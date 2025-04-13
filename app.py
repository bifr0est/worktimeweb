# worktimeweb/app.py
import os
import logging
from datetime import datetime, timedelta
# send_file is not needed when serving PWA files from /static
from flask import Flask, render_template, request, jsonify
import pytz

# --- Configuration Loading Helper ---

def get_env_int(key, default):
    """Helper to get an integer environment variable with a default."""
    try:
        return int(os.getenv(key, default))
    except ValueError:
        logging.warning(f"Invalid integer value for env var {key}. Using default: {default}")
        return default

# Load configuration using the helper
STANDARD_BREAK_MINUTES = get_env_int("STANDARD_BREAK_MINUTES", 30)
WORK_HOURS_REGULAR = get_env_int("WORK_HOURS_REGULAR", 8)
WORK_MINUTES_REGULAR = get_env_int("WORK_MINUTES_REGULAR", 0)
WORK_HOURS_FRIDAY = get_env_int("WORK_HOURS_FRIDAY", 6)
WORK_MINUTES_FRIDAY = get_env_int("WORK_MINUTES_FRIDAY", 30)

# Define constants derived from config
STANDARD_BREAK = timedelta(minutes=STANDARD_BREAK_MINUTES)
WORK_DURATION_REGULAR_NO_BREAK = timedelta(hours=WORK_HOURS_REGULAR, minutes=WORK_MINUTES_REGULAR)
WORK_DURATION_FRIDAY_NO_BREAK = timedelta(hours=WORK_HOURS_FRIDAY, minutes=WORK_MINUTES_FRIDAY)

# --- Timezone Helper ---

def get_local_timezone():
    """Gets the configured timezone or defaults to Europe/Vienna."""
    tz_name = os.getenv("TIMEZONE", "Europe/Vienna")
    try:
        return pytz.timezone(tz_name)
    except pytz.UnknownTimeZoneError:
        # Use app logger if app context is available, otherwise default logger
        logger = app.logger if app else logging.getLogger()
        logger.warning(f"Unknown timezone '{tz_name}', falling back to UTC.")
        return pytz.utc

LOCAL_TZ = get_local_timezone() # Get timezone once on startup

# --- App Setup ---
# Relies on default 'static' folder convention for CSS, JS, manifest, SW etc.
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "default-dev-secret-key-insecure")
logging.basicConfig(level=logging.INFO) # Basic logging config

# --- Calculation Logic Helper ---

class CalculationError(ValueError):
    """Custom exception for calculation errors."""
    pass

def perform_time_calculations(start_time_str, long_break_checked, break_hours_str, break_minutes_str):
    """Performs the core time tracking calculations."""
    # --- Time Parsing and Timezone Conversion ---
    try:
        start_time_naive = datetime.strptime(start_time_str, '%H:%M').time()
    except ValueError:
        raise CalculationError("Invalid start time format. Please use HH:MM.")

    now_local = datetime.now(LOCAL_TZ)
    try:
        start_datetime_local = LOCAL_TZ.localize(datetime.combine(now_local.date(), start_time_naive))
    except Exception as e:
         app.logger.error(f"Error localizing start time: {e}", exc_info=True)
         raise CalculationError("Could not determine start datetime.")

    if now_local < start_datetime_local:
        raise CalculationError("Start time appears to be in the future.")

    # --- Determine Work Duration ---
    day_of_week = start_datetime_local.weekday() # Monday is 0, Sunday is 6
    if day_of_week < 4: # Mon-Thu
        base_work_duration = WORK_DURATION_REGULAR_NO_BREAK
        required_total_duration = base_work_duration + STANDARD_BREAK
        day_type = f"Regular ({required_total_duration.total_seconds() / 3600:.2f}h)"
    elif day_of_week == 4: # Fri
        base_work_duration = WORK_DURATION_FRIDAY_NO_BREAK
        required_total_duration = base_work_duration + STANDARD_BREAK
        day_type = f"Friday ({required_total_duration.total_seconds() / 3600:.2f}h)"
    else: # Weekend
        raise CalculationError("It's the weekend!")

    # --- Calculate Break Adjustment ---
    entered_break_duration = timedelta(0)
    extra_break_time = timedelta(0)
    if long_break_checked:
        try:
            break_hours = int(break_hours_str)
            break_minutes = int(break_minutes_str)
            if break_hours < 0 or break_minutes < 0 or break_minutes >= 60:
                raise ValueError("Invalid break time values.")
            entered_break_duration = timedelta(hours=break_hours, minutes=break_minutes)
            if entered_break_duration > STANDARD_BREAK:
                extra_break_time = entered_break_duration - STANDARD_BREAK
        except (ValueError, TypeError):
             raise CalculationError("Invalid break time entered.")
    else:
        entered_break_duration = STANDARD_BREAK

    # --- Calculate End Time ---
    end_datetime_local = start_datetime_local + base_work_duration + entered_break_duration

    # --- Calculate Worked/Elapsed Time ---
    elapsed_time = now_local - start_datetime_local
    if elapsed_time.total_seconds() < 0: elapsed_time = timedelta(0)
    elapsed_total_seconds = int(elapsed_time.total_seconds())
    elapsed_hours = elapsed_total_seconds // 3600
    elapsed_minutes = (elapsed_total_seconds % 3600) // 60
    worked_str = f"{elapsed_hours:02d}h {elapsed_minutes:02d}m"

    # --- Calculate Status ---
    required_seconds = int(required_total_duration.total_seconds() + extra_break_time.total_seconds())
    actual_worked_seconds = elapsed_total_seconds - int(entered_break_duration.total_seconds())
    if actual_worked_seconds < 0: actual_worked_seconds = 0
    if now_local < end_datetime_local:
        remaining_time = end_datetime_local - now_local; rem_total_seconds = int(remaining_time.total_seconds())
        r_hours = rem_total_seconds // 3600; r_minutes = (rem_total_seconds % 3600) // 60
        status = f"Remaining: {r_hours:02d}h {r_minutes:02d}m"
    else:
        overtime = now_local - end_datetime_local; over_total_seconds = int(overtime.total_seconds())
        o_hours = over_total_seconds // 3600; o_minutes = (over_total_seconds % 3600) // 60
        status = f"Overtime: {o_hours:02d}h {o_minutes:02d}m"
        if extra_break_time > timedelta(0): status += f" (incl. {int(extra_break_time.total_seconds() / 60)} min extra break)"

    # --- Return Results Dictionary ---
    return {
        'end_time': end_datetime_local.strftime('%H:%M'), 'day_type': day_type,
        'worked': worked_str, 'status': status, 'worked_seconds': actual_worked_seconds,
        'required_seconds': required_seconds, 'break_seconds': int(entered_break_duration.total_seconds()),
        'timezone': LOCAL_TZ.zone
    }

# --- Web Routes ---

@app.route('/')
def index():
    """Serves the main HTML page."""
    return render_template('index.html',
                           start_time_value='', long_break_checked=False,
                           break_hours_value='0', break_minutes_value='0')

@app.route('/calculate', methods=['POST'])
def calculate_route():
    """Handles calculation requests via AJAX and returns JSON."""
    data = request.json
    if not data: return jsonify({"error": "Invalid request format."}), 400

    # Use .get with defaults for robustness, though JS sends them
    start_time_str = data.get('start_time', '').strip()
    long_break_checked = data.get('long_break', False)
    break_hours_str = data.get('break_hours', '0')
    break_minutes_str = data.get('break_minutes', '0')

    try:
        result_data = perform_time_calculations(
            start_time_str, long_break_checked,
            break_hours_str, break_minutes_str
        )
        return jsonify(result_data)
    except CalculationError as e:
        # Handle specific calculation errors
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        # Catch any other unexpected errors
        app.logger.error(f"Unexpected calculation error: {e}", exc_info=True)
        return jsonify({"error": "An unexpected calculation error occurred."}), 500

# --- Security Headers ---

@app.after_request
def add_security_headers(response):
    """Adds security headers to all responses."""
    response.headers['Cache-Control'] = 'public, max-age=3600' # Cache static assets
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers.pop('Server', None) # Remove server identification
    # Consider adding Content-Security-Policy header here for extra security
    # response.headers['Content-Security-Policy'] = "default-src 'self'; ..."
    return response

# --- Main Execution Guard ---

if __name__ == '__main__':
    # Debug mode should be disabled in production (controlled by env var or config)
    debug_mode = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    # Use 0.0.0.0 to be accessible within Docker container network
    # Port 5000 is standard for Flask dev, Gunicorn binds in production (Dockerfile)
    app.run(host='0.0.0.0', port=5000, debug=debug_mode)
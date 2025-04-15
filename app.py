# worktimeweb/app.py
import os
import logging
from datetime import datetime, timedelta
# Removed url_for as it's no longer needed in add_headers for SW path
from flask import Flask, render_template, request, jsonify
import pytz

# --- Configuration Loading Helper ---

def get_env_int(key, default):
    """Helper to get an integer environment variable with a default."""
    try:
        return int(os.getenv(key, default))
    except ValueError:
        # Use standard logging here as app context might not be available
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
        # Directly use standard logging if the timezone name is invalid
        logger = logging.getLogger(__name__)
        logger.warning(f"Unknown timezone '{tz_name}', falling back to UTC.")
        return pytz.utc

LOCAL_TZ = get_local_timezone() # Get timezone once on startup

# --- App Setup ---
# Relies on default 'static' folder convention for CSS, JS, manifest, SW etc.
app = Flask(__name__)

# !!! IMPORTANT: Set the FLASK_SECRET_KEY environment variable to a strong, random value in production!
# The default key below is INSECURE and for development ONLY.
app.secret_key = os.getenv("FLASK_SECRET_KEY", "default-dev-secret-key-insecure")

# Configure Flask logging
logging.basicConfig(level=logging.INFO) # Basic logging config for startup
app.logger.setLevel(logging.INFO) # Ensure Flask app logger level is set

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
        # Combine the current date with the parsed start time
        start_datetime_local = LOCAL_TZ.localize(datetime.combine(now_local.date(), start_time_naive))
    except Exception as e:
         app.logger.error(f"Error localizing start time: {e}", exc_info=True)
         raise CalculationError("Could not determine start datetime.")

    # Check if start time is in the future relative to current time
    if now_local < start_datetime_local:
        raise CalculationError("Start time cannot be in the future relative to the current time.")

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
        # Changed error message to be more informational
        raise CalculationError("Calculations are not applicable on weekends.")

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
            # Calculate extra break time ONLY if entered break exceeds standard break
            if entered_break_duration > STANDARD_BREAK:
                extra_break_time = entered_break_duration - STANDARD_BREAK
            else:
                # If entered break is less than or equal to standard, treat it as standard for end time calculation BUT NO extra time
                entered_break_duration = STANDARD_BREAK # Correction: Use actual entered time if <= standard
                extra_break_time = timedelta(0)          # Ensure no extra time if break <= standard

        except (ValueError, TypeError):
             raise CalculationError("Invalid break time entered. Please use whole numbers.")
    else:
        # If no long break, use the standard break duration
        entered_break_duration = STANDARD_BREAK
        extra_break_time = timedelta(0) # Ensure extra break is zero

    # --- Calculate End Time ---
    # End time is start time + base work duration + the *total* entered break duration
    end_datetime_local = start_datetime_local + base_work_duration + entered_break_duration

    # --- Calculate Worked/Elapsed Time ---
    elapsed_time = now_local - start_datetime_local
    if elapsed_time.total_seconds() < 0: elapsed_time = timedelta(0)
    elapsed_total_seconds = int(elapsed_time.total_seconds())
    elapsed_hours = elapsed_total_seconds // 3600
    elapsed_minutes = (elapsed_total_seconds % 3600) // 60
    worked_str = f"{elapsed_hours:02d}h {elapsed_minutes:02d}m"

    # --- Calculate Status ---
    # Required total duration includes the standard break
    required_seconds = int(required_total_duration.total_seconds())

    # *** FIX FOR PROGRESS BAR ***
    # Adjust required_seconds to account for any extra break time taken
    # This ensures the progress bar target reflects the actual total time needed
    if extra_break_time > timedelta(0):
        required_seconds += int(extra_break_time.total_seconds())
    # *** END FIX ***

    # Calculate status based on comparison with the calculated end time
    if now_local < end_datetime_local:
        remaining_time = end_datetime_local - now_local
        rem_total_seconds = int(remaining_time.total_seconds())
        r_hours = rem_total_seconds // 3600
        r_minutes = (rem_total_seconds % 3600) // 60
        status = f"Remaining: {r_hours:02d}h {r_minutes:02d}m"
    else:
        overtime = now_local - end_datetime_local
        over_total_seconds = int(overtime.total_seconds())
        o_hours = over_total_seconds // 3600
        o_minutes = (over_total_seconds % 3600) // 60
        status = f"Overtime: {o_hours:02d}h {o_minutes:02d}m"
        # Optionally indicate if extra break contributed
        if extra_break_time > timedelta(0):
             status += f" (incl. {int(extra_break_time.total_seconds() / 60)} min extra break)"

    # --- Return Results Dictionary ---
    return {
        'end_time': end_datetime_local.strftime('%H:%M'),
        'day_type': day_type,
        'worked': worked_str, # This is Elapsed Time String
        'status': status,
        'elapsed_seconds': elapsed_total_seconds, # Total time since start
        'required_seconds': required_seconds, # Target duration INCLUDING standard AND extra break time
        'break_seconds': int(entered_break_duration.total_seconds()), # Actual break duration used
        'timezone': LOCAL_TZ.zone
    }

# --- Web Routes ---

@app.route('/')
def index():
    """Serves the main HTML page."""
    return render_template('index.html')

@app.route('/calculate', methods=['POST'])
def calculate_route():
    """Handles calculation requests via AJAX and returns JSON."""
    data = request.json
    if not data:
        app.logger.warning("Received empty/invalid JSON data.")
        return jsonify({"error": "Invalid request format."}), 400

    # Get data safely using .get() with defaults and strip whitespace
    start_time_str = data.get('start_time', '').strip()
    long_break_checked = data.get('long_break', False)
    break_hours_str = data.get('break_hours', '0').strip()
    break_minutes_str = data.get('break_minutes', '0').strip()

    # Basic check for start time presence
    if not start_time_str:
        return jsonify({"error": "Start time is required."}), 400

    try:
        result_data = perform_time_calculations(
            start_time_str, long_break_checked,
            break_hours_str, break_minutes_str
        )
        return jsonify(result_data)
    except CalculationError as e:
        # Log calculation errors specifically
        app.logger.info(f"CalculationError: {e}")
        return jsonify({"error": str(e)}), 400 # Return 400 for expected calculation issues
    except Exception as e:
        # Log unexpected errors
        app.logger.error(f"Unexpected calculation error: {e}", exc_info=True)
        return jsonify({"error": "An unexpected server error occurred."}), 500

# --- Headers and Service Worker Scope Handling ---

@app.after_request
def add_headers(response):
    """Adds security headers and Service-Worker-Allowed header."""

    # Add security headers
    response.headers['Cache-Control'] = 'public, max-age=3600' # Allow caching for 1 hour
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers.pop('Server', None) # Remove default Server header

    # --- Add Service-Worker-Allowed header ONLY for the service worker script ---
    # Directly compare request path to the known static path for the service worker
    sw_path = '/static/service-worker.js'
    if request.path == sw_path:
        response.headers['Service-Worker-Allowed'] = '/'
        # Optional: log when header is added for debugging
        # app.logger.debug(f"Added Service-Worker-Allowed header for {request.path}")

    return response

# --- Main Execution Guard ---

if __name__ == '__main__':
    # Use Gunicorn in production instead of Flask's built-in server
    # The Flask dev server is run via 'flask run' command which respects FLASK_DEBUG
    debug_mode = os.getenv("FLASK_DEBUG", "False").lower() in ("true", "1", "t")
    # Port can also be configured via environment variable if needed
    port = int(os.getenv("PORT", 5000))
    # host='0.0.0.0' makes it accessible externally, crucial for Docker/deployment
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
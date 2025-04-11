# worktimeweb/app.py
import os
from flask import Flask, render_template, request, jsonify
from datetime import datetime, timedelta
import pytz # Added for timezone handling
import logging # Optional: for logging errors

# --- Configuration via Environment Variables (with defaults) ---
try:
    STANDARD_BREAK_MINUTES = int(os.getenv("STANDARD_BREAK_MINUTES", "30"))
except ValueError:
    STANDARD_BREAK_MINUTES = 30

try:
    # Monday-Thursday Work Time
    WORK_HOURS_REGULAR = int(os.getenv("WORK_HOURS_REGULAR", "8"))
    WORK_MINUTES_REGULAR = int(os.getenv("WORK_MINUTES_REGULAR", "0")) # Note: Break is ADDED later
except ValueError:
    WORK_HOURS_REGULAR = 8
    WORK_MINUTES_REGULAR = 0

try:
    # Friday Work Time
    WORK_HOURS_FRIDAY = int(os.getenv("WORK_HOURS_FRIDAY", "6"))
    WORK_MINUTES_FRIDAY = int(os.getenv("WORK_MINUTES_FRIDAY", "30")) # Note: Break is ADDED later
except ValueError:
    WORK_HOURS_FRIDAY = 6
    WORK_MINUTES_FRIDAY = 30

# Define standard break timedelta
STANDARD_BREAK = timedelta(minutes=STANDARD_BREAK_MINUTES)
# Define work durations WITHOUT standard break (it gets added)
WORK_DURATION_REGULAR_NO_BREAK = timedelta(hours=WORK_HOURS_REGULAR, minutes=WORK_MINUTES_REGULAR)
WORK_DURATION_FRIDAY_NO_BREAK = timedelta(hours=WORK_HOURS_FRIDAY, minutes=WORK_MINUTES_FRIDAY)

# --- App Setup ---
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "default-dev-secret-key-insecure")

# Configure logging
logging.basicConfig(level=logging.INFO)


# --- Timezone Helper ---
def get_local_timezone():
    # Attempt to get timezone from env, default to user's location
    tz_name = os.getenv("TIMEZONE", "Europe/Vienna")
    try:
        return pytz.timezone(tz_name)
    except pytz.UnknownTimeZoneError:
        app.logger.warning(f"Unknown timezone '{tz_name}', falling back to UTC.")
        return pytz.utc

LOCAL_TZ = get_local_timezone()

# --- Routes ---
@app.route('/')
def index():
    # This route now just serves the HTML page
    # Initial form values can be set here if needed, or handled by JS
    return render_template('index.html',
                           start_time_value='',
                           long_break_checked=False,
                           break_hours_value='0',
                           break_minutes_value='0')

@app.route('/calculate', methods=['POST'])
def calculate():
    # This route handles calculations and returns JSON
    data = request.json
    if not data:
        return jsonify({"error": "Invalid request format."}), 400

    start_time_str = data.get('start_time', '').strip()
    long_break_checked = data.get('long_break', False)
    break_hours_str = data.get('break_hours', '0')
    break_minutes_str = data.get('break_minutes', '0')
    # Note: Timezone offset is no longer needed from client

    try:
        # --- Time Parsing and Timezone Conversion ---
        start_time_naive = datetime.strptime(start_time_str, '%H:%M').time()

        # Get current time in the target timezone
        now_local = datetime.now(LOCAL_TZ)
        # Combine user's start time with today's date in local timezone
        start_datetime_local = LOCAL_TZ.localize(datetime.combine(now_local.date(), start_time_naive))

        # --- Determine Work Duration ---
        day_of_week = start_datetime_local.weekday()
        if day_of_week < 4: # Mon-Thu
            base_work_duration = WORK_DURATION_REGULAR_NO_BREAK
            required_total_duration = base_work_duration + STANDARD_BREAK
            day_type = f"Regular ({required_total_duration.total_seconds() / 3600:.2f}h)"
        elif day_of_week == 4: # Fri
            base_work_duration = WORK_DURATION_FRIDAY_NO_BREAK
            required_total_duration = base_work_duration + STANDARD_BREAK
            day_type = f"Friday ({required_total_duration.total_seconds() / 3600:.2f}h)"
        else:
            return jsonify({"error": "It's the weekend!"}), 400 # Return error as JSON

        # Check if start time is in the future relative to current time
        if now_local < start_datetime_local:
             return jsonify({"error": "Start time appears to be in the future."}), 400

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
                # else: break was shorter/equal standard, no adjustment
            except (ValueError, TypeError):
                 return jsonify({"error": "Invalid break time entered."}), 400
        else:
             entered_break_duration = STANDARD_BREAK # Assume standard break if not checked

        # --- Calculate End Time ---
        # End time = Start + Base Work Duration + Total Entered Break
        # This correctly handles breaks longer or shorter than standard
        end_datetime_local = start_datetime_local + base_work_duration + entered_break_duration

        # --- Calculate Worked/Elapsed Time ---
        # Elapsed since start
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
            if extra_break_time > timedelta(0):
                 status += f" (incl. {int(extra_break_time.total_seconds() / 60)} min extra break)"

        # --- Prepare JSON Response ---
        response_data = {
            'end_time': end_datetime_local.strftime('%H:%M'),
            'day_type': day_type,
            'worked': worked_str, # Elapsed time string
            'status': status,
            # Data for potential progress bar:
            'worked_seconds': actual_worked_seconds,
            'required_seconds': required_seconds,
            'break_seconds': int(entered_break_duration.total_seconds()),
            'timezone': LOCAL_TZ.zone
        }
        return jsonify(response_data)

    except ValueError as e:
        # Handle invalid start time format
        if "time data" in str(e):
             return jsonify({"error": "Invalid start time format. Please use HH:MM."}), 400
        else:
             app.logger.error(f"Calculation ValueError: {e}", exc_info=True)
             return jsonify({"error": "Invalid input value."}), 400
    except Exception as e:
        app.logger.error(f"Calculation error: {e}", exc_info=True)
        return jsonify({"error": "An unexpected calculation error occurred."}), 500


@app.after_request
def add_security_headers(response):
    # Security headers remain the same
    response.headers['Cache-Control'] = 'public, max-age=3600'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers.pop('Server', None)
    return response

if __name__ == '__main__':
    debug_mode = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    app.run(host='0.0.0.0', port=5000, debug=debug_mode)
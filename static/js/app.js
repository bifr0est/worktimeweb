// worktimeweb/static/js/app.js

// --- Local Storage Keys ---
const LS_START_TIME_KEY = 'worktimeweb_startTime';
const LS_START_TIME_DATE_KEY = 'worktimeweb_startTimeDate'; // Keep date key
const LS_LONG_BREAK_KEY = 'worktimeweb_longBreakChecked';
const LS_BREAK_HOURS_KEY = 'worktimeweb_breakHours';
const LS_BREAK_MINUTES_KEY = 'worktimeweb_breakMinutes';
const LS_AUTO_REFRESH_KEY = 'worktimeweb_autoRefreshChecked';

// --- Element References ---
const calculateButton = document.getElementById('calculate-button');
const startTimeInput = document.getElementById('start_time');
const longBreakCheckbox = document.getElementById('long_break');
const breakDetailsDiv = document.getElementById('break-details');
const breakHoursInput = document.getElementById('break_hours');
const breakMinutesInput = document.getElementById('break_minutes');
const autoRefreshCheckbox = document.getElementById('auto_refresh');
const errorDisplay = document.getElementById('error-display');
const errorMessage = document.getElementById('error-message');
const resultsDisplay = document.getElementById('results-display');
const resultEndTime = document.getElementById('result-end-time');
const resultDayType = document.getElementById('result-day-type');
const resultWorked = document.getElementById('result-worked');
const resultStatus = document.getElementById('result-status');
const resultTimezone = document.getElementById('result-timezone');
const progressBarContainer = document.getElementById('progress-bar-container');
const progressBarInner = document.getElementById('progress-bar-inner');
const themeToggle = document.getElementById('theme-checkbox');

let refreshInterval = null;
let isCalculating = false;

// --- Helper Function to get current date as YYYY-MM-DD ---
function getCurrentDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// --- Load Saved Values on Page Load ---
function loadSavedValues() {
    const savedStartTime = localStorage.getItem(LS_START_TIME_KEY);
    const savedStartTimeDate = localStorage.getItem(LS_START_TIME_DATE_KEY);
    const savedLongBreak = localStorage.getItem(LS_LONG_BREAK_KEY);
    const savedBreakHours = localStorage.getItem(LS_BREAK_HOURS_KEY);
    const savedBreakMinutes = localStorage.getItem(LS_BREAK_MINUTES_KEY);
    const savedAutoRefresh = localStorage.getItem(LS_AUTO_REFRESH_KEY);
    const todayDateString = getCurrentDateString();

    // Load start time only if saved date matches today
    if (savedStartTime && startTimeInput && savedStartTimeDate === todayDateString) {
        startTimeInput.value = savedStartTime;
    } else if (startTimeInput) {
        startTimeInput.value = ''; // Clear start time if stale
    }

    // Load other settings
    if (savedLongBreak && longBreakCheckbox) { longBreakCheckbox.checked = (savedLongBreak === 'true'); }
    if (savedBreakHours && breakHoursInput) { breakHoursInput.value = savedBreakHours; }
    if (savedBreakMinutes && breakMinutesInput) { breakMinutesInput.value = savedBreakMinutes; }
    if (savedAutoRefresh && autoRefreshCheckbox) {
        autoRefreshCheckbox.checked = (savedAutoRefresh === 'true');
        if (autoRefreshCheckbox.checked) {
            // Delay initial auto-refresh calculation slightly to ensure UI is ready
            setTimeout(startAutoRefresh, 500);
        }
    }

    // Update break details visibility based on loaded checkbox state
    if (longBreakCheckbox) { toggleBreakDetails(); }

    // Apply saved theme preference if it exists
    if (localStorage.getItem('worktimeweb_darkMode') === 'true' && themeToggle) {
        themeToggle.checked = true;
        document.body.classList.add('dark-mode');
    }
}

// --- Save Values to Local Storage ---
function saveCurrentValues() {
    const todayDateString = getCurrentDateString();

    // Save inputs after a successful calculation
    if (startTimeInput) {
        localStorage.setItem(LS_START_TIME_KEY, startTimeInput.value);
        localStorage.setItem(LS_START_TIME_DATE_KEY, todayDateString);
    }
    if (longBreakCheckbox) { localStorage.setItem(LS_LONG_BREAK_KEY, longBreakCheckbox.checked); }
    if (breakHoursInput) { localStorage.setItem(LS_BREAK_HOURS_KEY, breakHoursInput.value); }
    if (breakMinutesInput) { localStorage.setItem(LS_BREAK_MINUTES_KEY, breakMinutesInput.value); }
    // Auto-refresh state is saved in its own event listener
}


// --- Theme Toggle ---
function applyThemeChange() {
    const isDarkMode = themeToggle.checked;
    document.body.classList.toggle('dark-mode', isDarkMode);
    localStorage.setItem('worktimeweb_darkMode', isDarkMode); // Save preference
}
if (themeToggle) { themeToggle.addEventListener('change', applyThemeChange); }


// --- Break Input Visibility ---
function toggleBreakDetails() {
    if (!breakDetailsDiv) return;
    requestAnimationFrame(() => { // Use requestAnimationFrame for smoother transitions
        if (longBreakCheckbox && longBreakCheckbox.checked) {
            breakDetailsDiv.style.maxHeight = breakDetailsDiv.scrollHeight + "px";
            breakDetailsDiv.style.opacity = '1';
            breakDetailsDiv.style.marginTop = '1rem';
            breakDetailsDiv.style.padding = '1rem';
            breakDetailsDiv.style.border = '1px solid var(--border-color)';
        } else {
            breakDetailsDiv.style.maxHeight = '0';
            breakDetailsDiv.style.opacity = '0';
            breakDetailsDiv.style.marginTop = '0';
            // Delay removing padding/border until after collapse transition
            setTimeout(() => {
                if (!longBreakCheckbox || !longBreakCheckbox.checked) {
                    breakDetailsDiv.style.padding = '0 1rem';
                    breakDetailsDiv.style.border = 'none';
                }
            }, 400); // Match transition duration
        }
    });
}
if (longBreakCheckbox) { longBreakCheckbox.addEventListener('change', toggleBreakDetails); }


// --- Error Handling ---
function showError(message) {
    if (errorMessage && errorDisplay && resultsDisplay) {
        errorMessage.textContent = message;
        errorDisplay.classList.remove('d-none');
        resultsDisplay.classList.add('d-none'); // Hide results when showing error
        progressBarContainer?.classList.add('d-none'); // Hide progress bar on error
    }
}
function hideError() {
    if (errorDisplay) errorDisplay.classList.add('d-none');
}

// --- Update Results Display ---
function updateResults(data) {
    if (!resultEndTime || !resultDayType || !resultWorked || !resultStatus || !resultTimezone || !resultsDisplay) {
        console.error("One or more result display elements are missing.");
        showError("Internal UI error: Could not display results."); // Show user-friendly error
        return;
    }
    resultEndTime.textContent = data.end_time;
    resultDayType.textContent = `(${data.day_type})`;
    resultWorked.textContent = data.worked;
    resultStatus.textContent = data.status;
    resultTimezone.textContent = data.timezone;

    // Handle progress bar update
    if (progressBarContainer && progressBarInner && data.required_seconds != null && data.elapsed_seconds != null && data.required_seconds > 0) {
        let progressPercent = 0;
        if (data.elapsed_seconds >= data.required_seconds) {
            progressPercent = 100;
        } else {
            let progress = Math.max(0, (data.elapsed_seconds / data.required_seconds) * 100);
            progressPercent = Math.round(progress);
        }
        progressBarInner.style.width = progressPercent + '%';
        progressBarInner.textContent = progressPercent + '%';
        progressBarInner.setAttribute('aria-valuenow', progressPercent);
        progressBarContainer.classList.remove('d-none');
    } else if (progressBarContainer) {
        progressBarContainer.classList.add('d-none');
    }
    resultsDisplay.classList.remove('d-none'); // Show results area
}

// --- Set Loading State ---
function setLoadingState(loading) {
    isCalculating = loading;
    if (calculateButton) {
        const buttonText = calculateButton.querySelector('.button-text');
        const spinner = calculateButton.querySelector('.spinner-border');
        const icon = calculateButton.querySelector('.button-icon');

        calculateButton.disabled = loading; // Disable/enable button

        if (loading) {
            if (buttonText) buttonText.textContent = 'Calculating...';
            if (spinner) spinner.classList.remove('d-none');
            if (icon) icon.classList.add('d-none');
        } else {
            if (buttonText) buttonText.textContent = 'Calculate';
            if (spinner) spinner.classList.add('d-none');
            if (icon) icon.classList.remove('d-none');
        }
    }
}

// --- Perform Calculation (AJAX) ---
async function performCalculation() {
    if (isCalculating) return; // Prevent concurrent calculations

    hideError(); // Clear previous errors

    // --- Client-Side Input Validation ---
    if (!startTimeInput || !startTimeInput.value || !startTimeInput.checkValidity()) {
        showError("Please enter a valid start time (HH:MM).");
        startTimeInput?.focus();
        return;
    }

    let breakHours = 0;
    let breakMinutes = 0;

    if (longBreakCheckbox && longBreakCheckbox.checked) {
        if (!breakHoursInput || !breakMinutesInput) {
             showError("Internal UI Error: Break input fields not found.");
             return;
        }

        // Validate break hours
        const hoursValue = breakHoursInput.value.trim();
        if (hoursValue === '' || isNaN(hoursValue) || parseInt(hoursValue) < 0) {
            showError("Please enter a valid non-negative number for break hours.");
            breakHoursInput.focus();
            return;
        }
        breakHours = parseInt(hoursValue);

        // Validate break minutes
        const minutesValue = breakMinutesInput.value.trim();
        if (minutesValue === '' || isNaN(minutesValue) || parseInt(minutesValue) < 0 || parseInt(minutesValue) > 59) {
            showError("Please enter a valid number between 0 and 59 for break minutes.");
            breakMinutesInput.focus();
            return;
        }
        breakMinutes = parseInt(minutesValue);
    }
    // --- End Validation ---

    setLoadingState(true); // Set loading state AFTER validation

    const dataToSend = {
        start_time: startTimeInput.value,
        long_break: longBreakCheckbox ? longBreakCheckbox.checked : false,
        // Send validated numbers as strings (backend expects strings)
        break_hours: String(breakHours),
        break_minutes: String(breakMinutes),
    };

    try {
        const response = await fetch('/calculate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json', // Indicate we expect JSON back
            },
            body: JSON.stringify(dataToSend),
        });

        // --- Improved Error Handling ---
        if (!response.ok) {
            let errorMsg = `Server Error: ${response.status} ${response.statusText}`; // Default message
            const contentType = response.headers.get('content-type');

            // Try to parse JSON error only if content type is correct
            if (contentType && contentType.includes('application/json')) {
                try {
                    const errorResult = await response.json();
                    // Use server error if available, otherwise keep default
                    errorMsg = errorResult.error || errorMsg;
                } catch (parseError) {
                    console.error('Failed to parse JSON error response:', parseError);
                    // Keep the default message if JSON parsing fails
                }
            } else {
                // Handle non-JSON error responses (e.g., HTML error pages)
                console.warn(`Received non-JSON error response (Content-Type: ${contentType})`);
                // Could potentially try response.text() here if needed
            }
            showError(errorMsg); // Show the determined error message
        } else {
            // Success: Parse JSON, update UI, and save values
            const result = await response.json();
            updateResults(result);
            saveCurrentValues(); // Save only on successful calculation
        }
        // --- End Improved Error Handling ---

    } catch (networkError) {
        // Handle network errors (e.g., server down, CORS issues, DNS errors)
        console.error('Network or Fetch Error:', networkError);
        showError("Network Error: Could not connect to the server. Please check your connection.");
    } finally {
        // Always turn off loading state, regardless of success or failure
        setLoadingState(false);
    }
}

// --- Event Listeners ---
if (calculateButton) {
    calculateButton.addEventListener('click', performCalculation);
}
if (startTimeInput) {
    startTimeInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent default form submission if any
            performCalculation();
        }
    });
}
// Add Enter key listener to break inputs too, if they are visible
if (breakHoursInput) {
     breakHoursInput.addEventListener('keypress', function(event) {
         if (event.key === 'Enter') {
             event.preventDefault();
             performCalculation();
         }
     });
}
if (breakMinutesInput) {
     breakMinutesInput.addEventListener('keypress', function(event) {
         if (event.key === 'Enter') {
             event.preventDefault();
             performCalculation();
         }
     });
}

// --- Auto-Refresh Logic ---
function startAutoRefresh() {
    if (refreshInterval === null) { // Start only if not already running
        // Perform an initial calculation immediately *only if* start time is valid
        if (startTimeInput && startTimeInput.value && startTimeInput.checkValidity()) {
            performCalculation();
        }
        // Set interval to call performCalculation every 60 seconds
        refreshInterval = setInterval(performCalculation, 60000); // 60 seconds
        console.log("Auto-refresh started."); // Optional debug log
    }
}
function stopAutoRefresh() {
    if (refreshInterval !== null) { // Clear only if running
        clearInterval(refreshInterval);
        refreshInterval = null; // Reset variable
        console.log("Auto-refresh stopped."); // Optional debug log
    }
}

// Add event listener for the auto-refresh checkbox
if (autoRefreshCheckbox) {
    autoRefreshCheckbox.addEventListener('change', function() {
        localStorage.setItem(LS_AUTO_REFRESH_KEY, autoRefreshCheckbox.checked); // Save state immediately
        if (autoRefreshCheckbox.checked) {
            startAutoRefresh();
        } else {
            stopAutoRefresh();
        }
    });
}

// --- Initial Setup on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    loadSavedValues(); // Load saved values once the DOM is ready
});


// --- REMOVED Redundant Service Worker Registration ---
// The registration is now handled only in index.html using Flask's url_for
// worktimeweb/static/js/app.js

// --- Local Storage Keys ---
const LS_START_TIME_KEY = 'worktimeweb_startTime';
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

// --- Load Saved Values on Page Load ---
function loadSavedValues() {
    const savedStartTime = localStorage.getItem(LS_START_TIME_KEY);
    const savedLongBreak = localStorage.getItem(LS_LONG_BREAK_KEY);
    const savedBreakHours = localStorage.getItem(LS_BREAK_HOURS_KEY);
    const savedBreakMinutes = localStorage.getItem(LS_BREAK_MINUTES_KEY);
    const savedAutoRefresh = localStorage.getItem(LS_AUTO_REFRESH_KEY); // <-- Added Load

    if (savedStartTime && startTimeInput) {
        startTimeInput.value = savedStartTime;
    }
    if (savedLongBreak && longBreakCheckbox) {
        longBreakCheckbox.checked = (savedLongBreak === 'true'); // Convert string back to boolean
    }
    if (savedBreakHours && breakHoursInput) {
        breakHoursInput.value = savedBreakHours;
    }
    if (savedBreakMinutes && breakMinutesInput) {
        breakMinutesInput.value = savedBreakMinutes;
    }
     if (savedAutoRefresh && autoRefreshCheckbox) { // <-- Added Load Logic
         autoRefreshCheckbox.checked = (savedAutoRefresh === 'true');
         // --- Trigger action based on loaded state ---
         if (autoRefreshCheckbox.checked) {
             // Only start if results are already displayed perhaps? Or just start.
             // Let's start it regardless, performCalculation handles missing time.
             startAutoRefresh();
         }
         // --- End trigger ---
     }


    // Update break details visibility based on loaded checkbox state
    if (longBreakCheckbox) {
        toggleBreakDetails();
    }
}

// --- Save Values to Local Storage ---
function saveCurrentValues() {
    // Saves inputs after a successful calculation
    if (startTimeInput) {
        localStorage.setItem(LS_START_TIME_KEY, startTimeInput.value);
    }
    if (longBreakCheckbox) {
        localStorage.setItem(LS_LONG_BREAK_KEY, longBreakCheckbox.checked);
    }
    if (breakHoursInput) {
        localStorage.setItem(LS_BREAK_HOURS_KEY, breakHoursInput.value);
    }
    if (breakMinutesInput) {
        localStorage.setItem(LS_BREAK_MINUTES_KEY, breakMinutesInput.value);
    }
    // Auto-refresh state is saved in its own event listener now
}


// --- Theme Toggle ---
if (themeToggle) { // Check if element exists
    themeToggle.addEventListener('change', () => {
        document.body.classList.toggle('dark-mode');
    });
}


// --- Break Input Visibility ---
function toggleBreakDetails() {
     if (!breakDetailsDiv) return;
     requestAnimationFrame(() => {
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
             setTimeout(() => { if (!longBreakCheckbox || !longBreakCheckbox.checked) { breakDetailsDiv.style.padding = '0 1rem'; breakDetailsDiv.style.border = 'none'; } }, 400);
         }
     });
 }
if (longBreakCheckbox) { // Check if element exists
    longBreakCheckbox.addEventListener('change', toggleBreakDetails);
}


// --- Error Handling ---
function showError(message) {
    if(errorMessage && errorDisplay && resultsDisplay) {
        errorMessage.textContent = message;
        errorDisplay.classList.remove('d-none');
        resultsDisplay.classList.add('d-none');
    }
}
function hideError() {
    if(errorDisplay) errorDisplay.classList.add('d-none');
}

// --- Update Results Display ---
function updateResults(data) {
    if(!resultEndTime || !resultDayType || !resultWorked || !resultStatus || !resultTimezone || !resultsDisplay) return;

     resultEndTime.textContent = data.end_time;
     resultDayType.textContent = `(${data.day_type})`;
     resultWorked.textContent = data.worked;
     resultStatus.textContent = data.status;
     resultTimezone.textContent = data.timezone;

     // Progress Bar Logic
     if (progressBarContainer && progressBarInner && data.required_seconds != null && data.worked_seconds != null && data.required_seconds > 0) {
          let progress = Math.max(0, Math.min(100, (data.worked_seconds / data.required_seconds) * 100));
          let progressPercent = Math.round(progress);
          progressBarInner.style.width = progressPercent + '%';
          progressBarInner.textContent = progressPercent + '%';
          progressBarInner.setAttribute('aria-valuenow', progressPercent);
          progressBarContainer.classList.remove('d-none');
     } else if(progressBarContainer) {
          progressBarContainer.classList.add('d-none');
     }
     resultsDisplay.classList.remove('d-none');
}

// --- Set Loading State ---
function setLoadingState(loading) {
    isCalculating = loading;
    if (calculateButton) {
        calculateButton.disabled = loading;
        const spinner = calculateButton.querySelector('.spinner-border');
        const buttonText = calculateButton.querySelector('.button-text');
        const buttonIcon = calculateButton.querySelector('.button-icon');

        if (loading) {
            spinner?.classList.remove('d-none');
            if(buttonText) buttonText.textContent = 'Calculating...';
            buttonIcon?.classList.add('d-none');
        } else {
            spinner?.classList.add('d-none');
            if(buttonText) buttonText.textContent = 'Calculate';
            buttonIcon?.classList.remove('d-none');
        }
    }
}

// --- Perform Calculation (AJAX) ---
async function performCalculation() {
    if (isCalculating) return;

    hideError();
    if (!startTimeInput || !startTimeInput.value || !startTimeInput.checkValidity()) {
        // Don't necessarily show error if auto-refreshing with no time yet
        if(document.activeElement !== startTimeInput && refreshInterval !== null) {
            // If auto-refresh is running and input is empty/invalid but not focused, just stop
             console.log("Auto-refresh calculation skipped: Invalid start time.");
             setLoadingState(false); // Ensure button re-enables if loading was triggered
             return;
        }
        showError("Please enter a valid start time.");
        return;
    }
    // TODO: Add client-side validation for break inputs here

    setLoadingState(true);

    const dataToSend = {
        start_time: startTimeInput.value,
        long_break: longBreakCheckbox ? longBreakCheckbox.checked : false,
        break_hours: breakHoursInput ? breakHoursInput.value || '0' : '0',
        break_minutes: breakMinutesInput ? breakMinutesInput.value || '0' : '0'
    };

    try {
        const response = await fetch('/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(dataToSend),
        });

        const result = await response.json();

        if (!response.ok) {
            showError(result.error || `Server Error: ${response.statusText}`);
        } else {
            updateResults(result);
            // --- Save input values on successful calculation ---
            saveCurrentValues();
        }
    } catch (error) {
        console.error("Fetch error:", error);
        showError(`Network error: ${error.message}`);
    } finally {
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
            event.preventDefault();
            performCalculation();
        }
    });
}


// --- Auto-Refresh Logic ---
function startAutoRefresh(){
     if (refreshInterval === null) {
         // Perform calculation immediately ONLY if start time is valid
         if (startTimeInput && startTimeInput.value && startTimeInput.checkValidity()){
            performCalculation();
         } else {
             console.log("Auto-refresh enabled, but initial calculation skipped: Invalid start time.")
         }
         refreshInterval = setInterval(performCalculation, 60000);
         console.log("Auto-refresh interval started."); // Optional log
     }
 }
 function stopAutoRefresh(){
     if (refreshInterval !== null) {
         clearInterval(refreshInterval);
         refreshInterval = null;
         console.log("Auto-refresh stopped."); // Optional log
     }
 }

if (autoRefreshCheckbox) {
    autoRefreshCheckbox.addEventListener('change', function() {
        // Save state immediately when changed
        localStorage.setItem(LS_AUTO_REFRESH_KEY, autoRefreshCheckbox.checked); // <-- Added Save Logic Here
        if(autoRefreshCheckbox.checked) {
            startAutoRefresh();
        } else {
            stopAutoRefresh();
        }
    });
}

// --- Initial Setup on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    loadSavedValues(); // Load values AFTER DOM is ready
});


// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register("/static/service-worker.js") // Assuming reverted path
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(error => {
        console.error('ServiceWorker registration failed: ', error);
      });
  });
}
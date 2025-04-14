// worktimeweb/static/js/app.js

// --- Local Storage Keys ---
const LS_START_TIME_KEY = 'worktimeweb_startTime';
const LS_LONG_BREAK_KEY = 'worktimeweb_longBreakChecked';
const LS_BREAK_HOURS_KEY = 'worktimeweb_breakHours';
const LS_BREAK_MINUTES_KEY = 'worktimeweb_breakMinutes';

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

    // Update break details visibility based on loaded checkbox state
    if (longBreakCheckbox) {
        toggleBreakDetails();
    }
}

// --- Save Values to Local Storage ---
function saveCurrentValues() {
    if (startTimeInput) {
        localStorage.setItem(LS_START_TIME_KEY, startTimeInput.value);
    }
    if (longBreakCheckbox) {
        localStorage.setItem(LS_LONG_BREAK_KEY, longBreakCheckbox.checked); // Saves boolean as 'true'/'false'
    }
    if (breakHoursInput) {
        localStorage.setItem(LS_BREAK_HOURS_KEY, breakHoursInput.value);
    }
    if (breakMinutesInput) {
        localStorage.setItem(LS_BREAK_MINUTES_KEY, breakMinutesInput.value);
    }
}


// --- Theme Toggle ---
if (themeToggle) { // Check if element exists
    themeToggle.addEventListener('change', () => {
        document.body.classList.toggle('dark-mode');
        // Note: Theme preference is not saved and will reset on reload.
    });
}


// --- Break Input Visibility ---
function toggleBreakDetails() {
     if (!breakDetailsDiv) return; // Check if element exists
     // Use requestAnimationFrame for smoother transitions if needed
     requestAnimationFrame(() => {
         if (longBreakCheckbox && longBreakCheckbox.checked) { // Check element exists
             breakDetailsDiv.style.maxHeight = breakDetailsDiv.scrollHeight + "px";
             breakDetailsDiv.style.opacity = '1';
             breakDetailsDiv.style.marginTop = '1rem';
             breakDetailsDiv.style.padding = '1rem';
             breakDetailsDiv.style.border = '1px solid var(--border-color)';
         } else {
             breakDetailsDiv.style.maxHeight = '0';
             breakDetailsDiv.style.opacity = '0';
             breakDetailsDiv.style.marginTop = '0';
             // Delay hiding padding/border for transition out effect
             setTimeout(() => { if (!longBreakCheckbox || !longBreakCheckbox.checked) { breakDetailsDiv.style.padding = '0 1rem'; breakDetailsDiv.style.border = 'none'; } }, 400);
         }
     });
 }
if (longBreakCheckbox) { // Check if element exists
    longBreakCheckbox.addEventListener('change', toggleBreakDetails);
}


// --- Error Handling ---
function showError(message) {
    if(errorMessage && errorDisplay && resultsDisplay) { // Check elements exist
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
    // Check if all result elements exist
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
    // Check if start time input exists and is valid
    if (!startTimeInput || !startTimeInput.value || !startTimeInput.checkValidity()) {
        showError("Please enter a valid start time.");
        return;
    }
    // TODO: Add client-side validation for break inputs here

    setLoadingState(true);

    // Read values safely, checking if elements exist
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
            // --- Save values on successful calculation ---
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
         performCalculation();
         refreshInterval = setInterval(performCalculation, 60000);
     }
 }
 function stopAutoRefresh(){
     clearInterval(refreshInterval);
     refreshInterval = null;
 }

if (autoRefreshCheckbox) {
    autoRefreshCheckbox.addEventListener('change', function() {
        if(autoRefreshCheckbox.checked) {
            startAutoRefresh();
        } else {
            stopAutoRefresh();
        }
    });
}

// --- Initial Setup on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    loadSavedValues(); // Load values after DOM is ready
    // Any other setup that needs the DOM
});


// --- Service Worker Registration ---
// (Keep this registration code as it was, moved from index.html)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register("/static/service-worker.js") // Assuming reverted path
    // Or use "/service-worker.js" if using root path method
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(error => {
        console.error('ServiceWorker registration failed: ', error);
      });
  });
}
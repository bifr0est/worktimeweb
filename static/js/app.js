// worktimeweb/static/js/app.js

// --- Local Storage Keys ---
const LS_START_TIME_KEY = 'worktimeweb_startTime';
const LS_START_TIME_DATE_KEY = 'worktimeweb_startTimeDate'; // Keep date key
const LS_LONG_BREAK_KEY = 'worktimeweb_longBreakChecked';
const LS_BREAK_HOURS_KEY = 'worktimeweb_breakHours';
const LS_BREAK_MINUTES_KEY = 'worktimeweb_breakMinutes';
const LS_AUTO_REFRESH_KEY = 'worktimeweb_autoRefreshChecked'; // <-- Added Key

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
    const savedAutoRefresh = localStorage.getItem(LS_AUTO_REFRESH_KEY); // <-- Get saved auto-refresh state
    const todayDateString = getCurrentDateString();

    // --- Only load start time if saved date matches today ---
    if (savedStartTime && startTimeInput && savedStartTimeDate === todayDateString) {
        startTimeInput.value = savedStartTime;
    } else if (startTimeInput) {
        startTimeInput.value = ''; // Clear start time if stale
    }
    // --- End start time loading logic ---

    // Load other settings unconditionally
    if (savedLongBreak && longBreakCheckbox) { longBreakCheckbox.checked = (savedLongBreak === 'true'); }
    if (savedBreakHours && breakHoursInput) { breakHoursInput.value = savedBreakHours; }
    if (savedBreakMinutes && breakMinutesInput) { breakMinutesInput.value = savedBreakMinutes; }
     if (savedAutoRefresh && autoRefreshCheckbox) { // <-- Load auto-refresh state
         autoRefreshCheckbox.checked = (savedAutoRefresh === 'true');
         // --- Trigger action based on loaded state ---
         if (autoRefreshCheckbox.checked) {
             startAutoRefresh(); // Start timer if loaded as checked
         }
         // --- End trigger ---
     }

    // Update break details visibility based on loaded checkbox state
    if (longBreakCheckbox) { toggleBreakDetails(); }
}

// --- Save Values to Local Storage ---
function saveCurrentValues() {
    const todayDateString = getCurrentDateString();

    // Save inputs after a successful calculation
    if (startTimeInput) {
        localStorage.setItem(LS_START_TIME_KEY, startTimeInput.value);
        localStorage.setItem(LS_START_TIME_DATE_KEY, todayDateString); // <-- Save date too
    }
    if (longBreakCheckbox) { localStorage.setItem(LS_LONG_BREAK_KEY, longBreakCheckbox.checked); }
    if (breakHoursInput) { localStorage.setItem(LS_BREAK_HOURS_KEY, breakHoursInput.value); }
    if (breakMinutesInput) { localStorage.setItem(LS_BREAK_MINUTES_KEY, breakMinutesInput.value); }
    // Auto-refresh state is saved in its own event listener
}


// --- Theme Toggle ---
if (themeToggle) { themeToggle.addEventListener('change', () => { document.body.classList.toggle('dark-mode'); }); }


// --- Break Input Visibility ---
function toggleBreakDetails() {
     if (!breakDetailsDiv) return;
     requestAnimationFrame(() => {
         if (longBreakCheckbox && longBreakCheckbox.checked) {
             breakDetailsDiv.style.maxHeight = breakDetailsDiv.scrollHeight + "px";
             breakDetailsDiv.style.opacity = '1'; breakDetailsDiv.style.marginTop = '1rem';
             breakDetailsDiv.style.padding = '1rem'; breakDetailsDiv.style.border = '1px solid var(--border-color)';
         } else {
             breakDetailsDiv.style.maxHeight = '0'; breakDetailsDiv.style.opacity = '0';
             breakDetailsDiv.style.marginTop = '0';
             setTimeout(() => { if (!longBreakCheckbox || !longBreakCheckbox.checked) { breakDetailsDiv.style.padding = '0 1rem'; breakDetailsDiv.style.border = 'none'; } }, 400);
         }
     });
 }
if (longBreakCheckbox) { longBreakCheckbox.addEventListener('change', toggleBreakDetails); }


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
    // (This function including the corrected progress bar logic remains the same)
    if(!resultEndTime || !resultDayType || !resultWorked || !resultStatus || !resultTimezone || !resultsDisplay) return;
     resultEndTime.textContent = data.end_time;
     resultDayType.textContent = `(${data.day_type})`;
     resultWorked.textContent = data.worked;
     resultStatus.textContent = data.status;
     resultTimezone.textContent = data.timezone;
     if (progressBarContainer && progressBarInner && data.required_seconds != null && data.elapsed_seconds != null && data.required_seconds > 0) {
          let progressPercent = 0;
          if (data.elapsed_seconds >= data.required_seconds) { progressPercent = 100; }
          else { let progress = Math.max(0, (data.elapsed_seconds / data.required_seconds) * 100); progressPercent = Math.round(progress); }
          progressBarInner.style.width = progressPercent + '%';
          progressBarInner.textContent = progressPercent + '%';
          progressBarInner.setAttribute('aria-valuenow', progressPercent);
          progressBarContainer.classList.remove('d-none');
     } else if(progressBarContainer) { progressBarContainer.classList.add('d-none'); }
     resultsDisplay.classList.remove('d-none');
}

// --- Set Loading State ---
function setLoadingState(loading) {
    // (This function remains the same)
    isCalculating = loading;
    if (calculateButton) { /* ... */ }
}

// --- Perform Calculation (AJAX) ---
async function performCalculation() {
    // (This function remains the same - calls saveCurrentValues on success)
    if (isCalculating) return;
    hideError();
    if (!startTimeInput || !startTimeInput.value || !startTimeInput.checkValidity()) { /* ... */ }
    setLoadingState(true);
    const dataToSend = { /* ... */ };
    try {
        const response = await fetch('/calculate', { /* ... */ });
        const result = await response.json();
        if (!response.ok) { showError(result.error || `Server Error: ${response.statusText}`); }
        else { updateResults(result); saveCurrentValues(); } // Calls saveCurrentValues
    } catch (error) { /* ... */ }
    finally { setLoadingState(false); }
}

// --- Event Listeners ---
if (calculateButton) { calculateButton.addEventListener('click', performCalculation); }
if (startTimeInput) { startTimeInput.addEventListener('keypress', function(event) { if (event.key === 'Enter') { event.preventDefault(); performCalculation(); } }); }


// --- Auto-Refresh Logic ---
function startAutoRefresh(){
     if (refreshInterval === null) {
         if (startTimeInput && startTimeInput.value && startTimeInput.checkValidity()){ performCalculation(); }
         refreshInterval = setInterval(performCalculation, 60000);
     }
 }
 function stopAutoRefresh(){
     if (refreshInterval !== null) {
         clearInterval(refreshInterval); refreshInterval = null;
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
if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register("/static/service-worker.js").then(registration => {}).catch(error => { console.error('ServiceWorker registration failed: ', error); }); }); }
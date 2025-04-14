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
const resultWorked = document.getElementById('result-worked'); // Note: Displays 'elapsed' time string
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
    const savedAutoRefresh = localStorage.getItem(LS_AUTO_REFRESH_KEY);

    if (savedStartTime && startTimeInput) { startTimeInput.value = savedStartTime; }
    if (savedLongBreak && longBreakCheckbox) { longBreakCheckbox.checked = (savedLongBreak === 'true'); }
    if (savedBreakHours && breakHoursInput) { breakHoursInput.value = savedBreakHours; }
    if (savedBreakMinutes && breakMinutesInput) { breakMinutesInput.value = savedBreakMinutes; }
     if (savedAutoRefresh && autoRefreshCheckbox) {
         autoRefreshCheckbox.checked = (savedAutoRefresh === 'true');
         if (autoRefreshCheckbox.checked) { startAutoRefresh(); }
     }
    if (longBreakCheckbox) { toggleBreakDetails(); }
}

// --- Save Values to Local Storage ---
function saveCurrentValues() {
    if (startTimeInput) { localStorage.setItem(LS_START_TIME_KEY, startTimeInput.value); }
    if (longBreakCheckbox) { localStorage.setItem(LS_LONG_BREAK_KEY, longBreakCheckbox.checked); }
    if (breakHoursInput) { localStorage.setItem(LS_BREAK_HOURS_KEY, breakHoursInput.value); }
    if (breakMinutesInput) { localStorage.setItem(LS_BREAK_MINUTES_KEY, breakMinutesInput.value); }
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
function showError(message) { /* ... as before ... */ }
function hideError() { /* ... as before ... */ }

// --- Update Results Display ---
function updateResults(data) {
    if(!resultEndTime || !resultDayType || !resultWorked || !resultStatus || !resultTimezone || !resultsDisplay) return;

     resultEndTime.textContent = data.end_time;
     resultDayType.textContent = `(${data.day_type})`;
     resultWorked.textContent = data.worked; // This displays the 'elapsed' time string from backend
     resultStatus.textContent = data.status;
     resultTimezone.textContent = data.timezone;

     // --- ### UPDATED PROGRESS BAR LOGIC ### ---
     // Use elapsed_seconds vs required_seconds now
     if (progressBarContainer && progressBarInner && data.required_seconds != null && data.elapsed_seconds != null && data.required_seconds > 0) {
          let progressPercent = 0;
          // Check if required ELAPSED time is met or exceeded
          if (data.elapsed_seconds >= data.required_seconds) {
              progressPercent = 100; // Explicitly set to 100%
          } else {
              // Calculate percentage based on elapsed time vs required elapsed time
              let progress = Math.max(0, (data.elapsed_seconds / data.required_seconds) * 100);
              progressPercent = Math.round(progress);
          }
          // Update the progress bar UI
          progressBarInner.style.width = progressPercent + '%';
          progressBarInner.textContent = progressPercent + '%';
          progressBarInner.setAttribute('aria-valuenow', progressPercent);
          progressBarContainer.classList.remove('d-none');
     } else if(progressBarContainer) {
          // Hide if required seconds is 0 (e.g., weekend)
          progressBarContainer.classList.add('d-none');
     }
     // --- ### END UPDATED PROGRESS BAR LOGIC ### ---

     resultsDisplay.classList.remove('d-none');
}

// --- Set Loading State ---
function setLoadingState(loading) { /* ... as before ... */ }
// --- Perform Calculation (AJAX) ---
async function performCalculation() { /* ... mostly as before ... */
    if (isCalculating) return;
    hideError();
    if (!startTimeInput || !startTimeInput.value || !startTimeInput.checkValidity()) {
        if(document.activeElement !== startTimeInput && refreshInterval !== null) {
             // console.log("Auto-refresh calculation skipped: Invalid start time.");
             setLoadingState(false); return;
        }
        showError("Please enter a valid start time."); return;
    }
    setLoadingState(true);
    const dataToSend = {
        start_time: startTimeInput.value,
        long_break: longBreakCheckbox ? longBreakCheckbox.checked : false,
        break_hours: breakHoursInput ? breakHoursInput.value || '0' : '0',
        break_minutes: breakMinutesInput ? breakMinutesInput.value || '0' : '0'
    };
    try {
        const response = await fetch('/calculate', { /* ... */ body: JSON.stringify(dataToSend) });
        const result = await response.json();
        if (!response.ok) { showError(result.error || `Server Error: ${response.statusText}`); }
        else { updateResults(result); saveCurrentValues(); }
    } catch (error) { console.error("Fetch error:", error); showError(`Network error: ${error.message}`); }
    finally { setLoadingState(false); }
}

// --- Event Listeners ---
if (calculateButton) { calculateButton.addEventListener('click', performCalculation); }
if (startTimeInput) { startTimeInput.addEventListener('keypress', function(event) { if (event.key === 'Enter') { event.preventDefault(); performCalculation(); } }); }

// --- Auto-Refresh Logic ---
function startAutoRefresh(){
     if (refreshInterval === null) {
         if (startTimeInput && startTimeInput.value && startTimeInput.checkValidity()){ performCalculation(); }
         // else { console.log("Auto-refresh enabled, but initial calculation skipped: Invalid start time.") }
         refreshInterval = setInterval(performCalculation, 60000);
         // console.log("Auto-refresh interval started.");
     }
 }
 function stopAutoRefresh(){
     if (refreshInterval !== null) {
         clearInterval(refreshInterval); refreshInterval = null;
         // console.log("Auto-refresh stopped.");
     }
 }
if (autoRefreshCheckbox) { autoRefreshCheckbox.addEventListener('change', function() { localStorage.setItem(LS_AUTO_REFRESH_KEY, autoRefreshCheckbox.checked); if(autoRefreshCheckbox.checked) { startAutoRefresh(); } else { stopAutoRefresh(); } }); }

// --- Initial Setup on DOM Load ---
document.addEventListener('DOMContentLoaded', () => { loadSavedValues(); });

// --- Service Worker Registration ---
if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register("/static/service-worker.js").then(registration => {}).catch(error => { console.error('ServiceWorker registration failed: ', error); }); }); }
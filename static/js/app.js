// worktimeweb/static/js/app.js

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

// --- Theme Toggle ---
themeToggle.addEventListener('change', () => {
    document.body.classList.toggle('dark-mode');
    // Note: Theme preference is not saved and will reset on reload.
});

// --- Break Input Visibility ---
function toggleBreakDetails() {
     requestAnimationFrame(() => {
         if (longBreakCheckbox.checked) {
             breakDetailsDiv.style.maxHeight = breakDetailsDiv.scrollHeight + "px";
             breakDetailsDiv.style.opacity = '1';
             breakDetailsDiv.style.marginTop = '1rem';
             breakDetailsDiv.style.padding = '1rem';
             breakDetailsDiv.style.border = '1px solid var(--border-color)';
         } else {
             breakDetailsDiv.style.maxHeight = '0';
             breakDetailsDiv.style.opacity = '0';
             breakDetailsDiv.style.marginTop = '0';
             setTimeout(() => { if (!longBreakCheckbox.checked) { breakDetailsDiv.style.padding = '0 1rem'; breakDetailsDiv.style.border = 'none'; } }, 400);
         }
     });
 }
// Ensure elements exist before adding listeners or calling functions
if (longBreakCheckbox) {
    toggleBreakDetails(); // Initial state
    longBreakCheckbox.addEventListener('change', toggleBreakDetails);
}


// --- Error Handling ---
function showError(message) {
    errorMessage.textContent = message;
    errorDisplay.classList.remove('d-none');
    resultsDisplay.classList.add('d-none');
}
function hideError() {
    errorDisplay.classList.add('d-none');
}

// --- Update Results Display ---
function updateResults(data) {
     resultEndTime.textContent = data.end_time;
     resultDayType.textContent = `(${data.day_type})`;
     resultWorked.textContent = data.worked;
     resultStatus.textContent = data.status;
     resultTimezone.textContent = data.timezone;

     // Progress Bar Logic
     if (data.required_seconds != null && data.worked_seconds != null && data.required_seconds > 0) {
          let progress = Math.max(0, Math.min(100, (data.worked_seconds / data.required_seconds) * 100));
          let progressPercent = Math.round(progress);
          progressBarInner.style.width = progressPercent + '%';
          progressBarInner.textContent = progressPercent + '%';
          progressBarInner.setAttribute('aria-valuenow', progressPercent);
          progressBarContainer.classList.remove('d-none');
     } else {
          progressBarContainer.classList.add('d-none');
     }
     resultsDisplay.classList.remove('d-none');
}

// --- Set Loading State ---
function setLoadingState(loading) {
    isCalculating = loading;
    if (calculateButton) { // Check if button exists
        calculateButton.disabled = loading;
        const spinner = calculateButton.querySelector('.spinner-border');
        const buttonText = calculateButton.querySelector('.button-text');
        const buttonIcon = calculateButton.querySelector('.button-icon');

        if (loading) {
            spinner?.classList.remove('d-none'); // Optional chaining
            if(buttonText) buttonText.textContent = 'Calculating...';
            buttonIcon?.classList.add('d-none'); // Optional chaining
        } else {
            spinner?.classList.add('d-none'); // Optional chaining
            if(buttonText) buttonText.textContent = 'Calculate';
            buttonIcon?.classList.remove('d-none'); // Optional chaining
        }
    }
}

// --- Perform Calculation (AJAX) ---
async function performCalculation() {
    if (isCalculating) return;

    hideError();
    if (!startTimeInput || !startTimeInput.value || !startTimeInput.checkValidity()) { // Check element exists
        showError("Please enter a valid start time.");
        return;
    }
    // TODO: Add client-side validation for break inputs here

    setLoadingState(true);

    const dataToSend = {
        start_time: startTimeInput.value,
        long_break: longBreakCheckbox ? longBreakCheckbox.checked : false, // Check element exists
        break_hours: breakHoursInput ? breakHoursInput.value || '0' : '0', // Check element exists
        break_minutes: breakMinutesInput ? breakMinutesInput.value || '0': '0' // Check element exists
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
         performCalculation(); // Perform calculation immediately when refresh is enabled
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

// --- Service Worker Registration ---
// (This will be added in index.html for simplicity or can be the start of this file)
// --- Moved to index.html template for clarity ---
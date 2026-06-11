// worktimeweb/static/js/app.js - Version 1.1 with fetchData function

// --- Local Storage Keys ---
const LS_START_TIME_KEY = 'worktimeweb_startTime';
const LS_START_TIME_DATE_KEY = 'worktimeweb_startTimeDate'; // Keep date key
const LS_LONG_BREAK_KEY = 'worktimeweb_longBreakChecked';
const LS_BREAK_HOURS_KEY = 'worktimeweb_breakHours';
const LS_BREAK_MINUTES_KEY = 'worktimeweb_breakMinutes';
const LS_AUTO_REFRESH_KEY = 'worktimeweb_autoRefreshChecked';
const LS_AMPM_DISPLAY_KEY = 'worktimeweb_ampmDisplayChecked';
const LS_NOTIFY_END_KEY = 'worktimeweb_notifyEndChecked';
const LS_LAST_NOTIFICATION_KEY = 'worktimeweb_lastNotificationId';

// --- Element References ---
const calculateButton = document.getElementById('calculate-button');
const startTimeInput = document.getElementById('start_time');
const longBreakCheckbox = document.getElementById('long_break');
const breakDetailsDiv = document.getElementById('break-details');
const breakHoursInput = document.getElementById('break_hours');
const breakMinutesInput = document.getElementById('break_minutes');
const autoRefreshCheckbox = document.getElementById('auto_refresh');
const ampmDisplayCheckbox = document.getElementById('ampm_display');
const notifyEndCheckbox = document.getElementById('notify_end');
const notificationHelp = document.getElementById('notification-help');
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
let notificationTimeout = null;
let latestResult = null;

// --- Helper Function to get current date as YYYY-MM-DD ---
function getCurrentDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// --- Functions for Loading Values ---
function loadStartTime() {
    const savedStartTime = localStorage.getItem(LS_START_TIME_KEY);
    const savedStartTimeDate = localStorage.getItem(LS_START_TIME_DATE_KEY);
    const todayDateString = getCurrentDateString();

    if (savedStartTime && startTimeInput && savedStartTimeDate === todayDateString) {
        startTimeInput.value = savedStartTime;
    } else if (startTimeInput) {
        startTimeInput.value = ''; // Clear start time if stale
    }
}

function loadBreakSettings() {
    const savedLongBreak = localStorage.getItem(LS_LONG_BREAK_KEY);
    const savedBreakHours = localStorage.getItem(LS_BREAK_HOURS_KEY);
    const savedBreakMinutes = localStorage.getItem(LS_BREAK_MINUTES_KEY);

    if (savedLongBreak) {
        longBreakCheckbox.checked = (savedLongBreak === 'true');
    }
    if (savedBreakHours) {
        breakHoursInput.value = savedBreakHours;
    }
    if (savedBreakMinutes) {
        breakMinutesInput.value = savedBreakMinutes;
    }
}

function loadAutoRefreshSetting() {
    const savedAutoRefresh = localStorage.getItem(LS_AUTO_REFRESH_KEY);
    if (savedAutoRefresh && autoRefreshCheckbox) {
        autoRefreshCheckbox.checked = (savedAutoRefresh === 'true');
        if (autoRefreshCheckbox.checked) {
            setTimeout(startAutoRefresh, 500);
        }
    }
}

function loadDisplaySettings() {
    const savedAmpmDisplay = localStorage.getItem(LS_AMPM_DISPLAY_KEY);
    if (savedAmpmDisplay && ampmDisplayCheckbox) {
        ampmDisplayCheckbox.checked = savedAmpmDisplay === 'true';
    }
}

function loadNotificationSetting() {
    const savedNotifyEnd = localStorage.getItem(LS_NOTIFY_END_KEY);
    if (savedNotifyEnd && notifyEndCheckbox) {
        notifyEndCheckbox.checked = savedNotifyEnd === 'true';
    }
    updateNotificationHelp();
}

function applyTheme() {
    if (localStorage.getItem('worktimeweb_darkMode') === 'true' && themeToggle) {
        themeToggle.checked = true;
        document.body.classList.add('dark-mode');
    }
}

// --- Load Saved Values on Page Load ---
function loadSavedValues() {
    loadStartTime();
    loadBreakSettings();
    loadDisplaySettings();
    loadNotificationSetting();
    loadAutoRefreshSetting();
    applyTheme();

    toggleBreakDetails();
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
        if (longBreakCheckbox?.checked) {
            breakDetailsDiv.style.maxHeight = breakDetailsDiv.scrollHeight + "px";
            breakDetailsDiv.style.opacity = '1';
            breakDetailsDiv.style.marginTop = '1rem';
            breakDetailsDiv.style.marginBottom = '1rem';
            breakDetailsDiv.style.padding = '1rem';
            breakDetailsDiv.style.border = '1px solid var(--border-color)';
        } else {
            breakDetailsDiv.style.maxHeight = '0';
            breakDetailsDiv.style.opacity = '0';
            breakDetailsDiv.style.marginTop = '0';
            breakDetailsDiv.style.marginBottom = '0';
            // Delay removing padding/border until after collapse transition
            setTimeout(() => {
                if (!longBreakCheckbox?.checked) {
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

function formatDisplayTime(time24) {
    if (!ampmDisplayCheckbox?.checked || !time24) {
        return time24;
    }

    const [hourPart, minutePart] = time24.split(':');
    const hour = parseInt(hourPart, 10);
    if (Number.isNaN(hour) || minutePart === undefined) {
        return time24;
    }

    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutePart} ${period}`;
}

function updateDisplayedEndTime() {
    if (latestResult && resultEndTime) {
        resultEndTime.textContent = formatDisplayTime(latestResult.end_time);
    }
}

// --- Update Results Display ---
function updateResults(data) {
    if (!resultEndTime || !resultDayType || !resultWorked || !resultStatus || !resultTimezone || !resultsDisplay) {
        console.error("One or more result display elements are missing.");
        showError("Internal UI error: Could not display results."); // Show user-friendly error
        return;
    }
    latestResult = data;
    resultEndTime.textContent = formatDisplayTime(data.end_time);
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
    scheduleEndNotification(data);
}

function updateNotificationHelp(message) {
    if (!notificationHelp) return;

    if (message) {
        notificationHelp.textContent = message;
        return;
    }

    if (!('Notification' in window)) {
        notificationHelp.textContent = 'This browser does not support notifications.';
    } else if (Notification.permission === 'denied') {
        notificationHelp.textContent = 'Notifications are blocked in your browser settings.';
    } else {
        notificationHelp.textContent = 'Requires browser notification permission and this page to stay open.';
    }
}

async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        updateNotificationHelp('This browser does not support notifications.');
        return false;
    }

    if (Notification.permission === 'granted') {
        updateNotificationHelp();
        return true;
    }

    if (Notification.permission === 'denied') {
        updateNotificationHelp('Notifications are blocked in your browser settings.');
        return false;
    }

    const permission = await Notification.requestPermission();
    updateNotificationHelp();
    return permission === 'granted';
}

function clearEndNotification() {
    if (notificationTimeout !== null) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
    }
}

function buildNotificationId(endTime) {
    return `${getCurrentDateString()}-${startTimeInput?.value || ''}-${endTime}`;
}

function hasNotificationAlreadyShown(notificationId) {
    return localStorage.getItem(LS_LAST_NOTIFICATION_KEY) === notificationId;
}

function rememberNotification(notificationId) {
    localStorage.setItem(LS_LAST_NOTIFICATION_KEY, notificationId);
}

function showEndNotification(endTime, notificationId) {
    if (!notifyEndCheckbox?.checked || !('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }
    if (hasNotificationAlreadyShown(notificationId)) {
        return;
    }

    try {
        const notification = new Notification('Workday complete', {
            body: `You can leave now. Planned end time: ${formatDisplayTime(endTime)}.`,
            icon: '/static/icons/icon-192x192.png',
            tag: notificationId,
            renotify: false
        });
        notification.onclick = () => window.focus();
        rememberNotification(notificationId);
    } catch (error) {
        console.error('Could not show end-of-day notification:', error);
        updateNotificationHelp('Could not show notification. Check browser permissions and secure connection settings.');
    }
}

function scheduleEndNotification(data) {
    clearEndNotification();

    if (!notifyEndCheckbox?.checked || !data?.end_timestamp) {
        return;
    }

    const notificationId = buildNotificationId(data.end_time);
    if (hasNotificationAlreadyShown(notificationId)) {
        return;
    }

    const endTime = new Date(data.end_timestamp).getTime();
    if (Number.isNaN(endTime)) {
        updateNotificationHelp('Could not schedule notification for this end time.');
        return;
    }

    const delay = endTime - Date.now();
    if (delay <= 0) {
        showEndNotification(data.end_time, notificationId);
        return;
    }

    notificationTimeout = setTimeout(() => {
        showEndNotification(data.end_time, notificationId);
        notificationTimeout = null;
    }, delay);
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

// --- Input Validation ---
function validateBreakInputs() {
    if (!breakHoursInput || !breakMinutesInput) {
        showError("Internal UI Error: Break input fields not found.");
        return false;
    }

    const hoursValue = breakHoursInput.value.trim();
    const minutesValue = breakMinutesInput.value.trim();

    if (hoursValue === '' || isNaN(hoursValue) || parseInt(hoursValue) < 0) {
        showError("Please enter a valid non-negative number for break hours.");
        breakHoursInput.focus();
        return false;
    }

    if (minutesValue === '' || isNaN(minutesValue) || parseInt(minutesValue) < 0 || parseInt(minutesValue) > 59) {
        showError("Please enter a valid number between 0 and 59 for break minutes.");
        breakMinutesInput.focus();
        return false;
    }

    return true;
}



// --- Response Handling ---
async function handleResponse(response) {
    if (!response.ok) {
        let errorMsg = `Server Error: ${response.status} ${response.statusText}`;
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
            try {
                const errorResult = await response.json();
                errorMsg = errorResult.error || errorMsg;
            } catch (parseError) {
                console.error('Failed to parse JSON error response:', parseError);
            }
        } else {
            console.warn(`Received non-JSON error response (Content-Type: ${contentType})`);
        }
        showError(errorMsg);
    } else {
        const result = await response.json();
        updateResults(result);
        saveCurrentValues();
    }
}

// --- Perform Calculation (AJAX) ---
function prepareDataToSend() {
    const breakHours = (longBreakCheckbox?.checked && breakHoursInput) ? parseInt(breakHoursInput.value.trim()) : 0;
    const breakMinutes = (longBreakCheckbox?.checked && breakMinutesInput) ? parseInt(breakMinutesInput.value.trim()) : 0;

    return {
        start_time: startTimeInput.value,
        long_break: longBreakCheckbox?.checked || false,
        break_hours: String(breakHours),
        break_minutes: String(breakMinutes),
    };
}

function handleBreakValidation() {
    if (longBreakCheckbox?.checked) {
        if (!validateBreakInputs()) {
            return false;
        }
    }
    return true;
}

function validateStartTime() {
    if (!startTimeInput?.value || !startTimeInput?.checkValidity()) {
        showError("Please enter a valid start time (HH:MM).");
        startTimeInput?.focus();
        return false;
    }
    return true;
}

function preCalculationChecks() {
    if (isCalculating) return false;
    hideError();
    return true;
}

function validateAllInputs() {
    if (!validateStartTime()) {
        return false;
    }
    if (!handleBreakValidation()) {
        return false;
    }
    return true;
}

async function performCalculation() {
    if (!preCalculationChecks()) {
        return;
    }

    if (!validateAllInputs()) {
        return;
    }

    setLoadingState(true);

    const dataToSend = prepareDataToSend();

    await fetchData(dataToSend);
}

async function fetchData(dataToSend) {
    try {
        const response = await fetch('/calculate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dataToSend)
        });

        await handleResponse(response);
    } catch (error) {
        console.error('Network error:', error);
        showError('Network error: Unable to connect to server. Please check your connection.');
    } finally {
        setLoadingState(false);
    }
}

// --- Event Listeners ---
if (calculateButton) {
    calculateButton?.addEventListener('click', performCalculation);
}
if (startTimeInput) {
    startTimeInput?.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent default form submission if any
            performCalculation();
        }
    });
}
// Add Enter key listener to break inputs too, if they are visible
if (breakHoursInput) {
     breakHoursInput?.addEventListener('keypress', function(event) {
         if (event.key === 'Enter') {
             event.preventDefault();
             performCalculation();
         }
     });
}
if (breakMinutesInput) {
     breakMinutesInput?.addEventListener('keypress', function(event) {
         if (event.key === 'Enter') {
             event.preventDefault();
             performCalculation();
         }
     });
}

// --- Auto-Refresh Logic ---
function isStartTimeValid() {
    return startTimeInput?.value && startTimeInput?.checkValidity();
}

function startAutoRefresh() {
    if (refreshInterval === null) { // Start only if not already running
        // Perform an initial calculation immediately *only if* start time is valid
        if (isStartTimeValid()) {
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
    autoRefreshCheckbox?.addEventListener('change', function() {
        localStorage.setItem(LS_AUTO_REFRESH_KEY, autoRefreshCheckbox.checked); // Save state immediately
        if (autoRefreshCheckbox.checked) {
            startAutoRefresh();
        } else {
            stopAutoRefresh();
        }
    });
}

if (ampmDisplayCheckbox) {
    ampmDisplayCheckbox.addEventListener('change', function() {
        localStorage.setItem(LS_AMPM_DISPLAY_KEY, ampmDisplayCheckbox.checked);
        updateDisplayedEndTime();
    });
}

if (notifyEndCheckbox) {
    notifyEndCheckbox.addEventListener('change', async function() {
        localStorage.setItem(LS_NOTIFY_END_KEY, notifyEndCheckbox.checked);

        if (!notifyEndCheckbox.checked) {
            clearEndNotification();
            updateNotificationHelp();
            return;
        }

        const permissionGranted = await requestNotificationPermission();
        if (!permissionGranted) {
            notifyEndCheckbox.checked = false;
            localStorage.setItem(LS_NOTIFY_END_KEY, false);
            clearEndNotification();
            return;
        }

        if (latestResult) {
            scheduleEndNotification(latestResult);
        }
    });
}

// --- Initial Setup on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    loadSavedValues(); // Load saved values once the DOM is ready
});


// --- REMOVED Redundant Service Worker Registration ---
// The registration is now handled only in index.html using Flask's url_for

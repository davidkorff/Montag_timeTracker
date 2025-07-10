// Timezone utilities - standardized to Eastern Time
const EASTERN_TIMEZONE = 'America/New_York';

// Get current date in Eastern timezone
const getEasternDate = () => {
  const now = new Date();
  // Format as YYYY-MM-DD in Eastern time
  const easternDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: EASTERN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  
  return easternDate;
};

// Get current timestamp in Eastern timezone
const getEasternTimestamp = () => {
  return new Date();
};

// Convert a UTC date to Eastern date string (YYYY-MM-DD)
const toEasternDateString = (date) => {
  if (!date) return null;
  
  const d = new Date(date);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: EASTERN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
};

// Format timestamp for display in Eastern time
const formatEasternDateTime = (date) => {
  if (!date) return '';
  
  const d = new Date(date);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(d);
};

module.exports = {
  EASTERN_TIMEZONE,
  getEasternDate,
  getEasternTimestamp,
  toEasternDateString,
  formatEasternDateTime
};
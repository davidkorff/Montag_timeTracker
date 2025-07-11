// Date utilities - all dates displayed in Eastern timezone
const DateUtils = {
    // Cache server time offset to reduce API calls
    _serverTimeCache: null,
    _cacheExpiry: null,
    
    // Format date for display - dates are stored as YYYY-MM-DD strings
    formatDate: (dateString) => {
        if (!dateString) return '';
        
        // If it's a date-only string (YYYY-MM-DD), display it as-is
        // These are already Eastern dates from the server
        if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Simply reformat from YYYY-MM-DD to MM/DD/YYYY
            const [year, month, day] = dateString.split('-');
            return `${month}/${day}/${year}`;
        }
        
        // For timestamps with time, convert to Eastern timezone
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(date);
    },
    
    // Format date and time for display (Eastern timezone)
    formatDateTime: (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }).format(date);
    },
    
    // Format time only (Eastern timezone)
    formatTime: (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }).format(date);
    },
    
    // Get current date from server (cached for 1 minute)
    getServerDate: async () => {
        const now = Date.now();
        
        // Check cache
        if (DateUtils._serverTimeCache && DateUtils._cacheExpiry > now) {
            return DateUtils._serverTimeCache.currentDate;
        }
        
        // Fetch from server
        const response = await API.get('/server-time');
        DateUtils._serverTimeCache = response;
        DateUtils._cacheExpiry = now + 60000; // Cache for 1 minute
        
        return response.currentDate;
    },
    
    // Get timezone abbreviation
    getTimezoneAbbr: () => {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            timeZoneName: 'short'
        });
        const parts = formatter.formatToParts(now);
        const timeZoneName = parts.find(part => part.type === 'timeZoneName');
        return timeZoneName ? timeZoneName.value : 'ET';
    },
    
    // Clear cache (useful when navigating between pages)
    clearCache: () => {
        DateUtils._serverTimeCache = null;
        DateUtils._cacheExpiry = null;
    }
};

// Make available globally
window.DateUtils = DateUtils;
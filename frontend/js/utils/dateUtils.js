// Date utilities - all dates displayed in Eastern timezone
const DateUtils = {
    // Cache server time offset to reduce API calls
    _serverTimeCache: null,
    _cacheExpiry: null,
    
    // Format date for display (Eastern timezone)
    formatDate: (dateString) => {
        if (!dateString) return '';
        
        // If it's a date-only string (YYYY-MM-DD), treat it as a date in Eastern time
        // not as UTC midnight to avoid timezone shift issues
        if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Parse as local date parts to avoid timezone interpretation
            const [year, month, day] = dateString.split('-').map(Number);
            // Create date in Eastern timezone directly
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            // Use UTC noon to ensure we're in the middle of the day
            const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
            return formatter.format(date);
        }
        
        // For timestamps with time, use normal handling
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
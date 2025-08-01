// Immediately check if CONFIG is defined, if not, define it
(function() {
    if (typeof CONFIG === 'undefined') {
        window.CONFIG = {
            API_URL: window.location.hostname === 'localhost' 
                ? 'http://localhost:5000/api' 
                : `${window.location.protocol}//${window.location.host}/api`,
            TOKEN_KEY: '42_consulting_token',
            USER_KEY: '42_consulting_user'
        };
        console.warn('CONFIG was not defined, using fallback configuration');
    }
})();

class API {
    static async request(endpoint, options = {}) {
        // Use rate limiter if available
        if (window.rateLimiter) {
            return window.rateLimiter.throttleRequest(endpoint, options.method || 'GET', async () => {
                return this._makeRequest(endpoint, options);
            });
        }
        
        return this._makeRequest(endpoint, options);
    }

    static async _makeRequest(endpoint, options = {}) {
        const token = localStorage.getItem(CONFIG.TOKEN_KEY);
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };

        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            const response = await fetch(`${CONFIG.API_URL}${endpoint}`, finalOptions);
            
            if (response.status === 401) {
                localStorage.removeItem(CONFIG.TOKEN_KEY);
                localStorage.removeItem(CONFIG.USER_KEY);
                window.location.href = '#/login';
                throw new Error('Unauthorized');
            }

            // Handle 403 Forbidden separately
            if (response.status === 403) {
                const data = await response.json();
                throw new Error(data.error || 'Access denied');
            }

            // Handle 404 Not Found
            if (response.status === 404) {
                throw new Error('Resource not found');
            }

            // Try to parse JSON response
            let data;
            try {
                data = await response.json();
            } catch (e) {
                // If response is not JSON, throw generic error
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                data = null;
            }

            if (!response.ok) {
                throw new Error(data?.error || `Request failed with status ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    static get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    static post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    static put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    static delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
    
    static approveTimeEntries(timeEntryIds) {
        return this.post('/time-entries/approve', { timeEntryIds });
    }
    
    static rejectTimeEntries(timeEntryIds, reason) {
        return this.post('/time-entries/reject', { timeEntryIds, reason });
    }
}

const Auth = {
    async login(email, password) {
        const response = await API.post('/auth/login', { email, password });
        localStorage.setItem(CONFIG.TOKEN_KEY, response.token);
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(response.user));
        return response;
    },

    async logout() {
        try {
            await API.post('/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        }
        localStorage.removeItem(CONFIG.TOKEN_KEY);
        localStorage.removeItem(CONFIG.USER_KEY);
        window.location.href = '#/login';
    },

    getUser() {
        const userStr = localStorage.getItem(CONFIG.USER_KEY);
        return userStr ? JSON.parse(userStr) : null;
    },

    isAuthenticated() {
        return !!localStorage.getItem(CONFIG.TOKEN_KEY);
    },

    isAdmin() {
        const user = this.getUser();
        return user && (user.userTypeId === 1 || user.userType === 'admin');
    },

    getToken() {
        return localStorage.getItem(CONFIG.TOKEN_KEY);
    }
};

// Expose globally
window.API = API;
window.Auth = Auth;
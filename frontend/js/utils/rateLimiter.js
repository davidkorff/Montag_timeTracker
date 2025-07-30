class RateLimiter {
    constructor() {
        this.requests = new Map(); // Track requests by endpoint
        this.cache = new Map(); // Simple cache for GET requests
        this.cacheTimeout = 30000; // 30 seconds cache
        this.minRequestInterval = 1000; // Minimum 1 second between same endpoint calls
        this.globalRequestCount = 0;
        this.globalRequestLimit = 10; // Max 10 requests per second globally
        this.globalResetTime = Date.now();
    }

    async throttleRequest(endpoint, method, requestFn) {
        // Check global rate limit
        if (Date.now() - this.globalResetTime >= 1000) {
            this.globalRequestCount = 0;
            this.globalResetTime = Date.now();
        }

        if (this.globalRequestCount >= this.globalRequestLimit) {
            // Wait for the next second
            const waitTime = 1000 - (Date.now() - this.globalResetTime);
            if (waitTime > 0) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
                this.globalRequestCount = 0;
                this.globalResetTime = Date.now();
            }
        }

        // Check endpoint-specific rate limit
        const lastRequest = this.requests.get(endpoint);
        if (lastRequest) {
            const timeSinceLastRequest = Date.now() - lastRequest;
            if (timeSinceLastRequest < this.minRequestInterval) {
                await new Promise(resolve => 
                    setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
                );
            }
        }

        // Check cache for GET requests
        if (method === 'GET') {
            const cached = this.cache.get(endpoint);
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        // Make the request
        this.requests.set(endpoint, Date.now());
        this.globalRequestCount++;

        try {
            const result = await requestFn();
            
            // Cache successful GET requests
            if (method === 'GET') {
                this.cache.set(endpoint, {
                    data: result,
                    timestamp: Date.now()
                });
            }

            return result;
        } catch (error) {
            // If we get a 429, implement exponential backoff
            if (error.message && error.message.includes('429')) {
                const backoffTime = this.calculateBackoff(endpoint);
                console.log(`Rate limited on ${endpoint}. Backing off for ${backoffTime}ms`);
                
                // Update minimum interval for this endpoint
                this.minRequestInterval = Math.min(backoffTime, 30000); // Max 30s
                
                // Clear cache for this endpoint to force fresh data next time
                this.cache.delete(endpoint);
            }
            throw error;
        }
    }

    calculateBackoff(endpoint) {
        const attempts = (this.requests.get(`${endpoint}_attempts`) || 0) + 1;
        this.requests.set(`${endpoint}_attempts`, attempts);
        
        // Exponential backoff: 2^attempts * 1000ms, max 30 seconds
        return Math.min(Math.pow(2, attempts) * 1000, 30000);
    }

    clearCache(endpoint = null) {
        if (endpoint) {
            this.cache.delete(endpoint);
        } else {
            this.cache.clear();
        }
    }

    // Batch multiple requests together
    async batchRequests(requests) {
        // Group requests by timing to avoid overwhelming the server
        const batches = [];
        const batchSize = 3; // Max 3 concurrent requests
        
        for (let i = 0; i < requests.length; i += batchSize) {
            batches.push(requests.slice(i, i + batchSize));
        }

        const results = [];
        for (const batch of batches) {
            const batchResults = await Promise.all(
                batch.map(req => this.throttleRequest(req.endpoint, req.method, req.fn))
            );
            results.push(...batchResults);
            
            // Small delay between batches
            if (batches.indexOf(batch) < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        return results;
    }
}

// Export singleton instance
const rateLimiter = new RateLimiter();
window.rateLimiter = rateLimiter;
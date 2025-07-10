class Timer {
    constructor() {
        this.activeTimers = [];
        this.interval = null;
        this.refreshDelay = 5000; // Start with 5 seconds
        this.maxDelay = 60000; // Max 60 seconds
        this.errorCount = 0;
    }

    async init() {
        try {
            const response = await API.get('/time-entries/active-timers');
            this.activeTimers = response.timers || [];
            
            // Reset error count on success
            this.errorCount = 0;
            this.refreshDelay = 5000;
            
            if (this.activeTimers.length > 0) {
                this.startInterval();
            }
        } catch (error) {
            console.error('Error fetching active timers:', error);
            
            // Implement exponential backoff on error
            this.errorCount++;
            this.refreshDelay = Math.min(this.refreshDelay * 2, this.maxDelay);
            
            // Don't retry if we're getting rate limited
            if (error.message && error.message.includes('429')) {
                console.log(`Rate limited. Backing off to ${this.refreshDelay/1000}s refresh interval`);
            }
        }
    }

    async start(projectId, description = '', isBillable = true) {
        try {
            const response = await API.post('/time-entries/timer/start', {
                projectId,
                description,
                isBillable
            });
            // Refresh the timers list
            await this.init();
            this.render();
        } catch (error) {
            alert('Error starting timer: ' + error.message);
        }
    }

    async refresh() {
        await this.init();
        this.render();
    }

    startInterval() {
        // Clear any existing interval
        this.stopInterval();
        
        // Refresh timer data periodically with dynamic delay
        this.interval = setInterval(async () => {
            await this.refresh();
            
            // If we had errors, restart interval with new delay
            if (this.errorCount > 0) {
                this.startInterval();
            }
        }, this.refreshDelay);
    }

    stopInterval() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    render() {
        const container = document.getElementById('timer-container');
        if (!container) return;

        // Filter out any timers that have been committed (have timer_end)
        const activeTimers = this.activeTimers.filter(t => !t.timer_end);
        
        if (activeTimers.length === 0) {
            container.innerHTML = '';
            this.stopInterval();
            return;
        }

        // For now, just show a simple indicator that timers are running
        container.innerHTML = `
            <div class="timer-widget" onclick="window.location.hash='#/dashboard'" style="cursor: pointer;">
                <div class="timer-display">${activeTimers.length} timer${activeTimers.length > 1 ? 's' : ''} active</div>
                <div class="timer-project">Click to view dashboard</div>
            </div>
        `;
    }
}

const timer = new Timer();
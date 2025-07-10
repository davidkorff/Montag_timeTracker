class Timer {
    constructor() {
        this.activeTimers = [];
        this.interval = null;
    }

    async init() {
        try {
            const response = await API.get('/time-entries/active-timers');
            this.activeTimers = response.timers || [];
            if (this.activeTimers.length > 0) {
                this.startInterval();
            }
        } catch (error) {
            console.error('Error fetching active timers:', error);
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
        // Refresh timer data periodically
        this.interval = setInterval(async () => {
            await this.refresh();
        }, 5000); // Refresh every 5 seconds
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
const DashboardPage = {
    // Timer state management
    timers: new Map(), // Map of timerId -> timer data
    timerIntervals: new Map(), // Map of timerId -> interval ID
    pinnedProjects: [],
    todayEntries: [],

    render: async () => {
        const user = Auth.getUser();
        const isAdmin = Auth.isAdmin();

        document.getElementById('app').innerHTML = `
            ${Navbar.render()}
            <div class="container">
                <div class="dashboard-container">
                    <div class="dashboard-header">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                            <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: 700; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);">
                                ${user.firstName.charAt(0)}
                            </div>
                            <div>
                                <h1 style="margin: 0; font-size: 2.5rem; font-weight: 700; background: linear-gradient(135deg, #1e293b 0%, #475569 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                    Hello, ${user.firstName}! 👋
                                </h1>
                                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px; font-weight: 500;">
                                    ${DateUtils.getTimezoneAbbr()} • ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                        </div>
                        <div class="stats-row">
                            <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid rgba(59, 130, 246, 0.2); padding: 16px 20px; border-radius: 12px; text-align: center; flex: 1;">
                                <div style="font-size: 24px; font-weight: 700; color: #3b82f6; margin-bottom: 4px;" id="total-today">0.0</div>
                                <div style="font-size: 14px; color: #64748b; font-weight: 500;">Hours Today</div>
                            </div>
                            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid rgba(16, 185, 129, 0.2); padding: 16px 20px; border-radius: 12px; text-align: center; flex: 1;">
                                <div style="font-size: 24px; font-weight: 700; color: #10b981; margin-bottom: 4px;" id="active-count">0</div>
                                <div style="font-size: 14px; color: #64748b; font-weight: 500;">Active Timers</div>
                            </div>
                        </div>
                    </div>

                    <!-- Quick Actions -->
                    <div class="btn-group" style="margin-bottom: 2rem;">
                        <button onclick="DashboardPage.showQuickEntry()" class="btn btn-primary" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);">
                            <span style="font-size: 18px; margin-right: 8px;">⚡</span>
                            Quick Entry
                        </button>
                        <button onclick="DashboardPage.showProjectSelector()" class="btn btn-outline" style="border: 2px solid #3b82f6; color: #3b82f6; background: transparent;">
                            <span style="font-size: 18px; margin-right: 8px;">▶️</span>
                            Start Timer
                        </button>
                    </div>

                    <!-- Pinned Projects Section -->
                    <div class="section">
                        <div class="section-header">
                            <h2>📌 Pinned Projects</h2>
                            <button onclick="DashboardPage.managePinned()" class="btn btn-sm btn-secondary">Manage</button>
                        </div>
                        <div id="pinned-projects" class="project-grid">
                            <div class="loading">Loading...</div>
                        </div>
                    </div>

                    <!-- Active Timers Section -->
                    <div class="section">
                        <h2>⏱️ Active Timers</h2>
                        <div id="active-timers">
                            <div class="empty-state">
                                <p>No active timers. Start tracking time on a project above!</p>
                            </div>
                        </div>
                    </div>

                    <!-- Today's Time Entries -->
                    <div class="section">
                        <div class="section-header">
                            <h2>📅 Today's Work</h2>
                            <div class="btn-group">
                                <button onclick="DashboardPage.showAddTimeModal()" class="btn btn-sm btn-primary">Add Time</button>
                                <a href="#/time-entries" class="btn btn-sm btn-outline">View All</a>
                            </div>
                        </div>
                        <div id="today-entries">
                            <div class="loading">Loading...</div>
                        </div>
                    </div>

                </div>
            </div>
            
            <div id="modal-container"></div>
        `;

        Navbar.updateActiveLink();
        await DashboardPage.initialize();
    },

    initialize: async () => {
        // Clear any existing intervals
        DashboardPage.clearAllIntervals();
        
        // Load data with rate limiter batching if available
        if (window.rateLimiter) {
            const requests = [
                { endpoint: '/projects?status=active', method: 'GET', fn: () => API.get('/projects?status=active') },
                { endpoint: '/user-preferences', method: 'GET', fn: () => API.get('/user-preferences').catch(() => ({ preferences: {} })) },
                { endpoint: '/time-entries/active-timers', method: 'GET', fn: () => API.get('/time-entries/active-timers') },
                { endpoint: '/time-entries/today', method: 'GET', fn: () => API.get('/time-entries/today') }
            ];
            
            const [projects, preferences, activeTimers, todayEntries] = await window.rateLimiter.batchRequests(requests);
            
            // Process the results
            await DashboardPage.processPinnedProjects(projects, preferences);
            await DashboardPage.processActiveTimers(activeTimers);
            await DashboardPage.processTodayEntries(todayEntries);
        } else {
            // Fallback to parallel loading
            await Promise.all([
                DashboardPage.loadPinnedProjects(),
                DashboardPage.loadActiveTimers(),
                DashboardPage.loadTodayEntries()
            ]);
        }

        // Start timer update loop with longer interval
        DashboardPage.startTimerUpdateLoop();
    },

    clearAllIntervals: () => {
        DashboardPage.timerIntervals.forEach(intervalId => clearInterval(intervalId));
        DashboardPage.timerIntervals.clear();
    },

    processPinnedProjects: async (projects, preferences) => {
        try {
            const container = document.getElementById('pinned-projects');
            
            if (projects.projects.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <p>No active projects yet.</p>
                        <button onclick="DashboardPage.showProjectSelector()" class="btn btn-primary">Browse Projects</button>
                    </div>
                `;
                return;
            }

            // Get pinned project IDs from user preferences
            let pinnedIds = preferences.preferences?.pinnedProjects || [];
            
            if (pinnedIds.length > 0) {
                DashboardPage.pinnedProjects = projects.projects.filter(p => pinnedIds.includes(p.id));
            } else {
                DashboardPage.pinnedProjects = projects.projects;
            }
            
            // Render the pinned projects
            container.innerHTML = DashboardPage.pinnedProjects.map(project => {
                const hasTimer = Array.from(DashboardPage.timers.values()).some(t => t.project_id === project.id);
                const progress = project.budget_hours ? Math.min(100, Math.round((project.hours_used / project.budget_hours) * 100)) : 0;
                return `
                    <div class="project-card ${hasTimer ? 'has-timer' : ''}" data-project-id="${project.id}">
                        <div class="project-header">
                            <div>
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                    <div style="width: 8px; height: 8px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%;"></div>
                                    <span class="project-client" style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">${project.client_name}</span>
                                </div>
                                <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #1e293b; line-height: 1.3;">${project.name}</h3>
                            </div>
                            <button onclick="DashboardPage.unpinProject('${project.id}')" class="btn-icon" title="Unpin" style="background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); border: 1px solid #e2e8f0; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; transition: all 0.3s; color: #64748b;">
                                📌
                            </button>
                        </div>
                        <div class="project-stats">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <div style="text-align: center; flex: 1;">
                                    <div style="font-size: 20px; font-weight: 700; color: #3b82f6;">${(project.hours_used || 0).toFixed(1)}</div>
                                    <div style="font-size: 12px; color: #64748b; font-weight: 500;">Hours Used</div>
                                </div>
                                <div style="text-align: center; flex: 1;">
                                    <div style="font-size: 20px; font-weight: 700; color: #10b981;">${project.budget_hours ? project.budget_hours : '∞'}</div>
                                    <div style="font-size: 12px; color: #64748b; font-weight: 500;">Budget</div>
                                </div>
                            </div>
                            ${project.budget_hours ? `
                                <div style="margin-bottom: 8px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                        <span style="font-size: 12px; color: #64748b; font-weight: 500;">Progress</span>
                                        <span style="font-size: 12px; color: #64748b; font-weight: 600;">${progress}%</span>
                                    </div>
                                    <div class="progress" style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                                        <div class="progress-bar" style="height: 100%; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 3px; width: ${progress}%; transition: width 0.3s ease;"></div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        <div class="project-timer">
                            ${hasTimer ? 
                                `<div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid rgba(16, 185, 129, 0.2); padding: 12px; border-radius: 8px; text-align: center;">
                                    <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                                        <div style="width: 8px; height: 8px; background: #10b981; border-radius: 50%; animation: pulse 2s infinite;"></div>
                                        <span style="font-size: 14px; font-weight: 600; color: #10b981;">Timer Active</span>
                                    </div>
                                </div>` :
                                `<button onclick="DashboardPage.startProjectTimer('${project.id}')" class="btn btn-primary btn-sm" style="width: 100%; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);">
                                    <span style="font-size: 16px; margin-right: 6px;">▶️</span>
                                    Start Timer
                                </button>`
                            }
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error processing pinned projects:', error);
            document.getElementById('pinned-projects').innerHTML = 
                '<p class="error">Error loading projects. Please refresh the page.</p>';
        }
    },

    processActiveTimers: async (response) => {
        try {
            DashboardPage.timers.clear();
            
            if (response.timers && response.timers.length > 0) {
                response.timers.forEach(timer => {
                    DashboardPage.timers.set(timer.id, timer);
                });
            }
            
            DashboardPage.updateActiveTimersDisplay();
        } catch (error) {
            console.error('Error processing active timers:', error);
        }
    },

    processTodayEntries: async (response) => {
        try {
            const entries = response.entries || [];
            const container = document.getElementById('today-entries');
            
            if (entries.length === 0) {
                container.innerHTML = '<p class="empty-state">No entries for today yet.</p>';
                return;
            }

            // Group entries by project
            const projectGroups = {};
            entries.forEach(entry => {
                const key = entry.project_id;
                if (!projectGroups[key]) {
                    projectGroups[key] = {
                        project_name: entry.project_name,
                        client_name: entry.client_name,
                        entries: [],
                        total_hours: 0
                    };
                }
                projectGroups[key].entries.push(entry);
                projectGroups[key].total_hours += parseFloat(entry.hours || 0);
            });

            container.innerHTML = Object.values(projectGroups).map(group => `
                <div class="today-project" style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid rgba(255, 255, 255, 0.8); margin-bottom: 16px;">
                    <div class="project-summary" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h4 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 700; color: #1e293b;">${group.project_name}</h4>
                                <span class="client-name" style="color: #64748b; font-size: 14px; font-weight: 500;">${group.client_name}</span>
                            </div>
                            <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid rgba(59, 130, 246, 0.2); padding: 8px 16px; border-radius: 8px; text-align: center;">
                                <span class="project-total" style="color: #3b82f6; font-weight: 700; font-size: 16px;">${group.total_hours.toFixed(1)}h</span>
                            </div>
                        </div>
                    </div>
                    <div class="project-entries" style="padding: 0;">
                        ${group.entries.map(entry => `
                            <div class="entry-item" style="padding: 16px 20px; border-bottom: 1px solid #f1f5f9; transition: background-color 0.2s; display: flex; justify-content: space-between; align-items: center;">
                                <div style="flex: 1;">
                                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 4px;">
                                        <span class="entry-time" style="font-weight: 700; color: #3b82f6; font-size: 14px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.2);">${(parseFloat(entry.hours || 0)).toFixed(1)}h</span>
                                        <span style="font-size: 12px; color: #64748b; font-weight: 500;">${new Date(entry.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <span class="entry-desc" style="color: #64748b; font-size: 14px; line-height: 1.4;">${entry.description || 'No description'}</span>
                                </div>
                                <button onclick="DashboardPage.editEntry('${entry.id}')" class="btn-icon" title="Edit" style="background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); border: 1px solid #e2e8f0; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; transition: all 0.3s; color: #64748b; margin-left: 12px;">
                                    ✏️
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error processing today entries:', error);
            document.getElementById('today-entries').innerHTML = 
                '<p class="error">Error loading entries. Please refresh the page.</p>';
        }
    },

    loadPinnedProjects: async () => {
        try {
            // Fetch both projects and user preferences in parallel
            const [projects, preferences] = await Promise.all([
                API.get('/projects?status=active'),
                API.get('/user-preferences').catch(() => ({ preferences: {} }))
            ]);
            
            const container = document.getElementById('pinned-projects');
            
            if (projects.projects.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <p>No active projects yet.</p>
                        <button onclick="DashboardPage.showProjectSelector()" class="btn btn-primary">Browse Projects</button>
                    </div>
                `;
                return;
            }

            // Get pinned project IDs from user preferences (fallback to localStorage for migration)
            let pinnedIds = preferences.preferences?.pinnedProjects || [];
            
            // Migration: if no server preferences but localStorage exists, migrate it
            if (pinnedIds.length === 0) {
                const localPinned = JSON.parse(localStorage.getItem('pinnedProjects') || '[]');
                if (localPinned.length > 0) {
                    pinnedIds = localPinned;
                    // Save to server
                    API.post('/user-preferences', { 
                        key: 'pinnedProjects', 
                        value: pinnedIds 
                    }).catch(console.error);
                }
            }
            
            if (pinnedIds.length > 0) {
                // Filter projects to only show pinned ones
                DashboardPage.pinnedProjects = projects.projects.filter(p => pinnedIds.includes(p.id));
                
                // If some pinned projects no longer exist, clean up preferences
                if (DashboardPage.pinnedProjects.length < pinnedIds.length) {
                    const existingIds = DashboardPage.pinnedProjects.map(p => p.id);
                    API.post('/user-preferences', { 
                        key: 'pinnedProjects', 
                        value: existingIds 
                    }).catch(console.error);
                }
            } else {
                // Default to all projects if none are pinned
                DashboardPage.pinnedProjects = projects.projects;
            }
            
            DashboardPage.renderPinnedProjects();
        } catch (error) {
            console.error('Error loading pinned projects:', error);
            document.getElementById('pinned-projects').innerHTML = '<p class="error">Error loading projects</p>';
        }
    },

    renderPinnedProjects: () => {
        const container = document.getElementById('pinned-projects');
        
        if (DashboardPage.pinnedProjects.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No projects pinned yet.</p>
                    <button onclick="DashboardPage.managePinned()" class="btn btn-primary">Select Projects to Pin</button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = DashboardPage.pinnedProjects.map(project => {
            const hasTimer = Array.from(DashboardPage.timers.values()).some(t => t.project_id === project.id);
            const hoursUsed = parseFloat(project.total_hours || 0);
            const percentUsed = project.budget_hours ? Math.round((hoursUsed / project.budget_hours) * 100) : 0;
            
            return `
                <div class="project-card" data-project-id="${project.id}">
                    <div class="project-header">
                        <div class="project-info">
                            <div class="project-client">${project.client_name}</div>
                            <h3>${project.name}</h3>
                        </div>
                        <button onclick="DashboardPage.togglePin('${project.id}')" class="btn-close" title="Unpin">×</button>
                    </div>
                    <div class="project-stats">
                        <div>${hoursUsed.toFixed(1)} hours used</div>
                        ${project.budget_hours ? `
                            <div>
                                <div class="progress">
                                    <div class="progress-bar" style="width: ${percentUsed}%"></div>
                                </div>
                                <div>${percentUsed}% of ${project.budget_hours}h budget</div>
                            </div>` : ''}
                    </div>
                    <div style="margin-top: 1rem;">
                        ${hasTimer ? 
                            '<button class="btn btn-success btn-sm" disabled style="width: 100%;">Timer Active</button>' :
                            `<button onclick="DashboardPage.startProjectTimer('${project.id}')" class="btn btn-primary" style="width: 100%;">
                                Start Timer
                            </button>`
                        }
                    </div>
                </div>
            `;
        }).join('');
    },

    loadActiveTimers: async () => {
        try {
            const response = await API.get('/time-entries/active-timers');
            
            // Clear existing timers
            DashboardPage.timers.clear();
            
            if (response.timers && response.timers.length > 0) {
                response.timers.forEach(timer => {
                    DashboardPage.timers.set(timer.id, timer);
                });
            }
            
            DashboardPage.updateActiveTimersDisplay();
            DashboardPage.updateActiveCount();
            DashboardPage.renderPinnedProjects(); // Update project cards
        } catch (error) {
            console.error('Error loading active timers:', error);
        }
    },

    startProjectTimer: async (projectId) => {
        try {
            const response = await API.post('/time-entries/timer/start', {
                projectId,
                description: '',
                isBillable: true
            });

            const timer = response.timeEntry;
            DashboardPage.timers.set(timer.id, timer);
            
            DashboardPage.updateActiveTimersDisplay();
            DashboardPage.updateActiveCount();
            DashboardPage.renderPinnedProjects();
            
            // Focus on the notes input for the new timer
            setTimeout(() => {
                const notesInput = document.querySelector(`#timer-card-${timer.id} textarea`);
                if (notesInput) notesInput.focus();
            }, 100);
            
        } catch (error) {
            alert('Error starting timer: ' + error.message);
        }
    },

    pauseTimer: async (timerId) => {
        try {
            const response = await API.post(`/time-entries/timer/pause/${timerId}`);
            const timer = response.timeEntry;
            
            DashboardPage.timers.set(timer.id, timer);
            DashboardPage.updateActiveTimersDisplay();
            
        } catch (error) {
            alert('Error pausing timer: ' + error.message);
        }
    },

    resumeTimer: async (timerId) => {
        try {
            const response = await API.post(`/time-entries/timer/resume/${timerId}`);
            const timer = response.timeEntry;
            
            DashboardPage.timers.set(timer.id, timer);
            DashboardPage.updateActiveTimersDisplay();
            
        } catch (error) {
            alert('Error resuming timer: ' + error.message);
        }
    },

    commitTimer: async (timerId) => {
        try {
            await API.post(`/time-entries/timer/commit/${timerId}`);
            
            DashboardPage.timers.delete(timerId);
            DashboardPage.updateActiveTimersDisplay();
            DashboardPage.updateActiveCount();
            DashboardPage.renderPinnedProjects();
            await DashboardPage.loadTodayEntries();
            
            // Refresh the timer widget
            if (window.timer) {
                await window.timer.refresh();
            }
            
        } catch (error) {
            alert('Error committing timer: ' + error.message);
        }
    },

    stopTimer: async (timerId) => {
        if (!confirm('Delete this timer? All tracked time will be lost.')) {
            return;
        }
        
        try {
            await API.delete(`/time-entries/${timerId}`);
            
            DashboardPage.timers.delete(timerId);
            DashboardPage.updateActiveTimersDisplay();
            DashboardPage.updateActiveCount();
            DashboardPage.renderPinnedProjects();
            
            // Refresh the timer widget
            if (window.timer) {
                await window.timer.refresh();
            }
            
        } catch (error) {
            alert('Error deleting timer: ' + error.message);
        }
    },

    updateActiveTimersDisplay: () => {
        const container = document.getElementById('active-timers');
        
        if (DashboardPage.timers.size === 0) {
            container.innerHTML = '<div class="empty-state"><p>No active timers. Start tracking time on a project above!</p></div>';
            return;
        }

        container.innerHTML = Array.from(DashboardPage.timers.values()).map(timer => {
            const isPaused = timer.timer_is_paused || false;
            const elapsedSeconds = DashboardPage.calculateElapsedSeconds(timer);
            const timeStr = DashboardPage.formatTime(elapsedSeconds);
            
            return `
                <div class="timer-card ${isPaused ? 'paused' : ''}" id="timer-card-${timer.id}" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 2px solid ${isPaused ? '#f59e0b' : '#10b981'}; border-radius: 16px; padding: 20px; margin-bottom: 16px; transition: all 0.3s; position: relative; overflow: hidden;">
                    <div class="timer-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                            <div class="timer-indicator ${isPaused ? 'paused' : ''}" style="width: 12px; height: 12px; border-radius: 50%; background: ${isPaused ? '#f59e0b' : '#10b981'}; animation: ${isPaused ? 'none' : 'pulse 2s infinite'}; flex-shrink: 0;"></div>
                            <div class="timer-info" style="flex: 1;">
                                <div class="project-client" style="color: #64748b; font-size: 14px; font-weight: 500; margin-bottom: 4px;">${timer.client_name}</div>
                                <h4 style="margin: 0; font-size: 18px; font-weight: 700; color: #1e293b; line-height: 1.3;">${timer.project_name}</h4>
                            </div>
                        </div>
                        <div class="timer-time" id="timer-display-${timer.id}" style="font-size: 24px; font-weight: 700; color: #1e293b; font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace; background: white; padding: 8px 16px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);">
                            ${timeStr}
                        </div>
                    </div>
                    <div style="margin: 16px 0;">
                        <textarea class="form-control" 
                               placeholder="What are you working on?"
                               onblur="DashboardPage.updateTimerNotes('${timer.id}')"
                               onkeypress="if(event.key==='Enter' && !event.shiftKey) { event.preventDefault(); this.blur(); }"
                               rows="2" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 14px; transition: all 0.3s; background: white; color: #1e293b; resize: vertical;">${timer.description || ''}</textarea>
                    </div>
                    <div class="timer-controls" style="display: flex; gap: 8px; flex-wrap: wrap;">
                        ${isPaused ? 
                            `<button onclick="DashboardPage.resumeTimer('${timer.id}')" class="btn btn-success btn-sm" title="Resume" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.3);">
                                <span style="font-size: 14px; margin-right: 4px;">▶️</span>
                                Resume
                            </button>` :
                            `<button onclick="DashboardPage.pauseTimer('${timer.id}')" class="btn btn-warning btn-sm" title="Pause" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; box-shadow: 0 4px 6px -1px rgba(245, 158, 11, 0.3);">
                                <span style="font-size: 14px; margin-right: 4px;">⏸️</span>
                                Pause
                            </button>`
                        }
                        <button onclick="DashboardPage.editTimer('${timer.id}')" class="btn btn-secondary btn-sm" title="Edit" style="background: linear-gradient(135deg, #64748b 0%, #475569 100%); color: white;">
                            <span style="font-size: 14px; margin-right: 4px;">✏️</span>
                            Edit
                        </button>
                        <button onclick="DashboardPage.commitTimer('${timer.id}')" class="btn btn-primary btn-sm" title="Save" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);">
                            <span style="font-size: 14px; margin-right: 4px;">💾</span>
                            Save
                        </button>
                        <button onclick="DashboardPage.stopTimer('${timer.id}')" class="btn btn-danger btn-sm" title="Delete" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.3);">
                            <span style="font-size: 14px; margin-right: 4px;">🗑️</span>
                            Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    calculateElapsedSeconds: (timer) => {
        let totalSeconds = timer.timer_elapsed_seconds || 0;
        
        // If not paused, add current session time
        if (!timer.timer_is_paused && timer.timer_start) {
            const currentSessionSeconds = Math.floor((new Date() - new Date(timer.timer_start)) / 1000);
            totalSeconds += currentSessionSeconds;
        }
        
        return totalSeconds;
    },

    formatTime: (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },

    startTimerUpdateLoop: () => {
        // Update all timer displays every second
        setInterval(() => {
            DashboardPage.timers.forEach(timer => {
                if (!timer.timer_is_paused) {
                    const displayEl = document.getElementById(`timer-display-${timer.id}`);
                    if (displayEl) {
                        const elapsedSeconds = DashboardPage.calculateElapsedSeconds(timer);
                        displayEl.textContent = DashboardPage.formatTime(elapsedSeconds);
                    }
                }
            });
        }, 1000);
    },

    updateActiveCount: () => {
        const countEl = document.getElementById('active-count');
        if (countEl) {
            countEl.textContent = DashboardPage.timers.size;
        }
    },

    loadTodayEntries: async () => {
        try {
            // Use server-side endpoint that handles timezone correctly
            const entries = await API.get('/time-entries/today');
            const container = document.getElementById('today-entries');
            
            DashboardPage.todayEntries = entries.timeEntries;
            
            // Calculate total hours for completed entries only
            const totalHours = entries.timeEntries
                .filter(entry => !entry.timer_start || entry.timer_end)
                .reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
            document.getElementById('total-today').textContent = totalHours.toFixed(1);
            
            if (entries.timeEntries.length === 0) {
                container.innerHTML = '<div class="empty-state"><p>No time tracked today yet.</p></div>';
                return;
            }

            // Group by project and filter out active timers (those without timer_end)
            const byProject = {};
            entries.timeEntries.forEach(entry => {
                // Only show completed entries (those with timer_end or no timer_start)
                if (!entry.timer_start || entry.timer_end) {
                    if (!byProject[entry.project_id]) {
                        byProject[entry.project_id] = {
                            project_name: entry.project_name,
                            client_name: entry.client_name,
                            entries: [],
                            total: 0
                        };
                    }
                    byProject[entry.project_id].entries.push(entry);
                    byProject[entry.project_id].total += parseFloat(entry.hours);
                }
            });

            // Check if we have any completed entries
            if (Object.keys(byProject).length === 0) {
                container.innerHTML = '<div class="empty-state"><p>No completed time entries today yet.</p></div>';
                return;
            }
            
            container.innerHTML = Object.values(byProject).map(group => `
                <div class="today-project" style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid rgba(255, 255, 255, 0.8); margin-bottom: 16px;">
                    <div class="project-summary" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h4 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 700; color: #1e293b;">${group.project_name}</h4>
                                <span class="client-name" style="color: #64748b; font-size: 14px; font-weight: 500;">${group.client_name}</span>
                            </div>
                            <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid rgba(59, 130, 246, 0.2); padding: 8px 16px; border-radius: 8px; text-align: center;">
                                <span class="project-total" style="color: #3b82f6; font-weight: 700; font-size: 16px;">${group.total_hours.toFixed(1)}h</span>
                            </div>
                        </div>
                    </div>
                    <div class="project-entries" style="padding: 0;">
                        ${group.entries.map(entry => `
                            <div class="entry-item" style="padding: 16px 20px; border-bottom: 1px solid #f1f5f9; transition: background-color 0.2s; display: flex; justify-content: space-between; align-items: center;">
                                <div style="flex: 1;">
                                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 4px;">
                                        <span class="entry-time" style="font-weight: 700; color: #3b82f6; font-size: 14px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.2);">${(parseFloat(entry.hours || 0)).toFixed(1)}h</span>
                                        <span style="font-size: 12px; color: #64748b; font-weight: 500;">${new Date(entry.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <span class="entry-desc" style="color: #64748b; font-size: 14px; line-height: 1.4;">${entry.description || 'No description'}</span>
                                </div>
                                <button onclick="DashboardPage.editEntry('${entry.id}')" class="btn-icon" title="Edit" style="background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); border: 1px solid #e2e8f0; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; transition: all 0.3s; color: #64748b; margin-left: 12px;">
                                    ✏️
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading today entries:', error);
        }
    },

    updateTimerNotes: async (timerId) => {
        const notesInput = document.querySelector(`#timer-card-${timerId} textarea`);
        if (!notesInput) return;
        
        const newDescription = notesInput.value.trim();
        const timer = DashboardPage.timers.get(timerId);
        
        if (!timer || timer.description === newDescription) return;
        
        try {
            await API.put(`/time-entries/${timerId}`, {
                description: newDescription
            });
            
            // Update local timer data
            timer.description = newDescription;
            DashboardPage.timers.set(timerId, timer);
        } catch (error) {
            console.error('Error updating timer notes:', error);
        }
    },

    showQuickEntry: async () => {
        // Get server date first
        const serverTime = await API.get('/server-time');
        const currentDate = serverTime.currentDate;
        
        // Close FAB when opening modal
        const fabContainer = document.getElementById('fab-container');
        if (fabContainer) {
            fabContainer.classList.remove('expanded');
        }
        
        document.getElementById('modal-container').innerHTML = `
            <div class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Quick Time Entry</h3>
                        <button class="btn-close" onclick="DashboardPage.closeModal()">×</button>
                    </div>
                    <form onsubmit="DashboardPage.handleQuickEntry(event)">
                        <div class="modal-body">
                            <div class="form-group">
                                <label class="form-label">Project</label>
                                <select id="quick-project" class="form-control" required>
                                    <option value="">Select project...</option>
                                    ${DashboardPage.pinnedProjects.map(p => 
                                        `<option value="${p.id}">${p.client_name} - ${p.name}</option>`
                                    ).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Hours</label>
                                <input type="number" id="quick-hours" class="form-control" step="0.25" min="0.25" max="24" placeholder="e.g., 2.5" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Description</label>
                                <textarea id="quick-description" class="form-control" rows="3" placeholder="What did you work on?"></textarea>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Date</label>
                                <input type="date" id="quick-date" class="form-control" value="${currentDate}" required>
                            </div>
                            <div class="form-group">
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                    <input type="checkbox" id="quick-billable" checked>
                                    <span>Billable</span>
                                </label>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="DashboardPage.closeModal()">Cancel</button>
                            <button type="submit" class="btn btn-primary">Add Entry</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    handleQuickEntry: async (e) => {
        e.preventDefault();
        
        try {
            await API.post('/time-entries', {
                projectId: document.getElementById('quick-project').value,
                hours: parseFloat(document.getElementById('quick-hours').value),
                description: document.getElementById('quick-description').value,
                date: document.getElementById('quick-date').value,
                isBillable: true
            });
            
            DashboardPage.closeModal();
            await DashboardPage.loadTodayEntries();
        } catch (error) {
            alert('Error adding time entry: ' + error.message);
        }
    },

    showAddTimeModal: async () => {
        await DashboardPage.showQuickEntry();
    },

    showProjectSelector: async () => {
        try {
            const projects = await API.get('/projects?status=active');
            
            // Close FAB when opening modal
            const fabContainer = document.getElementById('fab-container');
            if (fabContainer) {
                fabContainer.classList.remove('expanded');
            }
            
            document.getElementById('modal-container').innerHTML = `
                <div class="modal">
                    <div class="modal-content" style="max-width: 600px;">
                        <div class="modal-header">
                            <h3>Select a Project</h3>
                            <button class="btn-close" onclick="DashboardPage.closeModal()">×</button>
                        </div>
                        <div class="modal-body">
                            <div class="form-group">
                                <input type="text" id="project-search" class="form-control" placeholder="Search projects..." 
                                       onkeyup="DashboardPage.filterProjects()" autofocus>
                            </div>
                            <div id="project-list" class="project-list">
                                ${projects.projects.map(project => {
                                    const hasTimer = Array.from(DashboardPage.timers.values()).some(t => t.project_id === project.id);
                                    return `
                                        <div class="project-item ${hasTimer ? 'disabled' : ''}" 
                                             onclick="${hasTimer ? '' : `DashboardPage.selectProject('${project.id}')`}">
                                            <div style="flex: 1;">
                                                <div class="project-client">${project.client_name}</div>
                                                <h4 style="margin: 0;">${project.name}</h4>
                                            </div>
                                            ${hasTimer ? 
                                                '<span class="badge badge-info">Timer Active</span>' : 
                                                '<span style="color: #3b82f6;">→</span>'}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            window.allProjects = projects.projects;
        } catch (error) {
            alert('Error loading projects: ' + error.message);
        }
    },

    filterProjects: () => {
        const search = document.getElementById('project-search').value.toLowerCase();
        const filtered = window.allProjects.filter(p => 
            p.name.toLowerCase().includes(search) || 
            p.client_name.toLowerCase().includes(search)
        );
        
        document.getElementById('project-list').innerHTML = filtered.map(project => {
            const hasTimer = Array.from(DashboardPage.timers.values()).some(t => t.project_id === project.id);
            return `
                <div class="project-item ${hasTimer ? 'disabled' : ''}" 
                     onclick="${hasTimer ? '' : `DashboardPage.selectProject('${project.id}')`}">
                    <div style="flex: 1;">
                        <div class="project-client">${project.client_name}</div>
                        <h4 style="margin: 0;">${project.name}</h4>
                    </div>
                    ${hasTimer ? 
                        '<span class="badge badge-info">Timer Active</span>' : 
                        '<span style="color: #3b82f6;">→</span>'}
                </div>
            `;
        }).join('');
    },

    selectProject: async (projectId) => {
        DashboardPage.closeModal();
        await DashboardPage.startProjectTimer(projectId);
    },


    managePinned: async () => {
        try {
            const [allProjects, preferences] = await Promise.all([
                API.get('/projects?status=active'),
                API.get('/user-preferences').catch(() => ({ preferences: {} }))
            ]);
            
            const pinnedIds = preferences.preferences?.pinnedProjects || [];
            
            document.getElementById('modal-container').innerHTML = `
                <div class="modal" style="display: block;">
                    <div class="modal-content" style="max-width: 600px;">
                        <div class="modal-header">
                            <h2 class="modal-title">Manage Pinned Projects</h2>
                            <button onclick="DashboardPage.closeModal()" class="modal-close">&times;</button>
                        </div>
                        <div class="modal-body">
                            <p class="text-muted" style="margin-bottom: 1rem;">Select projects to pin to your dashboard</p>
                            <div class="project-list" style="max-height: 400px; overflow-y: auto;">
                                ${allProjects.projects.map(project => `
                                    <div class="project-select-item" style="padding: 1rem; border-bottom: 1px solid #e2e8f0;">
                                        <label style="display: flex; align-items: center; cursor: pointer;">
                                            <input type="checkbox" 
                                                   id="pin-${project.id}" 
                                                   value="${project.id}"
                                                   ${pinnedIds.includes(project.id) ? 'checked' : ''}
                                                   onchange="DashboardPage.updatePinnedCount()"
                                                   style="margin-right: 1rem;">
                                            <div style="flex: 1;">
                                                <div style="font-weight: 500;">${project.name}</div>
                                                <div style="color: #718096; font-size: 0.875rem;">${project.client_name}</div>
                                            </div>
                                        </label>
                                    </div>
                                `).join('')}
                            </div>
                            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e2e8f0;">
                                <span id="pinned-count" style="color: #718096; font-size: 0.875rem;">
                                    ${pinnedIds.length} projects pinned
                                </span>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button onclick="DashboardPage.closeModal()" class="btn btn-secondary">Cancel</button>
                            <button onclick="DashboardPage.savePinnedProjects()" class="btn btn-primary">Save</button>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            alert('Error loading projects: ' + error.message);
        }
    },

    updatePinnedCount: () => {
        const checkedBoxes = document.querySelectorAll('input[id^="pin-"]:checked');
        const count = checkedBoxes.length;
        const countEl = document.getElementById('pinned-count');
        
        if (countEl) {
            countEl.textContent = `${count} projects pinned`;
            countEl.style.color = '#718096';
        }
        
        // No limit on pinned projects anymore
    },
    
    savePinnedProjects: async () => {
        const checkedBoxes = document.querySelectorAll('input[id^="pin-"]:checked');
        const pinnedIds = Array.from(checkedBoxes).map(box => box.value);
        
        // No limit check needed anymore
        
        try {
            // Save to server
            await API.post('/user-preferences', { 
                key: 'pinnedProjects', 
                value: pinnedIds 
            });
            
            // Also save to localStorage as backup
            localStorage.setItem('pinnedProjects', JSON.stringify(pinnedIds));
            
            // Reload pinned projects
            DashboardPage.closeModal();
            await DashboardPage.loadPinnedProjects();
        } catch (error) {
            alert('Error saving preferences: ' + error.message);
        }
    },

    editTimer: (timerId) => {
        const timer = DashboardPage.timers.get(timerId);
        if (!timer) return;
        
        // Calculate current elapsed time
        const elapsedSeconds = DashboardPage.calculateElapsedSeconds(timer);
        const currentHours = (elapsedSeconds / 3600).toFixed(2);
        
        document.getElementById('modal-container').innerHTML = `
            <div class="modal" style="display: block;">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2 class="modal-title">Edit Timer</h2>
                        <button onclick="DashboardPage.closeModal()" class="modal-close">&times;</button>
                    </div>
                    <form onsubmit="DashboardPage.handleTimerEdit(event, '${timerId}')">
                        <div class="form-group">
                            <label class="form-label">Project</label>
                            <input type="text" class="form-control" value="${timer.client_name} - ${timer.project_name}" disabled>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Hours</label>
                            <div style="display: flex; gap: 0.5rem; align-items: center;">
                                <input type="number" id="edit-hours" class="form-control" step="0.1" min="0" max="24" value="${currentHours}" required style="flex: 1;">
                                <button type="button" onclick="DashboardPage.adjustTime(-5)" class="btn btn-secondary" style="padding: 0.5rem 0.75rem;" title="Remove 5 minutes">-5m</button>
                                <button type="button" onclick="DashboardPage.adjustTime(5)" class="btn btn-secondary" style="padding: 0.5rem 0.75rem;" title="Add 5 minutes">+5m</button>
                            </div>
                            <small class="form-help">Current: ${currentHours} hours</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <textarea id="edit-description" class="form-control" rows="3">${timer.description || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">
                                <input type="checkbox" id="edit-commit"> Commit timer after editing
                            </label>
                        </div>
                        <button type="submit" class="btn btn-primary">Save Changes</button>
                    </form>
                </div>
            </div>
        `;
    },
    
    adjustTime: (minutes) => {
        const hoursInput = document.getElementById('edit-hours');
        const currentHours = parseFloat(hoursInput.value) || 0;
        const adjustment = minutes / 60; // Convert minutes to hours
        const newHours = Math.max(0, currentHours + adjustment);
        hoursInput.value = newHours.toFixed(2);
    },

    handleTimerEdit: async (e, timerId) => {
        e.preventDefault();
        
        const hours = parseFloat(document.getElementById('edit-hours').value);
        const description = document.getElementById('edit-description').value;
        const shouldCommit = document.getElementById('edit-commit').checked;
        
        // Convert hours to seconds
        const newElapsedSeconds = Math.round(hours * 3600);
        
        try {
            // Update the timer with new elapsed seconds
            const timer = DashboardPage.timers.get(timerId);
            
            // Update timer description
            await API.put(`/time-entries/${timerId}`, {
                description: description,
                timer_elapsed_seconds: newElapsedSeconds
            });
            
            // Update local timer data
            timer.description = description;
            timer.timer_elapsed_seconds = newElapsedSeconds;
            DashboardPage.timers.set(timerId, timer);
            
            if (shouldCommit) {
                await DashboardPage.commitTimer(timerId);
            } else {
                DashboardPage.updateActiveTimersDisplay();
            }
            
            DashboardPage.closeModal();
        } catch (error) {
            alert('Error updating timer: ' + error.message);
        }
    },
    
    editEntry: async (entryId) => {
        try {
            const response = await API.get(`/time-entries/${entryId}`);
            const entry = response.timeEntry;
            
            document.getElementById('modal-container').innerHTML = `
                <div class="modal" style="display: block;">
                    <div class="modal-content" style="max-width: 500px;">
                        <div class="modal-header">
                            <h2 class="modal-title">Edit Time Entry</h2>
                            <button onclick="DashboardPage.closeModal()" class="modal-close">&times;</button>
                        </div>
                        <form onsubmit="DashboardPage.handleEditEntry(event, '${entryId}')">
                            <div class="form-group">
                                <label class="form-label">Client</label>
                                <input type="text" class="form-control" value="${entry.client_name}" disabled>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Project</label>
                                <input type="text" class="form-control" value="${entry.project_name}" disabled>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Date</label>
                                <input type="date" id="edit-entry-date" class="form-control" required value="${entry.date.split('T')[0]}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Hours</label>
                                <input type="number" id="edit-entry-hours" class="form-control" step="0.1" min="0.1" max="24" required value="${entry.hours}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Notes</label>
                                <textarea id="edit-entry-description" class="form-control" rows="3">${entry.description || ''}</textarea>
                            </div>
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="edit-entry-billable" ${entry.is_billable ? 'checked' : ''}> Billable
                                </label>
                            </div>
                            <button type="submit" class="btn btn-primary">Save Changes</button>
                        </form>
                    </div>
                </div>
            `;
        } catch (error) {
            alert('Error loading entry details: ' + error.message);
        }
    },

    handleEditEntry: async (e, entryId) => {
        e.preventDefault();
        
        try {
            await API.put(`/time-entries/${entryId}`, {
                date: document.getElementById('edit-entry-date').value,
                hours: parseFloat(document.getElementById('edit-entry-hours').value),
                description: document.getElementById('edit-entry-description').value,
                is_billable: document.getElementById('edit-entry-billable').checked
            });
            
            DashboardPage.closeModal();
            await DashboardPage.loadTodayEntries();
        } catch (error) {
            alert('Error updating entry: ' + error.message);
        }
    },

    closeModal: () => {
        document.getElementById('modal-container').innerHTML = '';
    }
};

window.DashboardPage = DashboardPage;
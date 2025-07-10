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
            <div class="dashboard-container">
                <div class="dashboard-header">
                    <h1>Hello, ${user.firstName}! 👋 <small style="font-size: 0.5em; color: #718096;">(${DateUtils.getTimezoneAbbr()})</small></h1>
                    <div class="today-summary">
                        <span class="today-hours">Today: <strong id="total-today">0.0</strong> hours</span>
                        <span class="active-timers">Active timers: <strong id="active-count">0</strong></span>
                    </div>
                </div>

                <!-- Quick Actions Bar -->
                <div class="quick-actions">
                    <button onclick="DashboardPage.showQuickEntry()" class="btn btn-outline">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 5v14M5 12h14"></path>
                        </svg>
                        Quick Entry
                    </button>
                    <button onclick="DashboardPage.showProjectSelector()" class="btn btn-outline">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 5v14M5 12h14"></path>
                        </svg>
                        Add Timer
                    </button>
                </div>

                <!-- Pinned Projects Section -->
                <div class="dashboard-section">
                    <div class="section-header">
                        <h2>Pinned Projects</h2>
                        <button onclick="DashboardPage.managePinned()" class="btn btn-sm btn-ghost">Manage</button>
                    </div>
                    <div id="pinned-projects" class="project-grid">
                        <div class="loading-spinner">Loading...</div>
                    </div>
                </div>

                <!-- Active Timers Section -->
                <div class="dashboard-section">
                    <h2>Active Timers</h2>
                    <div id="active-timers" class="timers-container">
                        <p class="empty-state">No active timers. Start tracking time on a project above!</p>
                    </div>
                </div>

                <!-- Today's Time Entries -->
                <div class="dashboard-section">
                    <div class="section-header">
                        <h2>Today's Work</h2>
                        <div>
                            <button onclick="DashboardPage.showAddTimeModal()" class="btn btn-sm btn-primary">Add Time</button>
                            <a href="#/time-entries" class="btn btn-sm btn-ghost">View All</a>
                        </div>
                    </div>
                    <div id="today-entries" class="entries-list">
                        <div class="loading-spinner">Loading...</div>
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
        
        // Load all data in parallel
        await Promise.all([
            DashboardPage.loadPinnedProjects(),
            DashboardPage.loadActiveTimers(),
            DashboardPage.loadTodayEntries()
        ]);

        // Start timer update loop
        DashboardPage.startTimerUpdateLoop();
    },

    clearAllIntervals: () => {
        DashboardPage.timerIntervals.forEach(intervalId => clearInterval(intervalId));
        DashboardPage.timerIntervals.clear();
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
                // Default to first 6 projects if none are pinned
                DashboardPage.pinnedProjects = projects.projects.slice(0, 6);
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
            return `
                <div class="project-card" data-project-id="${project.id}">
                    <div class="project-header">
                        <div>
                            <p class="project-client">${project.client_name}</p>
                            <h3>${project.name}</h3>
                        </div>
                        <button onclick="DashboardPage.togglePin('${project.id}')" class="btn-icon" title="Unpin">
                            📌
                        </button>
                    </div>
                    <div class="project-stats">
                        <span>${parseFloat(project.total_hours || 0).toFixed(1)} hrs</span>
                        ${project.budget_hours ? `<span>${Math.round((project.total_hours / project.budget_hours) * 100)}% of ${project.budget_hours}h</span>` : ''}
                    </div>
                    <div class="project-timer" id="project-timer-${project.id}">
                        ${hasTimer ? 
                            '<span class="timer-badge">Timer Active</span>' :
                            `<button onclick="DashboardPage.startProjectTimer('${project.id}')" class="btn btn-primary btn-block">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                </svg>
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
                const notesInput = document.querySelector(`#timer-card-${timer.id} input`);
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
            container.innerHTML = '<p class="empty-state">No active timers. Start tracking time on a project above!</p>';
            return;
        }

        container.innerHTML = Array.from(DashboardPage.timers.values()).map(timer => {
            const isPaused = timer.timer_is_paused || false;
            const elapsedSeconds = DashboardPage.calculateElapsedSeconds(timer);
            const timeStr = DashboardPage.formatTime(elapsedSeconds);
            
            return `
                <div class="active-timer-card ${isPaused ? 'timer-paused' : 'timer-running'}" id="timer-card-${timer.id}">
                    <div class="timer-indicator ${isPaused ? 'indicator-paused' : 'indicator-running'}"></div>
                    <div class="timer-info">
                        <div class="timer-project-info">
                            <span class="timer-client">${timer.client_name}</span>
                            <h4>${timer.project_name}</h4>
                        </div>
                        <input type="text" 
                               class="timer-notes-input-inline" 
                               placeholder="What are you working on?"
                               value="${timer.description || ''}"
                               onblur="DashboardPage.updateTimerNotes('${timer.id}')"
                               onkeypress="if(event.key==='Enter') this.blur()">
                        <div class="timer-time-display" id="timer-display-${timer.id}">
                            ${timeStr}
                        </div>
                    </div>
                    <div class="timer-controls">
                        ${isPaused ? 
                            `<button onclick="DashboardPage.resumeTimer('${timer.id}')" class="btn btn-success btn-sm" title="Resume">
                                ▶
                            </button>` :
                            `<button onclick="DashboardPage.pauseTimer('${timer.id}')" class="btn btn-warning btn-sm" title="Pause">
                                ⏸
                            </button>`
                        }
                        <button onclick="DashboardPage.editTimer('${timer.id}')" class="btn btn-secondary btn-sm" title="Edit">
                            ✏️
                        </button>
                        <button onclick="DashboardPage.commitTimer('${timer.id}')" class="btn btn-primary btn-sm" title="Commit">
                            ✓
                        </button>
                        <button onclick="DashboardPage.stopTimer('${timer.id}')" class="btn btn-danger btn-sm" title="Delete">
                            🗑
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
                container.innerHTML = '<p class="empty-state">No time tracked today yet.</p>';
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
                container.innerHTML = '<p class="empty-state">No completed time entries today yet.</p>';
                return;
            }
            
            container.innerHTML = Object.values(byProject).map(group => `
                <div class="today-project">
                    <div class="project-summary">
                        <div>
                            <span class="client-name">${group.client_name}</span>
                            <h4>${group.project_name}</h4>
                        </div>
                        <span class="project-total">${group.total.toFixed(1)} hrs</span>
                    </div>
                    <div class="project-entries">
                        ${group.entries.map(entry => `
                            <div class="entry-item">
                                <span class="entry-time">${parseFloat(entry.hours).toFixed(1)}h</span>
                                <span class="entry-desc">${entry.description || 'No description'}</span>
                                ${entry.timer_start && !entry.timer_end ? 
                                    '<span class="timer-badge-small">Timer</span>' : 
                                    `<button onclick="DashboardPage.editEntry('${entry.id}')" class="btn-icon" title="Edit">✏️</button>`
                                }
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
        const notesInput = document.querySelector(`#timer-card-${timerId} input`);
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
        document.getElementById('modal-container').innerHTML = `
            <div class="modal" style="display: block;">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2 class="modal-title">Quick Time Entry</h2>
                        <button onclick="DashboardPage.closeModal()" class="modal-close">&times;</button>
                    </div>
                    <form onsubmit="DashboardPage.handleQuickEntry(event)">
                        <div class="form-group">
                            <label class="form-label">Project</label>
                            <select id="quick-project" class="form-control form-select" required>
                                <option value="">Select project...</option>
                                ${DashboardPage.pinnedProjects.map(p => 
                                    `<option value="${p.id}">${p.client_name} - ${p.name}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Hours</label>
                            <input type="number" id="quick-hours" class="form-control" step="0.25" min="0.25" max="24" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <textarea id="quick-description" class="form-control" rows="2"></textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Date</label>
                            <input type="date" id="quick-date" class="form-control" value="${currentDate}" required>
                        </div>
                        <button type="submit" class="btn btn-primary">Add Entry</button>
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
            
            document.getElementById('modal-container').innerHTML = `
                <div class="modal" style="display: block;">
                    <div class="modal-content" style="max-width: 600px;">
                        <div class="modal-header">
                            <h2 class="modal-title">Select a Project</h2>
                            <button onclick="DashboardPage.closeModal()" class="modal-close">&times;</button>
                        </div>
                        <div class="form-group">
                            <input type="text" id="project-search" class="form-control" placeholder="Search projects..." 
                                   onkeyup="DashboardPage.filterProjects()" autofocus>
                        </div>
                        <div id="project-list" style="max-height: 400px; overflow-y: auto;">
                            ${projects.projects.map(project => {
                                const hasTimer = Array.from(DashboardPage.timers.values()).some(t => t.project_id === project.id);
                                return `
                                    <div class="project-select-item ${hasTimer ? 'has-timer' : ''}" 
                                         onclick="${hasTimer ? '' : `DashboardPage.selectProject('${project.id}')`}">
                                        <div>
                                            <p class="text-muted">${project.client_name}</p>
                                            <h4>${project.name}</h4>
                                        </div>
                                        ${hasTimer ? 
                                            '<span class="badge badge-info">Timer Active</span>' : ''}
                                    </div>
                                `;
                            }).join('')}
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
                <div class="project-select-item ${hasTimer ? 'has-timer' : ''}" 
                     onclick="${hasTimer ? '' : `DashboardPage.selectProject('${project.id}')`}">
                    <div>
                        <p class="text-muted">${project.client_name}</p>
                        <h4>${project.name}</h4>
                    </div>
                    ${hasTimer ? 
                        '<span class="badge badge-info">Timer Active</span>' : ''}
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
                            <p class="text-muted" style="margin-bottom: 1rem;">Select up to 6 projects to pin to your dashboard</p>
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
                                    ${pinnedIds.length} of 6 projects pinned
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
            countEl.textContent = `${count} of 6 projects pinned`;
            if (count > 6) {
                countEl.style.color = '#e53e3e';
                countEl.textContent = `${count} of 6 projects selected (maximum exceeded)`;
            } else {
                countEl.style.color = '#718096';
            }
        }
        
        // Disable unchecked boxes if 6 are selected
        const allBoxes = document.querySelectorAll('input[id^="pin-"]');
        allBoxes.forEach(box => {
            if (count >= 6 && !box.checked) {
                box.disabled = true;
            } else {
                box.disabled = false;
            }
        });
    },
    
    savePinnedProjects: async () => {
        const checkedBoxes = document.querySelectorAll('input[id^="pin-"]:checked');
        const pinnedIds = Array.from(checkedBoxes).map(box => box.value);
        
        if (pinnedIds.length > 6) {
            alert('Please select no more than 6 projects');
            return;
        }
        
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
                            <input type="number" id="edit-hours" class="form-control" step="0.1" min="0" max="24" value="${currentHours}" required>
                            <small class="form-help">Current: ${currentHours} hours</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <textarea id="edit-description" class="form-control" rows="3">${timer.description || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">
                                <input type="checkbox" id="edit-commit" checked> Commit timer after editing
                            </label>
                        </div>
                        <button type="submit" class="btn btn-primary">Save Changes</button>
                    </form>
                </div>
            </div>
        `;
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
const DashboardPage = {
    activeTimers: new Map(), // Track multiple active timers
    pinnedProjects: [],
    recentProjects: [],
    todayEntries: [],

    render: async () => {
        const user = Auth.getUser();
        const isAdmin = Auth.isAdmin();

        document.getElementById('app').innerHTML = `
            ${Navbar.render()}
            <div class="dashboard-container">
                <div class="dashboard-header">
                    <h1>Hello, ${user.firstName}! 👋</h1>
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

                <!-- Recent Projects (if no pinned) -->
                <div id="recent-section" class="dashboard-section" style="display: none;">
                    <h2>Recent Projects</h2>
                    <div id="recent-projects" class="project-grid">
                        <div class="loading-spinner">Loading...</div>
                    </div>
                </div>

                ${isAdmin ? `
                    <!-- Team Overview for Admins -->
                    <div class="dashboard-section">
                        <h2>Team Activity</h2>
                        <div id="team-overview" class="team-grid">
                            <div class="loading-spinner">Loading...</div>
                        </div>
                    </div>
                ` : ''}
            </div>
            <div id="modal-container"></div>
        `;

        Navbar.updateActiveLink();
        await DashboardPage.initialize();
    },

    initialize: async () => {
        // Load all data in parallel
        await Promise.all([
            DashboardPage.loadPinnedProjects(),
            DashboardPage.loadActiveTimers(),
            DashboardPage.loadTodayEntries(),
            DashboardPage.loadRecentProjects(),
            Auth.isAdmin() ? DashboardPage.loadTeamOverview() : Promise.resolve()
        ]);

        // Start update interval for timers
        DashboardPage.startTimerUpdates();
    },

    loadPinnedProjects: async () => {
        try {
            // For now, load frequently used projects as "pinned"
            const projects = await API.get('/projects?status=active');
            const container = document.getElementById('pinned-projects');
            
            if (projects.projects.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <p>No pinned projects yet.</p>
                        <button onclick="DashboardPage.showProjectSelector()" class="btn btn-primary">Browse Projects</button>
                    </div>
                `;
                document.getElementById('recent-section').style.display = 'block';
                return;
            }

            DashboardPage.pinnedProjects = projects.projects.slice(0, 6);
            container.innerHTML = DashboardPage.pinnedProjects.map(project => `
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
                    <div class="project-timer" id="timer-${project.id}">
                        <button onclick="DashboardPage.startProjectTimer('${project.id}')" class="btn btn-primary btn-block">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                            Start Timer
                        </button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading pinned projects:', error);
            document.getElementById('pinned-projects').innerHTML = '<p class="error">Error loading projects</p>';
        }
    },

    loadActiveTimers: async () => {
        try {
            const response = await API.get('/time-entries/active-timers');
            if (response.timers && response.timers.length > 0) {
                response.timers.forEach(timer => {
                    DashboardPage.activeTimers.set(timer.project_id, timer);
                    DashboardPage.updateTimerDisplay(timer.project_id, timer);
                });
            }
            DashboardPage.updateActiveCount();
        } catch (error) {
            console.error('Error loading active timers:', error);
        }
    },

    startProjectTimer: async (projectId) => {
        try {
            // Check if timer already active for this project
            if (DashboardPage.activeTimers.has(projectId)) {
                if (confirm('Timer already running for this project. Stop it?')) {
                    await DashboardPage.stopProjectTimer(projectId);
                }
                return;
            }
            
            const response = await API.post('/time-entries/timer/start', {
                projectId,
                description: '',
                isBillable: true
            });

            DashboardPage.activeTimers.set(projectId, response.timeEntry);
            DashboardPage.updateTimerDisplay(projectId, response.timeEntry);
            DashboardPage.updateActiveCount();
            
        } catch (error) {
            alert('Error starting timer: ' + error.message);
        }
    },

    stopProjectTimer: async (projectId) => {
        const timer = DashboardPage.activeTimers.get(projectId);
        if (!timer) return;

        try {
            await API.post(`/time-entries/timer/stop/${timer.id}`);
            DashboardPage.activeTimers.delete(projectId);
            
            // Reset the project card timer display
            const timerEl = document.getElementById(`timer-${projectId}`);
            if (timerEl) {
                timerEl.innerHTML = `
                    <button onclick="DashboardPage.startProjectTimer('${projectId}')" class="btn btn-primary btn-block">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        Start Timer
                    </button>
                `;
            }
            
            DashboardPage.updateActiveCount();
            await DashboardPage.loadTodayEntries();
            
        } catch (error) {
            alert('Error stopping timer: ' + error.message);
        }
    },

    updateTimerDisplay: (projectId, timer) => {
        const timerEl = document.getElementById(`timer-${projectId}`);
        if (!timerEl) return;

        const startTime = new Date(timer.timer_start);
        
        const updateTime = () => {
            const elapsed = Math.floor((new Date() - startTime) / 1000);
            const hours = Math.floor(elapsed / 3600);
            const minutes = Math.floor((elapsed % 3600) / 60);
            const seconds = elapsed % 60;
            const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // Only update the time display, not the entire HTML to preserve input state
            const timeDisplay = timerEl.querySelector('.timer-time');
            if (timeDisplay) {
                timeDisplay.textContent = timeStr;
            } else {
                // Initial render
                timerEl.innerHTML = `
                    <div class="timer-active">
                        <div class="timer-time">${timeStr}</div>
                        <div class="timer-notes">
                            <input type="text" 
                                   id="timer-notes-${projectId}" 
                                   class="timer-notes-input" 
                                   placeholder="Add notes..."
                                   value="${timer.description || ''}"
                                   onblur="DashboardPage.updateTimerNotes('${timer.id}', '${projectId}')"
                                   onkeypress="if(event.key==='Enter') this.blur()">
                        </div>
                        <button onclick="DashboardPage.stopProjectTimer('${projectId}')" class="btn btn-danger btn-sm">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="6" width="12" height="12"></rect>
                            </svg>
                            Stop
                        </button>
                    </div>
                `;
            }
        };
        
        updateTime();
        
        // Also update active timers section
        DashboardPage.updateActiveTimersSection();
    },

    updateActiveTimersSection: () => {
        const container = document.getElementById('active-timers');
        if (DashboardPage.activeTimers.size === 0) {
            container.innerHTML = '<p class="empty-state">No active timers. Start tracking time on a project above!</p>';
            return;
        }

        // Don't re-render if we're just updating times
        const existingCards = container.querySelectorAll('.active-timer-card');
        if (existingCards.length === DashboardPage.activeTimers.size) {
            // Just update the time displays
            DashboardPage.activeTimers.forEach((timer, projectId) => {
                const card = container.querySelector(`[data-timer-id="${timer.id}"]`);
                if (card) {
                    const startTime = new Date(timer.timer_start);
                    const elapsed = Math.floor((new Date() - startTime) / 1000);
                    const hours = Math.floor(elapsed / 3600);
                    const minutes = Math.floor((elapsed % 3600) / 60);
                    const timeStr = `${hours}h ${minutes}m`;
                    const durationEl = card.querySelector('.timer-duration');
                    if (durationEl) durationEl.textContent = timeStr;
                }
            });
            return;
        }

        // Full render
        container.innerHTML = Array.from(DashboardPage.activeTimers.values()).map(timer => {
            const startTime = new Date(timer.timer_start);
            const elapsed = Math.floor((new Date() - startTime) / 1000);
            const hours = Math.floor(elapsed / 3600);
            const minutes = Math.floor((elapsed % 3600) / 60);
            const timeStr = `${hours}h ${minutes}m`;
            
            return `
                <div class="active-timer-card" data-timer-id="${timer.id}">
                    <div class="timer-info">
                        <h4>${timer.project_name || 'Loading...'}</h4>
                        <input type="text" 
                               class="timer-notes-input-inline" 
                               placeholder="What are you working on?"
                               value="${timer.description || ''}"
                               onblur="DashboardPage.updateTimerNotes('${timer.id}', '${timer.project_id}')"
                               onkeypress="if(event.key==='Enter') this.blur()">
                        <span class="timer-duration">${timeStr}</span>
                    </div>
                    <button onclick="DashboardPage.stopProjectTimer('${timer.project_id}')" class="btn btn-danger">
                        Stop
                    </button>
                </div>
            `;
        }).join('');
    },

    startTimerUpdates: () => {
        // Update all active timers every second
        setInterval(() => {
            DashboardPage.activeTimers.forEach((timer, projectId) => {
                DashboardPage.updateTimerDisplay(projectId, timer);
            });
        }, 1000);
    },

    updateActiveCount: () => {
        document.getElementById('active-count').textContent = DashboardPage.activeTimers.size;
    },

    loadTodayEntries: async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const entries = await API.get(`/time-entries?startDate=${today}&endDate=${today}`);
            const container = document.getElementById('today-entries');
            
            DashboardPage.todayEntries = entries.timeEntries;
            
            // Calculate total hours
            const totalHours = entries.timeEntries.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
            document.getElementById('total-today').textContent = totalHours.toFixed(1);
            
            if (entries.timeEntries.length === 0) {
                container.innerHTML = '<p class="empty-state">No time tracked today yet.</p>';
                return;
            }

            // Group by project
            const byProject = {};
            entries.timeEntries.forEach(entry => {
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
            });

            container.innerHTML = Object.values(byProject).map(group => `
                <div class="today-project">
                    <div class="project-summary">
                        <div>
                            <h4>${group.project_name}</h4>
                            <span class="client-name">${group.client_name}</span>
                        </div>
                        <span class="project-total">${group.total.toFixed(1)} hrs</span>
                    </div>
                    <div class="project-entries">
                        ${group.entries.map(entry => `
                            <div class="entry-item">
                                <span class="entry-time">${entry.hours}h</span>
                                <span class="entry-desc">${entry.description || 'No description'}</span>
                                <button onclick="DashboardPage.editEntry('${entry.id}')" class="btn-icon" title="Edit">✏️</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading today entries:', error);
        }
    },

    showQuickEntry: () => {
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
                            <input type="date" id="quick-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
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

    loadRecentProjects: async () => {
        // Implementation for recent projects
    },

    loadTeamOverview: async () => {
        // Implementation for team overview
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
                            ${projects.projects.map(project => `
                                <div class="project-select-item" onclick="DashboardPage.selectProject('${project.id}')">
                                    <div>
                                        <h4>${project.name}</h4>
                                        <p class="text-muted">${project.client_name}</p>
                                    </div>
                                    ${DashboardPage.activeTimers.has(project.id) ? 
                                        '<span class="badge badge-danger">Timer Active</span>' : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
            
            // Store projects for filtering
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
        
        document.getElementById('project-list').innerHTML = filtered.map(project => `
            <div class="project-select-item" onclick="DashboardPage.selectProject('${project.id}')">
                <div>
                    <h4>${project.name}</h4>
                    <p class="text-muted">${project.client_name}</p>
                </div>
                ${DashboardPage.activeTimers.has(project.id) ? 
                    '<span class="badge badge-danger">Timer Active</span>' : ''}
            </div>
        `).join('');
    },
    
    selectProject: async (projectId) => {
        DashboardPage.closeModal();
        await DashboardPage.startProjectTimer(projectId);
        
        // Focus on the notes input after starting timer
        setTimeout(() => {
            const notesInput = document.getElementById(`timer-notes-${projectId}`);
            if (notesInput) {
                notesInput.focus();
            }
        }, 100);
    },

    managePinned: () => {
        // Implementation for managing pinned projects
    },

    togglePin: (projectId) => {
        // Implementation for pin/unpin
    },

    editEntry: (entryId) => {
        // Implementation for editing entry
    },
    
    showAddTimeModal: () => {
        document.getElementById('modal-container').innerHTML = `
            <div class="modal" style="display: block;">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2 class="modal-title">Add Time Entry</h2>
                        <button onclick="DashboardPage.closeModal()" class="modal-close">&times;</button>
                    </div>
                    <form onsubmit="DashboardPage.handleAddTime(event)">
                        <div class="form-group">
                            <label class="form-label">Project *</label>
                            <select id="add-time-project" class="form-control form-select" required>
                                <option value="">Select project...</option>
                                ${DashboardPage.pinnedProjects.map(p => 
                                    `<option value="${p.id}">${p.client_name} - ${p.name}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="grid grid-2">
                            <div class="form-group">
                                <label class="form-label">Hours *</label>
                                <input type="number" id="add-time-hours" class="form-control" 
                                       step="0.25" min="0.25" max="24" required placeholder="2.5">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Date *</label>
                                <input type="date" id="add-time-date" class="form-control" 
                                       value="${new Date().toISOString().split('T')[0]}" required>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Notes</label>
                            <textarea id="add-time-notes" class="form-control" rows="3" 
                                      placeholder="What did you work on?"></textarea>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="add-time-billable" checked>
                                Billable
                            </label>
                        </div>
                        <button type="submit" class="btn btn-primary">Add Time Entry</button>
                    </form>
                </div>
            </div>
        `;
        
        // If not enough pinned projects, load all projects
        if (DashboardPage.pinnedProjects.length < 3) {
            API.get('/projects?status=active').then(response => {
                const select = document.getElementById('add-time-project');
                select.innerHTML = '<option value="">Select project...</option>' + 
                    response.projects.map(p => 
                        `<option value="${p.id}">${p.client_name} - ${p.name}</option>`
                    ).join('');
            });
        }
    },
    
    handleAddTime: async (e) => {
        e.preventDefault();
        
        try {
            await API.post('/time-entries', {
                projectId: document.getElementById('add-time-project').value,
                hours: parseFloat(document.getElementById('add-time-hours').value),
                date: document.getElementById('add-time-date').value,
                description: document.getElementById('add-time-notes').value,
                isBillable: document.getElementById('add-time-billable').checked
            });
            
            DashboardPage.closeModal();
            await DashboardPage.loadTodayEntries();
        } catch (error) {
            alert('Error adding time entry: ' + error.message);
        }
    },

    updateTimerNotes: async (timerId, projectId) => {
        const notesInput = document.getElementById(`timer-notes-${projectId}`) || 
                          document.querySelector(`input[onblur*="'${timerId}'"]`);
        
        if (!notesInput) return;
        
        const newDescription = notesInput.value.trim();
        const timer = DashboardPage.activeTimers.get(projectId);
        
        if (!timer || timer.description === newDescription) return;
        
        try {
            await API.put(`/time-entries/${timerId}`, {
                description: newDescription
            });
            
            // Update local timer data
            timer.description = newDescription;
            DashboardPage.activeTimers.set(projectId, timer);
        } catch (error) {
            console.error('Error updating timer notes:', error);
        }
    },

    closeModal: () => {
        document.getElementById('modal-container').innerHTML = '';
    }
};
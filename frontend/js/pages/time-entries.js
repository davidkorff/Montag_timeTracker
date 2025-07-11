const TimeEntriesPage = {
    render: async () => {
        document.getElementById('app').innerHTML = `
            ${Navbar.render()}
            <div class="container" style="margin-top: 2rem;">
                <div class="card-header">
                    <h1>Time Entries <small style="font-size: 0.6em; color: #718096;">(All times in ${DateUtils.getTimezoneAbbr()})</small></h1>
                    <button onclick="TimeEntriesPage.showAddModal()" class="btn btn-primary">Add Entry</button>
                </div>
                
                <div class="card" style="margin-top: 1rem;">
                    <div id="entries-list">Loading...</div>
                </div>
            </div>
            <div id="timer-container"></div>
            <div id="modal-container"></div>
        `;

        Navbar.updateActiveLink();
        await TimeEntriesPage.loadEntries();
        timer.render();
    },

    loadEntries: async () => {
        try {
            const entries = await API.get('/time-entries');
            const container = document.getElementById('entries-list');
            
            if (entries.timeEntries.length === 0) {
                container.innerHTML = '<p>No time entries found.</p>';
                return;
            }

            container.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-mobile-cards">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>User</th>
                                <th>Client</th>
                                <th>Project</th>
                                <th>Notes</th>
                                <th>Hours</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${entries.timeEntries.map(entry => `
                                <tr>
                                    <td data-label="Date">${DateUtils.formatDate(entry.date)}</td>
                                    <td data-label="User">${entry.user_email || '-'}</td>
                                    <td data-label="Client">${entry.client_name || '-'}</td>
                                    <td data-label="Project">${entry.project_name}</td>
                                    <td data-label="Notes">${entry.description || '-'}</td>
                                    <td data-label="Hours">${entry.hours}</td>
                                    <td data-label="Status"><span class="badge badge-${TimeEntriesPage.getStatusClass(entry.status)}">${entry.status}</span></td>
                                    <td data-label="Actions">
                                        ${entry.status === 'draft' ? `
                                            <div class="btn-group">
                                                <button onclick="TimeEntriesPage.editEntry('${entry.id}')" class="btn btn-sm btn-outline">Edit</button>
                                                <button onclick="TimeEntriesPage.deleteEntry('${entry.id}')" class="btn btn-sm btn-danger">Delete</button>
                                            </div>
                                        ` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            console.error('Error loading entries:', error);
        }
    },

    showAddModal: async () => {
        const serverDate = await DateUtils.getServerDate();
        document.getElementById('modal-container').innerHTML = `
            <div class="modal" style="display: block;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">Add Time Entry</h2>
                        <button onclick="TimeEntriesPage.closeModal()" class="modal-close">&times;</button>
                    </div>
                    <form onsubmit="TimeEntriesPage.handleAdd(event)">
                        <div class="form-group">
                            <label class="form-label">Project</label>
                            <select id="entry-project" class="form-control form-select" required>
                                <option value="">Select project...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Date</label>
                            <input type="date" id="entry-date" class="form-control" required value="${serverDate}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Hours</label>
                            <input type="number" id="entry-hours" class="form-control" step="0.25" min="0.25" max="24" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <textarea id="entry-description" class="form-control" rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="entry-billable" checked> Billable
                            </label>
                        </div>
                        <button type="submit" class="btn btn-primary">Add Entry</button>
                    </form>
                </div>
            </div>
        `;
        TimeEntriesPage.loadProjectsForModal();
    },

    loadProjectsForModal: async () => {
        try {
            const projects = await API.get('/projects?status=active');
            const select = document.getElementById('entry-project');
            
            projects.projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.id;
                option.textContent = `${project.client_name} - ${project.name}`;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading projects:', error);
        }
    },

    handleAdd: async (e) => {
        e.preventDefault();
        
        try {
            await API.post('/time-entries', {
                projectId: document.getElementById('entry-project').value,
                date: document.getElementById('entry-date').value,
                hours: parseFloat(document.getElementById('entry-hours').value),
                description: document.getElementById('entry-description').value,
                isBillable: document.getElementById('entry-billable').checked
            });
            
            TimeEntriesPage.closeModal();
            await TimeEntriesPage.loadEntries();
        } catch (error) {
            alert('Error adding entry: ' + error.message);
        }
    },

    deleteEntry: async (id) => {
        if (!confirm('Are you sure you want to delete this entry?')) return;
        
        try {
            await API.delete(`/time-entries/${id}`);
            await TimeEntriesPage.loadEntries();
        } catch (error) {
            alert('Error deleting entry: ' + error.message);
        }
    },

    editEntry: async (id) => {
        try {
            const response = await API.get(`/time-entries/${id}`);
            const entry = response.timeEntry;
            
            document.getElementById('modal-container').innerHTML = `
                <div class="modal" style="display: block;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2 class="modal-title">Edit Time Entry</h2>
                            <button onclick="TimeEntriesPage.closeModal()" class="modal-close">&times;</button>
                        </div>
                        <form onsubmit="TimeEntriesPage.handleEdit(event, '${id}')">
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
                                <input type="date" id="edit-date" class="form-control" required value="${entry.date.split('T')[0]}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Hours</label>
                                <input type="number" id="edit-hours" class="form-control" step="0.1" min="0.1" max="24" required value="${entry.hours}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Notes</label>
                                <textarea id="edit-description" class="form-control" rows="3">${entry.description || ''}</textarea>
                            </div>
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="edit-billable" ${entry.is_billable ? 'checked' : ''}> Billable
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

    handleEdit: async (e, id) => {
        e.preventDefault();
        
        try {
            await API.put(`/time-entries/${id}`, {
                date: document.getElementById('edit-date').value,
                hours: parseFloat(document.getElementById('edit-hours').value),
                description: document.getElementById('edit-description').value,
                is_billable: document.getElementById('edit-billable').checked
            });
            
            TimeEntriesPage.closeModal();
            await TimeEntriesPage.loadEntries();
        } catch (error) {
            alert('Error updating entry: ' + error.message);
        }
    },

    closeModal: () => {
        document.getElementById('modal-container').innerHTML = '';
    },

    getStatusClass: (status) => {
        const statusClasses = {
            'draft': 'info',
            'submitted': 'warning',
            'approved': 'success',
            'rejected': 'danger'
        };
        return statusClasses[status] || 'info';
    }
};

// Make TimeEntriesPage available globally for onclick handlers
window.TimeEntriesPage = TimeEntriesPage;
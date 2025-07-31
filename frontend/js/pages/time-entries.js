const TimeEntriesPage = {
    render: async () => {
        const isAdmin = Auth.isAdmin();
        document.getElementById('app').innerHTML = `
            ${Navbar.render()}
            <div class="container" style="margin-top: 2rem;">
                <div class="card-header">
                    <h1>Time Entries <small style="font-size: 0.6em; color: #718096;">(All times in ${DateUtils.getTimezoneAbbr()})</small></h1>
                    <div>
                        <button onclick="TimeEntriesPage.showAddModal()" class="btn btn-primary">Add Entry</button>
                        ${isAdmin ? `
                            <button onclick="TimeEntriesPage.bulkApprove()" class="btn btn-success" id="bulk-approve-btn" style="display: none;">Approve Selected</button>
                            <button onclick="TimeEntriesPage.bulkReject()" class="btn btn-danger" id="bulk-reject-btn" style="display: none;">Reject Selected</button>
                        ` : ''}
                    </div>
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
            const isAdmin = Auth.isAdmin();
            
            if (entries.timeEntries.length === 0) {
                container.innerHTML = '<p>No time entries found.</p>';
                return;
            }

            container.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-mobile-cards">
                        <thead>
                            <tr>
                                ${isAdmin ? '<th><input type="checkbox" id="select-all-entries" onchange="TimeEntriesPage.toggleSelectAll()"></th>' : ''}
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
                                    ${isAdmin ? `<td data-label="Select" style="width: 40px;">
                                        ${entry.status === 'submitted' ? 
                                            `<input type="checkbox" class="entry-checkbox" data-entry-id="${entry.id}" onchange="TimeEntriesPage.updateBulkButtons()">` : 
                                            ''
                                        }
                                    </td>` : ''}
                                    <td data-label="Date" style="width: 100px; white-space: nowrap;">${DateUtils.formatDate(entry.date)}</td>
                                    <td data-label="User" style="width: 120px;">${entry.user_email || '-'}</td>
                                    <td data-label="Client" style="width: 120px;">${entry.client_name || '-'}</td>
                                    <td data-label="Project" style="width: 150px;">${entry.project_name}</td>
                                    <td data-label="Notes" class="notes-cell">${entry.description || '-'}</td>
                                    <td data-label="Hours" style="width: 80px; text-align: center; font-weight: 600;">${entry.hours}</td>
                                    <td data-label="Status" style="width: 100px;"><span class="badge badge-${TimeEntriesPage.getStatusClass(entry.status)}">${entry.status}</span></td>
                                    <td data-label="Actions" class="actions-cell">
                                        ${entry.status === 'draft' || entry.status === 'rejected' ? `
                                            <div class="btn-group">
                                                <button onclick="TimeEntriesPage.submitEntry('${entry.id}')" class="btn btn-sm btn-primary">Submit</button>
                                                <button onclick="TimeEntriesPage.editEntry('${entry.id}')" class="btn btn-sm btn-outline">Edit</button>
                                                <button onclick="TimeEntriesPage.deleteEntry('${entry.id}')" class="btn btn-sm btn-danger">Delete</button>
                                            </div>
                                        ` : ''}
                                        ${isAdmin && entry.status === 'submitted' ? `
                                            <div class="btn-group">
                                                <button onclick="TimeEntriesPage.approveEntry('${entry.id}')" class="btn btn-sm btn-success">Approve</button>
                                                <button onclick="TimeEntriesPage.rejectEntry('${entry.id}')" class="btn btn-sm btn-danger">Reject</button>
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
    },

    toggleSelectAll: () => {
        const selectAll = document.getElementById('select-all-entries');
        const checkboxes = document.querySelectorAll('.entry-checkbox');
        checkboxes.forEach(cb => cb.checked = selectAll.checked);
        TimeEntriesPage.updateBulkButtons();
    },

    updateBulkButtons: () => {
        const checkedBoxes = document.querySelectorAll('.entry-checkbox:checked');
        const approveBtn = document.getElementById('bulk-approve-btn');
        const rejectBtn = document.getElementById('bulk-reject-btn');
        
        if (approveBtn && rejectBtn) {
            const hasChecked = checkedBoxes.length > 0;
            approveBtn.style.display = hasChecked ? 'inline-block' : 'none';
            rejectBtn.style.display = hasChecked ? 'inline-block' : 'none';
        }
    },

    approveEntry: async (id) => {
        if (!confirm('Are you sure you want to approve this time entry?')) return;
        
        try {
            await API.approveTimeEntries([id]);
            alert('Time entry approved successfully');
            await TimeEntriesPage.loadEntries();
        } catch (error) {
            alert('Error approving time entry: ' + error.message);
        }
    },

    rejectEntry: async (id) => {
        const reason = prompt('Please provide a reason for rejection:');
        if (!reason) return;
        
        try {
            await API.rejectTimeEntries([id], reason);
            alert('Time entry rejected successfully');
            await TimeEntriesPage.loadEntries();
        } catch (error) {
            alert('Error rejecting time entry: ' + error.message);
        }
    },

    bulkApprove: async () => {
        const checkedBoxes = document.querySelectorAll('.entry-checkbox:checked');
        const ids = Array.from(checkedBoxes).map(cb => cb.dataset.entryId);
        
        if (ids.length === 0) {
            alert('Please select entries to approve');
            return;
        }
        
        if (!confirm(`Are you sure you want to approve ${ids.length} time entries?`)) return;
        
        try {
            await API.approveTimeEntries(ids);
            alert(`${ids.length} time entries approved successfully`);
            await TimeEntriesPage.loadEntries();
        } catch (error) {
            alert('Error approving time entries: ' + error.message);
        }
    },

    bulkReject: async () => {
        const checkedBoxes = document.querySelectorAll('.entry-checkbox:checked');
        const ids = Array.from(checkedBoxes).map(cb => cb.dataset.entryId);
        
        if (ids.length === 0) {
            alert('Please select entries to reject');
            return;
        }
        
        const reason = prompt('Please provide a reason for rejection:');
        if (!reason) return;
        
        if (!confirm(`Are you sure you want to reject ${ids.length} time entries?`)) return;
        
        try {
            await API.rejectTimeEntries(ids, reason);
            alert(`${ids.length} time entries rejected successfully`);
            await TimeEntriesPage.loadEntries();
        } catch (error) {
            alert('Error rejecting time entries: ' + error.message);
        }
    },

    submitEntry: async (id) => {
        if (!confirm('Are you sure you want to submit this time entry for approval?')) return;
        
        try {
            await API.post('/time-entries/submit', { entryIds: [id] });
            alert('Time entry submitted for approval');
            await TimeEntriesPage.loadEntries();
        } catch (error) {
            alert('Error submitting time entry: ' + error.message);
        }
    }
};

// Make TimeEntriesPage available globally for onclick handlers
window.TimeEntriesPage = TimeEntriesPage;
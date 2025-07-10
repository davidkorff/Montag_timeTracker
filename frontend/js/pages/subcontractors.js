const SubcontractorsPage = {
    render: async () => {
        if (!Auth.isAdmin()) {
            router.navigate('/dashboard');
            return;
        }

        document.getElementById('app').innerHTML = `
            ${Navbar.render()}
            <div class="container" style="margin-top: 2rem;">
                <div class="card-header">
                    <h1>Subcontractors</h1>
                    <button onclick="SubcontractorsPage.showAddModal()" class="btn btn-primary">Add Subcontractor</button>
                </div>
                
                <div class="card" style="margin-top: 1rem;">
                    <div id="subcontractors-list">Loading...</div>
                </div>
            </div>
            <div id="timer-container"></div>
            <div id="modal-container"></div>
        `;

        Navbar.updateActiveLink();
        await SubcontractorsPage.loadSubcontractors();
        timer.render();
    },

    loadSubcontractors: async () => {
        try {
            const response = await API.get('/subcontractors');
            const container = document.getElementById('subcontractors-list');
            
            if (response.subcontractors.length === 0) {
                container.innerHTML = '<p>No subcontractors found.</p>';
                return;
            }

            container.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-mobile-cards">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Hourly Rate</th>
                                <th>Total Hours</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.subcontractors.map(sub => `
                                <tr>
                                    <td data-label="Name">${sub.first_name} ${sub.last_name}</td>
                                    <td data-label="Email">${sub.email || '-'}</td>
                                    <td data-label="Phone">${sub.phone || '-'}</td>
                                    <td data-label="Hourly Rate">${sub.hourly_rate ? '$' + sub.hourly_rate : '-'}</td>
                                    <td data-label="Total Hours">${sub.total_hours || 0}</td>
                                    <td data-label="Status">
                                        <span class="badge badge-${sub.is_active ? 'success' : 'danger'}">
                                            ${sub.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td data-label="Actions">
                                        <div class="btn-group">
                                            <button onclick="SubcontractorsPage.showEditModal('${sub.id}')" class="btn btn-sm btn-outline">Edit</button>
                                            <button onclick="SubcontractorsPage.showTimeEntryModal('${sub.id}')" class="btn btn-sm btn-primary">Log Time</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            console.error('Error loading subcontractors:', error);
            document.getElementById('subcontractors-list').innerHTML = '<p>Error loading subcontractors.</p>';
        }
    },

    showAddModal: () => {
        document.getElementById('modal-container').innerHTML = `
            <div class="modal" style="display: block;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">Add Subcontractor</h2>
                        <button onclick="SubcontractorsPage.closeModal()" class="modal-close">&times;</button>
                    </div>
                    <form onsubmit="SubcontractorsPage.handleAdd(event)">
                        <div class="form-group">
                            <label class="form-label">First Name *</label>
                            <input type="text" id="sub-firstName" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Last Name *</label>
                            <input type="text" id="sub-lastName" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Email</label>
                            <input type="email" id="sub-email" class="form-control">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Phone</label>
                            <input type="tel" id="sub-phone" class="form-control">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Hourly Rate</label>
                            <input type="number" id="sub-hourlyRate" class="form-control" step="0.01" min="0">
                        </div>
                        <button type="submit" class="btn btn-primary">Add Subcontractor</button>
                    </form>
                </div>
            </div>
        `;
    },

    showTimeEntryModal: async (subcontractorId) => {
        document.getElementById('modal-container').innerHTML = `
            <div class="modal" style="display: block;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">Log Time for Subcontractor</h2>
                        <button onclick="SubcontractorsPage.closeModal()" class="modal-close">&times;</button>
                    </div>
                    <form onsubmit="SubcontractorsPage.handleTimeEntry(event, '${subcontractorId}')">
                        <div class="form-group">
                            <label class="form-label">Project *</label>
                            <select id="entry-project" class="form-control form-select" required>
                                <option value="">Select project...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Date *</label>
                            <input type="date" id="entry-date" class="form-control" required value="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Hours *</label>
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
                        <button type="submit" class="btn btn-primary">Log Time</button>
                    </form>
                </div>
            </div>
        `;
        
        // Load projects
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
            await API.post('/subcontractors', {
                firstName: document.getElementById('sub-firstName').value,
                lastName: document.getElementById('sub-lastName').value,
                email: document.getElementById('sub-email').value || null,
                phone: document.getElementById('sub-phone').value || null,
                hourlyRate: parseFloat(document.getElementById('sub-hourlyRate').value) || null
            });
            
            SubcontractorsPage.closeModal();
            await SubcontractorsPage.loadSubcontractors();
        } catch (error) {
            alert('Error adding subcontractor: ' + error.message);
        }
    },

    handleTimeEntry: async (e, subcontractorId) => {
        e.preventDefault();
        
        try {
            await API.post('/subcontractors/time-entry', {
                subcontractorId: subcontractorId,
                projectId: document.getElementById('entry-project').value,
                date: document.getElementById('entry-date').value,
                hours: parseFloat(document.getElementById('entry-hours').value),
                description: document.getElementById('entry-description').value,
                isBillable: document.getElementById('entry-billable').checked
            });
            
            SubcontractorsPage.closeModal();
            alert('Time entry added successfully');
        } catch (error) {
            alert('Error adding time entry: ' + error.message);
        }
    },

    showEditModal: async (id) => {
        // TODO: Implement edit functionality
        alert('Edit functionality coming soon!');
    },

    closeModal: () => {
        document.getElementById('modal-container').innerHTML = '';
    }
};

window.SubcontractorsPage = SubcontractorsPage;
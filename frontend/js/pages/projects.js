const ProjectsPage = {
    render: async () => {
        document.getElementById('app').innerHTML = `
            ${Navbar.render()}
            <div class="container" style="margin-top: 2rem;">
                <div class="card-header">
                    <h1>Projects</h1>
                    <button onclick="ProjectsPage.showAddModal()" class="btn btn-primary">Add Project</button>
                </div>
                
                <div class="card" style="margin-top: 1rem;">
                    <div class="filter-container" style="margin-bottom: 1rem;">
                        <select id="filter-client" class="form-control form-select" style="width: 250px; display: inline-block;" onchange="ProjectsPage.loadProjects()">
                            <option value="">All Clients</option>
                        </select>
                        <select id="filter-status" class="form-control form-select" style="width: 150px; display: inline-block; margin-left: 1rem;" onchange="ProjectsPage.loadProjects()">
                            <option value="">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="on_hold">On Hold</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                    <div id="projects-list">Loading...</div>
                </div>
            </div>
            <div id="timer-container"></div>
            <div id="modal-container"></div>
        `;

        Navbar.updateActiveLink();
        await ProjectsPage.loadFilters();
        await ProjectsPage.loadProjects();
        timer.render();
    },

    loadFilters: async () => {
        try {
            const clients = await API.get('/clients');
            const select = document.getElementById('filter-client');
            
            clients.clients.forEach(client => {
                const option = document.createElement('option');
                option.value = client.id;
                option.textContent = client.name;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading clients:', error);
        }
    },

    loadProjects: async () => {
        try {
            const clientId = document.getElementById('filter-client').value;
            const status = document.getElementById('filter-status').value;
            
            let url = '/projects?';
            if (clientId) url += `clientId=${clientId}&`;
            if (status) url += `status=${status}&`;
            
            const response = await API.get(url);
            const container = document.getElementById('projects-list');
            
            if (response.projects.length === 0) {
                container.innerHTML = '<p>No projects found.</p>';
                return;
            }

            container.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-mobile-cards">
                        <thead>
                            <tr>
                                <th>Project Name</th>
                                <th>Client</th>
                                <th>Status</th>
                                <th>Hours Used</th>
                                <th>Budget</th>
                                <th>Progress</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.projects.map(project => {
                                const progress = project.budget_hours ? 
                                    Math.min(100, Math.round((project.total_hours / project.budget_hours) * 100)) : 0;
                                
                                return `
                                    <tr>
                                        <td data-label="Project Name"><strong>${project.name}</strong></td>
                                        <td data-label="Client">${project.client_name}</td>
                                        <td data-label="Status">
                                            <span class="badge badge-${ProjectsPage.getStatusClass(project.status)}">
                                                ${project.status}
                                            </span>
                                        </td>
                                        <td data-label="Hours Used">${project.total_hours || 0}</td>
                                        <td data-label="Budget">${project.budget_hours ? project.budget_hours + ' hrs' : '-'}</td>
                                        <td data-label="Progress">
                                            ${project.budget_hours ? `
                                                <div class="progress-bar-container" style="width: 100px;">
                                                    <div style="height: 10px; background: #e0e0e0; border-radius: 5px; overflow: hidden;">
                                                        <div style="width: ${progress}%; height: 100%; background: ${progress > 90 ? '#ef4444' : progress > 75 ? '#f59e0b' : '#10b981'};"></div>
                                                    </div>
                                                    <small>${progress}%</small>
                                                </div>
                                            ` : '-'}
                                        </td>
                                        <td data-label="Actions">
                                            <div class="btn-group">
                                                <button onclick="ProjectsPage.viewProject('${project.id}')" class="btn btn-sm btn-outline">View</button>
                                                <button onclick="ProjectsPage.showEditModal('${project.id}')" class="btn btn-sm btn-outline">Edit</button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            console.error('Error loading projects:', error);
            document.getElementById('projects-list').innerHTML = '<p>Error loading projects.</p>';
        }
    },

    showAddModal: async () => {
        document.getElementById('modal-container').innerHTML = `
            <div class="modal" style="display: block;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">Add Project</h2>
                        <button onclick="ProjectsPage.closeModal()" class="modal-close">&times;</button>
                    </div>
                    <form onsubmit="ProjectsPage.handleAdd(event)">
                        <div class="form-group">
                            <label for="project-client">Client *</label>
                            <select id="project-client" class="form-control" required>
                                <option value="">Select client...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="project-name">Project Name *</label>
                            <input type="text" id="project-name" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="project-code">Project Code</label>
                            <input type="text" id="project-code" class="form-control">
                        </div>
                        <div class="form-group">
                            <label for="project-description">Description</label>
                            <textarea id="project-description" class="form-control" rows="3"></textarea>
                        </div>
                        <div class="grid grid-2">
                            <div class="form-group">
                                <label for="project-budget-hours">Budget Hours</label>
                                <input type="number" id="project-budget-hours" class="form-control" step="0.5" min="0">
                            </div>
                            <div class="form-group">
                                <label for="project-budget-amount">Budget Amount ($)</label>
                                <input type="number" id="project-budget-amount" class="form-control" step="0.01" min="0">
                            </div>
                        </div>
                        <div class="grid grid-2">
                            <div class="form-group">
                                <label for="project-start-date">Start Date</label>
                                <input type="date" id="project-start-date" class="form-control">
                            </div>
                            <div class="form-group">
                                <label for="project-end-date">End Date</label>
                                <input type="date" id="project-end-date" class="form-control">
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary">Add Project</button>
                    </form>
                </div>
            </div>
        `;
        
        // Load clients
        try {
            const clients = await API.get('/clients');
            console.log('Loaded clients:', clients);
            const select = document.getElementById('project-client');
            
            if (!clients.clients || clients.clients.length === 0) {
                console.error('No clients found');
                select.innerHTML = '<option value="">No clients available - Please create a client first</option>';
                return;
            }
            
            const activeClients = clients.clients.filter(c => c.is_active !== false);
            console.log('Active clients:', activeClients);
            
            activeClients.forEach(client => {
                const option = document.createElement('option');
                option.value = client.id;
                option.textContent = client.name;
                select.appendChild(option);
                console.log(`Added client option: ${client.name} (ID: ${client.id})`);
            });
        } catch (error) {
            console.error('Error loading clients:', error);
            alert('Failed to load clients. Please make sure you have created at least one client.');
        }
    },

    handleAdd: async (e) => {
        e.preventDefault();
        
        try {
            const clientSelect = document.getElementById('project-client');
            const clientId = clientSelect.value;
            const name = document.getElementById('project-name').value;
            
            console.log('Client select element:', clientSelect);
            console.log('Client select value:', clientId);
            console.log('Client select value type:', typeof clientId);
            console.log('Client select options:', clientSelect.options.length);
            
            // Log all options to see what IDs look like
            for (let i = 0; i < clientSelect.options.length; i++) {
                console.log(`Option ${i}: value="${clientSelect.options[i].value}", text="${clientSelect.options[i].text}"`);
            }
            
            if (!clientId || clientId === '') {
                alert('Please select a client');
                return;
            }
            
            if (!name) {
                alert('Please enter a project name');
                return;
            }
            
            // Parse the client ID - it might be a string UUID or integer
            let parsedClientId;
            if (/^\d+$/.test(clientId)) {
                // It's a numeric ID
                parsedClientId = parseInt(clientId);
            } else {
                // It's likely a UUID, keep as string
                parsedClientId = clientId;
            }
            
            console.log('Client ID raw:', clientId);
            console.log('Client ID parsed:', parsedClientId);
            
            const projectData = {
                clientId: parsedClientId,
                name: name.trim(),
                code: document.getElementById('project-code').value || null,
                description: document.getElementById('project-description').value || null,
                budgetHours: document.getElementById('project-budget-hours').value ? parseFloat(document.getElementById('project-budget-hours').value) : null,
                budgetAmount: document.getElementById('project-budget-amount').value ? parseFloat(document.getElementById('project-budget-amount').value) : null,
                startDate: document.getElementById('project-start-date').value || null,
                endDate: document.getElementById('project-end-date').value || null,
                status: 'active'
            };
            
            console.log('Sending project data:', projectData);
            
            const response = await API.post('/projects', projectData);
            console.log('Project created:', response);
            
            ProjectsPage.closeModal();
            await ProjectsPage.loadProjects();
            alert('Project created successfully!');
        } catch (error) {
            console.error('Error adding project:', error);
            alert('Error adding project: ' + (error.message || 'Unknown error'));
        }
    },

    viewProject: async (id) => {
        try {
            const response = await API.get(`/projects/${id}`);
            const project = response.project;
            const stats = response.stats;
            const consultants = response.consultants;

            document.getElementById('modal-container').innerHTML = `
                <div class="modal" style="display: block;">
                    <div class="modal-content" style="max-width: 900px;">
                        <div class="modal-header">
                            <h2 class="modal-title">${project.name}</h2>
                            <button onclick="ProjectsPage.closeModal()" class="modal-close">&times;</button>
                        </div>
                        
                        <div class="grid grid-3" style="margin-bottom: 2rem;">
                            <div class="stat-card">
                                <div class="stat-value">${stats.total_hours || 0}</div>
                                <div class="stat-label">Total Hours</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${stats.billable_hours || 0}</div>
                                <div class="stat-label">Billable Hours</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${stats.consultant_count || 0}</div>
                                <div class="stat-label">Team Members</div>
                            </div>
                        </div>
                        
                        <div class="grid grid-2">
                            <div>
                                <p><strong>Client:</strong> ${project.client_name}</p>
                                <p><strong>Status:</strong> <span class="badge badge-${ProjectsPage.getStatusClass(project.status)}">${project.status}</span></p>
                                <p><strong>Budget:</strong> ${project.budget_hours ? project.budget_hours + ' hours' : 'No budget set'}</p>
                                ${project.budget_amount ? `<p><strong>Budget Amount:</strong> $${project.budget_amount}</p>` : ''}
                            </div>
                            <div>
                                <p><strong>Start Date:</strong> ${project.start_date ? new Date(project.start_date).toLocaleDateString() : '-'}</p>
                                <p><strong>End Date:</strong> ${project.end_date ? new Date(project.end_date).toLocaleDateString() : '-'}</p>
                                <p><strong>Created By:</strong> ${project.created_by_name || '-'}</p>
                            </div>
                        </div>
                        
                        ${project.description ? `<p><strong>Description:</strong><br>${project.description}</p>` : ''}
                        
                        <h3 style="margin-top: 2rem;">Team Members</h3>
                        ${consultants.length > 0 ? `
                            <div class="table-responsive">
                                <table class="table table-mobile-cards">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Hours Logged</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${consultants.map(consultant => `
                                            <tr>
                                                <td data-label="Name">${consultant.first_name} ${consultant.last_name}</td>
                                                <td data-label="Email">${consultant.email}</td>
                                                <td data-label="Hours Logged">${consultant.hours_logged}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : '<p>No team members have logged time yet.</p>'}
                    </div>
                </div>
            `;
        } catch (error) {
            alert('Error loading project details: ' + error.message);
        }
    },

    showEditModal: async (id) => {
        try {
            const response = await API.get(`/projects/${id}`);
            const project = response.project;

            document.getElementById('modal-container').innerHTML = `
                <div class="modal" style="display: block;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2 class="modal-title">Edit Project</h2>
                            <button onclick="ProjectsPage.closeModal()" class="modal-close">&times;</button>
                        </div>
                        <form onsubmit="ProjectsPage.handleEdit(event, '${id}')">
                            <div class="form-group">
                                <label class="form-label">Client</label>
                                <input type="text" class="form-control" value="${project.client_name}" disabled>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Project Name *</label>
                                <input type="text" id="project-name" class="form-control" value="${project.name}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Project Code</label>
                                <input type="text" id="project-code" class="form-control" value="${project.code || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Description</label>
                                <textarea id="project-description" class="form-control" rows="3">${project.description || ''}</textarea>
                            </div>
                            <div class="grid grid-2">
                                <div class="form-group">
                                    <label class="form-label">Budget Hours</label>
                                    <input type="number" id="project-budget-hours" class="form-control" step="0.5" min="0" value="${project.budget_hours || ''}">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Budget Amount ($)</label>
                                    <input type="number" id="project-budget-amount" class="form-control" step="0.01" min="0" value="${project.budget_amount || ''}">
                                </div>
                            </div>
                            <div class="grid grid-2">
                                <div class="form-group">
                                    <label class="form-label">Start Date</label>
                                    <input type="date" id="project-start-date" class="form-control" value="${project.start_date ? project.start_date.split('T')[0] : ''}">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">End Date</label>
                                    <input type="date" id="project-end-date" class="form-control" value="${project.end_date ? project.end_date.split('T')[0] : ''}">
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Status</label>
                                <select id="project-status" class="form-control form-select">
                                    <option value="active" ${project.status === 'active' ? 'selected' : ''}>Active</option>
                                    <option value="completed" ${project.status === 'completed' ? 'selected' : ''}>Completed</option>
                                    <option value="on_hold" ${project.status === 'on_hold' ? 'selected' : ''}>On Hold</option>
                                    <option value="cancelled" ${project.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                                </select>
                            </div>
                            <button type="submit" class="btn btn-primary">Update Project</button>
                        </form>
                    </div>
                </div>
            `;
        } catch (error) {
            alert('Error loading project: ' + error.message);
        }
    },

    handleEdit: async (e, id) => {
        e.preventDefault();
        
        try {
            await API.put(`/projects/${id}`, {
                name: document.getElementById('project-name').value,
                code: document.getElementById('project-code').value || null,
                description: document.getElementById('project-description').value || null,
                budgetHours: parseFloat(document.getElementById('project-budget-hours').value) || null,
                budgetAmount: parseFloat(document.getElementById('project-budget-amount').value) || null,
                startDate: document.getElementById('project-start-date').value || null,
                endDate: document.getElementById('project-end-date').value || null,
                status: document.getElementById('project-status').value
            });
            
            ProjectsPage.closeModal();
            await ProjectsPage.loadProjects();
        } catch (error) {
            alert('Error updating project: ' + error.message);
        }
    },

    getStatusClass: (status) => {
        const statusClasses = {
            'active': 'success',
            'completed': 'info',
            'on_hold': 'warning',
            'cancelled': 'danger'
        };
        return statusClasses[status] || 'info';
    },

    closeModal: () => {
        document.getElementById('modal-container').innerHTML = '';
    }
};

// Make ProjectsPage available globally for onclick handlers
window.ProjectsPage = ProjectsPage;
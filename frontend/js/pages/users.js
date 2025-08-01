const UsersPage = {
    render: async () => {
        if (!Auth.isAdmin()) {
            router.navigate('/dashboard');
            return;
        }

        document.getElementById('app').innerHTML = `
            ${Navbar.render()}
            <div class="container" style="margin-top: 2rem;">
                <div class="card-header">
                    <h1>Users</h1>
                    <button onclick="UsersPage.showAddModal()" class="btn btn-primary">Add User</button>
                </div>
                
                <div class="card" style="margin-top: 1rem;">
                    <div id="users-list">Loading...</div>
                </div>
            </div>
            <div id="timer-container"></div>
            <div id="modal-container"></div>
        `;

        Navbar.updateActiveLink();
        await UsersPage.loadUsers();
        timer.render();
    },

    loadUsers: async () => {
        try {
            const response = await API.get('/users');
            const container = document.getElementById('users-list');
            
            if (response.users.length === 0) {
                container.innerHTML = '<p>No users found.</p>';
                return;
            }

            container.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-mobile-cards">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>User Type</th>
                                <th>Hourly Rate</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.users.map(user => `
                                <tr>
                                    <td data-label="Name">${user.first_name} ${user.last_name}</td>
                                    <td data-label="Email">${user.email}</td>
                                    <td data-label="User Type">${user.user_type_name || 'Standard'}</td>
                                    <td data-label="Hourly Rate">${user.hourly_rate ? '$' + user.hourly_rate : '-'}</td>
                                    <td data-label="Status">
                                        <span class="badge badge-${user.is_active ? 'success' : 'danger'}">
                                            ${user.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td data-label="Created">${new Date(user.created_at).toLocaleDateString()}</td>
                                    <td data-label="Actions">
                                        <div class="btn-group">
                                            <button onclick="UsersPage.showEditModal('${user.id}')" class="btn btn-sm btn-outline">Edit</button>
                                            <button onclick="UsersPage.showTimeEntryModal('${user.id}', '${user.first_name} ${user.last_name}')" class="btn btn-sm btn-primary">Log Time</button>
                                            <button onclick="UsersPage.viewUserDetails('${user.id}')" class="btn btn-sm btn-outline">View</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            console.error('Error loading users:', error);
            document.getElementById('users-list').innerHTML = '<p>Error loading users.</p>';
        }
    },

    showAddModal: () => {
        document.getElementById('modal-container').innerHTML = `
            <div class="modal show">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">Add User</h2>
                        <button onclick="UsersPage.closeModal()" class="modal-close">&times;</button>
                    </div>
                    <form onsubmit="UsersPage.handleAdd(event)">
                        <div class="form-group">
                            <label class="form-label">First Name *</label>
                            <input type="text" id="user-firstName" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Last Name *</label>
                            <input type="text" id="user-lastName" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Email *</label>
                            <input type="email" id="user-email" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Password *</label>
                            <input type="password" id="user-password" class="form-control" required minlength="6">
                        </div>
                        <div class="form-group">
                            <label class="form-label">User Type</label>
                            <select id="user-type" class="form-control form-select">
                                <option value="2">Standard User</option>
                                <option value="1">Admin</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Hourly Rate</label>
                            <input type="number" id="user-hourlyRate" class="form-control" step="0.01" min="0">
                        </div>
                        <button type="submit" class="btn btn-primary">Add User</button>
                    </form>
                </div>
            </div>
        `;
    },

    showTimeEntryModal: async (userId, userName) => {
        document.getElementById('modal-container').innerHTML = `
            <div class="modal show">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">Log Time for ${userName}</h2>
                        <button onclick="UsersPage.closeModal()" class="modal-close">&times;</button>
                    </div>
                    <form onsubmit="UsersPage.handleTimeEntry(event, '${userId}')">
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
            await API.post('/users', {
                email: document.getElementById('user-email').value,
                password: document.getElementById('user-password').value,
                firstName: document.getElementById('user-firstName').value,
                lastName: document.getElementById('user-lastName').value,
                userTypeId: parseInt(document.getElementById('user-type').value),
                hourlyRate: parseFloat(document.getElementById('user-hourlyRate').value) || null
            });
            
            UsersPage.closeModal();
            await UsersPage.loadUsers();
        } catch (error) {
            alert('Error adding user: ' + error.message);
        }
    },

    handleTimeEntry: async (e, userId) => {
        e.preventDefault();
        
        try {
            await API.post('/time-entries', {
                userId: userId,
                projectId: document.getElementById('entry-project').value,
                date: document.getElementById('entry-date').value,
                hours: parseFloat(document.getElementById('entry-hours').value),
                description: document.getElementById('entry-description').value,
                isBillable: document.getElementById('entry-billable').checked
            });
            
            UsersPage.closeModal();
            alert('Time entry added successfully');
        } catch (error) {
            alert('Error adding time entry: ' + error.message);
        }
    },

    showEditModal: async (id) => {
        try {
            const response = await API.get(`/users/${id}`);
            const user = response.user;
            
            document.getElementById('modal-container').innerHTML = `
                <div class="modal show">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2 class="modal-title">Edit User</h2>
                            <button onclick="UsersPage.closeModal()" class="modal-close">&times;</button>
                        </div>
                        <form onsubmit="UsersPage.handleEdit(event, '${id}')">
                            <div class="form-group">
                                <label class="form-label">First Name *</label>
                                <input type="text" id="edit-firstName" class="form-control" value="${user.first_name}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Last Name *</label>
                                <input type="text" id="edit-lastName" class="form-control" value="${user.last_name}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Email *</label>
                                <input type="email" id="edit-email" class="form-control" value="${user.email}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Hourly Rate</label>
                                <input type="number" id="edit-hourlyRate" class="form-control" value="${user.hourly_rate || ''}" step="0.01" min="0">
                            </div>
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="edit-isActive" ${user.is_active ? 'checked' : ''}> Active
                                </label>
                            </div>
                            <button type="submit" class="btn btn-primary">Update User</button>
                        </form>
                    </div>
                </div>
            `;
        } catch (error) {
            alert('Error loading user details: ' + error.message);
        }
    },

    handleEdit: async (e, id) => {
        e.preventDefault();
        
        try {
            await API.put(`/users/${id}`, {
                first_name: document.getElementById('edit-firstName').value,
                last_name: document.getElementById('edit-lastName').value,
                email: document.getElementById('edit-email').value,
                hourly_rate: parseFloat(document.getElementById('edit-hourlyRate').value) || null,
                is_active: document.getElementById('edit-isActive').checked
            });
            
            UsersPage.closeModal();
            await UsersPage.loadUsers();
        } catch (error) {
            alert('Error updating user: ' + error.message);
        }
    },

    viewUserDetails: async (id) => {
        try {
            const response = await API.get(`/users/${id}`);
            const { user, stats } = response;
            
            document.getElementById('modal-container').innerHTML = `
                <div class="modal show">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2 class="modal-title">${user.first_name} ${user.last_name}</h2>
                            <button onclick="UsersPage.closeModal()" class="modal-close">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="info-group">
                                <strong>Email:</strong> ${user.email}
                            </div>
                            <div class="info-group">
                                <strong>User Type:</strong> ${user.user_type_name}
                            </div>
                            <div class="info-group">
                                <strong>Hourly Rate:</strong> ${user.hourly_rate ? '$' + user.hourly_rate : 'Not set'}
                            </div>
                            <div class="info-group">
                                <strong>Status:</strong> ${user.is_active ? 'Active' : 'Inactive'}
                            </div>
                            <div class="info-group">
                                <strong>Member Since:</strong> ${new Date(user.created_at).toLocaleDateString()}
                            </div>
                            <hr>
                            <h3>Time Entry Statistics</h3>
                            <div class="info-group">
                                <strong>Total Entries:</strong> ${stats.total_entries}
                            </div>
                            <div class="info-group">
                                <strong>Total Hours:</strong> ${parseFloat(stats.total_hours || 0).toFixed(2)}
                            </div>
                            <div class="info-group">
                                <strong>Billable Hours:</strong> ${parseFloat(stats.billable_hours || 0).toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            alert('Error loading user details: ' + error.message);
        }
    },

    closeModal: () => {
        document.getElementById('modal-container').innerHTML = '';
    }
};

window.UsersPage = UsersPage;
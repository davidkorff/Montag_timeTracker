const ClientsPage = {
    render: async () => {
        if (!Auth.isAdmin()) {
            router.navigate('/dashboard');
            return;
        }

        document.getElementById('app').innerHTML = `
            ${Navbar.render()}
            <div class="container" style="margin-top: 2rem;">
                <div class="card-header">
                    <h1>Clients</h1>
                    <button onclick="ClientsPage.showAddModal()" class="btn btn-primary">Add Client</button>
                </div>
                
                <div class="card" style="margin-top: 1rem;">
                    <div id="clients-list">Loading...</div>
                </div>
            </div>
            <div id="timer-container"></div>
            <div id="modal-container"></div>
        `;

        Navbar.updateActiveLink();
        await ClientsPage.loadClients();
        timer.render();
    },

    loadClients: async () => {
        try {
            const response = await API.get('/clients');
            const container = document.getElementById('clients-list');
            
            if (response.clients.length === 0) {
                container.innerHTML = '<p>No clients found.</p>';
                return;
            }

            container.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-mobile-cards">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Code</th>
                                <th>Contact Email</th>
                                <th>Billing Rate</th>
                                <th>Projects</th>
                                <th>Total Hours</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.clients.map(client => `
                                <tr>
                                    <td data-label="Name"><strong>${client.name}</strong></td>
                                    <td data-label="Code">${client.code || '-'}</td>
                                    <td data-label="Contact Email">${client.contact_email || '-'}</td>
                                    <td data-label="Billing Rate">${client.billing_rate ? '$' + client.billing_rate : '-'}</td>
                                    <td data-label="Projects">${client.project_count || 0}</td>
                                    <td data-label="Total Hours">${client.total_hours ? parseFloat(client.total_hours).toFixed(1) : '0'}</td>
                                    <td data-label="Status">
                                        <span class="badge badge-${client.is_active ? 'success' : 'danger'}">
                                            ${client.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td data-label="Actions">
                                        <div class="btn-group">
                                            <button onclick="ClientsPage.viewClient('${client.id}')" class="btn btn-sm btn-outline">View</button>
                                            <button onclick="ClientsPage.showEditModal('${client.id}')" class="btn btn-sm btn-outline">Edit</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            console.error('Error loading clients:', error);
            document.getElementById('clients-list').innerHTML = '<p>Error loading clients.</p>';
        }
    },

    showAddModal: () => {
        document.getElementById('modal-container').innerHTML = `
            <div class="modal" style="display: block;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">Add Client</h2>
                        <button onclick="ClientsPage.closeModal()" class="modal-close">&times;</button>
                    </div>
                    <form onsubmit="ClientsPage.handleAdd(event)">
                        <div class="form-group">
                            <label for="client-name" class="form-label">Client Name *</label>
                            <input type="text" id="client-name" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="client-code" class="form-label">Client Code</label>
                            <input type="text" id="client-code" class="form-control">
                        </div>
                        <div class="form-group">
                            <label for="client-email" class="form-label">Contact Email</label>
                            <input type="email" id="client-email" class="form-control">
                        </div>
                        <div class="form-group">
                            <label for="client-phone" class="form-label">Contact Phone</label>
                            <input type="tel" id="client-phone" class="form-control">
                        </div>
                        <div class="form-group">
                            <label for="client-address" class="form-label">Address</label>
                            <textarea id="client-address" class="form-control" rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label for="client-billing-rate" class="form-label">Billing Rate ($/hour)</label>
                            <input type="number" id="client-billing-rate" class="form-control" step="0.01" min="0" value="175">
                        </div>
                        
                        <h3 style="margin-top: 1.5rem;">Invoice Configuration</h3>
                        <div class="form-group">
                            <label for="invoice-email" class="form-label">Invoice Email</label>
                            <input type="email" id="invoice-email" class="form-control">
                        </div>
                        <div class="form-group">
                            <label for="invoice-cc-email" class="form-label">Invoice CC Email</label>
                            <input type="email" id="invoice-cc-email" class="form-control">
                        </div>
                        <div class="form-group">
                            <label for="invoice-recipient-name" class="form-label">Invoice Recipient Name</label>
                            <input type="text" id="invoice-recipient-name" class="form-control">
                        </div>
                        <div class="form-group">
                            <label for="billed-to" class="form-label">Billed To</label>
                            <input type="text" id="billed-to" class="form-control">
                        </div>
                        <div class="form-group">
                            <label for="company-name" class="form-label">Company Name</label>
                            <input type="text" id="company-name" class="form-control">
                        </div>
                        <div class="form-group">
                            <label for="company-address" class="form-label">Company Address</label>
                            <textarea id="company-address" class="form-control" rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label for="payment-terms" class="form-label">Payment Terms</label>
                            <select id="payment-terms" class="form-control form-select">
                                <option value="Net 15">Net 15</option>
                                <option value="Net 30" selected>Net 30</option>
                                <option value="Net 45">Net 45</option>
                                <option value="Net 60">Net 60</option>
                                <option value="Due on Receipt">Due on Receipt</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="invoice-notes" class="form-label">Invoice Notes (e.g., PO Number)</label>
                            <textarea id="invoice-notes" class="form-control" rows="2"></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary">Add Client</button>
                    </form>
                </div>
            </div>
        `;
    },

    handleAdd: async (e) => {
        e.preventDefault();
        
        try {
            const clientData = {
                name: document.getElementById('client-name').value,
                code: document.getElementById('client-code').value || undefined,
                contactEmail: document.getElementById('client-email').value || undefined,
                contactPhone: document.getElementById('client-phone').value || undefined,
                address: document.getElementById('client-address').value || undefined,
                billingRate: document.getElementById('client-billing-rate').value ? parseFloat(document.getElementById('client-billing-rate').value) : undefined,
                invoiceEmail: document.getElementById('invoice-email').value || undefined,
                invoiceCcEmail: document.getElementById('invoice-cc-email').value || undefined,
                invoiceRecipientName: document.getElementById('invoice-recipient-name').value || undefined,
                billedTo: document.getElementById('billed-to').value || undefined,
                companyName: document.getElementById('company-name').value || undefined,
                companyAddress: document.getElementById('company-address').value || undefined,
                paymentTerms: document.getElementById('payment-terms').value || undefined,
                invoiceNotes: document.getElementById('invoice-notes').value || undefined
            };
            
            // Remove undefined or empty properties
            Object.keys(clientData).forEach(key => {
                if (clientData[key] === undefined || clientData[key] === '') {
                    delete clientData[key];
                }
            });
            
            console.log('Sending client data:', clientData);
            
            await API.post('/clients', clientData);
            
            ClientsPage.closeModal();
            await ClientsPage.loadClients();
        } catch (error) {
            alert('Error adding client: ' + error.message);
        }
    },

    viewClient: async (id) => {
        try {
            const response = await API.get(`/clients/${id}`);
            const client = response.client;
            const projects = response.projects;

            document.getElementById('modal-container').innerHTML = `
                <div class="modal" style="display: block;">
                    <div class="modal-content" style="max-width: 800px;">
                        <div class="modal-header">
                            <h2 class="modal-title">${client.name}</h2>
                            <button onclick="ClientsPage.closeModal()" class="modal-close">&times;</button>
                        </div>
                        <div class="grid grid-2">
                            <div>
                                <p><strong>Code:</strong> ${client.code || '-'}</p>
                                <p><strong>Contact Email:</strong> ${client.contact_email || '-'}</p>
                                <p><strong>Contact Phone:</strong> ${client.contact_phone || '-'}</p>
                            </div>
                            <div>
                                <p><strong>Billing Rate:</strong> ${client.billing_rate ? '$' + client.billing_rate + '/hour' : '-'}</p>
                                <p><strong>Status:</strong> ${client.is_active ? 'Active' : 'Inactive'}</p>
                                <p><strong>Created:</strong> ${new Date(client.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                        ${client.address ? `<p><strong>Address:</strong><br>${client.address}</p>` : ''}
                        
                        <h3 style="margin-top: 2rem;">Projects</h3>
                        ${projects.length > 0 ? `
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Project Name</th>
                                        <th>Status</th>
                                        <th>Hours</th>
                                        <th>Budget</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${projects.map(project => `
                                        <tr>
                                            <td>${project.name}</td>
                                            <td><span class="badge badge-${ClientsPage.getProjectStatusClass(project.status)}">${project.status}</span></td>
                                            <td>${project.total_hours || 0}</td>
                                            <td>${project.budget_hours ? project.budget_hours + ' hours' : '-'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        ` : '<p>No projects yet.</p>'}
                    </div>
                </div>
            `;
        } catch (error) {
            alert('Error loading client details: ' + error.message);
        }
    },

    showEditModal: async (id) => {
        try {
            const response = await API.get(`/clients/${id}`);
            const client = response.client;

            document.getElementById('modal-container').innerHTML = `
                <div class="modal" style="display: block;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2 class="modal-title">Edit Client</h2>
                            <button onclick="ClientsPage.closeModal()" class="modal-close">&times;</button>
                        </div>
                        <form onsubmit="ClientsPage.handleEdit(event, '${id}')">
                            <div class="form-group">
                                <label for="client-name" class="form-label">Client Name *</label>
                                <input type="text" id="client-name" class="form-control" value="${client.name}" required>
                            </div>
                            <div class="form-group">
                                <label for="client-code" class="form-label">Client Code</label>
                                <input type="text" id="client-code" class="form-control" value="${client.code || ''}">
                            </div>
                            <div class="form-group">
                                <label for="client-email" class="form-label">Contact Email</label>
                                <input type="email" id="client-email" class="form-control" value="${client.contact_email || ''}">
                            </div>
                            <div class="form-group">
                                <label for="client-phone" class="form-label">Contact Phone</label>
                                <input type="tel" id="client-phone" class="form-control" value="${client.contact_phone || ''}">
                            </div>
                            <div class="form-group">
                                <label for="client-address" class="form-label">Address</label>
                                <textarea id="client-address" class="form-control" rows="3">${client.address || ''}</textarea>
                            </div>
                            <div class="form-group">
                                <label for="client-billing-rate" class="form-label">Billing Rate ($/hour)</label>
                                <input type="number" id="client-billing-rate" class="form-control" step="0.01" min="0" value="${client.billing_rate || client.default_rate || ''}">
                            </div>
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="client-active" ${client.is_active ? 'checked' : ''}> Active
                                </label>
                            </div>
                            
                            <h3 style="margin-top: 1.5rem;">Invoice Configuration</h3>
                            <div class="form-group">
                                <label for="invoice-email" class="form-label">Invoice Email</label>
                                <input type="email" id="invoice-email" class="form-control" value="${client.invoice_email || ''}">
                            </div>
                            <div class="form-group">
                                <label for="invoice-cc-email" class="form-label">Invoice CC Email</label>
                                <input type="email" id="invoice-cc-email" class="form-control" value="${client.invoice_cc_email || ''}">
                            </div>
                            <div class="form-group">
                                <label for="invoice-recipient-name" class="form-label">Invoice Recipient Name</label>
                                <input type="text" id="invoice-recipient-name" class="form-control" value="${client.invoice_recipient_name || ''}">
                            </div>
                            <div class="form-group">
                                <label for="billed-to" class="form-label">Billed To</label>
                                <input type="text" id="billed-to" class="form-control" value="${client.billed_to || ''}">
                            </div>
                            <div class="form-group">
                                <label for="company-name" class="form-label">Company Name</label>
                                <input type="text" id="company-name" class="form-control" value="${client.company_name || ''}">
                            </div>
                            <div class="form-group">
                                <label for="company-address" class="form-label">Company Address</label>
                                <textarea id="company-address" class="form-control" rows="3">${client.company_address || ''}</textarea>
                            </div>
                            <div class="form-group">
                                <label for="payment-terms" class="form-label">Payment Terms</label>
                                <select id="payment-terms" class="form-control form-select">
                                    <option value="Net 15" ${client.payment_terms === 'Net 15' ? 'selected' : ''}>Net 15</option>
                                    <option value="Net 30" ${client.payment_terms === 'Net 30' || !client.payment_terms ? 'selected' : ''}>Net 30</option>
                                    <option value="Net 45" ${client.payment_terms === 'Net 45' ? 'selected' : ''}>Net 45</option>
                                    <option value="Net 60" ${client.payment_terms === 'Net 60' ? 'selected' : ''}>Net 60</option>
                                    <option value="Due on Receipt" ${client.payment_terms === 'Due on Receipt' ? 'selected' : ''}>Due on Receipt</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="invoice-notes" class="form-label">Invoice Notes (e.g., PO Number)</label>
                                <textarea id="invoice-notes" class="form-control" rows="2">${client.invoice_notes || ''}</textarea>
                            </div>
                            <button type="submit" class="btn btn-primary">Update Client</button>
                        </form>
                    </div>
                </div>
            `;
        } catch (error) {
            alert('Error loading client: ' + error.message);
        }
    },

    handleEdit: async (e, id) => {
        e.preventDefault();
        
        try {
            const clientData = {
                name: document.getElementById('client-name').value,
                code: document.getElementById('client-code').value || undefined,
                contactEmail: document.getElementById('client-email').value || undefined,
                contactPhone: document.getElementById('client-phone').value || undefined,
                address: document.getElementById('client-address').value || undefined,
                billingRate: document.getElementById('client-billing-rate').value ? parseFloat(document.getElementById('client-billing-rate').value) : undefined,
                isActive: document.getElementById('client-active').checked,
                invoiceEmail: document.getElementById('invoice-email').value || undefined,
                invoiceCcEmail: document.getElementById('invoice-cc-email').value || undefined,
                invoiceRecipientName: document.getElementById('invoice-recipient-name').value || undefined,
                billedTo: document.getElementById('billed-to').value || undefined,
                companyName: document.getElementById('company-name').value || undefined,
                companyAddress: document.getElementById('company-address').value || undefined,
                paymentTerms: document.getElementById('payment-terms').value || undefined,
                invoiceNotes: document.getElementById('invoice-notes').value || undefined
            };
            
            // Remove undefined properties
            Object.keys(clientData).forEach(key => {
                if (clientData[key] === undefined) {
                    delete clientData[key];
                }
            });
            
            console.log('Updating client data:', clientData);
            
            await API.put(`/clients/${id}`, clientData);
            
            ClientsPage.closeModal();
            await ClientsPage.loadClients();
        } catch (error) {
            alert('Error updating client: ' + error.message);
        }
    },

    getProjectStatusClass: (status) => {
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

// Make ClientsPage available globally for onclick handlers
window.ClientsPage = ClientsPage;
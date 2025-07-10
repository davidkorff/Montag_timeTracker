const InvoicesPage = {
    render: async () => {
        document.getElementById('app').innerHTML = `
            ${Navbar.render()}
            <div class="container" style="margin-top: 2rem;">
                <div class="card-header">
                    <h1>Invoices <small style="font-size: 0.6em; color: #718096;">(All times in ${DateUtils.getTimezoneAbbr()})</small></h1>
                </div>
                
                <!-- Unbilled Time Summary Section -->
                <div class="card" style="margin-top: 1rem;">
                    <h2 style="margin-bottom: 1rem;">Outstanding Billables</h2>
                    <div id="unbilled-summary">Loading...</div>
                </div>
                
                <!-- Existing Invoices Section -->
                <div class="card" style="margin-top: 2rem;">
                    <h2 style="margin-bottom: 1rem;">Existing Invoices</h2>
                    <div style="margin-bottom: 1rem;">
                        <select id="filter-client" class="form-control form-select" style="width: 250px; display: inline-block;" onchange="InvoicesPage.loadInvoices()">
                            <option value="">All Clients</option>
                        </select>
                        <select id="filter-status" class="form-control form-select" style="width: 150px; display: inline-block; margin-left: 1rem;" onchange="InvoicesPage.loadInvoices()">
                            <option value="">All Statuses</option>
                            <option value="draft">Draft</option>
                            <option value="sent">Sent</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        <select id="filter-payment" class="form-control form-select" style="width: 150px; display: inline-block; margin-left: 1rem;" onchange="InvoicesPage.loadInvoices()">
                            <option value="">All Payments</option>
                            <option value="unpaid">Unpaid</option>
                            <option value="partial">Partial</option>
                            <option value="paid">Paid</option>
                        </select>
                    </div>
                    <div id="invoices-list">Loading...</div>
                </div>
            </div>
            <div id="timer-container"></div>
            <div id="modal-container"></div>
        `;

        Navbar.updateActiveLink();
        await Promise.all([
            InvoicesPage.loadUnbilledSummary(),
            InvoicesPage.loadFilters(),
            InvoicesPage.loadInvoices()
        ]);
        timer.render();
    },

    loadUnbilledSummary: async () => {
        try {
            const response = await API.get('/invoices/unbilled-summary');
            const container = document.getElementById('unbilled-summary');
            
            if (response.unbilledClients.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #666;">No outstanding billables. All time entries have been invoiced! 🎉</p>';
                return;
            }
            
            const totalValue = response.unbilledClients.reduce((sum, client) => sum + parseFloat(client.total_amount), 0);
            
            container.innerHTML = `
                <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px;">
                    <strong>Total Outstanding:</strong> $${totalValue.toFixed(2)}
                    <span style="float: right;">Next Invoice #: ${response.nextInvoiceNumber}</span>
                </div>
                <div class="table-responsive">
                    <table class="table table-mobile-cards">
                        <thead>
                            <tr>
                                <th>Client</th>
                                <th>Period</th>
                                <th>Entries</th>
                                <th>Hours</th>
                                <th>Amount</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.unbilledClients.map(client => {
                                const startDate = new Date(client.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                const endDate = new Date(client.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                return `
                                    <tr>
                                        <td data-label="Client"><strong>${client.client_name}</strong></td>
                                        <td data-label="Period">${startDate} - ${endDate}</td>
                                        <td data-label="Entries">${client.entry_count}</td>
                                        <td data-label="Hours">${parseFloat(client.total_hours).toFixed(1)}</td>
                                        <td data-label="Amount"><strong>$${parseFloat(client.total_amount).toFixed(2)}</strong></td>
                                        <td data-label="Action">
                                            <div class="btn-group">
                                                <button class="btn btn-primary btn-sm create-invoice-btn" data-client-id="${client.client_id}">
                                                    Create Invoice
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            
            // Add event listeners to all create invoice buttons
            document.querySelectorAll('.create-invoice-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const clientId = e.target.dataset.clientId;
                    console.log('Button clicked for client:', clientId);
                    
                    // Test if API is working
                    try {
                        console.log('Testing API...');
                        const testResponse = await fetch(`${CONFIG.API_URL}/clients/${clientId}`, {
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`
                            }
                        });
                        console.log('Test API response status:', testResponse.status);
                        const testData = await testResponse.json();
                        console.log('Test API data:', testData);
                    } catch (testError) {
                        console.error('Test API error:', testError);
                    }
                    
                    InvoicesPage.createInvoiceForClient(clientId);
                });
            });
        } catch (error) {
            console.error('Error loading unbilled summary:', error);
            document.getElementById('unbilled-summary').innerHTML = '<p>Error loading unbilled summary.</p>';
        }
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

    loadInvoices: async () => {
        try {
            const clientId = document.getElementById('filter-client').value;
            const status = document.getElementById('filter-status').value;
            const paymentStatus = document.getElementById('filter-payment').value;
            
            let url = '/invoices?';
            if (clientId) url += `clientId=${clientId}&`;
            if (status) url += `status=${status}&`;
            if (paymentStatus) url += `paymentStatus=${paymentStatus}&`;
            
            const response = await API.get(url);
            const container = document.getElementById('invoices-list');
            
            if (response.invoices.length === 0) {
                container.innerHTML = '<p>No invoices found.</p>';
                return;
            }

            container.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-mobile-cards">
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Client</th>
                                <th>Date</th>
                                <th>Due Date</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Payment</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.invoices.map(invoice => {
                                const dueDate = new Date(invoice.due_date);
                                const isOverdue = dueDate < new Date() && invoice.payment_status === 'unpaid';
                                
                                return `
                                    <tr>
                                        <td data-label="Invoice #"><strong>${invoice.invoice_number}</strong></td>
                                        <td data-label="Client">${invoice.client_name}</td>
                                        <td data-label="Date">${DateUtils.formatDate(invoice.invoice_date)}</td>
                                        <td data-label="Due Date" class="${isOverdue ? 'text-danger' : ''}">${DateUtils.formatDate(invoice.due_date)}</td>
                                        <td data-label="Amount">$${parseFloat(invoice.total_amount).toFixed(2)}</td>
                                        <td data-label="Status">
                                            <span class="badge badge-${InvoicesPage.getStatusClass(invoice.status)}">
                                                ${invoice.status}
                                            </span>
                                        </td>
                                        <td data-label="Payment">
                                            <span class="badge badge-${InvoicesPage.getPaymentStatusClass(invoice.payment_status)}">
                                                ${invoice.payment_status}
                                            </span>
                                        </td>
                                        <td data-label="Actions">
                                            <div class="btn-group">
                                                <button onclick="InvoicesPage.viewInvoice('${invoice.id}')" class="btn btn-sm btn-outline">View</button>
                                                ${invoice.status === 'draft' ? `
                                                    <button onclick="InvoicesPage.showEditModal('${invoice.id}')" class="btn btn-sm btn-outline">Edit</button>
                                                    <button onclick="InvoicesPage.downloadPDF('${invoice.id}')" class="btn btn-sm btn-outline">PDF</button>
                                                ` : ''}
                                                ${Auth.isAdmin() && invoice.status === 'sent' && invoice.payment_status !== 'paid' ? `
                                                    <button onclick="InvoicesPage.markAsPaid('${invoice.id}')" class="btn btn-sm btn-success">Mark Paid</button>
                                                ` : ''}
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
            console.error('Error loading invoices:', error);
            document.getElementById('invoices-list').innerHTML = '<p>Error loading invoices.</p>';
        }
    },

    createInvoiceForClient: async (clientId) => {
        console.log('Creating invoice for client:', clientId);
        try {
            console.log('Fetching client details...');
            let clientResponse;
            try {
                clientResponse = await API.get(`/clients/${clientId}`);
                console.log('Client fetched successfully:', clientResponse);
            } catch (error) {
                console.error('Failed to fetch client:', error);
                alert('Failed to fetch client details: ' + error.message);
                return;
            }
            
            console.log('Fetching unbilled entries...');
            let entriesResponse;
            try {
                entriesResponse = await API.get(`/invoices/unbilled/${clientId}`);
                console.log('Entries fetched successfully:', entriesResponse);
            } catch (error) {
                console.error('Failed to fetch unbilled entries:', error);
                alert('Failed to fetch unbilled entries: ' + error.message);
                return;
            }
            
            const client = clientResponse.client;
            const entries = entriesResponse.timeEntries;
            const summary = entriesResponse.summary;
            
            console.log('Client:', client);
            console.log('Entries:', entries);
            console.log('Summary:', summary);
            
            // Get server time for date calculations
            console.log('Getting server time...');
            let serverTime;
            try {
                serverTime = await API.get('/server-time');
                console.log('Server time:', serverTime);
            } catch (error) {
                console.error('Failed to get server time:', error);
                alert('Failed to get server time: ' + error.message);
                return;
            }
            
            const currentDate = new Date(serverTime.currentDate);
            console.log('Current date:', currentDate);
            
            // Calculate due date based on payment terms
            let daysToAdd = 30;
            if (client.payment_terms) {
                if (client.payment_terms.includes('15')) daysToAdd = 15;
                else if (client.payment_terms.includes('45')) daysToAdd = 45;
                else if (client.payment_terms.includes('60')) daysToAdd = 60;
                else if (client.payment_terms.includes('Receipt')) daysToAdd = 0;
            }
            
            const dueDate = new Date(currentDate);
            dueDate.setDate(dueDate.getDate() + daysToAdd);
            
            console.log('Due date:', dueDate);
            console.log('Creating modal...');
            
            const modalContainer = document.getElementById('modal-container');
            if (!modalContainer) {
                console.error('Modal container not found!');
                alert('Modal container not found in the page');
                return;
            }
            
            modalContainer.innerHTML = `
                <div class="modal" style="display: block;">
                    <div class="modal-content" style="max-width: 700px;">
                        <div class="modal-header">
                            <h2 class="modal-title">Create Invoice for ${client.name}</h2>
                            <button onclick="InvoicesPage.closeModal()" class="modal-close">&times;</button>
                        </div>
                        <form onsubmit="InvoicesPage.handleCreateForClient(event, '${clientId}')">
                            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                                <div class="grid grid-2">
                                    <div>
                                        <strong>Period:</strong> ${new Date(entries[entries.length-1].date).toLocaleDateString()} - ${new Date(entries[0].date).toLocaleDateString()}<br>
                                        <strong>Total Hours:</strong> ${summary.totalHours.toFixed(1)}<br>
                                        <strong>Total Amount:</strong> $${summary.totalAmount.toFixed(2)}
                                    </div>
                                    <div>
                                        <strong>Invoice To:</strong> ${client.invoice_email || client.contact_email || 'Not set'}<br>
                                        <strong>CC:</strong> ${client.invoice_cc_email || 'None'}<br>
                                        <strong>Rate:</strong> $${client.default_rate || client.billing_rate || '175'}/hr
                                    </div>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="invoice-date" class="form-label">Invoice Date</label>
                                <input type="date" id="invoice-date" name="invoice-date" class="form-control" value="${currentDate.toISOString().split('T')[0]}" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="invoice-due-date" class="form-label">Due Date</label>
                                <input type="date" id="invoice-due-date" name="invoice-due-date" class="form-control" value="${dueDate.toISOString().split('T')[0]}" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="invoice-payment-terms" class="form-label">Payment Terms</label>
                                <select id="invoice-payment-terms" name="invoice-payment-terms" class="form-control form-select">
                                    <option value="Net 15" ${client.payment_terms === 'Net 15' ? 'selected' : ''}>Net 15</option>
                                    <option value="Net 30" ${client.payment_terms === 'Net 30' || !client.payment_terms ? 'selected' : ''}>Net 30</option>
                                    <option value="Net 45" ${client.payment_terms === 'Net 45' ? 'selected' : ''}>Net 45</option>
                                    <option value="Net 60" ${client.payment_terms === 'Net 60' ? 'selected' : ''}>Net 60</option>
                                    <option value="Due on Receipt" ${client.payment_terms === 'Due on Receipt' ? 'selected' : ''}>Due on Receipt</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="invoice-tax-rate" class="form-label">Tax Rate (%)</label>
                                <input type="number" id="invoice-tax-rate" name="invoice-tax-rate" class="form-control" step="0.01" min="0" max="100" value="0">
                            </div>
                            
                            <div class="form-group">
                                <label for="invoice-notes" class="form-label">Notes</label>
                                <textarea id="invoice-notes" name="invoice-notes" class="form-control" rows="3">${client.invoice_notes || ''}</textarea>
                            </div>
                            
                            <div style="margin-top: 20px;">
                                <button type="submit" class="btn btn-primary">Create Invoice</button>
                                <button type="button" onclick="InvoicesPage.closeModal()" class="btn btn-secondary">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            
            console.log('Modal created successfully!');
            console.log('Modal HTML length:', modalContainer.innerHTML.length);
        } catch (error) {
            console.error('Error in createInvoiceForClient:', error);
            alert('Error loading client details: ' + error.message);
        }
    },

    handleCreateForClient: async (e, clientId) => {
        e.preventDefault();
        
        try {
            // Get all unbilled entries for this client
            const entriesResponse = await API.get(`/invoices/unbilled/${clientId}`);
            const timeEntryIds = entriesResponse.timeEntries.map(entry => entry.id);
            
            const invoiceData = {
                clientId: clientId,
                timeEntryIds: timeEntryIds,
                invoiceDate: document.getElementById('invoice-date').value,
                dueDate: document.getElementById('invoice-due-date').value,
                taxRate: parseFloat(document.getElementById('invoice-tax-rate').value) || 0,
                paymentTerms: document.getElementById('invoice-payment-terms').value,
                notes: document.getElementById('invoice-notes').value || undefined
            };
            
            const result = await API.post('/invoices', invoiceData);
            
            InvoicesPage.closeModal();
            
            // Refresh both sections
            await Promise.all([
                InvoicesPage.loadUnbilledSummary(),
                InvoicesPage.loadInvoices()
            ]);
            
            // Show invoice summary
            InvoicesPage.showInvoiceSummary(result.invoice);
        } catch (error) {
            alert('Error creating invoice: ' + error.message);
        }
    },

    loadUnbilledEntries: async () => {
        const clientId = document.getElementById('invoice-client').value;
        if (!clientId) {
            document.getElementById('unbilled-entries').style.display = 'none';
            return;
        }

        try {
            const response = await API.get(`/invoices/unbilled/${clientId}`);
            const container = document.getElementById('entries-list');
            const unbilledDiv = document.getElementById('unbilled-entries');
            
            if (response.timeEntries.length === 0) {
                container.innerHTML = '<p>No unbilled time entries found for this client.</p>';
                unbilledDiv.style.display = 'block';
                return;
            }

            container.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-mobile-cards">
                        <thead>
                            <tr>
                                <th><input type="checkbox" id="select-all" aria-label="Select all entries" onchange="InvoicesPage.toggleSelectAll()"></th>
                                <th>Date</th>
                                <th>Project</th>
                                <th>User</th>
                                <th>Hours</th>
                                <th>Rate</th>
                                <th>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.timeEntries.map(entry => `
                                <tr>
                                    <td data-label="Select">
                                        <input type="checkbox" class="entry-checkbox" value="${entry.id}" 
                                               data-hours="${entry.hours}" data-amount="${entry.amount}"
                                               aria-label="Select entry for ${DateUtils.formatDate(entry.date)}"
                                               onchange="InvoicesPage.updateTotals()">
                                    </td>
                                    <td data-label="Date">${DateUtils.formatDate(entry.date)}</td>
                                    <td data-label="Project">${entry.project_name}</td>
                                    <td data-label="User">${entry.user_name}</td>
                                    <td data-label="Hours">${parseFloat(entry.hours).toFixed(2)}</td>
                                    <td data-label="Rate">$${parseFloat(entry.rate).toFixed(2)}</td>
                                    <td data-label="Amount">$${parseFloat(entry.amount).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            document.getElementById('total-hours').textContent = response.summary.totalHours.toFixed(2);
            document.getElementById('total-amount').textContent = response.summary.totalAmount.toFixed(2);
            
            unbilledDiv.style.display = 'block';
            
            // Select all by default
            document.getElementById('select-all').checked = true;
            InvoicesPage.toggleSelectAll();
        } catch (error) {
            console.error('Error loading unbilled entries:', error);
            alert('Error loading unbilled entries');
        }
    },

    toggleSelectAll: () => {
        const selectAll = document.getElementById('select-all').checked;
        document.querySelectorAll('.entry-checkbox').forEach(checkbox => {
            checkbox.checked = selectAll;
        });
        InvoicesPage.updateTotals();
    },

    updateTotals: () => {
        let totalHours = 0;
        let totalAmount = 0;
        
        document.querySelectorAll('.entry-checkbox:checked').forEach(checkbox => {
            totalHours += parseFloat(checkbox.dataset.hours);
            totalAmount += parseFloat(checkbox.dataset.amount);
        });
        
        document.getElementById('total-hours').textContent = totalHours.toFixed(2);
        document.getElementById('total-amount').textContent = totalAmount.toFixed(2);
    },

    handleCreate: async (e) => {
        e.preventDefault();
        
        try {
            const selectedEntries = Array.from(document.querySelectorAll('.entry-checkbox:checked'))
                .map(cb => cb.value);
            
            if (selectedEntries.length === 0) {
                alert('Please select at least one time entry');
                return;
            }
            
            const clientId = document.getElementById('invoice-client').value;
            const clientResponse = await API.get(`/clients/${clientId}`);
            const client = clientResponse.client;
            
            const invoiceData = {
                clientId: clientId,
                timeEntryIds: selectedEntries,
                dueDate: document.getElementById('invoice-due-date').value,
                taxRate: parseFloat(document.getElementById('invoice-tax-rate').value) || 0,
                paymentTerms: document.getElementById('invoice-payment-terms').value || client.payment_terms || undefined,
                notes: document.getElementById('invoice-notes').value || client.invoice_notes || undefined
            };
            
            const result = await API.post('/invoices', invoiceData);
            
            InvoicesPage.closeModal();
            await InvoicesPage.loadInvoices();
            
            // Show invoice summary dialog
            InvoicesPage.showInvoiceSummary(result.invoice);
        } catch (error) {
            alert('Error creating invoice: ' + error.message);
        }
    },

    showInvoiceSummary: (invoice) => {
        const totalHours = parseFloat(invoice.subtotal) / 175; // Assuming $175/hr rate
        
        document.getElementById('modal-container').innerHTML = `
            <div class="modal" style="display: block;">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2 class="modal-title">Invoice Generated Successfully!</h2>
                        <button onclick="InvoicesPage.closeModal()" class="modal-close">&times;</button>
                    </div>
                    <div style="padding: 20px; font-family: Arial;">
                        <h3>Invoice Summary</h3>
                        <p><strong>Invoice:</strong> ${invoice.invoice_number}</p>
                        <p><strong>Total Hours:</strong> ${totalHours.toFixed(1)}</p>
                        <p><strong>Total Amount:</strong> $${parseFloat(invoice.total_amount).toFixed(2)}</p>
                        <p><strong>Status:</strong> ${invoice.status}</p>
                        <hr>
                        <div style="margin-top: 20px;">
                            <button onclick="InvoicesPage.downloadPDF('${invoice.id}')" class="btn btn-primary" style="background:#007acc;">
                                📄 Download PDF Invoice
                            </button>
                            <button onclick="InvoicesPage.generateEmail('${invoice.id}')" class="btn btn-success" style="background:#28a745;">
                                📧 Generate Email Template
                            </button>
                        </div>
                        <hr>
                        <button onclick="InvoicesPage.viewInvoice('${invoice.id}')" class="btn btn-outline" style="margin-top: 10px;">
                            View Full Invoice
                        </button>
                        <button onclick="InvoicesPage.closeModal()" class="btn btn-secondary" style="background:#6c757d;">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    viewInvoice: async (id) => {
        try {
            const response = await API.get(`/invoices/${id}`);
            const invoice = response.invoice;
            const items = response.items;

            document.getElementById('modal-container').innerHTML = `
                <div class="modal" style="display: block;">
                    <div class="modal-content" style="max-width: 800px;">
                        <div class="modal-header">
                            <h2 class="modal-title">Invoice ${invoice.invoice_number}</h2>
                            <button onclick="InvoicesPage.closeModal()" class="modal-close">&times;</button>
                        </div>
                        
                        <div class="grid grid-2" style="margin-bottom: 2rem;">
                            <div>
                                <h3>Bill To:</h3>
                                <p><strong>${invoice.client_name}</strong><br>
                                ${invoice.client_address || ''}</p>
                                ${invoice.contact_email ? `<p>Email: ${invoice.contact_email}</p>` : ''}
                            </div>
                            <div style="text-align: right;">
                                <p><strong>Invoice Date:</strong> ${DateUtils.formatDate(invoice.invoice_date)}</p>
                                <p><strong>Due Date:</strong> ${DateUtils.formatDate(invoice.due_date)}</p>
                                ${invoice.payment_terms ? `<p><strong>Terms:</strong> ${invoice.payment_terms}</p>` : ''}
                                <p>
                                    <strong>Status:</strong> 
                                    <span class="badge badge-${InvoicesPage.getStatusClass(invoice.status)}">${invoice.status}</span>
                                </p>
                                <p>
                                    <strong>Payment:</strong> 
                                    <span class="badge badge-${InvoicesPage.getPaymentStatusClass(invoice.payment_status)}">${invoice.payment_status}</span>
                                </p>
                            </div>
                        </div>
                        
                        <div class="table-responsive">
                            <table class="table table-mobile-cards">
                                <thead>
                                    <tr>
                                        <th>Description</th>
                                        <th style="text-align: right;">Quantity</th>
                                        <th style="text-align: right;">Rate</th>
                                        <th style="text-align: right;">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${items.map(item => `
                                        <tr>
                                            <td data-label="Description">${item.description}</td>
                                            <td data-label="Quantity" style="text-align: right;">${parseFloat(item.quantity).toFixed(2)}</td>
                                            <td data-label="Rate" style="text-align: right;">$${parseFloat(item.rate).toFixed(2)}</td>
                                            <td data-label="Amount" style="text-align: right;">$${parseFloat(item.amount).toFixed(2)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colspan="3" style="text-align: right;"><strong>Subtotal:</strong></td>
                                        <td data-label="Subtotal" style="text-align: right;">$${parseFloat(invoice.subtotal).toFixed(2)}</td>
                                    </tr>
                                    ${invoice.tax_rate > 0 ? `
                                        <tr>
                                            <td colspan="3" style="text-align: right;"><strong>Tax (${invoice.tax_rate}%):</strong></td>
                                            <td data-label="Tax" style="text-align: right;">$${parseFloat(invoice.tax_amount).toFixed(2)}</td>
                                        </tr>
                                    ` : ''}
                                    <tr>
                                        <td colspan="3" style="text-align: right;"><strong>Total:</strong></td>
                                        <td data-label="Total" style="text-align: right;"><strong>$${parseFloat(invoice.total_amount).toFixed(2)}</strong></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        
                        ${invoice.notes ? `<p><strong>Notes:</strong><br>${invoice.notes}</p>` : ''}
                        
                        <div style="margin-top: 2rem;">
                            <div class="btn-group">
                                ${invoice.status === 'draft' ? `
                                    <button onclick="InvoicesPage.markAsSent('${id}')" class="btn btn-primary">Mark as Sent</button>
                                    <button onclick="InvoicesPage.downloadPDF('${id}')" class="btn btn-outline">Download PDF</button>
                                    <button onclick="InvoicesPage.generateEmail('${id}')" class="btn btn-outline">Generate Email</button>
                                ` : `
                                    <button onclick="InvoicesPage.downloadPDF('${id}')" class="btn btn-primary">Download PDF</button>
                                    <button onclick="InvoicesPage.generateEmail('${id}')" class="btn btn-outline">Generate Email</button>
                                `}
                                ${invoice.payment_status !== 'paid' ? `
                                    <button onclick="InvoicesPage.markAsPaid('${id}')" class="btn btn-outline">Mark as Paid</button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            alert('Error loading invoice details: ' + error.message);
        }
    },

    markAsSent: async (id) => {
        try {
            await API.put(`/invoices/${id}`, { status: 'sent' });
            await InvoicesPage.loadInvoices();
            InvoicesPage.viewInvoice(id);
        } catch (error) {
            alert('Error updating invoice: ' + error.message);
        }
    },

    markAsPaid: async (id) => {
        try {
            await API.put(`/invoices/${id}`, { paymentStatus: 'paid' });
            await InvoicesPage.loadInvoices();
            InvoicesPage.viewInvoice(id);
        } catch (error) {
            alert('Error updating invoice: ' + error.message);
        }
    },

    downloadPDF: async (id) => {
        try {
            const response = await fetch(`${API_URL}/invoices/${id}/pdf`, {
                headers: {
                    'Authorization': `Bearer ${Auth.getToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to generate PDF');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `invoice_${id}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            alert('Error generating PDF: ' + error.message);
        }
    },

    getStatusClass: (status) => {
        const statusClasses = {
            'draft': 'warning',
            'sent': 'info',
            'cancelled': 'danger'
        };
        return statusClasses[status] || 'info';
    },

    getPaymentStatusClass: (status) => {
        const statusClasses = {
            'unpaid': 'danger',
            'partial': 'warning',
            'paid': 'success'
        };
        return statusClasses[status] || 'info';
    },

    generateEmail: async (id) => {
        try {
            const response = await API.get(`/invoices/${id}`);
            const invoice = response.invoice;
            
            // Calculate date range from items
            let startDate = null;
            let endDate = null;
            
            response.items.forEach(item => {
                const dateRangeMatch = item.description.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
                if (dateRangeMatch) {
                    const itemStart = new Date(dateRangeMatch[1]);
                    const itemEnd = new Date(dateRangeMatch[2]);
                    if (!startDate || itemStart < startDate) startDate = itemStart;
                    if (!endDate || itemEnd > endDate) endDate = itemEnd;
                }
            });
            
            const formatDate = (date) => {
                return date ? date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : '';
            };
            
            const recipientName = invoice.invoice_recipient_name || 'Accounts Payable Team';
            const toEmail = invoice.invoice_email || invoice.contact_email || '';
            const ccEmail = invoice.invoice_cc_email || '';
            const dateRange = startDate && endDate ? `${formatDate(startDate)} - ${formatDate(endDate)}` : 'the current period';
            
            const subject = `42 Consulting Invoice ${invoice.invoice_number}: ${dateRange}`;
            const body = `Hi ${recipientName},

Please find the most recent invoice attached for the period of ${dateRange}.

Thank you!

David Korff
Consultant
42 Consulting LLC
(516) 659-8138
david@42consultingllc.com`;

            document.getElementById('modal-container').innerHTML = `
                <div class="modal" style="display: block;">
                    <div class="modal-content" style="max-width: 600px;">
                        <div class="modal-header">
                            <h2 class="modal-title">Email Template</h2>
                            <button onclick="InvoicesPage.closeModal()" class="modal-close">&times;</button>
                        </div>
                        <div style="padding: 20px;">
                            <div class="form-group">
                                <label for="email-to" class="form-label">To:</label>
                                <input type="email" id="email-to" name="email-to" class="form-control" value="${toEmail}">
                            </div>
                            <div class="form-group">
                                <label for="email-cc" class="form-label">CC:</label>
                                <input type="email" id="email-cc" name="email-cc" class="form-control" value="${ccEmail}">
                            </div>
                            <div class="form-group">
                                <label for="email-subject" class="form-label">Subject:</label>
                                <input type="text" id="email-subject" name="email-subject" class="form-control" value="${subject}">
                            </div>
                            <div class="form-group">
                                <label for="email-body" class="form-label">Body:</label>
                                <textarea id="email-body" name="email-body" class="form-control" rows="10">${body}</textarea>
                            </div>
                            <div style="margin-top: 20px;">
                                <button onclick="InvoicesPage.openEmailClient()" class="btn btn-primary">Open in Email Client</button>
                                <button onclick="InvoicesPage.copyEmailDetails()" class="btn btn-outline">Copy Email Details</button>
                                <p style="margin-top: 10px; font-size: 0.9em; color: #666;">
                                    Don't forget to attach the invoice PDF before sending!
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            alert('Error generating email template: ' + error.message);
        }
    },

    openEmailClient: () => {
        const to = encodeURIComponent(document.getElementById('email-to').value);
        const cc = encodeURIComponent(document.getElementById('email-cc').value);
        const subject = encodeURIComponent(document.getElementById('email-subject').value);
        const body = encodeURIComponent(document.getElementById('email-body').value);
        
        const mailto = `mailto:${to}?cc=${cc}&subject=${subject}&body=${body}`;
        window.location.href = mailto;
    },

    copyEmailDetails: () => {
        const to = document.getElementById('email-to').value;
        const cc = document.getElementById('email-cc').value;
        const subject = document.getElementById('email-subject').value;
        const body = document.getElementById('email-body').value;
        
        const emailDetails = `To: ${to}\nCC: ${cc}\nSubject: ${subject}\n\n${body}`;
        
        navigator.clipboard.writeText(emailDetails).then(() => {
            alert('Email details copied to clipboard!');
        }).catch(err => {
            alert('Failed to copy email details');
        });
    },

    closeModal: () => {
        document.getElementById('modal-container').innerHTML = '';
    },

    markAsPaid: async (invoiceId) => {
        if (!confirm('Are you sure you want to mark this invoice as paid?')) {
            return;
        }

        try {
            await API.put(`/invoices/${invoiceId}/payment-status`, { 
                paymentStatus: 'paid',
                paymentDate: new Date().toISOString()
            });
            
            alert('Invoice marked as paid successfully!');
            await InvoicesPage.loadInvoices();
        } catch (error) {
            console.error('Error marking invoice as paid:', error);
            alert('Failed to mark invoice as paid. Please try again.');
        }
    },

    showEditModal: async (invoiceId) => {
        try {
            const response = await API.get(`/invoices/${invoiceId}`);
            const invoice = response.invoice;
            
            const modalContainer = document.getElementById('modal-container');
            modalContainer.innerHTML = `
                <div class="modal" style="display: block;">
                    <div class="modal-content" style="max-width: 600px;">
                        <div class="modal-header">
                            <h2 class="modal-title">Edit Invoice ${invoice.invoice_number}</h2>
                            <button onclick="InvoicesPage.closeModal()" class="modal-close">&times;</button>
                        </div>
                        <form onsubmit="InvoicesPage.handleEdit(event, '${invoiceId}')">
                            <div class="form-group">
                                <label for="edit-invoice-date" class="form-label">Invoice Date</label>
                                <input type="date" id="edit-invoice-date" name="edit-invoice-date" 
                                       class="form-control" value="${invoice.invoice_date.split('T')[0]}" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="edit-due-date" class="form-label">Due Date</label>
                                <input type="date" id="edit-due-date" name="edit-due-date" 
                                       class="form-control" value="${invoice.due_date.split('T')[0]}" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="edit-payment-terms" class="form-label">Payment Terms</label>
                                <select id="edit-payment-terms" name="edit-payment-terms" class="form-control form-select">
                                    <option value="Net 15" ${invoice.payment_terms === 'Net 15' ? 'selected' : ''}>Net 15</option>
                                    <option value="Net 30" ${invoice.payment_terms === 'Net 30' ? 'selected' : ''}>Net 30</option>
                                    <option value="Net 45" ${invoice.payment_terms === 'Net 45' ? 'selected' : ''}>Net 45</option>
                                    <option value="Net 60" ${invoice.payment_terms === 'Net 60' ? 'selected' : ''}>Net 60</option>
                                    <option value="Due on Receipt" ${invoice.payment_terms === 'Due on Receipt' ? 'selected' : ''}>Due on Receipt</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="edit-tax-rate" class="form-label">Tax Rate (%)</label>
                                <input type="number" id="edit-tax-rate" name="edit-tax-rate" 
                                       class="form-control" step="0.01" min="0" max="100" 
                                       value="${invoice.tax_rate || 0}">
                            </div>
                            
                            <div class="form-group">
                                <label for="edit-notes" class="form-label">Notes</label>
                                <textarea id="edit-notes" name="edit-notes" class="form-control" rows="3">${invoice.notes || ''}</textarea>
                            </div>
                            
                            <div class="form-group">
                                <label for="edit-status" class="form-label">Status</label>
                                <select id="edit-status" name="edit-status" class="form-control form-select">
                                    <option value="draft" ${invoice.status === 'draft' ? 'selected' : ''}>Draft</option>
                                    <option value="sent" ${invoice.status === 'sent' ? 'selected' : ''}>Sent</option>
                                    <option value="cancelled" ${invoice.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                                </select>
                            </div>
                            
                            <div style="margin-top: 20px;">
                                <button type="submit" class="btn btn-primary">Save Changes</button>
                                <button type="button" onclick="InvoicesPage.closeModal()" class="btn btn-secondary">Cancel</button>
                                ${invoice.status === 'draft' ? `
                                    <button type="button" onclick="InvoicesPage.sendInvoice('${invoiceId}')" class="btn btn-success">Send Invoice</button>
                                ` : ''}
                            </div>
                        </form>
                    </div>
                </div>
            `;
        } catch (error) {
            alert('Error loading invoice: ' + error.message);
        }
    },

    handleEdit: async (e, invoiceId) => {
        e.preventDefault();
        
        try {
            const invoiceData = {
                invoiceDate: document.getElementById('edit-invoice-date').value,
                dueDate: document.getElementById('edit-due-date').value,
                taxRate: parseFloat(document.getElementById('edit-tax-rate').value) || 0,
                paymentTerms: document.getElementById('edit-payment-terms').value,
                notes: document.getElementById('edit-notes').value || undefined,
                status: document.getElementById('edit-status').value
            };
            
            await API.put(`/invoices/${invoiceId}`, invoiceData);
            
            InvoicesPage.closeModal();
            await InvoicesPage.loadInvoices();
            
            alert('Invoice updated successfully!');
        } catch (error) {
            alert('Error updating invoice: ' + error.message);
        }
    },

    sendInvoice: async (invoiceId) => {
        if (!confirm('Are you sure you want to mark this invoice as sent?')) {
            return;
        }
        
        try {
            await API.put(`/invoices/${invoiceId}`, { status: 'sent' });
            InvoicesPage.closeModal();
            await InvoicesPage.loadInvoices();
            alert('Invoice marked as sent!');
        } catch (error) {
            alert('Error sending invoice: ' + error.message);
        }
    }
};

window.InvoicesPage = InvoicesPage;
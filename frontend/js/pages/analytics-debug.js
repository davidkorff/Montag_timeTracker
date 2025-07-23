const AnalyticsDebugPage = {
  render: async () => {
    document.getElementById('app').innerHTML = `
      ${Navbar.render()}
      <div class="container" style="margin-top: 2rem;">
        <div class="card">
          <div class="card-header">
            <h1>Analytics Debug Dashboard</h1>
            <button onclick="AnalyticsDebugPage.refreshData()" class="btn btn-primary">Refresh Data</button>
          </div>
          
          <div class="card" style="margin-top: 1rem;">
            <h3>Diagnostic Data</h3>
            <div id="diagnostic-data" style="padding: 1rem;">
              <div class="loading">Loading diagnostic data...</div>
            </div>
          </div>
          
          <div class="card" style="margin-top: 1rem;">
            <h3>Revenue Over Time (Raw)</h3>
            <div id="revenue-data" style="padding: 1rem;">
              <div class="loading">Loading revenue data...</div>
            </div>
          </div>
          
          <div class="card" style="margin-top: 1rem;">
            <h3>Client Analytics (Raw)</h3>
            <div id="client-data" style="padding: 1rem;">
              <div class="loading">Loading client data...</div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    Navbar.updateActiveLink();
    await AnalyticsDebugPage.loadAllData();
  },
  
  loadAllData: async () => {
    await Promise.all([
      AnalyticsDebugPage.loadDiagnosticData(),
      AnalyticsDebugPage.loadRevenueData(),
      AnalyticsDebugPage.loadClientData()
    ]);
  },
  
  refreshData: async () => {
    await AnalyticsDebugPage.loadAllData();
  },
  
  loadDiagnosticData: async () => {
    try {
      const data = await API.get('/analytics/diagnostic');
      const container = document.getElementById('diagnostic-data');
      
      container.innerHTML = `
        <h4>Summary</h4>
        <pre>${JSON.stringify(data.summary, null, 2)}</pre>
        
        <h4>Client Totals</h4>
        <table class="table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Entries</th>
              <th>Total Revenue</th>
              <th>Invoiced</th>
              <th>Unbilled</th>
            </tr>
          </thead>
          <tbody>
            ${data.clientTotals.map(client => `
              <tr>
                <td>${client.client_name}</td>
                <td>${client.entry_count}</td>
                <td>$${parseFloat(client.total_revenue).toLocaleString()}</td>
                <td>$${parseFloat(client.invoiced_revenue).toLocaleString()}</td>
                <td>$${parseFloat(client.unbilled_revenue).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <h4>Weekly Data (Last 3 Months)</h4>
        <table class="table">
          <thead>
            <tr>
              <th>Week Start</th>
              <th>Week #</th>
              <th>Client</th>
              <th>Entries</th>
              <th>Total Amount</th>
              <th>Individual Amounts</th>
            </tr>
          </thead>
          <tbody>
            ${data.weeklyData.map(week => `
              <tr>
                <td>${week.week_label}</td>
                <td>${week.week_number}</td>
                <td>${week.client_name}</td>
                <td>${week.entry_count}</td>
                <td>$${parseFloat(week.total_amount).toLocaleString()}</td>
                <td style="font-size: 0.8em;">${week.amounts}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (error) {
      console.error('Error loading diagnostic data:', error);
      document.getElementById('diagnostic-data').innerHTML = `
        <div class="error">Error: ${error.message}</div>
      `;
    }
  },
  
  loadRevenueData: async () => {
    try {
      const params = new URLSearchParams({
        period: 'week',
        startDate: new Date(2025, 0, 1).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        includeUnbilled: true
      });
      
      const data = await API.get(`/analytics/revenue-over-time?${params}`);
      const container = document.getElementById('revenue-data');
      
      container.innerHTML = `
        <h4>Periods</h4>
        <pre>${JSON.stringify(data.periods, null, 2)}</pre>
        
        <h4>Total Revenue by Period</h4>
        <table class="table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Total</th>
              <th>Invoiced</th>
              <th>Unbilled</th>
            </tr>
          </thead>
          <tbody>
            ${data.periods.map((period, idx) => `
              <tr>
                <td>${period}</td>
                <td>$${data.totalRevenue[idx].toLocaleString()}</td>
                <td>$${data.invoicedRevenue[idx].toLocaleString()}</td>
                <td>$${data.unbilledRevenue[idx].toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <h4>Revenue by Client (Raw)</h4>
        <pre>${JSON.stringify(data.revenueByClient, null, 2)}</pre>
      `;
    } catch (error) {
      console.error('Error loading revenue data:', error);
      document.getElementById('revenue-data').innerHTML = `
        <div class="error">Error: ${error.message}</div>
      `;
    }
  },
  
  loadClientData: async () => {
    try {
      const params = new URLSearchParams({
        startDate: new Date(2025, 0, 1).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        limit: 20
      });
      
      const data = await API.get(`/analytics/clients?${params}`);
      const container = document.getElementById('client-data');
      
      container.innerHTML = `
        <h4>Client Analytics</h4>
        <table class="table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Total Revenue</th>
              <th>Invoiced</th>
              <th>Unbilled</th>
              <th>Hours</th>
              <th>Entries</th>
            </tr>
          </thead>
          <tbody>
            ${data.clients.map(client => `
              <tr>
                <td>${client.name}</td>
                <td><strong>$${client.revenue.toLocaleString()}</strong></td>
                <td>$${client.invoicedRevenue.toLocaleString()}</td>
                <td>$${client.unbilledRevenue.toLocaleString()}</td>
                <td>${client.totalHours.toFixed(1)}</td>
                <td>${client.entryCount}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (error) {
      console.error('Error loading client data:', error);
      document.getElementById('client-data').innerHTML = `
        <div class="error">Error: ${error.message}</div>
      `;
    }
  }
};

window.AnalyticsDebugPage = AnalyticsDebugPage;
const AnalyticsPage = {
  charts: {},
  currentFilters: {
    startDate: null,
    endDate: null,
    period: 'month',
    includeUnbilled: false,
    revenueView: 'total'
  },

  render: async () => {
    const user = Auth.getUser();
    const isAdmin = Auth.isAdmin();
    const isConsultant = user.userTypeId === 2;

    document.getElementById('app').innerHTML = `
      ${Navbar.render()}
      <div class="container" style="margin-top: 2rem;">
        <div class="card-header">
          <h1>${isConsultant ? 'My Analytics' : 'Analytics Dashboard'}</h1>
          <div class="filters" style="display: flex; gap: 1rem; align-items: center;">
            <select id="period-filter" class="form-control" style="width: 150px;">
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month" selected>Monthly</option>
              <option value="quarter">Quarterly</option>
              <option value="year">Yearly</option>
            </select>
            <input type="date" id="start-date" class="form-control" style="width: 150px;">
            <input type="date" id="end-date" class="form-control" style="width: 150px;">
            <button onclick="AnalyticsPage.applyFilters()" class="btn btn-primary">Apply</button>
            <button onclick="AnalyticsPage.resetFilters()" class="btn btn-secondary">Reset</button>
          </div>
        </div>

        ${!isConsultant ? `
        <!-- Overview Cards -->
        <div id="overview-stats" class="stats-grid" style="margin-top: 2rem;">
          <div class="loading">Loading statistics...</div>
        </div>
        ` : ''}

        <!-- Hours Charts -->
        <div class="${isConsultant ? 'card' : 'grid grid-2'} " style="margin-top: 2rem; gap: 2rem;">
          ${!isConsultant ? `
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h3>Revenue Trend</h3>
              <div style="display: flex; gap: 1rem; align-items: center;">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                  <input type="checkbox" id="include-unbilled" onchange="AnalyticsPage.toggleUnbilledRevenue()">
                  Include Unbilled
                </label>
                <select id="revenue-view" class="form-control" style="width: 150px;" onchange="AnalyticsPage.toggleRevenueView()">
                  <option value="total">Total Revenue</option>
                  <option value="stacked">By Client (Stacked)</option>
                  <option value="superimposed">By Client (Lines)</option>
                </select>
              </div>
            </div>
            <div style="position: relative; height: 300px;">
              <canvas id="revenue-chart"></canvas>
            </div>
          </div>
          ` : ''}
          <div class="${isConsultant ? '' : 'card'}">
            <h3>${isConsultant ? 'My Hours Tracked' : 'Hours Trend'}</h3>
            <div class="chart-controls" style="margin-bottom: 1rem;">
              <div style="display: flex; gap: 10px; align-items: center;">
                <select id="hours-view" class="form-control" style="width: 150px;" onchange="AnalyticsPage.toggleHoursView()">
                  <option value="stacked">Stacked View</option>
                  <option value="line">Line View</option>
                </select>
              </div>
            </div>
            <div style="position: relative; height: 300px;">
              <canvas id="hours-chart"></canvas>
            </div>
          </div>
        </div>

        ${!isConsultant ? `
        <!-- Client Analytics -->
        <div class="card" style="margin-top: 2rem;">
          <h3>Top Clients by Revenue</h3>
          <div class="grid grid-2" style="gap: 2rem;">
            <div style="position: relative; height: 300px;">
              <canvas id="client-revenue-chart"></canvas>
            </div>
            <div id="client-table" style="max-height: 400px; overflow-y: auto;">
              <div class="loading">Loading client data...</div>
            </div>
          </div>
        </div>
        ` : `
        <!-- My Project Hours -->
        <div class="card" style="margin-top: 2rem;">
          <h3>My Time by Project</h3>
          <div class="grid grid-2" style="gap: 2rem;">
            <div style="position: relative; height: 300px;">
              <canvas id="project-hours-chart"></canvas>
            </div>
            <div id="project-hours-table" style="max-height: 400px; overflow-y: auto;">
              <div class="loading">Loading project data...</div>
            </div>
          </div>
        </div>
        `}

        ${!isConsultant ? `
        <!-- Project Analytics -->
        <div class="card" style="margin-top: 2rem;">
          <h3>Project Status & Budget</h3>
          <div class="grid grid-2" style="gap: 2rem;">
            <div style="position: relative; height: 300px;">
              <canvas id="project-status-chart"></canvas>
            </div>
            <div id="project-table" style="max-height: 400px; overflow-y: auto;">
              <div class="loading">Loading project data...</div>
            </div>
          </div>
        </div>
        ` : ''}

        ${!isConsultant ? `
        <!-- Invoice Analytics -->
        <div class="card" style="margin-top: 2rem;">
          <h3>Invoice Analysis</h3>
          <div class="grid grid-3" style="gap: 2rem;">
            <div>
              <h4>Payment Status</h4>
              <div style="position: relative; height: 250px;">
                <canvas id="invoice-status-chart"></canvas>
              </div>
            </div>
            <div>
              <h4>Aging Report</h4>
              <div style="position: relative; height: 250px;">
                <canvas id="invoice-aging-chart"></canvas>
              </div>
            </div>
            <div id="invoice-summary">
              <div class="loading">Loading invoice data...</div>
            </div>
          </div>
        </div>
        ` : ''}

        ${isConsultant ? `
        <!-- My Performance -->
        <div class="card" style="margin-top: 2rem;">
          <h3>My Performance Summary</h3>
          <div id="my-performance" class="stats-grid">
            <div class="loading">Loading performance data...</div>
          </div>
        </div>
        ` : Auth.isAdmin() ? `
        <!-- Utilization Analytics -->
        <div class="card" style="margin-top: 2rem;">
          <h3>Team Utilization</h3>
          <div id="utilization-table">
            <div class="loading">Loading utilization data...</div>
          </div>
        </div>
        ` : ''}
      </div>
      <div id="timer-container"></div>
    `;

    Navbar.updateActiveLink();
    timer.render();
    
    // Initialize date filters
    AnalyticsPage.initializeFilters();
    
    // Load all analytics data
    await AnalyticsPage.loadAllData();
  },

  initializeFilters: () => {
    // Set default date range (last 12 months)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);
    
    document.getElementById('start-date').value = startDate.toISOString().split('T')[0];
    document.getElementById('end-date').value = endDate.toISOString().split('T')[0];
    
    AnalyticsPage.currentFilters.startDate = startDate.toISOString().split('T')[0];
    AnalyticsPage.currentFilters.endDate = endDate.toISOString().split('T')[0];
    
    // Add period change listener
    document.getElementById('period-filter').addEventListener('change', () => {
      AnalyticsPage.currentFilters.period = document.getElementById('period-filter').value;
      AnalyticsPage.loadTimeSeriesData();
    });
  },

  applyFilters: () => {
    AnalyticsPage.currentFilters.startDate = document.getElementById('start-date').value;
    AnalyticsPage.currentFilters.endDate = document.getElementById('end-date').value;
    AnalyticsPage.currentFilters.period = document.getElementById('period-filter').value;
    AnalyticsPage.loadAllData();
  },

  resetFilters: () => {
    AnalyticsPage.initializeFilters();
    AnalyticsPage.loadAllData();
  },

  loadAllData: async () => {
    const user = Auth.getUser();
    const isConsultant = user.userTypeId === 2;
    
    const promises = [
      AnalyticsPage.loadTimeSeriesData()
    ];
    
    if (!isConsultant) {
      // Admin users see all analytics
      promises.push(
        AnalyticsPage.loadOverviewStats(),
        AnalyticsPage.loadClientAnalytics(),
        AnalyticsPage.loadProjectAnalytics(),
        AnalyticsPage.loadInvoiceAnalytics()
      );
    } else {
      // Consultants see their own analytics
      promises.push(
        AnalyticsPage.loadConsultantProjectHours(),
        AnalyticsPage.loadConsultantPerformance()
      );
    }
    
    // Only load utilization data for admin users
    if (Auth.isAdmin()) {
      promises.push(AnalyticsPage.loadUtilizationData());
    }
    
    await Promise.all(promises);
  },

  loadOverviewStats: async () => {
    try {
      const stats = await API.get('/analytics/overview');
      
      document.getElementById('overview-stats').innerHTML = `
        <div class="stat-card">
          <div class="stat-icon" style="background: #10b981;">💰</div>
          <div class="stat-content">
            <div class="stat-value">$${AnalyticsPage.formatNumber(stats.revenue.allTime)}</div>
            <div class="stat-label">Total Revenue</div>
            <div class="stat-detail">YTD: $${AnalyticsPage.formatNumber(stats.revenue.yearToDate)}</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon" style="background: #3b82f6;">⏱️</div>
          <div class="stat-content">
            <div class="stat-value">${AnalyticsPage.formatNumber(stats.hours.allTime)}</div>
            <div class="stat-label">Total Hours</div>
            <div class="stat-detail">Billable: ${stats.hours.utilizationRate}%</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon" style="background: #8b5cf6;">🏢</div>
          <div class="stat-content">
            <div class="stat-value">${stats.clients.active}</div>
            <div class="stat-label">Active Clients</div>
            <div class="stat-detail">${stats.clients.activeProjects} active projects</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon" style="background: #f59e0b;">📄</div>
          <div class="stat-content">
            <div class="stat-value">${stats.invoices.total}</div>
            <div class="stat-label">Total Invoices</div>
            <div class="stat-detail">${stats.invoices.overdue} overdue</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon" style="background: #ec4899;">💵</div>
          <div class="stat-content">
            <div class="stat-value">$${AnalyticsPage.formatNumber(stats.revenue.outstanding)}</div>
            <div class="stat-label">Outstanding</div>
            <div class="stat-detail">${stats.invoices.pending} pending</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon" style="background: #14b8a6;">💸</div>
          <div class="stat-content">
            <div class="stat-value">$${Math.round(stats.averages.hourlyRate)}</div>
            <div class="stat-label">Avg Hourly Rate</div>
            <div class="stat-detail">${Math.round(stats.averages.daysToPayment)} days to payment</div>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Error loading overview stats:', error);
      document.getElementById('overview-stats').innerHTML = `
        <div class="error-message">
          <p>Failed to load overview statistics. Please try refreshing the page.</p>
        </div>
      `;
    }
  },

  toggleUnbilledRevenue: () => {
    AnalyticsPage.currentFilters.includeUnbilled = document.getElementById('include-unbilled').checked;
    AnalyticsPage.loadTimeSeriesData();
  },

  toggleRevenueView: () => {
    AnalyticsPage.currentFilters.revenueView = document.getElementById('revenue-view').value;
    AnalyticsPage.loadTimeSeriesData();
  },

  toggleHoursView: () => {
    AnalyticsPage.loadTimeSeriesData();
  },

  loadTimeSeriesData: async () => {
    try {
      const params = new URLSearchParams({
        period: AnalyticsPage.currentFilters.period,
        startDate: AnalyticsPage.currentFilters.startDate,
        endDate: AnalyticsPage.currentFilters.endDate,
        includeUnbilled: AnalyticsPage.currentFilters.includeUnbilled
      });
      
      const [revenueData, hoursData] = await Promise.all([
        API.get(`/analytics/revenue-over-time?${params}`),
        API.get(`/analytics/hours-over-time?${params}`)
      ]);
      
      // Revenue Chart
      const revenueCtx = document.getElementById('revenue-chart').getContext('2d');
      if (AnalyticsPage.charts.revenue) {
        AnalyticsPage.charts.revenue.destroy();
      }
      
      // Build datasets based on view type
      let datasets = [];
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6'];
      
      if (AnalyticsPage.currentFilters.revenueView === 'total') {
        // Simple total revenue view
        datasets = [{
          label: 'Invoiced Revenue',
          data: revenueData.invoicedRevenue,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: true
        }];
        
        if (AnalyticsPage.currentFilters.includeUnbilled) {
          datasets.push({
            label: 'Unbilled Revenue',
            data: revenueData.unbilledRevenue,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            tension: 0.4,
            fill: true
          });
        }
      } else {
        // Client breakdown views
        revenueData.clients.forEach((client, index) => {
          const color = colors[index % colors.length];
          const clientData = revenueData.revenueByClient[client];
          
          if (AnalyticsPage.currentFilters.revenueView === 'stacked') {
            datasets.push({
              label: client,
              data: AnalyticsPage.currentFilters.includeUnbilled ? clientData.total : clientData.invoiced,
              backgroundColor: color,
              stack: 'revenue'
            });
          } else {
            // Superimposed lines
            datasets.push({
              label: client,
              data: AnalyticsPage.currentFilters.includeUnbilled ? clientData.total : clientData.invoiced,
              borderColor: color,
              backgroundColor: 'transparent',
              tension: 0.4,
              borderWidth: 2
            });
          }
        });
      }
      
      const chartType = AnalyticsPage.currentFilters.revenueView === 'stacked' ? 'bar' : 'line';
      
      AnalyticsPage.charts.revenue = new Chart(revenueCtx, {
        type: chartType,
        data: {
          labels: revenueData.periods,
          datasets: datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            tooltip: {
              mode: 'index',
              intersect: false,
              callbacks: {
                label: (context) => `${context.dataset.label}: $${AnalyticsPage.formatNumber(context.parsed.y)}`
              }
            },
            legend: {
              display: true,
              position: 'bottom'
            }
          },
          scales: {
            x: {
              stacked: AnalyticsPage.currentFilters.revenueView === 'stacked'
            },
            y: {
              stacked: AnalyticsPage.currentFilters.revenueView === 'stacked',
              beginAtZero: true,
              ticks: {
                callback: (value) => '$' + AnalyticsPage.formatNumber(value)
              }
            }
          }
        }
      });
      
      // Hours Chart
      const hoursCtx = document.getElementById('hours-chart').getContext('2d');
      if (AnalyticsPage.charts.hours) {
        AnalyticsPage.charts.hours.destroy();
      }
      
      const hoursView = document.getElementById('hours-view')?.value || 'stacked';
      const isStacked = hoursView === 'stacked';
      
      AnalyticsPage.charts.hours = new Chart(hoursCtx, {
        type: isStacked ? 'bar' : 'line',
        data: {
          labels: hoursData.periods,
          datasets: [{
            label: 'Billable Hours',
            data: hoursData.billableHours,
            backgroundColor: isStacked ? '#3b82f6' : 'rgba(59, 130, 246, 0.1)',
            borderColor: '#3b82f6',
            borderWidth: isStacked ? 0 : 2,
            stack: isStacked ? 'hours' : undefined,
            tension: 0.1
          }, {
            label: 'Non-Billable Hours',
            data: hoursData.nonBillableHours,
            backgroundColor: isStacked ? '#94a3b8' : 'rgba(148, 163, 184, 0.1)',
            borderColor: '#94a3b8',
            borderWidth: isStacked ? 0 : 2,
            stack: isStacked ? 'hours' : undefined,
            tension: 0.1
          }, {
            label: 'Utilization Rate',
            data: hoursData.utilizationRate,
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderColor: '#10b981',
            borderWidth: 2,
            type: 'line',
            yAxisID: 'y1',
            hidden: isStacked,
            tension: 0.1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: (context) => {
                  if (context.dataset.label === 'Utilization Rate') {
                    return `${context.dataset.label}: ${context.parsed.y}%`;
                  }
                  return `${context.dataset.label}: ${context.parsed.y} hours`;
                }
              }
            }
          },
          scales: {
            x: {
              stacked: isStacked
            },
            y: {
              stacked: isStacked,
              beginAtZero: true,
              title: {
                display: true,
                text: 'Hours'
              }
            },
            y1: {
              display: !isStacked,
              position: 'right',
              beginAtZero: true,
              max: 100,
              title: {
                display: true,
                text: 'Utilization %'
              },
              grid: {
                drawOnChartArea: false
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Error loading time series data:', error);
      // Ensure charts are properly destroyed on error
      if (AnalyticsPage.charts.revenue) {
        AnalyticsPage.charts.revenue.destroy();
        AnalyticsPage.charts.revenue = null;
      }
      if (AnalyticsPage.charts.hours) {
        AnalyticsPage.charts.hours.destroy();
        AnalyticsPage.charts.hours = null;
      }
    }
  },

  loadClientAnalytics: async () => {
    try {
      const params = new URLSearchParams({
        startDate: AnalyticsPage.currentFilters.startDate,
        endDate: AnalyticsPage.currentFilters.endDate,
        limit: 10
      });
      
      const data = await API.get(`/analytics/clients?${params}`);
      
      // Client Revenue Chart
      const ctx = document.getElementById('client-revenue-chart').getContext('2d');
      if (AnalyticsPage.charts.clientRevenue) {
        AnalyticsPage.charts.clientRevenue.destroy();
      }
      
      const topClients = data.clients.slice(0, 5);
      AnalyticsPage.charts.clientRevenue = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: topClients.map(c => c.name),
          datasets: [{
            label: 'Invoiced',
            data: topClients.map(c => c.invoicedRevenue),
            backgroundColor: '#10b981'
          }, {
            label: 'Unbilled',
            data: topClients.map(c => c.unbilledRevenue),
            backgroundColor: '#f59e0b',
            borderColor: '#f59e0b',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              stacked: true,
            },
            y: {
              stacked: true,
              ticks: {
                callback: function(value) {
                  return '$' + AnalyticsPage.formatNumber(value);
                }
              }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: (context) => {
                  const label = context.dataset.label || '';
                  const value = '$' + AnalyticsPage.formatNumber(context.parsed.y);
                  return `${label}: ${value}`;
                }
              }
            },
            legend: {
              position: 'top'
            }
          }
        }
      });
      
      // Client Table
      document.getElementById('client-table').innerHTML = `
        <table class="table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Total Revenue</th>
              <th>Invoiced</th>
              <th>Unbilled</th>
              <th>Hours</th>
              <th>Projects</th>
            </tr>
          </thead>
          <tbody>
            ${data.clients.map(client => `
              <tr>
                <td>${client.name}</td>
                <td><strong>$${AnalyticsPage.formatNumber(client.revenue)}</strong></td>
                <td style="color: #10b981;">$${AnalyticsPage.formatNumber(client.invoicedRevenue)}</td>
                <td style="color: #f59e0b;">$${AnalyticsPage.formatNumber(client.unbilledRevenue)}</td>
                <td>${AnalyticsPage.formatNumber(client.totalHours)}</td>
                <td>${client.projectCount}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (error) {
      console.error('Error loading client analytics:', error);
      document.getElementById('client-table').innerHTML = `
        <div class="error-message">
          <p>Failed to load client analytics. Please try again later.</p>
        </div>
      `;
      if (AnalyticsPage.charts.clientRevenue) {
        AnalyticsPage.charts.clientRevenue.destroy();
        AnalyticsPage.charts.clientRevenue = null;
      }
    }
  },

  loadProjectAnalytics: async () => {
    try {
      const data = await API.get('/analytics/projects');
      
      // Project Status Chart
      const statusCounts = {};
      data.projects.forEach(p => {
        statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
      });
      
      const ctx = document.getElementById('project-status-chart').getContext('2d');
      if (AnalyticsPage.charts.projectStatus) {
        AnalyticsPage.charts.projectStatus.destroy();
      }
      
      AnalyticsPage.charts.projectStatus = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: Object.keys(statusCounts).map(s => s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')),
          datasets: [{
            data: Object.values(statusCounts),
            backgroundColor: [
              '#10b981',
              '#3b82f6',
              '#f59e0b',
              '#ef4444'
            ]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom'
            }
          }
        }
      });
      
      // Project Table
      const sortedProjects = data.projects.sort((a, b) => b.revenue - a.revenue).slice(0, 10);
      document.getElementById('project-table').innerHTML = `
        <table class="table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Client</th>
              <th>Revenue</th>
              <th>Budget</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${sortedProjects.map(project => `
              <tr class="${project.isOverBudget ? 'over-budget' : ''}">
                <td>${project.name}</td>
                <td>${project.clientName}</td>
                <td>$${AnalyticsPage.formatNumber(project.revenue)}</td>
                <td>
                  ${project.budgetUtilization ? `
                    <div class="progress-bar">
                      <div class="progress-fill ${project.budgetUtilization > 90 ? 'danger' : project.budgetUtilization > 75 ? 'warning' : 'success'}" 
                           style="width: ${Math.min(100, project.budgetUtilization)}%"></div>
                    </div>
                    <small>${project.budgetUtilization}%</small>
                  ` : '-'}
                </td>
                <td>
                  <span class="badge badge-${AnalyticsPage.getStatusClass(project.status)}">
                    ${project.status}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (error) {
      console.error('Error loading project analytics:', error);
      document.getElementById('project-table').innerHTML = `
        <div class="error-message">
          <p>Failed to load project analytics. Please try again later.</p>
        </div>
      `;
      if (AnalyticsPage.charts.projectStatus) {
        AnalyticsPage.charts.projectStatus.destroy();
        AnalyticsPage.charts.projectStatus = null;
      }
    }
  },

  loadInvoiceAnalytics: async () => {
    try {
      const data = await API.get('/analytics/invoices');
      
      // Payment Status Chart
      const statusData = {};
      data.statusBreakdown.forEach(item => {
        const key = `${item.status}-${item.paymentStatus}`;
        statusData[key] = item.totalAmount;
      });
      
      const statusCtx = document.getElementById('invoice-status-chart').getContext('2d');
      if (AnalyticsPage.charts.invoiceStatus) {
        AnalyticsPage.charts.invoiceStatus.destroy();
      }
      
      AnalyticsPage.charts.invoiceStatus = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
          labels: ['Paid', 'Sent', 'Draft'],
          datasets: [{
            data: [
              statusData['sent-paid'] || 0,
              statusData['sent-pending'] || 0,
              statusData['draft-pending'] || 0
            ],
            backgroundColor: ['#10b981', '#f59e0b', '#94a3b8']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            tooltip: {
              callbacks: {
                label: (context) => {
                  const label = context.label || '';
                  const value = '$' + AnalyticsPage.formatNumber(context.parsed);
                  return `${label}: ${value}`;
                }
              }
            }
          }
        }
      });
      
      // Aging Chart
      const agingCtx = document.getElementById('invoice-aging-chart').getContext('2d');
      if (AnalyticsPage.charts.invoiceAging) {
        AnalyticsPage.charts.invoiceAging.destroy();
      }
      
      const agingData = {
        current: 0,
        overdue_30: 0,
        overdue_60: 0,
        overdue_90: 0,
        overdue_90_plus: 0
      };
      
      data.aging.forEach(item => {
        agingData[item.bucket] = item.totalAmount;
      });
      
      AnalyticsPage.charts.invoiceAging = new Chart(agingCtx, {
        type: 'bar',
        data: {
          labels: ['Current', '1-30 days', '31-60 days', '61-90 days', '90+ days'],
          datasets: [{
            label: 'Amount',
            data: Object.values(agingData),
            backgroundColor: ['#10b981', '#f59e0b', '#fb923c', '#f87171', '#ef4444']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: (value) => '$' + AnalyticsPage.formatNumber(value)
              }
            }
          }
        }
      });
      
      // Invoice Summary
      const totalAging = data.aging.reduce((sum, item) => sum + item.totalAmount, 0);
      document.getElementById('invoice-summary').innerHTML = `
        <h4>Payment Trends</h4>
        <div class="stat-list">
          ${data.paymentTrends.slice(0, 3).map(trend => `
            <div class="stat-item">
              <span>${new Date(trend.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
              <strong>$${AnalyticsPage.formatNumber(trend.amountCollected)}</strong>
              <small>${trend.invoicesPaid} invoices, ${Math.round(trend.avgDaysToPayment)} days avg</small>
            </div>
          `).join('')}
        </div>
        <div class="divider"></div>
        <div class="stat-item">
          <span>Total Outstanding</span>
          <strong class="text-danger">$${AnalyticsPage.formatNumber(totalAging)}</strong>
        </div>
      `;
    } catch (error) {
      console.error('Error loading invoice analytics:', error);
      document.getElementById('invoice-summary').innerHTML = `
        <div class="error-message">
          <p>Failed to load invoice analytics. Please try again later.</p>
        </div>
      `;
      if (AnalyticsPage.charts.invoiceStatus) {
        AnalyticsPage.charts.invoiceStatus.destroy();
        AnalyticsPage.charts.invoiceStatus = null;
      }
      if (AnalyticsPage.charts.invoiceAging) {
        AnalyticsPage.charts.invoiceAging.destroy();
        AnalyticsPage.charts.invoiceAging = null;
      }
    }
  },

  loadUtilizationData: async () => {
    try {
      // Only load if admin
      if (!Auth.isAdmin()) {
        const utilizationEl = document.getElementById('utilization-table');
        if (utilizationEl) {
          utilizationEl.innerHTML = `
            <p>Team utilization data is only available for administrators.</p>
          `;
        }
        return;
      }
      
      const params = new URLSearchParams({
        startDate: AnalyticsPage.currentFilters.startDate,
        endDate: AnalyticsPage.currentFilters.endDate
      });
      
      const data = await API.get(`/analytics/consultants?${params}`);
      
      document.getElementById('utilization-table').innerHTML = `
        <table class="table">
          <thead>
            <tr>
              <th>Consultant</th>
              <th>Total Hours</th>
              <th>Billable Hours</th>
              <th>Utilization</th>
              <th>Projects</th>
              <th>Clients</th>
              <th>Last Activity</th>
            </tr>
          </thead>
          <tbody>
            ${data.consultants.map(consultant => `
              <tr>
                <td>${consultant.name}</td>
                <td>${AnalyticsPage.formatNumber(consultant.totalHours)}</td>
                <td>${AnalyticsPage.formatNumber(consultant.billableHours)}</td>
                <td>
                  <div class="progress-bar" style="width: 100px;">
                    <div class="progress-fill ${consultant.utilizationRate > 80 ? 'success' : consultant.utilizationRate > 60 ? 'warning' : 'danger'}" 
                         style="width: ${consultant.utilizationRate}%"></div>
                  </div>
                  <span>${consultant.utilizationRate}%</span>
                </td>
                <td>${consultant.projectsWorked}</td>
                <td>${consultant.clientsServed}</td>
                <td>${consultant.lastActivity ? new Date(consultant.lastActivity).toLocaleDateString() : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (error) {
      console.error('Error loading utilization data:', error);
      const utilizationEl = document.getElementById('utilization-table');
      if (utilizationEl) {
        utilizationEl.innerHTML = `
          <div class="error-message">
            <p>Failed to load utilization data. ${error.message === 'Admin access required' ? 'Admin access is required.' : 'Please try again later.'}</p>
          </div>
        `;
      }
    }
  },

  formatNumber: (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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

  loadConsultantProjectHours: async () => {
    try {
      const params = new URLSearchParams({
        startDate: AnalyticsPage.currentFilters.startDate,
        endDate: AnalyticsPage.currentFilters.endDate
      });
      
      const data = await API.get(`/analytics/my-projects?${params}`);
      
      // Project Hours Chart
      const ctx = document.getElementById('project-hours-chart');
      if (ctx) {
        const chartCtx = ctx.getContext('2d');
        if (AnalyticsPage.charts.projectHours) {
          AnalyticsPage.charts.projectHours.destroy();
        }
        
        const topProjects = data.projects.slice(0, 10);
        AnalyticsPage.charts.projectHours = new Chart(chartCtx, {
          type: 'doughnut',
          data: {
            labels: topProjects.map(p => p.name),
            datasets: [{
              data: topProjects.map(p => p.totalHours),
              backgroundColor: [
                '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6',
                '#14b8a6', '#ef4444', '#84cc16', '#06b6d4', '#a855f7'
              ]
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const label = context.label || '';
                    const value = context.parsed;
                    const percentage = ((value / data.totalHours) * 100).toFixed(1);
                    return `${label}: ${value.toFixed(1)} hours (${percentage}%)`;
                  }
                }
              },
              legend: {
                position: 'bottom'
              }
            }
          }
        });
        
        // Project Hours Table
        document.getElementById('project-hours-table').innerHTML = `
          <table class="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Client</th>
                <th>Hours</th>
                <th>Billable</th>
                <th>% of Total</th>
              </tr>
            </thead>
            <tbody>
              ${data.projects.map(project => `
                <tr>
                  <td>${project.name}</td>
                  <td>${project.clientName}</td>
                  <td><strong>${project.totalHours.toFixed(1)}</strong></td>
                  <td>${project.billableHours.toFixed(1)}</td>
                  <td>${((project.totalHours / data.totalHours) * 100).toFixed(1)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
    } catch (error) {
      console.error('Error loading consultant project hours:', error);
      const table = document.getElementById('project-hours-table');
      if (table) {
        table.innerHTML = `
          <div class="error-message">
            <p>Failed to load project hours. Please try again later.</p>
          </div>
        `;
      }
    }
  },

  loadConsultantPerformance: async () => {
    try {
      const params = new URLSearchParams({
        startDate: AnalyticsPage.currentFilters.startDate,
        endDate: AnalyticsPage.currentFilters.endDate
      });
      
      const data = await API.get(`/analytics/my-performance?${params}`);
      
      document.getElementById('my-performance').innerHTML = `
        <div class="stat-card">
          <div class="stat-icon" style="background: #3b82f6;">⏱️</div>
          <div class="stat-content">
            <div class="stat-value">${AnalyticsPage.formatNumber(data.totalHours)}</div>
            <div class="stat-label">Total Hours</div>
            <div class="stat-detail">${data.workingDays} working days</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon" style="background: #10b981;">✅</div>
          <div class="stat-content">
            <div class="stat-value">${AnalyticsPage.formatNumber(data.billableHours)}</div>
            <div class="stat-label">Billable Hours</div>
            <div class="stat-detail">${data.billablePercentage}% billable</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon" style="background: #8b5cf6;">📊</div>
          <div class="stat-content">
            <div class="stat-value">${data.avgDailyHours.toFixed(1)}</div>
            <div class="stat-label">Avg Daily Hours</div>
            <div class="stat-detail">When working</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon" style="background: #f59e0b;">🏢</div>
          <div class="stat-content">
            <div class="stat-value">${data.projectsWorked}</div>
            <div class="stat-label">Projects Worked</div>
            <div class="stat-detail">${data.clientsServed} clients</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon" style="background: #14b8a6;">📝</div>
          <div class="stat-content">
            <div class="stat-value">${data.entriesCount}</div>
            <div class="stat-label">Time Entries</div>
            <div class="stat-detail">This period</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon" style="background: #ec4899;">🎯</div>
          <div class="stat-content">
            <div class="stat-value">${data.utilizationRate}%</div>
            <div class="stat-label">Utilization Rate</div>
            <div class="stat-detail">Billable/Total</div>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Error loading consultant performance:', error);
      document.getElementById('my-performance').innerHTML = `
        <div class="error-message">
          <p>Failed to load performance data. Please try again later.</p>
        </div>
      `;
    }
  }
};

window.AnalyticsPage = AnalyticsPage;
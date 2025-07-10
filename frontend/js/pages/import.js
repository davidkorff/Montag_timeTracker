const ImportPage = {
  csvData: null,
  analysisResult: null,
  mappings: {},

  async init() {
    document.getElementById('app').innerHTML = `
      <div class="page-container">
        <div class="page-header">
          <h1>Import Historical Data</h1>
          <button class="btn btn-secondary" onclick="history.back()">Back</button>
        </div>

        <div class="import-container">
          <div class="import-section">
            <h2>Step 1: Upload CSV File</h2>
            <div class="file-upload-area">
              <input type="file" id="csvFile" accept=".csv" style="display: none;">
              <button class="btn btn-primary" onclick="document.getElementById('csvFile').click()">
                Select CSV File
              </button>
              <span id="fileName" class="file-name"></span>
            </div>
          </div>

          <div id="analysisSection" class="import-section" style="display: none;">
            <h2>Step 2: Map Entries to Clients and Projects</h2>
            <div id="mappingSummary"></div>
            <div id="mappingTable"></div>
            <div style="margin-top: 20px;">
              <button class="btn btn-primary" onclick="ImportPage.importData()">Import Selected Entries</button>
            </div>
          </div>

          <div id="resultsSection" class="import-section" style="display: none;">
            <h2>Import Results</h2>
            <div id="importResults"></div>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  },

  attachEventListeners() {
    document.getElementById('csvFile').addEventListener('change', (e) => this.handleFileSelect(e));
  },

  async handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('fileName').textContent = file.name;

    try {
      const text = await file.text();
      this.csvData = this.parseCSV(text);
      
      // Show analysis section
      document.getElementById('analysisSection').style.display = 'block';
      document.getElementById('mappingTable').innerHTML = '<div class="loading">Analyzing CSV...</div>';
      
      // Analyze CSV
      const response = await API.post('/import/analyze', { csvData: this.csvData });
      this.analysisResult = response;
      this.displayMappingTable(response);
      
    } catch (error) {
      console.error('Error analyzing file:', error);
      this.showError('Failed to analyze CSV file: ' + error.message);
    }
  },

  parseCSV(text) {
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) return [];

    // Get headers from first line
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = this.parseCSVLine(lines[i]);
      const row = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      data.push(row);
    }

    return data;
  },

  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current.trim());
    return values;
  },

  displayMappingTable(result) {
    const { summary, entries, existingClients, csvCompanies } = result;
    
    // Create client options
    const clientOptions = existingClients.map(client => 
      `<option value="${client.id}">${client.name}</option>`
    ).join('');
    
    // Display summary with client selector
    document.getElementById('mappingSummary').innerHTML = `
      <div class="summary-stats">
        <div class="stat">
          <span class="label">Total Entries:</span>
          <span class="value">${summary.totalEntries}</span>
        </div>
        <div class="stat">
          <span class="label">Date Range:</span>
          <span class="value">${summary.dateRange.start} to ${summary.dateRange.end}</span>
        </div>
        <div class="stat">
          <span class="label">CSV Companies:</span>
          <span class="value">${summary.uniqueCompanies}</span>
        </div>
        <div class="stat">
          <span class="label">Existing Clients:</span>
          <span class="value">${existingClients.length}</span>
        </div>
      </div>
      
      <div style="margin: 20px 0; padding: 20px; background: #f0f0f0; border-radius: 8px;">
        <label style="font-weight: bold; margin-right: 10px;">Set Client for All Entries:</label>
        <select id="globalClient" onchange="ImportPage.setGlobalClient()" style="padding: 8px; font-size: 16px;">
          <option value="">-- Select Client for All --</option>
          ${clientOptions}
        </select>
      </div>
    `;
    
    // Store clients for easy access
    this.existingClients = existingClients;
    
    // Display entries table
    let tableHtml = `
      <div style="margin: 20px 0;">
        <label>
          <input type="checkbox" id="selectAll" onchange="ImportPage.toggleSelectAll()">
          Select All Entries
        </label>
      </div>
      <div style="overflow-x: auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th width="30">
                <input type="checkbox" id="headerCheckbox" onchange="ImportPage.toggleSelectAll()">
              </th>
              <th>Date</th>
              <th>Company</th>
              <th>Hours</th>
              <th>Rate</th>
              <th>Amount</th>
              <th>Description</th>
              <th>Status</th>
              <th>Invoice</th>
              <th>Project</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    entries.forEach(entry => {
      const rate = entry.hours > 0 ? Math.round(entry.money / entry.hours) : 0;
      const rowClass = entry.hours <= 0 ? 'style="opacity: 0.5;"' : '';
      const disabled = entry.hours <= 0 ? 'disabled' : '';
      const checked = entry.hours > 0 ? 'checked' : '';
      
      tableHtml += `
        <tr ${rowClass}>
          <td>
            <input type="checkbox" 
                   id="select_${entry.id}" 
                   ${checked} 
                   ${disabled}
                   onchange="ImportPage.updateSelection(${entry.id})">
          </td>
          <td>${entry.date}</td>
          <td>${entry.company}</td>
          <td>${entry.hours}</td>
          <td>$${rate}</td>
          <td>$${entry.money}</td>
          <td>${entry.context || '-'}</td>
          <td>
            <span class="badge badge-${entry.status === 'Paid' ? 'success' : entry.status === 'Billed' ? 'warning' : 'info'}">
              ${entry.status}
            </span>
          </td>
          <td>${entry.invoiceNumber || '-'}</td>
          <td>
            <select id="project_${entry.id}" 
                    onchange="ImportPage.updateProjectSelection(${entry.id})"
                    ${disabled}>
              <option value="">-- Select Project --</option>
            </select>
          </td>
        </tr>
      `;
      
      // Initialize mapping
      this.mappings[entry.id] = {
        selected: entry.hours > 0,
        clientId: null,
        projectId: null
      };
    });
    
    tableHtml += `
          </tbody>
        </table>
      </div>
    `;
    
    document.getElementById('mappingTable').innerHTML = tableHtml;
  },
  
  setGlobalClient() {
    const clientId = document.getElementById('globalClient').value;
    
    if (!clientId) return;
    
    // Find the selected client
    const client = this.existingClients.find(c => c.id == clientId);
    if (!client) return;
    
    // Get first project alphabetically as default
    let defaultProject = null;
    if (client.projects.length > 0) {
      // Sort projects alphabetically
      const sortedProjects = [...client.projects].sort((a, b) => a.name.localeCompare(b.name));
      defaultProject = sortedProjects[0];
    }
    
    // Update all entries
    this.analysisResult.entries.forEach(entry => {
      if (entry.hours > 0) {
        // Update mapping - keep as string/number as provided
        this.mappings[entry.id].clientId = clientId;
        
        // Update project dropdown
        const projectSelect = document.getElementById(`project_${entry.id}`);
        projectSelect.innerHTML = '<option value="">-- Select Project --</option>';
        
        if (client.projects.length > 0) {
          // Sort and add projects
          const sortedProjects = [...client.projects].sort((a, b) => a.name.localeCompare(b.name));
          sortedProjects.forEach(project => {
            projectSelect.innerHTML += `<option value="${project.id}">${project.name}</option>`;
          });
          
          // Set default project
          if (defaultProject) {
            projectSelect.value = defaultProject.id;
            this.mappings[entry.id].projectId = defaultProject.id;
          }
        }
      }
    });
  },
  
  updateProjectSelection(entryId) {
    const projectId = document.getElementById(`project_${entryId}`).value;
    this.mappings[entryId].projectId = projectId;
  },

  toggleSelectAll() {
    const selectAll = document.getElementById('selectAll').checked || 
                     document.getElementById('headerCheckbox').checked;
    
    // Sync both checkboxes
    document.getElementById('selectAll').checked = selectAll;
    document.getElementById('headerCheckbox').checked = selectAll;
    
    // Update all entry checkboxes
    this.analysisResult.entries.forEach(entry => {
      if (entry.hours > 0) {
        document.getElementById(`select_${entry.id}`).checked = selectAll;
        this.mappings[entry.id].selected = selectAll;
      }
    });
  },

  updateSelection(entryId) {
    const checked = document.getElementById(`select_${entryId}`).checked;
    this.mappings[entryId].selected = checked;
  },

  async importData() {
    // Filter selected entries with valid mappings
    const entriesToImport = this.analysisResult.entries.filter(entry => 
      this.mappings[entry.id].selected && 
      this.mappings[entry.id].clientId && 
      this.mappings[entry.id].projectId
    );
    
    if (entriesToImport.length === 0) {
      this.showError('Please select entries and map them to clients and projects');
      return;
    }
    
    // Disable import button
    const importBtn = event.target;
    importBtn.disabled = true;
    importBtn.textContent = 'Importing...';
    
    try {
      const response = await API.post('/import/import', {
        entries: entriesToImport,
        mappings: this.mappings
      });
      
      // Show results
      document.getElementById('resultsSection').style.display = 'block';
      this.displayImportResults(response);
      
      // Hide mapping section
      document.getElementById('analysisSection').style.display = 'none';
    } catch (error) {
      console.error('Import error:', error);
      this.showError('Import failed: ' + error.message);
      
      // Re-enable button
      importBtn.disabled = false;
      importBtn.textContent = 'Import Selected Entries';
    }
  },

  displayImportResults(response) {
    const { results, message } = response;
    
    const html = `
      <div class="import-success">
        <h3>✓ ${message}</h3>
        
        <div class="import-stats">
          <div class="stat-group">
            <h4>Time Entries</h4>
            <p>Imported: ${results.entries.imported}</p>
            <p>Skipped: ${results.entries.skipped}</p>
            <p>Errors: ${results.entries.errors}</p>
          </div>
          
          <div class="stat-group">
            <h4>Invoices</h4>
            <p>Created: ${results.invoices.created}</p>
            <p>Existing: ${results.invoices.existing}</p>
          </div>
        </div>
        
        <button class="btn btn-primary" onclick="window.location.hash = '#/time-entries'">
          View Time Entries
        </button>
      </div>
    `;
    
    document.getElementById('importResults').innerHTML = html;
  },

  showError(message) {
    alert(message);
  }
};

window.ImportPage = ImportPage;
class Navbar {
    static render() {
        const user = Auth.getUser();
        if (!user) return '';

        const isAdmin = Auth.isAdmin();
        const isConsultant = user.userTypeId === 2;

        return `
            <nav class="navbar">
                <div class="container">
                    <div class="navbar-content">
                        <a href="#/dashboard" class="navbar-brand">
                            <span style="background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">42</span> Consulting
                        </a>
                        
                        <ul class="navbar-nav">
                            <li><a href="#/dashboard" class="nav-link" onclick="console.log('Dashboard clicked')">Dashboard</a></li>
                            <li><a href="#/time-entries" class="nav-link" onclick="console.log('Time Entries clicked')">Time Entries</a></li>
                            ${isAdmin ? `
                                <li><a href="#/projects" class="nav-link" onclick="console.log('Projects clicked')">Projects</a></li>
                                <li><a href="#/clients" class="nav-link" onclick="console.log('Clients clicked')">Clients</a></li>
                                <li><a href="#/users" class="nav-link" onclick="console.log('Users clicked')">Users</a></li>
                                <li><a href="#/subcontractors" class="nav-link" onclick="console.log('Subcontractors clicked')">Subcontractors</a></li>
                                <li><a href="#/import" class="nav-link" onclick="console.log('Import clicked')">Import</a></li>
                                <li><a href="#/invoices" class="nav-link" onclick="console.log('Invoices clicked')">Invoices</a></li>
                            ` : ''}
                            <li><a href="#/analytics" class="nav-link" onclick="console.log('Analytics clicked')">Analytics</a></li>
                        </ul>
                        
                        <div class="navbar-user">
                            <div class="user-badge" style="background: linear-gradient(135deg, #475569 0%, #64748b 100%); box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                                ${user.firstName.charAt(0)}${user.lastName.charAt(0)}
                            </div>
                            <span style="color: white; font-weight: 500; font-size: 0.8rem;">${user.firstName} ${user.lastName}</span>
                            <button onclick="Auth.logout()" class="btn btn-sm btn-outline" style="color: white; border-color: rgba(255, 255, 255, 0.3); background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); padding: 0.375rem 0.75rem; font-size: 0.75rem;">Logout</button>
                        </div>
                    </div>
                </div>
            </nav>
            
            <!-- Mobile Bottom Navigation -->
            <nav class="bottom-nav">
                <a href="#/dashboard" class="bottom-nav-item" data-page="dashboard">
                    <svg class="bottom-nav-icon" fill="currentColor" viewBox="0 0 20 20" style="width: 20px; height: 20px; max-width: 20px; max-height: 20px;">
                        <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
                    </svg>
                    <span>Dashboard</span>
                </a>
                <a href="#/time-entries" class="bottom-nav-item" data-page="time-entries">
                    <svg class="bottom-nav-icon" fill="currentColor" viewBox="0 0 20 20" style="width: 20px; height: 20px; max-width: 20px; max-height: 20px;">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"/>
                    </svg>
                    <span>Time</span>
                </a>
                ${isAdmin ? `
                    <a href="#/projects" class="bottom-nav-item" data-page="projects">
                        <svg class="bottom-nav-icon" fill="currentColor" viewBox="0 0 20 20" style="width: 20px; height: 20px; max-width: 20px; max-height: 20px;">
                            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                            <path fill-rule="evenodd" d="M4 5a2 2 0 012-2v1a2 2 0 002 2h2a2 2 0 002-2V3a2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
                        </svg>
                        <span>Projects</span>
                    </a>
                    <a href="#/clients" class="bottom-nav-item" data-page="clients">
                        <svg class="bottom-nav-icon" fill="currentColor" viewBox="0 0 20 20" style="width: 20px; height: 20px; max-width: 20px; max-height: 20px;">
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
                        </svg>
                        <span>Clients</span>
                    </a>
                ` : ''}
                <a href="#/analytics" class="bottom-nav-item" data-page="analytics">
                    <svg class="bottom-nav-icon" fill="currentColor" viewBox="0 0 20 20" style="width: 20px; height: 20px; max-width: 20px; max-height: 20px;">
                        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
                    </svg>
                    <span>Analytics</span>
                </a>
            </nav>
        `;
    }

    static updateActiveLink() {
        const currentPath = window.location.hash.slice(1);
        
        // Update top navbar links
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.getAttribute('href').slice(1) === currentPath) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
        
        // Update bottom nav links
        document.querySelectorAll('.bottom-nav-item').forEach(link => {
            const href = link.getAttribute('href').slice(1);
            if (href === currentPath) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    static toggleMenu() {
        const collapse = document.getElementById('navbar-collapse');
        const toggle = document.querySelector('.navbar-toggle');
        
        if (collapse.classList.contains('show')) {
            collapse.classList.remove('show');
            toggle.classList.remove('active');
        } else {
            collapse.classList.add('show');
            toggle.classList.add('active');
        }
    }

    static closeMenu() {
        const collapse = document.getElementById('navbar-collapse');
        const toggle = document.querySelector('.navbar-toggle');
        
        collapse.classList.remove('show');
        toggle.classList.remove('active');
    }
}

// Make Navbar available globally for onclick handlers
window.Navbar = Navbar;
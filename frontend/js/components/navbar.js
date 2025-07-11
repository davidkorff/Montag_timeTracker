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
                        <a href="#/dashboard" class="navbar-brand">42 Consulting</a>
                        
                        <button class="navbar-toggle" onclick="Navbar.toggleMenu()">
                            <span class="navbar-toggle-icon"></span>
                            <span class="navbar-toggle-icon"></span>
                            <span class="navbar-toggle-icon"></span>
                        </button>
                        
                        <div class="navbar-collapse" id="navbar-collapse">
                            <ul class="navbar-menu">
                                <li><a href="#/dashboard" class="nav-link" onclick="Navbar.closeMenu()">Dashboard</a></li>
                                <li><a href="#/time-entries" class="nav-link" onclick="Navbar.closeMenu()">Time Entries</a></li>
                                ${isAdmin ? `
                                    <li><a href="#/projects" class="nav-link" onclick="Navbar.closeMenu()">Projects</a></li>
                                    <li><a href="#/clients" class="nav-link" onclick="Navbar.closeMenu()">Clients</a></li>
                                    <li><a href="#/users" class="nav-link" onclick="Navbar.closeMenu()">Users</a></li>
                                    <li><a href="#/subcontractors" class="nav-link" onclick="Navbar.closeMenu()">Subcontractors</a></li>
                                    <li><a href="#/import" class="nav-link" onclick="Navbar.closeMenu()">Import</a></li>
                                    <li><a href="#/invoices" class="nav-link" onclick="Navbar.closeMenu()">Invoices</a></li>
                                    <li><a href="#/reports" class="nav-link" onclick="Navbar.closeMenu()">Reports</a></li>
                                ` : ''}
                                <li><a href="#/analytics" class="nav-link" onclick="Navbar.closeMenu()">Analytics</a></li>
                            </ul>
                            
                            <div class="navbar-user">
                                <span class="navbar-user-name" data-initials="${user.firstName.charAt(0)}${user.lastName.charAt(0)}">${user.firstName} ${user.lastName}</span>
                                <button onclick="Auth.logout()" class="btn btn-outline btn-sm">Logout</button>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
        `;
    }

    static updateActiveLink() {
        const currentPath = window.location.hash.slice(1);
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.getAttribute('href').slice(1) === currentPath) {
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
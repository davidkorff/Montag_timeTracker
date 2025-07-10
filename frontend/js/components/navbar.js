class Navbar {
    static render() {
        const user = Auth.getUser();
        if (!user) return '';

        const isAdmin = Auth.isAdmin();

        return `
            <nav class="navbar">
                <div class="container">
                    <div class="navbar-content">
                        <a href="#/dashboard" class="navbar-brand">42 Consulting</a>
                        
                        <ul class="navbar-menu">
                            <li><a href="#/dashboard" class="nav-link">Dashboard</a></li>
                            <li><a href="#/time-entries" class="nav-link">Time Entries</a></li>
                            <li><a href="#/projects" class="nav-link">Projects</a></li>
                            ${isAdmin ? `
                                <li><a href="#/clients" class="nav-link">Clients</a></li>
                                <li><a href="#/users" class="nav-link">Users</a></li>
                                <li><a href="#/subcontractors" class="nav-link">Subcontractors</a></li>
                                <li><a href="#/import" class="nav-link">Import</a></li>
                            ` : ''}
                            <li><a href="#/invoices" class="nav-link">Invoices</a></li>
                            <li><a href="#/reports" class="nav-link">Reports</a></li>
                            <li><a href="#/analytics" class="nav-link">Analytics</a></li>
                        </ul>
                        
                        <div class="navbar-user">
                            <span>${user.firstName} ${user.lastName}</span>
                            <button onclick="Auth.logout()" class="btn btn-outline btn-sm">Logout</button>
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
}
(async function() {
    console.log('App initializing...');
    router.addRoute('/login', LoginPage.render);
    router.addRoute('/signup', SignupPage.render);
    console.log('Signup route added');
    router.addRoute('/dashboard', DashboardPage.render, () => authGuard());
    router.addRoute('/time-entries', TimeEntriesPage.render, () => authGuard());
    router.addRoute('/projects', ProjectsPage.render, () => authGuard('admin'));
    router.addRoute('/clients', ClientsPage.render, () => authGuard('admin'));
    router.addRoute('/users', UsersPage.render, () => authGuard('admin'));
    router.addRoute('/subcontractors', SubcontractorsPage.render, () => authGuard('admin'));
    router.addRoute('/invoices', InvoicesPage.render, () => authGuard('admin'));
    router.addRoute('/reports', ReportsPage.render, () => authGuard('admin'));
    router.addRoute('/analytics', AnalyticsPage.render, () => authGuard());
    router.addRoute('/analytics-debug', AnalyticsDebugPage.render, () => authGuard('admin'));
    router.addRoute('/import', () => ImportPage.init(), () => authGuard('admin'));
    
    router.addRoute('/', () => {
        if (Auth.isAuthenticated()) {
            router.navigate('/dashboard');
        } else {
            router.navigate('/login');
        }
    });
    
    router.addRoute('/404', () => {
        document.getElementById('app').innerHTML = `
            <div class="container" style="text-align: center; margin-top: 100px;">
                <h1>404 - Page Not Found</h1>
                <p>The page you're looking for doesn't exist.</p>
                <a href="#/dashboard" class="btn btn-primary">Go to Dashboard</a>
            </div>
        `;
    });

    document.getElementById('loading').style.display = 'none';

    if (Auth.isAuthenticated()) {
        window.timer = timer;
        await timer.init();
    }
})();
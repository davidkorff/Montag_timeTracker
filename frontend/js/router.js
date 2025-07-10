class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
        window.addEventListener('hashchange', () => this.handleRoute());
        window.addEventListener('load', () => this.handleRoute());
    }

    addRoute(path, handler, guard = null) {
        this.routes[path] = { handler, guard };
    }

    async handleRoute() {
        try {
            const hash = window.location.hash || '#/';
            const path = hash.slice(1);
            
            const route = this.routes[path] || this.routes['/404'];
            
            if (!route) {
                console.error(`No route found for path: ${path}`);
                // Try to navigate to dashboard or login
                if (Auth.isAuthenticated()) {
                    this.navigate('/dashboard');
                } else {
                    this.navigate('/login');
                }
                return;
            }
            
            if (route.guard && !route.guard()) {
                return;
            }

            this.currentRoute = path;
            await route.handler();
        } catch (error) {
            console.error('Router error:', error);
            // Show a user-friendly error message
            const app = document.getElementById('app');
            if (app) {
                app.innerHTML = `
                    <div class="container" style="margin-top: 50px;">
                        <div class="error-message">
                            <h2>Oops! Something went wrong</h2>
                            <p>We encountered an error while loading this page.</p>
                            <button class="btn btn-primary" onclick="window.location.reload()">Reload Page</button>
                            <button class="btn btn-secondary" onclick="router.navigate('/dashboard')">Go to Dashboard</button>
                        </div>
                    </div>
                `;
            }
        }
    }

    navigate(path) {
        window.location.hash = path;
    }
}

const router = new Router();
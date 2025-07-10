const LoginPage = {
    render: async () => {
        if (redirectIfAuthenticated()) return;

        document.getElementById('app').innerHTML = `
            <div class="container" style="max-width: 400px; margin-top: 100px;">
                <div class="card">
                    <h1 class="card-title" style="text-align: center; margin-bottom: 2rem;">42 Consulting</h1>
                    
                    <form id="login-form">
                        <div class="form-group">
                            <label class="form-label">Email</label>
                            <input type="email" id="email" class="form-control" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Password</label>
                            <input type="password" id="password" class="form-control" required>
                        </div>
                        
                        <div id="error-message" class="alert alert-error" style="display: none;"></div>
                        
                        <button type="submit" class="btn btn-primary" style="width: 100%;">Login</button>
                        
                        <div style="text-align: center; margin-top: 1rem;">
                            Don't have an account? <a href="#/signup">Sign Up</a>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.getElementById('login-form').addEventListener('submit', LoginPage.handleLogin);
    },

    handleLogin: async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('error-message');
        
        try {
            await Auth.login(email, password);
            router.navigate('/dashboard');
        } catch (error) {
            errorDiv.style.display = 'block';
            errorDiv.textContent = error.message || 'Invalid credentials';
        }
    }
};
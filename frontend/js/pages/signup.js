const SignupPage = {
    render: async () => {
        if (redirectIfAuthenticated()) return;

        document.getElementById('app').innerHTML = `
            <div class="container" style="max-width: 400px; margin-top: 100px;">
                <div class="card">
                    <h1 class="card-title" style="text-align: center; margin-bottom: 2rem;">Create Account</h1>
                    
                    <form id="signup-form">
                        <div class="form-group">
                            <label class="form-label">First Name</label>
                            <input type="text" id="firstName" class="form-control" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Last Name</label>
                            <input type="text" id="lastName" class="form-control" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Email</label>
                            <input type="email" id="email" class="form-control" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Password</label>
                            <input type="password" id="password" class="form-control" required minlength="6">
                            <small style="color: var(--text-secondary)">Minimum 6 characters</small>
                        </div>
                        
                        <div id="error-message" class="alert alert-error" style="display: none;"></div>
                        <div id="success-message" class="alert alert-success" style="display: none;"></div>
                        
                        <button type="submit" class="btn btn-primary" style="width: 100%;">Sign Up</button>
                        
                        <div style="text-align: center; margin-top: 1rem;">
                            Already have an account? <a href="#/login">Login</a>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.getElementById('signup-form').addEventListener('submit', SignupPage.handleSignup);
    },

    handleSignup: async (e) => {
        e.preventDefault();
        
        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('error-message');
        const successDiv = document.getElementById('success-message');
        
        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';
        
        try {
            const response = await API.post('/auth/signup', {
                firstName,
                lastName,
                email,
                password
            });
            
            localStorage.setItem(CONFIG.TOKEN_KEY, response.token);
            localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(response.user));
            
            successDiv.style.display = 'block';
            successDiv.textContent = 'Account created successfully! Redirecting...';
            
            setTimeout(() => {
                router.navigate('/dashboard');
            }, 1500);
        } catch (error) {
            errorDiv.style.display = 'block';
            if (error.message.includes('errors')) {
                errorDiv.textContent = 'Please check all fields are filled correctly';
            } else {
                errorDiv.textContent = error.message || 'Failed to create account';
            }
        }
    }
};
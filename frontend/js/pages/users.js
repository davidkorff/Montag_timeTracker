const UsersPage = {
    render: async () => {
        document.getElementById('app').innerHTML = `
            ${Navbar.render()}
            <div class="container" style="margin-top: 2rem;">
                <h1>Users</h1>
                <div class="card" style="margin-top: 1rem;">
                    <p>Users page coming soon...</p>
                </div>
            </div>
            <div id="timer-container"></div>
        `;
        Navbar.updateActiveLink();
        timer.render();
    }
};
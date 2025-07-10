const ReportsPage = {
    render: async () => {
        document.getElementById('app').innerHTML = `
            ${Navbar.render()}
            <div class="container" style="margin-top: 2rem;">
                <h1>Reports</h1>
                <div class="card" style="margin-top: 1rem;">
                    <p>Reports page coming soon...</p>
                </div>
            </div>
            <div id="timer-container"></div>
        `;
        Navbar.updateActiveLink();
        timer.render();
    }
};
const authGuard = (requiredRole = null) => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '#/login';
        return false;
    }

    if (requiredRole === 'admin' && !Auth.isAdmin()) {
        window.location.href = '#/dashboard';
        return false;
    }

    return true;
};

const redirectIfAuthenticated = () => {
    if (Auth.isAuthenticated()) {
        window.location.href = '#/dashboard';
        return true;
    }
    return false;
};
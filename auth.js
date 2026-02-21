// Authentication helper functions

// Check if user is logged in and has the correct role
function checkAuth(requiredRole) {
    const currentRole = localStorage.getItem('role');
    
    if (!currentRole) {
        // Not logged in, redirect to login
        window.location.href = 'login.html';
        return false;
    }
    
    if (currentRole !== requiredRole) {
        // Wrong role, redirect to login
        alert('You do not have permission to access this page.');
        window.location.href = 'login.html';
        return false;
    }
    
    return true;
}

// Logout function
function logout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace('login.html');
}

// Add logout button to header if user is logged in
function addLogoutButton() {
    const role = localStorage.getItem('role');
    if (role) {
        const header = document.querySelector('header');
        if (header) {
            const logoutBtn = document.createElement('button');
            logoutBtn.textContent = 'Logout';
            logoutBtn.className = 'logout-btn';
            
            // Use addEventListener for better mobile compatibility
            logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                logout();
            });
            
            // Add touch event support for mobile
            logoutBtn.addEventListener('touchend', function(e) {
                e.preventDefault();
                e.stopPropagation();
                logout();
            });
            
            header.appendChild(logoutBtn);
        }
    }
}

// Login credentials
const credentials = {
    teacher: 'teacher123',
    admin: 'admin123'
};

// Handle login form submission
document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const role = document.getElementById('role').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');
    
    // Clear previous error message
    errorMessage.textContent = '';
    
    // Validate credentials
    if (credentials[role] && credentials[role] === password) {
        // Store role in localStorage
        localStorage.setItem('role', role);
        
        // Redirect based on role
        if (role === 'teacher') {
            window.location.href = 'teacher.html';
        } else if (role === 'admin') {
            window.location.href = 'admin.html';
        }
    } else {
        // Show error message
        errorMessage.textContent = 'Invalid credentials. Please try again.';
        errorMessage.style.display = 'block';
    }
});

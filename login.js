// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDjKHoi4kL-HEj2Fqes8j-ZWQOAcBTvLq4",
    authDomain: "ziel-d0064.firebaseapp.com",
    projectId: "ziel-d0064",
    storageBucket: "ziel-d0064.firebasestorage.app",
    messagingSenderId: "688074633326",
    appId: "1:688074633326:web:ac09c3a8dd0a61d8bc4b0f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Admin credentials (hardcoded for admin)
const adminCredentials = {
    password: 'admin123'
};

// Toggle login fields based on role selection
window.toggleLoginFields = function() {
    const role = document.getElementById('role').value;
    const teacherNameField = document.getElementById('teacher-name-field');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const teacherNameInput = document.getElementById('teacherName');
    
    if (role === 'teacher') {
        teacherNameField.style.display = 'block';
        forgotPasswordLink.style.display = 'block';
        teacherNameInput.required = true;
    } else {
        teacherNameField.style.display = 'none';
        forgotPasswordLink.style.display = 'none';
        teacherNameInput.required = false;
        teacherNameInput.value = '';
    }
};

// Show forgot password message
window.showForgotPasswordMessage = function(event) {
    event.preventDefault();
    alert('Please contact your admin to get this resolved.');
};

// Handle login form submission
document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const role = document.getElementById('role').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');
    
    // Clear previous error message
    errorMessage.textContent = '';
    errorMessage.style.display = 'none';
    
    if (role === 'admin') {
        // Admin login with hardcoded credentials
        if (password === adminCredentials.password) {
            localStorage.setItem('role', 'admin');
            localStorage.setItem('adminName', 'Administrator');
            window.location.href = 'public/admin.html';
        } else {
            errorMessage.textContent = 'Invalid admin password.';
            errorMessage.style.display = 'block';
        }
    } else if (role === 'teacher') {
        // Teacher login with Firestore authentication
        const teacherName = document.getElementById('teacherName').value.trim();
        
        if (!teacherName) {
            errorMessage.textContent = 'Please enter your teacher name.';
            errorMessage.style.display = 'block';
            return;
        }
        
        try {
            // Query Firestore for teacher with exact case-sensitive name match
            const teachersQuery = query(
                collection(db, "teachers"),
                where("name", "==", teacherName),
                where("status", "==", "active")
            );
            
            const querySnapshot = await getDocs(teachersQuery);
            
            if (querySnapshot.empty) {
                errorMessage.textContent = 'Teacher not found or inactive. Name is case-sensitive.';
                errorMessage.style.display = 'block';
                return;
            }
            
            // Get the teacher document
            const teacherDoc = querySnapshot.docs[0];
            const teacherData = teacherDoc.data();
            
            // Verify password (case-sensitive)
            if (teacherData.password === password) {
                // Successful login
                localStorage.setItem('role', 'teacher');
                localStorage.setItem('teacherName', teacherData.name);
                localStorage.setItem('teacherId', teacherDoc.id);
                localStorage.setItem('teacherEmploymentType', teacherData.employmentType || 'fulltime');
                window.location.href = 'public/teacher.html';
            } else {
                errorMessage.textContent = 'Invalid password.';
                errorMessage.style.display = 'block';
            }
        } catch (error) {
            console.error('Login error:', error);
            errorMessage.textContent = 'An error occurred during login. Please try again.';
            errorMessage.style.display = 'block';
        }
    } else {
        errorMessage.textContent = 'Please select a role.';
        errorMessage.style.display = 'block';
    }
});

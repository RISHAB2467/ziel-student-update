// Admin Dashboard JavaScript

// Initialize on page load
window.onload = function() {
    if (localStorage.getItem("role") === "admin") {
        loadTeacherList();
        loadStudentList();
    }
};

// Add Teacher
function addTeacher() {
    const input = document.getElementById("newTeacher");
    const name = input.value.trim();
    
    if (!name) {
        alert("Please enter a teacher name");
        return;
    }
    
    let teachers = JSON.parse(localStorage.getItem("teachers") || "[]");
    
    if (teachers.includes(name)) {
        alert("Teacher already exists!");
        return;
    }
    
    teachers.push(name);
    localStorage.setItem("teachers", JSON.stringify(teachers));
    
    input.value = "";
    loadTeacherList();
    alert("Teacher added successfully!");
}

// Remove Teacher
function removeTeacher(name) {
    if (!confirm(`Remove teacher "${name}"?`)) return;
    
    let teachers = JSON.parse(localStorage.getItem("teachers") || "[]");
    teachers = teachers.filter(t => t !== name);
    localStorage.setItem("teachers", JSON.stringify(teachers));
    
    loadTeacherList();
    alert("Teacher removed!");
}

// Load Teacher List
function loadTeacherList() {
    let teachers = JSON.parse(localStorage.getItem("teachers") || "[]");
    const list = document.getElementById("teacherList");
    
    if (!list) return;
    
    list.innerHTML = "";
    
    if (teachers.length === 0) {
        list.innerHTML = "<li>No teachers added yet</li>";
        return;
    }
    
    teachers.forEach(t => {
        const li = document.createElement("li");
        li.innerHTML = `
            ${t} 
            <button onclick="removeTeacher('${t}')">Remove</button>
        `;
        list.appendChild(li);
    });
}

// Add Student
function addStudent() {
    const input = document.getElementById("newStudent");
    const name = input.value.trim();
    
    if (!name) {
        alert("Please enter a student name");
        return;
    }
    
    let students = JSON.parse(localStorage.getItem("students") || "[]");
    
    if (students.includes(name)) {
        alert("Student already exists!");
        return;
    }
    
    students.push(name);
    localStorage.setItem("students", JSON.stringify(students));
    
    input.value = "";
    loadStudentList();
    alert("Student added successfully!");
}

// Remove Student
function removeStudent(name) {
    if (!confirm(`Remove student "${name}"?`)) return;
    
    let students = JSON.parse(localStorage.getItem("students") || "[]");
    students = students.filter(s => s !== name);
    localStorage.setItem("students", JSON.stringify(students));
    
    loadStudentList();
    alert("Student removed!");
}

// Load Student List
function loadStudentList() {
    let students = JSON.parse(localStorage.getItem("students") || "[]");
    const list = document.getElementById("studentList");
    
    if (!list) return;
    
    list.innerHTML = "";
    
    if (students.length === 0) {
        list.innerHTML = "<li>No students added yet</li>";
        return;
    }
    
    students.forEach(s => {
        const li = document.createElement("li");
        li.innerHTML = `
            ${s} 
            <button onclick="removeStudent('${s}')">Remove</button>
        `;
        list.appendChild(li);
    });
}

// Search by Student
function searchByStudent() {
    const searchInput = document.getElementById("searchStudent");
    const studentName = searchInput.value.trim();
    
    if (!studentName) {
        alert("Please enter a student name");
        return;
    }
    
    let entries = JSON.parse(localStorage.getItem("entries") || "[]");
    
    // Filter entries for this student (case-insensitive)
    const studentEntries = entries.filter(e => 
        e.student.toLowerCase() === studentName.toLowerCase()
    );
    
    const resultsDiv = document.getElementById("searchResults");
    resultsDiv.innerHTML = "";
    
    if (studentEntries.length === 0) {
        resultsDiv.innerHTML = `<p>No classes found for "${studentName}"</p>`;
        return;
    }
    
    // Calculate statistics
    const totalClasses = studentEntries.length;
    const totalMinutes = studentEntries.reduce((sum, e) => sum + parseInt(e.duration), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);
    
    const uniqueTeachers = [...new Set(studentEntries.map(e => e.teacher))];
    const uniqueTopics = [...new Set(studentEntries.map(e => e.topic))];
    
    // Display results
    resultsDiv.innerHTML = `
        <h4>Results for: ${studentName}</h4>
        <p><strong>Total Classes:</strong> ${totalClasses}</p>
        <p><strong>Total Hours:</strong> ${totalHours}</p>
        <p><strong>Teachers:</strong> ${uniqueTeachers.join(", ")}</p>
        <p><strong>Topics:</strong> ${uniqueTopics.join(", ")}</p>
        <hr>
        <h4>Class Details:</h4>
    `;
    
    // Display each class
    studentEntries
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .forEach(e => {
            resultsDiv.innerHTML += `
                <div class="class-entry">
                    <p><strong>${e.date}</strong> at ${e.time} - Teacher: <strong>${e.teacher}</strong></p>
                    <p>Topic: ${e.topic} (${e.duration} minutes)</p>
                </div>
            `;
        });
}

// Load Full Dashboard
function loadFullDashboard() {
    let entries = JSON.parse(localStorage.getItem("entries") || "[]");
    const dashboardDiv = document.getElementById("fullDashboard");
    
    dashboardDiv.innerHTML = "";
    
    if (entries.length === 0) {
        dashboardDiv.innerHTML = "<p>No classes recorded yet</p>";
        return;
    }
    
    // Calculate overall statistics
    const totalClasses = entries.length;
    const totalMinutes = entries.reduce((sum, e) => sum + parseInt(e.duration), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);
    
    const uniqueTeachers = [...new Set(entries.map(e => e.teacher))];
    const uniqueStudents = [...new Set(entries.map(e => e.student))];
    const uniqueTopics = [...new Set(entries.map(e => e.topic))];
    
    // Display statistics
    dashboardDiv.innerHTML = `
        <h4>Overall Statistics</h4>
        <p><strong>Total Classes:</strong> ${totalClasses}</p>
        <p><strong>Total Teaching Hours:</strong> ${totalHours}</p>
        <p><strong>Number of Teachers:</strong> ${uniqueTeachers.length}</p>
        <p><strong>Number of Students:</strong> ${uniqueStudents.length}</p>
        <p><strong>Topics Covered:</strong> ${uniqueTopics.length}</p>
        <hr>
        <p><strong>All Teachers:</strong> ${uniqueTeachers.join(", ")}</p>
        <p><strong>All Topics:</strong> ${uniqueTopics.join(", ")}</p>
        <hr>
        <h4>All Classes (Most Recent First):</h4>
    `;
    
    // Display all classes
    entries
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .forEach(e => {
            dashboardDiv.innerHTML += `
                <div class="class-entry">
                    <p><strong>${e.date}</strong> at ${e.time}</p>
                    <p>Teacher: <strong>${e.teacher}</strong> | Student: <strong>${e.student}</strong></p>
                    <p>Topic: ${e.topic} (${e.duration} minutes)</p>
                </div>
            `;
        });
}

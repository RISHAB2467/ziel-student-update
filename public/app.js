// Login function
function login() {
    const pwd = document.getElementById("password").value;

    if (pwd === "teacher123") {
        localStorage.setItem("role", "teacher");
        window.location.href = "teacher.html";
    } 
    else if (pwd === "admin123") {
        localStorage.setItem("role", "admin");
        window.location.href = "admin.html";
    }
    else {
        alert("Incorrect Password!");
    }
}

// Load teacher and student lists
function loadLists() {
    let teachersData = JSON.parse(localStorage.getItem("teachersData") || "[]");
    let studentsData = JSON.parse(localStorage.getItem("studentsData") || "[]");

    // Filter only active teachers and students
    let teachers = teachersData.filter(t => t.active).map(t => t.name);
    let students = studentsData.filter(s => s.active).map(s => s.name);

    // Initialize default data if empty
    if (teachersData.length === 0) {
        teachersData = [
            { name: "Prof. Anderson", email: "anderson@ziel.edu", active: true },
            { name: "Dr. Williams", email: "williams@ziel.edu", active: true },
            { name: "Dr. Brown", email: "brown@ziel.edu", active: true },
            { name: "Ms. Johnson", email: "johnson@ziel.edu", active: true },
            { name: "Mr. Davis", email: "davis@ziel.edu", active: true }
        ];
        localStorage.setItem("teachersData", JSON.stringify(teachersData));
        teachers = teachersData.map(t => t.name);
    }

    if (studentsData.length === 0) {
        studentsData = [
            { name: "John Doe", active: true },
            { name: "Jane Smith", active: true },
            { name: "Mike Johnson", active: true },
            { name: "Emily Davis", active: true },
            { name: "Sarah Wilson", active: true },
            { name: "David Brown", active: true },
            { name: "Lisa Anderson", active: true },
            { name: "Tom Martinez", active: true },
            { name: "Anna Taylor", active: true },
            { name: "Chris Lee", active: true }
        ];
        localStorage.setItem("studentsData", JSON.stringify(studentsData));
        students = studentsData.map(s => s.name);
    }

    let teacherDropdown = document.getElementById("teacherName");
    let studentDropdown = document.getElementById("studentName");

    if (teacherDropdown) {
        teacherDropdown.innerHTML = "";
        teachers.forEach(t => {
            let opt = document.createElement("option");
            opt.value = t;
            opt.innerText = t;
            teacherDropdown.appendChild(opt);
        });
    }

    if (studentDropdown) {
        studentDropdown.innerHTML = "";
        students.forEach(s => {
            let opt = document.createElement("option");
            opt.value = s;
            opt.innerText = s;
            studentDropdown.appendChild(opt);
        });
    }

    // Setup student search filter
    setupStudentSearch();
}

// Setup searchable student dropdown
function setupStudentSearch() {
    const searchInput = document.getElementById("studentSearch");
    const studentDropdown = document.getElementById("studentName");
    
    if (!searchInput || !studentDropdown) return;

    searchInput.addEventListener("input", function() {
        const searchTerm = this.value.toLowerCase();
        const options = studentDropdown.options;
        
        for (let i = 0; i < options.length; i++) {
            const optionText = options[i].text.toLowerCase();
            if (optionText.includes(searchTerm)) {
                options[i].style.display = "";
            } else {
                options[i].style.display = "none";
            }
        }
    });

    // When student is selected, update search box
    studentDropdown.addEventListener("change", function() {
        searchInput.value = this.options[this.selectedIndex].text;
    });
}

// Save entry to localStorage
function saveEntry() {
    let entries = JSON.parse(localStorage.getItem("entries") || "[]");

    let entry = {
        teacher: document.getElementById("teacherName").value,
        student: document.getElementById("studentName").value,
        date: document.getElementById("date").value,
        time: document.getElementById("time").value,
        duration: parseInt(document.getElementById("duration").value),
        topic: document.getElementById("topic").value,
        createdAt: Date.now()
    };

    // Validate fields
    if (!entry.teacher || !entry.student || !entry.date || !entry.time || !entry.duration || !entry.topic) {
        alert("Please fill all fields!");
        return;
    }

    entries.push(entry);
    localStorage.setItem("entries", JSON.stringify(entries));

    alert("Class Saved!");
    
    // Clear form
    document.getElementById("classForm").reset();
    
    loadRecentEntries();
}

// Load recent entries (24 hours only)
function loadRecentEntries() {
    let entries = JSON.parse(localStorage.getItem("entries") || "[]");
    let teacherName = document.getElementById("teacherName").value;

    let div = document.getElementById("recentEntries");
    if (!div) return;

    div.innerHTML = "";

    const recentEntries = entries
        .filter(e => e.teacher === teacherName)
        .filter(e => (Date.now() - e.createdAt) < 24*60*60*1000)
        .sort((a, b) => b.createdAt - a.createdAt);

    if (recentEntries.length === 0) {
        div.innerHTML = "<p>No recent entries in the last 24 hours.</p>";
        return;
    }

    recentEntries.forEach((e, index) => {
        const entryIndex = entries.findIndex(entry => 
            entry.teacher === e.teacher && 
            entry.createdAt === e.createdAt
        );
        
        div.innerHTML += `
            <div class="entry-item">
                <p><strong>${e.date}</strong> at ${e.time} - <strong>${e.student}</strong></p>
                <p>Topic: ${e.topic} (${e.duration} mins)</p>
                <button onclick="editEntry(${entryIndex})">Edit</button>
                <button onclick="deleteEntry(${entryIndex})">Delete</button>
            </div>
        `;
    });
}

// Edit entry
function editEntry(index) {
    let entries = JSON.parse(localStorage.getItem("entries") || "[]");
    const entry = entries[index];

    if (!entry) return;

    // Check if within 24 hours
    if (Date.now() - entry.createdAt > 24*60*60*1000) {
        alert("Cannot edit entries older than 24 hours!");
        return;
    }

    // Populate form
    document.getElementById("teacherName").value = entry.teacher;
    document.getElementById("studentName").value = entry.student;
    document.getElementById("studentSearch").value = entry.student;
    document.getElementById("date").value = entry.date;
    document.getElementById("time").value = entry.time;
    document.getElementById("duration").value = entry.duration;
    document.getElementById("topic").value = entry.topic;

    // Delete old entry
    entries.splice(index, 1);
    localStorage.setItem("entries", JSON.stringify(entries));

    loadRecentEntries();
}

// Delete entry
function deleteEntry(index) {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    let entries = JSON.parse(localStorage.getItem("entries") || "[]");
    const entry = entries[index];

    // Check if within 24 hours
    if (Date.now() - entry.createdAt > 24*60*60*1000) {
        alert("Cannot delete entries older than 24 hours!");
        return;
    }

    entries.splice(index, 1);
    localStorage.setItem("entries", JSON.stringify(entries));

    alert("Entry deleted!");
    loadRecentEntries();
}

// ========== ADMIN FUNCTIONS ==========

// Global arrays to store full lists
let allTeachers = [];
let allStudents = [];

function initializeData() {
    // Initialize teachers with active status
    let teachers = JSON.parse(localStorage.getItem("teachersData") || "null");
    if (!teachers) {
        teachers = [
            { name: "Prof. Anderson", active: true },
            { name: "Dr. Williams", active: true },
            { name: "Dr. Brown", active: true },
            { name: "Ms. Johnson", active: true },
            { name: "Mr. Davis", active: true }
        ];
        localStorage.setItem("teachersData", JSON.stringify(teachers));
    }

    // Initialize students with active status
    let students = JSON.parse(localStorage.getItem("studentsData") || "null");
    if (!students) {
        students = [
            { name: "John Doe", active: true },
            { name: "Jane Smith", active: true },
            { name: "Mike Johnson", active: true },
            { name: "Emily Davis", active: true },
            { name: "Sarah Wilson", active: true },
            { name: "David Brown", active: true },
            { name: "Lisa Anderson", active: true },
            { name: "Tom Martinez", active: true },
            { name: "Anna Taylor", active: true },
            { name: "Chris Lee", active: true }
        ];
        localStorage.setItem("studentsData", JSON.stringify(students));
    }

    allTeachers = teachers;
    allStudents = students;
}

function addTeacher() {
    let name = document.getElementById("newTeacher").value.trim();
    let email = document.getElementById("newTeacherEmail").value.trim();
    
    if (!name) return alert("Enter teacher name");
    if (!email) return alert("Enter teacher email");
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return alert("Please enter a valid email address");
    }

    let teachers = JSON.parse(localStorage.getItem("teachersData") || "[]");
    
    // Check if teacher already exists
    if (teachers.some(t => t.name.toLowerCase() === name.toLowerCase())) {
        alert("Teacher already exists!");
        return;
    }
    
    // Check if email already exists
    if (teachers.some(t => t.email && t.email.toLowerCase() === email.toLowerCase())) {
        alert("This email is already registered!");
        return;
    }

    teachers.push({ name: name, email: email, active: true });
    localStorage.setItem("teachersData", JSON.stringify(teachers));

    document.getElementById("newTeacher").value = "";
    document.getElementById("newTeacherEmail").value = "";
    allTeachers = teachers;
    filterTeachers();
    alert(`Teacher ${name} added successfully!`);
}

function addStudent() {
    let name = document.getElementById("newStudent").value.trim();
    if (!name) return alert("Enter student name");

    let students = JSON.parse(localStorage.getItem("studentsData") || "[]");
    
    // Check if student already exists
    if (students.some(s => s.name.toLowerCase() === name.toLowerCase())) {
        alert("Student already exists!");
        return;
    }

    students.push({ name: name, active: true });
    localStorage.setItem("studentsData", JSON.stringify(students));

    document.getElementById("newStudent").value = "";
    allStudents = students;
    filterStudents();
}

function toggleTeacherStatus(index) {
    let teachers = JSON.parse(localStorage.getItem("teachersData") || "[]");
    const teacher = teachers[index];
    const action = teacher.active ? "deactivate" : "activate";
    
    if (!confirm(`Are you sure you want to ${action} ${teacher.name}?`)) return;
    
    teachers[index].active = !teachers[index].active;
    localStorage.setItem("teachersData", JSON.stringify(teachers));
    allTeachers = teachers;
    filterTeachers();
}

function toggleStudentStatus(index) {
    let students = JSON.parse(localStorage.getItem("studentsData") || "[]");
    const student = students[index];
    const action = student.active ? "deactivate" : "activate";
    
    if (!confirm(`Are you sure you want to ${action} ${student.name}?`)) return;
    
    students[index].active = !students[index].active;
    localStorage.setItem("studentsData", JSON.stringify(students));
    allStudents = students;
    filterStudents();
}

function deleteTeacher(index) {
    if (!confirm("Are you sure you want to permanently delete this teacher?")) return;
    
    let teachers = JSON.parse(localStorage.getItem("teachersData") || "[]");
    teachers.splice(index, 1);
    localStorage.setItem("teachersData", JSON.stringify(teachers));
    allTeachers = teachers;
    filterTeachers();
}

function deleteStudent(index) {
    if (!confirm("Are you sure you want to permanently delete this student?")) return;
    
    let students = JSON.parse(localStorage.getItem("studentsData") || "[]");
    students.splice(index, 1);
    localStorage.setItem("studentsData", JSON.stringify(students));
    allStudents = students;
    filterStudents();
}

function filterTeachers() {
    const searchTerm = document.getElementById("searchTeacher")?.value.toLowerCase() || "";
    const showInactive = document.getElementById("showInactiveTeachers")?.checked || false;
    
    let teachers = JSON.parse(localStorage.getItem("teachersData") || "[]");
    
    let filtered = teachers.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchTerm);
        const matchesStatus = showInactive || t.active;
        return matchesSearch && matchesStatus;
    });

    displayTeachers(filtered, teachers);
}

function filterStudents() {
    const searchTerm = document.getElementById("searchStudent")?.value.toLowerCase() || "";
    const showInactive = document.getElementById("showInactiveStudents")?.checked || false;
    
    let students = JSON.parse(localStorage.getItem("studentsData") || "[]");
    
    let filtered = students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm);
        const matchesStatus = showInactive || s.active;
        return matchesSearch && matchesStatus;
    });

    displayStudents(filtered, students);
}

function displayTeachers(filtered, allTeachers) {
    let tl = document.getElementById("teacherList");
    if (!tl) return;

    tl.innerHTML = "";

    if (filtered.length === 0) {
        tl.innerHTML = '<tr><td colspan="4" class="empty-state">No teachers found</td></tr>';
        return;
    }

    filtered.forEach((t) => {
        const index = allTeachers.findIndex(teacher => teacher.name === t.name);
        const statusClass = t.active ? "status-active" : "status-inactive";
        const statusText = t.active ? "Active" : "Inactive";
        const toggleBtnClass = t.active ? "deactivate" : "activate";
        const toggleBtnText = t.active ? "Deactivate" : "Activate";
        const email = t.email || "N/A";

        tl.innerHTML += `
            <tr>
                <td>${t.name}</td>
                <td>${email}</td>
                <td style="text-align: center;">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </td>
                <td style="text-align: center;">
                    <button class="toggle-btn ${toggleBtnClass}" onclick="toggleTeacherStatus(${index})">${toggleBtnText}</button>
                    <button class="delete-btn" onclick="deleteTeacher(${index})">Delete</button>
                </td>
            </tr>
        `;
    });
}

function displayStudents(filtered, allStudents) {
    let sl = document.getElementById("studentList");
    if (!sl) return;

    sl.innerHTML = "";

    if (filtered.length === 0) {
        sl.innerHTML = '<tr><td colspan="3" class="empty-state">No students found</td></tr>';
        return;
    }

    filtered.forEach((s) => {
        const index = allStudents.findIndex(student => student.name === s.name);
        const statusClass = s.active ? "status-active" : "status-inactive";
        const statusText = s.active ? "Active" : "Inactive";
        const toggleBtnClass = s.active ? "deactivate" : "activate";
        const toggleBtnText = s.active ? "Deactivate" : "Activate";

        sl.innerHTML += `
            <tr>
                <td>${s.name}</td>
                <td style="text-align: center;">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </td>
                <td style="text-align: center;">
                    <button class="toggle-btn ${toggleBtnClass}" onclick="toggleStudentStatus(${index})">${toggleBtnText}</button>
                    <button class="delete-btn" onclick="deleteStudent(${index})">Delete</button>
                </td>
            </tr>
        `;
    });
}

function loadAdminLists() {
    initializeData();
    filterTeachers();
    filterStudents();
}

function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName + '-tab').style.display = 'block';
    
    // Add active class to clicked button
    event.target.classList.add('active');
}

function loadStudentReport() {
    let search = document.getElementById("searchStudentReport")?.value.toLowerCase() || "";
    let entries = JSON.parse(localStorage.getItem("entries") || "[]");

    let results = entries.filter(e =>
        e.student.toLowerCase().includes(search)
    );

    let div = document.getElementById("report");
    if (!div) return;
    
    div.innerHTML = "";

    if (!search) {
        div.innerHTML = '<div class="empty-state">Type a student name to search for their class history</div>';
        return;
    }

    if (results.length === 0) {
        div.innerHTML = '<div class="empty-state">No records found for this student</div>';
        return;
    }

    // Summary calculations
    let totalClasses = results.length;
    let totalDuration = results.reduce((sum, e) => sum + parseInt(e.duration), 0);
    let teachers = [...new Set(results.map(e => e.teacher))];

    div.innerHTML += `
        <div class="report-summary">
            <h3>Summary Report</h3>
            <p><b>Total Classes:</b> ${totalClasses}</p>
            <p><b>Total Duration:</b> ${totalDuration} minutes (${(totalDuration/60).toFixed(1)} hours)</p>
            <p><b>Teachers:</b> ${teachers.join(", ")}</p>
        </div>
        <h3 style="color: #1e3c72; margin-bottom: 20px;">Detailed Class History</h3>
    `;

    results.forEach(e => {
        div.innerHTML += `
            <div class="report-item">
                <p><b>${e.date}</b> at ${e.time} | <b>${e.topic}</b></p>
                <p>Student: ${e.student}</p>
                <p>Teacher: ${e.teacher}</p>
                <p>Duration: ${e.duration} minutes</p>
            </div>
        `;
    });
}

// ========== LOAD ON PAGE OPEN ==========

window.onload = function () {
    let role = localStorage.getItem("role");

    if (role === "teacher") {
        loadLists();
        loadRecentEntries();
    }

    if (role === "admin") {
        loadAdminLists();
    }
};

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    doc,
    getDoc,
    updateDoc, 
    deleteDoc, 
    query, 
    where,
    onSnapshot,
    orderBy,
    Timestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyALyA_Yod2TKWonP_oSFehR6-tKq9xDC3I",
    authDomain: "ziel-d0064.firebaseapp.com",
    projectId: "ziel-d0064",
    storageBucket: "ziel-d0064.firebasestorage.app",
    messagingSenderId: "249203765928",
    appId: "1:249203765928:web:391650d800d197d902c89d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ========== INITIALIZE DEFAULT DATA ==========

// Initialize default teachers if none exist
async function initializeDefaultTeachers() {
    try {
        const teachersSnapshot = await getDocs(collection(db, "teachers"));
        
        // Only add default teachers if collection is empty
        if (teachersSnapshot.empty) {
            console.log("No teachers found. Adding default teachers...");
            
            const defaultTeachers = [
                { name: "Prof. Anderson", email: "anderson@ziel.edu", status: "active" },
                { name: "Dr. Williams", email: "williams@ziel.edu", status: "active" },
                { name: "Dr. Brown", email: "brown@ziel.edu", status: "active" },
                { name: "Ms. Johnson", email: "johnson@ziel.edu", status: "active" },
                { name: "Mr. Davis", email: "davis@ziel.edu", status: "active" }
            ];
            
            for (const teacher of defaultTeachers) {
                await addDoc(collection(db, "teachers"), {
                    ...teacher,
                    createdAt: Timestamp.now()
                });
            }
            
            console.log("Default teachers added successfully!");
            return true;
        }
        return false;
    } catch (error) {
        console.error("Error initializing default teachers:", error);
        return false;
    }
}

// Call initialization on page load
initializeDefaultTeachers();
initializeDefaultStudents();

async function initializeDefaultStudents() {
    try {
        const studentsSnapshot = await getDocs(collection(db, "students"));
        
        if (studentsSnapshot.empty) {
            console.log("No students found. Adding default students...");
            
            const defaultStudents = [
                { name: "John Doe", status: "active" },
                { name: "Jane Smith", status: "active" },
                { name: "Mike Johnson", status: "active" },
                { name: "Emily Davis", status: "active" },
                { name: "Sarah Wilson", status: "active" },
                { name: "David Brown", status: "active" },
                { name: "Lisa Anderson", status: "active" },
                { name: "Tom Martinez", status: "active" },
                { name: "Anna Taylor", status: "active" },
                { name: "Chris Lee", status: "active" }
            ];
            
            for (const student of defaultStudents) {
                await addDoc(collection(db, "students"), {
                    ...student,
                    createdAt: Timestamp.now()
                });
            }
            
            console.log("Default students added successfully!");
            return true;
        }
        return false;
    } catch (error) {
        console.error("Error initializing default students:", error);
        return false;
    }
}

// ========== LOGIN FUNCTIONS ==========

// Load active teachers for login dropdown
window.loadTeachersForLogin = async function() {
    const teacherDropdown = document.getElementById("teacherDropdown");
    if (!teacherDropdown) return;

    try {
        const q = query(collection(db, "teachers"), where("status", "==", "active"));
        const snapshot = await getDocs(q);
        
        teacherDropdown.innerHTML = '<option value="">-- Select Your Name --</option>';
        
        // Sort teachers by name in JavaScript instead of Firestore
        const teachers = [];
        snapshot.forEach(doc => {
            teachers.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        teachers.sort((a, b) => a.name.localeCompare(b.name));
        
        teachers.forEach(teacher => {
            teacherDropdown.innerHTML += `<option value="${teacher.name}">${teacher.name}</option>`;
        });
        
        if (teachers.length === 0) {
            teacherDropdown.innerHTML = '<option value="">No active teachers found</option>';
            alert("No active teachers found. Please contact admin.");
        }
    } catch (error) {
        console.error("Error loading teachers:", error);
        teacherDropdown.innerHTML = '<option value="">Error loading teachers</option>';
        alert("Error loading teachers: " + error.message);
    }
}

// Login function with teacher selection
// Handle role selection change
window.handleRoleChange = function() {
    const roleSelector = document.getElementById("roleSelector");
    const teacherSection = document.getElementById("teacherSection");
    const adminSection = document.getElementById("adminSection");
    const loginBtn = document.getElementById("loginBtn");
    
    const selectedRole = roleSelector.value;
    
    // Hide all sections first
    teacherSection.style.display = "none";
    adminSection.style.display = "none";
    loginBtn.style.display = "none";
    
    if (selectedRole === "teacher") {
        teacherSection.style.display = "block";
        loginBtn.style.display = "block";
        loginBtn.textContent = "Login as Teacher";
    } else if (selectedRole === "admin") {
        adminSection.style.display = "block";
        loginBtn.style.display = "block";
        loginBtn.textContent = "Login as Admin";
    }
}

window.login = async function() {
    const roleSelector = document.getElementById("roleSelector");
    const selectedRole = roleSelector?.value;
    
    if (!selectedRole) {
        alert("Please select your role first");
        return;
    }
    
    if (selectedRole === "teacher") {
        // Teacher Login - Email Based Authentication
        const teacherEmailInput = document.getElementById("teacherEmailLogin");
        const enteredEmail = teacherEmailInput?.value.trim();
        
        if (!enteredEmail) {
            alert("Please enter your registered email");
            return;
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(enteredEmail)) {
            alert("Please enter a valid email address");
            return;
        }
        
        try {
            // Query Firebase for teacher with this email
            const q = query(
                collection(db, "teachers"), 
                where("email", "==", enteredEmail.toLowerCase()),
                where("status", "==", "active")
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                alert("Email not registered or account inactive.\nPlease contact your admin.");
                return;
            }

            const teacherDoc = snapshot.docs[0];
            const teacherData = teacherDoc.data();

            // Success - Store teacher identity
            localStorage.setItem("role", "teacher");
            localStorage.setItem("teacherName", teacherData.name);
            localStorage.setItem("teacherEmail", teacherData.email);
            localStorage.setItem("currentTeacherName", teacherData.name);
            localStorage.setItem("teacherId", teacherDoc.id);
            
            window.location.href = "teacher.html";
        } catch (error) {
            console.error("Error verifying teacher:", error);
            alert("Error verifying credentials. Please try again.");
            return;
        }
    } 
    else if (selectedRole === "admin") {
        // Admin Login - Password Based
        const adminPasswordInput = document.getElementById("adminPassword");
        const pwd = adminPasswordInput?.value;
        
        if (!pwd) {
            alert("Please enter admin password");
            return;
        }
        
        if (pwd === "admin123") {
            localStorage.setItem("role", "admin");
            localStorage.removeItem("teacherName");
            localStorage.removeItem("teacherEmail");
            localStorage.removeItem("currentTeacherName");
            localStorage.removeItem("teacherId");
            window.location.href = "admin.html";
        } else {
            alert("Incorrect admin password!");
        }
    }
}

// ========== TEACHER PORTAL FUNCTIONS ==========

// Load teacher and student lists for dropdowns
window.loadLists = async function() {
    try {
        // Get active teachers
        const teachersQuery = query(collection(db, "teachers"), where("status", "==", "active"));
        const teachersSnapshot = await getDocs(teachersQuery);
        const teachers = teachersSnapshot.docs.map(doc => doc.data().name).sort();

        // Get active students
        const studentsQuery = query(collection(db, "students"), where("status", "==", "active"));
        const studentsSnapshot = await getDocs(studentsQuery);
        const students = studentsSnapshot.docs.map(doc => doc.data().name).sort();

        // Populate teacher dropdown with logged-in teacher's name
        let teacherSelect = document.getElementById("teacherName");
        if (teacherSelect) {
            const loggedInTeacher = localStorage.getItem("teacherName");
            const role = localStorage.getItem("role");

            teacherSelect.innerHTML = '<option value="">-- Select Teacher --</option>';
            
            if (role === "admin") {
                // Admin can see all active teachers
                teachers.forEach(t => {
                    teacherSelect.innerHTML += `<option value="${t}">${t}</option>`;
                });
            } else {
                // Teacher sees only their own name
                if (loggedInTeacher) {
                    teacherSelect.innerHTML += `<option value="${loggedInTeacher}" selected>${loggedInTeacher}</option>`;
                    teacherSelect.disabled = true; // Prevent changing
                }
            }
        }

        // Populate student dropdown
        let studentSelect = document.getElementById("studentName");
        if (studentSelect) {
            studentSelect.innerHTML = '<option value="">-- Select Student --</option>';
            students.forEach(s => {
                studentSelect.innerHTML += `<option value="${s}">${s}</option>`;
            });
        }

        // Initialize searchable student dropdown
        initStudentSearch(students);
    } catch (error) {
        console.error("Error loading lists:", error);
        alert("Error loading data. Check console.");
    }
}

function initStudentSearch(students) {
    const searchInput = document.getElementById("studentSearch");
    const dropdown = document.getElementById("studentName");

    if (!searchInput || !dropdown) return;

    searchInput.addEventListener("input", function() {
        const search = this.value.toLowerCase();
        dropdown.innerHTML = '<option value="">-- Select Student --</option>';
        
        students.filter(s => s.toLowerCase().includes(search))
            .forEach(s => {
                dropdown.innerHTML += `<option value="${s}">${s}</option>`;
            });
    });

    searchInput.addEventListener("focus", function() {
        dropdown.size = 8;
    });

    searchInput.addEventListener("blur", function() {
        setTimeout(() => { dropdown.size = 1; }, 200);
    });

    dropdown.addEventListener("change", function() {
        searchInput.value = this.value;
        this.size = 1;
    });
}

// Load students for teacher page
window.loadStudentsForTeacher = async function() {
    try {
        const studentsQuery = query(collection(db, "students"), where("status", "==", "active"));
        const studentsSnapshot = await getDocs(studentsQuery);
        const students = studentsSnapshot.docs.map(doc => doc.data().name).sort();

        let studentSelect = document.getElementById("studentName");
        if (studentSelect) {
            studentSelect.innerHTML = '<option value="">-- Select Student --</option>';
            students.forEach(s => {
                studentSelect.innerHTML += `<option value="${s}">${s}</option>`;
            });
        }
        
        // Setup student search
        initStudentSearch(students);
    } catch (error) {
        console.error("Error loading students:", error);
    }
}

// Prevent double submission flag
let isSavingEntry = false;

// Save entry to Firestore with complete fields
window.saveEntry = async function(event) {
    if (event) event.preventDefault();

    // Prevent double submission
    if (isSavingEntry) {
        console.log("Already saving, please wait...");
        return;
    }
    
    isSavingEntry = true;

    const student = document.getElementById("studentName").value;
    const date = document.getElementById("date").value;
    const timeFrom = document.getElementById("timeFrom").value;
    const timeTo = document.getElementById("timeTo").value;
    const classCount = document.getElementById("classCount").value;
    const sheetMade = document.querySelector('input[name="sheetMade"]:checked')?.value;
    const topic = document.getElementById("topic").value;
    const payment = document.getElementById("payment")?.value.trim() || "";
    
    // Check if we're editing an existing entry
    const editingId = document.getElementById("entryForm").dataset.editingId;

    // Validation
    if (!student || !date || !timeFrom || !timeTo || !classCount || !sheetMade || !topic) {
        alert("Please fill all required fields (marked with *)");
        isSavingEntry = false;
        return;
    }

    // Validate time range
    if (timeFrom >= timeTo) {
        alert("'Time To' must be later than 'Time From'");
        isSavingEntry = false;
        return;
    }

    // Get logged-in teacher info
    const teacherName = localStorage.getItem("teacherName");
    const teacherEmail = localStorage.getItem("teacherEmail");
    const role = localStorage.getItem("role");

    // Validate teacher info exists
    if (role === "teacher" && (!teacherName || !teacherEmail)) {
        alert("Teacher information missing! Please log in again.");
        isSavingEntry = false;
        window.location.href = "index.html";
        return;
    }

    try {
        // Calculate day of week
        const dateObj = new Date(date + 'T00:00:00');
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayOfWeek = days[dateObj.getDay()];

        // Get student ID from Firestore
        const studentQuery = query(collection(db, "students"), where("name", "==", student));
        const studentSnapshot = await getDocs(studentQuery);
        let studentId = null;
        if (!studentSnapshot.empty) {
            studentId = studentSnapshot.docs[0].id;
        }

        // For admin: get selected teacher's email and ID from Firestore
        let teacherNameToStore = teacherName;
        let emailToStore = teacherEmail;
        let teacherId = localStorage.getItem("teacherId");
        
        if (role === "admin") {
            const selectedTeacher = document.getElementById("teacherName")?.value;
            if (selectedTeacher) {
                teacherNameToStore = selectedTeacher;
                const q = query(collection(db, "teachers"), where("name", "==", selectedTeacher));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    emailToStore = snapshot.docs[0].data().email;
                    teacherId = snapshot.docs[0].id;
                }
            }
        }

        const entryData = {
            teacherId: teacherId,
            teacherName: teacherNameToStore,
            teacherEmail: emailToStore,
            studentId: studentId,
            studentName: student,
            date: date,
            dayOfWeek: dayOfWeek,
            timeFrom: timeFrom,
            timeTo: timeTo,
            classCount: parseInt(classCount),
            sheetMade: sheetMade,
            topic: topic,
            payment: payment
        };

        if (editingId) {
            // Update existing entry
            const docRef = doc(db, "entries", editingId);
            await updateDoc(docRef, entryData);
            alert("✅ Entry updated successfully!");
            delete document.getElementById("entryForm").dataset.editingId;
        } else {
            // Create new entry
            entryData.createdAt = Timestamp.now();
            await addDoc(collection(db, "entries"), entryData);
            alert("✅ Entry saved successfully!");
        }
        
        // Clear form
        document.getElementById("studentSearch").value = "";
        document.getElementById("studentName").value = "";
        document.getElementById("timeFrom").value = "";
        document.getElementById("timeTo").value = "";
        document.getElementById("classCount").value = "";
        const checkedRadio = document.querySelector('input[name="sheetMade"]:checked');
        if (checkedRadio) checkedRadio.checked = false;
        document.getElementById("topic").value = "";
        if (document.getElementById("payment")) {
            document.getElementById("payment").value = "";
        }

        loadRecentEntries();
        
        // Reset the flag after successful save
        isSavingEntry = false;
    } catch (error) {
        console.error("Error saving entry:", error);
        alert("❌ Error saving entry. Check console for details.");
        
        // Reset the flag on error
        isSavingEntry = false;
    }
}

// Load recent entries - filtered by teacher email or all for admin
window.loadRecentEntries = async function() {
    const teacherEmail = localStorage.getItem("teacherEmail");
    const role = localStorage.getItem("role");
    const div = document.getElementById("recentEntries");
    
    if (!div) return;

    // Check if teacher has valid email
    if (role === "teacher" && !teacherEmail) {
        div.innerHTML = "<p class='error'>Teacher email not found. Please <a href='index.html'>login again</a>.</p>";
        return;
    }

    div.innerHTML = "<p>Loading...</p>";

    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        let entriesQuery;
        if (role === "admin") {
            // Admin sees all entries - fetch all and filter by date in JS
            entriesQuery = query(collection(db, "entries"));
        } else {
            // Teachers see only their entries
            entriesQuery = query(
                collection(db, "entries"),
                where("teacherEmail", "==", teacherEmail)
            );
        }

        const snapshot = await getDocs(entriesQuery);

        // Filter by date in JavaScript
        const entries = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const createdAt = data.createdAt ? data.createdAt.toDate() : new Date(0);
            
            // Only include entries from last 24 hours
            if (createdAt >= twentyFourHoursAgo) {
                entries.push({
                    id: docSnap.id,
                    ...data
                });
            }
        });

        if (entries.length === 0) {
            div.innerHTML = "<p>No recent entries in the last 24 hours.</p>";
            return;
        }

        // Sort entries by createdAt in JavaScript (newest first)
        entries.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
            return timeB - timeA; // Descending order (newest first)
        });

        div.innerHTML = "";
        entries.forEach(e => {
            const paymentText = e.payment ? `${e.payment}` : 'No payment';
            const sheetText = e.sheetMade === 'yes' ? 'Yes' : 'No';
            const studentName = e.studentName || e.student || 'N/A';
            const createdAt = e.createdAt ? e.createdAt.toDate() : new Date();
            const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
            const canEdit = hoursSinceCreation <= 24;
            
            div.innerHTML += `
                <div class="entry-item">
                    <div class="entry-header">
                        <div>
                            <span class="entry-date">${e.date || 'N/A'}</span>
                            <span class="entry-day">${e.dayOfWeek || ''}</span>
                        </div>
                        ${!canEdit && role !== 'admin' ? '<span style="color: #d93025; font-size: 0.85em;">Locked (>24hrs)</span>' : ''}
                    </div>
                    <div class="entry-details">
                        <div class="entry-detail"><strong>Student:</strong> ${studentName}</div>
                        <div class="entry-detail"><strong>Time:</strong> ${e.timeFrom || 'N/A'} - ${e.timeTo || 'N/A'}</div>
                        <div class="entry-detail"><strong>Classes:</strong> ${e.classCount || 'N/A'}</div>
                        <div class="entry-detail"><strong>Sheet:</strong> ${sheetText}</div>
                        <div class="entry-detail"><strong>Payment:</strong> ${paymentText}</div>
                    </div>
                    <div class="entry-detail" style="margin-top: 8px;">
                        <strong>Topic:</strong> ${e.topic || '-'}
                    </div>
                    <div class="entry-actions">
                        ${canEdit || role === 'admin' ? `<button class="btn-edit" onclick="editEntry('${e.id}')">Edit</button>` : '<button class="btn-edit" disabled>Edit</button>'}
                        ${canEdit || role === 'admin' ? `<button class="btn-delete" onclick="deleteEntry('${e.id}')">Delete</button>` : '<button class="btn-delete" disabled>Delete</button>'}
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error("Error loading entries:", error);
        div.innerHTML = "<p style='color: red;'>❌ Error loading entries. Check console.</p>";
    }
}

// Edit entry - populate form with existing data
window.editEntry = async function(docId) {
    try {
        const docRef = doc(db, "entries", docId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            alert("❌ Entry not found!");
            return;
        }

        const entry = docSnap.data();
        const role = localStorage.getItem("role");
        const teacherEmail = localStorage.getItem("teacherEmail");

        // Admin can edit anything
        if (role !== "admin") {
            // Check if teacher owns this entry
            if (entry.teacherEmail !== teacherEmail) {
                alert("❌ You can only edit your own entries!");
                return;
            }

            // Check if within 24 hours for teachers
            const createdAt = entry.createdAt.toDate();
            const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
            
            if (hoursSinceCreation > 24) {
                alert(`❌ Cannot edit entries older than 24 hours!\nThis entry was created ${Math.floor(hoursSinceCreation)} hours ago.`);
                return;
            }
        }

        // Populate form fields
        document.getElementById("studentSearch").value = entry.studentName || entry.student || "";
        document.getElementById("studentName").value = entry.studentName || entry.student || "";
        document.getElementById("date").value = entry.date || "";
        document.getElementById("timeFrom").value = entry.timeFrom || "";
        document.getElementById("timeTo").value = entry.timeTo || "";
        document.getElementById("classCount").value = entry.classCount || "";
        
        // Set radio button
        if (entry.sheetMade) {
            const radio = document.querySelector(`input[name="sheetMade"][value="${entry.sheetMade}"]`);
            if (radio) radio.checked = true;
        }
        
        document.getElementById("topic").value = entry.topic || "";
        if (document.getElementById("payment")) {
            document.getElementById("payment").value = entry.payment || "";
        }

        // Store the entry ID for update
        document.getElementById("entryForm").dataset.editingId = docId;
        
        // Scroll to form
        document.getElementById("entryForm").scrollIntoView({ behavior: 'smooth' });
        
        alert("✏️ Entry loaded! Make your changes and save.");
    } catch (error) {
        console.error("Error loading entry for edit:", error);
        alert("❌ Error loading entry. Check console.");
    }
}

// Delete entry
window.deleteEntry = async function(docId) {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    try {
        const docRef = doc(db, "entries", docId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            alert("Entry not found!");
            return;
        }

        const entry = docSnap.data();
        const role = localStorage.getItem("role");
        const teacherEmail = localStorage.getItem("teacherEmail");

        // Admin can delete anything
        if (role === "admin") {
            await deleteDoc(docRef);
            alert("✅ Entry deleted!");
            loadRecentEntries();
            return;
        }

        // Check if teacher owns this entry
        if (entry.teacherEmail !== teacherEmail) {
            alert("❌ You can only delete your own entries!");
            return;
        }

        // Check if within 24 hours for teachers
        const createdAt = entry.createdAt.toDate();
        const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceCreation > 24) {
            alert(`❌ Cannot delete entries older than 24 hours!\nThis entry was created ${Math.floor(hoursSinceCreation)} hours ago.`);
            return;
        }

        await deleteDoc(docRef);
        alert("✅ Entry deleted successfully!");
        loadRecentEntries();
    } catch (error) {
        console.error("Error deleting entry:", error);
        alert("❌ Error deleting entry. Check console.");
    }
}

// ========== ADMIN FUNCTIONS ==========

// Global arrays to store full lists
let allTeachers = [];
let allStudents = [];

// Initialize data and set up real-time listeners
window.initializeData = async function() {
    // Set up real-time listener for teachers
    onSnapshot(collection(db, "teachers"), (snapshot) => {
        allTeachers = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        filterTeachers();
    });

    // Set up real-time listener for students
    onSnapshot(collection(db, "students"), (snapshot) => {
        allStudents = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        filterStudents();
    });
}

// Add teacher
window.addTeacher = async function() {
    let name = document.getElementById("newTeacher").value.trim();
    let email = document.getElementById("newTeacherEmail").value.trim();
    
    if (!name) return alert("Enter teacher name");
    if (!email) return alert("Enter teacher email");
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return alert("Please enter a valid email address");
    }

    try {
        // Check if email already exists (MUST be unique)
        const emailQuery = query(collection(db, "teachers"), where("email", "==", email));
        const emailSnapshot = await getDocs(emailQuery);

        if (!emailSnapshot.empty) {
            alert("This email is already registered! Email must be unique.");
            return;
        }

        await addDoc(collection(db, "teachers"), {
            name: name,
            email: email,
            status: "active",
            createdAt: Timestamp.now()
        });

        document.getElementById("newTeacher").value = "";
        document.getElementById("newTeacherEmail").value = "";
        alert("Teacher added successfully!");
    } catch (error) {
        console.error("Error adding teacher:", error);
        alert("Error adding teacher. Check console.");
    }
}

// Add student
window.addStudent = async function() {
    let name = document.getElementById("newStudent").value.trim();
    if (!name) return alert("Enter student name");

    try {
        // Check if student already exists
        const q = query(collection(db, "students"), where("name", "==", name));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            alert("Student already exists!");
            return;
        }

        await addDoc(collection(db, "students"), {
            name: name,
            status: "active",
            createdAt: Timestamp.now()
        });

        document.getElementById("newStudent").value = "";
        alert("Student added successfully!");
    } catch (error) {
        console.error("Error adding student:", error);
        alert("Error adding student. Check console.");
    }
}

// Toggle teacher status
window.toggleTeacherStatus = async function(id) {
    const teacher = allTeachers.find(t => t.id === id);
    if (!teacher) return;

    const action = teacher.status === "active" ? "deactivate" : "activate";
    if (!confirm(`Are you sure you want to ${action} ${teacher.name}?`)) return;

    try {
        const docRef = doc(db, "teachers", id);
        await updateDoc(docRef, {
            status: teacher.status === "active" ? "inactive" : "active"
        });
    } catch (error) {
        console.error("Error toggling teacher status:", error);
        alert("Error updating teacher. Check console.");
    }
}

// Toggle student status
window.toggleStudentStatus = async function(id) {
    const student = allStudents.find(s => s.id === id);
    if (!student) return;

    const action = student.status === "active" ? "deactivate" : "activate";
    if (!confirm(`Are you sure you want to ${action} ${student.name}?`)) return;

    try {
        const docRef = doc(db, "students", id);
        await updateDoc(docRef, {
            status: student.status === "active" ? "inactive" : "active"
        });
    } catch (error) {
        console.error("Error toggling student status:", error);
        alert("Error updating student. Check console.");
    }
}

// Delete teacher
window.deleteTeacher = async function(id) {
    const teacher = allTeachers.find(t => t.id === id);
    if (!teacher) return;

    if (!confirm(`Are you sure you want to permanently delete ${teacher.name}?`)) return;

    try {
        await deleteDoc(doc(db, "teachers", id));
        alert("Teacher deleted successfully!");
    } catch (error) {
        console.error("Error deleting teacher:", error);
        alert("Error deleting teacher. Check console.");
    }
}

// Delete student
window.deleteStudent = async function(id) {
    const student = allStudents.find(s => s.id === id);
    if (!student) return;

    if (!confirm(`Are you sure you want to permanently delete ${student.name}?`)) return;

    try {
        await deleteDoc(doc(db, "students", id));
        alert("Student deleted successfully!");
    } catch (error) {
        console.error("Error deleting student:", error);
        alert("Error deleting student. Check console.");
    }
}

// Filter teachers
window.filterTeachers = function() {
    const searchTerm = document.getElementById("searchTeacher")?.value.toLowerCase() || "";
    const showInactive = document.getElementById("showInactiveTeachers")?.checked || false;

    let filtered = allTeachers.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchTerm);
        const matchesStatus = showInactive || t.status === "active";
        return matchesSearch && matchesStatus;
    });

    displayTeachers(filtered);
}

// Filter students
window.filterStudents = function() {
    const searchTerm = document.getElementById("searchStudent")?.value.toLowerCase() || "";
    const showInactive = document.getElementById("showInactiveStudents")?.checked || false;

    let filtered = allStudents.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm);
        const matchesStatus = showInactive || s.status === "active";
        return matchesSearch && matchesStatus;
    });

    displayStudents(filtered);
}

// Display teachers
function displayTeachers(filtered) {
    let tl = document.getElementById("teacherList");
    if (!tl) return;

    tl.innerHTML = "";

    if (filtered.length === 0) {
        tl.innerHTML = '<tr><td colspan="4" class="empty-state">No teachers found</td></tr>';
        return;
    }

    filtered.forEach((t) => {
        const statusClass = t.status === "active" ? "status-active" : "status-inactive";
        const statusText = t.status === "active" ? "Active" : "Inactive";
        const toggleBtnClass = t.status === "active" ? "deactivate" : "activate";
        const toggleBtnText = t.status === "active" ? "Deactivate" : "Activate";

        tl.innerHTML += `
            <tr>
                <td>${t.name}</td>
                <td>${t.email || '<em style="color: #999;">No email</em>'}</td>
                <td style="text-align: center;">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </td>
                <td style="text-align: center;">
                    <button class="toggle-btn ${toggleBtnClass}" onclick="toggleTeacherStatus('${t.id}')">${toggleBtnText}</button>
                    <button class="delete-btn" onclick="deleteTeacher('${t.id}')">Delete</button>
                </td>
            </tr>
        `;
    });
}

// Display students
function displayStudents(filtered) {
    let sl = document.getElementById("studentList");
    if (!sl) return;

    sl.innerHTML = "";

    if (filtered.length === 0) {
        sl.innerHTML = '<tr><td colspan="3" class="empty-state">No students found</td></tr>';
        return;
    }

    filtered.forEach((s) => {
        const statusClass = s.status === "active" ? "status-active" : "status-inactive";
        const statusText = s.status === "active" ? "Active" : "Inactive";
        const toggleBtnClass = s.status === "active" ? "deactivate" : "activate";
        const toggleBtnText = s.status === "active" ? "Deactivate" : "Activate";

        sl.innerHTML += `
            <tr>
                <td>${s.name}</td>
                <td style="text-align: center;">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </td>
                <td style="text-align: center;">
                    <button class="toggle-btn ${toggleBtnClass}" onclick="toggleStudentStatus('${s.id}')">${toggleBtnText}</button>
                    <button class="delete-btn" onclick="deleteStudent('${s.id}')">Delete</button>
                </td>
            </tr>
        `;
    });
}

// Load student report
window.loadStudentReport = async function() {
    const selectedStudent = document.getElementById("searchStudentReport")?.value;
    const timePeriod = document.getElementById("timePeriodFilter")?.value || "30";
    const div = document.getElementById("report");
    
    if (!div) return;

    if (!selectedStudent) {
        div.innerHTML = `<div style="text-align: center; padding: 48px; color: #666666; font-family: 'Roboto', sans-serif; font-size: 14px; background: rgba(255, 255, 255, 0.95); border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.3);">
            <p>Please select a student to view their report.</p>
        </div>`;
        return;
    }

    div.innerHTML = `<div style="text-align: center; padding: 48px; color: #666666; font-family: 'Roboto', sans-serif; font-size: 14px;">
        <p>Loading report...</p>
    </div>`;

    try {
        // Calculate date filter
        let dateFilter = null;
        if (timePeriod !== "all") {
            const daysAgo = parseInt(timePeriod);
            dateFilter = new Date();
            dateFilter.setDate(dateFilter.getDate() - daysAgo);
        }

        // Query entries for the selected student
        const entriesQuery = query(
            collection(db, "entries"),
            where("studentName", "==", selectedStudent)
        );

        const snapshot = await getDocs(entriesQuery);

        if (snapshot.empty) {
            div.innerHTML = `<div style="text-align: center; padding: 48px; color: #666666; font-family: 'Roboto', sans-serif; font-size: 14px; background: rgba(255, 255, 255, 0.95); border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.3);">
                <p>No classes found for "${selectedStudent}"</p>
            </div>`;
            return;
        }

        let results = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Apply time period filter
        if (dateFilter) {
            results = results.filter(e => {
                const entryDate = e.createdAt ? e.createdAt.toDate() : new Date(e.date);
                return entryDate >= dateFilter;
            });
        }

        // Sort by date (newest first)
        results.sort((a, b) => {
            const dateA = a.createdAt ? a.createdAt.toDate() : new Date(a.date);
            const dateB = b.createdAt ? b.createdAt.toDate() : new Date(b.date);
            return dateB - dateA;
        });

        if (results.length === 0) {
            div.innerHTML = `<div style="text-align: center; padding: 48px; color: #666666; font-family: 'Roboto', sans-serif; font-size: 14px; background: rgba(255, 255, 255, 0.95); border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.3);">
                <p>No classes found for "${selectedStudent}" in the selected time period.</p>
            </div>`;
            return;
        }

        // Calculate statistics
        const totalClasses = results.reduce((sum, e) => sum + parseInt(e.classCount || 1), 0);
        const teachers = [...new Set(results.map(e => e.teacherName || e.teacher))];
        const totalPayment = results.reduce((sum, e) => {
            const payment = e.payment || "0";
            const amount = parseInt(payment.replace(/[^0-9]/g, '') || 0);
            return sum + amount;
        }, 0);

        // Build report HTML
        let html = `
            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
                <div style="background: #2c2c2c; color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 6px rgba(44, 44, 44, 0.2);">
                    <div style="font-size: 32px; font-weight: 700; font-family: 'Roboto', sans-serif;">${results.length}</div>
                    <div style="font-size: 13px; opacity: 0.9; font-family: 'Roboto', sans-serif; font-weight: 500; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 4px;">Total Sessions</div>
                </div>
                <div style="background: #90ee90; color: #2c2c2c; padding: 20px; border-radius: 8px; box-shadow: 0 2px 6px rgba(144, 238, 144, 0.3);">
                    <div style="font-size: 32px; font-weight: 700; font-family: 'Roboto', sans-serif;">${totalClasses}</div>
                    <div style="font-size: 13px; opacity: 0.85; font-family: 'Roboto', sans-serif; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 4px;">Total Classes</div>
                </div>
                <div style="background: #1a73e8; color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 6px rgba(26, 115, 232, 0.3);">
                    <div style="font-size: 32px; font-weight: 700; font-family: 'Roboto', sans-serif;">${teachers.length}</div>
                    <div style="font-size: 13px; opacity: 0.9; font-family: 'Roboto', sans-serif; font-weight: 500; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 4px;">Teachers</div>
                </div>
                <div style="background: #d4af37; color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 6px rgba(212, 175, 55, 0.3);">
                    <div style="font-size: 32px; font-weight: 700; font-family: 'Roboto', sans-serif;">₹${totalPayment}</div>
                    <div style="font-size: 13px; opacity: 0.9; font-family: 'Roboto', sans-serif; font-weight: 500; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 4px;">Total Payment</div>
                </div>
            </div>

            <!-- Teachers List -->
            <div style="background: rgba(255, 255, 255, 0.95); padding: 16px 20px; border-radius: 8px; margin-bottom: 24px; box-shadow: 0 1px 4px rgba(44, 44, 44, 0.1); border: 1px solid rgba(212, 175, 55, 0.3);">
                <strong style="font-family: 'Roboto', sans-serif; font-size: 14px; color: #2c2c2c;">Teachers:</strong> 
                <span style="font-family: 'Roboto', sans-serif; font-size: 14px; color: #666666;">${teachers.join(", ")}</span>
            </div>

            <!-- Detailed Class History -->
            <div style="background: rgba(255, 255, 255, 0.95); border-radius: 8px; padding: 20px; box-shadow: 0 1px 4px rgba(44, 44, 44, 0.1); border: 1px solid rgba(212, 175, 55, 0.3);">
                <h3 style="margin: 0 0 20px 0; color: #2c2c2c; font-family: 'Roboto', sans-serif; font-weight: 500; font-size: 18px; border-bottom: 1px solid #e8eaed; padding-bottom: 12px;">Class History</h3>
                <div style="display: flex; flex-direction: column; gap: 12px;">
        `;

        results.forEach(e => {
            const teacherName = e.teacherName || e.teacher || "N/A";
            const topic = e.topic || "No topic specified";
            const payment = e.payment || "No payment";
            const sheetMade = e.sheetMade === "yes" ? "Yes" : "No";
            
            html += `
                <div style="background: rgba(248, 249, 250, 0.8); border-left: 4px solid #90ee90; padding: 16px; border-radius: 4px; box-shadow: 0 1px 3px rgba(44, 44, 44, 0.08);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <div>
                            <div style="font-weight: 500; color: #2c2c2c; font-size: 15px; font-family: 'Roboto', sans-serif;">${e.date || "N/A"} <span style="color: #666666; font-size: 13px; font-weight: 400; margin-left: 8px;">${e.dayOfWeek || ""}</span></div>
                            <div style="color: #1a73e8; font-size: 13px; font-weight: 500; margin-top: 4px; font-family: 'Roboto', sans-serif;">Teacher: ${teacherName}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 13px; color: #666666; font-family: 'Roboto', sans-serif;">${e.timeFrom || "N/A"} - ${e.timeTo || "N/A"}</div>
                            <div style="font-size: 13px; color: #d4af37; font-weight: 500; margin-top: 4px; font-family: 'Roboto', sans-serif;">${payment}</div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; font-size: 13px; color: #666666; font-family: 'Roboto', sans-serif;">
                        <div><strong style="color: #2c2c2c;">Classes:</strong> ${e.classCount || "N/A"}</div>
                        <div><strong style="color: #2c2c2c;">Sheet Made:</strong> ${sheetMade}</div>
                    </div>
                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e8eaed;">
                        <strong style="color: #2c2c2c; font-size: 13px; font-family: 'Roboto', sans-serif;">Topic:</strong>
                        <div style="color: #666666; font-size: 13px; margin-top: 4px; font-family: 'Roboto', sans-serif; line-height: 1.5;">${topic}</div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        div.innerHTML = html;
    } catch (error) {
        console.error("Error loading student report:", error);
        div.innerHTML = `<div style="text-align: center; padding: 48px; color: #d93025; font-family: 'Roboto', sans-serif; font-size: 14px; background: rgba(255, 255, 255, 0.95); border-radius: 8px; border: 1px solid #d93025;">
            <p>Error loading report. Please try again.</p>
            <p style="font-size: 12px; margin-top: 8px;">${error.message}</p>
        </div>`;
    }
}

// Show tab
window.showTab = function(tabName) {
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

    // Load data based on tab
    if (tabName === 'teachers') {
        filterTeachers();
    } else if (tabName === 'students') {
        filterStudents();
    } else if (tabName === 'entries') {
        loadAdminEntries();
    } else if (tabName === 'reports') {
        loadStudentsForReport();
    }
}

// Load students into report dropdown
let allStudentsForReport = [];

async function loadStudentsForReport() {
    try {
        const studentsQuery = query(
            collection(db, "students"),
            where("status", "==", "active")
        );
        
        const snapshot = await getDocs(studentsQuery);
        
        allStudentsForReport = [];
        snapshot.docs.forEach(doc => {
            const student = doc.data();
            allStudentsForReport.push(student.name);
        });
        
        // Sort alphabetically
        allStudentsForReport.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    } catch (error) {
        console.error("Error loading students for report:", error);
    }
}

// Filter student list based on search input
window.filterStudentList = function() {
    const searchInput = document.getElementById("searchStudentReport");
    const dropdown = document.getElementById("studentDropdown");
    
    if (!searchInput || !dropdown) return;
    
    const searchValue = searchInput.value.toLowerCase().trim();
    
    if (searchValue.length === 0) {
        dropdown.style.display = "none";
        return;
    }
    
    // Filter students that match the search
    const filtered = allStudentsForReport.filter(name => 
        name.toLowerCase().includes(searchValue)
    );
    
    if (filtered.length === 0) {
        dropdown.innerHTML = '<div style="padding: 12px; color: #666666; font-family: \'Roboto\', sans-serif; font-size: 14px;">No students found</div>';
        dropdown.style.display = "block";
        return;
    }
    
    // Build dropdown HTML
    let html = '';
    filtered.forEach(name => {
        const highlightedName = highlightMatch(name, searchValue);
        html += `<div onclick="selectStudent('${name.replace(/'/g, "\\'")}')" style="padding: 10px 12px; cursor: pointer; font-family: 'Roboto', sans-serif; font-size: 14px; color: #2c2c2c; border-bottom: 1px solid #f0f0f0; transition: background 0.2s;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'">${highlightedName}</div>`;
    });
    
    dropdown.innerHTML = html;
    dropdown.style.display = "block";
}

// Highlight matching text
function highlightMatch(text, search) {
    const regex = new RegExp(`(${search})`, 'gi');
    return text.replace(regex, '<strong style="color: #d4af37; font-weight: 600;">$1</strong>');
}

// Show student dropdown
window.showStudentDropdown = function() {
    const searchInput = document.getElementById("searchStudentReport");
    const dropdown = document.getElementById("studentDropdown");
    
    if (!searchInput || !dropdown) return;
    
    if (searchInput.value.trim().length > 0) {
        filterStudentList();
    } else if (allStudentsForReport.length > 0) {
        // Show all students if no search text
        let html = '';
        allStudentsForReport.forEach(name => {
            html += `<div onclick="selectStudent('${name.replace(/'/g, "\\'")}')" style="padding: 10px 12px; cursor: pointer; font-family: 'Roboto', sans-serif; font-size: 14px; color: #2c2c2c; border-bottom: 1px solid #f0f0f0; transition: background 0.2s;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'">${name}</div>`;
        });
        dropdown.innerHTML = html;
        dropdown.style.display = "block";
    }
}

// Select student from dropdown
window.selectStudent = function(studentName) {
    const searchInput = document.getElementById("searchStudentReport");
    const dropdown = document.getElementById("studentDropdown");
    const hiddenInput = document.getElementById("selectedStudentId");
    
    if (searchInput) searchInput.value = studentName;
    if (hiddenInput) hiddenInput.value = studentName;
    if (dropdown) dropdown.style.display = "none";
    
    // Load report for selected student
    loadStudentReport();
}

// Hide dropdown when clicking outside
document.addEventListener('click', function(event) {
    const searchInput = document.getElementById("searchStudentReport");
    const dropdown = document.getElementById("studentDropdown");
    
    if (searchInput && dropdown && !searchInput.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.style.display = "none";
    }
});

// Admin page initialization
if (window.location.pathname.includes('admin.html')) {
    document.addEventListener('DOMContentLoaded', function() {
        const loginSection = document.getElementById("login-section");
        const dashboardSection = document.getElementById("dashboard-section");
        const logoutBtn = document.getElementById("logout-btn");

        // Check if admin is logged in
        if (localStorage.getItem("adminLoggedIn") === "true") {
            loginSection.style.display = "none";
            dashboardSection.style.display = "block";
            initializeData();
            filterTeachers();
        } else {
            loginSection.style.display = "flex";
            dashboardSection.style.display = "none";
        }

        // Admin login button
        const adminLoginBtn = document.getElementById("admin-login-btn");
        if (adminLoginBtn) {
            adminLoginBtn.addEventListener('click', function() {
                const pwd = document.getElementById("admin-password").value;
                if (pwd === "admin123") {
                    localStorage.setItem("adminLoggedIn", "true");
                    loginSection.style.display = "none";
                    dashboardSection.style.display = "block";
                    initializeData();
                    filterTeachers();
                } else {
                    alert("Incorrect Password!");
                }
            });
        }

        // Logout button
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function() {
                localStorage.removeItem("adminLoggedIn");
                window.location.reload();
            });
        }
    });
}

// ========== HELPER FUNCTIONS FOR LOADING ENTRIES ==========

// Load entries for specific teacher (Step 3)
window.loadTeacherEntries = async function() {
    const teacherEmail = localStorage.getItem("teacherEmail");

    if (!teacherEmail) {
        throw new Error("Teacher email missing! Please log in again.");
    }

    const q = query(
        collection(db, "entries"),
        where("teacherEmail", "==", teacherEmail),
        orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    const results = [];

    snapshot.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() });
    });

    return results; // array of entries belonging to that teacher (by email)
};

// Load all entries for admin (Step 4)
window.loadAllEntries = async function() {
    const snapshot = await getDocs(collection(db, "entries"));
    const results = [];

    snapshot.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() });
    });

    return results; // array of all entries
};

// ========== PAGE INITIALIZATION ==========

// Teacher page initialization
if (window.location.pathname.includes('teacher.html')) {
    document.addEventListener('DOMContentLoaded', function() {
        // Check if teacher is logged in
        const role = localStorage.getItem("role");
        const teacherName = localStorage.getItem("teacherName") || localStorage.getItem("currentTeacherName");

        if (role !== "teacher" && role !== "admin") {
            alert("Please login first!");
            window.location.href = "index.html";
            return;
        }

        if (role === "teacher" && !teacherName) {
            alert("Teacher name not found. Please login again.");
            window.location.href = "index.html";
            return;
        }

        loadLists();
        loadRecentEntries();
    });
}

// ========== ADMIN PANEL FUNCTIONS ==========

// Load admin panel data
window.loadAdminLists = function() {
    initializeData();
    loadAdminEntries(); // Load all entries for admin
};

// Load all entries for admin panel
// ========== ADMIN ENTRIES DASHBOARD ==========

let allAdminEntries = [];
let filteredAdminEntries = [];
let currentPage = 1;
let entriesPerPage = 25;

// Load all admin entries with stats
window.loadAdminEntries = async function() {
    const entriesList = document.getElementById("admin-entries-list");
    if (!entriesList) return;

    try {
        // Get all entries (no limit)
        const snapshot = await getDocs(collection(db, "entries"));
        
        if (snapshot.empty) {
            entriesList.innerHTML = '<tr><td colspan="9" class="empty-state" style="padding: 40px; text-align: center; color: #7f8c8d;">No entries found. Teachers can create entries from their dashboard.</td></tr>';
            updateStats([], []);
            return;
        }

        // Store all entries
        allAdminEntries = [];
        snapshot.forEach(doc => {
            allAdminEntries.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Sort by createdAt descending (newest first)
        allAdminEntries.sort((a, b) => {
            const aTime = a.createdAt?.toMillis() || 0;
            const bTime = b.createdAt?.toMillis() || 0;
            return bTime - aTime;
        });

        // Populate filter dropdowns
        populateFilterDropdowns();

        // Initially show all entries
        filteredAdminEntries = [...allAdminEntries];
        currentPage = 1;
        
        // Update display
        displayAdminEntries();
        updateStats(allAdminEntries, filteredAdminEntries);
        
    } catch (error) {
        console.error("Error loading admin entries:", error);
        entriesList.innerHTML = '<tr><td colspan="9" class="empty-state" style="padding: 40px; text-align: center; color: red;">Error loading entries. Check console.</td></tr>';
    }
};

// Populate filter dropdowns from existing data
function populateFilterDropdowns() {
    const teachers = new Set();
    const students = new Set();
    
    allAdminEntries.forEach(entry => {
        if (entry.teacherName) teachers.add(entry.teacherName);
        if (entry.studentName || entry.student) students.add(entry.studentName || entry.student);
    });
    
    // Populate teacher dropdown
    const teacherFilter = document.getElementById("filterTeacher");
    if (teacherFilter) {
        const currentValue = teacherFilter.value;
        teacherFilter.innerHTML = '<option value="">All Teachers</option>';
        Array.from(teachers).sort().forEach(teacher => {
            teacherFilter.innerHTML += `<option value="${teacher}" ${teacher === currentValue ? 'selected' : ''}>${teacher}</option>`;
        });
    }
    
    // Populate student dropdown
    const studentFilter = document.getElementById("filterStudent");
    if (studentFilter) {
        const currentValue = studentFilter.value;
        studentFilter.innerHTML = '<option value="">All Students</option>';
        Array.from(students).sort().forEach(student => {
            studentFilter.innerHTML += `<option value="${student}" ${student === currentValue ? 'selected' : ''}>${student}</option>`;
        });
    }
}

// Apply filters
window.applyAdminFilters = function() {
    const dateFrom = document.getElementById("filterDateFrom")?.value;
    const dateTo = document.getElementById("filterDateTo")?.value;
    const teacher = document.getElementById("filterTeacher")?.value;
    const student = document.getElementById("filterStudent")?.value;
    const sheetMade = document.getElementById("filterSheetMade")?.value;
    const search = document.getElementById("filterSearch")?.value.toLowerCase();
    
    filteredAdminEntries = allAdminEntries.filter(entry => {
        // Date range filter
        if (dateFrom && entry.date < dateFrom) return false;
        if (dateTo && entry.date > dateTo) return false;
        
        // Teacher filter
        if (teacher && entry.teacherName !== teacher) return false;
        
        // Student filter
        const entryStudent = entry.studentName || entry.student;
        if (student && entryStudent !== student) return false;
        
        // Sheet made filter
        if (sheetMade && entry.sheetMade !== sheetMade) return false;
        
        // Search filter (topic)
        if (search && !entry.topic?.toLowerCase().includes(search)) return false;
        
        return true;
    });
    
    currentPage = 1;
    displayAdminEntries();
    updateStats(allAdminEntries, filteredAdminEntries);
};

// Reset filters
window.resetAdminFilters = function() {
    document.getElementById("filterDateFrom").value = "";
    document.getElementById("filterDateTo").value = "";
    document.getElementById("filterTeacher").value = "";
    document.getElementById("filterStudent").value = "";
    document.getElementById("filterSheetMade").value = "";
    document.getElementById("filterSearch").value = "";
    
    filteredAdminEntries = [...allAdminEntries];
    currentPage = 1;
    displayAdminEntries();
    updateStats(allAdminEntries, filteredAdminEntries);
};

// Refresh entries
window.refreshAdminEntries = function() {
    loadAdminEntries();
};

// Display entries with pagination
function displayAdminEntries() {
    const entriesList = document.getElementById("admin-entries-list");
    if (!entriesList) return;
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredAdminEntries.length / entriesPerPage);
    const startIndex = (currentPage - 1) * entriesPerPage;
    const endIndex = startIndex + entriesPerPage;
    const pageEntries = filteredAdminEntries.slice(startIndex, endIndex);
    
    // Update pagination controls
    updatePaginationControls(currentPage, totalPages);
    
    // Display entries
    if (pageEntries.length === 0) {
        entriesList.innerHTML = '<tr><td colspan="9" class="empty-state" style="padding: 40px; text-align: center; color: #7f8c8d;">📭 No entries match your filters</td></tr>';
        return;
    }
    
    entriesList.innerHTML = pageEntries.map((entry, index) => {
        const paymentText = entry.payment || '-';
        const sheetBadge = entry.sheetMade === 'yes' ? 
            '<span style="background: #d4edda; color: #155724; padding: 3px 8px; border-radius: 3px; font-size: 12px; font-weight: bold;">✓ Yes</span>' : 
            '<span style="background: #f8d7da; color: #721c24; padding: 3px 8px; border-radius: 3px; font-size: 12px; font-weight: bold;">✗ No</span>';
        const studentName = entry.studentName || entry.student || 'N/A';
        const rowBg = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
        
        return `
        <tr style="background: ${rowBg}; border-bottom: 1px solid #dee2e6;">
            <td style="padding: 12px 8px;">
                <strong style="color: #2c3e50;">${entry.date || 'N/A'}</strong><br>
                <small style="color: #7f8c8d;">${entry.dayOfWeek || ''}</small>
            </td>
            <td style="padding: 12px 8px;">
                <strong style="color: #3498db;">${entry.teacherName || 'N/A'}</strong><br>
                <small style="color: #7f8c8d;">${entry.teacherEmail || ''}</small>
            </td>
            <td style="padding: 12px 8px;">
                <strong style="color: #2c3e50;">${studentName}</strong>
            </td>
            <td style="padding: 12px 8px; white-space: nowrap;">
                ${entry.timeFrom || 'N/A'} - ${entry.timeTo || 'N/A'}
            </td>
            <td style="padding: 12px 8px; text-align: center;">
                <span style="background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 3px; font-weight: bold;">${entry.classCount || 'N/A'}</span>
            </td>
            <td style="padding: 12px 8px; text-align: center;">
                ${sheetBadge}
            </td>
            <td style="padding: 12px 8px;">
                ${paymentText !== '-' ? '<span style="color: #27ae60; font-weight: bold;">💰 ' + paymentText + '</span>' : '<span style="color: #95a5a6;">-</span>'}
            </td>
            <td style="padding: 12px 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${entry.topic || '-'}">
                ${entry.topic || '-'}
            </td>
            <td style="padding: 12px 8px; text-align: center; white-space: nowrap;">
                <button onclick="adminEditEntry('${entry.id}')" style="padding: 6px 12px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; margin: 2px; font-size: 12px;" title="Edit Entry">
                    ✏️ Edit
                </button>
                <button onclick="adminDeleteEntry('${entry.id}')" style="padding: 6px 12px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; margin: 2px; font-size: 12px;" title="Delete Entry">
                    🗑️ Delete
                </button>
            </td>
        </tr>
    `}).join('');
}

// Update stats
function updateStats(allEntries, filteredEntries) {
    const totalEntriesEl = document.getElementById("totalEntriesCount");
    const filteredEntriesEl = document.getElementById("filteredEntriesCount");
    const teachersCountEl = document.getElementById("teachersCount");
    const studentsCountEl = document.getElementById("studentsCount");
    
    if (totalEntriesEl) totalEntriesEl.textContent = allEntries.length;
    if (filteredEntriesEl) filteredEntriesEl.textContent = filteredEntries.length;
    
    if (teachersCountEl) {
        const uniqueTeachers = new Set(filteredEntries.map(e => e.teacherName).filter(Boolean));
        teachersCountEl.textContent = uniqueTeachers.size;
    }
    
    if (studentsCountEl) {
        const uniqueStudents = new Set(filteredEntries.map(e => e.studentName || e.student).filter(Boolean));
        studentsCountEl.textContent = uniqueStudents.size;
    }
}

// Update pagination controls
function updatePaginationControls(currentPage, totalPages) {
    const pageInfo = document.getElementById("pageInfo");
    const prevBtn = document.getElementById("prevPageBtn");
    const nextBtn = document.getElementById("nextPageBtn");
    
    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
    
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        prevBtn.style.opacity = currentPage <= 1 ? '0.5' : '1';
        prevBtn.style.cursor = currentPage <= 1 ? 'not-allowed' : 'pointer';
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.opacity = currentPage >= totalPages ? '0.5' : '1';
        nextBtn.style.cursor = currentPage >= totalPages ? 'not-allowed' : 'pointer';
    }
}

// Pagination functions
window.goToPreviousPage = function() {
    if (currentPage > 1) {
        currentPage--;
        displayAdminEntries();
    }
};

window.goToNextPage = function() {
    const totalPages = Math.ceil(filteredAdminEntries.length / entriesPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        displayAdminEntries();
    }
};

window.changeEntriesPerPage = function() {
    const select = document.getElementById("entriesPerPage");
    entriesPerPage = parseInt(select.value);
    currentPage = 1;
    displayAdminEntries();
};

// Filter entries table by search (legacy function, kept for compatibility)
window.filterEntriesTable = function() {
    // Now redirects to advanced filter
    const searchInput = document.getElementById("searchEntries");
    if (searchInput) {
        document.getElementById("filterSearch").value = searchInput.value;
        applyAdminFilters();
    }
};

// Admin edit entry - opens in modal or navigates to form
window.adminEditEntry = async function(docId) {
    const confirmed = confirm("Edit this entry? You will be taken to the teacher entry form.");
    if (!confirmed) return;
    
    // Store entry ID for editing
    localStorage.setItem("editEntryId", docId);
    // Navigate to a page where admin can edit (could be teacher.html or custom admin edit page)
    window.location.href = "teacher.html?edit=" + docId;
};

// Admin delete entry - no restrictions
window.adminDeleteEntry = async function(docId) {
    if (!confirm("Are you sure you want to permanently delete this entry?\\nThis cannot be undone!")) return;

    try {
        await deleteDoc(doc(db, "entries", docId));
        alert("✅ Entry deleted successfully!");
        loadAdminEntries();
    } catch (error) {
        console.error("Error deleting entry:", error);
        alert("❌ Error deleting entry. Check console.");
    }
};

// Open add entry modal
window.openAddEntryModal = async function() {
    const modal = document.getElementById("addEntryModal");
    if (!modal) return;
    
    // Load active teachers
    const teachersQuery = query(collection(db, "teachers"), where("status", "==", "active"));
    const teachersSnapshot = await getDocs(teachersQuery);
    const teacherSelect = document.getElementById("adminEntryTeacher");
    
    if (teacherSelect) {
        teacherSelect.innerHTML = '<option value="">Select Teacher</option>';
        teachersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            teacherSelect.innerHTML += `<option value="${doc.id}">${data.name}</option>`;
        });
    }
    
    // Load active students
    const studentsQuery = query(collection(db, "students"), where("status", "==", "active"));
    const studentsSnapshot = await getDocs(studentsQuery);
    const studentSelect = document.getElementById("adminEntryStudent");
    
    if (studentSelect) {
        studentSelect.innerHTML = '<option value="">Select Student</option>';
        const students = studentsSnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name
        })).sort((a, b) => a.name.localeCompare(b.name));
        
        students.forEach(student => {
            studentSelect.innerHTML += `<option value="${student.id}">${student.name}</option>`;
        });
    }
    
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("adminEntryDate").value = today;
    
    modal.style.display = "block";
};

// Close add entry modal
window.closeAddEntryModal = function() {
    const modal = document.getElementById("addEntryModal");
    if (modal) {
        modal.style.display = "none";
        document.getElementById("adminEntryForm").reset();
    }
};

// Save admin entry
window.saveAdminEntry = async function(event) {
    event.preventDefault();
    
    const date = document.getElementById("adminEntryDate").value;
    const teacherId = document.getElementById("adminEntryTeacher").value;
    const studentId = document.getElementById("adminEntryStudent").value;
    const timeFrom = document.getElementById("adminEntryTimeFrom").value;
    const timeTo = document.getElementById("adminEntryTimeTo").value;
    const classCount = parseInt(document.getElementById("adminEntryClasses").value);
    const sheetMade = document.querySelector('input[name="adminEntrySheetMade"]:checked')?.value;
    const topic = document.getElementById("adminEntryTopic").value;
    const payment = document.getElementById("adminEntryPayment").value.trim();
    
    // Validate time range
    if (timeFrom >= timeTo) {
        alert("'Time To' must be later than 'Time From'");
        return;
    }
    
    try {
        // Get teacher data
        const teacherDoc = await getDoc(doc(db, "teachers", teacherId));
        if (!teacherDoc.exists()) {
            alert("❌ Teacher not found!");
            return;
        }
        const teacherData = teacherDoc.data();
        
        // Get student data
        const studentDoc = await getDoc(doc(db, "students", studentId));
        if (!studentDoc.exists()) {
            alert("❌ Student not found!");
            return;
        }
        const studentData = studentDoc.data();
        
        // Calculate day of week
        const dateObj = new Date(date + 'T00:00:00');
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayOfWeek = days[dateObj.getDay()];
        
        // Save entry
        await addDoc(collection(db, "entries"), {
            teacherId: teacherId,
            teacherName: teacherData.name,
            teacherEmail: teacherData.email || "",
            studentId: studentId,
            studentName: studentData.name,
            date: date,
            dayOfWeek: dayOfWeek,
            timeFrom: timeFrom,
            timeTo: timeTo,
            classCount: classCount,
            sheetMade: sheetMade,
            topic: topic,
            payment: payment || "",
            createdAt: Timestamp.now()
        });
        
        alert("✅ Entry added successfully!");
        closeAddEntryModal();
        loadAdminEntries();
        
    } catch (error) {
        console.error("Error adding entry:", error);
        alert("❌ Error adding entry. Check console.");
    }
};

// ========== REPORTS PAGE FUNCTIONS ==========

let allEntriesData = [];

// Load all entries for reports page
window.loadReportsData = async function() {
    const entriesList = document.getElementById("entriesList");
    const filterTeacher = document.getElementById("filterTeacher");
    const filterStudent = document.getElementById("filterStudent");

    if (!entriesList) return;

    entriesList.innerHTML = '<div class="loading">Loading entries...</div>';

    try {
        // Fetch all entries
        const snapshot = await getDocs(collection(db, "entries"));
        
        allEntriesData = [];
        snapshot.forEach(doc => {
            allEntriesData.push({ id: doc.id, ...doc.data() });
        });

        // Sort by most recent first
        allEntriesData.sort((a, b) => {
            const aTime = a.createdAt?.toMillis() || 0;
            const bTime = b.createdAt?.toMillis() || 0;
            return bTime - aTime;
        });

        // Populate filter dropdowns
        if (filterTeacher && filterStudent) {
            const teachers = [...new Set(allEntriesData.map(e => e.teacherName).filter(Boolean))].sort();
            const students = [...new Set(allEntriesData.map(e => e.student).filter(Boolean))].sort();

            filterTeacher.innerHTML = '<option value="">All Teachers</option>' + 
                teachers.map(t => `<option value="${t}">${t}</option>`).join('');
            
            filterStudent.innerHTML = '<option value="">All Students</option>' + 
                students.map(s => `<option value="${s}">${s}</option>`).join('');
        }

        // Display all entries initially
        displayEntries(allEntriesData);

    } catch (error) {
        console.error("Error loading reports data:", error);
        entriesList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-text">Error loading entries</div></div>';
    }
};

// Display entries in card format
function displayEntries(entries) {
    const entriesList = document.getElementById("entriesList");
    const entriesCount = document.getElementById("entriesCount");

    if (!entriesList) return;

    // Update count
    if (entriesCount) {
        entriesCount.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
    }

    // Check if empty
    if (entries.length === 0) {
        entriesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <div class="empty-state-text">No entries found</div>
                <p>Try adjusting your filters or create a new entry</p>
            </div>
        `;
        return;
    }

    // Display entries
    entriesList.innerHTML = entries.map(entry => {
        const paymentDisplay = entry.payment ? 
            `<span class="badge badge-payment">💰 ${entry.payment}</span>` : 
            '<span style="color: #95a5a6;">No payment</span>';
        
        const sheetDisplay = entry.sheetMade === 'yes' ? 
            '<span class="badge badge-yes">📄 Yes</span>' : 
            entry.sheetMade === 'no' ?
            '<span class="badge badge-no">📄 No</span>' :
            '<span style="color: #95a5a6;">-</span>';
        
        const studentName = entry.studentName || entry.student || 'N/A';

        return `
            <div class="entry-card">
                <div class="entry-top">
                    <div class="entry-field">
                        <div class="entry-label">Date & Day</div>
                        <div class="entry-value large">${entry.date || 'N/A'}<br><small style="color: #7f8c8d;">${entry.dayOfWeek || ''}</small></div>
                    </div>
                    <div class="entry-field">
                        <div class="entry-label">Teacher</div>
                        <div class="entry-value">${entry.teacherName || 'N/A'}</div>
                    </div>
                    <div class="entry-field">
                        <div class="entry-label">Student</div>
                        <div class="entry-value">${studentName}</div>
                    </div>
                    <div class="entry-field">
                        <div class="entry-label">Time</div>
                        <div class="entry-value">${entry.timeFrom || 'N/A'} - ${entry.timeTo || 'N/A'}</div>
                    </div>
                    <div class="entry-field">
                        <div class="entry-label">Classes</div>
                        <div class="entry-value">${entry.classCount || 'N/A'}</div>
                    </div>
                    <div class="entry-field">
                        <div class="entry-label">Sheet Made</div>
                        <div class="entry-value">${sheetDisplay}</div>
                    </div>
                    <div class="entry-field">
                        <div class="entry-label">Payment</div>
                        <div class="entry-value">${paymentDisplay}</div>
                    </div>
                </div>
                <div class="entry-topic">
                    <div class="entry-topic-label">Topic</div>
                    <div class="entry-topic-text">${entry.topic || 'No topic provided'}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Apply filters
window.applyFilters = function() {
    const filterTeacher = document.getElementById("filterTeacher")?.value;
    const filterStudent = document.getElementById("filterStudent")?.value;
    const filterDateFrom = document.getElementById("filterDateFrom")?.value;
    const filterDateTo = document.getElementById("filterDateTo")?.value;
    const filterSheet = document.getElementById("filterSheet")?.value;

    let filtered = [...allEntriesData];

    // Filter by teacher
    if (filterTeacher) {
        filtered = filtered.filter(e => e.teacherName === filterTeacher);
    }

    // Filter by student
    if (filterStudent) {
        filtered = filtered.filter(e => (e.studentName || e.student) === filterStudent);
    }

    // Filter by date range
    if (filterDateFrom) {
        filtered = filtered.filter(e => e.date >= filterDateFrom);
    }

    if (filterDateTo) {
        filtered = filtered.filter(e => e.date <= filterDateTo);
    }

    // Filter by sheet made
    if (filterSheet) {
        filtered = filtered.filter(e => e.sheetMade === filterSheet);
    }

    displayEntries(filtered);
};

// Reset filters
window.resetFilters = function() {
    document.getElementById("filterTeacher").value = "";
    document.getElementById("filterStudent").value = "";
    document.getElementById("filterDateFrom").value = "";
    document.getElementById("filterDateTo").value = "";
    document.getElementById("filterSheet").value = "";
    
    displayEntries(allEntriesData);
};

// Teacher page initialization
if (window.location.pathname.includes('teacher.html')) {
    document.addEventListener('DOMContentLoaded', function() {
        const role = localStorage.getItem("role");
        const teacherEmail = localStorage.getItem("teacherEmail");
        
        if (role !== "teacher" || !teacherEmail) {
            alert("Please login as a teacher first!");
            window.location.href = "index.html";
            return;
        }

        // Load students and recent entries
        loadStudentsForTeacher();
        loadRecentEntries();
        
        // Setup form submission (prevent multiple listeners)
        const form = document.getElementById("entryForm");
        if (form) {
            // Remove any existing listeners by cloning and replacing
            const newForm = form.cloneNode(true);
            form.parentNode.replaceChild(newForm, form);
            
            // Add single event listener
            newForm.addEventListener("submit", saveEntry);
        }
    });
}

// Reports page initialization
if (window.location.pathname.includes('reports.html')) {
    document.addEventListener('DOMContentLoaded', function() {
        const role = localStorage.getItem("role");
        
        if (!role) {
            alert("Please login first!");
            window.location.href = "index.html";
            return;
        }

        loadReportsData();
    });
}

// ===== ADVANCED REPORTS - TEACHER ANALYTICS =====
window.showAdvancedReports = function() {
    const modal = document.getElementById("advancedReportsModal");
    if (modal) {
        modal.style.display = "block";
        loadAdvancedReports();
    }
}

window.closeAdvancedReports = function() {
    const modal = document.getElementById("advancedReportsModal");
    if (modal) {
        modal.style.display = "none";
    }
}

window.loadAdvancedReports = async function() {
    const contentDiv = document.getElementById("advancedReportContent");
    const timePeriod = document.getElementById("advancedTimePeriod")?.value || "30";
    
    if (!contentDiv) return;
    
    contentDiv.innerHTML = '<div style="text-align: center; padding: 48px; color: #666666; font-family: \'Roboto\', sans-serif; font-size: 14px;">Loading teacher analytics...</div>';
    
    try {
        // Get all entries
        const entriesQuery = query(collection(db, "entries"));
        const snapshot = await getDocs(entriesQuery);
        
        // Calculate date filter
        let startDate = null;
        if (timePeriod !== "all") {
            const days = parseInt(timePeriod);
            startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
        }
        
        // Process entries per teacher
        const teacherStats = {};
        
        snapshot.docs.forEach(doc => {
            const entry = doc.data();
            const entryDate = entry.createdAt?.toDate() || new Date(entry.date);
            
            // Filter by date
            if (startDate && entryDate < startDate) return;
            
            const teacherName = entry.teacherName || "Unknown";
            
            if (!teacherStats[teacherName]) {
                teacherStats[teacherName] = {
                    totalClasses: 0,
                    totalSessions: 0,
                    students: new Set(),
                    totalPayment: 0
                };
            }
            
            teacherStats[teacherName].totalClasses += parseInt(entry.classCount) || 0;
            teacherStats[teacherName].totalSessions += 1;
            if (entry.studentName) {
                teacherStats[teacherName].students.add(entry.studentName);
            }
            
            // Parse payment
            const payment = entry.payment || "";
            const match = payment.match(/\d+/);
            if (match) {
                teacherStats[teacherName].totalPayment += parseInt(match[0]);
            }
        });
        
        // Sort teachers by total classes (descending)
        const sortedTeachers = Object.entries(teacherStats).sort((a, b) => b[1].totalClasses - a[1].totalClasses);
        
        if (sortedTeachers.length === 0) {
            contentDiv.innerHTML = '<div style="text-align: center; padding: 48px; color: #666666; font-family: \'Roboto\', sans-serif; font-size: 14px;">No data found for the selected time period.</div>';
            return;
        }
        
        // Build HTML
        let html = '<div style="overflow-x: auto;">';
        html += '<table style="width: 100%; border-collapse: collapse; font-family: \'Roboto\', sans-serif;">';
        html += '<thead><tr style="background: #f8f9fa; border-bottom: 2px solid #dadce0;">';
        html += '<th style="padding: 12px; text-align: left; font-weight: 600; font-size: 13px; color: #2c2c2c; text-transform: uppercase; letter-spacing: 0.5px;">Teacher Name</th>';
        html += '<th style="padding: 12px; text-align: center; font-weight: 600; font-size: 13px; color: #2c2c2c; text-transform: uppercase; letter-spacing: 0.5px;">Total Classes</th>';
        html += '<th style="padding: 12px; text-align: center; font-weight: 600; font-size: 13px; color: #2c2c2c; text-transform: uppercase; letter-spacing: 0.5px;">Total Sessions</th>';
        html += '<th style="padding: 12px; text-align: center; font-weight: 600; font-size: 13px; color: #2c2c2c; text-transform: uppercase; letter-spacing: 0.5px;">Students Taught</th>';
        html += '<th style="padding: 12px; text-align: right; font-weight: 600; font-size: 13px; color: #2c2c2c; text-transform: uppercase; letter-spacing: 0.5px;">Total Payment</th>';
        html += '</tr></thead><tbody>';
        
        sortedTeachers.forEach(([teacherName, stats], index) => {
            const bgColor = index % 2 === 0 ? 'white' : '#f8f9fa';
            html += `<tr style="background: ${bgColor}; border-bottom: 1px solid #f0f0f0;">`;
            html += `<td style="padding: 12px; font-size: 14px; color: #2c2c2c; font-weight: 500;">${teacherName}</td>`;
            html += `<td style="padding: 12px; text-align: center; font-size: 18px; font-weight: 600; color: #d4af37;">${stats.totalClasses}</td>`;
            html += `<td style="padding: 12px; text-align: center; font-size: 14px; color: #666666;">${stats.totalSessions}</td>`;
            html += `<td style="padding: 12px; text-align: center; font-size: 14px; color: #666666;">${stats.students.size}</td>`;
            html += `<td style="padding: 12px; text-align: right; font-size: 14px; color: #90ee90; font-weight: 500;">₹${stats.totalPayment}</td>`;
            html += '</tr>';
        });
        
        html += '</tbody></table></div>';
        
        contentDiv.innerHTML = html;
        
    } catch (error) {
        console.error("Error loading advanced reports:", error);
        contentDiv.innerHTML = '<div style="text-align: center; padding: 48px; color: #d93025; font-family: \'Roboto\', sans-serif; font-size: 14px;">Error loading data. Please try again.</div>';
    }
}

// ===== PDF GENERATION FOR STUDENT REPORTS =====
window.generateStudentPDF = async function() {
    const selectedStudent = document.getElementById("searchStudentReport")?.value;
    const timePeriod = document.getElementById("timePeriodFilter")?.value || "30";
    
    if (!selectedStudent) {
        alert("Please select a student first!");
        return;
    }
    
    try {
        // Get student entries
        const entriesQuery = query(
            collection(db, "entries"),
            where("studentName", "==", selectedStudent)
        );
        
        const snapshot = await getDocs(entriesQuery);
        
        // Calculate date filter
        let startDate = null;
        if (timePeriod !== "all") {
            const days = parseInt(timePeriod);
            startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
        }
        
        // Filter and sort entries
        let entries = [];
        snapshot.docs.forEach(doc => {
            const entry = doc.data();
            const entryDate = entry.createdAt?.toDate() || new Date(entry.date);
            
            if (!startDate || entryDate >= startDate) {
                entries.push({
                    date: entry.date,
                    dayOfWeek: entry.dayOfWeek,
                    teacher: entry.teacherName || "N/A",
                    subject: entry.topic || "N/A",
                    timeFrom: entry.timeFrom || "",
                    timeTo: entry.timeTo || "",
                    classes: entry.classCount || 0,
                    sheetMade: entry.sheetMade || "No"
                });
            }
        });
        
        entries.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (entries.length === 0) {
            alert("No records found for the selected time period!");
            return;
        }
        
        // Generate PDF content
        const periodText = timePeriod === "all" ? "All Time" : 
                          timePeriod === "7" ? "Last 7 Days" :
                          timePeriod === "30" ? "Last 1 Month" :
                          timePeriod === "90" ? "Last 3 Months" :
                          timePeriod === "180" ? "Last 6 Months" :
                          "Last 1 Year";
        
        let pdfContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Student Report - ${selectedStudent}</title>
            <style>
                @media print {
                    body { margin: 0; padding: 20px; }
                    .no-print { display: none; }
                }
                body {
                    font-family: Arial, sans-serif;
                    max-width: 1000px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 3px solid #d4af37;
                    padding-bottom: 15px;
                }
                .header h1 {
                    color: #2c2c2c;
                    margin: 0 0 10px 0;
                }
                .header p {
                    color: #666666;
                    margin: 5px 0;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                th {
                    background: #90ee90;
                    color: #2c2c2c;
                    padding: 12px 8px;
                    text-align: left;
                    font-weight: bold;
                    border: 1px solid #dadce0;
                    font-size: 12px;
                }
                td {
                    padding: 10px 8px;
                    border: 1px solid #dadce0;
                    font-size: 11px;
                    color: #2c2c2c;
                }
                tr:nth-child(even) {
                    background: #f8f9fa;
                }
                .footer {
                    margin-top: 30px;
                    text-align: center;
                    color: #666666;
                    font-size: 12px;
                    border-top: 1px solid #dadce0;
                    padding-top: 15px;
                }
                .print-btn {
                    background: #1a73e8;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    margin: 20px auto;
                    display: block;
                }
                .print-btn:hover {
                    background: #1557b0;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>ZIEL - Student Progress Report</h1>
                <p><strong>Student Name:</strong> ${selectedStudent}</p>
                <p><strong>Report Period:</strong> ${periodText}</p>
                <p><strong>Generated On:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Total Sessions:</strong> ${entries.length}</p>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Day</th>
                        <th>Teacher</th>
                        <th>Subject/Topic</th>
                        <th>Time</th>
                        <th>Classes</th>
                        <th>Sheet Made</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        entries.forEach(entry => {
            const timeRange = entry.timeFrom && entry.timeTo ? `${entry.timeFrom} - ${entry.timeTo}` : "N/A";
            pdfContent += `
                    <tr>
                        <td>${entry.date}</td>
                        <td>${entry.dayOfWeek}</td>
                        <td>${entry.teacher}</td>
                        <td>${entry.subject}</td>
                        <td>${timeRange}</td>
                        <td style="text-align: center;">${entry.classes}</td>
                        <td style="text-align: center;">${entry.sheetMade}</td>
                    </tr>
            `;
        });
        
        pdfContent += `
                </tbody>
            </table>
            
            <div class="footer">
                <p>This is a computer-generated report from ZIEL Management System</p>
            </div>
            
            <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
            
            <script>
                // Auto print dialog on load (optional)
                // window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
        `;
        
        // Open in new window
        const printWindow = window.open('', '_blank');
        printWindow.document.write(pdfContent);
        printWindow.document.close();
        
    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Error generating PDF. Please try again.");
    }
}

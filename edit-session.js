// Initialize form data from localStorage
let teachers = [];
let students = [];
let entries = [];
let editingIndex = -1;

// Load data on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check if there's an entry to edit
    const storedIndex = localStorage.getItem('editingEntryIndex');
    const storedEntry = localStorage.getItem('editingEntry');
    
    if (!storedIndex || !storedEntry) {
        alert('No entry to edit.');
        window.location.href = 'teacher.html';
        return;
    }
    
    editingIndex = parseInt(storedIndex);
    const entry = JSON.parse(storedEntry);
    
    loadTeachersAndStudents();
    populateTeacherDropdown();
    populateStudentDropdown();
    setupSearchableSelect();
    prefillForm(entry);
    setupFormSubmission();
});

// Load teachers and students from localStorage
function loadTeachersAndStudents() {
    const storedTeachers = localStorage.getItem('teachers');
    if (storedTeachers) {
        teachers = JSON.parse(storedTeachers);
    } else {
        teachers = [
            { id: 1, name: 'Prof. Anderson' },
            { id: 2, name: 'Dr. Williams' },
            { id: 3, name: 'Dr. Brown' },
            { id: 4, name: 'Ms. Johnson' },
            { id: 5, name: 'Mr. Davis' }
        ];
    }

    const storedStudents = localStorage.getItem('students');
    if (storedStudents) {
        students = JSON.parse(storedStudents);
    } else {
        students = [
            { id: 1, name: 'John Doe' },
            { id: 2, name: 'Jane Smith' },
            { id: 3, name: 'Mike Johnson' },
            { id: 4, name: 'Emily Davis' },
            { id: 5, name: 'Sarah Wilson' },
            { id: 6, name: 'David Brown' },
            { id: 7, name: 'Lisa Anderson' },
            { id: 8, name: 'Tom Martinez' },
            { id: 9, name: 'Anna Taylor' },
            { id: 10, name: 'Chris Lee' }
        ];
    }

    const storedEntries = localStorage.getItem('entries');
    if (storedEntries) {
        entries = JSON.parse(storedEntries);
    }
}

// Populate teacher dropdown
function populateTeacherDropdown() {
    const teacherSelect = document.getElementById('teacher-name');
    teacherSelect.innerHTML = '<option value="">Select Teacher</option>';
    
    teachers.forEach(teacher => {
        const option = document.createElement('option');
        option.value = teacher.name;
        option.textContent = teacher.name;
        teacherSelect.appendChild(option);
    });
}

// Populate student dropdown
function populateStudentDropdown() {
    const studentSelect = document.getElementById('student-name');
    studentSelect.innerHTML = '<option value="">Select Student</option>';
    
    students.forEach(student => {
        const option = document.createElement('option');
        option.value = student.name;
        option.textContent = student.name;
        studentSelect.appendChild(option);
    });
}

// Setup searchable select for students
function setupSearchableSelect() {
    const searchInput = document.getElementById('student-search');
    const studentSelect = document.getElementById('student-name');
    
    // Filter students as user types (case-insensitive)
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        const options = studentSelect.querySelectorAll('option');
        let visibleCount = 0;
        
        options.forEach(option => {
            if (option.value === '') {
                option.style.display = 'none'; // Hide placeholder when searching
                return;
            }
            
            const studentName = option.textContent.toLowerCase();
            
            // Show if search term is empty OR if name contains search term
            if (searchTerm === '' || studentName.includes(searchTerm)) {
                option.style.display = 'block';
                visibleCount++;
            } else {
                option.style.display = 'none';
            }
        });
        
        // Show the select dropdown if there's input and visible options
        if (searchTerm !== '' && visibleCount > 0) {
            studentSelect.style.display = 'block';
        } else if (searchTerm === '') {
            studentSelect.style.display = 'none';
        }
    });
    
    // When student is selected from dropdown, update search input
    studentSelect.addEventListener('change', function() {
        if (this.value) {
            searchInput.value = this.value;
            studentSelect.style.display = 'none';
        }
    });
    
    // When clicking on select, show all options
    studentSelect.addEventListener('click', function(e) {
        if (e.target.tagName === 'OPTION' && e.target.value) {
            searchInput.value = e.target.value;
            studentSelect.style.display = 'none';
        }
    });
    
    // Show dropdown when search input is focused (if there's text)
    searchInput.addEventListener('focus', function() {
        if (this.value.trim() !== '') {
            // Re-trigger filter to show matching options
            this.dispatchEvent(new Event('input'));
        }
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.searchable-select')) {
            studentSelect.style.display = 'none';
        }
    });
}

// Convert 12-hour time to 24-hour format for input
function convertTo24Hour(time12) {
    const [time, period] = time12.split(' ');
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours);
    
    if (period === 'PM' && hours !== 12) {
        hours += 12;
    } else if (period === 'AM' && hours === 12) {
        hours = 0;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

// Convert 24-hour time to 12-hour format with AM/PM
function formatTimeTo12Hour(time24) {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

// Prefill form with existing entry data
function prefillForm(entry) {
    document.getElementById('teacher-name').value = entry.teacher;
    document.getElementById('student-search').value = entry.student;
    document.getElementById('student-name').value = entry.student;
    document.getElementById('session-date').value = entry.date;
    document.getElementById('session-time').value = convertTo24Hour(entry.time);
    document.getElementById('session-duration').value = entry.duration.toString();
    document.getElementById('session-topic').value = entry.topic;
    document.getElementById('session-notes').value = entry.notes || '';
}

// Setup form submission
function setupFormSubmission() {
    const form = document.getElementById('edit-session-form');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form values
        const teacherName = document.getElementById('teacher-name').value;
        const studentName = document.getElementById('student-name').value || document.getElementById('student-search').value;
        const sessionDate = document.getElementById('session-date').value;
        const sessionTime = document.getElementById('session-time').value;
        const sessionDuration = parseInt(document.getElementById('session-duration').value);
        const sessionTopic = document.getElementById('session-topic').value;
        const sessionNotes = document.getElementById('session-notes').value;
        
        // Validate student name
        if (!studentName || !students.find(s => s.name === studentName)) {
            alert('Please select a valid student from the list.');
            return;
        }
        
        // Update entry object (preserve original createdAt)
        const originalEntry = entries[editingIndex];
        const updatedEntry = {
            teacher: teacherName,
            student: studentName,
            date: sessionDate,
            time: formatTimeTo12Hour(sessionTime),
            duration: sessionDuration,
            topic: sessionTopic,
            notes: sessionNotes,
            createdAt: originalEntry.createdAt // Keep original creation time
        };
        
        // Update in entries array
        entries[editingIndex] = updatedEntry;
        
        // Save to localStorage["entries"]
        localStorage.setItem('entries', JSON.stringify(entries));
        
        // Clear editing data
        localStorage.removeItem('editingEntryIndex');
        localStorage.removeItem('editingEntry');
        
        alert('Session updated successfully!');
        window.location.href = 'teacher.html';
    });
}

// Cancel editing
function cancelEdit() {
    localStorage.removeItem('editingEntryIndex');
    localStorage.removeItem('editingEntry');
    window.location.href = 'teacher.html';
}

# ZIEL Teacher Management System - Testing Checklist

## Test Date: December 5, 2025

### Phase 1: Data Import ✅
- [ ] Open http://127.0.0.1:5000/import-students.html
- [ ] Click "✅ Import Students" button
- [ ] Verify 290+ students are imported
- [ ] Check for success message showing count

### Phase 2: Migration (If needed)
- [ ] Open http://127.0.0.1:5000/migrate-to-status.html
- [ ] Click "🔍 Check Status" to see if migration needed
- [ ] If needed, click "🚀 Migrate Data"
- [ ] Verify all documents now have `status` field

### Phase 3: Admin Panel Testing
- [ ] Open http://127.0.0.1:5000/index.html
- [ ] Login with password: `admin123`
- [ ] Verify redirect to admin.html

#### 3a: Verify Active Students
- [ ] Go to Students tab
- [ ] Verify 290+ students shown
- [ ] Test search functionality
- [ ] Toggle a student to inactive
- [ ] Verify inactive students hidden by default
- [ ] Check "Show Inactive" checkbox
- [ ] Verify inactive student now visible

#### 3b: Verify Teachers
- [ ] Go to Teachers tab
- [ ] Verify teachers listed with emails
- [ ] Test adding a new teacher with email
- [ ] Verify unique email constraint (try duplicate)
- [ ] Toggle teacher status

#### 3c: View All Entries
- [ ] Go to "View All Entries" tab
- [ ] Verify entries table shows: Teacher, Email, Student, Date, Time, Classes, Topic, Actions
- [ ] Test search filter
- [ ] Verify Edit and Delete buttons present

### Phase 4: Teacher Login Testing
- [ ] Logout from admin
- [ ] Login with password: `teacher123`
- [ ] Select a teacher from dropdown (e.g., "Prof. Anderson")
- [ ] Enter teacher's email (e.g., "anderson@ziel.edu")
- [ ] Verify redirect to teacher.html

### Phase 5: Teacher Entry Form Testing

#### 5a: Form Display
- [ ] Verify form shows all fields:
  - Date (date picker)
  - Student Name (dropdown with search)
  - Time From (time picker)
  - Time To (time picker)
  - Number of Classes (1-10)
  - Sheet Made (Yes/No radio)
  - Topic (textarea)
  - Payment (optional text)

#### 5b: Student Dropdown
- [ ] Click on student search box
- [ ] Type a few letters (e.g., "San")
- [ ] Verify dropdown filters students
- [ ] Select a student
- [ ] Verify only ACTIVE students appear

#### 5c: Form Validation
- [ ] Try submitting empty form
- [ ] Verify required field validation
- [ ] Enter Time To before Time From
- [ ] Verify time range validation error

#### 5d: Successful Entry Creation
- [ ] Fill all required fields:
  - Date: Today's date
  - Student: Select any active student
  - Time From: 09:00
  - Time To: 10:00
  - Classes: 2
  - Sheet Made: Yes
  - Topic: "Introduction to Variables"
  - Payment: "500" (optional)
- [ ] Click "💾 Save Entry"
- [ ] Verify success message
- [ ] Verify form clears
- [ ] Verify entry appears in "Last 24 Hours" section below

### Phase 6: Recent Entries Display
- [ ] Verify entry shows:
  - Date and Day of Week
  - Student Name
  - Time Range
  - Number of Classes
  - Sheet Made (Yes/No with icon)
  - Payment (or "No payment")
  - Topic
  - Edit and Delete buttons

### Phase 7: Edit Entry Testing (Within 24 hours)
- [ ] Click "✏️ Edit" on recent entry
- [ ] Verify form populates with entry data
- [ ] Modify topic text
- [ ] Click "💾 Save Entry"
- [ ] Verify "Entry updated successfully" message
- [ ] Verify changes reflected in recent entries

### Phase 8: Delete Entry Testing (Within 24 hours)
- [ ] Create a new entry
- [ ] Click "🗑️ Delete" button
- [ ] Confirm deletion
- [ ] Verify entry removed from list
- [ ] Verify success message

### Phase 9: 24-Hour Restriction Testing
To simulate old entry:
- [ ] Create entry with timestamp > 24 hours ago (requires DB manipulation OR wait 24 hours)
- [ ] Verify Edit button shows "🔒 Locked (>24hrs)" or is disabled
- [ ] Try clicking edit, verify error message
- [ ] Try clicking delete, verify error message shows hours since creation

### Phase 10: Reports Page Testing
- [ ] Click "📊 View Reports" button
- [ ] Verify redirect to reports.html
- [ ] Verify all entries displayed in card format

#### 10a: Filter Testing
- [ ] Test Teacher filter dropdown
- [ ] Test Student filter dropdown
- [ ] Test Date From filter
- [ ] Test Date To filter
- [ ] Test Sheet Made filter
- [ ] Test combination of filters
- [ ] Click "🔄 Reset Filters"
- [ ] Verify all filters clear and all entries show

#### 10b: Entry Count Badge
- [ ] Verify badge shows correct count
- [ ] Apply filter, verify count updates
- [ ] Reset filter, verify count updates

### Phase 11: Admin Entry Management
- [ ] Login as admin
- [ ] Go to "View All Entries" tab
- [ ] Click "✏️" Edit button on any entry
- [ ] Verify admin can edit ANY entry (no 24-hour restriction)
- [ ] Click "🗑️" Delete button on any entry
- [ ] Verify admin can delete ANY entry (no 24-hour restriction)

### Phase 12: Data Structure Verification
Open browser console and check Firestore:
- [ ] Verify students have: `name`, `status`, `createdAt`
- [ ] Verify teachers have: `name`, `email`, `status`, `createdAt`
- [ ] Verify entries have:
  - `teacherId`
  - `teacherName`
  - `teacherEmail`
  - `studentId`
  - `studentName`
  - `date`
  - `dayOfWeek`
  - `timeFrom`
  - `timeTo`
  - `classCount`
  - `sheetMade`
  - `topic`
  - `payment`
  - `createdAt`

### Phase 13: Security Testing

#### 13a: Teacher Isolation
- [ ] Login as Teacher A
- [ ] Create several entries
- [ ] Logout
- [ ] Login as Teacher B
- [ ] Verify Teacher B CANNOT see Teacher A's entries
- [ ] Verify Teacher B can only see their own entries

#### 13b: Ownership Enforcement
- [ ] As Teacher A, try to edit entry created by Teacher B (requires DB ID)
- [ ] Verify error: "You can only edit your own entries!"

#### 13c: Email-Based Filtering
- [ ] Create multiple teachers with same name but different emails
- [ ] Verify entries are correctly isolated by email, not name

### Phase 14: Edge Cases

#### 14a: Empty States
- [ ] New teacher with no entries
- [ ] Verify "No recent entries in the last 24 hours" message
- [ ] Inactive student selected
- [ ] Verify form validation

#### 14b: Special Characters
- [ ] Create entry with special characters in topic: `Testing < > & " '`
- [ ] Verify proper encoding and display
- [ ] Create student with special characters in name

#### 14c: Long Text
- [ ] Enter very long topic (500+ characters)
- [ ] Verify saves correctly
- [ ] Verify displays without breaking layout

### Phase 15: Performance Testing
- [ ] With 290+ students, test dropdown load time
- [ ] With 50+ entries, test reports page load time
- [ ] Test search functionality with large dataset

## Known Issues / Notes
Document any issues found during testing:

1. 
2. 
3. 

## Test Results Summary
- Total Tests: 100+
- Passed: ___
- Failed: ___
- Skipped: ___

## Sign-off
Tested by: _______________
Date: _______________
Status: [ ] PASS [ ] FAIL [ ] NEEDS REVIEW

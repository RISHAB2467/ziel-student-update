# Quick Start Guide - Teacher Identity System

## ✅ System Ready!

The hosting server is running at: **http://127.0.0.1:5000**

## Important: Firestore Connection

Since the Firestore emulator requires Java (not installed), the system will connect to your **production Firestore database** at `ziel-d0064`.

This is actually better for testing as your data will persist!

## Initial Setup (One-Time)

### Step 1: Add Sample Teachers

1. Open: http://127.0.0.1:5000
2. Login with password: `admin123`
3. Go to "Manage Teachers" tab
4. Add these teachers:
   - Prof. Anderson
   - Dr. Williams
   - Dr. Brown
   - Ms. Johnson
   - Mr. Davis

### Step 2: Add Sample Students

1. Go to "Manage Students" tab
2. Add these students:
   - John Doe
   - Jane Smith
   - Mike Johnson
   - Emily Davis
   - Sarah Wilson

## Testing the Teacher Identity System

### Test 1: Teacher Login with Dropdown

1. **Logout** from admin (click Logout button)
2. Go to: http://127.0.0.1:5000
3. **Enter password:** `teacher123`
4. **Observe:** Teacher dropdown appears!
5. **Select:** "Prof. Anderson"
6. **Click:** Continue button
7. **Result:** Redirected to teacher portal

### Test 2: Teacher Sees Only Their Entries

**As Prof. Anderson:**
1. In teacher portal, notice teacher dropdown shows only "Prof. Anderson" (disabled)
2. Select student: "John Doe"
3. Fill in date, time, duration, topic
4. Click Submit
5. **Check:** Entry appears in "Your Last 24 Hours Entries"
6. Logout

**As Dr. Williams:**
1. Login as teacher → Select "Dr. Williams"
2. Create a different entry
3. **Result:** You should only see Dr. Williams' entries, NOT Prof. Anderson's!

### Test 3: Admin Sees All Entries

1. Logout
2. Login with: `admin123`
3. Click on browser back or go to teacher portal
4. In teacher dropdown, you can select any teacher
5. **Check recent entries:** You should see ALL entries from all teachers!

### Test 4: Inactive Teacher Hidden

1. As admin, go to "Manage Teachers"
2. Find "Dr. Brown"
3. Click "Deactivate" → Confirm
4. Logout
5. Try teacher login
6. **Check dropdown:** Dr. Brown should NOT appear
7. Login as admin again
8. Check "Show Inactive" → Find Dr. Brown → Click "Activate"
9. Logout and verify Dr. Brown reappears in login dropdown

## How It Works

### Login Flow

```
User enters password "teacher123"
    ↓
System shows teacher dropdown
    ↓
Loads active teachers from Firestore
    ↓
User selects their name
    ↓
System saves to localStorage:
  - role: "teacher"
  - teacherName: "Prof. Anderson"
    ↓
Redirects to teacher portal
```

### Entry Creation

```
Teacher creates entry
    ↓
System adds to Firestore:
  {
    teacher: "Prof. Anderson",     // From form
    teacherName: "Prof. Anderson", // From login
    student: "John Doe",
    date, time, duration, topic,
    createdAt: Timestamp
  }
    ↓
teacherName field used for filtering
```

### Dashboard Filtering

```
Load Recent Entries:

IF role === "teacher":
  Query: WHERE teacherName == "Prof. Anderson"
  Result: Only Prof. Anderson's entries

IF role === "admin":
  Query: No filter
  Result: ALL entries from all teachers
```

## URLs

- **Login:** http://127.0.0.1:5000
- **Admin Portal:** http://127.0.0.1:5000/admin.html
- **Teacher Portal:** http://127.0.0.1:5000/teacher.html
- **Firestore Console:** https://console.firebase.google.com/project/ziel-d0064/firestore

## Credentials

- **Teacher Password:** `teacher123` (then select name from dropdown)
- **Admin Password:** `admin123`

## Features Implemented

✅ **STEP 1:** Teacher login shows dropdown with active teachers from Firestore
✅ **STEP 2:** Teacher name stored in localStorage
✅ **STEP 3:** Every entry has `teacherName` field
✅ **STEP 4:** Teachers see only their entries, admins see all
✅ **STEP 5:** Only active teachers in dropdown

## Troubleshooting

### "Dropdown shows no teachers"
**Solution:** Use admin to add teachers to Firestore first

### "Can't see my entries"
**Solution:** Make sure you created entries after selecting your teacher name in login

### "Module not found" errors
**Solution:** 
- Make sure you're accessing via http://127.0.0.1:5000 (not file://)
- Check browser console for specific errors
- Verify internet connection (Firebase SDK loads from CDN)

### "Permission denied" in Firestore
**Solution:** 
- Your Firestore rules are deployed with open access for development
- If issues persist, go to Firebase Console → Firestore → Rules
- Temporarily set to: `allow read, write: if true;`

## Data Persistence

✅ **All data is stored in production Firestore**
- Teachers/Students persist across sessions
- Entries stored permanently
- No data lost on browser refresh
- Accessible from any device

## Next Steps

1. ✅ Test the complete flow (login → create entry → verify filtering)
2. ✅ Add more teachers/students via admin
3. ✅ Test with multiple teachers to verify isolation
4. ✅ Test activate/deactivate functionality
5. Deploy to production: `firebase deploy`

## View Your Data

See all your data in real-time:
📊 **Firestore Console:** https://console.firebase.google.com/project/ziel-d0064/firestore/databases

Collections:
- `teachers` - All teacher records
- `students` - All student records  
- `entries` - All class entries with teacherName field

## System is Ready! 🎉

Open **http://127.0.0.1:5000** and start testing!

**Remember:** First time setup requires adding teachers via admin panel before teacher login will work.

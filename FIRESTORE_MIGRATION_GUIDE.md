# ZIEL Education Platform - Firestore Integration Guide

## Current Status
✅ **Completed Features:**
- Confirmation dialogs before delete/activate/deactivate operations
- Students have all the same features as teachers (add, activate/deactivate, search, show inactive)
- Professional UI with golden-green gradient and no emojis
- localStorage version fully functional

## Firestore Migration Options

### Option 1: Quick Solution with Firebase SDK from CDN (Recommended for testing)

This approach uses Firebase SDK from CDN which works without a bundler. Here's how to implement:

#### Step 1: Update `firebase-config.js`
```javascript
// Use CDN imports instead of npm
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

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
const auth = getAuth(app);

export { db, auth };
```

#### Step 2: Update HTML files to use modules
```html
<!-- In admin.html -->
<script type="module" src="app-firestore.js"></script>

<!-- In teacher.html -->
<script type="module" src="app-firestore.js"></script>

<!-- In index.html -->
<script type="module" src="app-firestore.js"></script>
```

#### Step 3: Deploy Firestore Security Rules
```bash
# Deploy the security rules
firebase deploy --only firestore:rules

# Verify rules were deployed
firebase firestore:rules
```

### Option 2: Production Solution with Vite Bundler

For production deployment, use a bundler:

#### Step 1: Install Vite
```bash
npm install --save-dev vite
```

#### Step 2: Update `package.json`
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "npm run build && firebase deploy"
  }
}
```

#### Step 3: Create `vite.config.js`
```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'public',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  }
});
```

#### Step 4: Use npm imports in firebase-config.js
```javascript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// ... rest of config
```

## Firestore Security Rules Explanation

The `firestore.rules` file implements:

1. **Teachers Collection:**
   - ✅ Admins: Full read/write access
   - ❌ Teachers: Read-only access
   - ❌ Teachers cannot modify teacher list

2. **Students Collection:**
   - ✅ Admins: Full read/write access
   - ❌ Teachers: Read-only access
   - ❌ Teachers cannot modify student list

3. **Entries Collection (Class Records):**
   - ✅ Teachers: Can create entries
   - ✅ Teachers: Can edit/delete their own entries within 24 hours
   - ❌ Teachers: Cannot modify other teachers' entries
   - ✅ Admins: Full access to all entries

4. **Authentication Required:**
   - Custom claims are used to identify admins (`admin: true`)
   - Custom claims for teachers (`teacher: true`)

## Setting Up Authentication with Custom Claims

Since Firestore rules require authentication, you'll need to set up Firebase Authentication:

### Step 1: Enable Authentication
```bash
firebase auth:enable
```

### Step 2: Set Custom Claims (Run in Firebase Functions or Admin SDK)
```javascript
const admin = require('firebase-admin');
admin.initializeApp();

// Set admin claim
async function setAdminClaim(uid) {
  await admin.auth().setCustomUserClaims(uid, { admin: true });
}

// Set teacher claim
async function setTeacherClaim(uid, teacherName) {
  await admin.auth().setCustomUserClaims(uid, { 
    teacher: true,
    name: teacherName 
  });
}
```

### Step 3: Simple Authentication Setup

Add this to your login function:

```javascript
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase-config.js';

async function login() {
  const pwd = document.getElementById("password").value;
  
  try {
    if (pwd === "admin123") {
      // Sign in as admin
      await signInWithEmailAndPassword(auth, "admin@ziel.com", pwd);
    } else if (pwd === "teacher123") {
      // Sign in as teacher
      await signInWithEmailAndPassword(auth, "teacher@ziel.com", pwd);
    }
  } catch (error) {
    alert("Login failed: " + error.message);
  }
}
```

## Testing Security Rules Locally

```bash
# Start Firestore emulator with rules
firebase emulators:start --only firestore

# The emulator will load your firestore.rules automatically
```

## Verifying Teachers Cannot Modify Collections

### Test 1: Teacher tries to add a student
```javascript
// This should FAIL with permission denied
const teacherAuth = await signInWithEmailAndPassword(auth, "teacher@ziel.com", "teacher123");
await addDoc(collection(db, "students"), {
  name: "New Student",
  active: true
});
// Result: Firebase: Missing or insufficient permissions.
```

### Test 2: Admin adds a student
```javascript
// This should SUCCEED
const adminAuth = await signInWithEmailAndPassword(auth, "admin@ziel.com", "admin123");
await addDoc(collection(db, "students"), {
  name: "New Student",
  active: true
});
// Result: Success!
```

### Test 3: Teacher reads students
```javascript
// This should SUCCEED
const teacherAuth = await signInWithEmailAndPassword(auth, "teacher@ziel.com", "teacher123");
const students = await getDocs(collection(db, "students"));
// Result: Can read all students
```

## Deployment Checklist

- [ ] Deploy Firestore rules: `firebase deploy --only firestore:rules`
- [ ] Set up Firebase Authentication
- [ ] Create admin and teacher user accounts
- [ ] Set custom claims for users
- [ ] Test permissions with both admin and teacher accounts
- [ ] Deploy application: `firebase deploy`

## Current Implementation

**✅ What's Already Working:**
- localStorage version with all features
- Confirmation dialogs for all destructive operations
- Students have identical features to teachers
- Professional UI design

**🔄 What Needs Migration:**
- Replace localStorage calls with Firestore operations
- Add Firebase Authentication
- Deploy and test security rules
- Set up custom claims for users

## Quick Start Commands

```bash
# Option 1: Continue with localStorage (current working system)
# No changes needed - everything works!

# Option 2: Migrate to Firestore with CDN
# 1. Update HTML files to use app-firestore.js with type="module"
# 2. Deploy rules: firebase deploy --only firestore:rules
# 3. Test locally: firebase emulators:start

# Option 3: Production Firestore with Vite
npm install --save-dev vite
npm run dev  # Development server
npm run build  # Production build
npm run deploy  # Build and deploy to Firebase
```

## Recommendation

For immediate use: **Continue with localStorage** - it works perfectly and has all requested features.

For production/scalability: **Migrate to Firestore with Vite bundler** - provides:
- Real-time data synchronization
- Multi-user support
- Proper authentication and authorization
- Scalability for multiple schools/branches
- Backup and recovery through Firebase

The security rules in `firestore.rules` are ready and will enforce:
✅ Admins can modify teachers/students
❌ Teachers cannot modify teachers/students
✅ Teachers can read all data
✅ Teachers can manage their own entries (24-hour window)

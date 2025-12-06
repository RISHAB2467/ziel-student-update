# ZIEL - Firebase Integration Guide

## 🔥 Your app is now Firebase-ready!

### What's been set up:

✅ **Firebase SDK** - Added to all HTML files
✅ **Firestore Integration** - Complete replacement of localStorage
✅ **Firebase Config** - Located in `firebase-config.js`
✅ **Firestore Rules** - Open for development (update for production!)
✅ **Emulators** - Configured for local testing

---

## 📝 IMPORTANT: Add Your Firebase Config

### Step 1: Get your Firebase config from console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **ziel-d0064**
3. Click the gear icon ⚙️ > Project Settings
4. Scroll to "Your apps" section
5. Click "Add app" or select existing web app
6. Copy the **firebaseConfig** object

### Step 2: Update `firebase-config.js`

Replace the placeholder values in `public/firebase-config.js` with your actual config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "ziel-d0064.firebaseapp.com",
  projectId: "ziel-d0064",
  storageBucket: "ziel-d0064.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

---

## 🚀 How to Use

### Option A: Use Firestore (Cloud Database)

**Switch to Firestore version:**

1. Update `firebase-config.js` with real Firebase credentials
2. In all HTML files, change:
   - `<script src="app.js"></script>` 
   - TO: `<script src="app-firestore.js"></script>`

3. Test locally:
   ```
   firebase emulators:start
   ```
   Open: http://localhost:5000

4. Deploy to production:
   ```
   firebase deploy
   ```

### Option B: Keep using localStorage (Current)

Your app currently uses `app.js` with localStorage - it works without any Firebase setup!

---

## 📊 Firestore Collections Structure

### `teachers` collection:
```
{
  name: "Prof. Anderson"
}
```

### `students` collection:
```
{
  name: "John Doe"
}
```

### `class_entries` collection:
```
{
  teacher: "Prof. Anderson",
  student: "John Doe",
  date: "2025-12-05",
  time: "10:00",
  duration: 60,
  topic: "Mathematics",
  createdAt: Timestamp
}
```

---

## 🎯 Features Comparison

| Feature | localStorage (app.js) | Firestore (app-firestore.js) |
|---------|----------------------|------------------------------|
| Data Persistence | Browser only | Cloud (all devices) |
| Multi-device | ❌ No | ✅ Yes |
| Real-time sync | ❌ No | ✅ Yes |
| Requires Firebase | ❌ No | ✅ Yes |
| Works offline | ✅ Yes | ⚠️ Partial |

---

## 🔒 Security Rules (Production)

Before going live, update `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Teachers collection - anyone can read, only admins can write
    match /teachers/{teacherId} {
      allow read: if true;
      allow write: if false; // Admins only via backend
    }
    
    // Students collection - anyone can read, only admins can write
    match /students/{studentId} {
      allow read: if true;
      allow write: if false; // Admins only via backend
    }
    
    // Class entries - teachers can create and edit their own (24h)
    match /class_entries/{entryId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if resource.data.createdAt > request.time - duration.value(24, 'h');
    }
  }
}
```

---

## 🐛 Troubleshooting

**Error: "Firebase not defined"**
- Make sure Firebase SDK scripts load before your app script

**Error: "Permission denied"**
- Check your Firestore rules
- For development, rules allow all access

**Data not showing**
- Open browser console (F12)
- Check for error messages
- Verify Firebase config is correct

---

## 📞 Quick Commands

```bash
# Start local development with emulators
firebase emulators:start

# Deploy to production
firebase deploy

# Deploy only hosting
firebase deploy --only hosting

# Deploy only Firestore rules
firebase deploy --only firestore:rules
```

---

**Need help?** Check the console (F12) for error messages!

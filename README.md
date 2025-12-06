# ZIEL Education Platform 🎓

A Firebase-powered web application for managing teacher-student class sessions with role-based access control.

## 🚀 Features

### Teacher Portal
- ✅ Create class entries (student, date, time, duration, topic)
- ✅ View last 24-hour entries
- ✅ Edit/Delete entries within 24 hours
- ✅ Searchable student dropdown
- ✅ View only their own entries

### Admin Dashboard
- ✅ Add/Remove teachers and students
- ✅ Search student reports with statistics
  - Total number of classes
  - Total duration
  - Teachers who taught
  - Detailed class history
- ✅ View all entries across all teachers

## 🔐 Login Credentials

- **Teacher**: `teacher123`
- **Admin**: `admin123`

## 📦 Tech Stack

- **Frontend**: Vanilla JavaScript (ES Modules)
- **Database**: Firebase Firestore (Cloud NoSQL)
- **Hosting**: Firebase Hosting
- **Authentication**: Simple password-based (localStorage)

## 🛠️ Setup & Installation

### Prerequisites
- Node.js (v14+)
- npm
- Firebase CLI
- Java (optional, for Firestore emulator)

### Installation Steps

```bash
# 1. Clone/Navigate to project
cd ziel

# 2. Install dependencies
npm install

# 3. Login to Firebase
firebase login

# 4. Test locally (hosting only, uses live Firestore)
npm run dev
```

Open browser: **http://localhost:5000**

## 📁 Project Structure

```
ziel/
├── public/                    # Static files
│   ├── index.html            # Login page
│   ├── teacher.html          # Teacher portal
│   ├── admin.html            # Admin dashboard
│   ├── firebase-config.js    # Firebase initialization
│   ├── app-firestore.js      # Main app logic (Firestore)
│   ├── app.js               # localStorage version (backup)
│   └── styles.css           # Styling
├── firebase.json             # Firebase config
├── firestore.rules          # Security rules
├── firestore.indexes.json   # Firestore indexes
├── package.json             # npm config
└── README.md               # This file
```

## 🔥 Firebase Configuration

Your app is configured with:
- **Project ID**: `ziel-d0064`
- **API Key**: Configured in `firebase-config.js`
- **Collections**: `teachers`, `students`, `class_entries`

## 📊 Firestore Data Structure

### Collections

#### `teachers`
```javascript
{
  name: "Prof. Anderson"
}
```

#### `students`
```javascript
{
  name: "John Doe"
}
```

#### `class_entries`
```javascript
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

## 🚀 Deployment

### Deploy to Firebase Hosting

```bash
# Deploy everything
npm run deploy

# Or deploy only hosting
firebase deploy --only hosting

# Or deploy only Firestore rules
firebase deploy --only firestore:rules
```

Your app will be live at: **https://ziel-d0064.web.app**

## 🧪 Testing Locally

### Option 1: Live Firestore (Current Setup)
```bash
npm run dev
```
- Uses hosting emulator
- Connects to live Firebase Firestore
- No Java required

### Option 2: Firestore Emulator (Requires Java)
```bash
# Install Java first
# Then run:
npm run dev:firestore
```
- Uses both hosting and Firestore emulators
- Data is local and not saved to cloud
- Requires Java installed

## 🔒 Security Rules

Current rules (development mode - **CHANGE FOR PRODUCTION**):

```javascript
rules_version='2'

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // Open for development
    }
  }
}
```

### Production Security Rules (Recommended)

```javascript
rules_version='2'

service cloud.firestore {
  match /databases/{database}/documents {
    // Teachers - read only
    match /teachers/{teacherId} {
      allow read: if true;
      allow write: if false;
    }
    
    // Students - read only
    match /students/{studentId} {
      allow read: if true;
      allow write: if false;
    }
    
    // Class entries - 24-hour edit window
    match /class_entries/{entryId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if 
        resource.data.createdAt > request.time - duration.value(24, 'h');
    }
  }
}
```

## 📝 npm Scripts

```bash
npm run dev              # Start hosting emulator (live Firestore)
npm run dev:firestore    # Start all emulators (needs Java)
npm run deploy           # Deploy to Firebase
```

## 🐛 Troubleshooting

### Issue: Firebase not defined
- **Solution**: Make sure you're using ES modules (`<script type="module">`)

### Issue: Firestore permission denied
- **Solution**: Check `firestore.rules` - set to `allow read, write: if true` for development

### Issue: Data not loading
- **Solution**: 
  1. Open browser console (F12)
  2. Check for error messages
  3. Verify Firebase config in `firebase-config.js`

### Issue: Java error with emulators
- **Solution**: 
  - Install Java OR use `npm run dev` (hosting only)
  - `npm run dev` uses live Firestore (no Java needed)

### Issue: Module not found
- **Solution**: Make sure `"type": "module"` is in `package.json`

## 🔄 Version History

### v1.0.0 - Firebase Integration
- ✅ Migrated from localStorage to Firebase Firestore
- ✅ ES Module support
- ✅ Real-time cloud database
- ✅ Multi-device sync
- ✅ Production-ready deployment

### v0.5.0 - localStorage Version
- ✅ Basic CRUD operations
- ✅ Browser-only storage
- ✅ Simple password authentication

## 📞 Support

For issues or questions:
1. Check browser console (F12) for errors
2. Review `firestore.rules` for permission issues
3. Verify Firebase config is correct
4. Check Firebase Console for Firestore data

## 🎯 Next Steps

- [ ] Add proper user authentication (Firebase Auth)
- [ ] Implement real-time updates
- [ ] Add email notifications
- [ ] Export reports to PDF
- [ ] Add data visualization charts
- [ ] Mobile responsive design improvements

## 📄 License

ISC

---

**Made with ❤️ for education management**

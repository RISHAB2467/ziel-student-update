# 🚀 Quick Start Guide - ZIEL Platform

## ⚡ Fast Setup (5 minutes)

### 1. Install & Run
```bash
npm install
npm run dev
```
**Open**: http://localhost:5000

### 2. Login
- **Teacher**: `teacher123`
- **Admin**: `admin123`

### 3. Test Features
✅ Teacher: Add a class → See in recent entries → Edit/Delete  
✅ Admin: Add student → Search report → View all data

---

## 📋 Common Commands

```bash
# Development
npm run dev              # Start local server (uses live Firestore)
npm run dev:firestore    # With Firestore emulator (needs Java)

# Deployment
npm run deploy           # Deploy to Firebase
firebase deploy --only hosting        # Deploy only hosting
firebase deploy --only firestore      # Deploy only rules

# Firebase
firebase login           # Login to Firebase
firebase projects:list   # List your projects
firebase use <project>   # Switch project
```

---

## 🎯 How It Works

### Teacher Workflow
1. Login with `teacher123`
2. Select teacher name from dropdown
3. Search & select student (type to filter!)
4. Fill date, time, duration, topic
5. Click "Save Entry"
6. View recent entries (last 24 hours only)
7. Edit/Delete within 24 hours

### Admin Workflow
1. Login with `admin123`
2. **Manage Users**:
   - Add/Remove teachers
   - Add/Remove students
3. **View Reports**:
   - Type student name → instant search
   - See total classes, duration, teachers
   - View detailed class history

---

## 🔥 Firebase Structure

### Collections:
- `teachers` → { name: "Prof. Anderson" }
- `students` → { name: "John Doe" }
- `class_entries` → { teacher, student, date, time, duration, topic, createdAt }

### ES Modules Import:
```javascript
import { db } from './firebase-config.js';
import { collection, addDoc, getDocs } from 'firebase/firestore';

// Add document
await addDoc(collection(db, 'class_entries'), entry);

// Get documents
const snapshot = await getDocs(collection(db, 'students'));
```

---

## 🐛 Quick Fixes

| Problem | Solution |
|---------|----------|
| "Firebase not defined" | Using `<script type="module">` ✅ |
| Permission denied | Check `firestore.rules` → set to `allow read, write: if true` |
| Data not loading | Open console (F12) → check errors |
| Module import error | Verify `"type": "module"` in package.json |
| Java error | Use `npm run dev` (no Java needed) |

---

## 📊 Testing Checklist

### Teacher Portal ✅
- [ ] Login redirects to teacher.html
- [ ] Dropdowns populate with teachers/students
- [ ] Search filters students
- [ ] Form saves to Firestore
- [ ] Recent entries load (24h only)
- [ ] Edit populates form
- [ ] Delete removes entry

### Admin Dashboard ✅
- [ ] Login redirects to admin.html
- [ ] Add teacher → appears in list
- [ ] Remove teacher → disappears
- [ ] Add student → appears in list
- [ ] Remove student → disappears
- [ ] Student search works
- [ ] Report shows correct stats
- [ ] Detailed records display

---

## 🚢 Production Deployment

### Before Going Live:
1. **Update Security Rules** (`firestore.rules`):
   ```javascript
   allow read, write: if false; // Restrict teacher/student lists
   ```

2. **Enable Firestore Indexes** (if needed):
   - Firebase Console → Firestore → Indexes
   - Create composite index for `teacher + createdAt`

3. **Deploy**:
   ```bash
   firebase deploy
   ```

4. **Get Live URL**:
   ```
   https://ziel-d0064.web.app
   https://ziel-d0064.firebaseapp.com
   ```

---

## 💡 Pro Tips

### Development
- Use `console.log()` in app-firestore.js to debug
- Check Firebase Console → Firestore to see data
- Browser DevTools (F12) → Network tab shows Firebase calls

### Performance
- Firestore reads are cached automatically
- Use indexes for complex queries
- Limit query results with `.limit(10)`

### Security
- Never commit API keys to public repos
- Use environment variables for sensitive data
- Update Firestore rules before production

---

## 🎓 Learn More

**Firebase Docs**: https://firebase.google.com/docs/firestore  
**ES Modules**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules  
**Firestore Security**: https://firebase.google.com/docs/firestore/security/rules-structure

---

## 📞 Need Help?

1. Check browser console (F12)
2. Review `README.md` for detailed setup
3. Check `FIREBASE_SETUP.md` for integration guide
4. Visit Firebase Console to verify data

**Quick Debug**: Add this to any function:
```javascript
console.log('Debug:', variableName);
```

---

**Ready to go! 🚀**

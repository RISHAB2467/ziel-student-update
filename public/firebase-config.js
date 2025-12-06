// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyALyA_Yod2TKWonP_oSFehR6-tKq9xDC3I",
  authDomain: "ziel-d0064.firebaseapp.com",
  projectId: "ziel-d0064",
  storageBucket: "ziel-d0064.firebasestorage.app",
  messagingSenderId: "249203765928",
  appId: "1:249203765928:web:391650d800d197d902c89d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// Uncomment below to use Firestore emulator (requires Java installed)
// if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
//   connectFirestoreEmulator(db, 'localhost', 8080);
// }

export { db };

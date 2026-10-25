// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  addDoc, 
  deleteDoc, 
  collection, 
  query, 
  onSnapshot, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Aapke Firebase Project ki Real Config Details
const firebaseConfig = {
  apiKey: "AIzaSyD1SY_t_qQp8BJaoWFoprW60wDJadeUK6E",
  authDomain: "korra-e92a3.firebaseapp.com",
  databaseURL: "https://korra-e92a3-default-rtdb.firebaseio.com",
  projectId: "korra-e92a3",
  storageBucket: "korra-e92a3.firebasestorage.app",
  messagingSenderId: "602281077590",
  appId: "1:602281077590:web:062d414a26c6acb7ce44f7",
  measurementId: "G-13H7F3HG1S"
};

// Firebase Initialize
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export for app.js
export { 
  auth, 
  db, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  doc, 
  setDoc, 
  getDoc, 
  addDoc, 
  deleteDoc, 
  collection, 
  query, 
  onSnapshot, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  serverTimestamp 
};

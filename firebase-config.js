// ==========================================
// KORAA - Firebase Setup (Part 1)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
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
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD1SY_t_qQp8BJaoWFoprW60wDJadeUK6E",
  authDomain: "korra-e92a3.firebaseapp.com",
  projectId: "korra-e92a3",
  storageBucket: "korra-e92a3.firebasestorage.app",
  messagingSenderId: "602281077590",
  appId: "1:602281077590:web:062d414a26c6acb7ce44f7",
  measurementId: "G-13H7F3HG1S"
};
// ==========================================
// KORAA - Firebase Setup (Part 2)
// ==========================================
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  doc, 
  setDoc, 
  getDoc, 
  addDoc,
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  serverTimestamp
};

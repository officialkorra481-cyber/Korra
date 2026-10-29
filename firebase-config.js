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
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  addDoc, 
  deleteDoc,
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytesResumable, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { 
  auth, 
  db, 
  storage, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  addDoc, 
  deleteDoc,
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  serverTimestamp, 
  ref, 
  uploadBytesResumable, 
  getDownloadURL 
};

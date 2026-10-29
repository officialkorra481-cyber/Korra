import { 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "./firebase-config.js";

// Auto Login State Monitor
export function initAuth() {
  const splashScreen = document.getElementById("screen-splash");

  onAuthStateChanged(auth, (user) => {
    // 1.5 second tak Splash Screen full screen dikhegi
    setTimeout(() => {
      if (splashScreen) {
        splashScreen.classList.remove("active");
        splashScreen.style.display = "none";
      }

      if (user) {
        // Logged-in user seedha feed par jayega
        window.showScreen("screen-home");
        updateUserUI(user);
      } else {
        // New/Logged-out user login form par jayega
        window.showScreen("screen-login");
      }
    }, 1500);
  });
}

// Login Function
export async function handleLogin(email, password) {
  if (!email || !password) return alert("Email aur password likhein!");
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    window.showScreen("screen-home");
    updateUserUI(cred.user);
  } catch (err) {
    alert("Login Error: " + err.message);
  }
}

// Signup Function
export async function handleSignup(email, password) {
  if (!email || !password) return alert("Email aur password likhein!");
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    window.showScreen("screen-otp");
    updateUserUI(cred.user);
  } catch (err) {
    alert("Signup Error: " + err.message);
  }
}

// Logout Function
export async function handleLogout() {
  try {
    await signOut(auth);
    window.showScreen("screen-login");
  } catch (err) {
    alert("Logout Error: " + err.message);
  }
}

// Helper: Username update across screens
function updateUserUI(user) {
  const username = user.email ? user.email.split("@")[0] : "koraa_user";
  const userTagElements = document.querySelectorAll(".current-username-tag");
  userTagElements.forEach(el => el.textContent = username);
}

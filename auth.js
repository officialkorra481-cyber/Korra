// ==========================================
// KORAA - Auth Logic with Screen Switch (Part 1)
// ==========================================
import { 
  auth, 
  db, 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  doc, 
  setDoc, 
  serverTimestamp 
} from "./firebase-config.js";

const authSection = document.getElementById("auth-section");
const mainApp = document.getElementById("main-app");

// User Login State Monitor (Auto Screen Switch)
onAuthStateChanged(auth, (user) => {
  const splash = document.getElementById("splash-screen");
  if (splash) {
    splash.style.opacity = "0";
    setTimeout(() => splash.classList.add("hidden"), 500);
  }

  if (user) {
    // Agar user logged in hai to Home Feed show karein
    authSection.classList.add("hidden");
    mainApp.classList.remove("hidden");
  } else {
    // Agar logged out hai to Login/Register screen show karein
    mainApp.classList.add("hidden");
    authSection.classList.remove("hidden");
  }
});

// Logout Handler
const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    await signOut(auth);
  });
}

// Password Visibility Toggle
document.querySelectorAll(".eye-icon").forEach((icon) => {
  icon.addEventListener("click", () => {
    const targetId = icon.getAttribute("data-target");
    const input = document.getElementById(targetId);
    
    if (input.type === "password") {
      input.type = "text";
      icon.classList.remove("ri-eye-off-line");
      icon.classList.add("ri-eye-line");
    } else {
      input.type = "password";
      icon.classList.remove("ri-eye-line");
      icon.classList.add("ri-eye-off-line");
    }
  });
});
// ==========================================
// KORAA - Auth Logic with Screen Switch (Part 2)
// ==========================================
// Tab Switcher
const tabLogin = document.getElementById("tab-login-btn");
const tabReg = document.getElementById("tab-reg-btn");
const formLogin = document.getElementById("form-login");
const formRegister = document.getElementById("form-register");
const feedback = document.getElementById("auth-feedback");

function showMessage(msg, isError = true) {
  feedback.textContent = msg;
  feedback.className = `feedback-msg ${isError ? 'error' : 'success'}`;
}

tabLogin.addEventListener("click", () => {
  tabLogin.classList.add("active");
  tabReg.classList.remove("active");
  formLogin.classList.remove("hidden");
  formRegister.classList.add("hidden");
  feedback.className = "feedback-msg";
});

tabReg.addEventListener("click", () => {
  tabReg.classList.add("active");
  tabLogin.classList.remove("active");
  formRegister.classList.remove("hidden");
  formLogin.classList.add("hidden");
  feedback.className = "feedback-msg";
});

// Setup Recaptcha once
function initRecaptcha() {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
      callback: () => {}
    });
  }
}

let confirmationResultRef = null;
const btnSendOtp = document.getElementById("btn-send-otp");
const otpArea = document.getElementById("otp-area");

btnSendOtp.addEventListener("click", async () => {
  const phone = document.getElementById("reg-phone").value.trim();
  if (!phone.startsWith("+") || phone.length < 10) {
    showMessage("Please enter phone number with country code (e.g., +91...)");
    return;
  }

  try {
    initRecaptcha();
    btnSendOtp.disabled = true;
    btnSendOtp.innerText = "Sending OTP...";

    confirmationResultRef = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
    showMessage("OTP sent successfully!", false);
    otpArea.style.display = "block";
    btnSendOtp.style.display = "none";
  } catch (error) {
    showMessage(error.message);
    btnSendOtp.disabled = false;
    btnSendOtp.innerText = "Send OTP";
  }
});

// Verify OTP & Switch to App
const btnVerifyOtp = document.getElementById("btn-verify-otp");

btnVerifyOtp.addEventListener("click", async () => {
  const code = document.getElementById("otp-code").value.trim();
  const name = document.getElementById("reg-name").value.trim();
  const username = document.getElementById("reg-username").value.trim().toLowerCase();

  if (code.length !== 6) {
    showMessage("Enter 6-digit OTP");
    return;
  }

  try {
    btnVerifyOtp.disabled = true;
    btnVerifyOtp.innerText = "Verifying...";

    const res = await confirmationResultRef.confirm(code);
    const user = res.user;

    // Save profile to Firestore
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      fullName: name,
      username: username,
      phone: user.phoneNumber,
      bio: "Hey there! I am using Koraa.",
      createdAt: serverTimestamp()
    });

    showMessage("Verification successful! Opening App...", false);
    // onAuthStateChanged automatically screen change karega
  } catch (err) {
    showMessage("Invalid OTP: " + err.message);
    btnVerifyOtp.disabled = false;
    btnVerifyOtp.innerText = "Verify & Create Account";
  }
});

// Login Form Submit
formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-identifier").value.trim();
  const pass = document.getElementById("login-password").value;

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    // onAuthStateChanged automatically screen change karega
  } catch (err) {
    showMessage("Login failed: " + err.message);
  }
});

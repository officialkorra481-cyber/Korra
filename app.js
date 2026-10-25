// ==========================================
// KORAA - App Engine (Part 1 of 3)
// ==========================================
import { 
  auth, db,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged,
  doc, setDoc, getDoc, addDoc, collection,
  query, onSnapshot, updateDoc, arrayUnion, arrayRemove,
  serverTimestamp 
} from "./firebase-config.js";

let currentUser = null;
let currentProfile = null;
let activePostIdForComments = null;
let commentsUnsubscribe = null;

// Base64 Compressor
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 480;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.65));
      };
    };
    reader.onerror = (err) => reject(err);
  });
}

// Splash Screen
window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const splash = document.getElementById("splash-screen");
    if (splash) {
      splash.style.opacity = "0";
      setTimeout(() => splash.classList.add("hidden"), 300);
    }
  }, 1000);
});

// Auth Observer
onAuthStateChanged(auth, async (user) => {
  const authSection = document.getElementById("auth-section");
  const mainApp = document.getElementById("main-app");

  if (user) {
    currentUser = user;
    authSection.classList.add("hidden");
    mainApp.classList.remove("hidden");
    await fetchUserProfile(user.uid);
    loadRealtimeFeed();
    loadStories();
    initChatMessenger();
  } else {
    currentUser = null;
    currentProfile = null;
    mainApp.classList.add("hidden");
    authSection.classList.remove("hidden");
  }
});

async function fetchUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      currentProfile = snap.data();
      document.getElementById("my-profile-name").innerText = currentProfile.fullName || "User";
      document.getElementById("my-profile-username").innerText = `@${currentProfile.username || 'user'}`;
      document.getElementById("my-profile-bio").innerText = currentProfile.bio || "Hey there! I am using Koraa.";
      if (currentProfile.profilePic) {
        document.getElementById("my-profile-pic").src = currentProfile.profilePic;
      }
    }
  } catch (e) {
    console.error("Profile load err:", e);
  }
}

// Navigation Tabs
document.querySelectorAll(".bottom-nav .nav-item").forEach(item => {
  item.addEventListener("click", () => {
    const pageId = item.getAttribute("data-page");
    if (!pageId) return;

    document.querySelectorAll(".bottom-nav .nav-item").forEach(i => i.classList.remove("active"));
    document.querySelectorAll(".app-page").forEach(p => p.classList.remove("active"));

    item.classList.add("active");
    document.getElementById(pageId).classList.add("active");
  });
});

// DM Screen Switcher (Hides Top App Bar & Bottom Nav completely)
const chatModal = document.getElementById("fullscreen-chat-modal");
const appContainer = document.getElementById("app-root-container");

document.getElementById("btn-open-dm").addEventListener("click", () => {
  chatModal.classList.remove("hidden");
  appContainer.classList.add("chat-mode-active");
});

document.getElementById("btn-close-chat").addEventListener("click", () => {
  chatModal.classList.add("hidden");
  appContainer.classList.remove("chat-mode-active");
});

document.getElementById("btn-logout").addEventListener("click", () => signOut(auth));

// Eye Icon
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

// Tab Switch
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
  tabLogin.classList.add("active"); tabReg.classList.remove("active");
  formLogin.classList.remove("hidden"); formRegister.classList.add("hidden");
  feedback.className = "feedback-msg";
});
tabReg.addEventListener("click", () => {
  tabReg.classList.add("active"); tabLogin.classList.remove("active");
  formRegister.classList.remove("hidden"); formLogin.classList.add("hidden");
  feedback.className = "feedback-msg";
});

// Direct Any User Registration
formRegister.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("reg-name").value.trim();
  const username = document.getElementById("reg-username").value.trim().toLowerCase();
  const email = document.getElementById("reg-email").value.trim();
  const phone = document.getElementById("reg-phone").value.trim();
  const password = document.getElementById("reg-password").value;
  const btn = document.getElementById("btn-register-submit");

  btn.disabled = true; btn.innerText = "Creating Account...";

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid, fullName: name, username: username, email: email,
      phone: phone, bio: "Hey there! I am using Koraa.",
      profilePic: "https://picsum.photos/100/100", createdAt: serverTimestamp()
    });

    showMessage("Account created! Entering Koraa...", false);
  } catch (err) {
    showMessage("Registration failed: " + err.message);
    btn.disabled = false; btn.innerText = "Create Account";
  }
});

// Login
formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-identifier").value.trim();
  const pass = document.getElementById("login-password").value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    showMessage("Login successful!", false);
  } catch (err) {
    showMessage("Login failed: Check credentials");
  }
});
// ==========================================
// KORAA - App Engine (Part 2 of 3)
// ==========================================
// Real Call Engine (Audio & Video)
const callOverlay = document.getElementById("call-overlay-screen");
const callHeading = document.getElementById("call-heading-text");
const callTimer = document.getElementById("call-timer-text");
const callVideoBox = document.getElementById("call-video-box");
const liveCallStreamTag = document.getElementById("live-call-stream");
let mediaStreamRef = null;
let callInterval = null;
let secondsCount = 0;

async function initiateCall(isVideo = false) {
  callOverlay.classList.remove("hidden");
  callHeading.innerText = isVideo ? "Video Calling..." : "Audio Calling...";
  callTimer.innerText = "Connecting...";
  secondsCount = 0;

  try {
    mediaStreamRef = await navigator.mediaDevices.getUserMedia({
      video: isVideo,
      audio: true
    });

    if (isVideo) {
      callVideoBox.classList.remove("hidden");
      liveCallStreamTag.srcObject = mediaStreamRef;
    } else {
      callVideoBox.classList.add("hidden");
    }

    callHeading.innerText = isVideo ? "Video Call Connected" : "Audio Call Connected";
    clearInterval(callInterval);
    callInterval = setInterval(() => {
      secondsCount++;
      const mins = String(Math.floor(secondsCount / 60)).padStart(2, '0');
      const secs = String(secondsCount % 60).padStart(2, '0');
      callTimer.innerText = `${mins}:${secs}`;
    }, 1000);

  } catch (e) {
    callHeading.innerText = isVideo ? "Video Call Failed" : "Audio Call Failed";
    callTimer.innerText = "Camera/Mic permission needed";
  }
}

document.getElementById("btn-start-audio-call").addEventListener("click", () => initiateCall(false));
document.getElementById("btn-start-video-call").addEventListener("click", () => initiateCall(true));

document.getElementById("btn-end-call").addEventListener("click", () => {
  if (mediaStreamRef) {
    mediaStreamRef.getTracks().forEach(track => track.stop());
    mediaStreamRef = null;
  }
  clearInterval(callInterval);
  callOverlay.classList.add("hidden");
  callVideoBox.classList.add("hidden");
});

// Voice Note Recording (Mic Button)
let audioRecorder = null;
let audioChunks = [];
const btnVoiceRecord = document.getElementById("btn-voice-record");

btnVoiceRecord.addEventListener("click", async () => {
  if (!audioRecorder || audioRecorder.state === "inactive") {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioRecorder = new MediaRecorder(stream);
      audioChunks = [];

      audioRecorder.ondataavailable = (e) => audioChunks.push(e.data);
      audioRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/ogg; codecs=opus" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          await addDoc(collection(db, "global_messages"), {
            senderId: currentUser.uid,
            senderName: currentProfile?.username || "user",
            audioData: reader.result,
            type: "audio",
            createdAt: serverTimestamp()
          });
        };
      };

      audioRecorder.start();
      btnVoiceRecord.classList.add("recording");
    } catch (err) {
      alert("Mic permission required: " + err.message);
    }
  } else if (audioRecorder.state === "recording") {
    audioRecorder.stop();
    btnVoiceRecord.classList.remove("recording");
  }
});

// Chat Messenger System
function initChatMessenger() {
  const chatArea = document.getElementById("chat-messages-area");
  const q = query(collection(db, "global_messages"));

  onSnapshot(q, (snap) => {
    chatArea.innerHTML = "";
    snap.forEach(docSnap => {
      const msg = docSnap.data();
      const isMine = msg.senderId === currentUser.uid;
      const bubble = document.createElement("div");
      bubble.className = `chat-bubble ${isMine ? 'sent' : 'received'}`;

      if (msg.type === "audio") {
        bubble.innerHTML = `
          <small style="opacity:0.7; display:block; font-size:0.7rem;">${msg.senderName}</small>
          <audio src="${msg.audioData}" controls></audio>
        `;
      } else {
        bubble.innerHTML = `
          <small style="opacity:0.7; display:block; font-size:0.7rem;">${msg.senderName}</small>
          ${msg.text}
        `;
      }
      chatArea.appendChild(bubble);
    });
    chatArea.scrollTop = chatArea.scrollHeight;
  });
}

document.getElementById("btn-send-msg").addEventListener("click", async () => {
  const input = document.getElementById("chat-text-input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  await addDoc(collection(db, "global_messages"), {
    senderId: currentUser.uid,
    senderName: currentProfile?.username || "user",
    type: "text",
    text: text,
    createdAt: serverTimestamp()
  });
});
// ==========================================
// KORAA - App Engine (Part 3 of 3)
// ==========================================
// Create Post
let postFile = null;
const mediaInput = document.getElementById("media-input");
const uploadModal = document.getElementById("upload-modal");
const dropzonePlaceholder = document.getElementById("dropzone-placeholder");
const mediaPreviewBox = document.getElementById("media-preview-box");
const btnSubmitPost = document.getElementById("btn-submit-post");

document.getElementById("btn-open-upload").addEventListener("click", () => uploadModal.classList.remove("hidden"));
document.getElementById("btn-close-upload").addEventListener("click", () => uploadModal.classList.add("hidden"));

mediaInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  postFile = file;

  const url = URL.createObjectURL(file);
  dropzonePlaceholder.classList.add("hidden");
  mediaPreviewBox.classList.remove("hidden");
  mediaPreviewBox.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit:contain;" />`;
});

btnSubmitPost.addEventListener("click", async () => {
  if (!postFile) { alert("Please select an image first!"); return; }
  const caption = document.getElementById("post-caption").value.trim();
  btnSubmitPost.disabled = true; btnSubmitPost.innerText = "Publishing...";

  try {
    const base64Img = await fileToBase64(postFile);
    await addDoc(collection(db, "posts"), {
      userId: currentUser.uid,
      userName: currentProfile?.fullName || "User",
      userHandle: currentProfile?.username || "user",
      userAvatar: currentProfile?.profilePic || "https://picsum.photos/100/100",
      mediaUrl: base64Img,
      caption: caption,
      likes: [],
      commentsCount: 0,
      createdAt: serverTimestamp()
    });

    uploadModal.classList.add("hidden");
    btnSubmitPost.disabled = false; btnSubmitPost.innerText = "Publish Post";
    document.getElementById("post-caption").value = "";
    mediaPreviewBox.innerHTML = "";
    mediaPreviewBox.classList.add("hidden");
    dropzonePlaceholder.classList.remove("hidden");
    postFile = null;
    alert("Post published live on Koraa!");
  } catch (e) {
    alert("Publish failed: " + e.message);
    btnSubmitPost.disabled = false;
  }
});

// Comments Logic
const commentsModal = document.getElementById("comments-modal");
const commentsListBox = document.getElementById("comments-list-box");
const inputNewComment = document.getElementById("input-new-comment");
const btnSubmitComment = document.getElementById("btn-submit-comment");

document.getElementById("btn-close-comments").addEventListener("click", () => {
  commentsModal.classList.add("hidden");
  if (commentsUnsubscribe) { commentsUnsubscribe(); commentsUnsubscribe = null; }
  activePostIdForComments = null;
});

function openCommentsModal(postId) {
  activePostIdForComments = postId;
  commentsModal.classList.remove("hidden");
  commentsListBox.innerHTML = `<div class="empty-state">Loading comments...</div>`;

  const q = query(collection(db, "posts", postId, "comments"));
  commentsUnsubscribe = onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      commentsListBox.innerHTML = `<div class="empty-state">No comments yet. Start the conversation!</div>`;
      return;
    }
    commentsListBox.innerHTML = "";
    snapshot.forEach(docSnap => {
      const c = docSnap.data();
      const cRow = document.createElement("div");
      cRow.className = "comment-row";
      cRow.innerHTML = `
        <img src="${c.userAvatar || 'https://picsum.photos/100/100'}" class="comment-avatar">
        <div class="comment-details">
          <p><span class="comment-user">${c.userHandle || 'user'}</span><span>${c.text}</span></p>
        </div>
      `;
      commentsListBox.appendChild(cRow);
    });
    commentsListBox.scrollTop = commentsListBox.scrollHeight;
  });
}

btnSubmitComment.addEventListener("click", async () => {
  const text = inputNewComment.value.trim();
  if (!text || !activePostIdForComments) return;
  inputNewComment.value = "";

  await addDoc(collection(db, "posts", activePostIdForComments, "comments"), {
    userId: currentUser.uid,
    userName: currentProfile?.fullName || "User",
    userHandle: currentProfile?.username || "user",
    userAvatar: currentProfile?.profilePic || "https://picsum.photos/100/100",
    text: text,
    createdAt: serverTimestamp()
  });

  const postRef = doc(db, "posts", activePostIdForComments);
  const postSnap = await getDoc(postRef);
  if (postSnap.exists()) {
    const cCount = postSnap.data().commentsCount || 0;
    await updateDoc(postRef, { commentsCount: cCount + 1 });
  }
});

// Edit Profile
const editModal = document.getElementById("edit-profile-modal");
document.getElementById("btn-open-edit-profile").addEventListener("click", () => {
  document.getElementById("edit-name").value = currentProfile?.fullName || "";
  document.getElementById("edit-bio").value = currentProfile?.bio || "";
  editModal.classList.remove("hidden");
});
document.getElementById("btn-close-edit-profile").addEventListener("click", () => editModal.classList.add("hidden"));

document.getElementById("btn-save-profile").addEventListener("click", async () => {
  const newName = document.getElementById("edit-name").value.trim();
  const newBio = document.getElementById("edit-bio").value.trim();
  const avatarFile = document.getElementById("edit-avatar-input").files[0];
  const btn = document.getElementById("btn-save-profile");
  btn.innerText = "Saving..."; btn.disabled = true;

  try {
    let picUrl = currentProfile?.profilePic || "https://picsum.photos/100/100";
    if (avatarFile) picUrl = await fileToBase64(avatarFile);

    await setDoc(doc(db, "users", currentUser.uid), {
      fullName: newName, bio: newBio, profilePic: picUrl
    }, { merge: true });

    await fetchUserProfile(currentUser.uid);
    editModal.classList.add("hidden");
    alert("Profile saved successfully!");
  } catch (err) {
    alert("Profile save failed: " + err.message);
  }
  btn.innerText = "Save Changes"; btn.disabled = false;
});

// Instagram Stories System (15s Auto Switch)
let allStories = [];
let currentStoryIndex = 0;
let progressInterval = null;

const storyInput = document.getElementById("story-file-input");
document.getElementById("btn-add-story").addEventListener("click", () => storyInput.click());

storyInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  alert("Uploading your Story...");
  try {
    const base64Story = await fileToBase64(file);
    await addDoc(collection(db, "stories"), {
      userId: currentUser.uid,
      userName: currentProfile?.fullName || "User",
      userAvatar: currentProfile?.profilePic || "https://picsum.photos/100/100",
      mediaUrl: base64Story,
      createdAt: serverTimestamp()
    });
    alert("Story updated successfully!");
  } catch (err) {
    alert("Story failed: " + err.message);
  }
});

function loadStories() {
  const container = document.getElementById("stories-container");
  const q = query(collection(db, "stories"));

  onSnapshot(q, (snap) => {
    allStories = [];
    container.innerHTML = `
      <div class="story-item" id="btn-add-story">
        <div class="story-ring add-ring"><i class="ri-add-line"></i></div>
        <span class="story-name">Your Story</span>
      </div>
    `;
    document.getElementById("btn-add-story").addEventListener("click", () => storyInput.click());

    snap.forEach((docSnap) => {
      const s = docSnap.data();
      allStories.push(s);
      const index = allStories.length - 1;

      const sDiv = document.createElement("div");
      sDiv.className = "story-item";
      sDiv.innerHTML = `
        <div class="story-ring">
          <img src="${s.userAvatar || 'https://picsum.photos/100/100'}">
        </div>
        <span class="story-name">${s.userName || 'user'}</span>
      `;
      sDiv.addEventListener("click", () => openStoryViewer(index));
      container.appendChild(sDiv);
    });
  });
}

const storyModal = document.getElementById("story-viewer-modal");

function openStoryViewer(startIndex) {
  if (allStories.length === 0) return;
  currentStoryIndex = startIndex;
  storyModal.classList.remove("hidden");
  renderStoryUI();
}

function closeStoryViewer() {
  clearInterval(progressInterval);
  storyModal.classList.add("hidden");
}

document.getElementById("btn-close-story-viewer").addEventListener("click", closeStoryViewer);

function renderStoryUI() {
  clearInterval(progressInterval);
  const story = allStories[currentStoryIndex];
  document.getElementById("story-viewer-img").src = story.mediaUrl;
  document.getElementById("story-viewer-avatar").src = story.userAvatar || "https://picsum.photos/100/100";
  document.getElementById("story-viewer-username").innerText = story.userName || "User";

  const pContainer = document.getElementById("story-progress-container");
  pContainer.innerHTML = "";
  allStories.forEach((_, i) => {
    const bar = document.createElement("div");
    bar.className = "story-progress-bar";
    bar.innerHTML = `<div class="story-progress-fill" id="p-fill-${i}" style="width: ${i < currentStoryIndex ? '100%' : '0%'}"></div>`;
    pContainer.appendChild(bar);
  });

  const fillEl = document.getElementById(`p-fill-${currentStoryIndex}`);
  let elapsed = 0;
  const duration = 15000;
  const interval = 100;

  progressInterval = setInterval(() => {
    elapsed += interval;
    const pct = Math.min((elapsed / duration) * 100, 100);
    if (fillEl) fillEl.style.width = `${pct}%`;

    if (elapsed >= duration) {
      clearInterval(progressInterval);
      if (currentStoryIndex < allStories.length - 1) {
        currentStoryIndex++;
        renderStoryUI();
      } else {
        closeStoryViewer();
      }
    }
  }, interval);
}

document.getElementById("story-touch-right").addEventListener("click", () => {
  if (currentStoryIndex < allStories.length - 1) {
    currentStoryIndex++;
    renderStoryUI();
  } else {
    closeStoryViewer();
  }
});

document.getElementById("story-touch-left").addEventListener("click", () => {
  if (currentStoryIndex > 0) {
    currentStoryIndex--;
    renderStoryUI();
  }
});

// Load Realtime Feed
function loadRealtimeFeed() {
  const feed = document.getElementById("posts-feed");
  const myGrid = document.getElementById("my-posts-grid");
  const q = query(collection(db, "posts"));

  onSnapshot(q, (snap) => {
    if (snap.empty) {
      feed.innerHTML = `<div class="empty-state">No posts yet. Tap <b>+</b> to publish your first post!</div>`;
      return;
    }
    feed.innerHTML = "";
    myGrid.innerHTML = "";
    let myPostCount = 0;

    snap.forEach((d) => {
      const p = d.data();
      const pId = d.id;
      const isLiked = p.likes?.includes(currentUser.uid);

      if (p.userId === currentUser.uid) {
        myPostCount++;
        myGrid.innerHTML += `<img src="${p.mediaUrl}">`;
      }

      const div = document.createElement("div");
      div.className = "post-card";
      div.innerHTML = `
        <div class="post-header">
          <div class="post-user">
            <img src="${p.userAvatar || 'https://picsum.photos/100/100'}" class="post-avatar">
            <span class="post-username">${p.userHandle || 'user'}</span>
          </div>
          <i class="ri-more-fill"></i>
        </div>
        <img src="${p.mediaUrl}" class="post-media" loading="lazy">
        <div class="post-actions">
          <div class="post-actions-left">
            <i class="${isLiked ? 'ri-heart-fill liked' : 'ri-heart-line'}" data-like="${pId}"></i>
            <i class="ri-chat-3-line" data-comment="${pId}"></i>
            <i class="ri-send-plane-fill"></i>
          </div>
          <i class="ri-bookmark-line"></i>
        </div>
        <div class="post-caption-box">
          <div class="post-likes">${p.likes ? p.likes.length : 0} likes</div>
          <p><b>${p.userHandle || 'user'}</b> ${p.caption || ''}</p>
          <div class="view-comments-btn" data-comment="${pId}">
            View all ${p.commentsCount || 0} comments
          </div>
        </div>
      `;

      div.querySelector("[data-like]").addEventListener("click", async () => {
        const refPost = doc(db, "posts", pId);
        if (isLiked) {
          await updateDoc(refPost, { likes: arrayRemove(currentUser.uid) });
        } else {
          await updateDoc(refPost, { likes: arrayUnion(currentUser.uid) });
        }
      });

      div.querySelectorAll(`[data-comment="${pId}"]`).forEach(btn => {
        btn.addEventListener("click", () => openCommentsModal(pId));
      });

      feed.appendChild(div);
    });

    document.getElementById("stat-posts").innerText = myPostCount;
  });
}

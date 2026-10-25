// ==========================================
// KORAA - App Engine (Part 1 of 3)
// ==========================================
import { 
  auth, db,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged,
  doc, setDoc, getDoc, addDoc, deleteDoc, collection,
  query, onSnapshot, updateDoc, arrayUnion, arrayRemove,
  serverTimestamp 
} from "./firebase-config.js";

let currentUser = null;
let currentProfile = null;
let activeChatUserId = null;
let activeChatRoomId = null;
let currentViewingStoryAuthorId = null;

// Base64 & Canvas Compressor for Posts/Stories
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

// Special High-Speed Avatar Compressor (Perfect 300x300 Square Crop)
function compressAvatar(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 300;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");

        const minDim = Math.min(img.width, img.height);
        const startX = (img.width - minDim) / 2;
        const startY = (img.height - minDim) / 2;

        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = (err) => reject(err);
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
    initLiveUserSearch();
    listenToInbox();
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
      document.getElementById("my-profile-handle-top").innerText = `@${currentProfile.username || 'user'}`;
      document.getElementById("my-profile-bio").innerText = currentProfile.bio || "Raoshab";
      
      const followers = currentProfile.followers ? currentProfile.followers.length : 0;
      const following = currentProfile.following ? currentProfile.following.length : 0;
      document.getElementById("stat-followers").innerText = followers;
      document.getElementById("stat-following").innerText = following;

      if (currentProfile.profilePic) {
        document.getElementById("my-profile-pic").src = currentProfile.profilePic;
      }
    }
  } catch (e) {
    console.error("Profile load err:", e);
  }
}

// Settings Bottom Sheet (Dark Mode & Logout)
const settingsModal = document.getElementById("settings-sheet-modal");
document.getElementById("btn-open-settings").addEventListener("click", () => settingsModal.classList.remove("hidden"));
document.getElementById("btn-close-settings").addEventListener("click", () => settingsModal.classList.add("hidden"));

document.getElementById("btn-toggle-theme-row").addEventListener("click", () => {
  document.body.classList.toggle("light-theme");
  const isLight = document.body.classList.contains("light-theme");
  document.getElementById("theme-icon-state").className = isLight ? "ri-toggle-fill" : "ri-toggle-line";
});

document.getElementById("btn-logout-row").addEventListener("click", () => {
  settingsModal.classList.add("hidden");
  signOut(auth);
});

// Story Se User Profile Par Jana
document.getElementById("story-user-touch-profile").addEventListener("click", () => {
  if (currentViewingStoryAuthorId) {
    closeStoryViewer();
    openUserProfile(currentViewingStoryAuthorId);
  }
});

// Share My Profile
document.getElementById("btn-share-my-profile").addEventListener("click", async () => {
  const username = currentProfile?.username || "user";
  const profileUrl = `https://officialkorra481-cyber.github.io/Korra/?user=${username}`;
  const shareText = `Check out my Koraa profile: @${username}\n${profileUrl}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: `Koraa - @${username}`, text: shareText, url: profileUrl });
    } catch (err) {}
  } else {
    navigator.clipboard.writeText(profileUrl);
    alert("Profile link copied! Share it on WhatsApp or any app.");
  }
});

// Open Other User's Profile
const otherProfileModal = document.getElementById("other-user-profile-modal");
async function openUserProfile(targetUid) {
  if (targetUid === currentUser.uid) {
    document.querySelectorAll(".bottom-nav .nav-item").forEach(i => i.classList.remove("active"));
    document.querySelectorAll(".app-page").forEach(p => p.classList.remove("active"));
    document.querySelector('[data-page="page-profile"]').classList.add("active");
    document.getElementById("page-profile").classList.add("active");
    return;
  }

  otherProfileModal.classList.remove("hidden");
  const snap = await getDoc(doc(db, "users", targetUid));
  if (!snap.exists()) return;
  const targetUser = snap.data();

  document.getElementById("other-header-username").innerText = `@${targetUser.username}`;
  document.getElementById("other-profile-name").innerText = targetUser.fullName || "User";
  document.getElementById("other-profile-handle").innerText = `@${targetUser.username}`;
  document.getElementById("other-profile-bio").innerText = targetUser.bio || "No bio yet.";
  document.getElementById("other-profile-pic").src = targetUser.profilePic || "https://picsum.photos/150/150";

  document.getElementById("other-stat-followers").innerText = targetUser.followers ? targetUser.followers.length : 0;
  document.getElementById("other-stat-following").innerText = targetUser.following ? targetUser.following.length : 0;

  const btnFollow = document.getElementById("btn-other-follow");
  const isFollowing = currentProfile?.following?.includes(targetUid);
  btnFollow.innerText = isFollowing ? "Following" : "Follow";
  btnFollow.className = isFollowing ? "btn-profile-secondary" : "btn-profile-primary";

  btnFollow.onclick = async () => {
    const myRef = doc(db, "users", currentUser.uid);
    const targetRef = doc(db, "users", targetUid);
    const currentlyFollowing = currentProfile?.following?.includes(targetUid);

    if (currentlyFollowing) {
      await updateDoc(myRef, { following: arrayRemove(targetUid) });
      await updateDoc(targetRef, { followers: arrayRemove(currentUser.uid) });
      btnFollow.innerText = "Follow";
    } else {
      await updateDoc(myRef, { following: arrayUnion(targetUid) });
      await updateDoc(targetRef, { followers: arrayUnion(currentUser.uid) });
      btnFollow.innerText = "Following";
    }
    await fetchUserProfile(currentUser.uid);
  };

  document.getElementById("btn-other-personal-message").onclick = () => {
    otherProfileModal.classList.add("hidden");
    openDirectChat(targetUid, targetUser.username, targetUser.profilePic);
  };

  const otherPostsGrid = document.getElementById("other-posts-grid");
  otherPostsGrid.innerHTML = "";
  onSnapshot(query(collection(db, "posts")), (snap) => {
    otherPostsGrid.innerHTML = "";
    let count = 0;
    snap.forEach(d => {
      const p = d.data();
      if (p.userId === targetUid) {
        count++;
        otherPostsGrid.innerHTML += `<img src="${p.mediaUrl}">`;
      }
    });
    document.getElementById("other-stat-posts").innerText = count;
  });
}
document.getElementById("btn-close-other-profile").addEventListener("click", () => otherProfileModal.classList.add("hidden"));
// ==========================================
// KORAA - App Engine (Part 2 of 3)
// ==========================================
// Inbox Modal & Recent Conversations
const inboxModal = document.getElementById("direct-inbox-modal");
const inboxListContainer = document.getElementById("inbox-conversations-list");

document.getElementById("btn-open-inbox").addEventListener("click", () => {
  inboxModal.classList.remove("hidden");
  listenToInbox();
});
document.getElementById("btn-close-inbox").addEventListener("click", () => inboxModal.classList.add("hidden"));

function listenToInbox() {
  const q = query(collection(db, "users", currentUser.uid, "recent_chats"));
  onSnapshot(q, (snap) => {
    if (snap.empty) {
      inboxListContainer.innerHTML = `<div class="empty-state">No conversations yet. Message someone from their profile or search!</div>`;
      return;
    }
    inboxListContainer.innerHTML = "";
    snap.forEach(docSnap => {
      const chatData = docSnap.data();
      const div = document.createElement("div");
      div.className = "inbox-item-card";
      div.innerHTML = `
        <img src="${chatData.otherUserPic || 'https://picsum.photos/100/100'}" class="inbox-avatar">
        <div style="flex:1;">
          <b style="font-size:0.95rem; display:block;">@${chatData.otherUsername}</b>
          <span style="font-size:0.8rem; color:var(--text-muted);">${chatData.lastMessage || 'Open chat'}</span>
        </div>
        <i class="ri-arrow-right-s-line" style="font-size:1.3rem; color:var(--text-muted);"></i>
      `;
      div.addEventListener("click", () => {
        inboxModal.classList.add("hidden");
        openDirectChat(chatData.otherUid, chatData.otherUsername, chatData.otherUserPic);
      });
      inboxListContainer.appendChild(div);
    });
  });
}

// 1-on-1 Chat
function openDirectChat(targetUid, targetUsername, targetPic = "") {
  activeChatUserId = targetUid;
  activeChatRoomId = [currentUser.uid, targetUid].sort().join("_");

  document.getElementById("chat-header-title").innerText = `@${targetUsername}`;
  document.getElementById("fullscreen-chat-modal").classList.remove("hidden");
  document.getElementById("app-root-container").classList.add("chat-mode-active");

  setDoc(doc(db, "users", currentUser.uid, "recent_chats", targetUid), {
    otherUid: targetUid,
    otherUsername: targetUsername,
    otherUserPic: targetPic || "https://picsum.photos/100/100",
    lastMessage: "Chat started",
    updatedAt: serverTimestamp()
  }, { merge: true });

  listenToChatMessages(activeChatRoomId);
}

document.getElementById("btn-close-chat").addEventListener("click", () => {
  document.getElementById("fullscreen-chat-modal").classList.add("hidden");
  document.getElementById("app-root-container").classList.remove("chat-mode-active");
});

function listenToChatMessages(roomId) {
  const chatArea = document.getElementById("chat-messages-area");
  const q = query(collection(db, "chats", roomId, "messages"));

  onSnapshot(q, (snap) => {
    chatArea.innerHTML = "";
    snap.forEach(docSnap => {
      const msg = docSnap.data();
      const isMine = msg.senderId === currentUser.uid;
      const bubble = document.createElement("div");
      bubble.className = `chat-bubble ${isMine ? 'sent' : 'received'}`;
      bubble.innerHTML = `<small style="opacity:0.7; display:block; font-size:0.7rem;">${msg.senderName}</small>${msg.text}`;
      chatArea.appendChild(bubble);
    });
    chatArea.scrollTop = chatArea.scrollHeight;
  });
}

document.getElementById("btn-send-msg").addEventListener("click", async () => {
  const input = document.getElementById("chat-text-input");
  const text = input.value.trim();
  if (!text || !activeChatRoomId) return;
  input.value = "";

  await addDoc(collection(db, "chats", activeChatRoomId, "messages"), {
    senderId: currentUser.uid,
    senderName: currentProfile?.username || "user",
    type: "text",
    text: text,
    createdAt: serverTimestamp()
  });

  if (activeChatUserId) {
    await updateDoc(doc(db, "users", currentUser.uid, "recent_chats", activeChatUserId), {
      lastMessage: text,
      updatedAt: serverTimestamp()
    });
    await setDoc(doc(db, "users", activeChatUserId, "recent_chats", currentUser.uid), {
      otherUid: currentUser.uid,
      otherUsername: currentProfile?.username || "user",
      otherUserPic: currentProfile?.profilePic || "https://picsum.photos/100/100",
      lastMessage: text,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
});

// Live User Search
function initLiveUserSearch() {
  const searchInput = document.getElementById("live-user-search-input");
  const resultsContainer = document.getElementById("search-results-list");

  searchInput.addEventListener("input", () => {
    const val = searchInput.value.trim().toLowerCase();
    if (!val) { resultsContainer.innerHTML = ""; return; }

    onSnapshot(query(collection(db, "users")), (snap) => {
      resultsContainer.innerHTML = "";
      snap.forEach(docSnap => {
        const u = docSnap.data();
        if (u.uid === currentUser.uid) return;
        if (u.username?.toLowerCase().includes(val) || u.fullName?.toLowerCase().includes(val)) {
          const card = document.createElement("div");
          card.className = "inbox-item-card";
          card.innerHTML = `
            <img src="${u.profilePic || 'https://picsum.photos/100/100'}" class="inbox-avatar">
            <div style="flex:1;">
              <b>${u.fullName || 'User'}</b>
              <span style="display:block; font-size:0.8rem; color:var(--text-muted);">@${u.username}</span>
            </div>
            <button class="btn-profile-secondary" style="flex:0; padding:6px 12px; font-size:0.75rem;">View</button>
          `;
          card.addEventListener("click", () => openUserProfile(u.uid));
          resultsContainer.appendChild(card);
        }
      });
    });
  });
}
// ==========================================
// KORAA - App Engine (Part 3 of 3)
// ==========================================
// FIXED PROFILE EDIT & AVATAR UPLOAD SYSTEM
const editModal = document.getElementById("edit-profile-modal");
const editAvatarInput = document.getElementById("edit-avatar-input");
const editAvatarPreview = document.getElementById("edit-avatar-preview");

document.getElementById("btn-open-edit-profile").addEventListener("click", () => {
  document.getElementById("edit-name").value = currentProfile?.fullName || "";
  document.getElementById("edit-bio").value = currentProfile?.bio || "";
  editAvatarPreview.src = currentProfile?.profilePic || "https://picsum.photos/150/150";
  editModal.classList.remove("hidden");
});

document.getElementById("btn-close-edit-profile").addEventListener("click", () => {
  editModal.classList.add("hidden");
});

// Live Preview when image selected
editAvatarInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const tempUrl = URL.createObjectURL(file);
    editAvatarPreview.src = tempUrl;
  }
});

// Save Profile with Guaranteed Canvas Compression
document.getElementById("btn-save-profile").addEventListener("click", async () => {
  const name = document.getElementById("edit-name").value.trim();
  const bio = document.getElementById("edit-bio").value.trim();
  const file = editAvatarInput.files[0];
  const btn = document.getElementById("btn-save-profile");

  btn.disabled = true;
  btn.innerText = "Uploading & Saving...";

  try {
    let pic = currentProfile?.profilePic || "https://picsum.photos/150/150";
    if (file) {
      pic = await compressAvatar(file);
    }

    // Save in Firestore Database
    await setDoc(doc(db, "users", currentUser.uid), {
      fullName: name,
      bio: bio,
      profilePic: pic
    }, { merge: true });

    // Instantly update on screen
    document.getElementById("my-profile-pic").src = pic;
    await fetchUserProfile(currentUser.uid);

    editModal.classList.add("hidden");
    alert("Profile photo updated successfully!");
  } catch (err) {
    console.error("Profile save error:", err);
    alert("Profile update failed: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = "Save Changes";
  }
});

// IN-APP CAMERA FOR DIRECT PHOTOS
let inAppStream = null;
let shootTarget = "story";
const cameraModal = document.getElementById("in-app-camera-modal");
const cameraVideo = document.getElementById("live-camera-video");
const btnShutter = document.getElementById("btn-capture-media");
const btnModeToggle = document.getElementById("btn-cam-mode-toggle");

async function startInAppCamera(target = "story") {
  shootTarget = target;
  btnModeToggle.innerText = target === "story" ? "Posting to: Story" : "Posting to: Feed";
  cameraModal.classList.remove("hidden");

  try {
    inAppStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });
    cameraVideo.srcObject = inAppStream;
  } catch (err) {
    alert("Camera permission error: " + err.message);
    closeInAppCamera();
  }
}

function closeInAppCamera() {
  if (inAppStream) {
    inAppStream.getTracks().forEach(t => t.stop());
    inAppStream = null;
  }
  cameraModal.classList.add("hidden");
}

document.getElementById("btn-close-camera").addEventListener("click", closeInAppCamera);
document.getElementById("btn-open-camera-story").addEventListener("click", () => startInAppCamera("story"));
document.getElementById("btn-open-camera-shoot").addEventListener("click", () => startInAppCamera("feed"));

btnModeToggle.addEventListener("click", () => {
  shootTarget = shootTarget === "story" ? "feed" : "story";
  btnModeToggle.innerText = shootTarget === "story" ? "Posting to: Story" : "Posting to: Feed";
});

btnShutter.addEventListener("click", async () => {
  const canvas = document.getElementById("camera-frame-canvas");
  canvas.width = cameraVideo.videoWidth || 480;
  canvas.height = cameraVideo.videoHeight || 640;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
  const photoData = canvas.toDataURL("image/jpeg", 0.7);

  closeInAppCamera();

  if (shootTarget === "story") {
    alert("Publishing to Story...");
    await addDoc(collection(db, "stories"), {
      userId: currentUser.uid,
      userName: currentProfile?.fullName || "User",
      userAvatar: currentProfile?.profilePic || "https://picsum.photos/100/100",
      mediaUrl: photoData,
      createdAt: serverTimestamp()
    });
    alert("Story updated with live photo!");
  } else {
    const caption = prompt("Write caption for this photo:", "#koraapic");
    alert("Publishing to feed...");
    await addDoc(collection(db, "posts"), {
      userId: currentUser.uid,
      userName: currentProfile?.fullName || "User",
      userHandle: currentProfile?.username || "user",
      userAvatar: currentProfile?.profilePic || "https://picsum.photos/100/100",
      mediaUrl: photoData,
      mediaType: "image",
      caption: caption || "",
      likes: [],
      createdAt: serverTimestamp()
    });
    alert("Post published live!");
  }
});

// Realtime Feed
function loadRealtimeFeed() {
  const feed = document.getElementById("posts-feed");
  const myGrid = document.getElementById("my-posts-grid");
  const reelsContainer = document.getElementById("reels-feed");

  onSnapshot(query(collection(db, "posts")), (snap) => {
    feed.innerHTML = snap.empty ? `<div class="empty-state">No posts yet!</div>` : "";
    myGrid.innerHTML = "";
    reelsContainer.innerHTML = "";
    let myCount = 0;

    snap.forEach((d) => {
      const p = d.data();
      const pId = d.id;
      const isLiked = p.likes?.includes(currentUser.uid);
      const isMine = p.userId === currentUser.uid;

      if (isMine) {
        myCount++;
        myGrid.innerHTML += `<img src="${p.mediaUrl}">`;
      }

      const div = document.createElement("div");
      div.className = "post-card";
      div.innerHTML = `
        <div class="post-header">
          <div class="post-user" data-userlink="${p.userId}">
            <img src="${p.userAvatar || 'https://picsum.photos/100/100'}" class="post-avatar">
            <span class="post-username">${p.userHandle || 'user'}</span>
          </div>
          <i class="ri-delete-bin-line" data-del="${pId}" style="cursor:pointer; ${isMine ? '' : 'display:none;'}"></i>
        </div>
        <img src="${p.mediaUrl}" class="post-media">
        <div class="post-actions">
          <div class="post-actions-left">
            <i class="${isLiked ? 'ri-heart-fill liked' : 'ri-heart-line'}" data-like="${pId}"></i>
            <i class="ri-chat-3-line" data-userlink="${p.userId}"></i>
          </div>
        </div>
        <div class="post-caption-box">
          <div class="post-likes">${p.likes ? p.likes.length : 0} likes</div>
          <p><b>${p.userHandle || 'user'}</b> ${p.caption || ''}</p>
        </div>
      `;

      div.querySelectorAll(`[data-userlink="${p.userId}"]`).forEach(el => {
        el.addEventListener("click", () => openUserProfile(p.userId));
      });

      if (isMine) {
        div.querySelector(`[data-del="${pId}"]`).addEventListener("click", async () => {
          if (confirm("Delete this post?")) await deleteDoc(doc(db, "posts", pId));
        });
      }

      div.querySelector("[data-like]").addEventListener("click", async () => {
        const ref = doc(db, "posts", pId);
        if (isLiked) await updateDoc(ref, { likes: arrayRemove(currentUser.uid) });
        else await updateDoc(ref, { likes: arrayUnion(currentUser.uid) });
      });

      feed.appendChild(div);
    });
    document.getElementById("stat-posts").innerText = myCount;
  });
}

// Stories System
let allStories = [];
let currentStoryIdx = 0;
const storyModal = document.getElementById("story-viewer-modal");

function loadStories() {
  const container = document.getElementById("stories-container");
  onSnapshot(query(collection(db, "stories")), (snap) => {
    allStories = [];
    container.innerHTML = `
      <div class="story-item" id="btn-open-camera-story">
        <div class="story-ring add-ring"><i class="ri-camera-lens-line"></i></div>
        <span class="story-name">Add Story</span>
      </div>
    `;
    document.getElementById("btn-open-camera-story").addEventListener("click", () => startInAppCamera("story"));

    snap.forEach((docSnap) => {
      const s = docSnap.data();
      allStories.push(s);
      const index = allStories.length - 1;

      const sDiv = document.createElement("div");
      sDiv.className = "story-item";
      sDiv.innerHTML = `
        <div class="story-ring"><img src="${s.userAvatar || 'https://picsum.photos/100/100'}"></div>
        <span class="story-name">${s.userName || 'user'}</span>
      `;
      sDiv.addEventListener("click", () => openStoryViewer(index));
      container.appendChild(sDiv);
    });
  });
}

function openStoryViewer(idx) {
  if (allStories.length === 0) return;
  currentStoryIdx = idx;
  const story = allStories[currentStoryIdx];
  currentViewingStoryAuthorId = story.userId;

  document.getElementById("story-viewer-img").src = story.mediaUrl;
  document.getElementById("story-viewer-avatar").src = story.userAvatar || "https://picsum.photos/100/100";
  document.getElementById("story-viewer-username").innerText = story.userName || "User";
  storyModal.classList.remove("hidden");
}

function closeStoryViewer() {
  storyModal.classList.add("hidden");
  currentViewingStoryAuthorId = null;
}
document.getElementById("btn-close-story-viewer").addEventListener("click", closeStoryViewer);

// Bottom Nav
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

// Auth Forms
const tabLogin = document.getElementById("tab-login-btn");
const tabReg = document.getElementById("tab-reg-btn");
const formLogin = document.getElementById("form-login");
const formRegister = document.getElementById("form-register");
const feedback = document.getElementById("auth-feedback");

tabLogin.addEventListener("click", () => {
  tabLogin.classList.add("active"); tabReg.classList.remove("active");
  formLogin.classList.remove("hidden"); formRegister.classList.add("hidden");
});
tabReg.addEventListener("click", () => {
  tabReg.classList.add("active"); tabLogin.classList.remove("active");
  formRegister.classList.remove("hidden"); formLogin.classList.add("hidden");
});

formRegister.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("reg-name").value.trim();
  const username = document.getElementById("reg-username").value.trim().toLowerCase();
  const email = document.getElementById("reg-email").value.trim();
  const pass = document.getElementById("reg-password").value;

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await setDoc(doc(db, "users", cred.user.uid), {
      uid: cred.user.uid, fullName: name, username: username, email: email,
      bio: "Raoshab", profilePic: "https://picsum.photos/100/100",
      followers: [], following: [], createdAt: serverTimestamp()
    });
  } catch (err) {
    feedback.textContent = err.message; feedback.className = "feedback-msg error";
  }
});

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-identifier").value.trim();
  const pass = document.getElementById("login-password").value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    feedback.textContent = err.message; feedback.className = "feedback-msg error";
  }
});

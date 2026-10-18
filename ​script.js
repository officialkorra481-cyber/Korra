// PART 1: Firebase Config, Auth, Feed & Post Functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 1. FIREBASE CONFIG (korra-e92a3)
const firebaseConfig = {
  apiKey: "AIzaSyD1SY_t_qQp8BJaoWFoprW60wDJadeUK6E",
  authDomain: "korra-e92a3.firebaseapp.com",
  projectId: "korra-e92a3",
  storageBucket: "korra-e92a3.firebasestorage.app",
  messagingSenderId: "602281077590",
  appId: "1:602281077590:web:30156f52bb424427ce44f7",
  measurementId: "G-D6XG7MJWZ0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentUserData = null;
let selectedMediaBase64 = "";
let selectedPostType = "post";
let selectedFilter = "none";
let activeCommentPostId = null;
let viewedProfileUid = null;
let activeChatPartner = null;
let unsubscribeChat = null;
let allPostsCache = [];

// 2. SPLASH & ONBOARDING FLOW
let obStep = 1;
window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentUser = user;
        await loadCurrentUserProfile();
        showScreen("main-app");
        initRealtimeFeed();
        loadStories();
      } else {
        showScreen("onboarding-screen");
      }
    });
  }, 1800);
});

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(screenId);
  if (target) target.classList.add("active");
}

window.nextOnboarding = function () {
  if (obStep === 1) {
    obStep = 2;
    const titleEl = document.getElementById("ob-title");
    const descEl = document.getElementById("ob-desc");
    const dot1 = document.getElementById("dot-1");
    const dot2 = document.getElementById("dot-2");
    if (titleEl) titleEl.innerText = "Discover New People";
    if (descEl) descEl.innerText = "Follow creators, explore amazing content, reels and be part of the Koraa community.";
    if (dot1) dot1.classList.remove("active");
    if (dot2) dot2.classList.add("active");
  } else {
    showScreen("auth-screen");
  }
};

window.toggleAuth = function (mode) {
  const loginBox = document.getElementById("login-form-box");
  const signupBox = document.getElementById("signup-form-box");
  if (mode === "signup") {
    if (loginBox) loginBox.classList.add("hidden");
    if (signupBox) signupBox.classList.remove("hidden");
  } else {
    if (signupBox) signupBox.classList.add("hidden");
    if (loginBox) loginBox.classList.remove("hidden");
  }
};

function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.innerText = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

// 3. AUTHENTICATION & PROFILE LOADER
window.handleSignup = async function () {
  const nameEl = document.getElementById("signup-name");
  const usernameEl = document.getElementById("signup-username");
  const emailEl = document.getElementById("signup-email");
  const passEl = document.getElementById("signup-password");

  if (!nameEl || !usernameEl || !emailEl || !passEl) return;

  const name = nameEl.value.trim();
  const username = usernameEl.value.trim().toLowerCase().replace(/\s+/g, "_");
  const email = emailEl.value.trim();
  const pass = passEl.value;

  if (!name || !username || !email || pass.length < 6) {
    return showToast("Sabhi boxes bharein (Password min 6 chars)");
  }

  try {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
    const userObj = {
      uid: res.user.uid,
      name,
      username,
      email,
      bio: "Dreamer | Creator • On Koraa ✨",
      avatar: defaultAvatar,
      followers: [],
      following: [],
      savedPosts: [],
      blockedUsers: [],
      createdAt: serverTimestamp()
    };
    await setDoc(doc(db, "users", res.user.uid), userObj);
    currentUserData = userObj;
    showToast("Welcome to Koraa!");
  } catch (err) {
    showToast(err.message);
  }
};

window.handleLogin = async function () {
  const emailEl = document.getElementById("login-email");
  const passEl = document.getElementById("login-password");
  if (!emailEl || !passEl) return;

  const email = emailEl.value.trim();
  const pass = passEl.value;
  if (!email || !pass) return showToast("Email aur Password daalein");

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    showToast("Logged in!");
  } catch (err) {
    showToast("Galat Email ya Password!");
  }
};

window.handleLogout = async function () {
  await signOut(auth);
  currentUserData = null;
  showScreen("auth-screen");
};

async function loadCurrentUserProfile() {
  if (!currentUser) return;
  const snap = await getDoc(doc(db, "users", currentUser.uid));
  if (snap.exists()) {
    currentUserData = snap.data();
  } else {
    currentUserData = {
      uid: currentUser.uid,
      name: "Koraa User",
      username: currentUser.email ? currentUser.email.split('@')[0] : "user",
      bio: "Dreamer | Creator • On Koraa ✨",
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.uid}`,
      followers: [],
      following: [],
      savedPosts: [],
      blockedUsers: []
    };
  }
  const myAvatar = document.getElementById("my-story-avatar");
  if (myAvatar && currentUserData.avatar) myAvatar.src = currentUserData.avatar;
}

// 4. IMAGE COMPRESSOR & PREVIEW
function compressImageFile(file, maxWidth = 720, quality = 0.65) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => { resolve(e.target.result); };
    };
    reader.onerror = () => { resolve(""); };
  });
}

window.previewSelectedImage = async function (event) {
  const file = event.target.files[0];
  if (!file) return;
  showToast("Photo ready ho rahi hai...");
  selectedMediaBase64 = await compressImageFile(file, 720, 0.65);
  const previewBox = document.getElementById("media-preview-box");
  const previewImg = document.getElementById("image-preview");
  if (previewImg) previewImg.src = selectedMediaBase64;
  if (previewBox) previewBox.classList.remove("hidden");
};

window.previewUrlMedia = function (url) {
  if (!url.trim()) return;
  selectedMediaBase64 = url.trim();
  const previewBox = document.getElementById("media-preview-box");
  const previewImg = document.getElementById("image-preview");
  if (previewImg) previewImg.src = selectedMediaBase64;
  if (previewBox) previewBox.classList.remove("hidden");
};

window.setPostType = function (type) {
  selectedPostType = type;
  const postBtn = document.getElementById("type-post-btn");
  const reelBtn = document.getElementById("type-reel-btn");
  if (postBtn) postBtn.classList.toggle("active", type === "post");
  if (reelBtn) reelBtn.classList.toggle("active", type === "reel");
};

window.applyFilter = function (filterCss) {
  selectedFilter = filterCss;
  const previewImg = document.getElementById("image-preview");
  if (previewImg) previewImg.style.filter = filterCss;
};

// 5. POSTS, REELS & FEED
window.publishPost = async function () {
  if (!currentUser) return;
  if (!currentUserData) {
    await loadCurrentUserProfile();
  }

  const captionEl = document.getElementById("post-caption");
  const locationEl = document.getElementById("post-location");
  const caption = captionEl ? captionEl.value.trim() : "";
  const location = locationEl ? locationEl.value.trim() : "";

  if (!selectedMediaBase64) {
    return showToast("Pehle gallery se photo chunein ya URL daalein!");
  }

  const btn = document.getElementById("publish-btn");
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Publishing...";
  }

  try {
    const finalUsername = currentUserData?.username || currentUser.email.split('@')[0] || "user";
    const finalAvatar = currentUserData?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.uid}`;
    const hashtags = (caption.match(/#[a-z0-9_]+/gi) || []).map(t => t.toLowerCase());
    
    await addDoc(collection(db, "posts"), {
      uid: currentUser.uid,
      username: finalUsername,
      userAvatar: finalAvatar,
      mediaUrl: selectedMediaBase64,
      type: selectedPostType,
      filter: selectedFilter,
      caption,
      location,
      hashtags,
      likes: [],
      createdAt: serverTimestamp()
    });

    selectedMediaBase64 = "";
    if (captionEl) captionEl.value = "";
    if (locationEl) locationEl.value = "";
    const urlInput = document.getElementById("post-media-url");
    if (urlInput) urlInput.value = "";
    const previewBox = document.getElementById("media-preview-box");
    if (previewBox) previewBox.classList.add("hidden");

    showToast("Post Live ho gayi!");
    window.switchTab("home-view");
  } catch (e) {
    showToast("Error: " + e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Share Now";
    }
  }
};

function initRealtimeFeed() {
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    const feedBox = document.getElementById("feed-container");
    const reelsBox = document.getElementById("reels-container");
    const exploreBox = document.getElementById("explore-grid");
    if (feedBox) feedBox.innerHTML = "";
    if (reelsBox) reelsBox.innerHTML = "";
    if (exploreBox) exploreBox.innerHTML = "";
    allPostsCache = [];

    if (snapshot.empty) {
      if (feedBox) feedBox.innerHTML = `<div class="loader">Abhi koi post nahi hai. Neeche + button dabakar pehli post daalein!</div>`;
      return;
    }

    snapshot.forEach((docSnap) => {
      const post = { id: docSnap.id, ...docSnap.data() };
      if (currentUserData?.blockedUsers?.includes(post.uid)) return;
      allPostsCache.push(post);

      if (feedBox) feedBox.appendChild(createPostCard(post));

      if (exploreBox) {
        const gridItem = document.createElement("div");
        gridItem.className = "grid-item";
        gridItem.innerHTML = `<img src="${post.mediaUrl}" style="filter:${post.filter || 'none'}" alt="Post">`;
        gridItem.onclick = () => window.openUserProfile(post.uid);
        exploreBox.appendChild(gridItem);
      }

      if (post.type === "reel" && reelsBox) {
        const reelEl = document.createElement("div");
        reelEl.className = "reel-card";
        const isVideo = post.mediaUrl.endsWith(".mp4") || post.mediaUrl.endsWith(".webm");
        reelEl.innerHTML = `
          ${isVideo ? `<video src="${post.mediaUrl}" autoplay loop muted playsinline></video>` : `<img src="${post.mediaUrl}" style="filter:${post.filter || 'none'}">`}
          <div class="reel-overlay">
            <h4>@${post.username}</h4>
            <p>${formatHashtags(post.caption || "")}</p>
          </div>
        `;
        reelsBox.appendChild(reelEl);
      }
    });
  });
}

function createPostCard(post) {
  const isLiked = post.likes?.includes(currentUser.uid);
  const isSaved = currentUserData?.savedPosts?.includes(post.id);
  const isVideo = post.mediaUrl.endsWith(".mp4") || post.mediaUrl.endsWith(".webm");

  const card = document.createElement("article");
  card.className = "post-card";
  card.innerHTML = `
    <div class="post-header">
      <div class="post-user" onclick="openUserProfile('${post.uid}')">
        <img src="${post.userAvatar}" alt="${post.username}">
        <div class="post-user-meta">
          <h4>${post.username}</h4>
          <span>${post.location || "Koraa Community"}</span>
        </div>
      </div>
      <button class="icon-btn" onclick="sharePost('${post.username}')"><i class="ri-share-forward-line"></i></button>
    </div>
    <div class="post-media" ondblclick="toggleLike('${post.id}', '${post.uid}')">
      ${isVideo
        ? `<video src="${post.mediaUrl}" controls playsinline></video>`
        : `<img src="${post.mediaUrl}" style="filter:${post.filter || 'none'}" alt="Post">`
      }
    </div>
    <div class="post-actions">
      <div class="post-actions-left">
        <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${post.id}', '${post.uid}')">
          <i class="${isLiked ? 'ri-heart-3-fill' : 'ri-heart-3-line'}"></i>
          <span>${post.likes?.length || 0}</span>
        </button>
        <button class="action-btn" onclick="openCommentsModal('${post.id}', '${post.uid}')">
          <i class="ri-chat-3-line"></i>
        </button>
        <button class="action-btn" onclick="sharePost('${post.username}')">
          <i class="ri-send-plane-line"></i>
        </button>
      </div>
      <button class="action-btn" onclick="toggleSavePost('${post.id}')">
        <i class="${isSaved ? 'ri-bookmark-fill' : 'ri-bookmark-line'}"></i>
      </button>
    </div>
    <div class="post-caption-box">
      <strong>${post.username}</strong> ${formatHashtags(post.caption || "")}
    </div>
  `;
  return card;
}

function formatHashtags(text) {
  return text.replace(/#[a-z0-9_]+/gi, (match) => `<span class="hashtag">${match}</span>`);
}
// PART 2: Likes, Comments, Stories, Profile, Chat & Navigation
window.toggleLike = async function (postId, ownerUid) {
  const postRef = doc(db, "posts", postId);
  const post = allPostsCache.find(p => p.id === postId);
  if (!post) return;

  const alreadyLiked = post.likes?.includes(currentUser.uid);
  await updateDoc(postRef, {
    likes: alreadyLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
  });

  if (!alreadyLiked && ownerUid !== currentUser.uid) {
    if (!currentUserData) await loadCurrentUserProfile();
    await addDoc(collection(db, "notifications"), {
      toUid: ownerUid,
      fromUsername: currentUserData?.username || "user",
      fromAvatar: currentUserData?.avatar || "",
      text: "liked your post ❤️",
      createdAt: serverTimestamp()
    });
  }
};

window.toggleSavePost = async function (postId) {
  if (!currentUserData) await loadCurrentUserProfile();
  const userRef = doc(db, "users", currentUser.uid);
  const isSaved = currentUserData.savedPosts?.includes(postId);
  await updateDoc(userRef, {
    savedPosts: isSaved ? arrayRemove(postId) : arrayUnion(postId)
  });
  await loadCurrentUserProfile();
  showToast(isSaved ? "Removed from Saved" : "Post Saved!");
};

window.sharePost = function (username) {
  if (navigator.share) {
    navigator.share({
      title: `Post by @${username} on Koraa`,
      url: window.location.href
    });
  } else {
    navigator.clipboard.writeText(window.location.href);
    showToast("Link copied!");
  }
};

window.openCommentsModal = async function (postId, ownerUid) {
  activeCommentPostId = { postId, ownerUid };
  const modal = document.getElementById("comments-modal");
  if (modal) modal.classList.remove("hidden");
  const list = document.getElementById("comments-list");
  if (!list) return;
  list.innerHTML = "Loading comments...";

  const q = query(collection(db, "posts", postId, "comments"), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  list.innerHTML = "";
  if (snap.empty) {
    list.innerHTML = `<p style="color:#8E92A4;text-align:center;">Abhi koi comment nahi hai.</p>`;
  }
  snap.forEach(d => {
    const c = d.data();
    list.innerHTML += `<div class="comment-item"><strong>@${c.username}</strong> ${c.text}</div>`;
  });
};

window.closeCommentsModal = function () {
  const modal = document.getElementById("comments-modal");
  if (modal) modal.classList.add("hidden");
};

window.submitComment = async function () {
  const input = document.getElementById("comment-input");
  if (!input || !activeCommentPostId) return;
  const text = input.value.trim();
  if (!text) return;

  if (!currentUserData) await loadCurrentUserProfile();

  await addDoc(collection(db, "posts", activeCommentPostId.postId, "comments"), {
    uid: currentUser.uid,
    username: currentUserData?.username || "user",
    text,
    createdAt: serverTimestamp()
  });

  if (activeCommentPostId.ownerUid !== currentUser.uid) {
    await addDoc(collection(db, "notifications"), {
      toUid: activeCommentPostId.ownerUid,
      fromUsername: currentUserData?.username || "user",
      fromAvatar: currentUserData?.avatar || "",
      text: `commented: "${text}"`,
      createdAt: serverTimestamp()
    });
  }

  input.value = "";
  window.openCommentsModal(activeCommentPostId.postId, activeCommentPostId.ownerUid);
};

window.openStoryUpload = function () {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!currentUserData) await loadCurrentUserProfile();

    showToast("Story upload ho rahi hai...");
    const base64 = await compressImageFile(file, 600, 0.6);
    await addDoc(collection(db, "stories"), {
      uid: currentUser.uid,
      username: currentUserData?.username || "user",
      avatar: currentUserData?.avatar || "",
      mediaUrl: base64,
      createdAt: serverTimestamp()
    });
    showToast("Story lag gayi!");
    loadStories();
  };
  input.click();
};

async function loadStories() {
  const snap = await getDocs(query(collection(db, "stories"), orderBy("createdAt", "desc")));
  const strip = document.getElementById("stories-container");
  if (!strip) return;
  const firstBtn = strip.firstElementChild;
  strip.innerHTML = "";
  if (firstBtn) strip.appendChild(firstBtn);

  snap.forEach(d => {
    const s = d.data();
    const item = document.createElement("div");
    item.className = "story-item";
    item.innerHTML = `
      <div class="story-ring"><img src="${s.avatar}" alt="${s.username}"></div>
      <span>${s.username}</span>
    `;
    item.onclick = () => {
      const titleEl = document.getElementById("story-user-title");
      const imgEl = document.getElementById("story-full-img");
      const modalEl = document.getElementById("story-modal");
      if (titleEl) titleEl.innerText = "@" + s.username;
      if (imgEl) imgEl.src = s.mediaUrl;
      if (modalEl) modalEl.classList.remove("hidden");
    };
    strip.appendChild(item);
  });
}

window.closeStoryModal = function () {
  const modal = document.getElementById("story-modal");
  if (modal) modal.classList.add("hidden");
};

window.openMyProfile = function (navBtn) {
  window.switchTab("profile-view", navBtn);
  if (currentUser) window.openUserProfile(currentUser.uid);
};

window.openUserProfile = async function (uid) {
  viewedProfileUid = uid;
  window.switchTab("profile-view");
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return;
  const user = snap.data();

  const avatarEl = document.getElementById("profile-avatar");
  const fullnameEl = document.getElementById("profile-fullname");
  const usernameEl = document.getElementById("profile-username");
  const bioEl = document.getElementById("profile-bio");
  const statFollowers = document.getElementById("stat-followers");
  const statFollowing = document.getElementById("stat-following");
  const statPosts = document.getElementById("stat-posts");

  if (avatarEl) avatarEl.src = user.avatar;
  if (fullnameEl) fullnameEl.innerText = user.name;
  if (usernameEl) usernameEl.innerText = "@" + user.username;
  if (bioEl) bioEl.innerText = user.bio || "";
  if (statFollowers) statFollowers.innerText = user.followers?.length || 0;
  if (statFollowing) statFollowing.innerText = user.following?.length || 0;

  const userPosts = allPostsCache.filter(p => p.uid === uid);
  if (statPosts) statPosts.innerText = userPosts.length;

  const isMe = currentUser && uid === currentUser.uid;
  const myActions = document.getElementById("my-profile-actions");
  const otherActions = document.getElementById("other-profile-actions");
  if (myActions) myActions.classList.toggle("hidden", !isMe);
  if (otherActions) otherActions.classList.toggle("hidden", isMe);

  if (!isMe && currentUser) {
    const isFollowing = user.followers?.includes(currentUser.uid);
    const followBtn = document.getElementById("follow-toggle-btn");
    const msgBtn = document.getElementById("msg-user-btn");
    if (followBtn) followBtn.innerText = isFollowing ? "Following" : "Follow";
    if (msgBtn) msgBtn.onclick = () => startDirectChat(user);
  }

  const grid = document.getElementById("profile-posts-grid");
  if (grid) {
    grid.innerHTML = "";
    userPosts.forEach(p => {
      grid.innerHTML += `<div class="grid-item"><img src="${p.mediaUrl}" style="filter:${p.filter || 'none'}"></div>`;
    });
  }
};

window.toggleFollowUser = async function () {
  if (!viewedProfileUid || !currentUser) return;
  if (!currentUserData) await loadCurrentUserProfile();

  const targetRef = doc(db, "users", viewedProfileUid);
  const myRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(targetRef);
  const targetData = snap.data();
  const isFollowing = targetData.followers?.includes(currentUser.uid);

  await updateDoc(targetRef, {
    followers: isFollowing ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
  });
  await updateDoc(myRef, {
    following: isFollowing ? arrayRemove(viewedProfileUid) : arrayUnion(viewedProfileUid)
  });

  if (!isFollowing) {
    await addDoc(collection(db, "notifications"), {
      toUid: viewedProfileUid,
      fromUsername: currentUserData?.username || "user",
      fromAvatar: currentUserData?.avatar || "",
      text: "started following you 💜",
      createdAt: serverTimestamp()
    });
  }
  window.openUserProfile(viewedProfileUid);
};

window.showSavedPosts = function () {
  const grid = document.getElementById("profile-posts-grid");
  if (!grid || !currentUserData) return;
  grid.innerHTML = "";
  const saved = allPostsCache.filter(p => currentUserData.savedPosts?.includes(p.id));
  if (!saved.length) {
    grid.innerHTML = `<p style="padding:20px;color:#8E92A4;">No saved posts yet.</p>`;
    return;
  }
  saved.forEach(p => {
    grid.innerHTML += `<div class="grid-item"><img src="${p.mediaUrl}"></div>`;
  });
};

let newAvatarBase64 = "";
window.openEditProfile = async function () {
  if (!currentUser) return;
  if (!currentUserData) {
    await loadCurrentUserProfile();
  }
  const nameInput = document.getElementById("edit-name");
  const bioInput = document.getElementById("edit-bio");
  if (nameInput) nameInput.value = currentUserData?.name || "";
  if (bioInput) bioInput.value = currentUserData?.bio || "";
  const modal = document.getElementById("edit-profile-modal");
  if (modal) modal.classList.remove("hidden");
};

window.closeEditProfile = function () {
  const modal = document.getElementById("edit-profile-modal");
  if (modal) modal.classList.add("hidden");
};

window.previewAvatarFile = async function (e) {
  const file = e.target.files[0];
  if (!file) return;
  newAvatarBase64 = await compressImageFile(file, 300, 0.7);
  showToast("Naya profile photo select ho gaya!");
};

window.saveProfileChanges = async function () {
  if (!currentUser) return;
  const nameInput = document.getElementById("edit-name");
  const bioInput = document.getElementById("edit-bio");
  const name = nameInput ? nameInput.value.trim() : "";
  const bio = bioInput ? bioInput.value.trim() : "";
  
  const updates = { name, bio };
  if (newAvatarBase64) updates.avatar = newAvatarBase64;

  try {
    await setDoc(doc(db, "users", currentUser.uid), updates, { merge: true });
    await loadCurrentUserProfile();
    window.closeEditProfile();
    window.openUserProfile(currentUser.uid);
    showToast("Profile update ho gayi!");
  } catch (err) {
    showToast("Error: " + err.message);
  }
};

window.blockOrReportUser = async function () {
  if (!viewedProfileUid || !currentUser) return;
  await updateDoc(doc(db, "users", currentUser.uid), {
    blockedUsers: arrayUnion(viewedProfileUid)
  });
  await loadCurrentUserProfile();
  showToast("User blocked & reported.");
  window.switchTab("home-view");
};

window.handleSearch = async function (term) {
  const qText = term.trim().toLowerCase();
  const userBox = document.getElementById("search-results-users");
  if (!userBox) return;
  if (!qText) {
    userBox.classList.add("hidden");
    return;
  }
  const snap = await getDocs(collection(db, "users"));
  userBox.innerHTML = "";
  userBox.classList.remove("hidden");
  snap.forEach(d => {
    const u = d.data();
    if (u.username.includes(qText) || u.name.toLowerCase().includes(qText)) {
      const row = document.createElement("div");
      row.className = "user-row";
      row.innerHTML = `
        <div class="user-row-left">
          <img src="${u.avatar}">
          <div><h4>${u.name}</h4><span style="color:#8E92A4;font-size:0.8rem;">@${u.username}</span></div>
        </div>
      `;
      row.onclick = () => window.openUserProfile(u.uid);
      userBox.appendChild(row);
    }
  });
};

async function loadMessagesUsers() {
  const snap = await getDocs(collection(db, "users"));
  const list = document.getElementById("chat-users-list");
  if (!list) return;
  list.innerHTML = "";
  snap.forEach(d => {
    const u = d.data();
    if (currentUser && u.uid === currentUser.uid) return;
    const row = document.createElement("div");
    row.className = "user-row";
    row.innerHTML = `
      <div class="user-row-left">
        <img src="${u.avatar}">
        <div><h4>${u.username}</h4><span style="color:#8E92A4;font-size:0.78rem;">Tap to chat live</span></div>
      </div>
      <i class="ri-chat-smile-2-line" style="font-size:1.3rem;color:#9B51E0;"></i>
    `;
    row.onclick = () => startDirectChat(u);
    list.appendChild(row);
  });
}

function startDirectChat(partner) {
  activeChatPartner = partner;
  const nameEl = document.getElementById("chat-partner-name");
  const avatarEl = document.getElementById("chat-partner-avatar");
  if (nameEl) nameEl.innerText = partner.username;
  if (avatarEl) avatarEl.src = partner.avatar;
  window.switchTab("chat-room-view");

  const roomId = [currentUser.uid, partner.uid].sort().join("_");
  if (unsubscribeChat) unsubscribeChat();

  const q = query(collection(db, "chats", roomId, "messages"), orderBy("createdAt", "asc"));
  unsubscribeChat = onSnapshot(q, (snap) => {
    const box = document.getElementById("chat-messages-box");
    if (!box) return;
    box.innerHTML = "";
    snap.forEach(d => {
      const m = d.data();
      const div = document.createElement("div");
      div.className = `msg-bubble ${m.senderId === currentUser.uid ? "msg-me" : "msg-them"}`;
      div.innerText = m.text;
      box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
  });
}

window.sendChatMessage = async function () {
  const input = document.getElementById("chat-msg-input");
  if (!input || !activeChatPartner) return;
  const text = input.value.trim();
  if (!text) return;

  const roomId = [currentUser.uid, activeChatPartner.uid].sort().join("_");
  input.value = "";
  await addDoc(collection(db, "chats", roomId, "messages"), {
    senderId: currentUser.uid,
    text,
    createdAt: serverTimestamp()
  });
};

async function loadNotifications() {
  const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  const box = document.getElementById("notifications-list");
  if (!box) return;
  box.innerHTML = "";
  snap.forEach(d => {
    const n = d.data();
    if (currentUser && n.toUid !== currentUser.uid) return;
    box.innerHTML += `
      <div class="user-row">
        <div class="user-row-left">
          <img src="${n.fromAvatar}">
          <div><strong>@${n.fromUsername}</strong> ${n.text}</div>
        </div>
      </div>
    `;
  });
  if (!box.innerHTML) {
    box.innerHTML = `<div class="loader">No notifications yet.</div>`;
  }
}

window.switchTab = function (viewId, navBtn = null) {
  document.querySelectorAll(".tab-view").forEach(v => v.classList.remove("active"));
  const targetView = document.getElementById(viewId);
  if (targetView) targetView.classList.add("active");

  if (navBtn) {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    navBtn.classList.add("active");
  }

  if (viewId === "messages-view") loadMessagesUsers();
  if (viewId === "notifications-view") loadNotifications();
};

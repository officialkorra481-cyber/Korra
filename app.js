import { 
  db, 
  auth, 
  collection, 
  addDoc, 
  deleteDoc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  serverTimestamp 
} from "./firebase-config.js";
import { initAuth, handleLogin, handleSignup, handleLogout } from "./auth.js";

// =========================================================================
// 1. GLOBAL STATE & MEDIA CONSTANTS
// =========================================================================
window.activePostIdForComments = null;
window.storyTimerInterval = null;
window.activeStoryData = null;
window.globalHideLikesAndComments = false;
window.defaultAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100";
window.activeMenuPostId = null;
window.activeMenuPostOwnerId = null;
window.visitedUserId = null;
let tempSelectedAvatarBase64 = null;

// Media Streams
let mediaStream = null;
let mediaRecorder = null;
let recordedBlobs = [];
let capturedMediaData = null;
let audioMediaRecorder = null;
let audioChunks = [];
window.activeFilterClass = "none";
window.currentDubbingLanguage = localStorage.getItem("korra_dub_lang") || "original";

// =========================================================================
// 2. MASTER NAVIGATION CONTROLLER
// =========================================================================
window.showScreen = function(screenId) {
  const allScreens = document.querySelectorAll(".screen-view");
  allScreens.forEach(s => {
    s.classList.remove("active");
    s.style.setProperty("display", "none", "important");
  });

  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add("active");
    target.style.setProperty("display", screenId === "screen-splash" ? "flex" : "block", "important");
    window.scrollTo(0, 0);
  }

  // Camera stream cleanup/setup
  if (screenId !== "screen-story-camera" && screenId !== "screen-video-call" && mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  if (screenId === "screen-story-camera") {
    window.initInAppCamera();
  }

  // Profile data sync
  if (screenId === "screen-profile" || screenId === "screen-edit-profile") {
    loadRealProfileData();
  }

  if (screenId !== "screen-story-camera" && window.storyTimerInterval) {
    clearInterval(window.storyTimerInterval);
  }

  // Bottom Bar Visibility
  const bottomBar = document.getElementById("master-bottom-bar");
  const hideScreens = [
    "screen-splash", "screen-login", "screen-signup", "screen-otp", 
    "screen-create-post", "screen-story-camera", "screen-reel-create", 
    "screen-live", "screen-chat", "screen-video-call", "screen-audio-call",
    "screen-user-profile"
  ];
  if (bottomBar) {
    bottomBar.style.display = hideScreens.includes(screenId) ? "none" : "flex";
  }

  if (window.lucide) window.lucide.createIcons();
};

window.switchTab = function(screenId, btn) {
  window.showScreen(screenId);
  document.querySelectorAll(".nav-tab-node").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
};

// =========================================================================
// 3. ANY USER PROFILE VISITING ENGINE (POST, STORY, DM TO PROFILE)
// =========================================================================
window.openUserProfile = async function(targetUserId, fallbackUsername, fallbackAvatar) {
  const currentUser = auth.currentUser;
  if (currentUser && currentUser.uid === targetUserId) {
    window.showScreen("screen-profile");
    return;
  }

  window.visitedUserId = targetUserId;
  let viewModal = document.getElementById("screen-user-profile");
  if (!viewModal) {
    viewModal = document.createElement("div");
    viewModal.id = "screen-user-profile";
    viewModal.className = "screen-view";
    viewModal.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:#000; z-index:99990; overflow-y:auto; padding-bottom:40px;";
    document.body.appendChild(viewModal);
  }

  viewModal.innerHTML = `
    <header class="top-nav" style="border-bottom:1px solid #1c1c1c; position:sticky; top:0; background:#000; z-index:10;">
      <button class="icon-action" onclick="document.getElementById('screen-user-profile').style.display='none';"><i data-lucide="arrow-left"></i></button>
      <b id="visited-user-header-title">${fallbackUsername || "User Profile"}</b>
      <button class="icon-action" onclick="window.blockUser('${targetUserId}', '${fallbackUsername || 'User'}')"><i data-lucide="slash"></i></button>
    </header>

    <div style="padding:16px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
        <img id="visited-user-dp" src="${fallbackAvatar || window.defaultAvatar}" style="width:78px; height:78px; border-radius:50%; object-fit:cover; border:2px solid #262626;">
        <div style="display:flex; flex:1; justify-content:space-around; text-align:center;">
          <div><b id="visited-post-count" style="color:#fff; font-size:16px;">0</b><div style="font-size:12px; color:#888;">Posts</div></div>
          <div><b id="visited-follower-count" style="color:#fff; font-size:16px;">0</b><div style="font-size:12px; color:#888;">Followers</div></div>
          <div><b id="visited-following-count" style="color:#fff; font-size:16px;">0</b><div style="font-size:12px; color:#888;">Following</div></div>
        </div>
      </div>

      <div style="margin-bottom:16px;">
        <b id="visited-fullname" style="color:#fff; font-size:14px;">${fallbackUsername || "User"}</b>
        <div id="visited-bio" style="color:#bbb; font-size:13px; margin-top:2px;">Korra community member</div>
      </div>

      <div style="display:flex; gap:10px; margin-bottom:20px;">
        <button id="btn-visit-follow-toggle" onclick="window.toggleFollowUser('${targetUserId}')" class="btn-profile-sub" style="flex:1; background:#0095f6; color:#fff; font-weight:600; height:36px; border-radius:8px;">Follow</button>
        <button onclick="window.showScreen('screen-chat'); document.getElementById('screen-user-profile').style.display='none';" class="btn-profile-sub" style="flex:1; background:#262626; color:#fff; font-weight:600; height:36px; border-radius:8px;">Message</button>
      </div>

      <div style="border-top:1px solid #1c1c1c; padding-top:12px;">
        <div style="display:flex; justify-content:center; gap:8px; margin-bottom:12px; color:#fff; font-size:13px; font-weight:600;">
          <i data-lucide="grid"></i> POSTS
        </div>
        <div id="visited-posts-grid" class="grid-container" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:2px;"></div>
      </div>
    </div>
  `;

  viewModal.style.display = "block";
  if (window.lucide) window.lucide.createIcons();

  // Load Real Profile Details of Visited User
  try {
    const uRef = doc(db, "users", targetUserId);
    const uSnap = await getDoc(uRef);
    if (uSnap.exists()) {
      const uData = uSnap.data();
      if (uData.username) {
        document.getElementById("visited-user-header-title").textContent = uData.username;
        document.getElementById("visited-fullname").textContent = uData.username;
      }
      if (uData.photoUrl) {
        document.getElementById("visited-user-dp").src = uData.photoUrl;
      }
      if (uData.bio) {
        document.getElementById("visited-bio").textContent = uData.bio;
      }

      const fCount = uData.followers ? uData.followers.length : 0;
      const fgCount = uData.following ? uData.following.length : 0;
      document.getElementById("visited-follower-count").textContent = fCount;
      document.getElementById("visited-following-count").textContent = fgCount;

      const fBtn = document.getElementById("btn-visit-follow-toggle");
      if (currentUser && uData.followers && uData.followers.includes(currentUser.uid)) {
        fBtn.textContent = "Following";
        fBtn.style.background = "#262626";
      } else {
        fBtn.textContent = "Follow";
        fBtn.style.background = "#0095f6";
      }
    }
  } catch (e) {
    console.error("Error visiting profile: ", e);
  }

  // Load Visited User Posts
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    let pCount = 0;
    const grid = document.getElementById("visited-posts-grid");
    if (!grid) return;
    grid.innerHTML = "";

    snapshot.forEach(docSnap => {
      const p = docSnap.data();
      if (p.userId === targetUserId) {
        pCount++;
        const item = document.createElement("div");
        item.style.cssText = "position:relative; width:100%; aspect-ratio:1/1; cursor:pointer;";
        item.onclick = () => window.openPostDetailModal(docSnap.id, p);
        item.innerHTML = `<img src="${p.imageUrl}" style="width:100%; height:100%; object-fit:cover;">`;
        grid.appendChild(item);
      }
    });

    const postCountEl = document.getElementById("visited-post-count");
    if (postCountEl) postCountEl.textContent = pCount;
  });
};

// =========================================================================
// 4. INSTANT PROFILE DP SYNC & PASSWORD EYE
// =========================================================================
window.togglePasswordVisibility = function(inputId, iconElement) {
  const input = document.getElementById(inputId);
  if (!input) return;

  if (input.type === "password") {
    input.type = "text";
    if (iconElement) iconElement.setAttribute("data-lucide", "eye-off");
  } else {
    input.type = "password";
    if (iconElement) iconElement.setAttribute("data-lucide", "eye");
  }
  if (window.lucide) window.lucide.createIcons();
};

function setupPasswordEyeToggles() {
  const passInputs = [{ id: "login-pass" }, { id: "signup-pass" }];
  passInputs.forEach(item => {
    const input = document.getElementById(item.id);
    if (input && !input.parentElement.querySelector(".btn-toggle-pass")) {
      const wrapper = input.parentElement;
      wrapper.style.position = "relative";
      input.style.paddingRight = "42px";

      const eyeBtn = document.createElement("button");
      eyeBtn.type = "button";
      eyeBtn.className = "btn-toggle-pass";
      eyeBtn.style.cssText = "position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; color:#888; cursor:pointer; padding:0; display:flex; align-items:center; z-index:10;";
      eyeBtn.innerHTML = `<i data-lucide="eye" style="width:18px; height:18px;"></i>`;
      eyeBtn.onclick = () => window.togglePasswordVisibility(item.id, eyeBtn.querySelector("i"));
      wrapper.appendChild(eyeBtn);
    }
  });
  if (window.lucide) window.lucide.createIcons();
}

function syncAllUserAvatars(photoUrl) {
  if (!photoUrl) return;
  const selectors = ["#screen-edit-profile img", ".profile-avatar-lg", ".nav-tab-avatar", ".story-thumb.my-story-dp"];
  document.querySelectorAll(selectors.join(",")).forEach(img => {
    img.src = photoUrl;
  });
}

function getCurrentUserAvatar() {
  const user = auth.currentUser;
  if (!user) return window.defaultAvatar;
  return localStorage.getItem(`korra_avatar_${user.uid}`) || window.defaultAvatar;
}

function loadRealProfileData() {
  const user = auth.currentUser;
  if (!user) return;

  const currentDp = getCurrentUserAvatar();
  syncAllUserAvatars(currentDp);

  const uname = user.email ? user.email.split("@")[0] : "koraa_user";
  document.querySelectorAll(".current-username-tag").forEach(el => el.textContent = uname);

  const userRef = doc(db, "users", user.uid);
  onSnapshot(userRef, (userDoc) => {
    if (userDoc.exists()) {
      const data = userDoc.data();
      const followers = data.followers || [];
      const following = data.following || [];

      const followerEl = document.querySelector("#screen-profile .stat-item:nth-child(3) b");
      const followingEl = document.querySelector("#screen-profile .stat-item:nth-child(4) b");
      if (followerEl) followerEl.textContent = followers.length;
      if (followingEl) followingEl.textContent = following.length;

      if (data.photoUrl) {
        localStorage.setItem(`korra_avatar_${user.uid}`, data.photoUrl);
        syncAllUserAvatars(data.photoUrl);
      }
    }
  });

  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    let myPostCount = 0;
    const profileGrid = document.querySelector("#screen-profile .grid-container");
    if (profileGrid) profileGrid.innerHTML = "";

    snapshot.forEach(docSnap => {
      const post = docSnap.data();
      if (post.userId === user.uid) {
        myPostCount++;
        if (profileGrid) {
          const imgWrap = document.createElement("div");
          imgWrap.style.cssText = "position:relative; width:100%; aspect-ratio:1/1; cursor:pointer;";
          imgWrap.onclick = () => window.openPostDetailModal(docSnap.id, post);
          imgWrap.innerHTML = `<img src="${post.imageUrl}" style="width:100%; height:100%; object-fit:cover;">`;
          profileGrid.appendChild(imgWrap);
        }
      }
    });

    const statCountEl = document.querySelector("#screen-profile .stat-item:nth-child(2) b");
    if (statCountEl) statCountEl.textContent = myPostCount;
  });
}

window.triggerProfilePicChange = function() {
  let picInput = document.getElementById("profile-pic-file-input");
  if (!picInput) {
    picInput = document.createElement("input");
    picInput.type = "file";
    picInput.id = "profile-pic-file-input";
    picInput.accept = "image/*";
    picInput.style.display = "none";
    document.body.appendChild(picInput);

    picInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      const user = auth.currentUser;
      if (!file || !user) return;

      const localPreviewUrl = URL.createObjectURL(file);
      syncAllUserAvatars(localPreviewUrl);

      try {
        const compressed = await compressImage(file);
        tempSelectedAvatarBase64 = compressed;
        syncAllUserAvatars(compressed);
        localStorage.setItem(`korra_avatar_${user.uid}`, compressed);

        await setDoc(doc(db, "users", user.uid), {
          photoUrl: compressed,
          updatedAt: serverTimestamp()
        }, { merge: true });

        picInput.value = "";
      } catch (err) {
        alert("DP save error: " + err.message);
      }
    });
  }
  picInput.click();
};

window.saveProfileEdits = async function() {
  const user = auth.currentUser;
  if (!user) return;

  const inputs = document.querySelectorAll("#screen-edit-profile input");
  const nameVal = inputs[0] ? inputs[0].value.trim() : "";
  const usernameVal = inputs[1] ? inputs[1].value.trim() : "";
  const bioVal = inputs[2] ? inputs[2].value.trim() : "";

  try {
    const updateObj = { updatedAt: serverTimestamp() };
    if (nameVal) updateObj.name = nameVal;
    if (usernameVal) updateObj.username = usernameVal;
    if (bioVal) updateObj.bio = bioVal;
    if (tempSelectedAvatarBase64) updateObj.photoUrl = tempSelectedAvatarBase64;

    await setDoc(doc(db, "users", user.uid), updateObj, { merge: true });
    alert("Profile saved successfully!");
    window.showScreen("screen-profile");
  } catch (err) {
    alert("Profile save failed: " + err.message);
  }
};

window.toggleFollowUser = async function(targetUserId) {
  const currentUser = auth.currentUser;
  if (!currentUser) return alert("Pehle login karein!");
  if (currentUser.uid === targetUserId) return alert("Aap khud ko follow nahi kar sakte!");

  const myRef = doc(db, "users", currentUser.uid);
  const targetRef = doc(db, "users", targetUserId);

  try {
    const myDoc = await getDoc(myRef);
    const following = myDoc.exists() && myDoc.data().following ? myDoc.data().following : [];
    const isFollowing = following.includes(targetUserId);

    if (isFollowing) {
      await updateDoc(myRef, { following: arrayRemove(targetUserId) });
      await updateDoc(targetRef, { followers: arrayRemove(currentUser.uid) });
      alert("Unfollowed!");
    } else {
      await updateDoc(myRef, { following: arrayUnion(targetUserId) });
      await updateDoc(targetRef, { followers: arrayUnion(currentUser.uid) });
      alert("Following!");
    }

    if (window.visitedUserId === targetUserId) {
      window.openUserProfile(targetUserId);
    }
  } catch (err) {
    alert("Follow action error: " + err.message);
  }
};

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 600;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}
// =========================================================================
// 5. IN-APP CAMERA (LIVE FILTERS & VIDEO RECORDING ENGINE)
// =========================================================================
window.initInAppCamera = async function() {
  const cameraScreen = document.getElementById("screen-story-camera");
  if (!cameraScreen) return;

  cameraScreen.innerHTML = `
    <div style="position:relative; width:100vw; height:100vh; background:#000; overflow:hidden;">
      <video id="camera-live-preview" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover; filter:${window.activeFilterClass};"></video>
      
      <div id="capture-preview-box" style="position:absolute; top:0; left:0; width:100%; height:100%; background:#000; display:none; align-items:center; justify-content:center; z-index:22;">
        <img id="captured-img-preview" style="width:100%; height:100%; object-fit:contain; display:none;">
        <video id="captured-vid-preview" controls playsinline style="width:100%; height:100%; object-fit:contain; display:none;"></video>
      </div>

      <!-- Live Filters Reel -->
      <div id="camera-filter-scroller" style="position:absolute; bottom:120px; left:0; width:100%; display:flex; gap:10px; overflow-x:auto; padding:8px 16px; z-index:25;">
        <button onclick="window.applyLiveFilter('none')" class="btn-profile-sub" style="font-size:11px; padding:4px 10px; background:#222;">Normal</button>
        <button onclick="window.applyLiveFilter('contrast(1.4) saturate(1.3)')" class="btn-profile-sub" style="font-size:11px; padding:4px 10px; background:#222;">Clarendon</button>
        <button onclick="window.applyLiveFilter('sepia(0.6) hue-rotate(-20deg)')" class="btn-profile-sub" style="font-size:11px; padding:4px 10px; background:#222;">Vintage</button>
        <button onclick="window.applyLiveFilter('grayscale(100%)')" class="btn-profile-sub" style="font-size:11px; padding:4px 10px; background:#222;">B&W</button>
        <button onclick="window.applyLiveFilter('invert(85%)')" class="btn-profile-sub" style="font-size:11px; padding:4px 10px; background:#222;">Cyber</button>
      </div>

      <!-- Capture Controls -->
      <div id="camera-default-controls" style="position:absolute; bottom:30px; left:0; width:100%; display:flex; justify-content:space-around; align-items:center; z-index:25;">
        <button onclick="window.triggerStoryGalleryPick()" style="background:rgba(255,255,255,0.2); border:none; border-radius:12px; padding:12px; color:#fff; cursor:pointer;"><i data-lucide="image"></i></button>
        
        <div id="shutter-btn" onclick="window.takeSnapshot()" style="width:72px; height:72px; border-radius:50%; border:4px solid #fff; display:flex; align-items:center; justify-content:center; cursor:pointer;">
          <div style="width:56px; height:56px; border-radius:50%; background:#fff;"></div>
        </div>

        <button id="btn-video-shoot" onclick="window.toggleVideoRecord()" style="background:#ff3b30; border:none; border-radius:12px; padding:12px; color:#fff; cursor:pointer;"><i data-lucide="video"></i></button>
      </div>

      <!-- Retake / Post Controls -->
      <div id="camera-retake-controls" style="position:absolute; bottom:40px; left:0; width:100%; display:none; justify-content:center; gap:20px; z-index:30;">
        <button onclick="window.retakeCapture()" class="btn-profile-sub" style="width:120px; height:42px; background:#333;"><i data-lucide="rotate-ccw"></i> Retake</button>
        <button onclick="window.confirmCapturedMedia()" class="btn-profile-sub" style="width:120px; height:42px; background:#0095f6;"><i data-lucide="check"></i> Post Story</button>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
    const video = document.getElementById("camera-live-preview");
    if (video) video.srcObject = mediaStream;
  } catch (err) {
    alert("Camera permission error: " + err.message);
  }
};

window.applyLiveFilter = function(filterStyle) {
  window.activeFilterClass = filterStyle;
  const vid = document.getElementById("camera-live-preview");
  if (vid) vid.style.filter = filterStyle;
};

window.takeSnapshot = function() {
  const video = document.getElementById("camera-live-preview");
  if (!video) return;

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 720;
  canvas.height = video.videoHeight || 1280;
  const ctx = canvas.getContext("2d");
  if (window.activeFilterClass !== "none") ctx.filter = window.activeFilterClass;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  capturedMediaData = canvas.toDataURL("image/jpeg", 0.75);

  const previewBox = document.getElementById("capture-preview-box");
  const imgPreview = document.getElementById("captured-img-preview");
  previewBox.style.display = "flex";
  imgPreview.src = capturedMediaData;
  imgPreview.style.display = "block";

  document.getElementById("camera-default-controls").style.display = "none";
  document.getElementById("camera-filter-scroller").style.display = "none";
  document.getElementById("camera-retake-controls").style.display = "flex";
};

window.toggleVideoRecord = function() {
  const btn = document.getElementById("btn-video-shoot");
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    btn.style.background = "#ff3b30";
  } else {
    recordedBlobs = [];
    try {
      mediaRecorder = new MediaRecorder(mediaStream);
    } catch (e) {
      return alert("Video Recording not supported on this browser.");
    }

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) recordedBlobs.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const superBuffer = new Blob(recordedBlobs, { type: "video/mp4" });
      const vidPreview = document.getElementById("captured-vid-preview");
      const previewBox = document.getElementById("capture-preview-box");
      vidPreview.src = window.URL.createObjectURL(superBuffer);
      previewBox.style.display = "flex";
      vidPreview.style.display = "block";
      document.getElementById("camera-default-controls").style.display = "none";
      document.getElementById("camera-filter-scroller").style.display = "none";
      document.getElementById("camera-retake-controls").style.display = "flex";
    };

    mediaRecorder.start();
    btn.style.background = "#28cd41";
    alert("Video recording shuru ho gayi! Rokne ke liye dobara wahi button dabayein.");
  }
};

window.retakeCapture = function() {
  capturedMediaData = null;
  document.getElementById("capture-preview-box").style.display = "none";
  document.getElementById("captured-img-preview").style.display = "none";
  document.getElementById("captured-vid-preview").style.display = "none";
  document.getElementById("camera-default-controls").style.display = "flex";
  document.getElementById("camera-filter-scroller").style.display = "flex";
  document.getElementById("camera-retake-controls").style.display = "none";
};

window.confirmCapturedMedia = async function() {
  if (!capturedMediaData) return;
  const user = auth.currentUser;
  if (!user) return alert("Pehle login karein!");

  alert("Story upload ho rahi hai...");
  try {
    const userAvatar = getCurrentUserAvatar();
    await addDoc(collection(db, "stories"), {
      imageUrl: capturedMediaData,
      userId: user.uid,
      userAvatar: userAvatar,
      username: user.email ? user.email.split("@")[0] : "koraa_user",
      likes: [],
      createdAt: serverTimestamp()
    });
    alert("Story successfully live ho gayi!");
    window.showScreen("screen-home");
  } catch (err) {
    alert("Story upload error: " + err.message);
  }
};

// =========================================================================
// 6. VOICE NOTE RECORDER & CALL ENGINE
// =========================================================================
window.toggleAudioRecord = async function() {
  const micBtn = document.getElementById("btn-mic-record");
  if (audioMediaRecorder && audioMediaRecorder.state === "recording") {
    audioMediaRecorder.stop();
    if (micBtn) micBtn.style.color = "#fff";
  } else {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      audioMediaRecorder = new MediaRecorder(stream);

      audioMediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      audioMediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result;
          const user = auth.currentUser;
          if (user) {
            await addDoc(collection(db, "messages"), {
              audioType: true,
              audioData: base64Audio,
              senderId: user.uid,
              senderName: user.email ? user.email.split("@")[0] : "user",
              seen: false,
              createdAt: serverTimestamp()
            });
          }
        };
      };

      audioMediaRecorder.start();
      if (micBtn) micBtn.style.color = "#ff2d55";
      alert("Voice note recording shuru ho gayi! Bhejne ke liye mic dobara dabayein.");
    } catch (err) {
      alert("Mic permission nahi mili: " + err.message);
    }
  }
};

window.startCall = function(callType) {
  const screenId = callType === "video" ? "screen-video-call" : "screen-audio-call";
  window.showScreen(screenId);

  const callScreen = document.getElementById(screenId);
  if (!callScreen) return;

  callScreen.innerHTML = `
    <div style="position:relative; width:100vw; height:100vh; background:#121212; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:60px 20px;">
      <div style="text-align:center;">
        <img src="${window.defaultAvatar}" style="width:96px; height:96px; border-radius:50%; margin-bottom:14px; border:2px solid #333;">
        <h3 style="color:#fff; margin:0; font-size:20px;">Calling...</h3>
        <p style="color:#888; font-size:13px; margin-top:6px;">Ringing</p>
      </div>

      ${callType === "video" ? `<video id="video-call-self" autoplay playsinline muted style="width:130px; height:180px; object-fit:cover; border-radius:12px; border:2px solid #333;"></video>` : ''}

      <div style="display:flex; gap:24px; align-items:center;">
        <button onclick="alert('Mic toggled')" style="background:#222; border:none; width:52px; height:52px; border-radius:50%; color:#fff; cursor:pointer;"><i data-lucide="mic"></i></button>
        <button onclick="window.endCall()" style="background:#ff3b30; border:none; width:64px; height:64px; border-radius:50%; color:#fff; cursor:pointer;"><i data-lucide="phone-off"></i></button>
        <button onclick="alert('Speaker toggled')" style="background:#222; border:none; width:52px; height:52px; border-radius:50%; color:#fff; cursor:pointer;"><i data-lucide="volume-2"></i></button>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();

  if (callType === "video") {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(s => {
      mediaStream = s;
      const v = document.getElementById("video-call-self");
      if (v) v.srcObject = s;
    }).catch(() => {});
  }
};

window.endCall = function() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  window.showScreen("screen-chat");
};

// =========================================================================
// 7. REAL-TIME CHAT ENGINE (NO DUPLICATE ICONS & TAP USER PROFILE)
// =========================================================================
window.sendChatMessage = async function() {
  const input = document.getElementById("chat-msg-input");
  const text = input ? input.value.trim() : "";
  const user = auth.currentUser;

  if (!text) return;
  if (!user) return alert("Pehle login karein!");

  try {
    input.value = "";
    await addDoc(collection(db, "messages"), {
      text: text,
      senderId: user.uid,
      senderName: user.email ? user.email.split("@")[0] : "user",
      seen: false,
      createdAt: serverTimestamp()
    });

    const chatBox = document.getElementById("chat-messages-scroll-box");
    if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
  } catch (err) {
    alert("Message send fail: " + err.message);
  }
};

window.unsendMessage = async function(msgId) {
  if (!confirm("Kya aap ye message unsend karna chahte hain?")) return;
  try {
    await deleteDoc(doc(db, "messages", msgId));
  } catch (err) {
    alert("Unsend fail: " + err.message);
  }
};

// Clean Header: Removes HTML hardcoded duplicates and renders strictly 1 audio & 1 video button[span_2](start_span)[span_2](end_span)[span_3](start_span)[span_3](end_span)
function renderCleanChatHeader(peerName = "Pooja", peerAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100", peerId = null) {
  const chatHeader = document.querySelector("#screen-chat .top-nav");
  if (!chatHeader) return;

  chatHeader.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px;">
      <button class="icon-action" onclick="window.showScreen('screen-messages')" style="background:none; border:none; color:#fff; cursor:pointer; padding:0; display:flex; align-items:center;">
        <i data-lucide="arrow-left"></i>
      </button>
      <div style="display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="if('${peerId}' && '${peerId}' !== 'null') window.openUserProfile('${peerId}', '${peerName}', '${peerAvatar}');">
        <img src="${peerAvatar}" style="width:34px; height:34px; border-radius:50%; object-fit:cover;">
        <div>
          <b style="color:#fff; font-size:14px; display:block; line-height:1.2;">${peerName}</b>
          <span style="font-size:11px; color:#28cd41; display:flex; align-items:center; gap:4px; margin-top:2px;">
            <span style="width:6px; height:6px; border-radius:50%; background:#28cd41; display:inline-block;"></span> Active now
          </span>
        </div>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:18px;">
      <button onclick="window.startCall('audio')" style="background:none; border:none; color:#fff; cursor:pointer; padding:2px; display:flex; align-items:center;">
        <i data-lucide="phone"></i>
      </button>
      <button onclick="window.startCall('video')" style="background:none; border:none; color:#fff; cursor:pointer; padding:2px; display:flex; align-items:center;">
        <i data-lucide="video"></i>
      </button>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
}

function listenToMessages() {
  const chatScreen = document.getElementById("screen-chat");
  if (!chatScreen) return;

  renderCleanChatHeader();

  let chatContainer = document.getElementById("chat-messages-scroll-box");
  if (!chatContainer) {
    chatContainer = document.createElement("div");
    chatContainer.id = "chat-messages-scroll-box";
    chatContainer.style.cssText = "flex:1; overflow-y:auto; padding:16px 12px 80px; display:flex; flex-direction:column; gap:8px;";
    chatScreen.appendChild(chatContainer);
  }

  if (!document.getElementById("chat-send-bar")) {
    const bar = document.createElement("div");
    bar.id = "chat-send-bar";
    bar.style.cssText = "position:fixed; bottom:0; left:0; width:100%; display:flex; align-items:center; gap:8px; padding:10px 14px; background:#000; border-top:1px solid #1c1c1c; z-index:100;";
    bar.innerHTML = `
      <button id="btn-mic-record" onclick="window.toggleAudioRecord()" style="background:none; border:none; color:#fff; cursor:pointer; padding:4px;"><i data-lucide="mic"></i></button>
      <input type="text" id="chat-msg-input" placeholder="Message..." style="flex:1; height:40px; background:#121212; border:1px solid #262626; border-radius:20px; color:#fff; padding:0 16px; outline:none; font-size:14px;">
      <button id="btn-send-chat" onclick="window.sendChatMessage()" style="background:none; border:none; color:#0095f6; font-weight:700; font-size:14px; cursor:pointer; padding:6px 10px;">Send</button>
    `;
    chatScreen.appendChild(bar);

    const msgInput = document.getElementById("chat-msg-input");
    msgInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        window.sendChatMessage();
      }
    });

    if (window.lucide) window.lucide.createIcons();
  }

  const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
  onSnapshot(q, (snapshot) => {
    chatContainer.innerHTML = "";
    const user = auth.currentUser;

    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      const id = docSnap.id;
      const isMe = user && msg.senderId === user.uid;

      if (!isMe && !msg.seen && user) {
        updateDoc(doc(db, "messages", id), { seen: true });
      }

      const bubbleWrap = document.createElement("div");
      bubbleWrap.style.cssText = `display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; margin:2px 0;`;

      const bubble = document.createElement("div");
      bubble.style.cssText = `max-width:75%; padding:10px 14px; border-radius:18px; font-size:14px; line-height:1.4; word-break:break-word; ${isMe ? 'background:#3797f0; color:#fff; border-bottom-right-radius:4px;' : 'background:#262626; color:#fff; border-bottom-left-radius:4px;'}`;

      if (msg.audioType) {
        bubble.innerHTML = `<audio controls src="${msg.audioData}" style="max-width:210px; height:36px;"></audio>`;
      } else {
        bubble.textContent = msg.text;
      }

      if (isMe) {
        bubble.style.cursor = "pointer";
        bubble.title = "Tap to unsend";
        bubble.onclick = () => window.unsendMessage(id);
      } else {
        bubble.style.cursor = "pointer";
        bubble.title = "View profile";
        bubble.onclick = () => window.openUserProfile(msg.senderId, msg.senderName);
      }

      bubbleWrap.appendChild(bubble);

      if (isMe) {
        const statusText = document.createElement("span");
        statusText.style.cssText = "font-size:10px; color:#737373; margin-top:2px; margin-right:4px;";
        statusText.textContent = msg.seen ? "Seen" : "Sent";
        bubbleWrap.appendChild(statusText);
      }

      chatContainer.appendChild(bubbleWrap);
    });

    chatContainer.scrollTop = chatContainer.scrollHeight;
  });
}
// =========================================================================
// 8. COMMENTS ENGINE & LIVE REAL-TIME COUNT (LINKED TO USER PROFILE)
// =========================================================================
window.openCommentsForPost = function(postId) {
  window.activePostIdForComments = postId;
  
  let sheet = document.getElementById("comments-slide-sheet");
  if (!sheet) {
    sheet = document.createElement("div");
    sheet.id = "comments-slide-sheet";
    sheet.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.65); z-index:99999; display:none; flex-direction:column; justify-content:flex-end;";
    sheet.onclick = (e) => {
      if (e.target.id === "comments-slide-sheet") sheet.style.display = "none";
    };
    document.body.appendChild(sheet);
  }

  sheet.innerHTML = `
    <div style="background:#1c1c1c; border-radius:18px 18px 0 0; width:100%; max-height:80vh; display:flex; flex-direction:column; overflow:hidden;">
      <div style="padding:12px 16px; border-bottom:1px solid #2a2a2a; display:flex; align-items:center; justify-content:space-between;">
        <div style="width:30px;"></div>
        <b style="color:#fff; font-size:14px;">Comments</b>
        <button onclick="document.getElementById('comments-slide-sheet').style.display='none'" style="background:none; border:none; color:#fff; font-size:20px; cursor:pointer;">✕</button>
      </div>

      <div id="comments-tray-list" style="flex:1; overflow-y:auto; padding:16px; min-height:220px; max-height:55vh;"></div>

      <div style="padding:10px 14px; background:#121212; border-top:1px solid #2a2a2a; display:flex; align-items:center; gap:10px;">
        <input type="text" id="new-comment-input" placeholder="Add a comment..." style="flex:1; height:38px; background:#222; border:1px solid #333; border-radius:20px; color:#fff; padding:0 14px; outline:none; font-size:13px;">
        <button id="btn-post-comment" style="background:none; border:none; color:#0095f6; font-weight:600; font-size:14px; cursor:pointer;">Post</button>
      </div>
    </div>
  `;

  sheet.style.display = "flex";

  const postBtn = document.getElementById("btn-post-comment");
  if (postBtn) {
    postBtn.onclick = () => submitComment(postId);
  }

  const listBox = document.getElementById("comments-tray-list");
  const q = query(collection(db, "posts", postId, "comments"), orderBy("createdAt", "asc"));
  onSnapshot(q, (snapshot) => {
    if (!listBox) return;
    listBox.innerHTML = "";
    if (snapshot.empty) {
      listBox.innerHTML = '<div style="text-align:center; padding:30px; color:#777; font-size:13px;">No comments yet. Write the first one!</div>';
      return;
    }

    snapshot.forEach(docSnap => {
      const c = docSnap.data();
      const row = document.createElement("div");
      row.style.cssText = "display:flex; gap:10px; margin-bottom:14px; align-items:flex-start;";
      row.innerHTML = `
        <img src="${c.userAvatar || window.defaultAvatar}" onclick="window.openUserProfile('${c.userId}', '${c.username || 'user'}', '${c.userAvatar}')" style="width:32px; height:32px; border-radius:50%; object-fit:cover; cursor:pointer;">
        <div style="flex:1; font-size:13px; color:#fff;">
          <b style="cursor:pointer;" onclick="window.openUserProfile('${c.userId}', '${c.username || 'user'}', '${c.userAvatar}')">${c.username || "user"}</b> 
          <span style="color:#e0e0e0; margin-left:4px;">${c.text}</span>
        </div>
      `;
      listBox.appendChild(row);
    });
  });
};

async function submitComment(postId) {
  const input = document.getElementById("new-comment-input");
  const text = input ? input.value.trim() : "";
  const user = auth.currentUser;

  if (!text) return;
  if (!user) return alert("Pehle login karein!");

  try {
    const userAvatar = getCurrentUserAvatar();
    await addDoc(collection(db, "posts", postId, "comments"), {
      text: text,
      userId: user.uid,
      userAvatar: userAvatar,
      username: user.email ? user.email.split("@")[0] : "user",
      createdAt: serverTimestamp()
    });
    input.value = "";
  } catch (err) {
    alert("Comment fail: " + err.message);
  }
}

// =========================================================================
// 9. POST ACTIONS, DOUBLE-TAP ZOOM & FEED LOADER (CLICKABLE USER PROFILES)
// =========================================================================
window.openPostDetailModal = function(postId, post) {
  let modal = document.getElementById("post-detail-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "post-detail-modal";
    modal.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:#000; z-index:99990; overflow-y:auto; padding-bottom:60px;";
    document.body.appendChild(modal);
  }

  const userAvatar = post.userAvatar || window.defaultAvatar;
  modal.innerHTML = `
    <header class="top-nav" style="border-bottom:1px solid #1c1c1c;">
      <button class="icon-action" onclick="document.getElementById('post-detail-modal').style.display='none';"><i data-lucide="arrow-left"></i></button>
      <b>Post</b>
      <button class="icon-action" onclick="window.handlePostMenu('${postId}', '${post.userId}')"><i data-lucide="more-horizontal"></i></button>
    </header>
    <div style="padding:10px 14px; display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="window.openUserProfile('${post.userId}', '${post.username || 'koraa_user'}', '${userAvatar}')">
      <img src="${userAvatar}" style="width:34px; height:34px; border-radius:50%; object-fit:cover;">
      <b>${post.username || "koraa_user"}</b>
    </div>
    <div style="width:100%; aspect-ratio:1/1; background:#121212;">
      <img src="${post.imageUrl}" style="width:100%; height:100%; object-fit:cover;">
    </div>
    <div style="padding:12px 14px;">
      <div><b style="cursor:pointer;" onclick="window.openUserProfile('${post.userId}', '${post.username || 'koraa_user'}', '${userAvatar}')">${post.username || "koraa_user"}</b> ${post.caption || ""}</div>
    </div>
  `;
  modal.style.display = "block";
  if (window.lucide) window.lucide.createIcons();
};

window.handlePostMenu = function(postId, postOwnerId) {
  const user = auth.currentUser;
  if (!user) return alert("Pehle login karein!");

  window.activeMenuPostId = postId;
  window.activeMenuPostOwnerId = postOwnerId;

  let sheet = document.getElementById("insta-action-sheet");
  if (!sheet) {
    sheet = document.createElement("div");
    sheet.id = "insta-action-sheet";
    sheet.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.65); z-index:999999; display:none; align-items:flex-end; justify-content:center;";
    sheet.onclick = (e) => {
      if (e.target.id === "insta-action-sheet") sheet.style.display = "none";
    };
    document.body.appendChild(sheet);
  }

  const isOwner = user.uid === postOwnerId;
  sheet.innerHTML = `
    <div style="background:#262626; width:100%; max-width:500px; border-radius:18px 18px 0 0; padding:12px 0 24px;">
      <div style="width:36px; height:4px; background:#4a4a4a; border-radius:2px; margin:0 auto 14px;"></div>
      ${isOwner ? `
        <div onclick="window.sheetActionDelete()" style="padding:14px 20px; color:#ff3b30; font-weight:600; font-size:15px; border-bottom:1px solid #333; display:flex; align-items:center; gap:12px; cursor:pointer;">
          <i data-lucide="trash-2"></i> Delete Post
        </div>
      ` : `
        <div onclick="alert('Post reported.')" style="padding:14px 20px; color:#ff3b30; font-weight:600; font-size:15px; border-bottom:1px solid #333; display:flex; align-items:center; gap:12px; cursor:pointer;">
          <i data-lucide="alert-octagon"></i> Report Post
        </div>
      `}
      <div onclick="document.getElementById('insta-action-sheet').style.display='none'" style="padding:14px 20px; color:#a8a8a8; font-size:15px; display:flex; align-items:center; gap:12px; cursor:pointer;">
        <i data-lucide="x"></i> Cancel
      </div>
    </div>
  `;
  sheet.style.display = "flex";
  if (window.lucide) window.lucide.createIcons();
};

window.sheetActionDelete = async function() {
  document.getElementById("insta-action-sheet").style.display = "none";
  if (!confirm("Delete this post permanently?")) return;

  try {
    await deleteDoc(doc(db, "posts", window.activeMenuPostId));
    alert("Post delete ho gayi!");
    const modal = document.getElementById("post-detail-modal");
    if (modal) modal.style.display = "none";
  } catch (err) {
    alert("Delete fail: " + err.message);
  }
};

window.toggleImageZoom = function(imgElement) {
  if (imgElement.style.transform === "scale(1.8)") {
    imgElement.style.transform = "scale(1)";
    imgElement.style.transition = "transform 0.3s ease";
    imgElement.style.zIndex = "1";
  } else {
    imgElement.style.transform = "scale(1.8)";
    imgElement.style.transition = "transform 0.3s ease";
    imgElement.style.zIndex = "50";
  }
};

function listenToFeed() {
  const postsFeed = document.getElementById("posts-feed-container");
  if (!postsFeed) return;

  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      postsFeed.innerHTML = '<div style="text-align:center; padding: 40px; color:#555;">No posts yet. Tap + to upload first photo!</div>';
      return;
    }

    postsFeed.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const id = docSnap.id;
      const user = auth.currentUser;
      const isLiked = data.likes && user ? data.likes.includes(user.uid) : false;
      const likesCount = data.likes ? data.likes.length : 0;
      
      let authorAvatar = data.userAvatar || window.defaultAvatar;
      if (user && data.userId === user.uid) {
        authorAvatar = getCurrentUserAvatar();
      }

      const post = document.createElement("article");
      post.className = "feed-post";
      post.innerHTML = `
        <div class="post-user-bar">
          <div class="post-author" style="cursor:pointer;" onclick="window.openUserProfile('${data.userId}', '${data.username || 'koraa_user'}', '${authorAvatar}')">
            <img class="post-author-img" src="${authorAvatar}">
            <span>${data.username || "koraa_user"}</span>
          </div>
          <button class="btn-icon" onclick="window.handlePostMenu('${id}', '${data.userId}')" style="cursor:pointer;">
            <i data-lucide="more-horizontal"></i>
          </button>
        </div>

        <div class="post-media-box" style="position:relative; overflow:hidden;">
          <img src="${data.imageUrl}" ondblclick="window.toggleImageZoom(this)" onclick="window.openPostDetailModal('${id}', ${JSON.stringify(data).replace(/"/g, '&quot;')})">
        </div>

        <div class="post-action-bar">
          <div class="left">
            <button class="btn-icon btn-like ${isLiked ? 'liked' : ''}" onclick="window.toggleLike('${id}', ${isLiked})">
              <i data-lucide="heart" style="${isLiked ? 'fill:#ff2d55; color:#ff2d55;' : ''}"></i>
            </button>
            <button class="btn-icon" onclick="window.openCommentsForPost('${id}')">
              <i data-lucide="message-circle"></i>
            </button>
            <button class="btn-icon" onclick="window.openUserProfile('${data.userId}', '${data.username || 'koraa_user'}', '${authorAvatar}')">
              <i data-lucide="send"></i>
            </button>
          </div>
          <button class="btn-icon" onclick="this.classList.toggle('bookmarked')">
            <i data-lucide="bookmark"></i>
          </button>
        </div>

        <div class="post-details">
          <div class="likes">${likesCount} likes</div>
          <div class="caption">
            <span style="cursor:pointer;" onclick="window.openUserProfile('${data.userId}', '${data.username || 'koraa_user'}', '${authorAvatar}')">${data.username || "koraa_user"}</span>${data.caption || ""}
          </div>
          <div id="comment-count-label-${id}" style="color:#737373; font-size:12px; margin-top:4px; cursor:pointer;" onclick="window.openCommentsForPost('${id}')">
            View comments...
          </div>
        </div>
      `;
      postsFeed.appendChild(post);

      const commentsSubQuery = query(collection(db, "posts", id, "comments"));
      onSnapshot(commentsSubQuery, (cSnap) => {
        const countLabel = document.getElementById(`comment-count-label-${id}`);
        if (countLabel) {
          const count = cSnap.size;
          if (count === 0) countLabel.textContent = "Add a comment...";
          else if (count === 1) countLabel.textContent = "View 1 comment";
          else countLabel.textContent = `View all ${count} comments`;
        }
      });
    });

    if (window.lucide) window.lucide.createIcons();
  });
}

window.toggleLike = async function(postId, isLiked) {
  const user = auth.currentUser;
  if (!user) return alert("Pehle login karein!");
  
  try {
    const postRef = doc(db, "posts", postId);
    await updateDoc(postRef, {
      likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
    });
  } catch (err) {
    console.error("Like Action Error: ", err);
  }
};
// =========================================================================
// 10. STORIES ENGINE & DYNAMIC TRAY (LINKED TO USER PROFILE)
// =========================================================================
window.triggerStoryGalleryPick = function() {
  let storyInput = document.getElementById("story-gallery-picker");
  if (!storyInput) {
    storyInput = document.createElement("input");
    storyInput.type = "file";
    storyInput.id = "story-gallery-picker";
    storyInput.accept = "image/*";
    storyInput.style.display = "none";
    document.body.appendChild(storyInput);

    storyInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      const user = auth.currentUser;
      if (!file || !user) return alert("Pehle login karein!");

      alert("Story compress hokar live ho rahi hai...");
      try {
        const compressed = await compressImage(file);
        const userAvatar = getCurrentUserAvatar();
        await addDoc(collection(db, "stories"), {
          imageUrl: compressed,
          userId: user.uid,
          userAvatar: userAvatar,
          username: user.email ? user.email.split("@")[0] : "koraa_user",
          likes: [],
          createdAt: serverTimestamp()
        });
        alert("Story successfully uploaded!");
        window.showScreen("screen-home");
        storyInput.value = "";
      } catch (err) {
        alert("Story upload fail: " + err.message);
      }
    });
  }
  storyInput.click();
};

function listenToStories() {
  const tray = document.querySelector(".stories-tray");
  if (!tray) return;

  const currentDp = getCurrentUserAvatar();
  const q = query(collection(db, "stories"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    tray.innerHTML = `
      <div class="story-node" onclick="window.triggerStoryGalleryPick()">
        <div class="story-border" style="background:#262626; position:relative;">
          <img class="story-thumb my-story-dp" src="${currentDp}">
          <div style="position:absolute; bottom:2px; right:2px; background:#0095f6; width:18px; height:18px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-size:12px; font-weight:bold; border:2px solid #000;">+</div>
        </div>
        <span class="story-label">Your story</span>
      </div>
    `;

    const now = Date.now();
    const seenStories = JSON.parse(localStorage.getItem("seen_stories_korra") || "[]");

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const id = docSnap.id;
      const storyTime = data.createdAt ? data.createdAt.toMillis() : now;

      if (now - storyTime < 86400000) {
        const isSeen = seenStories.includes(id);
        const node = document.createElement("div");
        node.className = "story-node";
        node.onclick = () => {
          if (!seenStories.includes(id)) {
            seenStories.push(id);
            localStorage.setItem("seen_stories_korra", JSON.stringify(seenStories));
          }
          window.openStoryViewer(id, data);
        };

        const borderStyle = isSeen 
          ? "background: #3a3a3a !important;" 
          : "background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);";

        node.innerHTML = `
          <div class="story-border" style="${borderStyle}">
            <img class="story-thumb" src="${data.imageUrl}">
          </div>
          <span class="story-label" style="${isSeen ? 'color:#666;' : ''}">${data.username || "user"}</span>
        `;
        tray.appendChild(node);
      }
    });
  });
}

window.openStoryViewer = function(storyId, data) {
  window.activeStoryData = { id: storyId, ...data };
  const user = auth.currentUser;
  const isOwner = user && user.uid === data.userId;
  const isLiked = data.likes && user ? data.likes.includes(user.uid) : false;
  const authorAvatar = data.userAvatar || window.defaultAvatar;

  let viewer = document.getElementById("fullscreen-story-viewer");
  if (!viewer) {
    viewer = document.createElement("div");
    viewer.id = "fullscreen-story-viewer";
    viewer.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:#000; z-index:99999; display:flex; flex-direction:column; justify-content:center; align-items:center;";
    document.body.appendChild(viewer);
  }

  viewer.innerHTML = `
    <div id="story-progress-bg" style="position:absolute; top:12px; left:12px; right:12px; height:3px; background:rgba(255,255,255,0.3); border-radius:3px; overflow:hidden;">
      <div id="story-progress-bar" style="width:0%; height:100%; background:#fff; transition:width 0.1s linear;"></div>
    </div>
    
    <div style="position:absolute; top:24px; left:16px; right:16px; display:flex; align-items:center; justify-content:space-between; z-index:10;">
      <div style="display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="window.closeStoryViewer(); window.openUserProfile('${data.userId}', '${data.username || 'user'}', '${authorAvatar}');">
        <img src="${authorAvatar}" style="width:34px; height:34px; border-radius:50%; object-fit:cover; border:1px solid #fff;">
        <b style="color:#fff; font-size:13px;">${data.username || "user"}</b>
      </div>
      <div style="display:flex; align-items:center; gap:14px;">
        ${isOwner ? `<button onclick="window.deleteStory('${storyId}')" style="background:none; border:none; color:#ff2d55; font-size:18px; cursor:pointer;"><i data-lucide="trash-2"></i></button>` : ''}
        <button onclick="window.closeStoryViewer()" style="background:none; border:none; color:#fff; font-size:24px; cursor:pointer;">✕</button>
      </div>
    </div>

    <img src="${data.imageUrl}" style="width:100%; max-height:82vh; object-fit:contain;">

    <div style="position:absolute; bottom:20px; left:16px; right:16px; display:flex; align-items:center; gap:12px;">
      <input type="text" placeholder="Send reply..." style="flex:1; height:42px; background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.3); border-radius:24px; padding:0 16px; color:#fff; outline:none; font-size:13px;">
      <button onclick="window.toggleStoryLike('${storyId}', ${isLiked})" style="background:none; border:none; color:${isLiked ? '#ff2d55' : '#fff'}; cursor:pointer;">
        <i data-lucide="heart" style="${isLiked ? 'fill:#ff2d55;' : ''}"></i>
      </button>
    </div>
  `;

  viewer.style.display = "flex";
  if (window.lucide) window.lucide.createIcons();

  const pBar = document.getElementById("story-progress-bar");
  pBar.style.width = "0%";
  let progress = 0;
  if (window.storyTimerInterval) clearInterval(window.storyTimerInterval);

  window.storyTimerInterval = setInterval(() => {
    progress += 2;
    pBar.style.width = progress + "%";
    if (progress >= 100) window.closeStoryViewer();
  }, 100);
};

window.closeStoryViewer = function() {
  const viewer = document.getElementById("fullscreen-story-viewer");
  if (viewer) viewer.style.display = "none";
  if (window.storyTimerInterval) clearInterval(window.storyTimerInterval);
};

window.deleteStory = async function(storyId) {
  if (!confirm("Kya aap ye story delete karna chahte hain?")) return;
  try {
    await deleteDoc(doc(db, "stories", storyId));
    alert("Story delete ho gayi!");
    window.closeStoryViewer();
  } catch (err) {
    alert("Delete fail: " + err.message);
  }
};

window.toggleStoryLike = async function(storyId, isLiked) {
  const user = auth.currentUser;
  if (!user) return alert("Pehle login karein!");
  try {
    const sRef = doc(db, "stories", storyId);
    await updateDoc(sRef, {
      likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
    });
    window.closeStoryViewer();
  } catch (err) {
    console.error("Story Like Error: ", err);
  }
};

// =========================================================================
// 11. BLOCK USER & 15-DAY ACCOUNT DELETION CENTER
// =========================================================================
window.blockUser = async function(targetUserId, targetUsername) {
  const user = auth.currentUser;
  if (!user) return alert("Pehle login karein!");
  if (user.uid === targetUserId) return alert("Aap khud ko block nahi kar sakte!");

  if (!confirm(`Kya aap ${targetUsername} ko block karna chahte hain?`)) return;

  try {
    await updateDoc(doc(db, "users", user.uid), {
      blockedUsers: arrayUnion(targetUserId)
    });
    alert(`${targetUsername} ko block kar diya gaya hai.`);
    const viewModal = document.getElementById("screen-user-profile");
    if (viewModal) viewModal.style.display = "none";
    window.showScreen("screen-home");
  } catch (err) {
    alert("Block error: " + err.message);
  }
};

window.openAccountDeletionModal = function() {
  let modal = document.getElementById("modal-account-deletion");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "modal-account-deletion";
    modal.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:999999; display:flex; align-items:center; justify-content:center; padding:16px;";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background:#181818; width:100%; max-width:420px; border-radius:18px; border:1px solid #282828; padding:22px;">
      <h3 style="margin-top:0; color:#fff; font-size:18px; font-weight:700;">Account Management</h3>
      <p style="color:#8e8e8e; font-size:13px; line-height:1.4;">Chuniye ki aap apne Korra account ke saath kya karna chahte hain:</p>

      <div onclick="window.processTemporaryDeactivate()" style="background:#222; border:1px solid #333; border-radius:12px; padding:14px; margin-bottom:12px; cursor:pointer;">
        <div style="color:#fff; font-weight:600; font-size:14px; display:flex; align-items:center; gap:8px;">
          <i data-lucide="power"></i> Temporary Deactivate
        </div>
        <p style="color:#777; font-size:12px; margin:4px 0 0;">Aapka account tab tak hide rahega jab tak aap wapas login nahi karte.</p>
      </div>

      <div onclick="window.processPermanentDelete()" style="background:#222; border:1px solid #333; border-radius:12px; padding:14px; margin-bottom:18px; cursor:pointer;">
        <div style="color:#ff3b30; font-weight:600; font-size:14px; display:flex; align-items:center; gap:8px;">
          <i data-lucide="trash-2"></i> Permanent Delete (15-Day Grace)
        </div>
        <p style="color:#777; font-size:12px; margin:4px 0 0;">Aapki complaint record hogi aur account 15 din baad poora delete ho jayega.</p>
      </div>

      <button onclick="document.getElementById('modal-account-deletion').style.display='none'" class="btn-profile-sub" style="width:100%; height:42px; background:#2c2c2c; color:#fff;">Cancel</button>
    </div>
  `;
  modal.style.display = "flex";
  if (window.lucide) window.lucide.createIcons();
};

window.processTemporaryDeactivate = async function() {
  const pass = prompt("Confirm karne ke liye password dalein:");
  if (!pass) return;
  const user = auth.currentUser;
  if (!user) return;

  try {
    await updateDoc(doc(db, "users", user.uid), { isDeactivated: true, deactivatedAt: serverTimestamp() });
    alert("Account temporarily deactivate ho chuka hai. Agle login par live ho jayega.");
    handleLogout();
  } catch (err) {
    alert("Deactivation fail: " + err.message);
  }
};

window.processPermanentDelete = async function() {
  const reason = prompt("Account delete karne ka reason batayein (Feedback / Complaint):");
  if (!reason) return;
  const user = auth.currentUser;
  if (!user) return;

  try {
    await addDoc(collection(db, "deletion_complaints"), {
      userId: user.uid,
      userEmail: user.email || "user",
      reason: reason,
      scheduledDeleteDate: Date.now() + (15 * 86400000),
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, "users", user.uid), {
      isScheduledForDeletion: true,
      deletionDate: Date.now() + (15 * 86400000)
    });

    alert("Complaint save ho gayi hai aur account 15 din ke liye hide ho gaya hai. 15 din ke andar login karke aap request cancel kar sakte hain.");
    handleLogout();
  } catch (err) {
    alert("Action failed: " + err.message);
  }
};

window.openAIDubbingModal = function() {
  const selectedLang = prompt(
    "Choose AI Video Voice Dubbing Language:\n" +
    "1. Hindi\n" +
    "2. English\n" +
    "3. Spanish\n" +
    "4. French\n" +
    "5. Japanese\n" +
    "6. Original Audio (Off)\n\n" +
    "Enter number (1-6):"
  );

  const langMap = {
    "1": "hi-IN",
    "2": "en-US",
    "3": "es-ES",
    "4": "fr-FR",
    "5": "ja-JP",
    "6": "original"
  };

  if (langMap[selectedLang]) {
    window.currentDubbingLanguage = langMap[selectedLang];
    localStorage.setItem("korra_dub_lang", window.currentDubbingLanguage);
    alert(`AI Dubbing set to: ${langMap[selectedLang] === "original" ? "Original Audio" : "Voice Dubbed (" + langMap[selectedLang] + ")"}`);
  }
};

// =========================================================================
// 12. GLOBAL FEED POST UPLOADER & MASTER DOM INITIALIZER
// =========================================================================
export function initUploadHandler() {
  const fileInput = document.getElementById("global-file-input");
  if (!fileInput) return;
  
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    const user = auth.currentUser;
    if (!user) return alert("Pehle login karein!");
    if (!file) return;

    const caption = prompt("Post caption likhein:") || "";
    alert("Post compress aur upload ho rahi hai...");

    try {
      const compressedBase64 = await compressImage(file);
      const userAvatar = getCurrentUserAvatar();

      await addDoc(collection(db, "posts"), {
        imageUrl: compressedBase64,
        caption: caption,
        userId: user.uid,
        userAvatar: userAvatar,
        username: user.email ? user.email.split("@")[0] : "koraa_user",
        likes: [],
        createdAt: serverTimestamp()
      });

      alert("Post successfully upload ho gayi!");
      window.showScreen("screen-home");
      fileInput.value = "";
    } catch (err) {
      alert("Upload error: " + err.message);
    }
  });
}

// Master DOM Initialization Hook
window.addEventListener("DOMContentLoaded", () => {
  initAuth();
  listenToFeed();
  listenToStories();
  listenToMessages();
  initUploadHandler();

  setupPasswordEyeToggles();

  const changePicBtn = document.querySelector("#screen-edit-profile div[style*='color:#0095f6'], .change-photo-btn");
  if (changePicBtn) {
    changePicBtn.style.cursor = "pointer";
    changePicBtn.addEventListener("click", window.triggerProfilePicChange);
  }

  const editProfileImg = document.querySelector("#screen-edit-profile img");
  if (editProfileImg) {
    editProfileImg.style.cursor = "pointer";
    editProfileImg.addEventListener("click", window.triggerProfilePicChange);
  }

  const saveCheckmarkBtn = document.querySelector("#screen-edit-profile .top-nav button:last-child, #screen-edit-profile i[data-lucide='check']");
  if (saveCheckmarkBtn) {
    const targetAction = saveCheckmarkBtn.closest("button") || saveCheckmarkBtn;
    targetAction.style.cursor = "pointer";
    targetAction.addEventListener("click", window.saveProfileEdits);
  }

  const settingsList = document.querySelector("#screen-settings > div:last-child");
  if (settingsList && !document.getElementById("btn-delete-acc-entry")) {
    const delNode = document.createElement("div");
    delNode.id = "btn-delete-acc-entry";
    delNode.className = "settings-item";
    delNode.innerHTML = `<div class="settings-item-left" style="color:#ff3b30;"><i data-lucide="user-x"></i> Delete or Deactivate Account</div><i data-lucide="chevron-right"></i>`;
    delNode.onclick = window.openAccountDeletionModal;
    settingsList.insertBefore(delNode, document.getElementById("btn-logout-action"));
  }

  const reelsViewport = document.querySelector("#screen-reels .reels-viewport");
  if (reelsViewport && !document.getElementById("btn-ai-dubbing")) {
    const aiDubBtn = document.createElement("button");
    aiDubBtn.id = "btn-ai-dubbing";
    aiDubBtn.style.cssText = "position:absolute; top:20px; right:16px; background:rgba(0,0,0,0.6); border:1px solid #0095f6; color:#fff; padding:6px 12px; border-radius:20px; font-size:12px; display:flex; align-items:center; gap:6px; cursor:pointer; z-index:20;";
    aiDubBtn.innerHTML = `🌐 <b>AI Dubbing</b>`;
    aiDubBtn.onclick = window.openAIDubbingModal;
    reelsViewport.appendChild(aiDubBtn);
  }

  const loginBtn = document.getElementById("btn-login-action");
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      const email = document.getElementById("login-email").value;
      const pass = document.getElementById("login-pass").value;
      handleLogin(email, pass);
    });
  }

  const signupBtn = document.getElementById("btn-signup-action");
  if (signupBtn) {
    signupBtn.addEventListener("click", () => {
      const email = document.getElementById("signup-email").value;
      const pass = document.getElementById("signup-pass").value;
      handleSignup(email, pass);
    });
  }

  const logoutBtn = document.getElementById("btn-logout-action");
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

  if (window.lucide) window.lucide.createIcons();
});

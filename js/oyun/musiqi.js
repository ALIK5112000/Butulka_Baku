import * as fbModule from "./core/firebase.js";

const CLIP_COST = 9;

// API açarsız canlı YouTube axtarış mənbələri
const YT_SEARCH_ENDPOINTS = [
  "https://pipedapi.kavin.rocks/search?filter=music_songs&q=",
  "https://pipedapi.adminforge.de/search?filter=music_songs&q=",
  "https://inv.nadeko.net/api/v1/search?type=video&q="
];

const POPULAR_CLIPS = [
  { videoId: "M7lc1UVf-VE", title: "OMER DEEP - Medusa (Original Mix)", thumb: "https://i.ytimg.com/vi/M7lc1UVf-VE/mqdefault.jpg" },
  { videoId: "kJQP7kiw5Fk", title: "Luis Fonsi - Despacito", thumb: "https://i.ytimg.com/vi/kJQP7kiw5Fk/mqdefault.jpg" },
  { videoId: "JGwWNGJdvx8", title: "Ed Sheeran - Shape of You", thumb: "https://i.ytimg.com/vi/JGwWNGJdvx8/mqdefault.jpg" },
  { videoId: "RgKAFK5djSk", title: "Wiz Khalifa - See You Again", thumb: "https://i.ytimg.com/vi/RgKAFK5djSk/mqdefault.jpg" },
  { videoId: "60ItHLz5WEA", title: "Alan Walker - Faded", thumb: "https://i.ytimg.com/vi/60ItHLz5WEA/mqdefault.jpg" },
  { videoId: "fRh_vgS2dFE", title: "Justin Bieber - Sorry", thumb: "https://i.ytimg.com/vi/fRh_vgS2dFE/mqdefault.jpg" }
];

let ytLivePlayer = null;
let ytReady = false;
let progressInterval = null;
let zoomLevel = 0; // 0: orijinal, 1: 1x, 2: 2x
let currentPlayingId = null;

function getTableId() {
  const spanNo = document.getElementById("masaNo")?.textContent?.trim();
  const urlNo = new URLSearchParams(window.location.search).get("table");
  return String(urlNo || spanNo || "511");
}

// 1. YouTube IFrame API yüklə
function initYouTubeAPI() {
  if (!window.YT) {
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  }
  const prevReady = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function () {
    if (typeof prevReady === "function") prevReady();
    ytLivePlayer = new YT.Player("bb-live-yt-frame", {
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        modestbranding: 1,
        playsinline: 1,
        rel: 0
      },
      events: {
        onReady: () => { ytReady = true; },
        onStateChange: (e) => {
          // Mahnı bitəndə (0 = ENDED) avtomatik gizlət
          if (e.data === 0) stopAndHideClip(true);
        }
      }
    });
  };
}

// 2. #musiqiBtn1 düyməsinə basanda pəncərəni aç
const btn1 = document.getElementById("musiqiBtn1");
if (btn1) {
  btn1.addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("bb-clip-modal").style.display = "flex";
    switchTab("popular");
  });
}

document.getElementById("bb-clip-close")?.addEventListener("click", () => {
  document.getElementById("bb-clip-modal").style.display = "none";
});

document.querySelectorAll(".bb-tab-btn").forEach((b) => {
  b.addEventListener("click", () => switchTab(b.dataset.tab));
});

function switchTab(tab) {
  document.querySelectorAll(".bb-tab-btn").forEach((b) => {
    b.style.opacity = b.dataset.tab === tab ? "1" : "0.45";
  });
  const titleEl = document.getElementById("bb-tab-title");
  const searchBox = document.getElementById("bb-search-box");

  if (tab === "search") {
    titleEl.textContent = "Musiqi axtar (9 bonus)";
    searchBox.style.display = "block";
    const inp = document.getElementById("bb-yt-query");
    setTimeout(() => inp.focus(), 80);
    if (inp.value.trim()) searchYouTubeFree(inp.value.trim());
    else renderGrid([]);
  } else if (tab === "favorites") {
    titleEl.textContent = "Sevimli musiqilər";
    searchBox.style.display = "none";
    renderGrid(JSON.parse(localStorage.getItem("bb_fav_clips") || "[]"));
  } else if (tab === "history") {
    titleEl.textContent = "Son qoşulan kliplər";
    searchBox.style.display = "none";
    renderGrid(JSON.parse(localStorage.getItem("bb_hist_clips") || "[]"));
  } else {
    titleEl.textContent = "Populyar bölməsindən musiqi seç (9 bonus)";
    searchBox.style.display = "none";
    renderGrid(POPULAR_CLIPS);
  }
}

// 3. YouTube-da mahnı adı ilə canlı axtarış
async function searchYouTubeFree(query) {
  const grid = document.getElementById("bb-clip-grid");
  grid.style.display = "block";
  grid.innerHTML = `<div style="text-align:center; color:#888; padding:26px 0; font-size:14px;">Axtarılır...</div>`;

  for (const base of YT_SEARCH_ENDPOINTS) {
    try {
      const res = await fetch(base + encodeURIComponent(query));
      if (!res.ok) continue;
      const data = await res.json();

      if (Array.isArray(data.items)) {
        const parsed = data.items
          .filter(it => it.url && it.url.includes("v="))
          .slice(0, 14)
          .map(it => {
            const vid = it.url.split("v=")[1].split("&")[0];
            return {
              videoId: vid,
              title: it.title || "YouTube Musiqi",
              thumb: it.thumbnail || `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`
            };
          });
        if (parsed.length) {
          renderGrid(parsed);
          return;
        }
      }

      if (Array.isArray(data)) {
        const parsed = data
          .filter(it => it.videoId)
          .slice(0, 14)
          .map(it => ({
            videoId: it.videoId,
            title: it.title || "YouTube Musiqi",
            thumb: `https://i.ytimg.com/vi/${it.videoId}/mqdefault.jpg`
          }));
        if (parsed.length) {
          renderGrid(parsed);
          return;
        }
      }
    } catch (_) {}
  }

  const fallback = POPULAR_CLIPS.filter(c => c.title.toLowerCase().includes(query.toLowerCase()));
  renderGrid(fallback);
}

let searchTimer = null;
document.getElementById("bb-yt-query")?.addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  searchTimer = setTimeout(() => {
    if (!q) renderGrid([]);
    else searchYouTubeFree(q);
  }, 400);
});

function toggleFavorite(clip, starBtn) {
  let favs = JSON.parse(localStorage.getItem("bb_fav_clips") || "[]");
  const exists = favs.some(x => x.videoId === clip.videoId);
  if (exists) {
    favs = favs.filter(x => x.videoId !== clip.videoId);
    starBtn.textContent = "☆";
  } else {
    favs.unshift(clip);
    starBtn.textContent = "⭐";
  }
  localStorage.setItem("bb_fav_clips", JSON.stringify(favs.slice(0, 30)));
}

function renderGrid(items) {
  const grid = document.getElementById("bb-clip-grid");
  grid.innerHTML = "";
  if (!items.length) {
    grid.style.display = "block";
    grid.innerHTML = `<div style="text-align:center; color:#777; padding:28px 0; font-size:14px;">Hər hansı musiqi tapılmadı</div>`;
    return;
  }
  const favs = JSON.parse(localStorage.getItem("bb_fav_clips") || "[]");
  grid.style.display = "grid";

  items.forEach((clip) => {
    const isFav = favs.some(x => x.videoId === clip.videoId);
    const card = document.createElement("div");
    card.style.cssText = "border-radius:10px; overflow:hidden; background:#fafafa; border:1px solid #eee; cursor:pointer; position:relative;";
    card.innerHTML = `
      <div style="position:relative;">
        <img src="${clip.thumb}" style="width:100%; height:78px; object-fit:cover; display:block;" />
        <span class="bb-fav-star" style="position:absolute; top:4px; right:5px; font-size:16px; color:#fff; text-shadow:0 1px 4px #000;">${isFav ? "⭐" : "☆"}</span>
        <span style="position:absolute; bottom:4px; right:4px; background:rgba(0,0,0,0.75); color:#fff; font-size:10px; padding:1px 5px; border-radius:4px;">9 🔶</span>
      </div>
      <div style="padding:6px; font-size:11px; font-weight:600; color:#222; line-height:1.25; height:32px; overflow:hidden;">${clip.title}</div>
    `;

    card.querySelector(".bb-fav-star").addEventListener("click", (ev) => {
      ev.stopPropagation();
      toggleFavorite(clip, ev.currentTarget);
    });

    card.addEventListener("click", () => startClipWithBonus(clip));
    grid.appendChild(card);
  });
}

// 4. 9 Bonus çıx (#urekSayi + Firebase) və bütün masada real-vaxt başlat
async function startClipWithBonus(clip) {
  const urekEl = document.getElementById("urekSayi");
  const currentHearts = parseInt(urekEl?.textContent || "0", 10);

  if (currentHearts < CLIP_COST) {
    alert("Klip qoşmaq üçün minimum 9 bonus lazımdır!");
    return;
  }

  // Ekranda bonus sayını dərhal 9 azalt
  if (urekEl) urekEl.textContent = String(currentHearts - CLIP_COST);

  // Tarixçəyə əlavə et
  const hist = JSON.parse(localStorage.getItem("bb_hist_clips") || "[]");
  localStorage.setItem("bb_hist_clips", JSON.stringify([clip, ...hist.filter(x => x.videoId !== clip.videoId)].slice(0, 20)));
  document.getElementById("bb-clip-modal").style.display = "none";

  const uid = localStorage.getItem("userId") || localStorage.getItem("uid") || fbModule?.auth?.currentUser?.uid || "guest";
  const myAvatar =
    document.querySelector("#masa .oyuncu[data-uid='" + uid + "'] img")?.src ||
    localStorage.getItem("userAvatar") ||
    localStorage.getItem("avatar") ||
    "images/default-avatar.png";

  const payload = {
    clipInstanceId: Date.now() + "_" + uid,
    videoId: clip.videoId,
    title: clip.title,
    djUid: uid,
    djAvatar: myAvatar,
    startedAt: Date.now()
  };

  // Modular Firebase (v9/v10) və ya Compat Firebase dəstəyi
  try {
    const db = fbModule.db || fbModule.firestore || window.db;
    if (db) {
      if (typeof db.collection === "function") {
        if (uid !== "guest") {
          const uDoc = await db.collection("users").doc(uid).get();
          if (uDoc.exists) {
            const d = uDoc.data();
            const field = d.bonus !== undefined ? "bonus" : (d.hearts !== undefined ? "hearts" : "balance");
            await db.collection("users").doc(uid).update({ [field]: Math.max(0, Number(d[field] || 0) - CLIP_COST) });
          }
        }
        await db.collection("tables").doc(getTableId()).set({ activeClip: payload }, { merge: true });
        return;
      } else {
        // Firebase Modular SDK (v9+)
        const { doc, getDoc, updateDoc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        if (uid !== "guest") {
          const uRef = doc(db, "users", uid);
          const uSnap = await getDoc(uRef);
          if (uSnap.exists()) {
            const d = uSnap.data();
            const field = d.bonus !== undefined ? "bonus" : (d.hearts !== undefined ? "hearts" : "balance");
            await updateDoc(uRef, { [field]: Math.max(0, Number(d[field] || 0) - CLIP_COST) });
          }
        }
        await setDoc(doc(db, "tables", getTableId()), { activeClip: payload }, { merge: true });
        return;
      }
    }
  } catch (err) {
    console.warn("Firebase klip sinxron xətası:", err);
  }

  // Ehtiyat lokal başlatma
  playClipOnWidget(payload);
}

// 5. Masadakı bütün oyunçular üçün real-vaxt dinləmə
async function attachTableListener() {
  const db = fbModule.db || fbModule.firestore || window.db;
  if (!db) {
    setTimeout(attachTableListener, 600);
    return;
  }

  const handleClipSnap = (data) => {
    const activeClip = data?.activeClip;
    if (!activeClip || !activeClip.videoId) {
      stopAndHideClip(false);
      return;
    }
    if (currentPlayingId === activeClip.clipInstanceId) return;
    currentPlayingId = activeClip.clipInstanceId;
    playClipOnWidget(activeClip);
  };

  if (typeof db.collection === "function") {
    db.collection("tables").doc(getTableId()).onSnapshot((snap) => {
      if (snap.exists) handleClipSnap(snap.data());
    });
  } else {
    const { doc, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    onSnapshot(doc(db, "tables", getTableId()), (snap) => {
      if (snap.exists()) handleClipSnap(snap.data());
    });
  }
}

function playClipOnWidget(data) {
  const widget = document.getElementById("bb-live-clip-widget");
  document.getElementById("bb-dj-avatar").src = data.djAvatar || "images/default-avatar.png";
  widget.style.display = "block";

  const elapsedSec = Math.max(0, Math.floor((Date.now() - Number(data.startedAt || Date.now())) / 1000));

  const run = () => {
    ytLivePlayer.loadVideoById({ videoId: data.videoId, startSeconds: elapsedSec });
    const vol = Number(document.getElementById("bb-volume-slider").value || 85);
    ytLivePlayer.unMute();
    ytLivePlayer.setVolume(vol);
    ytLivePlayer.playVideo();
    startCircularRing();
  };

  if (ytReady && ytLivePlayer && typeof ytLivePlayer.loadVideoById === "function") {
    run();
  } else {
    const wait = setInterval(() => {
      if (ytReady && ytLivePlayer && typeof ytLivePlayer.loadVideoById === "function") {
        clearInterval(wait);
        run();
      }
    }, 200);
  }
}

// Profil şəklinin kənarındakı yaşıl dairəvi müddət halqası
function startCircularRing() {
  clearInterval(progressInterval);
  const circle = document.getElementById("bb-ring-progress");
  const circumference = 2 * Math.PI * 33;

  progressInterval = setInterval(() => {
    if (!ytLivePlayer || typeof ytLivePlayer.getCurrentTime !== "function") return;
    const cur = ytLivePlayer.getCurrentTime() || 0;
    const dur = ytLivePlayer.getDuration() || 0;

    if (dur > 0) {
      const ratio = Math.min(1, cur / dur);
      circle.style.strokeDashoffset = String(circumference * (1 - ratio));
      if (cur >= dur - 0.5) {
        stopAndHideClip(true);
      }
    }
  }, 250);
}

async function stopAndHideClip(clearDb) {
  clearInterval(progressInterval);
  currentPlayingId = null;
  if (ytLivePlayer && typeof ytLivePlayer.stopVideo === "function") {
    ytLivePlayer.stopVideo();
  }
  const w = document.getElementById("bb-live-clip-widget");
  if (w) w.style.display = "none";

  if (clearDb) {
    try {
      const db = fbModule.db || fbModule.firestore || window.db;
      if (db) {
        if (typeof db.collection === "function") {
          await db.collection("tables").doc(getTableId()).set({ activeClip: null }, { merge: true });
        } else {
          const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
          await setDoc(doc(db, "tables", getTableId()), { activeClip: null }, { merge: true });
        }
      }
    } catch (_) {}
  }
}

// 6. Kvadrat düymə: 1-ci klik -> 1x, 2-ci klik -> 2x, 3-cü klik -> orijinal
document.getElementById("bb-zoom-clip-btn")?.addEventListener("click", () => {
  zoomLevel = (zoomLevel + 1) % 3;
  const widget = document.getElementById("bb-live-clip-widget");
  const topBox = document.getElementById("bb-live-top");

  if (zoomLevel === 0) {
    widget.style.width = "265px";
    topBox.style.height = "96px";
  } else if (zoomLevel === 1) {
    widget.style.width = "315px";
    topBox.style.height = "135px";
  } else {
    widget.style.width = "94vw";
    topBox.style.height = "185px";
  }
});

// 7. Səs slideri və bağlama (mute)
const volSlider = document.getElementById("bb-volume-slider");
const muteBtn = document.getElementById("bb-mute-clip-btn");

volSlider?.addEventListener("input", () => {
  const v = Number(volSlider.value);
  if (!ytLivePlayer) return;
  if (v === 0) {
    ytLivePlayer.mute();
    muteBtn.textContent = "🔇";
  } else {
    ytLivePlayer.unMute();
    ytLivePlayer.setVolume(v);
    muteBtn.textContent = "🔊";
  }
});

muteBtn?.addEventListener("click", () => {
  if (!ytLivePlayer) return;
  if (ytLivePlayer.isMuted()) {
    ytLivePlayer.unMute();
    const v = Number(volSlider.value) || 80;
    volSlider.value = v;
    ytLivePlayer.setVolume(v);
    muteBtn.textContent = "🔊";
  } else {
    ytLivePlayer.mute();
    muteBtn.textContent = "🔇";
  }
});

initYouTubeAPI();
attachTableListener();

const DB_NAME = "yaflix-library";
const DB_VERSION = 1;
const STORE = "videos";
const THUMBS = "thumbs";
const META_KEY = "yaflix-library";

const els = {
  form: document.getElementById("addForm"),
  title: document.getElementById("titleInput"),
  tag: document.getElementById("tagInput"),
  notes: document.getElementById("notesInput"),
  url: document.getElementById("urlInput"),
  thumb: document.getElementById("thumbInput"),
  file: document.getElementById("fileInput"),
  fileName: document.getElementById("fileName"),
  linkFields: document.getElementById("linkFields"),
  fileFields: document.getElementById("fileFields"),
  drop: document.getElementById("dropZone"),
  cards: document.getElementById("cards"),
  empty: document.getElementById("emptyState"),
  search: document.getElementById("searchInput"),
  filter: document.getElementById("filterSelect"),
  sort: document.getElementById("sortSelect"),
  storage: document.getElementById("storageInfo"),
  storageDetail: document.getElementById("storageDetail"),
  dialog: document.getElementById("playerDialog"),
  player: document.getElementById("player"),
  playerTitle: document.getElementById("playerTitle"),
  playerHint: document.getElementById("playerHint"),
  closePlayer: document.getElementById("closePlayer"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  saveBtn: document.getElementById("saveBtn"),
  saveStatus: document.getElementById("saveStatus"),
  embed: document.getElementById("embedPlayer"),
  menuBtn: document.getElementById("menuBtn"),
  siteNav: document.getElementById("siteNav"),
  toast: document.getElementById("toast"),
};

let mode = "link";
let pendingFile = null;
let library = loadMeta();
function seedSamples() {
  const movies = ["Starlight Park", "River Rescue", "The Paper Plane", "Moon Market", "Captain Compass", "The Hidden Garden", "Cloud Racers", "Library Quest", "Sunny Harbor", "The Last Kite"];
  const anime = ["Sky Club", "Noodle Heroes", "Robot Picnic", "Fox School", "Island Racers", "Tiny Dragons", "City Sparks", "Paint Ninjas", "Train Spirits", "Pocket Giants"];
  const series = ["Camp Cabin", "Team Telescope", "Bakery Street", "Scout Squad", "Harbor Friends", "Code Club", "Forest Post", "Music Room", "Rocket Recess", "Garden Detectives"];
  const have = new Set(library.map((item) => item.id));
  function posterPath(shelf, number) {
  const folder = shelf === "Series" ? "shows" : shelf.toLowerCase();
  return "posters/" + folder + "/" + folder + "-" + number + ".png";
}
function posterFallbacks(src) {
  const match = src.match(/(\d+)\.png$/);
  const n = match ? match[1] : "";
  const list = [src];
  if (n) {
    list.push("posters/anime/anime-" + n + ".png");
    list.push("posters/anime-" + n + ".png");
    list.push("anime-" + n + ".png");
    list.push("posters/movies/movies-" + n + ".png");
    list.push("posters/shows/shows-" + n + ".png");
  }
  return list;
}
function addSet(names, shelf) {
  names.forEach((title, index) => {
      const id = "sample-" + shelf.toLowerCase() + "-" + (index + 1);
      if (have.has(id)) {
        const existing = library.find((item) => item.id === id);
        if (existing) {
          if (shelf !== "Anime") existing.title = title;
          existing.shelf = shelf;
          existing.tag = shelf;
          existing.thumbUrl = posterPath(shelf, index + 1);
        }
        return;
      }
      library.push({
        id,
        title,
        tag: shelf,
        shelf,
        show: "",
        season: 0,
        episode: 0,
        actors: "Sample cast",
        minutes: 22,
        notes: "A sample " + shelf.toLowerCase() + " card. Add your own video to play it.",
        type: "link",
        url: "",
        thumbUrl: posterPath(shelf, index + 1),
        poster: "",
        fileName: "",
        size: 0,
        rating: 2,
        favorite: false,
        createdAt: new Date(Date.now() - index * 1000).toISOString(),
      });
    });
  }
  addSet(anime, "Anime");
  try { saveMeta(); } catch { /* samples still show this visit */ }
}
seedSamples();
const removedMovies = ["Starlight Park", "River Rescue", "The Paper Plane", "Moon Market", "Captain Compass", "The Hidden Garden", "Cloud Racers", "Library Quest", "Sunny Harbor", "The Last Kite"];
const removedShows = ["Camp Cabin", "Team Telescope", "Bakery Street", "Scout Squad", "Harbor Friends", "Code Club", "Forest Post", "Music Room", "Rocket Recess", "Garden Detectives"];
library = library.filter((item) => {
  const title = item.title || "";
  const id = String(item.id || "");
  if (id.startsWith("sample-movies-") || id.startsWith("sample-series-")) return false;
  if (removedMovies.includes(title) || removedShows.includes(title)) return false;
  if (item.shelf === "Movies" || item.shelf === "Series") return false;
  return true;
});
try { saveMeta(); } catch { /* cards still hidden this visit */ }
function applyFile(rows, shelf) {
  const ids = new Set();
  rows.forEach((row, index) => {
    const id = row.id || shelf.toLowerCase() + "-file-" + (index + 1);
    ids.add(id);
    let item = library.find((entry) => entry.id === id);
    if (!item) {
      item = {
        id,
        type: "link",
        url: "",
        fileName: "",
        size: 0,
        favorite: false,
        rating: 2,
        actors: "",
        notes: "",
        createdAt: new Date().toISOString()
      };
      library.push(item);
    }
    item.title = row.title || item.title || shelf;
    item.shelf = row.shelf || shelf;
    item.tag = item.shelf;
    item.show = "";
    item.thumbUrl = row.pic || item.thumbUrl || "";
    if (row.vimeo) item.url = String(row.vimeo);
    const number = String(id).match(/(\d+)$/);
    if (shelf === "Anime" && number) {
      const n = Number(number[1]);
      const folders = [
        "01-jujutsu-kaisen",
        "02-one-piece",
        "03-spy-family",
        "04-the-seven-deadly-sins",
        "05-dragon-ball-super",
        "06-demon-slayer",
        "07-detective-conan-case-closed",
        "08-solo-leveling",
        "09-attack-on-titan",
        "10-frieren-beyond-journeys-end"
      ];
      const folder = folders[n - 1] || ("anime-" + n);
      item.url = "videos/anime/" + folder + "/video.mp4";
      if (n === 4) item.show = item.title;
    }
  });
  const prefix = "sample-" + shelf.toLowerCase() + "-";
  library = library.filter((item) => ids.has(item.id) || (item.shelf !== shelf && !String(item.id).startsWith(prefix)));
}
function applyCatalog(file, shelf) {
  return fetch(file)
    .then((res) => res.json())
    .then((rows) => {
      if (!Array.isArray(rows)) return;
      applyFile(rows, shelf);
    })
    .catch(() => {});
}
Promise.all([
  applyCatalog("anime.json", "Anime"),
  applyCatalog("movies.json", "Movies"),
  applyCatalog("shows.json", "Series")
]).then(() => {
  addAnimeSeasons();
  saveMeta();
  render();
});
function addAnimeSeasons() {
  const show = "The Seven Deadly Sins";
  const poster = "posters/anime/anime-4.png";
  for (let season = 1; season <= 5; season += 1) {
    for (let episode = 1; episode <= 24; episode += 1) {
      const id = "anime-04-s" + season + "e" + episode;
      let item = library.find((entry) => entry.id === id);
      if (!item) {
        item = { id, type: "link", fileName: "", size: 0, favorite: false, rating: 2, actors: "", createdAt: new Date().toISOString() };
        library.push(item);
      }
      item.title = "Episode " + episode;
      item.show = show;
      item.shelf = "Anime";
      item.tag = "Anime";
      item.season = season;
      item.episode = episode;
      item.notes = "Season " + season + ", episode " + episode;
      item.thumbUrl = poster;
      item.url = "videos/anime/04-the-seven-deadly-sins/season-" + season + "/episode-" + episode + ".mp4";
      if (season === 1 && episode === 1) item.url = "https://vimeo.com/1236263080";
      if (season === 1 && episode === 2) item.url = "https://vimeo.com/1236322072";
    }
  }
}

window.addEventListener("load", () => {
  const loader = document.getElementById("loader");
  setTimeout(() => {
    if (!loader) return;
    loader.classList.add("opacity-0", "pointer-events-none");
    openWho();
  }, 900);
});

const PROFILE_KEY = "yaflix-profiles";
let profiles = [];
let editingProfiles = false;
try { profiles = JSON.parse(localStorage.getItem(PROFILE_KEY) || "[]"); } catch { profiles = []; }
if (!Array.isArray(profiles)) profiles = [];

function saveProfiles() {
  const slim = profiles.map((p) => ({ id: p.id, name: p.name, color: p.color, pic: p.pic || "", rating: Number(p.rating) || 2, kids: Number(p.rating) <= 3 }));
  localStorage.setItem(PROFILE_KEY, JSON.stringify(slim));
}
function ratingList() {
  const list = Array.isArray(window.YAFLIX_RATINGS) ? window.YAFLIX_RATINGS : [];
  return list.length ? list : [{ level: 1, name: "TV-Y", kids: true }];
}
function ratingName(level) {
  const found = ratingList().find((item) => item.level === Number(level));
  return found ? found.name : ratingList()[0].name;
}
function paintRatings() {
  const list = ratingList();
  const labels = document.getElementById("ratingLabels");
  const slider = document.getElementById("ratingSlider");
  const select = document.getElementById("ratingInput");
  if (labels) {
    labels.style.gridTemplateColumns = "repeat(" + list.length + ", minmax(0, 1fr))";
    labels.innerHTML = list.map((item) => "<span>" + escapeHtml(item.name) + "</span>").join("");
  }
  if (slider) {
    slider.min = list[0].level;
    slider.max = list[list.length - 1].level;
  }
  if (select) {
    const current = select.value;
    select.innerHTML = list.map((item) => "<option value=\"" + item.level + "\">" + escapeHtml(item.name) + "</option>").join("");
    if (current) select.value = current;
  }
}
paintRatings();
function currentRating() {
  const id = localStorage.getItem("yaflix-watching");
  const profile = profiles.find((p) => p.id === id);
  return profile ? Number(profile.rating) || 4 : 5;
}
function setSideBar(show) {
  const bar = document.getElementById("sideBar");
  const main = document.getElementById("library");
  if (bar) {
    bar.classList.toggle("hidden", !show);
    bar.classList.toggle("flex", show);
  }
  if (main) {
    main.classList.toggle("ml-44", show);
    main.classList.toggle("w-[calc(100%-11rem)]", show);
    main.classList.toggle("ml-0", !show);
    main.classList.toggle("w-full", !show);
  }
}
function openWho() {
  const screen = document.getElementById("whoScreen");
  if (!screen) return;
  screen.classList.remove("hidden");
  screen.classList.add("flex");
  setSideBar(false);
  drawProfiles();
}
function closeWho() {
  const screen = document.getElementById("whoScreen");
  screen.classList.add("hidden");
  screen.classList.remove("flex");
  setSideBar(true);
}
let editingId = null;
function openProfileForm(profile) {
  editingId = profile ? profile.id : null;
  document.getElementById("profileForm").classList.remove("hidden");
  document.getElementById("profileStep1").classList.remove("hidden");
  document.getElementById("profileStep2").classList.add("hidden");
  document.getElementById("profileName").value = profile ? profile.name : "";
  const preview = document.getElementById("profilePreview");
  if (profile && profile.pic) {
    preview.src = profile.pic;
    preview.classList.remove("hidden");
  } else {
    preview.classList.add("hidden");
    preview.removeAttribute("src");
  }
  const rating = profile ? Number(profile.rating) || 2 : 2;
  document.getElementById("ratingSlider").value = rating;
  document.getElementById("profileRating").value = rating;
  document.getElementById("kidsNote").textContent = rating <= 3 ? "Kids profile" : "Not a kids profile";
  document.getElementById("profileRemove").classList.toggle("hidden", !profile);
}
function catalogPosters() {
  const seen = new Set();
  return library.filter((item) => {
    const key = item.show || item.id;
    const pic = item.thumbUrl || item.poster;
    if (!pic || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
let backdropTimer = null;
let backdropIndex = 0;
function startBackdropCycle() {
  if (backdropTimer) clearInterval(backdropTimer);
  const items = catalogPosters();
  if (!items.length) return;
  const show = () => {
    const item = items[backdropIndex % items.length];
    backdropIndex += 1;
    const pic = item.thumbUrl || item.poster;
    const backdrop = document.getElementById("whoBackdrop");
    if (backdrop) backdrop.src = pic;
    const hero = document.getElementById("heroImage");
    if (hero) hero.src = pic;
    fillHero(item);
  };
  show();
  backdropTimer = setInterval(show, 5000);
}
function drawProfiles() {
  const row = document.getElementById("profileRow");
  const backdrop = document.getElementById("whoBackdrop");
  row.innerHTML = "";
  if (backdrop && library[0]) backdrop.src = library[0].thumbUrl || library[0].poster || "";
  const selectedId = localStorage.getItem("yaflix-watching");
  profiles.forEach((p) => {
    const selected = p.id === selectedId || (!selectedId && p === profiles[0]);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "flex items-center gap-4 text-left text-white";
    const face = document.createElement("span");
    face.className = "grid h-16 w-16 place-items-center overflow-hidden rounded-md bg-slate-700 text-2xl" + (selected ? " ring-4 ring-white" : "");
    if (p.pic) {
      const img = document.createElement("img");
      img.className = "h-full w-full object-cover";
      img.alt = "";
      img.src = p.pic;
      face.appendChild(img);
    } else {
      face.textContent = (p.name || "?").slice(0, 1).toUpperCase();
      face.style.background = p.color || "#334155";
    }
    btn.appendChild(face);
    if (selected) {
      const name = document.createElement("span");
      name.className = "text-2xl";
      name.textContent = p.name;
      btn.appendChild(name);
    }
    btn.addEventListener("click", () => {
      if (editingProfiles) {
        openProfileForm(p);
        return;
      }
      localStorage.setItem("yaflix-watching", p.id);
      const corner = document.getElementById("cornerPic");
      if (p.pic) corner.src = p.pic;
      else corner.removeAttribute("src");
      document.getElementById("switchProfile").style.background = p.color || "#334155";
      closeWho();
      render();
    });
    row.appendChild(btn);
  });
  const add = document.createElement("button");
  add.type = "button";
  add.className = "grid h-16 w-16 place-items-center rounded-md border-2 border-white text-4xl";
  add.textContent = "+";
  add.addEventListener("click", () => openProfileForm(null));
  row.appendChild(add);
  document.getElementById("editProfiles").textContent = editingProfiles ? "DONE" : "EDIT PROFILES";
  startBackdropCycle();
}
document.getElementById("ratingSlider").addEventListener("input", (e) => {
  document.getElementById("profileRating").value = e.target.value;
  const kids = Number(e.target.value) <= 3;
  document.getElementById("ratingBlurb").textContent = "Only show titles rated " + ratingName(e.target.value) + " and below for this profile.";
  document.getElementById("kidsNote").textContent = kids ? "Kids profile" : "Not a kids profile";
});
document.getElementById("profileNext").addEventListener("click", () => {
  if (!document.getElementById("profileName").value.trim()) {
    document.getElementById("profileName").focus();
    return;
  }
  document.getElementById("profileStep1").classList.add("hidden");
  document.getElementById("profileStep2").classList.remove("hidden");
});
document.getElementById("editProfiles").addEventListener("click", () => {
  editingProfiles = !editingProfiles;
  drawProfiles();
});
document.getElementById("profilePic").addEventListener("change", () => {
  const file = document.getElementById("profilePic").files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 160;
      const ctx = canvas.getContext("2d");
      const size = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 160, 160);
      const preview = document.getElementById("profilePreview");
      preview.src = canvas.toDataURL("image/jpeg", 0.7);
      preview.classList.remove("hidden");
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});
document.getElementById("profileForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("profileName").value.trim();
  if (!name) return;
  const preview = document.getElementById("profilePreview");
  const pic = preview.src && preview.src.startsWith("data:") ? preview.src : "";
  const rating = Number(document.getElementById("profileRating").value) || 2;
  if (editingId) {
    const profile = profiles.find((item) => item.id === editingId);
    if (profile) {
      profile.name = name.slice(0, 16);
      profile.rating = rating;
      profile.kids = rating <= 3;
      if (pic) profile.pic = pic;
    }
  } else {
    profiles.push({
      id: uid(),
      name: name.slice(0, 16),
      color: "hsl(" + (profiles.length * 50) + " 45% 35%)",
      pic,
      rating,
      kids: rating <= 3,
    });
  }
  editingId = null;
  saveProfiles();
  e.target.reset();
  preview.classList.add("hidden");
  preview.removeAttribute("src");
  document.getElementById("profileStep1").classList.remove("hidden");
  document.getElementById("profileStep2").classList.add("hidden");
  e.target.classList.add("hidden");
  drawProfiles();
});
document.getElementById("profileRemove").addEventListener("click", () => {
  if (!editingId) return;
  profiles = profiles.filter((item) => item.id !== editingId);
  editingId = null;
  saveProfiles();
  document.getElementById("profileForm").classList.add("hidden");
  drawProfiles();
});

els.menuBtn.addEventListener("click", () => {
  const open = els.siteNav.classList.toggle("max-md:flex");
  els.siteNav.classList.toggle("max-md:absolute");
  els.siteNav.classList.toggle("max-md:left-3");
  els.siteNav.classList.toggle("max-md:right-3");
  els.siteNav.classList.toggle("max-md:top-16");
  els.siteNav.classList.toggle("max-md:z-30");
  els.menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
});
function closeMobileNav() {
  els.siteNav.classList.remove("max-md:flex", "max-md:absolute", "max-md:left-3", "max-md:right-3", "max-md:top-16", "max-md:z-30");
  els.menuBtn.setAttribute("aria-expanded", "false");
}
els.siteNav.addEventListener("click", (e) => {
  if (e.target.closest("button")) closeMobileNav();
});

function loadMeta() {
  try {
    const data = JSON.parse(localStorage.getItem(META_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveMeta() {
  const slim = library.map((item) => {
    const copy = Object.assign({}, item);
    if (String(copy.poster || "").startsWith("data:")) delete copy.poster;
    if (String(copy.thumbUrl || "").startsWith("data:")) delete copy.thumbUrl;
    return copy;
  });
  localStorage.setItem(META_KEY, JSON.stringify(slim));
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(THUMBS)) db.createObjectStore(THUMBS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putFile(id, file) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getFile(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function deleteStored(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE, THUMBS], "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.objectStore(THUMBS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function putThumb(id, dataUrl) {
  if (!dataUrl) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(THUMBS, "readwrite");
    tx.objectStore(THUMBS).put(dataUrl, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getThumb(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(THUMBS, "readonly");
    const req = tx.objectStore(THUMBS).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function cleanUrl(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(text)) return text;
  return "https://" + text;
}

function vimeoId(url) {
  const match = String(url || "").match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return match ? match[1] : "";
}
function playVimeo(id) {
  els.player.hidden = true;
  els.embed.hidden = false;
  els.embed.src = "https://player.vimeo.com/video/" + encodeURIComponent(id) + "?autoplay=1";
  els.playerHint.textContent = "Playing on Vimeo";
  els.dialog.showModal();
}
function youtubeId(url) {
  try {
    const u = new URL(cleanUrl(url));
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0];
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const parts = u.pathname.split("/").filter(Boolean);
      if (["shorts", "embed", "live", "v"].includes(parts[0])) return parts[1] || "";
    }
  } catch {
    return "";
  }
  return "";
}

function thumbnailFromLink(url, extraThumb) {
  if (extraThumb) return extraThumb;
  const id = youtubeId(url);
  if (id) return "https://img.youtube.com/vi/" + encodeURIComponent(id) + "/hqdefault.jpg";
  return "";
}

function posterDataUrl(title) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    let hash = 0;
    const safe = String(title || "Video");
    for (const ch of safe) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const hue = hash % 360;
    const g = ctx.createLinearGradient(0, 0, 320, 480);
    g.addColorStop(0, "hsl(" + hue + " 70% 28%)");
    g.addColorStop(1, "#07070c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 320, 480);
    ctx.fillStyle = "#ff1a1a";
    ctx.fillRect(0, 0, 320, 8);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 28px Trebuchet MS, Segoe UI, sans-serif";
    const words = safe.split(/\s+/);
    let line = "";
    let y = 190;
    words.forEach((word) => {
      const next = line ? line + " " + word : word;
      if (ctx.measureText(next).width > 260) {
        ctx.fillText(line, 24, y);
        line = word;
        y += 36;
      } else {
        line = next;
      }
    });
    if (line) ctx.fillText(line, 24, y);
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return "";
  }
}

function captureFrame(file) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(objectUrl);
      resolve(value);
    };
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;
    video.addEventListener("loadeddata", () => {
      const time = Math.min(1.2, Math.max(0.2, (video.duration || 2) * 0.15));
      video.addEventListener("seeked", () => {
        try {
          const canvas = document.createElement("canvas");
          const maxW = 640;
          const w = video.videoWidth || 640;
          const h = video.videoHeight || 360;
          const scale = Math.min(1, maxW / w);
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
          finish(canvas.toDataURL("image/jpeg", 0.72));
        } catch {
          finish("");
        }
      }, { once: true });
      try { video.currentTime = time; } catch { finish(""); }
    }, { once: true });
    video.addEventListener("error", () => finish(""));
    setTimeout(() => finish(""), 5000);
  });
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
}

function prettySize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return n.toFixed(i === 0 ? 0 : 1) + " " + units[i];
}

function toast(text) {
  els.toast.hidden = false;
  els.toast.textContent = text;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { els.toast.hidden = true; }, 2400);
}

function setMode(next) {
  mode = next;
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === next));
  els.linkFields.hidden = next !== "link";
  els.fileFields.hidden = next !== "file";
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => setMode(tab.dataset.mode));
});

if (els.file && els.drop && els.form) {
els.file.addEventListener("change", () => {
  pendingFile = els.file.files[0] || null;
  els.fileName.textContent = pendingFile ? pendingFile.name : "No file chosen";
  if (pendingFile) setMode("file");
});

["dragenter", "dragover"].forEach((evt) => {
  els.drop.addEventListener(evt, (e) => { e.preventDefault(); els.drop.classList.add("over"); });
});
["dragleave", "drop"].forEach((evt) => {
  els.drop.addEventListener(evt, (e) => { e.preventDefault(); els.drop.classList.remove("over"); });
});
els.drop.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (!file || !file.type.startsWith("video/")) {
    toast("Please drop a video file.");
    return;
  }
  pendingFile = file;
  els.fileName.textContent = file.name;
});

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = els.title.value.trim();
  if (!title) {
    toast("Add a title first.");
    els.saveStatus.textContent = "Add a title first.";
    return;
  }

  const typedUrl = cleanUrl(els.url.value);
  const extraThumb = cleanUrl(els.thumb.value);
  const pickedFile = pendingFile || (els.file.files && els.file.files[0]) || null;
  const useFile = mode === "file" || Boolean(pickedFile);
  if (useFile && !pickedFile) {
    toast("Choose a video file first.");
    els.saveStatus.textContent = "Choose a video file first.";
    return;
  }
  if (!useFile && !typedUrl) {
    toast("Paste a video link, or choose a file.");
    els.saveStatus.textContent = "Paste a video link, or choose a file.";
    return;
  }

  try {
    const shelfEl = document.getElementById("shelfInput");
    const showEl = document.getElementById("showInput");
    const showName = showEl ? showEl.value.trim() : "";
    const season = Number(document.getElementById("seasonInput") && document.getElementById("seasonInput").value) || 1;
    const episode = Number(document.getElementById("episodeInput") && document.getElementById("episodeInput").value) || 1;
    const actorsEl = document.getElementById("actorsInput");
    const minutesEl = document.getElementById("minutesInput");
    const ratingEl = document.getElementById("ratingInput");
    const item = {
      id: uid(),
      title,
      tag: els.tag ? els.tag.value.trim() : "",
      shelf: shelfEl ? shelfEl.value : "Other",
      show: shelfEl && (shelfEl.value === "Series" || shelfEl.value === "Anime") ? showName : "",
      season: shelfEl && (shelfEl.value === "Series" || shelfEl.value === "Anime") ? season : 0,
      episode: shelfEl && (shelfEl.value === "Series" || shelfEl.value === "Anime") ? episode : 0,
      actors: actorsEl ? actorsEl.value.trim() : "",
      minutes: minutesEl ? Number(minutesEl.value) || 0 : 0,
      notes: els.notes ? els.notes.value.trim() : "",
      type: useFile ? "file" : "link",
      url: useFile ? "" : typedUrl,
      thumbUrl: useFile ? "" : thumbnailFromLink(typedUrl, extraThumb),
      poster: posterDataUrl(showName || title),
      fileName: pickedFile ? pickedFile.name : "",
      size: pickedFile ? pickedFile.size : 0,
      rating: ratingEl ? Number(ratingEl.value) || 3 : 3,
      favorite: false,
      createdAt: new Date().toISOString(),
    };

    library.unshift(item);
    try { saveMeta(); } catch { toast("Saved on this page. Browser storage is full, so it may not stay after refresh."); }
    if (els.search) els.search.value = "";
    if (els.filter) els.filter.value = "all";
    document.querySelectorAll("[data-view-panel]").forEach((panel) => {
      panel.classList.toggle("hidden", panel.id !== "library");
    });
    document.getElementById("seriesPanel").classList.add("hidden");
    render(item.id);
    const made = els.cards.querySelector('[data-id="' + item.id + '"], [data-show]');
    if (made) made.scrollIntoView({ behavior: "smooth", block: "center" });
    toast("Saved. Your video is in the library.");
    if (els.saveStatus) els.saveStatus.textContent = "Saved! Look in the library.";

    els.form.reset();
    pendingFile = null;
    if (els.fileName) els.fileName.textContent = "No file chosen";
    setMode("link");
    const seriesFields = document.getElementById("seriesFields");
    if (seriesFields) seriesFields.hidden = true;
    document.getElementById("addPanel").classList.add("hidden");
    if (pickedFile) {
      try {
        await putFile(item.id, pickedFile);
      } catch { /* file stays for this play only */ }
    }
    openSaved(item, false);

    if (pickedFile) {
      try {
        await putFile(item.id, pickedFile);
        const frame = await captureFrame(pickedFile);
        if (frame) {
          item.thumbUrl = frame;
          await putThumb(item.id, frame);
          saveMeta();
          render(item.id);
        }
      } catch (err) {
        console.error(err);
        toast("The card is saved. The file itself could not be stored. Try a smaller file.");
      }
    }
  } catch (err) {
    console.error(err);
    toast("Could not add that video. " + (err && err.message ? err.message : "Try again."));
    if (els.saveStatus) els.saveStatus.textContent = "Could not add that video. " + (err && err.message ? err.message : "Try again.");
  }
});
}

function filtered() {
  const q = els.search.value.trim().toLowerCase();
  const kind = els.filter.value;
  const items = library.filter((item) => {
    const shelf = (item.shelf || item.tag || "").toLowerCase();
    let kindOk = kind === "all" || (kind === "fav" ? item.favorite : item.type === kind);
    if (kind === "movies") kindOk = shelf.includes("movie");
    if (kind === "series") kindOk = shelf.includes("series");
    if (kind === "anime") kindOk = shelf.includes("anime");
    const text = (item.title + " " + item.show + " " + item.notes + " " + item.tag + " " + item.shelf + " " + item.url + " " + item.fileName).toLowerCase();
    const ratingOk = (Number(item.rating) || 3) <= currentRating();
    return kindOk && ratingOk && text.includes(q);
  });
  if (els.sort.value === "old") items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (els.sort.value === "title") items.sort((a, b) => a.title.localeCompare(b.title));
  if (els.sort.value === "new") items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items;
}

function watchCounts() {
  try { return JSON.parse(localStorage.getItem("yaflix-watches") || "{}"); } catch { return {}; }
}
function noteWatch(item) {
  if (!item) return;
  const all = watchCounts();
  const key = item.show || item.id;
  all[key] = (all[key] || 0) + 1;
  localStorage.setItem("yaflix-watches", JSON.stringify(all));
}
function recommendScore(item) {
  const watches = watchCounts();
  const key = item.show || item.id;
  let score = 0;
  score += (watches[key] || 0) * 5;
  if (item.favorite) score += 8;
  if (getProgress(item.id) > 2) score += 4;
  const shelf = (item.shelf || "").toLowerCase();
  const shelfWatches = Object.keys(watches).filter((name) => {
    const match = library.find((entry) => (entry.show || entry.id) === name);
    return match && (match.shelf || "").toLowerCase() === shelf;
  }).length;
  score += shelfWatches * 2;
  const titleWords = (item.title + " " + (item.show || "")).toLowerCase().split(/\s+/);
  titleWords.forEach((word) => {
    if (word.length > 3 && JSON.stringify(watches).toLowerCase().includes(word)) score += 1;
  });
  return score;
}
function topRecommendations(items) {
  const seen = new Set();
  return items
    .slice()
    .sort((a, b) => recommendScore(b) - recommendScore(a))
    .filter((item) => {
      const key = item.show || item.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}
function cardFor(item, key) {
  const card = document.createElement("article");
  card.className = "rounded-xl border border-white/10 bg-black/30 p-2";
  const pic = item.thumbUrl || item.poster || posterDataUrl(item.show || item.title);
  const label = item.show || item.title;
  card.dataset.id = item.id;
  if (key) card.dataset.show = key;
  card.innerHTML =
    '<div class="relative aspect-[2/3] overflow-hidden rounded-lg bg-slate-900" data-info="' + item.id + '">' +
      '<img class="h-full w-full object-cover" alt="' + escapeHtml(label) + '">' +
    '</div>' +
    '<h3 class="px-1 py-2 text-center text-sm font-medium leading-snug">' + escapeHtml(label) + '</h3>';
  card.querySelector("img").src = pic;
  if (key) card.querySelector("div").setAttribute("data-show", key);
  return card;
}
function fillRecommendations(items) {
  const row = document.getElementById("recommendRow");
  if (row) row.innerHTML = "";
}
function buildRow(title, cards, moreItems) {
  const wrap = document.createElement("section");
  wrap.className = "mb-8";
  const head = document.createElement("div");
  head.className = "mb-3 flex items-center justify-between";
  head.innerHTML = '<h3 class="text-xl font-semibold">' + escapeHtml(title) + '</h3>';
  if (moreItems.length > 5) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "rounded-full border border-white/40 px-4 py-1 text-sm";
    more.textContent = "See more";
    more.addEventListener("click", () => openMore(title, moreItems));
    head.appendChild(more);
  }
  const scroller = document.createElement("div");
  scroller.className = "relative";
  const left = document.createElement("button");
  const right = document.createElement("button");
  left.type = "button";
  right.type = "button";
  left.className = "row-arrow absolute left-1 top-1/2 z-20 grid h-14 w-14 -translate-y-1/2 place-items-center rounded-full bg-black/80 text-3xl";
  right.className = "row-arrow absolute right-1 top-1/2 z-20 grid h-14 w-14 -translate-y-1/2 place-items-center rounded-full bg-black/80 text-3xl";
  left.textContent = "‹";
  right.textContent = "›";
  const row = document.createElement("div");
  row.className = "poster-row flex gap-4 overflow-x-auto px-16 py-8";
  cards.forEach((card) => row.appendChild(card));
  left.addEventListener("click", (e) => { e.stopPropagation(); row.scrollBy({ left: -520, behavior: "smooth" }); });
  right.addEventListener("click", (e) => { e.stopPropagation(); row.scrollBy({ left: 520, behavior: "smooth" }); });
  scroller.appendChild(left);
  scroller.appendChild(row);
  scroller.appendChild(right);
  wrap.appendChild(head);
  wrap.appendChild(scroller);
  return wrap;
}
function openMore(title, items) {
  const panel = document.getElementById("morePanel");
  const list = document.getElementById("moreList");
  document.getElementById("moreTitle").textContent = title;
  list.innerHTML = "";
  items.forEach((item) => list.appendChild(cardFor(item, item.show ? item.show.toLowerCase() : "")));
  panel.classList.remove("hidden");
  document.getElementById("shelves").classList.add("hidden");
  panel.scrollIntoView({ behavior: "smooth" });
}
document.getElementById("closeMore").addEventListener("click", () => {
  document.getElementById("morePanel").classList.add("hidden");
  document.getElementById("shelves").classList.remove("hidden");
});
function render(highlightId) {
  const items = filtered();
  els.cards.innerHTML = "";
  els.empty.hidden = items.length > 0;
  const fileCount = library.filter((i) => i.type === "file").length;
  const totalBytes = library.reduce((sum, i) => sum + (i.size || 0), 0);
  const summary = library.length + " saved · " + fileCount + " files · " + prettySize(totalBytes);
  if (els.storage) els.storage.textContent = summary;
  if (els.storageDetail) els.storageDetail.textContent = summary + " in this browser. Clearing site data removes files.";

  const grouped = new Map();
  const loose = [];
  items.forEach((item) => {
    if (item.show) {
      const key = item.show.toLowerCase();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item);
    } else {
      loose.push(item);
    }
  });
  const featured = items[0];
  if (featured) fillHero(featured);
  const shelves = document.getElementById("shelves");
  if (shelves) shelves.innerHTML = "";
  const recommended = topRecommendations(items).map((item) => cardFor(item, item.show ? item.show.toLowerCase() : ""));
  if (shelves && recommended.length) shelves.appendChild(buildRow("Recommended for You", recommended, topRecommendations(items)));
  const anime = loose.filter((item) => (item.shelf || "").toLowerCase() === "anime").concat(Array.from(grouped.values()).flat().filter((item) => (item.shelf || "").toLowerCase() === "anime" && !item.episode));
  const unique = (list) => {
    const seen = new Set();
    return list.filter((item) => {
      const key = item.show || item.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const animeCards = unique(items.filter((item) => (item.shelf || "").toLowerCase() === "anime")).map((item) => cardFor(item, item.show ? item.show.toLowerCase() : ""));
  const movieCards = unique(items.filter((item) => (item.shelf || "").toLowerCase().includes("movie"))).map((item) => cardFor(item, item.show ? item.show.toLowerCase() : ""));
  const showCards = unique(items.filter((item) => (item.shelf || "").toLowerCase().includes("series") || item.show)).map((item) => cardFor(item, item.show ? item.show.toLowerCase() : ""));
  if (shelves && animeCards.length) shelves.appendChild(buildRow("Anime", animeCards, unique(items.filter((item) => (item.shelf || "").toLowerCase() === "anime"))));
  if (shelves && movieCards.length) shelves.appendChild(buildRow("Movies", movieCards, unique(items.filter((item) => (item.shelf || "").toLowerCase().includes("movie")))));
  if (shelves && showCards.length) shelves.appendChild(buildRow("Shows", showCards, unique(items.filter((item) => (item.shelf || "").toLowerCase().includes("series") || item.show))));
}

async function fillStoredThumb(item) {
  try {
    const saved = await getThumb(item.id);
    if (!saved) return;
    item.thumbUrl = saved;
    const card = els.cards.querySelector('[data-id="' + item.id + '"] img');
    if (card) card.src = saved;
  } catch { /* poster already showing */ }
}

function fillHero(item) {
  const image = document.getElementById("heroImage");
  const title = document.getElementById("heroTitle");
  const meta = document.getElementById("heroMeta");
  const about = document.getElementById("heroAbout");
  const kind = document.getElementById("heroKind");
  if (!image || !title) return;
  image.src = item.thumbUrl || item.poster || posterDataUrl(item.show || item.title);
  title.textContent = item.show || item.title;
  if (kind) kind.textContent = item.shelf || "Yaflix";
  if (meta) meta.textContent = item.show ? "Show" : item.shelf || "";
  if (about) about.textContent = item.notes || "Open this title to see episodes and play.";
  window.heroItem = item;
}
function openSitePlayer(id, show) {
  const home = document.getElementById("siteHome");
  const panel = document.getElementById("sitePlayer");
  if (!panel) return;
  home.classList.add("hidden");
  panel.classList.remove("hidden");
  let episodes = library.filter((item) => (item.show || "").toLowerCase() === show || item.id === id);
  if (!episodes.length && (show.includes("seven") || String(id).indexOf("anime-04") === 0)) {
    episodes = [];
    for (let season = 1; season <= 5; season += 1) {
      for (let episode = 1; episode <= 24; episode += 1) {
        const url = season === 1 && episode === 1 ? "https://vimeo.com/1236263080" : season === 1 && episode === 2 ? "https://vimeo.com/1236322072" : "";
        episodes.push({ id: "anime-04-s" + season + "e" + episode, season, episode, title: "Episode " + episode, show: "The Seven Deadly Sins", url });
      }
    }
  }
  episodes.sort((a, b) => (Number(a.season) - Number(b.season)) || (Number(a.episode) - Number(b.episode)));
  const list = document.getElementById("siteEpisodes");
  const video = document.getElementById("siteVideo");
  const embed = document.getElementById("siteEmbed");
  const status = document.getElementById("siteStatus");
  function play(item) {
    if (!item) return;
    list.querySelectorAll("button").forEach((btn) => btn.classList.toggle("bg-white/20", btn.dataset.id === item.id));
    const match = String(item.url || item.vimeo || "").match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    if (match) {
      video.hidden = true;
      embed.hidden = false;
      embed.src = "https://player.vimeo.com/video/" + match[1] + "?autoplay=1";
      status.textContent = "Playing on Vimeo";
      return;
    }
    embed.hidden = true;
    embed.src = "";
    video.hidden = false;
    if (item.url) {
      video.src = item.url;
      status.textContent = "Ready. Press play.";
    } else status.textContent = "This episode does not have a video yet.";
  }
  list.innerHTML = "";
  episodes.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.id = item.id;
    btn.className = "mb-2 w-full rounded-lg bg-white/10 px-3 py-2 text-left";
    btn.textContent = item.episode ? "S" + item.season + " E" + item.episode : item.title;
    btn.addEventListener("click", () => play(item));
    list.appendChild(btn);
  });
  play(episodes.find((item) => item.id === id) || episodes[0]);
  panel.scrollIntoView({ behavior: "smooth" });
}
document.getElementById("closeSitePlayer").addEventListener("click", () => {
  document.getElementById("sitePlayer").classList.add("hidden");
  document.getElementById("siteHome").classList.remove("hidden");
  document.getElementById("siteEmbed").src = "";
  document.getElementById("siteVideo").pause();
});
document.getElementById("heroPlay").addEventListener("click", () => {
  const item = window.heroItem;
  if (!item) return;
  openSitePlayer(item.id, (item.show || "").toLowerCase());
});
document.getElementById("heroInfo").addEventListener("click", () => {
  const item = window.heroItem;
  if (!item) return;
  openSitePlayer(item.id, (item.show || "").toLowerCase());
});
document.getElementById("homeHero").addEventListener("click", (e) => {
  if (e.target.closest("button")) return;
  const item = window.heroItem;
  if (!item) return;
  openSitePlayer(item.id, (item.show || "").toLowerCase());
});
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;")
    .replace(/'/g, "&#39;");
}
function escapeAttr(value) {
  return escapeHtml(value);
}
function matchScore(title) {
  let hash = 0;
  for (const ch of String(title || "Yaflix")) hash = (hash * 33 + ch.charCodeAt(0)) >>> 0;
  return 70 + (hash % 30);
}
function previewsOn() {
  return localStorage.getItem("yaflix-preview") !== "off";
}
function autoplayOn() {
  return localStorage.getItem("yaflix-autoplay") !== "off";
}
function isPhone() {
  return window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 760;
}
function nextEpisode(item) {
  if (!item || !item.show) return null;
  const eps = library.filter((ep) => (ep.show || "").toLowerCase() === item.show.toLowerCase());
  eps.sort((a, b) => (a.season - b.season) || (a.episode - b.episode));
  const index = eps.findIndex((ep) => ep.id === item.id);
  return index >= 0 ? eps[index + 1] || null : null;
}

async function openSaved(item, resume) {
  if (!item) return;
  noteWatch(item);
  closeMedia();
  els.player.dataset.itemId = item.id;
  els.playerTitle.textContent = item.title;
  const startAt = resume ? getProgress(item.id) : 0;
  const vimeo = vimeoId(item.url || item.vimeo || "");
  if (vimeo) {
    playVimeo(vimeo);
    return;
  }
  const yt = youtubeId(item.url || "");
  if (item.type === "file") {
    const file = await getFile(item.id);
    if (!file) {
      toast("That file is no longer in this browser. Save it again.");
      return;
    }
    els.player.hidden = false;
    els.embed.hidden = true;
    els.player.src = URL.createObjectURL(file);
    els.playerHint.textContent = startAt ? "Resuming in this browser" : (item.fileName || "Playing from this browser");
    els.dialog.showModal();
    els.player.addEventListener("loadedmetadata", () => {
      if (startAt > 1 && startAt < (els.player.duration || startAt + 1)) els.player.currentTime = startAt;
    }, { once: true });
    els.player.play().catch(() => {});
    return;
  }
  if (yt) {
    els.player.hidden = true;
    els.embed.hidden = false;
    els.embed.src = "https://www.youtube.com/embed/" + encodeURIComponent(yt) + "?autoplay=1" + (startAt ? "&start=" + Math.floor(startAt) : "");
    els.playerHint.textContent = startAt ? "Resuming the saved YouTube link" : "Watching the saved YouTube link";
    els.dialog.showModal();
    return;
  }
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(item.url || "")) {
    els.player.hidden = false;
    els.embed.hidden = true;
    els.player.src = item.url;
    els.playerHint.textContent = item.url;
    els.dialog.showModal();
    els.player.addEventListener("loadedmetadata", () => {
      if (startAt > 1) els.player.currentTime = startAt;
    }, { once: true });
    els.player.play().catch(() => {});
    return;
  }
  if (item.url) window.open(item.url, "_blank", "noopener,noreferrer");
}

function progressAll() {
  try { return JSON.parse(localStorage.getItem("yaflix-progress") || "{}"); } catch { return {}; }
}
function getProgress(id) {
  return Number(progressAll()[id]) || 0;
}
function setProgress(id, time) {
  const all = progressAll();
  all[id] = Math.floor(time);
  localStorage.setItem("yaflix-progress", JSON.stringify(all));
}
els.player.addEventListener("timeupdate", () => {
  const itemId = els.player.dataset.itemId;
  if (itemId && els.player.currentTime > 1) setProgress(itemId, els.player.currentTime);
});

function closeMedia() {
  els.player.pause();
  const src = els.player.src;
  els.player.removeAttribute("src");
  els.player.load();
  els.player.hidden = false;
  if (src && src.startsWith("blob:")) URL.revokeObjectURL(src);
  els.embed.hidden = true;
  els.embed.src = "";
}

async function openCard(e) {
  if (e.target.closest(".row-arrow") || e.target.closest("#closeMore")) return;
  const card = e.target.closest("article");
  if (!card) return;
  const show = card.dataset.show || "";
  const id = card.dataset.id || "";
  openSitePlayer(id, show);
}
els.cards.addEventListener("click", openCard);
document.getElementById("shelves").addEventListener("click", openCard);
document.getElementById("moreList").addEventListener("click", openCard);

function closePlayer() {
  closeMedia();
  if (els.dialog.open) els.dialog.close();
}
els.closePlayer.addEventListener("click", closePlayer);
els.dialog.addEventListener("close", closePlayer);
els.search.addEventListener("input", () => {
  render();
  paintSearchResults();
});
function paintSearchResults() {
  const box = document.getElementById("searchResults");
  const panel = document.getElementById("searchPanel");
  if (!box || !panel) return;
  const q = els.search.value.trim().toLowerCase();
  box.innerHTML = "";
  if (!q) return;
  const seen = new Set();
  filtered().forEach((item) => {
    const key = item.show || item.id;
    if (seen.has(key)) return;
    seen.add(key);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-white/10";
    const pic = item.thumbUrl || item.poster || posterDataUrl(item.show || item.title);
    btn.innerHTML = '<img class="h-14 w-10 rounded object-cover" alt=""><span>' + escapeHtml(item.show || item.title) + '</span>';
    btn.querySelector("img").src = pic;
    btn.addEventListener("click", () => {
      if (item.show) openSeries(item.show.toLowerCase());
      else openTitle(item);
      panel.classList.add("hidden");
    });
    box.appendChild(btn);
  });
}
document.getElementById("searchOpen").addEventListener("click", () => {
  const panel = document.getElementById("searchPanel");
  panel.classList.toggle("hidden");
  if (!panel.classList.contains("hidden")) els.search.focus();
});
els.filter.addEventListener("change", () => render());
els.sort.addEventListener("change", () => render());
document.querySelectorAll(".cat").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".cat").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    els.filter.value = btn.dataset.filter;
    if (window.showView) window.showView("library");
    render();
  });
});

els.exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(library, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "yaflix-library.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

els.importInput.addEventListener("change", async () => {
  const file = els.importInput.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new Error("bad format");
    const existing = new Set(library.map((i) => i.id));
    data.filter((item) => item && item.title).forEach((item) => {
      if (existing.has(item.id)) return;
      library.push({
        id: item.id || uid(),
        title: String(item.title).slice(0, 80),
        tag: String(item.tag || "").slice(0, 24),
        shelf: String(item.shelf || "Other"),
        show: String(item.show || ""),
        season: Number(item.season) || 0,
        episode: Number(item.episode) || 0,
        actors: String(item.actors || "").slice(0, 120),
        minutes: Number(item.minutes) || 0,
        notes: String(item.notes || "").slice(0, 240),
        type: item.type === "file" ? "file" : "link",
        url: String(item.url || ""),
        thumbUrl: String(item.thumbUrl || ""),
        poster: item.poster || posterDataUrl(String(item.title)),
        fileName: String(item.fileName || ""),
        size: Number(item.size) || 0,
        favorite: Boolean(item.favorite),
        createdAt: item.createdAt || new Date().toISOString(),
      });
    });
    saveMeta();
    render();
    toast("List imported.");
  } catch {
    toast("That file could not be imported.");
  } finally {
    els.importInput.value = "";
  }
});

function fillDetail(title, about, actors, pic, meta) {
  document.getElementById("seriesTitle").textContent = title;
  document.getElementById("detailAbout").textContent = about || "No about text yet.";
  document.getElementById("detailActors").textContent = actors || "Not added";
  document.getElementById("detailGenres").textContent = meta || "Show";
  document.getElementById("detailMeta").textContent = matchScore(title) + "% Match";
  const hero = document.getElementById("detailHero");
  hero.style.backgroundImage = pic ? "url('" + pic.replace(/'/g, "") + "')" : "";
  document.getElementById("seriesPanel").classList.remove("hidden");
  document.getElementById("seriesPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function openTitle(item) {
  if (!item) return;
  window.currentDetail = { type: "movie", item };
  fillDetail(item.title, item.notes, item.actors, item.thumbUrl || item.poster, item.shelf || "Movie");
  document.getElementById("seriesList").innerHTML = "";
  document.getElementById("detailResume").hidden = getProgress(item.id) < 2;
}

function openSeries(key) {
  const eps = library.filter((item) => (item.show || "").toLowerCase() === key);
  eps.sort((a, b) => (a.season - b.season) || (a.episode - b.episode));
  if (!eps.length) return;
  window.currentDetail = { type: "show", key, eps };
  const first = eps[0];
  const seasons = new Map();
  eps.forEach((ep) => {
    const season = ep.season || 1;
    if (!seasons.has(season)) seasons.set(season, []);
    seasons.get(season).push(ep);
  });
  const resumeEp = eps.find((ep) => getProgress(ep.id) > 2) || eps[0];
  fillDetail(first.show, first.notes, first.actors, first.thumbUrl || first.poster, first.tag || "Series");
  document.getElementById("detailResume").hidden = getProgress(resumeEp.id) < 2;
  const list = document.getElementById("seriesList");
  list.innerHTML = '<div class="mb-3 flex items-center justify-between"><h3 class="text-2xl font-semibold">Episodes</h3><select id="seasonPick" class="rounded border border-white/20 bg-[#2a2a2a] px-3 py-2"></select></div><div id="episodeRows"></div>';
  const pick = document.getElementById("seasonPick");
  const rows = document.getElementById("episodeRows");
  function showSeason(season) {
    rows.innerHTML = "";
    (seasons.get(Number(season)) || []).forEach((ep) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "mb-2 grid w-full grid-cols-[28px_120px_1fr_auto] items-center gap-3 rounded bg-[#2a2a2a] p-3 text-left";
      row.setAttribute("data-play", ep.id);
      const pic = ep.thumbUrl || ep.poster || "";
      row.innerHTML =
        '<span class="text-2xl text-slate-300">' + (ep.episode || "?") + '</span>' +
        '<img class="h-16 w-28 rounded object-cover" alt="">' +
        '<span><strong class="block">' + escapeHtml(ep.title) + '</strong><span class="mt-1 block text-sm text-slate-300">' + escapeHtml(ep.notes || "No description yet.") + '</span></span>' +
        '<span class="text-sm text-slate-300">' + (ep.minutes ? ep.minutes + "m" : "") + '</span>';
      const shot = row.querySelector("img");
      if (shot) shot.src = pic || posterDataUrl(ep.title);
      rows.appendChild(row);
    });
  }
  seasons.forEach((unused, season) => {
    const option = document.createElement("option");
    option.value = season;
    option.textContent = Number(season) === 6 ? "Special/Mini-Season" : "Season " + season;
    pick.appendChild(option);
  });
  pick.addEventListener("change", () => showSeason(pick.value));
  showSeason(pick.value);
}

document.getElementById("detailPlay").addEventListener("click", async () => {
  const detail = window.currentDetail;
  if (!detail) return;
  if (detail.type === "movie") await openSaved(detail.item, false);
  else await openSaved(detail.eps[0], false);
});
document.getElementById("detailResume").addEventListener("click", async () => {
  const detail = window.currentDetail;
  if (!detail) return;
  if (detail.type === "movie") await openSaved(detail.item, true);
  else {
    const ep = detail.eps.find((item) => getProgress(item.id) > 2) || detail.eps[0];
    await openSaved(ep, true);
  }
});

document.getElementById("closeSeries").addEventListener("click", () => {
  document.getElementById("seriesPanel").classList.add("hidden");
});
document.getElementById("seriesList").addEventListener("click", async (e) => {
  const play = e.target.closest("[data-play]");
  const del = e.target.closest("[data-delete]");
  if (play) {
    const item = library.find((i) => i.id === play.getAttribute("data-play"));
    await openSaved(item);
  }
  if (del) {
    const id = del.getAttribute("data-delete");
    const item = library.find((i) => i.id === id);
    if (!item || !confirm('Delete "' + item.title + '"?')) return;
    library = library.filter((i) => i.id !== id);
    saveMeta();
    if (item.type === "file") await deleteStored(id).catch(() => {});
    render();
    openSeries((item.show || "").toLowerCase());
  }
});
const shelfInput = document.getElementById("shelfInput");
if (shelfInput) shelfInput.addEventListener("change", (e) => {
  document.getElementById("seriesFields").hidden = e.target.value !== "Series" && e.target.value !== "Anime";
});

let previewTimer = null;
let previewVideo = null;
function stopPreview() {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = null;
  if (previewVideo) {
    previewVideo.pause();
    previewVideo.remove();
    previewVideo = null;
  }
}
els.cards.addEventListener("mouseover", (e) => {
  if (!previewsOn() || isPhone()) return;
  const card = e.target.closest("article");
  if (!card || card.dataset.previewing) return;
  const info = card.querySelector("[data-info]");
  const show = card.querySelector("[data-show]");
  const item = info ? library.find((i) => i.id === info.getAttribute("data-info")) : null;
  const showItem = show ? library.find((i) => (i.show || "").toLowerCase() === show.getAttribute("data-show") && i.type === "file") : null;
  const target = item && item.type === "file" ? item : showItem;
  if (!target) return;
  stopPreview();
  previewTimer = setTimeout(async () => {
    const file = await getFile(target.id);
    if (!file || !previewsOn()) return;
    const wrap = card.querySelector(".relative");
    if (!wrap) return;
    previewVideo = document.createElement("video");
    previewVideo.className = "absolute inset-0 h-full w-full object-cover";
    previewVideo.muted = true;
    previewVideo.playsInline = true;
    previewVideo.src = URL.createObjectURL(file);
    wrap.appendChild(previewVideo);
    previewVideo.play().catch(() => {});
    card.dataset.previewing = "1";
  }, 700);
});
els.cards.addEventListener("mouseout", (e) => {
  const card = e.target.closest("article");
  if (card) delete card.dataset.previewing;
  stopPreview();
});

let nextTimer = null;
function clearNext() {
  if (nextTimer) clearInterval(nextTimer);
  nextTimer = null;
  const banner = document.getElementById("nextBanner");
  if (banner) banner.classList.add("hidden");
  if (banner) banner.classList.remove("grid");
}
function queueNext(item) {
  clearNext();
  const next = nextEpisode(item);
  if (!next || !autoplayOn()) return;
  const banner = document.getElementById("nextBanner");
  const count = document.getElementById("nextCount");
  let left = 5;
  count.textContent = left;
  banner.classList.remove("hidden");
  banner.classList.add("grid");
  nextTimer = setInterval(() => {
    left -= 1;
    count.textContent = left;
    if (left <= 0) {
      clearNext();
      openSaved(next, false);
    }
  }, 1000);
  document.getElementById("playNextNow").onclick = () => { clearNext(); openSaved(next, false); };
  document.getElementById("cancelNext").onclick = clearNext;
}
els.player.addEventListener("ended", () => {
  const item = library.find((i) => i.id === els.player.dataset.itemId);
  queueNext(item);
});
els.player.addEventListener("timeupdate", () => {
  const bar = document.getElementById("progressBar");
  if (els.player.duration) bar.value = Math.round((els.player.currentTime / els.player.duration) * 100);
});
document.getElementById("playPause").addEventListener("click", () => {
  if (els.player.paused) { els.player.play(); document.getElementById("playPause").textContent = "Pause"; }
  else { els.player.pause(); document.getElementById("playPause").textContent = "Play"; }
});
document.getElementById("back10").addEventListener("click", () => { els.player.currentTime = Math.max(0, els.player.currentTime - 10); });
document.getElementById("fwd10").addEventListener("click", () => { els.player.currentTime = Math.min(els.player.duration || 0, els.player.currentTime + 10); });
document.getElementById("volumeBar").addEventListener("input", (e) => { els.player.volume = Number(e.target.value); });
document.getElementById("progressBar").addEventListener("input", (e) => {
  if (els.player.duration) els.player.currentTime = (Number(e.target.value) / 100) * els.player.duration;
});
document.getElementById("captionBtn").addEventListener("click", () => {
  const tracks = els.player.textTracks;
  if (!tracks || !tracks.length) { toast("This video has no subtitle track."); return; }
  tracks[0].mode = tracks[0].mode === "showing" ? "hidden" : "showing";
});
document.getElementById("playerWrap").addEventListener("mousemove", () => {
  const controls = document.getElementById("playerControls");
  if (controls) controls.classList.remove("hidden");
});
["playPause", "back10", "fwd10", "volumeBar", "progressBar", "captionBtn", "previewToggle", "autoplayToggle"].forEach((id) => {
  if (!document.getElementById(id)) console.warn("Missing", id);
});
document.getElementById("previewToggle").checked = previewsOn();
document.getElementById("autoplayToggle").checked = autoplayOn();
document.getElementById("previewToggle").addEventListener("change", (e) => {
  localStorage.setItem("yaflix-preview", e.target.checked ? "on" : "off");
  if (!e.target.checked) stopPreview();
});
document.getElementById("autoplayToggle").addEventListener("change", (e) => {
  localStorage.setItem("yaflix-autoplay", e.target.checked ? "on" : "off");
});

render();

function isTvBrowser() {
  return /smart-?tv|smarttv|webos|tizen|netcast|bravia|hbbtv|viera|aftb|aftm|crkey/i.test(navigator.userAgent);
}
function setTv(on) {
  document.body.classList.toggle("tv", on);
  const box = document.getElementById("tvSwitch");
  if (box) box.checked = on;
  localStorage.setItem("yaflix-tv", on ? "on" : "off");
}
const savedTv = localStorage.getItem("yaflix-tv");
setTv(savedTv ? savedTv === "on" : isTvBrowser());
const tvSwitch = document.getElementById("tvSwitch");
if (tvSwitch) tvSwitch.addEventListener("change", (e) => setTv(e.target.checked));

function tvTargets() {
  return Array.from(document.querySelectorAll("button, a, select, input")).filter((el) => {
    if (el.disabled || el.hidden) return false;
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}
function moveTvFocus(key) {
  const items = tvTargets();
  const current = document.activeElement;
  if (!items.length) return;
  if (!items.includes(current)) {
    items[0].focus();
    return;
  }
  const box = current.getBoundingClientRect();
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  let best = null;
  let bestScore = Infinity;
  items.forEach((el) => {
    if (el === current) return;
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const ok = (key === "ArrowRight" && dx > 20) || (key === "ArrowLeft" && dx < -20) || (key === "ArrowDown" && dy > 20) || (key === "ArrowUp" && dy < -20);
    if (!ok) return;
    const score = Math.abs(dx) + Math.abs(dy) * (key === "ArrowLeft" || key === "ArrowRight" ? 1.4 : 1);
    if (score < bestScore) {
      best = el;
      bestScore = score;
    }
  });
  if (best) best.focus();
}
document.addEventListener("keydown", (e) => {
  if (!document.body.classList.contains("tv")) return;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
    e.preventDefault();
    moveTvFocus(e.key);
  }
  if (e.key === "Escape" || e.key === "BrowserBack") {
    const dialog = document.getElementById("playerDialog");
    if (dialog && dialog.open) {
      e.preventDefault();
      dialog.close();
      return;
    }
    const panel = document.getElementById("seriesPanel");
    if (panel && !panel.classList.contains("hidden")) {
      e.preventDefault();
      panel.classList.add("hidden");
    }
  }
});

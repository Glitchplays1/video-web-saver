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
          existing.title = title;
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
  addSet(movies, "Movies");
  addSet(anime, "Anime");
  addSet(series, "Series");
  try { saveMeta(); } catch { /* samples still show this visit */ }
}
seedSamples();
fetch("anime.json")
  .then((res) => res.json())
  .then((rows) => {
    if (!Array.isArray(rows)) return;
    rows.forEach((row) => {
      const item = library.find((entry) => entry.id === row.id);
      if (!item || !row.pic) return;
      item.thumbUrl = row.pic;
      item.title = row.title || item.title;
    });
    saveMeta();
    render();
  })
  .catch(() => {});

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
function openWho() {
  const screen = document.getElementById("whoScreen");
  if (!screen) return;
  screen.classList.remove("hidden");
  screen.classList.add("flex");
  drawProfiles();
}
function closeWho() {
  const screen = document.getElementById("whoScreen");
  screen.classList.add("hidden");
  screen.classList.remove("flex");
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
function drawProfiles() {
  const row = document.getElementById("profileRow");
  row.innerHTML = "";
  profiles.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "w-28 text-slate-300 hover:text-white";
    const kind = Number(p.rating) <= 3 ? "Kids profile" : ratingName(p.rating);
    btn.innerHTML = '<span class="mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-md bg-slate-700 text-3xl"></span><span class="mt-2 block">' + escapeHtml(p.name) + '</span><span class="block text-xs text-slate-400">' + escapeHtml(kind) + '</span>';
    const face = btn.querySelector("span");
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
  add.className = "w-28 text-slate-300";
  add.innerHTML = '<span class="mx-auto grid h-24 w-24 place-items-center rounded-md bg-slate-800 text-5xl">+</span><span class="mt-2 block">Add Profile</span>';
  add.addEventListener("click", () => openProfileForm(null));
  row.appendChild(add);
  document.getElementById("editProfiles").textContent = editingProfiles ? "DONE" : "EDIT PROFILES";
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
    const showName = (document.getElementById("showInput").value || "").trim();
    const season = Number(document.getElementById("seasonInput").value) || 1;
    const episode = Number(document.getElementById("episodeInput").value) || 1;
    const item = {
      id: uid(),
      title,
      tag: els.tag.value.trim(),
      shelf: shelfEl ? shelfEl.value : "Other",
      show: shelfEl && (shelfEl.value === "Series" || shelfEl.value === "Anime") ? showName : "",
      season: shelfEl && (shelfEl.value === "Series" || shelfEl.value === "Anime") ? season : 0,
      episode: shelfEl && (shelfEl.value === "Series" || shelfEl.value === "Anime") ? episode : 0,
      actors: document.getElementById("actorsInput").value.trim(),
      minutes: Number(document.getElementById("minutesInput").value) || 0,
      notes: els.notes.value.trim(),
      type: useFile ? "file" : "link",
      url: useFile ? "" : typedUrl,
      thumbUrl: useFile ? "" : thumbnailFromLink(typedUrl, extraThumb),
      poster: posterDataUrl(showName || title),
      fileName: pickedFile ? pickedFile.name : "",
      size: pickedFile ? pickedFile.size : 0,
      rating: Number(document.getElementById("ratingInput").value) || 3,
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
    els.fileName.textContent = "No file chosen";
    setMode("link");
    document.getElementById("seriesFields").hidden = true;

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

function render(highlightId) {
  const items = filtered();
  els.cards.innerHTML = "";
  els.empty.hidden = items.length > 0;
  const fileCount = library.filter((i) => i.type === "file").length;
  const totalBytes = library.reduce((sum, i) => sum + (i.size || 0), 0);
  const summary = library.length + " saved · " + fileCount + " files · " + prettySize(totalBytes);
  els.storage.textContent = summary;
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

  grouped.forEach((eps, key) => {
    eps.sort((a, b) => (a.season - b.season) || (a.episode - b.episode));
    const first = eps[0];
    const seasons = new Set(eps.map((ep) => ep.season || 1)).size;
    const card = document.createElement("article");
    card.className = "rounded-xl border border-dashed border-blue-300 p-2";
    const pic = first.thumbUrl || first.poster || posterDataUrl(first.show);
    card.innerHTML =
      '<div class="relative aspect-[2/3] overflow-hidden rounded-lg bg-slate-900" data-show="' + escapeHtml(key) + '">' +
        '<img class="h-full w-full object-cover" alt="' + escapeHtml(first.show) + '">' +
        '<span class="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-1 text-xs">' + eps.length + ' eps</span>' +
      '</div>' +
      '<h3 class="px-1 py-2 text-center text-sm font-medium leading-snug">' + escapeHtml(first.show) + '</h3>' +
      '<p class="mb-2 text-center text-xs text-slate-300">' + seasons + ' season' + (seasons === 1 ? '' : 's') + '</p>' +
      '<div class="mb-1 flex justify-center"><button class="rounded-full bg-bar px-2 py-1 text-xs" type="button" data-show="' + escapeHtml(key) + '">Open series</button></div>';
    card.querySelector("img").src = pic || posterDataUrl(first.show);
    els.cards.appendChild(card);
  });

  loose.forEach((item) => {
    const card = document.createElement("article");
    card.className = "rounded-xl border border-dashed border-blue-300 p-2" + (highlightId && item.id === highlightId ? " outline outline-2 outline-emerald-300" : "");
    card.dataset.id = item.id;
    const pic = item.thumbUrl || item.poster || posterDataUrl(item.title);
    card.innerHTML =
      '<div class="relative aspect-[2/3] overflow-hidden rounded-lg bg-slate-900" data-info="' + item.id + '">' +
        '<img class="h-full w-full object-cover" alt="' + escapeHtml(item.title) + '">' +
        '<span class="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/70 text-xs">▶</span>' +
      '</div>' +
      '<h3 class="px-1 py-2 text-center text-sm font-medium leading-snug">' + escapeHtml(item.title) + '</h3>' +
      '<div class="mb-1 flex flex-wrap justify-center gap-1">' +
        '<button class="rounded-full bg-bar px-2 py-1 text-xs" type="button" data-play="' + item.id + '">Watch</button>' +
        '<button class="rounded-full bg-bar px-2 py-1 text-xs" type="button" data-fav="' + item.id + '">' + (item.favorite ? "Saved" : "Favorite") + '</button>' +
        '<button class="rounded-full bg-bar px-2 py-1 text-xs" type="button" data-delete="' + item.id + '">Delete</button>' +
      '</div>';
    const img = card.querySelector("img");
    img.src = pic || posterDataUrl(item.title);
    img.dataset.tries = "0";
    img.addEventListener("error", () => {
      const tries = posterFallbacks(pic);
      const next = Number(img.dataset.tries) + 1;
      img.dataset.tries = String(next);
      if (tries[next]) img.src = tries[next];
      else img.src = posterDataUrl(item.title);
    });
    els.cards.appendChild(card);
    if (!item.thumbUrl && item.type === "file") fillStoredThumb(item);
  });
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
  closeMedia();
  els.player.dataset.itemId = item.id;
  els.playerTitle.textContent = item.title;
  const startAt = resume ? getProgress(item.id) : 0;
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

els.cards.addEventListener("click", async (e) => {
  if (e.target.closest("a")) return;
  const showEl = e.target.closest("[data-show]");
  const infoEl = e.target.closest("[data-info]");
  const play = e.target.closest("[data-play]");
  const del = e.target.closest("[data-delete]");
  const fav = e.target.closest("[data-fav]");
  if (infoEl && !play && !del && !fav) {
    const item = library.find((i) => i.id === infoEl.getAttribute("data-info"));
    if (!item) return;
    if (isPhone()) await openSaved(item, getProgress(item.id) > 2);
    else openTitle(item);
    return;
  }
  if (showEl && !play && !del && !fav) {
    if (isPhone()) {
      const eps = library.filter((item) => (item.show || "").toLowerCase() === showEl.getAttribute("data-show"));
      eps.sort((a, b) => (a.season - b.season) || (a.episode - b.episode));
      if (eps[0]) await openSaved(eps[0], getProgress(eps[0].id) > 2);
    } else openSeries(showEl.getAttribute("data-show"));
    return;
  }
  if (fav) {
    const item = library.find((i) => i.id === fav.getAttribute("data-fav"));
    if (!item) return;
    item.favorite = !item.favorite;
    saveMeta();
    render(item.id);
    return;
  }
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
  }
});

function closePlayer() {
  closeMedia();
  if (els.dialog.open) els.dialog.close();
}
els.closePlayer.addEventListener("click", closePlayer);
els.dialog.addEventListener("close", closePlayer);
els.search.addEventListener("input", () => render());
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
    option.textContent = "Season " + season;
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
document.getElementById("shelfInput").addEventListener("change", (e) => {
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

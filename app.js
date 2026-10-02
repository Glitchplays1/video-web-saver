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

window.addEventListener("load", () => {
  const loader = document.getElementById("loader");
  setTimeout(() => {
    if (!loader) return;
    loader.classList.add("opacity-0", "pointer-events-none");
  }, 1600);
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
  localStorage.setItem(META_KEY, JSON.stringify(library));
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
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  let hash = 0;
  for (const ch of title) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  const g = ctx.createLinearGradient(0, 0, 480, 720);
  g.addColorStop(0, "hsl(" + hue + " 70% 28%)");
  g.addColorStop(1, "#07070c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 480, 720);
  ctx.fillStyle = "#ff1a1a";
  ctx.fillRect(0, 0, 480, 10);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 42px Trebuchet MS, Segoe UI, sans-serif";
  const words = title.split(/\s+/);
  let line = "";
  let y = 280;
  words.forEach((word) => {
    const next = line ? line + " " + word : word;
    if (ctx.measureText(next).width > 400) {
      ctx.fillText(line, 36, y);
      line = word;
      y += 50;
    } else {
      line = next;
    }
  });
  if (line) ctx.fillText(line, 36, y);
  ctx.fillStyle = "#ffb4b4";
  ctx.font = "600 22px Trebuchet MS, Segoe UI, sans-serif";
  ctx.fillText("YAFLIX", 36, 650);
  return canvas.toDataURL("image/jpeg", 0.82);
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
  if (!title) return;

  const typedUrl = cleanUrl(els.url.value);
  const extraThumb = cleanUrl(els.thumb.value);
  const useFile = mode === "file";
  if (useFile && !pendingFile) {
    toast("Choose a video file first.");
    return;
  }
  if (!useFile && !typedUrl) {
    toast("Paste a video link first.");
    return;
  }

  const shelfEl = document.getElementById("shelfInput");
  const showName = document.getElementById("showInput").value.trim();
  const season = Number(document.getElementById("seasonInput").value) || 1;
  const episode = Number(document.getElementById("episodeInput").value) || 1;
  const item = {
    id: uid(),
    title,
    tag: els.tag.value.trim(),
    shelf: shelfEl ? shelfEl.value : "Other",
    show: showName,
    season: showName ? season : 0,
    episode: showName ? episode : 0,
    actors: document.getElementById("actorsInput").value.trim(),
    notes: els.notes.value.trim(),
    type: useFile ? "file" : "link",
    url: useFile ? "" : typedUrl,
    thumbUrl: useFile ? "" : thumbnailFromLink(typedUrl, extraThumb),
    poster: posterDataUrl(title),
    fileName: pendingFile ? pendingFile.name : "",
    size: pendingFile ? pendingFile.size : 0,
    favorite: false,
    createdAt: new Date().toISOString(),
  };

  const fileToStore = pendingFile;
  library.unshift(item);
  saveMeta();
  els.search.value = "";
  els.filter.value = "all";
  render(item.id);
  toast("Saved. Your video is in the library.");
  els.saveStatus.textContent = "Saved! The card is in Your library.";
  if (window.showView) window.showView("library");

  els.form.reset();
  pendingFile = null;
  els.fileName.textContent = "No file chosen";
  setMode("link");

  if (fileToStore) {
    try {
      await putFile(item.id, fileToStore);
      const frame = await captureFrame(fileToStore);
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
});

function filtered() {
  const q = els.search.value.trim().toLowerCase();
  const kind = els.filter.value;
  const items = library.filter((item) => {
    const shelf = (item.shelf || item.tag || "").toLowerCase();
    let kindOk = kind === "all" || (kind === "fav" ? item.favorite : item.type === kind);
    if (kind === "movies") kindOk = shelf.includes("movie");
    if (kind === "series") kindOk = shelf.includes("series");
    const text = (item.title + " " + item.show + " " + item.notes + " " + item.tag + " " + item.shelf + " " + item.url + " " + item.fileName).toLowerCase();
    return kindOk && text.includes(q);
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
  els.storageDetail.textContent = summary + " in this browser. Clearing site data removes files.";

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
      '<div class="relative aspect-[2/3] overflow-hidden rounded-lg bg-slate-900" data-show="' + escapeAttr(key) + '">' +
        '<img class="h-full w-full object-cover" alt="' + escapeHtml(first.show) + '" src="' + escapeAttr(pic) + '">' +
        '<span class="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-1 text-xs">' + eps.length + ' eps</span>' +
      '</div>' +
      '<h3 class="px-1 py-2 text-center text-sm font-medium leading-snug">' + escapeHtml(first.show) + '</h3>' +
      '<p class="mb-2 text-center text-xs text-slate-300">' + seasons + ' season' + (seasons === 1 ? '' : 's') + '</p>' +
      '<div class="mb-1 flex justify-center"><button class="rounded-full bg-bar px-2 py-1 text-xs" type="button" data-show="' + escapeAttr(key) + '">Open series</button></div>';
    els.cards.appendChild(card);
  });

  loose.forEach((item) => {
    const card = document.createElement("article");
    card.className = "rounded-xl border border-dashed border-blue-300 p-2" + (highlightId && item.id === highlightId ? " outline outline-2 outline-emerald-300" : "");
    card.dataset.id = item.id;
    const pic = item.thumbUrl || item.poster || posterDataUrl(item.title);
    card.innerHTML =
      '<div class="relative aspect-[2/3] overflow-hidden rounded-lg bg-slate-900" data-info="' + item.id + '">' +
        '<img class="h-full w-full object-cover" alt="' + escapeHtml(item.title) + '" src="' + escapeAttr(pic) + '">' +
        '<span class="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/70 text-xs">▶</span>' +
      '</div>' +
      '<h3 class="px-1 py-2 text-center text-sm font-medium leading-snug">' + escapeHtml(item.title) + '</h3>' +
      '<div class="mb-1 flex flex-wrap justify-center gap-1">' +
        '<button class="rounded-full bg-bar px-2 py-1 text-xs" type="button" data-play="' + item.id + '">Watch</button>' +
        '<button class="rounded-full bg-bar px-2 py-1 text-xs" type="button" data-fav="' + item.id + '">' + (item.favorite ? "Saved" : "Favorite") + '</button>' +
        '<button class="rounded-full bg-bar px-2 py-1 text-xs" type="button" data-delete="' + item.id + '">Delete</button>' +
      '</div>';
    const img = card.querySelector("img");
    img.addEventListener("error", () => {
      if (item.poster && img.src !== item.poster) img.src = item.poster;
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
    .replace(/"/g, "\u0026quot;");
}
function escapeAttr(value) { return escapeHtml(value); }

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
    openTitle(item);
    return;
  }
  if (showEl && !play && !del && !fav) {
    openSeries(showEl.getAttribute("data-show"));
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
  document.getElementById("detailActors").textContent = actors || "No actors added yet.";
  document.getElementById("detailMeta").textContent = meta;
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
  fillDetail(first.show, first.notes, first.actors, first.thumbUrl || first.poster, seasons.size + " season" + (seasons.size === 1 ? "" : "s"));
  document.getElementById("detailResume").hidden = getProgress(resumeEp.id) < 2;
  const list = document.getElementById("seriesList");
  list.innerHTML = '<div class="mb-3 flex flex-wrap gap-2" id="seasonTabs"></div><div id="episodeRows"></div>';
  const tabs = document.getElementById("seasonTabs");
  const rows = document.getElementById("episodeRows");
  function showSeason(season) {
    rows.innerHTML = "";
    (seasons.get(season) || []).forEach((ep) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "mb-2 flex w-full items-center justify-between rounded-lg bg-ink px-3 py-2 text-left";
      row.setAttribute("data-play", ep.id);
      row.innerHTML = "<span>Episode " + (ep.episode || "?") + " · " + escapeHtml(ep.title) + "</span><span>Play</span>";
      rows.appendChild(row);
    });
  }
  seasons.forEach((unused, season) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "rounded-full bg-ink px-3 py-1 text-sm";
    tab.textContent = "Season " + season;
    tab.addEventListener("click", () => showSeason(season));
    tabs.appendChild(tab);
  });
  showSeason(eps[0].season || 1);
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
  document.getElementById("seriesFields").classList.toggle("hidden", e.target.value !== "Series");
});

render();

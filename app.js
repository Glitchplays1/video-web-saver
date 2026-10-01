const DB_NAME = "video-web-saver";
const DB_VERSION = 2;
const STORE = "videos";
const THUMBS = "thumbs";
const META_KEY = "vws-library";

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
  storage: document.getElementById("storageInfo"),
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
};

let mode = "link";
let pendingFile = null;
let library = loadMeta();

window.addEventListener("load", () => {
  const loader = document.getElementById("loader");
  if (!loader) return;
  setTimeout(() => loader.classList.add("hide"), 2200);
});

function loadMeta() {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || "[]");
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
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
      if (!db.objectStoreNames.contains(THUMBS)) {
        db.createObjectStore(THUMBS);
      }
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

async function deleteFile(id) {
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
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0].split("?")[0];
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
  if (id) return `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
  return "";
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
    const startCapture = () => {
      const time = Math.min(1.2, Math.max(0.2, (video.duration || 2) * 0.15));
      const onSeek = () => {
        try {
          const canvas = document.createElement("canvas");
          const maxW = 640;
          const w = video.videoWidth || 640;
          const h = video.videoHeight || 360;
          const scale = Math.min(1, maxW / w);
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          finish(canvas.toDataURL("image/jpeg", 0.72));
        } catch {
          finish("");
        }
      };
      video.addEventListener("seeked", onSeek, { once: true });
      try {
        video.currentTime = time;
      } catch {
        onSeek();
      }
    };
    video.addEventListener("loadeddata", startCapture, { once: true });
    video.addEventListener("loadedmetadata", () => {
      video.play().then(() => video.pause()).catch(() => {});
    }, { once: true });
    video.addEventListener("error", () => finish(""));
    setTimeout(() => finish(""), 5000);
  });
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
}

function prettySize(bytes) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function setMode(next) {
  mode = next;
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === next);
  });
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
  els.drop.addEventListener(evt, (e) => {
    e.preventDefault();
    els.drop.classList.add("over");
  });
});

["dragleave", "drop"].forEach((evt) => {
  els.drop.addEventListener(evt, (e) => {
    e.preventDefault();
    els.drop.classList.remove("over");
  });
});

els.drop.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (!file || !file.type.startsWith("video/")) {
    alert("Please drop a video file.");
    return;
  }
  pendingFile = file;
  els.fileName.textContent = file.name;
});

function setStatus(text) {
  if (els.saveStatus) els.saveStatus.textContent = text;
}

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = els.title.value.trim();
  if (!title) {
    alert("Add a title first.");
    els.title.focus();
    return;
  }

  const typedUrl = cleanUrl(els.url ? els.url.value : "");
  const extraThumb = cleanUrl(els.thumb ? els.thumb.value : "");
  const useFile = mode === "file" || Boolean(pendingFile);

  if (useFile && !pendingFile) {
    alert("Choose a video file first, or switch to Save a link.");
    return;
  }
  if (!useFile && !typedUrl) {
    alert("Paste a video link first, or switch to Save a file from this device.");
    return;
  }

  const item = {
    id: uid(),
    title,
    tag: els.tag.value.trim(),
    notes: els.notes.value.trim(),
    type: useFile ? "file" : "link",
    url: useFile ? "" : typedUrl,
    thumbUrl: "",
    fileName: pendingFile ? pendingFile.name : "",
    size: pendingFile ? pendingFile.size : 0,
    createdAt: new Date().toISOString(),
  };

  if (item.type === "link") {
    item.thumbUrl = thumbnailFromLink(item.url, extraThumb);
  }

  if (els.saveBtn) {
    els.saveBtn.disabled = true;
    els.saveBtn.textContent = "Saving...";
  }
  setStatus("Saving...");

  try {
    if (pendingFile) {
      await putFile(item.id, pendingFile);
    }
    library.unshift(item);
    saveMeta();
    els.search.value = "";
    els.filter.value = "all";
    render(item.id);
    setStatus("Saved! Look in Your library below.");
    document.querySelector(".library")?.scrollIntoView({ behavior: "smooth", block: "start" });

    if (pendingFile) {
      captureFrame(pendingFile).then(async (frame) => {
        if (frame) {
          await putThumb(item.id, frame);
          render(item.id);
        }
      });
    }

    if (item.type === "link") {
      openSaved(item);
    } else {
      const file = pendingFile;
      pendingFile = null;
      openSaved(item, file);
    }
  } catch (err) {
    console.error(err);
    alert("Could not save that video in this browser. Try a smaller file, or save it as a link.");
    setStatus("Save failed.");
  } finally {
    els.form.reset();
    pendingFile = null;
    els.fileName.textContent = "No file chosen";
    setMode("link");
    if (els.saveBtn) {
      els.saveBtn.disabled = false;
      els.saveBtn.textContent = "Save video";
    }
  }
});

function filtered() {
  const q = els.search.value.trim().toLowerCase();
  const kind = els.filter.value;
  return library.filter((item) => {
    const kindOk = kind === "all" || item.type === kind;
    const text = `${item.title} ${item.notes} ${item.tag} ${item.url} ${item.fileName}`.toLowerCase();
    return kindOk && text.includes(q);
  });
}

function render(highlightId) {
  const items = filtered();
  els.cards.innerHTML = "";
  els.empty.hidden = items.length > 0;
  els.empty.style.display = items.length > 0 ? "none" : "block";

  const fileCount = library.filter((i) => i.type === "file").length;
  const totalBytes = library.reduce((sum, i) => sum + (i.size || 0), 0);
  els.storage.textContent = `${library.length} saved • ${fileCount} files • ${prettySize(totalBytes) || "0 B"} in this browser`;

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "card" + (highlightId && item.id === highlightId ? " new-card" : "");
    card.dataset.id = item.id;
    const linkThumb = item.thumbUrl || thumbnailFromLink(item.url || "", "");
    card.innerHTML = `
      <div class="thumb-wrap" data-play="${item.id}">
        <div class="thumb-missing" data-ph="${item.id}">🎬</div>
        <span class="play-mark">▶</span>
      </div>
      <div class="card-body">
        <div>
          <span class="badge">${item.type === "file" ? "Saved file" : "Link"}</span>
          ${item.tag ? `<span class="badge">${escapeHtml(item.tag)}</span>` : ""}
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.notes || item.fileName || item.url || "No notes")}</p>
        <p>${new Date(item.createdAt).toLocaleString()}${item.size ? " • " + prettySize(item.size) : ""}</p>
        <div class="row">
          <button data-play="${item.id}">Watch</button>
          ${item.url ? `<a class="file-label" href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer">Open link</a>` : ""}
          <button data-delete="${item.id}">Delete</button>
        </div>
      </div>
    `;
    els.cards.appendChild(card);
    fillThumb(card, item, linkThumb);
  });
}

async function fillThumb(card, item, linkThumb) {
  const wrap = card.querySelector(".thumb-wrap");
  const placeholder = card.querySelector("[data-ph]");
  let src = linkThumb || "";
  if (!src) {
    src = await getThumb(item.id);
  }
  if (!src && item.type === "file") {
    const file = await getFile(item.id);
    if (file) {
      src = await captureFrame(file);
      if (src) await putThumb(item.id, src);
    }
  }
  if (!src || !wrap) return;
  const img = document.createElement("img");
  img.alt = item.title;
  img.src = src;
  img.addEventListener("error", () => img.remove());
  wrap.insertBefore(img, wrap.firstChild);
  if (placeholder) placeholder.remove();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

async function openSaved(item, fileOverride) {
  if (!item) return;
  closeMedia();
  els.playerTitle.textContent = item.title;
  const yt = youtubeId(item.url || "");

  if (item.type === "file") {
    const file = fileOverride || (await getFile(item.id));
    if (!file) {
      alert("That file is no longer in this browser. Save it again.");
      return;
    }
    els.player.hidden = false;
    if (els.embed) els.embed.hidden = true;
    els.player.src = URL.createObjectURL(file);
    els.playerHint.textContent = item.fileName || "Playing from this browser";
    els.dialog.showModal();
    els.player.play().catch(() => {});
    return;
  }

  if (yt && els.embed) {
    els.player.hidden = true;
    els.embed.hidden = false;
    els.embed.src = "https://www.youtube.com/embed/" + encodeURIComponent(yt) + "?autoplay=1";
    els.playerHint.textContent = "Watching the saved YouTube link";
    els.dialog.showModal();
    return;
  }

  if (/\.(mp4|webm|ogg)(\?|$)/i.test(item.url || "")) {
    els.player.hidden = false;
    if (els.embed) els.embed.hidden = true;
    els.player.src = item.url;
    els.playerHint.textContent = item.url;
    els.dialog.showModal();
    els.player.play().catch(() => {});
    return;
  }

  if (item.url) {
    window.open(item.url, "_blank", "noopener,noreferrer");
  }
}

function closeMedia() {
  els.player.pause();
  const src = els.player.src;
  els.player.removeAttribute("src");
  els.player.load();
  els.player.hidden = false;
  if (src && src.startsWith("blob:")) URL.revokeObjectURL(src);
  if (els.embed) {
    els.embed.hidden = true;
    els.embed.src = "";
  }
}

els.cards.addEventListener("click", async (e) => {
  if (e.target.closest("a")) return;
  const playEl = e.target.closest("[data-play]");
  const deleteEl = e.target.closest("[data-delete]");
  const playId = playEl ? playEl.getAttribute("data-play") : null;
  const deleteId = deleteEl ? deleteEl.getAttribute("data-delete") : null;

  if (playId) {
    const item = library.find((i) => i.id === playId);
    await openSaved(item);
  }

  if (deleteId) {
    const item = library.find((i) => i.id === deleteId);
    if (!item) return;
    if (!confirm(`Delete "${item.title}"?`)) return;
    library = library.filter((i) => i.id !== deleteId);
    saveMeta();
    if (item.type === "file") {
      await deleteFile(deleteId);
    }
    render();
  }
});

els.closePlayer.addEventListener("click", closePlayer);
els.dialog.addEventListener("close", closePlayer);

function closePlayer() {
  closeMedia();
  if (els.dialog.open) els.dialog.close();
}

els.search.addEventListener("input", render);
els.filter.addEventListener("change", render);

els.exportBtn.addEventListener("click", () => {
  const safe = library.map(({ id, title, tag, notes, type, url, thumbUrl, fileName, size, createdAt }) => ({
    id, title, tag, notes, type, url, thumbUrl, fileName, size, createdAt,
  }));
  const blob = new Blob([JSON.stringify(safe, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "video-web-saver-library.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

els.importInput.addEventListener("change", async () => {
  const file = els.importInput.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error("bad format");
    const incoming = data
      .filter((item) => item && item.title)
      .map((item) => ({
        id: item.id || uid(),
        title: String(item.title).slice(0, 80),
        tag: String(item.tag || "").slice(0, 24),
        notes: String(item.notes || "").slice(0, 240),
        type: item.type === "file" ? "file" : "link",
        url: String(item.url || ""),
        thumbUrl: String(item.thumbUrl || ""),
        fileName: String(item.fileName || ""),
        size: Number(item.size) || 0,
        createdAt: item.createdAt || new Date().toISOString(),
      }));
    const existingIds = new Set(library.map((i) => i.id));
    incoming.forEach((item) => {
      if (!existingIds.has(item.id)) library.push(item);
    });
    saveMeta();
    render();
  } catch {
    alert("That file could not be imported.");
  } finally {
    els.importInput.value = "";
  }
});

render();

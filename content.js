let overlayE = null;
let captionEl = null;

console.log("[VT] content script loaded", location.href);

function findBestVideo() {
  const vids = Array.from(document.querySelectorAll("video"));
  if (!vids.length) return null;

  // choose biggest visible video
  let best = null;
  let bestScore = 0;

  for (const v of vids) {
    const r = v.getBoundingClientRect();
    const visible =
      r.width > 50 && r.height > 50 && r.bottom > 0 && r.right > 0;
    if (!visible) continue;
    const score = r.width * r.height;
    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }
  return best;
}

// function findOverlayAnchor(video) {
//   // Walk up a few levels to find a good container
//   let el = video;
//   for (let i = 0; i < 6 && el; i++) {
//     const parent = el.parentElement;
//     if (!parent) break;

//     const r = parent.getBoundingClientRect();
//     // Pick a parent that roughly matches video size
//     if (r.width >= 100 && r.height >= 100) return parent;
//     el = parent;
//   }
//   return video.parentElement || video;
// }

// function ensureOverlay(video) {
//   const anchor = findOverlayAnchor(video);
//   if (!anchor) return;

//   const style = window.getComputedStyle(anchor);
//   if (style.position === "static") {
//     anchor.style.position = "relative";
//   }

//   if (!overlayE) {
//     overlayE = document.createElement("div");
//     overlayE.className = "vt-overlay";

//     captionEl = document.createElement("div");
//     captionEl.className = "vt-caption";
//     captionEl.textContent = "";

//     overlayE.appendChild(captionEl);
//     anchor.appendChild(overlayE);
//   }
// }

function ensureOverlay(video) {
  // Attach overlay to a positioned parent so absolute works.
  const parent = video.parentElement;
  if (!parent) return;

  const style = window.getComputedStyle(parent);
  if (style.position === "static") {
    parent.style.position = "relative";
  }

  if (!overlayE) {
    overlayE = document.createElement("div");
    overlayE.className = "vt-overlay";

    captionEl = document.createElement("div");
    captionEl.className = "vt-caption";
    captionEl.textContent = "";

    overlayE.appendChild(captionEl);
    parent.appendChild(overlayE);
  }
}

function removeOverlay() {
  overlayE?.remove();
  overlayE = null;
  captionEl = null;
}

function setCaption(text) {
  if (!captionEl) return;
  captionEl.textContent = text || "";
  overlayE.style.display = text ? "flex" : "none";
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "SHOW_CAPTION") {
    const v = findBestVideo();
    if (!v) return;
    ensureOverlay(v);
    setCaption(msg.text);
  }

  if (msg?.type === "CLEAR_CAPTION") {
    setCaption("");
  }

  if (msg?.type === "STOP_OVERLAY") {
    removeOverlay();
  }
});

// Optional: auto-detect play events (useful later)
document.addEventListener(
  "play",
  (e) => {
    if (e.target?.tagName === "VIDEO") {
      // Could notify SW here if you want auto-start
      // chrome.runtime.sendMessage({ type: "VIDEO_PLAY" });
    }
  },
  true
);

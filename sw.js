let offscreenCreated = false;
let runningTabId = null; // only one capture at a time for MVP
let stopping = false;

async function ensureOffscreen() {
  if (offscreenCreated) return;
  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["USER_MEDIA"],
      justification: "Capture tab audio for transcription",
    });
  } catch {
    // already exists
  }
  offscreenCreated = true;
}

async function ensureInjected(tabId) {
  // Inject CSS + JS into the tab so it can receive messages
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["overlay.css"],
    });
  } catch (e) {
    //Ignore
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  } catch (e) {
    //Ignore
  }
}

async function safeSend(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (e) {
    try {
      await ensureInjected(tabId);
      await chrome.tabs.sendMessage(tabId, message);
    } catch (e2) {
      console.warn("[VT] Could not message tab.", e2);
      // best-effort: stop capture to avoid silently running
      if (runningTabId === tabId) {
        await chrome.runtime
          .sendMessage({ type: "OFFSCREEN_STOP" })
          .catch(() => {});
        runningTabId = null;
      }
    }
  }
}

async function startForTab(tabId) {
  // Don’t allow double start
  if (runningTabId === tabId) return;

  // If another tab is running, stop it first
  if (runningTabId !== null) {
    await stopForTab(runningTabId);
  }

  await ensureOffscreen();
  await ensureInjected(tabId);

  // Important: only call getMediaStreamId if we’re not already capturing
  const streamId = await chrome.tabCapture.getMediaStreamId({
    targetTabId: tabId,
  });
  await chrome.runtime.sendMessage({ type: "OFFSCREEN_START", streamId });

  runningTabId = tabId;
  await safeSend(tabId, {
    type: "SHOW_CAPTION",
    text: "✅ VT started (listening…)",
  });
}

async function stopForTab(tabId) {
  if (runningTabId !== tabId || stopping) return;
  stopping = true;

  runningTabId = null;
  await chrome.runtime.sendMessage({ type: "OFFSCREEN_STOP" }).catch(() => {});
  await safeSend(tabId, { type: "STOP_OVERLAY" });

  // cooldown (prevents active stream race)
  await new Promise((r) => setTimeout(r, 250));
  stopping = false;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type === "START") {
      await startForTab(msg.tabId);
      sendResponse({ ok: true });
      return;
    }

    if (msg?.type === "STOP") {
      await stopForTab(msg.tabId);
      sendResponse({ ok: true });
      return;
    }

    if (msg?.type === "AUDIO_CHUNK") {
      if (runningTabId !== null) {
        await safeSend(runningTabId, {
          type: "SHOW_CAPTION",
          text: `Listening… (${Math.round(msg.byteLength / 1024)} KB chunk)`,
        });
      }
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "DEBUG") {
      if (runningTabId !== null) {
        await safeSend(runningTabId, { type: "SHOW_CAPTION", text: msg.text });
      }
      sendResponse({ ok: true });
      return;
    }

    if (msg?.type === "LANG_DETECTED") {
      if (runningTabId !== null) {
        const conf = (msg.confidence ?? 0).toFixed(2);
        await safeSend(runningTabId, {
          type: "SHOW_CAPTION",
          text: `Language: ${msg.language} (${conf})`,
        });
      }
      sendResponse({ ok: true });
      return;
    }

    if (msg?.type === "LANG_ERROR") {
      if (runningTabId !== null) {
        await safeSend(runningTabId, {
          type: "SHOW_CAPTION",
          text: `Lang detect error: ${msg.error}`,
        });
      }
      sendResponse({ ok: true });
      return;
    }
  })();

  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === runningTabId) stopForTab(tabId);
});

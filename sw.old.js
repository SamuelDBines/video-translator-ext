let offscreenCreated = false;
let isRunningByTab = new Map();

async function ensureOffscreen() {
  if (offscreenCreated) return;
  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["USER_MEDIA"],
      justification: "Capture tab audio for transcription",
    });
  } catch (e) {
    // likely already exists
    console.error("[Error]: ", e);
  }

  offscreenCreated = true;
}

async function startForTab(tabId) {
  console.log("[VT] sending caption to tab", tabId);
  await ensureOffscreen();

  // Get a stream id for tab capture
  const streamId = await chrome.tabCapture.getMediaStreamId({
    targetTabId: tabId,
  });

  // Tell offscreen to start recording
  await chrome.runtime.sendMessage({ type: "OFFSCREEN_START", streamId });

  isRunningByTab.set(tabId, true);

  // show overlay “listening”
  await chrome.tabs.sendMessage(tabId, {
    type: "SHOW_CAPTION",
    text: "Listening…",
  });
}

async function stopForTab(tabId) {
  isRunningByTab.delete(tabId);

  await chrome.runtime.sendMessage({ type: "OFFSCREEN_STOP" }).catch(() => {});
  await chrome.tabs
    .sendMessage(tabId, { type: "STOP_OVERLAY" })
    .catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === "START") {
      await startForTab(msg.tabId);
      sendResponse({ ok: true });
    }

    if (msg?.type === "STOP") {
      await stopForTab(msg.tabId);
      sendResponse({ ok: true });
    }

    if (msg?.type === "AUDIO_CHUNK") {
      const tabs = Array.from(isRunningByTab.keys());
      for (const tabId of tabs) {
        await chrome.tabs
          .sendMessage(tabId, {
            type: "SHOW_CAPTION",
            text: `Listening… (${Math.round(msg.byteLength / 1024)} KB chunk)`,
          })
          .catch(() => {});
      }
      sendResponse({ ok: true });
    }
  })().catch((err) => console.error("[Error]: ", err));

  return true; // async response
});

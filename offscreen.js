let mediaStream = null;
let recorder = null;
let running = false;

let chunks = [];
let secondsRecorded = 0;
const SLICE_MS = 3000; // 3s per chunk
const TARGET_SECONDS = 15; // send ~15s

async function uploadToServer(blob) {
  const form = new FormData();
  form.append("audio", blob, "sample.webm");

  const r = await fetch("http://localhost:4000/api/detect-language", {
    method: "POST",
    body: form,
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Server error ${r.status}: ${t}`);
  }
  return r.json();
}

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg?.type === "OFFSCREEN_START") {
    if (running) return;
    running = true;

    chunks = [];
    secondsRecorded = 0;

    const { streamId } = msg;

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
    });

    recorder = new MediaRecorder(mediaStream, { mimeType: "audio/webm" });

    recorder.ondataavailable = async (e) => {
      if (!running) return;
      if (!e.data || e.data.size === 0) return;

      chunks.push(e.data);
      secondsRecorded += SLICE_MS / 1000;

      chrome.runtime.sendMessage({
        type: "DEBUG",
        text: `Recorded ${Math.round(secondsRecorded)}s...`,
      });

      if (secondsRecorded >= TARGET_SECONDS) {
        // Stop recording further; create a single blob
        try {
          const blob = new Blob(chunks, { type: "audio/webm" });
          const result = await uploadToServer(blob);

          chrome.runtime.sendMessage({
            type: "LANG_DETECTED",
            language: result.language,
            confidence: result.confidence,
          });
        } catch (err) {
          chrome.runtime.sendMessage({
            type: "LANG_ERROR",
            error: String(err),
          });
        }
      }
    };

    recorder.start(SLICE_MS);
  }

  if (msg?.type === "OFFSCREEN_STOP") {
    running = false;

    try {
      recorder?.stop();
    } catch {}
    recorder = null;

    try {
      mediaStream?.getTracks()?.forEach((t) => t.stop());
    } catch {}
    mediaStream = null;

    chunks = [];
    secondsRecorded = 0;
  }
});

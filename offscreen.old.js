let mediaStream = null;
let recorder = null;
let running = false;

function blobToArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result);
    reader.readAsArrayBuffer(blob);
  });
}

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg?.type === "OFFSCREEN_START") {
    console.log("[VT] offscreen got start");
    if (running) return;
    running = true;

    // Get tab-capture streamId from service worker
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
      if (!e.data || e.data.size === 0) return;

      // In v1 we’re not doing ASR yet.
      // This proves we’re receiving audio chunks.
      const buf = await blobToArrayBuffer(e.data);

      chrome.runtime.sendMessage({
        type: "AUDIO_CHUNK",
        byteLength: buf.byteLength,
      });
    };

    recorder.start(2000); // 2s chunks
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
  }
});

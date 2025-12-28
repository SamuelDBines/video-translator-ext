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
    if (running) return; // <- prevents “active stream” issues
    running = true;

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
      console.log("[DATA], ", e?.data);
      if (!e.data || e.data.size === 0) return;
      const buf = await blobToArrayBuffer(e.data);
      chrome.runtime.sendMessage({
        type: "AUDIO_CHUNK",
        byteLength: buf.byteLength,
      });
    };

    recorder.start(2000);
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

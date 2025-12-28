const statusEl = document.getElementById("status");
const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");

function setStatus(msg) {
  statusEl.textContent = msg;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab");
  return tab;
}

startBtn.addEventListener("click", async () => {
  try {
    const tab = await getActiveTab();
    setStatus("Starting...");
    await chrome.runtime.sendMessage({ type: "START", tabId: tab.id });
    setStatus("Running");
  } catch (e) {
    setStatus(`Error: ${e.message}`);
  }
});

stopBtn.addEventListener("click", async () => {
  try {
    const tab = await getActiveTab();
    setStatus("Stopping...");
    await chrome.runtime.sendMessage({ type: "STOP", tabId: tab.id });
    setStatus("Idle");
  } catch (e) {
    setStatus(`Error: ${e.message}`);
  }
});

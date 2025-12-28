import express from "express";
import cors from "cors";
import multer from "multer";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const app = express();
app.use(cors({ origin: true })); // dev-friendly
const upload = multer({ dest: os.tmpdir() });

function run(cmd, args, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";

    const t = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error(`Timeout running ${cmd}`));
    }, timeoutMs);

    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));

    p.on("close", (code) => {
      clearTimeout(t);
      if (code === 0) resolve({ out, err });
      else reject(new Error(`${cmd} failed (${code}): ${err || out}`));
    });
  });
}

app.post("/api/detect-language", upload.single("audio"), async (req, res) => {
  const inputPath = req.file?.path;
  if (!inputPath) return res.status(400).json({ error: "Missing audio file" });

  const wavPath = path.join(
    os.tmpdir(),
    `vt-${Date.now()}-${Math.random().toString(16).slice(2)}.wav`
  );

  try {
    // Normalize to 16k mono wav (good for language detect / whisper)
    await run("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-ac",
      "1",
      "-ar",
      "16000",
      "-vn",
      wavPath,
    ]);

    // Call python detector
    const py = spawn(
      "python3",
      [path.resolve("./detect_language.py"), wavPath],
      {
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let out = "";
    let err = "";
    py.stdout.on("data", (d) => (out += d.toString()));
    py.stderr.on("data", (d) => (err += d.toString()));

    py.on("close", async (code) => {
      // cleanup temp files
      await fs.unlink(inputPath).catch(() => {});
      await fs.unlink(wavPath).catch(() => {});

      if (code !== 0) {
        return res.status(500).json({ error: err || "Python failed" });
      }

      try {
        const json = JSON.parse(out);
        res.json(json);
      } catch {
        res.status(500).json({ error: "Bad JSON from python", raw: out });
      }
    });
  } catch (e) {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(wavPath).catch(() => {});
    res.status(500).json({ error: e.message });
  }
});

app.listen(4000, () => {
  console.log("Server listening on http://localhost:4000");
});

import json
import sys
from faster_whisper import WhisperModel

# Use a small model to keep it cheap/fast.
# Options: "tiny", "base", "small"
MODEL_SIZE = "tiny"

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing wav path"}))
        sys.exit(1)

    wav_path = sys.argv[1]

    # CPU inference by default
    model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")

    # We only need a short sample for language detection
    # but faster-whisper detects language during transcription.
    # We'll transcribe a small chunk and read info.
    segments, info = model.transcribe(
        wav_path,
        task="transcribe",
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
        beam_size=1
    )

    # Consume a few segments to trigger work (not strictly needed but safe)
    _ = []
    for i, seg in enumerate(segments):
        _.append(seg.text)
        if i >= 1:
            break

    result = {
        "language": info.language,
        "confidence": float(info.language_probability)
    }

    print(json.dumps(result))

if __name__ == "__main__":
    main()

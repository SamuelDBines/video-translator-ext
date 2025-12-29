import json
import sys
from faster_whisper import WhisperModel

MODEL_SIZE = "tiny"

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing wav path"}))
        sys.exit(1)

    wav_path = sys.argv[1]

    # CPU inference by default
    model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")

    segments, info = model.transcribe(
        wav_path,
        task="transcribe",
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
        beam_size=1
    )

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

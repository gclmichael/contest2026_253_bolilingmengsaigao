import argparse
import base64
import json
import os
import time
import urllib.error
import urllib.request
import wave
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "docs" / "video" / "narration.json"
DEFAULT_OUTPUT = ROOT / "docs" / "video" / "audio"


def request_audio(base_url, api_key, model, voice, style, text, retries=3):
    payload = {
        "model": model,
        "messages": [
            {"role": "user", "content": style},
            {"role": "assistant", "content": text},
        ],
        "audio": {"format": "wav", "voice": voice},
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        base_url.rstrip("/") + "/chat/completions",
        data=body,
        headers={
            "Authorization": "Bearer " + api_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                result = json.loads(response.read().decode("utf-8"))
            message = result["choices"][0]["message"]
            audio = message.get("audio") or {}
            return base64.b64decode(audio["data"]), result.get("usage", {})
        except (urllib.error.URLError, urllib.error.HTTPError, KeyError, ValueError) as error:
            if attempt == retries:
                raise RuntimeError(f"TTS request failed after {retries} attempts: {error}") from error
            time.sleep(attempt * 2)


def wav_info(path):
    with wave.open(str(path), "rb") as source:
        frames = source.getnframes()
        rate = source.getframerate()
        return {
            "channels": source.getnchannels(),
            "sample_width": source.getsampwidth(),
            "sample_rate": rate,
            "frames": frames,
            "duration_seconds": round(frames / rate, 3),
        }


def join_wavs(paths, output, silence_seconds=0.45):
    parameters = None
    chunks = []
    for path in paths:
        with wave.open(str(path), "rb") as source:
            current = (
                source.getnchannels(),
                source.getsampwidth(),
                source.getframerate(),
                source.getcomptype(),
            )
            if parameters is None:
                parameters = current
            elif current != parameters:
                raise RuntimeError(f"WAV format mismatch: {path}")
            chunks.append(source.readframes(source.getnframes()))

    channels, sample_width, sample_rate, _ = parameters
    silence = b"\x00" * int(silence_seconds * sample_rate) * channels * sample_width
    with wave.open(str(output), "wb") as target:
        target.setnchannels(channels)
        target.setsampwidth(sample_width)
        target.setframerate(sample_rate)
        for index, chunk in enumerate(chunks):
            if index:
                target.writeframes(silence)
            target.writeframes(chunk)


def main():
    parser = argparse.ArgumentParser(description="Generate FocusLoop narration with MiMo-V2.5-TTS.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--base-url", default="https://token-plan-cn.xiaomimimo.com/v1")
    parser.add_argument("--model", default="mimo-v2.5-tts")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    api_key = os.environ.get("MIMO_API_KEY")
    if not api_key:
        raise SystemExit("MIMO_API_KEY is required")

    config = json.loads(args.input.read_text(encoding="utf-8"))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    manifest = {
        "model": args.model,
        "voice": config["voice"],
        "base_url": args.base_url,
        "segments": [],
    }
    for index, segment in enumerate(config["segments"], start=1):
        output = args.output_dir / f"{segment['id']}.wav"
        usage = {}
        if args.force or not output.exists():
            audio_bytes, usage = request_audio(
                args.base_url,
                api_key,
                args.model,
                config["voice"],
                config["style"],
                segment["text"],
            )
            output.write_bytes(audio_bytes)
        info = wav_info(output)
        paths.append(output)
        manifest["segments"].append({
            "index": index,
            "id": segment["id"],
            "title": segment["title"],
            "file": output.name,
            **info,
            "usage": usage,
        })
        print(f"{segment['id']}: {info['duration_seconds']:.2f}s")

    combined = args.output_dir.parent / "FocusLoop_讲解.wav"
    join_wavs(paths, combined)
    combined_info = wav_info(combined)
    manifest["combined"] = {"file": combined.name, **combined_info}
    manifest_path = args.output_dir.parent / "narration_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"combined: {combined_info['duration_seconds']:.2f}s -> {combined}")


if __name__ == "__main__":
    main()

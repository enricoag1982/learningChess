#!/usr/bin/env python3
"""
Generates pre-recorded Kokoro audio (docs/voice.md) for every text in
packages/content/dist/voice-texts.json, writing apps/web/public/audio/en/<key>.mp3 plus
apps/web/public/audio/en/manifest.json (`{ config, entries: { <key>: { text, ms } } }`).

Incremental: reuses an existing mp3 when its key is already in the manifest, the manifest's
`config` still matches tools/voice/config.json exactly, and the file exists on disk. A config
change regenerates every file (one shared config for the whole manifest, not per entry). Removes
any apps/web/public/audio/en/*.mp3 whose key is no longer in voice-texts.json, or that was left
over from a different config.

Usage:
    python3 generate.py                       # generate everything missing
    python3 generate.py --limit 20             # quick sample (first 20 missing keys)
    python3 generate.py --model-dir /some/dir  # reuse already-downloaded model files

Model files (kokoro-v1.0.int8.onnx, voices-v1.0.bin) are read from --model-dir (or the
$KOKORO_MODEL_DIR env var), default tools/voice/.cache/ (gitignored) — downloaded there
automatically from the thewh1teagle/kokoro-onnx `model-files-v1.0` GitHub release if missing
(huggingface.co, where Kokoro is normally published, is blocked in some environments; this
release mirrors the same two files). See docs/voice.md.
"""

import argparse
import json
import os
import time
import urllib.request
from pathlib import Path

# Capped before onnxruntime/kokoro_onnx are imported (deferred, below): a shared 4-core dev
# machine (CLAUDE.md) should not have one generation run claim every core. Belt-and-braces with
# `capped_kokoro`'s SessionOptions patch, which is what actually governs onnxruntime's own thread
# pool regardless of this env var's effect on any OpenMP-linked op underneath it.
os.environ.setdefault("OMP_NUM_THREADS", "2")

TOOLS_DIR = Path(__file__).resolve().parent
REPO_ROOT = TOOLS_DIR.parent.parent
DEFAULT_MODEL_DIR = TOOLS_DIR / ".cache"
DEFAULT_VOICE_TEXTS = REPO_ROOT / "packages" / "content" / "dist" / "voice-texts.json"
DEFAULT_OUT_DIR = REPO_ROOT / "apps" / "web" / "public" / "audio" / "en"
CONFIG_PATH = TOOLS_DIR / "config.json"

MODEL_RELEASE_BASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"


def load_config() -> dict:
    with open(CONFIG_PATH, encoding="utf8") as f:
        return json.load(f)


def ensure_model_files(model_dir: Path, config: dict) -> tuple[Path, Path]:
    """Downloads the two Kokoro model files into `model_dir` if not already there."""
    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_dir / config["model"]
    voices_path = model_dir / config["voicesFile"]
    for path in (model_path, voices_path):
        if path.exists():
            continue
        url = f"{MODEL_RELEASE_BASE}/{path.name}"
        print(f"generate: downloading {url} -> {path}")
        try:
            urllib.request.urlretrieve(url, path)
        except Exception as error:  # noqa: BLE001 - one clear message covers every failure mode
            raise SystemExit(
                f"generate: could not download {url} ({error}). Place the file at {path} "
                "manually (see docs/voice.md) and re-run, or pass --model-dir to an existing copy."
            ) from error
    return model_path, voices_path


def capped_kokoro(model_path: Path, voices_path: Path, threads: int):
    """Builds a `Kokoro` instance whose onnxruntime session's thread pool is capped to `threads`.

    `kokoro_onnx` does not expose this itself, so its `session.create_session` (the one call that
    builds the `onnxruntime.InferenceSession`) is patched for the duration of this one call only.
    """
    import onnxruntime as rt
    from kokoro_onnx import Kokoro
    from kokoro_onnx import session as kokoro_session

    def capped_create_session(path: str) -> rt.InferenceSession:
        providers = kokoro_session.resolve_providers()
        options = rt.SessionOptions()
        options.intra_op_num_threads = threads
        options.inter_op_num_threads = threads
        return rt.InferenceSession(path, sess_options=options, providers=providers)

    original_create_session = kokoro_session.create_session
    kokoro_session.create_session = capped_create_session
    try:
        return Kokoro(str(model_path), str(voices_path))
    finally:
        kokoro_session.create_session = original_create_session


def encode_mp3(samples, sample_rate: int, kbps: int, quality: int) -> bytes:
    import lameenc
    import numpy as np

    encoder = lameenc.Encoder()
    encoder.set_bit_rate(kbps)
    encoder.set_in_sample_rate(sample_rate)
    encoder.set_channels(1)
    encoder.set_quality(quality)
    pcm = (np.clip(samples, -1, 1) * 32767).astype(np.int16).tobytes()
    return encoder.encode(pcm) + encoder.flush()


def load_manifest(out_dir: Path) -> dict:
    manifest_path = out_dir / "manifest.json"
    if not manifest_path.exists():
        return {"config": None, "entries": {}}
    with open(manifest_path, encoding="utf8") as f:
        return json.load(f)


def write_manifest(out_dir: Path, config: dict, entries: dict) -> None:
    with open(out_dir / "manifest.json", "w", encoding="utf8") as f:
        json.dump({"config": config, "entries": entries}, f)


def report(out_dir: Path, entries: dict) -> None:
    total_bytes = sum(
        (out_dir / f"{key}.mp3").stat().st_size
        for key in entries
        if (out_dir / f"{key}.mp3").exists()
    )
    total_ms = sum(value["ms"] for value in entries.values())
    print(
        f"generate: {len(entries)} file(s), "
        f"{total_bytes / 1024 / 1024:.1f} MB, "
        f"{total_ms / 1000 / 60:.1f} min"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--limit", type=int, default=None, help="generate at most N missing entries (quick sample)")
    parser.add_argument(
        "--model-dir",
        type=Path,
        default=Path(os.environ.get("KOKORO_MODEL_DIR", str(DEFAULT_MODEL_DIR))),
        help="directory holding kokoro-v1.0.int8.onnx / voices-v1.0.bin (downloaded here if missing)",
    )
    parser.add_argument("--voice-texts", type=Path, default=DEFAULT_VOICE_TEXTS)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    parser.add_argument("--threads", type=int, default=2, help="onnxruntime intra/inter-op thread cap")
    args = parser.parse_args()

    config = load_config()

    if not args.voice_texts.exists():
        raise SystemExit(
            f"generate: {args.voice_texts} not found — run "
            "`pnpm --filter @chess-kids/content voice-texts` first."
        )
    with open(args.voice_texts, encoding="utf8") as f:
        inventory = json.load(f)
    texts_by_key = {entry["key"]: entry["text"] for entry in inventory}

    args.out_dir.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest(args.out_dir)
    config_matches = manifest.get("config") == config
    if not config_matches and manifest.get("entries"):
        print("generate: config.json changed since the last run — regenerating every file")
    entries: dict = dict(manifest.get("entries", {})) if config_matches else {}

    # Prune: a stale file whose key is no longer inventoried, or left over from a different config.
    for path in sorted(args.out_dir.glob("*.mp3")):
        if path.stem not in texts_by_key or path.stem not in entries:
            path.unlink()
    entries = {key: value for key, value in entries.items() if key in texts_by_key}

    missing = [
        key
        for key in texts_by_key
        if key not in entries or not (args.out_dir / f"{key}.mp3").exists()
    ]
    if args.limit is not None:
        missing = missing[: args.limit]

    print(f"generate: {len(texts_by_key)} text(s) in inventory, {len(missing)} to generate")
    if not missing:
        write_manifest(args.out_dir, config, entries)
        report(args.out_dir, entries)
        return

    model_path, voices_path = ensure_model_files(args.model_dir, config)
    kokoro = capped_kokoro(model_path, voices_path, args.threads)

    started = time.time()
    for i, key in enumerate(missing, start=1):
        text = texts_by_key[key]
        t0 = time.time()
        samples, sample_rate = kokoro.create(
            text, voice=config["voice"], speed=config["speed"], lang=config["lang"]
        )
        mp3_bytes = encode_mp3(samples, sample_rate, config["mp3BitrateKbps"], config["mp3Quality"])
        (args.out_dir / f"{key}.mp3").write_bytes(mp3_bytes)
        ms = round(len(samples) / sample_rate * 1000)
        entries[key] = {"text": text, "ms": ms}
        write_manifest(args.out_dir, config, entries)  # after every file: crash-safe / resumable
        if i % 25 == 0 or i == len(missing):
            elapsed = time.time() - t0
            print(
                f"generate: {i}/{len(missing)} "
                f"({elapsed:.1f}s last, {time.time() - started:.0f}s total)"
            )

    report(args.out_dir, entries)


if __name__ == "__main__":
    main()

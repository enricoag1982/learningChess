# Voice — Chess for Kids

Related: [architecture.md](architecture.md) §Narration, [non-functional.md](non-functional.md) §1–2.

## 1. What is generated

Pre-recorded neural audio (Kokoro-82M, voice `af_heart`) for every kid-facing narrated string:
lesson story/demo/guided/exercise/variant text, mini-game goals, series-round instructions, every
`narrator.speak`/`useNarratedText` UI "owl line" (Home/Journey/Play/Assessment/Placement/
Celebration/Den), expanded over each template's bounded, content-derived variable domain.
Parent-area/password/backup/privacy text is never narrated, so never generated. Size budget: ≤ 25 MB
English (`non-functional.md` §1's ≤ 50 MB/language envelope) — `generate.py` prints the actual total.

| Output | Path |
|---|---|
| Inventory (build input) | `packages/content/dist/voice-texts.json` (gitignored) |
| Audio | `apps/web/public/audio/en/<key>.mp3` (committed) |
| Manifest | `apps/web/public/audio/en/manifest.json` (`{ config, entries: { <key>: { text, ms } } }`, committed) |

`key` = first 16 hex of `sha256(normalizeVoiceText(text))` (`packages/core/src/domain/voice-text.ts`).

## 2. Config

`tools/voice/config.json`: engine `kokoro-onnx`, model files, `voice: af_heart`, `lang: en-us`,
`speed: 0.92`, MP3 mono 32 kbps (`lameenc` quality 2). Manifest records the config used; a config
change regenerates every file (one shared config for the whole manifest).

## 3. Regenerate

```sh
pnpm --filter @chess-kids/content voice-texts   # dist/voice-texts.json + report
python3 tools/voice/generate.py                 # public/audio/en/*.mp3 + manifest.json
python3 tools/voice/generate.py --limit 20       # quick sample
```

Needs `tools/voice/requirements.txt` (venv) + Kokoro's `kokoro-v1.0.int8.onnx`/`voices-v1.0.bin`
(`thewh1teagle/kokoro-onnx` `model-files-v1.0` GitHub release — huggingface.co is blocked in some
environments). `--model-dir DIR`/`$KOKORO_MODEL_DIR` reuses a downloaded copy; else downloads into
gitignored `tools/voice/.cache/`. Incremental: skips a key already generated under the same config,
prunes files no longer inventoried. Threads capped to 2 (`--threads`); full run, 4-core machine:
roughly 1–2 h.

**Adding a language:** (1) `packages/content/locales/<lang>/`, same keys as `en`. (2)
`tools/voice/config.json` → that language's Kokoro voice/`lang`. (3) commands above, output to
`apps/web/public/audio/<lang>/` — `createAudioNarrator` takes `baseUrl` per language, so a 2nd
language is a 2nd narrator instance.

## 4. Fallback rules

Per call (never the whole session), `audio-narrator.ts` falls back to Web Speech (device voice)
when: no manifest entry for the key; manifest missing/unreachable/malformed; no `AudioContext`; mp3
fetch/`decodeAudioData` fails; or a `suspended` `AudioContext` (iOS pre-gesture) whose `resume()`
fails. A newer `speak`/`cancel` invalidates any in-flight fetch/decode.

## 5. Nickname rule

Never in generated audio. `speak(text)` looks up `stripNickname(text, nickname)` (name + one
adjacent `, `/` ,`/space, word-boundary safe); `setNickname` wired wherever the active profile is
set. A miss still passes the *original* text to the fallback (Web Speech has no such limit;
subtitles already show the name). `packages/content`'s inventory applies the same rule to templates.

# Voice — Chess for Kids

Related: [architecture.md](architecture.md) §Narration, [non-functional.md](non-functional.md) §1–2.

## 1. What is generated

Pre-recorded neural audio (Kokoro-82M, voice `af_heart`) for every kid-facing narrated string:
lesson story/demo/guided/exercise/variant text, every exercise feedback note (§5), mini-game goals,
series-round instructions, every `narrator.speak`/`useNarratedText` UI "owl line", expanded over
each template's bounded, content-derived variable domain. Parent-area/password/backup/privacy text
is never narrated. Size budget: ≤ 25 MB English (`non-functional.md` §1's ≤ 50 MB/language envelope).

| Output | Path |
|---|---|
| Inventory (build input) | `packages/content/dist/voice-texts.json` (gitignored) |
| Audio | `apps/web/public/audio/en/<key>.mp3` (committed) |
| Manifest | `apps/web/public/audio/en/manifest.json` (`{ config, entries: { <key>: { text, ms } } }`, committed) |

`key` = first 16 hex of `sha256(normalizeVoiceText(text))` (`packages/core/src/domain/voice-text.ts`).

## 2. Config

`tools/voice/config.json`: engine `kokoro-onnx`, model files, `voice: af_heart`, `lang: en-us`,
`speed: 0.92`, MP3 mono 32 kbps (`lameenc` quality 2). A config change regenerates every file.

## 3. Regenerate

```sh
pnpm --filter @chess-kids/content voice-texts   # dist/voice-texts.json + report
python3 tools/voice/generate.py                 # public/audio/en/*.mp3 + manifest.json (--limit N for a sample)
pnpm voice:generate                             # root wrapper: both commands above, in order
pnpm voice:check                                # CI "Voice coverage" step: inventory vs. manifest
```

Needs `tools/voice/requirements.txt` (venv) + Kokoro's `kokoro-v1.0.int8.onnx`/`voices-v1.0.bin`
(`thewh1teagle/kokoro-onnx` `model-files-v1.0` GitHub release; `--model-dir DIR`/`$KOKORO_MODEL_DIR`
reuses a downloaded copy, else downloads into gitignored `tools/voice/.cache/`). Incremental: skips
a key already generated under the same config, prunes files no longer inventoried. Threads capped
to 2 (`--threads`); full run, 4-core machine: roughly 1–2 h. `voice:check` fails (names the missing
texts) on any inventory key without audio, warns (does not fail) on an orphan manifest entry.

**Adding a language:** `packages/content/locales/<lang>/` (same keys as `en`) + that language's
Kokoro voice/`lang` in `config.json` → commands above, output to `apps/web/public/audio/<lang>/`
(`createAudioNarrator` takes `baseUrl` per language).

## 4. Fallback rules

Per call (never the whole session), `audio-narrator.ts` falls back to Web Speech (device voice)
when: no manifest entry for the key; manifest missing/unreachable/malformed; no `AudioContext`; mp3
fetch/`decodeAudioData` fails; or a `suspended` `AudioContext` whose `resume()` doesn't settle to
`'running'` within 300 ms for that call. A newer `speak`/`cancel` invalidates any in-flight
fetch/decode; `lastOutcome()` reports which case happened last (§6). iOS only truly unlocks it
inside `touchend`/`click`: the unlock listener covers all four gesture types, kept until running.

## 5. Sequence

An exercise's instruction and its feedback note (hint/error/praise/…) are spoken as two separate
utterances (`speakSequence`, `apps/web/src/ui/`), not one concatenated string. A newer sequence (or
an explicit cancel) stops it before its next text starts; replay buttons replay it from the top.

## 6. Missed-text report and Test voice

`localStorage['chess-kids:voice-report'] = '1'` makes the narrator record every text that fell back
for a content reason (manifest miss / decode failure) into `window.__chessKidsVoiceMisses` — off by
default, no cost otherwise. The e2e a11y curriculum walk sets it, asserts the list is empty
(chromium project only). Parent area → child Settings → Voice → "Test voice" speaks one fixed
sentence, showing "Recorded voice ✓" or the fallback reason (`ChildSettings.tsx`/`Services.testVoice`).

## 7. Offline size

`apps/web/scripts/check-size.ts` (`pnpm size`) also sums every file the built service worker
precaches (parsed from `dist/sw.js`'s `precacheAndRoute([...])`), fails above 50 MB
(`non-functional.md` §1); the `audio/en/*` slice is reported separately.

## 8. Nickname rule

Never in generated audio. `speak(text)` looks up `stripNickname(text, nickname)` (name + one
adjacent `, `/` ,`/space, word-boundary safe); `setNickname` wired wherever the active profile is
set. A miss still passes the *original* text to the fallback (Web Speech has no such limit;
subtitles already show the name). `packages/content`'s inventory applies the same rule to templates.

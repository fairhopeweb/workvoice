# WorkVoice

Private, on-device voice notes — now a **Expo / React Native** app with a futuristic
neumorphic UI, running on iOS, Android, and the web from one codebase. An original
re-implementation inspired by the NotelyVoice concept.

## Features
- Dashboard landing view: greeting, live stats, quick actions, recent notes
- Dictation sheet with animated level meter, timer, and live transcript
  - **Web**: real speech-to-text via the Web Speech API + audio capture (`expo-audio`)
  - **Expo Go (native)**: audio recording + clearly-labeled simulated transcript
    (real native STT requires a dev build with a speech-recognition module — see below)
- Notes with search, filters (All / Starred / Voice / Recent), starring, word counts
- Audio playback on voice notes, dark/light neumorphic themes
- "Install on iOS" guided flow (web target)

## Run it
```bash
npm install
npm start          # Expo dev server → scan QR with Expo Go (iOS/Android)
npm run web        # web target in the browser
npm run build:web  # static web export → dist/ (what Vercel deploys)
```

## Deployment
Vercel builds the web target on every push to `main`:
`npx expo export -p web` → `dist/` (see `vercel.json`).

## UI tests (Stagehand)
AI-driven browser tests live in `tests/ui.test.ts`, using
[Stagehand](https://stagehand.dev) `act()` / `extract()` primitives with Zod-schema
assertions, so the suite verifies *behavior* and survives markup changes. Covered:
dashboard render + stats, Install-on-iOS modal, search & filters, note creation,
the full dictation flow, and theme toggling.

```bash
npm run build:web && npm run serve:web   # terminal 1
ANTHROPIC_API_KEY=sk-ant-... npm run test:ui   # terminal 2
# or point at production:
BASE_URL=https://<your-vercel-domain> ANTHROPIC_API_KEY=... npm run test:ui
```

CI: `.github/workflows/ui-tests.yml` runs the suite on every push/PR
(local headless Chromium). **Requires the `ANTHROPIC_API_KEY` repository secret.**

## Native speech-to-text (optional upgrade)
Expo Go can't load custom native modules, so on-device STT needs a development build:
add `expo-speech-recognition`, run `npx expo prebuild` + `npx expo run:ios`, and swap
the simulation branch in `App.tsx` for the module's recognizer.

## Layout
- `App.tsx` — app shell, views, recording flow
- `src/theme.ts` — neumorphic design tokens (cross-platform `boxShadow`)
- `src/data.ts` — note model + seeds
- `tests/ui.test.ts` — Stagehand suite
- `legacy-web/` — the previous hand-rolled static PWA, kept for reference

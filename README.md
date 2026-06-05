# WorkVoice

Private, on-device voice transcription and note-taking — a browser-based demo
inspired by the NotelyVoice concept (original re-implementation).

- Dashboard landing view with stats, quick actions, and recent notes
- Dictation via Web Speech API with live transcript + waveform (MediaRecorder audio playback)
- Rich text notes, search, filters, starring, dark/light themes
- Installable PWA (manifest + service worker); on iOS: Safari → Share → Add to Home Screen

## Stack
Static single-page app — no build step, no server, no API keys.

## Deploy
Deployed on Vercel as a static project. `vercel.json` sets service-worker and
microphone permission headers.

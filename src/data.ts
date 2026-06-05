export interface Note {
  id: number;
  title: string;
  body: string;
  tag: string;
  starred: boolean;
  hasAudio: boolean;
  audioUri: string | null;
  audioLen: string | null;
  created: number;
  updated: number;
}

const now = Date.now();
const D = 86400e3, H = 3600e3;

export const SEED: Note[] = [
  {
    id: 1, title: 'Sprint 24 standup recap', tag: 'work', starred: true,
    hasAudio: false, audioUri: null, audioLen: null,
    created: now - D, updated: now - 2 * H,
    body: 'BLOCKERS\nCI runner queue is backed up — infra is adding two more agents this week.\n\nDECISIONS\nShip the export feature behind a flag on Friday and hold the schema migration until Monday.',
  },
  {
    id: 2, title: 'Client call — Meridian onboarding', tag: 'voice', starred: false,
    hasAudio: true, audioUri: null, audioLen: 'voice memo',
    created: now - 2 * D, updated: now - 2 * D,
    body: '🎙 VOICE TRANSCRIPT\nThey want single sign-on before the pilot expands past fifty seats. Procurement review starts the second week of the month, so the security questionnaire needs to go out before then.\n\nFollow-up: send SSO docs + SOC 2 letter.',
  },
  {
    id: 3, title: 'Ideas parking lot', tag: 'personal', starred: false,
    hasAudio: false, audioUri: null, audioLen: null,
    created: now - 6 * D, updated: now - 5 * D,
    body: 'Voice-first changelog dictation. Auto-summarize long transcripts into action items. Keyboard shortcut to drop a timestamp marker mid-recording.',
  },
];

export const SIM_WORDS = (
  'Quick note from the demo recorder. Action items for this week: confirm the staging deploy, ' +
  'send the onboarding checklist to the new contractor, and review the open pull requests before Friday. ' +
  'Also remember to follow up on the invoice that went out Monday.'
).split(' ');

export const fmtDate = (t: number) =>
  new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// WorkVoice theme — futuristic neumorphism
export type ThemeName = 'dark' | 'light';

export interface Theme {
  name: ThemeName;
  bg: string; panel: string; panelUp: string;
  ink: string; ink2: string; ink3: string;
  accent: string; accentDim: string; accentInk: string;
  rec: string; ok: string;
  shD: string; shL: string;
  raise: string; raiseSm: string; raiseXs: string;
  inset: string; insetSm: string;
  glow: string; glowSoft: string;
}

export const DARK: Theme = {
  name: 'dark',
  bg: '#171c23', panel: '#1a2028', panelUp: '#1d242d',
  ink: '#dfe8f0', ink2: '#8b98a6', ink3: '#54616f',
  accent: '#2de2ff', accentDim: '#149db8', accentInk: '#04222b',
  rec: '#ff4d6d', ok: '#3deca5',
  shD: '#0c0f13', shL: '#242d38',
  raise: '7px 7px 14px #0c0f13, -7px -7px 14px #242d38',
  raiseSm: '4px 4px 9px #0c0f13, -4px -4px 9px #242d38',
  raiseXs: '2px 2px 5px #0c0f13, -2px -2px 5px #242d38',
  inset: 'inset 5px 5px 10px #0c0f13, inset -5px -5px 10px #242d38',
  insetSm: 'inset 3px 3px 6px #0c0f13, inset -3px -3px 6px #242d38',
  glow: '0 0 16px rgba(45,226,255,0.35)',
  glowSoft: '0 0 22px rgba(45,226,255,0.14)',
};

export const LIGHT: Theme = {
  name: 'light',
  bg: '#e3e9f1', panel: '#e7edf4', panelUp: '#eef3f9',
  ink: '#2a3340', ink2: '#5e6b7a', ink3: '#94a1b0',
  accent: '#089cc4', accentDim: '#0b7e9e', accentInk: '#f2fcff',
  rec: '#e63757', ok: '#0e9f6e',
  shD: '#bac4d1', shL: '#ffffff',
  raise: '7px 7px 14px #bac4d1, -7px -7px 14px #ffffff',
  raiseSm: '4px 4px 9px #bac4d1, -4px -4px 9px #ffffff',
  raiseXs: '2px 2px 5px #bac4d1, -2px -2px 5px #ffffff',
  inset: 'inset 5px 5px 10px #bac4d1, inset -5px -5px 10px #ffffff',
  insetSm: 'inset 3px 3px 6px #bac4d1, inset -3px -3px 6px #ffffff',
  glow: '0 0 16px rgba(8,156,196,0.28)',
  glowSoft: '0 0 22px rgba(8,156,196,0.12)',
};

// Cross-platform neumorphic surface styles (RN 0.76+ boxShadow)
export const neo = {
  raised: (t: Theme, radius = 18) => ({
    backgroundColor: t.panel, borderRadius: radius, boxShadow: t.raiseSm,
  }),
  raisedBig: (t: Theme, radius = 26) => ({
    backgroundColor: t.panel, borderRadius: radius, boxShadow: t.raise,
  }),
  raisedGlow: (t: Theme, radius = 18) => ({
    backgroundColor: t.panelUp, borderRadius: radius,
    boxShadow: `${t.raiseSm}, ${t.glowSoft}`,
  }),
  inset: (t: Theme, radius = 14) => ({
    backgroundColor: t.bg, borderRadius: radius, boxShadow: t.inset,
  }),
  insetSm: (t: Theme, radius = 12) => ({
    backgroundColor: t.bg, borderRadius: radius, boxShadow: t.insetSm,
  }),
};

export const MONO = { fontFamily: 'monospace' as const, letterSpacing: 1.2 };

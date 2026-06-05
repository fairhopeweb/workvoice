import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, Modal,
  Platform, useWindowDimensions, StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  useAudioRecorder, useAudioPlayer, RecordingPresets,
  AudioModule, setAudioModeAsync,
} from 'expo-audio';
import { DARK, LIGHT, Theme, neo, MONO } from './src/theme';
import { Note, SEED, SIM_WORDS, fmtDate } from './src/data';

type ViewName = 'dash' | 'notes' | 'editor';
type Filter = 'all' | 'starred' | 'voice' | 'recent';

// ---------- small UI atoms ----------
const Label = ({ t, children, style }: any) => (
  <Text style={[MONO, { fontSize: 10, color: t.ink3, textTransform: 'uppercase' }, style]}>{children}</Text>
);

const NeoButton = ({ t, onPress, children, glow, style, testID }: any) => {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        glow ? neo.raisedGlow(t, 14) : neo.raised(t, 14),
        pressed && neo.insetSm(t, 14),
        { paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
};

// ---------- App ----------
export default function App() {
  const [themeName, setThemeName] = useState<'dark' | 'light'>('dark');
  const t: Theme = themeName === 'dark' ? DARK : LIGHT;
  const { width } = useWindowDimensions();
  const wide = width > 760;

  const [notes, setNotes] = useState<Note[]>(SEED);
  const [view, setView] = useState<ViewName>('dash');
  const [selId, setSelId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [toast, setToast] = useState<string | null>(null);
  const [installOpen, setInstallOpen] = useState(false);

  // recording state
  const [recOpen, setRecOpen] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [recMode, setRecMode] = useState('');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [levels, setLevels] = useState<number[]>(Array(28).fill(0.1));
  const recRef = useRef<{ timer?: any; sim?: any; meter?: any; sr?: any; final: string }>({ final: '' });

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer(null);

  const toastT = useRef<any>(null);
  const showToast = (m: string) => {
    setToast(m);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => { showToast('WorkVoice ready — tap the mic to dictate'); }, []);

  const sel = notes.find(n => n.id === selId) || null;

  const update = (id: number, patch: Partial<Note>, touch = true) =>
    setNotes(ns => ns.map(n => (n.id === id ? { ...n, ...patch, ...(touch ? { updated: Date.now() } : {}) } : n)));

  const newNote = (open = true) => {
    const n: Note = {
      id: Date.now(), title: '', body: '', tag: 'work', starred: false,
      hasAudio: false, audioUri: null, audioLen: null, created: Date.now(), updated: Date.now(),
    };
    setNotes(ns => [n, ...ns]);
    if (open) { setSelId(n.id); setView('editor'); }
    return n.id;
  };

  const deleteSel = () => {
    if (!sel) return;
    setNotes(ns => ns.filter(n => n.id !== sel.id));
    setSelId(null); setView('notes'); showToast('Note deleted');
  };

  // ---------- filtering ----------
  const visible = useMemo(() => {
    let arr = [...notes].sort((a, b) => b.updated - a.updated);
    if (filter === 'starred') arr = arr.filter(n => n.starred);
    if (filter === 'voice') arr = arr.filter(n => n.hasAudio || n.body.includes('VOICE TRANSCRIPT'));
    if (filter === 'recent') arr = arr.filter(n => Date.now() - n.updated < 3 * 86400e3);
    if (query) arr = arr.filter(n => (n.title + ' ' + n.body).toLowerCase().includes(query.toLowerCase()));
    return arr;
  }, [notes, filter, query]);

  // ---------- stats ----------
  const stats = useMemo(() => {
    const words = notes.reduce((a, n) => a + (n.body.trim() ? n.body.trim().split(/\s+/).length : 0), 0);
    return {
      total: notes.length,
      voice: notes.filter(n => n.hasAudio || n.body.includes('VOICE TRANSCRIPT')).length,
      starred: notes.filter(n => n.starred).length,
      words,
    };
  }, [notes]);

  // ---------- recording ----------
  const startSim = () => {
    setRecMode('SIMULATED TRANSCRIPTION (NATIVE STT NEEDS DEV BUILD)');
    let i = 0;
    recRef.current.sim = setInterval(() => {
      if (i >= SIM_WORDS.length) { clearInterval(recRef.current.sim); return; }
      recRef.current.final += SIM_WORDS[i++] + ' ';
      setTranscript(recRef.current.final);
    }, 180);
  };

  const startRec = async () => {
    if (!selId || view !== 'editor') { newNote(true); }
    recRef.current.final = '';
    setTranscript(''); setInterim(''); setRecSecs(0); setRecOpen(true);

    const t0 = Date.now();
    recRef.current.timer = setInterval(() => setRecSecs(Math.floor((Date.now() - t0) / 1000)), 250);

    // audio recording (expo-audio)
    let mic = false;
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (perm.granted) {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
        mic = true;
      }
    } catch { /* no mic in this environment */ }

    // waveform: metering when available, ambient animation otherwise
    recRef.current.meter = setInterval(() => {
      let v = 0.12 + 0.55 * Math.abs(Math.sin(Date.now() / 280)) * Math.random();
      try {
        const m = (recorder as any).getStatus?.().metering;
        if (typeof m === 'number') v = Math.min(1, Math.max(0.05, (m + 60) / 60));
      } catch {}
      setLevels(l => [...l.slice(1), v]);
    }, 90);

    // transcription: Web Speech on web, simulation elsewhere
    const SR = Platform.OS === 'web'
      ? (globalThis as any).SpeechRecognition || (globalThis as any).webkitSpeechRecognition
      : null;
    if (SR && mic) {
      try {
        const sr = new SR();
        sr.continuous = true; sr.interimResults = true;
        sr.onresult = (ev: any) => {
          let inter = '';
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const r = ev.results[i];
            if (r.isFinal) recRef.current.final += r[0].transcript + ' ';
            else inter += r[0].transcript;
          }
          setTranscript(recRef.current.final); setInterim(inter);
        };
        sr.onerror = () => { if (!recRef.current.final) startSim(); };
        sr.start();
        recRef.current.sr = sr;
        setRecMode('LIVE ON-DEVICE DICTATION');
      } catch { startSim(); }
    } else {
      startSim();
    }
  };

  const stopRec = async (keep: boolean) => {
    clearInterval(recRef.current.timer);
    clearInterval(recRef.current.sim);
    clearInterval(recRef.current.meter);
    try { recRef.current.sr?.stop(); } catch {}
    recRef.current.sr = null;

    let uri: string | null = null;
    try { await recorder.stop(); uri = recorder.uri ?? null; } catch {}

    setRecOpen(false);
    if (!keep) { showToast('Recording discarded'); return; }

    const text = recRef.current.final.trim();
    const id = selId;
    if (!id) return;
    const n = notes.find(x => x.id === id);
    if (!n) return;

    const secs = Math.max(1, recSecs);
    const block = text ? `\n\n🎙 VOICE TRANSCRIPT · ${secs}s\n${text}` : '';
    update(id, {
      body: (n.body + block).trim(),
      title: n.title || (text ? text.split(' ').slice(0, 6).join(' ') : n.title),
      ...(uri ? { hasAudio: true, audioUri: uri, audioLen: `${secs}s` } : {}),
    });
    showToast(text ? 'Transcript inserted into note' : 'Stopped — no speech captured');
  };

  const playAudio = (n: Note) => {
    if (!n.audioUri) { showToast('Demo note — record audio to hear playback'); return; }
    try { player.replace(n.audioUri); player.play(); } catch { showToast('Playback unavailable here'); }
  };

  // ---------- UI pieces ----------
  const greet = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  };

  const Chip = ({ f, label }: { f: Filter; label: string }) => {
    const on = filter === f;
    return (
      <Pressable
        testID={`chip-${f}`}
        onPress={() => setFilter(f)}
        style={[
          on ? neo.insetSm(t, 99) : neo.raised(t, 99),
          { paddingVertical: 7, paddingHorizontal: 14, marginRight: 8, marginBottom: 8 },
        ]}
      >
        <Text style={[MONO, { fontSize: 10.5, color: on ? t.accent : t.ink2 }]}>{label}</Text>
      </Pressable>
    );
  };

  const NoteCard = ({ n }: { n: Note }) => (
    <Pressable
      testID={`note-${n.id}`}
      onPress={() => { setSelId(n.id); setView('editor'); }}
      style={[neo.raised(t, 16), { padding: 14, marginBottom: 12 }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text numberOfLines={1} style={{ flex: 1, color: t.ink, fontWeight: '600', fontSize: 14 }}>
          {n.title || 'Untitled note'}
        </Text>
        <Pressable hitSlop={8} onPress={() => update(n.id, { starred: !n.starred }, false)}>
          <Text style={{ color: n.starred ? t.accent : t.ink3, fontSize: 14 }}>★</Text>
        </Pressable>
      </View>
      <Text numberOfLines={2} style={{ color: t.ink2, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
        {n.body.replace(/\n+/g, ' ')}
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        {(n.hasAudio || n.body.includes('VOICE TRANSCRIPT')) && (
          <Text style={[MONO, { fontSize: 9.5, color: t.accent }]}>🎙 VOICE</Text>
        )}
        <Text style={[MONO, { fontSize: 9.5, color: t.ink3 }]}>{fmtDate(n.updated)}</Text>
        <Text style={[MONO, { fontSize: 9.5, color: t.ink3 }]}>#{n.tag}</Text>
      </View>
    </Pressable>
  );

  // ---------- views ----------
  const Dashboard = (
    <ScrollView testID="dashboard" contentContainerStyle={{ padding: 22, paddingBottom: 140, maxWidth: 900, alignSelf: 'center', width: '100%' }}>
      <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'flex-start', gap: 14 }}>
        <View style={{ flex: 1 }}>
          <Text testID="greeting" style={{ color: t.ink, fontSize: 28, fontWeight: '700' }}>{greet()}</Text>
          <Text style={{ color: t.ink2, fontSize: 13, marginTop: 6 }}>
            Everything stays on this device. Nothing is uploaded.
          </Text>
        </View>
        {Platform.OS === 'web' && (
          <NeoButton t={t} testID="ios-install-btn" onPress={() => setInstallOpen(true)} style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ color: t.ink, fontSize: 15 }}></Text>
            <Text style={{ color: t.ink, fontWeight: '600', fontSize: 13 }}>Install on iOS</Text>
          </NeoButton>
        )}
      </View>

      <View testID="stats" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 24 }}>
        {[
          ['stat-total', stats.total, 'NOTES'],
          ['stat-voice', stats.voice, 'VOICE NOTES'],
          ['stat-starred', stats.starred, 'STARRED'],
          ['stat-words', stats.words.toLocaleString(), 'WORDS CAPTURED'],
        ].map(([id, num, lbl]) => (
          <View key={String(id)} testID={String(id)} style={[neo.raised(t, 18), { padding: 16, minWidth: 140, flexGrow: 1 }]}>
            <Text style={{ color: t.accent, fontSize: 26, fontWeight: '700' }}>{String(num)}</Text>
            <Label t={t} style={{ marginTop: 4 }}>{lbl}</Label>
          </View>
        ))}
      </View>

      <Label t={t} style={{ marginTop: 28, marginBottom: 12, letterSpacing: 2 }}>QUICK ACTIONS</Label>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 14 }}>
        <NeoButton t={t} testID="qa-dictate" onPress={() => { newNote(true); setTimeout(startRec, 50); }}
          style={{ flex: 1, flexDirection: 'row', gap: 13, justifyContent: 'flex-start', padding: 16 }}>
          <View style={[neo.raisedGlow(t, 13), { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 17 }}>🎙</Text>
          </View>
          <View>
            <Text style={{ color: t.ink, fontWeight: '600', fontSize: 14 }}>New dictation</Text>
            <Text style={{ color: t.ink2, fontSize: 12, marginTop: 2 }}>Record and transcribe into a fresh note</Text>
          </View>
        </NeoButton>
        <NeoButton t={t} testID="qa-note" onPress={() => newNote(true)}
          style={{ flex: 1, flexDirection: 'row', gap: 13, justifyContent: 'flex-start', padding: 16 }}>
          <View style={[neo.raised(t, 13), { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 17 }}>✏️</Text>
          </View>
          <View>
            <Text style={{ color: t.ink, fontWeight: '600', fontSize: 14 }}>New written note</Text>
            <Text style={{ color: t.ink2, fontSize: 12, marginTop: 2 }}>Skip the mic and start typing</Text>
          </View>
        </NeoButton>
      </View>

      <Label t={t} style={{ marginTop: 28, marginBottom: 12, letterSpacing: 2 }}>RECENT NOTES</Label>
      {visible.slice(0, 4).map(n => <NoteCard key={n.id} n={n} />)}
    </ScrollView>
  );

  const NotesList = (
    <View testID="notes-list" style={{ flex: 1, padding: 22, maxWidth: 900, alignSelf: 'center', width: '100%' }}>
      <TextInput
        testID="search-input"
        value={query}
        onChangeText={setQuery}
        placeholder="Search notes…"
        placeholderTextColor={t.ink3}
        style={[neo.inset(t, 14), { color: t.ink, paddingVertical: 12, paddingHorizontal: 16, fontSize: 14 }]}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 }}>
        <Chip f="all" label="ALL" />
        <Chip f="starred" label="★ STARRED" />
        <Chip f="voice" label="🎙 VOICE" />
        <Chip f="recent" label="RECENT" />
      </View>
      <ScrollView style={{ marginTop: 6 }} contentContainerStyle={{ paddingBottom: 140 }}>
        {visible.length === 0 && (
          <Text style={{ color: t.ink3, textAlign: 'center', marginTop: 30, fontSize: 13 }}>No notes match.</Text>
        )}
        {visible.map(n => <NoteCard key={n.id} n={n} />)}
      </ScrollView>
      <NeoButton t={t} glow testID="new-note-btn" onPress={() => newNote(true)}
        style={{ position: 'absolute', bottom: 110, right: 22, borderRadius: 16 }}>
        <Text style={{ color: t.accent, fontWeight: '700', fontSize: 13, letterSpacing: 1 }}>＋ NEW NOTE</Text>
      </NeoButton>
    </View>
  );

  const Editor = sel && (
    <View testID="editor" style={{ flex: 1, padding: 22, maxWidth: 820, alignSelf: 'center', width: '100%' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <NeoButton t={t} testID="back-btn" onPress={() => setView('notes')} style={{ width: 40, height: 40, padding: 0 }}>
          <Text style={{ color: t.ink2, fontSize: 16 }}>←</Text>
        </NeoButton>
        <Label t={t}>EDITED {fmtDate(sel.updated).toUpperCase()}</Label>
        <View style={{ flex: 1 }} />
        <NeoButton t={t} testID="star-btn" onPress={() => update(sel.id, { starred: !sel.starred }, false)}
          style={{ width: 40, height: 40, padding: 0 }}>
          <Text style={{ color: sel.starred ? t.accent : t.ink2, fontSize: 15 }}>★</Text>
        </NeoButton>
        <NeoButton t={t} testID="delete-btn" onPress={deleteSel} style={{ width: 40, height: 40, padding: 0 }}>
          <Text style={{ color: t.rec, fontSize: 14 }}>🗑</Text>
        </NeoButton>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 150 }}>
        <View style={[neo.raisedBig(t, 24), { padding: 22 }]}>
          <TextInput
            testID="title-input"
            value={sel.title}
            onChangeText={v => update(sel.id, { title: v })}
            placeholder="Untitled note"
            placeholderTextColor={t.ink3}
            style={{ color: t.ink, fontSize: 26, fontWeight: '700', paddingVertical: 4 }}
          />
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 4, marginBottom: 14 }}>
            <Label t={t}>{sel.body.trim() ? sel.body.trim().split(/\s+/).length : 0} WORDS</Label>
            <Label t={t}>#{sel.tag.toUpperCase()}</Label>
          </View>

          {sel.hasAudio && (
            <Pressable onPress={() => playAudio(sel)}
              style={[neo.inset(t, 16), { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, marginBottom: 16 }]}>
              <View style={[neo.raisedGlow(t, 99), { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: t.accent, fontSize: 13 }}>▶</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1, height: 24, overflow: 'hidden' }}>
                {Array.from({ length: 30 }).map((_, i) => (
                  <View key={i} style={{ flex: 1, height: `${20 + ((i * 37) % 70)}%`, backgroundColor: t.shL, borderRadius: 2 }} />
                ))}
              </View>
              <Text style={[MONO, { fontSize: 10, color: t.ink2 }]}>{sel.audioLen}</Text>
            </Pressable>
          )}

          <TextInput
            testID="body-input"
            value={sel.body}
            onChangeText={v => update(sel.id, { body: v })}
            placeholder="Start typing, or hit the mic to dictate…"
            placeholderTextColor={t.ink3}
            multiline
            style={{ color: t.ink, fontSize: 15, lineHeight: 24, minHeight: 280, textAlignVertical: 'top' }}
          />
        </View>
      </ScrollView>
    </View>
  );

  // ---------- shell ----------
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0 }}>
      <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />

      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 54 : 16, paddingBottom: 12 }}>
        <View style={[neo.raisedGlow(t, 12), { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: t.accent, fontWeight: '700', fontSize: 13 }}>WV</Text>
        </View>
        <Text testID="brand" style={{ color: t.ink, fontWeight: '700', fontSize: 17, letterSpacing: 0.5 }}>
          WORK<Text style={{ color: t.accent }}>VOICE</Text>
        </Text>
        <View style={{ flex: 1 }} />
        <View style={[neo.insetSm(t, 99), { paddingVertical: 4, paddingHorizontal: 10 }]}>
          <Text style={[MONO, { fontSize: 9, color: t.accentDim }]}>ON-DEVICE</Text>
        </View>
        <NeoButton t={t} testID="theme-btn" onPress={() => setThemeName(x => (x === 'dark' ? 'light' : 'dark'))}
          style={{ width: 38, height: 38, padding: 0 }}>
          <Text style={{ color: t.ink2, fontSize: 14 }}>◐</Text>
        </NeoButton>
      </View>

      {/* nav */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 8 }}>
        {([['dash', 'DASHBOARD'], ['notes', 'NOTES']] as [ViewName, string][]).map(([v, lbl]) => {
          const on = view === v || (v === 'notes' && view === 'editor');
          return (
            <Pressable key={v} testID={`nav-${v}`} onPress={() => setView(v)}
              style={[on ? neo.insetSm(t, 12) : neo.raised(t, 12), { flex: 1, paddingVertical: 10, alignItems: 'center' }]}>
              <Text style={[MONO, { fontSize: 11, color: on ? t.accent : t.ink2 }]}>{lbl}</Text>
            </Pressable>
          );
        })}
      </View>

      {view === 'dash' && Dashboard}
      {view === 'notes' && NotesList}
      {view === 'editor' && (Editor || NotesList)}

      {/* record dock */}
      {!recOpen && (
        <View style={{ position: 'absolute', bottom: 28, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={[neo.raised(t, 99), { paddingVertical: 8, paddingHorizontal: 14 }]}>
            <Label t={t}>TAP TO DICTATE</Label>
          </View>
          <Pressable testID="rec-btn" onPress={startRec}
            style={[neo.raisedBig(t, 99), { width: 66, height: 66, alignItems: 'center', justifyContent: 'center', boxShadow: `${t.raise}, 0 0 20px rgba(255,77,109,0.2)` }]}>
            <Text style={{ fontSize: 22 }}>🎙</Text>
          </Pressable>
        </View>
      )}

      {/* record sheet */}
      {recOpen && (
        <View testID="rec-panel" style={[neo.raisedBig(t, 24), {
          position: 'absolute', bottom: 0, alignSelf: 'center', width: '100%', maxWidth: 680,
          borderBottomLeftRadius: 0, borderBottomRightRadius: 0, backgroundColor: t.panelUp,
          padding: 22, boxShadow: `0 -18px 50px ${t.shD}, ${t.glowSoft}`,
        }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.rec, boxShadow: `0 0 10px ${t.rec}` }} />
            <View>
              <Text style={{ color: t.ink, fontWeight: '700', fontSize: 13, letterSpacing: 1 }}>RECORDING</Text>
              <Text style={[MONO, { fontSize: 8.5, color: t.ink3, marginTop: 2 }]}>{recMode}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <Text testID="rec-timer" style={[MONO, { fontSize: 14, color: t.accent }]}>
              {String(Math.floor(recSecs / 60)).padStart(2, '0')}:{String(recSecs % 60).padStart(2, '0')}
            </Text>
          </View>

          <View style={[neo.inset(t, 14), { height: 60, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10 }]}>
            {levels.map((v, i) => (
              <View key={i} style={{
                flex: 1, height: Math.max(4, v * 48), borderRadius: 2,
                backgroundColor: t.accent, opacity: 0.35 + v * 0.65,
              }} />
            ))}
          </View>

          <View style={[neo.inset(t, 14), { marginTop: 14, padding: 13, maxHeight: 110 }]}>
            <ScrollView>
              <Text testID="live-transcript" style={{ color: t.ink, fontSize: 14, lineHeight: 21 }}>
                {transcript || (interim ? '' : 'Listening…')}
                <Text style={{ color: t.ink3 }}>{interim}</Text>
              </Text>
            </ScrollView>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <NeoButton t={t} testID="rec-discard" onPress={() => stopRec(false)} style={{ flex: 1 }}>
              <Text style={{ color: t.ink2, fontWeight: '600', fontSize: 13 }}>Discard</Text>
            </NeoButton>
            <NeoButton t={t} glow testID="rec-stop" onPress={() => stopRec(true)} style={{ flex: 1 }}>
              <Text style={{ color: t.accent, fontWeight: '700', fontSize: 13 }}>■ Stop & insert transcript</Text>
            </NeoButton>
          </View>
        </View>
      )}

      {/* toast */}
      {toast && (
        <View testID="toast" style={[neo.raisedGlow(t, 13), {
          position: 'absolute', top: Platform.OS === 'ios' ? 58 : 18, alignSelf: 'center',
          paddingVertical: 10, paddingHorizontal: 18, maxWidth: 480,
        }]}>
          <Text style={{ color: t.ink, fontSize: 12.5 }}>{toast}</Text>
        </View>
      )}

      {/* install modal */}
      <Modal visible={installOpen} transparent animationType="fade" onRequestClose={() => setInstallOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(8,11,15,0.6)', alignItems: 'center', justifyContent: 'center' }}>
          <View testID="ios-modal" style={[neo.raisedBig(t, 24), { width: '90%', maxWidth: 430, backgroundColor: t.panelUp, padding: 24 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <View style={[neo.raisedGlow(t, 12), { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: t.accent, fontWeight: '700', fontSize: 13 }}>WV</Text>
              </View>
              <Text style={{ color: t.ink, fontWeight: '700', fontSize: 16 }}>Install WorkVoice on iOS</Text>
            </View>
            <Text style={{ color: t.ink2, fontSize: 12.5, lineHeight: 19, marginTop: 10, marginBottom: 8 }}>
              WorkVoice installs as a full-screen app on your home screen — icon, offline shell, no browser chrome.
            </Text>
            {[
              ['1', 'Open this page in Safari on your iPhone or iPad.'],
              ['2', 'Tap the Share button ⬆︎ in the toolbar.'],
              ['3', 'Scroll down and tap “Add to Home Screen”.'],
              ['4', 'Tap Add — launch WorkVoice from your home screen.'],
            ].map(([n, s]) => (
              <View key={n} style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, alignItems: 'flex-start' }}>
                <View style={[neo.insetSm(t, 99), { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={[MONO, { fontSize: 11, color: t.accent }]}>{n}</Text>
                </View>
                <Text style={{ color: t.ink, fontSize: 13, lineHeight: 19, flex: 1 }}>{s}</Text>
              </View>
            ))}
            <NeoButton t={t} testID="ios-modal-close" onPress={() => setInstallOpen(false)} style={{ marginTop: 14 }}>
              <Text style={{ color: t.ink, fontWeight: '600', fontSize: 13 }}>Close</Text>
            </NeoButton>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export interface Track {
  id: number;
  name: string;
}

export interface Item {
  id: number;
  path: string;
  name: string;
}

export interface Settings {
  volume: number;
  muted: boolean;
  rate: number;
  repeat: 'off' | 'all' | 'one';
  aspect: string;
  playlist: Item[];
  current: number | null;
}

export interface Playback {
  state: string;
  time: number;
  duration: number;
  seekable: boolean;
  rate: number;
  audio_tracks: Track[];
  subtitle_tracks: Track[];
  audio_track: number;
  subtitle_track: number;
  audio_delay?: number;
  subtitle_delay?: number;
  title: string;
  artist: string;
  album: string;
}

export interface Snapshot {
  playback: Playback;
  settings: Settings;
  error: string | null;
  runtime: string;
}

export interface VideoAdjustments {
  brightness: number; // -100 to 100
  contrast: number;   // 0 to 200
  saturation: number; // 0 to 300
  gamma: number;      // 0.2 to 5.0
  hue: number;        // 0 to 360
  invert: boolean;
}

export interface EqualizerPreset {
  name: string;
  bands: number[]; // 10 bands from 60Hz to 16kHz (-12 to +12 dB)
  preamp: number;
}

export interface Bookmark {
  id: string;
  time: number;
  label: string;
}

export const initialVideoAdjustments: VideoAdjustments = {
  brightness: 0,
  contrast: 100,
  saturation: 100,
  gamma: 1.0,
  hue: 0,
  invert: false,
};

export const EQUALIZER_PRESETS: Record<string, EqualizerPreset> = {
  flat: { name: 'Flat', bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], preamp: 0 },
  rock: { name: 'Rock', bands: [4.8, 3.2, -1.6, -3.2, -0.8, 2.4, 4.0, 5.6, 6.4, 6.4], preamp: 0 },
  pop: { name: 'Pop', bands: [-1.6, 1.2, 4.0, 4.8, 3.2, -0.8, -1.6, -1.6, 2.4, 2.4], preamp: 0 },
  classical: { name: 'Classical', bands: [4.8, 3.6, 2.4, 2.0, -1.6, -1.6, 0, 2.4, 3.2, 4.0], preamp: 0 },
  dance: { name: 'Dance', bands: [6.4, 5.6, 2.4, 0, 1.6, 3.6, 4.8, 4.0, 3.2, 0], preamp: 0 },
  techno: { name: 'Techno', bands: [5.6, 4.0, 0, -3.2, -2.4, 0, 4.8, 6.4, 6.0, 5.6], preamp: 0 },
  club: { name: 'Club', bands: [0, 0, 2.0, 3.6, 3.6, 3.6, 2.0, 0, 0, 0], preamp: 0 },
  bass_boost: { name: 'Full Bass', bands: [7.2, 5.6, 4.0, 1.6, 0, -1.6, -3.2, -4.0, -4.8, -4.8], preamp: 0 },
  treble_boost: { name: 'Full Treble', bands: [-4.8, -4.8, -4.8, -2.4, 0, 4.0, 6.4, 8.0, 8.8, 9.6], preamp: 0 },
  vocal: { name: 'Vocal / Dialogue', bands: [-1.6, -2.4, -1.6, 2.4, 5.6, 5.6, 3.2, 1.6, 0, -1.6], preamp: 0 },
  live: { name: 'Live', bands: [-2.4, 0, 2.4, 3.2, 3.6, 3.6, 2.4, 1.6, 1.6, 1.2], preamp: 0 },
  headphones: { name: 'Headphones', bands: [3.2, 6.4, 3.2, -2.0, -1.6, 1.2, 3.2, 5.6, 7.2, 8.0], preamp: 0 }
};

export const initial: Snapshot = {
  playback: {
    state: 'idle',
    time: 0,
    duration: 0,
    seekable: false,
    rate: 1,
    audio_tracks: [],
    subtitle_tracks: [],
    audio_track: -1,
    subtitle_track: -1,
    audio_delay: 0,
    subtitle_delay: 0,
    title: '',
    artist: '',
    album: ''
  },
  settings: {
    volume: 80,
    muted: false,
    rate: 1,
    repeat: 'off',
    aspect: '',
    playlist: [],
    current: null
  },
  error: null,
  runtime: 'Connecting…'
};

export function formatTime(ms: number): string {
  const seconds = Math.floor(Math.max(0, Number.isFinite(ms) ? ms : 0) / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h ? `${h}:` : ''}${h ? String(m).padStart(2, '0') : m}:${String(s).padStart(2, '0')}`;
}

export function parseTimeString(str: string): number | null {
  const clean = str.trim();
  if (!clean) return null;
  const parts = clean.split(':').map(Number);
  if (parts.some(p => isNaN(p) || p < 0)) return null;

  let totalSeconds = 0;
  if (parts.length === 3) {
    totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    totalSeconds = parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    totalSeconds = parts[0];
  } else {
    return null;
  }
  return totalSeconds * 1000;
}

export function shortcut(key: string, ctrl: boolean, shift: boolean): string | null {
  if (ctrl) {
    const k = key.toLowerCase();
    if (k === 'o') return shift ? 'append' : 'open';
    if (k === 't') return 'jump_to_time';
    if (k === 'b') return 'toggle_bookmarks';
    if (k === 'e') return 'toggle_effects';
    if (k === 's' && shift) return 'snapshot';
    return null;
  }

  const map: Record<string, string> = {
    ' ': 'toggle',
    n: 'next',
    p: 'previous',
    s: 'stop',
    m: 'mute',
    f: 'fullscreen',
    Escape: 'exit_fullscreen',
    ArrowRight: shift ? 'seek_long_forward' : 'seek_forward',
    ArrowLeft: shift ? 'seek_long_backward' : 'seek_backward',
    ArrowUp: 'volume_up',
    ArrowDown: 'volume_down',
    v: 'cycle_subtitle',
    b: 'cycle_audio',
    a: 'cycle_aspect',
    c: 'cycle_crop',
    l: 'toggle_ab_loop',
    e: 'step_frame',
    '[': 'slower',
    ']': 'faster',
    '=': 'rate_normal',
    j: 'audio_delay_down',
    k: 'audio_delay_up',
    h: 'subtitle_delay_down',
    g: 'subtitle_delay_up'
  };

  return map[key] ?? null;
}

export function nextTrack(tracks: Track[], current: number): number | null {
  if (!tracks.length) return null;
  const i = tracks.findIndex(t => t.id === current);
  return tracks[(i + 1) % tracks.length].id;
}

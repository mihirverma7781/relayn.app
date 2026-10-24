import {useState} from 'react';
import {
  AudioLines,
  Bookmark,
  Camera,
  ChevronDown,
  Clock,
  Crop,
  Loader2,
  Maximize2,
  Pause,
  Play,
  Plus,
  Repeat,
  Repeat1,
  RotateCcw,
  RotateCw,
  Shuffle,
  SkipBack,
  SkipForward,
  Sliders,
  Square,
  StepForward,
  Subtitles,
  Volume2,
  VolumeX,
  ListMusic
} from 'lucide-react';
import {formatTime} from '../player';
import {mediaKind, mediaTitle} from '../media';
import type {PlayerController} from '../usePlayer';
import {FileGlyph} from './Artwork';

interface TransportProps {
  player: PlayerController;
  toggleQueue: () => void;
  queueOpen: boolean;
  loopA: number | null;
  loopB: number | null;
  onToggleAbLoop: () => void;
  onOpenEffects: () => void;
  onOpenBookmarks: () => void;
  onOpenJump: () => void;
  onSnapshot: () => void;
  onStepFrame: () => void;
  shuffle: boolean;
  onToggleShuffle: () => void;
  cropRatio: string;
  onSetCropRatio: (ratio: string) => void;
}

export function TrackControls({
  player,
  cropRatio,
  onSetCropRatio,
  onOpenJump
}: {
  player: PlayerController;
  cropRatio: string;
  onSetCropRatio: (ratio: string) => void;
  onOpenJump: () => void;
}) {
  const {playback: p, settings: s} = player.state;
  const current = !!s.current;

  return (
    <div className="track-controls">
      {/* Audio Track Dropdown */}
      <label className="track-select-label" title="Select audio track">
        <AudioLines size={14} />
        <select
          aria-label="Audio track"
          value={p.audio_track}
          disabled={!p.audio_tracks.length}
          onChange={e => player.call('audio', Number(e.target.value))}
        >
          {p.audio_tracks.length ? (
            p.audio_tracks.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))
          ) : (
            <option value="-1">Default Audio</option>
          )}
        </select>
        <ChevronDown size={11} className="select-chevron" />
      </label>

      {/* Subtitles Dropdown */}
      <label className="track-select-label" title="Select subtitle track">
        <Subtitles size={14} />
        <select
          aria-label="Subtitle track"
          value={p.subtitle_track}
          disabled={!p.subtitle_tracks.length}
          onChange={e => player.call('subtitle', Number(e.target.value))}
        >
          {p.subtitle_tracks.length ? (
            p.subtitle_tracks.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))
          ) : (
            <option value="-1">Subtitles Off</option>
          )}
        </select>
        <ChevronDown size={11} className="select-chevron" />
      </label>

      {/* Add Subtitle File */}
      <button
        className="icon-button small"
        title="Load external subtitle file (.srt, .vtt, .ass)"
        aria-label="Load subtitle file"
        disabled={!current}
        onClick={player.subtitles}
      >
        <Plus size={14} />
      </button>

      <span className="control-divider" />

      {/* Aspect Ratio */}
      <label className="track-select-label" title="Aspect ratio">
        <select
          aria-label="Aspect ratio"
          value={s.aspect}
          onChange={e => player.call('aspect', undefined, e.target.value)}
        >
          {['', '16:9', '16:10', '4:3', '1:1', '2.35:1', '2.39:1', '21:9'].map(v => (
            <option key={v} value={v}>{v || 'Original Aspect'}</option>
          ))}
        </select>
        <ChevronDown size={11} className="select-chevron" />
      </label>

      {/* Crop Ratio */}
      <label className="track-select-label" title="Crop mode">
        <Crop size={13} />
        <select
          aria-label="Crop mode"
          value={cropRatio}
          onChange={e => onSetCropRatio(e.target.value)}
        >
          <option value="none">No Crop</option>
          <option value="fill">Fill Canvas</option>
          <option value="16:9">Crop 16:9</option>
          <option value="4:3">Crop 4:3</option>
          <option value="2.35:1">Crop 2.35:1</option>
        </select>
        <ChevronDown size={11} className="select-chevron" />
      </label>

      <span className="control-divider" />

      {/* Jump to Time (⌘T) */}
      <button
        className="button secondary small jump-time-btn"
        title="Jump to time (⌘T)"
        onClick={onOpenJump}
        disabled={!current}
      >
        <Clock size={13} /> Jump…
      </button>
    </div>
  );
}

export default function Transport({
  player,
  toggleQueue,
  queueOpen,
  loopA,
  loopB,
  onToggleAbLoop,
  onOpenEffects,
  onOpenBookmarks,
  onOpenJump,
  onSnapshot,
  onStepFrame,
  shuffle,
  onToggleShuffle,
  cropRatio,
  onSetCropRatio
}: TransportProps) {
  const {state: {playback: p, settings: s}, call, seeking, setSeeking} = player;
  const current = s.playlist.find(i => i.id === s.current);
  const busy = ['opening', 'buffering'].includes(p.state);
  const isVideo = current ? mediaKind(current.name) === 'video' : false;

  const [showRemaining, setShowRemaining] = useState(false);

  const seekBy = (deltaMs: number) => {
    if (p.seekable) {
      const next = p.duration > 0
        ? Math.min(p.duration, Math.max(0, p.time + deltaMs))
        : Math.max(0, p.time + deltaMs);
      void call('seek', next);
    }
  };

  const displayDuration = p.duration > 0
    ? (showRemaining ? `-${formatTime(Math.max(0, p.duration - p.time))}` : formatTime(p.duration))
    : (current ? '—' : '0:00');

  // Compute A-B loop percentage marks on the scrubber
  const loopAPercent = loopA !== null && p.duration > 0 ? (loopA / p.duration) * 100 : null;
  const loopBPercent = loopB !== null && p.duration > 0 ? (loopB / p.duration) * 100 : null;

  return (
    <footer className="player-dock" aria-label="Playback controls">
      <div className="dock-main">
        {/* ================= LEFT: NOW PLAYING ================= */}
        <div className="dock-current">
          <FileGlyph audio={current ? mediaKind(current.name) === 'audio' : false} />
          <div className="dock-meta-text">
            <strong title={current?.path}>
              {current ? mediaTitle(p.title || current.name) : 'No media loaded'}
            </strong>
            <span>{p.artist || 'Your collection'}{p.album ? ` · ${p.album}` : ''}</span>
          </div>
          {current && (
            <span className="chip dock-format">{current.name.split('.').pop()?.toUpperCase()}</span>
          )}
        </div>

        {/* ================= CENTER: TRANSPORT CONTROLS ================= */}
        <div className="dock-transport">
          <div className="play-controls">
            {/* Skip back 10s */}
            <button
              className="icon-button"
              aria-label="Seek backward 10s"
              title="Seek backward 10s (←)"
              disabled={!p.seekable}
              onClick={() => seekBy(-10000)}
            >
              <RotateCcw size={16} />
              <small>10</small>
            </button>

            {/* Previous */}
            <button
              className="icon-button"
              aria-label="Previous track"
              title="Previous (P)"
              disabled={!s.playlist.length}
              onClick={() => call('previous')}
            >
              <SkipBack size={17} />
            </button>

            {/* Hero Play / Pause */}
            <button
              className="play-button"
              aria-label={p.state === 'playing' ? 'Pause' : 'Play'}
              title="Play / Pause (Space)"
              disabled={!s.playlist.length || busy}
              onClick={() => call('toggle')}
            >
              {busy ? (
                <Loader2 size={21} className="spin" />
              ) : p.state === 'playing' ? (
                <Pause size={20} fill="currentColor" />
              ) : (
                <Play size={20} fill="currentColor" />
              )}
            </button>

            {/* Next */}
            <button
              className="icon-button"
              aria-label="Next track"
              title="Next (N)"
              disabled={!s.playlist.length}
              onClick={() => call('next')}
            >
              <SkipForward size={17} />
            </button>

            {/* Skip forward 10s */}
            <button
              className="icon-button"
              aria-label="Seek forward 10s"
              title="Seek forward 10s (→)"
              disabled={!p.seekable}
              onClick={() => seekBy(10000)}
            >
              <RotateCw size={16} />
              <small>10</small>
            </button>

            {/* Frame Step (e) */}
            {isVideo && (
              <button
                className="icon-button"
                aria-label="Next frame"
                title="Next frame (E)"
                disabled={!current}
                onClick={onStepFrame}
              >
                <StepForward size={15} />
              </button>
            )}

            {/* A-B Loop Button */}
            <button
              className={`icon-button loop-ab-btn ${loopA !== null ? 'active' : ''}`}
              title={loopA === null ? 'A-B Loop: Set Point A (L)' : loopB === null ? 'A-B Loop: Set Point B (L)' : 'A-B Loop: Clear Loop (L)'}
              aria-label="A-B Loop"
              disabled={!p.seekable}
              onClick={onToggleAbLoop}
            >
              <Repeat size={15} />
              <span className="ab-badge">
                {loopA === null ? 'A' : loopB === null ? 'B' : 'A-B'}
              </span>
            </button>
          </div>

          {/* Timeline & Scrubber */}
          <div className="timeline">
            <span className="mono time-display">{formatTime(seeking ?? p.time)}</span>

            <div className="scrubber-track-container">
              <input
                aria-label="Playback position"
                type="range"
                min="0"
                max={Math.max(1, p.duration)}
                value={seeking ?? Math.min(p.time, p.duration)}
                disabled={!p.seekable || p.duration <= 0}
                onChange={e => setSeeking(Number(e.target.value))}
                onPointerUp={e => {
                  void call('seek', Number(e.currentTarget.value));
                  setSeeking(null);
                }}
                onKeyUp={e => {
                  void call('seek', Number(e.currentTarget.value));
                  setSeeking(null);
                }}
                onBlur={() => setSeeking(null)}
                style={{
                  '--progress': `${p.duration ? (100 * (seeking ?? p.time)) / p.duration : 0}%`
                } as React.CSSProperties}
              />

              {/* Point A Marker */}
              {loopAPercent !== null && (
                <div
                  className="loop-point-marker marker-a"
                  style={{left: `${loopAPercent}%`}}
                  title={`Loop Point A: ${formatTime(loopA!)}`}
                />
              )}

              {/* Point B Marker */}
              {loopBPercent !== null && (
                <div
                  className="loop-point-marker marker-b"
                  style={{left: `${loopBPercent}%`}}
                  title={`Loop Point B: ${formatTime(loopB!)}`}
                />
              )}
            </div>

            <button
              type="button"
              className="mono time-display duration-toggle-btn"
              title="Click to toggle remaining time"
              onClick={() => setShowRemaining(prev => !prev)}
            >
              {displayDuration}
            </button>
          </div>
        </div>

        {/* ================= RIGHT: TOOLS & VOLUME ================= */}
        <div className="dock-options">
          {/* Playback speed */}
          <select
            className="speed-select"
            aria-label="Playback speed"
            title="Playback speed ([ / ])"
            value={s.rate}
            onChange={e => call('rate', Number(e.target.value))}
          >
            {[0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0].map(v => (
              <option key={v} value={v}>{v.toFixed(v % 1 ? 2 : 1)}×</option>
            ))}
          </select>

          {/* Shuffle toggle */}
          <button
            className={`icon-button ${shuffle ? 'selected' : ''}`}
            title={`Shuffle: ${shuffle ? 'On' : 'Off'}`}
            aria-label="Toggle shuffle"
            onClick={onToggleShuffle}
          >
            <Shuffle size={16} />
          </button>

          {/* Repeat mode */}
          <button
            className={`icon-button ${s.repeat !== 'off' ? 'selected' : ''}`}
            aria-label={`Repeat: ${s.repeat}`}
            title={`Repeat mode: ${s.repeat}`}
            onClick={() => call('repeat', undefined, s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off')}
          >
            {s.repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </button>

          {/* Bookmarks Manager */}
          <button
            className="icon-button"
            title="Bookmarks (⌘B)"
            aria-label="Bookmarks"
            disabled={!current}
            onClick={onOpenBookmarks}
          >
            <Bookmark size={16} />
          </button>

          {/* Audio / Video Effects & Equalizer */}
          <button
            className="icon-button"
            title="Effects & Equalizer (⌘E)"
            aria-label="Effects and Equalizer"
            onClick={onOpenEffects}
          >
            <Sliders size={16} />
          </button>

          {/* Video Snapshot (⌘⌥S) */}
          {isVideo && (
            <button
              className="icon-button"
              title="Take snapshot (⌘S)"
              aria-label="Take video snapshot"
              disabled={!current}
              onClick={onSnapshot}
            >
              <Camera size={16} />
            </button>
          )}

          {/* Play Queue Drawer Toggle */}
          <button
            className={`icon-button ${queueOpen ? 'selected' : ''}`}
            title="Play queue (⌘L)"
            aria-label="Toggle play queue"
            aria-expanded={queueOpen}
            onClick={toggleQueue}
          >
            <ListMusic size={17} />
            {s.playlist.length > 0 && <span className="queue-count">{s.playlist.length}</span>}
          </button>

          {/* Mute Button */}
          <button
            className="icon-button"
            aria-label={s.muted ? 'Unmute' : 'Mute'}
            title="Mute (M)"
            onClick={() => call('mute')}
          >
            {s.muted || s.volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>

          {/* Volume Slider (0 to 150% with boost!) */}
          <div className="volume-slider-wrapper" title={`Volume: ${s.volume}%`}>
            <input
              className={`volume-slider ${s.volume > 100 ? 'is-boosted' : ''}`}
              aria-label="Volume"
              type="range"
              min="0"
              max="150"
              value={s.volume}
              onChange={e => call('volume', Number(e.target.value))}
            />
            {s.volume > 100 && <span className="boost-tag">BOOST</span>}
          </div>

          {/* Fullscreen Button */}
          <button
            className="icon-button"
            aria-label="Toggle fullscreen"
            title="Fullscreen (F)"
            disabled={!player.native}
            onClick={() => player.fullscreen()}
          >
            <Maximize2 size={17} />
          </button>
        </div>
      </div>

      {/* ================= SECONDARY SUB BAR ================= */}
      <div className="dock-sub">
        <TrackControls
          player={player}
          cropRatio={cropRatio}
          onSetCropRatio={onSetCropRatio}
          onOpenJump={onOpenJump}
        />

        <div className="dock-secondary">
          <button
            className="icon-button small"
            aria-label="Stop playback"
            title="Stop (S)"
            disabled={!current}
            onClick={() => call('stop')}
          >
            <Square size={12} />
          </button>
          <span className={`mono muted volume-indicator ${s.volume > 100 ? 'boosted-text' : ''}`}>
            {s.muted ? 'MUTED' : `${s.volume}% VOLUME`}
          </span>
        </div>
      </div>
    </footer>
  );
}

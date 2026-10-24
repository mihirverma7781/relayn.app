import {useState, useEffect, useRef} from 'react';
import {
  AudioLines,
  Bookmark,
  Camera,
  Check,
  Clock,
  Crop,
  ListMusic,
  Loader2,
  Maximize2,
  Pause,
  Play,
  Plus,
  Repeat,
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
  VolumeX
} from 'lucide-react';
import {formatTime} from '../player';
import {mediaKind, mediaTitle} from '../media';
import type {PlayerController} from '../usePlayer';

interface TransportProps {
  player: PlayerController;
  viewMode: 'video' | 'playlist';
  onToggleViewMode: () => void;
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
  audioDelay: number;
  onAudioDelayChange: (val: number) => void;
  subDelay: number;
  onSubDelayChange: (val: number) => void;
}

export default function Transport({
  player,
  viewMode,
  onToggleViewMode,
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
  onSetCropRatio,
  audioDelay,
  onAudioDelayChange,
  subDelay,
  onSubDelayChange
}: TransportProps) {
  const {state: {playback: p, settings: s}, call, seeking, setSeeking} = player;
  const current = s.playlist.find(i => i.id === s.current);
  const busy = ['opening', 'buffering'].includes(p.state);
  const isVideo = current ? mediaKind(current.name) === 'video' : false;

  const [showRemaining, setShowRemaining] = useState(false);
  const [activePopover, setActivePopover] = useState<'audio' | 'subtitle' | 'aspect' | 'speed' | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActivePopover(null);
      }
    };
    if (activePopover) {
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [activePopover]);

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

  const loopAPercent = loopA !== null && p.duration > 0 ? (loopA / p.duration) * 100 : null;
  const loopBPercent = loopB !== null && p.duration > 0 ? (loopB / p.duration) * 100 : null;

  return (
    <footer className="vlc-player-dock" ref={popoverRef} aria-label="Playback controls">
      {/* ================= TOP: TIMELINE & PROGRESS ================= */}
      <div className="vlc-dock-timeline">
        <span className="mono time-label elapsed">{formatTime(seeking ?? p.time)}</span>

        <div className="vlc-scrubber-track">
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

          {loopAPercent !== null && (
            <div
              className="vlc-loop-marker marker-a"
              style={{left: `${loopAPercent}%`}}
              title={`Point A: ${formatTime(loopA!)}`}
            />
          )}

          {loopBPercent !== null && (
            <div
              className="vlc-loop-marker marker-b"
              style={{left: `${loopBPercent}%`}}
              title={`Point B: ${formatTime(loopB!)}`}
            />
          )}
        </div>

        <button
          type="button"
          className="mono time-label duration duration-toggle-btn"
          title="Click to toggle remaining time"
          onClick={() => setShowRemaining(prev => !prev)}
        >
          {displayDuration}
        </button>
      </div>

      {/* ================= BOTTOM: INTEGRATED CONTROLS ROW ================= */}
      <div className="vlc-dock-controls">
        {/* LEFT GROUP: Primary Transport */}
        <div className="vlc-control-group group-left">
          {/* Previous Track */}
          <button
            className="vlc-btn"
            title="Previous (⌘←)"
            aria-label="Previous"
            disabled={!s.playlist.length}
            onClick={() => call('previous')}
          >
            <SkipBack size={16} />
          </button>

          {/* Backward 10s */}
          <button
            className="vlc-btn"
            title="Back 10s (←)"
            aria-label="Back 10s"
            disabled={!p.seekable}
            onClick={() => seekBy(-10000)}
          >
            <RotateCcw size={15} />
          </button>

          {/* Hero Play/Pause Button */}
          <button
            className="vlc-btn-play"
            title="Play / Pause (Space)"
            aria-label={p.state === 'playing' ? 'Pause' : 'Play'}
            disabled={!s.playlist.length || busy}
            onClick={() => call('toggle')}
          >
            {busy ? (
              <Loader2 size={19} className="spin" />
            ) : p.state === 'playing' ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" />
            )}
          </button>

          {/* Forward 10s */}
          <button
            className="vlc-btn"
            title="Forward 10s (→)"
            aria-label="Forward 10s"
            disabled={!p.seekable}
            onClick={() => seekBy(10000)}
          >
            <RotateCw size={15} />
          </button>

          {/* Next Track */}
          <button
            className="vlc-btn"
            title="Next (⌘→)"
            aria-label="Next"
            disabled={!s.playlist.length}
            onClick={() => call('next')}
          >
            <SkipForward size={16} />
          </button>

          {/* Stop Button */}
          <button
            className="vlc-btn"
            title="Stop (S)"
            aria-label="Stop"
            disabled={!current}
            onClick={() => call('stop')}
          >
            <Square size={13} />
          </button>

          {/* Frame Step Forward */}
          {isVideo && (
            <button
              className="vlc-btn"
              title="Next frame (E)"
              aria-label="Next frame"
              disabled={!current}
              onClick={onStepFrame}
            >
              <StepForward size={14} />
            </button>
          )}

          {/* A-B Loop Button */}
          <button
            className={`vlc-btn vlc-ab-btn ${loopA !== null ? 'active' : ''}`}
            title={loopA === null ? 'A-B Loop: Set Point A (L)' : loopB === null ? 'A-B Loop: Set Point B (L)' : 'A-B Loop: Clear Loop (L)'}
            aria-label="A-B Loop"
            disabled={!p.seekable}
            onClick={onToggleAbLoop}
          >
            <Repeat size={14} />
            <span className="vlc-badge">{loopA === null ? 'A' : loopB === null ? 'B' : 'A-B'}</span>
          </button>

          {/* Shuffle Toggle Button */}
          <button
            className={`vlc-btn ${shuffle ? 'active' : ''}`}
            title={shuffle ? 'Shuffle: On' : 'Shuffle: Off'}
            aria-label="Shuffle"
            onClick={onToggleShuffle}
          >
            <Shuffle size={14} />
          </button>

          {/* Volume Group */}
          <div className="vlc-volume-group">
            <button
              className="vlc-btn"
              title="Mute / Unmute (M)"
              aria-label="Mute"
              onClick={() => call('mute')}
            >
              {s.muted || s.volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <div className="vlc-volume-slider-box" title={`Volume: ${s.volume}%`}>
              <input
                className={`vlc-volume-slider ${s.volume > 100 ? 'boosted' : ''}`}
                aria-label="Volume"
                type="range"
                min="0"
                max="150"
                value={s.volume}
                onChange={e => call('volume', Number(e.target.value))}
              />
            </div>
            <span className={`mono vlc-vol-text ${s.volume > 100 ? 'boosted' : ''}`}>
              {s.volume}%
            </span>
          </div>
        </div>

        {/* CENTER GROUP: Now Playing Title */}
        <div className="vlc-control-group group-center">
          {current ? (
            <div className="vlc-now-playing-pill" title={current.path}>
              <span className="mono chip-ext">{current.name.split('.').pop()?.toUpperCase()}</span>
              <span className="title-text">{mediaTitle(p.title || current.name)}</span>
              {p.artist && <span className="artist-text">· {p.artist}</span>}
            </div>
          ) : (
            <span className="vlc-idle-text">Drop media or open file (⌘O)</span>
          )}
        </div>

        {/* RIGHT GROUP: VLC Audio/Subtitle/Aspect/Speed/Effects Popovers */}
        <div className="vlc-control-group group-right">
          {/* Audio Tracks Popover Button */}
          <div className="vlc-popover-anchor">
            <button
              className={`vlc-btn ${activePopover === 'audio' ? 'active' : ''}`}
              title="Audio Tracks & Delay"
              aria-label="Audio Tracks"
              onClick={() => setActivePopover(prev => prev === 'audio' ? null : 'audio')}
            >
              <AudioLines size={15} />
            </button>

            {activePopover === 'audio' && (
              <div className="vlc-popover-menu">
                <div className="popover-title">Audio Tracks</div>
                <div className="popover-list">
                  {p.audio_tracks.length ? (
                    p.audio_tracks.map(t => (
                      <button
                        key={t.id}
                        className={`popover-item ${p.audio_track === t.id ? 'selected' : ''}`}
                        onClick={() => {
                          void call('audio', t.id);
                          setActivePopover(null);
                        }}
                      >
                        {p.audio_track === t.id && <Check size={13} className="item-check" />}
                        <span>{t.name}</span>
                      </button>
                    ))
                  ) : (
                    <div className="popover-empty">Default audio track</div>
                  )}
                </div>

                <div className="popover-divider" />
                <div className="popover-sync-row">
                  <span>Lipsync Delay:</span>
                  <div className="sync-nudge-group">
                    <button className="sync-btn" onClick={() => onAudioDelayChange(audioDelay - 50)}>-50ms</button>
                    <span className="mono sync-val">{audioDelay > 0 ? `+${audioDelay}` : audioDelay}ms</span>
                    <button className="sync-btn" onClick={() => onAudioDelayChange(audioDelay + 50)}>+50ms</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Subtitles Popover Button */}
          <div className="vlc-popover-anchor">
            <button
              className={`vlc-btn ${activePopover === 'subtitle' ? 'active' : ''}`}
              title="Subtitles & Delay"
              aria-label="Subtitles"
              onClick={() => setActivePopover(prev => prev === 'subtitle' ? null : 'subtitle')}
            >
              <Subtitles size={15} />
            </button>

            {activePopover === 'subtitle' && (
              <div className="vlc-popover-menu">
                <div className="popover-title">Subtitle Tracks</div>
                <div className="popover-list">
                  <button
                    className={`popover-item ${p.subtitle_track === -1 ? 'selected' : ''}`}
                    onClick={() => {
                      void call('subtitle', -1);
                      setActivePopover(null);
                    }}
                  >
                    {p.subtitle_track === -1 && <Check size={13} className="item-check" />}
                    <span>Disable Subtitles</span>
                  </button>
                  {p.subtitle_tracks.map(t => (
                    <button
                      key={t.id}
                      className={`popover-item ${p.subtitle_track === t.id ? 'selected' : ''}`}
                      onClick={() => {
                        void call('subtitle', t.id);
                        setActivePopover(null);
                      }}
                    >
                      {p.subtitle_track === t.id && <Check size={13} className="item-check" />}
                      <span>{t.name}</span>
                    </button>
                  ))}
                </div>

                <div className="popover-divider" />
                <button
                  className="popover-action-btn"
                  onClick={() => {
                    player.subtitles();
                    setActivePopover(null);
                  }}
                >
                  <Plus size={13} /> Load Subtitle File (.srt, .vtt)
                </button>

                <div className="popover-divider" />
                <div className="popover-sync-row">
                  <span>Subtitle Delay:</span>
                  <div className="sync-nudge-group">
                    <button className="sync-btn" onClick={() => onSubDelayChange(subDelay - 50)}>-50ms</button>
                    <span className="mono sync-val">{subDelay > 0 ? `+${subDelay}` : subDelay}ms</span>
                    <button className="sync-btn" onClick={() => onSubDelayChange(subDelay + 50)}>+50ms</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Aspect & Crop Popover Button */}
          <div className="vlc-popover-anchor">
            <button
              className={`vlc-btn ${activePopover === 'aspect' ? 'active' : ''}`}
              title="Aspect & Crop"
              aria-label="Aspect and Crop"
              onClick={() => setActivePopover(prev => prev === 'aspect' ? null : 'aspect')}
            >
              <Crop size={15} />
            </button>

            {activePopover === 'aspect' && (
              <div className="vlc-popover-menu">
                <div className="popover-title">Aspect Ratio</div>
                <div className="popover-list">
                  {[
                    {id: '', label: 'Original Ratio'},
                    {id: '16:9', label: '16:9 Widescreen'},
                    {id: '16:10', label: '16:10 Monitor'},
                    {id: '4:3', label: '4:3 Classic TV'},
                    {id: '1:1', label: '1:1 Square'},
                    {id: '2.35:1', label: '2.35:1 CinemaScope'},
                    {id: '21:9', label: '21:9 UltraWide'}
                  ].map(a => (
                    <button
                      key={a.id}
                      className={`popover-item ${s.aspect === a.id ? 'selected' : ''}`}
                      onClick={() => {
                        void call('aspect', undefined, a.id);
                        setActivePopover(null);
                      }}
                    >
                      {s.aspect === a.id && <Check size={13} className="item-check" />}
                      <span>{a.label}</span>
                    </button>
                  ))}
                </div>

                <div className="popover-divider" />
                <div className="popover-title">Video Crop</div>
                <div className="popover-list">
                  {[
                    {id: 'none', label: 'No Crop (Fit)'},
                    {id: 'fill', label: 'Fill Window (Stretch)'},
                    {id: '16:9', label: 'Crop 16:9'},
                    {id: '4:3', label: 'Crop 4:3'},
                    {id: '2.35:1', label: 'Crop 2.35:1'}
                  ].map(c => (
                    <button
                      key={c.id}
                      className={`popover-item ${cropRatio === c.id ? 'selected' : ''}`}
                      onClick={() => {
                        onSetCropRatio(c.id);
                        setActivePopover(null);
                      }}
                    >
                      {cropRatio === c.id && <Check size={13} className="item-check" />}
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Speed Popover Button */}
          <div className="vlc-popover-anchor">
            <button
              className={`vlc-btn mono ${activePopover === 'speed' ? 'active' : ''}`}
              title="Playback Speed ([ / ])"
              aria-label="Speed"
              onClick={() => setActivePopover(prev => prev === 'speed' ? null : 'speed')}
            >
              {s.rate.toFixed(s.rate % 1 ? 2 : 1)}×
            </button>

            {activePopover === 'speed' && (
              <div className="vlc-popover-menu speed-menu">
                <div className="popover-title">Playback Speed</div>
                <div className="popover-grid">
                  {[0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 3.0, 4.0].map(r => (
                    <button
                      key={r}
                      className={`speed-grid-btn mono ${s.rate === r ? 'active' : ''}`}
                      onClick={() => {
                        void call('rate', r);
                        setActivePopover(null);
                      }}
                    >
                      {r.toFixed(r % 1 ? 2 : 1)}×
                    </button>
                  ))}
                </div>
                <button
                  className="popover-action-btn"
                  onClick={() => {
                    void call('rate', 1.0);
                    setActivePopover(null);
                  }}
                >
                  Reset Speed (1.0×)
                </button>
              </div>
            )}
          </div>

          {/* Jump to Time Button (⌘T) */}
          <button
            className="vlc-btn"
            title="Jump to Time (⌘T)"
            aria-label="Jump to Time"
            disabled={!current}
            onClick={onOpenJump}
          >
            <Clock size={15} />
          </button>

          {/* Bookmarks Manager (⌘B) */}
          <button
            className="vlc-btn"
            title="Bookmarks (⌘B)"
            aria-label="Bookmarks"
            disabled={!current}
            onClick={onOpenBookmarks}
          >
            <Bookmark size={15} />
          </button>

          {/* Snapshot Button (⌘⌥S) */}
          {isVideo && (
            <button
              className="vlc-btn"
              title="Snapshot (⌘S)"
              aria-label="Snapshot"
              disabled={!current}
              onClick={onSnapshot}
            >
              <Camera size={15} />
            </button>
          )}

          {/* Audio & Video Effects Button (⌘E) */}
          <button
            className="vlc-btn"
            title="Audio & Video Effects (⌘E)"
            aria-label="Effects"
            onClick={onOpenEffects}
          >
            <Sliders size={15} />
          </button>

          {/* Playlist View Toggle Button (⌘L) */}
          <button
            className={`vlc-btn ${viewMode === 'playlist' ? 'active' : ''}`}
            title="Toggle Playlist View (⌘L)"
            aria-label="Playlist View"
            onClick={onToggleViewMode}
          >
            <ListMusic size={16} />
            {s.playlist.length > 0 && <span className="vlc-badge">{s.playlist.length}</span>}
          </button>

          {/* Fullscreen Button (F) */}
          <button
            className="vlc-btn"
            title="Toggle Fullscreen (F)"
            aria-label="Fullscreen"
            disabled={!player.native}
            onClick={() => player.fullscreen()}
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>
    </footer>
  );
}

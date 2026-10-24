import brandSymbol from '../assets/brand/relayn-symbol-sage.svg';
import {useEffect, useRef, useState, useMemo, useCallback} from 'react';
import {
  Bookmark as BookmarkIcon,
  Clock,
  Disc3,
  FolderOpen,
  Info,
  ListMusic,
  Settings2,
  Sliders,
  X
} from 'lucide-react';
import {
  formatTime,
  initialVideoAdjustments,
  EQUALIZER_PRESETS,
  type VideoAdjustments,
  type Bookmark
} from './player';
import {extension, mediaKind, mediaTitle, parentFolder} from './media';
import {useNativeSurface, usePlayer, usePlayerKeys, webObjectUrls} from './usePlayer';
import Transport from './components/Transport';
import Queue from './components/Queue';
import {IdleArtwork, MediaArtwork} from './components/Artwork';
import EffectsModal from './components/EffectsModal';
import JumpModal from './components/JumpModal';
import BookmarksModal from './components/BookmarksModal';
import HudToast from './components/HudToast';

type Panel = 'settings' | 'info' | 'effects' | 'jump' | 'bookmarks' | null;

export default function App() {
  const player = usePlayer();
  const {state, call, open, fullscreen, dragging} = player;
  const {playback: p, settings: s} = state;
  const current = s.playlist.find(i => i.id === s.current);
  const isAudio = current ? mediaKind(current.name) === 'audio' : false;
  const isPlaying = p.state === 'playing';

  // Modal / panel states
  const [panel, setPanel] = useState<Panel>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const overlayTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);

  // VLC Features State
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const [audioDelay, setAudioDelay] = useState(0);
  const [subDelay, setSubDelay] = useState(0);
  const [adjustments, setAdjustments] = useState<VideoAdjustments>(initialVideoAdjustments);
  const [equalizerPreset, setEqualizerPreset] = useState<string>('flat');
  const [equalizerBands, setEqualizerBands] = useState<number[]>([...EQUALIZER_PRESETS.flat.bands]);
  const [cropRatio, setCropRatio] = useState<string>('none');
  const [shuffle, setShuffle] = useState(false);
  const [hudMessage, setHudMessage] = useState<string | null>(null);

  // Bookmarks state persisted in localStorage
  const [allBookmarks, setAllBookmarks] = useState<Record<string, Bookmark[]>>(() => {
    try {
      const saved = localStorage.getItem('relayn_bookmarks');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const currentBookmarks = useMemo(() => {
    return (current?.path && allBookmarks[current.path]) || [];
  }, [allBookmarks, current?.path]);

  const addBookmark = useCallback((timeMs: number, label: string) => {
    if (!current?.path) return;
    const item: Bookmark = {
      id: Math.random().toString(36).substring(2, 9),
      time: timeMs,
      label
    };
    setAllBookmarks(prev => {
      const updated = {
        ...prev,
        [current.path]: [...(prev[current.path] || []), item].sort((a, b) => a.time - b.time)
      };
      try {
        localStorage.setItem('relayn_bookmarks', JSON.stringify(updated));
      } catch {
        // Storage quota
      }
      return updated;
    });
    setHudMessage(`Bookmark saved: "${label}"`);
  }, [current?.path]);

  const deleteBookmark = useCallback((id: string) => {
    if (!current?.path) return;
    setAllBookmarks(prev => {
      const updated = {
        ...prev,
        [current.path]: (prev[current.path] || []).filter(b => b.id !== id)
      };
      try {
        localStorage.setItem('relayn_bookmarks', JSON.stringify(updated));
      } catch {
        // Storage quota
      }
      return updated;
    });
  }, [current?.path]);

  // A-B Loop handler
  const handleToggleAbLoop = useCallback(() => {
    if (loopA === null) {
      setLoopA(p.time);
      setHudMessage(`A-B Loop: Point A set (${formatTime(p.time)})`);
    } else if (loopB === null) {
      const bTime = Math.max(loopA + 500, p.time);
      setLoopB(bTime);
      setHudMessage(`A-B Loop: Active (${formatTime(loopA)} → ${formatTime(bTime)})`);
    } else {
      setLoopA(null);
      setLoopB(null);
      setHudMessage('A-B Loop: Cleared');
    }
  }, [loopA, loopB, p.time]);

  // A-B Loop playback enforcement
  useEffect(() => {
    if (loopA !== null && loopB !== null && loopB > loopA) {
      if (p.time >= loopB) {
        void call('seek', loopA);
      }
    }
  }, [p.time, loopA, loopB, call]);

  // Clear A-B loop when track changes
  useEffect(() => {
    setLoopA(null);
    setLoopB(null);
  }, [s.current]);

  // Snapshot handler
  const handleSnapshot = useCallback(async () => {
    try {
      await call('snapshot');
      setHudMessage('Snapshot saved to Pictures folder');
    } catch {
      setHudMessage('Snapshot captured');
    }
  }, [call]);

  // Step Frame forward
  const handleStepFrame = useCallback(() => {
    void call('step_frame');
    setHudMessage('Frame Step Forward');
  }, [call]);

  // Audio delay change
  const handleAudioDelayChange = useCallback((val: number) => {
    setAudioDelay(val);
    void call('audio_delay', val);
    setHudMessage(`Audio Delay: ${val > 0 ? `+${val}` : val} ms`);
  }, [call]);

  // Subtitle delay change
  const handleSubDelayChange = useCallback((val: number) => {
    setSubDelay(val);
    void call('subtitle_delay', val);
    setHudMessage(`Subtitle Delay: ${val > 0 ? `+${val}` : val} ms`);
  }, [call]);

  // Custom action handler for shortcuts
  const handleCustomAction = useCallback((cmd: string): boolean => {
    if (cmd === 'toggle_ab_loop') {
      handleToggleAbLoop();
      return true;
    }
    if (cmd === 'step_frame') {
      handleStepFrame();
      return true;
    }
    if (cmd === 'snapshot') {
      void handleSnapshot();
      return true;
    }
    if (cmd === 'jump_to_time') {
      setPanel('jump');
      return true;
    }
    if (cmd === 'toggle_bookmarks') {
      setPanel(prev => prev === 'bookmarks' ? null : 'bookmarks');
      return true;
    }
    if (cmd === 'toggle_effects') {
      setPanel(prev => prev === 'effects' ? null : 'effects');
      return true;
    }
    if (cmd === 'audio_delay_down') {
      handleAudioDelayChange(audioDelay - 50);
      return true;
    }
    if (cmd === 'audio_delay_up') {
      handleAudioDelayChange(audioDelay + 50);
      return true;
    }
    if (cmd === 'subtitle_delay_down') {
      handleSubDelayChange(subDelay - 50);
      return true;
    }
    if (cmd === 'subtitle_delay_up') {
      handleSubDelayChange(subDelay + 50);
      return true;
    }
    if (cmd === 'cycle_crop') {
      const crops = ['none', 'fill', '16:9', '4:3', '2.35:1'];
      const next = crops[(crops.indexOf(cropRatio) + 1) % crops.length];
      setCropRatio(next);
      setHudMessage(`Crop: ${next}`);
      return true;
    }
    return false;
  }, [
    handleToggleAbLoop,
    handleStepFrame,
    handleSnapshot,
    audioDelay,
    handleAudioDelayChange,
    subDelay,
    handleSubDelayChange,
    cropRatio
  ]);

  // Native surface hook: active when there is a current video item and no full-page modal covers the surface
  const isCovered = panel === 'settings' || panel === 'effects' || panel === 'jump' || panel === 'bookmarks';
  const videoRef = useNativeSurface(player, !isAudio && !!current, isCovered);

  // Keyboard shortcuts integration
  usePlayerKeys(
    player,
    () => void fullscreen(),
    () => setQueueOpen(prev => !prev),
    handleCustomAction
  );

  // Sync web video element with usePlayer
  useEffect(() => {
    if (!player.native && webVideoRef.current) {
      player.setWebVideoRef(webVideoRef.current);
    }
  }, [player.native, player.setWebVideoRef, current]);

  // Auto-hide controls overlay on video during playback
  const handleMouseMove = () => {
    setShowOverlay(true);
    if (overlayTimeout.current) clearTimeout(overlayTimeout.current);
    if (isPlaying && !isAudio) {
      overlayTimeout.current = setTimeout(() => {
        setShowOverlay(false);
      }, 2500);
    }
  };

  const togglePlayback = () => {
    if (!current) {
      void open(true);
    } else {
      void call('toggle');
    }
  };

  // Video filter CSS string
  const videoFilterStyle = useMemo(() => {
    const filters = [
      `brightness(${1 + adjustments.brightness / 100})`,
      `contrast(${adjustments.contrast / 100})`,
      `saturate(${adjustments.saturation / 100})`,
      `hue-rotate(${adjustments.hue}deg)`
    ];
    if (adjustments.invert) filters.push('invert(1)');
    return {
      filter: filters.join(' ')
    };
  }, [adjustments]);

  return (
    <div
      className={`app ${dragging ? 'is-dragging' : ''}`}
      onMouseMove={handleMouseMove}
      onDragOver={e => e.preventDefault()}
    >
      {/* ================= TOP HEADER ================= */}
      <header className="topbar">
        <div className="brand-group">
          <div className="brand-logo">
            <img src={brandSymbol} alt="" width="22" height="22" />
          </div>
          <div className="brand-title">
            <span>RelayN</span>
            <span className={`status-dot ${isPlaying ? 'live' : ''}`} title={isPlaying ? 'Playing' : 'Ready'} />
          </div>
        </div>

        {/* Center Now-Playing Title */}
        <div className="header-now-playing">
          {current ? (
            <div className="now-playing-pill" title={current.path}>
              <span className="mono chip-ext">{extension(current.name).toUpperCase()}</span>
              <span className="now-playing-name">{mediaTitle(p.title || current.name)}</span>
              {p.artist && <span className="now-playing-sub">· {p.artist}</span>}
            </div>
          ) : (
            <span className="header-tagline">Your media. In motion.</span>
          )}
        </div>

        {/* Header Action Tools */}
        <div className="header-actions">
          <button
            className="icon-button"
            title="Open media file (⌘O)"
            aria-label="Open media file"
            onClick={() => open(true)}
          >
            <FolderOpen size={17} />
          </button>

          <button
            className={`icon-button ${panel === 'jump' ? 'active' : ''}`}
            title="Jump to time (⌘T)"
            aria-label="Jump to time"
            disabled={!current}
            onClick={() => setPanel(p => p === 'jump' ? null : 'jump')}
          >
            <Clock size={17} />
          </button>

          <button
            className={`icon-button ${panel === 'bookmarks' ? 'active' : ''}`}
            title="Bookmarks (⌘B)"
            aria-label="Bookmarks"
            disabled={!current}
            onClick={() => setPanel(p => p === 'bookmarks' ? null : 'bookmarks')}
          >
            <BookmarkIcon size={17} />
            {currentBookmarks.length > 0 && (
              <span className="badge-count">{currentBookmarks.length}</span>
            )}
          </button>

          <button
            className={`icon-button ${panel === 'effects' ? 'active' : ''}`}
            title="Effects & Equalizer (⌘E)"
            aria-label="Effects and Equalizer"
            onClick={() => setPanel(p => p === 'effects' ? null : 'effects')}
          >
            <Sliders size={17} />
          </button>

          <button
            className={`icon-button ${queueOpen ? 'active' : ''}`}
            title="Play queue (⌘L)"
            aria-label="Toggle play queue"
            onClick={() => setQueueOpen(q => !q)}
          >
            <ListMusic size={17} />
            {s.playlist.length > 0 && <span className="badge-count">{s.playlist.length}</span>}
          </button>

          <button
            className={`icon-button ${panel === 'info' ? 'active' : ''}`}
            title="File details"
            aria-label="File details"
            disabled={!current}
            onClick={() => setPanel(p => p === 'info' ? null : 'info')}
          >
            <Info size={17} />
          </button>

          <button
            className={`icon-button ${panel === 'settings' ? 'active' : ''}`}
            title="Shortcuts & settings (⌘,)"
            aria-label="Settings"
            onClick={() => setPanel(p => p === 'settings' ? null : 'settings')}
          >
            <Settings2 size={17} />
          </button>
        </div>
      </header>

      {/* Error Toast / Alert Banner */}
      {player.error && (
        <div className="error-toast" role="alert">
          <span>{player.error}</span>
          <button className="icon-button small" aria-label="Dismiss error" onClick={player.dismiss}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ================= MAIN WORKSPACE ================= */}
      <main className="workspace-main">
        <div className="stage-container">
          {/* HUD On-Screen Display Overlay */}
          <HudToast message={hudMessage} onClear={() => setHudMessage(null)} />

          {/* Empty State / Dropzone */}
          {!current ? (
            <div className="empty-dropzone" onClick={() => open(true)}>
              <div className="dropzone-halo">
                <IdleArtwork />
              </div>
              <div className="dropzone-content">
                <h2>Your media starts here.</h2>
                <p>Open an audio or video file from your device to begin playback.</p>
                <button className="button primary" onClick={e => { e.stopPropagation(); open(true); }}>
                  <FolderOpen size={16} /> Open media file <span className="kbd-hint">⌘O</span>
                </button>
                <div className="dropzone-formats">
                  <span>MP4</span><span>MKV</span><span>FLAC</span><span>WAV</span><span>WebM</span><span>AVI</span><span>MOV</span><span>ProRes</span>
                </div>
              </div>
            </div>
          ) : isAudio ? (
            /* Pure Audio Experience */
            <div className="audio-stage">
              <div className={`audio-disc-wrapper ${isPlaying ? 'is-playing' : ''}`}>
                <div className="vinyl-grooves">
                  <Disc3 size={110} strokeWidth={0.5} />
                </div>
                <div className="vinyl-center">
                  <MediaArtwork name={current.name} playing={isPlaying} />
                </div>
              </div>

              <div className="audio-meta">
                <span className="mono chip-format">{extension(current.name).toUpperCase()} AUDIO</span>
                <h1>{mediaTitle(p.title || current.name)}</h1>
                <p className="audio-artist">{p.artist || parentFolder(current.path)}</p>
                {p.album && <p className="audio-album">{p.album}</p>}

                {/* Live Audio Waves */}
                <div className={`live-wave-bars ${isPlaying ? 'animate' : ''}`}>
                  <span /><span /><span /><span /><span />
                </div>
              </div>
            </div>
          ) : (
            /* True Native / Web Video Stage */
            <div
              className={`video-stage crop-${cropRatio}`}
              onClick={togglePlayback}
              onDoubleClick={() => fullscreen()}
            >
              {/* Native video handle container with real-time video adjustments */}
              <div ref={videoRef} className={`native-video-box crop-${cropRatio}`} style={videoFilterStyle}>
                {/* In browser fallback preview mode, render HTML5 video element */}
                {!player.native && (
                  <video
                    ref={webVideoRef}
                    className="html-video-element"
                    src={webObjectUrls.get(current.id) || current.path}
                    playsInline
                    style={videoFilterStyle}
                  />
                )}
              </div>

              {/* Video Hover Floating Bar */}
              <div className={`video-overlay-header ${showOverlay ? 'visible' : 'hidden'}`}>
                <span className="video-title">{mediaTitle(p.title || current.name)}</span>
                <span className="mono video-time">
                  {formatTime(p.time)} / {p.duration > 0 ? formatTime(p.duration) : '—'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ================= SLIDE-OUT PLAY QUEUE DRAWER ================= */}
        {queueOpen && (
          <aside className="drawer-panel queue-drawer">
            <Queue player={player} close={() => setQueueOpen(false)} />
          </aside>
        )}

        {/* ================= SLIDE-OUT FILE INSPECTOR DRAWER ================= */}
        {panel === 'info' && current && (
          <aside className="drawer-panel inspector-drawer">
            <div className="drawer-header">
              <h3>File Inspector</h3>
              <button className="icon-button small" aria-label="Close inspector" onClick={() => setPanel(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="inspector-body">
              <div className="inspector-item">
                <span className="mono label">FILE NAME</span>
                <strong className="value">{current.name}</strong>
              </div>
              <div className="inspector-item">
                <span className="mono label">FORMAT</span>
                <span className="value chip">{extension(current.name).toUpperCase()}</span>
              </div>
              <div className="inspector-item">
                <span className="mono label">DURATION</span>
                <span className="value mono">{p.duration > 0 ? formatTime(p.duration) : '—'}</span>
              </div>
              <div className="inspector-item">
                <span className="mono label">AUDIO TRACKS</span>
                <span className="value">{p.audio_tracks.filter(t => t.id >= 0).length} stream(s)</span>
              </div>
              <div className="inspector-item">
                <span className="mono label">SUBTITLE TRACKS</span>
                <span className="value">{p.subtitle_tracks.filter(t => t.id >= 0).length} stream(s)</span>
              </div>
              <div className="inspector-item">
                <span className="mono label">AUDIO DELAY</span>
                <span className="value mono">{audioDelay} ms</span>
              </div>
              <div className="inspector-item">
                <span className="mono label">SUBTITLE DELAY</span>
                <span className="value mono">{subDelay} ms</span>
              </div>
              <div className="inspector-item">
                <span className="mono label">ENGINE</span>
                <span className="value mono">{state.runtime}</span>
              </div>
              <div className="inspector-item">
                <span className="mono label">LOCATION</span>
                <code className="path-code">{current.path}</code>
              </div>
            </div>
          </aside>
        )}
      </main>

      {/* ================= BOTTOM TRANSPORT CONTROLS DOCK ================= */}
      <Transport
        player={player}
        toggleQueue={() => setQueueOpen(q => !q)}
        queueOpen={queueOpen}
        loopA={loopA}
        loopB={loopB}
        onToggleAbLoop={handleToggleAbLoop}
        onOpenEffects={() => setPanel('effects')}
        onOpenBookmarks={() => setPanel('bookmarks')}
        onOpenJump={() => setPanel('jump')}
        onSnapshot={handleSnapshot}
        onStepFrame={handleStepFrame}
        shuffle={shuffle}
        onToggleShuffle={() => {
          setShuffle(prev => {
            const next = !prev;
            setHudMessage(`Shuffle: ${next ? 'On' : 'Off'}`);
            return next;
          });
        }}
        cropRatio={cropRatio}
        onSetCropRatio={ratio => {
          setCropRatio(ratio);
          setHudMessage(`Crop: ${ratio}`);
        }}
      />

      {/* ================= EFFECTS & EQUALIZER MODAL ================= */}
      {panel === 'effects' && (
        <EffectsModal
          player={player}
          adjustments={adjustments}
          setAdjustments={setAdjustments}
          audioDelay={audioDelay}
          setAudioDelay={handleAudioDelayChange}
          subDelay={subDelay}
          setSubDelay={handleSubDelayChange}
          equalizerBands={equalizerBands}
          setEqualizerBands={setEqualizerBands}
          equalizerPreset={equalizerPreset}
          setEqualizerPreset={setEqualizerPreset}
          onClose={() => setPanel(null)}
        />
      )}

      {/* ================= JUMP TO TIME MODAL ================= */}
      {panel === 'jump' && (
        <JumpModal
          currentTimeMs={p.time}
          durationMs={p.duration}
          onJump={timeMs => {
            void call('seek', timeMs);
            setHudMessage(`Jumped to ${formatTime(timeMs)}`);
          }}
          onClose={() => setPanel(null)}
        />
      )}

      {/* ================= BOOKMARKS MODAL ================= */}
      {panel === 'bookmarks' && current && (
        <BookmarksModal
          filePath={current.path}
          currentTimeMs={p.time}
          bookmarks={currentBookmarks}
          onAddBookmark={addBookmark}
          onDeleteBookmark={deleteBookmark}
          onSeek={timeMs => {
            void call('seek', timeMs);
            setHudMessage(`Jumped to bookmark (${formatTime(timeMs)})`);
          }}
          onClose={() => setPanel(null)}
        />
      )}

      {/* ================= SETTINGS & SHORTCUTS MODAL ================= */}
      {panel === 'settings' && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setPanel(null); }}>
          <div className="modal modal-settings" role="dialog" aria-modal="true" aria-label="Settings and shortcuts">
            <div className="modal-header">
              <h2>Keyboard Shortcuts & VLC Controls</h2>
              <button className="icon-button" aria-label="Close" onClick={() => setPanel(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="shortcuts-table">
              <div className="shortcut-row">
                <span>Play / Pause</span>
                <kbd>Space</kbd>
              </div>
              <div className="shortcut-row">
                <span>Seek ±10s / ±60s</span>
                <kbd>← / → / ⇧← / ⇧→</kbd>
              </div>
              <div className="shortcut-row">
                <span>Volume Up / Down (up to 150%)</span>
                <kbd>↑ / ↓</kbd>
              </div>
              <div className="shortcut-row">
                <span>Next Video Frame</span>
                <kbd>E</kbd>
              </div>
              <div className="shortcut-row">
                <span>Playback Speed Slower / Faster</span>
                <kbd>[ / ]</kbd>
              </div>
              <div className="shortcut-row">
                <span>Reset Playback Speed (1.0×)</span>
                <kbd>=</kbd>
              </div>
              <div className="shortcut-row">
                <span>A-B Repeat Loop (Set A → Set B → Clear)</span>
                <kbd>L</kbd>
              </div>
              <div className="shortcut-row">
                <span>Audio Delay ±50ms (Lipsync)</span>
                <kbd>J / K</kbd>
              </div>
              <div className="shortcut-row">
                <span>Subtitle Delay ±50ms</span>
                <kbd>H / G</kbd>
              </div>
              <div className="shortcut-row">
                <span>Jump to Time</span>
                <kbd>⌘ T</kbd>
              </div>
              <div className="shortcut-row">
                <span>Bookmarks Manager</span>
                <kbd>⌘ B</kbd>
              </div>
              <div className="shortcut-row">
                <span>Audio Equalizer & Video Effects</span>
                <kbd>⌘ E</kbd>
              </div>
              <div className="shortcut-row">
                <span>Capture Snapshot</span>
                <kbd>⌘ S</kbd>
              </div>
              <div className="shortcut-row">
                <span>Mute / Unmute</span>
                <kbd>M</kbd>
              </div>
              <div className="shortcut-row">
                <span>Toggle Fullscreen</span>
                <kbd>F</kbd>
              </div>
              <div className="shortcut-row">
                <span>Cycle Aspect Ratio</span>
                <kbd>A</kbd>
              </div>
              <div className="shortcut-row">
                <span>Cycle Crop Ratio</span>
                <kbd>C</kbd>
              </div>
              <div className="shortcut-row">
                <span>Cycle Audio / Subtitle Track</span>
                <kbd>B / V</kbd>
              </div>
            </div>

            <div className="modal-footer">
              <span className="mono muted">RELAYN PLAYER · HIGH EFFICIENCY LIBVLC ENGINE</span>
              <button className="button secondary" onClick={() => setPanel(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

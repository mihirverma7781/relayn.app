import brandSymbol from '../assets/brand/relayn-symbol-sage.svg';
import {useEffect, useRef, useState, useMemo, useCallback} from 'react';
import {
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
import PlaylistView from './components/PlaylistView';
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

  // Primary view mode: 'video' (default cinema) or 'playlist' (VLC media library mode)
  const [viewMode, setViewMode] = useState<'video' | 'playlist'>('video');

  // Dialog panels
  const [panel, setPanel] = useState<Panel>(null);

  // Auto-hiding controls overlay
  const [showControls, setShowControls] = useState(true);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Bookmarks stored in localStorage
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
      } catch {}
      return updated;
    });
    setHudMessage(`Bookmark added at ${formatTime(timeMs)}`);
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
      } catch {}
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

  // Enforce A-B loop boundary
  useEffect(() => {
    if (loopA !== null && loopB !== null && loopB > loopA) {
      if (p.time >= loopB) {
        void call('seek', loopA);
      }
    }
  }, [p.time, loopA, loopB, call]);

  // Clear loop on track change
  useEffect(() => {
    setLoopA(null);
    setLoopB(null);
  }, [s.current]);

  // Snapshot handler
  const handleSnapshot = useCallback(async () => {
    try {
      await call('snapshot');
      setHudMessage('Snapshot captured to Pictures');
    } catch {
      setHudMessage('Snapshot saved');
    }
  }, [call]);

  // Frame step handler
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

  // Toggle View Mode (Video vs. Playlist)
  const handleToggleViewMode = useCallback(() => {
    setViewMode(prev => prev === 'video' ? 'playlist' : 'video');
  }, []);

  // Keyboard shortcut command dispatcher
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

  // Native video surface active condition:
  // Active only when in 'video' mode, not audio, and not covered by full modal dialog
  const isCovered = panel !== null;
  const isSurfaceActive = viewMode === 'video' && !isAudio && !!current;
  const videoRef = useNativeSurface(player, isSurfaceActive, isCovered);

  // Keyboard shortcuts
  usePlayerKeys(
    player,
    () => void fullscreen(),
    handleToggleViewMode,
    handleCustomAction
  );

  // Sync web video element with fallback
  useEffect(() => {
    if (!player.native && webVideoRef.current) {
      player.setWebVideoRef(webVideoRef.current);
    }
  }, [player.native, player.setWebVideoRef, current]);

  // Mouse activity auto-hiding for cinema mode
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    if (isPlaying && viewMode === 'video' && !isAudio && panel === null) {
      controlsTimer.current = setTimeout(() => {
        setShowControls(false);
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

  // Video adjustments filter style
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
      className={`vlc-app-shell ${dragging ? 'is-dragging' : ''}`}
      onMouseMove={handleMouseMove}
      onDragOver={e => e.preventDefault()}
    >
      {/* ================= TOP APPLICATION HEADER ================= */}
      <header className={`vlc-top-header ${showControls || viewMode === 'playlist' ? 'visible' : 'autohide'}`}>
        <div className="vlc-brand-group" onClick={handleToggleViewMode} title="Toggle Playlist / Player (⌘L)">
          <img src={brandSymbol} alt="" width="20" height="20" />
          <span className="brand-text">RelayN</span>
          <span className={`status-dot ${isPlaying ? 'live' : ''}`} title={isPlaying ? 'Playing' : 'Ready'} />
        </div>

        {/* Center Title Pill */}
        <div className="vlc-header-title">
          {current ? (
            <div className="header-media-badge" title={current.path}>
              <span className="mono format-chip">{extension(current.name).toUpperCase()}</span>
              <span className="title-str">{mediaTitle(p.title || current.name)}</span>
              {p.artist && <span className="artist-str">· {p.artist}</span>}
            </div>
          ) : (
            <span className="header-idle-tagline">RelayN Player</span>
          )}
        </div>

        {/* Header Tools */}
        <div className="vlc-header-actions">
          <button
            className="header-btn"
            title="Open media file (⌘O)"
            aria-label="Open Media"
            onClick={() => void open(true)}
          >
            <FolderOpen size={16} />
          </button>

          <button
            className={`header-btn ${panel === 'effects' ? 'active' : ''}`}
            title="Audio & Video Effects (⌘E)"
            aria-label="Effects"
            onClick={() => setPanel(p => p === 'effects' ? null : 'effects')}
          >
            <Sliders size={16} />
          </button>

          <button
            className={`header-btn ${viewMode === 'playlist' ? 'active' : ''}`}
            title="Toggle Playlist (⌘L)"
            aria-label="Playlist"
            onClick={handleToggleViewMode}
          >
            <ListMusic size={16} />
            {s.playlist.length > 0 && <span className="btn-badge">{s.playlist.length}</span>}
          </button>

          <button
            className={`header-btn ${panel === 'info' ? 'active' : ''}`}
            title="Media Information (⌘I)"
            aria-label="Info"
            disabled={!current}
            onClick={() => setPanel(p => p === 'info' ? null : 'info')}
          >
            <Info size={16} />
          </button>

          <button
            className={`header-btn ${panel === 'settings' ? 'active' : ''}`}
            title="Preferences & Shortcuts (⌘,)"
            aria-label="Settings"
            onClick={() => setPanel(p => p === 'settings' ? null : 'settings')}
          >
            <Settings2 size={16} />
          </button>
        </div>
      </header>

      {/* ================= MAIN CONTENT AREA ================= */}
      <main className="vlc-main-stage">
        {/* HUD On-Screen Display Overlay */}
        <HudToast message={hudMessage} onClear={() => setHudMessage(null)} />

        {/* VIEW 1: Playlist / Library Mode */}
        {viewMode === 'playlist' ? (
          <PlaylistView
            player={player}
            onClose={() => setViewMode('video')}
            shuffle={shuffle}
            onToggleShuffle={() => {
              setShuffle(prev => {
                const next = !prev;
                setHudMessage(`Shuffle: ${next ? 'On' : 'Off'}`);
                return next;
              });
            }}
          />
        ) : !current ? (
          /* Empty Dropzone / Welcome Mode */
          <div className="vlc-dropzone" onClick={() => void open(true)}>
            <div className="dropzone-halo">
              <IdleArtwork />
            </div>
            <div className="dropzone-text-group">
              <h2>Open media to begin</h2>
              <p>Drop video or audio files here, or browse from your computer.</p>
              <button
                className="button primary"
                onClick={e => {
                  e.stopPropagation();
                  void open(true);
                }}
              >
                <FolderOpen size={16} /> Open media file <span className="kbd-hint">⌘O</span>
              </button>
              <div className="dropzone-codecs">
                <span>MP4</span><span>MKV</span><span>HEVC</span><span>AV1</span><span>ProRes</span><span>FLAC</span><span>WAV</span><span>WebM</span>
              </div>
            </div>
          </div>
        ) : isAudio ? (
          /* Pure Audio Player Mode */
          <div className="vlc-audio-stage">
            <div className={`audio-disc-container ${isPlaying ? 'is-playing' : ''}`}>
              <div className="disc-grooves">
                <Disc3 size={110} strokeWidth={0.5} />
              </div>
              <div className="disc-artwork">
                <MediaArtwork name={current.name} playing={isPlaying} />
              </div>
            </div>

            <div className="audio-details-col">
              <span className="mono format-badge">{extension(current.name).toUpperCase()} AUDIO</span>
              <h1>{mediaTitle(p.title || current.name)}</h1>
              <p className="artist-line">{p.artist || parentFolder(current.path)}</p>
              {p.album && <p className="album-line">{p.album}</p>}

              <div className={`audio-eq-bars ${isPlaying ? 'animated' : ''}`}>
                <span /><span /><span /><span /><span />
              </div>
            </div>
          </div>
        ) : (
          /* Full Edge-to-Edge Video Stage */
          <div
            className={`vlc-video-stage crop-${cropRatio}`}
            onClick={togglePlayback}
            onDoubleClick={() => fullscreen()}
          >
            {/* Native video handle container */}
            <div
              ref={videoRef}
              className={`native-video-box crop-${cropRatio}`}
              style={videoFilterStyle}
            >
              {/* HTML5 video fallback for web browser preview */}
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
          </div>
        )}
      </main>

      {/* ================= BOTTOM VLC TRANSPORT CONTROLLER ================= */}
      {/* Auto-hides on mouse idle during video playback; stays visible in playlist mode */}
      <div className={`vlc-dock-wrapper ${showControls || viewMode === 'playlist' || !isPlaying ? 'visible' : 'autohide'}`}>
        <Transport
          player={player}
          viewMode={viewMode}
          onToggleViewMode={handleToggleViewMode}
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
          audioDelay={audioDelay}
          onAudioDelayChange={handleAudioDelayChange}
          subDelay={subDelay}
          onSubDelayChange={handleSubDelayChange}
        />
      </div>

      {/* ================= AUDIO & VIDEO EFFECTS MODAL (⌘E) ================= */}
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

      {/* ================= JUMP TO TIME MODAL (⌘T) ================= */}
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

      {/* ================= BOOKMARKS MODAL (⌘B) ================= */}
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

      {/* ================= MEDIA INFORMATION MODAL (⌘I) ================= */}
      {panel === 'info' && current && (
        <div className="modal-backdrop" onClick={() => setPanel(null)}>
          <div className="dialog-window media-info-dialog" onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <div className="dialog-title-group">
                <Info size={17} className="dialog-icon" />
                <h3>Media Information</h3>
              </div>
              <button className="icon-button small" aria-label="Close" onClick={() => setPanel(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="dialog-content">
              <div className="info-meta-grid">
                <div className="info-cell">
                  <span className="mono label">TITLE</span>
                  <strong className="value">{mediaTitle(p.title || current.name)}</strong>
                </div>

                <div className="info-cell">
                  <span className="mono label">CONTAINER / FORMAT</span>
                  <span className="value chip">{extension(current.name).toUpperCase()}</span>
                </div>

                <div className="info-cell">
                  <span className="mono label">DURATION</span>
                  <span className="value mono">{p.duration > 0 ? formatTime(p.duration) : '—'}</span>
                </div>

                <div className="info-cell">
                  <span className="mono label">AUDIO STREAMS</span>
                  <span className="value">{p.audio_tracks.filter(t => t.id >= 0).length} stream(s)</span>
                </div>

                <div className="info-cell">
                  <span className="mono label">SUBTITLE STREAMS</span>
                  <span className="value">{p.subtitle_tracks.filter(t => t.id >= 0).length} stream(s)</span>
                </div>

                <div className="info-cell">
                  <span className="mono label">ENGINE / CODEC RUNTIME</span>
                  <span className="value mono">{state.runtime}</span>
                </div>

                <div className="info-cell full-width">
                  <span className="mono label">FULL FILE PATH</span>
                  <code className="path-code">{current.path}</code>
                </div>
              </div>

              <div className="dialog-footer-actions">
                <button className="button secondary" onClick={() => setPanel(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= PREFERENCES & SHORTCUTS MODAL (⌘,) ================= */}
      {panel === 'settings' && (
        <div className="modal-backdrop" onClick={() => setPanel(null)}>
          <div className="dialog-window shortcuts-dialog" onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <div className="dialog-title-group">
                <Settings2 size={17} className="dialog-icon" />
                <h3>Keyboard Shortcuts</h3>
              </div>
              <button className="icon-button small" aria-label="Close" onClick={() => setPanel(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="dialog-content">
              <div className="shortcuts-table">
                <div className="shortcut-row"><span>Play / Pause</span><kbd>Space</kbd></div>
                <div className="shortcut-row"><span>Seek ±10s / ±60s</span><kbd>← / → / ⇧← / ⇧→</kbd></div>
                <div className="shortcut-row"><span>Volume Up / Down (0–150%)</span><kbd>↑ / ↓</kbd></div>
                <div className="shortcut-row"><span>Next Video Frame</span><kbd>E</kbd></div>
                <div className="shortcut-row"><span>Playback Speed Slower / Faster</span><kbd>[ / ]</kbd></div>
                <div className="shortcut-row"><span>Reset Speed to 1.0×</span><kbd>=</kbd></div>
                <div className="shortcut-row"><span>A-B Repeat Loop (Set A → Set B → Clear)</span><kbd>L</kbd></div>
                <div className="shortcut-row"><span>Toggle Playlist Table View</span><kbd>⌘ L</kbd></div>
                <div className="shortcut-row"><span>Audio Delay ±50ms (Lipsync)</span><kbd>J / K</kbd></div>
                <div className="shortcut-row"><span>Subtitle Delay ±50ms</span><kbd>H / G</kbd></div>
                <div className="shortcut-row"><span>Jump to Specific Time</span><kbd>⌘ T</kbd></div>
                <div className="shortcut-row"><span>Bookmarks Manager</span><kbd>⌘ B</kbd></div>
                <div className="shortcut-row"><span>Equalizer & Video Adjustments</span><kbd>⌘ E</kbd></div>
                <div className="shortcut-row"><span>Take Lossless Snapshot</span><kbd>⌘ S</kbd></div>
                <div className="shortcut-row"><span>Mute / Unmute</span><kbd>M</kbd></div>
                <div className="shortcut-row"><span>Toggle Fullscreen</span><kbd>F</kbd></div>
                <div className="shortcut-row"><span>Cycle Aspect Ratio</span><kbd>A</kbd></div>
                <div className="shortcut-row"><span>Cycle Crop Mode</span><kbd>C</kbd></div>
              </div>

              <div className="dialog-footer-actions">
                <span className="mono muted">RELAYN PLAYER · HIGH-EFFICIENCY LIBVLC ENGINE</span>
                <button className="button secondary" onClick={() => setPanel(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

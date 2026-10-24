import brandSymbol from '../assets/brand/relayn-symbol-sage.svg';
import {useEffect,useRef,useState} from 'react';
import {Disc3,FolderOpen,Info,ListMusic,Settings2,X} from 'lucide-react';
import {formatTime} from './player';
import {extension,mediaKind,mediaTitle,parentFolder} from './media';
import {useNativeSurface,usePlayer,usePlayerKeys,webObjectUrls} from './usePlayer';
import Transport from './components/Transport';
import Queue from './components/Queue';
import {IdleArtwork,MediaArtwork} from './components/Artwork';

type Panel='settings'|'info'|null;

export default function App(){
 const player=usePlayer();
 const {state,call,open,fullscreen,dragging}=player;
 const {playback:p,settings:s}=state;
 const current=s.playlist.find(i=>i.id===s.current);
 const isAudio=current?mediaKind(current.name)==='audio':false;
 const isPlaying=p.state==='playing';

 const [panel,setPanel]=useState<Panel>(null);
 const [queueOpen,setQueueOpen]=useState(false);
 const [showOverlay,setShowOverlay]=useState(true);
 const overlayTimeout=useRef<ReturnType<typeof setTimeout>|null>(null);
 const webVideoRef=useRef<HTMLVideoElement|null>(null);

 // Native surface hook: active when there is a current video item and not covered by full modal
 const videoRef=useNativeSurface(player,!isAudio&&!!current,panel!==null);

 // Keyboard shortcuts
 usePlayerKeys(
  player,
  ()=>void fullscreen(),
  ()=>setQueueOpen(prev=>!prev)
 );

 // Sync web video element with usePlayer
 useEffect(()=>{
  if(!player.native&&webVideoRef.current){
   player.setWebVideoRef(webVideoRef.current);
  }
 },[player.native,player.setWebVideoRef,current]);

 // Auto-hide controls overlay on video during playback
 const handleMouseMove=()=>{
  setShowOverlay(true);
  if(overlayTimeout.current)clearTimeout(overlayTimeout.current);
  if(isPlaying&&!isAudio){
   overlayTimeout.current=setTimeout(()=>{
    setShowOverlay(false);
   },2500);
  }
 };

 const togglePlayback=()=>{
  if(!current){
   void open(true);
  }else{
   void call('toggle');
  }
 };

 return (
  <div
   className={`app ${dragging?'is-dragging':''}`}
   onMouseMove={handleMouseMove}
   onDragOver={e=>e.preventDefault()}
  >
   {/* ================= TOP HEADER ================= */}
   <header className="topbar">
    <div className="brand-group">
     <div className="brand-logo">
      <img src={brandSymbol} alt="" width="22" height="22"/>
     </div>
     <div className="brand-title">
      <span>RelayN</span>
      <span className={`status-dot ${isPlaying?'live':''}`} title={isPlaying?'Playing':'Ready'}/>
     </div>
    </div>

    {/* Center Now-Playing Title */}
    <div className="header-now-playing">
     {current?(
      <div className="now-playing-pill" title={current.path}>
       <span className="mono chip-ext">{extension(current.name).toUpperCase()}</span>
       <span className="now-playing-name">{mediaTitle(p.title||current.name)}</span>
       {p.artist&&<span className="now-playing-sub">· {p.artist}</span>}
      </div>
     ):(
      <span className="header-tagline">Your media. In motion.</span>
     )}
    </div>

    {/* Header Action Tools */}
    <div className="header-actions">
     <button
      className="icon-button"
      title="Open media file (⌘O)"
      aria-label="Open media file"
      onClick={()=>open(true)}
     >
      <FolderOpen size={17}/>
     </button>

     <button
      className={`icon-button ${queueOpen?'active':''}`}
      title="Play queue (⌘L)"
      aria-label="Toggle play queue"
      onClick={()=>setQueueOpen(q=>!q)}
     >
      <ListMusic size={17}/>
      {s.playlist.length>0&&<span className="badge-count">{s.playlist.length}</span>}
     </button>

     <button
      className={`icon-button ${panel==='info'?'active':''}`}
      title="File details"
      aria-label="File details"
      disabled={!current}
      onClick={()=>setPanel(p=>p==='info'?null:'info')}
     >
      <Info size={17}/>
     </button>

     <button
      className={`icon-button ${panel==='settings'?'active':''}`}
      title="Shortcuts & settings (⌘,)"
      aria-label="Settings"
      onClick={()=>setPanel(p=>p==='settings'?null:'settings')}
     >
      <Settings2 size={17}/>
     </button>
    </div>
   </header>

   {/* Error Toast / Alert Banner */}
   {player.error&&(
    <div className="error-toast" role="alert">
     <span>{player.error}</span>
     <button className="icon-button small" aria-label="Dismiss error" onClick={player.dismiss}>
      <X size={14}/>
     </button>
    </div>
   )}

   {/* ================= MAIN WORKSPACE ================= */}
   <main className="workspace-main">
    <div className="stage-container">
     {/* Empty State / Dropzone */}
     {!current?(
      <div className="empty-dropzone" onClick={()=>open(true)}>
       <div className="dropzone-halo">
        <IdleArtwork/>
       </div>
       <div className="dropzone-content">
        <h2>Your media starts here.</h2>
        <p>Open an audio or video file from your device to begin playback.</p>
        <button className="button primary" onClick={e=>{e.stopPropagation();open(true);}}>
         <FolderOpen size={16}/>Open media file <span className="kbd-hint">⌘O</span>
        </button>
        <div className="dropzone-formats">
         <span>MP4</span><span>MKV</span><span>FLAC</span><span>WAV</span><span>WebM</span><span>AVI</span><span>MOV</span>
        </div>
       </div>
      </div>
     ):isAudio?(
      /* Pure Audio Experience */
      <div className="audio-stage">
       <div className={`audio-disc-wrapper ${isPlaying?'is-playing':''}`}>
        <div className="vinyl-grooves">
         <Disc3 size={110} strokeWidth={0.5}/>
        </div>
        <div className="vinyl-center">
         <MediaArtwork name={current.name} playing={isPlaying}/>
        </div>
       </div>

       <div className="audio-meta">
        <span className="mono chip-format">{extension(current.name).toUpperCase()} AUDIO</span>
        <h1>{mediaTitle(p.title||current.name)}</h1>
        <p className="audio-artist">{p.artist||parentFolder(current.path)}</p>
        {p.album&&<p className="audio-album">{p.album}</p>}

        {/* Live Audio Waves */}
        <div className={`live-wave-bars ${isPlaying?'animate':''}`}>
         <span/><span/><span/><span/><span/>
        </div>
       </div>
      </div>
     ):(
      /* True Native / Web Video Stage */
      <div
       className="video-stage"
       onClick={togglePlayback}
       onDoubleClick={()=>fullscreen()}
      >
       {/* Native video handle container */}
       <div ref={videoRef} className="native-video-box">
        {/* In browser fallback preview mode, render HTML5 video element */}
        {!player.native&&(
         <video
          ref={webVideoRef}
          className="html-video-element"
          src={webObjectUrls.get(current.id)||current.path}
          playsInline
         />
        )}
       </div>

       {/* Video Hover Floating Bar */}
       <div className={`video-overlay-header ${showOverlay?'visible':'hidden'}`}>
        <span className="video-title">{mediaTitle(p.title||current.name)}</span>
        <span className="mono video-time">
         {formatTime(p.time)} / {p.duration>0?formatTime(p.duration):'—'}
        </span>
       </div>
      </div>
     )}
    </div>

    {/* ================= SLIDE-OUT PLAY QUEUE DRAWER ================= */}
    {queueOpen&&(
     <aside className="drawer-panel queue-drawer">
      <Queue player={player} close={()=>setQueueOpen(false)}/>
     </aside>
    )}

    {/* ================= SLIDE-OUT FILE INSPECTOR DRAWER ================= */}
    {panel==='info'&&current&&(
     <aside className="drawer-panel inspector-drawer">
      <div className="drawer-header">
       <h3>File Inspector</h3>
       <button className="icon-button small" aria-label="Close inspector" onClick={()=>setPanel(null)}>
        <X size={16}/>
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
        <span className="value mono">{p.duration>0?formatTime(p.duration):'—'}</span>
       </div>
       <div className="inspector-item">
        <span className="mono label">AUDIO TRACKS</span>
        <span className="value">{p.audio_tracks.filter(t=>t.id>=0).length} available</span>
       </div>
       <div className="inspector-item">
        <span className="mono label">SUBTITLE TRACKS</span>
        <span className="value">{p.subtitle_tracks.filter(t=>t.id>=0).length} available</span>
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
    toggleQueue={()=>setQueueOpen(q=>!q)}
    queueOpen={queueOpen}
   />

   {/* ================= SETTINGS & SHORTCUTS MODAL ================= */}
   {panel==='settings'&&(
    <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setPanel(null);}}>
     <div className="modal modal-settings" role="dialog" aria-modal="true" aria-label="Settings and shortcuts">
      <div className="modal-header">
       <h2>Keyboard Shortcuts</h2>
       <button className="icon-button" aria-label="Close" onClick={()=>setPanel(null)}>
        <X size={18}/>
       </button>
      </div>

      <div className="shortcuts-table">
       <div className="shortcut-row">
        <span>Play / Pause</span>
        <kbd>Space</kbd>
       </div>
       <div className="shortcut-row">
        <span>Seek ±10 seconds</span>
        <kbd>← / →</kbd>
       </div>
       <div className="shortcut-row">
        <span>Volume up / down</span>
        <kbd>↑ / ↓</kbd>
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
        <span>Open file</span>
        <kbd>⌘ O</kbd>
       </div>
       <div className="shortcut-row">
        <span>Toggle play queue</span>
        <kbd>⌘ L</kbd>
       </div>
       <div className="shortcut-row">
        <span>Previous / Next track</span>
        <kbd>P / N</kbd>
       </div>
       <div className="shortcut-row">
        <span>Cycle aspect ratio</span>
        <kbd>A</kbd>
       </div>
       <div className="shortcut-row">
        <span>Cycle audio / subtitle</span>
        <kbd>B / V</kbd>
       </div>
      </div>

      <div className="modal-footer">
       <span className="mono muted">RELAYN PLAYER · LIBVLC HARDWARE ACCELERATED</span>
       <button className="button secondary" onClick={()=>setPanel(null)}>Close</button>
      </div>
     </div>
    </div>
   )}
  </div>
 );
}

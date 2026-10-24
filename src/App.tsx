import brandSymbol from '../assets/brand/relayn-symbol-sage.svg';
import {useCallback,useEffect,useRef,useState,type MouseEvent,type RefObject} from 'react';
import {ArrowDown,ArrowLeft,ArrowRight,AudioLines,Check,ChevronRight,Compass,Disc3,FilePlus2,Film,FolderOpen,Grid2X2,HelpCircle,Info,List,Pause,Play,Plus,Search,Settings2,ShieldCheck,SlidersHorizontal,Sparkles,X} from 'lucide-react';
import {formatTime,type Item} from './player';
import {extension,mediaKind,mediaTitle,parentFolder,type View} from './media';
import {useNativeSurface,usePlayer,usePlayerKeys,type PlayerController} from './usePlayer';
import Transport from './components/Transport';
import Queue from './components/Queue';
import {FileGlyph,IdleArtwork,MediaArtwork} from './components/Artwork';

type Panel='settings'|'info'|'tour'|null;
type Filter='all'|'video'|'audio';
const views:View[]=['home','library','video','audio'];
const viewLabel:Record<View,string>={home:'Home',library:'Library',video:'Video',audio:'Audio'};

interface FeaturePill {
 id:string;
 label:string;
 title:string;
 description:string;
}

const FEATURE_PILLS:FeaturePill[]=[
 {
  id:'local',
  label:'LOCAL FIRST',
  title:'Zero telemetry & cloud dependencies',
  description:'Your media stays in your own folders. RelayN never uploads your library, indexes remote servers, or requires an account.'
 },
 {
  id:'codecs',
  label:'UNIVERSAL CODECS',
  title:'Direct hardware-accelerated playback',
  description:'Broad format support including MKV, FLAC, MP4, WAV, ALAC, WebM, and multi-track audio and subtitle streams.'
 },
 {
  id:'editorial',
  label:'RESTRAINED FOCUS',
  title:'Modern editorial interface',
  description:'Thoughtful typography, calm low-distraction surfaces, and clean responsive workspaces crafted for long viewing sessions.'
 },
 {
  id:'continuity',
  label:'SMART CONTINUITY',
  title:'Remembers your pace',
  description:'Playback speed, custom aspect ratios, volume, and playlist states are safely preserved across restarts.'
 }
];

function Inspector({player,item,play}:{player:PlayerController;item?:Item;play?:(item:Item)=>void}){
 const {playback:p,settings:s}=player.state;
 const active=item?.id===s.current;
 const fields=[
  ['File type',item?extension(item.name).toUpperCase():'—'],
  ['Duration',active&&p.duration>0?formatTime(p.duration):'—'],
  ['Artist',active?p.artist||'—':'—'],
  ['Album',active?p.album||'—':'—']
 ];

 return (
  <section className="inspector">
   <div className="eyebrow"><span className="status-dot live"/>FILE INSPECTOR<Info size={13}/></div>
   {item?(
    <>
     <div className="inspector-art">
      <MediaArtwork name={item.name} playing={active&&p.state==='playing'}/>
      <span className="chip">{active?'CURRENT SELECTION':'LOCAL FILE'}</span>
     </div>
     <span className="mono muted">{mediaKind(item.name)==='audio'?'AUDIO RECORDING':'MEDIA FILE'}</span>
     <h2>{mediaTitle(active?p.title||item.name:item.name)}</h2>
     <p className="muted inspector-folder">{parentFolder(item.path)}</p>
     <dl className="inspector-fields">
      {fields.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
     </dl>
     <div className="inspector-streams">
      <span className="mono muted">AVAILABLE TRACKS</span>
      <div><AudioLines size={14}/>{active?p.audio_tracks.filter(t=>t.id>=0).length:'—'} audio <span> / </span>{active?p.subtitle_tracks.filter(t=>t.id>=0).length:'—'} subtitle</div>
     </div>
     <div className="storage-path">
      <span className="mono muted">STORAGE PATH</span>
      <code>{item.path}</code>
     </div>
     {play&&<button className="button primary wide" onClick={()=>play(item)}><Play size={14}/>Begin playback<ArrowRight size={14}/></button>}
    </>
   ):(
    <div className="inspector-empty">
     <SlidersHorizontal size={30} strokeWidth={1}/>
     <h3>A closer look.</h3>
     <p>Select a file in your library<br/>to inspect its details.</p>
    </div>
   )}
  </section>
 );
}

function Stage({player,videoRef,cinema=false,onOpenTour}:{player:PlayerController;videoRef:RefObject<HTMLDivElement|null>;cinema?:boolean;onOpenTour?:()=>void}){
 const {playback:p,settings:s}=player.state;
 const item=s.playlist.find(i=>i.id===s.current);
 const audio=item&&mediaKind(item.name)==='audio';
 const progress=p.duration?Math.min(100,Math.round(p.time/p.duration*100)):0;

 const handleMouseMove=(e:MouseEvent<HTMLElement>)=>{
  const rect=e.currentTarget.getBoundingClientRect();
  const x=(e.clientX-rect.left)/rect.width-0.5;
  const y=(e.clientY-rect.top)/rect.height-0.5;
  e.currentTarget.style.setProperty('--mx',`${x*15}px`);
  e.currentTarget.style.setProperty('--my',`${y*15}px`);
 };

 const handleMouseLeave=(e:MouseEvent<HTMLElement>)=>{
  e.currentTarget.style.setProperty('--mx','0px');
  e.currentTarget.style.setProperty('--my','0px');
 };

 return (
  <section
   className={`visual-stage ${cinema?'cinema-stage':''}`}
   aria-label="Video stage"
   onMouseMove={handleMouseMove}
   onMouseLeave={handleMouseLeave}
  >
   <div className="stage-heading">
    <span className="chip">{item?p.state==='playing'?'IN PROGRESS':p.state==='paused'?'PAUSED':p.state.toUpperCase():'PRIVATE SCREENING'}</span>
    <span className="mono">{item&&p.duration>0?`${progress}% COMPLETE`:'YOUR FILES. YOUR PACE.'}</span>
    <span className="stage-position mono">{formatTime(p.time)}<b>/</b>{p.duration>0?formatTime(p.duration):'—'}</span>
   </div>
   <div ref={videoRef} className={`video-area ${!item?'is-empty':''}`}>
    {!item?(
     <>
      <IdleArtwork/>
      <div className="stage-welcome">
       <span className="eyebrow"><Sparkles size={13}/>A ROOM FOR YOUR COLLECTION</span>
       <h1>Your media.<br/><em>Beautifully at home.</em></h1>
       <p>Films, music, and the things you come back to.<br/>Open a local file or drop media anywhere to begin.</p>
       <div className="stage-welcome-actions">
        <button className="button primary" onClick={()=>player.open(true)}>
         <FolderOpen size={15}/>Open media<ArrowRight size={15}/>
        </button>
        {onOpenTour&&(
         <button className="button secondary" onClick={onOpenTour}>
          <Compass size={14}/>Explore features
         </button>
        )}
       </div>
      </div>
     </>
    ):audio?(
     <div className="audio-in-stage">
      <div className={`audio-stage-disc ${p.state==='playing'?'spinning':''}`}>
       <Disc3 size={65} strokeWidth={.5}/>
      </div>
      <h2>{mediaTitle(p.title||item.name)}</h2>
      <p>{p.artist||'Local audio playback'}</p>
      <span className="mono">AUDIO SESSION / {extension(item.name).toUpperCase()}</span>
     </div>
    ):null}
   </div>
   <div className="stage-foot">
    <span className="mono">{item?mediaKind(item.name)==='audio'?'AUDIO SESSION':'ACTIVE SCREENING':'LOCAL MEDIA'}</span>
    <span className="mono">{item&&p.duration>0?`REMAINING ${formatTime(Math.max(0,p.duration-p.time))}`:'RELAYN PLAYER'}</span>
   </div>
  </section>
 );
}

function SessionCard({item,active,playing,onPlay}:{item:Item;active:boolean;playing:boolean;onPlay:()=>void}){
 return (
  <button className={`session-card ${active?'current':''}`} onClick={onPlay} aria-label={`Play ${item.name}`}>
   <div className="session-art">
    <MediaArtwork name={item.name} playing={playing}/>
    <span className="chip">{extension(item.name).toUpperCase()}</span>
    <span className="card-play"><Play size={16}/></span>
   </div>
   <div className="session-copy">
    <span className="mono">{active?'CURRENT SELECTION':mediaKind(item.name)==='audio'?'LISTENING SESSION':'LOCAL SCREENING'}</span>
    <h3>{mediaTitle(item.name)}</h3>
    <p>{parentFolder(item.path)}</p>
    <div className="session-bottom">
     <span>{active?'CONTINUE SESSION':'PLAY FROM COLLECTION'}</span>
     <ArrowRight size={12}/>
    </div>
   </div>
  </button>
 );
}

function Modal({panel,close,player}:{panel:Exclude<Panel,null>;close:()=>void;player:PlayerController}){
 const dialog=useRef<HTMLDivElement>(null);
 const previous=useRef<HTMLElement|null>(null);
 const {playback:p,settings:s}=player.state;
 const item=s.playlist.find(i=>i.id===s.current);
 const [pressedKey,setPressedKey]=useState<string|null>(null);

 useEffect(()=>{
  previous.current=document.activeElement as HTMLElement;
  dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
  return()=>previous.current?.focus();
 },[]);

 useEffect(()=>{
  if(panel!=='settings')return;
  const handleKey=(e:KeyboardEvent)=>{
   setPressedKey(e.key.toLowerCase());
   const timer=setTimeout(()=>setPressedKey(null),400);
   return()=>clearTimeout(timer);
  };
  window.addEventListener('keydown',handleKey);
  return()=>window.removeEventListener('keydown',handleKey);
 },[panel]);

 const shortcutsList=[
  {label:'Open / add media',key:'Ctrl / Cmd O / Shift O',match:['o']},
  {label:'Search collection',key:'Ctrl / Cmd K',match:['k']},
  {label:'Play / pause',key:'Space',match:[' ']},
  {label:'Previous / next',key:'P / N',match:['p','n']},
  {label:'Seek 10 seconds',key:'← / →',match:['arrowleft','arrowright']},
  {label:'Volume / mute',key:'↑ ↓ / M',match:['arrowup','arrowdown','m']},
  {label:'Fullscreen / exit',key:'F / Esc',match:['f','escape']},
  {label:'Audio / subtitle track',key:'B / V',match:['b','v']},
  {label:'Aspect ratio / speed',key:'A / + −',match:['a','+','-','=']}
 ];

 return (
  <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}>
   <div
    ref={dialog}
    className="modal modal-enter"
    role="dialog"
    aria-modal="true"
    aria-label={panel==='info'?'Media information':panel==='tour'?'Workspace tour':'Settings and shortcuts'}
    onKeyDown={e=>{
     if(e.key==='Escape'){e.stopPropagation();close();}
     if(e.key==='Tab'){
      const elements=dialog.current?.querySelectorAll<HTMLElement>('button,select,input,[tabindex="0"]');
      if(!elements?.length)return;
      const first=elements[0],last=elements[elements.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
     }
    }}
   >
    <div className="modal-header">
     <span className="eyebrow">RELAYN / {panel==='info'?'INSPECTOR':panel==='tour'?'WORKSPACE TOUR':'PREFERENCES'}</span>
     <button className="icon-button" aria-label="Close dialog" onClick={close}><X size={18}/></button>
    </div>

    {panel==='info'?(
     <>
      <h2>Media information</h2>
      <dl className="info-fields">
       {[
        ['File',item?.path||'No media selected'],
        ['Title',p.title||item?.name||'—'],
        ['Artist',p.artist||'—'],
        ['Album',p.album||'—'],
        ['Duration',p.duration?formatTime(p.duration):'—'],
        ['Audio tracks',String(p.audio_tracks.filter(t=>t.id>=0).length)],
        ['Subtitle tracks',String(p.subtitle_tracks.filter(t=>t.id>=0).length)],
        ['Playback engine',player.state.runtime]
       ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
     </>
    ):panel==='tour'?(
     <>
      <h2>Your media. In motion.</h2>
      <p className="modal-copy">RelayN is designed as a calm, editorial desktop player for the files you own.</p>
      <div className="tour-grid">
       {FEATURE_PILLS.map(pill=>(
        <div key={pill.id} className="tour-card">
         <span className="chip">{pill.label}</span>
         <h4>{pill.title}</h4>
         <p>{pill.description}</p>
        </div>
       ))}
      </div>
      <div className="privacy-note">
       <ShieldCheck size={16}/><span>Built local-first. Zero accounts, cloud syncing, or background trackers.</span>
      </div>
      <button className="button primary wide" style={{marginTop:'20px'}} onClick={()=>{close();void player.open(true);}}>
       <FolderOpen size={15}/>Choose media to play<ArrowRight size={15}/>
      </button>
     </>
    ):(
     <>
      <h2>A player, at your pace.</h2>
      <p className="modal-copy">Your volume, speed, aspect ratio, repeat mode, and playlist are saved locally. Press any key below to test your shortcuts live.</p>
      <h3>Keyboard shortcuts</h3>
      <div className="shortcuts">
       {shortcutsList.map(({label,key,match})=>{
        const isMatched=pressedKey&&match.includes(pressedKey);
        return (
         <div key={label} className={`shortcut-row ${isMatched?'key-active':''}`}>
          <span>{label}</span>
          <kbd className={isMatched?'kbd-active':''}>{key}</kbd>
         </div>
        );
       })}
      </div>
      <div className="privacy-note">
       <ShieldCheck size={16}/><span>Media files stay safely in their folders.</span>
      </div>
     </>
    )}
   </div>
  </div>
 );
}

export default function App(){
 const player=usePlayer();
 const {playback:p,settings:s}=player.state;
 const current=s.playlist.find(i=>i.id===s.current);

 const [view,setView]=useState<View>(()=>{
  try{
   const v=localStorage.getItem('aster.view');
   return views.includes(v as View)?v as View:'home';
  }catch{
   return 'home';
  }
 });

 const [panel,setPanel]=useState<Panel>(null);
 const [queueOpen,setQueueOpen]=useState(false);
 const [query,setQuery]=useState('');
 const [filter,setFilter]=useState<Filter>('all');
 const [layout,setLayout]=useState<'list'|'grid'>('list');
 const [sort,setSort]=useState('queue');
 const [selection,setSelection]=useState<number|null>(null);
 const [activePill,setActivePill]=useState<string>('local');

 const searchRef=useRef<HTMLInputElement>(null);
 const videoRef=useNativeSurface(player,view,!!panel||queueOpen||player.dragging);

 const navigate=(next:View)=>{
  setView(next);
  setQueueOpen(false);
  try{localStorage.setItem('aster.view',next);}catch{/* private storage unavailable */}
 };

 const focusSearch=useCallback(()=>{
  setView('library');
  searchRef.current?.focus();
 },[]);

 const clearPanel=useCallback(()=>setPanel(null),[]);
 usePlayerKeys(player,clearPanel,focusSearch);

 const filtered=s.playlist
  .filter(item=>(filter==='all'||mediaKind(item.name)===filter)&&item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  .sort((a,b)=>sort==='title'?a.name.localeCompare(b.name):0);

 const selected=s.playlist.find(i=>i.id===selection)||current||s.playlist[0];
 const audioCount=s.playlist.filter(i=>mediaKind(i.name)==='audio').length;
 const videoCount=s.playlist.filter(i=>mediaKind(i.name)==='video').length;

 const play=(item:Item)=>{void player.call('play',undefined,undefined,item.id);};
 const connected=player.native&&player.state.runtime!=='Connecting…'&&player.state.runtime!=='Unavailable';
 const isPlaying=p.state==='playing';
 const activePillData=FEATURE_PILLS.find(p=>p.id===activePill)||FEATURE_PILLS[0];

 return (
  <div className={`app view-${view}`}>
   <header className="topbar">
    <button className="brand" onClick={()=>navigate('home')} aria-label="RelayN home">
     <img className="brand-mark" src={brandSymbol} alt="" aria-hidden="true"/>
     <span className="wordmark">RelayN</span>
     <span className="version mono">v0.1</span>
    </button>
    <nav className="main-nav" aria-label="Main navigation">
     {views.map(name=>(
      <button key={name} aria-current={view===name?'page':undefined} onClick={()=>navigate(name)}>
       {viewLabel[name]}
      </button>
     ))}
    </nav>
    <label className="header-search">
     <Search size={15}/>
     <input
      ref={searchRef}
      aria-label="Search library"
      placeholder="Search your collection…"
      value={query}
      onChange={e=>{
       setQuery(e.target.value);
       if(e.target.value)setView('library');
      }}
     />
     <kbd>⌘K</kbd>
    </label>
    <button className="icon-button header-open" title="Open media (Ctrl / Cmd O)" aria-label="Open media" onClick={()=>player.open(true)}>
     <FolderOpen size={18}/>
    </button>
    <div className="header-tools">
     <button className="icon-button" aria-label="Media information" title="File inspector" onClick={()=>setPanel('info')}>
      <Info size={17}/>
     </button>
     <button className="icon-button" aria-label="Player settings" title="Player settings" onClick={()=>setPanel('settings')}>
      <Settings2 size={18}/>
     </button>
     <button className="icon-button" aria-label="Workspace tour" title="Workspace tour" onClick={()=>setPanel('tour')}>
      <HelpCircle size={17}/>
     </button>
     <span className={`local-profile ${isPlaying?'is-spinning':''}`} title="Local collection">
      <Disc3 size={16}/>
     </span>
    </div>
   </header>

   <div className="engine-bar">
    <span>
     <span className={`status-dot ${connected||!player.native?'live':''}`}/>
     {connected?'LOCAL PLAYBACK ENGINE READY':player.native?'CONNECTING TO PLAYBACK ENGINE':'WEB PREVIEW ACTIVE'}
     <i>/</i>
     <span className="engine-version">
      {connected?`LIBVLC ${player.state.runtime}`:player.native?'YOUR FILES STAY ON YOUR COMPUTER':'DESKTOP APP USES LIBVLC · LOCAL FIRST'}
     </span>
    </span>
    {isPlaying&&(
     <span className="now-playing-ticker">
      <span className="mini-bars">
       <span className="mini-bar b1"/>
       <span className="mini-bar b2"/>
       <span className="mini-bar b3"/>
      </span>
      {mediaTitle(p.title||current?.name||'Playing')}
     </span>
    )}
    <span>
     {s.playlist.length} LOCAL ITEMS<i>/</i>{videoCount} VIDEO · {audioCount} AUDIO
    </span>
   </div>

   {player.error&&(
    <div className="error-banner" role="alert">
     <span>{player.error}</span>
     <button className="icon-button small" aria-label="Dismiss error" onClick={player.dismiss}><X size={15}/></button>
    </div>
   )}

   <main className="workspace">
    {view==='home'&&(
     <div className="home-content view-enter">
      <div className="page-heading">
       <div>
        <span className="eyebrow"><Sparkles size={11}/>THE PERSONAL COLLECTION</span>
        <h2>Good things are worth keeping.</h2>
       </div>
       <button className="text-button" onClick={()=>player.open(false)}>
        <Plus size={14}/>Add to collection
       </button>
      </div>

      <div className="home-hero">
       <Stage player={player} videoRef={videoRef} onOpenTour={()=>setPanel('tour')}/>
       <section className="session-details">
        <div className="eyebrow"><span className="status-dot live"/>{current?'YOUR CURRENT SESSION':'AN INVITATION TO SLOW DOWN'}</div>
        <div className="details-title">
         <h1>{current?mediaTitle(p.title||current.name):<>A little more<br/><em>intentional.</em></>}</h1>
         <p>{p.artist||(current?parentFolder(current.path):'A considered home for films, music, and everything in between.')}</p>
        </div>

        <div className="session-tags" role="tablist" aria-label="RelayN Pillars">
         {FEATURE_PILLS.map(pill=>(
          <button
           key={pill.id}
           role="tab"
           aria-selected={activePill===pill.id}
           className={`chip interactive-chip ${activePill===pill.id?'active-chip':''}`}
           onClick={()=>setActivePill(pill.id)}
           title={pill.title}
          >
           {pill.label}
          </button>
         ))}
        </div>

        <div className="interactive-feature-card">
         <h4>{activePillData.title}</h4>
         <p>{activePillData.description}</p>
        </div>

        <p className="session-note">
         {current
          ?'Every file has its place. Your current session is saved in the collection below.'
          :'Bring your own collection. RelayN Player takes care of playback, the queue, and the quiet details.'}
        </p>

        <div className="detail-metrics">
         <div>
          <span>DURATION</span>
          <strong>{current&&p.duration>0?formatTime(p.duration):'—'}</strong>
         </div>
         <div>
          <span>IN YOUR QUEUE</span>
          <strong>{String(s.playlist.length).padStart(2,'0')}<small> FILES</small></strong>
         </div>
        </div>

        <button className="button primary wide" onClick={()=>current?player.call('toggle'):player.open(true)}>
         {current&&isPlaying?<Pause size={15}/>:<Play size={15}/>}
         {current?isPlaying?'Pause session':'Continue session':'Begin a session'}
         <ArrowRight size={15}/>
        </button>
       </section>
      </div>

      <section className="home-archive">
       <div className="section-heading">
        <div>
         <h2>From your collection</h2>
         <span className="mono muted">{s.playlist.length?`${String(s.playlist.length).padStart(2,'0')} LOCAL FILES`:'WAITING TO BE FILLED'}</span>
        </div>
        <button className="text-button" onClick={()=>navigate('library')}>
         View library<ArrowRight size={13}/>
        </button>
       </div>

       {s.playlist.length?(
        <div className="session-grid">
         {s.playlist.slice(0,3).map(item=>(
          <SessionCard
           key={item.id}
           item={item}
           active={s.current===item.id}
           playing={s.current===item.id&&isPlaying}
           onPlay={()=>play(item)}
          />
         ))}
        </div>
       ):(
        <div className="collection-invitation" onClick={()=>player.open(false)} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')player.open(false);}}>
         <div className="invitation-glyph">
          <FolderOpen size={25} strokeWidth={1}/>
         </div>
         <div>
          <h3>Every great collection starts somewhere.</h3>
          <p>Add a film, an album, or a few favorites. Drag and drop media anywhere, or click to browse.</p>
         </div>
         <button className="button secondary" onClick={e=>{e.stopPropagation();player.open(false);}}>
          Browse files<ArrowRight size={14}/>
         </button>
         <div className="invitation-lines" aria-hidden="true"/>
        </div>
       )}
      </section>
     </div>
    )}

    {view==='library'&&(
     <div className="library-content view-enter">
      <div className="page-heading">
       <div>
        <span className="eyebrow">THE COLLECTION ARCHIVE</span>
        <h1>Personal media library</h1>
       </div>
       <button className="button primary" onClick={()=>player.open(false)}>
        <Plus size={15}/>Add media
       </button>
      </div>

      <div className="library-toolbar">
       <div className="segmented" aria-label="Media filter">
        {(['all','video','audio'] as Filter[]).map(value=>(
         <button
          key={value}
          aria-pressed={filter===value}
          className={filter===value?'active':''}
          onClick={()=>setFilter(value)}
         >
          {value==='all'?'All media':value==='video'?'Films & video':'Audio'}
          <span>{value==='all'?s.playlist.length:value==='video'?videoCount:audioCount}</span>
         </button>
        ))}
       </div>
       <div className="library-view-controls">
        <select aria-label="Sort library" value={sort} onChange={e=>setSort(e.target.value)}>
         <option value="queue">Queue order</option>
         <option value="title">Title A–Z</option>
        </select>
        <button
         className={`icon-button ${layout==='grid'?'selected':''}`}
         aria-label="Grid view"
         aria-pressed={layout==='grid'}
         onClick={()=>setLayout('grid')}
        >
         <Grid2X2 size={16}/>
        </button>
        <button
         className={`icon-button ${layout==='list'?'selected':''}`}
         aria-label="List view"
         aria-pressed={layout==='list'}
         onClick={()=>setLayout('list')}
        >
         <List size={18}/>
        </button>
       </div>
      </div>

      <div className="library-layout">
       <section className="library-index">
        <div className="section-heading">
         <div>
          <h2>Library index</h2>
          <span className="mono muted">{filtered.length} MATCHED FILES</span>
         </div>
         <button className="text-button" disabled={!s.playlist.length} onClick={player.exportList}>
          <ArrowDown size={13}/>Export playlist
         </button>
        </div>

        {!filtered.length?(
         <div className="library-empty">
          <FolderOpen size={40} strokeWidth={.7}/>
          <h2>{s.playlist.length?'Nothing here, just yet.':'Make room for your favorites.'}</h2>
          <p>{s.playlist.length?'Try another search or media filter.':'Open local media to begin building your personal archive.'}</p>
          {!s.playlist.length&&(
           <button className="button secondary" onClick={()=>player.open(false)}>
            <Plus size={14}/>Add media
           </button>
          )}
         </div>
        ):layout==='grid'?(
         <div className="library-grid">
          {filtered.map(item=>(
           <SessionCard
            key={item.id}
            item={item}
            active={s.current===item.id}
            playing={s.current===item.id&&isPlaying}
            onPlay={()=>{setSelection(item.id);play(item);}}
           />
          ))}
         </div>
        ):(
         <div className="library-table">
          <div className="table-head">
           <span>TITLE & FILE</span>
           <span>FORMAT</span>
           <span>LOCATION</span>
           <span/>
          </div>
          <div className="table-body">
           {filtered.map(item=>(
            <div className={`library-row ${selected?.id===item.id?'selected':''}`} key={item.id}>
             <button
              className="library-title"
              aria-label={`Inspect ${item.name}`}
              onClick={()=>setSelection(item.id)}
              onDoubleClick={()=>play(item)}
             >
              <FileGlyph audio={mediaKind(item.name)==='audio'} active={selected?.id===item.id}/>
              <span>
               <strong>{mediaTitle(item.name)}</strong>
               <small>{item.name}</small>
              </span>
             </button>
             <span className="chip">{extension(item.name).toUpperCase()}</span>
             <span className="file-folder mono" title={item.path}>{parentFolder(item.path)}</span>
             <button
              className="icon-button"
              aria-label={`Play ${item.name}`}
              onClick={()=>play(item)}
             >
              {item.id===s.current&&isPlaying?<AudioLines size={15}/>:<Play size={15}/>}
             </button>
            </div>
           ))}
          </div>
         </div>
        )}
       </section>
       <Inspector player={player} item={selected} play={play}/>
      </div>
     </div>
    )}

    {view==='video'&&(
     <div className="cinema-content view-enter">
      <div className="page-heading">
       <div className="cinema-title">
        <button className="icon-button" aria-label="Back to home" onClick={()=>navigate('home')}>
         <ArrowLeft size={18}/>
        </button>
        <div>
         <span className="eyebrow">THE SCREENING ROOM</span>
         <h1>{current?mediaTitle(p.title||current.name):'A screen, entirely yours.'}</h1>
        </div>
       </div>
       <button className="text-button" onClick={()=>player.open(true)}>
        <FolderOpen size={15}/>Open a film
       </button>
      </div>

      <Stage player={player} videoRef={videoRef} cinema onOpenTour={()=>setPanel('tour')}/>

      <div className="cinema-caption">
       <span>
        <Film size={14}/>
        {current?current.name:'Choose a file or drop media anywhere in the window'}
       </span>
       <button className="text-button" onClick={()=>setPanel('info')}>
        File information<ChevronRight size={13}/>
       </button>
      </div>
     </div>
    )}

    {view==='audio'&&(
     <div className="audio-content view-enter">
      <div className="audio-main">
       <div className="session-strip">
        <span>
         <span className={`status-dot ${isPlaying?'live':''}`}/>
         {isPlaying?'LISTENING SESSION ACTIVE':'A SPACE TO LISTEN'}
        </span>
        <span>LOCAL PLAYBACK / {s.rate.toFixed(2)}×</span>
       </div>

       <section className="audio-experience">
        <div className="album-sleeve">
         <MediaArtwork name={current?.name||''} large playing={isPlaying}/>
         <span className="mono muted"><Disc3 size={13}/>YOUR COLLECTION / YOUR OWN PACE</span>
        </div>
        <div className="audio-editorial">
         <span className="eyebrow">
          {current?`TRACK ${String(s.playlist.findIndex(i=>i.id===s.current)+1).padStart(2,'0')} / LOCAL RECORDING`:'THE LISTENING ROOM'}
         </span>
         <h1>
          {current?mediaTitle(p.title||current.name):<>Find your next<br/></>}
          {!current&&<em>favorite.</em>}
         </h1>
         <h2>{p.artist||(current?'From your collection':'A little space for sound.')}</h2>
         <p className="audio-album">
          {p.album||(current?parentFolder(current.path):'Bring an album, a recording, or something you love listening to.')}
         </p>
         <div className="audio-specs">
          {[
           ['FILE TYPE',current?extension(current.name).toUpperCase():'—'],
           ['PLAYBACK RATE',`${s.rate.toFixed(2)}×`],
           ['VOLUME',s.muted?'Muted':`${s.volume}%`],
           ['AUDIO TRACKS',current?String(p.audio_tracks.filter(t=>t.id>=0).length):'—']
          ].map(([label,value])=>(
           <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
           </div>
          ))}
         </div>
         <button className="button primary wide" onClick={()=>current?player.call('toggle'):player.open(true)}>
          {current&&isPlaying?<Pause size={15}/>:<Play size={15}/>}
          {current?isPlaying?'Pause this session':'Continue listening':'Choose your first recording'}
          <ArrowRight size={15}/>
         </button>
        </div>
       </section>

       <div className="audio-file-strip">
        <FileGlyph audio active={!!current}/>
        <div>
         <span className="mono muted">CURRENT FILE</span>
         <p>{current?.path||'No recording selected. Open media to get started.'}</p>
        </div>
        <Check size={15}/>
       </div>
      </div>
      <Queue player={player}/>
     </div>
    )}
   </main>

   <Transport player={player} queueOpen={queueOpen} toggleQueue={()=>setQueueOpen(v=>!v)}/>

   {queueOpen&&(
    <div className="queue-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setQueueOpen(false);}}>
     <Queue player={player} close={()=>setQueueOpen(false)}/>
    </div>
   )}

   {player.dragging&&(
    <div className="drop-overlay">
     <div className="drop-target-box">
      <FilePlus2 size={44} strokeWidth={1} className="drop-bounce"/>
      <h2>A new addition to the collection.</h2>
      <p>Drop audio or video files anywhere to add them to your play queue.</p>
     </div>
    </div>
   )}

   {panel&&<Modal panel={panel} close={()=>setPanel(null)} player={player}/>}
  </div>
 );
}

import {Disc3,Film,Music2} from 'lucide-react';
import {artSeed,mediaKind} from '../media';

export function MediaArtwork({name='',large=false,playing=false}:{name?:string;large?:boolean;playing?:boolean}){
 const audio=large||mediaKind(name)==='audio',seed=artSeed(name);
 return (
  <div className={`media-art art-${seed} ${audio?'art-audio':'art-video'} ${large?'art-large':''} ${playing?'is-playing':''}`} aria-hidden="true">
   <div className="art-grain"/>
   {audio?(
    <>
     <div className="record-wrap">
      <div className={`record ${playing?'spinning':''}`}>
       <div className="record-sheen"/>
       <div className="record-grooves"/>
       <div className="record-label"><Disc3/></div>
      </div>
     </div>
     <span className="art-edition">{name?'LOCAL RECORDING / '+name.split('.').pop()?.toUpperCase():'YOUR PERSONAL COLLECTION'}</span>
    </>
   ):(
    <>
     <svg className="landscape" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
      <defs>
       <linearGradient id={`sky-${seed}-${large}`} x2="0" y2="1">
        <stop stopColor="#6c604c"/>
        <stop offset="1" stopColor="#25251e"/>
       </linearGradient>
      </defs>
      <rect width="1000" height="600" fill={`url(#sky-${seed}-${large})`}/>
      <circle cx="750" cy="150" r="64" fill="#c3b18b" opacity=".5"/>
      <path d="M0 450Q200 175 520 400T1000 350V600H0" fill="#65634e"/>
      <path d="M0 470Q400 260 720 470T1100 400V600H0" fill="#353a2e"/>
      <path d="M0 570Q500 300 1000 540V600H0" fill="#171d17"/>
     </svg>
     <div className="art-frame-lines"/>
     <Film className="art-film"/>
    </>
   )}
  </div>
 );
}

export function IdleArtwork(){
 return (
  <div className="idle-art" aria-hidden="true">
   <div className="idle-orbit orbit-one">
    <span className="orbit-satellite sat-1"/>
   </div>
   <div className="idle-orbit orbit-two">
    <span className="orbit-satellite sat-2"/>
   </div>
   <div className="idle-orbit orbit-three">
    <span className="orbit-satellite sat-3"/>
   </div>
   <div className="idle-emblem" title="RelayN Audio & Video Engine">
    <div className="emblem-bars">
     <span className="emblem-bar bar-1"/>
     <span className="emblem-bar bar-2"/>
     <span className="emblem-bar bar-3"/>
     <span className="emblem-bar bar-4"/>
     <span className="emblem-bar bar-5"/>
    </div>
   </div>
   <span className="idle-coordinate">35° 41′ N / YOUR OWN COLLECTION</span>
  </div>
 );
}

export function FileGlyph({audio=false,active=false}:{audio?:boolean;active?:boolean}){
 return (
  <span className={`file-glyph ${active?'active-glyph':''}`}>
   {audio?<Music2 size={19}/>:<Film size={19}/>}
  </span>
 );
}

import {useCallback,useEffect,useRef,useState} from 'react';
import {invoke,isTauri} from '@tauri-apps/api/core';
import {listen} from '@tauri-apps/api/event';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {initial,nextTrack,shortcut,type Snapshot} from './player';
import {mediaKind,type View} from './media';
export function usePlayer(){
 const [state,setState]=useState<Snapshot>(initial),[message,setMessage]=useState(''),[dragging,setDragging]=useState(false),[seeking,setSeeking]=useState<number|null>(null);
 const stateRef=useRef(state);stateRef.current=state;const native=isTauri();
 const report=useCallback((error:unknown)=>setMessage(String(error)),[]);
 const call=useCallback(async(kind:string,value?:number,text?:string,id?:number)=>{try{await invoke('action',{action:{kind,value,text,id}})}catch(e){report(e)}},[report]);
 const open=useCallback(async(replace:boolean)=>{if(!native)return;try{const paths=await invoke<string[]>('pick_files',{subtitle:false});if(paths.length){setMessage('');await invoke('open_paths',{paths,replace});}}catch(e){report(e)}},[native,report]);
 const fullscreen=useCallback(async(exit=false)=>{if(!native)return;try{const w=getCurrentWindow();await w.setFullscreen(exit?false:!await w.isFullscreen())}catch(e){report(e)}},[native,report]);
 const subtitles=useCallback(async()=>{try{const paths=await invoke<string[]>('pick_files',{subtitle:true});if(paths[0])await invoke('load_subtitle',{path:paths[0]});}catch(e){report(e)}},[report]);
 useEffect(()=>{if(!native)return;let disposed=false;const stops:Array<()=>void>=[];const keep=(f:()=>void)=>disposed?f():stops.push(f);
  invoke<Snapshot>('get_state').then(v=>{if(!disposed)setState(v)}).catch(report);
  listen<Snapshot>('player-state',e=>setState(e.payload)).then(keep).catch(report);
  getCurrentWindow().onDragDropEvent(async event=>{if(event.payload.type==='over'||event.payload.type==='enter')setDragging(true);else setDragging(false);if(event.payload.type==='drop'){try{setMessage('');await invoke('open_paths',{paths:event.payload.paths,replace:false})}catch(e){report(e)}}}).then(keep).catch(report);
  return()=>{disposed=true;stops.forEach(f=>f())};
 },[native,report]);
 const dismiss=()=>{setMessage('');if(native)void call('dismiss_error')};
 const exportList=()=>invoke('export_playlist').catch(report);
 return {state,stateRef,native,call,open,fullscreen,subtitles,dragging,seeking,setSeeking,error:message||state.error,dismiss,exportList,report};
}
export type PlayerController=ReturnType<typeof usePlayer>;
export function useNativeSurface(player:PlayerController,view:View,covered:boolean){
 const ref=useRef<HTMLDivElement>(null);
 const {native,stateRef,report}=player;const current=player.state.settings.current;
 const place=useCallback(()=>{if(!native)return;const rect=ref.current?.getBoundingClientRect();const snap=stateRef.current;const item=snap.settings.playlist.find(i=>i.id===snap.settings.current);const visible=!!rect&&!!item&&mediaKind(item.name)!=='audio'&&['home','video'].includes(view)&&!covered&&rect.width>0&&rect.height>0;
  void invoke('place_video',{rect:{x:rect?.x||0,y:rect?.y||0,width:rect?.width||1,height:rect?.height||1,visible}}).catch(report);
 },[native,stateRef,report,view,covered]);
 useEffect(()=>{const observer=new ResizeObserver(place);if(ref.current)observer.observe(ref.current);window.addEventListener('resize',place);place();return()=>{observer.disconnect();window.removeEventListener('resize',place)}},[place,current]);
 return ref;
}
export function usePlayerKeys(player:PlayerController,onFullscreen:()=>void,search:()=>void){
 const {stateRef,call,open,fullscreen}=player;
 useEffect(()=>{const handler=(event:KeyboardEvent)=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();search();return;}
  if(event.target instanceof HTMLElement&&(['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)||event.target.isContentEditable||(event.target.tagName==='BUTTON'&&[' ','Enter'].includes(event.key))))return;
  const cmd=shortcut(event.key,event.ctrlKey||event.metaKey,event.shiftKey);if(!cmd)return;event.preventDefault();const {playback:p,settings:s}=stateRef.current;
  if(cmd==='open'||cmd==='append')void open(cmd==='open');else if(cmd==='fullscreen'||cmd==='exit_fullscreen'){onFullscreen();void fullscreen(cmd==='exit_fullscreen');}
  else if(cmd.startsWith('seek_')){if(p.seekable)void call('seek',p.duration>0?Math.min(p.duration,Math.max(0,p.time+(cmd==='seek_forward'?10000:-10000))):Math.max(0,p.time+(cmd==='seek_forward'?10000:-10000)));}
  else if(cmd.startsWith('volume_'))void call('volume',Math.max(0,Math.min(100,s.volume+(cmd==='volume_up'?5:-5))));
  else if(cmd==='cycle_audio'||cmd==='cycle_subtitle'){const audio=cmd==='cycle_audio',id=nextTrack(audio?p.audio_tracks:p.subtitle_tracks,audio?p.audio_track:p.subtitle_track);if(id!==null)void call(audio?'audio':'subtitle',id);}
  else if(cmd==='cycle_aspect'){const options=['','16:9','4:3','1:1','21:9'];void call('aspect',undefined,options[(options.indexOf(s.aspect)+1)%options.length]);}
  else if(cmd==='faster'||cmd==='slower')void call('rate',Math.max(.25,Math.min(4,s.rate+(cmd==='faster'?.25:-.25))));else void call(cmd);
 };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)},[stateRef,call,open,fullscreen,onFullscreen,search]);
}

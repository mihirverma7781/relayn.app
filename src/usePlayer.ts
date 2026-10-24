import {useCallback,useEffect,useRef,useState} from 'react';
import {invoke,isTauri} from '@tauri-apps/api/core';
import {listen} from '@tauri-apps/api/event';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {initial,nextTrack,shortcut,type Item,type Snapshot} from './player';
import {mediaKind} from './media';

let webAudio:HTMLAudioElement|null=null;
let webVideoEl:HTMLVideoElement|null=null;
export const webObjectUrls=new Map<number,string>();

export function usePlayer(){
 const [state,setState]=useState<Snapshot>(initial);
 const [message,setMessage]=useState('');
 const [dragging,setDragging]=useState(false);
 const [seeking,setSeeking]=useState<number|null>(null);
 const stateRef=useRef(state);
 stateRef.current=state;
 const native=isTauri();

 const report=useCallback((error:unknown)=>setMessage(String(error)),[]);

 const getActiveWebMedia=useCallback(():HTMLMediaElement|null=>{
  const curSnap=stateRef.current;
  const item=curSnap.settings.playlist.find(i=>i.id===curSnap.settings.current);
  if(!item)return webVideoEl||webAudio;
  return mediaKind(item.name)==='video'?(webVideoEl||webAudio):(webAudio||webVideoEl);
 },[]);

 const playWebItem=useCallback((item:Item)=>{
  const isVideo=mediaKind(item.name)==='video';
  const url=webObjectUrls.get(item.id)||item.path;

  // Stop previous
  if(webAudio&&webAudio!==webVideoEl){webAudio.pause();}
  if(webVideoEl){webVideoEl.pause();}

  const media:HTMLMediaElement=(isVideo&&webVideoEl)?webVideoEl:(webAudio||=(new Audio()));
  media.src=url;
  media.volume=stateRef.current.settings.muted?0:stateRef.current.settings.volume/100;
  media.playbackRate=stateRef.current.settings.rate;
  media.play().catch(report);

  setState(prev=>({
   ...prev,
   settings:{...prev.settings,current:item.id},
   playback:{
    ...prev.playback,
    state:'playing',
    title:item.name,
    artist:isVideo?'Local video preview':'Local audio preview',
    album:'Web mode playback'
   }
  }));
 },[report]);

 const call=useCallback(async(kind:string,value?:number,text?:string,id?:number)=>{
  if(native){
   try{
    await invoke('action',{action:{kind,value,text,id}});
   }catch(e){
    report(e);
   }
   return;
  }

  // Web preview mode fallback:
  const curSnap=stateRef.current;
  const playlist=curSnap.settings.playlist;
  const media=getActiveWebMedia();

  if(kind==='play'){
   const target=playlist.find(i=>i.id===(id??curSnap.settings.current))||playlist[0];
   if(target)playWebItem(target);
  }else if(kind==='toggle'){
   if(!media||!media.src){
    const target=playlist.find(i=>i.id===curSnap.settings.current)||playlist[0];
    if(target)playWebItem(target);
   }else if(media.paused){
    media.play().catch(report);
    setState(p=>({...p,playback:{...p.playback,state:'playing'}}));
   }else{
    media.pause();
    setState(p=>({...p,playback:{...p.playback,state:'paused'}}));
   }
  }else if(kind==='stop'){
   if(media){media.pause();media.currentTime=0;}
   setState(p=>({...p,playback:{...p.playback,state:'stopped',time:0}}));
  }else if(kind==='seek'){
   const ms=value??0;
   if(media)media.currentTime=ms/1000;
   setState(p=>({...p,playback:{...p.playback,time:ms}}));
  }else if(kind==='volume'){
   const vol=Math.max(0,Math.min(100,value??80));
   if(media&&!curSnap.settings.muted)media.volume=vol/100;
   setState(p=>({...p,settings:{...p.settings,volume:vol}}));
  }else if(kind==='mute'){
   const nextMute=!curSnap.settings.muted;
   if(media)media.volume=nextMute?0:curSnap.settings.volume/100;
   setState(p=>({...p,settings:{...p.settings,muted:nextMute}}));
  }else if(kind==='rate'){
   const r=value??1;
   if(media)media.playbackRate=r;
   setState(p=>({...p,settings:{...p.settings,rate:r}}));
  }else if(kind==='next'||kind==='previous'){
   if(!playlist.length)return;
   const curIdx=playlist.findIndex(i=>i.id===curSnap.settings.current);
   const nextIdx=kind==='next'?(curIdx+1)%playlist.length:(curIdx-1+playlist.length)%playlist.length;
   playWebItem(playlist[nextIdx]);
  }else if(kind==='repeat'){
   const r=(text as 'off'|'all'|'one')||'off';
   if(media)media.loop=r==='one';
   setState(p=>({...p,settings:{...p.settings,repeat:r}}));
  }else if(kind==='aspect'){
   setState(p=>({...p,settings:{...p.settings,aspect:text||''}}));
  }else if(kind==='remove'&&id!==undefined){
   const nextList=playlist.filter(i=>i.id!==id);
   const nextCurrent=curSnap.settings.current===id?(nextList[0]?.id??null):curSnap.settings.current;
   setState(p=>({...p,settings:{...p.settings,playlist:nextList,current:nextCurrent}}));
  }else if(kind==='move_up'&&id!==undefined){
   const idx=playlist.findIndex(i=>i.id===id);
   if(idx>0){
    const next=[...playlist];
    const temp=next[idx-1];next[idx-1]=next[idx];next[idx]=temp;
    setState(p=>({...p,settings:{...p.settings,playlist:next}}));
   }
  }else if(kind==='move_down'&&id!==undefined){
   const idx=playlist.findIndex(i=>i.id===id);
   if(idx>=0&&idx<playlist.length-1){
    const next=[...playlist];
    const temp=next[idx+1];next[idx+1]=next[idx];next[idx]=temp;
    setState(p=>({...p,settings:{...p.settings,playlist:next}}));
   }
  }else if(kind==='clear'){
   if(media){media.pause();media.src='';}
   setState(p=>({...p,settings:{...p.settings,playlist:[],current:null},playback:{...initial.playback}}));
  }
 },[native,report,playWebItem,getActiveWebMedia]);

 const handleFilesSelected=useCallback((fileList:FileList,replace=false)=>{
  const files=Array.from(fileList);
  if(!files.length)return;
  let nextId=Math.max(0,...stateRef.current.settings.playlist.map(i=>i.id))+1;
  const newItems:Item[]=files.map(f=>{
   const id=nextId++;
   const url=URL.createObjectURL(f);
   webObjectUrls.set(id,url);
   return {id,path:f.name,name:f.name};
  });
  setState(p=>({
   ...p,
   settings:{
    ...p.settings,
    playlist:replace?newItems:[...p.settings.playlist,...newItems],
    current:replace||!p.settings.current?newItems[0].id:p.settings.current
   }
  }));
  if(replace||!stateRef.current.settings.current){
   playWebItem(newItems[0]);
  }
 },[playWebItem]);

 const open=useCallback(async(replace=true)=>{
  if(native){
   try{
    setMessage('');
    const paths=await invoke<string[]>('pick_files',{subtitle:false});
    if(paths.length)await invoke('open_paths',{paths,replace});
   }catch(e){
    report(e);
   }
   return;
  }
  const input=document.createElement('input');
  input.type='file';
  input.multiple=true;
  input.accept='audio/*,video/*';
  input.onchange=()=>{
   if(input.files?.length)handleFilesSelected(input.files,replace);
  };
  input.click();
 },[native,handleFilesSelected,report]);

 const fullscreen=useCallback(async(exit=false)=>{
  if(native){
   try{
    const w=getCurrentWindow();
    await w.setFullscreen(exit?false:!await w.isFullscreen());
   }catch(e){
    report(e);
   }
   return;
  }
  if(exit){
   if(document.fullscreenElement)void document.exitFullscreen();
  }else{
   if(!document.fullscreenElement)void document.documentElement.requestFullscreen();
   else void document.exitFullscreen();
  }
 },[native]);

 const subtitles=useCallback(async()=>{
  if(native){
   try{
    const paths=await invoke<string[]>('pick_files',{subtitle:true});
    if(paths[0])await invoke('load_subtitle',{path:paths[0]});
   }catch(e){
    report(e);
   }
   return;
  }
  const input=document.createElement('input');
  input.type='file';
  input.accept='.srt,.vtt,.ass,.ssa';
  input.onchange=()=>{
   if(input.files?.[0]){
    setMessage(`Loaded subtitle: ${input.files[0].name}`);
   }
  };
  input.click();
 },[native,report]);

 useEffect(()=>{
  if(native){
   let disposed=false;
   const stops:Array<()=>void>=[];
   const keep=(f:()=>void)=>disposed?f():stops.push(f);
   invoke<Snapshot>('get_state').then(v=>{if(!disposed)setState(v)}).catch(report);
   listen<Snapshot>('player-state',e=>setState(e.payload)).then(keep).catch(report);
   getCurrentWindow().onDragDropEvent(async event=>{
    if(event.payload.type==='over'||event.payload.type==='enter')setDragging(true);
    else setDragging(false);
    if(event.payload.type==='drop'){
     try{
      setMessage('');
      await invoke('open_paths',{paths:event.payload.paths,replace:false});
     }catch(e){
      report(e);
     }
    }
   }).then(keep).catch(report);
   return()=>{disposed=true;stops.forEach(f=>f())};
  }

  // Web mode initialization & listeners
  setState(p=>({...p,runtime:'Web Preview Mode'}));
  if(!webAudio)webAudio=new Audio();

  const bindMediaEvents=(media:HTMLMediaElement)=>{
   const onTimeUpdate=()=>{
    setState(p=>({
     ...p,
     playback:{
      ...p.playback,
      time:Math.floor(media.currentTime*1000),
      duration:Math.floor((media.duration||0)*1000),
      seekable:Number.isFinite(media.duration)&&media.duration>0
     }
    }));
   };
   const onEnded=()=>{
    const curSnap=stateRef.current;
    const list=curSnap.settings.playlist;
    const idx=list.findIndex(i=>i.id===curSnap.settings.current);
    if(curSnap.settings.repeat==='one'){
     media.currentTime=0;
     media.play().catch(report);
    }else if(idx>=0&&idx<list.length-1){
     playWebItem(list[idx+1]);
    }else if(curSnap.settings.repeat==='all'&&list[0]){
     playWebItem(list[0]);
    }else{
     setState(p=>({...p,playback:{...p.playback,state:'stopped',time:0}}));
    }
   };
   media.addEventListener('timeupdate',onTimeUpdate);
   media.addEventListener('ended',onEnded);
   return()=>{
    media.removeEventListener('timeupdate',onTimeUpdate);
    media.removeEventListener('ended',onEnded);
   };
  };

  const unbindAudio=bindMediaEvents(webAudio);
  let unbindVideo=()=>{};
  if(webVideoEl)unbindVideo=bindMediaEvents(webVideoEl);

  const onDragOver=(e:DragEvent)=>{e.preventDefault();setDragging(true);};
  const onDragLeave=(e:DragEvent)=>{
   if(e.relatedTarget===null)setDragging(false);
  };
  const onDrop=(e:DragEvent)=>{
   e.preventDefault();
   setDragging(false);
   if(e.dataTransfer?.files.length){
    handleFilesSelected(e.dataTransfer.files,false);
   }
  };
  window.addEventListener('dragover',onDragOver);
  window.addEventListener('dragleave',onDragLeave);
  window.addEventListener('drop',onDrop);

  return()=>{
   unbindAudio();
   unbindVideo();
   window.removeEventListener('dragover',onDragOver);
   window.removeEventListener('dragleave',onDragLeave);
   window.removeEventListener('drop',onDrop);
  };
 },[native,report,handleFilesSelected,playWebItem]);

 const setWebVideoRef=useCallback((el:HTMLVideoElement|null)=>{
  webVideoEl=el;
 },[]);

 const dismiss=()=>{setMessage('');if(native)void call('dismiss_error');};

 const exportList=()=>{
  if(native){
   invoke('export_playlist').catch(report);
   return;
  }
  const items=stateRef.current.settings.playlist;
  if(!items.length)return;
  const content='#EXTM3U\n'+items.map(i=>`#EXTINF:-1,${i.name}\n${i.path}`).join('\n')+'\n';
  const blob=new Blob([content],{type:'audio/x-mpegurl'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='relayn-collection.m3u';
  a.click();
  URL.revokeObjectURL(url);
 };

 return {
  state,
  stateRef,
  native,
  call,
  open,
  fullscreen,
  subtitles,
  dragging,
  seeking,
  setSeeking,
  error:message||state.error,
  dismiss,
  exportList,
  report,
  setWebVideoRef
 };
}

export type PlayerController=ReturnType<typeof usePlayer>;

export function useNativeSurface(player:PlayerController,active=true,covered=false){
 const ref=useRef<HTMLDivElement>(null);
 const {native,stateRef,report}=player;
 const current=player.state.settings.current;

 const place=useCallback(()=>{
  if(!native)return;
  const rect=ref.current?.getBoundingClientRect();
  const snap=stateRef.current;
  const item=snap.settings.playlist.find(i=>i.id===snap.settings.current);
  const visible=!!rect&&!!item&&mediaKind(item.name)!=='audio'&&active&&!covered&&rect.width>0&&rect.height>0;
  void invoke('place_video',{
   rect:{
    x:Math.round(rect?.x||0),
    y:Math.round(rect?.y||0),
    width:Math.round(rect?.width||1),
    height:Math.round(rect?.height||1),
    visible
   }
  }).catch(report);
 },[native,stateRef,report,active,covered]);

 useEffect(()=>{
  const observer=new ResizeObserver(place);
  if(ref.current)observer.observe(ref.current);
  window.addEventListener('resize',place);
  place();
  const t=setTimeout(place,80);
  return()=>{
   clearTimeout(t);
   observer.disconnect();
   window.removeEventListener('resize',place);
  };
 },[place,current]);

 return ref;
}

export function usePlayerKeys(player:PlayerController,onFullscreen:()=>void,onToggleQueue:()=>void){
 const {stateRef,call,open,fullscreen}=player;
 useEffect(()=>{
  const handler=(event:KeyboardEvent)=>{
   if(event.target instanceof HTMLElement&&(['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)||event.target.isContentEditable||(event.target.tagName==='BUTTON'&&[' ','Enter'].includes(event.key))))return;
   if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='o'){
    event.preventDefault();
    void open(true);
    return;
   }
   if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='l'){
    event.preventDefault();
    onToggleQueue();
    return;
   }
   const cmd=shortcut(event.key,event.ctrlKey||event.metaKey,event.shiftKey);
   if(!cmd)return;
   event.preventDefault();
   const {playback:p,settings:s}=stateRef.current;
   if(cmd==='open'||cmd==='append')void open(cmd==='open');
   else if(cmd==='fullscreen'||cmd==='exit_fullscreen'){onFullscreen();void fullscreen(cmd==='exit_fullscreen');}
   else if(cmd.startsWith('seek_')){
    if(p.seekable)void call('seek',p.duration>0?Math.min(p.duration,Math.max(0,p.time+(cmd==='seek_forward'?10000:-10000))):Math.max(0,p.time+(cmd==='seek_forward'?10000:-10000)));
   }
   else if(cmd.startsWith('volume_'))void call('volume',Math.max(0,Math.min(100,s.volume+(cmd==='volume_up'?5:-5))));
   else if(cmd==='cycle_audio'||cmd==='cycle_subtitle'){
    const audio=cmd==='cycle_audio',id=nextTrack(audio?p.audio_tracks:p.subtitle_tracks,audio?p.audio_track:p.subtitle_track);
    if(id!==null)void call(audio?'audio':'subtitle',id);
   }
   else if(cmd==='cycle_aspect'){
    const options=['','16:9','4:3','1:1','21:9'];
    void call('aspect',undefined,options[(options.indexOf(s.aspect)+1)%options.length]);
   }
   else if(cmd==='faster'||cmd==='slower')void call('rate',Math.max(.25,Math.min(4,s.rate+(cmd==='faster'?.25:-.25))));
   else void call(cmd);
  };
  window.addEventListener('keydown',handler);
  return()=>window.removeEventListener('keydown',handler);
 },[stateRef,call,open,fullscreen,onFullscreen,onToggleQueue]);
}

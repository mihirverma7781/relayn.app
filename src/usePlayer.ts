import {useCallback,useEffect,useRef,useState} from 'react';
import {invoke,isTauri} from '@tauri-apps/api/core';
import {listen} from '@tauri-apps/api/event';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {initial,nextTrack,shortcut,type Item,type Snapshot} from './player';
import {mediaKind,type View} from './media';

let webAudio:HTMLAudioElement|null=null;
const webObjectUrls=new Map<number,string>();

export function usePlayer(){
 const [state,setState]=useState<Snapshot>(initial);
 const [message,setMessage]=useState('');
 const [dragging,setDragging]=useState(false);
 const [seeking,setSeeking]=useState<number|null>(null);
 const stateRef=useRef(state);
 stateRef.current=state;
 const native=isTauri();

 const report=useCallback((error:unknown)=>setMessage(String(error)),[]);

 const playWebItem=useCallback((item:Item)=>{
  if(!webAudio)webAudio=new Audio();
  const url=webObjectUrls.get(item.id)||item.path;
  webAudio.src=url;
  webAudio.volume=stateRef.current.settings.muted?0:stateRef.current.settings.volume/100;
  webAudio.playbackRate=stateRef.current.settings.rate;
  webAudio.play().catch(report);
  setState(prev=>({
   ...prev,
   settings:{...prev.settings,current:item.id},
   playback:{
    ...prev.playback,
    state:'playing',
    title:item.name,
    artist:'Local audio preview',
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
  if(kind==='play'){
   const target=playlist.find(i=>i.id===(id??curSnap.settings.current))||playlist[0];
   if(target)playWebItem(target);
  }else if(kind==='toggle'){
   if(!webAudio||!webAudio.src){
    const target=playlist.find(i=>i.id===curSnap.settings.current)||playlist[0];
    if(target)playWebItem(target);
   }else if(webAudio.paused){
    webAudio.play().catch(report);
    setState(p=>({...p,playback:{...p.playback,state:'playing'}}));
   }else{
    webAudio.pause();
    setState(p=>({...p,playback:{...p.playback,state:'paused'}}));
   }
  }else if(kind==='stop'){
   if(webAudio){webAudio.pause();webAudio.currentTime=0;}
   setState(p=>({...p,playback:{...p.playback,state:'stopped',time:0}}));
  }else if(kind==='seek'){
   const ms=value??0;
   if(webAudio)webAudio.currentTime=ms/1000;
   setState(p=>({...p,playback:{...p.playback,time:ms}}));
  }else if(kind==='volume'){
   const vol=Math.max(0,Math.min(100,value??80));
   if(webAudio&&!curSnap.settings.muted)webAudio.volume=vol/100;
   setState(p=>({...p,settings:{...p.settings,volume:vol}}));
  }else if(kind==='mute'){
   const nextMute=!curSnap.settings.muted;
   if(webAudio)webAudio.volume=nextMute?0:curSnap.settings.volume/100;
   setState(p=>({...p,settings:{...p.settings,muted:nextMute}}));
  }else if(kind==='rate'){
   const r=value??1;
   if(webAudio)webAudio.playbackRate=r;
   setState(p=>({...p,settings:{...p.settings,rate:r}}));
  }else if(kind==='next'||kind==='previous'){
   if(!playlist.length)return;
   const curIdx=playlist.findIndex(i=>i.id===curSnap.settings.current);
   const nextIdx=kind==='next'?(curIdx+1)%playlist.length:(curIdx-1+playlist.length)%playlist.length;
   playWebItem(playlist[nextIdx]);
  }else if(kind==='repeat'){
   const r=(text as 'off'|'all'|'one')||'off';
   if(webAudio)webAudio.loop=r==='one';
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
   if(webAudio){webAudio.pause();webAudio.src='';}
   setState(p=>({...p,settings:{...p.settings,playlist:[],current:null},playback:{...initial.playback}}));
  }
 },[native,playWebItem,report]);

 const handleFilesSelected=useCallback((fileList:FileList|File[],replace:boolean)=>{
  const files=Array.from(fileList);
  if(!files.length)return;
  let maxId=Math.max(0,...stateRef.current.settings.playlist.map(i=>i.id));
  const newItems:Item[]=files.map(f=>{
   const id=++maxId;
   const objUrl=URL.createObjectURL(f);
   webObjectUrls.set(id,objUrl);
   return {id,name:f.name,path:f.name};
  });
  setMessage('');
  setState(prev=>{
   const playlist=replace?newItems:[...prev.settings.playlist,...newItems];
   const current=replace||prev.settings.current===null?(newItems[0]?.id??null):prev.settings.current;
   return {...prev,settings:{...prev.settings,playlist,current}};
  });
  if(replace&&newItems[0]){
   playWebItem(newItems[0]);
  }
 },[playWebItem]);

 const open=useCallback(async(replace:boolean)=>{
  if(native){
   try{
    const paths=await invoke<string[]>('pick_files',{subtitle:false});
    if(paths.length){setMessage('');await invoke('open_paths',{paths,replace});}
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
  setState(p=>({...p,runtime:'Web Preview · Tauri app uses libVLC'}));
  if(!webAudio)webAudio=new Audio();
  const audio=webAudio;
  const onTimeUpdate=()=>{
   setState(p=>({
    ...p,
    playback:{
     ...p.playback,
     time:Math.floor(audio.currentTime*1000),
     duration:Math.floor((audio.duration||0)*1000),
     seekable:Number.isFinite(audio.duration)&&audio.duration>0
    }
   }));
  };
  const onEnded=()=>{
   const curSnap=stateRef.current;
   const list=curSnap.settings.playlist;
   if(curSnap.settings.repeat==='one'){
    audio.currentTime=0;
    audio.play().catch(report);
   }else if(list.length){
    const idx=list.findIndex(i=>i.id===curSnap.settings.current);
    if(idx>=0&&idx<list.length-1){
     playWebItem(list[idx+1]);
    }else if(curSnap.settings.repeat==='all'&&list[0]){
     playWebItem(list[0]);
    }else{
     setState(p=>({...p,playback:{...p.playback,state:'stopped',time:0}}));
    }
   }
  };
  audio.addEventListener('timeupdate',onTimeUpdate);
  audio.addEventListener('ended',onEnded);

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
   audio.removeEventListener('timeupdate',onTimeUpdate);
   audio.removeEventListener('ended',onEnded);
   window.removeEventListener('dragover',onDragOver);
   window.removeEventListener('dragleave',onDragLeave);
   window.removeEventListener('drop',onDrop);
  };
 },[native,report,handleFilesSelected,playWebItem]);

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

 return {state,stateRef,native,call,open,fullscreen,subtitles,dragging,seeking,setSeeking,error:message||state.error,dismiss,exportList,report};
}

export type PlayerController=ReturnType<typeof usePlayer>;

export function useNativeSurface(player:PlayerController,view:View,covered:boolean){
 const ref=useRef<HTMLDivElement>(null);
 const {native,stateRef,report}=player;
 const current=player.state.settings.current;
 const place=useCallback(()=>{
  if(!native)return;
  const rect=ref.current?.getBoundingClientRect();
  const snap=stateRef.current;
  const item=snap.settings.playlist.find(i=>i.id===snap.settings.current);
  const visible=!!rect&&!!item&&mediaKind(item.name)!=='audio'&&['home','video'].includes(view)&&!covered&&rect.width>0&&rect.height>0;
  void invoke('place_video',{rect:{x:rect?.x||0,y:rect?.y||0,width:rect?.width||1,height:rect?.height||1,visible}}).catch(report);
 },[native,stateRef,report,view,covered]);

 useEffect(()=>{
  const observer=new ResizeObserver(place);
  if(ref.current)observer.observe(ref.current);
  window.addEventListener('resize',place);
  place();
  return()=>{
   observer.disconnect();
   window.removeEventListener('resize',place);
  };
 },[place,current]);

 return ref;
}

export function usePlayerKeys(player:PlayerController,onFullscreen:()=>void,search:()=>void){
 const {stateRef,call,open,fullscreen}=player;
 useEffect(()=>{
  const handler=(event:KeyboardEvent)=>{
   if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
    event.preventDefault();
    search();
    return;
   }
   if(event.target instanceof HTMLElement&&(['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)||event.target.isContentEditable||(event.target.tagName==='BUTTON'&&[' ','Enter'].includes(event.key))))return;
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
 },[stateRef,call,open,fullscreen,onFullscreen,search]);
}

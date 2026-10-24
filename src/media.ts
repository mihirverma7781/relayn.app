export type MediaKind = 'audio' | 'video' | 'other';
export type View = 'home' | 'library' | 'video' | 'audio';
export const AUDIO_EXTENSIONS = new Set(['mp3','flac','wav','aac','m4a','ogg','opus','aiff','aif','alac','wma','ape','oga']);
export const VIDEO_EXTENSIONS = new Set(['mp4','mkv','avi','mov','webm','m4v','wmv','mpeg','mpg','ts','mts','m2ts','vob','ogv','3gp']);
export function extension(name:string):string {return name.split('.').pop()?.toLowerCase() || '';}
export function mediaKind(name:string):MediaKind {const ext=extension(name);return AUDIO_EXTENSIONS.has(ext)?'audio':VIDEO_EXTENSIONS.has(ext)?'video':'other';}
export function mediaTitle(name:string):string {return name.replace(/\.[^.]+$/,'').replace(/[_]+/g,' ');}
export function parentFolder(path:string):string {return path.replace(/\\/g,'/').split('/').slice(0,-1).pop() || 'Local files';}
export function artSeed(name:string):number {return [...name].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,0)%5;}

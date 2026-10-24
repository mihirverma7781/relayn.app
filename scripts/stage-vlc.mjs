import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=path.resolve('src-tauri/resources/vlc-3.0.24');
const source=process.env.LIBVLC_DIR || (process.platform==='win32'?'C:/Program Files/VideoLAN/VLC':'/Applications/VLC.app/Contents/MacOS');
fs.mkdirSync(root,{recursive:true});

function copy(from,to,options={}){
 if(!fs.existsSync(from))throw new Error(`Missing native dependency: ${from}`);
 fs.cpSync(from,to,{recursive:true,...options});
}

if(process.platform==='win32'){
 for(const name of ['libvlc.dll','libvlccore.dll','plugins']){
  const dest=path.join(root,name);
  if(fs.existsSync(dest))fs.rmSync(dest,{recursive:true,force:true});
  copy(path.join(source,name),dest);
 }
 for(const name of ['COPYING.txt','AUTHORS.txt','THANKS.txt']){
  if(fs.existsSync(path.join(source,name)))copy(path.join(source,name),path.join(root,name));
 }
}else if(process.platform==='darwin'){
 const base=fs.existsSync(path.join(source,'lib'))?source:path.dirname(source);
 const libDest=path.join(root,'lib');
 const pluginsDest=path.join(root,'plugins');
 if(fs.existsSync(libDest))fs.rmSync(libDest,{recursive:true,force:true});
 if(fs.existsSync(pluginsDest))fs.rmSync(pluginsDest,{recursive:true,force:true});

 // VLC.app uses versioned dylibs behind symlinks. cp -RL dereferences all symlinks into real files so the staged runtime remains self-contained after the DMG is detached.
 execFileSync('cp',['-RL',path.join(base,'lib'),libDest]);
 execFileSync('cp',['-RL',path.join(base,'plugins'),pluginsDest]);

 // Remove GUI-only plugins that link to unbundled VLC desktop app frameworks (Sparkle, Growl). Embedded libVLC does not use VLC Cocoa GUI.
 for(const p of ['libmacosx_plugin.dylib','libosx_notifications_plugin.dylib']){
  const f=path.join(pluginsDest,p);
  if(fs.existsSync(f))fs.rmSync(f,{force:true});
 }
 console.log('macOS: libVLC libraries and plugins staged.');
}else throw new Error('Packaging is configured for Windows and macOS only.');

fs.writeFileSync(path.join(root,'RUNTIME-PROVENANCE.txt'),`Runtime staged from ${source}\nStaged at ${new Date().toISOString()}\nPreserve and review upstream license/source obligations before distributing.\n`);
console.log(`libVLC runtime staged at ${root}`);

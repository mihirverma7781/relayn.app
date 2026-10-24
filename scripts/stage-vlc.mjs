import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('src-tauri/resources/vlc-3.0.24');
const source=process.env.LIBVLC_DIR || (process.platform==='win32'?'C:/Program Files/VideoLAN/VLC':'/Applications/VLC.app/Contents/MacOS');
fs.mkdirSync(root,{recursive:true});
function copy(from,to){if(!fs.existsSync(from))throw new Error(`Missing native dependency: ${from}`);fs.cpSync(from,to,{recursive:true});}
if(process.platform==='win32'){
 for(const name of ['libvlc.dll','libvlccore.dll','plugins'])copy(path.join(source,name),path.join(root,name));
 for(const name of ['COPYING.txt','AUTHORS.txt','THANKS.txt'])if(fs.existsSync(path.join(source,name)))copy(path.join(source,name),path.join(root,name));
}else if(process.platform==='darwin'){
 const base=fs.existsSync(path.join(source,'lib'))?source:path.dirname(source);
 copy(path.join(base,'lib'),path.join(root,'lib'));copy(path.join(base,'plugins'),path.join(root,'plugins'));
 console.log('macOS: verify dylib install names with otool before release. See README.');
}else throw new Error('Packaging is configured for Windows and macOS only.');
fs.writeFileSync(path.join(root,'RUNTIME-PROVENANCE.txt'),`Runtime staged from ${source}\nStaged at ${new Date().toISOString()}\nPreserve and review upstream license/source obligations before distributing.\n`);
console.log(`libVLC runtime staged at ${root}`);

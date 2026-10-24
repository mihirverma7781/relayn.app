import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pipeline} from 'node:stream/promises';
const version='3.0.24';
const platform=process.platform;
if(!['win32','darwin'].includes(platform))throw new Error('Only Windows and macOS are supported');
const arch=process.arch==='arm64'?'arm64':'x64';
const name=platform==='win32'?`vlc-${version}-win${arch==='arm64'?'arm64':'64'}.zip`:`vlc-${version}-${arch==='arm64'?'arm64':'intel64'}.dmg`;
const base=`https://download.videolan.org/pub/videolan/vlc/${version}/${platform==='win32'?(arch==='arm64'?'winarm64':'win64'):'macosx'}/`;
const dir=path.resolve('work/runtime-downloads');fs.mkdirSync(dir,{recursive:true});
const archive=path.join(dir,name);
async function download(url,file){const response=await fetch(url);if(!response.ok||!response.body)throw new Error(`Download failed: ${url} (${response.status})`);await pipeline(response.body,fs.createWriteStream(file));}
console.log(`Downloading official libVLC runtime ${version} (${arch})…`);
if(!fs.existsSync(archive))await download(base+name,archive);
const checksumResponse=await fetch(base+name+'.sha256');if(!checksumResponse.ok)throw new Error('Cannot obtain upstream checksum');
const checksumText=await checksumResponse.text();const expected=checksumText.match(/\b[a-f0-9]{64}\b/i)?.[0].toLowerCase();if(!expected)throw new Error('Invalid checksum document');
const hash=createHash('sha256');for await(const chunk of fs.createReadStream(archive))hash.update(chunk);const actual=hash.digest('hex');if(actual!==expected)throw new Error(`SHA-256 mismatch for ${name}`);
console.log(`Verified SHA-256 ${actual}`);
fs.writeFileSync(path.join(dir,name+'.sha256'),checksumText);
let source,mount;
try{
 if(platform==='win32'){const extract=path.join(dir,`windows-${arch}-${version}`);fs.mkdirSync(extract,{recursive:true});execFileSync('tar.exe',['-xf',archive,'-C',extract]);source=path.join(extract,`vlc-${version}`);}
 else{mount=path.join(dir,'vlc-mount');fs.mkdirSync(mount,{recursive:true});execFileSync('hdiutil',['attach',archive,'-readonly','-nobrowse','-mountpoint',mount]);source=path.join(mount,'VLC.app/Contents/MacOS');}
 const staged=path.resolve('src-tauri/resources/vlc-3.0.24');
 execFileSync(process.execPath,['scripts/stage-vlc.mjs'],{env:{...process.env,LIBVLC_DIR:source},stdio:'inherit'});
 fs.appendFileSync(path.join(staged,'RUNTIME-PROVENANCE.txt'),`Upstream: ${base+name}\nVersion: ${version}\nSHA-256: ${actual}\nSource: https://download.videolan.org/pub/videolan/vlc/${version}/vlc-${version}.tar.xz\n`);
}finally{if(mount)execFileSync('hdiutil',['detach',mount]);}

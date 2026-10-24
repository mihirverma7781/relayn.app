import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
if(process.platform!=='darwin')process.exit(0);
const root=path.resolve('src-tauri/resources/vlc-3.0.24');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=path.join(dir,entry.name);return entry.isDirectory()?walk(file):entry.isFile()?[file]:[];});}
const dylibs=walk(root).filter(f=>f.endsWith('.dylib'));
if(!dylibs.length)throw new Error('No staged macOS dylibs. Run npm run runtime:fetch first.');
for(const file of dylibs){
 const linked=execFileSync('otool',['-L',file],{encoding:'utf8'}).split('\n').slice(1).map(l=>l.trim().split(' (')[0]).filter(Boolean);
 for(const dependency of linked){
  if(dependency.startsWith('/System/')||dependency.startsWith('/usr/lib/'))continue;
  const target=dylibs.find(f=>path.basename(f)===path.basename(dependency));
  if(!target)throw new Error(`Unbundled dylib dependency ${dependency} in ${file}`);
  const relative='@loader_path/'+path.relative(path.dirname(file),target).split(path.sep).join('/');
  if(dependency!==relative)execFileSync('install_name_tool',['-change',dependency,relative,file]);
 }
 // Each loadable plugin and runtime library must be signed before the outer app.
 const identity=process.env.APPLE_SIGNING_IDENTITY||'-';
 execFileSync('codesign',['--force','--sign',identity,...(identity==='-'?[]:['--timestamp','--options','runtime']),file]);
 execFileSync('codesign',['--verify','--strict',file]);
}
console.log(`Verified loader paths and signatures for ${dylibs.length} macOS libraries.`);

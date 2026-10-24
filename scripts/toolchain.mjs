import {spawn} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const env={...process.env};const inheritedPath=process.env.PATH||process.env.Path||'';for(const key of Object.keys(env))if(key.toLowerCase()==='path')delete env[key];const cargo=path.join(os.homedir(),'.cargo','bin');env.PATH=(fs.existsSync(cargo)?cargo+path.delimiter:'')+inheritedPath;
const [tool,...args]=process.argv.slice(2);
const child=tool==='tauri'?spawn(process.execPath,['node_modules/@tauri-apps/cli/tauri.js',...args],{env,stdio:'inherit',windowsHide:true}):spawn(tool==='cargo'?(process.platform==='win32'?'cargo.exe':'cargo'):tool,args,{env,stdio:'inherit'});
child.on('error',e=>{console.error(e.message);process.exitCode=1});child.on('exit',code=>{process.exitCode=code??1});


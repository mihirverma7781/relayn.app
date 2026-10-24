import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
const env={...process.env,PATH:path.join(os.homedir(),'.cargo/bin')+path.delimiter+process.env.PATH};
let failed=false;
function command(name,args){const result=spawnSync(name,args,{env,encoding:'utf8',windowsHide:true});if(result.error||result.status!==0){failed=true;console.error(`${name}: ${result.error?.message||result.stderr}`);return null;}console.log(result.stdout.trim());return result.stdout;}
command('node',['--version']);command('rustc',['--version']);command('cargo',['--version']);
if(process.platform==='win32'){
 const vswhere=path.join(process.env['ProgramFiles(x86)']||'C:/Program Files (x86)','Microsoft Visual Studio/Installer/vswhere.exe');
 const root=command(vswhere,['-latest','-products','*','-requires','Microsoft.VisualStudio.Component.VC.Tools.x86.x64','-property','installationPath'])?.trim();
 if(!root){failed=true;console.error('Missing MSVC workload. Install Desktop development with C++.');}
 else{const tools=path.join(root,'VC/Tools/MSVC');const versions=fs.existsSync(tools)?fs.readdirSync(tools).sort().reverse():[];const linker=versions.map(v=>path.join(tools,v,'bin/Hostx64/x64/link.exe')).find(p=>fs.existsSync(p));if(!linker){failed=true;console.error('MSVC linker is not installed yet.');}else console.log(`MSVC linker: ${linker}`);}
 const sdk=path.join(process.env['ProgramFiles(x86)']||'C:/Program Files (x86)','Windows Kits/10/Lib');const sdks=fs.existsSync(sdk)?fs.readdirSync(sdk).filter(v=>fs.existsSync(path.join(sdk,v,'um/x64/kernel32.lib'))):[];if(!sdks.length){failed=true;console.error('Windows SDK is not installed yet.');}else console.log(`Windows SDK: ${sdks.join(', ')}`);
}else if(process.platform==='darwin')command('xcode-select',['-p']);
if(!failed){fs.mkdirSync('work/toolchain-probe',{recursive:true});fs.writeFileSync('work/toolchain-probe/main.rs','fn main() { println!("native-toolchain-ok"); }');const output=path.resolve('work/toolchain-probe',process.platform==='win32'?'probe.exe':'probe');if(command('rustc',['work/toolchain-probe/main.rs','-o',output])!==null)command(output,[]);}
process.exitCode=failed?1:0;

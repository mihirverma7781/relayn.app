import fs from 'node:fs';
const w=160,h=90,fps=20,count=120,frameSize=w*h*3;
const u32=(n)=>{const b=Buffer.alloc(4);b.writeUInt32LE(n>>>0);return b};
const chunk=(tag,b)=>Buffer.concat([Buffer.from(tag),u32(b.length),b,...(b.length%2?[Buffer.alloc(1)]:[])]);
const list=(tag,parts)=>chunk('LIST',Buffer.concat([Buffer.from(tag),...parts]));
const avih=Buffer.alloc(56);[50000,frameSize*fps,0,16,count,0,1,frameSize,w,h].forEach((v,i)=>avih.writeUInt32LE(v,i*4));
const strh=Buffer.alloc(56);strh.write('vidsDIB ');strh.writeUInt32LE(1,20);strh.writeUInt32LE(fps,24);strh.writeUInt32LE(count,32);strh.writeUInt32LE(frameSize,36);strh.writeUInt32LE(0xffffffff,40);strh.writeInt16LE(w,52);strh.writeInt16LE(h,54);
const strf=Buffer.alloc(40);strf.writeUInt32LE(40);strf.writeInt32LE(w,4);strf.writeInt32LE(h,8);strf.writeUInt16LE(1,12);strf.writeUInt16LE(24,14);strf.writeUInt32LE(frameSize,20);
const frames=[],index=[];let offset=4;
for(let f=0;f<count;f++){const data=Buffer.alloc(frameSize);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*3;data[i]=(x+f*2)%256;data[i+1]=(y*2+f)%256;data[i+2]=x<((f*3)%w)?210:50;}frames.push(chunk('00db',data));index.push(Buffer.concat([Buffer.from('00db'),u32(16),u32(offset),u32(frameSize)]));offset+=8+frameSize;}
fs.mkdirSync('work/fixtures',{recursive:true});fs.writeFileSync('work/fixtures/color-motion.avi',chunk('RIFF',Buffer.concat([Buffer.from('AVI '),list('hdrl',[chunk('avih',avih),list('strl',[chunk('strh',strh),chunk('strf',strf)])]),list('movi',frames),chunk('idx1',Buffer.concat(index))])));
const rate=44100,samples=rate*6,b=Buffer.alloc(44+samples*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples*2,40);for(let i=0;i<samples;i++)b.writeInt16LE(Math.round(2000*Math.sin(i*2*Math.PI*440/rate)),44+i*2);fs.writeFileSync('work/fixtures/tone.wav',b);
fs.writeFileSync('work/fixtures/English.srt','1\n00:00:00,100 --> 00:00:05,000\nAster subtitle verification\n');fs.writeFileSync('work/fixtures/corrupt.mp4','This is not a media file.');fs.writeFileSync('work/fixtures/playlist.m3u8','#EXTM3U\ntone.wav\ncolor-motion.avi\n');console.log('Generated original AVI, WAV, SRT, corrupt-file and playlist fixtures.');

import {describe,it,expect} from 'vitest';
import {formatTime,nextTrack,shortcut} from '../src/player';
describe('media controls',()=>{
 it('formats duration without wrapping hours',()=>{expect(formatTime(3661000)).toBe('1:01:01');expect(formatTime(-30)).toBe('0:00');expect(formatTime(NaN)).toBe('0:00');expect(formatTime(90000)).toBe('1:30')});
 it('uses track IDs rather than array offsets',()=>{const tracks=[{id:-1,name:'Disable'},{id:5,name:'English'},{id:12,name:'日本語'}];expect(nextTrack(tracks,5)).toBe(12);expect(nextTrack(tracks,12)).toBe(-1);expect(nextTrack([],0)).toBe(null)});
 it('keeps native open shortcuts distinct from playback keys',()=>{expect(shortcut('o',true,false)).toBe('open');expect(shortcut('O',true,true)).toBe('append');expect(shortcut('s',true,false)).toBe(null);expect(shortcut(' ',false,false)).toBe('toggle');expect(shortcut('Escape',false,false)).toBe('exit_fullscreen')});
});

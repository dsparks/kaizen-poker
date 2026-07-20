// Sound effects: shared audio cache plus a global enable flag persisted to
// localStorage (the React state in KaizenPoker mirrors it via setGlobalSfxEnabled).
// Sample files are vendored under src/assets/sfx so the game works offline and
// never blocks on a third-party CDN; cardPlay/defeat are synthesized with
// WebAudio so they need no asset at all.
import cameraUrl from "./assets/sfx/camera.wav";
import confirmUrl from "./assets/sfx/confirm.wav";
import errorUrl from "./assets/sfx/error.wav";
import chipUrl from "./assets/sfx/chip.wav";
import victoryUrl from "./assets/sfx/victory.wav";
import chippyUrl from "./assets/sfx/chippy.wav";
import shuffleUrl from "./assets/sfx/shuffle.mp3";

const SFX_ENABLED_KEY="kaizenPoker.sfxEnabled";
const SFX_URLS={
  camera:cameraUrl,
  confirm:confirmUrl,
  error:errorUrl,
  chip:chipUrl,
  victory:victoryUrl,
  chippy:chippyUrl,
  shuffle:shuffleUrl,
};
let globalSfxEnabled=true;
const sfxCache=new Map();
const sfxStopTimers=new Map();
const setGlobalSfxEnabled=value=>{globalSfxEnabled=value;};
const getSfxEnabledDefault=()=>{
  if(typeof window==="undefined")return true;
  try{
    const raw=window.localStorage.getItem(SFX_ENABLED_KEY);
    return raw==null?true:raw==="true";
  }catch{return true;}
};
function getSfxAudio(name){
  if(!SFX_URLS[name]||typeof Audio==="undefined")return null;
  if(!sfxCache.has(name)){
    const audio=new Audio(SFX_URLS[name]);
    audio.preload="auto";
    // Allow playbackRate to shift pitch (used for the "opponent scores" chip).
    try{audio.preservesPitch=false;audio.mozPreservesPitch=false;audio.webkitPreservesPitch=false;}catch{}
    sfxCache.set(name,audio);
  }
  return sfxCache.get(name);
}
// Decode all samples once the browser is idle so the first play never stutters.
if(typeof window!=="undefined"){
  const warm=()=>{try{Object.keys(SFX_URLS).forEach(name=>getSfxAudio(name));}catch{}};
  if(window.requestIdleCallback)window.requestIdleCallback(warm,{timeout:5000});
  else setTimeout(warm,2000);
}
// --- WebAudio-synthesized effects (no asset needed) ---
let sharedAudioCtx=null;
function getAudioCtx(){
  if(typeof window==="undefined")return null;
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx)return null;
  try{
    if(!sharedAudioCtx)sharedAudioCtx=new Ctx();
    if(sharedAudioCtx.state==="suspended")void sharedAudioCtx.resume();
    return sharedAudioCtx;
  }catch{return null;}
}
const SYNTH_SFX={
  // Short filtered noise burst: a card being slapped onto the felt.
  cardPlay(ctx,volume){
    const t=ctx.currentTime,dur=0.09;
    const buf=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*dur),ctx.sampleRate);
    const data=buf.getChannelData(0);
    for(let i=0;i<data.length;i++){const fade=1-i/data.length;data[i]=(Math.random()*2-1)*fade*fade;}
    const noise=ctx.createBufferSource();noise.buffer=buf;
    const filter=ctx.createBiquadFilter();
    filter.type="bandpass";filter.Q.value=0.9;
    filter.frequency.setValueAtTime(2200,t);
    filter.frequency.exponentialRampToValueAtTime(420,t+dur);
    const gain=ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.001,volume),t);
    gain.gain.exponentialRampToValueAtTime(0.001,t+dur);
    noise.connect(filter);filter.connect(gain);gain.connect(ctx.destination);
    noise.start(t);noise.stop(t+dur);
  },
  // Two descending muted notes: the match is lost.
  defeat(ctx,volume){
    const t=ctx.currentTime;
    const notes=[[311.13,0,0.5],[233.08,0.3,0.95]]; // Eb4 then Bb3
    for(const[freq,delay,dur]of notes){
      const start=t+delay;
      const gain=ctx.createGain();
      gain.gain.setValueAtTime(0.001,start);
      gain.gain.linearRampToValueAtTime(Math.max(0.001,volume),start+0.02);
      gain.gain.exponentialRampToValueAtTime(0.001,start+dur);
      const filter=ctx.createBiquadFilter();
      filter.type="lowpass";filter.frequency.value=1100;
      filter.connect(gain);gain.connect(ctx.destination);
      for(const[type,detune]of[["triangle",0],["sawtooth",-8]]){
        const osc=ctx.createOscillator();
        osc.type=type;osc.frequency.value=freq;osc.detune.value=detune;
        osc.connect(filter);osc.start(start);osc.stop(start+dur);
      }
    }
  },
};
function playSfx(name,{volume=1,reset=true,rate=1}={}){
  if(!globalSfxEnabled)return;
  if(SYNTH_SFX[name]){
    const ctx=getAudioCtx();
    if(ctx){try{SYNTH_SFX[name](ctx,Math.max(0,Math.min(1,volume)));}catch{}}
    return;
  }
  const audio=getSfxAudio(name);
  if(!audio)return;
  try{
    const priorStopTimer=sfxStopTimers.get(name);
    if(priorStopTimer){
      clearTimeout(priorStopTimer);
      sfxStopTimers.delete(name);
    }
    if(reset)audio.currentTime=0;
    audio.volume=Math.max(0,Math.min(1,volume));
    audio.playbackRate=rate;
    void audio.play().catch(()=>{});
    if(name==="shuffle"){
      const stopTimer=setTimeout(()=>{
        try{
          audio.pause();
          audio.currentTime=0;
        }catch{}
        sfxStopTimers.delete(name);
      },2500);
      sfxStopTimers.set(name,stopTimer);
    }
  }catch{}
}
export { SFX_ENABLED_KEY, setGlobalSfxEnabled, getSfxEnabledDefault, playSfx };

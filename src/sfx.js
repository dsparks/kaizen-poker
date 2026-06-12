// Sound effects: shared audio cache plus a global enable flag persisted to
// localStorage (the React state in KaizenPoker mirrors it via setGlobalSfxEnabled).
const SFX_ENABLED_KEY="kaizenPoker.sfxEnabled";
const SFX_URLS={
  camera:"https://assets.mixkit.co/active_storage/sfx/1133/1133.wav",
  confirm:"https://assets.mixkit.co/active_storage/sfx/1104/1104.wav",
  error:"https://assets.mixkit.co/active_storage/sfx/1110/1110.wav",
  chip:"https://assets.mixkit.co/active_storage/sfx/3187/3187.wav",
  victory:"https://assets.mixkit.co/active_storage/sfx/2059/2059.wav",
  chippy:"https://assets.mixkit.co/active_storage/sfx/269/269.wav",
  shuffle:"https://cdn.pixabay.com/download/audio/2022/03/24/audio_2b254f7c73.mp3?filename=freesound_community-riffle-card-shuffle-104313.mp3",
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
    sfxCache.set(name,audio);
  }
  return sfxCache.get(name);
}
function playSfx(name,{volume=1,reset=true}={}){
  if(!globalSfxEnabled)return;
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

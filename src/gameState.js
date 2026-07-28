import { CARDS } from "./gameData.js";
import { syncVisibleMemories } from "./memory.js";

const GAME_STATE_VERSION=2;
const CARD_IDS=new Set(CARDS.map(card=>card.id));
const ARRAY_FIELDS=["aDeck","bDeck","aHand","bHand","aDiscard","bDiscard","aPlay","bPlay","scrap","log","newCards","aMods","bMods","aForecast","bForecast"];
const MODES=new Set(["hotseat","online","tutorial","solo","solo_art","rules","gallery"]);
const PHASES=new Set(["action","score","reveal","gameOver","tutorialDone","browse"]);

function migrateGameState(raw){
  if(!raw||typeof raw!=="object")return null;
  let next={...raw};
  ARRAY_FIELDS.forEach(key=>{if(!Array.isArray(next[key]))next[key]=[];});
  if(!next.amends)next.amends={aFreeze:false,bFreeze:false,aNegate:false,bNegate:false};
  if(!Number.isInteger(next._stateVersion)||next._stateVersion<2){
    next=syncVisibleMemories(next);
  }
  return {...next,_stateVersion:GAME_STATE_VERSION};
}

function physicalCardIds(gs){
  const ids=[];
  ["aDeck","bDeck","aHand","bHand","aDiscard","bDiscard","scrap"].forEach(zone=>ids.push(...(gs[zone]||[])));
  ids.push(...(gs.aPlay||[]).map(entry=>entry?.id));
  ids.push(...(gs.bPlay||[]).map(entry=>entry?.id));
  if(gs.mode==="solo"||gs.mode==="solo_art")ids.push(...(gs._soloRevealedCards||[]));
  return ids.filter(Boolean);
}

function validateGameState(raw,{requireCompleteDeck=true}={}){
  const errors=[];
  if(!raw||typeof raw!=="object")return["Game state must be an object."];
  ARRAY_FIELDS.forEach(key=>{if(raw[key]!==undefined&&!Array.isArray(raw[key]))errors.push(`${key} must be an array.`);});
  const gs=migrateGameState(raw);
  if(!MODES.has(gs.mode))errors.push(`Unknown mode: ${String(gs.mode)}`);
  if(!PHASES.has(gs.phase))errors.push(`Unknown phase: ${String(gs.phase)}`);
  if(!["A","B"].includes(gs.currentPlayer))errors.push(`Invalid currentPlayer: ${String(gs.currentPlayer)}`);
  if(!["A","B"].includes(gs.firstPlayer))errors.push(`Invalid firstPlayer: ${String(gs.firstPlayer)}`);

  const locations=new Map();
  const add=(id,zone)=>{
    if(!CARD_IDS.has(id)){errors.push(`Unknown card ${String(id)} in ${zone}.`);return;}
    const previous=locations.get(id);
    if(previous)errors.push(`${id} appears in both ${previous} and ${zone}.`);
    else locations.set(id,zone);
  };
  ["aDeck","bDeck","aHand","bHand","aDiscard","bDiscard","scrap"].forEach(zone=>(gs[zone]||[]).forEach(id=>add(id,zone)));
  (gs.aPlay||[]).forEach(entry=>add(entry?.id,"aPlay"));
  (gs.bPlay||[]).forEach(entry=>add(entry?.id,"bPlay"));
  if(gs.mode==="solo"||gs.mode==="solo_art")(gs._soloRevealedCards||[]).forEach(id=>add(id,"_soloRevealedCards"));
  if(requireCompleteDeck&&["hotseat","online","solo","solo_art"].includes(gs.mode)&&locations.size!==CARD_IDS.size){
    errors.push(`Expected ${CARD_IDS.size} physical cards across zones, found ${locations.size}.`);
  }
  return errors;
}

function assertValidGameState(gs,options){
  const errors=validateGameState(gs,options);
  if(errors.length)throw new Error(`Invalid game state:\n- ${errors.join("\n- ")}`);
  return gs;
}

export { GAME_STATE_VERSION, assertValidGameState, migrateGameState, physicalCardIds, validateGameState };

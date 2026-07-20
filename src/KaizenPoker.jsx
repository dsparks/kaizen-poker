import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Chippy from "./Chippy.jsx";
import PlaytestPanel from "./PlaytestPanel.jsx";
import { CHIPPY_COPY, renderChippyMessage } from "./chippyCopy.jsx";
import { getCardIllustrationSrc } from "./cardImageMap.js";
import {
  clearActiveTrackedGame,
  archiveCompletedTrackedGame,
  appendTrackedEvent,
  buildRoundSummary,
  buildTrackedGame,
  closeTrackedGame,
  finalizeTrackedGame,
  saveActiveTrackedGame,
  upsertTrackedRound,
} from "./analytics.js";
import { createGameTransport } from "./gameTransport.js";
import { useLiveGameSession } from "./useLiveGameSession.js";
import {
  claimSeat,
  createLiveGame,
  fetchLiveGame,
  makeSeatToken,
  multiplayerEnabled,
} from "./liveGameClient.js";
import { getAnalyticsDebugInfo, syncTrackedGame } from "./supabaseAnalytics.js";
import {
  getTutorialPrompt,
  getTutorialRoundSetup,
  TUTORIAL_TOTAL_ROUNDS,
} from "./tutorialScript.js";
import { trackUmami, trackUmamiScreen } from "./umami.js";
import { RO, FACE, CARDS, CM, SUITS, SC, SO, SOLO_DIFFICULTIES, CHALLENGER_LOOKUP, CHALLENGER_ROWS, isSoloMode, lowerRanks, higherRanks, adjacentRanks } from "./gameData.js";
import { evalHand, compareHands, shuf, sortC, drawCards, displayOrder, evalChallenger, isMatchOver, getMatchWinner, getRoundRequirements, initGame, cloneGs, tutorialRoundState } from "./engine.js";
import { SFX_ENABLED_KEY, setGlobalSfxEnabled, getSfxEnabledDefault, playSfx } from "./sfx.js";
import { FONT_DISPLAY, FONT_BODY, USE_ILLUSTRATED_CARDS, FeltBackdrop, CardRenderContext, Card, PreviewCard, FaceDownActionSlot, CardBack, FLIGHT_MS, prefersReducedMotion, flightZoneMap, FlightGhost, RememberChip, getCascadeCardPool, VictorySolitaireCanvas, KonamiCelebrationOverlay, HandBadge, Btn, SfxToggle, Chip, Modal, MultiPickModal, BrainstormModal, RejuvenateModal, DeckStats, PublicZones } from "./components.jsx";

// ============================================================
// APP SHELL HELPERS (routing, local snapshots, misc)
// ============================================================
const LOCAL_GAME_SNAPSHOT_KEY="kaizen-poker:last-local-game:v1";
const PLAYTEST_QUERY_FLAG="playtest";
const ROUTE_BY_MODE={
  home:"",
  demo:"demo",
  remote:"remote",
  hotseat:"hotseat",
  tutorial:"tutorial",
  solo:"solo",
  solo_art:"solo-artless",
  gallery:"gallery",
  rules:"rules",
};
const MODE_BY_ROUTE=Object.fromEntries(
  Object.entries(ROUTE_BY_MODE)
    .filter(([,route])=>route)
    .map(([mode,route])=>[route,mode])
);
const normalizeHashRoute=hash=>{
  const raw=(hash||"").replace(/^#/,"").replace(/^\/+/,"").trim().toLowerCase();
  return raw.replace(/\/+$/,"");
};
const getRequestedModeFromHash=()=>{
  if(typeof window==="undefined")return null;
  const route=normalizeHashRoute(window.location.hash);
  return MODE_BY_ROUTE[route]||null;
};
const isHomeRouteVariant=mode=>mode==="demo"||mode==="remote";
const updateHashForMode=(mode,{replace=false,preserveGameSearch=false}={})=>{
  if(typeof window==="undefined")return;
  try{
    const route=ROUTE_BY_MODE[mode]??"";
    const nextHash=route?`#/${route}`:"";
    const params=new URLSearchParams(window.location.search);
    if(!preserveGameSearch)params.delete("game");
    const nextSearch=params.toString();
    const nextUrl=`${window.location.pathname}${nextSearch?`?${nextSearch}`:""}${nextHash}`;
    window.history[replace?"replaceState":"pushState"]({},"",nextUrl);
  }catch{}
};
const LOCAL_RESUMABLE_MODES=new Set(["hotseat","solo","solo_art","tutorial"]);
const canResumeLocally=gs=>!!(gs&&LOCAL_RESUMABLE_MODES.has(gs.mode));
const loadLocalGameSnapshot=()=>{
  if(typeof window==="undefined")return null;
  try{
    const raw=window.localStorage.getItem(LOCAL_GAME_SNAPSHOT_KEY);
    if(!raw)return null;
    const parsed=JSON.parse(raw);
    return canResumeLocally(parsed)?parsed:null;
  }catch{return null;}
};
const saveLocalGameSnapshot=gs=>{
  if(typeof window==="undefined")return;
  try{
    if(canResumeLocally(gs))window.localStorage.setItem(LOCAL_GAME_SNAPSHOT_KEY,JSON.stringify(gs));
  }catch{}
};
const computeIsMobileLandscape=()=>{
  if(typeof window==="undefined")return false;
  const w=window.innerWidth,h=window.innerHeight;
  return w<=600||(w>h&&w<=960&&h<=560);
};
const hasPlaytestFlag=()=>{
  if(typeof window==="undefined")return false;
  try{return new URLSearchParams(window.location.search).get(PLAYTEST_QUERY_FLAG)==="1";}catch{return false;}
};
const KONAMI_SEQUENCE=["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a","Enter"];
const LIVE_SEAT_PREFIX="kaizenPoker.liveSeat.";
const PassiveScreens=lazy(()=>import("./PassiveScreens.jsx"));

// ============================================================
// MAIN APP
// ============================================================
export default function KaizenPoker(){
  const[gs,setGs]=useState(null);const[modal,setModal]=useState(null);const[fdMode,setFdMode]=useState(false);
  const[undoState,setUndoState]=useState(null); // snapshot before last action, for undo
  const[toast,setToast]=useState(null);
  const[sfxEnabled,setSfxEnabled]=useState(()=>getSfxEnabledDefault());
  const[joinCode,setJoinCode]=useState("");
  const[shareLink,setShareLink]=useState("");
  const[soloIntroVisible,setSoloIntroVisible]=useState(false);
  const[galleryHoverId,setGalleryHoverId]=useState(null);
  const[resumeAvailable,setResumeAvailable]=useState(()=>!!loadLocalGameSnapshot());
  const[playtestEnabled,setPlaytestEnabled]=useState(()=>hasPlaytestFlag());
  const[homeRoute,setHomeRoute]=useState(()=>getRequestedModeFromHash());
  const[demoChippyDismissed,setDemoChippyDismissed]=useState(false);
  const[galleryChippyDismissed,setGalleryChippyDismissed]=useState(false);
  const[konamiCelebrationOpen,setKonamiCelebrationOpen]=useState(false);
  const[konamiCelebrationKey,setKonamiCelebrationKey]=useState(0);
  // Only the mobile-landscape boolean is stored, so resize events don't
  // re-render the app unless the layout mode actually flips.
  const[isMobileLandscape,setIsMobileLandscape]=useState(computeIsMobileLandscape);
  const[mobileLogOpen,setMobileLogOpen]=useState(false);
  const[analyticsSyncState,setAnalyticsSyncState]=useState(()=>({
    ...getAnalyticsDebugInfo(),
    lastAttemptAt:null,
    lastSuccessAt:null,
    lastError:"",
    lastStatus:"idle",
    lastGameId:null,
  }));
  const gameTransport=createGameTransport({setGs});
  const liveSession=useLiveGameSession({gameTransport,onTrackedState:tracked=>setTracked(tracked)});
  const {sessionRef:onlineRef,onlineError,setOnlineError,onlineStatus,setOnlineStatus,liveSeat,liveGameId}=liveSession;
  const analyticsAuthorityRef=useRef(true);
  const prevPhaseRef=useRef(null);
  const prevChipsRef=useRef({a:0,b:0});
  const prevGameOverRef=useRef(false);
  const prevChippyVisibleRef=useRef(false);
  const prevGalleryHoverRef=useRef(null);
  const prevReshuffleRef=useRef(null);
  const initialRouteHandledRef=useRef(false);
  const lastUmamiScreenRef=useRef("");
  const konamiProgressRef=useRef(0);
  // Warm the (web-optimized) card illustrations once the browser is idle so
  // cards never pop in blank mid-game.
  useEffect(()=>{
    if(!USE_ILLUSTRATED_CARDS||typeof window==="undefined")return undefined;
    const warm=()=>{CARDS.forEach(c=>{const src=getCardIllustrationSrc(c.name);if(src){const img=new Image();img.src=src;}});};
    if(window.requestIdleCallback){
      const handle=window.requestIdleCallback(warm,{timeout:4000});
      return()=>window.cancelIdleCallback?.(handle);
    }
    const timer=setTimeout(warm,1500);
    return()=>clearTimeout(timer);
  },[]);
  // Card flights: ghosts that fly when a card changes zones between commits.
  const[flights,setFlights]=useState([]);
  const flightKeyRef=useRef(0);
  const flightRectsRef=useRef(new Map());
  const flightPrevGsRef=useRef(null);
  const removeFlight=useCallback(key=>setFlights(f=>f.filter(x=>x.key!==key)),[]);
  useLayoutEffect(()=>{
    const prev=flightPrevGsRef.current;
    flightPrevGsRef.current=gs;
    if(!prev||!gs||prev===gs)return;
    if(prefersReducedMotion())return;
    // Skip bulk transitions: new games, round boundaries, end-of-round sweeps.
    if(prev._gameId!==gs._gameId||prev.mode!==gs.mode||prev.round!==gs.round||gs.phase==="gameOver")return;
    const before=flightZoneMap(prev),after=flightZoneMap(gs);
    const moved=[];
    after.forEach((zone,id)=>{const prevZone=before.get(id);if(prevZone&&prevZone!==zone)moved.push({id,fromZone:prevZone,toZone:zone});});
    if(!moved.length)return;
    const snapshot=flightRectsRef.current;
    const norm=r=>({left:r.left,top:r.top,width:r.width,height:r.height});
    const tabRect=zone=>{
      const sel=zone==="scrap"?'[data-zone="scrap"]'
        :zone==="aDiscard"?'[data-zone="aDiscard"]'
        :zone==="bDiscard"?'[data-zone="bDiscard"]'
        :(zone==="aDeck"||zone==="bDeck")?'[data-zone="deck"]'
        :null;
      if(!sel)return null;
      const el=document.querySelector(sel);
      if(!el)return null;
      const r=el.getBoundingClientRect();
      // Shrink toward the tab's center so cards read as "tucked into" the pile.
      return {left:r.left+r.width/2-17,top:r.top+r.height/2-24,width:34,height:48};
    };
    const findCardEl=id=>{
      const nodes=document.querySelectorAll(`[data-card-id="${id}"]`);
      for(const el of nodes){if(!el.closest("[data-flight-ghost]"))return el;}
      return null;
    };
    const spawns=[];
    for(const mv of moved){
      if(spawns.length>=6)break;
      const snap=snapshot.get(mv.id);
      const destEl=findCardEl(mv.id);
      const to=destEl?norm(destEl.getBoundingClientRect()):tabRect(mv.toZone);
      const from=snap?snap.rect:tabRect(mv.fromZone);
      if(!from||!to)continue;
      if(Math.abs(from.left-to.left)<4&&Math.abs(from.top-to.top)<4)continue;
      const back=!!(snap&&snap.faceDown)||destEl?.getAttribute("data-facedown")==="1";
      spawns.push({key:`fl${flightKeyRef.current++}`,id:mv.id,from,to,back,fadeOut:!destEl});
      if(destEl){
        destEl.style.visibility="hidden";
        setTimeout(()=>{try{destEl.style.visibility="";}catch{}},FLIGHT_MS+40);
      }
    }
    if(spawns.length)setFlights(f=>[...f,...spawns]);
  },[gs]);
  useLayoutEffect(()=>{
    // Snapshot card positions after every commit (runs after the flight effect
    // above has consumed the previous snapshot).
    if(typeof document==="undefined")return;
    const map=new Map();
    document.querySelectorAll("[data-card-id]").forEach(el=>{
      if(el.closest("[data-flight-ghost]"))return;
      const id=el.getAttribute("data-card-id");
      if(!id||map.has(id))return;
      const r=el.getBoundingClientRect();
      if(!r.width||!r.height)return;
      map.set(id,{rect:{left:r.left,top:r.top,width:r.width,height:r.height},faceDown:el.getAttribute("data-facedown")==="1"});
    });
    flightRectsRef.current=map;
    // Deps: only re-measure when the game state (or layout mode) changes —
    // running this on every render forces a synchronous reflow of every card.
  },[gs,isMobileLandscape]);
  const commitGameState=nextGs=>{
    gameTransport.commit(nextGs);
    if(canResumeLocally(nextGs)){
      saveLocalGameSnapshot(nextGs);
      setResumeAvailable(true);
    }
    liveSession.queueUpdate(nextGs,{tracked:trackedRef.current,authority:analyticsAuthorityRef.current});
    return nextGs;
  };
  const patchGameState=updater=>gameTransport.patch(updater);
  const clearGameState=()=>{
    trackUmami("return_to_menu",{from_mode:gs?.mode||"home",home_route:isHomeRouteVariant(homeRoute)?homeRoute:"home"});
    flushTrackedSession(gs,"left_mode");
    updateHashForMode(isHomeRouteVariant(homeRoute)?homeRoute:"home",{replace:true});
    liveSession.reset();
    analyticsAuthorityRef.current=true;
    setJoinCode("");
    setShareLink("");
    setSoloIntroVisible(false);
    setGalleryHoverId(null);
    setGalleryChippyDismissed(false);
    trackedRef.current=null;
    clearActiveTrackedGame();
    gameTransport.clear();
  };
  const enablePlaytestMode=()=>{
    trackUmami("playtest_enabled",{source:"join_remote_game_magic_word"});
    if(typeof window!=="undefined"){
      try{
        const params=new URLSearchParams(window.location.search);
        params.set(PLAYTEST_QUERY_FLAG,"1");
        const nextQuery=params.toString();
        const nextUrl=`${window.location.pathname}${nextQuery?`?${nextQuery}`:""}`;
        window.history.replaceState({}, "", nextUrl);
      }catch{}
    }
    setPlaytestEnabled(true);
    setJoinCode("");
    setOnlineError("");
  };
  const logRef=useRef(null);
  const toastTimerRef=useRef(null);
  const trackedRef=useRef(null);
  const syncTimerRef=useRef(null);

  const scheduleTrackedSync=()=>{
    if(!trackedRef.current)return;
    if(!analyticsAuthorityRef.current)return;
    saveActiveTrackedGame(trackedRef.current);
    if(syncTimerRef.current)clearTimeout(syncTimerRef.current);
    syncTimerRef.current=setTimeout(()=>{
      const snap=trackedRef.current;
      if(!snap)return;
      const attemptedAt=new Date().toISOString();
      setAnalyticsSyncState(prev=>({
        ...prev,
        ...getAnalyticsDebugInfo(),
        lastAttemptAt:attemptedAt,
        lastStatus:"syncing",
        lastGameId:snap.gameId||prev.lastGameId,
      }));
      void syncTrackedGame(snap)
        .then(()=>{
          setAnalyticsSyncState(prev=>({
            ...prev,
            ...getAnalyticsDebugInfo(),
            lastAttemptAt:attemptedAt,
            lastSuccessAt:new Date().toISOString(),
            lastError:"",
            lastStatus:"success",
            lastGameId:snap.gameId||prev.lastGameId,
          }));
        })
        .catch(err=>{
          console.error("Analytics sync failed",err);
          setAnalyticsSyncState(prev=>({
            ...prev,
            ...getAnalyticsDebugInfo(),
            lastAttemptAt:attemptedAt,
            lastError:err?.message||String(err),
            lastStatus:"error",
            lastGameId:snap.gameId||prev.lastGameId,
          }));
        });
    },500);
  };
  const setTracked=updater=>{
    trackedRef.current=typeof updater==="function"?updater(trackedRef.current):updater;
    if(!trackedRef.current){
      clearActiveTrackedGame();
      return trackedRef.current;
    }
    scheduleTrackedSync();
    return trackedRef.current;
  };
  const flushTrackedSession=(gLike,reason="abandoned")=>{
    if(!analyticsAuthorityRef.current||!trackedRef.current||trackedRef.current.outcome||trackedRef.current.closedAt)return;
    const closed=closeTrackedGame(trackedRef.current,gLike||gs,reason);
    if(!closed)return;
    trackedRef.current=closed;
    saveActiveTrackedGame(closed);
    const attemptedAt=new Date().toISOString();
    setAnalyticsSyncState(prev=>({
      ...prev,
      ...getAnalyticsDebugInfo(),
      lastAttemptAt:attemptedAt,
      lastStatus:"syncing",
      lastGameId:closed.gameId||prev.lastGameId,
    }));
    void syncTrackedGame(closed)
      .then(()=>{
        setAnalyticsSyncState(prev=>({
          ...prev,
          ...getAnalyticsDebugInfo(),
          lastAttemptAt:attemptedAt,
          lastSuccessAt:new Date().toISOString(),
          lastError:"",
          lastStatus:"success",
          lastGameId:closed.gameId||prev.lastGameId,
        }));
      })
      .catch(err=>{
        console.error("Analytics close sync failed",err);
        setAnalyticsSyncState(prev=>({
          ...prev,
          ...getAnalyticsDebugInfo(),
          lastAttemptAt:attemptedAt,
          lastError:err?.message||String(err),
          lastStatus:"error",
          lastGameId:closed.gameId||prev.lastGameId,
        }));
      });
  };
  const trackEvent=(gLike,eventType,eventPayload={},opts={})=>{
    if(!trackedRef.current)return;
    setTracked(curr=>appendTrackedEvent(curr,gLike,eventType,eventPayload,opts));
  };
  const trackDraws=(gLike,playerSlot,cards,source)=>{
    (cards||[]).forEach(cardId=>trackEvent(gLike,"card_drawn",{cardId,source},{playerSlot}));
  };
  const trackRoundStart=gLike=>trackEvent(gLike,"round_started",{
    roundNumber:gLike.round,
    firstPlayer:gLike.firstPlayer,
    aHand:[...(gLike.aHand||[])],
    bHand:[...(gLike.bHand||[])],
    aActionsRequired:gLike._aReq||2,
    bActionsRequired:gLike._bReq||2,
    aCardsDrawn:(gLike.aHand||[]).length,
    bCardsDrawn:(gLike.bHand||[]).length,
  },{phase:"action",playerSlot:gLike.firstPlayer});
  const trackRoundSummary=gLike=>setTracked(curr=>upsertTrackedRound(curr,buildRoundSummary(gLike)));
  const trackGameFinished=(gLike,winner)=>{
    setTracked(curr=>curr?.outcome?curr:finalizeTrackedGame(curr,gLike,winner));
    if(analyticsAuthorityRef.current&&trackedRef.current){archiveCompletedTrackedGame(trackedRef.current);void syncTrackedGame(trackedRef.current).catch(err=>console.error("Analytics final sync failed",err));}
  };

  const flashToast=(msg,tone="info")=>{
    if(toastTimerRef.current)clearTimeout(toastTimerRef.current);
    if(tone==="frozen"||tone==="fizzle"||tone==="cancel")playSfx("error",{volume:.26});
    setToast({msg,tone,key:Date.now()+Math.random()});
    toastTimerRef.current=setTimeout(()=>setToast(null),1800);
  };
  const maybeToastLog=msg=>{
    const clean=msg.replace(/^\.\.\./,"").replace(/\.$/,"").trim();
    if(!clean)return;
    if(/Frozen/i.test(clean)){flashToast(clean,"frozen");return;}
    if(/Fizzles?/i.test(clean)){flashToast(clean,"fizzle");return;}
    if(/cancelled/i.test(clean)){flashToast(clean,"cancel");}
  };
  const L=(gs,msg)=>{
    maybeToastLog(msg);
    if(trackedRef.current){
      const phase=gs?.phase==="gameOver"?"game_over":gs?.phase||"action";
      setTracked(curr=>appendTrackedEvent(curr,gs,"log_message",{message:msg},{phase,playerSlot:null}));
      if(/Frozen/i.test(msg)) setTracked(curr=>appendTrackedEvent(curr,gs,"action_frozen",{message:msg},{phase,playerSlot:null}));
      if(/Fizzles?/i.test(msg)) setTracked(curr=>appendTrackedEvent(curr,gs,"action_fizzled",{message:msg},{phase,playerSlot:null}));
      if(/cancelled/i.test(msg)) setTracked(curr=>appendTrackedEvent(curr,gs,"action_cancelled",{message:msg},{phase,playerSlot:null}));
    }
    return {...gs,log:[...gs.log,msg]};
  };
  const getH=(gs,p)=>p==="A"?gs.aHand:gs.bHand;const getD=(gs,p)=>p==="A"?gs.aDiscard:gs.bDiscard;
  const getDk=(gs,p)=>p==="A"?gs.aDeck:gs.bDeck;const getP=(gs,p)=>p==="A"?gs.aPlay:gs.bPlay;
  const opp=p=>p==="A"?"B":"A";
  const setZ=(gs,p,z,v)=>({...gs,[(p==="A"?"a":"b")+z[0].toUpperCase()+z.slice(1)]:v});
  const isFroz=(gs,p)=>p==="A"?gs.amends.aFreeze:gs.amends.bFreeze;
  const getActionCard=a=>a?.copiedFrom?(CM[a.copiedFrom]||CM[a.id]):CM[a?.id];
  const getModifyEntries=(g,pl)=>getP(g,pl).flatMap(a=>{
    if(a.faceDown)return [];
    const effect=getActionCard(a);
    if(effect?.type!=="Modify")return [];
    return [{sourceId:a.id,effectId:effect.id,copiedFrom:a.copiedFrom||null}];
  });
  const getAppliedMods=(g,pl)=>{
    const mk=pl==="A"?"aMods":"bMods";
    const queued=g[mk]||[];
    const free=queued.filter(m=>!m.sourceId);
    return [...free,...getP(g,pl).flatMap(a=>a.faceDown?[]:queued.filter(m=>m.sourceId===a.id))];
  };
  const getCurrentSeat=()=>liveSeat||onlineRef.current.seat||null;
  const finishActionResolution=g2=>{setUndoState(null);g2=advance(g2);commitGameState(g2);return g2;};
  const queueRemotePrompt=(g,prompt)=>{let g2=cloneGs(g);g2._remotePrompt=prompt;commitGameState(g2);return g2;};
  const resolveRemotePromptPick=(baseGs,prompt,id)=>{
    let g=cloneGs(baseGs);g._remotePrompt=null;
    if(prompt.kind==="abdicate"){
      g=setZ(g,prompt.player,"hand",[...getH(g,prompt.player)].filter(x=>x!==id));
      g=setZ(g,prompt.player,"discard",[...getD(g,prompt.player),id]);
      g=L(g,`${prompt.player} discards ${CM[id].name} (Abdicate)`);
      g=drawCards(g,prompt.player,1);if(g.drawn){trackDraws(g,prompt.player,g.drawn,"abdicate");g=L(g,`${prompt.player} draws`);}
      finishActionResolution(g);return;
    }
    if(prompt.kind==="rummage_opp"){
      discardFromHand(g,prompt.player,id,g2=>{
        g2._remotePrompt=null;
        g2=drawCards(g2,prompt.player,1);if(g2.drawn){trackDraws(g2,prompt.player,g2.drawn,"rummage");g2=L(g2,`${prompt.player} draws`);}
        finishActionResolution(g2);
      });
    }
  };

  const buildFreshGame=(mode="hotseat",options={})=>{
    let g=mode==="tutorial"?tutorialRoundState(1):initGame(mode,options);
    g=L(g,`=== ROUND 1 === ${isSoloMode(mode)?"Solo Mode":mode==="tutorial"?"Tutorial begins":"Player A"} acts first`);
    g=L(g,`A: ${g.aHand.map(id=>`${CM[id].rank}${SUITS[CM[id].suit]} ${CM[id].name}`).join(", ")}`);
    if(isSoloMode(mode))g=L(g,`Challenger Deck: ${g.bDeck.length} cards ready`);
    else if(mode==="tutorial")g=L(g,`Tutorial Opponent: ${g.bHand.map(id=>`${CM[id].rank}${SUITS[CM[id].suit]} ${CM[id].name}`).join(", ")}`);
    else g=L(g,`B: ${g.bHand.map(id=>`${CM[id].rank}${SUITS[CM[id].suit]} ${CM[id].name}`).join(", ")}`);return g;};
  const buildPassiveModeState=mode=>({mode,phase:"browse",round:1,firstPlayer:"A",currentPlayer:"A",aDeck:[],bDeck:[],aHand:[],bHand:[],aDiscard:[],bDiscard:[],aPlay:[],bPlay:[],log:[],_createdAt:new Date().toISOString()});
  const startGame=(mode="hotseat",{replaceUrl=false,soloDifficulty=null}={})=>{trackUmami("mode_started",{mode,entry:"local"});flushTrackedSession(gs,"mode_switch");const g=buildFreshGame(mode,soloDifficulty?{soloDifficulty}:{});setSoloIntroVisible(isSoloMode(mode));setTracked(buildTrackedGame(g));commitGameState(g);updateHashForMode(mode,{replace:replaceUrl});};
  const resumeLocalGame=()=>{const saved=loadLocalGameSnapshot();if(!saved)return;trackUmami("mode_resumed",{mode:saved.mode||"hotseat"});flushTrackedSession(gs,"mode_switch");setSoloIntroVisible(false);setTracked(buildTrackedGame(saved));commitGameState(saved);updateHashForMode(saved.mode||"hotseat");};
  const startGallery=({replaceUrl=false}={})=>{trackUmami("mode_started",{mode:"gallery",entry:"menu"});flushTrackedSession(gs,"mode_switch");const galleryState=buildPassiveModeState("gallery");setTracked(buildTrackedGame(galleryState));setSoloIntroVisible(false);setGalleryHoverId(null);setGalleryChippyDismissed(false);commitGameState(galleryState);updateHashForMode("gallery",{replace:replaceUrl});};
  const startRules=({replaceUrl=false}={})=>{trackUmami("mode_started",{mode:"rules",entry:"menu"});flushTrackedSession(gs,"mode_switch");const rulesState=buildPassiveModeState("rules");setTracked(buildTrackedGame(rulesState));setSoloIntroVisible(false);setGalleryHoverId(null);commitGameState(rulesState);updateHashForMode("rules",{replace:replaceUrl});};
  const setHomeRouteVariant=useCallback((variant="home",{replaceUrl=false}={})=>{
    trackUmami("home_variant_opened",{variant:variant||"home"});
    setHomeRoute(variant);
    updateHashForMode(variant,{replace:replaceUrl});
  },[]);
  const launchModeFromHash=useCallback((requestedMode,{replaceUrl=false}={})=>{
    if(isHomeRouteVariant(requestedMode)){setHomeRoute(requestedMode);return false;}
    if(!requestedMode||requestedMode==="home")return false;
    if(requestedMode==="gallery"){startGallery({replaceUrl});return true;}
    if(requestedMode==="rules"){startRules({replaceUrl});return true;}
    if(["hotseat","tutorial","solo","solo_art"].includes(requestedMode)){startGame(requestedMode,{replaceUrl});return true;}
    return false;
  },[gs]);
  const acknowledgeTutorial=mark=>{
    if(!gs||gs.mode!=="tutorial")return;
    const g2={...gs,_tutorialAck:mark};
    commitGameState(g2);
  };
  const replaceSandboxState=nextGs=>{flushTrackedSession(gs,"sandbox_replace");setModal(null);setFdMode(false);setUndoState(null);setTracked(buildTrackedGame(nextGs));commitGameState(nextGs);};

  const liveSeatKey=gameId=>`${LIVE_SEAT_PREFIX}${gameId}`;
  const storeSeat=(gameId,seat,token)=>{try{localStorage.setItem(liveSeatKey(gameId),JSON.stringify({seat,token}));}catch{}};
  const loadSeat=(gameId)=>{try{const raw=localStorage.getItem(liveSeatKey(gameId));return raw?JSON.parse(raw):null;}catch{return null;}};

  const hydrateFromLiveRow=(row,{seat=null,token=null,authority=false}={})=>{
    if(!row?.state)return;
    if(typeof window!=="undefined"){
      const nextUrl=`${window.location.pathname}?game=${row.id}`;
      window.history.replaceState({}, "", nextUrl);
    }
    liveSession.activate(row,{seat,token});
    analyticsAuthorityRef.current=authority;
    setJoinCode(row.id);
    setShareLink(typeof window!=="undefined"?`${window.location.origin}${window.location.pathname}?game=${row.id}`:"");
    if(row.tracked) setTracked(row.tracked);
    else if(authority) setTracked(buildTrackedGame(row.state));
    else trackedRef.current=null;
    gameTransport.commit(row.state);
  };

  const startLivePolling=(gameId,authority=false)=>liveSession.startPolling(gameId,{authority});

  const tutorialPrompt=gs?.mode==="tutorial"?getTutorialPrompt(gs,modal,fdMode):null;
  const tutorialAckReady=gs?.mode==="tutorial" && gs.phase==="action" && gs.currentPlayer==="B" && gs._tutorialAck==="opp-turn";
  const tutorialAllows=(kind,value=null)=>{
    if(gs?.mode!=="tutorial")return true;
    const expect=tutorialPrompt?.expect;
    if(!expect)return true;
    if(expect.kind==="none"||expect.kind==="ack")return false;
    if(expect.kind==="menu")return kind==="menu";
    if(expect.kind!==kind)return false;
    return expect.value==null||expect.value===value;
  };
  const tutorialZoneTarget=tutorialPrompt?.expect?.kind==="inspectZone"?tutorialPrompt.expect.value:null;
  const tutorialCanToggleZone=key=>!tutorialZoneTarget||tutorialZoneTarget===key;
  const handleTutorialZoneToggle=key=>{
    if(gs?.mode!=="tutorial"||tutorialZoneTarget!==key)return;
    acknowledgeTutorial(`zone:${key}`);
  };
  const tutorialTagStyles={
    aDiscard:{label:"A Discard",color:"#ff5a4e",background:"transparent",glow:"#ff5a4e55"},
    bDiscard:{label:"B Discard",color:"#34a3ff",background:"transparent",glow:"#34a3ff55"},
    scrap:{label:"Scrap",color:"#a86ef0",background:"transparent",glow:"#a86ef055"},
  };
  const tutorialTag=tutorialPrompt?.tagKey?tutorialTagStyles[tutorialPrompt.tagKey]||null:null;

  useEffect(()=>{
    setGlobalSfxEnabled(sfxEnabled);
    if(typeof window!=="undefined"){
      try{window.localStorage.setItem(SFX_ENABLED_KEY,String(sfxEnabled));}catch{}
    }
  },[sfxEnabled]);

  // Test bridge for headless card-effect tests (scripts/card-tests.mjs): lets a
  // test inject a full game state and read it back. Only present under the
  // ?playtest=1 flag, so it never exists in the deployed build.
  useEffect(()=>{
    if(typeof window==="undefined")return;
    if(!playtestEnabled){try{delete window.__kp;}catch{}return;}
    window.__kp={getState:()=>gs,setState:next=>replaceSandboxState(next)};
  });

  useEffect(()=>{
    if(!gs||gs.phase!=="score"||modal)return;
    const flow=gs._scoreFlow;
    const currentSeat=liveSeat||onlineRef.current.seat||null;
    if(!flow)return;
    if(onlineRef.current.active&&currentSeat&&currentSeat!==flow.player)return;
    if(flow.stage==="mods"){
      resolveMods(gs,flow.player,getModifyEntries(gs,flow.player),flow.index||0);
      return;
    }
    if(flow.stage==="q2s"){
      resolveQ2s(gs,flow.player,g2=>{
        if(isSoloMode(g2.mode)){finalScore(g2);return;}
        const nextPlayer=opp(flow.player);
        if(flow.player!==g2.firstPlayer){finalScore(g2);return;}
        resolveMods(g2,nextPlayer,getModifyEntries(g2,nextPlayer),0);
      },flow.index||0);
    }
  },[gs,modal,liveSeat]);

  useEffect(()=>{
    if(!gs||!gs._remotePrompt||modal)return;
    const prompt=gs._remotePrompt;
    const currentSeat=getCurrentSeat();
    if(!onlineRef.current.active||!currentSeat||currentSeat!==prompt.player)return;
    if(prompt.type==="pickDiscardFromHand"){
      setModal({
        type:"pickDiscard",
        hand:getH(gs,prompt.player),
        title:prompt.title,
        filter:prompt.faceOnly?(id=>FACE.includes(CM[id].rank)):undefined,
        onPick:id=>{setModal(null);resolveRemotePromptPick(gs,prompt,id);}
      });
    }
  },[gs,modal,liveSeat]);

  useEffect(()=>{
    if(logRef.current) logRef.current.scrollTop=logRef.current.scrollHeight;
  },[gs?.log?.length]);

  useEffect(()=>{
    if(!gs)return;
    if(prevPhaseRef.current && prevPhaseRef.current!==gs.phase){
      if(gs.phase==="reveal")playSfx("camera",{volume:.26});
      if(gs.phase==="gameOver")playSfx("camera",{volume:.3});
    }
    prevPhaseRef.current=gs.phase;
  },[gs?.phase]);

  // The seat "you" occupy for feel purposes: A in solo/tutorial, your seat
  // online, nobody in hotseat (both players are local).
  const getLocalSeat=g=>!g||g.mode==="hotseat"?null:g.mode==="online"?(liveSeat||onlineRef.current.seat||null):"A";

  useEffect(()=>{
    if(!gs)return;
    const prev=prevChipsRef.current;
    if(gs.aChips>prev.a||gs.bChips>prev.b){
      const gainer=gs.aChips>prev.a?"A":"B";
      const local=getLocalSeat(gs);
      // Opponent scoring gets a duller, pitched-down chip instead of the cheerful one.
      if(local&&gainer!==local)playSfx("chip",{volume:.22,rate:.7});
      else playSfx("chip",{volume:.34});
    }
    prevChipsRef.current={a:gs.aChips||0,b:gs.bChips||0};
  },[gs?.aChips,gs?.bChips]);

  useEffect(()=>{
    if(!gs?._lastReshuffleAt)return;
    if(gs._lastReshuffleAt!==prevReshuffleRef.current)playSfx("shuffle",{volume:.2});
    prevReshuffleRef.current=gs._lastReshuffleAt;
  },[gs?._lastReshuffleAt]);

  useEffect(()=>{
    const isGameOver=!!(gs&&gs.phase==="gameOver");
    if(isGameOver&&!prevGameOverRef.current){
      const local=getLocalSeat(gs);
      const lost=!!local&&getMatchWinner(gs)!==local;
      playSfx(lost?"defeat":"victory",{volume:.38});
    }
    prevGameOverRef.current=isGameOver;
  },[gs?.phase]);

  useEffect(()=>{
    const visible=!!((soloIntroVisible&&gs&&isSoloMode(gs.mode))||(gs?.mode==="tutorial"&&tutorialPrompt));
    if(visible&&!prevChippyVisibleRef.current)playSfx("chippy",{volume:.24});
    prevChippyVisibleRef.current=visible;
  },[soloIntroVisible,gs?.mode,tutorialPrompt]);

  useEffect(()=>{
    if(gs?.mode!=="gallery"){prevGalleryHoverRef.current=null;return;}
    if(galleryHoverId&&galleryHoverId!==prevGalleryHoverRef.current)playSfx("camera",{volume:.18});
    prevGalleryHoverRef.current=galleryHoverId;
  },[gs?.mode,galleryHoverId]);

  useEffect(()=>{
    if(!gs||gs.mode!=="tutorial"||gs.phase!=="action"||gs.currentPlayer!=="B"||modal||fdMode)return;
    if(!tutorialAckReady)return;
    const setup=getTutorialRoundSetup(gs._tutorialRound||1);
    const actions=setup?.computerActions||[];
    const played=(gs.bPlay||[]).length;
    if(played>=actions.length)return;
    const step=actions[played];
    const nextId=typeof step==="string"?step:step.cardId;
    const timer=setTimeout(()=>{
      if(step&&typeof step==="object"&&step.faceDown){
        let g2=playFD({...gs,_tutorialComputerStep:played},nextId);
        trackEvent(g2,"action_played",{cardId:nextId,effectId:nextId,faceDown:true,actionType:"FaceDown"},{playerSlot:"B"});
        const discardId=step.choice?.discard;
        const handAfter=getH(g2,"B");
        const pickId=(discardId&&handAfter.includes(discardId))?discardId:handAfter[0];
        if(pickId){
          discardFromHand(g2,"B",pickId,g3=>{
            g3=drawCards(g3,"B",1);
            if(g3.drawn){trackDraws(g3,"B",g3.drawn,"refresh");g3=L(g3,`B draws ${CM[g3.drawn[0]].name}`);g3.newCards=g3.drawn;}
            g3=advance(g3);
            commitGameState(g3);
          });
        }else{
          g2=advance(g2);
          commitGameState(g2);
        }
        return;
      }
      resolveAction(nextId,nextId,false,{...gs,_tutorialComputerStep:played});
    },650);
    return()=>clearTimeout(timer);
  },[gs,modal,fdMode]);

  useEffect(()=>{
    const isEditableTarget=target=>{
      if(!target)return false;
      const tagName=target.tagName?.toLowerCase?.();
      return tagName==="input"||tagName==="textarea"||tagName==="select"||target.isContentEditable;
    };
    const onKeyDown=e=>{
      if(isEditableTarget(e.target))return;
      const normalized=e.key.length===1?e.key.toLowerCase():e.key;
      const expected=KONAMI_SEQUENCE[konamiProgressRef.current];
      if(normalized===expected){
        konamiProgressRef.current+=1;
        if(konamiProgressRef.current===KONAMI_SEQUENCE.length){
          konamiProgressRef.current=0;
          setKonamiCelebrationKey(v=>v+1);
          setKonamiCelebrationOpen(true);
          playSfx("victory",{volume:.34});
          trackUmami("konami_celebration_opened",{mode:gs?.mode||"home"});
        }
        return;
      }
      konamiProgressRef.current=normalized===KONAMI_SEQUENCE[0]?1:0;
    };
    window.addEventListener("keydown",onKeyDown);
    return()=>window.removeEventListener("keydown",onKeyDown);
  },[gs?.mode]);

  const startOnlineGame=async()=>{
    if(!multiplayerEnabled()){setOnlineError("Supabase multiplayer is not configured.");return;}
    try{
      trackUmami("remote_game_create_attempt",{source:"menu"});
      flushTrackedSession(gs,"mode_switch");
      const token=makeSeatToken();
      const g=buildFreshGame("online");
      const tracked=buildTrackedGame(g);
      analyticsAuthorityRef.current=true;
      trackedRef.current=tracked;
      const row=await createLiveGame({gameId:g._gameId,state:g,tracked,playerAToken:token});
      trackUmami("remote_game_created",{source:"menu",seat:"A"});
      storeSeat(row.id,"A",token);
      hydrateFromLiveRow(row,{seat:"A",token,authority:true});
      startLivePolling(row.id,true);
    }catch(err){
      trackUmami("remote_game_create_failed",{source:"menu"});
      console.error(err);
      setOnlineError(err.message||"Unable to create online game.");
    }
  };

  const joinOnlineGame=useCallback(async(rawCode)=>{
    const trimmed=(rawCode||"").trim();
    if(trimmed.toLowerCase()==="playtest"){
      enablePlaytestMode();
      return;
    }
    const gameId=trimmed.replace(/^.*[?&]game=/,"");
    if(!gameId){setOnlineError("Enter a game link or game ID.");return;}
    if(!multiplayerEnabled()){setOnlineError("Supabase multiplayer is not configured.");return;}
    try{
      trackUmami("remote_game_join_attempt",{source:"join_form"});
      let row=await fetchLiveGame(gameId);
      if(!row){setOnlineError("That online game was not found.");return;}
      let seatInfo=loadSeat(gameId);
      let seat=seatInfo?.seat||null;
      let token=seatInfo?.token||null;
      let authority=false;
      if(seat==="A"&&token&&row.player_a_token===token) authority=true;
      else if(seat==="B"&&token&&row.player_b_token===token) authority=false;
      else if(!row.player_b_token){
        seat="B";token=makeSeatToken();
        const claimed=await claimSeat(gameId,"B",token);
        row=claimed||await fetchLiveGame(gameId);
        storeSeat(gameId,"B",token);
      }else if(row.player_a_token&&seatInfo?.token===row.player_a_token){
        seat="A";token=seatInfo.token;authority=true;
      }else{
        seat=null;token=null;
      }
      trackUmami("remote_game_joined",{source:"join_form",seat:seat||"spectator"});
      hydrateFromLiveRow(row,{seat,token,authority});
      startLivePolling(gameId,authority);
    }catch(err){
      trackUmami("remote_game_join_failed",{source:"join_form"});
      console.error(err);
      setOnlineError(err.message||"Unable to join online game.");
    }
  },[]);

  useEffect(()=>{
    if(typeof window==="undefined")return;
    if(initialRouteHandledRef.current)return;
    initialRouteHandledRef.current=true;
    const params=new URLSearchParams(window.location.search);
    const gameId=params.get("game");
    if(gameId){
      setJoinCode(gameId);
      void joinOnlineGame(gameId);
    }else{
      const requestedMode=getRequestedModeFromHash();
      if(requestedMode)launchModeFromHash(requestedMode,{replaceUrl:true});
    }
  },[joinOnlineGame,launchModeFromHash]);

  useEffect(()=>{
    if(typeof window==="undefined")return;
    const syncHomeRoute=()=>{
      const requested=getRequestedModeFromHash();
      if(requested&&requested!=="home"){
        const launched=launchModeFromHash(requested);
        if(!launched)setHomeRoute(requested);
        return;
      }
      setHomeRoute(requested);
    };
    window.addEventListener("hashchange",syncHomeRoute);
    return()=>window.removeEventListener("hashchange",syncHomeRoute);
  },[launchModeFromHash]);

  useEffect(()=>{
    setDemoChippyDismissed(false);
  },[homeRoute]);

  useEffect(()=>{
    if(typeof window==="undefined")return;
    const syncViewport=()=>setIsMobileLandscape(computeIsMobileLandscape());
    syncViewport();
    window.addEventListener("resize",syncViewport);
    window.addEventListener("orientationchange",syncViewport);
    return()=>{
      window.removeEventListener("resize",syncViewport);
      window.removeEventListener("orientationchange",syncViewport);
    };
  },[]);

  useEffect(()=>{
    const screen=liveGameId
      ?"remote_game"
      :gs?.mode
        ?gs.mode
        :isHomeRouteVariant(homeRoute)
          ?homeRoute
          :"home";
    if(screen===lastUmamiScreenRef.current)return;
    lastUmamiScreenRef.current=screen;
    trackUmamiScreen(screen,{
      mode:gs?.mode||"",
      live_game:liveGameId?"yes":"no",
      home_route:isHomeRouteVariant(homeRoute)?homeRoute:"home",
    });
  },[gs?.mode,homeRoute,liveGameId]);

  useEffect(()=>{
    if(!isMobileLandscape&&mobileLogOpen)setMobileLogOpen(false);
  },[isMobileLandscape,mobileLogOpen]);

  // Actions that reveal new info (need confirmation, can't undo after)
  const REVEALS=new Set(["3C","3D","3S","4C","4D","4H","5C","8H","KC","KD","KH","AD","7H"]);

  const advance=(g)=>{let n={...g};
    if(n.bonusActions>0){n.bonusActions--;n=L(n,`${n.currentPlayer} may play an additional Action this round.`);return n;}
    n.regularActionsPlayed++;if(n.regularActionsPlayed<n.actionsRequired)return n;
    setFdMode(false);setUndoState(null);
    if(isSoloMode(n.mode)){n.phase="score";n=L(n,`--- SCORING ---`);return n;}
    if(n.currentPlayer===n.firstPlayer){n.currentPlayer=opp(n.firstPlayer);n.regularActionsPlayed=0;
      n.actionsRequired=n.currentPlayer==="A"?n._aReq:n._bReq;n=L(n,`--- ${n.currentPlayer}'s turn ---`);
    }else{n.phase="score";n=L(n,`--- SCORING ---`);}return n;};

  const playFD=(gs,cid)=>{let g={...gs};const p=g.currentPlayer;
    g=setZ(g,p,"hand",[...getH(g,p)].filter(id=>id!==cid));
    g=setZ(g,p,"play",[...getP(g,p),{id:cid,faceDown:true}]);return L(g,`${p} plays ${CM[cid].name} face-down`);};

  // --- CAPITALIZE CHECK: triggers when 8S is discarded from hand ---
  const checkCap=(g,player,discardedId,then)=>{
    // Check if discarded card IS Capitalize (8S) and player has it in play as React
    // Actually: Capitalize triggers when you discard it FROM YOUR HAND, not from play.
    // So check if discardedId === "8S"
    if(discardedId==="8S"){
      const frozen=isFroz(g,player);
      if(frozen){g=L(g,`${player}: Capitalize triggers but Frozen!`);commitGameState(g);then(g);return;}
      const disc=getD(g,player).filter(id=>id!==discardedId);
      if(!disc.length){then(g);return;}
      setModal({type:"pickFromList",title:`${player}: Capitalize! You discarded 8♠. Scrap a card?`,cards:disc,canCancel:true,
        statsPlayer:player,
        onPick:id=>{setModal(null);let g2=cloneGs(g);g2=setZ(g2,player,"discard",[...getD(g2,player)].filter(x=>x!==id));
          g2.scrap=[...g2.scrap,id];g2=L(g2,`${player}: Capitalize scraps ${CM[id].name}`);commitGameState(g2);then(g2);},
        onCancel:()=>{setModal(null);then(g);}});return;}
    then(g);};

  // Helper: discard a card from hand with Capitalize check
  const discardFromHand=(g,player,cardId,then)=>{
    let g2=cloneGs(g);
    g2=setZ(g2,player,"hand",[...getH(g2,player)].filter(x=>x!==cardId));
    g2=setZ(g2,player,"discard",[...getD(g2,player),cardId]);
    trackEvent(g2,"card_discarded",{cardId,source:"hand"},{playerSlot:player});
    g2=L(g2,`${player} discards ${CM[cardId].name}`);commitGameState(g2);
    checkCap(g2,player,cardId,then);};

  const offerRefresh=(g,done)=>{const p=g.currentPlayer;if(!getH(g,p).length){done(g);return;}
    const opts=[{label:"Refresh (discard, then draw)",key:"refresh"}];
    if(g.scrap.includes("QH"))opts.push({label:"Sift (draw, then discard)",key:"sift"});
    if(g.scrap.includes("QS"))opts.push({label:"Declutter (scrap from discard)",key:"declutter"});
    opts.push({label:"Skip",key:"skip"});
    setModal({type:"refreshOpts",opts,onChoice:key=>{setModal(null);
      if(key==="skip"){done(g);return;}
      if(key==="refresh"){setModal({type:"pickDiscard",hand:getH(g,p),title:"Refresh: Discard (then draw)",
        onPick:id=>{setModal(null);
          discardFromHand(g,p,id,g2=>{
            setUndoState(null);
            g2=drawCards(g2,p,1);if(g2.drawn){trackDraws(g2,p,g2.drawn,"refresh");g2=L(g2,`${p} draws ${CM[g2.drawn[0]].name}`);g2.newCards=g2.drawn;}
            done(g2);});}});return;}
      if(key==="sift"){setUndoState(null);let g2=drawCards(g,p,1);if(g2.drawn){trackDraws(g2,p,g2.drawn,"sift");g2=L(g2,`${p} draws ${CM[g2.drawn[0]].name} (Sift)`);g2.newCards=g2.drawn;}commitGameState(g2);
        setModal({type:"pickDiscard",hand:getH(g2,p),title:"Sift: Discard a card",newCards:g2.drawn||[],
          onPick:id=>{setModal(null);discardFromHand(g2,p,id,done);}});return;}
      if(key==="declutter"){const disc=getD(g,p);if(!disc.length){done(g);return;}
        setModal({type:"pickFromList",title:"Declutter: Scrap from discard",cards:disc,canCancel:true,
          statsPlayer:p,
          onPick:id=>{setModal(null);let g2=cloneGs(g);g2=setZ(g2,p,"discard",[...getD(g2,p)].filter(x=>x!==id));
            g2.scrap=[...g2.scrap,id];g2=L(g2,`${p} scraps ${CM[id].name} (Declutter)`);done(g2);},
          onCancel:()=>{setModal(null);done(g);}});}}});};

  // --- UNDO ---
  const doUndo=()=>{if(undoState){commitGameState(undoState);setUndoState(null);setModal(null);setFdMode(false);}};

  const handlePlayCard=cid=>{if(!gs)return;if(gs.newCards.length)patchGameState(p=>({...p,newCards:[]}));
    const card=CM[cid],p=gs.currentPlayer;
    if(fdMode){setFdMode(false);const snap=cloneGs(gs);let g=playFD(gs,cid);
      playSfx("cardPlay",{volume:.5});
      trackEvent(g,"action_played",{cardId:cid,effectId:cid,faceDown:true,actionType:"FaceDown"},{playerSlot:p});
      setUndoState(snap);// Can undo face-down (no info revealed)
      offerRefresh(g,g2=>{g2=advance(g2);commitGameState(g2);});return;}
    if(card.type==="Modify"&&((p==="A"&&gs.amends.aNegate)||(p==="B"&&gs.amends.bNegate))){
      setModal({type:"alert",msg:"Negate prevents Modify actions!",onOk:()=>setModal(null)});return;}
    // Info-revealing actions: confirm first
    if(gs.mode!=="tutorial"&&REVEALS.has(cid)){
      setModal({type:"confirm",title:`Play ${card.name}?`,msg:`This will reveal new information and can't be undone.`,card:cid,
        onYes:()=>{setModal(null);setUndoState(null);resolveAction(cid);},
        onNo:()=>{setModal(null);}});return;}
    // Non-revealing actions: play with undo available
    const snap=cloneGs(gs);setUndoState(snap);resolveAction(cid);};

  // --- RESOLVE ACTION ---
  const resolveAction=(cid,effectId=cid,alreadyInPlay=false,baseGs=gs)=>{const card=CM[effectId],p=baseGs.currentPlayer;let g=cloneGs(baseGs);
    if(!alreadyInPlay){
      g=setZ(g,p,"hand",[...getH(g,p)].filter(id=>id!==cid));
      g=setZ(g,p,"play",[...getP(g,p),{id:cid,faceDown:false}]);
      playSfx("cardPlay",{volume:.5});
      trackEvent(g,"action_played",{cardId:cid,effectId,faceDown:false,actionType:card.type},{playerSlot:p});
    }
    if(card.type==="Modify"){g=L(g,`${p} plays ${card.name} (Modify)`);g=advance(g);commitGameState(g);return;}
    if(card.type==="React"){g=L(g,`${p} plays ${card.name} (React)`);g=advance(g);commitGameState(g);return;}
    if(card.type==="Remember"){g=L(g,`${p} plays ${card.name} (Remember)`);g=advance(g);commitGameState(g);return;}
    if(card.type==="Amend"){
      if(effectId==="7C"){g.amends={...g.amends,[opp(p)==="A"?"aFreeze":"bFreeze"]:true};g=L(g,`${p} plays Freeze`);}
      else if(effectId==="7D"){g.amends={...g.amends,[opp(p)==="A"?"aNegate":"bNegate"]:true};g=L(g,`${p} plays Negate`);}
      g=advance(g);commitGameState(g);return;}
      g=L(g,`${p} plays ${card.name}`);const frozen=isFroz(g,p);
      const scrapF=(g2,pl,id,reason="effect")=>{g2=setZ(g2,pl,"discard",[...getD(g2,pl)].filter(x=>x!==id));g2.scrap=[...g2.scrap,id];trackEvent(g2,"card_scrapped",{cardId:id,reason},{playerSlot:pl});return g2;};
      const done=g2=>{setUndoState(null);g2=advance(g2);commitGameState(g2);};// Clear undo after info revealed
      const pick=(t,cards,filter,onP,onC,extra={})=>{setModal({type:"pickFromList",title:t,cards,filter,canCancel:!!onC,cancelLabel:onC?"Cancel":undefined,...extra,
        onPick:id=>{setModal(null);onP(id);},onCancel:onC?()=>{setModal(null);onC();}:undefined});};
      const tutorialStep=(g.mode==="tutorial"&&p==="B")?(getTutorialRoundSetup(g._tutorialRound||1)?.computerActions||[])[g._tutorialComputerStep||0]:null;
      const tutorialChoice=tutorialStep&&typeof tutorialStep==="object"?(tutorialStep.choice||{}):{};
      const resolveCopiedImmediate=(g2,nextEffectId)=>resolveAction(cid,nextEffectId,true,g2);

    // 2s
    if(card.scrapSuits){if(frozen){g=L(g,"...Frozen!");done(g);return;}
        const disc=getD(g,p),valid=disc.filter(id=>card.scrapSuits.includes(CM[id].suit));
        if(!valid.length){g=L(g,"...no valid targets. Fizzles.");done(g);return;}
        if(g.mode==="tutorial"&&p==="B"&&tutorialChoice.target&&valid.includes(tutorialChoice.target)){
          let g2=scrapF({...g},p,tutorialChoice.target);g2=L(g2,`${p} scraps ${CM[tutorialChoice.target].name}`);done(g2);return;
        }
        pick(`${card.name}: Scrap a ${card.scrapSuits.map(s=>SUITS[s]).join("/")}`,disc,id=>card.scrapSuits.includes(CM[id].suit),
          id=>{let g2=scrapF({...g},p,id);g2=L(g2,`${p} scraps ${CM[id].name}`);done(g2);},
          ()=>{g=L(g,"...cancelled.");done(g);},{statsPlayer:p});return;}
    // 3C Defer
    if(effectId==="3C"){const dk=getDk(g,p);if(!dk.length){g=L(g,"...deck empty.");done(g);return;}
      setModal({type:"twoChoice",title:"Defer: Look at the top card of your deck",card:dk[0],opt1:"Leave on Top",opt2:"Put on Bottom",
        on1:()=>{setModal(null);g=L(g,`${p} leaves ${CM[dk[0]].name} on top`);done(g);},
        on2:()=>{setModal(null);let g2={...g};let d=[...getDk(g2,p)];d.push(d.shift());g2=setZ(g2,p,"deck",d);
          g2=L(g2,`${p} puts ${CM[dk[0]].name} on bottom`);done(g2);}});return;}
    // 3D Loot
    if(effectId==="3D"){g=drawCards(g,p,1);if(g.drawn){trackDraws(g,p,g.drawn,"loot");g=L(g,`${p} draws ${CM[g.drawn[0]].name}`);g.newCards=g.drawn;}commitGameState(g);
      setModal({type:"pickDiscard",hand:getH(g,p),title:"Loot: Discard a card",newCards:g.drawn||[],
        onPick:id=>{setModal(null);discardFromHand(g,p,id,g2=>done(g2));}});return;}
    // 3H Rummage
    if(effectId==="3H"){setModal({type:"twoOptChoice",title:"Rummage: Who Refreshes?",opt1:"You Refresh",opt2:"Opponent Refreshes",
      on1:()=>{setModal(null);setModal({type:"pickDiscard",hand:getH(g,p),title:"Rummage: Discard (then draw)",
        onPick:id=>{setModal(null);discardFromHand(g,p,id,g2=>{
          g2=drawCards(g2,p,1);if(g2.drawn){trackDraws(g2,p,g2.drawn,"rummage");g2=L(g2,`${p} draws ${CM[g2.drawn[0]].name}`);g2.newCards=g2.drawn;}done(g2);});}});},
      on2:()=>{setModal(null);const oh=getH(g,opp(p));
        if(isSoloMode(g.mode)){g=L(g,"...the Challenger has no hand to Refresh. Fizzles.");done(g);return;}
        if(onlineRef.current.active&&getCurrentSeat()===p&&getCurrentSeat()!==opp(p)){
          queueRemotePrompt(g,{type:"pickDiscardFromHand",kind:"rummage_opp",player:opp(p),title:`${opp(p)} must discard (then draws)`});
          return;
        }
        setModal({type:"pickDiscard",hand:oh,title:`Rummage: ${opp(p)} discards, then draws`,
          onPick:id=>{setModal(null);discardFromHand(g,opp(p),id,g2=>{
            g2=drawCards(g2,opp(p),1);if(g2.drawn){trackDraws(g2,opp(p),g2.drawn,"rummage");g2=L(g2,`${opp(p)} draws`);}done(g2);});}});}});return;}
    // 3S Consider
    if(effectId==="3S"){const dk=getDk(g,p);if(!dk.length){g=L(g,"...deck empty.");done(g);return;}
      if(g.mode==="tutorial"&&p==="B"&&tutorialChoice.decision){
        if(tutorialChoice.decision==="keep"){g=L(g,`${p} keeps ${CM[dk[0]].name}`);done(g);return;}
        if(tutorialChoice.decision==="discard"){let g2={...g};let d=[...getDk(g2,p)];const c=d.shift();
          g2=setZ(g2,p,"deck",d);g2=setZ(g2,p,"discard",[...getD(g2,p),c]);g2=L(g2,`${p} discards ${CM[c].name}`);done(g2);return;}
      }
        setModal({type:"twoChoice",title:"Consider: Look at the top card of your deck",card:dk[0],opt1:"Keep on Top",opt2:"Discard It",
          on1:()=>{setModal(null);g=L(g,`${p} keeps ${CM[dk[0]].name}`);done(g);},
          on2:()=>{setModal(null);let g2={...g};let d=[...getDk(g2,p)];const c=d.shift();
            g2=setZ(g2,p,"deck",d);g2=setZ(g2,p,"discard",[...getD(g2,p),c]);g2=L(g2,`${p} discards ${CM[c].name}`);done(g2);}});return;}
    // 4C Entomb
    if(effectId==="4C"){const dk=getDk(g,p);if(!dk.length){g=L(g,"...deck empty.");done(g);return;}
      pick("Entomb: Search your deck and discard 1 card",sortC(dk),null,id=>{let g2={...g};
        g2=setZ(g2,p,"deck",shuf([...getDk(g2,p)].filter(x=>x!==id)));g2=setZ(g2,p,"discard",[...getD(g2,p),id]);
        g2=L(g2,`${p} entombs ${CM[id].name}`);done(g2);});return;}
    // 4D Gamble
    if(effectId==="4D"){const dk=getDk(g,p);if(!dk.length){g=L(g,"...deck empty.");done(g);return;}
      pick("Gamble: Search your deck, take 1 card, then discard 1 at random",sortC(dk),null,id=>{let g2={...g};
        g2=setZ(g2,p,"deck",shuf([...getDk(g2,p)].filter(x=>x!==id)));let h=[...getH(g2,p),id];g2.newCards=[id];
        const ri=Math.floor(Math.random()*h.length);const disc=h[ri];h=h.filter((_,i)=>i!==ri);
        g2=setZ(g2,p,"hand",h);g2=setZ(g2,p,"discard",[...getD(g2,p),disc]);
        g2=L(g2,`${p} takes ${CM[id].name}, randomly discards ${CM[disc].name}`);done(g2);});return;}
    // 4H Cultivate
    if(effectId==="4H"){const dk=getDk(g,p);if(!dk.length){g=L(g,"...deck empty.");done(g);return;}
      pick("Cultivate: Search your deck and put 1 card on top",sortC(dk),null,id=>{let g2={...g};
        let d=shuf([...getDk(g2,p)].filter(x=>x!==id));d.unshift(id);g2=setZ(g2,p,"deck",d);
        g2=L(g2,`${p} cultivates ${CM[id].name}`);done(g2);});return;}
    // 4S Unearth
    if(effectId==="4S"){const disc=getD(g,p);if(!disc.length){g=L(g,"...discard empty.");done(g);return;}
      pick("Unearth: Return a card from your discard to hand",disc,null,id=>{let g2=cloneGs(g);
        g2=setZ(g2,p,"discard",[...getD(g2,p)].filter(x=>x!==id));let h=[...getH(g2,p),id];g2=setZ(g2,p,"hand",h);
        g2=L(g2,`${p} unearths ${CM[id].name}`);g2.newCards=[id];commitGameState(g2);
        setModal({type:"pickDiscard",hand:h,title:"Unearth: Discard a card",newCards:[id],
          onPick:did=>{setModal(null);discardFromHand(g2,p,did,g3=>done(g3));}});});return;}
    // 5C Mill
    if(effectId==="5C"){let dk=[...getDk(g,p)],dc=[...getD(g,p)],m=[];
      for(let i=0;i<3&&dk.length;i++){const c=dk.shift();dc.push(c);m.push(c);}
      g=setZ(g,p,"deck",dk);g=setZ(g,p,"discard",dc);g=L(g,`${p} mills: ${m.map(id=>CM[id].name).join(", ")}`);done(g);return;}
    // 5H Recall
    if(effectId==="5H"){const play=getP(g,p).filter(a=>!a.faceDown&&a.id!==cid);
      if(!play.length){g=L(g,"...no other actions.");done(g);return;}
      pick("Recall: Return one of your actions to hand",play.map(a=>a.id),null,id=>{let g2=cloneGs(g);
        g2=setZ(g2,p,"play",[...getP(g2,p)].filter(a=>a.id!==id));let h=[...getH(g2,p),id];g2=setZ(g2,p,"hand",h);
        g2=L(g2,`${p} recalls ${CM[id].name}`);g2.newCards=[id];commitGameState(g2);
        setModal({type:"pickDiscard",hand:h,title:"Recall: Discard",newCards:[id],
          onPick:did=>{setModal(null);discardFromHand(g2,p,did,g3=>done(g3));}});});return;}
    // 5S Reclaim
    if(effectId==="5S"){const disc=getD(g,p);if(!disc.length){g=L(g,"...discard empty.");done(g);return;}
      if(g.mode==="tutorial"&&p==="B"&&tutorialChoice.target&&disc.includes(tutorialChoice.target)){let g2={...g};
        g2=setZ(g2,p,"discard",[...getD(g2,p)].filter(x=>x!==tutorialChoice.target));g2=setZ(g2,p,"deck",[tutorialChoice.target,...getDk(g2,p)]);
        g2=L(g2,`${p} reclaims ${CM[tutorialChoice.target].name}`);done(g2);return;}
      pick("Reclaim: Put on top of deck",disc,null,id=>{let g2={...g};
        g2=setZ(g2,p,"discard",[...getD(g2,p)].filter(x=>x!==id));g2=setZ(g2,p,"deck",[id,...getDk(g2,p)]);
        g2=L(g2,`${p} reclaims ${CM[id].name}`);done(g2);});return;}
    // 6C Curse
    if(effectId==="6C"){if(!g.scrap.length){g=L(g,"...scrap empty. Fizzles.");done(g);return;}
      pick("Curse: Move a scrapped card into your opponent's discard",g.scrap,null,id=>{let g2={...g};
        g2.scrap=g2.scrap.filter(x=>x!==id);g2=setZ(g2,opp(p),"discard",[...getD(g2,opp(p)),id]);
        g2=L(g2,`${p} curses ${opp(p)} with ${CM[id].name}`);done(g2);},()=>{g=L(g,"...cancelled.");done(g);});return;}
    // 6D Abduct
    if(effectId==="6D"){const oa=getP(g,opp(p)).filter(a=>!a.faceDown);
      if(!oa.length){g=L(g,"...no opponent actions. Fizzles.");done(g);return;}
      pick("Abduct: Steal an opponent action into your discard",oa.map(a=>a.id),null,id=>{let g2={...g};
        g2=setZ(g2,opp(p),"play",[...getP(g2,opp(p))].filter(a=>a.id!==id));
        g2=setZ(g2,p,"discard",[...getD(g2,p),id]);g2=setZ(g2,p,"play",[...getP(g2,p)].filter(a=>a.id!==cid));
        g2.scrap=[...g2.scrap,cid];g2=L(g2,`${p} abducts ${CM[id].name}!`);done(g2);},()=>{g=L(g,"...cancelled.");done(g);});return;}
    // 6H Exchange
    if(effectId==="6H"){const od=getD(g,opp(p)),md=getD(g,p);
      if(!od.length||!md.length){g=L(g,"...need cards in both discards. Fizzles.");done(g);return;}
      pick("Exchange: Choose a card from your opponent's discard",od,null,oid=>{
        pick("Exchange: Choose one of your discard cards to trade",getD(g,p),null,mid=>{let g2={...g};
          let o2=[...getD(g2,opp(p))].filter(x=>x!==oid);o2.push(mid);
          let m2=[...getD(g2,p)].filter(x=>x!==mid);m2.push(oid);
          g2=setZ(g2,opp(p),"discard",o2);g2=setZ(g2,p,"discard",m2);
          g2=L(g2,`${p} exchanges: gives ${CM[mid].name}, takes ${CM[oid].name}`);done(g2);},()=>{g=L(g,"...cancelled.");done(g);});
      },()=>{g=L(g,"...cancelled.");done(g);});return;}
    // 6S Banish
    if(effectId==="6S"){const od=getD(g,opp(p));if(!od.length){g=L(g,"...opponent discard empty. Fizzles.");done(g);return;}
      pick("Banish: Scrap a card from your opponent's discard",od,null,id=>{let g2={...g};
        g2=setZ(g2,opp(p),"discard",[...getD(g2,opp(p))].filter(x=>x!==id));g2.scrap=[...g2.scrap,id];
        g2=L(g2,`${p} banishes ${CM[id].name}`);done(g2);},()=>{g=L(g,"...cancelled.");done(g);});return;}
    // 7H Abdicate
    if(effectId==="7H"){const oh=getH(g,opp(p)),faces=oh.filter(id=>FACE.includes(CM[id].rank));
      if(!faces.length){g=L(g,`${opp(p)} has no face cards.`);g=drawCards(g,opp(p),1);if(g.drawn){trackDraws(g,opp(p),g.drawn,"abdicate");g=L(g,`${opp(p)} draws`);}done(g);return;}
      if(onlineRef.current.active&&getCurrentSeat()===p&&getCurrentSeat()!==opp(p)){
        queueRemotePrompt(g,{type:"pickDiscardFromHand",kind:"abdicate",player:opp(p),title:`${opp(p)} must discard a face card`,faceOnly:true});
        return;
      }
      setModal({type:"pickDiscard",hand:oh,title:`${opp(p)} must discard a face card`,filter:id=>FACE.includes(CM[id].rank),
        onPick:id=>{setModal(null);let g2={...g};g2=setZ(g2,opp(p),"hand",[...getH(g2,opp(p))].filter(x=>x!==id));
          g2=setZ(g2,opp(p),"discard",[...getD(g2,opp(p)),id]);g2=L(g2,`${opp(p)} discards ${CM[id].name} (Abdicate)`);
          g2=drawCards(g2,opp(p),1);if(g2.drawn){trackDraws(g2,opp(p),g2.drawn,"abdicate");g2=L(g2,`${opp(p)} draws`);}done(g2);}});return;}
    // 7S Nullify
    if(effectId==="7S"){const allM=[...getP(g,"A").filter(a=>CM[a.id].type==="Modify"&&!a.faceDown).map(a=>({...a,ow:"A"})),
      ...getP(g,"B").filter(a=>CM[a.id].type==="Modify"&&!a.faceDown).map(a=>({...a,ow:"B"}))];
      if(!allM.length){g=L(g,"...no Modifies. Fizzles.");done(g);return;}
      pick("Nullify: Remove a Modify",allM.map(m=>m.id),null,id=>{let g2={...g};const ow=allM.find(m=>m.id===id).ow;
        g2=setZ(g2,ow,"play",[...getP(g2,ow)].filter(a=>a.id!==id));g2=setZ(g2,ow,"discard",[...getD(g2,ow),id]);
        g2=L(g2,`${p} nullifies ${CM[id].name}`);done(g2);});return;}
    // 8H Reject
    if(effectId==="8H"){const dk=getDk(g,p);if(!dk.length){g=L(g,"...deck empty.");done(g);return;}
      if(g.mode==="tutorial"&&p==="B"&&tutorialChoice.decision){
        if(tutorialChoice.decision==="keep"){g=L(g,`${p} keeps ${CM[dk[0]].name}`);done(g);return;}
        if(tutorialChoice.decision==="scrap"){if(frozen){g=L(g,"...Frozen!");done(g);return;}
          let g2={...g};let d=[...getDk(g2,p)];d.shift();g2=setZ(g2,p,"deck",d);g2.scrap=[...g2.scrap,dk[0]];
          g2=L(g2,`${p} rejects ${CM[dk[0]].name}`);done(g2);return;}
      }
        setModal({type:"twoChoice",title:"Reject: Look at the top card of your deck",card:dk[0],opt1:"Leave It",opt2:"Scrap It",
          on1:()=>{setModal(null);g=L(g,`${p} keeps ${CM[dk[0]].name}`);done(g);},
          on2:()=>{setModal(null);if(frozen){g=L(g,"...Frozen!");done(g);return;}
          let g2={...g};let d=[...getDk(g2,p)];d.shift();g2=setZ(g2,p,"deck",d);g2.scrap=[...g2.scrap,dk[0]];
          g2=L(g2,`${p} rejects ${CM[dk[0]].name}`);done(g2);}});return;}
    // 9C Terminate
    if(effectId==="9C"){if(frozen){g=L(g,"...Frozen!");done(g);return;}const disc=getD(g,p);
      const valid=disc.filter(id=>!FACE.includes(CM[id].rank));if(!valid.length){g=L(g,"...no non-face cards. Fizzles.");done(g);return;}
        pick("Terminate: Scrap a non-face card",disc,id=>!FACE.includes(CM[id].rank),
          id=>{done(L(scrapF({...g},p,id),`${p} scraps ${CM[id].name}`));},()=>{done(L(g,"...cancelled."));},{statsPlayer:p});return;}
    // 9D Impeach
    if(effectId==="9D"){if(frozen){g=L(g,"...Frozen!");done(g);return;}const disc=getD(g,p);
      const valid=disc.filter(id=>FACE.includes(CM[id].rank));if(!valid.length){g=L(g,"...no face cards. Fizzles.");done(g);return;}
        pick("Impeach: Scrap a face card",disc,id=>FACE.includes(CM[id].rank),
          id=>{done(L(scrapF({...g},p,id),`${p} scraps ${CM[id].name}`));},()=>{done(L(g,"...cancelled."));},{statsPlayer:p});return;}
    // 9H Accumulate
    if(effectId==="9H"){if(frozen){g=L(g,"...Frozen!");done(g);return;}const disc=getD(g,p);
      const ss=new Set(g.scrap.map(id=>CM[id].suit)),sr=new Set(g.scrap.map(id=>CM[id].rank));
      const valid=disc.filter(id=>ss.has(CM[id].suit)||sr.has(CM[id].rank));
      if(!valid.length){g=L(g,"...no matching cards. Fizzles.");done(g);return;}
        pick("Accumulate: Scrap matching scrapped card",disc,id=>ss.has(CM[id].suit)||sr.has(CM[id].rank),
          id=>{done(L(scrapF({...g},p,id),`${p} accumulates ${CM[id].name}`));},()=>{done(L(g,"...cancelled."));},{statsPlayer:p});return;}
    // 9S Reap
    if(effectId==="9S"){if(frozen){g=L(g,"...Frozen!");done(g);return;}const disc=getD(g,p);
      const valid=disc.filter((id,idx)=>disc.some((other,j)=>j!==idx&&(CM[other].rank===CM[id].rank||CM[other].suit===CM[id].suit)));
      if(!valid.length){g=L(g,"...no matching discard cards. Fizzles.");done(g);return;}
        pick("Reap: Scrap a card matching another discard card",disc,id=>valid.includes(id),
          id=>{done(L(scrapF({...g},p,id),`${p} reaps ${CM[id].name}`));},()=>{done(L(g,"...cancelled."));},{statsPlayer:p});return;}
    // JD Duplicate — immediately copies another of your Actions in play
    if(effectId==="JD"){const myActions=getP(g,p).filter(a=>a.id!==cid&&!a.faceDown);
      if(!myActions.length){g=L(g,"...no other actions to copy. Fizzles.");done(g);return;}
      pick("Duplicate: Pick one of YOUR actions to copy",myActions.map(a=>a.id),null,id=>{
        let g2=cloneGs(g);// Mark Duplicate as copying that action
        const pl=getP(g2,p).map(a=>a.id===cid?{...a,copiedFrom:id}:a);
        g2=setZ(g2,p,"play",pl);g2=L(g2,`${p} duplicates ${CM[id].name}`);
        if(["Enact","Amend"].includes(CM[id]?.type))resolveCopiedImmediate(g2,id);else done(g2);},
      ()=>{g=L(g,"...cancelled. Fizzles.");done(g);});return;}
    // JH Reflect — copies an opponent's Action in play
    if(effectId==="JH"){const oppActions=getP(g,opp(p)).filter(a=>!a.faceDown);
      if(!oppActions.length){g=L(g,"...no opponent actions to copy. Fizzles.");done(g);return;}
      pick("Reflect: Pick an OPPONENT'S action to copy",oppActions.map(a=>a.id),null,id=>{
        let g2=cloneGs(g);const pl=getP(g2,p).map(a=>a.id===cid?{...a,copiedFrom:id}:a);
        g2=setZ(g2,p,"play",pl);g2=L(g2,`${p} reflects ${CM[id].name}`);
        if(["Enact","Amend"].includes(CM[id]?.type))resolveCopiedImmediate(g2,id);else done(g2);},
      ()=>{g=L(g,"...cancelled. Fizzles.");done(g);});return;}
    // AD Explore
    if(effectId==="AD"){g=drawCards(g,p,1);if(g.drawn){trackDraws(g,p,g.drawn,"explore");g=L(g,`${p} draws ${CM[g.drawn[0]].name}`);g.bonusActions++;g.newCards=g.drawn;}done(g);return;}
    // AC Salvage
    if(effectId==="AC"){if(!g.scrap.length){g=L(g,"...scrap empty.");done(g);return;}
      pick("Salvage: Take from scrap",g.scrap,null,id=>{let g2=cloneGs(g);g2.scrap=g2.scrap.filter(x=>x!==id);
        g2=setZ(g2,p,"hand",[...getH(g2,p),id]);g2.newCards=[id];g2=L(g2,`${p} salvages ${CM[id].name}`);g2.bonusActions++;done(g2);},
      ()=>{g=L(g,"...cancelled.");done(g);});return;}
    // AH Retrieve — can retrieve ANY action in play (including face-down)
    if(effectId==="AH"){const play=getP(g,p).filter(a=>a.id!==cid);
      if(!play.length){g=L(g,"...no actions to retrieve.");done(g);return;}
      pick("Retrieve: Return any of your actions to hand",play.map(a=>a.id),null,id=>{let g2=cloneGs(g);
        g2=setZ(g2,p,"play",[...getP(g2,p)].filter(a=>a.id!==id));g2=setZ(g2,p,"hand",[...getH(g2,p),id]);
        g2.newCards=[id];g2=L(g2,`${p} retrieves ${CM[id].name}`);g2.bonusActions++;done(g2);},
      ()=>{g=L(g,"...cancelled.");done(g);});return;}
    // AS Reanimate — return card from discard to hand
    if(effectId==="AS"){const disc=getD(g,p);if(!disc.length){g=L(g,"...discard empty.");done(g);return;}
      pick("Reanimate: Return a card from your discard to hand",disc,null,id=>{let g2=cloneGs(g);
        g2=setZ(g2,p,"discard",[...getD(g2,p)].filter(x=>x!==id));g2=setZ(g2,p,"hand",[...getH(g2,p),id]);
        g2.newCards=[id];g2=L(g2,`${p} reanimates ${CM[id].name}`);g2.bonusActions++;done(g2);},
      ()=>{g=L(g,"...cancelled.");done(g);});return;}
    // KC Brainstorm
    if(effectId==="KC"){g=drawCards(g,p,3);const dr=g.drawn||[];trackDraws(g,p,dr,"brainstorm");g=L(g,`${p} draws: ${dr.map(id=>CM[id].name).join(", ")}`);g.newCards=dr;commitGameState(g);
      setModal({type:"brainstorm",hand:getH(g,p),newCards:dr,onPick:ids=>{setModal(null);let g2={...g};
        g2=setZ(g2,p,"hand",[...getH(g2,p)].filter(x=>!ids.includes(x)));g2=setZ(g2,p,"deck",[...ids,...getDk(g2,p)]);
        g2=L(g2,`${p} puts back: ${ids.map(id=>CM[id].name).join(", ")}`);g2.newCards=[];done(g2);}});return;}
    // KD Improvise
    if(effectId==="KD"){let dk=[...getDk(g,p)],dc=[...getD(g,p)],m=[];
      for(let i=0;i<3&&dk.length;i++){const c=dk.shift();dc.push(c);m.push(c);}
      g=setZ(g,p,"deck",dk);g=setZ(g,p,"discard",dc);g=L(g,`${p} mills: ${m.map(id=>CM[id].name).join(", ")}`);commitGameState(g);
      pick("Improvise: Take from discard",[...getD(g,p)],null,id=>{let g2=cloneGs(g);
        g2=setZ(g2,p,"discard",[...getD(g2,p)].filter(x=>x!==id));let h=[...getH(g2,p),id];g2=setZ(g2,p,"hand",h);
        g2=L(g2,`${p} takes ${CM[id].name}`);g2.newCards=[id];commitGameState(g2);
        setModal({type:"pickDiscard",hand:h,title:"Improvise: Discard",newCards:[id],
          onPick:did=>{setModal(null);discardFromHand(g2,p,did,g3=>done(g3));}});});return;}
    // KH Rejuvenate
    if(effectId==="KH"){setModal({type:"rejuvenate",hand:getH(g,p),onPick:ids=>{setModal(null);let g2=cloneGs(g);
      g2=setZ(g2,p,"hand",[...getH(g2,p)].filter(x=>!ids.includes(x)));g2=setZ(g2,p,"discard",[...getD(g2,p),...ids]);
      g2=L(g2,ids.length?`${p} discards: ${ids.map(id=>CM[id].name).join(", ")}`:`${p} discards nothing.`);
      // Check Capitalize for each discarded card (only 8S matters)
      const capCheck=(g3,ci)=>{if(ci>=ids.length){
        g3=drawCards(g3,p,ids.length);const dr=g3.drawn||[];trackDraws(g3,p,dr,"rejuvenate");
        g3=L(g3,dr.length?`${p} draws: ${dr.map(id=>CM[id].name).join(", ")}`:`${p} draws nothing.`);g3.newCards=dr;done(g3);return;}
        checkCap(g3,p,ids[ci],g4=>capCheck(g4,ci+1));};
      capCheck(g2,0);}});return;}
    // KS Bury
    if(effectId==="KS"){if(frozen){g=L(g,"...Frozen!");done(g);return;}const disc=getD(g,p);
      if(!disc.length){g=L(g,"...nothing to scrap.");done(g);return;}
      setModal({type:"pickMulti",cards:disc,maxPick:3,title:"Bury: Scrap up to 3 cards",hint:"Choose any number from 0 to 3.",statsPlayer:p,onPick:ids=>{setModal(null);let g2={...g};
        g2=setZ(g2,p,"discard",[...getD(g2,p)].filter(x=>!ids.includes(x)));g2.scrap=[...g2.scrap,...ids];
        g2=L(g2,ids.length?`${p} buries: ${ids.map(id=>CM[id].name).join(", ")}`:`${p} buries nothing.`);done(g2);}});return;}
    g=L(g,`(${card.name} not implemented)`);done(g);};

  // ============================================================
  // SCORING WITH MODIFY RESOLUTION
  // ============================================================
  const doScore=()=>{if(!gs)return;let g=cloneGs(gs);
    const first=gs.firstPlayer||"A";
    g.aMods=[];g.bMods=[];g.aForecast=[];g.bForecast=[];g._remotePrompt=null;g.currentPlayer=first;g._scoreFlow={stage:"mods",player:first,index:0};g=L(g,"Resolving modifications...");commitGameState(g);
    const firstMods=getModifyEntries(g,first);resolveMods(g,first,firstMods,0);};

  const resolveMods=(g,pl,mods,i)=>{
    if(g.currentPlayer!==pl||g._scoreFlow?.stage!=="mods"||g._scoreFlow?.player!==pl||g._scoreFlow?.index!==i){
      g={...g,currentPlayer:pl,_scoreFlow:{stage:"mods",player:pl,index:i}};
      commitGameState(g);
    }
    if(onlineRef.current.active&&(liveSeat||onlineRef.current.seat)&&((liveSeat||onlineRef.current.seat)!==pl))return;
    if(i>=mods.length){resolveQ2s(g,pl,g2=>{
      if(isSoloMode(g2.mode)){finalScore(g2);return;}
      const nextPlayer=opp(pl);
      if(pl!==g2.firstPlayer){finalScore(g2);return;}
      const nextMods=getModifyEntries(g2,nextPlayer);resolveMods(g2,nextPlayer,nextMods,0);});return;}
    const entry=mods[i],mid=entry.effectId,mc=CM[mid],hand=getH(g,pl),mk=pl==="A"?"aMods":"bMods";
    const next=(g2)=>resolveMods(g2||g,pl,mods,i+1);
    const modLabel=entry.copiedFrom?`${CM[entry.sourceId]?.name||mc.name} copying ${CM[entry.copiedFrom]?.name||mc.name}`:mc.name;
    const skip=()=>{let g2=L(g,`${pl}: ${modLabel} - skipped`);commitGameState(g2);next(g2);};
    // Forecast: choose target now, resolve after reveal
    if(mid==="5D"){const fk=pl==="A"?"aForecast":"bForecast";
      setModal({type:"pickFromList",title:`${pl}: Forecast - pick a scoring card to save later`,cards:hand,showHand:hand,canCancel:true,cancelLabel:"Skip Modify",
        onPick:tid=>{setModal(null);let g2=cloneGs(g);g2[fk]=[...(g2[fk]||[]),{sourceId:entry.sourceId,target:tid}];trackEvent(g2,"modify_chosen",{sourceId:entry.sourceId,effectId:mid,target:tid,kind:"forecast"},{playerSlot:pl,phase:"score"});g2=L(g2,`${pl}: ${modLabel} marks ${CM[tid].name} for Forecast`);commitGameState(g2);next(g2);},
        onCancel:()=>{setModal(null);skip();}});return;}
    // Vanish: defer
    if(mid==="8D"){let g2=L(g,`${pl}: ${modLabel} - after scoring`);commitGameState(g2);next(g2);return;}
    // Buff
    if(mid==="10H"){setModal({type:"pickFromList",title:`${pl}: Buff - choose which scoring card to modify`,cards:hand,filter:id=>higherRanks(CM[id].rank).length>0,canCancel:true,
      hint:"Pick the scoring card Buff will raise. Aces can count as high or low here.",
      onPick:tid=>{setModal(null);const hr=higherRanks(CM[tid].rank);
        if(!hr.length){let g2=L(g,`${pl}: ${modLabel} has no higher rank target for ${CM[tid].name}`);commitGameState(g2);next(g2);return;}
        setModal({type:"pickRank",title:`Buff ${CM[tid].name}: New rank`,ranks:hr,showHand:hand,cancelLabel:"Skip Modify",
          onPick:r=>{setModal(null);let g2=cloneGs(g);g2[mk]=[...g2[mk],{sourceId:entry.sourceId,target:tid,rank:r,suit:null}];trackEvent(g2,"modify_chosen",{sourceId:entry.sourceId,effectId:mid,target:tid,rank:r},{playerSlot:pl,phase:"score"});g2=L(g2,`${pl}: ${modLabel} ${CM[tid].name} -> ${r}`);commitGameState(g2);next(g2);},
          onCancel:()=>{setModal(null);skip();}});},
      onCancel:()=>{setModal(null);skip();}});return;}
    // Nerf
    if(mid==="10S"){setModal({type:"pickFromList",title:`${pl}: Nerf - choose which scoring card to modify`,cards:hand,filter:id=>lowerRanks(CM[id].rank).length>0,canCancel:true,
      hint:"Pick the scoring card Nerf will lower. Aces can count as high or low here.",
      onPick:tid=>{setModal(null);const lr=lowerRanks(CM[tid].rank);
        if(!lr.length){let g2=L(g,`${pl}: ${modLabel} has no lower rank target for ${CM[tid].name}`);commitGameState(g2);next(g2);return;}
        setModal({type:"pickRank",title:`Nerf ${CM[tid].name}: New rank`,ranks:lr,showHand:hand,cancelLabel:"Skip Modify",
          onPick:r=>{setModal(null);let g2=cloneGs(g);g2[mk]=[...g2[mk],{sourceId:entry.sourceId,target:tid,rank:r,suit:null}];trackEvent(g2,"modify_chosen",{sourceId:entry.sourceId,effectId:mid,target:tid,rank:r},{playerSlot:pl,phase:"score"});g2=L(g2,`${pl}: ${modLabel} ${CM[tid].name} -> ${r}`);commitGameState(g2);next(g2);},
          onCancel:()=>{setModal(null);skip();}});},
      onCancel:()=>{setModal(null);skip();}});return;}
    // Nudge
    if(mid==="10C"){setModal({type:"pickFromList",title:`${pl}: Nudge - choose which scoring card to modify`,cards:hand,filter:id=>adjacentRanks(CM[id].rank).length>0,canCancel:true,
      hint:"Pick the scoring card Nudge will move by one rank.",
      onPick:tid=>{setModal(null);const opts=adjacentRanks(CM[tid].rank);
        if(!opts.length){let g2=L(g,`${pl}: ${modLabel} has no adjacent ranks for ${CM[tid].name}`);commitGameState(g2);next(g2);return;}
        setModal({type:"pickRank",title:`Nudge ${CM[tid].name}: ±1`,ranks:opts,showHand:hand,cancelLabel:"Skip Modify",
          onPick:r=>{setModal(null);let g2=cloneGs(g);g2[mk]=[...g2[mk],{sourceId:entry.sourceId,target:tid,rank:r,suit:null}];trackEvent(g2,"modify_chosen",{sourceId:entry.sourceId,effectId:mid,target:tid,rank:r},{playerSlot:pl,phase:"score"});g2=L(g2,`${pl}: ${modLabel} ${CM[tid].name} -> ${r}`);commitGameState(g2);next(g2);},
          onCancel:()=>{setModal(null);skip();}});},
      onCancel:()=>{setModal(null);skip();}});return;}
    // Disguise
    if(mid==="10D"){setModal({type:"pickFromList",title:`${pl}: Disguise - choose which scoring card to modify`,cards:hand,canCancel:true,
      hint:"Pick the scoring card Disguise will change to another suit.",
      onPick:tid=>{setModal(null);
        setModal({type:"pickSuit",title:`Disguise ${CM[tid].name}: New suit`,showHand:hand,cancelLabel:"Skip Modify",
          onPick:s=>{setModal(null);let g2=cloneGs(g);g2[mk]=[...g2[mk],{sourceId:entry.sourceId,target:tid,rank:null,suit:s}];trackEvent(g2,"modify_chosen",{sourceId:entry.sourceId,effectId:mid,target:tid,suit:s},{playerSlot:pl,phase:"score"});g2=L(g2,`${pl}: ${modLabel} ${CM[tid].name} -> ${SUITS[s]}`);commitGameState(g2);next(g2);},
          onCancel:()=>{setModal(null);skip();}});},
      onCancel:()=>{setModal(null);skip();}});return;}
    // Clone — one SCORING card becomes copy of another SCORING card
    if(mid==="JC"){
      setModal({type:"pickFromList",title:`${pl}: Clone - pick a scoring card to OVERWRITE`,cards:hand,showHand:hand,canCancel:true,
        onPick:tid=>{setModal(null);const others=hand.filter(x=>x!==tid);
          setModal({type:"pickFromList",title:`Clone: Choose the scoring card to copy onto ${CM[tid].name}`,cards:others,showHand:hand,canCancel:false,
            onPick:sid=>{setModal(null);let g2=cloneGs(g);g2[mk]=[...g2[mk],{sourceId:entry.sourceId,target:tid,rank:CM[sid].rank,suit:CM[sid].suit}];trackEvent(g2,"modify_chosen",{sourceId:entry.sourceId,effectId:mid,target:tid,copyCardId:sid,rank:CM[sid].rank,suit:CM[sid].suit},{playerSlot:pl,phase:"score"});
              g2=L(g2,`${pl}: ${modLabel} ${CM[tid].name} -> copy of ${CM[sid].name}`);commitGameState(g2);next(g2);}});},
        onCancel:()=>{setModal(null);skip();}});return;}
    // Reminisce — one SCORING card becomes copy of a DISCARD card
    if(mid==="JS"){const disc=getD(g,pl);if(!disc.length){let g2=L(g,`${pl}: Reminisce - discard empty`);commitGameState(g2);next(g2);return;}
      setModal({type:"pickFromList",title:`${pl}: Reminisce - pick scoring card to OVERWRITE`,cards:hand,showHand:hand,canCancel:true,
        onPick:tid=>{setModal(null);
          setModal({type:"pickFromList",title:`Reminisce: Choose a discard card to copy onto ${CM[tid].name}`,cards:disc,showHand:hand,canCancel:false,
            onPick:sid=>{setModal(null);let g2=cloneGs(g);g2[mk]=[...g2[mk],{sourceId:entry.sourceId,target:tid,rank:CM[sid].rank,suit:CM[sid].suit}];trackEvent(g2,"modify_chosen",{sourceId:entry.sourceId,effectId:mid,target:tid,copyCardId:sid,rank:CM[sid].rank,suit:CM[sid].suit},{playerSlot:pl,phase:"score"});
              g2=L(g2,`${pl}: ${modLabel} ${CM[tid].name} -> copy of ${CM[sid].name}`);commitGameState(g2);next(g2);}});},
        onCancel:()=>{setModal(null);skip();}});return;}
    let g2=L(g,`${pl}: ${modLabel} - not implemented`);commitGameState(g2);next(g2);};

  // Queen Remember on 2s
  const resolveQ2s=(g,pl,done,tiStart=0)=>{
    if(g.currentPlayer!==pl||g._scoreFlow?.stage!=="q2s"||g._scoreFlow?.player!==pl||g._scoreFlow?.index!==tiStart){
      g={...g,currentPlayer:pl,_scoreFlow:{stage:"q2s",player:pl,index:tiStart}};
      commitGameState(g);
    }
    if(onlineRef.current.active&&(liveSeat||onlineRef.current.seat)&&((liveSeat||onlineRef.current.seat)!==pl))return;
    const mk=pl==="A"?"aMods":"bMods";
    const modded=new Set(getAppliedMods(g,pl).map(m=>m.target));
    const hand=getH(g,pl);
    const twos=hand.filter(id=>CM[id].rank==="2"&&!modded.has(id));
    const misc=g.scrap.includes("QC"),camo=g.scrap.includes("QD");
    const queenSourceLabel=misc&&camo
      ?"Miscalculate + Camouflage"
      :misc
      ?"Miscalculate"
      :camo
      ?"Camouflage"
      :"";
    if(!twos.length||(!misc&&!camo)){done(g);return;}
    const proc=(g2,ti)=>{if(g2.currentPlayer!==pl||g2._scoreFlow?.stage!=="q2s"||g2._scoreFlow?.player!==pl||g2._scoreFlow?.index!==ti){
        g2={...g2,currentPlayer:pl,_scoreFlow:{stage:"q2s",player:pl,index:ti}};
        commitGameState(g2);
      }
      if(onlineRef.current.active&&(liveSeat||onlineRef.current.seat)&&((liveSeat||onlineRef.current.seat)!==pl))return;
      if(ti>=twos.length){done(g2);return;}const tid=twos[ti];
      setModal({type:"queen2",pl,cardId:tid,misc,camo,showHand:hand,queenSourceLabel,
        onRank:()=>{setModal(null);
          setModal({type:"pickRank",title:`Miscalculate: ${CM[tid].name} -> any rank`,ranks:RO,showHand:hand,
            onPick:r=>{setModal(null);
              if(camo){setModal({type:"twoOptChoice",title:`Also change suit of ${CM[tid].name}? (rank -> ${r})`,opt1:"Yes",opt2:"No",
                on1:()=>{setModal(null);setModal({type:"pickSuit",title:"Pick suit",showHand:hand,
                  onPick:s=>{setModal(null);let g3=cloneGs(g2);g3[mk]=[...g3[mk],{target:tid,rank:r,suit:s}];trackEvent(g3,"queen_choice",{source:"both",target:tid,rank:r,suit:s},{playerSlot:pl,phase:"score"});g3=L(g3,`${pl}: ${CM[tid].name} -> ${r}${SUITS[s]}`);commitGameState(g3);proc(g3,ti+1);}});},
                on2:()=>{setModal(null);let g3=cloneGs(g2);g3[mk]=[...g3[mk],{target:tid,rank:r,suit:null}];trackEvent(g3,"queen_choice",{source:"miscalculate",target:tid,rank:r,suit:null},{playerSlot:pl,phase:"score"});g3=L(g3,`${pl}: ${CM[tid].name} -> ${r}`);commitGameState(g3);proc(g3,ti+1);}});}
              else{let g3=cloneGs(g2);g3[mk]=[...g3[mk],{target:tid,rank:r,suit:null}];trackEvent(g3,"queen_choice",{source:"miscalculate",target:tid,rank:r,suit:null},{playerSlot:pl,phase:"score"});g3=L(g3,`${pl}: ${CM[tid].name} -> ${r}`);commitGameState(g3);proc(g3,ti+1);}}});},
        onSuit:()=>{setModal(null);
          setModal({type:"pickSuit",title:`Camouflage: ${CM[tid].name} -> any suit`,showHand:hand,
            onPick:s=>{setModal(null);let g3=cloneGs(g2);g3[mk]=[...g3[mk],{target:tid,rank:null,suit:s}];trackEvent(g3,"queen_choice",{source:"camouflage",target:tid,rank:null,suit:s},{playerSlot:pl,phase:"score"});g3=L(g3,`${pl}: ${CM[tid].name} -> ${SUITS[s]}`);commitGameState(g3);proc(g3,ti+1);}});},
        onBoth:()=>{setModal(null);
          setModal({type:"pickRank",title:`${CM[tid].name}: Pick rank`,ranks:RO,showHand:hand,
            onPick:r=>{setModal(null);setModal({type:"pickSuit",title:`${CM[tid].name}: Pick suit`,showHand:hand,
              onPick:s=>{setModal(null);let g3=cloneGs(g2);g3[mk]=[...g3[mk],{target:tid,rank:r,suit:s}];trackEvent(g3,"queen_choice",{source:"both",target:tid,rank:r,suit:s},{playerSlot:pl,phase:"score"});g3=L(g3,`${pl}: ${CM[tid].name} -> ${r}${SUITS[s]}`);commitGameState(g3);proc(g3,ti+1);}});}});},
        onSkip:()=>{setModal(null);proc(g2,ti+1);}});};
    proc(g,tiStart);};

  // Finalize scoring — show reveal
  const finalScore=(g)=>{const aH=getH(g,"A"),bH=getH(g,"B"),aM=getAppliedMods(g,"A"),bM=getAppliedMods(g,"B");
    const aE=evalHand(aH,aM);
    const soloCard=isSoloMode(g.mode)?(g.bDeck[0]||null):null;
    const bE=isSoloMode(g.mode)?evalChallenger(soloCard):evalHand(bH,bM);
    const winner=isSoloMode(g.mode)?(aE.handRank>bE.handRank?"A":"B"):compareHands(aH,bH,aM,bM);
    trackEvent(g,"round_scored",{
      winner,
      aHand:[...aH],
      bHand:isSoloMode(g.mode)?[]:[...bH],
      aHandRank:aE.handName,
      bHandRank:bE.handName,
      aMods:[...aM],
      bMods:[...bM],
      challengerCardId:soloCard,
      challengerDescription:isSoloMode(g.mode)?bE.description:undefined,
    },{phase:"score",playerSlot:null});
    g=L(g,`A: ${aE.handName}`);
    if(isSoloMode(g.mode)){
      if(soloCard){
        g.bDeck=g.bDeck.slice(1);
        g._soloReveal={cardId:soloCard,handName:bE.handName,description:bE.description,handRank:bE.handRank};
        g._soloRevealedCards=[...(g._soloRevealedCards||[]),soloCard];
        trackEvent(g,"challenger_revealed",{cardId:soloCard,handName:bE.handName,description:bE.description},{phase:"score",playerSlot:"B"});
        g=L(g,`Challenger reveals ${CM[soloCard].rank}${SUITS[CM[soloCard].suit]}: ${bE.handName}`);
      }else{
        g._soloReveal={cardId:null,handName:bE.handName,description:bE.description,handRank:bE.handRank};
        g=L(g,"Challenger has no card to reveal.");
      }
    }else g=L(g,`B: ${bE.handName}`);
    if(winner==="A"){g.aChips++;trackEvent(g,"chip_awarded",{winner:"A",aChips:g.aChips,bChips:g.bChips},{phase:"score",playerSlot:"A"});g=L(g,isSoloMode(g.mode)?`You win the chip! (${g.aChips}-${g.bChips})`:`Player A wins the chip! (${g.aChips}-${g.bChips})`);}
    else if(winner==="B"){g.bChips++;trackEvent(g,"chip_awarded",{winner:"B",aChips:g.aChips,bChips:g.bChips},{phase:"score",playerSlot:"B"});g=L(g,isSoloMode(g.mode)?`The Challenger wins the chip! (${g.aChips}-${g.bChips})`:`Player B wins the chip! (${g.aChips}-${g.bChips})`);}
    else g=L(g,"Tie - no chip awarded.");
    if(isMatchOver(g)){
      trackGameFinished(g,getMatchWinner(g));
    }
    g.phase="reveal";g.currentPlayer=g.firstPlayer;g._scoreFlow=null;g._revealWinner=winner;g._revealAE=aE;g._revealBE=bE;commitGameState(g);};

  // After reveal, process post-score effects and advance
  const advanceFromReveal=()=>{if(!gs)return;let g={...gs};const winner=g._revealWinner;
    const effs=[];
    for(const pl of["A","B"]){for(const a of getP(g,pl)){
      const effect=getActionCard(a);
      if(a.faceDown||!effect)continue;
      if(effect.id==="5D"){
        const fk=pl==="A"?"aForecast":"bForecast";
        const queue=[...(g[fk]||[])];
        const nextMark=queue.shift()||null;
        effs.push({t:"forecast",pl,target:nextMark?nextMark.target:null});
        g[fk]=queue;
      }
      if(effect.id==="8D")effs.push({t:"vanish",pl});
      if(effect.id==="8C"&&((pl==="A"&&winner==="B")||(pl==="B"&&winner==="A")))effs.push({t:"capitulate",pl});
    }}
    procPost(g,effs,0);};

  const startNextRound=(g)=>{
    if(g.mode==="tutorial"){
      const nextRound=(g._tutorialRound||g.round||1)+1;
      if(nextRound>TUTORIAL_TOTAL_ROUNDS){
        const winner=g.aChips>=g.bChips?"A":"B";
        g.phase="tutorialDone";
        g.currentPlayer="A";
        g.actionsRequired=0;
        g.regularActionsPlayed=0;
        g.bonusActions=0;
        g._tutorialComplete=true;
        g._scoreFlow=null;
        g._remotePrompt=null;
        g=L(g,"=== Tutorial complete ===");
        trackGameFinished(g,winner);
        commitGameState(g);
        return;
      }
      let g2={...g};
      g2.aHand=[];g2.bHand=[];g2.aPlay=[];g2.bPlay=[];g2.newCards=[];g2.aMods=[];g2.bMods=[];g2.aForecast=[];g2.bForecast=[];
      g2._remotePrompt=null;g2._scoreFlow=null;g2._revealAE=null;g2._revealBE=null;g2._revealWinner=null;g2._tutorialComplete=false;
      g2.amends={aFreeze:false,bFreeze:false,aNegate:false,bNegate:false};
      g2.round=nextRound;
      g2._tutorialRound=nextRound;
      g2.firstPlayer="A";
      g2.currentPlayer="A";
      g2.phase="action";
      g2.regularActionsPlayed=0;
      g2.actionsRequired=2;
      g2.bonusActions=0;
      g2._aReq=2;
      g2._bReq=2;
      g2._tutorialAck=null;
      g2=L(g2,`=== ROUND ${g2.round} === Tutorial continues`);
      g2=drawCards(g2,"A",7);if(g2.error){g2.phase="tutorialDone";g2._tutorialComplete=true;g2=L(g2,"Tutorial deck ran out earlier than expected.");trackGameFinished(g2,g2.aChips>=g2.bChips?"A":"B");commitGameState(g2);return;}
      trackDraws(g2,"A",g2.drawn||[],"round_start");g2.aHand=sortC(g2.aHand);
      g2=drawCards(g2,"B",7);if(g2.error){g2.phase="tutorialDone";g2._tutorialComplete=true;g2=L(g2,"Tutorial opponent deck ran out earlier than expected.");trackGameFinished(g2,g2.aChips>=g2.bChips?"A":"B");commitGameState(g2);return;}
      trackDraws(g2,"B",g2.drawn||[],"round_start");g2.bHand=sortC(g2.bHand);
      g2=L(g2,`A: ${g2.aHand.map(id=>`${CM[id].rank}${SUITS[CM[id].suit]}`).join(", ")}`);
      g2=L(g2,`Tutorial Opponent: ${g2.bHand.map(id=>`${CM[id].rank}${SUITS[CM[id].suit]}`).join(", ")}`);
      trackRoundStart(g2);commitGameState(g2);return;
    }
    if(isMatchOver(g)){const winner=getMatchWinner(g);g.phase="gameOver";g=L(g,`WINNER: ${isSoloMode(g.mode)?(winner==="A"?"You win the solo run!":"The Challenger wins the solo run!"):`Player ${winner} wins the game!`}`);trackGameFinished(g,winner);commitGameState(g);return;}
    g.aHand=[];g.bHand=[];g.aPlay=[];g.bPlay=[];g.newCards=[];g.aMods=[];g.bMods=[];g.aForecast=[];g.bForecast=[];g._remotePrompt=null;
    g.amends={aFreeze:false,bFreeze:false,aNegate:false,bNegate:false};g._soloReveal=null;
    const nextFirstPlayer=isSoloMode(g.mode)
      ?"A"
      :(g._revealWinner==="A"||g._revealWinner==="B"
        ?g._revealWinner
        :g.firstPlayer);
    g.round++;g.firstPlayer=nextFirstPlayer;g.currentPlayer=g.firstPlayer;g.regularActionsPlayed=0;g.bonusActions=0;
    g=L(g,`=== ROUND ${g.round} === ${isSoloMode(g.mode)?"Solo Mode":`Player ${g.firstPlayer} acts first`}`);
    const {aActions:aR,bActions:bR,aDraw:aD,bDraw:bD,suddenDeath}=getRoundRequirements(g);
    if(suddenDeath)g=L(g,"SUDDEN DEATH!");
    g._aReq=aR;g._bReq=bR;g.actionsRequired=g.currentPlayer==="A"?aR:bR;
    g=drawCards(g,"A",aD);if(g.error){g.phase="gameOver";g=L(g,"A can't draw!");trackGameFinished(g,"B");commitGameState(g);return;}trackDraws(g,"A",g.drawn||[],"round_start");g.aHand=sortC(g.aHand);
    if(!isSoloMode(g.mode)){
      g=drawCards(g,"B",bD);if(g.error){g.phase="gameOver";g=L(g,"B can't draw!");trackGameFinished(g,"A");commitGameState(g);return;}trackDraws(g,"B",g.drawn||[],"round_start");g.bHand=sortC(g.bHand);
    }else g.bHand=[];
    g.phase="action";g=L(g,`A: ${g.aHand.map(id=>`${CM[id].rank}${SUITS[CM[id].suit]}`).join(", ")}`);
    if(isSoloMode(g.mode))g=L(g,`Challenger Deck: ${g.bDeck.length} cards remain`);
    else g=L(g,`B: ${g.bHand.map(id=>`${CM[id].rank}${SUITS[CM[id].suit]}`).join(", ")}`);
    trackRoundStart(g);commitGameState(g);
  };

  const procPost=(g,effs,i)=>{if(i>=effs.length){
    trackRoundSummary(g);
    if(isMatchOver(g)){const winner=getMatchWinner(g);g.phase="gameOver";g=L(g,`WINNER: ${isSoloMode(g.mode)?(winner==="A"?"You win the solo run!":"The Challenger wins the solo run!"):`Player ${winner} wins the game!`}`);trackGameFinished(g,winner);commitGameState(g);return;}
    const aH=getH(g,"A"),bH=getH(g,"B");
    g.aDiscard=[...g.aDiscard,...g.aPlay.map(a=>a.id),...aH];g.bDiscard=[...g.bDiscard,...g.bPlay.map(a=>a.id),...bH];
    startNextRound(g);return;}
    const e=effs[i];
    if(e.t==="forecast"){
      if(!e.target||!getH(g,e.pl).includes(e.target)){procPost(g,effs,i+1);return;}
      let g2={...g};
      g2=setZ(g2,e.pl,"hand",[...getH(g2,e.pl)].filter(x=>x!==e.target));
      g2=setZ(g2,e.pl,"deck",[e.target,...getDk(g2,e.pl)]);
      trackEvent(g2,"post_score_effect",{effect:"forecast",target:e.target,playerSlot:e.pl},{phase:"post_score",playerSlot:e.pl});
      g2=L(g2,`${e.pl}: Forecast puts ${CM[e.target].name} on top of the deck`);
      commitGameState(g2);procPost(g2,effs,i+1);return;}
    if(e.t==="vanish"){if(isFroz(g,e.pl)){g=L(g,`${e.pl}: Vanish - Frozen!`);procPost(g,effs,i+1);return;}
      const activeMods=getAppliedMods(g,e.pl);const effS=new Set(getH(g,e.pl).map(id=>{const m=activeMods.find(x=>x.target===id);return m?.suit||CM[id].suit;}));
      const disc=getD(g,e.pl);const valid=disc.filter(id=>effS.has(CM[id].suit));
      if(!valid.length){procPost(g,effs,i+1);return;}
      if(g.mode==="tutorial"&&e.pl==="B"){
        const id=valid[0];let g2={...g};g2=setZ(g2,e.pl,"discard",[...getD(g2,e.pl)].filter(x=>x!==id));g2.scrap=[...g2.scrap,id];
        trackEvent(g2,"post_score_effect",{effect:"vanish",target:id,playerSlot:e.pl},{phase:"post_score",playerSlot:e.pl});
        trackEvent(g2,"card_scrapped",{cardId:id,reason:"vanish"},{phase:"post_score",playerSlot:e.pl});
        g2=L(g2,`B: Vanish triggers automatically and scraps ${CM[id].name}`);commitGameState(g2);procPost(g2,effs,i+1);return;}
      setModal({type:"pickFromList",title:`${e.pl}: Vanish - scrap matching suit`,cards:disc,filter:id=>effS.has(CM[id].suit),canCancel:true,
          statsPlayer:e.pl,
          onPick:id=>{setModal(null);let g2={...g};g2=setZ(g2,e.pl,"discard",[...getD(g2,e.pl)].filter(x=>x!==id));g2.scrap=[...g2.scrap,id];
          trackEvent(g2,"post_score_effect",{effect:"vanish",target:id,playerSlot:e.pl},{phase:"post_score",playerSlot:e.pl});
          trackEvent(g2,"card_scrapped",{cardId:id,reason:"vanish"},{phase:"post_score",playerSlot:e.pl});
          g2=L(g2,`${e.pl}: Vanish scraps ${CM[id].name}`);commitGameState(g2);procPost(g2,effs,i+1);},
        onCancel:()=>{setModal(null);procPost(g,effs,i+1);}});return;}
    if(e.t==="capitulate"){if(isFroz(g,e.pl)){procPost(g,effs,i+1);return;}
      const disc=getD(g,e.pl);if(!disc.length){procPost(g,effs,i+1);return;}
      if(g.mode==="tutorial"&&e.pl==="B"){
        const id=disc[0];let g2={...g};g2=setZ(g2,e.pl,"discard",[...getD(g2,e.pl)].filter(x=>x!==id));g2.scrap=[...g2.scrap,id];
        trackEvent(g2,"post_score_effect",{effect:"capitulate",target:id,playerSlot:e.pl},{phase:"post_score",playerSlot:e.pl});
        trackEvent(g2,"card_scrapped",{cardId:id,reason:"capitulate"},{phase:"post_score",playerSlot:e.pl});
        g2=L(g2,`B: Capitulate triggers automatically after losing and scraps ${CM[id].name}`);commitGameState(g2);procPost(g2,effs,i+1);return;}
      setModal({type:"pickFromList",title:`${e.pl}: Capitulate - you lost! Scrap a card?`,cards:disc,canCancel:true,
          statsPlayer:e.pl,
          onPick:id=>{setModal(null);let g2={...g};g2=setZ(g2,e.pl,"discard",[...getD(g2,e.pl)].filter(x=>x!==id));g2.scrap=[...g2.scrap,id];
          trackEvent(g2,"post_score_effect",{effect:"capitulate",target:id,playerSlot:e.pl},{phase:"post_score",playerSlot:e.pl});
          trackEvent(g2,"card_scrapped",{cardId:id,reason:"capitulate"},{phase:"post_score",playerSlot:e.pl});
          g2=L(g2,`${e.pl}: Capitulate scraps ${CM[id].name}`);commitGameState(g2);procPost(g2,effs,i+1);},
        onCancel:()=>{setModal(null);procPost(g,effs,i+1);}});return;}
    procPost(g,effs,i+1);};

  // ============================================================
  // RENDER
  // ============================================================
  const homeLinkStyle={color:"#8fd0ff",fontWeight:700,textDecoration:"underline",textUnderlineOffset:2,pointerEvents:"auto"};
  const demoChippyMessage=renderChippyMessage(CHIPPY_COPY.demo.message,homeLinkStyle);
  const konamiCards=gs?getCascadeCardPool(gs):CARDS.map(c=>c.id);

  if(!gs)return(<>
    <KonamiCelebrationOverlay
      key={`konami-home-${konamiCelebrationKey}`}
      open={konamiCelebrationOpen}
      cards={konamiCards}
      onReplay={()=>{setKonamiCelebrationKey(v=>v+1);playSfx("victory",{volume:.34});}}
      onClose={()=>setKonamiCelebrationOpen(false)}
    />
    <div style={{minHeight:"100vh",fontFamily:FONT_BODY,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20,position:"relative",overflow:"hidden"}}>
    <FeltBackdrop/>
    <div className="kp-panel" style={{position:"relative",padding:"26px 30px 30px",borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:18,maxWidth:580,width:"min(580px,calc(100vw - 48px))"}}>
      <div style={{width:"100%",display:"flex",justifyContent:"flex-end"}}><SfxToggle enabled={sfxEnabled} onToggle={()=>setSfxEnabled(v=>!v)}/></div>
      <div style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:"#8d89a8",fontWeight:800}}>Deckbuilding Duel Prototype</div>
      <h1 className="kp-wordmark" style={{fontSize:54,fontWeight:400,letterSpacing:2,margin:0,textAlign:"center",lineHeight:1}}>KAIZEN POKER</h1>
        <p style={{color:"#c8c4d8",fontSize:14,maxWidth:460,textAlign:"center",lineHeight:1.6,margin:0}}>A deckbuilding poker duel. Play hot-seat locally, learn with Chippy in the guided Tutorial, take on the Challenger in Solo Mode, or create an online guest game and send the link to a friend.</p>
        <div style={{width:"100%",display:"grid",gap:14}}>
          <div style={{display:"grid",gap:8}}>
            <div className="kp-section-label" style={{color:"#f5b942",textAlign:"center"}}>Learn</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>
              <Btn label="Tutorial" bg="#f5b942" onClick={()=>startGame("tutorial")}/>
              <Btn label="Rules" bg="#ff9d2e" onClick={startRules}/>
            </div>
          </div>
          <div style={{display:"grid",gap:8}}>
            <div className="kp-section-label" style={{color:"#3bbf7c",textAlign:"center"}}>Play Locally</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>
              <Btn label="Hotseat Game" bg="#3bbf7c" onClick={()=>startGame("hotseat")}/>
              <Btn label="Solo Mode" bg="#2aa86a" onClick={()=>startGame("solo")}/>
              {resumeAvailable&&<Btn label="Resume Last Local Game" bg="#34a3ff" onClick={resumeLocalGame}/>}
            </div>
          </div>
          <div style={{display:"grid",gap:8}}>
            <div className="kp-section-label" style={{color:homeRoute==="remote"?"#aedbff":"#34a3ff",textAlign:"center",textShadow:homeRoute==="remote"?"0 0 14px rgba(52,163,255,.55)":"none"}}>Play Remotely</div>
            <div style={{display:"flex",justifyContent:"center"}}>
              <Btn label="Create Online Game" bg="#34a3ff" onClick={startOnlineGame}/>
            </div>
          </div>
        </div>
      <div style={{width:"100%",display:"grid",gap:8,paddingTop:2,paddingBottom:homeRoute==="remote"?6:0,borderRadius:14,background:homeRoute==="remote"?"#34a3ff14":"transparent",boxShadow:homeRoute==="remote"?"inset 0 0 0 2px #34a3ff44, 0 0 28px #34a3ff22":"none",transition:"all .2s ease"}}>
        <div className="kp-section-label" style={{color:homeRoute==="remote"?"#dbeafe":"#8d89a8",textAlign:"center"}}>Join Remote Game</div>
        <input
          value={joinCode}
          onChange={e=>setJoinCode(e.target.value)}
          placeholder="Paste game link or game ID"
          style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`2px solid ${homeRoute==="remote"?"#34a3ff":"#3d4470"}`,background:"#12142a",color:"#f5f1e8",fontSize:13,fontFamily:FONT_BODY,fontWeight:600,boxShadow:"inset 0 3px 8px rgba(0,0,0,.4)"}}
        />
        <div style={{display:"flex",justifyContent:"center"}}>
          <Btn label="Join Game" bg="#2173c2" onClick={()=>joinOnlineGame(joinCode)}/>
        </div>
      </div>
        {onlineError&&<div style={{fontSize:12,color:"#fca5a5",textAlign:"center",maxWidth:460}}>{onlineError}</div>}
        </div></div>
    {homeRoute==="demo"&&!demoChippyDismissed&&<Chippy
      title={CHIPPY_COPY.demo.title}
      message={demoChippyMessage}
      visible
      actionLabel="OK"
      onAction={()=>{trackUmami("demo_intro_dismissed",{source:"demo_route"});setDemoChippyDismissed(true);}}
      initialPos={{x:150,y:252}}
      draggable={false}
    />}
  </>);

  if(gs.mode==="rules"||gs.mode==="gallery")return <Suspense fallback={<div className="kp-route-loading">Loading...</div>}>
    <PassiveScreens mode={gs.mode} hoverId={galleryHoverId} setHoverId={setGalleryHoverId}
      chippyDismissed={galleryChippyDismissed} setChippyDismissed={setGalleryChippyDismissed}
      isCompact={isMobileLandscape} onBack={()=>{playSfx("confirm",{volume:.28});clearGameState();}}/>
  </Suspense>;

  const isOnlineMode=gs.mode==="online";
  const actingPlayer=gs.currentPlayer;
  const seatPlayer=isOnlineMode?(liveSeat||onlineRef.current.seat||null):null;
  const viewerPlayer=gs.mode==="tutorial"?"A":isOnlineMode?(seatPlayer||actingPlayer):actingPlayer;
  // The solo test mode always renders the opposite of the default card style:
  // with illustrations as the default it is the "Solo Artless Test" (HTML cards),
  // and if USE_ILLUSTRATED_CARDS is rolled back it becomes the art test again.
  const cardRenderStyle=gs.mode==="solo_art"
    ?(USE_ILLUSTRATED_CARDS?"html":"image")
    :(USE_ILLUSTRATED_CARDS?"image":"html");
  const soloDifficulty=gs._soloDifficulty||SOLO_DIFFICULTIES.difficult;
  const easySoloMode=isSoloMode(gs.mode)&&soloDifficulty===SOLO_DIFFICULTIES.easy;
  const showingRevealedChallengerCard=easySoloMode&&!!gs._soloReveal?.cardId&&gs.phase!=="action";
  const challengerDisplayCardId=easySoloMode
    ?(showingRevealedChallengerCard?(gs._soloReveal?.cardId||null):(gs.bDeck[0]||null))
    :null;
  const challengerDisplayLookup=challengerDisplayCardId?CHALLENGER_LOOKUP[CM[challengerDisplayCardId].rank]:null;
  const hand=getH(gs,viewerPlayer);
  const actionsLeft=gs.actionsRequired-gs.regularActionsPlayed+gs.bonusActions;
  const soloIntroMessage=CHIPPY_COPY.soloIntro.message;
  const setSoloDifficulty=(difficulty)=>{
    if(!gs||!isSoloMode(gs.mode))return;
    const nextDifficulty=difficulty===SOLO_DIFFICULTIES.easy?SOLO_DIFFICULTIES.easy:SOLO_DIFFICULTIES.difficult;
    const g2={...gs,_soloDifficulty:nextDifficulty};
    setSoloIntroVisible(false);
    commitGameState(g2);
  };
  const onlineReady=!isOnlineMode||onlineStatus!=="waiting";
  const canControlSeat=!isOnlineMode||(!!seatPlayer&&seatPlayer===actingPlayer);
  const canUseOnlineControls=!isOnlineMode||(onlineReady&&!!seatPlayer&&seatPlayer===actingPlayer);
  const canAct=gs.phase==="action"&&actionsLeft>0&&canControlSeat&&onlineReady;
  const describeVisibleAction=(pl,a)=>{
    if(a.faceDown&&pl!==viewerPlayer)return "Hidden face-down";
    const copiedName=a.copiedFrom?CM[a.copiedFrom]?.name:null;
    const baseName=copiedName?`${CM[a.id]?.name} copying ${copiedName}`:CM[a.id]?.name;
    return `${baseName}${a.faceDown?" face-down":" face-up"}`;
  };
  const actionSummaryRows=(gs.phase==="score"||gs.phase==="reveal")?["A","B"].map(pl=>{
    const entries=getP(gs,pl);
    if(!entries.length)return null;
    const label=isSoloMode(gs.mode)
      ?(pl==="A"?"You played":"Challenger played")
      :(pl===viewerPlayer?"You played":`Player ${pl} played`);
    return {pl,label,text:entries.map(a=>describeVisibleAction(pl,a)).join(", ")};
  }).filter(Boolean):[];

  const isSuddenDeath=gs.aChips===6||gs.bChips===6;
  const headerPad=isMobileLandscape?"8px 10px":"10px 16px";
  const headerGap=isMobileLandscape?8:12;
  const headerFontSize=isMobileLandscape?11:12;
  const mainPad=isMobileLandscape?8:16;
  const mainGap=isMobileLandscape?8:12;
  const panelPad=isMobileLandscape?"8px 10px":"12px 14px";
  const handPad=isMobileLandscape?"8px 10px":"14px 16px";
  const handGap=isMobileLandscape?4:8;
  const sectionRadius=isMobileLandscape?16:18;
  const handCardSmall=false;
  const actionAreaMinHeight=isMobileLandscape?78:95;
  const publicAreaGap=isMobileLandscape?10:16;

  const pClr=viewerPlayer==="A"?"#ff5a4e":"#34a3ff";
  const chipGoal=7;
  const chipStrip=(pl,count,color)=>Array.from({length:chipGoal},(_,i)=><span key={pl+i} style={{width:10,height:10,borderRadius:"50%",display:"inline-block",background:i<count?color:"#12142a",boxShadow:i<count?`0 0 10px ${color}88`:"inset 0 1px 2px #0008",border:`1px solid ${i<count?color+"88":"#3d4470"}`,animation:i===count-1?"chipBounce .45s cubic-bezier(.26,1.5,.42,1)":"none"}}/>);
  // Redact hidden information from the log: in online games mask the other
  // seat (or both while unseated); in hotseat mask both players, since either
  // player can scroll the log on the shared device.
  const logHiddenPlayers=isOnlineMode
    ?(seatPlayer?["A","B"].filter(pl=>pl!==seatPlayer):["A","B"])
    :gs.mode==="hotseat"?["A","B"]:[];
  const visibleLog=gs.log.map(msg=>{
    let next=msg;
    logHiddenPlayers.forEach(pl=>{
      if(next.startsWith(`${pl}: `)) next=`${pl}: hidden hand`;
      else if(next.startsWith(`${pl} draws:`)) next=`${pl} draws cards`;
      else if(next.startsWith(`${pl} draws `) && next!==`${pl} draws`) next=`${pl} draws`;
      else if(next.startsWith(`${pl} keeps `)) next=`${pl} looks at the top card`;
      else if(next.startsWith(`${pl} puts back:`)) next=`${pl} puts cards back on top of the deck`;
      else if(next.startsWith(`${pl} puts `) && next.includes("on bottom")) next=`${pl} adjusts the top of the deck`;
      else if(next.startsWith(`${pl} cultivates `)) next=`${pl} cultivates a card to the top of the deck`;
      else if(next.startsWith(`${pl} takes `)) next=`${pl} takes a card, then discards a random card`;
      else if(next.startsWith(`${pl} has no face cards.`)) next=`${pl} reveals no face cards.`;
    });
    return next;
  });
  const revealPostQueue=(g)=>{
    const items=[];
    for(const pl of["A","B"]){
      for(const a of getP(g,pl)){
        const effect=getActionCard(a);
        if(a.faceDown||!effect)continue;
        if(effect.id==="5D")items.push(`${pl}: Forecast`);
        if(effect.id==="8D")items.push(`${pl}: Vanish`);
        if(effect.id==="8C"&&((pl==="A"&&g._revealWinner==="B")||(pl==="B"&&g._revealWinner==="A")))items.push(`${pl}: Capitulate`);
      }
    }
    return items;
  };
  const renderShowdown=(isFinal=false)=>{
    const w=gs._revealWinner,aE=gs._revealAE,bE=gs._revealBE;
    const aH=getH(gs,"A"),bH=getH(gs,"B");
    const wClr=w==="A"?"#ff5a4e":w==="B"?"#34a3ff":"#718096";
    const winnerPlayer=w==="A"?"A":w==="B"?"B":null;
    const cascadeCards=getCascadeCardPool(gs);
    const wText=isSoloMode(gs.mode)
      ?(isFinal
        ?(w==="A"?"You win the solo run!":w==="B"?"The Challenger wins the solo run!":"The solo run ends in a tie!")
        :(w==="A"?"You win the chip!":w==="B"?"The Challenger wins the chip!":"Tie - the Challenger keeps the chip"))
      :(isFinal
        ?(w==="A"?"Player A wins the game!":w==="B"?"Player B wins the game!":"Game ends in a tie!")
        :(w==="A"?"Player A wins the chip!":w==="B"?"Player B wins the chip!":"Tie - no chip awarded"));
    const postQueue=revealPostQueue(gs);
    const soloRow=isSoloMode(gs.mode)&&gs._soloReveal?.cardId?CHALLENGER_LOOKUP[CM[gs._soloReveal.cardId].rank]:null;
    const shell=(
      <div style={{padding:isFinal?24:16,background:"linear-gradient(180deg,#262b4cf6,#191c36fa)",borderRadius:isFinal?24:18,border:`3px solid ${wClr}`,boxShadow:isFinal?`0 8px 0 rgba(0,0,0,.4), 0 40px 100px ${wClr}44, inset 0 2px 0 rgba(255,255,255,.08)`:`0 6px 0 rgba(0,0,0,.4), 0 24px 60px ${wClr}33, inset 0 2px 0 rgba(255,255,255,.08)`,animation:"revealRise 0.4s cubic-bezier(.26,1.36,.42,1)",position:"relative",overflow:"hidden",maxWidth:isFinal?980:undefined,width:"100%"}}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(120deg,transparent 0%,rgba(255,255,255,.05) 22%,transparent 46%)",backgroundSize:"240px 100%",animation:"brassShine 5.5s linear infinite",pointerEvents:"none",opacity:.55}}/>
        {isFinal&&<>
          <div style={{position:"absolute",top:-110,left:-80,width:260,height:260,borderRadius:"50%",background:`radial-gradient(circle,${wClr}33 0%,transparent 68%)`,pointerEvents:"none"}}/>
          <div style={{position:"absolute",bottom:-120,right:-60,width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,#f5b94222 0%,transparent 72%)",pointerEvents:"none"}}/>
        </>}
        <div style={{textAlign:"center",marginBottom:isFinal?16:12,position:"relative"}}>
          <div style={{fontSize:isFinal?11:10,fontWeight:800,color:"#9b97b2",letterSpacing:isFinal?4:3,textTransform:"uppercase",marginBottom:6}}>{isFinal?"Final Showdown":"Showdown"}</div>
          <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:isFinal?14:10,marginBottom:4}}>
            {w!=="TIE"&&<Chip filled color={w==="A"?"#ff5a4e":"#34a3ff"} label={isFinal?"*":"*"} active/>}
            <div style={{fontSize:isFinal?44:26,color:wClr,fontFamily:FONT_DISPLAY,textShadow:`0 3px 0 rgba(0,0,0,.45), 0 0 ${isFinal?30:20}px ${wClr}66`,lineHeight:1.08,animation:"scorePunch .5s cubic-bezier(.26,1.5,.42,1) .42s backwards"}}>{wText}</div>
            {w!=="TIE"&&<Chip filled color={w==="A"?"#ff5a4e":"#34a3ff"} label={isFinal?"*":"*"} active/>}
          </div>
          <div style={{fontSize:isFinal?18:13,color:isFinal?"#dce7f2":"#a8a4c0",fontWeight:isFinal?700:400,animation:"chipBounce .4s cubic-bezier(.26,1.5,.42,1) .55s backwards"}}>{gs.aChips} - {gs.bChips}</div>
          {isFinal&&winnerPlayer&&<div style={{marginTop:10,display:"inline-flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:999,background:"#12142add",border:`1px solid ${wClr}55`,boxShadow:`0 12px 28px ${wClr}22`}}>
            <span style={{fontSize:10,fontWeight:800,letterSpacing:1.4,textTransform:"uppercase",color:"#f3d7a4"}}>Champion</span>
            <span style={{fontSize:13,color:"#e8f1f9"}}>{isSoloMode(gs.mode)?(winnerPlayer==="A"?"You beat the Challenger":"The Challenger shuts the door"):`Player ${winnerPlayer} closes it out`}</span>
          </div>}
          {!isFinal&&postQueue.length>0&&<div style={{marginTop:10,display:"inline-flex",gap:8,flexWrap:"wrap",justifyContent:"center",padding:"7px 12px",borderRadius:999,background:"#12142acc",border:"2px solid #3d4470",boxShadow:"0 10px 24px #00000024"}}>
            <span style={{fontSize:9,fontWeight:800,letterSpacing:1.4,textTransform:"uppercase",color:"#d8c08d"}}>Up Next</span>
            <span style={{fontSize:11,color:"#dbe5ee"}}>{postQueue.join(" / ")}</span>
          </div>}
        </div>
        {isSoloMode(gs.mode)
          ?<div style={{display:"grid",gap:isFinal?18:14}}>
            <div style={{display:"flex",gap:isFinal?20:16,justifyContent:"center",flexWrap:"wrap",alignItems:"stretch"}}>
              <div style={{minWidth:300,maxWidth:420,opacity:w==="B"?0.55:1,transition:"all 0.3s",padding:isFinal?"12px 14px 14px":"8px 10px 10px",borderRadius:18,background:w==="A"?"#ff5a4e14":"transparent",border:w==="A"?"1px solid #ff5a4e44":"1px solid transparent",boxShadow:w==="A"&&isFinal?"0 18px 42px #ff5a4e22":"none"}}>
                <div style={{fontSize:isFinal?13:12,fontWeight:700,color:"#ff5a4e",marginBottom:6,textAlign:"center",letterSpacing:1}}>
                  YOU {w==="A"&&"*"}
                </div>
                <div style={{display:"flex",gap:5,justifyContent:"center",marginBottom:6,flexWrap:"wrap"}}>
                  {displayOrder(aH,getAppliedMods(gs,"A")).map((id,i)=>{
                    const mod=getAppliedMods(gs,"A").find(m=>m.target===id);
                    return(<div key={id} className="kp-reveal-card" style={{position:"relative",animationDelay:`${i*0.06}s`,animationFillMode:"backwards"}}>
                      <PreviewCard id={id} glow={w==="A"?"#ff5a4e":undefined} rankSticker={mod?.rank} suitSticker={mod?.suit}/>
                    </div>);
                  })}
                </div>
                <div style={{textAlign:"center"}}><HandBadge ids={aH} mods={getAppliedMods(gs,"A")} delay=".38s"/></div>
                <div style={{textAlign:"center",marginTop:6,fontSize:isFinal?11:10,color:w==="A"?"#f3d7a4":"#9b97b2",letterSpacing:.4}}>
                  {aE.handName} {isFinal?(w==="A"?"wins the run":"makes the final hand"):(w==="A"?"beats the Challenger":"faces the Challenger")}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",fontSize:isFinal?28:20,fontWeight:900,color:"#f3d7a4",fontFamily:FONT_DISPLAY,letterSpacing:2,padding:"0 6px"}}>VS</div>
              <div style={{minWidth:300,maxWidth:420,opacity:w==="A"?0.55:1,transition:"all 0.3s",padding:isFinal?"12px 14px 14px":"8px 10px 10px",borderRadius:18,background:w==="B"?"#34a3ff14":"transparent",border:w==="B"?"1px solid #34a3ff44":"1px solid transparent",boxShadow:w==="B"&&isFinal?"0 18px 42px #34a3ff22":"none"}}>
                <div style={{fontSize:isFinal?13:12,fontWeight:700,color:"#34a3ff",marginBottom:6,textAlign:"center",letterSpacing:1}}>
                  CHALLENGER {w==="B"&&"*"}
                </div>
                <div style={{display:"flex",justifyContent:"center",marginBottom:8}}>
                  {gs._soloReveal?.cardId
                    ?<div className="kp-reveal-card" style={{position:"relative",animationDelay:".3s",animationFillMode:"backwards"}}><PreviewCard id={gs._soloReveal.cardId} glow={w==="B"?"#34a3ff":undefined}/></div>
                    :<div style={{width:68,height:95,borderRadius:8,border:"1px dashed #516172",display:"flex",alignItems:"center",justifyContent:"center",color:"#9b97b2",fontSize:10}}>No card</div>}
                </div>
                <div style={{textAlign:"center",marginBottom:6}}><span style={{display:"inline-block",padding:"4px 14px",borderRadius:9,background:"#12142a",border:"2px solid #34a3ff",color:"#7ec3ff",fontWeight:400,fontSize:13,fontFamily:FONT_DISPLAY,letterSpacing:.6,whiteSpace:"nowrap",boxShadow:"0 3px 0 rgba(0,0,0,.4), 0 0 14px #34a3ff33",animation:"scorePunch .42s cubic-bezier(.26,1.5,.42,1) .38s backwards"}}>{bE.handName}</span></div>
                <div style={{textAlign:"center",marginTop:6,fontSize:isFinal?11:10,color:w==="B"?"#f3d7a4":"#9b97b2",letterSpacing:.25,lineHeight:1.4}}>
                  {soloRow?.rankLabel?`${soloRow.rankLabel} maps to ${bE.handName}. `:""}{gs._soloReveal?.description||bE.description}
                </div>
              </div>
            </div>
          </div>
          :<div style={{display:"flex",gap:isFinal?20:16,justifyContent:"center",flexWrap:"wrap"}}>
            {[{pl:"A",hand:aH,ev:aE,clr:"#ff5a4e",mods:getAppliedMods(gs,"A")},{pl:"B",hand:bH,ev:bE,clr:"#34a3ff",mods:getAppliedMods(gs,"B")}].map(({pl,hand:h,ev,clr,mods})=>{
              const isWinner=w===pl;const isTie=w==="TIE";
              return(<div key={pl} style={{opacity:!isWinner&&!isTie?0.5:1,transition:"all 0.3s",padding:isFinal?"12px 14px 14px":"8px 10px 10px",borderRadius:18,background:isWinner?`${clr}14`:"transparent",border:isWinner?`1px solid ${clr}44`:"1px solid transparent",boxShadow:isWinner&&isFinal?`0 18px 42px ${clr}22`:"none"}}>
                <div style={{fontSize:isFinal?13:12,fontWeight:700,color:clr,marginBottom:6,textAlign:"center",letterSpacing:1}}>
                  PLAYER {pl} {isWinner&&"*"}</div>
                <div style={{display:"flex",gap:5,marginBottom:6}}>
                  {displayOrder(h,mods).map((id,i)=>{
                    const mod=mods.find(m=>m.target===id);
                    return(<div key={id} className="kp-reveal-card" style={{position:"relative",animationDelay:`${i*0.06}s`,animationFillMode:"backwards"}}>
                      <PreviewCard id={id} glow={isWinner?clr:undefined} rankSticker={mod?.rank} suitSticker={mod?.suit}/>
                    </div>);})}
                </div>
                <div style={{textAlign:"center"}}><HandBadge ids={h} mods={mods} delay=".38s"/></div>
                <div style={{textAlign:"center",marginTop:6,fontSize:isFinal?11:10,color:isWinner?"#f3d7a4":"#9b97b2",letterSpacing:.4}}>
                  {ev.handName} {isFinal?(isWinner&&w!=="TIE"?"wins the game":"makes the final hand"):(isWinner&&w!=="TIE"?"claims the chip":"holds")}
                </div>
              </div>);})}
          </div>}
        <div style={{display:"flex",justifyContent:"center",marginTop:18}}>
          {isFinal
            ?<Btn label="New Game" bg="linear-gradient(135deg,#f5b942,#ff9d2e)" onClick={()=>clearGameState()}/>
            :(isMatchOver(gs)
              ?<Btn label="New Game" bg="#333" onClick={()=>clearGameState()} disabled={!canUseOnlineControls}/>
              :<Btn label={gs.mode==="tutorial"&&gs._tutorialRound===TUTORIAL_TOTAL_ROUNDS?"Finish Tutorial":"Next Round ->"} bg="#f5b942" onClick={advanceFromReveal} disabled={!canUseOnlineControls||!tutorialAllows("next")}/>)}
        </div>
      </div>
    );
    if(!isFinal)return <div style={{position:"fixed",inset:0,zIndex:25,display:"flex",alignItems:"center",justifyContent:"center",padding:"28px 20px",background:"radial-gradient(circle at 50% 20%,rgba(13,21,29,.18) 0%,rgba(10,15,22,.78) 38%,rgba(5,8,12,.9) 100%)",backdropFilter:"blur(6px)"}}>{shell}</div>;
    return <div style={{position:"fixed",inset:0,zIndex:30,display:"flex",alignItems:"center",justifyContent:"center",padding:"28px 20px",background:"radial-gradient(circle at 50% 20%,rgba(241,196,15,.12) 0%,rgba(10,15,22,.82) 38%,rgba(5,8,12,.94) 100%)",backdropFilter:"blur(8px)"}}><VictorySolitaireCanvas winner={winnerPlayer} cards={cascadeCards}/>{shell}</div>;
  };

  return(<CardRenderContext.Provider value={cardRenderStyle}>
    {flights.map(f=><FlightGhost key={f.key} flight={f} onDone={removeFlight}/>)}
    <KonamiCelebrationOverlay
      key={`konami-live-${konamiCelebrationKey}`}
      open={konamiCelebrationOpen}
      cards={konamiCards}
      onReplay={()=>{setKonamiCelebrationKey(v=>v+1);playSfx("victory",{volume:.34});}}
      onClose={()=>setKonamiCelebrationOpen(false)}
    />
    <div className="kp-game-shell" style={{height:"100dvh",color:"#f5f1e8",fontFamily:FONT_BODY,display:"flex",flexDirection:"column",position:"relative",overflow:"hidden"}}>
    <FeltBackdrop/>
    <div className="kp-game-header" style={{padding:headerPad,borderBottom:isSuddenDeath?"3px solid #ff5a4e":"2px solid #00000055",display:"flex",alignItems:"center",gap:headerGap,background:isSuddenDeath?"linear-gradient(180deg,#5c1626f2,#3a0f1af6)":"linear-gradient(180deg,#252a4af2,#1a1d38f6)",fontSize:headerFontSize,flexWrap:"wrap",backdropFilter:"blur(10px)",position:"relative",zIndex:1,boxShadow:"0 6px 0 rgba(0,0,0,.25), 0 12px 30px rgba(0,0,0,.3)"}}>
      <span className="kp-wordmark" style={{fontSize:isMobileLandscape?16:20,letterSpacing:1}}>KAIZEN POKER</span>
      <span style={{color:"#8d89a8",fontWeight:800}}>Round {gs.round}</span>
      <span className="kp-pill" style={{padding:"4px 12px",fontSize:10,color:"#f5b942",animation:gs.phase==="reveal"?"pulseGold 1.8s ease-in-out infinite":"none"}}>
        {gs.phase==="action"
          ?(isSoloMode(gs.mode)?"Action - Solo Player":gs.mode==="tutorial"?(actingPlayer==="A"?"Action - Learner":"Action - Tutorial Opponent"):`Action - Player ${actingPlayer}`)
          :gs.phase==="score"
          ?"Scoring"
          :gs.phase==="reveal"
          ?"Reveal"
          :gs.phase==="tutorialDone"
          ?"Tutorial Complete"
          :"Game Over"}
      </span>
      {isSuddenDeath&&<span style={{color:"#ff5a4e",fontWeight:700,fontSize:10,animation:"pulse 1.5s infinite",letterSpacing:1}}>SUDDEN DEATH</span>}
      <SfxToggle enabled={sfxEnabled} onToggle={()=>setSfxEnabled(v=>!v)}/>
      <button onClick={()=>{playSfx("confirm",{volume:.28});setModal({type:"mainMenu"});}} className="kp-pill" style={{padding:"4px 12px",fontSize:10}}>MENU</button>
      {isMobileLandscape&&<button onClick={()=>setMobileLogOpen(true)} className="kp-pill" style={{padding:"4px 12px",fontSize:10}}>LOG</button>}
      <div style={{marginLeft:"auto",display:"flex",gap:isMobileLandscape?6:10,flexWrap:"wrap"}}>
        <div className="kp-panel-inset" style={{padding:isMobileLandscape?"5px 10px":"6px 12px",display:"flex",alignItems:"center",gap:isMobileLandscape?6:8}}>
          <span style={{color:"#ff5a4e",fontFamily:FONT_DISPLAY,fontSize:13,textShadow:"0 2px 0 rgba(0,0,0,.4)"}}>{isSoloMode(gs.mode)?"YOU":"A"} {gs.aChips}</span>
          <span style={{display:"flex",gap:4}}>{chipStrip("A",gs.aChips,"#ff5a4e")}</span>
        </div>
        <div className="kp-panel-inset" style={{padding:isMobileLandscape?"5px 10px":"6px 12px",display:"flex",alignItems:"center",gap:isMobileLandscape?6:8}}>
          <span style={{color:"#34a3ff",fontFamily:FONT_DISPLAY,fontSize:13,textShadow:"0 2px 0 rgba(0,0,0,.4)"}}>{isSoloMode(gs.mode)?"CHALLENGER":"B"} {gs.bChips}</span>
          <span style={{display:"flex",gap:4}}>{chipStrip("B",gs.bChips,"#34a3ff")}</span>
        </div>
      </div></div>
    <div style={{display:"flex",flex:1,overflow:"hidden",height:0,position:"relative",zIndex:1}}>
      <div className="kp-main-column" style={{flex:1,minWidth:0,minHeight:0,padding:mainPad,display:"flex",flexDirection:"column",gap:mainGap,overflowY:"auto",overflowX:"hidden"}}>
        {toast&&<div key={toast.key} style={{position:"sticky",top:6,zIndex:5,display:"flex",justifyContent:"center",pointerEvents:"none",marginBottom:-2}}>
          <div style={{
            padding:"8px 16px",
            borderRadius:999,
            fontSize:13,
            fontFamily:FONT_DISPLAY,
            letterSpacing:.5,
            textShadow:"0 2px 0 rgba(0,0,0,.35)",
            color:toast.tone==="frozen"?"#d8f0ff":toast.tone==="cancel"?"#e6dfd2":"#fff0cf",
            background:toast.tone==="frozen"
              ?"linear-gradient(180deg,#21455ddf,#143041f2)"
              :toast.tone==="cancel"
              ?"linear-gradient(180deg,#3b3428df,#241f18f2)"
              :"linear-gradient(180deg,#5a341fdf,#392114f2)",
            border:toast.tone==="frozen"
              ?"1px solid #6fb6e066"
              :toast.tone==="cancel"
              ?"1px solid #b49c7a55"
              :"1px solid #f0a35a66",
            boxShadow:"0 4px 0 rgba(0,0,0,.4), 0 12px 28px #00000044, inset 0 1px 0 #ffffff18",
            animation:"toastPop 0.22s cubic-bezier(.26,1.36,.42,1)"
          }}>{toast.msg}</div>
        </div>}
        {isOnlineMode&&<div style={{background:"linear-gradient(180deg,#252a4af0,#1a1d38f4)",border:"2px solid #34a3ff55",borderRadius:12,padding:isMobileLandscape?"7px 10px":"8px 12px",display:"flex",gap:isMobileLandscape?8:10,alignItems:"center",flexWrap:"wrap",boxShadow:"0 4px 0 rgba(0,0,0,.3), inset 0 2px 0 rgba(255,255,255,.06)"}}>
          <span className="kp-section-label" style={{fontSize:10,color:"#8fc5ff"}}>Online Game</span>
          {seatPlayer
            ?<span style={{fontSize:11,color:"#dbeafe"}}>You are Player {seatPlayer}</span>
            :<span style={{fontSize:11,color:"#cbd5e1"}}>Spectating</span>}
          <span style={{fontSize:11,color:"#94a3b8"}}>{onlineStatus}</span>
          {liveGameId&&<span style={{fontSize:10,color:"#64748b"}}>{liveGameId}</span>}
          {shareLink&&seatPlayer==="A"&&<button onClick={()=>navigator.clipboard?.writeText(shareLink)} className="kp-pill" style={{padding:"4px 12px",fontSize:10}}>Copy Invite Link</button>}
          {isOnlineMode&&onlineStatus==="waiting"&&seatPlayer==="A"&&<span style={{fontSize:11,color:"#fcd34d"}}>Waiting for Player B to join</span>}
          {isOnlineMode&&!canControlSeat&&gs.phase==="action"&&<span style={{fontSize:11,color:"#fcd34d"}}>Waiting for Player {actingPlayer}</span>}
          {onlineError&&<span style={{fontSize:11,color:"#fca5a5"}}>{onlineError}</span>}
        </div>}
        {/* Remember */}
        {(()=>{const aq=gs.scrap.filter(id=>CM[id].type==="Remember");if(!aq.length)return null;
          return(<div style={{background:"linear-gradient(180deg,#332658f2,#241c40f6)",border:"2px solid #a86ef0",borderRadius:12,padding:isMobileLandscape?"7px 10px":"8px 12px",display:"flex",flexWrap:"wrap",gap:isMobileLandscape?"6px 10px":"8px 14px",alignItems:"center",boxShadow:"0 4px 0 rgba(0,0,0,.32), 0 0 22px #a86ef02e, inset 0 2px 0 rgba(255,255,255,.08)"}}>
            <span className="kp-section-label" style={{fontSize:11,color:"#dcc4ff",textShadow:"0 2px 0 rgba(0,0,0,.35)"}}>Active Effects</span>
            {aq.map(id=><RememberChip key={id} id={id}/>)}</div>)})()}
        {/* Play areas */}
        {isSoloMode(gs.mode)
          ?<div style={{display:"flex",gap:publicAreaGap,flexWrap:"wrap",minWidth:0}}>
            <div style={{flex:"1 1 320px",minWidth:0,padding:panelPad,borderRadius:sectionRadius,background:"linear-gradient(180deg,#252a4af0,#1a1d38f4)",border:"2px solid #34a3ff55",boxShadow:"0 5px 0 rgba(0,0,0,.3), 0 12px 26px rgba(0,0,0,.28), inset 0 2px 0 rgba(255,255,255,.06)",overflow:"hidden"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:6}}>
                <div className="kp-section-label" style={{color:"#8fc5ff"}}>CHALLENGER DECK</div>
                <button
                  onClick={()=>setModal({type:"soloLookup",activeRank:gs._soloReveal?.cardId?CM[gs._soloReveal.cardId].rank:null})}
                  className="kp-pill"
                  style={{padding:"4px 12px",fontSize:10}}
                >
                  Challenger Lookup
                </button>
              </div>
              <div style={{display:"flex",gap:isMobileLandscape?10:16,alignItems:"center",minHeight:actionAreaMinHeight}}>
                <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:"1 1 auto"}}>
                  <div style={{display:"flex",alignItems:"center",minWidth:gs._soloRevealedCards?.length?110:0}}>
                    {(gs._soloRevealedCards||[]).map((id,i)=>{
                      const isLatest=i===((gs._soloRevealedCards||[]).length-1);
                      return(
                        <div key={`${id}-${i}`} style={{marginLeft:i===0?0:-42,position:"relative",zIndex:i+1}}>
                          <PreviewCard id={id} glow={isLatest?"#34a3ff":undefined}/>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{display:"grid",gap:6,minWidth:0}}>
                    <div style={{fontSize:12,color:"#dbe5ee",fontWeight:700}}>
                      {gs.bDeck.length} card{gs.bDeck.length!==1?"s":""} remain
                      {(gs._soloRevealedCards?.length||0)>0&&<span style={{color:"#89b8ff",fontWeight:600}}> | {(gs._soloRevealedCards||[]).length} revealed</span>}
                    </div>
                    <div style={{fontSize:10,color:"#a8a4c0",lineHeight:1.4,whiteSpace:"normal"}}>
                      {easySoloMode
                        ?(showingRevealedChallengerCard
                          ?"Easy mode is showing the Challenger card that was just revealed for this round."
                          :"Easy mode shows the top Challenger card and the hand it maps to.")
                        :"Sweep over the revealed stack to inspect what the Challenger has shown so far."}
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",gap:4,flexShrink:0,alignItems:"center"}}>
                  {easySoloMode&&challengerDisplayCardId
                    ?<div style={{position:"relative"}}>
                      <PreviewCard id={challengerDisplayCardId} glow="#34a3ff"/>
                      {challengerDisplayLookup&&<div style={{position:"absolute",left:6,right:6,bottom:6,padding:"4px 6px",borderRadius:8,background:"linear-gradient(180deg,#0f2435f0,#09131df4)",border:"1px solid #5ca9ff66",boxShadow:"0 10px 18px #00000033,inset 0 1px 0 #ffffff10",textAlign:"center"}}>
                        <div style={{fontSize:10,color:"#eaf6ff",fontWeight:800,lineHeight:1.2}}>{challengerDisplayLookup.handName}</div>
                      </div>}
                    </div>
                    :Array.from({length:Math.min(4,Math.max(gs.bDeck.length,1))},(_,i)=><CardBack key={i} style={{transform:`translateX(${i*-46}px)`}}/>)
                  }
                </div>
              </div>
            </div>
            <div style={{flex:"1 1 320px",minWidth:0,padding:panelPad,borderRadius:sectionRadius,background:"linear-gradient(180deg,#252a4af0,#1a1d38f4)",border:"2px solid #ff5a4e55",boxShadow:"0 5px 0 rgba(0,0,0,.3), 0 12px 26px rgba(0,0,0,.28), inset 0 2px 0 rgba(255,255,255,.06)",overflow:"hidden"}}>
              <div className="kp-section-label" style={{color:"#ff9a93",marginBottom:6}}>YOUR ACTIONS</div>
              <div style={{display:"flex",gap:4,minHeight:actionAreaMinHeight,flexWrap:"wrap"}}>
                {getP(gs,"A").map((a,i)=>a.faceDown?<FaceDownActionSlot key={i} id={a.id} canPeek copySticker={a.copiedFrom?CM[a.copiedFrom]?.name:undefined}/>
                  :<div key={i} className="kp-action-slot" style={{position:"relative"}}>
                    <PreviewCard id={a.id} copySticker={a.copiedFrom?CM[a.copiedFrom]?.name:undefined}/>
                  </div>)}
              </div>
            </div>
          </div>
          :<div style={{display:"flex",gap:publicAreaGap,flexWrap:"wrap",minWidth:0}}>{[opp(viewerPlayer),viewerPlayer].map(pl=>(<div key={pl} style={{flex:"1 1 320px",minWidth:0,padding:panelPad,borderRadius:sectionRadius,background:"linear-gradient(180deg,#252a4af0,#1a1d38f4)",border:`2px solid ${pl==="A"?"#ff5a4e55":"#34a3ff55"}`,boxShadow:"0 5px 0 rgba(0,0,0,.3), 0 12px 26px rgba(0,0,0,.28), inset 0 2px 0 rgba(255,255,255,.06)",overflow:"hidden"}}>
            <div className="kp-section-label" style={{color:pl==="A"?"#ff9a93":"#8fc5ff",marginBottom:6}}>{pl}'s ACTIONS</div>
            <div style={{display:"flex",gap:4,minHeight:actionAreaMinHeight,flexWrap:"wrap"}}>
              {getP(gs,pl).map((a,i)=>a.faceDown?<FaceDownActionSlot key={i} id={a.id} canPeek={pl===viewerPlayer} copySticker={a.copiedFrom?CM[a.copiedFrom]?.name:undefined}/>
                :<div key={i} className="kp-action-slot" style={{position:"relative"}}>
                  <PreviewCard id={a.id} copySticker={a.copiedFrom?CM[a.copiedFrom]?.name:undefined}/>
                </div>)}</div></div>))}</div>}
        <PublicZones gs={gs} extraControls={<><DeckStats gs={gs} player="A" viewerPlayer={viewerPlayer}/><DeckStats gs={gs} player="B" viewerPlayer={viewerPlayer}/></>} onToggleZone={handleTutorialZoneToggle} canToggleZone={tutorialCanToggleZone} spotlightZone={tutorialZoneTarget}/>
        {actionSummaryRows.length>0&&<div style={{padding:isMobileLandscape?"8px 10px":"10px 12px",borderRadius:12,background:"linear-gradient(180deg,#252a4af0,#1a1d38f4)",border:"2px solid #3d4470",boxShadow:"0 4px 0 rgba(0,0,0,.3), inset 0 2px 0 rgba(255,255,255,.06)",display:"grid",gap:6}}>
          <div className="kp-section-label" style={{fontSize:10,color:"#f5b942"}}>Action Summary</div>
          {actionSummaryRows.map(row=><div key={row.pl} style={{fontSize:11,lineHeight:1.45,color:"#cbd5e1"}}>
            <span style={{color:row.pl==="A"?"#ff9a9a":"#8fc5ff",fontWeight:800}}>{row.label}:</span>{" "}
            <span>{row.text}</span>
          </div>)}
        </div>}
        {/* Hand */}
        <div className="kp-hand-panel" style={{padding:handPad,borderRadius:isMobileLandscape?14:16,background:"linear-gradient(180deg,#252a4af0,#1a1d38f4)",border:`2px solid ${viewerPlayer==="A"?"#ff5a4e88":"#34a3ff88"}`,boxShadow:"0 5px 0 rgba(0,0,0,.3), 0 14px 30px rgba(0,0,0,.3), inset 0 2px 0 rgba(255,255,255,.06)"}}>
          <div className="kp-section-label" style={{fontSize:12,color:viewerPlayer==="A"?"#ff9a93":"#8fc5ff",marginBottom:8,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            YOUR HAND (Player {viewerPlayer})
            {canAct&&<span style={{color:pClr,fontSize:10}}>- {actionsLeft} action{actionsLeft!==1?"s":""} left</span>}
            {canAct&&!fdMode&&<Btn label="Play Face-Down v" bg="#555" onClick={()=>setFdMode(true)} disabled={!tutorialAllows("faceDownToggle")}/>}
            {canAct&&fdMode&&<><span style={{color:"#aaa",fontSize:10}}>Pick a card</span><Btn label="Cancel" bg="#333" onClick={()=>setFdMode(false)}/></>}
            {canAct&&undoState&&!isOnlineMode&&<Btn label="<- Undo" bg="#ff9d2e" onClick={doUndo}/>}
            {gs.phase==="score"&&<HandBadge ids={hand} mods={getAppliedMods(gs,viewerPlayer)}/>}</div>
          <div style={isMobileLandscape?{overflowX:"auto",overflowY:"hidden",paddingBottom:4}:{}}>
            <div style={{display:"flex",gap:handGap,flexWrap:isMobileLandscape?"nowrap":"wrap",alignItems:"flex-start",minWidth:isMobileLandscape?"max-content":"0"}}>
              {sortC(hand).map(id=>{
                const tutorialActionKind=fdMode?"playFaceDownCard":"playCard";
                const tutorialEnabled=tutorialAllows(tutorialActionKind,id);
                return(<Card key={id} id={id} small={handCardSmall} onClick={canAct&&tutorialEnabled?()=>handlePlayCard(id):undefined}
                  glow={canAct&&tutorialEnabled?(fdMode?"#888":"#58c6ff"):canAct?(fdMode?"#555":pClr):undefined} isNew={gs.newCards.includes(id)}/>);
              })}
            </div>
          </div></div>
        {gs.phase==="score"&&<Btn label="REVEAL & SCORE" bg="linear-gradient(135deg,#f5b942,#ff9d2e)" onClick={doScore} disabled={!canUseOnlineControls||!tutorialAllows("reveal")}/>}
        {/* REVEAL / GAME END SHOWDOWN */}
        {gs.phase==="gameOver"&&!gs._revealAE&&<div style={{textAlign:"center",padding:20,position:"relative"}}>
          <VictorySolitaireCanvas winner={getMatchWinner(gs)} cards={getMatchWinner(gs)==="A"?getH(gs,"A"):(isSoloMode(gs.mode)&&gs._soloReveal?.cardId?[gs._soloReveal.cardId]:getH(gs,"B"))}/>
          <div style={{fontSize:24,fontWeight:900,color:"#f5b942",fontFamily:FONT_DISPLAY,position:"relative",zIndex:32}}>{isSoloMode(gs.mode)?(getMatchWinner(gs)==="A"?"You win the solo run!":"The Challenger wins the solo run!"):`Game Over - Player ${getMatchWinner(gs)} Wins!`}</div>
          <div style={{position:"relative",zIndex:32}}><Btn label="New Game" bg="#333" onClick={()=>clearGameState()}/></div></div>}
        {gs.mode!=="tutorial"&&playtestEnabled&&<div style={{marginTop:"auto",position:"sticky",bottom:0,zIndex:1,paddingTop:8,background:"linear-gradient(180deg,transparent,#09121af2 26%)"}}>
          <PlaytestPanel
            gs={gs}
            onReplaceGameState={replaceSandboxState}
            makeFreshGame={buildFreshGame}
            cards={CARDS}
            onOpenGallery={startGallery}
            onOpenSoloArt={()=>startGame("solo_art")}
            analyticsSyncState={analyticsSyncState}
          />
        </div>}
      </div>
      {/* Log */}
      {!isMobileLandscape&&<div style={{width:260,minHeight:0,height:"100%",overflow:"hidden",borderLeft:"2px solid #00000066",background:"linear-gradient(180deg,#16182ef2,#101226f6)",display:"flex",flexDirection:"column",flexShrink:0,boxShadow:"inset 2px 0 0 rgba(255,255,255,.04)"}}>
        <div className="kp-section-label" style={{fontSize:10,color:"#f5b942",padding:"12px 12px 6px",position:"sticky",top:0,zIndex:1,background:"linear-gradient(180deg,#16182e 0%,#16182ef2 78%,#16182e00 100%)"}}>GAME LOG</div>
        <div ref={logRef} className="kp-log-scroll" style={{flex:1,minHeight:0,overflowY:"auto",overflowX:"hidden",padding:"0 12px 12px",fontSize:10,color:"#a8a4c0",lineHeight:1.6}}>
        {visibleLog.map((m,i)=>(<div key={i} style={{color:m.startsWith("===")?"#f5b942":m.startsWith("WINNER:")?"#3bbf7c":m.includes("wins")?"#ff9d2e":m.includes("Fizzle")||m.includes("Frozen")?"#ff5a4e":"#8d89a8",fontWeight:m.startsWith("===")?700:400}}>{m}</div>))}</div></div>}
    </div>
    {isMobileLandscape&&mobileLogOpen&&<div style={{position:"fixed",inset:0,zIndex:24,display:"flex",justifyContent:"flex-end",background:"rgba(3,7,12,.56)",backdropFilter:"blur(4px)"}} onClick={()=>setMobileLogOpen(false)}>
      <div style={{width:"min(86vw,360px)",height:"100%",overflow:"hidden",borderLeft:"2px solid #00000066",background:"linear-gradient(180deg,#16182e,#101226)",display:"flex",flexDirection:"column",boxShadow:"-24px 0 60px #00000055"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"10px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,borderBottom:"2px solid #00000044",background:"linear-gradient(180deg,#252a4a,#1a1d38)"}}>
          <div className="kp-section-label" style={{fontSize:10,color:"#f5b942"}}>Game Log</div>
          <button onClick={()=>setMobileLogOpen(false)} className="kp-pill" style={{padding:"4px 12px",fontSize:10}}>Close</button>
        </div>
        <div ref={logRef} className="kp-log-scroll" style={{flex:1,minHeight:0,overflowY:"auto",overflowX:"hidden",padding:"10px 12px 14px",fontSize:10,color:"#a8a4c0",lineHeight:1.6}}>
          {visibleLog.map((m,i)=>(<div key={i} style={{color:m.startsWith("===")?"#f5b942":m.startsWith("WINNER:")?"#3bbf7c":m.includes("wins")?"#ff9d2e":m.includes("Fizzle")||m.includes("Frozen")?"#ff5a4e":"#8d89a8",fontWeight:m.startsWith("===")?700:400}}>{m}</div>))}
        </div>
      </div>
    </div>}
    {gs.phase==="reveal"&&renderShowdown(isMatchOver(gs))}
    {gs.phase==="gameOver"&&gs._revealAE&&renderShowdown(true)}
    {/* MODALS */}
    {modal?.type==="refreshOpts"&&<Modal title="Face-Down Options">
      <p style={{color:"#aaa",fontSize:12,marginBottom:10}}>Choose:</p>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center"}}>
        {modal.opts.map(o=>(<Btn key={o.key} label={o.label} bg={o.key==="skip"?"#333":o.key==="refresh"?"#34a3ff":o.key==="sift"?"#3bbf7c":"#a86ef0"} onClick={()=>modal.onChoice(o.key)} disabled={!tutorialAllows("refreshChoice",o.key)}/>))}</div></Modal>}
    {modal?.type==="pickDiscard"&&<Modal title={modal.title||"Discard a card"}>
      {modal.hint&&<div style={{fontSize:11,color:"#b4b0c8",marginBottom:8,lineHeight:1.35}}>{modal.hint}</div>}
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {(modal.hand||getH(gs,gs.currentPlayer)).map(id=>{const v=!modal.filter||modal.filter(id);
          return <PreviewCard key={id} id={id} dimmed={!v||!tutorialAllows("modalCard",id)} onClick={v&&tutorialAllows("modalCard",id)?()=>modal.onPick(id):undefined} glow={v&&tutorialAllows("modalCard",id)?"#ff5a4e":undefined} isNew={(modal.newCards||gs.newCards||[]).includes(id)}/>;})}</div></Modal>}
    {modal?.type==="pickFromList"&&<Modal title={modal.title}>
      {modal.hint&&<div style={{fontSize:11,color:"#b4b0c8",marginBottom:8,lineHeight:1.35}}>{modal.hint}</div>}
      {modal.showHand&&<div style={{marginBottom:8}}>
        <div style={{fontSize:9,color:"#8d89a8",fontWeight:700,letterSpacing:1,marginBottom:3}}>YOUR SCORING HAND</div>
        <div style={{display:"flex",gap:4,marginBottom:6}}>{sortC(modal.showHand).map(id=><PreviewCard key={id} id={id}/>)}</div></div>}
      {modal.statsPlayer&&<div style={{marginBottom:8,display:"flex",justifyContent:"flex-start"}}><DeckStats gs={gs} player={modal.statsPlayer} viewerPlayer={viewerPlayer}/></div>}
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
        {modal.cards.map(id=>{const v=!modal.filter||modal.filter(id);
          return <PreviewCard key={id} id={id} dimmed={!v||!tutorialAllows("modalCard",id)} onClick={v&&tutorialAllows("modalCard",id)?()=>modal.onPick(id):undefined} glow={v&&tutorialAllows("modalCard",id)?"#f5b942":undefined}/>;})}</div>
      {modal.canCancel&&<Btn label={modal.cancelLabel||"Cancel"} bg="#333" onClick={modal.onCancel} disabled={gs.mode==="tutorial"&&tutorialPrompt?.expect?.kind==="modalCard"}/>}</Modal>}
    {modal?.type==="soloLookup"&&<Modal title="Challenger Lookup">
      <div style={{display:"grid",gap:6}}>
        <div style={{display:"grid",gridTemplateColumns:"70px 160px 1fr",gap:8,alignItems:"center",padding:"0 8px",fontSize:10,fontWeight:800,color:"#d8c08d",letterSpacing:1.2,textTransform:"uppercase"}}>
          <div>Rank</div>
          <div>Maps To</div>
          <div>Definition</div>
        </div>
        {CHALLENGER_ROWS.map(row=>{
          const active=modal.activeRank===row.rank;
          return(
            <div key={row.rank} style={{display:"grid",gridTemplateColumns:"70px 160px 1fr",gap:8,alignItems:"center",padding:"6px 8px",borderRadius:10,background:active?"#34a3ff1f":"#12142acc",border:active?"2px solid #34a3ff88":"2px solid #2c3152"}}>
              <div style={{fontSize:12,fontWeight:900,color:active?"#8fd0ff":"#dfe8ef"}}>{row.rank} {"->"}</div>
              <div style={{fontSize:12,fontWeight:700,color:active?"#f5fbff":"#c8d6e2"}}>{row.handName}</div>
              <div style={{fontSize:11,color:active?"#dceaf6":"#92a4b5",lineHeight:1.35}}>{row.description}</div>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",justifyContent:"center",marginTop:12}}>
        <Btn label="Close" bg="#333" onClick={()=>setModal(null)}/>
      </div>
    </Modal>}
    {modal?.type==="mainMenu"&&<Modal title="Menu">
      <div style={{display:"grid",gap:14,minWidth:"min(360px,82vw)"}}>
        <div style={{fontSize:13,color:"#cbd5e1",lineHeight:1.5}}>
          Leave this game and return to the home screen, or close this menu and keep playing.
        </div>
        {isOnlineMode&&<div style={{fontSize:11,color:"#fcd34d",lineHeight:1.5}}>
          Leaving an online game stops syncing on this browser. You can rejoin later from the same invite link.
        </div>}
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap"}}>
          <Btn label="Return to Game" bg="#333" onClick={()=>setModal(null)}/>
          <Btn label="Quit to Home" bg="#ff9d2e" onClick={()=>{setModal(null);clearGameState();}}/>
        </div>
      </div>
    </Modal>}
    {modal?.type==="pickMulti"&&<MultiPickModal title={modal.title} cards={modal.cards} maxPick={modal.maxPick} onPick={modal.onPick} statsPlayer={modal.statsPlayer} gs={gs} viewerPlayer={viewerPlayer} hint={modal.hint}/>}
    {modal?.type==="twoChoice"&&<Modal title={modal.title}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:12}}><Card id={modal.card}/></div>
      <div style={{display:"flex",gap:8,justifyContent:"center"}}><Btn label={modal.opt1} bg="#34a3ff" onClick={modal.on1}/><Btn label={modal.opt2} bg="#ff9d2e" onClick={modal.on2}/></div></Modal>}
    {modal?.type==="twoOptChoice"&&<Modal title={modal.title}>
      <div style={{display:"flex",gap:8,justifyContent:"center"}}><Btn label={modal.opt1} bg="#34a3ff" onClick={modal.on1}/><Btn label={modal.opt2} bg="#ff5a4e" onClick={modal.on2}/></div></Modal>}
    {modal?.type==="brainstorm"&&<BrainstormModal hand={modal.hand} newCards={modal.newCards} onPick={modal.onPick}/>}
    {modal?.type==="rejuvenate"&&<RejuvenateModal hand={modal.hand} onPick={modal.onPick}/>}
    {modal?.type==="confirm"&&<Modal title={modal.title}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:10}}><Card id={modal.card}/></div>
      <p style={{color:"#aaa",fontSize:12,marginBottom:10,textAlign:"center"}}>{modal.msg}</p>
      <div style={{display:"flex",gap:8,justifyContent:"center"}}><Btn label="Play It" bg="#3bbf7c" onClick={modal.onYes}/><Btn label="Cancel" bg="#333" onClick={modal.onNo}/></div></Modal>}
    {modal?.type==="pickRank"&&<Modal title={modal.title}>
      {modal.showHand&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:"#8d89a8",fontWeight:700,letterSpacing:1,marginBottom:3}}>YOUR SCORING HAND</div>
        <div style={{display:"flex",gap:4,marginBottom:4}}>{sortC(modal.showHand).map(id=><PreviewCard key={id} id={id}/>)}</div></div>}
      <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center"}}>
        {modal.ranks.map(r=>(<button key={r} onClick={()=>modal.onPick(r)} disabled={!tutorialAllows("modalRank",r)} style={{width:44,height:44,borderRadius:9,background:"#12142a",border:"2px solid #f5b94266",color:tutorialAllows("modalRank",r)?"#f5b942":"#6b7280",fontSize:18,cursor:tutorialAllows("modalRank",r)?"pointer":"default",fontFamily:FONT_DISPLAY,display:"flex",alignItems:"center",justifyContent:"center",opacity:tutorialAllows("modalRank",r)?1:0.45,boxShadow:"0 3px 0 rgba(0,0,0,.4)"}}>{r}</button>))}</div>
      {modal.onCancel&&<div style={{display:"flex",justifyContent:"center",marginTop:10}}><Btn label={modal.cancelLabel||"Cancel"} bg="#333" onClick={modal.onCancel} disabled={gs.mode==="tutorial"&&tutorialPrompt?.expect?.kind==="modalRank"}/></div>}</Modal>}
    {modal?.type==="pickSuit"&&<Modal title={modal.title}>
      {modal.showHand&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:"#8d89a8",fontWeight:700,letterSpacing:1,marginBottom:3}}>YOUR SCORING HAND</div>
        <div style={{display:"flex",gap:4,marginBottom:4}}>{sortC(modal.showHand).map(id=><PreviewCard key={id} id={id}/>)}</div></div>}
      <div style={{display:"flex",gap:12,justifyContent:"center"}}>
        {SO.map(s=>(<button key={s} onClick={()=>modal.onPick(s)} disabled={!tutorialAllows("modalSuit",s)} style={{width:56,height:56,borderRadius:10,background:"#12142a",border:`2px solid ${SC[s]}88`,color:tutorialAllows("modalSuit",s)?SC[s]:"#6b7280",fontSize:28,cursor:tutorialAllows("modalSuit",s)?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",opacity:tutorialAllows("modalSuit",s)?1:0.45,boxShadow:"0 3px 0 rgba(0,0,0,.4)"}}>{SUITS[s]}</button>))}</div>
      {modal.onCancel&&<div style={{display:"flex",justifyContent:"center",marginTop:10}}><Btn label={modal.cancelLabel||"Cancel"} bg="#333" onClick={modal.onCancel} disabled={gs.mode==="tutorial"&&tutorialPrompt?.expect?.kind==="modalSuit"}/></div>}</Modal>}
    {modal?.type==="queen2"&&<Modal title={`${modal.pl}: Modify ${CM[modal.cardId].name}${modal.queenSourceLabel?` (${modal.queenSourceLabel})`:""}`}>
      {modal.showHand&&<div style={{marginBottom:8}}><div style={{fontSize:9,color:"#8d89a8",fontWeight:700,letterSpacing:1,marginBottom:3}}>YOUR SCORING HAND</div>
        <div style={{display:"flex",gap:4,marginBottom:4}}>{sortC(modal.showHand).map(id=><PreviewCard key={id} id={id}/>)}</div></div>}
      <div style={{display:"flex",justifyContent:"center",marginBottom:10}}><Card id={modal.cardId}/></div>
      <p style={{color:"#d8c08d",fontSize:11,textAlign:"center",marginBottom:6}}>Remember: {modal.queenSourceLabel||"Remember effects"}</p>
      <p style={{color:"#aaa",fontSize:11,textAlign:"center",marginBottom:10}}>Unmodified 2 - Queen effects available:</p>
      <div style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap"}}>
        {modal.misc&&modal.camo&&<Btn label="Rank + Suit" bg="#a86ef0" onClick={modal.onBoth} disabled={!tutorialAllows("queenChoice","both")}/>}
        {modal.misc&&<Btn label="Rank Only" bg="#ff9d2e" onClick={modal.onRank} disabled={!tutorialAllows("queenChoice","rank")}/>}
        {modal.camo&&<Btn label="Suit Only" bg="#34a3ff" onClick={modal.onSuit} disabled={!tutorialAllows("queenChoice","suit")}/>}
        <Btn label="Skip" bg="#333" onClick={modal.onSkip} disabled={gs.mode==="tutorial"&&tutorialPrompt?.expect?.kind==="queenChoice"}/></div></Modal>}
    {modal?.type==="alert"&&<Modal title="Notice"><p style={{color:"#aaa",fontSize:13}}>{modal.msg}</p><Btn label="OK" bg="#333" onClick={modal.onOk}/></Modal>}
    {soloIntroVisible&&isSoloMode(gs.mode)&&<Chippy
      title={CHIPPY_COPY.soloIntro.title}
      message={soloIntroMessage}
      visible
      actionButtons={[
        {label:"Easy",onClick:()=>setSoloDifficulty(SOLO_DIFFICULTIES.easy),background:"#3bbf7c"},
        {label:"Difficult",onClick:()=>setSoloDifficulty(SOLO_DIFFICULTIES.difficult)}
      ]}
    />}
    {gs.mode==="tutorial"&&tutorialPrompt&&<Chippy title={tutorialPrompt.title} message={tutorialPrompt.message} tag={tutorialTag} visible actionLabel={tutorialPrompt.expect?.kind==="ack"?"OK":""} onAction={tutorialPrompt.expect?.kind==="ack"?()=>acknowledgeTutorial(tutorialPrompt.expect.value||"opp-turn"):null} />}
  </div></CardRenderContext.Provider>);
}

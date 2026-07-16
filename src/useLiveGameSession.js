import { useEffect, useRef, useState } from "react";
import { fetchLiveGame, updateLiveGame } from "./liveGameClient.js";

const idleSession=()=>({active:false,gameId:null,seat:null,token:null,version:1,pendingWrites:0,writeChain:Promise.resolve()});

export function useLiveGameSession({gameTransport,onTrackedState}){
  const sessionRef=useRef(idleSession());
  const pollRef=useRef(null);
  const[onlineError,setOnlineError]=useState("");
  const[onlineStatus,setOnlineStatus]=useState("offline");
  const[liveSeat,setLiveSeat]=useState(null);
  const[liveGameId,setLiveGameId]=useState(null);

  const stopPolling=()=>{
    if(pollRef.current)clearInterval(pollRef.current);
    pollRef.current=null;
  };
  const reset=()=>{
    stopPolling();
    sessionRef.current=idleSession();
    setOnlineError("");
    setOnlineStatus("offline");
    setLiveSeat(null);
    setLiveGameId(null);
  };
  const activate=(row,{seat=null,token=null}={})=>{
    sessionRef.current={active:true,gameId:row.id,seat,token,version:row.version||1,pendingWrites:0,writeChain:Promise.resolve()};
    setLiveGameId(row.id);
    setLiveSeat(seat);
    setOnlineStatus(row.status||"active");
    setOnlineError("");
  };
  const startPolling=(gameId,{authority=false}={})=>{
    stopPolling();
    pollRef.current=setInterval(async()=>{
      try{
        const row=await fetchLiveGame(gameId);
        if(!row?.state)return;
        const rowVersion=row.version||1;
        const localVersion=sessionRef.current.version||1;
        if((sessionRef.current.pendingWrites||0)>0&&rowVersion<localVersion)return;
        if(rowVersion!==localVersion){
          sessionRef.current.version=rowVersion;
          gameTransport.commit(row.state);
          if(row.tracked&&authority)onTrackedState(row.tracked);
          setOnlineError("");
        }
        setOnlineStatus(row.status||"active");
      }catch(err){console.error("Live poll failed",err);}
    },1200);
  };
  const queueUpdate=(nextState,{tracked=null,authority=false}={})=>{
    const session=sessionRef.current;
    if(!session.active||!session.gameId||!session.seat)return;
    const status=nextState.phase==="gameOver"?"finished":"active";
    const expectedVersion=session.version||1;
    session.version=expectedVersion+1;
    session.pendingWrites=(session.pendingWrites||0)+1;
    setOnlineStatus(status==="finished"?"finished":"syncing");
    session.writeChain=(session.writeChain||Promise.resolve())
      .then(()=>updateLiveGame({gameId:session.gameId,state:nextState,tracked,expectedVersion,seat:session.seat,token:session.token,status}))
      .then(row=>{
        session.pendingWrites=Math.max(0,(session.pendingWrites||1)-1);
        if(!row)return;
        session.version=Math.max(session.version||1,row.version||1);
        if(session.pendingWrites===0)setOnlineStatus(row.status||"active");
      })
      .catch(async err=>{
        session.pendingWrites=0;
        console.error("Live game update failed",err);
        setOnlineError(err.message||"Live update failed.");
        try{
          const fresh=await fetchLiveGame(session.gameId);
          if(fresh?.state){
            session.version=fresh.version||session.version;
            gameTransport.commit(fresh.state);
            if(fresh.tracked&&authority)onTrackedState(fresh.tracked);
            setOnlineStatus(fresh.status||"active");
          }
        }catch(innerErr){console.error("Live game resync failed",innerErr);}
      });
  };

  useEffect(()=>()=>stopPolling(),[]);
  return {sessionRef,onlineError,setOnlineError,onlineStatus,setOnlineStatus,liveSeat,liveGameId,reset,activate,startPolling,queueUpdate};
}

const zoneKey=(player,zone)=>`${player.toLowerCase()}${zone[0].toUpperCase()}${zone.slice(1)}`;
const opponent=player=>player==="A"?"B":"A";

function getPlayerZone(gs,player,zone){
  return gs[zoneKey(player,zone)]||[];
}

function setPlayerZone(gs,player,zone,value){
  return {...gs,[zoneKey(player,zone)]:value};
}

function requireCardIn(cards,cardId,zone){
  if(!cards.some(entry=>(entry?.id||entry)===cardId))throw new Error(`${cardId} is not in ${zone}.`);
}

function reduceGameCommand(gs,command){
  if(!gs||!command?.type)throw new Error("A game state and command type are required.");
  let state={...gs};
  const events=[];
  const emit=(type,payload={})=>events.push({type,payload});
  const player=command.player||state.currentPlayer;

  switch(command.type){
    case "PLAY_CARD":{
      const hand=[...getPlayerZone(state,player,"hand")];
      requireCardIn(hand,command.cardId,`${player} hand`);
      state=setPlayerZone(state,player,"hand",hand.filter(id=>id!==command.cardId));
      state=setPlayerZone(state,player,"play",[
        ...getPlayerZone(state,player,"play"),
        {id:command.cardId,faceDown:!!command.faceDown,...(command.copiedFrom?{copiedFrom:command.copiedFrom}:{})},
      ]);
      emit("card_played",{player,cardId:command.cardId,faceDown:!!command.faceDown});
      break;
    }
    case "DISCARD_FROM_HAND":{
      const hand=[...getPlayerZone(state,player,"hand")];
      requireCardIn(hand,command.cardId,`${player} hand`);
      state=setPlayerZone(state,player,"hand",hand.filter(id=>id!==command.cardId));
      state=setPlayerZone(state,player,"discard",[...getPlayerZone(state,player,"discard"),command.cardId]);
      emit("card_discarded",{player,cardId:command.cardId,source:"hand"});
      break;
    }
    case "SCRAP_FROM_DISCARD":{
      const discard=[...getPlayerZone(state,player,"discard")];
      requireCardIn(discard,command.cardId,`${player} discard`);
      state=setPlayerZone(state,player,"discard",discard.filter(id=>id!==command.cardId));
      state={...state,scrap:[...(state.scrap||[]),command.cardId]};
      emit("card_scrapped",{player,cardId:command.cardId,source:"discard"});
      break;
    }
    case "MOVE_TOP_TO_BOTTOM":{
      const deck=[...getPlayerZone(state,player,"deck")];
      if(!deck.length)throw new Error(`${player} deck is empty.`);
      const cardId=deck.shift();deck.push(cardId);
      state=setPlayerZone(state,player,"deck",deck);
      emit("deck_reordered",{player,cardId,from:"top",to:"bottom"});
      break;
    }
    case "MILL":{
      const deck=[...getPlayerZone(state,player,"deck")];
      const discard=[...getPlayerZone(state,player,"discard")];
      const cards=deck.splice(0,Math.max(0,command.count||0));
      discard.push(...cards);
      state=setPlayerZone(state,player,"deck",deck);
      state=setPlayerZone(state,player,"discard",discard);
      emit("cards_milled",{player,cards});
      break;
    }
    case "ADVANCE_ACTION":{
      if((state.bonusActions||0)>0){
        state={...state,bonusActions:state.bonusActions-1};
        emit("bonus_action_available",{player:state.currentPlayer});
        break;
      }
      state={...state,regularActionsPlayed:(state.regularActionsPlayed||0)+1};
      if(state.regularActionsPlayed<state.actionsRequired)break;
      if(command.solo){
        state={...state,phase:"score"};
        emit("phase_changed",{phase:"score"});
        break;
      }
      if(state.currentPlayer===state.firstPlayer){
        const nextPlayer=opponent(state.firstPlayer);
        state={
          ...state,
          currentPlayer:nextPlayer,
          regularActionsPlayed:0,
          actionsRequired:nextPlayer==="A"?state._aReq:state._bReq,
        };
        emit("turn_changed",{player:nextPlayer});
      }else{
        state={...state,phase:"score"};
        emit("phase_changed",{phase:"score"});
      }
      break;
    }
    default:
      throw new Error(`Unknown game command: ${command.type}`);
  }
  return {state,events};
}

export { getPlayerZone, opponent, reduceGameCommand, setPlayerZone, zoneKey };

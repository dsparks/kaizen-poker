import assert from "node:assert/strict";
import { CARDS } from "../src/gameData.js";
import { compareHands, drawCards, evalHand, initGame } from "../src/engine.js";
import { GAME_STATE_VERSION, migrateGameState, validateGameState } from "../src/gameState.js";
import { reduceGameCommand } from "../src/rulesEngine.js";
import { hashSeed, randomIndexFromState, shuffleFromState } from "../src/rng.js";

const ids=CARDS.map(card=>card.id);
const completeState=()=>migrateGameState({
  mode:"hotseat",phase:"action",round:1,firstPlayer:"A",currentPlayer:"A",
  actionsRequired:2,regularActionsPlayed:0,bonusActions:0,_aReq:2,_bReq:2,
  aDeck:ids.slice(7,26),bDeck:ids.slice(33),aHand:ids.slice(0,7),bHand:ids.slice(26,33),
  aDiscard:[],bDiscard:[],aPlay:[],bPlay:[],scrap:[],log:[],
});

{
  const migrated=migrateGameState({...completeState(),_stateVersion:undefined,_aMemory:undefined,_bMemory:undefined});
  assert.equal(migrated._stateVersion,GAME_STATE_VERSION);
  assert.equal(Object.keys(migrated._aMemory).length,7);
  assert.deepEqual(validateGameState(migrated),[]);
}

{
  const broken=completeState();
  broken.bDeck=[...broken.bDeck,broken.aHand[0]];
  assert.ok(validateGameState(broken).some(error=>error.includes("appears in both")));
}

{
  let gs=completeState();
  const cardId=gs.aHand[0];
  gs=reduceGameCommand(gs,{type:"PLAY_CARD",player:"A",cardId,faceDown:true}).state;
  assert.ok(!gs.aHand.includes(cardId));
  assert.deepEqual(gs.aPlay.at(-1),{id:cardId,faceDown:true});
  gs=reduceGameCommand(gs,{type:"ADVANCE_ACTION",solo:false}).state;
  assert.equal(gs.regularActionsPlayed,1);
  gs=reduceGameCommand(gs,{type:"ADVANCE_ACTION",solo:false}).state;
  assert.equal(gs.currentPlayer,"B");
  assert.equal(gs.regularActionsPlayed,0);
}

{
  let gs=completeState();
  const cardId=gs.aHand[0];
  gs=reduceGameCommand(gs,{type:"DISCARD_FROM_HAND",player:"A",cardId}).state;
  gs=reduceGameCommand(gs,{type:"SCRAP_FROM_DISCARD",player:"A",cardId}).state;
  assert.ok(gs.scrap.includes(cardId));
  assert.ok(!gs.aHand.includes(cardId)&&!gs.aDiscard.includes(cardId));
}

{
  const seed=hashSeed("repeatable");
  const first=shuffleFromState({_rngState:seed},ids);
  const second=shuffleFromState({_rngState:seed},ids);
  assert.deepEqual(first.cards,second.cards);
  assert.equal(first.state._rngState,second.state._rngState);
  const pickA=randomIndexFromState({_rngState:seed},17);
  const pickB=randomIndexFromState({_rngState:seed},17);
  assert.equal(pickA.index,pickB.index);
}

{
  const first=initGame("hotseat",{seed:"fixed-deal"});
  const second=initGame("hotseat",{seed:"fixed-deal"});
  assert.deepEqual(first.aHand,second.aHand);
  assert.deepEqual(first.aDeck,second.aDeck);
  assert.equal(first._stateVersion,GAME_STATE_VERSION);
  assert.deepEqual(validateGameState(first),[]);
}

{
  assert.equal(evalHand(["10H","JH","QH","KH","AH"]).handName,"Royal Flush");
  assert.equal(evalHand(["AC","2D","3H","4S","5C"]).handName,"Straight");
  assert.equal(compareHands(["9C","9D","9H","2S","2C"],["8C","8D","8H","AS","AC"]),"A");
}

{
  let gs=completeState();
  gs.aDeck=[];gs.aDiscard=[];gs.aHand=[];
  const result=drawCards(gs,"A",1);
  assert.equal(result.error,"DECK_EXHAUSTED");
  assert.equal(result.drawn,undefined);
}

console.log("engine tests passed");

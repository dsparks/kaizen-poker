const UINT32_MAX=0x100000000;

function hashSeed(value){
  const text=String(value||"kaizen-poker");
  let hash=2166136261;
  for(let i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return hash>>>0||0x9e3779b9;
}

function nextSeed(seed){
  let x=(seed>>>0)||0x9e3779b9;
  x^=x<<13;x^=x>>>17;x^=x<<5;
  return x>>>0;
}

function randomFromState(gs){
  const seed=nextSeed(gs?._rngState||hashSeed(gs?._gameId));
  return {state:{...gs,_rngState:seed},value:seed/UINT32_MAX};
}

function randomIndexFromState(gs,length){
  if(!Number.isInteger(length)||length<=0)return {state:gs,index:-1};
  const {state,value}=randomFromState(gs);
  return {state,index:Math.floor(value*length)};
}

function shuffleFromState(gs,values){
  let state=gs;
  const cards=[...(values||[])];
  for(let i=cards.length-1;i>0;i--){
    const result=randomIndexFromState(state,i+1);
    state=result.state;
    [cards[i],cards[result.index]]=[cards[result.index],cards[i]];
  }
  return {state,cards};
}

export { hashSeed, nextSeed, randomFromState, randomIndexFromState, shuffleFromState };

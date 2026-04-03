import { adjacentRanks, compareHands, evalHand, lowerRanks } from "./KaizenPoker.jsx";

const TESTS=[
  {
    name:"Higher straight wins",
    run:()=>compareHands(["4C","5D","6H","7S","8C"],["3C","4D","5H","6S","7C"])==="A",
    detail:"8-high straight should beat 7-high straight."
  },
  {
    name:"Wheel straight is low",
    run:()=>compareHands(["AC","2D","3H","4S","5C"],["2C","3D","4H","5S","6C"])==="B",
    detail:"A-2-3-4-5 should lose to 2-3-4-5-6."
  },
  {
    name:"Nerf allows 2 to become Ace",
    run:()=>JSON.stringify(lowerRanks("2"))===JSON.stringify(["A"]),
    detail:"2 should be able to move down to Ace."
  },
  {
    name:"Nudge treats Ace and 2 as adjacent",
    run:()=>JSON.stringify(adjacentRanks("2"))===JSON.stringify(["A","3"])&&JSON.stringify(adjacentRanks("A"))===JSON.stringify(["K","2"]),
    detail:"Ace should be adjacent to 2 for low-Ace movement."
  },
  {
    name:"Straight tiebreak uses high card only",
    run:()=>evalHand(["4C","5D","6H","7S","8C"]).rankVals[0]===6&&evalHand(["AC","2D","3H","4S","5C"]).rankVals[0]===3,
    detail:"Straight rank vectors should reflect the straight high card."
  },
  {
    name:"Full house compares trips before pair",
    run:()=>compareHands(["8C","8D","8H","4S","4C"],["7C","7D","7H","AC","AS"])==="A",
    detail:"8s full should beat 7s full regardless of pair rank."
  }
];

export function runSelfTests(){
  const results=TESTS.map(test=>{
    try{
      const pass=!!test.run();
      return{...test,pass};
    }catch(err){
      return{...test,pass:false,detail:`${test.detail} Error: ${err?.message||err}`};
    }
  });
  return{
    results,
    passed:results.filter(r=>r.pass).length,
    total:results.length
  };
}


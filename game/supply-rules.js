'use strict';

// One entry per level, indexed by level - 1. Probabilities use 1/100 of a percent.
const SupplyRules=(()=>{
  const thresholds=Object.freeze([0,20,40,60,80,100,130,160,190,220,260,300,340,380,420,480,540,600,660,720]);
  // Common and B drops are tuned in whole percentages through level 14.
  const commonAndB=[
    [60,40],[59,40],[56,43],[53,45],[50,48],
    [47,50],[44,53],[41,55],[38,58],[35,60],
    [34,56],[33,52],[32,48],[30,44]
  ];
  const highLevelShares=[20,40];
  const sRates=[1,2,4,8,12,20];
  const interval=20;

  function progress(count){
    count=Number.isSafeInteger(count) && count>=0?count:0;
    const nextIndex=thresholds.findIndex(at=>at>count);
    const level=nextIndex<0?thresholds.length:nextIndex;
    const nextLevelAt=thresholds[level]??null;
    return {count,level,levelStart:thresholds[level-1],nextLevelAt,
      nextLevelIn:nextLevelAt===null?null:nextLevelAt-count,remainingToA:interval-count%interval};
  }
  function odds(level){
    if(!Number.isInteger(level) || level<1 || level>thresholds.length)throw new RangeError('Invalid supply level');
    const [common,bGrade]=commonAndB[level-1]??highLevelShares;
    const C=common*100,B=bGrade*100,S=sRates[level-15]??0;
    return {C,B,A:10000-C-B-S,S};
  }
  function rankForRoll(level,roll){
    const {C,B,A}=odds(level);
    const ticket=Math.floor(roll*10000);
    if(ticket<C)return 'C';
    if(ticket<C+B)return 'B';
    if(ticket<C+B+A)return 'A';
    return 'S';
  }
  return Object.freeze({thresholds,interval,price:100,progress,odds,rankForRoll});
})();
if(typeof module!=='undefined' && module.exports)module.exports=SupplyRules;

'use strict';

const portraitRoles=['bulk','raven','lynx','hammer','cct'];
function fieldPortrait(id){
  const rank=rankedTiers[outfitTier(run.squad[id])].rank.replace('+','-plus');
  return 'art/armory/crew-frames/'+portraitRoles[id]+'/'+rank+'-battle-face.webp';
}
function wornPortrait(id){return uniformPortrait(id,armory.crewTiers[id])}
function uniformPortrait(id,tier){
  return recruitImagePath(portraitRoles[id],'face',tier);
}

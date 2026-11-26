'use strict';

const portraitRoles=['bulk','raven','lynx','hammer','cct'];
function fieldPortrait(id){return uniformPortrait(id,outfitTier(run.squad[id]))}
function wornPortrait(id){return uniformPortrait(id,armory.crewTiers[id])}
function uniformPortrait(id,tier){
  return recruitImagePath(portraitRoles[id],'face',tier);
}

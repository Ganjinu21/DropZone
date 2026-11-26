'use strict';

// Walk and moving fire share the same two steps, timed by ground distance.
const crewFrameSize=256,crewFrameHeight=164,crewFrameFoot=[109,243];
const crewMotion={guard:0,travel:1,toward:2,away:3,up:4,level:5,down:6,skill:7};
// Grounded key poses from the original model sheets keep their saved cel addresses.
const fieldKeys={walk:48,up:52,level:53,down:54};
function crewFootfall(m){
  const beat=Math.floor((m.gait||0)*8/crewStrideLength);
  return (beat%8+8)%8;
}
function crewStrideCel(action,phase){
  // The first 55 addresses are also used by saved skill-entry poses.
  return phase<6?action*6+phase:55+(action-1)*2+phase-6;
}

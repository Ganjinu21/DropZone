'use strict';

// The same foot-level footprints drive movement, sight, and the pursuit graph.
class MapRoutes {
  constructor(map) {
    this.width = map.bounds.w;
    this.height = map.bounds.h;
    this.bucket = 128;
    this.buckets = new Map();
    this.bucketCols = Math.ceil(this.width / this.bucket);
    for (const box of map.solids) {
      for (let y = Math.floor(box.y / this.bucket); y <= Math.floor((box.y + box.h) / this.bucket); y++) {
        for (let x = Math.floor(box.x / this.bucket); x <= Math.floor((box.x + box.w) / this.bucket); x++) {
          if (x < 0 || x >= this.bucketCols || y < 0) continue;
          const key = y * this.bucketCols + x;
          if (!this.buckets.has(key)) this.buckets.set(key, []);
          this.buckets.get(key).push(box);
        }
      }
    }

    this.tile = 24;
    this.cols = Math.ceil(this.width / this.tile);
    this.rows = Math.ceil(this.height / this.tile);
    const cells = this.cols * this.rows;
    this.walk = new Uint8Array(cells);
    this.edges = new Uint8Array(cells);
    this.distance = new Int32Array(cells);
    this.queue = new Int32Array(cells);
    this.offsets = [-1, 1, -this.cols, this.cols];
    this.target = -1;
    this.distance.fill(-1);
    for (let i = 0; i < cells; i++) this.walk[i] = !this.blocked(this.cx(i), this.cy(i), 5);
    for (let i = 0; i < cells; i++) {
      if (!this.walk[i]) continue;
      for (const d of [1, 3]) {
        if (d === 1 && i % this.cols === this.cols - 1) continue;
        const j = i + this.offsets[d];
        if (this.walk[j] && this.clear(this.cx(i), this.cy(i), this.cx(j), this.cy(j), 5)) {
          this.edges[i] |= 1 << d;
          this.edges[j] |= 1 << (d ^ 1);
        }
      }
    }
  }
  cx(i) { return (i % this.cols + .5) * this.tile; }
  cy(i) { return (Math.floor(i / this.cols) + .5) * this.tile; }
  blocked(x, y, radius) {
    if (x < radius || y < radius || x > this.width-radius || y > this.height-radius) return true;
    for (let by = Math.floor((y-radius)/this.bucket); by <= Math.floor((y+radius)/this.bucket); by++) {
      for (let bx = Math.floor((x-radius)/this.bucket); bx <= Math.floor((x+radius)/this.bucket); bx++) {
        const list = this.buckets.get(by*this.bucketCols + bx);
        if (list) for (const b of list) {
          if (x+radius > b.x && x-radius < b.x+b.w && y+radius > b.y && y-radius < b.y+b.h) return true;
        }
      }
    }
    return false;
  }
  clear(x,y,tx,ty,radius) {
    // Intersect the swept point against expanded footprints, even for a thin signpost.
    if (this.blocked(tx,ty,radius)) return false;
    const dx=tx-x, dy=ty-y;
    const x0=Math.floor((Math.min(x,tx)-radius)/this.bucket), x1=Math.floor((Math.max(x,tx)+radius)/this.bucket);
    const y0=Math.floor((Math.min(y,ty)-radius)/this.bucket), y1=Math.floor((Math.max(y,ty)+radius)/this.bucket);
    for(let by=y0;by<=y1;by++) for(let bx=x0;bx<=x1;bx++){
      const list=this.buckets.get(by*this.bucketCols+bx);
      if(!list)continue;
      for(const b of list){
        const left=b.x-radius, right=b.x+b.w+radius, top=b.y-radius, bottom=b.y+b.h+radius;
        if(Math.max(x,tx)<=left || Math.min(x,tx)>=right || Math.max(y,ty)<=top || Math.min(y,ty)>=bottom) continue;
        let entry=0, leave=1;
        if(dx){const a=(left-x)/dx,c=(right-x)/dx;entry=Math.max(entry,Math.min(a,c));leave=Math.min(leave,Math.max(a,c));}
        if(dy){const a=(top-y)/dy,c=(bottom-y)/dy;entry=Math.max(entry,Math.min(a,c));leave=Math.min(leave,Math.max(a,c));}
        if(entry<leave)return false;
      }
    }
    return true;
  }
  node(x,y) {
    const col=Math.floor(x/this.tile),row=Math.floor(y/this.tile), home=row*this.cols+col;
    if(this.walk[home] && this.clear(x,y,this.cx(home),this.cy(home),4)) return home;
    let nearest=-1, best=Infinity;
    for(let yy=Math.max(0,row-2);yy<=Math.min(this.rows-1,row+2);yy++) {
      for(let xx=Math.max(0,col-2);xx<=Math.min(this.cols-1,col+2);xx++){
        const i=yy*this.cols+xx, d=(this.cx(i)-x)**2+(this.cy(i)-y)**2;
        if(this.walk[i] && d<best && this.clear(x,y,this.cx(i),this.cy(i),4)){nearest=i;best=d;}
      }
    }
    return nearest;
  }
  aimAt(x,y) {
    const end=this.node(x,y);
    if(end===this.target)return;
    this.target=end;
    this.distance.fill(-1);
    if(end<0)return;
    this.queue[0]=end;this.distance[end]=0;
    let head=0,tail=1;
    while(head<tail){
      const i=this.queue[head++];
      for(let d=0;d<4;d++) if(this.edges[i] & (1<<d)){
        const j=i+this.offsets[d];
        if(this.distance[j]===-1){this.distance[j]=this.distance[i]+1;this.queue[tail++]=j;}
      }
    }
  }
  slide(who,dx,dy,radius) {
    if(this.clear(who.x,who.y,who.x+dx,who.y,radius))who.x+=dx;
    if(this.clear(who.x,who.y,who.x,who.y+dy,radius))who.y+=dy;
  }
  chase(who,goal,dt) {
    let tx=goal.x,ty=goal.y;
    if(Math.abs(tx-who.x)+Math.abs(ty-who.y)>130 || !this.clear(who.x,who.y,tx,ty,4)) {
      const here=this.node(who.x,who.y);
      if(here<0 || this.distance[here]<0)return;
      let next=here;
      for(let d=0;d<4;d++) if(this.edges[here] & (1<<d)){
        const j=here+this.offsets[d];
        if(this.distance[j]>=0 && this.distance[j]<this.distance[next])next=j;
      }
      if(next!==here || !this.clear(who.x,who.y,tx,ty,4)){
        if(!this.clear(who.x,who.y,this.cx(next),this.cy(next),4))next=here;
        tx=this.cx(next);ty=this.cy(next);
      }
    }
    const dx=tx-who.x,dy=ty-who.y,len=Math.hypot(dx,dy);
    if(len<.01)return;
    if(Math.abs(dx)>1)who.flip=dx<0?-1:1;
    const step=Math.min(1,who.speed*dt/len);
    this.slide(who,dx*step,dy*step,4);
  }
}

const cityMaps = {surface:SURFACE, metro:METRO};
const routes = {};
function makeMap() {
  for(const key of Object.keys(cityMaps)) routes[key]=new MapRoutes(cityMaps[key]);
}
function otherFloor() {return run.floor==='surface'?'metro':'surface';}
function nearestStair() {
  const exits=cityMaps[run.floor].exits;
  let index=0;
  for(let i=1;i<exits.length;i++)if(dist(run,exits[i])<dist(run,exits[index]))index=i;
  return index;
}
function freshFloor() {return {enemies:[],crystals:[],pursuitExit:-1,crossAfter:0};}
function canUseStair(index) {
  const stair=cityMaps[run.floor].exits[index];
  return run.t>=run.stairReady && dist(run,stair)<=65 && routes[run.floor].clear(run.x,run.y,stair.x,stair.y,4);
}
function useStair() {
  if(mode!=='play')return;
  const index=nearestStair();
  if(!canUseStair(index))return;
  const old=run.floors[run.floor];
  old.enemies=run.enemies;
  old.crystals=run.crystals;
  old.pursuitExit=index;
  old.crossAfter=run.t+1.65;
  run.floor=otherFloor();
  const dest=cityMaps[run.floor].exits[index];
  const here=run.floors[run.floor];
  run.enemies=here.enemies;
  run.crystals=here.crystals;
  run.x=dest.x;run.y=dest.y;
  run.camera={x:run.x,y:run.y};
  run.effects.length=0;run.cues.length=0;run.marks.length=0;run.mark=null;
  run.stairReady=run.t+2;
  run.arrivalGrace=run.t+.55;
  for(const m of run.squad){
    m.x=run.x;m.y=run.y;m.lastShot=null;m.shoot=0;
  }
  tone(run.floor==='metro'?280:410,.13,.035,'triangle');
  updateHud();
}
function updatePursuit(dt) {
  const floor=otherFloor(), other=run.floors[floor];
  if(other.pursuitExit<0 || !other.enemies.length)return;
  const stair=cityMaps[floor].exits[other.pursuitExit];
  const arrival=cityMaps[run.floor].exits[other.pursuitExit];
  const nav=routes[floor];
  nav.aimAt(stair.x,stair.y);
  let remaining=0;
  for(const e of other.enemies){
    if(e.hp<=0)continue;
    if(dist(e,stair)>15)nav.chase(e,stair,dt);
    if(dist(e,stair)<=15 && other.crossAfter<=run.t){
      e.x=arrival.x;e.y=arrival.y;e.arrived=run.t;
      run.enemies.push(e);
      other.crossAfter=run.t+.30;
    } else other.enemies[remaining++]=e;
  }
  other.enemies.length=remaining;
}
function updateMapHud() {
  const index=nearestStair(),stair=cityMaps[run.floor].exits[index],metro=run.floor==='metro';
  const bearing=Math.round(Math.atan2(stair.y-run.y,stair.x-run.x)*4/Math.PI);
  const arrow=['→','↘','↓','↙','←','↖','↑','↗'][(bearing+8)%8];
  const badge=$('sector');
  const label=(metro?'지하철':'지상')+'  ·  '+arrow+' '+(index+1)+'번 '+stair.name;
  if(badge.textContent!==label)badge.textContent=label;
  const button=$('stairs');
  button.hidden=!canUseStair(index);
  const action=(index+1)+'번 '+(metro?'지상으로':'역으로');
  if(button.lastElementChild.textContent!==action)button.lastElementChild.textContent=action;
}

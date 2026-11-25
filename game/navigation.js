'use strict';

// The same foot-level footprints drive movement, sight, and the pursuit graph.
function ravenMovementScale(who){
  return who.ravenSlowUntil && who.ravenSlowUntil > run.t ? .65 : 1;
}
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
    if(!this.clear(who.x,who.y,tx,ty,4)) {
      const here=this.node(who.x,who.y);
      if(here<0 || this.distance[here]<0)return;
      let next=here;
      for(let d=0;d<4;d++) if(this.edges[here] & (1<<d)){
        const j=here+this.offsets[d];
        if(this.distance[j]>=0 && this.distance[j]<this.distance[next])next=j;
      }
      if(next!==here && !this.clear(who.x,who.y,this.cx(next),this.cy(next),4))next=here;
      tx=this.cx(next);ty=this.cy(next);
    }
    const dx=tx-who.x,dy=ty-who.y,len=Math.hypot(dx,dy);
    if(len<.01)return;
    if(Math.abs(dx)>1)who.flip=dx<0?-1:1;
    const step=Math.min(1,who.speed*ravenMovementScale(who)*dt/len);
    // The whole segment to the goal or waypoint has clearance, including diagonal corners.
    who.x+=dx*step;
    who.y+=dy*step;
  }
}

const cityMaps = {surface:SURFACE, metro:underground};
const routes = {};
function makeMap() {
  underground.prepare();
  for(const key of Object.keys(cityMaps)) routes[key]=new MapRoutes(cityMaps[key]);
}
function otherFloor() {return run.floor==='surface'?'metro':'surface';}
function nearestStair() {
  const exits=cityMaps[run.floor].exits;
  let index=0;
  for(let i=1;i<exits.length;i++)if(dist(run,exits[i])<dist(run,exits[index]))index=i;
  return index;
}

function freshFloor() {
  return {enemies:[],crystals:[],effects:[],marks:[],cues:[],pursuitExit:-1};
}
function stairFormationScale(point) {
  const approach=40, width=TransitKit.halfWidth, len=TransitKit.stairLength;
  for(const e of SURFACE.exits){
    if(Math.abs(point.x-e.x)>len+approach||Math.abs(point.y-e.y)>len+approach)continue;
    const {along,side}=TransitKit.stairCoordinates(e,point);
    const outside=Math.max(0,-along,along-len,Math.abs(side)-width);
    if(outside<approach)return .48+.52*outside/approach;
  }
  return 1;
}
const floorLists=['enemies','crystals','effects','marks','cues'];
function updateStairDepth() {
  let depth=run.floor==='metro'?1:0, index=-1;
  for(const [i,e] of SURFACE.exits.entries()){
    if(Math.abs(run.x-e.x)>125||Math.abs(run.y-e.y)>125)continue;
    const {along,side}=TransitKit.stairCoordinates(e,run);
    if(Math.abs(side)>TransitKit.halfWidth||along<0||along>TransitKit.stairLength)continue;
    depth=along/TransitKit.stairLength;index=i;break;
  }
  run.depth=depth;
  run.stair=index;
  const floor=depth>=.5?'metro':'surface';
  if(floor===run.floor)return;
  const old=run.floors[run.floor],destination=run.floors[floor];
  old.pursuitExit=index;
  for(const key of floorLists){old[key]=run[key];run[key]=destination[key]}
  run.floor=floor;
  run.mark=null;
  routes[floor].aimAt(run.x,run.y);
  updateMapHud();
}
function updatePursuit(dt) {
  const floor=otherFloor(), other=run.floors[floor];
  advanceRounds(dt,other,floor);
  for(const list of [other.effects,other.cues]){
    let write=0;
    for(const v of list){v.age+=dt;if(v.age<v.duration)list[write++]=v}
    list.length=write;
  }
  if(other.pursuitExit<0||!other.enemies.length)return;
  const e=SURFACE.exits[other.pursuitExit],goingDown=floor==='surface';
  const half=TransitKit.stairLength/2;
  const goal=TransitKit.stairPoint(e,half+(goingDown?6:-6));
  const nav=routes[floor];
  nav.aimAt(goal.x,goal.y);
  let remaining=0;
  for(const enemy of other.enemies){
    if(enemy.hp<=0)continue;
    enemy.hit-=dt;
    nav.chase(enemy,goal,dt);
    const {along,side}=TransitKit.stairCoordinates(e,enemy);
    if(Math.abs(side)<TransitKit.halfWidth && Math.abs(along-half)<11 &&
       (goingDown?along>=half:along<=half)){
      run.enemies.push(enemy);
    } else other.enemies[remaining++]=enemy;
  }
  other.enemies.length=remaining;
}
function updateMapHud(){
  const index=run.stair>=0?run.stair:nearestStair(),e=SURFACE.exits[index];
  const inside=run.depth>0&&run.depth<1;
  const target=TransitKit.stairPoint(e,run.floor==='metro'?TransitKit.stairLength:0);
  const bearing=Math.round(Math.atan2(target.y-run.y,target.x-run.x)*4/Math.PI);
  const arrow=['→','↘','↓','↙','←','↖','↑','↗'][(bearing+8)%8];
  const area=inside?'연결 계단':run.floor==='metro'?'지하철':'지상';
  const label=area+'  ·  '+(inside?'':arrow+' ')+(index+1)+'번 '+e.name;
  if($('sector').textContent!==label)$('sector').textContent=label;
}

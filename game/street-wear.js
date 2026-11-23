'use strict';

// Static decals sit under the objects that caused them, baked into the street tiles.
const drawStreetWear = (() => {
  function line(g, points, color, width = 1) {
    g.beginPath();
    g.strokeStyle = color;
    g.lineWidth = width;
    g.moveTo(...points[0]);
    for (let i = 1; i < points.length; i++) g.lineTo(...points[i]);
    g.stroke();
  }
  function polygon(g, points, color) {
    g.beginPath();
    g.fillStyle = color;
    g.moveTo(...points[0]);
    for (let i = 1; i < points.length; i++) g.lineTo(...points[i]);
    g.closePath();
    g.fill();
  }
  function seeded(seed) {
    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }
  function tyrePair(g, x, y, sx, sy) {
    g.save();
    g.translate(x, y);
    g.scale(sx, sy);
    // Two arcs of rubber follow the bus's swerve nose-first into the stop.
    for (const track of [0, 23]) {
      for (const edge of [0, 3]) {
        g.beginPath();
        g.moveTo(0, track+edge);
        g.bezierCurveTo(68, track-2+edge, 129, track-33+edge, 196, track-61+edge);
        g.bezierCurveTo(243, track-86+edge, 294, track-85+edge, 329, track-84+edge);
        g.lineWidth = 2;
        g.strokeStyle = edge ? '#23252874' : '#1e232a80';
        g.setLineDash([8, 1, 12, 2]);
        g.stroke();
      }
    }
    g.restore();
  }
  function gutterPool(g, x, y, width, mirror) {
    const r = seeded(x + y);
    g.save();g.translate(x,y);g.scale((mirror ? -1 : 1)*width/135,1);
    const shape=[[0,0],[15,-4],[32,-3],[45,-9],[86,-11],[121,-6],[136,-6],
      [131,-1],[109,1],[95,6],[73,5],[59,8],[45,5],[34,7],[21,4],[8,4]];
    polygon(g,shape,'#202b2c72');
    polygon(g,[[9,0],[36,-2],[60,-7],[84,-8],[108,-4],[95,0],[67,1],[47,5],[27,3]],'#62747777');
    for(let i=0;i<22;i++) {
      const xx=18+Math.floor(r()*85), yy=-3+Math.floor(r()*6);
      line(g,[[xx,yy],[xx+3+Math.floor(r()*11),yy]],i%4?'#b0b9a948':'#788e9577');
    }
    g.restore();
  }
  function spall(g, x, y, size, seed) {
    const r=seeded(seed), outline=[];
    for(let k=0;k<22;k++) {
      const a=k*Math.PI/11,rad=size*(.5+r()*.55);
      outline.push([Math.round(Math.cos(a)*rad),Math.round(Math.sin(a)*rad*.49)]);
    }
    g.save();g.translate(x,y);
    polygon(g,outline,'#98948491');
    g.translate(0,-2);polygon(g,outline,'#353943');
    g.save();g.clip();
    g.fillStyle='#504e4b';g.fillRect(-size,-size*.45,size*2,size*.7);
    for(let j=0;j<size*2;j++) {
      const xx=Math.floor((r()*2-1)*size), yy=Math.floor((r()-.5)*size);
      g.fillStyle=['#6e6c66','#3e4140','#898578','#5c5954'][j%4];
      g.fillRect(xx,yy,1+Math.floor(r()*6),1+Math.floor(r()*3));
    }
    g.restore();
    for(let j=0;j<6;j++){
      const p=outline[j*3],dx=p[0]/3,dy=p[1]/2;
      line(g,[p,[p[0]+dx,p[1]+dy],[p[0]+dx+5,p[1]+dy-1],[p[0]+2*dx+5,p[1]+2*dy]],'#2e323aac',1.5);
    }
    g.restore();
  }
  function impact(g) {
    // Screen glass and bits of the bezel travel outwards across the zebra paint.
    const r=seeded(83912);
    spall(g,1508,948,19,250);
    for(let i=0;i<75;i++){
      const dx=r()**1.5*147,dy=(r()-.47)*(16+dx*.64);
      const x=Math.round(1454+dx),y=Math.round(956+dy);
      const sz=i%9===0?6:2+r()*2|0;
      polygon(g,[[x,y+2],[x+sz+1,y],[x+sz-1,y+3]],'#2b323a92');
      polygon(g,[[x-1,y],[x+sz,y-1],[x+2,y+2]],
        ['#89a4a5','#6a898c','#5c7477','#b0bbad','#434c50'][i%5]);
    }
    line(g,[[1481,942],[1493,941],[1497,938],[1493,933],[1497,930],[1514,933],[1520,929]],'#262e32',2);
    line(g,[[1515,934],[1521,930],[1525,931]],'#b29b75');
  }

  return function draw(g,view) {
    function visible(x,y,rx,ry){
      return x+rx>=view.x && x-rx<=view.x+view.w && y+ry>=view.y && y-ry<=view.y+view.h;
    }
    if(visible(934,898,198,80)) tyrePair(g,1110,936,-1,.88);
    if(visible(1431,1820,195,76)) tyrePair(g,1291,1880,.83,.74);
    if(visible(1511,953,105,64)) impact(g);
    for(const [x,y,w,rev] of [[1094,844,103,true],[1570,847,95,false],
      [2143,1090,145,true],[628,1456,102,false],[902,450,138,false],[1938,829,100,true]]){
      if(visible(x,y,w+3,24))gutterPool(g,x,y,w,rev);
    }
    for(const [x,y,sz] of [[1150,1078,38],[733,1418,26],[1915,442,35],[365,866,45],[2222,1535,42]]){
      if(visible(x,y,sz*2,sz))spall(g,x,y,sz,x+y);
    }
  };
})();

// Eight equally spaced phases. Wave and impact rows wrap back to phase zero.
function makeWaterAtlas(){
  const w=128,h=64,n=8,c=document.createElement('canvas');c.width=w*n;c.height=h*2;
  const g=c.getContext('2d'),tau=Math.PI*2;
  for(let f=0;f<n;f++){
    const t=f/n;g.save();g.translate(w*f,0);g.beginPath();g.rect(0,0,w,h);g.clip();
    for(let j=0;j<15;j++){
      const y=(j*19)%64,phase=j*.73+t*tau,span=7+((j*13)%22);
      const cycle=(t+j*.31)%1,crest=Math.sin(Math.PI*cycle)**2;
      const cx=(j*41+cycle*16)%128;
      for(const wx of [cx-128,cx,cx+128]){
        g.beginPath();
        for(let k=0;k<=span;k+=2){
          const yy=y+1.6*Math.sin(k*.19+phase)+Math.sin(j*.51+t*tau);
          k?g.lineTo(wx+k,yy):g.moveTo(wx,yy);
        }
        g.strokeStyle='rgba(128,180,178,'+(.06+.25*crest)+')';g.lineWidth=.9;g.stroke();
      }
    }
    g.restore();g.save();g.translate(w*f,h);g.beginPath();g.rect(0,0,w,h);g.clip();
    // Two successive splashes hit the upstream face; expanding wakes outlive the spray.
    for(let k=0;k<3;k++){
      const u=(t+k/3)%1;
      const radius=6+31*u;
      for(const [start,end] of [[-1.42,-.48],[-.23,.55],[.76,1.39]]){
        g.beginPath();
        for(let j=0;j<=9;j++){
          const angle=start+(end-start)*j/9;
          const noise=Math.sin(angle*9+k)*1.2+Math.cos(angle*6+u*tau)*.8;
          const xx=47+u*6+(radius+noise)*Math.cos(angle);
          const yy=35+(2+12*u)*Math.sin(angle)+noise*.65;
          j?g.lineTo(xx,yy):g.moveTo(xx,yy);
        }
        g.strokeStyle='rgba(155,185,177,'+(.52*(1-u))+')';g.lineWidth=1.7-u;g.stroke();
      }
    }
    for(let j=0;j<26;j++){
      const u=(t+(j%4)*.028)%1,theta=-1.5+j*.12,rise=Math.sin(Math.PI*u);
      const dx=Math.cos(theta)*(8+(j%7)*2.2)*u,dy=Math.sin(theta)*(6+j%8)*u;
      const xx=49+dx,yy=34+dy-(8+j%6)*rise;
      g.fillStyle='rgba(201,213,198,'+(.72*rise)+')';g.fillRect(Math.round(xx),Math.round(yy),j%4?1:2,2);
    }
    g.restore();
  }
  return c;
}

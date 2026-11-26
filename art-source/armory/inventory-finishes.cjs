// Export the five cosmetic finishes of the original Lynx and Hammer inventory paintings.
// Run with Node and sharp. Metal seams, grips and the painted silhouettes come from the game art.
const path = require('node:path');
const sharp = require('sharp');
const game = path.resolve(__dirname, '../../game');
const finishes = {
  C: {plate:[135,111,78], trim:[151,131,88], lens:[131,167,159]},
  B: {plate:[111,132,95], trim:[134,144,108], lens:[151,178,146]},
  A: {plate:[226,167,44], trim:[224,173,68], lens:[254,205,102]},
  S: {plate:[179,52,57], trim:[153,60,61], lens:[255,111,94]},
  'S-plus': {plate:[218,228,228], trim:[87,193,196], lens:[99,246,249]}
};
const clamp = value => Math.min(1, Math.max(0, value));
function finishPixel(data, offset, colors) {
  const r=data[offset], g=data[offset+1], b=data[offset+2];
  const light=.25*r+.60*g+.15*b;
  const lens=clamp((g-r-8)/40)*clamp((b-r-4)/36);
  const warm=clamp((r-b-1)/13)*clamp((r-g+5)/12);
  const plate=warm*clamp((light-37)/68);
  const trim=warm*clamp((r-g-13)/25);
  const mask=Math.max(lens,plate,trim);
  if(!mask)return;
  const target=lens>.35?colors.lens:trim>.6?colors.trim:colors.plate;
  const shade=light/178, highlight=clamp((light-189)/66)*.73;
  for(let channel=0;channel<3;channel++){
    const tone=target[channel]*shade;
    const enamel=tone*(1-highlight)+255*highlight;
    data[offset+channel]=Math.round(data[offset+channel]*(1-mask)+Math.min(255,enamel)*mask);
  }
}
async function exportFamily(family) {
  const source=path.join(game,'art','augments',family+'.webp');
  const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(const [rank,colors] of Object.entries(finishes)){
    const pixels=Buffer.from(data);
    for(let offset=0;offset<pixels.length;offset+=4){
      if(pixels[offset+3])finishPixel(pixels,offset,colors);
    }
    await sharp(pixels,{raw:{width:info.width,height:info.height,channels:4}})
      .extend({top:4,bottom:4,left:4,right:4,background:'#00000000'})
      .webp({quality:94,alphaQuality:100})
      .toFile(path.join(game,'art','armory','catalog',family,rank+'.webp'));
  }
}
Promise.all(['sniper','rocket'].map(exportFamily)).catch(error=>{console.error(error);process.exitCode=1});

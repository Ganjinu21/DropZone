"""Pack the painted squad cels, muzzle anchors and registered equipment finishes."""
import json
from pathlib import Path

import numpy as np
from PIL import Image
from raven_cels import field_drawing
from bulk_brace import brace_inbetweens

SOURCE = Path(__file__).parent / 'painted-squad'
OUT = SOURCE.parents[2] / 'game/art/armory/painted-squad'
SIZE, SOLE = 256, 240
HEIGHT = {'bulk': 217, 'lynx': 196, 'hammer': 202, 'cct': 198}
RANKS = ['B', 'A', 'S', 'S-plus']
HEAD = {'bulk': (124,17), 'lynx': (146,37), 'hammer': (141,32), 'cct': (133,33)}
# Muzzle tips on the separately painted, 800px-wide breathing proofs.
IDLE_TIPS = {
    'bulk': [(124,117,10),(325,112,9),(528,110,8),(728,108,8)],
    'lynx': [(194,148,30),(395,143,28),(595,136,26),(796,131,24)],
    'hammer': [(165,92,-20),(364,90,-20),(567,81,-22),(768,79,-22)],
    'cct': [(165,151,34),(365,145,31),(568,139,30),(769,135,29)]}
# Walking cels are annotated on the registered 106px proofs.
WALK_TIPS = {
    'bulk': [(66,48,5),(62,46,5),(66,48,5),(69,48,5),(70,47,5),(65,48,5),(66,48,5),(70,48,5),
             (53,43,65),(56,43,65),(56,41,65),(55,45,65),(100,31,-4),(96,36,-4),(98,33,-4),(97,36,-4)],
    'lynx': [(96,60,28),(93,60,28),(90,54,23),(90,55,20),(94,61,28),(92,60,28),(85,61,27),(95,60,30),
             (79,61,48),(77,62,48),(75,60,48),(76,61,48),(91,44,20),(88,45,20),(86,43,20),(92,44,20)],
    'hammer': [(84,35,-17),(80,36,-17),(88,35,-15),(80,35,-17),(83,39,-10),(80,35,-15),(84,37,-15),(84,39,-13),
               (53,54,88),(54,54,88),(55,53,88),(54,55,88),(69,19,-55),(69,19,-55),(68,18,-55),(70,20,-55)],
    'cct': [(76,54,17),(75,54,17),(77,49,6),(77,50,7),(77,51,8),(75,54,17),(74,53,12),(74,52,8),
            (65,56,60),(64,57,60),(63,59,60),(64,57,60),(65,45,0),(65,45,0),(65,45,0),(65,45,0)]}
# Bore at the end of the painted barrel, annotated on a 500px-tall source proof.
# Angle is in screen space and also locates the receiver behind the muzzle.
TIPS = {
    'bulk': [(85,58,8),(217,52,8),(401,25,0),(480,34,-12),
             (86,122,-90),(251,126,-40),(376,211,49),(473,209,90),
             (80,298,8),(213,296,9),(347,312,12),(487,310,14),
             (88,374,-80),(244,380,-49),(382,465,51),(473,453,90)],
    'lynx': [(117,63,27),(242,58,22),(376,31,-1),(496,41,2),
             (65,125,-91),(227,128,-40),(365,203,38),(444,212,90),
             (122,297,12),(246,280,-4),(376,282,0),(497,266,-14),
             (62,369,-92),(217,373,-43),(369,444,32),(449,462,85)],
    'hammer': [(100,36,-13),(217,36,-10),(370,30,-3),(472,34,-12),
               (64,127,-88),(214,125,-45),(349,191,24),(444,204,93),
               (95,319,42),(224,344,44),(353,277,-58),(481,282,-64),
               (65,374,-90),(219,378,-49),(350,444,27),(443,451,90)],
    'cct': [(98,67,32),(219,62,26),(359,40,0),(482,37,0),
            (68,125,-90),(210,130,-50),(340,201,42),(436,207,87),
            (97,319,49),(215,320,49),(337,320,49),(456,318,50),
            (67,371,-90),(208,379,-49),(343,436,31),(437,443,87)]}
CCT_WALK_TIPS=[(106,57,18),(227,55,18),(349,53,12),(471,53,10),
               (106,173,8),(229,177,15),(351,178,17),(475,178,10),
               (88,316,43),(210,316,50),(330,316,52),(456,316,48),
               (86,421,5),(210,419,5),(330,418,5),(455,419,5)]
RAMPS = [
    [(23,29,39),(99,127,148),(220,232,242)],
    [(36,31,25),(159,128,71),(247,225,172)],
    [(31,25,41),(141,109,154),(236,214,242)],
    [(37,29,26),(196,151,63),(255,236,173)]]


def gutters(projection, count):
    step=len(projection)/count
    cuts=[0]
    for i in range(1,count):
        middle=round(i*step)
        choices=range(middle-round(step*.20), middle+round(step*.20)+1)
        cuts.append(min(choices,key=lambda p:(projection[p],abs(p-middle))))
    return cuts+[len(projection)]


def read_sheet(role, group, rows):
    sheet=Image.open(SOURCE/f'{role}-{group}.png').convert('RGBA')
    raw=np.array(sheet)
    raw[:,:,3]=np.clip((raw[:,:,3].astype(float)-14)*255/241,0,255).astype('uint8')
    sheet=Image.fromarray(raw)
    mask=raw[:,:,3]>90
    ys=gutters(mask.sum(1),rows)
    cells=[]
    for top,bottom in zip(ys,ys[1:]):
        xs=gutters(mask[top:bottom].sum(0),4)
        for left,right in zip(xs,xs[1:]):
            sub=mask[top:bottom,left:right]
            y=np.flatnonzero(sub.sum(1)>2); x=np.flatnonzero(sub.sum(0)>2)
            box=(left+x[0],top+y[0],left+x[-1]+1,top+y[-1]+1)
            cells.append((sheet.crop(box),box))
    return cells,sheet.width/800 if group=='idle' else sheet.height/500


def register(role,group,rows):
    cells,proof_scale=read_sheet(role,group,rows)
    height=np.median([p.height for p,_ in cells[:(2 if group=='action' else 4)]])
    scale=HEIGHT[role]/height
    result=[]
    for i,(patch,box) in enumerate(cells):
        s=min(scale,246/patch.width,232/patch.height)
        patch=patch.resize((round(patch.width*s),round(patch.height*s)),Image.Resampling.LANCZOS)
        alpha=np.asarray(patch.getchannel('A'))
        # Center on the trunk rather than the barrel or cloth trailing behind it.
        band=(.90,.98) if group=='idle' else (.60,.69)
        anchor=np.where(alpha[int(patch.height*band[0]):int(patch.height*band[1])]>145)[1]
        anchor_x=(anchor.min()+anchor.max())/2 if group=='idle' else np.median(anchor)
        x=int(np.clip(round(SIZE/2-anchor_x),2,SIZE-patch.width-2))
        y=SOLE-patch.height
        cel=Image.new('RGBA',(SIZE,SIZE));cel.alpha_composite(patch,(x,y))
        if group=='action' or group=='idle' or (role=='cct' and group=='walk'):
            if group=='idle':
                mx,my,a=IDLE_TIPS[role][i]
            else:
                mx,my,a=(TIPS[role] if group=='action' else CCT_WALK_TIPS)[i]
            tip=[round(x+(mx*proof_scale-box[0])*s),round(y+(my*proof_scale-box[1])*s),a]
        elif group=='walk':
            px,py,a=WALK_TIPS[role][i]
            tip=[round(px*SIZE/106),round(py*SIZE/106),a]
        else:
            tip=[x+round(patch.width*.94),y+round(patch.height*.44),12]
        result.append((cel,tip))
    return result


def material_regions(cel,role,tip):
    pix=np.asarray(cel).astype(float)
    r,g,b,alpha=pix.transpose(2,0,1)
    yy,xx=np.indices(alpha.shape)
    l,t,right,bottom=cel.getbbox()
    z=(yy-t)/(bottom-t)
    skin=(r>g*1.27)&(g>b*1.23)&(r>66)
    fabric=(alpha>25)&~skin
    mx,my,angle=tip
    co,si=np.cos(np.deg2rad(angle)),np.sin(np.deg2rad(angle))
    back=(mx-xx)*co+(my-yy)*si
    cross=(mx-xx)*si-(my-yy)*co
    length={'bulk':32,'lynx':94,'hammer':70,'cct':66}[role]
    metal=(g>=r*.88)&(b>=r*.80)
    weapon=fabric&metal&(back>=-3)&(back<length)&(abs(cross)<(9 if role=='hammer' else 6))
    shield=fabric&(b>r*1.10)&(b>g*1.02)&(role=='bulk')&(z>.22)&~weapon
    gloves=fabric&(abs(back-length*.71)<16)&(abs(cross)<16)&(r<80)&~weapon&~shield
    cloth=fabric&~(weapon|shield|gloves)
    return [weapon,shield,cloth&(z<.245),cloth&(z>=.245)&(z<.59),
            cloth&(z>=.59)&(z<.84),cloth&(z>=.84),gloves]


def pack(role):
    cels=register(role,'action',4)+register(role,'walk',4)
    if role=='hammer':cels+=register(role,'remote',1)
    breath_start=len(cels)
    cels+=register(role,'idle',1)
    if role=='bulk':
        cels+=brace_inbetweens(cels,breath_start)
    base=Image.new('RGBA',(8*SIZE,((len(cels)+7)//8)*SIZE))
    masks=[]; origins=[]; tips=[]
    for i,(cel,tip) in enumerate(cels):
        base.paste(cel,(i%8*SIZE,i//8*SIZE));tips.append(tip)
        entries=[]
        for region in material_regions(cel,role,tip):
            alpha=Image.fromarray(np.where(region,np.asarray(cel.getchannel('A')),0).astype('uint8'))
            layer=cel.copy();layer.putalpha(alpha)
            layer=layer.resize((128,128),Image.Resampling.LANCZOS)
            box=layer.getbbox()
            if not box:entries.append(None);continue
            entries.append([0,0,box[2]-box[0],box[3]-box[1],box[0],box[1]])
            masks.append((entries[-1],layer.crop(box)))
        origins.append(entries)
    base.save(OUT/f'{role}.webp',quality=94,method=5)
    for size in (72,144):
        field=Image.new('RGBA',(8*size,((len(cels)+7)//8)*size))
        for i,(cel,_) in enumerate(cels):
            field.paste(field_drawing(cel,size),(i%8*size,i//8*size))
        field.save(OUT/f'{role}-{size}.webp',quality=95,method=5)
    cx,top_y=HEAD[role]
    portrait_box=(cx-58,top_y,cx+58,top_y+116)
    def portrait(cel,rank):
        cel.crop(portrait_box).resize((112,112),Image.Resampling.LANCZOS).save(OUT/f'{role}-portrait-{rank}.png')
    portrait(cels[0][0],'C')
    left=top=row_h=0
    for entry,patch in masks:
        if left+patch.width>1024:left=0;top+=row_h+2;row_h=0
        entry[:2]=left,top
        left+=patch.width+2;row_h=max(row_h,patch.height)
    for rank,ramp in zip(RANKS,RAMPS):
        atlas=Image.new('RGBA',(1024,top+row_h))
        for (x,y,*_),patch in masks:
            lum=np.asarray(patch.convert('L'))
            rgb=np.stack([np.interp(lum,[8,112,236],[c[j] for c in ramp]) for j in range(3)],axis=2)
            dye=Image.fromarray(rgb.astype('uint8')).convert('RGBA')
            dye.putalpha(patch.getchannel('A'));atlas.paste(dye,(x,y))
        atlas.save(OUT/f'{role}-{rank}.webp',quality=90,method=5)
        face=cels[0][0].copy()
        x,y,w,h,dx,dy=origins[0][2]
        head=atlas.crop((x,y,x+w,y+h)).resize((w*2,h*2),Image.Resampling.LANCZOS)
        face.alpha_composite(head,(dx*2,dy*2))
        portrait(face,rank)
    return {'tips':tips,'layers':origins,'breathStart':breath_start}


if __name__=='__main__':
    OUT.mkdir(exist_ok=True,parents=True)
    data={role:pack(role) for role in HEIGHT}
    (OUT/'frames.js').write_text('const paintedOperators='+json.dumps(data,separators=(',',':'))+';\n')

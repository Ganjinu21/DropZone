"""Build Raven's painted animation atlases from the registered full-body poses."""
from pathlib import Path
import json
from raven_equipped import registered, material, finish

import numpy as np
from PIL import Image, ImageChops, ImageOps, ImageFilter

SRC = Path(__file__).parent / 'raven-painted'
OUT = SRC.parents[2] / 'game/art/armory/raven-cels'
SIZE = 144
SOLE = 134
RANKS = ('C','B','A','S','S-plus')
SLOTS = ('helmet','top','pants','boots','gloves')
RESAMPLE = Image.Resampling.LANCZOS


def field_drawing(cel, size):
    """Restore local ink and material contrast after reducing to combat resolution."""
    reduced=cel.resize((size,size),RESAMPLE)
    rgba=np.asarray(reduced).astype(np.float32)
    alpha=reduced.getchannel('A')
    luma=reduced.convert('L')
    # Alpha-weight the neighbourhood so transparent black cannot make a bright fringe.
    radius=.85*size/72
    blur=ImageFilter.GaussianBlur(radius)
    weight=np.asarray(alpha.filter(blur),dtype=np.float32)
    weighted=np.asarray(ImageChops.multiply(luma,alpha).filter(blur),dtype=np.float32)
    average=255*weighted/np.maximum(weight,1)
    detail=np.asarray(luma,dtype=np.float32)-average
    lift=np.clip(detail*1.10,-23,23)*(rgba[:,:,3]/255)
    rgba[:,:,:3]+=lift[:,:,None]
    return Image.fromarray(np.clip(rgba,0,255).astype('uint8'))

# Tie and loose end on the registered drawing, measured in 144-unit cel space.
# Deform the free ponytail and scarf tips, keeping the head, wrists and SMGs pinned.
HAIR=[
    (66,40,100,53),(60,32,38,51),(71,33,49,55),(68,44,39,65),
    (61,58,90,67),(61,44,99,51),(69,26,32,40),(62,43,33,57),
    (88,25,132,40),(69,44,107,57),(71,35,48,51),(70,55,46,71),
    (67,37,44,58),(65,37,46,56),(64,38,48,57),(67,38,47,58),
    (76,47,114,53),(82,36,131,37),(62,52,98,57),(64,31,28,54),
    (61,39,17,52),(69,40,22,35),(68,58,115,67),(92,39,128,42)]

def hair_exposure(cel,i,stage):
    root_x,root_y,tip_x,tip_y=HAIR[i-48]
    dx,dy=tip_x-root_x,tip_y-root_y
    length=np.hypot(dx,dy)
    ux,uy=dx/length,dy/length
    stretch,lift=[(5,-6),(1,-9),(-3,4)][stage]
    def sample(x,y):
        ax,ay=x/2-root_x,y/2-root_y
        along=(ax*ux+ay*uy)/length
        across=(ax*uy-ay*ux)/22
        bend=np.clip(along,0,1)**1.6*np.exp(-across**2*1.8-max(0,along-1.25)**2*5)
        return (x-2*stretch*ux*bend,y-2*(lift+stretch*uy)*bend)
    mesh=[]
    for y in range(0,cel.height,16):
        for x in range(0,cel.width,16):
            mesh.append(((x,y,x+16,y+16),sum((sample(a,b) for a,b in
                [(x,y),(x,y+16),(x+16,y+16),(x+16,y)]),())))
    moved=cel.transform(cel.size,Image.Transform.MESH,mesh,Image.Resampling.BICUBIC)
    r,g,b,a=np.asarray(cel).astype(float).transpose(2,0,1)
    fixed=(a>45)&(((g>r+3)&(g>b*.80))|((r>g*1.22)&(g>b*1.15)&(g>52))|
                   ((g>b*1.13)&(r<g*1.35)&(g>29)))
    keep=Image.fromarray(np.uint8(fixed)*255).filter(ImageFilter.MaxFilter(3))
    keep=ImageChops.lighter(keep,keep.transform(cel.size,Image.Transform.MESH,mesh,Image.Resampling.BILINEAR))
    return Image.composite(cel,moved,keep)

def build():
    OUT.mkdir(exist_ok=True)
    cels=registered()
    barrels=json.loads((SRC/'equipped/barrels.json').read_text())
    rows=(len(cels)+7)//8
    spin_rows=rows-6
    base=Image.new('RGBA',(8*288,rows*288))
    field=Image.new('RGBA',(8*72,rows*72))
    field2x=Image.new('RGBA',(8*SIZE,rows*SIZE))
    echo=Image.new('RGBA',field2x.size,(255,35,79,0))
    follow=Image.new('RGBA',(8*288,3*spin_rows*288))
    follow_echo=Image.new('RGBA',(8*72,3*spin_rows*72))
    icons={(slot,rank):Image.open(OUT.parent/'catalog'/slot/(rank+'.png')).convert('RGBA')
           for slot in SLOTS for rank in RANKS[1:]}
    # Pack each garment only as large as its pose needs instead of a screen-sized layer.
    overlays={(slot,rank):[] for slot in SLOTS for rank in RANKS[1:]}
    offsets={slot:[] for slot in SLOTS}
    finishes={rank:[] for rank in RANKS[1:]}
    finishes_at=[]
    for i,cel in enumerate(cels):
        x,y=i%8,i//8
        smg=material(cel,i,barrels)
        box=smg.getbbox() or (0,0,1,1)
        finishes_at.append(box[:2])
        for tier,rank in enumerate(RANKS[1:],1):
            finishes[rank].append(finish(cel.crop(box),smg.crop(box),tier))
        base.paste(cel,(x*SIZE*2,y*SIZE*2))
        if i>=48:
            for stage in range(3):
                variant=hair_exposure(cel,i,stage)
                row=stage*spin_rows+(i-48)//8
                follow.paste(variant,(x*288,row*288))
                trail=Image.new('RGBA',(72,72),'#ff234f')
                trail.putalpha(variant.getchannel('A').resize(trail.size,RESAMPLE))
                follow_echo.paste(trail,(x*72,row*72))
        field.paste(field_drawing(cel,72),(x*72,y*72))
        field2x.paste(field_drawing(cel,SIZE),(x*SIZE,y*SIZE))
        body=cel.resize((SIZE,SIZE),RESAMPLE)
        tint=Image.new('RGBA',body.size,'#ff234f')
        tint.putalpha(body.getchannel('A'))
        echo.paste(tint,(x*SIZE,y*SIZE))
        raw=np.asarray(body).astype(float)
        r,g,b,alpha=raw.transpose(2,0,1)
        yy,xx=np.indices((SIZE,SIZE))
        scarf=(r>1.6*g)&(r>1.4*b)&(r>64)&(alpha>125)
        sy,sx=np.where(scarf)
        hx=int(np.median(sx)) if len(sx) else 72
        hy=int(np.median(sy))-10 if len(sy) else 45
        cloth=(r>g*.83)&(g>b*1.09)&(r<g*1.35)
        trousers=cloth & (alpha>120) & (yy>hy+16) & (abs(xx-72)<14)
        hips=np.flatnonzero(trousers.sum(1)>=6)
        hip=int(hips[0]) if len(hips) else hy+35
        skin=(r>g*1.28)&(g>b*1.12)&(r>65)
        legs=(yy>=hip)&cloth&~skin
        boots=(yy>=hip+(SOLE-hip)*.54)&~legs
        small_mask=smg.resize(body.size,RESAMPLE)
        around_guns=np.asarray(small_mask.filter(ImageFilter.MaxFilter(13)))>22
        equipment=np.asarray(small_mask.filter(ImageFilter.MaxFilter(3)))>12
        fingers=around_guns & ~equipment & ~scarf & ~skin & (alpha>100) & (abs(r-g)<15) & (r<100)
        facing_left=i in (37,38,39)
        for slot in SLOTS:
            variants=[]
            for rank in RANKS[1:]:
                item=icons[slot,rank]
                out=Image.new('RGBA',body.size)
                if slot=='helmet':
                    cap=item.resize((24,15),RESAMPLE)
                    if facing_left:cap=cap.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                    out.alpha_composite(cap,(hx-12,hy-12))
                elif slot=='top':
                    h=max(13,hip-hy-10)
                    vest=item.resize((25,h),RESAMPLE)
                    out.alpha_composite(vest,(round((hx+72)/2)-13,hip-h))
                    visible=Image.fromarray(np.uint8(np.where(skin | around_guns,0,alpha)))
                    out.putalpha(ImageChops.multiply(out.getchannel('A'),visible))
                else:
                    # Preserve the directional lighting and folds of the painted clothing.
                    palette={'B':'#b2ad8c','A':'#7197a6','S':'#a393ac','S-plus':'#ceac7c'}
                    dye=ImageOps.colorize(body.convert('L'),'#171821',palette[rank],whitepoint=163)
                    out=Image.blend(body.convert('RGB'),dye,.72).convert('RGBA')
                    out.putalpha(Image.fromarray(np.uint8(np.where((legs if slot=='pants' else fingers if slot=='gloves' else boots) & ~equipment,alpha,0))))
                variants.append(out)
            mask=variants[0].getchannel('A')
            for v in variants[1:]:mask=ImageChops.lighter(mask,v.getchannel('A'))
            rect=mask.getbbox() or (0,0,1,1)
            offsets[slot].append(rect[:2])
            for rank,v in zip(RANKS[1:],variants):overlays[slot,rank].append(v.crop(rect))
    base.save(OUT/'base.png',optimize=True)
    follow.save(OUT/'spin-follow.webp',lossless=True,method=5)
    follow_echo.save(OUT/'spin-follow-echo.webp',lossless=True,method=5)
    field.save(OUT/'field.png',optimize=True)
    field2x.save(OUT/'field-2x.webp',lossless=True,method=6)
    echo.save(OUT/'echo.png',optimize=True)
    for (slot,rank),parts in overlays.items():
        w,h=max(p.width for p in parts),max(p.height for p in parts)
        sheet=Image.new('RGBA',(8*w,rows*h))
        for i,part in enumerate(parts):sheet.paste(part,(i%8*w,i//8*h))
        sheet.save(OUT/(slot+'-'+rank+'.png'),optimize=True)
    for rank,parts in finishes.items():
        w,h=max(p.width for p in parts),max(p.height for p in parts)
        sheet=Image.new('RGBA',(8*w,rows*h))
        for i,part in enumerate(parts):sheet.paste(part,(i%8*w,i//8*h))
        sheet.save(OUT/('finish-'+rank+'.webp'),lossless=True,method=5)
    (OUT/'grips.js').write_text('const ravenBarrels='+json.dumps(barrels)+';\n'
        +'const ravenFinishOrigins='+json.dumps(finishes_at)+';\n'
        +'const ravenWearOrigins='+json.dumps(offsets)+';\n',encoding='utf8')

if __name__=='__main__':build()

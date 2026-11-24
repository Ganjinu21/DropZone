"""Paint the approved equipment silhouettes on the same pixel grid as the field operators."""
import json
from grade_clothing import ranked_clothing
from bisect import bisect
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageColor, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
MASTERS = Path(__file__).with_name('catalog-masters.png')
RANKS = ('C', 'B', 'A', 'S', 'S-plus')
DELTA = (23, 39, 58, 82, 109, 139, 170, 201, 230)
# Material ramps share the CCT plate carrier, earcup, glove and optic values.
RAMPS = {
    'canvas': ('1a1515','302521','45352b','594433','745639','916e48','b38b5e','d4ad7a','ead099','f4dfad'),
    'olive': ('191616','2c2820','3d3829','514832','665c40','827652','a2976d','c2b78b','ddd2a3','f1e5bb'),
    'steel': ('181517','272429','383538','49464a','605b5a','7b756e','99958b','b8b5a7','d4d0bd','eee7cf'),
    'slate': ('181519','25242a','33323b','454550','565865','6f7280','90929c','b1b2ae','d1d0c2','ede9d5'),
    'lens': ('17191c','233037','30454c','3b5765','477486','64909f','8bafb3','afd0ce','d7e8d8','f2f7e3'),
    'pulse': ('172023','183b42','14515e','1a6874','218a91','38a9ad','6ac8c4','9fe3d6','cff6e6','f1fff0'),
    'ember': ('211618','3e2020','652b28','8c342c','ad4233','c75b41','dc7a52','e9a371','f6c995','ffe6b9'),
}
RAMPS = {k: [ImageColor.getrgb('#'+c) for c in colors] for k, colors in RAMPS.items()}
INK = '#251e20'
ARMS = {'pistol','carbine','smg','sniper','rocket','ar'}
CLOTH = {'helmet','gloves','top','pants','boots'}


@lru_cache(maxsize=65536)
def field_color(color, family, rank):
    r,g,b=color
    value=.27*r+.57*g+.16*b
    slot=bisect(DELTA,value)
    if r>g*1.58 and r>b*1.46 and r-g>26:
        material='ember'
    elif g>r+15 and b>=r+13 and (rank=='S-plus' or g>r*1.3):
        material='pulse' if rank=='S-plus' else 'lens'
    elif b>r+6 and b>g+1:
        material='slate'
    elif g>=r-2 and g-b>10:
        material='olive'
    elif r-b>14 and r>g+3:
        material='canvas'
    else:
        material='slate' if rank=='S' else 'steel'
    # Desert canvas catches the key light. Gunmetal reflects the same warm light
    # but retains a cool middle value beside the operator's brown sleeves.
    if material=='canvas' and value>85 and family in CLOTH:
        slot=min(9,slot+1)
    return RAMPS[material][slot]


def finish(source, family, rank):
    original=source.convert('RGBA')
    mask=original.getchannel('A').point(lambda a: 255 if a>=100 else 0)
    soften=original.convert('RGB').filter(ImageFilter.MedianFilter(3))
    pixels,neighbors,alpha=original.load(),soften.load(),mask.load()
    output=Image.new('RGBA',source.size)
    out=output.load()
    for y in range(source.height):
        for x in range(source.width):
            if not alpha[x,y]:
                continue
            color=pixels[x,y][:3]
            # Keep deliberate hard highlights and dark seams; cluster the small
            # compression flecks within a face instead of dithering the surface.
            median=neighbors[x,y]
            if max(abs(a-b) for a,b in zip(color,median))<25:
                color=tuple((a+b)//2 for a,b in zip(color,median))
            out[x,y]=(*field_color(color,family,rank),255)
    return output


def long_face(image, at):
    """The main painted face at one station of a silhouette, above the slung gear."""
    x=round((image.width-1)*at)
    runs=[]
    start=None
    for y in range(image.height+1):
        opaque=y<image.height and image.getpixel((x,y))[3]
        if opaque and start is None:
            start=y
        elif not opaque and start is not None:
            runs.append((start,y-1))
            start=None
    if not runs:return None
    lo,hi=max(runs,key=lambda interval:interval[1]-interval[0])
    return x,lo,hi


# Stations specify the front face and the small fabric/property tab respectively.
STATIONS={'pistol':(.64,.32),'carbine':(.68,.43),'smg':(.64,.41),
          'sniper':(.57,.34),'rocket':(.39,.25),'ar':(.67,.47)}


def paint_weapon(image,family,rank,far):
    alpha=image.getchannel('A')
    d=ImageDraw.Draw(image)
    tier=RANKS.index(rank)
    station,tab=STATIONS[family]
    bay=long_face(image,station)
    if bay:
        x,lo,hi=bay
        y=lo+max(2,(hi-lo)//2)
        edge='#867963' if far else '#bcaa89'
        # Raised fore-end ridges catch light only on their upper bevel. Heavy
        # kit has a contrasting collar, the compact slides have short serrations.
        if family=='rocket':
            for xx in (x,x+4):
                d.line((xx,lo+2,xx-2,hi-1),fill='#352f2a',width=2)
                d.line((xx+1,lo+2,xx,lo+5),fill=edge)
        elif hi-lo>=4:
            for i in range(2+(tier>=2)):
                xx=x+i*3
                d.line((xx,y,xx+1,y-1),fill='#302a2a')
                if hi-lo>=7:d.point((xx,y+1),fill=edge)
    plate=long_face(image,tab)
    if plate and family!='pistol':
        x,lo,hi=plate
        y=lo+max(2,round(.45*(hi-lo)))
        if hi-lo>=6 and rank!='S-plus':
            d.line((x,y,x+3,y),fill='#362e2a')
            d.line((x,y-1,x+2,y-1),fill='#c4aa7c' if not far else '#978269')
    if family=='ar':
        # Amber optic body with a single red emitter, easily read in the locker.
        optic=long_face(image,.815)
        if optic:
            x,lo,hi=optic
            d.line((x-2,hi-1,x,hi-1),fill='#632f2b')
            d.point((x,hi-1),fill='#ff6949')
    image.putalpha(alpha)
    return image


def paint_shield(image,field):
    alpha=image.getchannel('A')
    d=ImageDraw.Draw(image)
    for at in (.27,.70):
        face=long_face(image,at)
        if not face:continue
        x,lo,hi=face
        y=hi-max(2,(hi-lo)//8)
        d.point((x,y),fill='#b1a083')
        d.point((x+1,y+1),fill='#342b29')
    # A two-value rim following the lower toe reads even on a foreshortened shield.
    width=2 if not field else 1
    for at in (.42,.48,.54):
        face=long_face(image,at)
        if face:
            x,lo,hi=face
            d.line((x,hi-1,x+width-1,hi-1),fill='#7c6d5d')
    image.putalpha(alpha)
    return image


def build_catalog(destination, families=None):
    master=Image.open(MASTERS)
    rects=json.loads(master.info['sourceRects'])
    for key,(x,y,w,h) in rects.items():
        family,variant=key.split('/')
        if families and family not in families:
            continue
        rank=next(r for r in reversed(RANKS) if variant==r or variant.startswith(r+'-'))
        src=master.crop((x,y,x+w,y+h))
        image=finish(src,family,rank)
        if family in ARMS:
            image=paint_weapon(image,family,rank,variant.endswith('-far'))
        elif family=='shield':
            image=paint_shield(image,variant.endswith('-field'))
        if family in CLOTH:
            image=ranked_clothing(family,rank,image)
        image.save(destination/(key+'.png'),optimize=True)


if __name__=='__main__':
    build_catalog(ROOT/'game/art/armory/catalog')

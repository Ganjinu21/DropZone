"""Paint the approved equipment silhouettes on the same pixel grid as the field operators."""
import json
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


def starter_gear(slot):
    """Complete single items, drawn at equipment scale with the CCT kit's ink and cloth ramps."""
    sizes={'gloves':(31,23),'boots':(43,34),'pants':(47,44),'top':(47,45)}
    im=Image.new('RGBA',sizes[slot]); d=ImageDraw.Draw(im)
    shadow='#4c382d'; cloth='#846341'; tan='#ac8558'; light='#d1aa77'
    rubber='#3c3433'; steel='#786d62'
    def patch(points,fill,edge=INK):
        mask=Image.new('L',im.size)
        ImageDraw.Draw(mask).polygon(points,fill=255)
        bounds=mask.getbbox()
        x0,y0,x1,y1=bounds
        rgb=ImageColor.getrgb(fill)
        raised=tuple(round(c*.78+v*.22) for c,v in zip(rgb,(255,212,156)))
        lit=tuple(round(c*.65+v*.35) for c,v in zip(rgb,(255,219,165)))
        shade=tuple(round(c*.68+v*.32) for c,v in zip(rgb,(38,27,27)))
        ink=ImageColor.getrgb(edge)
        def inside(x,y):
            return 0<=x<mask.width and 0<=y<mask.height and mask.getpixel((x,y))
        for y in range(y0,y1):
            for x in range(x0,x1):
                if not inside(x,y):continue
                u=(x-x0)/max(1,x1-x0-1);v=(y-y0)/max(1,y1-y0-1)
                if not all(inside(x+dx,y+dy) for dx,dy in ((1,0),(-1,0),(0,1),(0,-1))):
                    color=ink
                elif not inside(x-2,y-2):
                    color=lit if u+v<.78 else raised
                elif not inside(x+2,y+2) or u+v>1.48:
                    color=shade
                else:
                    color=raised if u+.85*v<.62 else rgb
                im.putpixel((x,y),(*color,255))
    def line(points,fill,width=1):d.line(points,fill=fill,width=width)
    if slot=='gloves':
        patch([(0,10),(4,8),(7,6),(11,4),(14,3),(21,3),(22,4),(27,5),(29,6),(29,9),(26,11),(24,11),(25,14),(22,18),(17,20),(11,20),(5,17),(2,17)],shadow)
        patch([(2,10),(7,8),(9,11),(8,16),(4,16),(2,14)],cloth)
        patch([(8,9),(12,5),(18,4),(21,5),(24,8),(21,12),(17,15),(12,16),(9,14)],tan)
        patch([(12,6),(15,5),(18,5),(19,7),(17,9),(12,10)],rubber)
        line([(13,6),(16,6),(17,5)],steel);line([(9,10),(11,8),(12,8)],light)
        for x,y in ((18,11),(20,13),(17,15)):
            line([(x,y),(x+2,y-1),(x+3,y-1)],cloth)
        line([(7,16),(10,17),(13,18),(16,17)],'#57412f')
        d.point((19,10),fill=light)
        line([(23,6),(26,6),(27,7)],light);line([(4,11),(5,10),(6,10)],light)
    elif slot=='boots':
        patch([(5,1),(15,2),(20,0),(23,2),(22,10),(25,17),(27,20),(35,22),(39,25),(41,29),(40,31),(35,33),(11,33),(6,31),(2,31),(1,27),(3,22),(3,13)],shadow)
        patch([(5,3),(10,4),(17,4),(20,2),(21,6),(18,8),(15,10),(7,9)],cloth)
        patch([(4,11),(10,11),(16,9),(20,9),(21,14),(17,17),(19,21),(15,24),(8,24),(5,22)],tan)
        patch([(16,18),(22,14),(24,18),(24,20),(30,23),(35,24),(38,27),(31,28),(19,26),(12,24)],cloth)
        patch([(2,26),(10,25),(17,25),(24,27),(33,28),(39,27),(41,29),(38,31),(32,32),(10,31),(8,29),(4,30),(2,29)],rubber)
        for x in (10,16,22,28,34):line([(x,29),(x+1,30)],steel)
        for x,y in ((14,11),(15,14),(17,17)):
            line([(x-1,y),(x+1,y+1),(x+5,y-2)],rubber,2)
            line([(x,y),(x+2,y),(x+4,y-1)],light)
        line([(5,17),(7,18),(9,20),(11,21)],shadow)
        line([(5,16),(8,17),(10,19)],light)
        line([(22,22),(25,22),(27,24)],tan)
        line([(6,13),(8,11),(11,11)],light);line([(28,24),(32,24),(34,25)],light)
    elif slot=='pants':
        patch([(13,1),(29,1),(34,4),(34,10),(35,17),(39,23),(40,28),(45,35),(44,41),(36,43),(32,40),(30,33),(26,29),(22,24),(20,26),(18,34),(14,42),(6,42),(3,39),(7,28),(9,22),(8,16),(11,8)],shadow)
        patch([(13,5),(21,6),(26,5),(24,14),(21,21),(16,27),(14,32),(8,30),(12,21),(11,17)],cloth)
        patch([(25,5),(31,5),(31,12),(35,19),(34,22),(28,24),(23,18),(21,15)],tan)
        for x,y in ((9,24),(29,21)):
            patch([(x,y+2),(x+4,y),(x+8,y+1),(x+8,y+5),(x+5,y+8),(x,y+7)],cloth)
            line([(x+1,y+2),(x+5,y+1),(x+7,y+2)],light)
        line([(9,32),(13,32),(11,39),(8,39)],tan,2);line([(34,30),(38,29),(42,38)],tan,2)
        patch([(10,11),(17,10),(18,11),(16,17),(11,18),(10,16)],tan)
        line([(11,11),(16,10)],light);line([(12,3),(23,4),(33,3)],rubber,2);d.rectangle((23,2,26,5),outline=steel)
        line([(14,7),(16,7),(17,8)],light);line([(12,20),(14,19),(16,19)],light)
        line([(8,36),(11,35),(12,35)],shadow);line([(34,36),(37,36),(39,38)],cloth)
        line([(28,9),(30,11),(30,13)],shadow)
    elif slot=='top':
        patch([(9,3),(14,1),(18,2),(19,6),(28,7),(32,3),(37,3),(39,9),(42,14),(42,21),(39,24),(40,36),(36,41),(26,43),(12,42),(7,40),(6,33),(8,23),(3,20),(2,13),(5,7)],shadow)
        patch([(6,8),(10,4),(14,4),(15,7),(12,13),(10,19),(5,19),(4,16)],tan)
        line([(6,9),(9,6),(12,5)],light,2)
        patch([(14,13),(18,8),(27,9),(31,6),(35,6),(36,14),(38,17),(35,25),(29,29),(13,26),(11,21)],cloth)
        patch([(16,13),(27,12),(31,11),(33,15),(31,19),(16,21),(13,18)],tan)
        for y in (15,17):line([(16,y),(22,y),(28,y-1)],light if y==15 else cloth)
        for x,y in ((8,27),(16,26),(24,26),(32,24)):
            patch([(x,y+1),(x+6,y),(x+7,y+1),(x+7,y+9),(x+5,y+11),(x,y+10)],cloth)
            line([(x+1,y+4),(x+3,y+5),(x+6,y+4)],shadow)
            line([(x+1,y+2),(x+5,y+1)],light)
            d.point((x+3,y+5),fill='#bda789')
        line([(9,8),(10,7),(13,6)],light);line([(6,15),(8,13),(11,13)],cloth,2)
        line([(15,22),(21,23),(29,22),(33,20)],shadow,2)
        line([(15,21),(21,22),(27,21)],tan)
        line([(13,39),(24,40),(36,37)],tan,2);d.rectangle((24,38,27,40),outline=steel)
    return im.crop(im.getbbox())


def build_catalog(destination):
    master=Image.open(MASTERS)
    rects=json.loads(master.info['sourceRects'])
    for key,(x,y,w,h) in rects.items():
        family,variant=key.split('/')
        rank=next(r for r in reversed(RANKS) if variant==r or variant.startswith(r+'-'))
        src=master.crop((x,y,x+w,y+h))
        if family in ('top','gloves','pants','boots') and rank=='C':
            image=starter_gear(family)
        else:
            image=finish(src,family,rank)
            if family in ARMS:
                image=paint_weapon(image,family,rank,variant.endswith('-far'))
            elif family=='shield':
                image=paint_shield(image,variant.endswith('-field'))
        image.save(destination/(key+'.png'),optimize=True)


if __name__=='__main__':
    build_catalog(ROOT/'game/art/armory/catalog')

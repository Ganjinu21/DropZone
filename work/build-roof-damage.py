"""Cutaway roof modules at native resolution. The void, debris and lifted seams share one mask."""
from pathlib import Path
from random import Random
import math
from PIL import Image, ImageDraw

W,H=88,60
scars=[
 [(4,18),(16,18),(16,11),(30,13),(37,5),(45,9),(55,6),(61,15),(75,14),(72,25),(83,29),(77,38),(66,37),(62,48),(52,44),(43,53),(34,47),(23,50),(21,41),(11,42),(14,32),(5,30)],
 [(11,7),(36,8),(42,5),(51,8),(64,6),(62,16),(76,20),(76,37),(66,38),(65,52),(49,51),(42,55),(27,48),(18,50),(15,37),(8,30),(11,21)],
 [(4,17),(22,17),(21,8),(34,8),(35,4),(60,8),(59,17),(76,17),(79,26),(69,26),(70,42),(53,43),(48,53),(28,52),(23,45),(12,43),(13,32),(4,33)],
 [(8,34),(16,22),(27,21),(25,12),(34,13),(48,5),(59,7),(68,14),(78,14),(75,26),(82,35),(71,40),(62,39),(58,51),(47,48),(36,55),(29,46),(20,47),(18,38)]
]
palette=[('#94877a','#695e54','#373c3d'),('#9c8c73','#685842','#353b39'),
         ('#a09a8b','#69675d','#353d3c'),('#9f9080','#71685a','#393d40')]
def outline(draw,points,color):
    draw.line(points+points[:1],fill=color,width=1)
def damage(n):
    r=Random(1271+n);poly=scars[n];pale,bed,deep=palette[n]
    mask=Image.new('L',(W,H));ImageDraw.Draw(mask).polygon(poly,fill=255)
    panel=Image.new('RGBA',(W,H));d=ImageDraw.Draw(panel)
    d.rectangle((0,0,W,H),fill=deep)
    # Under the missing roof the top-left wall shades a lower floor with a different material.
    for y in range(15,H,8):
        for x in range((y%3)*-3,W,11):
            v=r.randrange(43,72)
            d.rectangle((x,y,x+9,y+6),fill=(v+4,v+4,v))
    for x,y in zip(poly,poly[1:]+poly[:1]):
        ax,ay=x;bx,by=y
        if bx>ax:
            d.polygon([x,y,(bx+1,by+7),(ax+1,ay+7)],fill=bed)
            d.line([x,y],fill=pale)
            for k in range(ax+2,bx,3):
                f=(k-ax)/(bx-ax); h=round(ay+(by-ay)*f)
                d.line((k,h+2,k,h+r.randint(3,6)),fill='#494844')
    # Broken spanning beams expose rooms underneath. Some are snapped and droop.
    for j,x in enumerate(range(14+n*2,79,15)):
        y0=7+r.randrange(7);y1=42+r.randrange(12)
        if (j+n)%3==0:y1=25+r.randrange(9)
        d.rectangle((x+3,y0+5,x+7,y1+5),fill='#282f2e')
        d.rectangle((x,y0,x+4,y1),fill='#443c36')
        d.line((x,y0,x,y1-1),fill='#bf9a75')
        d.line((x+2,y0,x+2,y1-2),fill='#956e54')
        for y in range(y0+2,y1,7):d.point((x+2,y),fill='#cfb691')
        if y1<38:d.line([(x+2,y1),(x+1,y1+3),(x+2,y1+6)],fill='#8c8073')
    for _ in range(66):
        x,y=r.randrange(5,W-3),r.randrange(13,H-3);size=r.randrange(2,6)
        d.rectangle((x+1,y+2,x+size,y+3),fill='#343938')
        d.line((x,y,x+size,y),fill=r.choice([bed,'#848176','#916f55','#a1937c','#645f56']))
        d.point((x,y-1),fill=pale)
    # A different silhouette reads from the street in each case.
    if n in (0,1):
        points=[(46,12),(64,15),(59,29),(44,25)] if n==0 else [(22,29),(48,23),(51,36),(25,42)]
        d.polygon(points,fill='#7d8178')
        for i in range(1,5):
            t=i/6; q=lambda a,b:tuple(round(v+(w-v)*t) for v,w in zip(a,b))
            d.line([q(points[0],points[1]),q(points[3],points[2])],fill='#aaa997')
        outline(d,points,'#595e58')
    if n==2:
        d.rectangle((24,20,39,31),fill='#586769')
        d.rectangle((25,21,38,22),fill='#8c9e98')
        d.line((24,30,38,30),fill='#8c9e98')
    # Fractures run from the edge into surviving roof membrane.
    out=Image.new('RGBA',(W,H));s=ImageDraw.Draw(out)
    for i in range(n,len(poly),4):
        x,y=poly[i];dx=1 if x>44 else -1;dy=1 if y>30 else -1
        s.line([(x,y),(x+dx*3,y+dy*2),(x+dx*5,y+dy*2),(x+dx*6,y+dy*6)],fill='#49514c')
    out.paste(panel,mask=mask);s=ImageDraw.Draw(out)
    for i in range(0,len(poly),2):
        a,b=poly[i],poly[(i+1)%len(poly)]
        s.line([a,b],fill=pale if i%4 else '#6e7169')
        x,y=a
        for _ in range(3):
            dx,dy=r.randint(-4,4),r.randint(-3,3)
            s.rectangle((x+dx,y+dy,x+dx+r.randint(1,3),y+dy+1),fill=r.choice([bed,pale,'#706e65']))
    return out
atlas=Image.new('RGBA',(W*4,H))
for i in range(4):atlas.paste(damage(i),(i*W,0))
atlas.save(Path(__file__).resolve().parents[1]/'game'/'roof-damage.png',optimize=True)

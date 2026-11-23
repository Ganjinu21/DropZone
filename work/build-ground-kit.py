"""Eight material variations per row. First four rows are seamless; fifth is decals."""
from pathlib import Path
from random import Random
from PIL import Image, ImageDraw

CELL = 32
sheet = Image.new("RGBA", (CELL*8, CELL*7))

def tint(c, delta):
    return tuple(min(255,max(0,p+delta)) for p in c)

def pebbles(d, r, base, count, lo, hi):
    for _ in range(count):
        x,y = r.randrange(CELL),r.randrange(CELL)
        a=r.choices([1,2,3],[.68,.29,.03])[0]
        d.line((x,y,x+a-1,y),fill=tint(base,r.randint(lo,hi)))

for col in range(8):
    for row in range(5):
        r=Random(15200+col*49+row*201)
        tile=Image.new("RGBA",(CELL,CELL))
        d=ImageDraw.Draw(tile)
        if row==0:
            base=(65,68,71)
            d.rectangle((0,0,31,31), fill=base)
            for _ in range(60):
                x,y=r.randrange(32),r.randrange(32)
                d.rectangle((x,y,x+r.randint(1,6),y+r.randint(1,3)),fill=tint(base,r.randint(-3,3)))
            pebbles(d,r,base,230,-10,10)
            pebbles(d,r,base,12,-16,16)
        elif row==1:
            for i in range(4):
                y=i*8; shift=8 if i%2 else 0
                for x in range(shift-16,32,16):
                    b=tint((103,103,97),r.randint(-5,5))
                    d.rectangle((x,y,x+15,y+7),fill=tint(b,-21))
                    d.rectangle((x,y,x+14,y+6),fill=b)
                    d.line((x+1,y,x+13,y),fill=tint(b,9))
            pebbles(d,r,(103,103,97),78,-12,11)
        elif row==2:
            base=(85,88,86)
            d.rectangle((0,0,31,31),fill=base)
            pebbles(d,r,base,185,-13,11)
            d.line((0,0,31,0),fill='#555953')
            d.line((0,0,0,31),fill='#61635e')
            if col in (1,6):
                d.line((1,12,5,13,7,15,11,14,16,18,17,21),fill='#484d49')
        elif row==3:
            base=(76,75,68)
            d.rectangle((0,0,31,31),fill=base)
            pebbles(d,r,base,205,-11,10)
            if col%4==1:
                d.line((7,24,10,23,18,23,24,20),fill='#41463f')
            if col in (0,4):
                for j in range(3):
                    x,y=r.randint(3,29),r.randint(3,29)
                    d.line((x,y,x+2,y),fill='#9d9380')
        else:
            if col==0: # drain set in an iron frame
                d.rectangle((2,11,28,21),fill='#2f3437')
                d.rectangle((2,11,28,12),fill='#838780')
                for x in range(4,27,4):
                    d.rectangle((x,14,x+1,18),fill='#696e68')
            elif col==1: # ridged utility cover
                d.ellipse((3,5,28,26),fill='#353b3b',outline='#777a6e',width=2)
                d.ellipse((6,8,25,23),outline='#535c57')
                for j in range(4): d.line((9,11+j*3,21,11+j*3),fill='#636a63')
            elif col in (2,3): # shattered brick / rendered masonry
                for _ in range(25):
                    x,y=r.randint(2,25),r.randint(6,25)
                    a=r.randint(1,5)
                    d.rectangle((x+1,y+1,x+a,y+3),fill='#3b3c39')
                    d.polygon([(x,y+2),(x+1,y-1),(x+a,y),(x+a-1,y+2)],fill=r.choice(['#89877a','#9a8777','#756459','#7e7d71']))
            elif col==4:
                for j in range(18):
                    x,y=r.randint(4,28),r.randint(16,27)
                    d.line((x,y,x+r.randint(-4,3),y-r.randint(2,8)),fill=r.choice(['#535c44','#657054','#7a805b']))
            elif col==5:
                d.rectangle((0,0,31,31),fill='#b79c63')
                for y in range(3,32,6):
                    for x in range(2,32,6):
                        d.rectangle((x,y,x+1,y+2),fill='#887543')
                        d.point((x,y),fill='#cfba7e')
            elif col==6:
                for j in range(13):
                    x,y=r.randrange(2,28),r.randrange(4,26)
                    d.line((x,y,x+3,y+1),fill=r.choice(['#9fa997','#858876','#bab8a7']))
            else:
                d.rectangle((2,3,28,27),fill='#64665e',outline='#3f4443')
                d.rectangle((4,5,26,25),outline='#72736b')
                for y in (10,18):d.line((20,y,23,y),fill='#383e3d')
        sheet.paste(tile,(col*CELL,row*CELL))

def tree(col, dead=False):
    """Planting well, roots, boughs and two nested leaf canopies."""
    r=Random(3610+col)
    tile=Image.new("RGBA",(64,64));d=ImageDraw.Draw(tile)
    d.ellipse((12,32,61,55),fill=(27,32,34,66))
    d.rectangle((15,26,46,51),fill='#464e48')
    d.rectangle((15,25,46,48),fill='#9c9987')
    d.rectangle((18,28,43,46),fill='#514e41')
    for _ in range(35):
        x,y=r.randrange(19,43),r.randrange(29,46)
        d.point((x,y),fill=r.choice(('#7a755d','#67634c','#433f37')))
    d.line((32,44,30,35,31,21),fill='#484a3d',width=4)
    d.line((31,43,30,36,30,21),fill='#837b5d',width=2)
    branch_tips=[]
    for i in range(19):
        side=-1 if i%2==0 else 1
        bx,by=31+side*r.randrange(4,15),r.randrange(12,31)
        tx,ty=max(3,min(59,bx+side*r.randrange(2,13))),max(2,by-r.randrange(4,11))
        d.line((31,36,bx,by,tx,ty),fill=r.choice(['#514d3f','#625a4a','#554f42']),width=2)
        d.line((bx,by,bx+side*7,by-r.randrange(2,8)),fill='#81785c')
        branch_tips.append((tx,ty))
    leaf_dark=['#454e40','#455247','#555643','#585a45']
    leaf_mid=['#616a51','#61705b','#757054','#727257']
    leaf_lit=['#7d8060','#83937a','#9b8b68','#989871']
    if not dead:
        for j,(x,y) in enumerate(sorted(branch_tips,key=lambda p:p[1])):
            radius=r.randrange(4,9); k=col%4
            # Lozenge clusters avoid a round, uniform lollipop silhouette.
            d.polygon([(x-radius,y-2),(x-2,y-radius),(x+3,y-radius+1),(x+radius,y-1),(x+radius-1,y+3),(x+1,y+radius),(x-radius+1,y+4)],fill=leaf_dark[k])
            for i in range(12):
                xx,yy=x+r.randrange(-radius+1,radius),y+r.randrange(-radius+1,radius)
                if (xx-x)**2+(yy-y)**2>radius**2:continue
                d.rectangle((xx,yy,xx+r.randrange(1,3),yy+1),fill=r.choice([leaf_mid[k],leaf_mid[k],leaf_dark[k],leaf_lit[k]]))
    else:
        for j,(x,y) in enumerate(branch_tips):
            if j%3==0:
                d.line((x-1,y,x+2,y),fill='#867b57')
    return tile

for idx in range(4):
    sheet.paste(tree(idx,idx==3),(idx*64,5*CELL))

sheet.save(Path(__file__).resolve().parents[1]/"game"/"ground-kit.png", optimize=True)

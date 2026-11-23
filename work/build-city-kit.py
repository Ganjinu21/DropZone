"""Author the 64px-cell, transparent architecture atlas used by city-kit.js.

Rows are building families. Roof materials, wall bays, entries, return walls
and removable fixtures occupy independent cells; draw only their content rects.
Run with Pillow installed: python work/build-city-kit.py
"""
from pathlib import Path
import math
import random
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / 'game' / 'city-kit.png'
CELL = 64
atlas = Image.new('RGBA', (12 * CELL, 9 * CELL))
# roof / sunny parapet / masonry / stone sill / paint or glazing / window / shadow
families = [
    ('office',     ['#7d827b','#b9b8a6','#849187','#c9cbb6','#729698','#344b50','#324346']),
    ('hospital',   ['#9d9e8c','#d7d6b8','#acb1a3','#d4d5c2','#68a39a','#426061','#3c5351']),
    ('apartment',  ['#708575','#a3ac91','#9c8d78','#c1b297','#8a998a','#4c605f','#494d45']),
    ('warehouse',  ['#697b7b','#9ba69a','#8d8174','#b6ab91','#8b7663','#51564e','#48483d']),
    ('market',     ['#8c7970','#c2a58b','#a19179','#c5ae90','#b77753','#555c50','#524b3f']),
    ('retail',     ['#778a86','#a8b5a0','#918d7a','#c2b69a','#678d85','#3c5253','#494c41']),
    ('tower',      ['#6a7e82','#b2bdb1','#758487','#bcc5b6','#70959b','#344b58','#30464d']),
]

def rgb(col):
    return tuple(bytes.fromhex(col[1:])) if isinstance(col,str) else col

def shade(col, delta):
    return tuple(max(0,min(255,c+delta)) for c in rgb(col))

def mix(a,b,t):
    return tuple(round(c*(1-t)+d*t) for c,d in zip(rgb(a),rgb(b)))

def stamp(col,row,im):
    atlas.alpha_composite(im,(col*CELL,row*CELL))

def make(w,h):
    im = Image.new('RGBA',(w,h))
    return im,ImageDraw.Draw(im)

def grit(d,box,col,seed,density=.28,strength=12):
    x0,y0,x1,y1=box
    rng=random.Random(seed)
    for _ in range(int((x1-x0+1)*(y1-y0+1)*density)):
        x,y=rng.randint(x0,x1),rng.randint(y0,y1)
        delta=rng.choice([-strength,-strength//2,3,strength//2,strength])
        d.point((x,y),fill=shade(col,delta))

def roof(kind,p,seed,var):
    im,d=make(36,36)
    c=shade(p[0], (0,-9,6)[var])
    d.rectangle((0,0,35,35),fill=c)
    rng=random.Random(seed+var*27)
    # Careful use of small patches gives wear without gridding the entire roof.
    for i in range(12):
        x,y=rng.randrange(35),rng.randrange(35)
        d.rectangle((x,y,x+rng.randrange(2,8),y+rng.randrange(1,4)),fill=shade(c,rng.choice([-6,-4,3,5])))
    grit(d,(0,0,35,35),c,seed+var,strength=9)
    if kind in ('warehouse','market'):
        for x in range(1,36,6):
            d.line((x,0,x,35),fill=shade(c,-19),width=2)
            d.line((x+2,0,x+2,35),fill=shade(c,15))
            d.point((x+2,4),fill=shade(c,43))
            d.point((x+2,23),fill=shade(c,-32))
        d.line((0,34,35,34),fill=shade(c,-20))
        d.line((0,35,35,35),fill=shade(c,8))
    elif kind in ('office','hospital','tower'):
        d.line((0,0,35,0),fill=shade(c,12))
        d.line((0,35,35,35),fill=shade(c,-13))
        if var==2:
            d.line((17,1,17,34),fill=shade(c,-13))
            d.line((18,1,18,34),fill=shade(c,7))
    elif var==1:
        d.line(((2,20),(7,18),(8,14),(13,12),(15,9)),fill=shade(c,-15))
    return im

def glazing(d,x,y,w,h,p,var=0):
    glass=rgb(p[5]); bright=rgb(p[4])
    d.rectangle((x,y,x+w-1,y+h-1),fill=shade(p[6],-13))
    d.rectangle((x+2,y+2,x+w-3,y+h-3),fill=glass)
    d.polygon([(x+2,y+2),(x+w-4,y+2),(x+w-4,y+5),(x+4,y+h-4),(x+2,y+h-4)],fill=mix(glass,bright,.37))
    d.line((x+2,y+h-3,x+w-3,y+h-3),fill=shade(glass,-8))
    d.line((x+1,y+h-1,x+w-2,y+h-1),fill=shade(p[3],-18))
    if var==1:
        for yy in range(y+3,y+h-4,3):
            d.line((x+3,yy,x+w-4,yy),fill=mix(glass,bright,.63))
    if var==2 and h>9:
        d.line([(x+4,y+2),(x+8,y+6),(x+6,y+8),(x+10,y+h-3)],fill=shade(glass,31))
        d.line([(x+8,y+6),(x+w-4,y+4)],fill=shade(glass,22))

def wall(kind,p,seed,var):
    im,d=make(40,30); c=p[2]; ink=p[6]
    d.rectangle((0,0,39,29),fill=c); grit(d,(0,0,39,29),c,seed+var)
    d.line((0,0,39,0),fill=p[3]); d.line((0,29,39,29),fill=shade(ink,4))
    if kind in ('office','tower'):
        glazing(d,2,1,36,24,p,var)
        mid=20 if kind=='office' else 12
        for x in range(mid,37,14 if kind=='tower' else 26):
            d.line((x,1,x,24),fill=ink,width=2);d.line((x+2,1,x+2,24),fill=shade(c,-3))
        d.line((3,17,36,17),fill=mix(c,ink,.55))
        d.rectangle((1,25,38,28),fill=shade(c,-9))
        if kind=='tower': d.line((4,27,36,27),fill=p[3])
    elif kind=='apartment':
        glazing(d,2,2,23,17,p,var)
        glazing(d,26,3,11,16,p)
        d.line((13,3,13,17),fill=p[3])
        # Projecting balconies and individual balusters.
        d.rectangle((1,17,37,24),fill=shade(c,-18))
        for x in range(3,37,5):d.line((x,17,x,23),fill=ink)
        d.rectangle((1,15,38,16),fill=p[3]);d.rectangle((0,24,39,26),fill=p[3])
        d.rectangle((1,27,38,28),fill=shade(c,-28))
        if var==1:
            d.rectangle((7,16,10,22),fill='#7e9a92');d.rectangle((12,16,19,20),fill='#b2a790')
    elif kind=='hospital':
        glazing(d,3,4,21,15,p,var);glazing(d,25,4,12,15,p)
        d.rectangle((0,22,39,23),fill=p[4]);d.line((0,24,39,24),fill=shade(p[4],-10))
        d.line((2,26,2,29),fill=shade(c,-21))
    elif kind=='warehouse':
        d.rectangle((0,0,39,29),fill=shade(c,-4))
        for y in range(2,30,5):
            d.line((0,y,39,y),fill=shade(c,14));d.line((0,y+2,39,y+2),fill=shade(c,-14))
        for x in [0,37]:d.rectangle((x,0,x+2,29),fill=ink)
        glazing(d,5,4,28,10,p,var)
        for x in (13,23):d.line((x,6,x,12),fill=c)
    else:
        glazing(d,2,3,35,22,p,var)
        d.rectangle((2,19,36,24),fill=shade(c,-28))
        # Items in darkened storefront: little stacks of newspapers / bakery trays.
        for n in range(4):
            xx=4+7*n;hh=1+((var+n)*3)%5
            d.rectangle((xx,20-hh,xx+4,20),fill=[shade(c,-5),p[4],shade(p[3],-18)][(n+var)%3])
        d.rectangle((19,3,20,24),fill=ink)
        d.rectangle((0,0,39,2),fill=p[3]);d.line((2,27,36,27),fill=shade(c,11))
    return im

def service_wall(kind,p,seed):
    im,d=make(40,30);c=shade(p[2],-8);d.rectangle((0,0,39,29),fill=c)
    grit(d,(0,0,39,29),c,seed,.36,12)
    if kind in ('warehouse','market','retail','apartment'):
        for y in range(4,30,6):
            d.line((0,y,39,y),fill=shade(c,-11))
            for x in range((y%12)+1,40,16):d.line((x,y-5,x,y),fill=shade(c,-11))
    else:
        d.line((0,16,39,16),fill=shade(c,-13));d.line((18,0,18,15),fill=shade(c,-13))
    d.line((0,28,39,28),fill=shade(c,12));d.line((0,29,39,29),fill=p[6])
    return im

def entry(kind,p):
    im,d=make(40,32);ink=p[6];d.rectangle((0,0,39,31),fill=shade(p[2],-8))
    d.rectangle((2,1,37,29),fill=ink);d.rectangle((4,2,35,29),fill=p[3])
    if kind in ('warehouse','market'):
        d.rectangle((6,4,33,27),fill=shade(p[2],-22))
        for yy in range(5,27,3):
            d.line((7,yy,32,yy),fill=shade(p[2],6))
        d.rectangle((15,24,24,26),fill=ink);d.point((19,25),fill='#c1b9ac')
    else:
        for x in (6,20):
            d.rectangle((x,5,x+12,27),fill=shade(p[5],-12))
            glazing(d,x+1,6,11,15,p)
            d.line((x+3,23,x+5,23),fill=shade(p[3],15))
        d.rectangle((6,2,33,4),fill=shade(p[4],-10))
    d.rectangle((0,29,39,30),fill=shade(p[3],8));d.line((0,31,39,31),fill=p[6])
    return im

for row,(kind,p) in enumerate(families):
    for v in range(3):
        stamp(v,row,roof(kind,p,row*317,v))
        stamp(3+v,row,wall(kind,p,row*27,v))
    stamp(6,row,service_wall(kind,p,row*123));stamp(7,row,entry(kind,p))
    # Cardinal canopies seen from above. Their lit left and top lips are in world space.
    for k,direction in enumerate('SENW'):
        im,d=make(38,20); c=p[4];s=p[6]
        d.rectangle((1,6,36,19),fill=shade(s,-8))
        d.rectangle((3,11,34,18),fill=shade(p[2],-7))
        for yy in (13,16):d.line((4,yy,33,yy),fill=shade(p[3],7))
        d.rectangle((0,0,37,10),fill=s)
        d.rectangle((1,1,36,8),fill=c)
        for xx in range(4,34,5):d.line((xx,2,xx,7),fill=shade(c,-15))
        d.line((1,1,35,1),fill=shade(c,35));d.line((1,8,35,8),fill=shade(c,14))
        if direction=='E':im=im.transpose(Image.Transpose.ROTATE_90)
        if direction=='N':im=im.transpose(Image.Transpose.ROTATE_180)
        if direction=='W':im=im.transpose(Image.Transpose.ROTATE_270)
        stamp(8+k,row,im)

def metalbox(d,x,y,w,h,deck,lit,side,depth=5):
    d.rectangle((x+3,y+4,x+w+1,y+h+1),fill=(26,33,36,90))
    d.rectangle((x,y,x+w-1,y+h-1),fill=side)
    d.rectangle((x+1,y+1,x+w-3,y+h-depth),fill=deck)
    d.line((x,y,x+w-2,y),fill=lit);d.line((x,y,x,y+h-depth),fill=lit)
    d.line((x+1,y+h-depth,x+w-3,y+h-depth),fill=shade(deck,15))
    d.line((x+w-2,y+1,x+w-2,y+h-2),fill=shade(side,10))
    d.line((x+1,y+h-2,x+w-2,y+h-2),fill=shade(side,-10))

def fan(d,cx,cy,r):
    d.ellipse((cx-r,cy-r,cx+r,cy+r), fill='#525b58', outline='#a2a799')
    d.ellipse((cx-r+2,cy-r+2,cx+r-2,cy+r-2), fill='#394743')
    for i in range(5):
        angle=(i*2*math.pi)/5
        def pos(rad,off):
            return (cx+round(rad*math.cos(angle+off)),cy+round(rad*math.sin(angle+off)))
        d.polygon([pos(2,.15),pos(r-2,.15),pos(r-3,.57),pos(3,.87)],fill='#78847b')
    d.ellipse((cx-2,cy-2,cx+2,cy+2),fill='#a0a696')
    for xx in range(cx-r+3,cx+r-2,4):
        dy=int(math.sqrt(max(0,(r-2)**2-(xx-cx)**2)))
        d.line((xx,cy-dy,xx,cy+dy),fill='#59635b')

def detail(i):
    im,d=make(64,64)
    if i in (0,1): # twin-fan cooling cabinet and single compact AC
        w,h=(47,28) if i==0 else (24,21)
        metalbox(d,1,1,w,h,'#909a8c','#c2c3aa','#505c5b',6)
        for xx in ([13,34] if i==0 else [12]):fan(d,xx,11,8 if i==0 else 7)
        for xx in range(6,w-3,4):d.point((xx,h-4),fill='#9b9c87')
        d.rectangle((3,h-2,6,h+1),fill='#394440');d.rectangle((w-7,h-2,w-4,h+1),fill='#394440')
    elif i==2: # Korean rooftop blue horizontal water tank, two saddles, fill cap
        d.ellipse((5,13,36,26), fill=(23,34,34,85))
        for xx in (6,26):d.rectangle((xx,14,xx+5,25),fill='#51514a')
        d.rounded_rectangle((2,4,36,21),radius=7,fill='#475d64',outline='#364a50')
        d.rounded_rectangle((3,3,33,18),radius=6,fill='#678b92')
        d.line((9,4,28,4),fill='#a9b9b0',width=2)
        for xx in (9,26):
            d.line((xx,4,xx,18),fill='#4e676c',width=2);d.line((xx+1,4,xx+1,16),fill='#a1ada1')
        d.rectangle((15,2,20,4),fill='#41575a');d.rectangle((15,1,20,2),fill='#a2b1a2')
        d.line([(35,13),(41,13),(41,21),(45,21)],fill='#808e80',width=3)
    elif i==3: # lift motor room with heavy access door, glass blocks, flashing
        metalbox(d,1,1,51,36,'#a5a698','#cac7b0','#696e65',15)
        grit(d,(4,3,48,18),'#a6a799',522,.35,14)
        d.rectangle((6,21,17,33),fill='#4d5752');d.rectangle((8,22,15,33),fill='#7b8880')
        d.point((13,28),fill='#d6d1ba');d.rectangle((30,23,44,29),fill='#465451')
        for xx in (32,36,40):d.rectangle((xx,24,xx+2,27),fill='#8aa296')
        d.line((1,20,49,20),fill='#c4c0a8')
    elif i==4: # monitor skylight
        metalbox(d,1,1,48,23,'#62797a','#b2b9a5','#505c59',5)
        for j in range(4):
            xx=4+j*11;d.rectangle((xx,3,xx+8,16),fill='#91a79c')
            d.polygon([(xx+1,5),(xx+6,5),(xx+1,11)],fill='#bdc4ab')
            d.rectangle((xx,12,xx+8,16),fill='#728983')
            d.line((xx,10,xx+8,10),fill='#a9b4a0')
    elif i==5: # fine antenna and insulators
        d.line((3,33,40,43),fill=(25,32,34,95),width=2)
        d.rectangle((13,34,25,38),fill='#4e5852');d.rectangle((14,32,24,35),fill='#a1a597')
        d.line((19,1,19,33),fill='#394942',width=3);d.line((19,0,19,33),fill='#c0c4b2')
        for x,y,w in ((1,6,35),(4,12,27),(9,18,18)):
            d.line((x,y,x+w,y),fill='#474e48',width=2);d.line((x,y-1,x+w,y-1),fill='#adb4a3')
        d.line([(19,20),(8,34),(7,34)],fill='#798479')
    elif i==6: # elbowed exhaust duct
        d.line([(3,6),(24,6),(24,20),(45,20)],fill='#525e5b',width=10)
        d.line([(2,3),(22,3),(22,17),(44,17)],fill='#a3ab9a',width=6)
        for xx,yy in ((8,1),(16,1),(32,15),(40,15)):d.line((xx,yy,xx,yy+8),fill='#74827a',width=2)
        d.line((19,11,27,11),fill='#727d76',width=2)
    elif i==7: # chipped chimney, terracotta with dark throat
        metalbox(d,2,3,20,24,'#ac8972','#c1a48c','#816c60',12)
        d.rectangle((6,6,16,11),fill='#4d4b45');d.line((4,18,18,18),fill='#9a8571')
        d.line((10,14,10,18),fill='#a28a76');d.line((14,19,14,23),fill='#a28a76')
    elif i==8: # solar row
        metalbox(d,2,2,53,24,'#5c7881','#b2b5a1','#3d5054',4)
        for xx in (4,21,38):
            d.rectangle((xx,3,xx+14,17),fill='#455f6c')
            for yy in (6,10,14):d.line((xx,yy,xx+13,yy),fill='#738b8f')
            d.line((xx+7,3,xx+7,17),fill='#87999a')
    elif i==9: # rotating cowls, exhaust flues
        for xx,yy in [(1,8),(14,3),(26,11)]:
            d.rectangle((xx,yy+4,xx+9,yy+15),fill='#65726d')
            d.ellipse((xx-1,yy+10,xx+10,yy+16),fill='#69756f')
            d.ellipse((xx-1,yy,xx+10,yy+8),fill='#a6ac99',outline='#63746e')
            d.arc((xx+1,yy+1,xx+7,yy+8),180,330,fill='#d8d3b6')
    elif i==10: # stair bulkhead canopy + bolt shadows
        metalbox(d,1,1,38,26,'#878e7c','#b3b5a0','#677365',8)
        for xx in range(4,37,4):d.line((xx,3,xx,16),fill='#75816f')
        d.rectangle((17,18,26,24),fill='#495b52');d.point((24,21),fill='#bdbaa4')
    elif i==11: # tar patch over old duct penetration
        d.polygon([(1,5),(6,2),(25,2),(32,8),(31,16),(21,20),(3,16)],fill='#575950')
        d.line([(3,5),(20,3),(31,8)],fill='#959785')
        for x in range(6,28,5):d.point((x,6),fill='#a1a18f')
        d.line([(7,8),(9,10),(17,10),(24,14)],fill='#494c44')
    return im
for i in range(12):stamp(i,7,detail(i))

def fittings(i):
    im,d=make(64,64)
    if i in (0,1,2): # empty frame, snapped fascia, surviving enamel plaque
        for xx in (4,27):d.rectangle((xx,1,xx+2,14),fill='#514c43')
        if i==0:
            d.rectangle((0,3,34,11),outline='#6f7467');d.line((3,9,27,4),fill='#929780')
            d.line([(29,9),(30,13),(27,16),(29,18)],fill='#575950')
        else:
            poly=[(0,2),(34,2),(34,12),(0,12)] if i==2 else [(0,2),(29,2),(28,4),(31,7),(24,8),(24,12),(0,12)]
            d.polygon(poly,fill='#656c59' if i==2 else '#725749',outline='#4c5147')
            d.line((2,3,26,3),fill='#ab9c7d')
            # Faded remnants of the lettering on the enamel. Do not stamp on every bay.
            for xx,yy in [(4,5),(12,5),(19,5)]:
                d.line((xx,yy,xx+4,yy),fill='#c5b99b')
                d.line((xx+2,yy+1,xx+2,yy+4),fill='#c5b99b')
                d.line((xx,yy+5,xx+4,yy+5),fill='#c5b99b')
    elif i==3: # wall service panel, back wall
        metalbox(d,1,1,15,12,'#8d988a','#b3b6a0','#55605b',3)
        for y in (3,5,7):d.line((3,y,11,y),fill='#53615b')
        d.line([(15,8),(18,8),(18,18),(23,18)],fill='#5c655e',width=2)
    elif i==4: # masonry fracture and loose edge chips
        for pts in [[(3,1),(7,5),(7,8),(12,9),(13,13),(17,16)],[(7,8),(4,11),(3,14)]]:
            d.line([(x+1,y) for x,y in pts], fill=(193,187,163,150))
            d.line(pts,fill=(64,66,58,205))
    elif i==5: # damp curtain under parapet
        for x,h in [(2,8),(3,13),(5,16),(6,10),(10,6),(15,4),(16,7),(24,3)]:
            d.line((x,0,x,h),fill=(66,70,54,65))
    elif i==6: # fire escape grille / ladder on return wall
        d.rectangle((1,1,12,27),fill=(35,37,31,120))
        for x in [0,10]:d.line((x,0,x,27),fill='#aaa99a')
        for y in range(2,26,5):
            d.line((1,y,10,y),fill='#9c9c88');d.line((1,y+1,10,y+1),fill='#576157')
    elif i==7: # empty sign mounting holes, rust drips
        for xx in (2,22):
            d.line((xx,2,xx,9),fill='#8a7663')
            d.rectangle((xx-1,1,xx+2,3),fill='#555b51');d.point((xx,1),fill='#bbb8a0')
    elif i==8: # hospital entry marker
        d.rectangle((0,0,12,12),fill='#b9c3af',outline='#6a8273')
        d.rectangle((5,2,7,10),fill='#507e70');d.rectangle((2,5,10,7),fill='#507e70')
    elif i==9: # split cladding / tar membrane
        d.polygon([(1,2),(9,1),(13,4),(22,4),(25,8),(15,11),(10,8),(6,8)],fill='#626256')
        d.line([(1,2),(9,1),(13,4),(22,4)],fill='#a6a38c')
        d.line([(15,6),(20,7),(16,9)],fill='#454d43')
    elif i==10: # folded awning, striped fabric
        d.rectangle((1,1,37,6),fill='#6c8071')
        for x in range(3,36,7):d.rectangle((x,2,x+2,5),fill='#a4ac8e')
        d.line((1,6,37,6),fill='#47594c')
    elif i==11: # small square glass blocks for stair return
        d.rectangle((0,0,16,12),fill='#61726b')
        for x in range(1,16,5):
            for y in (1,7):
                d.rectangle((x,y,x+3,y+3),fill='#9ba99c');d.point((x,y),fill='#c4c7ac')
    return im
for i in range(12):stamp(i,8,fittings(i))
atlas.save(OUT,optimize=True)

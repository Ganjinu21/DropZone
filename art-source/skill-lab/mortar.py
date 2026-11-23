"""Bake the Hammer operator, launcher handoff and fictional area-effect animation."""
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw
from mortar_blasts import bake as bake_blasts

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "design/skill-lab/mortar"
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = Image.open(ROOT / "game/combat-units.png").convert("RGBA")
EDGE = "#20272c"
DARK = "#324249"
STEEL = "#516168"
LIT = "#859195"
PALE = "#bdc2b4"
COPPER = "#9d513a"
ORANGE = "#d7753b"
GOLD = "#f5ab58"
TEAL = "#357777"
SEA = "#67aaa1"


def blank(size):
    return Image.new("RGBA", size)


def painter(im, dx=0, dy=0):
    pen = ImageDraw.Draw(im)
    def points(coords):
        return [(round(x+dx),round(y+dy)) for x,y in zip(coords[::2],coords[1::2])]
    def poly(color,*coords):
        pen.polygon(points(coords),fill=color)
    def line(color,*coords,width=1):
        pen.line(points(coords),fill=color,width=width)
    def box(color,x,y,xx,yy):
        pen.rectangle((x+dx,y+dy,xx+dx,yy+dy),fill=color)
    return poly,line,box


def canisters(im,x,y):
    p,l,b=painter(im,x,y)
    p(EDGE,0,7,3,3,5,3,6,1,10,0,13,2,15,9,15,25,11,30,3,29,0,25)
    p(DARK,1,8,4,5,7,5,8,4,12,4,13,11,13,24,9,27,3,26)
    for xx,yy in [(1,4),(7,1)]:
        p(EDGE,xx,yy+4,xx+2,yy+1,xx+4,yy,xx+6,yy+2,xx+6,yy+16,xx+4,yy+19,xx+1,yy+19)
        p(STEEL,xx+1,yy+5,xx+3,yy+2,xx+4,yy+2,xx+5,yy+4,xx+5,yy+16,xx+1,yy+17)
        l(LIT,xx+2,yy+5,xx+2,yy+14)
        l(ORANGE,xx+1,yy+7,xx+5,yy+6,width=2)
        l(PALE,xx+3,yy+2,xx+4,yy+2)
    p("#665943",0,18,13,14,14,18,1,22)
    l("#ab9564",1,18,13,15)
    b("#bbc1a2",8,16,10,18)
    l(EDGE,1,25,8,27,12,25)
    l(STEEL,2,23,7,24)


def torso(im,x,y):
    p,l,b=painter(im,x,y)
    p(EDGE,16,28,21,24,30,23,39,26,43,30,42,40,38,47,22,48,15,44,13,37)
    p(DARK,17,28,24,25,32,24,39,27,41,32,39,41,36,45,23,46,17,42,15,34)
    p(STEEL,18,28,22,26,31,25,38,28,36,35,26,40,17,38)
    p("#728080",18,28,23,26,28,26,27,29,23,31,17,32)
    p("#465158",25,31,33,29,39,30,37,38,31,42,23,40)
    p("#766447",18,27,22,26,31,40,29,43,26,41)
    l("#a78e60",19,27,28,40)
    p(TEAL,25,25,32,24,40,25,38,28,32,32,26,30)
    l(SEA,27,26,31,28,37,26)
    p(EDGE,20,38,24,37,28,39,27,44,21,45,19,42)
    b("#6b6653",21,39,26,42);l("#9a947a",21,39,25,38)
    p(EDGE,29,38,37,36,39,38,38,43,31,45,29,43)
    l("#879282",30,39,37,37,width=2)
    l(ORANGE,32,41,35,40);l(EDGE,20,45,34,46,38,43,width=2)
    b("#c6a266",28,43,31,45)


def head(im,x,y):
    p,l,b=painter(im,x,y)
    # A wide sun-baked helmet with a swept back shell and small cheek guard.
    p(EDGE,20,21,18,17,19,11,22,7,28,4,34,3,39,5,42,9,43,14,46,15,46,18,42,19,42,24,39,28,32,30,25,28,23,25)
    p("#614235",20,16,21,12,23,9,28,6,35,5,39,7,41,11,42,15,42,17,26,23,22,20)
    p(COPPER,20,14,23,9,28,6,34,5,39,8,40,13,34,15,24,18,20,17)
    p(ORANGE,22,12,24,9,29,7,34,6,38,8,38,10,31,12,25,15,21,15)
    p(GOLD,23,11,26,8,30,7,33,7,29,9,25,12)
    l("#ffcf79",25,9,29,7)
    p("#543e35",31,6,33,5,36,6,39,9,37,10)
    l("#ef9b51",34,6,37,8,38,10)
    p(EDGE,23,16,41,11,43,14,46,15,45,17,28,21,23,21)
    p("#5c6868",26,16,40,13,42,14,43,15,30,18,26,19)
    l("#9eaaa2",31,15,39,13)
    p("#6d493a",26,21,32,18,41,17,42,21,43,22,41,23,40,26,36,28,31,27,27,24)
    p("#bb7854",30,20,36,18,40,18,40,21,42,22,39,23,39,25,36,26,31,25)
    p("#edaa71",34,20,38,18,39,19,39,21,41,22,38,22,36,24,33,23)
    l("#563f38",34,20,38,19);l("#ffe0a4",36,20,38,20)
    b(EDGE,38,20,38,21);l("#513d35",36,25,39,24)
    p("#3f4140",27,22,30,23,32,25,37,26,39,25,38,28,33,29,28,27)
    p(EDGE,20,17,24,15,28,17,28,23,25,26,21,25,19,22)
    p("#4a5b60",21,18,24,17,26,18,26,22,24,24,21,23)
    l("#93a397",21,19,23,18,25,18)
    b("#ce9e5d",22,20,24,21)
    l("#56443a",29,11,31,11);l("#e6ac67",22,14,23,14)


def gauntlet(im,x,y,far):
    p,l,b=painter(im,x,y)
    if far:
        p(EDGE,-6,0,-5,-2,-3,-2,-4,-5,-2,-6,0,-5,0,-2,4,-3,5,-1,4,2,1,4,-3,4,-6,2)
        p("#72634c",-5,0,-2,-1,-2,-4,-1,-4,0,0,3,-2,4,0,2,3,-2,3)
        l("#bb9667",-4,1,-1,2,2,0);l("#e3b976",0,-1,2,-2)
    else:
        p(EDGE,-7,0,-4,-5,0,-6,4,-5,5,-3,7,-3,7,0,4,1,4,4,1,6,-4,5,-6,3)
        p("#82583f",-5,0,-3,-4,0,-5,3,-4,5,-2,6,-1,3,0,2,3,0,4,-4,3)
        p("#bf8051",-4,-1,-2,-4,0,-4,3,-3,3,-1,0,2,-3,2)
        l("#ecc185",-3,-2,-1,-4,1,-4);l("#edb477",2,-2,4,-2)
        l("#563f35",-4,2,-2,3,0,2);b("#8da89f",-5,0,-3,1)


def arm(im,a,b,far):
    p,l,_=painter(im)
    x,y=a;xx,yy=b
    l(EDGE,x,y,xx,yy,width=9)
    l("#534b41" if far else "#72604d",x,y,xx,yy,width=6)
    l("#806f54" if far else "#b8996c",x-1,y-2,xx-1,yy-2,width=3)
    l(EDGE,xx-4,yy-3,xx-3,yy+2,width=2)


def launcher():
    im=blank((36,18));p,l,b=painter(im)
    p(EDGE,0,6,5,4,10,5,13,4,13,2,18,1,21,2,29,2,30,1,34,1,35,3,35,9,33,11,24,11,21,13,14,13,12,17,8,17,9,12,5,10,2,12,0,11)
    p(STEEL,1,7,5,6,10,7,12,6,12,9,7,9,4,8,2,10)
    p("#476468",13,4,17,2,29,3,31,2,33,3,33,8,30,9,20,10,13,9)
    l("#a0b2a8",14,4,19,3,30,4)
    p("#9d643b",17,5,22,4,23,5,23,10,20,12,16,11,15,8)
    l(GOLD,17,5,20,5);l("#735138",18,8,18,10)
    b(EDGE,31,5,34,8);l(SEA,30,3,30,9);l(ORANGE,25,3,25,8)
    l("#414e50",11,12,10,15);l("#87948a",10,11,14,11)
    return im


def legs(frame,sink):
    # Reuse the shipped boot shape while recolouring its fatigues to slate.
    src=SOURCE.crop((frame*64,39,frame*64+64,64))
    px=src.load()
    for yy in range(src.height):
        for xx in range(src.width):
            r,g,b,a=px[xx,yy]
            if not a:continue
            lum=(r*4+g*5+b)//10
            if max(r,g,b)-min(r,g,b)>14:
                px[xx,yy]=(int(lum*.80),int(lum*.96),min(255,int(lum*1.03)),a)
    if sink>0:src=src.resize((64,25-sink),Image.Resampling.NEAREST)
    return src


def operator(row,col):
    im=blank((80,76))
    if row==0:
        # walk cycle, aim, kick, recover, and ready.
        dx=[0,1,0,-1,1,-3,-1,0][col]
        dy=[0,-1,0,1,0,1,0,0][col]
        crouch=0
        gun=[(32,32),(33,31),(32,32),(31,33),(33,29),(30,26),(32,29),(32,31)][col]
        gh=[(gun[0]+4,gun[1]+10),(gun[0]+21,gun[1]+8)]
    else:
        dx=[-1,-3,-2,-1,3,5,3,0][col]
        dy=[1,4,0,-4,-1,7,5,2][col]
        crouch=max(0,dy)
        gh=[[(25,33),(20,29)],[(22,36),(18,32)],[(34,25),(26,22)],
            [(42,15),(33,17)],[(48,26),(39,29)],[(50,47),(40,45)],
            [(43,39),(37,41)],[(38,34),(43,28)]][col]
        if row==2:
            # Foreground hand for the interleaved operator / carried prop / hand draw.
            gauntlet(im,*gh[0],False)
            return im
    # Original atlas value y=60 is the foot pivot; use the same registration.
    im.alpha_composite(legs((col%4) if row==0 and col<4 else 4,crouch),(0,39+crouch))
    canisters(im,7+dx,16+dy);torso(im,dx,dy);head(im,dx,dy)
    arm(im,(35+dx,29+dy),gh[1],True)
    if row==0:
        im.alpha_composite(launcher(),gun)
    gauntlet(im,*gh[1],True)
    arm(im,(21+dx,32+dy),gh[0],False)
    p,l,b=painter(im,dx,dy)
    p(EDGE,16,29,20,26,25,27,28,30,26,34,19,35,16,33)
    p("#946347",17,30,20,28,24,28,26,30,25,32,19,33)
    l(ORANGE,18,30,21,28,24,29);l(GOLD,19,29,20,28)
    gauntlet(im,*gh[0],False)
    return im


def prop(col):
    im=blank((64,64))
    p,l,b=painter(im)
    recoil=[0,1,0,4,2,1,0,0][col]
    open_amt=[0,2,6,7,7,7,7,7][col]
    y=recoil
    # Graphic prop: broad triangular shoe, twin orange collars and mint status lamp.
    p(EDGE,14,51,22,45,35,44,40+open_amt,47,44+open_amt,50,44+open_amt,53,23,57,14,55)
    p("#4d5e60",16,51,23,47,34,46,40+open_amt,49,42+open_amt,50,24,54,16,54)
    l("#9d9f88",17,51,24,48,33,47);l(TEAL,25,54,41+open_amt,51)
    for tx,ty in [(20,52),(37+open_amt,50)]:
        b(EDGE,tx,ty,tx+2,ty+1)
    l(EDGE,25,47,15-open_amt,53,width=5);l(STEEL,25,46,15-open_amt,51,width=3)
    l(EDGE,33,42,39+open_amt,50,width=5);l("#96a49a",33,42,40+open_amt,49,width=2)
    for x,yy in [(23,47),(31,44)]:
        p(EDGE,x-4,yy-2,x,yy-5,x+4,yy-3,x+4,yy+1,x+1,yy+4,x-3,yy+3)
        b(LIT,x-1,yy-2,x+1,yy)
    p,l,b=painter(im,0,y)
    p(EDGE,19,41,28,16,29,10,33,7,42,10,44,13,43,18,40,20,34,41,31,46,27,48,20,46)
    p(DARK,21,41,29,18,31,13,39,14,41,17,38,20,31,41,29,45,24,46)
    p("#497575",23,40,30,19,34,18,35,21,29,41,26,44,23,44)
    l(SEA,25,39,31,20)
    p("#9a593c",24,29,26,25,36,28,35,32)
    l("#df9654",26,26,35,29);l("#ffca78",26,26,28,26)
    p("#26363c",29,13,32,9,39,10,43,13,42,17,38,20,31,18,28,16)
    p("#82978e",30,13,33,10,38,11,41,13,40,16,37,18,32,16)
    p(EDGE,32,13,34,11,38,12,40,13,39,15,36,16,33,15)
    l("#a9c3ad",33,10,37,11)
    b("#dbaf64",23,39,24,41);b("#6eb9b1",27,35,28,36)
    return im


def fx(row,col):
    im=blank((64,64)); p,l,b=painter(im)
    if row==0: # elliptical warning zone, open corners avoid obscuring enemies
        r=[10,14,18,20,20,21,22,22][col]
        color=["#a17d50","#b19055","#cca264","#e7b868","#ffd286","#efae5c","#ffc477","#ffdb98"][col]
        for sign in (-1,1):
            for side in (-1,1):
                l("#51473c",32+side*r,32+sign,32+side*(r-3),32+sign*5,32+side*(r//2),32+sign*7)
                l(color,32+side*r,31+sign,32+side*(r-3),31+sign*5,32+side*(r//2),31+sign*7)
        l(color,31,32,33,32);b(color,32,31,32,33)
    elif row==1: # ring at the planted object's base
        r=[4,9,14,18,22,25,28,30][col]
        for i in range(12):
            a=i*math.tau/12
            xx=32+round(math.cos(a)*r); yy=32+round(math.sin(a)*r*.28)
            sz=max(1,4-col//2)
            l(["#ffe8a7","#fbd794","#e8bc79","#c89b69","#a78d68","#91795e","#7e705d","#6c6456"][col],xx,yy,xx+sz*(1 if xx>32 else -1),yy)
    elif row==2: # one compact, chunky blast in ochre smoke with an incandescent core
        if col<4:
            radii=[6,15,19,16]; r=radii[col]
            pts=[]
            for i in range(16):
                a=i*math.pi/8
                rr=r*(1 if i%2==0 else .53)
                pts.extend((32+round(math.cos(a)*rr),33+round(math.sin(a)*rr*(1 if math.sin(a)<0 else .46))))
            p("#9a573f",*pts); 
        for i in range(6):
            theta=(i*1.99+.45)
            outward=[1,4,8,12,15,17,19,21][col]
            xx=32+round(math.cos(theta)*outward)
            yy=31+round(math.sin(theta)*outward*.39)-[0,1,3,5,8,10,12,15][col]
            radius=max(1,[2,4,6,7,7,6,4,2][col]-(i%2))
            shade=["#b16c45","#96684e","#795e50","#665957","#605957","#64615b","#6b6960","#777267"][col]
            rim=["#f4ab57","#d99159","#ac805e","#9c8069","#928372","#8b8373","#96907c","#a2987f"][col]
            p(shade,xx-radius,yy-1,xx-radius+1,yy-radius+1,xx+1,yy-radius,xx+radius-1,yy-radius+2,xx+radius,yy+1,xx+radius-2,yy+radius,xx-2,yy+radius,xx-radius,yy+2)
            l(rim,xx-radius+1,yy-1,xx-radius+2,yy-radius+2,xx+1,yy-radius+1)
        if col<4:
            r=[5,10,13,8][col]
            p("#f49c4d",32-r,33,29,29,27,32-r,33,29,35,23-r//3,38,29,32+r,26,38,34,31,36)
            p("#ffdf85",29,33,29,28,32,30,34,24,35,30,39,29,35,34,31,34)
            b("#fff4c0",31,30,33,32)
        if 0<col<7:
            for i in range(8):
                a=(-167+i*22)*math.pi/180
                rad=min(26,5+4*col)+(i%3)
                xx=32+round(math.cos(a)*rad);yy=33+round(math.sin(a)*rad*.78)+max(0,col-4)**2
                l("#ffcb7d" if col<4 else "#8f816c",xx,yy,xx+(1 if xx>32 else -1),yy-1)
    elif row==3: # chunky silhouette, bright ogive and opposed tail fins seen in rotation
        fin=(3,4,4,3,2,1,2,3)[col]
        p(EDGE,19,32-fin,20,30-fin,26,29,31,27,38,27,43,29,46,32,43,35,
          38,37,31,37,26,35,20,34+fin,19,32+fin,21,33,21,31)
        p("#477474",22,30,27,30,31,28,37,28,42,30,44,32,40,35,32,36,
          27,34,22,34)
        p("#7aa89a",27,30,32,28,37,28,40,30,34,30,29,32)
        p("#f4a649",36,28,38,28,39,30,39,34,37,36,35,36,37,33)
        l("#ffdfa0",38,29,40,30,42,31)
        l("#2d464b",21,32,27,32);l(ORANGE,21,31-fin,25,30)
        l("#a0bab0",30,29,34,28)
        if fin>2:l("#927350",21,33+fin,25,35)
    return im


def write_atlas(filename,cell,rows,cols,draw):
    sheet=blank((cell[0]*cols,cell[1]*rows))
    for row in range(rows):
        for col in range(cols):
            sheet.alpha_composite(draw(row,col),(col*cell[0],row*cell[1]))
    sheet.save(OUT/filename,optimize=True)


write_atlas("operator.png",(80,76),3,8,operator)
write_atlas("emplacement.png",(64,64),1,8,lambda row,col:prop(col))
write_atlas("effects.png",(64,64),4,8,fx)
manifest={
    "name":"해머","operator":{"image":"operator.png","cell":[80,76],"anchor":[32,60],
    "basic":["stepA","stepB","stepC","stepD","aim","kick","recover","ready"],
    "plant":["reach","squat","extract","lift","swing","slam","brace","signal"],
    "foregroundHandRow":2},
    "emplacement":{"image":"emplacement.png","cell":[64,64],"anchor":[25,54],
    "frames":["folded","drop","expand","kick","returnA","returnB","ready","ready"]},
    "effects":{"image":"effects.png","cell":[64,64],"anchor":[32,32],"rows":["landingCue","groundSlam","impact","round"]},
    "blast":bake_blasts(OUT),
    "demo":{"durationMs":4000,"plantContactMs":610,
    "barrageMs":[990,1290,1420,1550,2020,2190,2500,2650],
    "barrageImpactMs":[1630,1890,2035,2175,2665,2815,3150,3320]}
}
(OUT/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf8")


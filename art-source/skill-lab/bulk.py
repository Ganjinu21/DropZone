"""Bake Bulk's two-legged armored walker, swivel pods, boarding poses and ballistic FX."""
import json
import math
import runpy
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/"design/skill-lab/bulk"
crew=runpy.run_path(str(ROOT/"work/art/tag-combat/units.py"))
CELL=(136,108)
INK="#141d24"
BLACK="#1c2830"
STEEL="#566674"
EDGE="#98aeb9"

def plate(d,points,fill,outline=INK):
    d.polygon(points,fill=fill)
    if outline:
        d.line([*points,points[0]],fill=outline,width=1)

def joint(d,x,y,r):
    d.ellipse((x-r,y-r,x+r,y+r),fill=BLACK,outline=INK)
    d.arc((x-r+1,y-r+1,x+r-1,y+r-1),155,300,fill="#8c9ba3",width=2)
    d.ellipse((x-2,y-2,x+2,y+2),fill="#465866",outline=INK)
    d.point((x-1,y-1),fill="#c1c5bd")

def leg(d,far,sink):
    # Both soles stay pinned while the hip drops and the reverse joint folds back.
    hip=(46,46+sink) if far else (82,49+sink)
    knee=(57+round(.5*sink),63+round(.43*sink)) if far else (94+round(.67*sink),68+round(.48*sink))
    ankle=(39,89) if far else (83,94)
    x,y=ankle;hx,hy=hip;kx,ky=knee
    armor="#4d6b92" if far else "#5e82b3"
    light="#8b9eb4" if far else "#c4c7c1"
    # Heel spring, wedge toe, flat sole and toe cap form one planted foot.
    plate(d,[(x-19,y+3),(x-10,y-3),(x-3,y-6),(x+6,y-5),(x+11,y+2),(x+14,y+5),(x+14,y+8),(x-21,y+8),(x-21,y+5)],"#455c78")
    plate(d,[(x-20,y+4),(x-10,y-2),(x-4,y-3),(x-6,y+4),(x-15,y+6),(x-20,y+6)],light)
    plate(d,[(x-4,y+3),(x,y-4),(x+5,y-3),(x+10,y+3),(x+10,y+6),(x-3,y+6)],armor)
    d.line([(x-16,y+8),(x+12,y+8)],fill="#10171c",width=2)
    d.line([(x+5,y+3),(x+8,y+6),(x+10,y+6)],fill="#84919a",width=2)
    # Dark bunched hip bellows show compression behind the blue thigh shield.
    d.line([hip,knee],fill=INK,width=17)
    d.line([(hx+1,hy-2),(kx+1,ky-1)],fill="#596678",width=11)
    for u in (.18,.32,.46,.60):
        rx=round(hx+(kx-hx)*u);ry=round(hy+(ky-hy)*u)
        d.line([(rx-2,ry+3),(rx+3,ry-2)],fill="#252e36",width=2)
    plate(d,[(hx-8,hy-3),(hx-2,hy-7),(hx+5,hy-6),(kx+4,ky-4),
             (kx,ky+3),(hx-3,hy+7),(hx-8,hy+5)],armor)
    d.line([(hx-6,hy-2),(hx-1,hy-4),(kx,ky-4)],fill=light)
    # Twin piston rods, thick shin cuff and floating front greave.
    d.line([(kx-3,ky),(x-4,y)],fill=INK,width=8)
    d.line([(kx-3,ky+2),(x-4,y)],fill="#9aa6a7",width=3)
    d.line([(kx+3,ky),(x+3,y-2)],fill=BLACK,width=7)
    d.line([(kx+3,ky+2),(x+3,y-3)],fill="#7a8589",width=2)
    c=round(.70*(kx-x));v=round(.70*(ky-y))
    plate(d,[(x+c-8,y+v-2),(x+c-4,y+v-4),(x+c+6,y+v-4),
             (x+c+8,y+v+1),(x+8,y-2),(x+5,y+3),(x-8,y+3),(x-11,y),(x-7,y-5)],armor)
    d.line([(x+c-6,y+v-1),(x+c+3,y+v-2)],fill=light,width=2)
    d.line([(x+c-5,y+v+2),(x-7,y),(x-5,y+2)],fill=light)
    d.line([(x+c+4,y+v+1),(x+4,y-3)],fill="#364b68",width=2)
    d.line([(x+3,y-1),(x+5,y-6)],fill="#334b60",width=2)
    d.line([(x-3,y+1),(x+1,y)],fill="#b4b8ad")
    if not far:
        for yy in [-5,-2]:
            d.line([(x+c-4,y+v+6+yy),(x+c-1,y+v+8+yy),(x+c+3,y+v+6+yy)],fill="#e4d5ab")
    joint(d,kx,ky,6 if far else 7)
    d.line([(kx-3,ky-5),(kx+1,ky-6)],fill="#d9b56d",width=2)
    if sink>=14:
        d.line([(x+8,y+4),(x+11,y+7)],fill="#d5a662",width=2)

def body(stage):
    sink=[0,0,0,0,0,6,13,19][stage]
    opened=[0,5,14,7,0,0,0,0][stage]
    rear=Image.new("RGBA",CELL);front=rear.copy()
    d=ImageDraw.Draw(rear)
    leg(d,True,sink)
    leg(d,False,sink)
    # All cab geometry is authored in neutral pose, then translated with the hips.
    under=Image.new("RGBA",CELL);g=ImageDraw.Draw(under)
    plate(g,[(44,40),(83,35),(95,40),(92,52),(84,59),(58,61),(41,52)],"#32404c")
    for x in (46,50,54,81,85,89):
        g.line([(x,45),(x-1,54)],fill="#16212a",width=2)
    plate(g,[(49,46),(74,44),(86,48),(83,54),(58,56),(47,52)],"#536577")
    g.line([(54,50),(67,51),(76,48)],fill="#a3ada8")
    # Visible double-jointed shoulder yokes behind the two independent pods.
    for near in (False,True):
        if near: chain=[(86,27),(104,19),(115,26)]
        else: chain=[(47,34),(29,29),(20,37)]
        g.line(chain,fill=INK,width=9)
        g.line(chain,fill="#72808d" if near else "#596978",width=5)
        g.line([(chain[0][0],chain[0][1]-2),(chain[1][0],chain[1][1]-2)],fill=EDGE,width=2)
        joint(g,*chain[1],4)
    # Exposed cockpit tub, a deep seat and ribbed forward entry.
    plate(g,[(39,26),(46,18),(74,12),(93,17),(99,24),(95,41),(87,50),(59,52),(42,45)],"#2e4050")
    plate(g,[(46,29),(52,22),(72,20),(84,22),(84,40),(76,48),(52,45),(45,39)],"#121d25")
    plate(g,[(54,42),(55,28),(59,24),(69,24),(72,26),(73,39),(69,44)],"#43525e")
    g.line([(58,28),(60,26),(68,26)],fill="#87979b")
    for yy in (30,33,36):
        g.line([(57,yy),(68,yy+1)],fill="#24323a")
    g.line([(48,38),(52,39)],fill="#ebbb68",width=2)
    rear.alpha_composite(under,(0,sink))

    face=Image.new("RGBA",CELL);g=ImageDraw.Draw(face)
    # Sloped chin and side cheeks remain fixed below an opening canopy.
    plate(g,[(40,31),(48,35),(55,42),(73,44),(86,40),(94,33),(96,24),(100,25),
             (99,39),(90,46),(78,51),(56,52),(45,48),(39,40)],"#456885")
    plate(g,[(39,36),(46,39),(52,46),(65,49),(64,52),(51,50),(41,45)],"#607b90")
    plate(g,[(56,45),(76,46),(89,41),(86,46),(77,50),(61,50)],"#7790a0")
    g.line([(41,37),(48,41),(54,46)],fill="#95afbb")
    for x,y in [(44,43),(54,48),(83,46),(94,37)]:
        g.point((x,y),fill="#b9c2bd")
    # Canopy is a broad domed charcoal roof, not a conical bunker.
    lid=Image.new("RGBA",CELL);p=ImageDraw.Draw(lid)
    plate(p,[(38,29),(37,23),(39,16),(43,11),(49,7),(58,5),(76,4),
             (88,6),(94,10),(98,16),(99,24),(95,30),(78,35),(54,38),(42,35)],"#24333d")
    plate(p,[(39,26),(40,18),(44,12),(51,8),(60,6),(75,5),(87,7),(92,10),
             (88,14),(75,17),(55,20),(45,23)],"#3b4953",None)
    plate(p,[(43,17),(46,12),(54,8),(65,7),(73,7),(58,10),(50,13)],"#62717a",None)
    plate(p,[(50,19),(64,13),(80,10),(91,11),(95,14),(94,17),(75,19),
             (54,24),(43,29),(39,29)],"#35404a",None)
    p.line([(43,16),(48,11),(56,8),(64,7)],fill="#879599")
    p.line([(46,24),(62,20),(80,17),(92,16)],fill="#505d65")
    for xx,yy in [(53,14),(58,12),(68,10),(71,10),(82,8),(78,13),(61,18),(46,21)]:
        p.point((xx,yy),fill="#5a676e")
    # Inset grille: near-black punched mesh, cool sensor and cobalt cheek plates.
    plate(p,[(47,28),(54,24),(74,21),(82,22),(81,32),(73,36),(54,38),(46,35)],"#142027")
    for yy in (26,29,32,35,37):
        for xx in range(52,80,3):
            v=yy-round((xx-52)*.14)
            if v>=24-round((xx-52)*.13):
                p.line([(xx,v),(xx+1,v)],fill="#75818a")
    p.line([(51,27),(50,29),(50,34)],fill="#cfac6b")
    p.line([(76,24),(78,26),(77,31)],fill="#ba8c58")
    p.line([(48,27),(56,24),(74,22)],fill="#8dbfca")
    p.line([(52,26),(59,24)],fill="#a3ece7",width=2)
    plate(p,[(80,20),(93,16),(97,17),(98,22),(94,28),(80,32),(82,25)],"#4b7199")
    p.line([(82,21),(92,18),(96,18)],fill="#95adbc",width=2)
    p.line([(83,26),(92,23),(95,23)],fill="#243b50",width=2)
    plate(p,[(38,28),(44,25),(49,24),(48,30),(44,34),(39,33)],"#4e7393")
    p.line([(39,28),(46,25)],fill="#9bb1b8")
    p.line([(86,29),(89,29),(91,26)],fill="#e0dfd0",width=2)
    # Opening tilts the shell high enough to expose the seat between its lip and tub.
    if opened:
        # Lift with a minor rearward shift so its roof stays inside the atlas.
        flat=lid.crop((0,0,136,40)).resize((136,40-round(opened*.63)),Image.Resampling.NEAREST)
        face.alpha_composite(flat,(round(opened*.40),-round(opened*.19)))
    else:
        face.alpha_composite(lid)
    front.alpha_composite(face,(0,sink))
    return rear,front

POD_CELL=(42,40)
POD_PIVOT=(20,18)
DIRECTIONS=[(.12,.10),(.50,.04),(.97,.0),(.93,-.39),(.87,.49),(.68,-.19),(.69,.24)]

def pod(orientation):
    # Orthographic cylinders tilt from front-facing round drums to outward barrels.
    vx,vy=DIRECTIONS[orientation]
    cx,cy=POD_PIVOT
    width=.95 if orientation==0 else math.sqrt(max(.10,1-vx*vx-vy*vy))
    length=math.hypot(vx,vy)
    ax,ay=vx/length,vy/length
    def ellipse(x,y,r):
        pts=[]
        for i in range(20):
            angle=math.tau*i/20
            a=math.cos(angle)*r*width;b=math.sin(angle)*r
            pts.append((round(x+ax*a-ay*b),round(y+ay*a+ax*b)))
        return pts
    im=Image.new("RGBA",POD_CELL);d=ImageDraw.Draw(im)
    front=(cx+vx*9,cy+vy*9+1);back=(cx-vx*5,cy-vy*5-1)
    # Draw the drum continuously along its axis so the two rings share a housing.
    for i in range(13):
        u=i/12;x=back[0]+(front[0]-back[0])*u;y=back[1]+(front[1]-back[1])*u
        plate(d,ellipse(x,y,11),"#374957" if i<3 else "#527597" if i<9 else "#83949c",None)
    lo=ellipse(*back,10);d.line(lo[10:18],fill=INK,width=2)
    plate(d,ellipse(*front,11),"#a2adb1",INK)
    d.line(ellipse(*front,10)[10:17],fill="#d8d4c3",width=2)
    plate(d,ellipse(*front,9),"#354550","#abb8b8")
    plate(d,ellipse(*front,7),"#1c2931","#4b5c67")
    for side in (-1,1):
        x=front[0]+side*(3.6*width+1);y=front[1]+side*(1.5+2.8*vx)
        tip=(x+vx*3,y+vy*3)
        d.line([(round(x),round(y)),(round(tip[0]),round(tip[1]))],fill=INK,width=7)
        plate(d,ellipse(*tip,3.3),"#131a23","#a4a9a5")
        d.point((round(tip[0]),round(tip[1])-1),fill="#626766")
    plate(d,[(cx-6,cy-10),(cx-4,cy-13),(cx+2,cy-13),(cx+5,cy-10)],"#52677a")
    d.line([(cx-4,cy-12),(cx+1,cy-12)],fill="#9faeb3")
    return im

def operator():
    atlas=Image.new("RGBA",(4*96,3*64))
    for role in range(3):
        for i,(near,far) in enumerate([((36,37),(35,32)),((38,32),(36,28)),((38,24),(37,21)),((35,33),(34,30))]):
            im=crew["operator"](role,lean=[0,2,3,1][i],sink=[0,0,-1,3][i])
            for wrist,elbow,back in [(far,(29,31),True),(near,(27,35),False)]:
                crew["arm"](im,elbow,wrist,back,role)
                crew["glove"](im,*wrist,back,role)
            atlas.paste(im,(i*96,role*64))
    return atlas

def ballistics():
    atlas=Image.new("RGBA",(5*40,3*32))
    for i in range(5):
        im=Image.new("RGBA",(40,32));g=ImageDraw.Draw(im)
        g.polygon([(4,16),(19,13),(28,13),(33,16),(28,19),(19,19)],fill="#623f2e")
        g.polygon([(5,16),(19,14),(27,14),(31,16),(19,17)],fill="#e8a34d")
        g.line([(13,16),(23,15),(28,15),(31,16)],fill="#fff3bf",width=2)
        g.line([(20,18),(27,18)],fill="#b7753f")
        atlas.paste(im,(40*i,0))
        im=Image.new("RGBA",(40,32));g=ImageDraw.Draw(im)
        dx,dy=[(6,-1),(4,-4),(0,-6),(-4,-4),(-6,-1)][i]
        ax,ay=20-dx,16-dy;bx,by=20+dx,16+dy
        g.line([(ax,ay),(bx,by)],fill="#563c29",width=6)
        g.line([(ax,ay-1),(bx,by-1)],fill="#dda347",width=4)
        g.line([(ax+1,ay-2),(bx,by-2)],fill="#ffe3a0",width=2)
        g.line([(bx-1,by-1),(bx+1,by+1)],fill="#86643c",width=2)
        atlas.paste(im,(40*i,32))
        im=Image.new("RGBA",(40,32));g=ImageDraw.Draw(im)
        u=[.1,.35,.58,.8,.98][i]
        for j,(dx,dy) in enumerate([(17,-13),(-5,-11),(18,-4),(18,7),(5,13),(-6,8)]):
            a=max(0,u-.25)
            g.line([(16+int(dx*a),16+int(dy*a)),(16+int(dx*u),16+int(dy*u))],
                   fill=("#fff6bd","#ffcf7b","#d7904e","#a98c70","#92897a")[i],width=2 if i<4 else 1)
        if i<3:
            g.polygon([(10,16),(15,14),(16,9+i),(19,14),(24,16),(18,18),(15,22-i),(14,18)],
                      fill="#fff5ce")
        atlas.paste(im,(40*i,64))
    return atlas


def main():
    names=["neutral","unlock","board","close","sealed","lower","fold","anchored"]
    atlas=Image.new("RGBA",(CELL[0]*len(names),CELL[1]*2))
    for col in range(len(names)):
        for row,im in enumerate(body(col)):
            atlas.paste(im,(col*CELL[0],row*CELL[1]))
    atlas.save(OUT/"bunker.png",optimize=True)
    pods=Image.new("RGBA",(POD_CELL[0]*len(DIRECTIONS),POD_CELL[1]))
    for i in range(len(DIRECTIONS)):
        pods.paste(pod(i),(i*POD_CELL[0],0))
    pods.save(OUT/"pods.png",optimize=True)
    operator().save(OUT/"deploy.png",optimize=True)
    ballistics().save(OUT/"ballistics.png",optimize=True)
    info={"durationMs":4000,"atlases":{
        "bunker.png":{"cell":list(CELL),"anchor":[67,101],"rows":["legsAndOpenTub","canopyAndChin"],
                      "frames":names,"verticalCompression":[0,0,0,0,0,6,13,19],"footSoles":[[39,97],[83,102]]},
        "pods.png":{"cell":list(POD_CELL),"pivot":list(POD_PIVOT),"localAim":DIRECTIONS,
                    "rows":["rightPodMirrorForLeft"],"neutralShoulders":[[20,37],[115,26]],"presentationScale":[1,1.14]},
        "deploy.png":{"cell":[96,64],"anchor":[32,60],"rows":["bulk","raven","lynx"],
                      "frames":["approach","reach","climb","sit"]},
        "ballistics.png":{"cell":[40,32],"rows":["outgoingRound","spentCase","impactFan"],
                          "pivots":[[33,16],[20,16],[16,16]]}},
        "basicFireMs":[560,1720,2880],"basicFlightMs":402,
        "skillEventsMs":{"open":330,"allCrewInside":1210,"sealed":1280,"kneel":1380,"anchor":1580,
                         "firstBarrage":1670,"roundInterval":94,"rounds":22,"lastBarrage":3644}}
    (OUT/"frames.json").write_text(json.dumps(info,indent=2)+"\n",encoding="utf8")

if __name__=="__main__":main()

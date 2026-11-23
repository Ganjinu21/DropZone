"""Lynx's heavy four-shot skill: a braced pose, open action and discrete impacts."""
from importlib.util import spec_from_file_location, module_from_spec
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[2]
spec=spec_from_file_location("crew",ROOT/"work/art/tag-combat/units.py")
crew=module_from_spec(spec);spec.loader.exec_module(crew)
OUT=ROOT/"design/skill-lab/lynx";OUT.mkdir(exist_ok=True,parents=True)
TRANSPARENT=(0,0,0,0)

def rifle(action):
    im=crew.marksman_rifle()
    p=ImageDraw.Draw(im)
    # Heavy, cool-grey forward housing; the warm projectile stays distinct.
    p.polygon([(27,6),(32,5),(43,5),(46,7),(52,7),(52,10),(44,10),(42,12),(27,12)],fill="#18252a")
    p.polygon([(29,7),(33,6),(42,6),(45,8),(42,10),(29,10)],fill="#5d7777")
    p.line([(32,6),(42,6),(44,8)],fill="#b8cfbf")
    for x in (32,36,40):p.line((x,8,x+1,9),fill="#243a40")
    p.polygon([(48,5),(56,5),(58,7),(58,10),(56,12),(48,12),(46,10),(46,7)],fill="#293b41")
    p.line([(49,6),(55,6),(57,7)],fill="#b2c8bf")
    for x in [49,53]:p.line((x,8,x+1,10),fill="#18252a",width=2)
    p.line([(27,0),(31,0),(31,4)],fill="#81d5d0")
    if action:
        p.rectangle((17,7,24,10),fill="#18262b")
        p.rectangle((16,7,18,9),fill="#a08c65")
        p.line([(18,9),(15,11),(12,11)],fill="#cab18c",width=2)
    return im

def pose(i):
    # Boots remain planted while the torso sinks and absorbs the recoil.
    lean=[0,0,1,-4,-2,0,0][i]
    sink=[0,2,3,4,4,3,2][i]
    im=crew.operator(2,lean,sink)
    gx=22+[0,1,1,-5,-3,-1,0][i]
    gy=24+sink
    rearX=gx+(11 if i==5 else 15)
    rearY=gy+(14 if i==5 else 13)
    crew.arm(im,(29+lean,35+sink),(gx+35,gy+13),True,2)
    im.alpha_composite(rifle(i==5),(gx,gy))
    crew.glove(im,gx+35,gy+13,True,2)
    crew.arm(im,(27+lean,36+sink),(rearX,rearY),False,2)
    crew.glove(im,rearX,rearY,False,2)
    if i in (1,2):
        d=ImageDraw.Draw(im);d.point((gx+30,gy+1),fill="#e9fff3")
        if i==2:d.line((gx+29,gy,gx+31,gy),fill="#a5f0eb")
    return im,(gx+59,gy+8)

def fx(row,col):
    im=Image.new('RGBA',(56,48));d=ImageDraw.Draw(im)
    if row==0:
        # A hard flash and side-port exhaust collapse into two separate wisps.
        lens=[13,34,25,12,5]; l=lens[col]; x,y=7,24
        pts=[(x,y),(x+4,y-5),(x+6,y-3),(x+l,y-1),(x+l-3,y+1),(x+9,y+2),(x+5,y+4)]
        d.polygon(pts,fill=["#8ec5cc","#86ccc9","#a4c4b9","#9bb8b0","#688383"][col])
        if col<4:
            d.polygon([(x,y),(x+5,y-2),(x+l-2,y),(x+6,y+1),(x+3,y+2)],fill="#ffe4a2")
            d.line((x,y,x+l//2,y),fill="#ffffe9",width=2)
        if col<3:
            for s in (-1,1):
                d.polygon([(9,24+s),(7,24+5*s),(2+col*2,24+(10+col)*s),(6,24+4*s)],fill="#b9d9cc")
        if col>=2:
            d.line([(14,13-col),(19,11-col),(22,11-col)],fill="#949e90")
            d.point((26+col,6+col),fill="#e8ccb0")
    elif row==1:
        x,y=30,24; length=[11,16,18,15,10][col]
        d.polygon([(x-length,y),(x-8,y-2),(x-2,y-2),(x+2,y),(x-2,y+2),(x-8,y+2)],fill="#694b39")
        d.line([(x-length,y),(x-6,y)],fill="#88a5aa")
        d.line([(x-6,y-1),(x-2,y-1),(x+1,y)],fill="#ffe2a1")
        d.line([(x-7,y+1),(x-3,y+1)],fill="#cf8a50")
        d.point((x-2,y-1),fill="#fff8d1")
    else:
        # Entry is a compact spark; the fan of fragments projects forward.
        x,y=17,24
        for j,(dx,dy) in enumerate([(12,-13),(22,-6),(28,0),(20,8),(12,14)]):
            prog=[.14,.39,.65,.84,1][col]; px=round(x+dx*prog);py=round(y+dy*prog)
            d.line([(round(x+dx*max(0,prog-.20)),round(y+dy*max(0,prog-.2))),(px,py)],
                   fill=(["#dcab72","#ebd9a5","#c5e8db","#a3c2b9","#93a99e"][col]),
                   width=2 if col==1 else 1)
            if col<3:d.point((px,py),fill="#fff9c7")
        if col<3:
            h=[5,9,5][col]
            d.polygon([(x-4,y),(x-1,y-2),(x,y-h),(x+2,y-2),(x+8,y),(x+2,y+2),(x,y+h),(x-1,y+2)],fill="#ffe2a0")
            d.line([(x-2,y),(x+4,y)],fill="#fffdec")
    return im

def main():
    atlas=Image.new("RGBA",(96*7,64));muzzles=[]
    for i in range(7):
        im,tip=pose(i);atlas.paste(im,(96*i,0));muzzles.append(tip)
    atlas.save(OUT/"precision.png",optimize=True)
    atlas=Image.new("RGBA",(56*5,48*3))
    for row in range(3):
        for col in range(5):atlas.paste(fx(row,col),(col*56,row*48))
    atlas.save(OUT/"pierce-fx.png",optimize=True)
    beams=Image.new("RGBA",(160,26*7))
    # Each tile already contains a full-length instantaneous beam. Tail frames
    # cool from a broad plasma core to separated afterimage filaments.
    for i in range(7):
        tile=Image.new("RGBA",(160,26));ink=ImageDraw.Draw(tile)
        widths=[7,5,3,2,1,1,1]
        half=widths[i]
        if i<5:
            ink.polygon([(0,13),(4,13-half),(151,13-half),(159,13),(152,13+half),(3,13+half)],
                        fill=[(65,174,224,205),(59,180,233,230),(90,206,232,220),(92,187,226,190),(116,157,226,150)][i])
            ink.line((0,13,159,13),fill=["#f7fff3","#effffb","#d1fffa","#b5eff2","#a3cced"][i],width=[4,3,2,1,1][i])
        if i==4:
            ink.line((0,13,159,13),fill="#85e3db",width=2)
        if i>=5:
            step=19 if i==5 else 24
            run=14 if i==5 else 8
            for a in range(0,160,step):
                ink.line((a,13,min(159,a+run),13),fill=(133,228,220,218 if i==5 else 165),width=1)
        if i>=2:
            for j in range(9):
                a=(j*19+i*3)%155;l=max(2,18-i*2-(j%3))
                y=13+(1 if j%2 else -1)*(2+(i+j)%4)
                ink.line([(a,y),(min(158,a+l),y)],fill=(113,190,221,max(70,200-i*17)))
        if i<3:
            for a in [13,55,103,141]:
                ink.line([(a,12-half),(a+4,13-half)],fill=(156,244,237,210))
        beams.paste(tile,(0,26*i))
    beams.save(OUT/"laser.png",optimize=True)
    info={"facing":"right","durationMs":4000,
          "precision.png":{"cell":[96,64],"anchor":[32,60],
                           "columns":["ready","brace","focus","heavyKick","return","cycle","settle"],"muzzles":muzzles},
          "pierce-fx.png":{"cell":[56,48],"rows":["muzzle","basicRound","exit"],"pivots":[[7,24],[32,24],[17,24]],
                           "exposureMs":[24,32,40,48,48]},
          "laser.png":{"cell":[160,26],"rows":["pulse","fullCore","coolCore","thinCore","afterimage","filament","tail"],
                       "exposureMs":[32,40,48,58,60,75,97],"anchor":[0,13]},
          "basicFlightMs":340,"fireMs":[650,1410,2170,2930],"impactDelayMs":0}
    (OUT/"frames.json").write_text(json.dumps(info,indent=2)+"\n",encoding="utf8")

if __name__=="__main__":main()

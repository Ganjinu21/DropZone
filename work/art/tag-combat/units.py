"""Register hand-pixelled leader equipment on the shipped 1x combat sprites."""
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
TARGET = ROOT / "game/art/tag-combat"
SOURCE = Image.open(ROOT / "game/combat-units.png").convert("RGBA")
CELL = (96, 64)
ROLES = ["bulk", "raven", "lynx"]
EDGE = "#181f24"


def layer():
    return Image.new("RGBA", CELL)


class Pixels:
    def __init__(self, image):
        self.pen = ImageDraw.Draw(image)

    def shape(self, color, *points):
        self.pen.polygon(points, fill=color)

    def line(self, color, *points):
        self.pen.line(points, fill=color)

    def box(self, color, x1, y1, x2, y2):
        self.pen.rectangle((x1, y1, x2, y2), fill=color)

    def dot(self, color, *points):
        self.pen.point(points, fill=color)


def operator(row, lean=0, sink=0):
    """Preserve the shipped right-facing figure; remove its old weapon and forward grip."""
    body = SOURCE.crop((256, row * 64, 320, row * 64 + 64))
    # Rightmost retained pixel on each band follows the original face, elbow, chest.
    trims = [
        [(0, 63), (20, 45), (22, 44), (24, 41), (25, 34),
         (27, 33), (29, 34), (33, 33), (36, 39), (39, 63)],
        [(0, 63), (25, 39), (27, 36), (28, 32), (30, 30),
         (33, 32), (36, 36), (38, 63)],
        [(0, 63), (26, 42), (27, 39), (28, 36), (30, 33),
         (32, 33), (34, 33), (36, 39), (39, 63)],
    ][row]
    pen = ImageDraw.Draw(body)
    for (top, edge), (bottom, _) in zip(trims, trims[1:]):
        if edge < 63:
            pen.rectangle((edge+1, top, 63, bottom-1), fill=(0, 0, 0, 0))
    image = layer()
    image.alpha_composite(body.crop((0, 39, 64, 64)), (0, 39))
    image.alpha_composite(body.crop((0, 0, 64, 41)), (lean, sink))
    return image


def handgun(longslide=False, far=False, support=False):
    """Origin at rear sight. An open trigger guard and stepped slide stay visible at 1x."""
    output = layer()
    p = Pixels(output)
    length = 19 if longslide else (13 if support else 14)
    upper = "#9b978a" if far else "#c7cfc4"
    slide = "#69716f" if far else "#899b9c"
    dark = "#424a4b" if far else "#526365"
    p.shape(EDGE,(1,2),(2,1),(3,1),(3,0),(5,0),(6,1),(length-4,1),
            (length-4,0),(length-2,0),(length-2,1),(length+1,1),(length+1,5),
            (length-1,6),(10,6),(9,10),(6,10),(4,13),(0,12),(2,6),(0,5),(0,2))
    p.box(slide,2,2,length,4)
    p.line(upper,(4,1),(5,2),(length-1,2))
    p.box(EDGE,7,2,10,3)
    p.dot("#8f9390",(8,3))
    p.line(dark,(11,4),(length-1,4))
    p.line("#78817b",(9,6),(8,9),(6,9))
    p.line(dark,(3,6),(5,6),(3,11))
    p.dot("#81837a",(3,7),(2,10))
    p.dot("#b2a88f" if support else "#ffb473",(length-3,0))
    p.dot(EDGE,(3,3),(5,3),(length-2,3))
    if longslide:
        p.line("#3f4d50",(length-5,4),(length-5,5))
        p.line("#c3c1ae" if not far else "#969a8a",(length-1,3),(length-1,4))
    return output


def ballistic_shield():
    """Faceted slab, inset laminated window, reinforced perimeter and replaceable foot."""
    out = layer()
    p = Pixels(out)
    p.shape(EDGE,(0,6),(5,2),(20,0),(24,3),(24,27),(21,33),(7,36),(2,33),(0,28))
    p.shape("#20374f",(2,6),(6,3),(19,1),(23,4),(22,27),(20,32),(7,34),(3,31))
    p.shape("#7997aa",(2,6),(5,4),(7,4),(6,31),(5,32),(3,29))
    p.shape("#354e6c",(4,7),(6,6),(5,28),(4,29))
    p.shape("#4b79a4",(7,4),(18,2),(21,4),(20,26),(18,30),(8,32),(6,29))
    p.shape("#38638c",(8,13),(19,11),(19,24),(17,29),(8,31))
    p.shape("#2a4f79",(8,24),(18,17),(19,17),(18,27),(16,29),(9,30))
    p.line("#86a9be",(7,4),(17,2),(19,2))
    p.line("#233d5a",(7,12),(19,10))
    p.shape("#202a31",(6,8),(8,6),(19,4),(21,5),(20,10),(8,12),(6,11))
    p.shape("#78acba",(8,7),(18,5),(19,6),(18,8),(8,10))
    p.line("#c0d5d2",(8,7),(17,5))
    p.line("#395a72",(9,9),(16,8),(19,6))
    p.dot("#bdcbc4",(14,7),(15,6))
    # Yellow doubled chevron used on the squad leader's existing UI marker.
    p.line("#233b52",(9,18),(13,20),(17,16))
    for y in (16,19):
        p.line("#d8aa57",(9,y),(12,y+2),(17,y-2))
        p.line("#f8ce7f",(10,y),(12,y+1))
    p.line("#7ba3b1",(9,27),(10,26))
    p.line("#7193ab",(16,13),(18,12))
    p.line("#6387a0",(13,27),(14,26))
    p.shape("#2c4054",(5,30),(8,32),(19,29),(21,26),(20,31),(8,34),(5,32))
    for x,y in ((4,7),(4,24),(8,5),(19,4),(8,30),(19,27)):
        p.dot("#273338",(x,y+1))
        p.dot("#bac0ad",(x,y))
    return out


def marksman_rifle():
    """A single long silhouette with a negative-space stock, optic and squared muzzle."""
    out = layer()
    p = Pixels(out)
    p.shape(EDGE,(0,7),(4,7),(6,8),(12,8),(14,6),(18,6),(18,4),(15,4),
            (15,1),(18,0),(21,1),(26,1),(28,0),(31,0),(31,4),(28,5),(26,4),
            (26,6),(37,6),(39,7),(49,7),(49,6),(55,6),(56,7),(56,10),
            (55,11),(49,11),(48,10),(38,10),(36,12),(26,12),(25,16),
            (21,16),(20,13),(17,12),(15,16),(12,16),(13,12),(8,12),
            (3,15),(0,15))
    p.shape("#566568",(2,8),(5,9),(12,9),(12,10),(7,11),(3,13),(2,13))
    p.line("#98a298",(2,8),(4,8))
    p.box("#677470",14,7,36,9)
    p.line("#a4ada1",(15,7),(35,7))
    p.box("#434f4e",15,10,36,11)
    p.box("#27363b",17,8,22,9)
    p.dot("#a7b6a9",(16,8),(23,9),(24,9))
    p.box("#314a53",16,2,30,3)
    p.box("#677e82",18,1,20,2)
    p.line("#9ea89b",(21,2),(26,2))
    p.line("#36444a",(20,5),(20,6))
    p.line("#36444a",(25,4),(25,6))
    p.box("#50b5c2",28,1,30,3)
    p.dot("#dcf7e2",(29,1))
    p.line("#a4afa2",(37,8),(48,8))
    p.box("#647275",50,7,54,10)
    p.line("#a9af9f",(50,7),(54,7))
    p.dot(EDGE,(51,8),(53,8),(55,9))
    for x in (28,31,34):
        p.box("#28353a",x,9,x+1,10)
    p.line("#788275",(22,12),(24,12),(24,14))
    p.line("#2d3c3e",(14,12),(13,15))
    return out


def glove(image, x, y, far=False, role=0):
    """Fingerless glove with just enough exposed knuckle to connect to the sleeve."""
    p = Pixels(image)
    # Anatomical right hand is near the camera (knuckle plate and index above
    # trigger). The left hand shows its darker palm/thenar. Drawing the mirrored
    # view transforms the complete sprite, never exchanges the weapons/hands.
    warm=["#b3bdba","#daad83","#c1b58b"][role]
    lit=["#dae0d1","#f4c38c","#dfd3a9"][role]
    mid=["#667c83","#8b6550","#8e876a"][role]
    low=["#374b53","#503c36","#575b48"][role]
    if far:
        # Far wrist emerges from behind, palm cupped upwards with thumb on rear edge.
        p.shape(EDGE,(x-6,y),(x-4,y-2),(x-2,y-2),(x-3,y-5),(x-1,y-6),
                (x+1,y-5),(x+1,y-2),(x+4,y-3),(x+5,y-2),(x+5,y+1),
                (x+2,y+3),(x-2,y+4),(x-5,y+3))
        p.shape(low,(x-5,y),(x-2,y-1),(x-2,y-4),(x-1,y-5),(x,y-4),
                (x,y-1),(x+4,y-2),(x+4,y+1),(x+1,y+2),(x-2,y+3),(x-4,y+2))
        p.line(mid,(x-3,y),(x,y+1),(x+2,y))
        p.line(warm,(x+1,y-1),(x+3,y-2))
        p.dot(mid,(x-1,y-4),(x+3,y+1))
    else:
        # Near wrist enters from bottom left, four knuckles fan toward the slide;
        # index follows the trigger guard, thumb catches the forward edge.
        p.shape(EDGE,(x-6,y),(x-4,y-4),(x,y-5),(x+3,y-4),(x+5,y-3),
                (x+6,y-3),(x+6,y-1),(x+3,y),(x+4,y+2),(x+2,y+4),
                (x-2,y+5),(x-5,y+3))
        p.shape(low,(x-5,y),(x-3,y-3),(x,y-4),(x+3,y-3),(x+5,y-2),
                (x+2,y-1),(x+3,y+2),(x,y+3),(x-2,y+4),(x-4,y+2))
        p.shape(mid,(x-4,y),(x-2,y-3),(x,y-3),(x+2,y-2),(x+1,y),
                (x-1,y+2),(x-3,y+2))
        p.line(warm,(x-3,y-1),(x-2,y-2),(x,y-3))
        p.dot(lit,(x,y-3),(x+4,y-2))
        p.line(warm,(x+1,y),(x+2,y-1))
        p.dot(low,(x-2,y),(x,y-1))
        p.line("#293032",(x-5,y+1),(x-3,y+3))


def arm(image, start, end, far, role):
    """Bent sleeve running from existing elbow to the equipment grip."""
    sx,sy = start
    ex,ey = end
    p = Pixels(image)
    p.shape(EDGE,(sx-2,sy-2),(sx+1,sy-4),(ex,ey-2),(ex+1,ey+2),(sx+2,sy+3),(sx-2,sy+2))
    p.shape("#74523a" if far else "#a66d40",(sx-1,sy-2),(sx+1,sy-3),(ex-1,ey-1),
            (ex-2,ey+1),(sx+1,sy+1),(sx-1,sy+1))
    p.line("#a4734b" if far else ["#ebb56e","#f6b27a","#bc995e"][role],
           (sx,sy-2),(sx+2,sy-2),(ex-3,ey-1))


PISTOL = handgun(longslide=True)
FAR_PISTOL = handgun(longslide=True, far=True)
COMPACT = handgun(support=True)
SHIELD = ballistic_shield()
RIFLE = marksman_rifle()


def paste(image, item, x, y):
    image.alpha_composite(item,(x,y))


def pose(role, support, frame, deployment=1, *, layers=False):
    """Return a complete composited character and its live shot attachment point."""
    recoil = [0,2,1,2,1,0][frame]
    torso = -int(recoil > 1)
    base = operator(role,torso,int(recoil > 1))
    if layers:
        # The renderer supplies the walking legs before drawing the torso.
        ImageDraw.Draw(base).rectangle((0,42,95,63), fill=(0,0,0,0))
    body = layer()
    def finish(muzzle):
        if layers:
            return base, body
        return Image.alpha_composite(base, body), muzzle
    if support:
        x,y=[38,36,38][role]-recoil,[25,28,30][role]-int(recoil>1)
        arm(body,([29,28,29][role],[33,34,36][role]),(x+2,y+7),False,role)
        paste(body,COMPACT,x,y)
        glove(body,x+2,y+7,False,role)
        return finish((x+15,y+3))
    deploy = 1-deployment
    if role == 0:
        # Left forearm and strap stay behind the shield. The right arm and
        # pistol pass in front of its outer rim, keeping the firing hand visible.
        sx,sy=18+int(recoil>1)-round(4*deploy),23+round(3*deploy)
        arm(base,(27,34),(sx+10,sy+15),True,role)
        glove(base,sx+10,sy+15,True,role)
        if deploy:
            w=round(25-12*deploy)
            shield=SHIELD.crop((0,0,25,37)).resize((w,37),Image.Resampling.NEAREST)
        else:
            shield=SHIELD
        paste(base,shield,sx,sy)
        x,y=42-recoil,27-int(recoil>1)+round(6*deploy)
        arm(body,(37,37),(x+2,y+7),False,role)
        paste(body,COMPACT,x,y)
        glove(body,x+2,y+7,False,role)
        return finish((x+15,y+3))
    if role == 1:
        active_far=frame in (3,4)
        far_kick,near_kick=(recoil,0) if active_far else (0,recoil)
        far_x,far_y=43-2*far_kick-round(7*deploy),24-int(far_kick>1)+round(6*deploy)
        near_x,near_y=36-2*near_kick-round(5*deploy),33-int(near_kick>1)+round(6*deploy)
        arm(body,(32,29),(far_x+2,far_y+7),True,role)
        paste(body,FAR_PISTOL,far_x,far_y)
        glove(body,far_x+2,far_y+7,True,role)
        arm(body,(28,34),(near_x+2,near_y+7),False,role)
        paste(body,PISTOL,near_x,near_y)
        glove(body,near_x+2,near_y+7,False,role)
        return finish(((far_x if active_far else near_x)+21,(far_y if active_far else near_y)+3))
    x,y=23-2*recoil-round(4*deploy),24-int(recoil>1)+round(7*deploy)
    arm(body,(32,35),(x+34,y+13),True,role)
    paste(body,RIFLE,x,y)
    glove(body,x+34,y+13,True,role)
    glove(body,x+15,y+13,False,role)
    return finish((x+57,y+8))


def main():
    TARGET.mkdir(parents=True,exist_ok=True)
    atlas=Image.new("RGBA",(CELL[0]*6,CELL[1]*6))
    rig=Image.new("RGBA",(CELL[0]*6,CELL[1]*12))
    units=[]
    timing=[[45,64,72,45,64,210],[36,32,37,36,32,37],[65,64,144,65,64,420]]
    clips={}
    for row in range(6):
        role=row%3
        support=row>=3
        name=ROLES[role]+("_support" if support else "_lead")
        frames=[]
        for col in range(6):
            sprite,muzzle=pose(role,support,col)
            base, arms = pose(role,support,col,layers=True)
            rig.paste(base,(col*96,row*64))
            rig.paste(arms,(col*96,(row+6)*64))
            atlas.paste(sprite,(col*96,row*64))
            frames.append({"col":col,"muzzle":muzzle})
        units.append({"name":name,"row":row,"frames":frames})
        clips[name]={
            "frames":[0,1,2,3,4,5] if role==1 and not support else [0,1,2,5],
            "exposureMs":timing[1] if role==1 and not support else
                         ([95,45,65,200] if support else [timing[role][i] for i in (0,1,2,5)]),
            "fireAtColumns":[1,3] if role==1 and not support else [1]}
    atlas.save(TARGET/"units.png",optimize=True)
    rig.save(TARGET/"units-rig.png",optimize=True)
    tags=Image.new("RGBA",(4*96,3*64))
    for row in range(3):
        for col in range(4):
            sprite,_=pose(row,col==0,0,max(0,(col-1)/2))
            tags.paste(sprite,(col*96,row*64))
    tags.save(TARGET/"units-equip.png",optimize=True)
    gear=Image.new("RGBA",(CELL[0],4*CELL[1]))
    gear.paste(SHIELD,(6,6))
    gear.paste(PISTOL,(4,64+18))
    gear.paste(FAR_PISTOL,(13,64+7))
    gear.paste(RIFLE,(4,128+12))
    gear.paste(COMPACT,(4,192+12))
    gear.save(TARGET/"units-gear.png",optimize=True)
    data={"file":"units.png","cell":CELL,"anchor":[32,60],"facing":"right",
          "view":"original three-quarter side",
          "handedness":"Anatomical right is near camera (trigger, Raven A); left is far (shield, support grip, Raven B). Mirror the assembled sprite and muzzle point about anchor.x; do not swap hand ids.",
          "columns":["ready","fireA","recoveryA","fireB","recoveryB","settle"],
          "rows":units,"clips":clips,
          "equip":{"file":"units-equip.png","cell":CELL,"rows":ROLES,"anchor":[32,60],
                   "columns":["support","draw","raise","ready"],"exposureMs":[42,58,58,82]},
          "gear":{"file":"units-gear.png","cell":CELL,"rows":["shield","dualPistols","marksmanRifle","sidearm"]}}
    (TARGET/"units.json").write_text(json.dumps(data,indent=2)+"\n",encoding="utf8")
    # Classic script rather than fetch: the desktop game and Android WebView
    # boot directly from file URLs. Keep coordinates sourced from the sprite bake.
    runtime={
        "muzzles":[[f["muzzle"] for f in row["frames"]] for row in units],
        "clips":clips,
        "gearRects":[list(gear.crop((0,y,96,y+64)).getchannel("A").getbbox()) for y in (0,64,128)],
        "fx":json.loads((TARGET/"fx.json").read_text(encoding="utf8"))["clips"]
    }
    (TARGET/"atlas.js").write_text("/* Generated by work/art/tag-combat/units.py */\n"
                                  +"const tagAtlas = "+json.dumps(runtime,separators=(",",":"))+";\n",
                                  encoding="utf8")


if __name__ == "__main__":
    main()

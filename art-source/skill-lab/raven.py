"""Render Raven, her two short SMGs, and a sixteen-angle upright turn at native game scale."""
from pathlib import Path
import json
import math
import runpy
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "design/skill-lab/raven"
OUT.mkdir(parents=True, exist_ok=True)
classic = runpy.run_path(str(ROOT / "work/art/tag-combat/units.py"))
base_sprite, glove, arm = (classic[n] for n in ("operator", "glove", "arm"))
source = classic["SOURCE"]
CELL = (112, 72)
FOOT = (54, 65)
INK = "#1b1c20"

def point(x, y):
    return round(x), round(y)

def equipment(angle, far=False):
    """Paint each miniature weapon in three-quarter view with a stable vertical axis.

    Pieces are abstract art blocks in sprite pixels. Screen-space depth decides
    which cheek of the receiver, magazine and folded brace is visible per angle.
    """
    c, s = math.cos(angle), math.sin(angle)
    def project(x,y,z):
        return point(42+.87*(c*x-s*y), 32+.87*((s*x+c*y)*.52-z))
    colors = {
        "metal":("#abafa6","#64747a","#43545c"), "rail":("#e0d9bf","#869296","#5c6870"),
        "dark":("#657177","#424e53","#343b42"), "vent":("#303940","#293139","#20272e"),
        "grip":("#8e654c","#6b483b","#483331"), "red":("#e68a52","#ae533a","#884233"),
    }
    def shade(color):
        if not far: return color
        rgb=bytes.fromhex(color[1:])
        return tuple(round(channel*.80) for channel in rgb)
    faces=[]
    def block(x0,x1,y0,y1,z0,z1,material):
        top,light,shadow=colors[material]
        def face(v, color):
            depth=sum(x*s+y*c+.32*z for x,y,z in v)/len(v)
            faces.append((depth, [project(*p) for p in v], shade(color)))
        if c>=0:
            face([(x0,y1,z0),(x1,y1,z0),(x1,y1,z1),(x0,y1,z1)],light)
        else:
            face([(x0,y0,z0),(x1,y0,z0),(x1,y0,z1),(x0,y0,z1)],shadow)
        xx=x1 if s>=0 else x0
        face([(xx,y0,z0),(xx,y1,z0),(xx,y1,z1),(xx,y0,z1)],shadow)
        face([(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)],top)
    block(-10,-8,-1.4,1.4,-2,4,"dark")
    block(-9,-2,-1,1,1.4,3.5,"metal")
    block(-2,15,-2.2,2.2,1,7,"metal")
    block(0,10,-1.9,1.9,7,8.5,"rail")
    block(13,21,-2,2,2.2,5.6,"dark")
    block(20,23,-1.8,1.8,2.6,5.2,"metal")
    block(0,3,-1.3,1.3,-5,2,"grip")
    block(8,12,-1.5,1.5,-6,1.8,"dark")
    block(9.5,13,-1.5,1.5,-8,-4.6,"metal")
    block(10,13.5,-1.6,1.6,-8.5,-7.1,"red")
    yy = 2.35 if c>=0 else -2.35
    im = Image.new("RGBA",(84,64)); d=ImageDraw.Draw(im)
    for _,vs,color in sorted(faces,key=lambda face:face[0]):
        d.polygon(vs,fill=color)
    if abs(c)>.35:
        d.line([project(-6,yy,3),project(-2,yy,3)],fill=shade("#b59876"))
        d.line([project(-1,yy,6),project(4,yy,6)],fill=shade("#d4bb8e"))
        d.line([project(3,yy,5),project(10,yy,5)],fill=shade("#263137"))
        d.point(project(6,yy,5),fill=shade("#d3af74"))
        d.line([project(0,yy,2),project(6,yy,2)],fill=shade("#3b4749"))
        d.line([project(11,yy,-2),project(12.5,yy,-5)],fill=shade("#bbc4b1"))
        for x in (12,15,18):
            d.line([project(x,yy,4.7),project(x,yy,3.5)],fill=INK)
        d.line([project(20,yy,5.5),project(21.7,yy,5.5)],fill=shade("#bdc2b4"))
    alpha=im.getchannel("A")
    from PIL import ImageFilter
    edge=Image.new("RGBA",im.size,INK)
    edge.putalpha(alpha.filter(ImageFilter.MaxFilter(3)))
    edge.alpha_composite(im)
    return edge, project(24,0,4)

def arm_layer(canvas, shoulder, wrist, far):
    arm(canvas,shoulder,wrist,far,1)
    d=ImageDraw.Draw(canvas)
    sx,sy=shoulder
    d.line([(sx-1,sy-2),(sx+1,sy-3),(sx+2,sy-2)],fill="#6a4937" if far else "#d29157",width=2)

def gun(canvas, center, angle, far):
    im,tip=equipment(angle,far)
    x,y=point(*center)
    canvas.alpha_composite(im,(x-42,y-32))
    glove(canvas,x,y+2,far,1)
    return (x+tip[0]-42,y+tip[1]-32)

def shifted_body(lean,sink,step=None):
    original=base_sprite(1,lean,sink)
    if step is not None:
        draw=ImageDraw.Draw(original);draw.rectangle((0,42,95,63),fill=(0,0,0,0))
        legs=source.crop((step*64,64+42,step*64+64,128))
        original.alpha_composite(legs,(0,42))
    out=Image.new('RGBA',CELL);out.alpha_composite(original,(22,5))
    return out

def side(col,forward):
    near_kick=[0,5,2,0,0,0,0,0][col];far_kick=[0,0,0,5,2,0,0,0][col]
    hard=col in (1,3)
    lean=(2 if forward else 0)-(3 if hard else int(max(near_kick,far_kick)>0))
    sink=(1 if forward else 0)+(2 if hard else 0)
    step=[0,1,1,2,3,3,0,2][col] if forward else None
    im=shifted_body(lean,sink,step)
    # Anatomical left hand is farther from the camera. It shows the palm;
    # right hand sits lower, closer and gets the brighter knuckle planes.
    a=(74 if forward else 72)-far_kick, (33 if forward else 34)-2*int(far_kick>1)
    b=(60 if forward else 59)-near_kick, (42 if forward else 43)-2*int(near_kick>1)
    if col in (6,7):
        a=(a[0]-3,a[1]+2);b=(b[0]-2,b[1]+1)
    arm_layer(im,(53+lean,34+sink),(a[0],a[1]+2),True)
    far_tip=gun(im,a,-.35 if col==3 else -.10,True)
    arm_layer(im,(49+lean,39+sink),(b[0],b[1]+2),False)
    near_tip=gun(im,b,-.32 if col==1 else -.045,False)
    return im,[near_tip,far_tip]

def spin_body(theta):
    """Custom front/back body planes keep boots grounded throughout the pirouette."""
    c,s=math.cos(theta),math.sin(theta)
    im=shifted_body(0,1, int(((theta/(2*math.pi))%1)*8)%4)
    if c<0:
        im=ImageOps.mirror(im).transform(CELL, Image.Transform.AFFINE,(1,0,3,0,1,0),
                                          resample=Image.Resampling.NEAREST)
    if abs(s)<.35: return im
    d=ImageDraw.Draw(im)
    # Rebuild the turning bust above the original hips. Raven's black hair,
    # copper scarf and split olive utility belt survive all sixteen angles.
    d.rectangle((0,0,111,44),fill=(0,0,0,0))
    x=54+round(c*1.5); y=3
    def poly(color,verts):
        d.polygon([(x+a,y+b) for a,b in verts],fill=color)
    def line(color,verts,width=1):
        d.line([(x+a,y+b) for a,b in verts],fill=color,width=width)
    def box(color,a,b,j,k):
        d.rectangle((x+a,y+b,x+j,y+k), fill=color)
    poly(INK,[(-6,26),(5,26),(10,29),(9,35),(6,39),(7,42),(-8,42),(-8,38),(-11,34),(-10,29)])
    poly("#6a6840",[(-7,29),(5,29),(8,30),(6,37),(5,40),(-6,41),(-8,34)])
    poly("#404532",[(-8,34),(-2,35),(1,40),(-7,41)])
    line("#9f9055",[(-6,33),(-2,34),(3,33)])
    # The ribbon trails the turn on its tangent, changing side as she rotates.
    tail=round(15*c+7*s)
    poly("#48251e",[(-4,25),(-tail//2-3,26),(-tail-5,22),(-tail-9,23),(-tail-5,27),(-tail-8,30),(-tail-2,29),(-1,30)])
    line("#ca6032",[(-4,27),(-tail//2-3,28),(-tail-4,25)])
    poly("#703621",[(-9,25),(5,23),(9,27),(4,31),(-2,31),(-8,29)])
    line("#d47b3d",[(-8,26),(-3,27),(5,25)])
    line("#ef9b56",[(3,26),(6,25)])
    shift=round(3*c)
    poly("#212124",[(-9+shift,14),(-7+shift,10),(-3+shift,8),(3+shift,9),(7+shift,12),(8+shift,19),(6+shift,24),(2+shift,27),(-4+shift,26),(-8+shift,22)])
    if s>0:
        poly("#9b573a",[(-6+shift,16),(4+shift,13),(7+shift,17),(6+shift,22),(3+shift,25),(-2+shift,24),(-6+shift,21)])
        poly("#d88d58",[(-5+shift,17),(1+shift,15),(6+shift,16),(5+shift,21),(2+shift,23),(-3+shift,21)])
        line("#f4b777",[(-3+shift,18),(1+shift,17),(4+shift,17)])
        line("#52362b",[(-4+shift,17),(-2+shift,18),(-1+shift,18)])
        line("#623629",[(2+shift,18),(4+shift,17)])
        box("#644130",shift,22,shift+2,22)
        poly("#352c28",[(-8+shift,14),(-5+shift,10),(1+shift,9),(5+shift,11),(7+shift,14),(3+shift,14),(-1+shift,13),(-4+shift,17),(-7+shift,19)])
    else:
        poly("#38312b",[(-8+shift,15),(-5+shift,11),(1+shift,10),(5+shift,13),(7+shift,16),(5+shift,22),(1+shift,25),(-5+shift,23)])
        line("#66503d",[(-6+shift,14),(-3+shift,12),(1+shift,12)])
        line("#4e4032",[(-5+shift,16),(-4+shift,20),(-1+shift,23)])
        line("#4b4436",[(-6,33),(0,34),(5,32)])
        box("#bd9657",-3,35,3,36)
    # Ponytail swings away from the cheek, distinct from a second face when viewed from behind.
    hair_dx=round(-6*c-3*s)
    poly("#292623",[(-4+shift,14),(hair_dx-3,14),(hair_dx-5,18),(hair_dx-4,22),(hair_dx-6,24),(hair_dx-2,23),(hair_dx+1,17)])
    line("#604632",[(hair_dx-2,16),(hair_dx-3,18),(hair_dx-4,20)])
    line("#ab6538",[(hair_dx+1,15),(hair_dx,16)])
    line("#d59e63",[(-5,40),(-1,40)])
    return im

def spin_layers(i):
    theta=i*math.tau/16
    rear=Image.new("RGBA",CELL)
    front=Image.new("RGBA",CELL)
    guns=[]
    for hand,direction in enumerate([theta+.32,theta+math.pi-.32]):
        ca,sa=math.cos(direction),math.sin(direction)
        wrist=point(54+ca*17,37+sa*11)
        shoulder=point(54+ca*4.6,36+sa*2)
        guns.append((sa,hand,direction,wrist,shoulder))
    sockets=[None,None]
    for sa,hand,direction,wrist,shoulder in sorted(guns):
        plane=front if sa>=-.10 else rear
        arm_layer(plane,shoulder,(wrist[0],wrist[1]+2),hand==1)
        sockets[hand]=gun(plane,wrist,direction,hand==1)
    return rear,front,sockets

def spin(i):
    rear,front,sockets=spin_layers(i)
    rear.alpha_composite(spin_body(i*math.tau/16))
    rear.alpha_composite(front)
    return rear,sockets

def build_echoes(poses):
    """Three inks preserve the face, scarf, gloves and SMG silhouettes in motion."""
    echoes=Image.new("RGBA",(8*CELL[0],6*CELL[1]))
    spin=poses.crop((0,2*CELL[1],poses.width,poses.height))
    palettes=[
        ["#692e38","#80303e","#9a4146","#b0514d","#bf6250"],
        ["#733142","#a1464c","#c95d57","#e37e62","#f39970"],
        ["#753944","#ad514e","#d77054","#ed975e","#ffd390"]]
    alpha=spin.getchannel("A")
    for bank,palette in enumerate(palettes):
        colors=[tuple(bytes.fromhex(p[1:])) for p in palette]
        out=Image.new("RGBA",spin.size)
        grays=spin.convert("L").tobytes()
        out.putdata([(*colors[min(4,sum(level>q for q in [35,61,99,151]))],a)
                     for level,a in zip(grays,alpha.tobytes())])
        echoes.paste(out,(0,2*CELL[1]*bank))
    echoes.save(OUT/"spin-echo.png",optimize=True)

def build_fx():
    """Draw the brass slugs, pressure flash and directional contact bursts at 1x."""
    w,h=72,56
    atlas=Image.new("RGBA",(6*w,3*h))
    for i in range(6):
        im=Image.new("RGBA",(w,h));d=ImageDraw.Draw(im)
        # A short dense projectile, heel first, with glancing copper and steel planes.
        cx,cy=40,28
        def poly(color,p):
            d.polygon([(cx+x,cy+y) for x,y in p], fill=color)
        poly("#473833",[(-13,-1),(-12,-2),(-6,-2),(-5,-3),(-1,-3),(3,-1),(3,1),(0,3),(-9,3),(-9,2),(-13,1)])
        poly("#cd7c41",[(-11,-1),(-4,-2),(0,-2),(2,-1),(2,1),(-1,2),(-10,2)])
        poly("#f5c581",[(-8,-1),(-3,-2),(0,-1),(1,0),(0,1),(-8,1)])
        d.line([(cx-6,cy-1),(cx-3,cy-1),(cx-1,cy-2)],fill="#fff0b8")
        d.line([(cx-11,cy),(cx-10,cy+1)],fill="#7a5044")
        d.point((cx,cy+1),fill="#9d6445")
        d.point((cx+1,cy),fill="#fff2c1")
        if i%3!=2:d.line([(cx-17,cy),(cx-20-i%3,cy)],fill="#e5a85d")
        atlas.paste(im,(i*w,0))
        im=Image.new("RGBA",(w,h));d=ImageDraw.Draw(im)
        cx,cy=7,28
        length=[17,38,30,21,12,6][i];spread=[4,11,9,6,4,2][i];x=length;s=spread
        poly("#ac533c",[(0,-2),(int(x*.30),-3),(int(x*.45),-s),(int(x*.53),-3),(x-3,-4),
                     (x-6,-1),(x+3,0),(int(x*.55),2),(int(x*.73),s-1),(int(x*.34),4),
                     (int(x*.32),s),(int(x*.17),3),(0,2)])
        poly("#ffad59",[(0,-1),(int(x*.28),-2),(int(x*.42),-s+2),(int(x*.48),-2),(x-5,-3),
                       (int(x*.65),0),(x-1,0),(int(x*.45),2),(int(x*.60),s-2),(int(x*.29),3),(0,1)])
        poly("#fff1aa",[(0,0),(int(x*.31),-2),(int(x*.40),-s//2),(int(x*.43),-1),
                       (int(x*.74),-1),(int(x*.48),1),(int(x*.52),s//2),(int(x*.31),2)])
        d.line([(cx+1,cy),(cx+int(x*.44),cy)],fill="#fffbdc")
        if i in (1,2,3):
            d.line([(cx+x+7,cy-2),(cx+x+11,cy-3)],fill="#f8b776")
            d.point((cx+x//2+5,cy+s+3),fill="#ffe2a0")
        atlas.paste(im,(i*w,h))
        im=Image.new("RGBA",(w,h));d=ImageDraw.Draw(im);cx,cy=34,28
        # Hard expanding flecks continue past contact; no soft circular magic burst.
        radius=[5,13,19,23,26,29][i]
        for n,direction in enumerate([-2.6,-1.80,-1.15,-.69,-.19,.43,1.05,1.76,2.48]):
            r=radius*(.68+(n*3%7)*.052)
            dx,dy=math.cos(direction),math.sin(direction)
            tip=point(cx+dx*r,cy+dy*r)
            tail=point(cx+dx*(r-max(2,8-i)),cy+dy*(r-max(2,8-i)))
            if i<4 or n%2==0:
                d.line([tail,tip], fill=["#f4a96c","#fad284","#f4a870","#c08d70","#aa7963","#745c52"][i],width=2 if i<3 else 1)
                if i<3:d.point(tip,fill="#ffedbf")
        if i<3:
            size=[4,5,3][i]
            poly("#f6a75e",[(-size,0),(-2,-2),(0,-size-2),(2,-2),(size+4,0),(2,2),(0,size+2),(-2,2)])
            d.rectangle((cx-2,cy-1,cx+3,cy+1),fill="#fff7cb")
        atlas.paste(im,(i*w,2*h))
    atlas.save(OUT/"ballistics.png",optimize=True)
    return {"image":"ballistics.png","cell":[w,h],"columns":6,"clips":{
        "slug":{"row":0,"pivot":[40,28],"exposureMs":[30]*6},
        "flash":{"row":1,"pivot":[7,28],"exposureMs":[12,21,19,15,12,11]},
        "contact":{"row":2,"pivot":[34,28],"exposureMs":[16,26,32,34,39,43]}}}

def build():
    poses=Image.new("RGBA",(CELL[0]*8,CELL[1]*4)); sockets=[]
    for row in range(4):
        row_tips=[]
        for col in range(8):
            im,tips=side(col,row==1) if row<2 else spin((row-2)*8+col)
            poses.paste(im,(col*CELL[0],row*CELL[1]));row_tips.append(tips)
        sockets.append(row_tips)
    poses.save(OUT/"raven-smg.png", optimize=True)
    build_echoes(poses)
    gear=Image.new('RGBA',(80,44))
    for x,y,far in ((36,13,True),(24,26,False)):
        im,_=equipment(-.12,far);gear.alpha_composite(im,(x-42,y-32));glove(gear,x,y+2,far,1)
    gear.save(OUT/"dual-smg.png",optimize=True)
    events={"basic":[662,814,972,1815,1967,2125],
            "forward":[640+group*255+offset for group in range(7) for offset in (0,48,96,154)],
            "spin":[648+group*306+offset for group in range(6) for offset in (0,33,69,112,150,200)]}
    data={"image":"raven-smg.png","cell":list(CELL),"foot":list(FOOT),
          "columns":8,"rows":["short_burst","mobile_barrage","spin_0_to_157_5","spin_180_to_337_5"],
          "anglesPerFrame":22.5,"socketOrder":["right_triggers_near","left_triggers_far"],
          "muzzles":sockets,"gear":"dual-smg.png","previewDurationMs":3200,
          "shotMs":events,"previewTravelPixelsPerMs":{"basic":0.68,"forward":1.04,"spin":0.92},
          "tracerFadeAfterContactMs":{"forward":204,"spin":188},
          "echo":{"image":"spin-echo.png","cell":list(CELL),"columns":8,
                  "rowsPerInk":2,"inks":["burnt_claret","vermillion","copper"],"lookbackMs":[210,130,68]},
          "ballistics":build_fx()}
    (OUT/"atlas.json").write_text(json.dumps(data,indent=2)+"\n",encoding="utf8")
    scene=Path(__file__).with_name('raven-scene.js')
    if scene.is_file():
        source=scene.read_text(encoding="utf8")
        for marker,value in [("/*SOCKETS*/",sockets),("/*SHOT_MS*/",events)]:
            source=source.replace(marker,json.dumps(value,separators=(",",":")))
        (OUT/"scene.js").write_text(source,encoding="utf8")

if __name__=="__main__":
    build()

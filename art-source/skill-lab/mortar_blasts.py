"""Native-pixel flash, fire, dust and ground cels for the skill lab."""
from math import cos, pi, sin
from PIL import Image, ImageDraw

CELL = (124, 108)
ANCHOR = (62, 84)
HOLD = [36, 44, 57, 64, 74, 83, 86, 94, 103, 108, 116, 132]
# Each angular pad is a billowing lobe. The underside has its own cooler palette.
LOBE = [(-1,-.15),(-.92,-.5),(-.71,-.74),(-.49,-.79),(-.35,-.99),
        (.07,-1),(.23,-.87),(.50,-.87),(.64,-.68),(.84,-.62),(.88,-.42),
        (1,-.25),(.97,.18),(.86,.31),(.8,.52),(.45,.73),(.22,.7),
        (.08,.85),(-.34,.85),(-.53,.66),(-.78,.58),(-.94,.33)]
FIRE = [
    ("#643e38","#ac503e","#e7773a","#ffc466","#fff1ab"),
    ("#6b3d35","#b64e37","#ee8339","#ffcf65","#fff7b0"),
    ("#5f403b","#a34633","#db6638","#ffaf43","#ffe588"),
    ("#58413d","#9b503a","#cc713d","#f0a452","#ffd78b"),
]
ASH = [
    ("#413e44","#594c50","#77635e","#a98a72","#cfa68d"),
    ("#3e4144","#504e50","#6a6362","#918375","#b1a190"),
    ("#474b4b","#575a58","#6b6f6b","#888e83","#a4a599"),
    ("#505657","#606562","#737973","#8a9287","#a6aaa0"),
]


def sprite(layer, frame, heavy):
    im=Image.new("RGBA",CELL)
    dr=ImageDraw.Draw(im)
    sx=1 if heavy else .91
    sy=1 if heavy else .91
    def points(pts):
        return [(round(ANCHOR[0]+x*sx),round(ANCHOR[1]+y*sy)) for x,y in pts]
    def poly(c,pts):
        dr.polygon(points(pts),fill=c)
    def line(c,pts,width=1):
        dr.line(points(pts),fill=c,width=width)
    def cloud(x,y,rx,ry,pal,variant=0):
        if rx<1 or ry<1:return
        edge,base,face,light,rim=pal
        def skin(shift_x,shift_y,stretch_x,stretch_y,ink):
            pts=[(x+shift_x+rx*a*stretch_x,y+shift_y+ry*b*stretch_y) for a,b in LOBE]
            poly(ink,pts)
        skin(0,0,1,1,edge)
        skin(-.5,-.8,.95,.91,base)
        skin(-rx*.13,-ry*.17,.80,.70,face)
        # Offset highlights show a rolling volume rather than concentric discs.
        poly(light,[(x-rx*.86,y-ry*.2),(x-rx*.70,y-ry*.52),(x-rx*.48,y-ry*.56),
                    (x-rx*.31,y-ry*.78),(x-rx*.04,y-ry*.78),(x+rx*.11,y-ry*.61),
                    (x-rx*.12,y-ry*.55),(x-rx*.20,y-ry*.34),(x-rx*.53,y-ry*.32),
                    (x-rx*.66,y-ry*.12)])
        line(rim,[(x-rx*.67,y-ry*.54),(x-rx*.50,y-ry*.58),(x-rx*.35,y-ry*.74),
                  (x-rx*.10,y-ry*.78)], max(1,round(rx/10)))
        if rx>8:
            line(base,[(x+rx*.52,y-ry*.2),(x+rx*.6,y-ry*.01),(x+rx*.47,y+ry*.20),
                       (x+rx*.23,y+ry*.26),(x+rx*.14,y+ry*.12)],max(1,round(rx/10)))
    if layer=='mark':
        # Soot and chips belong to the ground plane, independently of the smoke.
        w=[3,8,14,21,25,26,26,26,26,26,26,26][frame]*(1.22 if heavy else .88)
        h=w*.27
        irregular=[(-1,.10),(-.78,-.30),(-.80,-.55),(-.45,-.65),(-.32,-1),
                   (-.13,-.72),(.33,-.98),(.43,-.54),(.80,-.42),(1,.05),
                   (.75,.34),(.82,.53),(.35,.81),(.10,.70),(-.25,.95),(-.64,.65)]
        for sz,col in [(1.02,(30,29,31,140)),(.73,(40,35,34,190)),(.38,(51,41,38,210))]:
            poly(col,[(x*w*sz,y*h*sz) for x,y in irregular])
        for i in range(7):
            a=(i*1.76+.19)
            x=cos(a)*w*.66;y=sin(a)*h*.66
            col=("#d77e42","#b06c45","#7d5b47","#5a5048")[min(3,frame//2)]
            line(col,[(x,y),(x+3*cos(a),y+sin(a)),(x+4*cos(a),y+3*sin(a))])
        return im
    if layer=='core':
        if frame<3:
            length=[27,45,33][frame]*(1.13 if heavy else .80)
            for i in range(12):
                a=(-175+i*15.6)*pi/180
                dist=length*(.62+.36*abs(sin(i*1.77)))
                vx,vy=cos(a),sin(a)
                spread=2.4 if frame==0 else 3.2
                poly("#ffac49",[(vx*5-vy*spread,vy*5+vx*spread),(vx*dist,vy*dist),
                                (vx*6+vy*spread,vy*6-vx*spread)])
                line("#fff3b3",[(vx*2,vy*2),(vx*dist*.84,vy*dist*.84)])
            if frame==0:
                poly("#fffbd9",[(-25,0),(-8,-3),(-4,-9),(-1,-19),(3,-8),(6,-5),
                                (17,-7),(10,-2),(26,0),(7,1),(1,8),(-6,2)])
                return im
        # Unfold from a hot base to two uneven bays and a tall central crown.
        width=[0,11,21,30,35,35,32,29,30,32,34,35][frame]
        height=[0,6,13,19,25,29,32,36,41,44,47,49][frame]
        radius=[0,8,13,17,18,17,15,13,11,8,5,2][frame]
        if not heavy:
            width*=.88;height*=.88;radius*=.93
        loc=[(-.79,.65,.63),(-.47,1.13,.83),(.49,1.15,.75),(.91,.45,.59),(.03,1.50,1.03)]
        if heavy:loc.insert(0,(.64,1.52,.54))
        for i,(xx,yy,ss) in enumerate(loc):
            palette=FIRE[(i+1)%len(FIRE)] if frame<=4 else (FIRE[3] if frame==5 and i in (1,4) else ASH[min(3,(frame-5)//2)])
            x=xx*width+sin(i*2.7+frame*.26)*2
            y=-height*yy
            cloud(x,y,radius*ss,radius*ss*(1.07 if heavy else .88),palette,i)
        if frame<=5:
            # A bright, branching column joins the crown to its point of origin.
            k=[0,.52,.80,1,.87,.54][frame]
            pts=[(-23,0),(-12,-5),(-16,-15),(-7,-10),(-8,-27),(-2,-16),(4,-36),
                 (8,-21),(14,-28),(12,-13),(23,-18),(15,-5),(26,-2),(8,2),(-7,2)]
            poly("#ef8237",[(x*k,y*k) for x,y in pts])
            pts=[(-14,0),(-5,-6),(-9,-16),(-2,-12),(1,-24),(6,-14),(11,-17),
                 (8,-5),(16,-3),(5,1),(-4,2)]
            poly("#ffd360",[(x*k,y*k) for x,y in pts])
            poly("#fff5bb",[(x*k,y*k) for x,y in [(-9,0),(-3,-3),(-3,-9),(1,-6),(3,-14),(5,-5),(9,-4),(4,0)]])
        if frame>=8:
            alpha=[212,166,105,65][frame-8]
            im.putalpha(im.getchannel('A').point(lambda a:a*alpha//255))
        return im
    # Horizontal dust rolling outward and dark asphalt chips on different parabolas.
    envelope=[.03,.24,.51,.72,.87,1,1.05,1.1,1.15,1.20,1.25,1.3][frame]
    dust_size=[1,3,6,8,9,9,8,6,5,4,2,1][frame]
    for i in range(7):
        side=1 if i%2==0 else -1
        along=[.43,.38,.70,.69,.93,.90,1][i]
        x=side*envelope*along*(42 if heavy else 36)
        cloud(x,-(1+abs(sin(i*1.3))*6)*envelope,dust_size*(.7+along*.50),
              dust_size*(.42+along*.34),FIRE[3] if frame<3 else ASH[min(3,(frame-3)//3)],i)
    if 1<=frame<=10:
        # Streaks break into silhouetted chunks and lose their hot edges in flight.
        time=[0,.08,.19,.29,.40,.53,.65,.75,.86,.94,.99,1][frame]
        for i in range(11 if heavy else 7):
            side=1 if i%2==0 else -1
            reach=side*(16+37*abs(sin(i*1.4+.63)))
            rise=15+31*abs(cos(i*2.2+.1))
            x=reach*time;y=-4*rise*time*(1-time)+1.5*(i%3)
            s=1+int(i%4==0)
            poly("#39383b",[(x-s,y),(x,y-s-1),(x+s+1,y-1),(x+s,y+s),(x-1,y+s)])
            line("#ffe4a1" if frame<5 else "#a69a83",[(x-s,y),(x,y-s)])
            if frame<5:
                line("#f1a85a",[(x,y+1),(x-side*2,y+5)])
    if frame>=8:
        alpha=[226,172,105,67][frame-8]
        im.putalpha(im.getchannel('A').point(lambda a:a*alpha//255))
    return im


def bake(out):
    files=['mark','core','debris']
    sheet=Image.new('RGBA',(CELL[0]*len(HOLD),CELL[1]*6))
    for heavy in (False,True):
        for row,layer in enumerate(files):
            for col in range(len(HOLD)):
                sheet.paste(sprite(layer,col,heavy),(col*CELL[0],(row+3*heavy)*CELL[1]))
    sheet.save(out/'blast-layers.png',optimize=True)
    return {'image':'blast-layers.png','cell':CELL,'anchor':ANCHOR,'frameDurationMs':HOLD,
            'rows':['grenadeScorch','grenadeFire','grenadeDebris','salvoScorch','salvoFire','salvoDebris']}


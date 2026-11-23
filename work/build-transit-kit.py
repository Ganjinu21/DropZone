"""Paint the orthogonal station and rolling-stock atlas used by game/transit-kit.js.

Coordinates are native game pixels. Each entrance is the same 72 × 108 plan;
the cardinal transform rotates the footprint before vertical posts are raised.
This keeps light, sheet-metal highlights and projected post heights in world space.
"""
from pathlib import Path
from random import Random
from PIL import Image, ImageDraw

OUTPUT = Path(__file__).resolve().parents[1] / "game" / "transit-kit.png"
sheet = Image.new("RGBA", (512, 416))

def canvas(w, h):
    return Image.new("RGBA", (w, h))

DARK = '#29373a'
STEEL = '#87958f'
SILVER = '#c1c5ad'
PALE = '#dbd6b6'

def entrance(ori, hood):
    im = canvas(128,128)
    d = ImageDraw.Draw(im)
    rng = Random(460 + 'NESW'.index(ori))
    # (cross, along) runs from deep end (-52) to street end (+52).
    def pt(u,v,z=0):
        x,y={'S':(u,v),'E':(v,-u),'N':(-u,-v),'W':(-v,u)}[ori]
        return (64+x,65+y-z)
    def quad(x1,y1,x2,y2,color,z=0):
        d.polygon([pt(x1,y1,z),pt(x1,y2,z),pt(x2,y2,z),pt(x2,y1,z)],fill=color)
    def face(a,b,h,col):
        d.polygon([pt(*a),pt(*b),pt(*b,h),pt(*a,h)],fill=col)
    def rail(points,col,width=1):
        d.line([pt(*p) for p in points],fill=col,width=width)
    def post(x,y):
        rail([(x,y,0),(x,y,11)],'#253337',3)
        rail([(x,y,1),(x,y,11)],'#aeb8aa')
    # Bed, stone curb and open shaft. Global shadows don't rotate with the sprite.
    p=[pt(-37,-54),pt(37,-54),pt(37,49),pt(-37,49)]
    d.polygon([(x+3,y+3) for x,y in p],fill=(16,25,27,62))
    quad(-36,-54,36,48,'#333f41');quad(-35,-53,35,46,'#8c927f')
    quad(-32,-50,32,46,'#192a2d')
    palette=['#344347','#3d4a4b','#4c5957','#5d6963','#68736c','#788077','#879083','#939c8b','#a5a996','#a3aa99','#a9b09c','#a8ad98']
    for n,color in enumerate(palette):
        v=-23+n*5
        quad(-29,v,29,v+4,color)
        quad(-29,v+3,29,v+4,'#46524f' if n>5 else '#2d3c3d')
        if n>3:rail([(-27,v,0),(27,v,0)],'#9a9f8d')
        for _ in range(2):
            xx=rng.randrange(-26,26)
            rail([(xx,v+1,0),(xx+rng.randrange(2,5),v+1,0)],rng.choice(['#57645f','#929785']))
    quad(-29,-49,29,-25,'#202f32');quad(-23,-47,23,-43,'#2b3b3f')
    # Damp tile cladding inside the threshold sheds light down the sides.
    for j in range(4):
        tone=['#263a3d','#304447','#354a49','#415453'][j]
        for side in [-1,1]:quad(side*29,-47+j*6,side*25,-43+j*6,tone)
    quad(-20,-45,20,-42,'#283f40')
    quad(-15,-44,15,-43,'#47625a')
    # A narrow warm recessed luminaire is visible inside the dark stairwell.
    quad(-22,-39,-9,-37,'#667466')
    quad(-21,-39,-11,-38,'#a3a186')
    quad(17,-41,21,-37,'#3b544c')
    for vx in [-23,-10,2,16]: rail([(vx,-34,0),(vx+4,-34,0)],'#304449')
    # Warmer safety nosing appears only at the pedestrian threshold.
    quad(-31,36,31,42,'#867d54')
    for xx in range(-29,31,4):
        for yy in [37,40]: quad(xx,yy,xx+1,yy,'#c3af6b')
    for yy in [43,46]:rail([(-34,yy,0),(34,yy,0)],'#8b8f81')
    # Cast concrete sidewalls, using screen-space normals for the lit vs. dark face.
    panels=[]
    for x1,x2 in [(-36,-30),(30,36)]:
        footprint=[(x1,-53),(x2,-53),(x2,37),(x1,37)]
        for a,b in zip(footprint,footprint[1:]+footprint[:1]):
            panels.append((max(pt(*a)[1],pt(*b)[1]),a,b))
    for _,a,b in sorted(panels):face(a,b,5,'#687266' if pt(*a)[1]==pt(*b)[1] else '#424f50')
    for edge in [-33,33]:
        quad(edge-3,-53,edge+3,37,'#a3a99b',5)
        for v in range(-45,34,18):rail([(edge-3,v,5),(edge+2,v,5)],'#69756d')
        for v in [-48,-24,2,31]:post(edge,v)
        rail([(edge,-50,12),(edge,30,12),(edge,35,7)],'#314347',3)
        rail([(edge,-50,13),(edge,30,13),(edge,35,8)],'#c2c9ba')
    # Skylight is a compact partial weather hood, leaving the actual steps visible.
    # Each glazing pane has gasket strips and horizontal cross rails.
    if hood:
        for edge in [-33,33]:
            for v in [-50,-15]:
                rail([(edge,v,2),(edge,v,19)],'#34484b',4)
                rail([(edge,v,3),(edge,v,19)],'#839890')
        quad(-38,-53,38,-14,'#253e41',17)
        for col in range(4):
            xx=-35+col*18
            quad(xx,-50,xx+16,-16,['#607e77','#7d9286','#5e7773','#6e8480'][col],18)
            quad(xx+2,-48,xx+7,-18,'#84988b',18)
            rail([(xx,-34,18),(xx+16,-34,18)],'#536b66',2)
            rail([(xx,-48,18),(xx+15,-48,18)],'#a3b4a0')
            if col==1:
                rail([(xx+5,-32,18),(xx+11,-27,18),(xx+7,-23,18),(xx+15,-19,18)],'#485d5b')
        for col in [0,2]:
            xx=-33+col*18
            rail([(xx,-47,19),(xx+5,-43,19),(xx+8,-43,19)],'#a4b4a2')
            rail([(xx+4,-44,19),(xx+9,-40,19)],'#8da79c')
        for yy in [-52,-15]:rail([(-38,yy,19),(38,yy,19)],'#536f6c',3)
        rail([(-38,-52,20),(38,-52,20)],'#bec6b4')
    return im

for row,hood in enumerate([False,True]):
    for col,ori in enumerate("NESW"):
        sheet.alpha_composite(entrance(ori,hood),(col*128,row*128))

# Passenger saloon, vestibule and driver modules all meet on the same roof,
# body waist and underframe lines. The first and last pixel columns tile.
def shell(w, seed):
    im=canvas(w,99);d=ImageDraw.Draw(im);rng=Random(seed)
    bands=[(7,8,'#404c50'),(9,10,'#b3b9ad'),(11,12,'#c6c8b6'),(13,15,'#b3b7a8'),
           (16,24,'#9da69f'),(25,27,'#929d97'),(28,29,'#818f89'),(30,31,'#c0c4b5'),
           (32,34,'#455759'),(35,36,'#82918e'),(37,59,'#a6afa5'),(60,61,'#bac0ad'),
           (62,65,'#3f7668'),(66,69,'#45806d'),(70,70,'#94a694'),(71,74,'#92988b'),
           (75,79,'#afb3a4'),(80,80,'#c8c7b5'),(81,83,'#76847d'),(84,85,'#424f50'),
           (86,89,'#344346')]
    for y1,y2,c in bands:d.rectangle([0,y1,w-1,y2],fill=c)
    for y in [16,21,27,73,76,79]:d.line([(0,y),(w-1,y)],fill='#919a91' if y<30 else '#88958b')
    for _ in range(w//3):
        x,y=rng.randrange(w),rng.randrange(11,27)
        d.line((x,y,min(w-1,x+rng.randint(1,5)),y),fill=rng.choice(['#a7afa3','#939c93','#9ca497']))
    for _ in range(max(2,w//7)):
        x,y=rng.randrange(w),rng.choice([61,71,82])
        d.line((x,y,x,y+rng.randrange(1,5)),fill='#838a7b')
    return im,d

def window(d,x,y,w,h,broken=False):
    d.rounded_rectangle([x,y,x+w-1,y+h-1],radius=3,fill='#596760')
    d.rounded_rectangle([x+1,y+1,x+w-2,y+h-2],radius=2,fill='#283a40')
    d.rectangle([x+3,y+3,x+w-4,y+h-4],fill='#3c5257')
    d.rectangle([x+3,y+3,x+w-4,y+5],fill='#52686a')
    d.rectangle([x+4,y+h-7,x+w-5,y+h-5],fill='#687372')
    for sx in range(x+5,x+w-6,9):d.rectangle([sx,y+h-9,sx+6,y+h-7],fill='#695f5d')
    d.polygon([(x+3,y+4),(x+11,y+4),(x+4,y+13),(x+3,y+13)],fill='#678382')
    d.line([(x+3,y+h-2),(x+w-4,y+h-2)],fill='#b9c0b2')
    if broken:
        d.line([(x+w-9,y+4),(x+w-14,y+10),(x+w-10,y+13),(x+w-16,y+20)],fill='#9bac9e')
        d.line([(x+w-14,y+10),(x+w-21,y+9)],fill='#899f98')

def saloon(broken):
    im,d=shell(74,111+broken)
    for i in range(2):
        window(d,3+i*35,37,33,24,broken and i==1)
        d.line((5+i*35,61,33+i*35,61),fill='#78847c')
    d.line((72,34,72,81),fill='#809087')
    for y in [39,45,49,58,72,78]:d.point((72,y),fill='#c0c5b6')
    if broken:
        for j in range(8):d.line((38+j*3,64,41+j*3,64+j%4),fill='#636d61')
    return im

def double_door(opened):
    im,d=shell(38,280+opened)
    d.rectangle((2,34,35,83),fill='#566761')
    d.rectangle((3,36,34,81),fill='#1d3033')
    if opened:
        d.rectangle((6,36,31,75),fill='#3b4542')
        d.line((9,37,9,72),fill='#a1a58e',width=2)
        d.line((24,37,24,73),fill='#7c8b7d')
        d.rectangle((10,62,26,65),fill='#836e5d')
        d.rectangle((12,66,25,69),fill='#514f48')
        for i in [4,31]:d.rectangle((i,36,i+2,80),fill='#aab2a3')
    else:
        for x in [4,19]:
            d.rectangle((x,36,x+13,80),fill='#9da79e')
            d.line((x,36,x,79),fill='#c1c3ae')
            d.line((x+13,37,x+13,80),fill='#668078')
            d.rounded_rectangle((x+2,39,x+11,58),radius=2,fill='#30444a')
            d.rectangle((x+3,40,x+10,42),fill='#77908a')
            d.line((x+3,44,x+6,41),fill='#68827c')
            d.rectangle((x+1,62,x+12,69),fill='#447d6d')
            d.rectangle((x+6,73,x+8,74),fill='#69796e')
    d.rectangle((1,81,36,83),fill='#c9b586')
    for x in range(3,36,4):d.point((x,82),fill='#6a6a5d')
    d.rectangle((6,31,31,34),fill='#54655f');d.rectangle((9,32,29,32),fill='#a9b3a1')
    return im

def cap():
    im,d=shell(53,944)
    # Common projection to the right; straight flat-ended EMU front, not a train nose pasted to the side.
    # Driver side door/window occupies the same side plane as the passenger windows.
    d.rectangle((2,34,27,81),fill='#596d68');d.rectangle((3,35,26,79),fill='#a4aea2')
    window(d,5,37,19,23)
    d.rectangle((5,62,25,69),fill='#417967');d.line((22,73,25,73),fill='#46534f')
    # Stepped profile: roof rounds into cab roof cowl; windshield and skirt follow ONE outline.
    d.polygon([(25,8),(38,9),(44,12),(47,17),(47,23),(49,29),(51,37),(51,69),(48,77),(45,81),(40,84),(26,84)],fill='#657471')
    d.polygon([(26,10),(38,11),(42,13),(44,16),(46,23),(45,30),(27,30)],fill='#b2b8a9')
    d.polygon([(28,11),(37,12),(40,14),(43,17),(44,20),(28,20)],fill='#c3c7b7')
    # Header, small amber destination display, side marker.
    d.polygon([(26,29),(46,28),(49,32),(50,36),(26,36)],fill='#33474a')
    d.rectangle((30,30,43,33),fill='#213338')
    for x in [31,32,35,38,39,41]:d.point((x,31+(x%2)),fill='#a7955f')
    # Narrow front plane, 2 panes separated by an actual mullion. A trace of
    # curvature from the cowl to the skirt, never protruding beyond the car shell.
    d.polygon([(27,36),(45,33),(49,36),(50,48),(49,54),(27,61)],fill='#273b40')
    d.polygon([(28,37),(36,36),(36,54),(28,57)],fill='#41575d')
    d.polygon([(38,36),(45,35),(48,38),(49,50),(38,53)],fill='#4c676b')
    d.line((28,38,35,37),fill='#809699')
    d.line((39,37,46,36),fill='#8faaa6')
    d.line((29,55,35,49),fill='#283b3e')
    d.line((40,51,46,46),fill='#2e4346')
    d.polygon([(26,62),(49,55),(49,67),(47,71),(26,73)],fill='#447d6c')
    d.polygon([(27,63),(49,56),(49,59),(27,66)],fill='#7b9f89')
    for x,y in [(28,66),(44,61)]:
        d.rectangle((x,y,x+4,y+3),fill='#354947');d.line((x+1,y+1,x+3,y+1),fill='#ddc594')
    d.polygon([(27,74),(47,71),(45,76),(41,81),(27,83)],fill='#747f74')
    d.line((29,77,44,74),fill='#a3a797')
    d.rectangle((30,83,40,88),fill='#43504c');d.rectangle((34,84,42,86),fill='#2c3b39')
    mask=Image.new('L',im.size,0); m=ImageDraw.Draw(mask)
    m.polygon([(0,7),(30,7),(39,8),(44,11),(47,15),(48,23),(50,30),(52,37),(52,68),(50,73),(47,78),(42,83),(42,88),(29,89),(0,89)],fill=255)
    im.putalpha(Image.composite(im.getchannel('A'),Image.new('L',im.size,0),mask))
    return im

def hvac():
    im=canvas(63,19);d=ImageDraw.Draw(im)
    d.polygon([(1,5),(4,2),(55,2),(60,5),(60,14),(56,17),(3,17),(1,15)],fill='#707e78')
    d.polygon([(2,4),(5,1),(55,1),(59,4),(58,13),(4,14)],fill='#b3b8a9')
    for x in [7,33]:
        d.rectangle((x,4,x+20,11),fill='#637169')
        for y in [5,7,9,11]:
            d.line((x+1,y,x+19,y),fill='#98a297')
    for px in [4,55]:
        for py in [3,12]:d.point((px,py),fill='#e0dcc8')
    d.line((4,14,56,14),fill='#959f91')
    return im

def bogie():
    im=canvas(62,15);d=ImageDraw.Draw(im)
    for x in [7,42]:
        d.ellipse((x,1,x+12,13),fill='#233033')
        d.ellipse((x+2,3,x+10,11),fill='#55615f')
        d.rectangle((x+4,6,x+8,8),fill='#8d978c')
    d.rectangle((3,0,58,4),fill='#394a4b')
    d.polygon([(8,3),(54,3),(52,7),(43,8),(39,6),(23,6),(18,9),(9,8)],fill='#63706a')
    for x in [19,33]:d.rectangle((x,3,x+9,5),fill='#354342')
    return im

def intercar():
    im=canvas(10,99);d=ImageDraw.Draw(im)
    d.rectangle((0,20,9,79),fill='#2c3b3e')
    for x in [1,4,7]:
        d.rectangle((x,19,x+1,79),fill='#5f6b62')
        d.point((x,20),fill='#9ba394')
    d.rectangle((0,83,9,88),fill='#444d49')
    return im

elements=[
    (0,256,saloon(False)),(80,256,saloon(True)),(160,256,double_door(False)),
    (202,256,double_door(True)),(245,256,cap()),(302,256,shell(14,34)[0]),
    (320,256,intercar()),(339,256,hvac()),(339,279,bogie())
]
for x,y,im in elements:sheet.alpha_composite(im,(x,y))

# Independent platform debris, broken window glass and dislodged passenger door.
door=canvas(24,53);d=ImageDraw.Draw(door)
d.rectangle((1,1,21,50),fill='#475954');d.rectangle((2,2,20,49),fill='#9ba397')
d.rounded_rectangle((4,4,18,25),radius=2,fill='#394f52')
d.line([(6,5),(12,11),(8,14),(16,21)],fill='#93aaa1')
d.rectangle((3,28,19,34),fill='#447966')
d.line((4,45,18,45),fill='#69776a')
sheet.alpha_composite(door,(408,256))
OUTPUT.parent.mkdir(parents=True,exist_ok=True)
sheet.save(OUTPUT,optimize=True)

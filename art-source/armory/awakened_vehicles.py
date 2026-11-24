"""Native field pixels from Bulk's standing concept and the approved shark-mouth aircraft."""
from pathlib import Path
from PIL import Image, ImageDraw
from field_vehicles import SKILLS,paint_vehicle
from catalog_style import ROOT
from grade_clothing import Pixel

HERE=Path(__file__).parent


def mech():
    size=(74,100)
    src=Image.open(ROOT/'design/equipment-concepts/bulk-mech-standing.png').convert('RGBA')
    src=src.crop(src.getchannel('A').point(lambda a:255 if a>160 else 0).getbbox()).resize(size,Image.Resampling.BOX)
    im=Image.new('RGBA',size);p=im.load()
    metal=['#26232a','#323944','#465268','#5b707e','#79919c','#a7b8b8','#dbd8c4']
    cobalt=['#232530','#2e3c54','#3b526f','#4d6987','#718ba3','#9dabb0','#c3c4b5']
    iron=['#272529','#3b3537','#544a46','#73685a','#93836d','#bca887','#dfccaa']
    from PIL import ImageColor
    for y in range(100):
        for x in range(74):
            r,g,b,a=src.getpixel((x,y))
            if a<110: continue
            ramp=cobalt if b>g*1.13 and b>r*1.18 else iron if r>b+10 else metal
            value=.29*r+.42*g+.29*b
            p[x,y]=(*ImageColor.getrgb(ramp[min(6,int(value/35))]),255)
    d=ImageDraw.Draw(im)
    # The canopy has a raised gasket and one seated pilot behind amber armoured glass.
    d.polygon([(24,24),(30,21),(42,21),(48,24),(45,35),(40,39),(30,38),(26,35)],fill='#25282c',outline='#988a73')
    d.polygon([(27,26),(31,23),(41,23),(45,25),(43,32),(38,36),(31,35),(28,32)],fill='#525644')
    d.polygon([(28,26),(32,24),(37,24),(32,29),(29,29)],fill='#b7b992')
    d.rectangle((34,26,39,30),fill='#282d32')
    d.line((35,25,38,25,40,27),fill='#8d9083',width=2)
    d.rectangle((36,28,39,29),fill='#dfb071')
    d.line((31,34,34,31,38,32,41,34),fill='#464e51',width=2)
    d.line((29,36,38,38,44,34),fill='#a7a28c')
    # Air intakes are recessed in the shoulders; rank lights remain small wearing surfaces.
    for x in (8,54):
        for i in range(3): d.line((x+i*2,16,x+2+i*2,13),fill='#a4b0ae')
    for x in (17,51):
        d.rectangle((x,51,x+4,53),fill='#31545c');d.line((x+1,51,x+3,51),fill='#7dd6d0')
    # Each leg rotates from its hip. The torso is separate so the rotating gun never leaves its rack.
    atlas=Image.new('RGBA',(3*74,100))
    for x0,x1,column in ((0,37,0),(37,74,1)):
        leg=im.crop((x0,54,x1,100));atlas.paste(leg,(column*74+x0,54))
    atlas.paste(im.crop((0,0,74,55)),(148,0))
    return atlas


def minigun():
    b=Pixel((44,17))
    b.piece([(0,7),(3,3),(10,2),(15,4),(17,7),(16,12),(12,15),(4,15),(1,12)],'metal')
    b.piece([(10,5),(18,3),(22,4),(24,6),(37,6),(41,5),(43,7),(43,12),(40,13),(23,12),(17,14),(11,13)],'heavy')
    for y,t in ((5,'#9dadab'),(7,'#555f6a'),(9,'#a1aaa8'),(11,'#4c5662')):
        b.pen.line((19,y,39,y),fill=t)
    for x in (21,28,36):
        b.pen.rectangle((x,5,x+1,11),fill='#444852');b.pen.point((x,5),fill='#bbad88')
    b.pen.line((41,6,41,11),fill='#b6af93')
    b.pen.rectangle((7,7,12,9),fill='#39686a');b.pen.line((8,7,11,7),fill='#9fe6d5')
    return b.im


def rocket_rack():
    b=Pixel((48,25))
    # A bank of four independent square tubes with staggered shock mounts.
    for row in range(4):
        x=row%2*3;y=row*5
        b.piece([(x+1,y+4),(x+4,y+1),(x+33,y),(x+39,y+1),(x+42,y+3),(x+41,y+7),(x+36,y+8),(x+4,y+9)],'metal' if row%2 else 'heavy')
        b.seam([(x+9,y+3),(x+23,y+2),(x+30,y+2)],'metal',4)
        b.pen.rectangle((x+31,y+2,x+35,y+4),fill='#2d4b51')
        b.pen.line((x+32,y+2,x+34,y+2),fill='#8ed7c5')
        b.pen.line((x+39,y+3,x+39,y+5),fill='#d0875f')
    for x in (7,22):
        b.pen.line((x,3,x+3,20),fill='#292c31',width=3)
        b.pen.line((x,4,x+2,18),fill='#a69272')
    return b.im


if __name__=='__main__':
    mech().save(SKILLS/'field-mech.png',optimize=True)
    minigun().save(SKILLS/'field-minigun.png',optimize=True)
    rocket_rack().save(SKILLS/'field-rocket-bank.png',optimize=True)
    ref=HERE/'a10-reference.png'
    bird=paint_vehicle(ref,(172,97))
    # The nose paint is part of the hull. Keep red enamel and uneven ivory teeth at sprite size.
    raw=Image.open(ref).convert('RGBA').resize(bird.size,Image.Resampling.BOX)
    for y in range(49,88):
        for x in range(131,172):
            r,g,b,a=raw.getpixel((x,y))
            if a>120 and r>g*1.35 and r>b*1.25:
                bird.putpixel((x,y),(max(87,r),min(66,g),min(61,b),255))
    bird.save(SKILLS/'field-a10.png',optimize=True)

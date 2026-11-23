"""Rebuild the street prop atlas at its native pixel resolution."""
import json
from pathlib import Path
from random import Random
from PIL import Image, ImageDraw

GAME = Path(__file__).resolve().parents[1] / "game"
INK, DARK, SHADE, STEEL, LIGHT = "#20292c", "#354045", "#566065", "#869291", "#bdc1ac"
RUST, OCHRE, GOLD = "#815c47", "#a78257", "#c4aa71"
sprites = {}

def make(key, w, h):
    image = Image.new("RGBA", (w,h))
    sprites[key] = image
    return ImageDraw.Draw(image)

def plate(d, x, y, w, h, col, edge=STEEL):
    d.rectangle((x,y,x+w-1,y+h-1),fill=INK)
    d.rectangle((x+1,y+1,x+w-2,y+h-2),fill=col)
    d.line((x+1,y+1,x+w-3,y+1),fill=edge)
    d.point((x+1,y+2),fill=edge)

def speckle(d, box, n, palette, seed=4):
    r=Random(seed);x,y,ex,ey=box
    for _ in range(n):
        d.point((r.randint(x,ex),r.randint(y,ey)),fill=r.choice(palette))

def tire(d,x,y):
    d.ellipse((x,y,x+9,y+6),fill=INK)
    d.ellipse((x+1,y,x+8,y+4),fill=SHADE)
    d.ellipse((x+2,y+1,x+7,y+3),fill="#232b2d")
    d.line((x+3,y,x+6,y),fill="#77817e")
    d.line((x+3,y+5,x+6,y+5),fill=DARK)

d=make('tires',22,15)
for x,y in [(1,7),(1,4),(1,1),(11,8),(11,5)]: tire(d,x,y)

d=make('cable',18,16)
d.ellipse((3,5,15,15),fill=INK);d.rectangle((3,5,16,12),fill="#514639")
for y in (6,8,10,12):d.line((3,y,15,y),fill="#8a7360")
d.ellipse((1,0,16,8),fill=INK);d.ellipse((2,0,15,6),fill="#a18e71")
d.line((5,2,11,1),fill="#d0b998");d.ellipse((6,2,10,5),fill=DARK)
d.line([(16,10),(17,12),(12,15),(8,14)],fill=INK)

d=make('pallet',26,15)
for x in (2,11,22):d.rectangle((x,1,x+2,14),fill="#574438")
for i in range(4):
    y=1+i*3;d.rectangle((0,y,25,y+1),fill=["#937957","#af9269","#76654e","#a48b6a"][i]);d.line((1,y,21,y),fill="#b5a17e")
    for x in (2,12,23): d.point((x,y),fill="#514b42")

def crate(d,x,y,w,h,fruit):
    plate(d,x,y,w,h,"#665c42","#ba9a65")
    d.rectangle((x+2,y+2,x+w-3,y+h-5),fill="#383a33")
    for i in range(w//3-1):
        for j in range(2):
            px=x+2+i*3+j%2;py=y+2+j*2;d.line((px,py,px+1,py),fill=fruit[(i+j)%len(fruit)])
    d.line((x+1,y+h-3,x+w-2,y+h-3),fill="#aa895e")
    for px in [x+1,x+w-2]: d.line((px,y+1,px,y+h-2),fill=OCHRE)
d=make('crates',24,18);crate(d,0,1,13,11,["#84925a","#a8a267"]);crate(d,10,7,14,11,["#b87546","#b08d53","#a46848"])

d=make('cart',23,18)
for x in (3,17): d.ellipse((x,13,x+4,17),fill=INK);d.point((x+2,15),fill=LIGHT)
plate(d,1,4,20,11,"#566963","#b6bd9e")
d.line([(1,5),(0,0),(5,0),(6,4)],fill=STEEL)
for i in range(3):d.line((3,6+2*i,17,6+2*i),fill="#79877a")
d.rectangle((8,4,14,9),fill="#aa8860");d.line((11,4,11,9),fill="#d4be8a")

d=make('refuse',26,18)
for x,y in [(2,2),(11,1)]:
    plate(d,x,y+2,10,13,"#50605a","#829081")
    d.rectangle((x-1,y+1,x+9,y+3),fill="#34403c");d.line((x-1,y,x+8,y),fill="#829081")
    for xx in [x+2,x+5]:d.line((xx,y+6,xx,y+11),fill="#39473f")
for x,y in [(0,13),(18,11)]:
    d.polygon([(x,y+2),(x+2,y),(x+4,y),(x+7,y+4),(x+6,y+6),(x,y+6)],fill="#2c3333");d.point((x+3,y+1),fill=STEEL)

d=make('bench',28,13)
for x in (4,22):d.rectangle((x,3,x+2,12),fill=DARK)
for y in (1,4,7):plate(d,0,y,28,4,"#836b50","#b09a73")
for x in (2,13,25):d.line((x,3,x,8),fill="#576362")

d=make('barrier',27,13)
for x in (4,22):d.rectangle((x,2,x+1,12),fill=SHADE);d.line((x-2,12,x+2,12),fill=INK)
plate(d,0,2,27,7,"#bf9a5e","#dec58a")
for x in range(3,24,7):d.polygon([(x+1,3),(x+4,3),(x+1,6),(x-2,6)],fill=DARK)

d=make('hydrant',9,13)
d.ellipse((1,8,7,12),fill=DARK);plate(d,2,3,5,9,"#925b49","#c38361");d.rectangle((0,5,8,7),fill="#865744");d.rectangle((2,0,6,3),fill="#ab735c");d.point((3,1),fill="#d7a383")

d=make('junction',15,19)
plate(d,1,2,13,16,"#737c70","#a3aa95");d.line((9,5,9,16),fill=DARK)
for y in range(6,12,2):d.line((3,y,6,y),fill=SHADE)
d.line((2,17,12,17),fill=INK);d.line((0,1,12,1),fill=LIGHT)
d.rectangle((6,13,8,15),fill=GOLD);d.point((7,14),fill=INK)

d=make('fallenLed',52,17)
plate(d,2,2,44,11,"#334044","#88918a");d.rectangle((4,4,42,9),fill="#202b2e")
for i in range(14):
    for j in range(3):
        if (i*3+j*7)%11 in (0,1,4,6,8):d.point((6+i*2,5+j),fill=["#c38e55","#906e46"][i%2])
d.line([(31,3),(28,6),(31,7),(27,10)],fill=LIGHT);d.line([(42,8),(47,11),(50,10),(51,13)],fill=INK)
d.line([(13,13),(10,15),(5,15)],fill=STEEL);d.rectangle((34,12,37,15),fill=SHADE)
for x in (2,19,43):d.point((x,2),fill=LIGHT)

d=make('busStop',48,23)
for x in (2,43):
    d.rectangle((x,4,x+2,21),fill=DARK);d.point((x,19),fill=LIGHT)
plate(d,2,3,43,12,"#657976","#b1b8a6")
for x in (4,17,30):
    d.rectangle((x,5,x+10,13),fill="#45595d")
    d.line((x+2,11,x+7,6),fill="#647e7d")
d.line([(23,5),(21,8),(25,8),(20,12)],fill="#b3c6b8")
plate(d,1,0,45,5,"#748477","#a0ab94");d.rectangle((31,2,41,3),fill="#bdab73")
plate(d,5,12,22,4,"#8c755a","#bda880");d.rectangle((5,16,6,19),fill=INK);d.rectangle((22,16,23,19),fill=INK)
plate(d,30,8,10,9,"#b0b099","#ded9b5");d.line((32,11,37,11),fill="#527a72");d.line((32,13,35,13),fill="#9f735e")

d=make('bike',19,11)
for x in (0,11):d.ellipse((x,4,x+7,10),outline=INK,width=2);d.point((x+3,7),fill=STEEL)
d.line([(3,7),(7,3),(10,7),(3,7)],fill="#947a58");d.line([(11,7),(15,2),(16,7)],fill=STEEL)
d.line((5,2,9,2),fill=INK);d.line((13,1,16,1),fill=LIGHT)

# Passenger vehicles use a plan-view silhouette; turning the chassis by 90° is valid.
def chassis(key,w,h,body,light):
    d=make(key,w,h)
    for x in (6,w-13):
        for y in (0,h-4):
            d.rounded_rectangle((x,y,x+6,y+3),radius=1,fill=INK)
            d.line((x+1,y+1,x+5,y+1),fill=DARK)
    d.rounded_rectangle((0,2,w-1,h-3),radius=3,fill=INK)
    d.rounded_rectangle((1,3,w-2,h-4),radius=2,fill=body)
    d.line((3,3,w-4,3),fill=light);d.line((3,h-4,w-4,h-4),fill=DARK)
    d.line((1,6,1,h-7),fill=SHADE)
    for y in [5,h-7]:
        d.line((1,y,2,y),fill="#ba7155");d.line((w-4,y,w-2,y),fill="#daca99")
    return d

def window(d,corners):
    d.polygon(corners,fill=DARK)
    x,y=corners[0]
    d.line([(x+1,y+1), (x+3,y+1)],fill="#95aaa3")

d=chassis('sedan',38,20,"#77857d","#b3b7a2")
window(d,[(5,5),(13,5),(13,14),(5,14),(7,12),(7,7)])
window(d,[(22,5),(28,6),(30,9),(29,13),(22,14)])
plate(d,11,4,12,12,"#808e86","#aab2a0");d.line((9,6,8,12),fill="#60797b")
d.line([(24,7),(26,10),(24,10),(27,13)],fill="#90a4a0")
d.line((31,6,33,6),fill=LIGHT);d.line((31,13,34,13),fill="#5e6963")
for x in (13,18):d.point((x,16),fill=LIGHT)
speckle(d,(13,6,20,13),8,["#7c8780","#949789",RUST])

d=chassis('ambulance',49,23,"#a7a998","#cfd0ae")
for y in (4,18):d.line((3,y,34,y),fill="#527c73")
plate(d,4,4,30,15,"#a5a998","#d2cfaf")
d.rectangle((11,7,17,13),fill="#49776c");d.rectangle((13,8,15,12),fill="#d4d6bf");d.line((12,10,16,10),fill="#d4d6bf")
plate(d,22,6,7,5,"#7b847b","#c2c3ac")
window(d,[(35,5),(40,6),(42,10),(42,13),(40,17),(35,17)])
d.line((36,5,36,17),fill=INK);d.rectangle((33,6,34,15),fill=DARK)
d.line((33,6,33,9),fill="#b57759");d.line((33,12,33,15),fill="#7f9cae")
d.line((44,6,44,15),fill="#8e998a");speckle(d,(5,6,9,15),9,[OCHRE,RUST,STEEL],8)

d=chassis('truck',49,23,"#727c70","#acaf94")
plate(d,2,3,29,16,"#7b8075","#abae92")
for x in range(5,28,3):d.line((x,5,x,16),fill="#656e66")
d.line([(3,8),(11,7),(14,9),(23,10)],fill="#897c61")
plate(d,32,4,9,15,"#797b63","#adaf8d")
window(d,[(39,5),(42,5),(44,8),(44,14),(42,17),(39,17)])
d.line((33,17,37,17),fill=SHADE);d.line((45,6,45,16),fill="#9c9c7f")

d=chassis('bus',77,30,"#586e78","#a6afb0")
plate(d,3,4,62,20,"#85918b","#bec4ac")
for y in (3,25):
    for x in range(6,62,8):d.line((x,y,x+5,y),fill="#34484e")
for x in (12,43):
    plate(d,x,7,13,9,"#747e76","#adb39f")
    for j in range(4):d.line((x+2+j*2,9,x+2+j*2,13),fill="#4c5a56")
plate(d,30,10,8,6,"#76867f","#aab59e")
d.polygon([(63,5),(70,6),(72,10),(72,18),(70,23),(63,24)],fill="#354a53")
d.line([(66,6),(70,10),(68,13),(70,18)],fill="#9caf9e")
d.rectangle((65,24,71,25),fill="#aa9468")
d.line((6,22,60,22),fill="#9b8b72");speckle(d,(4,7,59,22),38,["#adab93","#6a7772","#97876e"],14)

for key in ['sedan','truck','ambulance']:
    sprites[key+'V']=sprites[key].transpose(Image.Transpose.ROTATE_90)

atlas=Image.new('RGBA',(320,160))
x=y=row_h=0
frames={}
for name,im in sprites.items():
    if x+im.width+2 > atlas.width:
        y+=row_h+3;x=row_h=0
    atlas.paste(im,(x,y))
    frames[name]=[x,y,im.width,im.height]
    x+=im.width+3;row_h=max(row_h,im.height)
atlas.crop((0,0,320,y+row_h)).save(GAME/'street-fixtures.png')
(GAME/'street-fixture-frames.js').write_text(
    "'use strict';\n// Atlas rectangles at native pixel resolution.\nconst fixtureFrames = "
    +json.dumps(frames,indent=2)+";\n")

"""Composite the three approved concepts on the original in-game street at one scale."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "design" / "equipment-concepts"
SHARED = ROOT / "design" / "skill-lab" / "shared"
OUTPUT_SCALE = 3


def content(im):
    alpha = im.getchannel("A")
    solid = alpha.point(lambda a: 255 if a >= 55 else 0).filter(ImageFilter.MedianFilter(3))
    left,top,right,bottom = solid.getbbox()
    return im.crop((max(0,left-2),max(0,top-2),min(im.width,right+2),min(im.height,bottom+2)))


def place(street, art, x, y, width=None, height=None):
    art = content(art)
    ratio = width/art.width if width else height/art.height
    size = (round(art.width*ratio),round(art.height*ratio))
    art = art.resize(size,Image.Resampling.LANCZOS)
    street.alpha_composite(art,(round(x-art.width/2),y-art.height))


def floor_shadow(street,x,y,rx,ry):
    mask = Image.new("RGBA",street.size)
    ImageDraw.Draw(mask).ellipse((x-rx,y-ry,x+rx,y+ry), fill=(13,20,23,80))
    street.alpha_composite(mask)


def export():
    street = Image.open(SHARED/"street.png").convert("RGBA")
    bulk = Image.open(SHARED/"units.png").convert("RGBA").crop((0,0,96,64))
    bunker = Image.open(ART/"bunker-fourway-cupola-mg.png").convert("RGBA")
    poses = Image.open(ART/"mortar-pack-stand-poses.png").convert("RGBA")
    split = poses.width//2
    carry = content(poses.crop((0,0,split,poses.height)))
    installed = content(poses.crop((split,0,poses.width,poses.height)))
    floor_shadow(street,109,110,52,8)
    floor_shadow(street,35,113,10,3)
    floor_shadow(street,276,110,12,3)
    floor_shadow(street,431,110,20,4)
    place(street,bunker,109,112,width=110)
    place(street,bulk,35,115,height=40)
    place(street,carry,276,112,height=40)
    place(street,installed,431,112,height=round(40*installed.height/carry.height))
    field = street.convert("RGB").resize((street.width*OUTPUT_SCALE,street.height*OUTPUT_SCALE),Image.Resampling.NEAREST)
    sheet = Image.new("RGB",(field.width,field.height+98),"#22282b")
    sheet.paste(field)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf",35)
    positions = [(96,"벌크 벙커","#85add4"),(276,"박격포 운반","#e0a36e"),(431,"박격포 설치","#e0a36e")]
    for x,title,accent in positions:
        x *= OUTPUT_SCALE
        draw.rectangle((x-14,field.height,x+14,field.height+3),fill=accent)
        draw.text((x,field.height+62),title,anchor="ms",font=font,fill="#f0f0e9")
    sheet.save(ART/"street-equipment-preview.png",optimize=True)


if __name__ == "__main__":
    export()

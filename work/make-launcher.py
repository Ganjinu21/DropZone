"""Compose the APK launcher layers and platform-sized fallback icons."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "android" / "res"
DRAWABLE = RES / "drawable-nodpi"
DRAWABLE.mkdir(parents=True, exist_ok=True)

# Work on an arcade pixel grid. Android can move the two layers independently.
grid = Image.new("RGB", (108, 108), "#b35633")
draw = ImageDraw.Draw(grid)
draw.rectangle((0, 0, 107, 31), fill="#bd613c")
draw.rectangle((0, 32, 107, 62), fill="#da7e46")
draw.rectangle((0, 63, 107, 107), fill="#f1a756")
draw.ellipse((25, 24, 83, 82), fill="#f4c877")
for rect in ((12, 47, 32, 48), (15, 51, 31, 51), (74, 38, 96, 39),
             (79, 42, 91, 42), (22, 58, 35, 59), (81, 62, 94, 63)):
    draw.rectangle(rect, fill="#d98b52")
draw.polygon([(0,76),(13,76),(13,65),(24,65),(24,71),(35,71),(35,67),
              (41,67),(41,77),(64,77),(64,67),(70,67),(70,59),(77,59),
              (77,66),(86,66),(86,62),(89,62),(89,60),(98,60),
              (98,74),(108,74),(108,108),(0,108)],fill="#986047")
for x, y in ((17,69),(22,69),(66,70),(73,62),(91,65),(95,65),(91,70)):
    draw.rectangle((x,y,x+1,y+1), fill="#d49859")
back = grid.resize((432, 432), Image.Resampling.NEAREST)
back.save(DRAWABLE / "squad_sunset.png")

source = Image.open(ROOT / "work" / "icon-generated.png").convert("RGBA")
alpha_box = source.getchannel("A").point(lambda a: 255 if a >= 128 else 0).getbbox()
head = ImageOps.contain(source.crop(alpha_box), (254,254), Image.Resampling.LANCZOS)
front = Image.new("RGBA", back.size)
front.alpha_composite(head, ((432 - head.width) // 2, 100))
front.save(DRAWABLE / "squad_operator.png")
combined = Image.alpha_composite(back.convert("RGBA"), front)
# Most Android launchers reveal a 72 dp diameter from a 108 dp adaptive layer.
badge = combined.crop((72,72,360,360))
badge.save(ROOT / "work" / "launcher-composed.png")
for qualifier, size in (("mdpi",48),("hdpi",72),("xhdpi",96),("xxhdpi",144),("xxxhdpi",192)):
    target = RES / ("mipmap-" + qualifier)
    target.mkdir(parents=True, exist_ok=True)
    for name, round_icon in (("ic_launcher",False),("ic_launcher_round",True)):
        mask = Image.new("L", badge.size)
        brush = ImageDraw.Draw(mask)
        if round_icon:
            brush.ellipse((1,1,286,286), fill=255)
        else:
            brush.rounded_rectangle((3,3,284,284), radius=52, fill=255)
        masked = badge.copy()
        masked.putalpha(mask)
        masked.resize((size,size), Image.Resampling.LANCZOS).save(target / (name+".png"))

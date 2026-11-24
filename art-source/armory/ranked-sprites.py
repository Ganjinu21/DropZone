"""Build inventory pairs and skill frames from the approved handheld catalog sprites."""
from importlib.util import module_from_spec, spec_from_file_location
from math import cos, sin
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / 'game/art/armory/catalog'
NEAREST = Image.Resampling.NEAREST


def artist(name):
    spec = spec_from_file_location(name, ROOT / 'art-source/skill-lab' / (name + '.py'))
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def raven_sheet(rank):
    raven = artist('raven')
    guns = [Image.open(CATALOG / 'smg' / f'{rank}-{hand}.png') for hand in ('near', 'far')]

    # Offset the two hands on the square inventory tile so each silhouette stays legible.
    near, far = guns
    offset_x, offset_y = round(near.width*.21), round(far.height*.76)
    pair = Image.new('RGBA',(max(offset_x+far.width, near.width),max(far.height,offset_y+near.height)))
    pair.alpha_composite(far,(offset_x,0))
    pair.alpha_composite(near,(0,offset_y))
    pair.save(CATALOG / 'smg' / f'{rank}.png', optimize=True)

    def equipment(angle, far=False):
        # Project a side-view sprite onto the turning weapon's local plane.
        c, s = cos(angle), sin(angle)
        tip = raven.point(42 + .87*c*24, 32 + .87*(s*24*.52 - 4))
        img = guns[int(far)]
        if c < 0:
            img = ImageOps.mirror(img)
        length = max(4, abs(tip[0]-42)/.7)
        w = max(4, round(length))
        h = max(6, round(29*img.height/img.width))
        gun = img.resize((w,h), NEAREST)
        canvas = Image.new('RGBA',(84,64))
        # Preserve depth at the end-on frames by staggering the sprite columns.
        for x in range(w):
            fraction = (x+.5)/w if c >= 0 else (w-x-.5)/w
            lift = round((fraction-1)*29*s*.52)
            canvas.alpha_composite(gun.crop((x,0,x+1,h)),
                                   (tip[0]-(w-1 if c>=0 else 0)+x, tip[1]-round(h*.35)+lift))
        return canvas, tip

    raven.equipment = equipment
    sheet = Image.new('RGBA',(112*8,72*3))
    body = raven.shifted_body
    raven.shifted_body = lambda *args: Image.new('RGBA',raven.CELL)
    for i in range(8):
        hands, _ = raven.side(i, True)
        sheet.paste(hands,(i*112,0))
    raven.shifted_body = body
    for i in range(16):
        pose, _ = raven.spin(i)
        sheet.paste(pose,(i%8*112,(1+i//8)*72))
    sheet.save(CATALOG / 'smg' / f'{rank}-skill.png', optimize=True)


def lynx_sheet(rank):
    lynx = artist('lynx')
    img = Image.open(CATALOG / 'sniper' / f'{rank}.png')
    gun = img.resize((59,round(59*img.height/img.width)), NEAREST)
    def rifle(action):
        layer = Image.new('RGBA',(64,30))
        layer.alpha_composite(gun,(0,8-round(gun.height*.38)))
        return layer
    lynx.rifle = rifle
    lynx.crew.operator = lambda *args: Image.new('RGBA',(96,64))
    sheet = Image.new('RGBA',(7*96,64))
    for i in range(7):
        hands, _ = lynx.pose(i)
        sheet.paste(hands,(i*96,0))
    sheet.save(CATALOG / 'sniper' / f'{rank}-skill.png', optimize=True)


if __name__ == '__main__':
    for rank in ('C','B','A','S','S-plus'):
        raven_sheet(rank)
        lynx_sheet(rank)

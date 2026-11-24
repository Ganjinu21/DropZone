"""Fit the original special-skill art to the field pixel grid and uniform metal ramps."""
from PIL import Image

from catalog_style import ROOT, field_color

SKILLS = ROOT / 'game/art/skills'


def paint_vehicle(source, size, rotor=False):
    original = Image.open(source).convert('RGBA').resize(size, Image.Resampling.BOX)
    result = Image.new('RGBA', size)
    for y in range(size[1]):
        for x in range(size[0]):
            r, g, b, alpha = original.getpixel((x, y))
            # The Cobra rotor is a painted translucent disk. Retain it on the
            # native grid while giving the opaque fuselage a solid ink contour.
            if rotor and min(r, g, b)>187 and alpha<195 and y<53:
                opacity = min(160, round(alpha/32)*32)
                if opacity:
                    result.putpixel((x,y),(236,232,215,opacity))
            elif alpha>=92:
                color = field_color((r,g,b), 'metal', 'A')
                result.putpixel((x,y),(*color,255))
    return result


if __name__=='__main__':
    paint_vehicle(SKILLS/'bunker.png',(112,72)).save(SKILLS/'field-bunker.png',optimize=True)
    paint_vehicle(SKILLS/'bulk-fold.png',(224,144)).save(SKILLS/'field-fold.png',optimize=True)
    paint_vehicle(ROOT/'game/art/prep/cobra.png',(148,78),rotor=True).save(SKILLS/'field-cobra.png',optimize=True)

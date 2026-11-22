"""Bake registered, phone-size sprites from the original Drop Zone artwork."""
from base64 import b64decode
from collections import deque
from io import BytesIO
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
art = json.loads((ROOT / "game/images.js").read_text(encoding="utf8").removeprefix("const ART=").rstrip(";"))
cell = 64
atlas = Image.new("RGBA", (8 * cell, 12 * cell))


def main_component(alpha):
    """A previous cell's muzzle flash occasionally extends into the next cell."""
    mask = alpha.point(lambda a: 255 if a > 50 else 0)
    width, height = mask.size
    pending = {i for i, a in enumerate(mask.getdata()) if a}
    largest = []
    while pending:
        seed = pending.pop()
        component, active = [seed], deque([seed])
        while active:
            p = active.popleft()
            x = p % width
            for q in [p - width, p + width, p - 1 if x else -1, p + 1 if x + 1 < width else -1]:
                if q in pending:
                    pending.remove(q)
                    active.append(q)
                    component.append(q)
        if len(component) > len(largest):
            largest = component
    data = bytearray(width * height)
    for i in largest:
        data[i] = 255
    solid = Image.frombytes("L", mask.size, bytes(data))
    return ImageChops.multiply(solid.filter(ImageFilter.MaxFilter(3)), alpha)


def bake(source, actor_row, columns, source_cell, heights, outline):
    original = Image.open(BytesIO(b64decode(art[source].split(",")[1]))).convert("RGBA")
    for row, height in enumerate(heights):
        for col in range(columns):
            # The flash is rendered independently along the shot heading.
            sample = 6 if source == "frames" and col == 5 else col
            x, y = sample * source_cell, row * source_cell
            unit = original.crop((x, y, x + source_cell, y + source_cell))
            alpha = main_component(unit.getchannel("A"))
            unit.putalpha(alpha)
            baseline = alpha.point(lambda a: 255 if a > 165 else 0).getbbox()[3]
            scaled = unit.resize((height, height), Image.Resampling.LANCZOS)
            alpha = scaled.getchannel("A").point(lambda a: 255 if a >= 115 else 0)
            color = ImageEnhance.Color(scaled.convert("RGB")).enhance(1.19 if source == "frames" else .99)
            color = ImageEnhance.Brightness(color).enhance(1.14 if source == "frames" else 1.04)
            color = color.filter(ImageFilter.UnsharpMask(1.05, 127, 3))
            registered = Image.new("RGBA", (cell, cell))
            anchor = ((cell - height) // 2, cell - 4 - round(baseline * height / source_cell))
            color.putalpha(alpha)
            registered.paste(color, anchor)
            base = Image.new("RGBA", registered.size, outline)
            base.putalpha(registered.getchannel("A").filter(ImageFilter.MaxFilter(3)))
            base.alpha_composite(registered)
            index = actor_row + row
            atlas.paste(base, (col * cell, index * cell))
            flash = Image.blend(base.convert("RGB"), Image.new("RGB", base.size, "#fff0d3"), .72)
            flash.putalpha(base.getchannel("A"))
            atlas.paste(flash, (col * cell, (index + 6) * cell))


bake("frames", 0, 8, 112, [56, 53, 55], "#24292d")
bake("enemy", 3, 4, 88, [38, 37, 51], "#392f35")
# Unused columns beside enemies hold walking legs, free of the lowered rifle.
legs = Image.new("L", (cell, cell))
ImageDraw.Draw(legs).polygon([(17, 34), (36, 34), (41, 42), (43, 46),
                              (55, 48), (58, 63), (7, 63), (7, 45), (14, 42)], fill=255)
for row in (0, 1, 2, 6, 7, 8):
    for col in range(4):
        x, y = col * cell, row * cell
        unit = atlas.crop((x, y, x + cell, y + cell))
        unit.putalpha(ImageChops.multiply(unit.getchannel("A"), legs))
        atlas.paste(unit, (x + 4 * cell, y + 3 * cell))
atlas.save(ROOT / "game/combat-units.png", optimize=True)

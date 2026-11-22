from pathlib import Path
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


SIZE = (760, 720)
SOURCE = Image.open(Path('work/pavement.png')).convert('RGB')


def reflected_texture(crop, size):
    stone = SOURCE.crop(crop).resize(size, Image.Resampling.LANCZOS)
    tile = Image.new('RGB', (size[0] * 2, size[1] * 2))
    tile.paste(stone)
    tile.paste(ImageOps.mirror(stone), (size[0], 0))
    tile.paste(ImageOps.flip(tile.crop((0, 0, tile.width, size[1]))), (0, size[1]))
    surface = Image.new('RGB', SIZE)
    for y in range(0, SIZE[1], tile.height):
        for x in range(0, SIZE[0], tile.width):
            surface.paste(tile, (x, y))
    return surface


road = reflected_texture((140, 270, 791, 777), (380, 360))
road = Image.blend(road, Image.new('RGB', SIZE, '#313b47'), .21)
pavement = reflected_texture((210, 300, 786, 736), (190, 180))
lum = np.asarray(ImageOps.grayscale(pavement)).astype(float)
rng = np.random.default_rng(729)
detail = (lum - 81) * .47 + rng.normal(0, 2.2, lum.shape)
sidewalk = Image.fromarray(np.clip(np.array([93, 94, 92]) + detail[:, :, None], 0, 255).astype('uint8'))
grid = ImageDraw.Draw(sidewalk, 'RGBA')
for row, y in enumerate(range(-16, 740, 16)):
    grid.line((0, y, 760, y), fill=(39, 47, 50, 95))
    grid.line((0, y+1, 760, y+1), fill=(169, 161, 141, 51))
    for x in range((row % 2)*16, 761, 32):
        grid.line((x, y, x, y+16), fill=(47, 51, 51, 85))


def crop_stamp(box, size, feather=3):
    stamp = SOURCE.crop(box).resize(size, Image.Resampling.LANCZOS)
    alpha = Image.new('L', size)
    ImageDraw.Draw(alpha).rounded_rectangle((feather, feather, size[0]-feather-1, size[1]-feather-1), radius=feather, fill=255)
    return stamp, alpha.filter(ImageFilter.GaussianBlur(feather / 2))


cover, cover_mask = crop_stamp((849, 292, 924, 370), (39, 40), 4)
grate, grate_mask = crop_stamp((44, 181, 127, 220), (43, 20), 2)
tactile = SOURCE.crop((66, 106, 97, 138)).resize((8, 8), Image.Resampling.LANCZOS)
weed, weed_mask = crop_stamp((113, 0, 156, 35), (21, 16), 3)
typeface = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 21)


def curb_polygon(left, right, top, bottom):
    c = 18
    return [(left + c, top), (right - c, top), (right, top+c),
            (right, bottom-c), (right-c, bottom), (left+c, bottom),
            (left, bottom-c), (left, top+c)]


def build(variant, name):
    gen = random.Random(530 + variant * 75)
    street = road.copy()
    curbs = Image.new('L', SIZE)
    mask_draw = ImageDraw.Draw(curbs)
    plots = [(x-166, x+420, top, bottom)
             for x in (0, 760) for top, bottom in ((-48, 215), (325, 475), (672, 815))]
    for left, right, top, bottom in plots:
        mask_draw.polygon(curb_polygon(left, right, top, bottom), fill=255)
    street.paste(sidewalk, mask=curbs)
    draw = ImageDraw.Draw(street)
    for left, right, top, bottom in plots:
        for inset, color in ((0, '#343a40'), (1, '#55575a'), (2, '#928a80'), (4, '#7a7671'), (5, '#4c5153')):
            p = curb_polygon(left+inset, right-inset, top+inset, bottom-inset)
            draw.line(p+[p[0]], fill=color, width=1)
        for px in range(left+28, right-18, 25):
            for py in (top, bottom-4):
                draw.line((px, py+1, px+1, py+4), fill='#42474b')
        for px in (left+1, right-4):
            for py in range(top+27, bottom-20, 24):
                draw.line((px, py, px+3, py), fill='#44494a')

    paint = Image.new('RGBA', SIZE)
    ink = ImageDraw.Draw(paint)
    white = (207, 203, 182, 178)
    amber = (200, 154, 75, 184)
    # Main avenue and side street. Leave the junction clear for the crossing.
    for x1, x2 in ((-5, 365), (647, 765)):
        for y in (569, 574):
            ink.rectangle((x1, y, x2, y+1), fill=amber)
    for top, bottom in ((0, 188), (343, 447), (698, 730)):
        for x in (504, 509):
            ink.rectangle((x, top, x+1, bottom), fill=amber)
    for x1, x2 in ((362, 390), (623, 651)):
        for y in range(490, 664, 17):
            ink.rectangle((x1, y, x2, y+7), fill=white)
    for y in (447, 688):
        for x in range(435, 584, 17):
            ink.rectangle((x, y, x+7, y+23), fill=white)
    # Small loading alley, drainage and inset parking bays.
    for x in range(12, 373, 54):
        ink.rectangle((x, 258, x+25, 259), fill=(195, 185, 157, 92))
    for x in range(24, 340, 51):
        ink.line((x, 350, x, 377), fill=(205, 199, 180, 118), width=2)
        ink.line((x, 350, x+13, 350), fill=(205, 199, 180, 118), width=2)
    for x in (391, 612):
        for y in (466, 675):
            ink.rectangle((x-12, y-3, x+12, y+3), fill=(166, 137, 89, 239))
            for dx in range(-10, 11, 4):
                for dy in (-1, 2):
                    ink.point((x+dx, y+dy), fill=(216, 187, 130, 210))
    # A different real-world road marking identifies each block.
    def arrow(x, y, direction):
        outline = [(-22,-2),(8,-2),(8,-6),(21,0),(8,6),(8,2),(-22,2)]
        ink.polygon([(x+u*direction,y+v) for u,v in outline], fill=white)
    arrow(130, 518, -1)
    arrow(697, 617, 1)
    if variant == 1:
        for left in (39, 193):
            ink.rectangle((left, 415, left+119, 446), outline=(192, 163, 105, 121), width=2)
            for x in range(left+15, left+90, 14):
                ink.line((x, 443, x+23, 417), fill=(192, 163, 105, 108), width=2)
    elif variant == 2:
        ink.rounded_rectangle((65, 632, 294, 658), radius=6, outline=(207,169,83,165), width=2)
        ink.text((154, 632), 'BUS', font=typeface, fill=(214,181,103,176))
    else:
        ink.ellipse((207, 595, 262, 635), outline=(211, 203, 178, 150), width=2)
        ink.text((223, 603), '30', font=typeface, fill=(219, 211, 183, 176))
    # Break up painted edges and let original road texture show through.
    alpha = np.array(paint.getchannel('A'), dtype=float)
    weather = np.random.default_rng(463+variant)
    wear = np.clip((lum - 62) / 44, .3, 1)
    wear *= np.where(weather.random(lum.shape) < .17, .18, 1)
    paint.putalpha(Image.fromarray((alpha * wear).astype('uint8')))
    street.paste(paint, mask=paint.getchannel('A'))
    for x,y in [(303, 284), (543, 139), (274+20*variant, 590), (677, 40)]:
        street.paste(cover, (x,y), cover_mask)
    for x,y in [(91,207), (328,468), (278,664), (689,316)]:
        street.paste(grate, (x,y), grate_mask)
    for origin_x in (363, 622):
        for origin_y, direction in ((466, -1), (679, 1)):
            for col in range(4):
                street.paste(tactile, (origin_x + col*8, origin_y))
            for row in range(1, 4):
                street.paste(tactile, (origin_x + 16, origin_y+row*8*direction))
    for x,y in [(45, 197), (404, 334), (670, 451), (137, 681)]:
        street.paste(weed, (x+gen.randint(-10,10), y), weed_mask)
    # Little repair seams add variety without distracting from the squad.
    draw = ImageDraw.Draw(street)
    for _ in range(9):
        x = gen.randrange(25, 715)
        y = gen.choice((242, 276, 400, 522, 605)) + gen.randrange(-12, 12)
        points = [(x,y)]
        for step in range(gen.randrange(3, 6)):
            x += gen.randrange(3,9)
            y += gen.randrange(-4,5)
            points.append((x,y))
        draw.line(points, fill='#454b52')
    street.save(Path('game') / ('street-' + name + '.webp'), quality=83, method=6)


for index, district in enumerate(('market', 'service', 'transit')):
    build(index, district)

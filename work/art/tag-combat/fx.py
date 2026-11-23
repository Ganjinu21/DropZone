"""Bake the tag-combat VFX tiles. Run with Python 3 and Pillow."""

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw


OUT = Path(__file__).resolve().parents[3] / "game/art/tag-combat"
CELL = 48
CENTER = (24, 24)
MUZZLE = (6, 24)

# Spike contours are specified relative to the barrel. Outer flame colors
# keep a readable silhouette on both the pavement and the metro floor.
AMBER = ("#a85333", "#ed974c", "#ffe192", "#fff8dc")
ORANGE = ("#9d4133", "#f17a3f", "#ffd372", "#fff4ce")
ICE = ("#4e7f8e", "#91d5db", "#e7efe0", "#fff9e6")
STEEL = ("#62757e", "#afbab0", "#e4d5a6", "#f5edce")
BRASS = ("#523c37", "#987040", "#e1af65", "#ffe6a5")
CINDER = (162, 139, 121, 160)
VAPOR = (161, 184, 184, 145)


class Tile:
    def __init__(self, pivot):
        self.image = Image.new("RGBA", (CELL, CELL))
        self.draw = ImageDraw.Draw(self.image)
        self.pivot = pivot

    def positions(self, points):
        return [(self.pivot[0] + x, self.pivot[1] + y) for x, y in points]

    def polygon(self, points, color):
        self.draw.polygon(self.positions(points), fill=color)

    def line(self, points, color, width=1):
        self.draw.line(self.positions(points), fill=color, width=width)

    def dot(self, x, y, color):
        self.draw.point(self.positions([(x, y)]), fill=color)


def shard(tile, x, y, dx, dy, thickness, color, glint=None):
    """Pointed chip, with an optional single lit facet."""
    norm = math.hypot(dx, dy)
    px = -dy / norm * thickness / 2
    py = dx / norm * thickness / 2
    tip = (x + dx, y + dy)
    tile.polygon([(round(x + px), round(y + py)),
                  (round(x - px), round(y - py)), tip], color)
    if glint:
        tile.line([(x, y), (x + round(dx * .55), y + round(dy * .55))], glint)


# Each role is drawn from its own silhouette: a squat, hot crown, a small
# crooked pistol tongue, and a long split cone from the rifle's brake.
CROWNS = [
    [(0,-2),(4,-3),(9,-7),(9,-4),(15,-6),(13,-2),(23,-1),(19,1),
     (15,2),(18,5),(12,4),(12,7),(6,4),(2,3),(0,1)],
    [(0,-1),(4,-3),(8,-7),(9,-4),(12,-5),(10,-2),(20,-3),(17,0),
     (10,2),(13,4),(8,3),(6,5),(5,3),(1,2)],
    [(0,-2),(4,-2),(3,-6),(6,-5),(9,-3),(12,-5),(20,-7),(16,-3),
     (12,-1),(25,-2),(35,-1),(29,1),(21,2),(13,2),(19,6),(15,6),
     (8,3),(7,5),(3,7),(4,3),(0,2)],
    [(0,-1),(3,-2),(7,-4),(6,-1),(12,-1),(10,1),(6,1),(7,3),(3,2),(0,1)],
]


def muzzle(role, frame, colors):
    tile = Tile(MUZZLE)
    edge, hot, yellow, white = colors
    if frame == 3:
        # The extinguished flash leaves only broken smoke and a warm fleck.
        x = (12, 9, 18, 6)[role]
        tile.line([(x,-2),(x+2,-2),(x+3,-3)], VAPOR if role == 2 else CINDER)
        if role != 3:
            tile.line([(x+7,-4),(x+8,-4),(x+9,-5)], (154,162,162,100))
            tile.dot(x+3, 1, (*bytes.fromhex(hot[1:]), 145))
        return tile
    scales = [(0.42,0.47),(1,1),(0.62,0.48)]
    sx, sy = scales[frame]
    crown = CROWNS[role]
    def layer(xs, ys, xoff, yoff, color):
        tile.polygon([(round(x * sx * xs) + xoff, round(y * sy * ys) + yoff)
                      for x, y in crown], color)
    layer(1,1,0,0,edge)
    layer(.90,.78,0,0,hot)
    layer(.66,.50,0,0,yellow)
    layer(.44,.31,0,0,white)
    if frame == 1 and role != 3:
        reach = (24, 20, 34)[role]
        tile.line([(reach-4,-1),(reach-1,-1)], yellow)
        tile.line([(reach//2,-8),(reach//2+3,-10)], hot)
        if role == 2:
            tile.line([(8,6),(11,8),(13,8)], hot)
            tile.dot(23,4,white)
    if frame == 2 and role != 3:
        reach = (20, 17, 30)[role]
        shard(tile,reach,-2,3,-1,2,hot)
        tile.dot(reach//2, -5, yellow)
    return tile


def bullet(role, frame, colors):
    tile = Tile(CENTER)
    edge, hot, yellow, white = colors
    length = [7, 5, 12][role]
    # Separate a compact copper projectile from its short, broken wake.
    tile.polygon([(-length, -1),(-3,-1),(0,0),(-3,2),(-length,2)], "#533f37")
    tile.line([(-length,-1),(-4,-1),(-2,0)], yellow)
    tile.line([(-length,0),(-2,0)], "#eba667")
    tile.line([(-length,1),(-3,1)], "#b76e49")
    tile.dot(-1,0,white)
    tile.dot(-length,1,hot)
    if role == 2:
        tile.line([(-length+2,-1),(-5,-1)], white)
    gap = 3 + (frame % 2)
    wake = -length-gap
    tile.line([(wake-((3,2,5)[role]),0),(wake,0)], (*bytes.fromhex(hot[1:]), 180))
    if frame in (0,2):
        tile.dot(wake-((6,5,8)[role]),0,(*bytes.fromhex(edge[1:]),135))
    return tile


def impact(frame, piercing=False):
    tile = Tile(CENTER)
    edge, hot, yellow, white = ICE if piercing else ORANGE
    rays = ([(13,-6),(16,1),(10,7),(4,-10),(-5,-5),(-6,3)]
            if piercing else [(-8,-8),(3,-11),(9,-5),(10,3),(-7,5),(4,7)])
    if frame == 0:
        tile.polygon([(-3,-1),(-1,-4),(1,-2),(4,-2),(3,1),(0,3),(-3,2)], hot)
        tile.line([(-2,0),(2,-1)], white, 2)
        return tile
    stretch, start, length = [(0,0,0),(1,.16,.83),(1.19,.64,.35),(1.35,.91,.11)][frame]
    for i,(dx,dy) in enumerate(rays):
        if frame == 3 and i % 2:
            continue
        x,y = round(dx*start*stretch), round(dy*start*stretch)
        shard(tile,x,y,round(dx*length*stretch),round(dy*length*stretch),
              (0,4,3,2)[frame], hot if frame < 3 else edge, yellow if frame < 3 else None)
    if frame == 1:
        tile.polygon([(-5,-1),(-2,-3),(0,-5),(2,-2),(6,-2),(4,0),
                      (3,3),(0,2),(-2,4),(-2,1)], yellow)
        tile.line([(-3,0),(2,-1)], white, 2)
    if frame == 2:
        for x,y in [(3,-4),(7,0),(-5,2)]:
            tile.line([(x,y),(x+1,y)], CINDER)
    return tile


def brass(frame):
    tile = Tile(CENTER)
    profiles = [
        [(-3,0),(-1,-2),(0,-2),(2,0),(2,1),(0,3)],
        [(-3,-1),(2,-1),(3,0),(3,1),(2,2),(-3,2)],
        [(-2,-2),(-1,-3),(2,-1),(3,0),(1,2),(0,2)],
        [(-1,-3),(1,-3),(1,2),(0,3),(-2,2),(-2,-2)],
    ]
    tile.polygon(profiles[frame],BRASS[0])
    facets = [[(-2,0),(1,2)],[(-2,0),(2,0)],[(-1,-2),(2,0)],[(0,-2),(0,1)]]
    tile.line(facets[frame], BRASS[2], 2)
    tile.dot(*facets[frame][0],BRASS[3])
    return tile


def block(frame):
    tile = Tile(CENTER)
    # At the point of contact, hot fragments peel tangentially off the plate.
    plate = ["#578cc8","#c9e6ff","#86b9ee",(102,153,216,145)][frame]
    scale = [.44,1,1.24,1.35][frame]
    crest = [(0,-14),(2,-10),(2,-7),(4,-4),(4,3),(2,7),(1,11),(-1,13)]
    lip = [(round(x*scale),round(y*scale)) for x,y in crest]
    if frame == 3:
        tile.line(lip[:3],plate)
        tile.line(lip[-3:],plate)
    else:
        tile.line(lip,plate, 2 if frame == 1 else 1)
    if frame < 2:
        tile.line([(2,-2),(4,-1),(5,1)],"#fffadc",2)
    for dx,dy in [(9,-8),(12,-1),(6,9)]:
        pos = (.14,.28,.75,1.12)[frame]
        span = (.16,.70,.42,.19)[frame]
        shard(tile,4+round(dx*pos), round(dy*pos),round(dx*span),round(dy*span),
              3 if frame == 1 else 2, AMBER[frame % 3], AMBER[2] if frame < 3 else None)
    return tile


def tag(frame):
    tile = Tile(CENTER)
    offset = [8,4,1,0][frame]
    width = [13,11,9,6][frame]
    gold = ["#c18a53","#ffda8d","#ffecba","#d8b575"][frame]
    # Two lateral ticks compress into the established command chevron.
    for sign in (-1,1):
        start = sign*(width+offset)
        if frame < 3:
            tile.line([(start,-3),(start,-1),(start-sign*2,1)],gold,2)
            if frame == 1:
                tile.dot(start+sign*3,-4,AMBER[1])
    y = [-7,-4,-1,0][frame]
    tile.polygon([(-width,y-3),(0,y+1),(width,y-3),(width,y),(0,y+6),(-width,y)],"#554537")
    tile.polygon([(-width+1,y-3),(0,y+1),(width-1,y-3),(width-1,y-1),(0,y+4),(-width+1,y-1)], gold)
    tile.line([(-width+2,y-2),(-width+4,y-2)],"#fff5cc")
    return tile


def bake():
    rows = [
        ("bulk_muzzle", MUZZLE, [18,30,36,60], lambda f: muzzle(0,f,AMBER)),
        ("raven_muzzle", MUZZLE, [16,24,22,34], lambda f: muzzle(1,f,ORANGE)),
        ("lynx_muzzle", MUZZLE, [20,45,40,75], lambda f: muzzle(2,f,ICE)),
        ("support_muzzle", MUZZLE, [17,18,22,32], lambda f: muzzle(3,f,STEEL)),
        ("bulk_bullet", CENTER, [22]*4, lambda f: bullet(0,f,AMBER)),
        ("raven_bullet", CENTER, [18]*4, lambda f: bullet(1,f,ORANGE)),
        ("lynx_bullet", CENTER, [17]*4, lambda f: bullet(2,f,ICE)),
        ("hit_spark", CENTER, [18,29,40,45], impact),
        ("pierce_exit", CENTER, [18,34,43,53], lambda f: impact(f,True)),
        ("brass", CENTER, [36,40,44,50], brass),
        ("shield_block", CENTER, [18,35,50,65], block),
        ("tag_pulse", CENTER, [44,55,65,105], tag),
    ]
    atlas = Image.new("RGBA", (CELL*4, CELL*len(rows)))
    data = {"image":"fx.png","frameSize":[CELL,CELL],"columns":4,
            "heading":"right","worldPixelsPerTexel":1,"clips":{}}
    for row,(name,pivot,timing,render) in enumerate(rows):
        for frame in range(4):
            source = render(frame).image
            atlas.paste(source,(CELL*frame,CELL*row))
        data["clips"][name] = {"row":row,"pivot":pivot,"durationMs":timing,
                               "loop":name.endswith("_bullet") or name=="brass"}
    OUT.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT/"fx.png", optimize=True)
    (OUT/"fx.json").write_text(json.dumps(data,indent=2)+"\n",encoding="utf-8")


if __name__ == "__main__":
    bake()

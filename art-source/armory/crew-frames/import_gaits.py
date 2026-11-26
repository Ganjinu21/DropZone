"""Register whole-body, eight-pose model sheets; each row is one costume.

Usage: python import_gaits.py SOURCE_DIRECTORY ROLE ACTION
The checked-in strips are the finished paintings, including both boots, arms,
head and equipment. The game only selects one complete cel per operator.
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

import pack
from shield_registration import register_shield

REFERENCE = pack.HERE.parent / 'field-reference'
sys.path.insert(0, str(REFERENCE))
from import_frames import grid


def matte(image):
    rgba = np.asarray(image.convert('RGBA'), dtype=np.float32)
    a = rgba[:, :, 3:] / 255
    return np.uint8(rgba[:, :, :3] * a + 46 * (1 - a))


def belt_center(image):
    a = np.asarray(image.getchannel('A')) > 130
    h = a.shape[0]
    xs = np.nonzero(a[round(h * .48):round(h * .58)])[1]
    return float(np.median(xs))


def stature(im, action):
    a = np.asarray(im.getchannel('A')) > 128
    # In raised aim the barrel may project above the helmet. Measure away
    # from its tip. A changing stride must not change the zoom on the hood.
    band = a[:, :round(im.width*.64)] if action=='up' else a
    rows = np.flatnonzero(band.sum(axis=1) >= max(3, round(im.width*.029)))
    return im.height-int(rows[0])


def place_row(figures, action, original):
    ref = original.crop(original.getbbox())
    height = stature(ref, action)
    target_x = original.getbbox()[0] + belt_center(ref)
    statures = [stature(im, action) for im in figures]
    typical = np.median(statures)
    tiles = []
    for im, measured in zip(figures, statures):
        # Retain the illustrated weight transfer but correct accidental zoom
        # within a row. Register to the torso, never the swinging boot.
        scale = height / np.clip(typical, measured * .984, measured * 1.016)
        scale = min(scale, (pack.TILE - 8) / im.width, (pack.SOLE - 3) / im.height)
        w, h = round(im.width * scale), round(im.height * scale)
        x = round(np.clip(target_x - belt_center(im) * scale, 3, pack.TILE - w - 3))
        tile = Image.new('RGBA', (pack.TILE, pack.TILE))
        tile.paste(im.resize((w, h), pack.LANCZOS), (x, pack.SOLE - h))
        tiles.append(tile)
    return tiles


def boot_contacts(tile):
    """Sole landmarks of the two visible boots, ordered horizontally."""
    ink = np.asarray(tile.getchannel('A')) > 100
    start = pack.SOLE - 34
    y, x = np.nonzero(ink[start:])
    left, right = np.percentile(x, [8, 92])
    mid = (left + right) / 2
    # Prefer the transparent space between boots. In a passing pose one boot
    # overlaps the planted one, so stay close to the middle of the pair.
    columns = np.arange(round(left+.22*(right-left)), round(right-.22*(right-left))+1)
    density = ink[start:].sum(axis=0)
    split = columns[np.argmin(density[columns] + .55*np.abs(columns-mid))]
    points = []
    for side in (x <= split, x > split):
        bottom = y[side].max()
        points.append((float(np.median(x[side & (y >= bottom-3)])), float(start+bottom)))
    return points


def settle_stride(tiles, role):
    """Keep the contact boot grounded while retiming the weight of whole paintings."""
    feet = [boot_contacts(im) for im in tiles]
    center = np.median([np.mean([p[0] for p in feet[i]]) for i in (0, 4, 7)])
    cm = {'bulk':194, 'raven':170, 'lynx':170, 'hammer':176, 'cct':182}[role]
    # Five world units per cel; the supporting boot travels back by that
    # amount relative to the pelvis on each tick of the 40-unit stride.
    delta = 5 * pack.HEIGHT / (54.75 * cm/170)
    reach = (-2, -1.42, .15, 1.6, 2, 1, 0, -1)
    lift = (0, 11, 13, 3, 0, 0, 0, 0)
    yy, xx = np.indices((pack.TILE, pack.TILE), dtype=np.float32)
    result = []
    for phase, (im, soles) in enumerate(zip(tiles, feet)):
        opposite = (phase+4)%8
        goals = sorted((center+reach[j]*delta, pack.SOLE-1-lift[j]) for j in (phase, opposite))
        transfer = np.sin((phase+.5)*np.pi/4)
        # A continuous registration from crown through shoulders and pelvis
        # to both soles preserves the original drawing across every joint.
        pins = [(center, 84, 0, 0), (center, 125, -.8*transfer, 0),
                (center+62, 121, 0, 0), (center, 165, 1.4*transfer, .7*np.cos(phase*np.pi/2))]
        # When the swing foot passes in front of the shin the bottom
        # silhouette is just one boot. Never pull its heel and toe apart.
        if phase in (2, 6) or soles[1][0]-soles[0][0]<24:
            planted = max(soles, key=lambda point: point[1])
            soles = [planted]
            goals = [(center, pack.SOLE-1)]
        for (x, y), (gx, gy) in zip(soles, goals):
            shift = np.clip(gx-x, -8, 8), np.clip(gy-y, -5, 5)
            for ox, oy in ((-7, -4), (6, -4), (0, -12)):
                pins.append((x+ox, y+oy, *shift))
        total = np.zeros_like(xx)
        dx = np.zeros_like(xx)
        dy = np.zeros_like(xx)
        for x, y, sx, sy in pins:
            weight = ((xx-x-sx)**2 + (yy-y-sy)**2 + 25)**-1.5
            total += weight
            dx += weight*sx
            dy += weight*sy
        rgba = np.asarray(im, dtype=np.float32).copy()
        rgba[:, :, :3] *= rgba[:, :, 3:] / 255
        moved = cv2.remap(rgba, xx-dx/total, yy-dy/total, cv2.INTER_LINEAR)
        moved[:, :, :3] *= 255/np.maximum(1, moved[:, :, 3:])
        result.append(Image.fromarray(np.uint8(np.clip(np.rint(moved), 0, 255))))
    return result


def locate_patch(reference, current, bounds, scales, reach):
    """Find a painted detail on the new pose using its prior field reference."""
    x, y, r, b = bounds
    w, h = r - x, b - y
    stamp = reference[y:b, x:r]
    best_score = -np.inf
    for sx, sy in scales:
        nw, nh = max(3, round(w * sx)), max(3, round(h * sy))
        stamp2 = cv2.resize(stamp, (nw, nh), interpolation=cv2.INTER_AREA)
        left, top = max(0, x - reach), max(0, y - reach)
        right, bottom = min(256, x + reach + nw), min(256, y + reach + nh)
        corr = cv2.matchTemplate(current[top:bottom, left:right], stamp2, cv2.TM_CCOEFF_NORMED)
        yy, xx = np.indices(corr.shape)
        corr -= .0013 * np.hypot(xx + left - x, yy + top - y)
        iy, ix = np.unravel_index(np.argmax(corr), corr.shape)
        if corr[iy, ix] > best_score:
            best_score = corr[iy, ix]
            cx, cy = int(ix + left), int(iy + top)
            best = [cx, cy, cx + nw, cy + nh]
    return best


def register_points(tile, role, original, authored, shield_size):
    ref, target = matte(original), matte(tile)
    points = authored.copy()
    for j in ([0, 3] if role == 'raven' else [0]):
        x, y = authored[j:j+2]
        radius = 8
        l, t, _, _ = locate_patch(ref, target, (x-radius, y-radius, x+radius+1, y+radius+1),
                                  [(1, 1)], 32)
        points[j:j+2] = [l+radius, t+radius]
    if role == 'bulk':
        scales = [(sx, sy) for sx in (.68, .82, .96, 1.10, 1.24)
                  for sy in (.78, .90, 1.02, 1.14)]
        bounds = locate_patch(ref, target, authored[3:7], scales, 33)
        tile, points = register_shield(tile, bounds, shield_size, points, pack.SOLE)
    return tile, points


def import_sheet(folder, role, action):
    rank_marks = json.loads((REFERENCE/'barrels.json').read_text())[role]
    shield_marks = json.loads((pack.HERE/'bulk'/'shields.json').read_text())
    paintings = grid(folder / f'{role}-{action}.png', len(pack.RANKS), 8)
    # Individually art-directed reach and heel-strike drawings for the far
    # leg. They are complete figures, just like the other six paintings.
    pair = next(pair for pair in [('level','down'), ('travel','toward'), ('away','up')] if action in pair)
    contacts = grid(folder / f'bridge-{role}-{pair[0]}-{pair[1]}.png', len(pack.RANKS), 4)
    for row in range(len(pack.RANKS)):
        i = row*4 + pair.index(action)*2
        paintings[row*8+3:row*8+5] = contacts[i:i+2]
    if role == 'bulk' and action == 'level':
        paintings[-5:-3] = grid(folder/'bulk-cross-contact.png', 1, 2)
    for row, rank in enumerate(pack.RANKS):
        root = pack.HERE / role / rank
        # Bulk's earlier retreat reused his side view so the face of his
        # shield stayed visible. Register the new retreat to that reference.
        reference_action = 'travel' if role=='bulk' and action=='away' else action
        original = Image.open(root / f'{reference_action}-1.webp').convert('RGBA')
        marks = pack.pose_points(original, action, role)
        if action in rank_marks[rank]:
            marked = rank_marks[rank][action][0]
            marks[:2] = marked[:2]
            if role == 'raven':
                marks[3:5] = marked[2:4]
        size = shield_marks[rank]['size']
        if role == 'bulk':
            original, marks = register_shield(original, shield_marks[rank][reference_action][0], size, marks, pack.SOLE)
        figures = paintings[row*8:row*8+8]
        figures = [im.crop(im.getchannel('A').point(lambda a: 255 if a>95 else 0).getbbox()) for im in figures]
        pictures = settle_stride(place_row(figures, action, original), role)
        strip = Image.new('RGBA', (pack.TILE*8, pack.TILE))
        points = []
        for step, tile in enumerate(pictures):
            tile, tip = register_points(tile, role, original, marks, size)
            y = np.flatnonzero((np.asarray(tile.getchannel('A'))>128).sum(axis=1)>=3)[-1]
            rise = int(pack.SOLE-1-y)
            strip.paste(tile, (step*pack.TILE, rise))
            tip[1] += rise
            for j in range(4,len(tip),2):
                tip[j] += rise
            points.append(tip)
        dest = root / 'gait'
        dest.mkdir(exist_ok=True)
        strip.save(dest / f'{action}.webp', lossless=True, method=4)
        meta = dest / 'anchors.json'
        data = json.loads(meta.read_text()) if meta.exists() else {}
        data[action] = points
        meta.write_text(json.dumps(data, separators=(',', ':'), sort_keys=True)+'\n')


if __name__ == '__main__':
    import_sheet(Path(sys.argv[1]), sys.argv[2], sys.argv[3])

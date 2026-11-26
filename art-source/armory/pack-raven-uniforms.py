"""Register the costume artwork to Raven's original portrait and animation cels."""
from pathlib import Path
import json
import re

import cv2
import numpy as np
from PIL import Image

here = Path(__file__).resolve().parent
dest = here.parents[1] / 'game/art/armory/raven-cels'
names = ['B', 'A', 'S', 'S-plus']


def register_portraits():
    original = np.array(Image.open(dest / 'portrait-C.png').convert('RGBA'))
    sheet = Image.open(here / 'raven-painted/uniform-portraits.webp')
    h, w = original.shape[:2]
    y, x_pos = np.indices((h, w))
    detector = cv2.SIFT_create()
    gray = lambda rgba: cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2GRAY)
    points, descriptors = detector.detectAndCompute(gray(original), original[:, :, 3].copy())
    # Only neutral vest panels and fingerless gloves can receive painted upgrades.
    # The face, ponytail, bare arms, red scarf and original alpha stay registered.
    red, green, blue = original[:, :, :3].astype(float).transpose(2, 0, 1)
    unpainted = (red - green > 22) | (green - blue > 17) | (y < h * .54)
    coverage = ((~unpainted) & (original[:, :, 3] > 16)).astype('float32')
    coverage *= cv2.GaussianBlur(coverage, (3, 3), .6)
    for n, name in enumerate(names):
        x, row = n % 2, n // 2
        cell = sheet.crop((x*sheet.width//2, row*sheet.height//2,
                           (x+1)*sheet.width//2, (row+1)*sheet.height//2))
        art = np.array(cell.convert('RGBA').resize((w, h), Image.Resampling.LANCZOS))
        keypoints, desc = detector.detectAndCompute(gray(art), art[:, :, 3].copy())
        pairs = cv2.BFMatcher().knnMatch(desc, descriptors, k=2)
        matches = [a for a, b in pairs if a.distance < .77*b.distance]
        src = np.float32([keypoints[m.queryIdx].pt for m in matches])
        target = np.float32([points[m.trainIdx].pt for m in matches])
        transform, inliers = cv2.estimateAffinePartial2D(src, target, ransacReprojThreshold=3.0)
        if transform is None or sum(inliers.flat) < 10:
            raise ValueError('Portrait registration failed: '+name)
        patch = cv2.warpAffine(art, transform, (w, h))
        blend = (coverage * (patch[:, :, 3]/255))[:, :, None]
        # The generated gloves have slightly different knuckle positions. Tint the
        # registered glove pixels instead of transferring a second set of fingers.
        hands = (y > h * .80) & ((x_pos < w * .62) | (x_pos > w * .80))
        tint = np.array([(68,78,58),(210,156,37),(178,47,54),(131,208,211)][n])
        original_rgb = original[:, :, :3].astype(float)
        glove_finish = np.clip(original_rgb * .78 + tint * (.08 + gray(original)[:, :, None]/600), 0, 255)
        patch_rgb = np.where(hands[:, :, None], glove_finish, patch[:, :, :3])
        result = original.copy()
        result[:, :, :3] = np.rint(original_rgb*(1-blend) + patch_rgb*blend)
        Image.fromarray(result).save(dest / f'uniform-face-{n+1}.webp', lossless=True, method=4)


# Four-point material ramps carry the supplied palette through the authored fabric folds.
graphite = ['10161c','252b34','46515d','818d96']
ivory = ['26313d','788a96','d5deda','fffbeb']
gold = ['3c2915','a76c15','edb72c','ffeb96']
red = ['320f1a','8e2032','da3b47','ff9c86']
cyan = ['172c3b','286978','62dce9','d4ffff']
olive = ['1a2221','3c4535','68735a','a1ab88']
palettes = {
    'B': (olive, olive, graphite, graphite),
    'A': (gold, graphite, graphite, gold),
    'S': (red, red, graphite, graphite),
    'S-plus': (ivory, ivory, graphite, cyan),
}


def pack_actions():
    data = (dest / 'grips.js').read_text()
    origins = json.loads(re.search(r'const ravenWearOrigins=(.*?);', data, re.S)[1])
    rows = (len(origins['top']) + 7)//8
    cell = 144
    base = Image.open(dest / 'base.png').convert('RGBA').resize((8*cell, rows*cell), Image.Resampling.LANCZOS)
    base_alpha = np.array(base.getchannel('A'))
    for name in names:
        result = Image.new('RGBA', base.size)
        for part, ramp in zip(('top','pants','boots','gloves'), palettes[name]):
            # Use the existing tailored masks (no helmet) for each exact original pose.
            material = Image.open(dest / (part+'-'+name+'.png')).convert('RGBA')
            rgba = np.array(material)
            light = np.array(material.convert('L'))
            stops = np.array([list(bytes.fromhex(c)) for c in ramp])
            occupied = light[rgba[:, :, 3] > 160]
            anchors = np.percentile(occupied, [2, 37, 78, 99])
            for channel in range(3):
                rgba[:, :, channel] = np.interp(light, anchors, stops[:, channel])
            material = Image.fromarray(rgba)
            width, height = material.width//8, material.height//rows
            for i, (x, y) in enumerate(origins[part]):
                col, row = i%8, i//8
                patch = material.crop((col*width, row*height, (col+1)*width, (row+1)*height))
                result.alpha_composite(patch, (col*cell+x, row*cell+y))
        # Keep the costume inside the original silhouette, including the hair and soles.
        opacity = np.array(result.getchannel('A'))
        opacity[base_alpha < 250] = 0
        result.putalpha(Image.fromarray(opacity))
        result.save(dest / ('uniform-'+name+'.webp'), quality=94, method=5)


if __name__ == '__main__':
    register_portraits()
    pack_actions()

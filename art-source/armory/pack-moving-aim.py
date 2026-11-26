"""Bake walking boot motion into the registered aim poses, from the knee down."""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

assets = Path(__file__).resolve().parents[2] / "game/art/armory/rank-crew"
size, knee, sole = 192, 133, 182
y, x = np.mgrid[knee:size, :size].astype(np.float32)
weight = np.clip((y - knee) / (sole - knee), 0, 1)
weight = weight * weight * (3 - 2 * weight)

for role in ("bulk", "raven", "lynx", "hammer", "cct"):
    source = Image.open(assets / f"{role}-aim.webp").convert("RGBA")
    sheet = Image.new("RGBA", (8 * size, 9 * (size - knee)))
    for grade, column in enumerate((3, 2, 4)):
        for elevation in range(3):
            left, top = column * size, elevation * size
            tile = np.array(source.crop((left, top, left + size, top + size)))
            # Measure the actual boots so cloaks and off-centre poses remain registered.
            feet = np.where(tile[sole-10:sole, :, 3].max(axis=0) > 120)[0]
            middle = (feet[0] + feet[-1]) * .5
            side = np.tanh((x - middle) / 5)
            for beat in range(8):
                phase = beat * np.pi / 4
                shift = 15 * np.sin(phase) * side
                lift = 12 * np.maximum(0, side * np.cos(phase))
                pixels = cv2.remap(tile, (x - weight * shift).astype('float32'),
                                   (y + weight * lift).astype('float32'), cv2.INTER_LINEAR)
                sheet.paste(Image.fromarray(pixels), (beat * size, (grade * 3 + elevation) * (size - knee)))
    sheet.save(assets / f"{role}-steps.webp", lossless=True, method=4)

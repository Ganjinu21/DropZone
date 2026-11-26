"""Register the painted plate within each full-body Bulk cel at atlas pack time."""
import cv2
import numpy as np
from PIL import Image


def register_shield(image, bounds, size, muzzle, sole):
    left, top, right, bottom = bounds
    width, height = size
    # Hold the inboard grip near its source position. A planted shield stops at
    # ground level even when the operator continues to lower his shoulders.
    x = round(left + .15 * (right - left - width))
    y = min(round(top + .2 * (bottom - top - height)), sole - height)

    def axis(source_start, source_end, start, end, length):
        # Interpolate the original painting continuously across its silhouette,
        # including the gauntlet and rim. No detached equipment layer or matte.
        coords = np.arange(length, dtype=np.float32)
        low, high = min(start, source_start)-14, max(end, source_end)+17
        delta = np.interp(coords, [low, start, end, high],
                          [0, source_start-start, source_end-end, 0]).astype(np.float32)
        weight = np.clip(np.minimum((coords-start+12)/12, (end+12-coords)/12), 0, 1)
        return delta, weight

    dx, wx = axis(left, right, x, x+width, image.width)
    dy, wy = axis(top, bottom, y, y+height, image.height)
    yy, xx = np.indices((image.height, image.width), dtype=np.float32)
    mx = xx + wy[:, None] * dx
    my = yy + dy[:, None] * wx

    pixels = np.asarray(image).copy()
    rgba = pixels.astype(np.float32)
    rgba[:, :, :3] *= rgba[:, :, 3:] / 255
    sampled = cv2.remap(rgba, mx, my, cv2.INTER_LINEAR)
    sampled[:, :, :3] *= 255 / np.maximum(1, sampled[:, :, 3:])
    changed = (mx != xx) | (my != yy)
    pixels[changed] = np.clip(np.rint(sampled[changed]), 0, 255).astype('uint8')
    # Flash and projectile placement must follow the very same registered cel.
    at = np.argmin((mx-muzzle[0])**2 + (my-muzzle[1])**2)
    my_tip, mx_tip = np.unravel_index(at, mx.shape)
    return Image.fromarray(pixels), [int(mx_tip), int(my_tip), muzzle[2], x, y, x+width, y+height]

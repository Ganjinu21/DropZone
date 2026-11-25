"""Painted in-betweens for Bulk, using landmarks on his registered field cels."""
import numpy as np
from PIL import Image


# Visor, crown, near pauldron, elbow, grip, muzzle, outside top of shield,
# inside top, inside/outside bottom, near knee, heel, far knee, far boot.
# Coordinates are in the existing 256px rig, in order: idle, 8, 9, 10, 11.
LANDMARKS = [
    [(150,48),(141,28),(93,68),(74,114),(112,120),(154,125),(205,92),(182,110),(185,183),(196,193),(111,181),(85,231),(169,178),(165,227)],
    [(133,55),(122,30),(68,59),(39,97),(70,103),(108,112),(200,99),(172,122),(180,222),(191,235),(79,180),(41,233),(151,174),(145,222)],
    [(145,74),(136,47),(77,80),(62,131),(101,120),(149,114),(200,99),(163,114),(163,207),(179,235),(87,178),(51,233),(146,178),(147,221)],
    [(156,98),(149,67),(90,88),(66,143),(110,143),(155,125),(199,91),(159,124),(163,203),(193,235),(90,188),(49,233),(147,190),(144,225)],
    [(161,108),(153,80),(93,109),(81,151),(115,153),(140,137),(196,93),(144,114),(143,207),(167,236),(96,200),(51,234),(143,201),(142,227)],
]


def mesh_points(a, b, weight):
    # Fit a smooth displacement through corresponding landmarks. Boots and
    # cell corners constrain the ground plane; helmet and shield move rigidly.
    anchors = [(0,0),(255,0),(0,255),(255,255),(128,247)]
    a = np.array(a + anchors, dtype=float)/256
    b = np.array(b + anchors, dtype=float)/256
    mid = (1-weight)*a + weight*b
    def kernel(points):
        d2 = ((points[:,None]-mid)**2).sum(axis=2)
        return d2*np.log(np.maximum(d2,1e-12))
    linear = np.column_stack((np.ones(len(mid)),mid))
    system = np.block([[kernel(mid)+np.eye(len(mid))*.0004,linear],
                       [linear.T,np.zeros((3,3))]])
    rhs = np.vstack((np.column_stack((a-mid,b-mid)),np.zeros((3,4))))
    grid = np.array([(x,y) for y in range(0,257,8) for x in range(0,257,8)])/256
    terms = np.column_stack((kernel(grid),np.ones(len(grid)),grid))
    delta = terms @ np.linalg.solve(system,rhs)
    return [((grid+offset)*256).reshape(33,33,2) for offset in np.hsplit(delta,2)]


def brace_inbetweens(cels, idle):
    keys = [cels[i] for i in (idle,8,9,10,11)]
    frames = []
    for step, ((first,tip_a),(last,tip_b)) in enumerate(zip(keys,keys[1:])):
        for weight in (1/3,2/3):
            warped = []
            for image, grid in zip((first,last),mesh_points(LANDMARKS[step],LANDMARKS[step+1],weight)):
                mesh = [((x*8,y*8,x*8+8,y*8+8),tuple(grid[[y,y+1,y+1,y],[x,x,x+1,x+1]].ravel()))
                        for y in range(32) for x in range(32)]
                warped.append(image.convert('RGBa').transform((256,256),Image.Transform.MESH,mesh,Image.Resampling.BICUBIC))
            pose = Image.blend(*warped,weight).convert('RGBA')
            tip = [round(a+(b-a)*weight) for a,b in zip(tip_a,tip_b)]
            frames.append((pose,tip))
    return frames

"""Track painted muzzle landmarks through the six frames of each shooting cycle."""
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

HERE=Path(__file__).resolve().parent
FRAMES=HERE.parent/'crew-frames'
RANKS=('C','B','A','S','S-plus')
# Points are in a 256px registered frame. Front-facing barrels end at the
# visible bore inside the silhouette; projecting to its outer edge hits a boot.
SEEDS={
    'hammer':{
        'down':[(157,161),(162,159),(162,158),(162,159),(162,161)],
        'nadir':[(103,132),(102,130),(102,130),(102,130),(101,132)]},
    'bulk':{'down':[(136,183)]*5,'nadir':[(101,142),(100,141),(100,142),(99,141),(99,140)]},
    'lynx':{'nadir':[(117,149)]*5},
    'cct':{'nadir':[(109,160),(108,159),(103,159),(116,159),(105,160)]},
    'raven':{
        'zenith':[(137,75,85,87)]*5,
        'up':[(194,76,176,101)]*5,
        'level':[(177,111,165,138),(186,112,169,139),(192,112,169,139),
                 (189,108,170,131),(189,116,168,146)],
        'down':[(165,185,170,156)]*5,
        'nadir':[(111,144,105,141),(111,143,106,140),(114,145,106,141),
                 (118,148,112,146),(110,147,104,144)]},
}


def track(reference,current,x,y):
    radius,reach=9,25
    stamp=reference[y-radius:y+radius+1,x-radius:x+radius+1]
    x0=max(0,x-radius-reach);y0=max(0,y-radius-reach)
    x1=min(current.shape[1],x+radius+reach+1);y1=min(current.shape[0],y+radius+reach+1)
    match=cv2.matchTemplate(current[y0:y1,x0:x1],stamp,cv2.TM_CCOEFF_NORMED)
    yy,xx=np.indices(match.shape)
    score=match-.003*np.hypot(xx+x0+radius-x,yy+y0+radius-y)
    by,bx=np.unravel_index(np.argmax(score),score.shape)
    return [int(x0+bx+radius),int(y0+by+radius)]


def raster(path):
    pixels=np.asarray(Image.open(path).convert('RGBA'),dtype=np.int32)
    rgb=((pixels[:,:,:3]*pixels[:,:,3:]+45*(255-pixels[:,:,3:]))//255).astype('uint8')
    return rgb


def measure():
    answer={}
    for role,actions in SEEDS.items():
        answer[role]={}
        for i,rank in enumerate(RANKS):
            result={}
            for action,by_rank in actions.items():
                frames=[raster(FRAMES/role/rank/f'{action}-{j}.webp') for j in range(1,7)]
                points=by_rank[i];seq=[]
                for j,im in enumerate(frames):
                    marks=[]
                    for x,y in zip(points[::2],points[1::2]):
                        marks.extend(([x,y] if j==0 else track(frames[0],im,x,y)))
                    seq.append(marks)
                result[action]=seq
            answer[role][rank]=result
    (HERE/'barrels.json').write_text(json.dumps(answer,separators=(',',':'))+'\n')


if __name__=='__main__':
    measure()

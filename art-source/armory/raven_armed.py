"""Bake Raven's equipped artwork. Coordinates below are on the 1199x1312 painted master."""
import json
import re
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageOps
import numpy as np

FILTER = Image.Resampling.LANCZOS
BOXES = ((354, 387, 858, 611), (710, 92, 1140, 445))
ELBOWS = ((409, 497), (763, 400))
NOSES = ((838, 455), (1112, 268))
WRISTS = ((537,524),(860,353))
# The original key drawing kept both props horizontal. Turn the painted hand,
# thumb, and gun together at the cuff to continue the forearm's action line.
BARREL_DEGREES = (5,-27)
ARMS = (
    [(373,483),(391,463),(415,462),(439,472),(462,480),(494,496),(531,505),
     (557,501),(589,487),(608,477),(648,476),(688,480),(695,495),(680,507),
     (666,510),(664,524),(654,544),(642,557),(609,562),(563,560),(517,554),
     (465,550),(394,539),(373,527)],
    [(746,370),(775,374),(813,357),(848,343),(860,327),(890,300),(914,289),
     (944,290),(984,294),(984,316),(961,329),(955,351),(941,369),(911,383),
     (880,394),(817,427),(782,435),(752,430),(736,413)]
)
GUN_BOXES = ((522,418,841,572),(805,214,1116,385))
GLOVE_COLORS = (None,'#a89465','#8eaeb3','#a096ae','#dbb675')

def polygon(size, points):
    mask = Image.new('L', size)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    return mask

def glove_variant(img, mask, tier):
    if not tier:
        return img
    shade = ImageOps.colorize(img.convert('L'),'#181922',GLOVE_COLORS[tier],whitepoint=165)
    out = img.copy()
    out.paste(shade,mask=mask)
    out.putalpha(img.getchannel('A'))
    return out

def profiles(src, out, ranks):
    source = Image.open(src/'armed-master.png').convert('RGBA')
    rgb = np.asarray(source).astype(float)
    r,g,b,alpha = rgb.transpose(2,0,1).copy()
    key = np.clip((g-np.maximum(r,b)-6)/28,0,1)
    # Eliminate chroma spill in the semitransparent anti-aliased edge as well.
    rgb[:,:,1] = np.minimum(g,np.maximum(r,b)+3)
    clean = Image.fromarray(np.uint8(rgb))
    sockets = (out.parent/'weapon-sockets.js').read_text()
    arms = Image.new('RGBA',(2*200,25*100))
    guns = Image.new('RGBA',(2*128,5*64))
    removable = Image.new('L', source.size)
    for hand,(box,gu,points) in enumerate(zip(BOXES,GUN_BOXES,ARMS)):
        l,t,rr,bb = box
        # The two padded rotation tiles overlap. Select only this prop's chroma.
        keypart = Image.new('L',(rr-l,bb-t))
        keypart.paste(Image.fromarray(np.uint8(255*key[gu[1]:gu[3],gu[0]:gu[2]])),
                      (gu[0]-l,gu[1]-t))
        limb = polygon(source.size,points).crop(box)
        selection = ImageChops.lighter(limb,keypart)
        removable.paste(ImageChops.lighter(removable.crop(box),selection),(l,t))
        srcpart = clean.crop(box)
        coverage = ImageChops.multiply(selection,srcpart.getchannel('A'))
        # Transfer each catalog finish to the same sculpt. Material UVs meet at
        # the actual grip and muzzle heights, including on the asymmetric far view.
        side = 'far' if hand else 'near'
        wx,wy=WRISTS[hand][0]-l,WRISTS[hand][1]-t
        cols=np.indices((bb-t,rr-l))[1]
        moving=ImageChops.lighter(keypart,Image.fromarray(np.uint8(255*np.clip((cols-wx+5)/8,0,1))))
        fixed=ImageChops.multiply(limb,Image.fromarray(np.uint8(255*np.clip((wx+5-cols)/6,0,1))))
        fits = json.loads(re.search(r'^  '+('smgFar' if hand else 'smg')+r': (\[.*\])',sockets,re.M)[1])
        guw,guh = gu[2]-gu[0],gu[3]-gu[1]
        gy,gx = np.indices((guh,guw))
        shade = np.clip((g[gu[1]:gu[3],gu[0]:gu[2]]/255)**.6,.43,1)
        normalized = []
        for rank,fit in zip(ranks,fits):
            art = Image.open(out.parent/'catalog'/'smg'/f'{rank}-{side}.png').convert('RGBA')
            data = np.array(art)
            known = data[:,:,3]>100
            # Extend paint under the common shell wherever a variant has a cutout.
            filled = Image.fromarray(data[:,:,:3])
            while not known.all():
                total = np.zeros_like(data[:,:,:3],dtype=float)
                count = np.zeros(known.shape)
                for dy,dx in ((0,1),(0,-1),(1,0),(-1,0)):
                    pad = np.pad(known,1)
                    k = pad[1+dy:1+dy+art.height,1+dx:1+dx+art.width]
                    px = np.pad(np.asarray(filled),((1,1),(1,1),(0,0)),mode='edge')
                    total += px[1+dy:1+dy+art.height,1+dx:1+dx+art.width]*k[:,:,None]
                    count += k
                edge = ~known & (count>0)
                arr = np.array(filled)
                arr[edge] = total[edge]/count[edge,None]
                filled = Image.fromarray(arr)
                known |= edge
            u = np.interp(gx/guw,[0,.34,1],[0,fit['grip'][0],1])
            v = np.interp(gy/guh,[0,.24,.70,1],[0,fit['bore'],fit['grip'][1],1])
            sampled = np.asarray(filled)[np.minimum((v*art.height).astype(int),art.height-1),
                                         np.minimum((u*art.width).astype(int),art.width-1)]
            finish = Image.fromarray(np.uint8(np.clip(sampled*(.50+.58*shade[:,:,None]),0,255)))
            color = srcpart.copy()
            painted = color.copy()
            painted.paste(finish,(gu[0]-l,gu[1]-t))
            color.paste(painted,mask=keypart)
            color.putalpha(coverage)
            thumb = np.asarray(limb)>0
            dark = ((r[t:bb,l:rr]<1.26*g[t:bb,l:rr]) & (key[t:bb,l:rr]<.15))
            glove = Image.fromarray(np.uint8(255*(thumb & dark &
                (np.indices(thumb.shape)[1]>(844 if hand else 526)-l))))
            for tier in range(5):
                layer=glove_variant(color,glove,tier)
                base=layer.copy()
                base.putalpha(ImageChops.multiply(coverage,fixed))
                layer.putalpha(ImageChops.multiply(coverage,moving))
                layer=layer.rotate(-BARREL_DEGREES[hand],Image.Resampling.BICUBIC,center=(wx,wy))
                base.alpha_composite(layer)
                tile=base.resize((200,100),FILTER)
                arms.paste(tile,(hand*200,(ranks.index(rank)*5+tier)*100))
            norm = art.transform((128,64),Image.Transform.MESH,[
                ((a,c,d,e),(u0,v0,u0,v1,u1,v1,u1,v0))
                for a,d,u0,u1 in [(0,44,0,art.width*fit['grip'][0]),(44,128,art.width*fit['grip'][0],art.width)]
                for c,e,v0,v1 in [(0,16,0,art.height*fit['bore']),(16,43,art.height*fit['bore'],art.height*fit['grip'][1]),(43,64,art.height*fit['grip'][1],art.height)]
            ],Image.Resampling.BICUBIC)
            normalized.append((norm,finish.resize((128,64),FILTER)))
        # Median of the five registered silhouettes: identical grip, magazine
        # clearance and footprint in every action pose, independent of rarity.
        shell = Image.fromarray(np.uint8(np.median([np.asarray(n.getchannel('A')) for n,_ in normalized],axis=0)))
        for tier,(norm,finish) in enumerate(normalized):
            variant=finish.convert('RGBA')
            variant.alpha_composite(norm)
            variant.putalpha(shell)
            guns.paste(variant,(hand*128,tier*64))
    arms.save(out/'armed-profile.webp',lossless=True,method=5)
    guns.save(out/'armed-skins.webp',lossless=True,method=5)
    body=clean.copy()
    body.putalpha(ImageChops.subtract(clean.getchannel('A'),removable.filter(ImageFilter.MaxFilter(5))))
    # Rebuild the dark vest behind the near forearm so it can lift to aim.
    backing = Image.new('RGBA',source.size)
    vestmask = polygon(source.size,[(492,414),(711,408),(697,482),(660,545),(650,578),(465,565),(479,519)])
    texture = clean.crop((494,394,681,418)).resize((250,171),FILTER)
    backing.paste(texture,(462,409))
    backing.putalpha(vestmask)
    backing.alpha_composite(body)
    return backing

def arm_geometry():
    geometry=[]
    for box,elbow,nose,wrist,degrees in zip(BOXES,ELBOWS,NOSES,WRISTS,BARREL_DEGREES):
        dx,dy=np.subtract(nose,wrist)
        a=np.deg2rad(degrees)
        tx=wrist[0]+dx*np.cos(a)-dy*np.sin(a)
        ty=wrist[1]+dx*np.sin(a)+dy*np.cos(a)
        geometry.append([box[0]-elbow[0],box[1]-elbow[1],box[2]-box[0],box[3]-box[1],
                         round(tx-elbow[0],3),round(ty-elbow[1],3),degrees])
    return geometry

def mount_profile(cel, upper, height, brow, index):
    # Register the new torso to the belt of each existing lower-body drawing.
    scale=height/1312
    x,y=brow
    x=max(77,x) if index==30 else x
    left=x-736*scale
    top=y-174*scale
    seam=round((top+593*scale)*2)
    topart=upper if index<4 else upper.crop((0,0,1199,638))
    w,h=round(topart.width*scale*2),round(topart.height*scale*2)
    fg=Image.new('RGBA',cel.size)
    fg.alpha_composite(topart.resize((w,h),FILTER),(round(left*2),round(top*2)))
    if index>=4:
        fade=np.clip((np.arange(cel.height)-seam+3)/8,0,1)
        mask=Image.fromarray(np.uint8(255*fade[:,None])).resize(cel.size)
        fg=Image.composite(cel,fg,mask)
    pivots=[round(q,4) for ex,ey in ELBOWS for q in (left+ex*scale,top+ey*scale)]
    return fg,pivots+[scale]

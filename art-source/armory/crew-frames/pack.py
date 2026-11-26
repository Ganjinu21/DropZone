"""Import individually illustrated full-body frames and pack mobile texture atlases.

The source PNG manifest is optional. For a clean rebuild run this script without
arguments; every registered frame is stored separately next to this script.
"""
import json
import sys
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
GAME = HERE.parents[2] / 'game'
ART = GAME / 'art/armory'
DEST = ART / 'crew-frames'
ROLES = ('bulk', 'raven', 'lynx', 'hammer', 'cct')
RANKS = ('C', 'B', 'A', 'S', 'S-plus')
ACTIONS = ('guard', 'travel', 'toward', 'away', 'zenith', 'up', 'level', 'down', 'nadir', 'skill')
TILE, HEIGHT, PIVOT, SOLE = 256, 164, 109, 243
ANGLES = {'zenith':-78, 'up':-43, 'level':0, 'down':42, 'nadir':75}
LANCZOS = Image.Resampling.LANCZOS


def cutouts(path, rows, cols, colour_matte=False):
    pixels = np.array(Image.open(path).convert('RGBA'))
    alpha = pixels[:,:,3]
    if (alpha < 15).mean() < .15:
        # Some exports carry a translucent paper matte under the figures.
        # Its alpha band is distinct from the opaque painted silhouettes.
        paper=float(np.percentile(alpha,35));ink=float(np.percentile(alpha,95))
        if ink-paper>8 and not colour_matte:
            edge=paper+.67*(ink-paper)
            width=max(2,(ink-paper)*.16)
            alpha[:]=np.uint8(np.clip((alpha.astype(float)-edge)/width+.5,0,1)*255)
        else:
            border=np.concatenate((pixels[0,:,:3],pixels[-1,:,:3],pixels[:,0,:3],pixels[:,-1,:3]))
            contrast=np.abs(pixels[:,:,:3].astype(float)-np.median(border,axis=0)).max(axis=2)
            _,paper_labels=cv2.connectedComponents((contrast<24).astype('uint8'))
            outside=np.unique(np.r_[paper_labels[0],paper_labels[-1],paper_labels[:,0],paper_labels[:,-1]])
            alpha[:]=np.where(np.isin(paper_labels,outside[outside!=0]),0,255)
    h,w=alpha.shape
    _,labels,stats,_=cv2.connectedComponentsWithStats((alpha>80).astype('uint8'))
    boxes=[(i,*s[:4]) for i,s in enumerate(stats[1:],1) if s[4]>w*h/(rows*cols)*.045]
    result=[]
    for row in range(rows):
        group=sorted((b for b in boxes if row <= (b[2]+b[4]/2)*rows/h < row+1),key=lambda b:b[1]+b[3]/2)
        if len(group)!=cols:
            if not colour_matte:
                return cutouts(path,rows,cols,True)
            raise ValueError(f'{path.name} row {row+1} has {len(group)} bodies instead of {cols}')
        for label,x,y,bw,bh in group:
            pad=3
            x0,y0=max(0,x-pad),max(0,y-pad)
            x1,y1=min(w,x+bw+pad),min(h,y+bh+pad)
            cell=pixels[y0:y1,x0:x1].copy()
            keep=(labels[y0:y1,x0:x1]==label).astype('uint8')
            keep=cv2.dilate(keep,np.ones((5,5),'uint8'))
            cell[:,:,3]*=keep
            im=Image.fromarray(cell)
            result.append(im.crop(im.getbbox()))
    return result


def landmarks(im,action):
    a=np.array(im.getchannel('A'))>140
    h,w=a.shape
    ys,xs=np.where(a)
    # Use the torso for horizontal registration. A long barrel and a passing
    # boot are both free to cross the cell without pulling the body sideways.
    band=a[int(h*.39):int(h*.64)]
    centre=float(np.median(np.where(band)[1]))
    if action in ('zenith','up'):
        region=a[:,max(0,int(centre-h*.13)):min(w,int(centre+h*.06)+1)]
        top=np.where(region.sum(axis=1)>max(3,h*.055))[0]
        crown=int(top[0]) if len(top) else 0
    else:
        crown=int(np.percentile(ys,.45))
    return centre,h-crown


def pose_points(tile,action,role):
    p=np.array(tile)
    mask=p[:,:,3]>160
    y,x=np.where(mask)
    top,base=y.min(),y.max()
    height=base-top
    # These are attachment coordinates measured from complete images, never
    # transforms for the body. The same marks place the gun finish and flash.
    angle=ANGLES.get(action,{'hammer':-13,'bulk':5,'raven':13,'cct':24,'lynx':23}[role])
    rad=np.radians(angle)
    if action in ('zenith','up'):
        valid=(y<top+height*.51)&(x>PIVOT-height*.07)
    elif action in ('down','nadir'):
        valid=(y>top+height*.27)&(y<top+height*(.84 if action=='nadir' else .72))&(x>PIVOT+height*.07)
    else:
        valid=(y>top+height*.08)&(y<top+height*.63)
    if not valid.any():valid=np.ones(len(x),dtype=bool)
    px,py=x[valid],y[valid]
    # Straight-down sights need the foremost piece of metal, clear of the boot.
    projection=px*np.cos(rad)+py*np.sin(rad)
    front=projection>=projection.max()-2.2
    tip=[round(np.median(px[front])),round(np.median(py[front])),angle]
    if role=='raven':
        perpendicular=(px-tip[0])*(-np.sin(rad))+(py-tip[1])*np.cos(rad)
        other=(np.abs(perpendicular)>4)&(np.abs(perpendicular)<18)&(projection>projection.max()-17)
        if other.any():
            end=other&(projection>=projection[other].max()-1.5)
            return tip+[round(np.median(px[end])),round(np.median(py[end]))]
        return tip+[tip[0]-3,tip[1]-2]
    if role!='bulk':return tip
    # The broad dark face of Bulk's held shield sits beside the forward thigh.
    dark=p[:,:,:3].max(axis=2)<91
    mid=int(top+height*.57)
    runs=[]
    for yy in range(mid-3,mid+4):
        line=mask[yy] & dark[yy] & (np.arange(TILE)>PIVOT-6)
        ix=np.where(line)[0]
        if not len(ix):continue
        pieces=np.split(ix,np.where(np.diff(ix)>3)[0]+1)
        matches=[s for s in pieces if len(s)>=7]
        if matches:runs.append(max(matches,key=lambda s:s[-1]))
    if runs:
        left,right=np.median([(s[0],s[-1]) for s in runs],axis=0)
    else:left,right=PIVOT+4,PIVOT+height*.21
    width=max(12,min(height*.30,right-left+1))
    cx=int((left+right)/2)
    patch=dark[:,max(0,cx-3):cx+4] & mask[:,max(0,cx-3):cx+4]
    col=patch.sum(axis=1)>=3
    lo,hi=mid,mid
    while lo>top+.16*height and col[max(0,lo-2):lo+1].any():lo-=1
    while hi<base-.1*height and col[hi:hi+3].any():hi+=1
    if hi-lo<height*.19:lo,hi=top+height*.27,top+height*.78
    return tip+[round(cx-width/2),round(lo),round(cx+width/2),round(hi)]


def import_motion(role,action,path):
    cells=cutouts(path,5,6)
    for t,rank in enumerate(RANKS):
        seq=cells[t*6:t*6+6]
        marks=[landmarks(im,action) for im in seq]
        measure=marks[0][1] if action=='skill' else float(np.median([h for _,h in marks]))
        scale=HEIGHT/measure
        scale=min(scale,(TILE-8)/max(im.width for im in seq),(SOLE-3)/max(im.height for im in seq))
        directory=HERE/role/rank;directory.mkdir(parents=True,exist_ok=True)
        for step,(im,(cx,_)) in enumerate(zip(seq,marks)):
            w,h=round(im.width*scale),round(im.height*scale)
            x=min(TILE-w-2,max(2,round(PIVOT-cx*scale)))
            frame=Image.new('RGBA',(TILE,TILE))
            frame.paste(im.resize((w,h),LANCZOS),(x,SOLE-h))
            frame.save(directory/f'{action}-{step+1}.webp',quality=97,method=4)


def import_stands(role,path):
    cells=cutouts(path,2,2)
    for rank,im in zip(RANKS[1:],cells):
        # Keep full portrait resolution; use the same anatomy for the locker icon.
        directory=DEST/role;directory.mkdir(parents=True,exist_ok=True)
        im.save(directory/f'{rank}-stand.webp',quality=96,method=5)
        cx,h=landmarks(im,'guard')
        size=round(h*{'bulk':.39,'raven':.37,'lynx':.34,'hammer':.37,'cct':.36}[role])
        x=round(cx-size/2)
        im.crop((x,0,x+size,size)).resize((384,384),LANCZOS).save(directory/f'{rank}-face.webp',quality=96,method=4)

def pack_raven_skills():
    # Preserve the authored spin choreography, including all three follow-through
    # drawings and their original muzzle registrations. Each result is a whole cel.
    original=ART/'raven-cels'
    base=Image.open(original/'base.png').convert('RGBA')
    follow=Image.open(original/'spin-follow.webp').convert('RGBA')
    size=224
    for rank in RANKS:
        cloth=None if rank=='C' else Image.open(original/f'uniform-{rank}.webp').convert('RGBA')
        sheet=Image.new('RGBA',(8*size,13*size))
        directory=HERE/'raven'/rank
        for index in range(104):
            source=base if index<32 else follow
            cel=index+40 if index<32 else index-32
            original_cel=cel if index<32 else 48+cel%24
            x,y=cel%8*288,cel//8*288
            body=source.crop((x,y,x+288,y+288))
            if body.getchannel('A').getextrema()[1]<100:continue
            if cloth is not None:
                u,v=original_cel%8*144,original_cel//8*144
                body.alpha_composite(cloth.crop((u,v,u+144,v+144)).resize((288,288),LANCZOS))
            frame=body.resize((size,size),LANCZOS)
            frame.save(directory/f'special-{index+1:03}.webp',quality=96,method=4)
            sheet.paste(frame,(index%8*size,index//8*size))
        sheet.save(DEST/'raven'/f'{rank}-special.webp',quality=95,method=4)


def pack():
    data={}
    stands={
        'bulk':[[.47,79,80,2,93,47,138,210]],'raven':[[.52,99,136.7,33,145.3,143.2]],
        'lynx':[[.43,196,126,29]],'hammer':[[.46,122,62,-20]],'cct':[[.48,129,115,27]]}
    for role in ROLES:
        data[role]=[]
        for rank in RANKS:
            actions=ACTIONS[:-1] if role=='raven' else ACTIONS
            sheet=Image.new('RGBA',(6*TILE,len(actions)*TILE));marks=[]
            for i,action in enumerate(actions):
                for step in range(6):
                    im=Image.open(HERE/role/rank/f'{action}-{step+1}.webp').convert('RGBA')
                    sheet.paste(im,(step*TILE,i*TILE))
                    marks.append(pose_points(im,action,role))
            directory=DEST/role;directory.mkdir(parents=True,exist_ok=True)
            sheet.save(directory/f'{rank}.webp',quality=95,method=4)
            data[role].append(marks)
            if rank!='C':
                im=Image.open(directory/f'{rank}-stand.webp').convert('RGBA')
                cx,_=landmarks(im,'guard')
                k=HEIGHT/im.height
                x=round(PIVOT-cx*k);y=SOLE-HEIGHT
                canvas=Image.new('RGBA',(TILE,TILE))
                canvas.paste(im.resize((round(im.width*k),HEIGHT),LANCZOS),(x,y))
                mark=pose_points(canvas,'guard',role)
                points=[round((mark[0]-x)*275/HEIGHT,1),round((mark[1]-y)*275/HEIGHT,1),mark[2]]
                points.extend(round((v-(x if i%2==0 else y))*275/HEIGHT,1) for i,v in enumerate(mark[3:]))
                stands[role].append([round(cx/im.width,4),*points])
        print('Packed',role,flush=True)
    (DEST/'anchors.js').write_text("'use strict';\nconst crewFrameAnchors="+json.dumps(data,separators=(',',':'))+
                                   ';\nconst crewStandAnchors='+json.dumps(stands,separators=(',',':'))+';\n')


if __name__=='__main__':
    if len(sys.argv)>1:
        for key,name in json.loads(Path(sys.argv[1]).read_text()).items():
            role,action=key.split('-')
            if action=='stand':import_stands(role,Path(name))
            else:import_motion(role,action,Path(name))
            print('Imported',key,flush=True)
    else:
        pack()
        pack_raven_skills()

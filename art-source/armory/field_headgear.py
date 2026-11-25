"""Place each helmet around the operator's eyes with role insignia below the crown."""
from PIL import Image, ImageDraw

ROLES=('bulk','raven','lynx','hammer','cct')
RANKS=('C','B','A','S','S-plus')
# Top of the head, brow height and center differ on the radio/hood specialist rig.
FIT=((37,29),(39,28),(43,30),(38,28),(44,28))
CAP_SIZE=((49,22),(48,26),(50,31),(54,33),(57,37))
CAP_DROP=(0,0,4,7,7)
INK='#27242a'
PATCH=('.##.##.###','#..#....#.','#..#....#.','#..#....#.','.##.##..#.')


def head(body,role,rank,catalog):
    top=body.crop((0,0,192,48))
    if role==1:
        tier=RANKS.index(rank)
        w,h=[(22,11),(24,13),(25,15),(27,16),(28,17)][tier]
        cap=Image.open(catalog/'helmet'/(rank+'.png')).convert('RGBA').resize((w,h),Image.Resampling.NEAREST)
        top.alpha_composite(cap,(66-w//2,19-h))
        return top
    x,brow=FIT[role]
    layer=ImageDraw.Draw(top)
    # Only the crown is removed. Ears, faces, masks, scarf tails, the radio whip and
    # Hammer's carried rounds remain the original painted pixels.
    if role==2:
        edge=[(x-4,32),(x+3,29),(x+12,26),(x+20,25),(x+27,26),(x+35,26),(x+51,32)]
    else:
        edge=[(x-1,30),(x+5,31),(x+12,29),(x+22,25),(x+30,24),(x+37,25),(x+60,25)]
    layer.polygon([(x-1,0),(x+66,0),*reversed(edge)],fill=(0,0,0,0))
    tier=RANKS.index(rank); w,h=CAP_SIZE[tier]
    y=brow-h+CAP_DROP[tier]
    if rank=='S-plus': y=max(0,y)
    icon=Image.open(catalog/'helmet'/(rank+'.png')).convert('RGBA').resize((w,h),Image.Resampling.NEAREST)
    top.alpha_composite(icon,(x,y))
    d=ImageDraw.Draw(top)
    # Paint patches on the temple, to the rear of the ballistic brow or the four lenses.
    if role==4:
        px=x+(5 if tier>=2 else 7);py=y+(17 if tier>=2 else 10)
        d.rectangle((px-1,py-1,px+10,py+5),fill=INK)
        for row,s in enumerate(PATCH):
            for col,pixel in enumerate(s):
                if pixel=='#': d.point((px+col,py+row),fill='#e2c89a')
    elif role==1:
        d.line([(x+1,brow-4),(x+8,brow-6),(x+14,brow-7)],fill='#753b37',width=3)
        d.line([(x+1,brow-5),(x+8,brow-7),(x+14,brow-8)],fill='#d17b5d')
    elif role==3:
        d.line([(x+5,brow-9),(x+8,brow-13),(x+14,brow-15)],fill='#ab532f',width=3)
        d.line([(x+6,brow-10),(x+9,brow-13),(x+13,brow-14)],fill='#ee9350')
    elif role==0:
        d.line([(x+9,y+7),(x+16,y+4),(x+20,y+4)],fill='#93a4af',width=2)
    elif role==2:
        d.line([(x+2,brow-7),(x+7,brow-11),(x+12,brow-12)],fill='#869061',width=2)
    return top


def publish_base_and_helmets(out,bodies):
    """Export replacement strips and portraits from the exact same native head pixels."""
    portraits=out/'portraits';portraits.mkdir(exist_ok=True)
    worn=out/'worn';worn.mkdir(exist_ok=True)
    for rank in RANKS:
        band=Image.new('RGBA',(192*len(ROLES),48))
        for i,(role,body) in enumerate(zip(ROLES,bodies)):
            top=head(body,i,rank,out/'catalog')
            band.paste(top,(i*192,0))
            dressed=body.copy()
            dressed.paste(top,(0,0))
            portrait=dressed.crop((27,0,103,76)).resize((112,112),Image.Resampling.NEAREST)
            if rank=='C':
                portrait.save(out/(role+'-portrait.png'),optimize=True)
            else:
                portrait.save(portraits/(role+'-'+rank+'.png'),optimize=True)
        band.save(worn/('helmet-'+rank+'.png'),optimize=True)

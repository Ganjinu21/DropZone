"""Register whole-body drawings at the soles, with two independent weapon sockets."""
import json
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageChops

SRC = Path(__file__).parent
ARMORY = SRC.parents[1] / 'game/art/armory'
OUT = ARMORY / 'operator-cels'
ROLES = ('bulk', 'lynx', 'hammer', 'cct')
HEIGHT = (126, 111, 112, 110)
RANKS = ('C', 'B', 'A', 'S', 'S-plus')
METALS = ('', '#90987e', '#6b9caa', '#948899', '#b99d71')
# Each pose is annotated in percent of the source cell: near palm, far palm.
# Idle / inhale, fire / recoil / recover, skill preparation / action / hold.
PALMS = {
    'bulk': [(57,45,77,47),(58,44,78,46),(54,47,72,41),(54,48,83,40),
             (55,48,75,49),(46,53,73,57),(44,57,69,63),(42,61,69,65)],
    'lynx': [(55,43,72,41),(55,43,72,41),(53,44,70,39),(57,45,71,35),
             (53,45,72,39),(52,45,69,37),(59,42,78,33),(52,45,72,36)],
    'hammer': [(48,49,73,47),(49,49,73,47),(47,50,68,46),(73,47,80,43),
               (51,48,72,45),(14,38,77,51),(59,69,74,72),(64,79,82,80)],
    'cct': [(50,48,68,47),(50,48,68,47),(51,50,63,42),(63,49,76,46),
            (50,49,67,47),(49,47,65,34),(48,52,66,39),(47,51,77,12)]}
WALK_GRIP = {'bulk': (58,43,72,43), 'lynx': (56,44,72,43),
             'hammer': (50,49,69,48), 'cct': (49,50,65,47)}
EDGE = 144
FOOT = 136

def cells(path):
    im = Image.open(path).convert('RGB')
    frames = []
    for i in range(16):
        col, row = i % 4, i // 4
        box = tuple(round(v) for v in (col*im.width/4, row*im.height/4,
                                       (col+1)*im.width/4, (row+1)*im.height/4))
        tile = im.crop(box).convert('RGBA')
        tile.putdata([(r,g,b,0 if min(r,b)-g>39 and min(r,b)>95 else 255)
                      for r,g,b,_ in tile.getdata()])
        frames.append(tile)
    return frames

def build(role, height):
    poses = cells(SRC / (role+'-cels.png'))
    walk = cells(SRC / (role+'-walk.png'))
    scale = height / (poses[0].getbbox()[3]-poses[0].getbbox()[1])
    walk_scale = height / (walk[0].getbbox()[3]-walk[0].getbbox()[1])
    atlases = [Image.new('RGBA',(EDGE*8, EDGE*3)) for _ in RANKS]
    hardware = {slot:[Image.open(ARMORY/'catalog'/slot/(r+'.png')).convert('RGBA') for r in RANKS]
                for slot in ('helmet','top')}
    data = []
    for i, tile in enumerate([poses[j] for j in (0,1,10,11,12,13,14,15)]+walk):
        factor = scale if i<8 else walk_scale
        l,t,r,b = tile.getbbox()
        # Register the trunk rather than the moving hands or the leading boot.
        belt = round(t+(b-t)*.56)
        band = tile.crop((0,belt,tile.width,belt+1)).getbbox()
        dx = round(EDGE/2 - (band[0]+band[2])*.5*factor)
        dy = round(FOOT-b*factor)
        cel = Image.new('RGBA',(EDGE,EDGE))
        cel.alpha_composite(tile.resize((round(tile.width*factor),round(tile.height*factor)),
                                        Image.Resampling.NEAREST),(dx,dy))
        palms = PALMS[role][i] if i<8 else WALK_GRIP[role]
        if i>=16:
            palms = (39,46,62,47) if i<20 else (38,45,61,46)
        grip = [round((dx if k%2==0 else dy)+v*.01*(tile.width if k%2==0 else tile.height)*factor)
                for k,v in enumerate(palms)]
        head, hip, boot = [round(dy+(t+(b-t)*fraction)*factor) for fraction in (.27,.59,.83)]
        if role=='cct' and i==7: head += 5
        data.append(grip+[head,hip,boot])
        dest = (i%8*EDGE,i//8*EDGE)
        for rank,atlas in enumerate(atlases):
            fitted = cel.copy()
            if rank:
                metal = ImageOps.colorize(cel.convert('L'), '#181d25', METALS[rank], whitepoint=168)
                metal.putalpha(cel.getchannel('A'))
                fitted = Image.blend(cel,metal,.64)
                # Preserve exposed skin, the radio headset and the warm optics.
                skin = Image.new('L', cel.size)
                skin.putdata([255 if r>g*1.24 and g>b*1.27 and r>108 else 0 for r,g,b,a in cel.getdata()])
                fitted.paste(cel,mask=skin)
                brow_y = head-round(height*.12)
                band = cel.crop((0,brow_y,EDGE,brow_y+1)).getbbox()
                if band and i<20:
                    # Leave the role-defining collar, hood and earcups visible below the crown.
                    crown_w = 31 if role=='bulk' else 24
                    x = (band[0]+band[2])//2 if i>=16 else band[2]-crown_w//2+1
                    if role=='cct' and i==7:x=grip[0]+2
                    cap = hardware['helmet'][rank]
                    cap = cap.crop(cap.getbbox()).resize((crown_w,12+rank),Image.Resampling.NEAREST)
                    fitted.alpha_composite(cap,(x-cap.width//2,brow_y+2-cap.height))
                # Lay the worn carrier into the painted trunk; keep the silhouette and fists in front.
                width = 35 if role=='bulk' else 24
                plate = hardware['top'][rank]
                plate = plate.crop(plate.getbbox()).resize((width,max(8,hip-head-3)),Image.Resampling.NEAREST)
                carrier = Image.new('RGBA',cel.size)
                if i<20:carrier.alpha_composite(plate,(round(EDGE/2-width*.55),head+2))
                mask = ImageChops.multiply(carrier.getchannel('A'),cel.getchannel('A'))
                pen = ImageDraw.Draw(mask)
                for x,y in (grip[:2],grip[2:]):pen.ellipse((x-9,y-7,x+6,y+5),fill=0)
                fitted.paste(carrier,mask=mask)
            atlas.paste(fitted,dest)
            if i==0:
                top = cel.getbbox()[1]
                size = round(height*.53)
                left = round(EDGE/2-size*.44)
                portrait = fitted.crop((left,top-3,left+size,top-3+size)).resize((112,112),Image.Resampling.NEAREST)
                target = ARMORY/(role+'-portrait.png') if not rank else ARMORY/'portraits'/(role+'-'+RANKS[rank]+'.png')
                portrait.save(target)
    for atlas, rank in zip(atlases,RANKS):
        atlas.quantize(colors=240,method=Image.Quantize.FASTOCTREE,
                       dither=Image.Dither.NONE).save(OUT/(role+'-'+rank+'.png'),optimize=True)
    return data

if __name__=='__main__':
    OUT.mkdir(exist_ok=True)
    frames = {r:build(r,h) for r,h in zip(ROLES,HEIGHT)}
    (OUT/'frames.js').write_text('const operatorFrames='+json.dumps(frames)+';\n',encoding='utf8')

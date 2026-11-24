"""Fit the ranked trousers and boots to the original uniform, then pose their pixels with each leg."""
from pathlib import Path

from PIL import Image, ImageChops

from locomotion import BODY_Y, CELL, RIGS, ROOT, dress_leg, legs_and_coat, walk_targets

CROP = (8,68,120,124)
RANKS = ('B','A','S','S-plus')
SLOTS = ('pants','boots')


def leg_coordinates(leg, rest, far):
    """Encode texture U, V and garment/leg ID in RGB. Opaque coordinates survive the rig's nearest transforms."""
    _,knee,ankle = rest
    mask = leg.getchannel('A')
    left,top,right,bottom = mask.getbbox()
    boot_top = ankle[1]-5
    coords = Image.new('RGBA', CELL)
    coverage, uv = mask.load(), coords.load()
    for y in range(top,bottom):
        xs = [x for x in range(left,right) if coverage[x,y]]
        if not xs:
            continue
        if y>=boot_top:
            v = (y-boot_top)/max(1,bottom-1-boot_top)
            material = 3+far
        else:
            # Match the kit icon's knee plate to the operator's original articulated knee.
            if y<knee[1]:
                v = .69*(y-top)/max(1,knee[1]-top)
            else:
                v = .69+.31*(y-knee[1])/max(1,boot_top-1-knee[1])
            material = 1+far
        v = round(255*min(1,max(0,v)))
        for x in xs:
            u = round(255*(x-xs[0])/max(1,xs[-1]-xs[0]))
            uv[x,y] = (u,v,material,255)
    return coords


def posed_coordinates(body, stride, role):
    rig = RIGS[role]
    coat, legs = legs_and_coat(body,rig)
    maps = [leg_coordinates(leg,rest,far) for far,(leg,rest) in enumerate(zip(legs,rig['legs']))]
    poses = [None,*walk_targets(body,role)]
    for column, pose in enumerate(poses):
        frame = column-1
        coordinates = Image.new('RGBA',CELL)
        for i in (1,0):
            layer = maps[i]
            if pose is not None:
                moved,pitch = pose[i]
                layer = dress_leg(layer,rig['legs'][i],moved,pitch)
            coordinates.alpha_composite(layer)
        upper = Image.new('L',CELL)
        upper.paste(coat.getchannel('A'),(0,BODY_Y[frame] if column else 0))
        coordinates.putalpha(ImageChops.subtract(coordinates.getchannel('A'),upper))
        rendered = stride.crop((frame*192,role*128,(frame+1)*192,(role+1)*128)) if column else body
        coordinates.putalpha(ImageChops.darker(coordinates.getchannel('A'),rendered.getchannel('A')))
        yield coordinates.crop(CROP)


def texture_rows(icon, slot, far):
    """Separate the pants legs and stretch each painted scanline across its new silhouette."""
    width,height = icon.size
    pixels = icon.load()
    xs = range(width)
    if slot=='pants':
        xs = range(width//2,width) if far else range(width//2)
    rows = []
    for y in range(height):
        row = []
        for x in xs:
            r,g,b,a = pixels[x,y]
            if a<128:
                continue
            # Recess the back leg without losing the actual painted knee, ankle or toe.
            row.append((round(r*.82),round(g*.82),round(b*.82)) if far else (r,g,b))
        if row:
            rows.append(row)
    return rows


def fit_texture(coordinates, slot, textures):
    result = Image.new('RGBA',coordinates.size)
    source,target = coordinates.load(),result.load()
    region = 1 if slot=='pants' else 3
    for y in range(coordinates.height):
        for x in range(coordinates.width):
            u,v,material,alpha = source[x,y]
            if not alpha or material not in (region,region+1):
                continue
            rows = textures[material-region]
            row = rows[round(v*(len(rows)-1)/255)]
            color = row[round(u*(len(row)-1)/255)]
            target[x,y] = (*color,alpha)
    return result


def build_worn_armor(armory_dir):
    armory_dir = Path(armory_dir)
    bodies = Image.open(armory_dir/'bodies.png').convert('RGBA')
    stride = Image.open(armory_dir/'crew-stride.png').convert('RGBA')
    cells = []
    for role in range(len(RIGS)):
        body = bodies.crop((role*192,0,(role+1)*192,128))
        cells.append(list(posed_coordinates(body,stride,role)))
    out = armory_dir/'worn'
    out.mkdir(exist_ok=True)
    cw,ch = CROP[2]-CROP[0],CROP[3]-CROP[1]
    for slot in SLOTS:
        for rank in RANKS:
            icon = Image.open(armory_dir/'catalog'/slot/(rank+'.png')).convert('RGBA')
            textures = [texture_rows(icon,slot,far) for far in (0,1)]
            sheet = Image.new('RGBA',(9*cw,len(cells)*ch))
            for role, poses in enumerate(cells):
                for column, coordinates in enumerate(poses):
                    fitted = fit_texture(coordinates,slot,textures)
                    sheet.paste(fitted,(column*cw,role*ch))
            sheet.save(out/(slot+'-'+rank+'.png'),optimize=True)


if __name__=='__main__':
    build_worn_armor(ROOT/'game/art/armory')

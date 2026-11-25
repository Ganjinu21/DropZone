"""Register empty shell cels around the independently rendered Bulk operator."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

SOURCE = Path(__file__).parent
DEST = SOURCE.parents[1] / 'game/art/skills/bulk-shield-deploy.webp'
CELL, COLS = 320, 6
sheet = Image.open(SOURCE / 'bulk-empty-shell.png').convert('RGBA')
# 0–18 are the foreground shell; 19–34 are the independently moving rear wall.
atlas = Image.new('RGBA', (CELL*COLS, CELL*6))
# Ground anchors on the source sheet, measured on the fixed end stops.
columns = [166, 490, 815, 1142]
soles = [238, 482, 726, 969, 1208]
# Silhouette of the operator's carried shield above the mounting shoe.
shield = [(-16,-108),(19,-121),(43,-139),(62,-138),(77,-124),(77,-21),(-16,-21)]


def put(i, cell):
    atlas.paste(cell, (i%COLS*CELL, i//COLS*CELL))


def mask_for(points):
    mask = Image.new('L',(320,240))
    ImageDraw.Draw(mask).polygon([(160+x,240+y) for x,y in points],fill=255)
    return mask


def register(cell):
    # Use one common world scale and ground contact for the entire assembly.
    w,h = 250,187
    layer = Image.new('RGBA',(CELL,CELL))
    layer.paste(cell.resize((w,h),Image.Resampling.LANCZOS),((CELL-w)//2,280-h))
    return layer


def source_cel(i):
    x,y = columns[i%4], soles[i//4]
    return sheet.crop((x-160,y-240,x+160,y))


def locked_cel(i):
    keys = Image.open(SOURCE/'bulk-shield-deploy.png').convert('RGBA')
    cell = keys.crop((i%4*keys.width//4,keys.height//2,(i%4+1)*keys.width//4,keys.height))
    alpha = cell.getchannel('A').point(lambda a:max(0,round((a-12)*255/243)))
    cell.putalpha(alpha)
    return cell.crop(alpha.point(lambda a:255 if a>42 else 0).getbbox())


def materials(rgb):
    r,g,b = np.moveaxis(rgb,-1,0)
    blue = np.clip((b-r-3)/9,0,1)*np.clip((b-g-2)/6,0,1)
    brass = np.clip((r-g-6)/12,0,1)*np.clip((g-b-5)/12,0,1)
    return (1-blue-brass,blue,brass)


# A single grade per material is fitted to the two fully closed paintings.
# Use it at every exposure so moving panels never change their finish.
def sample_finishes(cell):
    rgba = np.asarray(cell,dtype=float)
    rgb = rgba[:,:,:3]
    return [np.percentile(rgb[(mask>.8)&(rgba[:,:,3]>220)],[5,25,50,75,95],axis=0)
            for mask in materials(rgb)]


closed = locked_cel(7)
source_levels = sample_finishes(source_cel(18))
target_levels = sample_finishes(closed)


def match_finish(cell):
    rgba = np.array(cell)
    rgb = rgba[:,:,:3].astype(float)
    result = np.zeros_like(rgb)
    for weight,src,dst in zip(materials(rgb),source_levels,target_levels):
        for k in range(3):
            channel = np.interp(rgb[:,:,k], [0,*src[:,k],255], [0,*dst[:,k],255])
            result[:,:,k] += weight*channel
    rgba[:,:,:3] = result.round().clip(0,255).astype('uint8')
    return Image.fromarray(rgba)


# Reuse the painted ribs and bevels visible through the open doors. Each band
# is a rigid plate sliding from a common sill, occluded by the plate below it.
def rear_plates():
    recess = source_cel(15)
    plates = []
    for top,bottom,width,height in [(178,201,217,42),(145,180,212,45),
                                    (105,147,204,48),(65,108,194,59)]:
        band = recess.crop((116,top,208,bottom)).resize((width,height),Image.Resampling.LANCZOS)
        panel = Image.new('RGBA',(width,height+9))
        # The folded side returns project toward the floor and into shadow.
        for x in range(width):
            edge = max(0,(abs(x-(width-1)/2)-(width*.32))/(width*.18))
            strip = np.array(band.crop((x,0,x+1,height)))
            strip[:,:,:3] = (strip[:,:,:3]*(1-.22*edge)).astype('uint8')
            # Chamfer the outer ends under the hinged roof; a narrow lit lip
            # separates each telescoping panel from its neighbor in shadow.
            bevel = round(edge*(28 if top==65 else 7))
            strip[:bevel,:,3] = 0
            strip[bevel:bevel+2,:,:3] = np.minimum(255,strip[bevel:bevel+2,:,:3].astype(int)+17)
            panel.paste(Image.fromarray(strip),(x,round(8*edge)))
        plates.append(panel)
    return plates


plates = rear_plates()
def rear_wall(i):
    wall = Image.new('RGBA',(320,240))
    sill = 219
    travel = [(1,4,38),(3,7,40),(5,10,42),(8,12,54)]
    lifted = 0
    rows = []
    for panel,(start,end,stroke) in zip(plates,travel):
        progress = np.clip((i-start+1)/(end-start+1),0,1)
        lifted += round(stroke*progress*progress*(3-2*progress))
        if progress>0:
            rows.append((panel,((320-panel.width)//2,sill-lifted)))
    for panel,xy in reversed(rows):
        wall.alpha_composite(panel,xy)
    wall.paste((0,0,0,0),(0,sill,320,240))
    # Continue the interior deck down to the front latch when the doors part.
    if i>=12:
        deck = source_cel(15).crop((119,200,137,221)).resize((158,19),Image.Resampling.BILINEAR)
        wall.alpha_composite(deck,(81,sill))
    return wall


for i in range(17):
    if i:
        put(18+i,register(match_finish(rear_wall(i))))
    if i<=12:
        cell = source_cel(i)
        if i:
            cell.paste((0,0,0,0),mask=mask_for(shield))
        put(i,register(match_finish(cell)))


def register_locked(cell):
    layer = Image.new('RGBA',(CELL,CELL))
    layer.paste(cell.resize((208,166),Image.Resampling.LANCZOS),(56,114))
    return layer


lit = register_locked(closed)
dark = lit.copy()
lamp = Image.new('L',dark.size)
ImageDraw.Draw(lamp).rounded_rectangle((154,188,165,227),radius=3,fill=255)
dark.paste(register_locked(locked_cel(6)),mask=lamp.filter(ImageFilter.GaussianBlur(1)))

# The roof, port housings and sill are already bolted down at this point.
# Swing only the painted leaves, with their outside hinges fixed in cell space.
outline = [(83,162),(88,154),(94,149),(99,147),(110,151),(117,152),
           (124,156),(149,160),(159,170),(159,250),(145,252),(139,260),
           (134,270),(109,270),(105,255),(100,248),(83,237)]
left = Image.new('L',dark.size)
ImageDraw.Draw(left).polygon(outline,fill=255)
right = ImageOps.mirror(left)
housing = dark.copy()
opening = left.copy()
opening.paste(255,mask=right)
ImageDraw.Draw(opening).rectangle((156,168,163,249),fill=255)
housing.paste((0,0,0,0),mask=opening.filter(ImageFilter.MaxFilter(3)))
leaves = []
for mask in (left,right):
    leaf = Image.new('RGBA',dark.size)
    leaf.paste(dark,mask=mask)
    leaves.append(leaf)

for i,width in enumerate((.34,.44,.64,.86),start=13):
    frame = housing.copy()
    for leaf,hinge,side in zip(leaves,(83,236),(1,-1)):
        # Affine inverse of a projected hinged plate. Its free end approaches
        # the viewer slightly when open and seats squarely at contact.
        slope = side*(1-width)*.12
        transform = (1/width,0,hinge-hinge/width,-slope/width,1,slope*hinge/width)
        frame.alpha_composite(leaf.transform(frame.size,Image.Transform.AFFINE,transform,Image.Resampling.BICUBIC))
    put(i,frame)
put(17,dark)
put(18,lit)
atlas.save(DEST,quality=96,method=6)

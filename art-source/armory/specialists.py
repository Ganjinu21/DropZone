"""Register the production sprite sheet against the game's 96×64 operator cells."""
from pathlib import Path
from PIL import Image, ImageDraw

sheet = Image.open(Path(__file__).with_name('field-specialists.png')).convert('RGBA')
# Coordinates in the approved sheet. The ground is y=60 and both shoulders
# rotate about (32,32) in a finished operator cell.
bounds = {'cct': (163,96,506,670), 'hammer': (732,105,1124,670),
          'ar': (83,852,560,1091), 'rocket': (653,877,1234,1069)}

def piece(name, size):
    im = sheet.crop(bounds[name])
    im = im.crop(im.getchannel('A').point(lambda a: 255 if a>96 else 0).getbbox())
    return im.resize(size,Image.Resampling.NEAREST)

def body(name):
    cell=Image.new('RGBA',(192,128))
    w,h=(67,112) if name=='cct' else (77,110)
    cell.alpha_composite(piece(name,(w,h)),(64-w//2,120-h))
    return cell

def hands(name):
    # Only the two original hands and adjacent sleeve edges overprint the equipped prop.
    polygons={
        'cct': [[(227,385),(259,370),(286,380),(316,357),(344,351),(360,356),(373,373),(376,391),(362,405),(313,410),(281,430),(246,432),(227,419)],
                [(407,375),(427,357),(447,355),(464,363),(473,378),(471,403),(455,416),(427,414),(409,402)]],
        'hammer': [[(809,392),(844,371),(873,374),(897,353),(923,350),(942,359),(949,375),(945,395),(926,405),(902,409),(868,432),(833,441),(811,428)],
                   [(992,373),(1012,355),(1033,351),(1049,362),(1060,380),(1057,401),(1038,415),(1013,416),(994,402)]]}
    mask=Image.new('L',sheet.size); pen=ImageDraw.Draw(mask)
    for points in polygons[name]:
        pen.polygon(points,fill=255)
    full=Image.new('RGBA',sheet.size)
    full.paste(sheet,mask=mask)
    box=sheet.crop(bounds[name]).getchannel('A').point(lambda a:255 if a>96 else 0).getbbox()
    size=(67,112) if name=='cct' else (77,110)
    cell=Image.new('RGBA',(192,128))
    cell.alpha_composite(full.crop(bounds[name]).crop(box).resize(size,Image.Resampling.NEAREST),
                         (64-size[0]//2,120-size[1]))
    return cell

def portrait(name):
    im=sheet.crop(bounds[name])
    # Register helmets and eyes in the center of the square roster and HUD slots.
    box=(27,-6,327,294) if name=='cct' else (24,-8,338,306)
    return im.crop(box).resize((112,112),Image.Resampling.NEAREST)

def weapon(name,variant,accent):
    size=(72,36) if name=='ar' else (102,34)
    im=piece(name,size)
    d=ImageDraw.Draw(im)
    if variant:
        x,y=(47,17) if name=='ar' else (36,16)
        d.rectangle((x,y,x+variant*2,y+2),fill=accent)
        if variant>=2:
            d.line((x-4,y+2,x-2,y+2),fill=accent)
        if variant>=4:
            d.line((x+1,y-2,x+4,y-2),fill='#ded1a5')
    if name=='ar':
        d.rectangle((60,15,61,16),fill='#ff5d48')
    return im

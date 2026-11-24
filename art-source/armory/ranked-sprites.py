"""Fit the catalog art to the crew's hands and bake the matching skill frames and firing sockets."""
import json
from importlib.util import module_from_spec, spec_from_file_location
from math import cos, sin, tau
from pathlib import Path
from statistics import median

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / 'game/art/armory/catalog'
NEAREST = Image.Resampling.NEAREST
RANKS = ('C','B','A','S','S-plus')

# Grip centers in the trimmed inventory sprite, listed from C through S+.
GRIPS = {
    'pistol': ((.205,.62),(.20,.63),(.185,.62),(.172,.61),(.165,.615)),
    'carbine': ((.195,.64),(.338,.66),(.32,.67),(.33,.67),(.318,.66)),
    'smg': ((.265,.61),(.32,.61),(.34,.61),(.34,.62),(.34,.62)),
    'sniper': ((.245,.535),(.252,.626),(.252,.68),(.25,.68),(.24,.68)),
}


def artist(name):
    spec = spec_from_file_location(name, ROOT / 'art-source/skill-lab' / (name + '.py'))
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def mount(image,grip):
    alpha=image.getchannel('A')
    if alpha.getpixel((int(grip[0]*image.width),int(grip[1]*image.height)))<128:
        raise ValueError('The declared hand socket is outside the painted grip')
    right=alpha.getbbox()[2]-1
    heights=[y+.5 for y in range(image.height) if alpha.getpixel((right,y))>=128]
    if not heights:
        raise ValueError('Expected a solid muzzle at the right edge of the fitted sprite')
    return {'grip':grip,'bore':round(median(heights)/image.height,4)}


def write_pair(rank,near,far):
    offset_x,offset_y=round(near.width*.21),round(far.height*.76)
    pair=Image.new('RGBA',(max(offset_x+far.width,near.width),max(far.height,offset_y+near.height)))
    pair.alpha_composite(far,(offset_x,0))
    pair.alpha_composite(near,(0,offset_y))
    pair.save(CATALOG / 'smg' / f'{rank}.png',optimize=True)


def track_gloves(module):
    """Record the glove anchors already used when the artist draws this pose."""
    points=[]
    original=module.glove
    def draw(canvas,x,y,far,role):
        points.append([x,y])
        original(canvas,x,y,far,role)
    module.glove=draw
    return points,original


def raven_sheet(rank,guns,fittings):
    raven=artist('raven')

    def equipment(angle, far=False):
        # Project the catalog side view into the turning hand's local plane.
        c,s=cos(angle),sin(angle)
        img=guns[int(far)]
        fit=fittings[int(far)]
        grip_x,grip_y=fit['grip']
        length=20.88/(1-grip_x)
        w=max(4,round(length*abs(c)))
        h=max(6,round(length*img.height/img.width))
        bore_y=round(h*fit['bore'])
        tip=raven.point(42+20.88*c,34-round(grip_y*h)+bore_y+20.88*s*.52)
        gun=img.resize((w,h),NEAREST)
        if c<0:gun=ImageOps.mirror(gun)
        canvas=Image.new('RGBA',(84,64))
        # Keep the bore at the socket and the grip at the glove, even when the
        # gun turns end-on and the two hands overlap on screen.
        for x in range(w):
            fraction=x/(w-1) if c>=0 else (w-1-x)/(w-1)
            lift=round((fraction-1)*length*s*.52)
            canvas.alpha_composite(gun.crop((x,0,x+1,h)),
                (tip[0]-(w-1 if c>=0 else 0)+x,tip[1]-bore_y+lift))
        return canvas,tip

    raven.equipment=equipment
    sheet=Image.new('RGBA',(112*8,72*7))
    body=raven.shifted_body
    raven.shifted_body=lambda *args: Image.new('RGBA',raven.CELL)
    forward=[]
    grips=[]
    points,original_glove=track_gloves(raven)
    for i in range(8):
        points.clear()
        hands,tips=raven.side(i,True)
        sheet.paste(hands,(i*112,0))
        if i in (1,3):forward.append(tips[int(i==3)])
        grips.append(points.copy())
    raven.glove=original_glove
    raven.shifted_body=body
    turning=[]
    for i in range(16):
        rear,front,tips=raven.spin_layers(i)
        turning.append(tips)
        pose=rear.copy()
        pose.alpha_composite(raven.spin_body(i*tau/16))
        pose.alpha_composite(front)
        sheet.paste(pose,(i%8*112,(1+i//8)*72))
        sheet.paste(rear,(i%8*112,(3+i//8)*72))
        sheet.paste(front,(i%8*112,(5+i//8)*72))
    sheet.save(CATALOG / 'smg' / f'{rank}-skill.png',optimize=True)
    return {'forward':forward,'turn':turning},grips


def lynx_sheet(rank,img,fit):
    lynx=artist('lynx')
    w=59
    gun=img.resize((w,round(w*img.height/img.width)),NEAREST)
    grip_x,grip_y=fit['grip']
    placement=(gun,(round(w*grip_x),round(gun.height*grip_y)),(w,round(gun.height*fit['bore'])))
    lynx.crew.operator=lambda *args: Image.new('RGBA',(96,64))
    sheet=Image.new('RGBA',(7*96,64))
    grips=[]
    points,_=track_gloves(lynx.crew)
    for i in range(7):
        points.clear()
        hands,tip=lynx.pose(i,placement)
        sheet.paste(hands,(i*96,0))
        if i==3:firing_tip=tip
        grips.append(points.copy())
    sheet.save(CATALOG / 'sniper' / f'{rank}-skill.png',optimize=True)
    return firing_tip,grips


def build_ranked_art(make_pairs=True):
    field={family:[] for family in (*GRIPS,'smgFar')}
    skill_grips={}
    for tier,rank in enumerate(RANKS):
        for family in GRIPS:
            suffix='-near' if family=='smg' else ''
            img=Image.open(CATALOG/family/f'{rank}{suffix}.png').convert('RGBA')
            fit=mount(img,GRIPS[family][tier])
            field[family].append(fit)
            if family=='smg':
                far=Image.open(CATALOG/'smg'/f'{rank}-far.png').convert('RGBA')
                far_fit=mount(far,GRIPS['smg'][tier])
                field['smgFar'].append(far_fit)
                if make_pairs:write_pair(rank,img,far)
                tips,skill_grips['smg']=raven_sheet(rank,[img,far],[fit,far_fit])
                fit.update(tips)
            if family=='sniper':
                fit['firingTip'],skill_grips['sniper']=lynx_sheet(rank,img,fit)
    rows=',\n'.join('  '+key+': '+json.dumps(values,separators=(',',':')) for key,values in field.items())
    (CATALOG.parent/'weapon-sockets.js').write_text(
        "'use strict';\n// Generated by art-source/armory/ranked-sprites.py from the catalog artwork.\n"
        +'const weaponSockets={\n'+rows+'\n};\n'
        +'const skillGrips='+json.dumps(skill_grips,separators=(',',':'))+';\n',encoding='utf-8')


if __name__=='__main__':
    build_ranked_art()

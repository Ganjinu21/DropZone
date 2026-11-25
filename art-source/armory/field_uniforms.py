"""Dress the specialist art on a common 192×128 CCT cell and export its articulated layers."""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

from locomotion import CELL, stride_sheet
import specialists
from field_headgear import PATCH, publish_base_and_helmets

ROLES = ('bulk', 'raven', 'lynx', 'hammer', 'cct')
EDGE = '#211c20'
RAMPS = {
    'navy': ('1c1b20','292c37','36404e','48596b','617687','8796a0','b8c1bd'),
    'slate': ('1d191d','302c32','413e44','555761','717680','969c9e','c4c5bb'),
    'umber': ('211b1c','342b27','504038','695448','8b7160','ad8e6e','cfb38c'),
    'bark': ('211b1d','332e29','4a4734','625d42','837c58','a39a6f','c4ba8d'),
    'olive': ('211d1c','33362b','4c4e35','646741','828450','a1a56c','c3c58b'),
    'canvas': ('231d1c','372c27','554237','765a42','94744f','b89668','d2b88b'),
}
COLOR_STOPS = (12,41,69,100,134,171,213)


def fabric(source, ramp):
    """Maintain the drawn folds and one-pixel outline while changing the cloth dye."""
    colors = [bytes.fromhex(s) for s in RAMPS[ramp]]
    lookup = []
    for v in range(256):
        upper = next((i for i,n in enumerate(COLOR_STOPS) if n>=v),len(colors)-1)
        lower = max(0,upper-1)
        blend = min(1,max(0,(v-COLOR_STOPS[lower])/max(1,COLOR_STOPS[upper]-COLOR_STOPS[lower])))
        lookup.append(tuple(round(a+(b-a)*blend) for a,b in zip(colors[lower], colors[upper])))
    out = Image.new('RGBA',source.size)
    for y in range(source.height):
        for x in range(source.width):
            r,g,b,a=source.getpixel((x,y))
            if a:
                out.putpixel((x,y),(*lookup[(3*r+6*g+b)//10],a))
    return out


def mask(points):
    layer = Image.new('L',CELL)
    ImageDraw.Draw(layer).polygon(points,fill=255)
    return layer


def cut(source, points):
    im = source.copy()
    im.putalpha(ImageChops.multiply(im.getchannel('A'),mask(points)))
    return im


def panel(pen, shape, tone, edge=EDGE):
    pen.polygon(shape,fill=tone,outline=edge,width=2)


def seam(pen, points, tone, width=2):
    pen.line(points,fill=tone,width=width,joint='curve')


def preserve_skin(body, original, role):
    """Expose the original face, cheek shadow and bare forearms beneath cloth/armor."""
    face = [(57,28),(64,23),(79,22),(81,41),(72,47),(60,41)]
    if role=='lynx':
        face = [(65,28),(83,25),(88,31),(84,41),(76,49),(62,43)]
    body.alpha_composite(cut(original,face))
    hands = specialists.hands('cct' if role=='lynx' else 'hammer')
    body.alpha_composite(hands)


def bulk_kit(body, base):
    # Navy segmented helmet: white crown stripe, wraparound amber glass, hinged cheek guard.
    pen=ImageDraw.Draw(body)
    panel(pen,[(38,32),(40,22),(46,14),(55,9),(65,8),(74,11),(80,17),(83,24),(81,30),(73,32),(61,30),(55,36),(46,38)],'#47566b')
    pen.polygon([(42,23),(48,16),(56,12),(62,11),(64,14),(54,16),(48,20),(45,25)],fill='#8898a5')
    pen.polygon([(53,12),(58,10),(64,10),(69,14),(74,20),(76,23),(71,23),(67,18),(62,14)],fill='#d2c9a7')
    seam(pen,[(61,11),(66,13),(70,17)],'#f8e5b4')
    seam(pen,[(41,30),(48,24),(56,23)],'#334352',3)
    panel(pen,[(55,24),(63,21),(80,21),(85,24),(84,30),(78,34),(64,33),(58,31)],'#554333')
    pen.polygon([(59,25),(65,23),(80,23),(81,25),(76,29),(63,29)],fill='#a5763e')
    seam(pen,[(62,25),(67,24),(73,24)],'#f3d596')
    seam(pen,[(78,25),(81,25)],'#dbac67')
    # The overlapping shield mount casts a hard step across the glass.
    pen.polygon([(58,25),(62,23),(66,23),(63,28),(58,28)],fill='#594a39')
    pen.polygon([(66,24),(70,24),(67,28),(64,28)],fill='#ebc88b')
    pen.rectangle((71,29,79,30),fill='#75533b')
    seam(pen,[(60,20),(64,18),(67,18)],'#596c7a')
    seam(pen,[(41,25),(44,22),(46,21)],'#708997')
    pen.rectangle((48,20,52,22),fill='#384550')
    pen.point((48,20),fill='#9cacaa')
    seam(pen,[(75,31),(80,30),(83,27)],'#382d29')
    pen.rectangle((54,25,58,28),fill='#2e3340')
    pen.rectangle((55,25,56,26),fill='#c6bca4')
    seam(pen,[(48,36),(53,38),(59,37)],'#323d48')
    panel(pen,[(46,28),(52,26),(58,29),(59,35),(55,40),(48,39),(45,36)],'#3a485a')
    seam(pen,[(48,30),(53,29),(55,31)],'#8c99a4')
    limb=cut(fabric(base,'navy'),[(28,45),(34,40),(42,37),(53,42),(55,49),(51,56),(49,63),(32,66),(27,59)])
    body.alpha_composite(limb)
    pen=ImageDraw.Draw(body)
    seam(pen,[(32,51),(36,47),(42,46),(48,47)],'#acb9b9')
    seam(pen,[(31,58),(36,56),(40,55)],'#d2b570')
    pen.rectangle((36,50,38,51),fill='#ccd1c1')


def raven_kit(body, base):
    # Two trailing ends make the headwrap readable even at battlefield scale.
    tails=Image.new('RGBA',CELL); p=ImageDraw.Draw(tails)
    panel(p,[(49,27),(46,34),(37,40),(25,42),(21,40),(25,37),(33,37),(40,32)],'#9f503c')
    seam(p,[(26,39),(34,38),(43,32)],'#ce7350')
    panel(p,[(46,31),(49,31),(47,44),(43,53),(38,56),(38,50),(41,40)],'#7b3c36')
    seam(p,[(40,50),(43,41)],'#ad5940')
    tails.alpha_composite(body); body.paste(tails)
    p=ImageDraw.Draw(body)
    # Break up the helmet silhouette with a swept crown and a stepped fringe.
    p.rectangle((38,8,86,33),fill=(0,0,0,0))
    body.alpha_composite(cut(base,[(58,26),(66,22),(78,22),(80,30),(79,40),(72,44),(61,39)]))
    panel(p,[(40,23),(44,18),(43,15),(49,14),(49,11),(57,12),(64,10),(69,12),(74,13),(79,17),(83,22),(81,29),(77,30),(75,26),(71,29),(68,26),(64,27),(60,23),(55,26),(53,35),(48,37),(44,33)],'#353137')
    p.polygon([(44,23),(49,17),(57,15),(62,13),(67,13),(60,17),(54,18),(50,23)],fill='#5b5252')
    seam(p,[(53,16),(57,15),(61,14)],'#7b6d64')
    # Exposed fringe, broken highlights and a tied knot distinguish the headwrap from a cap.
    p.polygon([(43,21),(46,17),(44,16),(48,16),(49,13),(53,14),(57,12),(56,15),(50,18),(48,21)],fill='#3f373c')
    p.polygon([(57,13),(59,9),(62,8),(62,11),(67,9),(72,11),(74,14),(67,12),(63,14)],fill='#29272e')
    seam(p,[(60,12),(64,11),(68,12)],'#685c58')
    seam(p,[(65,16),(70,16),(76,20)],'#514b52')
    seam(p,[(72,14),(77,16),(79,19)],'#645752')
    panel(p,[(40,25),(49,23),(58,21),(69,20),(77,21),(81,23),(80,27),(76,26),(67,25),(60,26),(50,29),(42,31)],'#a9503c')
    seam(p,[(44,26),(54,24),(64,22),(74,22)],'#dc8962')
    seam(p,[(50,29),(57,27),(61,27)],'#763b35')
    panel(p,[(39,25),(44,24),(47,26),(46,29),(42,31),(39,30)],'#96523c')
    p.rectangle((41,26,43,27),fill='#db9567')
    seam(p,[(58,26),(60,23),(61,22)],'#98513e',1)
    seam(p,[(66,25),(69,23),(72,23)],'#edab78',1)
    p.polygon([(72,25),(77,25),(77,28),(75,30),(75,27),(72,29)],fill='#302a2b')
    # Replace the heavy ear cup and pauldron with a soft collar and rolled sleeve.
    panel(p,[(42,32),(50,29),(55,30),(56,35),(53,42),(46,41),(41,37)],'#433a37')
    seam(p,[(46,33),(51,32),(52,34)],'#7d6651')
    panel(p,[(28,48),(32,42),(38,40),(45,41),(51,44),(52,49),(48,53),(39,54),(31,59),(28,59)],'#545d50')
    p.polygon([(30,47),(34,43),(40,42),(44,44),(38,45),(33,49)],fill='#90927a')
    seam(p,[(30,55),(37,51),(45,49)],'#384038')
    seam(p,[(32,54),(38,51),(42,51)],'#b3a586')
    for x,y in ((60,46),(64,47),(69,47)):
        p.rectangle((x,y,x+2,y+6),fill='#352e2a')
        p.rectangle((x,y,x+1,y+2),fill='#aa7e55')


def lynx_kit(body, base):
    # The cloak hangs behind the hip; its scalloped leaf shapes remain clear of the hands.
    cloak=Image.new('RGBA',CELL); p=ImageDraw.Draw(cloak)
    panel(p,[(42,38),(52,34),(63,37),(67,45),(62,51),(55,54),(49,66),(39,72),(38,77),(32,76),(26,82),(23,80),(21,86),(17,84),(19,75),(23,69),(25,58),(31,50)],'#5f6142')
    p.polygon([(21,78),(26,66),(28,56),(36,46),(43,42),(46,44),(40,52),(36,59),(29,69)],fill='#83825b')
    seam(p,[(32,66),(38,54),(45,46)],'#a59c69')
    seam(p,[(24,78),(28,75),(36,61)],'#403f30')
    seam(p,[(36,73),(42,62),(49,54)],'#444633',3)
    cloak.alpha_composite(body);body.paste(cloak)
    p=ImageDraw.Draw(body)
    p.rectangle((30,4,103,38),fill=(0,0,0,0))
    # Gold-lined opening retains CCT's eye proportions while the hood covers the radio helmet.
    panel(p,[(39,35),(40,27),(44,20),(51,13),(59,10),(67,11),(76,15),(84,21),(91,28),(92,35),(87,39),(78,36),(70,34),(67,41),(62,46),(54,48),(48,44),(41,45),(35,50),(34,46)],'#686b47')
    p.polygon([(40,34),(44,24),(51,17),(60,13),(67,13),(76,17),(80,21),(71,18),(63,17),(55,20),(48,27),(44,35)],fill='#92915c')
    seam(p,[(49,22),(54,17),(61,15),(65,15)],'#beb580')
    p.polygon([(60,31),(70,23),(78,22),(86,27),(88,32),(84,34),(77,30),(69,31),(65,37),(62,44),(56,45)],fill='#363a2b')
    seam(p,[(63,31),(70,25),(77,24),(83,27)],'#c3b77c')
    body.alpha_composite(cut(base,[(67,32),(72,29),(80,29),(83,32),(81,36),(78,38),(73,38),(67,36)]))
    p=ImageDraw.Draw(body)
    panel(p,[(62,38),(67,36),(72,38),(80,37),(85,35),(84,41),(79,48),(70,50),(62,46)],'#494a37')
    seam(p,[(68,41),(76,42),(81,39)],'#858065')
    seam(p,[(71,46),(77,46),(81,43)],'#5d6047')
    seam(p,[(37,46),(43,42),(49,41),(53,37)],'#a2996a')
    seam(p,[(37,51),(42,48),(47,47)],'#7f8054')
    for x,y in ((48,27),(52,24),(58,19),(44,33),(53,31)):
        p.rectangle((x,y,x+2,y),fill='#9c996b')
    seam(p,[(70,20),(74,21),(78,23)],'#7c7b52',1)


def hammer_kit(body):
    # Three capped rounds are strapped behind one shoulder; stagger all three tips.
    rack=Image.new('RGBA',CELL); p=ImageDraw.Draw(rack)
    for x,y in ((17,37),(23,32),(29,28)):
        panel(p,[(x,y+8),(x+1,y+4),(x+3,y),(x+5,y+2),(x+8,y+9),(x+8,y+34),(x+1,y+37)],'#60664e')
        seam(p,[(x+2,y+9),(x+3,y+4)],'#ab9e76')
        p.rectangle((x+2,y+10,x+6,y+12),fill='#bb7650')
        p.rectangle((x+2,y+14,x+3,y+30),fill='#919377')
        p.rectangle((x+5,y+14,x+6,y+32),fill='#41463b')
    seam(p,[(17,57),(23,60),(31,59),(36,57)],'#292b26',4)
    seam(p,[(17,56),(23,59),(30,58)],'#928875')
    rack.alpha_composite(body);body.paste(rack)


def uniform(role):
    if role=='cct':
        return specialists.body(role)
    template = 'cct' if role=='lynx' else 'hammer'
    base=specialists.body(template)
    dyes={'bulk':('slate','navy'),'raven':('bark','umber'),'lynx':('olive','bark'),'hammer':('canvas','bark')}
    vest,trousers=dyes[role]
    body=fabric(base,vest)
    # All uniforms use the reference hips, knees and boot sole. Keep its contour as well as its dye.
    cct=specialists.body('cct')
    body.paste((0,0,0,0),(0,81,CELL[0],CELL[1]))
    legs=fabric(cct,trousers)
    body.alpha_composite(legs.crop((0,81,CELL[0],CELL[1])),(0,81))
    preserve_skin(body,base,role)
    if role=='bulk':
        bulk_kit(body,base)
    elif role=='raven':
        raven_kit(body,base)
    elif role=='lynx':
        lynx_kit(body,base)
    else:
        # Hammer's orange shell and anvil silhouette identify the heavy operator.
        body.alpha_composite(cut(base,[(36,9),(83,7),(84,24),(78,29),(76,26),(65,24),(62,33),(57,39),(51,43),(44,40),(38,36)]))
        hammer_kit(body)
    # The reference leather is a separate material from the trouser cloth.
    boot_mask=mask([(28,103),(38,105),(48,104),(47,109),(53,117),(53,121),(27,121)])
    boot_mask=ImageChops.lighter(boot_mask,mask([(72,105),(83,105),(90,103),(91,108),(99,112),(101,121),(71,121)]))
    boots=cct.copy()
    boots.putalpha(ImageChops.multiply(cct.getchannel('A'),boot_mask))
    body.alpha_composite(boots)
    if role in ('bulk','hammer'):
        p=ImageDraw.Draw(body)
        color,light=('#4d5868','#85939b') if role=='bulk' else ('#565458','#93908b')
        for x,y in ((46,94),(85,95)):
            panel(p,[(x-5,y-2),(x-2,y-6),(x+3,y-6),(x+6,y-3),(x+5,y+3),(x+1,y+5),(x-5,y+4)],color)
            seam(p,[(x-3,y-2),(x-1,y-4),(x+3,y-4)],light)
            p.point((x+3,y+2),fill='#b2a693')
    return body


# Masks extend to the outermost painted wrist, so raised weapons do not reveal a second fist.
FOREARMS = {
    'cct': [
        [(39,62),(42,58),(46,56),(52,54),(55,56),(57,60),(60,59),(64,56),(68,56),(72,58),(73,62),(71,68),(67,70),(61,70),(56,73),(51,75),(46,75),(41,72),(39,68)],
        [(80,56),(84,54),(94,56),(95,72),(85,74),(79,71),(79,65)]],
    'hammer': [
        [(39,62),(43,59),(47,57),(51,57),(54,60),(57,60),(61,56),(65,55),(69,56),(71,59),(71,65),(68,69),(59,71),(54,75),(46,76),(41,74),(38,69)],
        [(77,57),(81,55),(85,54),(94,57),(95,74),(86,76),(80,73),(77,69)]]
}


def separate_arms(dressed, template):
    polygons=FOREARMS[template]
    coverage=ImageChops.lighter(*(mask(points) for points in polygons))
    arms=dressed.copy()
    arms.putalpha(ImageChops.multiply(arms.getchannel('A'),coverage))
    body=dressed.copy()
    body.paste((0,0,0,0),(0,0,*CELL),coverage)
    # Extend the existing plate-carrier fabric underneath the forearm. Clamp UVs
    # at the front of the torso, leaving the space behind a lifted fist transparent.
    carrier=Image.new('RGBA',CELL)
    shadows=[dressed.getpixel(point)[:3] for point in ((62,54),(69,54),(70,55))]
    dark,mid,light=sorted(shadows,key=sum)
    p=ImageDraw.Draw(carrier)
    panel(p,[(39,56),(51,53),(69,53),(81,55),(81,71),(78,76),(48,76),(37,69)],dark)
    p.polygon([(40,58),(49,55),(56,55),(54,64),(49,67),(41,68)],fill=mid)
    p.polygon([(53,58),(60,56),(75,56),(79,59),(78,68),(72,71),(54,70)],fill=mid)
    seam(p,[(43,57),(48,56),(51,56)],light)
    seam(p,[(55,60),(68,58),(78,58)],light)
    seam(p,[(55,65),(59,64),(78,64)],dark)
    for x in (54,63,72):
        p.rectangle((x,68,x+5,73),fill=dark)
        p.rectangle((x+1,68,x+5,70),fill=mid)
        p.line((x+1,68,x+3,68),fill=light)
    carrier.putalpha(ImageChops.multiply(carrier.getchannel('A'),coverage))
    body.alpha_composite(carrier)
    return body,arms


def cct_field_helmet(body):
    """Remove the detachable four-lens assembly while retaining the radio, mask and fabric helmet."""
    pen=ImageDraw.Draw(body)
    pen.polygon([(67,0),(101,0),(101,28),(86,28),(81,25),(70,25),(67,21)],fill=(0,0,0,0))
    pen.polygon([(63,14),(68,12),(75,12),(81,14),(85,17),(87,21),(88,24),
                 (84,26),(78,24),(71,24),(66,26),(63,24)],fill='#312820')
    pen.polygon([(63,15),(68,14),(75,14),(80,16),(84,19),(85,21),
                 (79,21),(73,20),(67,22),(63,23)],fill='#ae8757')
    pen.polygon([(64,15),(69,14),(75,14),(78,16),(72,16),(68,18),(64,18)],fill='#d6af79')
    pen.polygon([(76,16),(80,17),(82,19),(76,18),(73,19),(71,18)],fill='#c29d6a')
    seam(pen,[(72,22),(78,22),(84,23),(86,24)],'#6c523a')
    pen.rectangle((50,23,61,29),fill='#57492f')
    for y,row in enumerate(PATCH,24):
        for x,pixel in enumerate(row,51):
            if pixel=='#': pen.point((x,y),fill='#e3cb94')


def publish(out):
    out=Path(out)
    bodies=Image.new('RGBA',(len(ROLES)*CELL[0],CELL[1]))
    arms=Image.new('RGBA',bodies.size)
    uniforms=[uniform(role) for role in ROLES]
    publish_base_and_helmets(out,uniforms)
    for i,(role,dressed) in enumerate(zip(ROLES,uniforms)):
        if role=='cct':
            cct_field_helmet(dressed)
        portrait=dressed.crop((27,0,103,76)).resize((112,112),Image.Resampling.NEAREST)
        portrait.save(out/'portraits'/(role+'-field.png'),optimize=True)
        body,hands=separate_arms(dressed,'cct' if role in ('cct','lynx') else 'hammer')
        bodies.paste(body,(i*CELL[0],0))
        arms.paste(hands,(i*CELL[0],0))
    bodies.save(out/'bodies.png',optimize=True)
    arms.save(out/'specialist-hands.png',optimize=True)
    stride_sheet(out/'crew-stride.png')


if __name__=='__main__':
    publish(Path(__file__).resolve().parents[2]/'game/art/armory')

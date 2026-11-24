"""Class fabric worn over the equipped armor, in the field operator's native grid."""
from PIL import Image, ImageDraw

RANKS = ('C','B','A','S','S-plus')
SIZE = (112,88)
INK = '#28242a'
# Ink, occlusion, shadow, body, lit plane, rim. Gold is reserved for the elite piping.
CLOTH = {
    'C': ('302a29','42392f','594b3e','73624c','907a5b','ad9873'),
    'B': ('262a27','323b30','46513d','5e6b4c','79825c','a1a479'),
    'A': ('252931','313741','434d58','5d6870','77858a','abb6aa'),
    'S': ('30232a','4c2930','71313a','9c4145','bc5351','de7564'),
    'S-plus': ('2b2028','45232c','682d38','923744','b64a4f','de7561'),
}


def patch(p, vertices, color, edge=INK):
    p.polygon(vertices, fill=color, outline=edge)


def thread(p, points, color, width=2):
    p.line(points, fill=color, width=width, joint='curve')


def lynx(rank, swing=0):
    im=Image.new('RGBA',SIZE);p=ImageDraw.Draw(im)
    ink,deep,shadow,base,lit,rim=('#'+c for c in CLOTH[rank])
    # The cloak folds behind the outer shoulder. Only the loose corners sway.
    patch(p,[(18+swing,84),(21+swing,75),(23,68),(26,57),(31,49),(40,40),(51,36),
             (61,38),(65,43),(58,52),(48,60),(43,65),(38,71),(34,77),(31,76),
             (25+swing,82),(23+swing,80),(21+swing,86)],base,ink)
    p.polygon([(20+swing,80),(26,65),(30,53),(37,45),(49,40),(52,42),
               (42,49),(35,60),(30,67),(26,74)],fill=lit)
    p.polygon([(31+swing,76),(37,63),(44,53),(51,48),(46,59),(40,68),(34,76)],fill=shadow)
    thread(p,[(25+swing,78),(30,68),(37,56),(43,50)],shadow)
    thread(p,[(28,65),(32,54),(39,47),(45,44)],rim)
    # Crown falls forward over the helmet. An opening at the far brow exposes
    # the helmet brim, eye and the four lamps of the S+ lens rack.
    patch(p,[(35,47),(37,38),(38,29),(40,23),(45,15),(53,9),(62,6),(69,6),(76,9),
             (82,14),(85,20),(80,22),(73,22),(67,27),(63,34),(61,42),(55,47),
             (46,50),(40,54),(34,56)],base,ink)
    p.polygon([(39,37),(42,24),(48,17),(56,12),(63,9),(69,9),(75,12),(78,15),
               (68,13),(60,15),(54,18),(48,25),(43,35)],fill=lit)
    p.polygon([(43,45),(49,31),(55,24),(62,20),(68,19),(61,25),(58,31),(55,42),(49,47)],fill=shadow)
    thread(p,[(42,37),(47,26),(54,18),(62,14)],lit,3)
    thread(p,[(50,19),(55,15),(62,12),(67,12)],rim)
    thread(p,[(38,47),(44,43),(49,40),(53,33)],deep)
    thread(p,[(55,44),(59,34),(62,28),(67,23),(74,19),(81,19)],deep,3)
    thread(p,[(59,36),(62,29),(68,23),(75,20)],lit)
    for x,y in ((44,31),(46,28),(51,24),(50,36),(55,28),(63,15)):
        p.rectangle((x,y,x+2,y),fill=lit)
    # Wrapped collar, throat flap and three angular creases in front of the vest.
    patch(p,[(46,45),(55,41),(60,35),(66,35),(70,39),(76,40),(83,37),(86,36),
             (85,42),(81,47),(75,51),(67,52),(61,56),(56,54),(51,52),(45,51)],shadow,ink)
    p.polygon([(50,46),(56,44),(62,39),(67,40),(72,43),(79,42),(82,40),
               (78,45),(70,47),(62,46),(57,49),(51,49)],fill=base)
    thread(p,[(53,46),(59,42),(62,40),(66,41)],lit)
    thread(p,[(61,49),(67,47),(73,48),(79,45)],deep)
    thread(p,[(57,52),(62,50),(65,50)],lit)
    if rank=='S-plus':
        # Broken stitches stay visible at half resolution on both hems; no new optics.
        for pts in ([(19+swing,82),(23+swing,77),(27,68),(32,59),(38,53)],
                    [(36,51),(43,46),(49,44),(54,38)],[(57,37),(62,27),(69,21),(74,19)],
                    [(54,48),(61,44),(65,44)],[(67,50),(74,49),(80,46)]):
            thread(p,pts,'#8d5c35',4);thread(p,pts,'#dca644',2)
        for x,y in ((23+swing,77),(31,59),(41,47),(60,30),(69,21),(61,44),(74,48)):
            p.rectangle((x,y,x+2,y+1),fill='#ffe295')
    return im


def raven(rank, swing=0):
    im=Image.new('RGBA',SIZE);p=ImageDraw.Draw(im)
    # A split red kerchief is anchored behind the neck. Both points stay clear
    # of the helmet while the front drapes across the top edge of the vest.
    patch(p,[(52,38),(47,42),(41,46),(34,47),(29+swing,50),(19+swing,49),
             (14+swing,46),(23+swing,45),(29,41),(37,41),(44,37)],'#a3473f')
    thread(p,[(19+swing,46),(26+swing,46),(31,43),(38,43),(43,40)],'#da7458')
    patch(p,[(51,40),(48,45),(44,51),(38,54),(33+swing,60),(28+swing,63),
             (29+swing,55),(34,48),(41,44),(45,39)],'#78383a')
    thread(p,[(30+swing,58),(35,51),(42,46)],'#ac5146')
    # Rolled short sleeve ends high on the biceps. Articulated bare forearms
    # are on the independently rotating gun/hand layers.
    patch(p,[(29,54),(30,48),(34,45),(39,43),(45,44),(49,47),(52,50),
             (49,54),(42,55),(36,59),(30,60)],'#535c4c')
    p.polygon([(31,51),(34,47),(38,45),(43,46),(45,48),(40,48),(34,52)],fill='#858b72')
    thread(p,[(30,56),(36,52),(42,50),(48,50)],'#30352e',3)
    thread(p,[(31,57),(37,54),(43,52),(48,52)],'#b6ab87')
    patch(p,[(46,38),(51,37),(57,38),(63,40),(68,41),(74,39),(79,37),(81,40),
             (79,46),(75,48),(71,52),(65,51),(60,49),(54,47),(49,45),(44,42)],'#a64a40')
    p.polygon([(47,40),(54,39),(62,42),(69,44),(74,42),(78,40),(76,44),
               (69,47),(61,45),(54,43)],fill='#ce6950')
    thread(p,[(51,41),(56,41),(62,44)],'#ed9170')
    thread(p,[(62,47),(69,49),(75,46)],'#633032')
    p.rectangle((68,48,71,48),fill='#df7356')
    return im


def atlas(out):
    image=Image.new('RGBA',(SIZE[0]*5,SIZE[1]*6))
    for role,paint in enumerate((raven,lynx)):
        for i,rank in enumerate(RANKS):
            for j,swing in enumerate((-2,0,2)):
                image.paste(paint(rank,swing),(i*SIZE[0],(role*3+j)*SIZE[1]))
    image.save(out/'worn/class-cloth.png',optimize=True)


def lynx_optics(head):
    """The four-lens block and hinged bracket sit outside the fabric on the S+ helmet."""
    optics=Image.new('RGBA',SIZE)
    mask=Image.new('L',(192,48))
    ImageDraw.Draw(mask).polygon([(63,12),(68,10),(69,5),(73,2),(87,2),(91,4),(96,4),
                                 (100,6),(100,12),(97,14),(89,15),(82,13),(77,13),
                                 (73,17),(70,21),(64,21),(62,18)],fill=255)
    optics.paste(head,(0,0),mask)
    return optics.crop((62,0,101,22))

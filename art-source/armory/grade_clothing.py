"""Pixel silhouettes for civilian, field and assault equipment; retain elite and pulse masters."""
from PIL import Image, ImageDraw, ImageColor

PALETTES = {
    'civil': ('28212a','473a3e','67534f','927665','ba9780','dfbca0'),
    'denim': ('24242d','363a46','505863','707b82','929c99','bbc1af'),
    'field': ('252723','3a4131','586246','798359','a2aa73','c9ca94'),
    'web': ('29262a','483f36','6b5a43','917a55','b49c72','dbc399'),
    'plate': ('26232a','403c3a','605747','8f7e61','b9a07a','e0c69b'),
    'metal': ('202229','343740','4d535e','69737d','94a3a4','c6ccc0'),
    'heavy': ('201e26','31303a','494752','666876','8b909b','b4b7b2')
}
def colors(name):
    return ['#'+s for s in PALETTES[name]]


class Pixel:
    def __init__(self, size=(64,60)):
        self.im=Image.new('RGBA',size)
        self.pen=ImageDraw.Draw(self.im)

    def piece(self, points, palette, bright=3):
        """One ink edge, an upper-left reflected edge and shaded lower panels."""
        p=colors(palette)
        mask=Image.new('L',self.im.size)
        ImageDraw.Draw(mask).polygon(points,fill=255)
        x0,y0,x1,y1=mask.getbbox()
        a=mask.load(); w,h=self.im.size
        def on(x,y):
            return 0<=x<w and 0<=y<h and a[x,y]
        target=self.im.load(); rgb=[ImageColor.getrgb(c)+(255,) for c in p]
        for y in range(y0,y1):
            for x in range(x0,x1):
                if not on(x,y): continue
                if not (on(x+1,y) and on(x-1,y) and on(x,y-1) and on(x,y+1)): n=0
                elif not on(x-2,y-2): n=bright+1
                elif not on(x+2,y+2): n=1
                elif (x-x0)/(x1-x0)+(y-y0)/(y1-y0)>1.05: n=bright-1
                else: n=bright
                target[x,y]=rgb[n]

    def seam(self,points,palette,tone=2,width=1):
        self.pen.line(points,fill=colors(palette)[tone],width=width)

    def pocket(self,x,y,w,h,palette):
        self.piece([(x,y+1),(x+w-2,y),(x+w,y+2),(x+w-1,y+h),(x+2,y+h+1),(x,y+h-1)],palette)
        self.seam([(x+1,y+3),(x+w//2,y+5),(x+w-1,y+2)],palette,1)
        self.pen.point((x+w//2,y+5),fill=colors(palette)[5])

    def result(self):
        return self.im.crop(self.im.getbbox())


def helmet(rank):
    b=Pixel()
    if rank=='C':  # Soft five-panel cap, stitched side panel, bent bill.
        b.piece([(4,23),(6,17),(9,12),(17,8),(24,6),(32,6),(40,9),(44,14),(45,20),(52,21),(59,24),(59,26),(54,27),(42,25),(28,26),(17,30),(7,30),(3,27)],'civil')
        b.seam([(9,21),(15,15),(22,12),(29,11),(36,12)],'civil',4)
        b.seam([(19,10),(24,10),(29,12),(32,17),(32,21)],'civil',2)
        b.seam([(5,25),(14,26),(25,23),(36,21),(45,21)],'civil',1,2)
        b.seam([(37,22),(46,22),(55,24)],'civil',5)
        b.seam([(11,23),(16,22),(20,21)],'civil',4)
        b.pen.polygon([(8,21),(11,16),(16,13),(19,13),(17,15),(13,16),(11,21)],fill='#a98b77')
        b.pen.polygon([(31,10),(37,12),(41,17),(42,19),(37,18),(36,14)],fill='#75615a')
        for a,c in ((11,25),(16,24),(21,23),(26,22),(31,21)):
            b.pen.line((a,c,a+2,c-1),fill='#c3a68a')
        b.seam([(39,24),(47,24),(53,25)],'civil',2)
    elif rank=='B':  # Wide steel rim; canvas band and small elastic keeper.
        b.piece([(4,26),(6,20),(9,14),(14,9),(23,5),(33,4),(42,7),(48,12),(52,19),(52,22),(58,24),(58,27),(54,29),(46,29),(37,27),(23,29),(11,33),(5,31)],'field')
        b.seam([(10,19),(14,13),(22,9),(31,8)],'field',4,2)
        b.seam([(18,11),(24,8),(29,7)],'field',5)
        b.seam([(6,24),(15,23),(27,21),(42,20),(50,22)],'web',2,3)
        b.seam([(6,23),(15,22),(27,20),(42,19)],'web',4)
        b.seam([(18,21),(19,25)],'web',5,2)
        b.seam([(8,29),(16,29),(29,26),(38,25),(52,26)],'field',4)
        b.pen.polygon([(31,9),(37,9),(43,12),(42,14),(35,12)],fill='#697852')
        b.pen.polygon([(11,20),(16,17),(19,16),(17,19),(13,21)],fill='#8f995f')
        for a,c in ((13,24),(24,22),(33,21),(43,21)):
            b.pen.line((a,c,a+1,c),fill='#aa996e')
    elif rank=='A':  # High-cut composite shell, rail and ear protection.
        b.piece([(4,24),(5,18),(12,10),(22,5),(33,4),(43,6),(50,12),(54,18),(55,23),(61,24),(60,27),(52,27),(45,25),(40,23),(32,24),(27,30),(22,34),(12,34),(7,30)],'plate')
        b.seam([(10,18),(16,12),(25,8),(34,8),(39,9)],'plate',5,2)
        b.seam([(21,8),(24,10),(25,14),(23,18)],'plate',2)
        b.piece([(12,21),(23,17),(34,16),(40,18),(41,21),(27,23),(18,27),(10,27)],'web')
        b.piece([(8,29),(10,23),(17,21),(24,24),(25,30),(21,35),(14,36),(9,34)],'metal')
        b.seam([(12,26),(16,24),(20,25)],'metal',4)
        b.seam([(28,20),(31,19),(35,19)],'plate',5)
    else:  # Ballistic brow and wraparound segmented ear guard.
        b.piece([(2,25),(4,17),(11,10),(18,6),(30,3),(41,4),(50,8),(56,15),(58,22),(60,25),(58,29),(50,29),(42,26),(35,27),(29,33),(26,39),(14,40),(8,36),(7,31)],'heavy')
        b.piece([(4,22),(9,15),(16,10),(26,7),(36,7),(39,9),(29,12),(23,16),(17,19),(11,24)],'metal')
        b.piece([(31,12),(40,7),(47,9),(53,14),(55,18),(48,18),(43,16),(35,17),(28,18)],'heavy')
        b.piece([(25,21),(34,17),(45,16),(55,19),(60,24),(59,27),(52,28),(47,24),(37,22),(30,24)],'metal')
        b.seam([(33,21),(40,19),(46,19),(53,22)],'web',4)
        b.piece([(9,26),(16,21),(22,22),(28,27),(28,34),(24,39),(16,40),(10,37)],'heavy')
        b.seam([(13,30),(16,26),(22,25)],'metal',4,2)
        b.seam([(12,33),(17,35),(21,35)],'metal',2)
    return b.result()


def soft_vest():
    b=Pixel()
    b.piece([(11,7),(19,3),(24,5),(26,10),(32,13),(37,12),(42,6),(47,6),(53,11),(53,20),(50,27),(52,40),(54,47),(51,50),(39,51),(32,49),(26,52),(13,50),(7,46),(9,36),(10,26),(6,21),(6,14)],'civil')
    # Open V neckline and zipper, quilt stitch, two low slash pockets, knitted hem.
    b.piece([(19,4),(23,5),(28,12),(32,17),(36,14),(41,7),(44,6),(44,11),(39,19),(34,23),(33,48),(30,49),(30,23),(24,18),(20,12)],'civil',2)
    b.seam([(22,8),(25,13),(30,18)],'civil',5)
    b.seam([(32,22),(32,32),(32,47)],'denim',4)
    b.seam([(9,17),(12,20),(13,25),(12,30)],'civil',1,2)
    for y in (25,32,40):
        b.seam([(13,y),(20,y+2),(28,y+2)],'civil',2)
        b.seam([(37,y),(44,y-1),(49,y-3)],'civil',2)
    b.seam([(14,40),(19,36),(22,35)],'civil',1,2)
    b.seam([(41,36),(45,39),(47,40)],'civil',1,2)
    b.seam([(12,47),(23,49),(29,48)],'civil',4)
    b.pen.polygon([(11,13),(13,9),(17,7),(19,8),(15,11),(13,16)],fill='#b3947d')
    b.pen.polygon([(37,22),(43,15),(46,14),(44,20),(40,23)],fill='#69524c')
    for py in (25,32,40):
        b.seam([(14,py+1),(20,py+3),(25,py+3)],'civil',4)
        b.seam([(37,py+1),(43,py),(47,py-2)],'civil',4)
    b.seam([(15,41),(20,37)],'civil',4)
    b.seam([(42,35),(47,39)],'civil',4)
    b.pen.rectangle((31,30,33,33),fill='#d2b996')
    for px in (15,19,23,37,41,45):
        b.pen.line((px,47,px+1,47),fill='#4a393a')
    return b.result()


def field_vest():
    b=Pixel()
    b.piece([(9,10),(17,6),(22,7),(25,15),(35,17),(41,12),(44,6),(51,7),(55,13),(53,20),(49,24),(50,44),(54,46),(51,51),(38,52),(30,50),(15,53),(8,49),(7,44),(11,34),(10,24),(5,20),(5,14)],'field')
    for x in (14,40):
        b.piece([(x,8),(x+4,7),(x+7,11),(x+6,21),(x+4,33),(x-1,33),(x+1,20)],'web')
        b.seam([(x+2,13),(x+5,12)],'web',5,2)
    b.seam([(13,30),(24,32),(38,31),(49,27)],'web',1,4)
    b.seam([(13,29),(23,31),(37,30),(48,27)],'web',4)
    b.pen.polygon([(20,18),(25,19),(32,20),(34,19),(33,22),(25,23),(20,21)],fill='#87916a')
    b.seam([(18,24),(23,25),(31,25)],'field',2)
    b.seam([(20,26),(27,27),(32,26)],'field',4)
    for px in (16,42):
        b.pen.rectangle((px,16,px+3,18),outline='#bdac84')
    b.pocket(9,33,12,14,'field');b.pocket(23,35,9,11,'web');b.pocket(36,31,13,14,'field')
    return b.result()


def plate_vest():
    b=Pixel()
    b.piece([(8,13),(14,5),(21,4),(27,9),(28,13),(37,13),(44,6),(50,5),(54,9),(56,16),(52,24),(53,45),(50,51),(40,53),(17,52),(9,48),(8,37),(10,26),(5,22),(5,16)],'web')
    b.piece([(19,15),(27,12),(38,13),(43,11),(48,14),(49,23),(46,34),(40,39),(23,39),(17,33),(15,23)],'plate')
    b.seam([(20,18),(26,15),(39,15)],'plate',5,2)
    b.pen.polygon([(20,19),(25,16),(32,16),(30,18),(25,19),(22,22)],fill='#bda683')
    b.pen.rectangle((31,18,39,20),fill='#675b4b');b.pen.line((32,18,37,18),fill='#b89c73')
    for y in (24,28,32):
        b.seam([(20,y),(28,y+1),(40,y),(45,y-2)],'web',2,2)
    for x in (13,23,33,43):
        b.pocket(x,38 if x<32 else 36,7,12,'web')
    b.seam([(7,17),(12,11),(17,9)],'plate',4,2)
    return b.result()


def gloves(rank):
    b=Pixel()
    if rank=='C':
        # Knit fingerless glove; exposed fingertips, ribbed elastic cuff.
        b.piece([(3,18),(8,15),(14,12),(18,7),(23,5),(28,5),(32,7),(37,7),(41,10),(40,13),(34,14),(34,17),(30,20),(27,23),(20,25),(13,24),(11,22),(7,24),(4,23)],'denim')
        for x,y in ((30,7),(33,12),(30,16),(27,19)):
            b.seam([(x,y),(x+4,y),(x+5,y+1)],'civil',4,2)
        for x in (5,8,11):
            b.seam([(x,19),(x+2,22)],'denim',4)
        b.seam([(15,15),(19,10),(24,9)],'denim',4)
        b.seam([(15,18),(20,16),(23,13)],'denim',2,2)
        b.seam([(18,13),(21,11),(23,10)],'denim',5)
        for px,py in ((25,8),(27,10),(28,13)):
            b.pen.line((px,py,px+2,py),fill='#91979a')
        b.seam([(5,18),(9,16),(11,16)],'denim',4)
    else:
        # Full leather field glove and buckled wrist strap.
        b.piece([(4,15),(8,12),(13,11),(18,6),(25,4),(31,5),(34,6),(40,7),(42,10),(40,13),(35,13),(36,16),(32,20),(26,22),(20,24),(15,22),(10,24),(5,22)],'web')
        b.piece([(4,14),(9,11),(14,12),(15,19),(12,22),(6,23),(3,20)],'field')
        b.piece([(15,12),(19,8),(25,6),(30,8),(33,11),(28,15),(20,17)],'web')
        b.seam([(18,11),(23,8),(27,8)],'web',5)
        b.seam([(5,15),(11,13)],'web',5,2)
        for x,y in ((28,14),(27,17),(24,20)):
            b.seam([(x,y),(x+4,y-1)],'web',1)
    return b.result()


def trousers(rank):
    b=Pixel()
    base='denim' if rank=='C' else 'field'
    b.piece([(14,4),(27,3),(36,4),(40,7),(40,15),(43,23),(46,28),(45,32),(52,43),(51,47),(43,50),(37,47),(34,39),(29,32),(25,27),(22,31),(18,43),(15,50),(6,49),(4,46),(7,36),(10,28),(9,22),(11,14)],base)
    b.seam([(13,8),(24,9),(37,7)],'web',1,3)
    b.pen.rectangle((25,6,29,9),outline=colors('web')[4])
    b.seam([(14,12),(20,12),(18,15),(13,17)],base,4)
    b.seam([(26,11),(26,16),(24,20)],base,1)
    b.seam([(13,30),(19,26),(21,26)],base,2,2)
    b.seam([(33,30),(37,31),(42,29)],base,2,2)
    b.seam([(7,46),(13,47),(16,46)],base,4);b.seam([(41,46),(47,45),(49,44)],base,4)
    if rank=='B':
        b.seam([(18,17),(22,15),(24,15)],base,4)
        b.seam([(8,39),(13,37),(15,36)],base,4)
        b.seam([(39,41),(43,41),(46,40)],base,4)
        b.pocket(9,18,10,9,'field');b.pocket(33,16,8,9,'web')
        b.seam([(10,34),(15,33),(17,34)],'web',3,2);b.seam([(36,35),(42,33)],'web',3,2)
    else:
        b.pen.polygon([(15,14),(20,13),(18,18),(14,21),(12,23)],fill='#7f8990')
        b.pen.polygon([(28,17),(31,19),(34,25),(36,26),(37,29),(32,28)],fill='#3c414c')
        b.pen.polygon([(9,36),(15,33),(18,33),(15,36),(11,37)],fill='#7d8588')
        b.seam([(10,39),(15,38),(16,37)],base,1)
        b.seam([(36,36),(40,38),(44,37)],base,4)
        b.seam([(13,27),(15,26),(18,25)],base,5)
        b.seam([(41,41),(44,44),(48,44)],base,1)
        b.seam([(12,20),(12,25),(11,28),(9,34)],base,4)
        b.seam([(32,15),(34,21),(37,23)],base,4)
    return b.result()


def boots(rank):
    b=Pixel()
    if rank=='C':
        # Low canvas trainer, rubber toe and continuous pale sole.
        b.piece([(4,19),(7,16),(11,17),(15,20),(20,19),(23,14),(27,15),(30,20),(34,23),(40,24),(45,27),(46,32),(41,35),(14,35),(5,33),(3,30)],'denim')
        b.piece([(6,24),(9,21),(12,22),(15,26),(18,28),(10,28),(6,27)],'denim',2)
        b.pen.polygon([(31,24),(35,25),(39,26),(42,28),(36,28),(32,27)],fill='#b6b8a8')
        b.seam([(16,26),(20,26),(24,24)],'denim',4)
        b.seam([(5,29),(14,31),(31,31),(42,30),(44,29)],'civil',5,3)
        b.seam([(9,19),(12,22),(17,25),(21,25)],'denim',4,2)
        b.seam([(24,20),(28,19)],'denim',5,2);b.seam([(26,23),(30,22)],'denim',5,2)
    else:
        b.piece([(6,6),(11,4),(17,7),(24,4),(28,7),(26,14),(28,22),(32,25),(39,26),(44,29),(45,34),(42,37),(11,37),(6,35),(3,35),(2,30),(5,24)],'web')
        b.piece([(5,10),(12,11),(19,10),(23,8),(24,14),(20,18),(18,23),(9,26),(5,23)],'field')
        b.pen.polygon([(7,20),(12,18),(15,19),(12,21),(7,22)],fill='#7d8360')
        b.seam([(7,25),(13,24),(17,23)],'web',4)
        b.seam([(27,27),(33,27),(37,28)],'web',4,2)
        b.seam([(5,31),(13,32),(26,32),(39,33),(43,32)],'web',1,3)
        for y in (12,16,20): b.seam([(18,y),(21,y+1),(25,y-1)],'web',4,2)
    return b.result()


def reinforced(slot, source):
    """Steel strike plates above Cordura and bronze fasteners, with a wider profile."""
    w,h=source.size
    b=Pixel((w+12,h+10))
    x,y=6,6
    if slot=='gloves':
        b.piece([(0,15),(3,10),(12,8),(16,12),(16,20),(12,27),(3,28),(1,24)],'heavy')
        b.seam([(2,16),(5,13),(10,12)],'metal',4)
    elif slot=='boots':
        b.piece([(9,10),(11,2),(18,0),(28,1),(31,5),(29,20),(22,27),(10,25)],'heavy')
        b.seam([(12,6),(18,3),(26,3)],'metal',4,2)
    elif slot=='top':
        b.piece([(23,15),(24,4),(30,1),(42,0),(51,3),(54,10),(49,19)],'heavy')
        b.seam([(27,6),(32,4),(43,3),(49,5)],'metal',4,2)
    elif slot=='pants':
        b.piece([(7,19),(12,16),(20,18),(22,24),(18,31),(11,33),(4,29)],'heavy')
        b.piece([(42,17),(49,15),(57,20),(59,26),(55,31),(46,29)],'heavy')
    im=source.copy();pix=im.load()
    metal=[ImageColor.getrgb(c) for c in colors('heavy')]
    for py in range(h):
        for px in range(w):
            r,g,blue,a=pix[px,py]
            # Retain copper buckles and luminous edge nicks; cool the broad bronze faces.
            if a and r>blue+16 and r>g and r-g<62 and r<182:
                v=(r+2*g+blue)//4
                grade=min(5,int(v/35))
                tint=metal[grade]
                pix[px,py]=(*(round(.72*c+.28*o) for c,o in zip(tint,(r,g,blue))),a)
    b.im.alpha_composite(im,(x,y))
    if slot=='gloves':
        for px,py in ((21,13),(25,12),(29,11)):
            b.seam([(px,py+2),(px+1,py),(px+3,py)],'metal',4)
    elif slot=='top':
        b.seam([(9,26),(13,21),(20,19),(24,19)],'metal',4,2)
    elif slot=='boots':
        b.piece([(12,13),(19,10),(25,12),(26,17),(21,23),(14,23),(11,20)],'heavy')
        b.seam([(14,15),(18,12),(22,13)],'metal',4)
    elif slot=='pants':
        b.seam([(6,24),(9,21),(13,21)],'metal',4,2)
        b.seam([(48,24),(52,23),(55,25)],'metal',4,2)
    return b.result()


def ranked_clothing(slot,rank,finished):
    if slot=='helmet' and rank!='S-plus': return helmet(rank)
    if slot=='top' and rank in ('C','B','A'):
        return {'C':soft_vest,'B':field_vest,'A':plate_vest}[rank]()
    if rank in ('C','B') and slot in ('gloves','pants','boots'):
        return {'gloves':gloves,'pants':trousers,'boots':boots}[slot](rank)
    if rank=='S': return reinforced(slot,finished)
    return finished

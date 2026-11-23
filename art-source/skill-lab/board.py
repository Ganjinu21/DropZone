"""Pair each operator's basic ammunition with their signature skill frame."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'design/skill-lab'
BAKES = ROOT / 'work/skill-lab-bake'
FONTS = Path('C:/Windows/Fonts')
PAPER = '#eee9de'
INK = '#192324'

board = Image.new('RGB', (1488, 1300), PAPER)
pen = ImageDraw.Draw(board)


def label(x, y, text, size, color=INK, face='malgunbd.ttf', anchor='lt'):
    font = ImageFont.truetype(str(FONTS / face), size)
    pen.text((x, y), text, font=font, fill=color, anchor=anchor)


def battle(x, y, clip, ms, caption):
    frame = round(ms/40)
    sx, sy = frame % 8 * 400, frame // 8 * 160
    with Image.open(BAKES / (clip+'.png')) as strip:
        shot = strip.crop((sx, sy, sx+400, sy+160))
        board.paste(shot.resize((540,216), Image.Resampling.NEAREST), (x,y))
    label(x, y+224, caption, 20)
    label(x+540, y+229, f'{frame*.04:.2f} s', 15, '#636f68','consola.ttf','rt')


def operator(x, y, ident, name, call, background, accent):
    w, h = 258, 246
    pen.rectangle((x,y,x+w-1,y+h-1),fill=background)
    pen.rectangle((x,y,x+4,y+h-1),fill=accent)
    with Image.open(ART / 'portraits' / (ident+'.png')) as image:
        mask = image.getchannel('A').point(lambda a: 255 if a>42 else 0)
        cut = image.crop(mask.getbbox())
        cut.thumbnail((w-19,160),Image.Resampling.LANCZOS)
        board.paste(cut, (x+(w-cut.width)//2,y+55+(160-cut.height)//2),cut)
    label(x+15,y+12,name,32,'#f3eee2')
    label(x+w-15,y+20,call,16,accent,'consolab.ttf','rt')


def row(n, ident, name, call, background, accent, basic, signature):
    y = 211 + n*270
    operator(48,y,ident,name,call,background,accent)
    battle(336,y,ident+'-basic',*basic)
    move, ms, title = signature
    battle(900,y,ident+'-'+move,ms,title)
    pen.line((48,y+258,1440,y+258),fill='#bbbeb1',width=1)


pen.rectangle((49,33,61,45),fill='#a05c2c')
label(74,30,'DROP ZONE SQUAD',20,'#4a5551','consolab.ttf')
label(45,67,'사격과 착탄',64)
label(1440,113,'분대 스킬 도감',26,'#455550',anchor='rt')
pen.line((48,155,1440,155),fill=INK,width=3)
label(48,174,'대원',22)
label(336,174,'기본 공격',22)
label(900,174,'스킬',22)
row(0,'bulk','벌크','BULK','#273e50','#9bd1f6',
    (680,'방패 사격'),('skill',2280,'메카 벙커 고정 모드'))
row(1,'raven','레이븐','RAVEN','#493531','#ffaf82',
    (850,'양손 SMG 점사'),('spin',1640,'회전 난사'))
row(2,'lynx','링스','LYNX','#2f423c','#a7dfc5',
    (920,'정밀 단발'),('skill',1440,'레이저 관통 4연격'))
row(3,'mortar','해머','HAMMER','#494036','#ffc181',
    (1490,'곡사 유탄'),('skill',2260,'연쇄 포격'))
board.save(ART / 'skill-board.png', optimize=True)

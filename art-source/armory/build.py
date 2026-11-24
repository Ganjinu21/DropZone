"""Export native pixel sprites shared by the locker, character preview and battlefield."""
import importlib.util
from pathlib import Path
from PIL import Image, ImageDraw
from field_crew import squad_icons
from locomotion import stride_sheet
from leg_armor import build_worn_armor
import specialists

root = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("unit_art", root / "work/art/tag-combat/units.py")
units = importlib.util.module_from_spec(spec)
spec.loader.exec_module(units)
out = root / "game/art/armory"
out.mkdir(parents=True, exist_ok=True)
colors = ["#9ca699", "#82bfad", "#73adbc", "#bda6c9", "#bd99bd", "#dfb366"]
families = ["pistol","carbine","smg","sniper","rocket","ar"]
def cropped(im):
    return im.crop(im.getchannel("A").getbbox())
for family in families:
    for variant,accent in enumerate(colors):
        if family in ('ar','rocket'):
            specialists.weapon(family,variant,accent).save(out/f'{family}-{variant}.png')
            continue
        canvas = Image.new("RGBA",(72,29)); d=ImageDraw.Draw(canvas)
        if family in ("pistol","sniper"):
            sprite = cropped(units.COMPACT if family=="pistol" else units.RIFLE)
        else:
            source="ar" if family=="carbine" else family
            base=Image.open(root/f"game/art/prep/{source}.png").convert("RGBA")
            if family=="smg": # draw one compact weapon; the paired pose repeats it
                base=cropped(units.PISTOL)
            sprite=cropped(base)
            sizes={"carbine":(26,12),"ar":(36,15),"rocket":(35,15),"smg":(22,12)}
            sprite=sprite.resize(sizes[family],Image.Resampling.NEAREST)
        w,h=sprite.size
        canvas.alpha_composite(sprite,(2,6))
        if family=="smg":d.rectangle((9,13,12,19),fill="#514b3e",outline="#232a2d")
        if family=="carbine":d.rectangle((1,11,9,15),fill="#59655c",outline="#212b2b")
        if variant:
            y=8 if family!='sniper' else 12
            d.rectangle((max(3,w//2-1),y,w//2+3,y+2),fill=accent)
            d.line((4,y+1,7,y+1),fill=accent)
            if variant in (1,3,5):
                d.rectangle((w-2,y,w+2+variant//2,y+2),fill="#283337")
                d.line((w-1,y,w+variant//2,y),fill=accent)
            if variant>=2:
                d.rectangle((w//2-2,5,w//2+variant-1,7),fill="#243036")
                d.line((w//2-1,5,w//2+variant-2,5),fill=accent)
            if variant>=4:
                d.rectangle((w//2+4,y+3,w//2+7,y+5),fill="#454f4d")
                d.point((w//2+6,y+5),fill=accent)
        cropped(canvas).save(out/f"{family}-{variant}.png")
hands=Image.new('RGBA',(384,128))
bodies=Image.new('RGBA',(96*5*2,64*2))
for role in range(5):
    if role<3:
        body=units.operator(role).resize((192,128), Image.Resampling.NEAREST)
    else:
        name='hammer' if role==3 else 'cct'
        body=specialists.body(name)
        hands.alpha_composite(specialists.hands(name),((role-3)*192,0))
        specialists.portrait(name).save(out/f'{name}-portrait.png')
    bodies.alpha_composite(body,(role*192,0))
bodies.save(out/'bodies.png')
hands.save(out/'specialist-hands.png')
stride_sheet(out/'crew-stride.png')
build_worn_armor(out)
squad_icons(out)
shield=cropped(units.SHIELD);shield.save(out/'shield.png')
# Reinforced field supply crate at native icon resolution.
im=Image.new('RGBA',(64,44));d=ImageDraw.Draw(im)
d.polygon([(2,12),(17,4),(52,4),(62,11),(62,34),(49,41),(2,35)],fill='#19282b',outline='#111d22')
d.polygon([(4,14),(46,19),(46,38),(4,33)],fill='#53635b');d.polygon([(48,19),(60,13),(60,32),(48,38)],fill='#344640')
d.polygon([(5,11),(18,6),(51,6),(59,10),(46,16)],fill='#89937e')
for x in (8,33):
    d.polygon([(x,13),(x+5,14),(x+5,35),(x,34)],fill='#b69463',outline='#333d37')
    d.line((x+1,15,x+1,32),fill='#e0c48c')
d.rectangle((20,22,28,29),fill='#192c30');d.polygon([(21,25),(24,22),(27,25),(24,28)],fill='#93d4c7')
im.save(out/'crate.png')
# Button symbols on the same 16-pixel grid as the in-game equipment.
glyphs={
'bunks':["11..........","11.22..2222.","11222222222.","111111111111","11........11","11.22..2222.","11222222222.","111111111111","11........11"],
'play':["....11......","....1211....","....122211..","....12222211","....12222211","....122211..","....1211....","....11......"],
'team':["..111..11...","..121..12...","..111..11...","............",".11111.1111.","112221112211","122221122221",".11111.1111."],
'save':[".111111111..",".1221111211.",".1221111211.",".1111111111.",".1112222111.",".1121111211.",".1121111211.",".1111111111."],
'lead':[".....11.....","....1221....","...122221...","..12211221..",".1211..1121.",".....11.....","....1221....","...12..21..."],
'back':["....11......","...121......","..121.......",".1221111111.","..122222221.","...121......","....11......"],
'close':[".11.....11..",".121...121..","..121.121...","...12221....","....121.....","...12221....","..121.121...",".121...121..",".11.....11.."],
'swap':[".......11...","..11111121..","..122222221.",".......121..","...11...1...","..121.......",".122222221..","..12111111..","...11......."],
'check':[".........11.","........121.",".......121..","..11..121...",".1211121....","..12221.....","...121......","....1......."],
'gem':["..1111111...",".122112221..","12221122221.","12222222221.",".122222221..","..1222221...","...12221....","....121.....",".....1......"],
'pause':[".111..111...",".121..121...",".121..121...",".121..121...",".121..121...",".121..121...",".111..111..."],
'skill':[".....11111..","....12221...","...12221....","..12211111..",".11112221...","....1221....","...121......","..11........"],
'home':[".....11.....","...112211...","..12222221..",".1111111111.","..12222221..","..12211221..","..12211221..","..11111111.."],
}
for name,matrix in glyphs.items():
    icon=Image.new('RGBA',(16,16));p=ImageDraw.Draw(icon)
    for y,row in enumerate(matrix):
        for x,cell in enumerate(row):
            if cell!='.':p.point((x+2,y+(16-len(matrix))//2),fill='#dfd3a6' if cell=='1' else '#89afa0')
    icon.save(out/f'ui-{name}.png')

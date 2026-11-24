"""Native squad upgrade icons."""
from PIL import Image, ImageDraw

def squad_icons(out):
    for name in ('field-kit','squad-damage','squad-vitality','xp-magnet'):
        im=Image.new('RGBA',(40,36)); d=ImageDraw.Draw(im)
        if name=='field-kit':
            d.rectangle((6,11,34,30),fill='#29322b',outline='#161f20',width=2)
            d.rectangle((8,13,32,27),fill='#7c8466');d.rectangle((8,12,32,16),fill='#abb08a')
            d.rectangle((14,6,25,11),outline='#b7ad89',width=2)
            for x in (10,29):d.line((x,13,x,28),fill='#4b5846',width=2)
            d.rectangle((18,16,22,26),fill='#e9d7af');d.rectangle((15,19,25,23),fill='#e9d7af')
        elif name=='squad-vitality':
            # Medical shield with cream piped edging and a field-green cross.
            d.polygon([(5,6),(20,3),(34,6),(34,18),(31,24),(25,30),(20,33),
                       (14,30),(8,24),(5,18)],fill='#302b26',outline='#151c1e',width=2)
            d.polygon([(8,8),(20,6),(31,8),(31,17),(28,22),(23,27),(20,29),
                       (15,26),(10,21),(8,17)],fill='#9f7960',outline='#e9c797',width=2)
            d.rectangle((17,10,22,23),fill='#e4ddae');d.rectangle((13,14,26,19),fill='#e4ddae')
            d.line((10,9,17,7),fill='#fff0cd')
        elif name=='xp-magnet':
            d.polygon([(7,4),(15,4),(15,19),(18,23),(22,23),(25,19),(25,4),
                       (33,4),(33,21),(29,28),(24,32),(16,32),(10,28),(6,21)],
                      fill='#94574b',outline='#252426',width=2)
            d.rectangle((8,5,13,12),fill='#b9b9a6');d.rectangle((26,5,31,12),fill='#b9b9a6')
            d.line((8,14,8,20,12,27,17,30),fill='#d28d68',width=2)
            d.line((26,7,30,7),fill='#f2dbac');d.line((9,7,13,7),fill='#f2dbac')
            d.polygon([(19,5),(22,10),(19,15),(17,10)],fill='#89d5b3',outline='#536d62')
        else:
            for x,y in [(6,11),(15,8),(24,5)]:
                d.polygon([(x,y+7),(x+3,y),(x+6,y+7),(x+6,y+20),(x,y+20)],fill='#ba8d50',outline='#35342b')
                d.line((x+2,y+7,x+2,y+18),fill='#f0cf83');d.line((x+1,y+17,x+5,y+17),fill='#7a663f')
        im.save(out/(name+'.png'))

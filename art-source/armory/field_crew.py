"""Native squad upgrade icons."""
from PIL import Image, ImageDraw

def squad_icons(out):
    for name in ('field-kit','squad-damage'):
        im=Image.new('RGBA',(40,36)); d=ImageDraw.Draw(im)
        if name=='field-kit':
            d.rectangle((6,11,34,30),fill='#29322b',outline='#161f20',width=2)
            d.rectangle((8,13,32,27),fill='#7c8466');d.rectangle((8,12,32,16),fill='#abb08a')
            d.rectangle((14,6,25,11),outline='#b7ad89',width=2)
            for x in (10,29):d.line((x,13,x,28),fill='#4b5846',width=2)
            d.rectangle((18,16,22,26),fill='#e9d7af');d.rectangle((15,19,25,23),fill='#e9d7af')
        else:
            for x,y in [(6,11),(15,8),(24,5)]:
                d.polygon([(x,y+7),(x+3,y),(x+6,y+7),(x+6,y+20),(x,y+20)],fill='#ba8d50',outline='#35342b')
                d.line((x+2,y+7,x+2,y+18),fill='#f0cf83');d.line((x+1,y+17,x+5,y+17),fill='#7a663f')
        im.save(out/(name+'.png'))

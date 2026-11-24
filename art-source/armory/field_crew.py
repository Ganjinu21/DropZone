"""Native 1x field uniform, eight planted-foot walking poses and squad upgrade icons."""
from math import cos, sin, tau
from PIL import Image, ImageDraw

# Fabric highlights, midtone, deep folds, kneepad and boot leather.
uniforms = [
    ('#8d927d','#5d6455','#41483f','#414752','#292a28'),
    ('#947951','#70583c','#504031','#655444','#302b27'),
    ('#a2a06c','#777748','#525539','#696847','#323129'),
    ('#ae8959','#836643','#594a38','#645e51','#322e29'),
    ('#c3a079','#937956','#6b5a43','#82775c','#453d32'),
]

def stride_sheet(path):
    sheet=Image.new('RGBA',(8*64,5*24))
    for role,(lit,cloth,fold,pad,boot) in enumerate(uniforms):
        for frame in range(8):
            im=Image.new('RGBA',(64,24)); d=ImageDraw.Draw(im)
            for rear in [True,False]:
                phase=tau*frame/8+(tau/2 if rear else 0)
                hip=29 if rear else 33
                ankle=round(hip+10*cos(phase))
                lift=round(5*max(0,-sin(phase)))
                knee=round(hip+4*cos(phase)+4*max(0,-sin(phase)))
                ky=9-lift//2; ay=17-lift
                thigh=[(hip-4,-2),(hip+4,-2),(knee+4,ky),(knee+2,ky+3),(knee-4,ky+2)]
                calf=[(knee-3,ky),(knee+3,ky),(ankle+2,ay+1),(ankle-4,ay+1)]
                d.polygon(thigh,fill=fold if rear else cloth,outline='#303029')
                d.polygon(calf,fill=fold if rear else cloth,outline='#303029')
                d.line((hip-1,1,knee-2,ky-2),fill=cloth if rear else lit,width=2)
                d.rectangle((knee-2,ky-1,knee+2,ky+2),fill=fold if rear else pad)
                d.line((knee-2,ky-1,knee+1,ky-1),fill=cloth if rear else lit)
                d.polygon([(ankle-4,ay-2),(ankle+2,ay-2),(ankle+3,ay),(ankle+6,ay+1),(ankle+6,ay+3),(ankle-4,ay+3)],fill=boot,outline='#272826')
                d.line((ankle,ay,ankle+4,ay+1),fill=fold if rear else pad)
            sheet.alpha_composite(im,(frame*64,role*24))
    sheet.save(path)

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

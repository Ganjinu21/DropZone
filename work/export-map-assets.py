from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
from io import BytesIO
from PIL import Image
import argparse,json,re
project = Path(__file__).resolve().parents[1]
game = project/'game'
parts={}
city={}
for row,kind in enumerate('office hospital apartment warehouse market retail tower'.split()):
    for col,name in enumerate(['roof-1','roof-2','roof-3','facade-1','facade-2','facade-3','wall-service','door','canopy-S','canopy-E','canopy-N','canopy-W']):
        w,h=([(36,36)]*3+[(40,30)]*4+[(40,32),(38,20),(20,38),(38,20),(20,38)])[col]
        city[kind+'/'+name]=(64*col,64*row,w,h)
cityjs=(game/'city-kit.js').read_text()
for row,key,names in [(7,'extras','twin-cooler small-ac tank lift-room skylight antenna exhaust chimney solar flues stairwell tar-patch'),(8,'fittings','brackets broken-sign sign service-box masonry-crack damp ladder anchors clinic-marker membrane folded-awning glass-block')]:
    sizes=json.loads(re.search(r'const '+key+r'\s*=\s*(\[[^;]+)',cityjs)[1])
    for n,(name,(w,h)) in enumerate(zip(names.split(),sizes,strict=True)):
        city['detail/'+name]=(64*n,64*row,w,h)
parts['city-kit']=city
ground={}
for row,s in enumerate(('asphalt','pavers','yard','alley')):
    for col in range(8):ground[f'{s}/{col+1}']=(32*col,32*row,32,32)
for col,n in enumerate('drain manhole rubble-brick rubble-stone weeds tactile paper hatch'.split()):ground['decal/'+n]=(32*col,128,32,32)
for col in range(4):ground['tree/'+str(col+1)]=(64*col,160,64,64)
parts['ground-kit']=ground
transit={f'stair/{variant}-{f}':(128*j,128*i,128,128) for i,variant in enumerate(('open','covered')) for j,f in enumerate('NESW')}
spec=re.search(r'const modules = \{(.+?)\};',(game/'transit-kit.js').read_text(),re.S)[1]
for name,box in re.findall(r'(\w+):\[([\d,]+)\]',spec):transit['train/'+name]=list(map(int,box.split(',')))
parts['transit-kit']=transit
parts['street-fixtures']=json.loads((game/'street-fixture-frames.js').read_text().split('=',1)[1].rstrip(';\n'))
parts['roof-damage']={f'collapse-{i+1}':(i*88,0,88,60) for i in range(4)}

parser=argparse.ArgumentParser(description='Export the city atlases, named frames, and individual sprites.')
parser.add_argument('output',type=Path,nargs='?',default=project/'dist'/'DropZone-Map-Assets.zip')
out=parser.parse_args().output
out.parent.mkdir(exist_ok=True,parents=True)
with ZipFile(out,'w',ZIP_DEFLATED) as z:
    for kit,frames in parts.items():
        source=game/(kit+'.png')
        z.write(source,'atlases/'+kit+'.png')
        im=Image.open(source)
        metadata={}
        for name,(x,y,w,h) in frames.items():
            assert 0<=x<x+w<=im.width and 0<=y<y+h<=im.height
            sprite=im.crop((x,y,x+w,y+h));assert sprite.getbbox() is not None
            data=BytesIO();sprite.save(data,format='PNG'); z.writestr('sprites/'+kit+'/'+name+'.png',data.getvalue())
            metadata[name]={'frame':dict(x=x,y=y,w=w,h=h),'rotated':False,'trimmed':False,'spriteSourceSize':dict(x=0,y=0,w=w,h=h),'sourceSize':dict(w=w,h=h)}
        manifest={'frames':metadata,'meta':{'image':kit+'.png','format':'RGBA8888','size':{'w':im.width,'h':im.height},'scale':'1'}}
        z.writestr('atlases/'+kit+'.json',json.dumps(manifest,indent=1))
print({k:len(v) for k,v in parts.items()},sum(map(len,parts.values())))

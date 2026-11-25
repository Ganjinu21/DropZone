"""Register Raven's complete armed drawings and isolate the painted SMG finish."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

SOURCE = Path(__file__).parent/'raven-painted'/'equipped'
GROUPS = {'ready':[0,1,2,3,28,29,30,31], 'side':range(4,12), 'away':range(12,20),
          'toward':range(20,28), 'aim':range(32,40), 'forward':range(40,48),
          'pivot-0':[None,49,50,None,None,None,None,None],
          'pivot-1':[None,None,58,59,60,None,None,None],
          'standing':[None,None,None,None,None,None,61,None],
          'action':[52,None,None,None], 'wind':[None,None,62,63],
          'turn-wrap':[None,48,57], 'turn-link-4':[53], 'turn-steep':[56,54],
          'turn-link-8':[51], 'turn-link-10':[55],
          'turn-open':[64,65], 'turn-cross':[66,67], 'turn-vertical':[68,69],
          'turn-drop':[70,71]}

def gutters(projection,count):
    step=len(projection)/count
    cuts=[0]
    for i in range(1,count):
        mid=round(i*step)
        choices=range(mid-round(step*.16),mid+round(step*.16)+1)
        cuts.append(min(choices,key=lambda x:(projection[x],abs(mid-x))))
    return cuts+[len(projection)]

def registered():
    frames=[None]*72
    for group,indices in GROUPS.items():
        sheet=Image.open(SOURCE/(group+'.png')).convert('RGBA')
        rgba=np.array(sheet)
        white=rgba[:,:,:3].min(2).astype(float)
        if ((white>218)&(rgba[:,:,3]>65)).mean()>.15:
            # Some exports carry a white studio matte; recover its soft edge
            # before trimming the frame and finding the heel registration.
            keep=np.clip((233-white)/38,0,1)
            rgb=(rgba[:,:,:3]-249*(1-keep[:,:,None]))/np.maximum(.001,keep[:,:,None])
            rgba[:,:,:3]=np.uint8(np.clip(rgb,0,255))
            rgba[:,:,3]=np.uint8(rgba[:,:,3]*keep)
        rgba[:,:,3]=np.uint8(np.clip((rgba[:,:,3].astype(float)-20)*255/235,0,255))
        sheet=Image.fromarray(rgba)
        mask=np.asarray(sheet.getchannel('A'))>112
        rows=1 if group.startswith('turn-') else 2
        ys=gutters(mask.sum(1),rows)
        for row,(t,b) in enumerate(zip(ys,ys[1:])):
            columns=len(indices)//rows
            xs=gutters(mask[t:b].sum(0),columns)
            for col,(l,r) in enumerate(zip(xs,xs[1:])):
                i=indices[columns*row+col]
                if i is None:continue
                patch=sheet.crop((l,t,r,b))
                alpha=np.asarray(patch.getchannel('A'))>115
                xx=np.flatnonzero(alpha.sum(0)>2)
                yy=np.flatnonzero(alpha.sum(1)>2)
                patch=patch.crop((xx[0],yy[0],xx[-1]+1,yy[-1]+1))
                # Use equal figure scale within a sheet so a crouch remains low.
                h=b-t
                scale=min(228/h,276/patch.width,246/patch.height)
                if i>=48:
                    # The layout sheets use different gutters. Register to the figure;
                    # the raised weapons in 49 and 58 extend above the crown.
                    height=[213,228,222,207,180,201,247,205,250,197,231,188,220,220,215,217,
                            197,238,194,232,252,223,193,233][i-48]
                    scale=min(height/patch.height,276/patch.width)
                w,h=round(patch.width*scale),round(patch.height*scale)
                small=patch.resize((w,h),Image.Resampling.LANCZOS)
                pix=np.asarray(small).astype(float)
                red,green,blue,a=pix.transpose(2,0,1)
                trousers=(a>125)&(red>blue*1.16)&(green>blue*1.12)&(red<green*1.38)
                trousers[:int(h*.46)]=False
                trousers[int(h*.76):]=False
                hip=float(np.median(np.where(trousers)[1])) if trousers.any() else w/2
                x=int(np.clip(round(144-hip),2,286-w))
                frame=Image.new('RGBA',(288,288))
                frame.alpha_composite(small,(x,268-h))
                frames[i]=frame
    return frames

def material(cel,index,barrels):
    rgb=np.asarray(cel).astype(float)
    r,g,b,a=rgb.transpose(2,0,1)
    # Petrol metal has green above red and roughly as much green as blue.
    # Raven's blue-black hair is more violet, with red above green in its lights.
    chroma=np.minimum(g-r,(g-.81*b)*2)
    weight=np.clip((chroma-3)/14,0,1)*np.clip((b-r+2)/9,0,1)
    weight*=np.asarray(Image.fromarray(np.uint8((chroma>17)&(b>r+9))*255)
                       .filter(ImageFilter.MaxFilter(7)))/255
    y,x=np.indices(a.shape)/2
    if index>=28:
        near,far=barrels[index-28][:3],barrels[index-28][3:]
        region=np.zeros(a.shape,dtype=bool)
        for tx,ty,angle in (near,far):
            co,si=np.cos(np.deg2rad(angle)),np.sin(np.deg2rad(angle))
            behind=(tx-x)*co+(ty-y)*si
            side=(x-tx)*si+(ty-y)*co
            region|=(behind>=-4)&(behind<32)&(abs(side)<9)
    elif index<12:
        region=(x>59)&(x<108)&(y>44)&(y<82)
    elif index<20:
        region=(x>73)&(x<105)&(y>27)&(y<73)
    else:
        region=(y>64)&(y<111)&((x<61)|(x>84))
    return Image.fromarray(np.uint8(weight*a*region))

def finish(cel,mask,tier):
    ramps=[('#242b30','#8a9eaf','#e4edf0'),('#382719','#ba874e','#fff0bf'),
           ('#272137','#846fbb','#ede0ff'),('#32241c','#d6a548','#fff2ca')]
    colors=np.array([tuple(bytes.fromhex(c[1:])) for c in ramps[tier-1]])
    y=np.asarray(cel.convert('L')).astype(float)
    rgb=np.stack([np.interp(y,[8,117,225],colors[:,i]) for i in range(3)],axis=2)
    out=Image.fromarray(np.uint8(rgb)).convert('RGBA')
    out.putalpha(mask)
    return out

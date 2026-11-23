'use strict';

ART.roofDamage = 'roof-damage.png';

const CityDamage = {
  draw(ctx, x, y, maxWidth, maxHeight, variant) {
    const scale = Math.min(1.72, maxWidth / 88, maxHeight / 60);
    if (scale <= 0) return;
    const w = Math.round(88 * scale), h = Math.round(60 * scale);
    const dx = x + Math.round((maxWidth - w) * (variant % 2 ? .72 : .32));
    const dy = y + Math.round((maxHeight - h) / 2);
    ctx.drawImage(art.roofDamage, 88 * variant, 0, 88, 60, dx, dy, w, h);
  }
};

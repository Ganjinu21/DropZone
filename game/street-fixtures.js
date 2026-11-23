'use strict';

ART.streetFixtures = 'street-fixtures.png';

const StreetFixtures = {
  bounds(id, centerX, baseY, scale = 2) {
    const [, , width, height] = fixtureFrames[id];
    const w = width * scale, h = height * scale;
    return {x: Math.round(centerX-w/2), y: Math.round(baseY-h), w, h};
  },
  draw(ctx, id, centerX, baseY, scale = 2) {
    const [sx, sy, width, height] = fixtureFrames[id];
    const b = this.bounds(id, centerX, baseY, scale);
    ctx.drawImage(art.streetFixtures, sx, sy, width, height, b.x, b.y, b.w, b.h);
  }
};

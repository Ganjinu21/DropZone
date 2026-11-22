'use strict';

// Blocks meet at the same curb cuts so the avenues continue across the map.
const streetBlocks = ['street-market.webp', 'street-service.webp', 'street-transit.webp'];
streetBlocks.forEach((file, i) => { ART['streetBlock' + i] = file; });
ART.printShop = 'shop-print.webp';
ART.electricShop = 'shop-electric.webp';

function drawStreetGround(context, cameraX, cameraY, width, height) {
  const blockWidth = 760;
  const blockHeight = 720;
  const firstX = Math.floor(cameraX / blockWidth);
  const firstY = Math.floor(cameraY / blockHeight);
  const lastX = Math.floor((cameraX + width) / blockWidth);
  const lastY = Math.floor((cameraY + height) / blockHeight);
  for (let y = firstY; y <= lastY; y++) {
    for (let x = firstX; x <= lastX; x++) {
      const seed = (Math.imul(x + 7, 73856093) ^ Math.imul(y + 5, 19349663)) >>> 0;
      context.drawImage(art['streetBlock' + seed % streetBlocks.length], x * blockWidth, y * blockHeight);
    }
  }
}

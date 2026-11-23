'use strict';

// World-space details tied to their source, so they stay in place as the camera pans.
const drawMapAmbience = (() => {
  const gutters = [
    [1002, 844, 0.7], [1581, 858, 3.4], [323, 808, 6.8],
    [2202, 846, 2.2], [1819, 1091, 8.2], [579, 747, 5.1]
  ];
  const leaks = [
    [222, 581, 0.4], [199, 572, 1.3], [271, 588, 2.4]
  ];

  function polygon(g, points, color) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
    g.closePath();
    g.fill();
  }

  function leaflet(g, x, y, t) {
    // Short gust, then a long rest. The return is an eddy beside the curb.
    const phase = (t % 12) / 12;
    const u = Math.min(1, phase / .53);
    const gust = Math.sin(Math.PI * u) ** 2;
    const drift = Math.round(35 * gust);
    const flutter = Math.cos(Math.PI * 4 * u);
    const lift = Math.round(gust * (4 + 7 * Math.abs(flutter)));
    x += drift;
    y -= Math.round(4 * gust);
    g.fillStyle = '#222c303c';
    g.fillRect(x - 4, y + 2, 11, 2);
    g.save();
    g.translate(x, y - lift);
    const h = Math.sign(flutter || 1) * Math.max(1, Math.round(Math.abs(flutter) * 4));
    polygon(g, [[-5, -h], [4, -h - 1], [6, 1], [-3, h]], '#b6b09b');
    polygon(g, [[4,-h-1],[6,1],[2,0]], '#7f877c');
    g.fillStyle = '#676c64';
    g.fillRect(-3, -Math.sign(h), 4, 1);
    g.restore();
  }

  function drip(g, x, y, t) {
    const phase = (t % 3.2) / 3.2;
    if (phase < .15) {
      const d = Math.round((phase / .15) ** 2 * 25);
      g.fillStyle = '#b5c9c793';
      g.fillRect(x, y - 26 + d, 1, 3);
    } else if (phase < .59) {
      const p = (phase - .15) / .44;
      g.globalAlpha *= (1 - p) * .6;
      g.strokeStyle = '#c2d4ca';
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(x, y, 1 + 12*p, 1 + 4*p, 0, 0, Math.PI*2);
      g.stroke();
    }
  }

  return function draw(g, floor, view, time, reduced) {
    if (reduced) return;
    const street = floor === 'surface';
    const spots = street ? gutters : leaks;
    for (const [x, y, offset] of spots) {
      if (x < view.x - 48 || x > view.x + view.w + 48 ||
          y < view.y - 32 || y > view.y + view.h + 32) continue;
      g.save();
      if (street) leaflet(g, x, y, time + offset);
      else drip(g, x, y, time + offset);
      g.restore();
    }
  };
})();

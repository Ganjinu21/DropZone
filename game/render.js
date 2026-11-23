'use strict';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let screenShade;
let shadeAspect = 0;

function ellipse(x, y, rx, ry, color, width = 0, start = 0, end = TAU) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, start, end);
  if (width) {
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function line(x1, y1, x2, y2, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function footShadow(x, y, size) {
  ellipse(x + 1, y, size + 2, size * .34, '#121c263a');
  ellipse(x, y, size * .80, size * .19, '#1d242a77');
}

function drawUnit(frame, row, x, y, flip, width = 64, height = 64) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(flip, 1);
  ctx.drawImage(art.combatUnits, frame * 64, row * 64, 64, 64,
    -Math.round(width / 2), -Math.round(height * 60 / 64), width, height);
  ctx.restore();
}

function drawAimingUnit(m, row, frame, legFrame, x, y, recoil) {
  const hip = 39;
  const lowerStart = hip - 4;
  const upperEnd = hip + 3;
  const pitch = m.aimPitch ?? 0;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(m.flip, 1);
  // Both halves overlap at the belt. Legs keep their independent stride while aiming.
  const walking = legFrame < 4;
  const legX = (legFrame + (walking ? 4 : 0)) * 64;
  const legY = (row + (walking ? 3 : 0)) * 64;
  ctx.drawImage(art.combatUnits, legX, legY + lowerStart, 64, 64 - lowerStart,
    -32, lowerStart - 60, 64, 64 - lowerStart);
  ctx.translate(-recoil, hip - 60);
  ctx.rotate(pitch);
  ctx.drawImage(art.combatUnits, frame * 64, row * 64, 64, upperEnd,
    -32, -hip, 64, upperEnd);
  ctx.restore();
}

function drawCrystal(g) {
  const rare = g.val > 1;
  const phase = run.t * 3.3 + (g.seed ?? (Math.floor(g.x / 20) + Math.floor(g.y / 20))) * 1.93;
  const x = Math.round(g.x), base = Math.round(g.y);
  const y = base - 4 - Math.round(reduceMotion.matches ? 0 : Math.sin(phase) * 1.6);
  const r = rare ? 6 : 4;
  ellipse(x, base + 1, r + 1, 2, '#15272969');
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, -r - 1); ctx.lineTo(r, -2); ctx.lineTo(r, 1);
  ctx.lineTo(0, r + 2); ctx.lineTo(-r, 1); ctx.lineTo(-r, -2); ctx.closePath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = rare ? '#583e28' : '#1a4549';
  ctx.stroke();
  ctx.fillStyle = rare ? '#f2bc64' : '#6cd2c3';
  ctx.fill();
  ctx.fillStyle = rare ? '#9b633d' : '#328c88';
  ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, -1); ctx.lineTo(0, r + 1); ctx.fill();
  ctx.fillStyle = rare ? '#fff3c1' : '#d7fff0';
  ctx.fillRect(-2, -r + 1, 2, 2);
  if (rare && Math.sin(phase) > .48) {
    ctx.fillRect(r - 2, -r - 4, 1, 5);
    ctx.fillRect(r - 4, -r - 2, 5, 1);
  }
  ctx.restore();
}

function leaderChevron(x, y) {
  x = Math.round(x); y = Math.round(y);
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(-5, -4); ctx.lineTo(0, -2); ctx.lineTo(5, -4);
  ctx.lineTo(5, 0); ctx.lineTo(0, 3); ctx.lineTo(-5, 0); ctx.closePath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#3b3128'; ctx.stroke();
  ctx.fillStyle = '#ffce75'; ctx.fill();
  ctx.fillStyle = '#fff3c6'; ctx.fillRect(-4, -3, 2, 1); ctx.fillRect(2, -3, 2, 1);
  ctx.restore();
}

function drawHero(m) {
  const moving = m.moving ?? run.moving;
  const gait = (m.gait ?? run.walk * 7.5) / 30 + m.id * .31;
  const firing = m.shoot > 0;
  const stroke = Math.sin(gait * TAU);
  const shotPhase = clamp((.22 - m.shoot) / .22, 0, 1);
  const strideFrame = Math.floor(gait * 4) % 4;
  const frame = firing ? 4 + Math.min(3, Math.floor(shotPhase * 4)) :
    moving ? strideFrame : 0;
  const motion = !reduceMotion.matches;
  const recoil = firing && motion ? (1 - shotPhase) ** 2 * (m.id === 2 ? 3.2 : 1.8) : 0;
  const sway = moving && motion ? stroke * .8 : 0;
  const lift = !motion ? 0 : moving ? Math.abs(stroke) * 1.7 : (1 + Math.sin(run.t * 2.6 + m.id * 2)) * .5;
  const lead = m.id === run.lead;
  footShadow(m.x, m.y, 12);
  if (lead) {
    ellipse(m.x, m.y, 17, 5, '#342d25aa', 3, .04, 3.10);
    ellipse(m.x, m.y, 17, 5, '#edbf68', 1.5, .07, 3.07);
  }
  if (moving && motion && m.moveSpeed > 40) {
    const step = (gait % .5) * 2;
    const side = Math.floor(gait * 2) % 2 ? 1 : -1;
    const x = m.x - run.dx * (3 + step * 7) - run.dy * side * 4;
    const y = m.y - run.dy * (3 + step * 7) + run.dx * side * 3;
    ctx.globalAlpha = (1 - step) * .4;
    ellipse(x, y, 2 + step * 3, 1 + step, '#b3a08a');
    ctx.globalAlpha = 1;
  }
  const impact = m.hurt > .60;
  const row = m.id + (impact ? 6 : 0);
  if (firing) {
    drawAimingUnit(m, row, frame, moving ? strideFrame : frame, m.x + sway, m.y - lift, recoil);
  } else {
    drawUnit(frame, row, m.x + sway, m.y - lift, m.flip);
  }
  if (lead) leaderChevron(m.x, m.y - [57, 55, 55][m.id] - lift);
}

function drawEnemy(e) {
  const heavy = e.type === 2;
  const cadence = [5.4, 8.5, 3.9][e.type];
  const phase = run.t * cadence + e.phase;
  const frame = Math.floor(phase) % 4;
  const lift = reduceMotion.matches ? 0 : Math.abs(Math.sin(phase * Math.PI / 2)) * (heavy ? .65 : 1.1);
  footShadow(e.x, e.y, heavy ? 12 : 7.5);
  drawUnit(frame, 3 + e.type + (e.hit > .052 ? 6 : 0), e.x, e.y - lift, e.flip);
  if (run.mark === e && run.lead === 2) {
    const y = e.y - [18, 17, 25][e.type];
    const spread = 9 + Math.round(Math.sin(run.t * 5));
    for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
      const x0 = Math.round(e.x) + dx * spread, y0 = Math.round(y) + dy * spread;
      line(x0, y0, x0 - dx * 4, y0, '#fcce7c', 2);
      line(x0, y0, x0, y0 - dy * 4, '#fcce7c', 2);
    }
  }
  if (heavy && e.hp < e.max) {
    const x = Math.round(e.x) - 10, y = Math.round(e.y) - 51;
    ctx.fillStyle = '#302b2c'; ctx.fillRect(x, y, 20, 4);
    ctx.fillStyle = '#da926a'; ctx.fillRect(x + 1, y + 1, Math.ceil(18 * Math.max(0, e.hp) / e.max), 2);
  }
}

function drawTracer(mark) {
  const t = clamp(mark.age / (mark.duration ?? .085), 0, 1);
  const dx = mark.tx - mark.x, dy = mark.ty - mark.y;
  const id = mark.id ?? mark.operator ?? (mark.sniper ? 2 : 1);
  const head = .60 + .40 * Math.min(1, t * 4);
  const tail = Math.max(0, t * .93 - .06);
  const x1 = mark.x + dx * tail, y1 = mark.y + dy * tail;
  const x2 = mark.x + dx * head, y2 = mark.y + dy * head;
  const color = id === 2 ? '#a1e9e5' : id === 0 ? '#ffd793' : '#ffb369';
  ctx.globalAlpha = (1 - t) * .32;
  line(x1, y1, x2, y2, color, id === 2 ? 4.5 : 3);
  ctx.globalAlpha = (1 - t) * .95;
  line(x1, y1, x2, y2, color, id === 2 ? 1.65 : 1.2);
  const glint = Math.max(tail, head - .12);
  line(mark.x + dx * glint, mark.y + dy * glint, x2, y2, '#fffae4', id === 2 ? 2 : 1.6);
  ctx.globalAlpha = 1;
}

function drawEffect(e) {
  const t = clamp(e.age / e.duration, 0, 1), frame = Math.min(5, Math.floor(t * 6));
  const id = e.id ?? e.operator ?? 1;
  const angle = Number.isFinite(e.angle) ? e.angle : (e.dir < 0 ? Math.PI : 0);
  ctx.save();
  ctx.translate(Math.round(e.x), Math.round(e.y));
  if (e.row === 0) {
    const w = Math.max(22, e.w) * (id === 2 ? 1.65 : 1.16), h = w * .54;
    ctx.rotate(angle);
    ctx.drawImage(art.fx, frame * 128, 0, 128, 72, -w * .28, -h * .50, w, h);
  } else {
    const w = e.w * (e.row === 2 ? 1.6 : 1);
    if (e.row === 2) ctx.scale(Math.cos(angle) < 0 ? -1 : 1, 1);
    const h = w * .56;
    ctx.drawImage(art.fx, frame * 128, e.row * 72, 128, 72, -w * .36, -h * .77, w, h);
  }
  ctx.restore();
}

function drawDown(cue, t) {
  const id = cue.id, size = id === 2 ? 1.4 : 1;
  const dx = Math.cos(cue.angle || 0);
  if (t < .70) {
    const p = t / .70;
    ctx.globalAlpha = (1 - p) * .83;
    const flip = cue.flip || (dx > 0 ? -1 : 1);
    drawUnit(2, 3 + id, cue.x + dx * p * 6, cue.y, flip, 64 + p * 4, 64 - p * 35);
  }
  ctx.globalAlpha = (1 - t) * .65;
  const frame = Math.min(5, Math.floor(t * 6));
  const w = (18 + t * 12) * size;
  ctx.drawImage(art.fx, frame * 128, 2 * 72, 128, 72, cue.x - w * .36, cue.y - w * .42, w, w * .56);
  ctx.globalAlpha = 1;
}

function drawGroundCue(cue) {
  const t = clamp(cue.age / cue.duration, 0, 1);
  if (cue.kind === 'down') { drawDown(cue, t); return; }
  if (cue.kind !== 'guard' && cue.kind !== 'swap') return;
  const guard = cue.kind === 'guard';
  const member = run.squad[cue.id];
  const x = guard ? cue.x : member.x, y = guard ? cue.y : member.y;
  const r = guard ? 7 + (cue.size - 7) * (1 - (1 - t) ** 2) : 12 + 20 * t;
  const flatten = guard ? .63 : .39;
  const ink = guard ? '#b3eee1' : '#ffd184';
  ctx.globalAlpha = (1 - t) * .15;
  ellipse(x, y, r, r * flatten, ink);
  ctx.globalAlpha = (1 - t) * .90;
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + .12 + (guard ? 0 : t * .4);
    ellipse(x, y, r, r * flatten, ink, 2 - t, a, a + 1.22);
  }
  ctx.globalAlpha = 1;
}

function drawAirCue(cue) {
  const t = clamp(cue.age / cue.duration, 0, 1);
  if (cue.kind === 'guard') {
    const angle = cue.angle || 0;
    ctx.globalAlpha = (1 - t) * .83;
    for (let i = 0; i < 4; i++) {
      const a = angle + (i - 1.5) * .33, r = 15 + t * 10;
      const x = cue.x + Math.cos(a) * r, y = cue.y - 10 + Math.sin(a) * r * .56;
      line(x, y, x, y - 5 - 7 * Math.sin((i + 1) * Math.PI / 5), '#cbf8e8', 2);
    }
  } else if (cue.kind === 'hurt') {
    const m = run.squad[cue.id];
    ctx.globalAlpha = (1 - t) * .85;
    const r = 12 + t * 10;
    ellipse(m.x, m.y - 17, r, r, '#fc9578', 2, 3.4, 4.42);
    ellipse(m.x, m.y - 17, r, r, '#fc9578', 2, .25, 1.15);
  } else if (cue.kind === 'pickup' || cue.kind === 'equip') {
    const equip = cue.kind === 'equip';
    const x = equip ? run.squad[cue.id].x : cue.x;
    const y = (equip ? run.squad[cue.id].y : cue.y) - 5;
    const count = equip ? 7 : 3;
    ctx.globalAlpha = (1 - t) * .83;
    ctx.fillStyle = equip ? '#ffda8d' : '#a9eddc';
    for (let i = 0; i < count; i++) {
      const a = TAU * i / count + .4, r = (equip ? 12 : 6) * (1 + t * .65);
      ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * .5 - 13 * t), 2, 2 + 2 * (1 - t));
    }
  }
  ctx.globalAlpha = 1;
}

function drawShell(m) {
  if (m.lastShot == null || reduceMotion.matches) return;
  const age = run.t - m.lastShot;
  if (age < 0 || age > .33) return;
  const t = age / .33;
  const x = (m.shellX ?? m.x) - (m.shellFlip ?? m.flip) * (4 + t * 14);
  const y = (m.shellY ?? m.y) - 26 - Math.sin(t * Math.PI) * 7 + t * t * 22;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate((m.shellFlip ?? m.flip) * t * 5);
  ctx.fillStyle = '#674a31'; ctx.fillRect(-2, -1, 5, 3);
  ctx.fillStyle = '#f4c674'; ctx.fillRect(-1, -1, 3, 1);
  ctx.restore();
}

function drawScreenShade() {
  if (shadeAspect !== viewW || !screenShade) {
    shadeAspect = viewW;
    screenShade = document.createElement('canvas');
    screenShade.width = 192; screenShade.height = Math.max(1, Math.round(192 * viewH / viewW));
    const brush = screenShade.getContext('2d'), w = screenShade.width, h = screenShade.height;
    brush.scale(w, h);
    const shade = brush.createRadialGradient(.5, .51, .16, .5, .51, .73);
    shade.addColorStop(0, 'rgba(12,21,26,0)'); shade.addColorStop(.68, 'rgba(12,21,26,.05)');
    shade.addColorStop(1, 'rgba(12,21,26,.21)'); brush.fillStyle = shade; brush.fillRect(0, 0, 1, 1);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(screenShade, 0, 0, viewW, viewH);
  ctx.imageSmoothingEnabled = false;
}

function drawStick() {
  if (!stick || mode !== 'play') return;
  const x = stick.x * viewW / innerWidth, y = stick.y * viewH / innerHeight;
  const l = Math.max(1, Math.hypot(stick.dx, stick.dy)), r = 34;
  ellipse(x, y, r, r, '#121e2699');
  for (let i = 0; i < 4; i++) ellipse(x, y, r, r, '#d5dfd7a0', 2, i * Math.PI / 2 + .12, (i + 1) * Math.PI / 2 - .12);
  const tx = x + stick.dx / l * 25, ty = y + stick.dy / l * 25;
  ellipse(tx, ty, 11, 11, '#f2e0aaac');
  ellipse(tx, ty, 11, 11, '#f9ebc580', 1);
}

function render() {
  if (!run || mode === 'home') return;
  const map=cityMaps[run.floor];
  const cx = Math.round(clamp(run.camera.x - viewW / 2, 0, Math.max(0, map.bounds.w - viewW)));
  const cy = Math.round(clamp(run.camera.y - viewH / 2, 0, Math.max(0, map.bounds.h - viewH)));
  const visible = (x, y, padding = 80) => x >= cx - padding && x <= cx + viewW + padding &&
    y >= cy - padding && y <= cy + viewH + padding;
  const cues = run.cues || [];
  ctx.setTransform(1, 0, 0, 1, -cx, -cy);
  ctx.fillStyle='#172027';
  ctx.fillRect(cx,cy,viewW,viewH);
  ctx.save();
  const view={x:cx,y:cy,w:viewW,h:viewH};
  map.draw(ctx,view);
  drawMapAmbience(ctx,run.floor,view,run.t,reduceMotion.matches);
  ctx.restore();
  for (const g of run.crystals) if (visible(g.x, g.y, 12)) drawCrystal(g);
  for (const cue of cues) if (visible(cue.x, cue.y)) drawGroundCue(cue);
  const actors = [];
  for (const o of run.enemies) if (visible(o.x, o.y)) actors.push({ o, draw: drawEnemy });
  for (const o of run.squad) if (o.hp > 0) actors.push({ o, draw: drawHero });
  actors.sort((a, b) => a.o.y - b.o.y);
  for (const { o, draw } of actors) draw(o);
  for (const mark of run.marks) drawTracer(mark);
  for (const e of run.effects) if (visible(e.x, e.y)) drawEffect(e);
  for (const m of run.squad) if (m.hp > 0) drawShell(m);
  for (const cue of cues) if (visible(cue.x, cue.y)) drawAirCue(cue);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawScreenShade();
  drawStick();
}

function tick(now) {
  const dt = last ? Math.min(.04, (now - last) / 1000) : 0;
  last = now;
  if (mode === 'play') update(dt);
  if (mode !== 'home') render();
  requestAnimationFrame(tick);
}

Promise.all(Object.entries({ ...ART, combatUnits: 'combat-units.png' }).map(([id, url]) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { art[id] = img; resolve(); };
    img.onerror = reject;
    img.src = url;
  }))).then(() => {
    makeMap();
    $('home').style.backgroundImage = 'linear-gradient(90deg,rgba(9,19,26,.86),rgba(12,21,27,.42) 45%,transparent 70%),url(' + ART.lobby + ')';
    $('start').disabled = false;
    $('start').textContent = '작전 개시';
    requestAnimationFrame(tick);
  }).catch(() => { $('start').textContent = '에셋을 불러오지 못했습니다'; });

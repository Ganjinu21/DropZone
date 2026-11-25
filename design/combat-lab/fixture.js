// Loaded only by the local workbench server, after the game's scripts.
(() => {
  const original = {update, updateEncounter, shoot, updateRadioSupport, drawEffect,
    drawSkillGround, fireSupport, damageEnemy};
  let settings, paused = false, singleShot = false;
  const palette = [
    ['#fff1c3','#e28f4e'], ['#fff2d4','#ff7755'], ['#ecffff','#79dbea'],
    ['#fff0c2','#ff9b4f'], ['#fff6bc','#e3bc5d']
  ];

  update = dt => {
    if (settings && !paused) original.update(dt * settings.speed);
  };
  updateEncounter = dt => {
    if (settings.scene === 'live') original.updateEncounter(dt);
  };
  shoot = member => {
    const followThrough = member.weapon.family==='smg' && member.burstIndex>0;
    if (settings.scene === 'live' || ((singleShot || followThrough) && member.id === run.lead)) original.shoot(member);
  };
  updateRadioSupport = dt => {
    if (settings.scene === 'live' || run.cobra) original.updateRadioSupport(dt);
  };
  damageEnemy = (enemy, damage, ...args) => {
    original.damageEnemy(enemy, damage, ...args);
    if (enemy.labTarget) enemy.hp = enemy.max;
  };
  fireSupport = (source, enemy, damage, awakened) => {
    const index = run.effects.length;
    original.fireSupport(source, enemy, damage, awakened);
    const tracer = run.effects[index];
    if (tracer?.clip === 'support_tracer' && (source === run.cobra || awakened)) tracer.labCobra = true;
  };
  // Keep external workbench buttons usable without triggering the game's blur pause.
  window.removeEventListener('blur', pause);
  window.removeEventListener('pagehide', saveBattleCheckpoint);
  saveBattleCheckpoint = () => {};
  clearBattleCheckpoint = () => {};

  function targets(scene) {
    const leader = run.squad[run.lead], nav = routes[run.floor];
    let direction = 0;
    for (const angle of [0,-Math.PI/2,Math.PI,Math.PI/2]) {
      if (nav.clear(leader.x,leader.y,leader.x+145*Math.cos(angle),leader.y+145*Math.sin(angle),5)) {
        direction=angle; break;
      }
    }
    run.heading=direction;
    const swarm = Array.from({length:12}, (_,i) => [i*TAU/12, 88+(i%3)*22]);
    const layout = scene === 'single' ? [[direction,92]] : scene === 'line' ?
      [[direction,82],[direction,117],[direction,152]] : swarm;
    for (const [angle,distance] of layout) {
      const x=leader.x+Math.cos(angle)*distance, y=leader.y+Math.sin(angle)*distance;
      if (!nav.blocked(x,y,6)) run.enemies.push({x,y,type:0,hp:100000,max:100000,
        speed:0,contactDamage:0,phase:0,hit:0,flip:1,labTarget:true});
    }
    if (scene === 'boss') {
      run.bossPhase=true;
      run.boss=spawn(direction,155,true);
      if (run.boss) Object.assign(run.boss,{stage:1,speed:0,labTarget:true});
      updateHud();
    }
  }

  function reset(next) {
    settings = {...next};
    paused = false;
    const id = settings.crew;
    savedSquad = [id,...names.map((_,i)=>i).filter(i=>i!==id).slice(0,2)];
    start();
    const lead = run.squad[id];
    // Preview the selected operator's skill without changing the saved talent tree.
    run.talents[skillRoutes[id]+'Skill']=true;
    const weapon = equipmentCatalog.find(item=>item.family===weaponFamilies[id] && item.rank===settings.rank);
    const loadout = savedEquipment.map((row,index)=>index===id ? {...row,weapon:weapon.key} : row);
    Object.assign(lead,{weapon,loadout:loadout[id],gear:gearStats(id,loadout)});
    if (settings.scene !== 'live') {
      run.enemies.length=0;
      targets(settings.scene);
    }
    render();
  }

  function accentStreak(x,y,angle,length,width,alpha,colors) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x,y);
    ctx.rotate(angle);
    ctx.fillStyle=colors[1];
    ctx.fillRect(-length*.2,-width*.5,length,width);
    ctx.fillStyle=colors[0];
    ctx.fillRect(0,-.8,length*.6,1.6);
    ctx.restore();
  }

  drawEffect = effect => {
    original.drawEffect(effect);
    const lead = run.squad[run.lead];
    const colors = palette[effect.id ?? run.lead];
    const alpha = Math.max(0,1-effect.age/effect.duration);
    const {x,y,angle=0,clip,skillFx} = effect;
    if (settings.flash && effect.lead && alpha>.55) {
      let tip = null;
      if (clip?.endsWith('_muzzle') && lead.id===effect.id && lead.lastShot===effect.shotTime && run.activeSkill?.id!==0) {
        tip=combatMuzzle(lead,effect.col,true,lead.aimPitch);
      } else if (skillFx==='bunkerFire' || skillFx==='smgFire') {
        tip=effect;
      }
      if(tip) accentStreak(tip.x,tip.y,angle,[13,10,19,17,11][effect.id],5,alpha*.8,colors);
    }
    if (settings.trail && ['railBeam','smgTrail'].includes(skillFx)) {
      const length=Math.hypot(effect.tx-x,effect.ty-y);
      line(x,y,effect.tx,effect.ty,colors[0]+(skillFx==='railBeam'?'80':'44'),Math.min(2,length*.02)*alpha);
    }
    if (settings.trail && effect.labCobra) {
      const a=Math.atan2(effect.ty-y,effect.tx-x);
      accentStreak(effect.tx,effect.ty,a+Math.PI,25,4,alpha,colors);
    }
    if (settings.impact && (effect.lead && ['hit_spark','pierce_exit'].includes(clip) || effect.labCobra)) {
      for (const fan of [-.55,0,.55]) {
        accentStreak(effect.tx??x,effect.ty??y,(effect.labCobra ? Math.atan2(effect.ty-y,effect.tx-x) : angle)+fan,
          5+9*(1-alpha),2,alpha*.75,colors);
      }
    }
  };
  drawSkillGround = effect => {
    original.drawSkillGround(effect);
    if (!settings.impact || effect.skillFx!=='blast' || effect.age>.22) return;
    const progress=effect.age/.22;
    ctx.save();
    ctx.globalAlpha *= .62*(1-progress);
    ctx.strokeStyle=palette[effect.id ?? 3][0];
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.ellipse(effect.x,effect.y,4+(effect.radius||35)*progress,2+(effect.radius||35)*progress*.55,0,0,TAU);
    ctx.stroke();
    ctx.restore();
  };

  window.combatLab = {
    ready:()=>!$('start').disabled, roster:()=>names.slice(), reset,
    configure(next) {settings={...next}; render()},
    basic() {
      if (mode!=='play') return false;
      sound?.resume().catch(()=>{});
      const lead=run.squad[run.lead];
      lead.cool=0;
      singleShot=true;
      try {shoot(lead)} finally {singleShot=false}
      render();
      return lead.cool>.075;
    },
    skill() {
      if (mode!=='play') return false;
      sound?.resume().catch(()=>{});
      run.squad[run.lead].skillReadyAt=run.t;
      const fired=activateSquadSkill();
      render();
      return fired;
    },
    pause() {paused=!paused; return paused},
    step() {
      paused=true;
      if (mode==='play') original.update(1/60);
      render();
    },
    status:()=>({mode, paused, time:run.t, effects:run.effects.length, rounds:run.marks.length, enemies:run.enemies.length})
  };
})();

'use strict';

// Sectors run clockwise from the top. Bridges occupy a half-sector between two open routes.
const TalentTree = (() => {
  const routes = [
    {id:'bulk', name:'벌크', theme:'생존', operator:0},
    {id:'cct', name:'CCT', theme:'지휘', operator:4},
    {id:'raven', name:'레이븐', theme:'연사', operator:1},
    {id:'rocket', name:'해머', theme:'화력', operator:3},
    {id:'lynx', name:'링스', theme:'탄약', operator:2},
    {id:'classified', name:'미공개', theme:'기밀', operator:null}
  ].map((route, sector) => ({...route, shortName:route.name, sector}));

  routes.push({id:'command',name:'분대 지휘',shortName:'지휘',theme:'출격',sector:0});
  const branches=routes.filter(r=>r.operator!=null);
  const nodes = [];
  const byId = new Map();
  const effectKeys = {
    hpBonus:0, moveBonus:0, fireRateBonus:0, damageBonus:0, reloadBonus:0,
    reduction:0, critBonus:0, cooldownReduction:0, ammoSaveChance:0,
    twinPower:0, bossDamageBonus:0, healOnLevel:0, xpOnLevel:0, rerolls:0,
    bulkCap:false, cctCap:false, ravenCap:false, rocketCap:false, lynxCap:false
  };
  const steps = [
    {kind:'stat', currency:'diamonds', costs:[60,100,160]},
    {kind:'perk', currency:'bossTokens', costs:[2]},
    {kind:'stat', currency:'diamonds', costs:[200]},
    {kind:'capstone', currency:'bossTokens', costs:[4]}
  ];
  function add(node) {
    byId.set(node.id, node);
    nodes.push(node);
  }
  function trainedStat(name, label, key, points) {
    const effects = [1,2,3].map(rank => label + ' +' + points * rank + '%');
    return {name, description:'단계당 분대 ' + label + ' +' + points + '% (최대 +' + points*3 + '%)', effects, key, value:points/100};
  }
  function benefit(name, description, effect, key, value) {
    return {name, description, effects:[effect], key, value};
  }
  function branch(route, entries) {
    entries.forEach((entry, i) => {
      const id = route.id + '-' + (i + 1);
      const requires = i === 0 ? [{id:'command',rank:1}] : [{id:route.id + '-' + i, rank:steps[i-1].costs.length}];
      add({id, route:route.id, sector:route.sector, depth:i+1, ...steps[i], ...entry, requires});
    });
  }
  add({id:'command',route:'command',sector:0,depth:0,kind:'perk',currency:'diamonds',costs:[0],requires:[],
    ...benefit('출격 브리핑','새 작전을 시작할 때 증강 카드 세 장 중 하나를 선택합니다.','출격 증강 1회','opening',true)});
  branch(routes[0], [
    trainedStat('기초 체력','최대 체력','hpBonus',10),
    benefit('야전 처치','레벨업할 때 생존한 분대원과 지원병이 최대 체력의 10%를 회복합니다.','레벨업 회복 10%','healOnLevel',.10),
    benefit('충격 흡수','분대가 받는 피해를 5% 줄입니다.','받는 피해 −5%','reduction',.05),
    benefit('메카 동기화','벙커를 연구한 벌크가 모든 등급의 권총으로 메카를 전개합니다. 메카 내구도가 25% 증가합니다.','메카 조기 각성 · 내구도 +25%','bulkCap',true)
  ]);
  branch(routes[1], [
    trainedStat('기동 훈련','이동 속도','moveBonus',4),
    benefit('호출 단축','분대 특수 스킬의 재사용 대기시간이 10% 줄어듭니다.','특수 스킬 대기시간 −10%','cooldownReduction',.10),
    benefit('신속 전개','분대의 이동 속도가 5% 추가로 증가합니다.','이동 속도 +5%','moveBonus',.05),
    benefit('체공 연장','CCT의 코브라와 A-10 공중지원이 3초 더 지속됩니다.','공중지원 지속 +3초','cctCap',true)
  ]);
  branch(routes[2], [
    trainedStat('속사 훈련','기본 공격 속도','fireRateBonus',4),
    benefit('이중 사격','분대원이 기본 공격할 때마다 원래 위력의 30%인 추가탄을 한 발 발사합니다. 추가탄은 탄약을 소모하지 않으며, 소환 대원과 특수 공격에는 적용되지 않습니다.','기본 사격마다 추가탄 1발 · 위력 30%','twinPower',.30),
    benefit('연사 제어','분대원의 기본 공격 속도가 8% 추가로 증가합니다.','기본 공격 속도 +8%','fireRateBonus',.08),
    benefit('지속 난사','레이븐의 난사는 3초간 지속됩니다. 일반 난사의 재사용 대기시간과 삼중 난사의 충전 시간이 각각 1초 줄어듭니다.','난사 대기·충전 시간 −1초','ravenCap',true)
  ]);
  branch(routes[3], [
    trainedStat('탄두 개량','공격 피해','damageBonus',5),
    benefit('중장갑 파쇄','분대가 보스에게 주는 피해가 12% 증가합니다.','보스 피해 +12%','bossDamageBonus',.12),
    benefit('장약 개량','분대 공격 피해가 8% 추가로 증가합니다.','공격 피해 +8%','damageBonus',.08),
    benefit('집중 포화','해머의 박격포와 다연장 공성포 특수 공격 피해가 25% 증가합니다.','해머 특수 피해 +25%','rocketCap',true)
  ]);
  branch(routes[4], [
    trainedStat('탄창 교환','재장전 속도','reloadBonus',5),
    benefit('탄약 보존','분대원은 기본 사격 시 15% 확률로 탄약을 소모하지 않습니다.','탄약 보존 확률 15%','ammoSaveChance',.15),
    benefit('정밀 조준','분대의 치명타 확률이 5%p 증가합니다.','치명타 확률 +5%p','critBonus',.05),
    benefit('표적 제거','링스의 기본 공격과 특수 공격이 보스에게 주는 피해가 25% 증가합니다.','링스의 보스 피해 +25%','lynxCap',true)
  ]);
  add({id:'classified-1', route:'classified', sector:5, depth:1, kind:'sealed', name:'기밀 연구',
    description:'미공개 대원 전용 경로입니다.', effects:[], currency:null, costs:[], requires:[]});
  function bridge(left,right,entry) {
    add({id:'link-'+left.id+'-'+right.id, route:'shared', depth:2.5, sector:(left.sector+right.sector)/2,
      kind:'bridge', currency:'bossTokens', costs:[1],
      requires:[{id:left.id+'-2',rank:1},{id:right.id+'-2',rank:1}], ...entry});
  }
  bridge(routes[0],routes[1],benefit('합동 작전회의','작전당 한 번, 레벨업 증강 카드를 다시 뽑을 수 있습니다.','작전당 증강 리롤 1회','rerolls',1));
  bridge(routes[1],routes[2],benefit('전과 분석','레벨업 때 다음 레벨 경험치 10을 추가로 받습니다.','레벨업 경험치 +10','xpOnLevel',10));
  bridge(routes[2],routes[3],benefit('화력 조율','분대 기본 공격 속도가 5% 추가로 증가합니다.','기본 공격 속도 +5%','fireRateBonus',.05));
  bridge(routes[3],routes[4],benefit('약점 공유','분대가 보스에게 주는 피해가 8% 추가로 증가합니다.','보스 피해 +8%','bossDamageBonus',.08));

  const doctrines=[
    ['벙커 전개','보강 프레임','hpBonus',.05,'최대 체력 +5%','장갑 보강','reduction',.03,'받는 피해 −3%'],
    ['코브라 공중지원','기동 지휘','moveBonus',.03,'이동속도 +3%','교신 최적화','cooldownReduction',.04,'스킬 대기시간 −4%'],
    ['쌍기관단총 난사','속사 숙련','fireRateBonus',.04,'공격속도 +4%','교차 사격','damageBonus',.04,'피해 +4%'],
    ['박격포 포격','화력 훈련','damageBonus',.04,'피해 +4%','집중 타격','bossDamageBonus',.06,'보스 피해 +6%'],
    ['관통 사격','장전 숙련','reloadBonus',.04,'재장전 속도 +4%','탄약 회수','ammoSaveChance',.04,'탄약 보존 +4%p']
  ];
  for(const [i,r] of branches.entries()){
    const [skill,stat,key,value,effect,perk,pkey,pvalue,peffect]=doctrines[i];
    add({id:r.id+'-skill',route:r.id,sector:r.sector+.38,depth:1.5,kind:'perk',currency:'bossTokens',costs:[1],
      requires:[{id:r.id+'-1',rank:1}],...benefit(skill,'무기 등급에 관계없이 '+r.name+'의 '+skill+' 특수 공격을 해금합니다.','특수 공격 해금',r.id+'Skill',true)});
    add({id:r.id+'-5',route:r.id,sector:r.sector,depth:5,kind:'stat',currency:'diamonds',costs:[180,260],
      requires:[{id:r.id+'-4',rank:1}],...benefit(stat,'단계당 분대 '+effect,effect,key,value),effects:[effect,'2단계 · '+effect+' × 2']});
    add({id:r.id+'-6',route:r.id,sector:r.sector,depth:6,kind:'perk',currency:'bossTokens',costs:[3],
      requires:[{id:r.id+'-5',rank:2}],...benefit(perk,'분대 '+peffect,peffect,pkey,pvalue)});
  }
  function visible(id,state=armory){
    const n=byId.get(id);
    return n && n.kind!=='sealed' && n.requires.every(req=>(state.talentRanks[req.id]||0)>=req.rank);
  }
  function restoreRanks(raw) {
    const ranks = {};
    if(raw && !raw.command && branches.some(r=>raw[r.id+'-1']>0))ranks.command=1;
    for (const node of nodes) {
      const rank = raw?.[node.id];
      if (!Number.isSafeInteger(rank) || rank<=0 || !node.costs.length) continue;
      if (node.requires.every(req => (ranks[req.id] || 0) >= req.rank)) {
        ranks[node.id] = Math.min(rank,node.costs.length);
      }
    }
    return ranks;
  }
  function status(id,state=armory) {
    const node = byId.get(id);
    const rank = node ? state.talentRanks[id] || 0 : 0;
    const maxRank = node?.costs.length || 0;
    const cost = node?.costs[rank] ?? null;
    const currency = node?.currency ?? null;
    const missing = (node?.requires || []).filter(req => (state.talentRanks[req.id] || 0)<req.rank);
    let reason = '';
    if (!node || node.kind==='sealed') reason='미공개 경로';
    else if (rank>=maxRank) reason='연구 완료';
    else if (missing.length) reason='선행 연구 필요';
    else if (state[currency]<cost) reason=(currency==='diamonds'?'다이아 ':'보스 토큰 ')+(cost-state[currency])+'개 부족';
    return {rank,maxRank,cost,currency,missing,canBuy:!reason,reason};
  }
  function effects(raw) {
    const result = {...effectKeys};
    for (const [id,rank] of Object.entries(restoreRanks(raw))) {
      const node = byId.get(id);
      if (typeof node.value==='boolean') result[node.key]=true;
      else result[node.key]+=node.value*rank;
    }
    return result;
  }
  const maxRanks=Object.freeze(Object.fromEntries(
    nodes.filter(node=>node.costs.length>0).map(node=>[node.id,node.costs.length])
  ));
  return {routes,nodes,byId,visible,restoreRanks,status,effects,maxRanks};
})();

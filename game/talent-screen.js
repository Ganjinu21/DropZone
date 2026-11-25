'use strict';

const talentScreen = (() => {
  const palette = {
    bulk:'#cfb47d', cct:'#83b6ac', raven:'#bd969c', rocket:'#c7967b',
    lynx:'#95abbc', classified:'#828f88', command:'#dcc596', shared:'#bfba98'
  };
  const portraits = {bulk:'bulk', cct:'cct', raven:'raven', rocket:'hammer', lynx:'lynx'};
  const routeGlyph = {bulk:'heart',cct:'radio',raven:'burst',rocket:'blast',lynx:'rounds',classified:'lock',shared:'link'};
  const kindName = {stat:'기본 능력',perk:'보스 특전',capstone:'최종 특전',bridge:'연계 특전',sealed:'미공개'};
  const currencyName = {diamonds:'다이아', bossTokens:'보스 토큰'};
  const paths = {
    diamond:'M4 3h8l3 4-7 7-7-7zm1.3 2L3.8 7h3l.4-2zm3.5 0 .4 2h3L11 5z',
    token:'M5 1h6v1h2v2h2v8h-2v2h-2v1H5v-1H3v-2H1V4h2V2h2zm.5 4v4H7V7h2v2h1.5V5zM6 11v1h4v-1z',
    heart:'M2 3h4v1h1v1h2V4h1V3h4v1h1v5h-1v1h-1v1h-1v1h-1v1h-1v1H6v-1H5v-1H4v-1H3v-1H2V9H1V4h1z',
    radio:'M7 6h2v2H7zm0 3h2v2h1v2h2v1H4v-1h2v-2h1zM4 4h2v1H5v4H4V8H3V5h1zm6 0h2v1h1v3h-1v1h-1V5h-1zM2 2h2v1H3v1H2v6h1v1H1V9H0V5h1V3h1zm10 0h2v1h1v2h1v4h-1v2h-2v-1h1V4h-1V3h-1z',
    burst:'M1 3h7v2h4V3h3v4H6v2H3V7H1zm0 8h10V9h4v4H5v2H3v-2H1z',
    blast:'M10 1h5v5l-5 5-2-1-2 2-2-2 2-2-1-2zm1 2-2 2 2 2 2-2zM1 12h2v1h1v2H1zm4 1h2v2H5z',
    rounds:'M3 2h1v1h1v9H2V3h1zm4-1h1v1h1v10H6V2h1zm4 2h1v1h1v8h-3V4h1zM1 13h13v2H1z',
    chevron:'M1 4h3v1h3v1h2V5h3V4h3v3h-3v1H9v1H7V8H4V7H1zm0 5h3v1h3v1h2v-1h3V9h3v3h-3v1H9v1H7v-1H4v-1H1z',
    link:'M3 2h6v2H4v4h2v2H3V9H2V3h1zm4 4h2v4H7zm3 0h3v1h1v6h-1v1H7v-2h5V8h-2z',
    lock:'M5 1h6v1h1v4h2v8H2V6h2V2h1zm1 2v3h4V3zm1 6v3h2V9z',
    squad:'M7 1h2v2h2v2h-1v2H6V5H5V3h2zm-4 6h1v1h2v3H2V8h1zm9 0h1v1h1v3h-4V8h2zM6 9h4v2h1v3H5v-3h1zM2 12h2v2H1v-1h1zm10 0h2v1h1v1h-3z'
  };
  const views = new Map();
  let nodes, routes, board, edges, selected = 'command', busy = false, lastNote = '';
  const root = () => document.getElementById('talent-page');
  const el = id => document.getElementById('talent-'+id);
  function svg(tag,attrs,parent) {
    const element = document.createElementNS('http://www.w3.org/2000/svg',tag);
    for(const [key,value] of Object.entries(attrs))element.setAttribute(key,value);
    if(parent)parent.append(element);
    return element;
  }
  function icon(id) {
    return '<svg class="talent-icon" aria-hidden="true" viewBox="0 0 16 16"><use href="#talent-glyph-'+id+'"></use></svg>';
  }
  function polar(radius,sector){
    const angle=(sector-1.5)*Math.PI/3;
    return [Math.cos(angle)*radius, Math.sin(angle)*radius];
  }
  function hex(radius){
    return Array.from({length:6},(_,n)=>polar(radius,n+.5).map(v=>v.toFixed(1)).join(',')).join(' ');
  }
  function nodePosition(n){
    if(n.id==='command')return [0,0];
    if(n.depth===1.5)return polar(53,n.sector);
    if(n.kind==='sealed')return polar(129,n.sector);
    return polar(n.kind==='bridge'?81:[0,34,69,104,140,188,225][n.depth],n.sector);
  }
  function stageGlyph(n){
    if(n.id==='command')return 'squad';
    if(n.kind==='sealed')return 'lock';
    if(n.kind==='bridge')return 'link';
    if(n.kind==='perk')return 'token';
    return n.depth===3?'chevron':routeGlyph[n.route];
  }
  function glyph(parent,id,size){
    return svg('use',{href:'#talent-glyph-'+id,x:-size/2,y:-size/2,width:size,height:size,'aria-hidden':'true'},parent);
  }
  function mount(){
    nodes=new Map(TalentTree.nodes.map(n=>[n.id,n]));
    routes=new Map(TalentTree.routes.map(r=>[r.id,r]));
    root().innerHTML='<div class="talent-wrap"><header class="talent-heading"><h2>분대 스킬트리</h2><button type="button" class="talent-wallets" id="talent-help" aria-label="보유 재화와 훈련 안내" aria-controls="talent-guide" aria-expanded="false"><span>'+icon('diamond')+'<b id="talent-diamonds"></b></span><span>'+icon('token')+'<b id="talent-tokens"></b></span></button></header>'+
      '<aside id="talent-guide" hidden><p><b>다이아</b>분대 기본 능력치를 강화합니다.</p><p><b>보스 토큰</b>보스 한 마리 처치 시 1개를 얻습니다. 특전과 최종 특전에 사용합니다.</p><p><b>연계</b>이웃한 두 경로의 보스 특전을 습득하면 연결된 특전을 열 수 있습니다.</p>'+(developerMode?'<small>개발자 프로필에는 첫 도입 시 보스 토큰 8개가 지급됩니다.</small>':'')+'</aside>'+
      '<div class="talent-layout"><section class="talent-board-panel" aria-label="분대 육각 스킬트리"><svg id="talent-board" viewBox="-170 -164 340 328" role="group" aria-label="분대 훈련 경로"></svg><div class="talent-legend"><label>확대 <select id="talent-zoom"><option value="1">1×</option><option value="1.6">1.6×</option><option value="2.3">2.3×</option></select></label><span>'+icon('diamond')+'다이아 · 능력치</span><span>'+icon('token')+'토큰 · 특전</span><span>'+icon('link')+'경로 연계</span></div></section>'+
      '<div class="talent-controls"><section class="talent-detail" aria-labelledby="talent-name"><header><div id="talent-image"></div><div class="talent-identity"><small id="talent-type"></small><h3 id="talent-name"></h3></div><b id="talent-rank"></b></header><p id="talent-description"></p><p id="talent-step" hidden></p><div id="talent-needs" hidden></div><div class="talent-actionrow"><span id="talent-cost"></span><button type="button" id="talent-buy"></button></div><p id="talent-notice" role="status"></p></section>'+
      '<section class="talent-routes" aria-labelledby="talent-route-label"><header><label id="talent-route-label" for="talent-route">경로 탐색</label><select id="talent-route"></select></header><div id="talent-list"></div><div id="talent-links" aria-label="다른 경로와 연계"></div></section></div></div></div>';
    board=el('board');el('zoom').onchange=paint;
    const defs=svg('defs',{},board);
    for(const [id,d] of Object.entries(paths)){
      const symbol=svg('symbol',{id:'talent-glyph-'+id,viewBox:'0 0 16 16'},defs);
      svg('path',{d,fill:'currentColor','fill-rule':'evenodd'},symbol);
    }
    const frame=svg('clipPath',{id:'talent-face-clip'},defs);
    svg('polygon',{points:hex(16.5)},frame);
    const guides=svg('g',{'aria-hidden':'true',class:'talent-guides'},board);
    for(const r of [34,69,104,140,188,225])svg('polygon',{points:Array.from({length:6},(_,n)=>polar(r,n).join(',')).join(' ')},guides);
    const lines=svg('g',{'aria-hidden':'true'},board);
    edges=[];
    for(const n of nodes.values()){
      const tip=nodePosition(n);
      const parents=n.requires?.length?n.requires.map(req=>nodes.get(req.id)): [null];
      for(const parent of parents){
        const [x,y]=parent?nodePosition(parent):[0,0];
        const stroke=svg('line',{x1:x,y1:y,x2:tip[0],y2:tip[1],class:'talent-edge'+(n.kind==='bridge'?' is-bridge':'')+(n.kind==='sealed'?' is-secret':'')},lines);
        edges.push({stroke,parent,node:n});
      }
    }

    for(const n of nodes.values()){
      const [x,y]=nodePosition(n), isEnd=n.kind==='capstone'||n.kind==='sealed', rad=isEnd?18:n.kind==='bridge'?10.5:11.5;
      const g=svg('g',{class:'talent-node node-'+n.kind,transform:'translate('+x.toFixed(2)+' '+y.toFixed(2)+')',role:'button',tabindex:'-1','data-talent-node':n.id},board);
      g.style.setProperty('--route-color',palette[n.route]);
      svg('circle',{r:isEnd?22:15.5,class:'talent-hit'},g);
      svg('polygon',{points:hex(rad+3.5),class:'talent-node-ring'},g);
      svg('polygon',{points:hex(rad),class:'talent-node-shell'},g);
      if(n.kind==='capstone'){
        svg('image',{href:'art/armory/portraits/'+portraits[n.route]+'-A.png',x:-16.4,y:-16.4,width:32.8,height:32.8,'clip-path':'url(#talent-face-clip)'},g);
      }else glyph(g,stageGlyph(n),isEnd?15:n.kind==='bridge'?10:12);
      if(isEnd || n.depth===1 && n.route!=='classified'){
        const route=routes.get(n.route), label=svg('text',{x:0,y:y<0?-25:32,'text-anchor':'middle',class:'talent-route-name'},g);
        if(n.depth===1){label.setAttribute('class','talent-route-name early-route');label.setAttribute('x',x>5?15:x< -5?-15:0);label.setAttribute('y',Math.abs(x)>5?1:-17);label.setAttribute('text-anchor',x>5?'start':x< -5?'end':'middle');}
        label.textContent=n.kind==='sealed'?'미공개':route.shortName+' · '+route.theme;
      }
      views.set(n.id,g);
    }
    for(const r of [...routes.values(),{id:'shared',name:'연계 특전'}]){
      const option=document.createElement('option');
      option.value=r.id;
      option.textContent=r.id==='shared'||r.id==='classified'?r.name:r.name+' · '+r.theme;
      el('route').append(option);
    }
    board.addEventListener('click',event=>{
      const node=event.target.closest('[data-talent-node]');
      if(node)select(node.dataset.talentNode);
    });
    board.addEventListener('keydown',event=>{
      const g=event.target.closest('[data-talent-node]');if(!g)return;
      if(event.key==='Enter'||event.key===' '){event.preventDefault();select(g.dataset.talentNode);return}
      const direction={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[event.key];
      if(!direction)return;
      event.preventDefault();event.stopPropagation();
      const origin=nodePosition(nodes.get(g.dataset.talentNode));
      let best=null,min=Infinity;
      for(const node of nodes.values()){
        if(!TalentTree.visible(node.id))continue;
        const [nx,ny]=nodePosition(node),dx=nx-origin[0],dy=ny-origin[1];
        const along=dx*direction[0]+dy*direction[1],across=Math.abs(dx*direction[1]-dy*direction[0]);
        if(along<=1||across>along*1.1)continue;
        const score=along+2*across;
        if(score<min){min=score;best=node;}
      }
      if(best){select(best.id);views.get(best.id).focus()}
    });
    el('route').onchange=()=>{
      const choices=TalentTree.nodes.filter(n=>n.route===el('route').value && TalentTree.visible(n.id));
      const first=choices.find(n=>{const s=TalentTree.status(n.id);return s.canBuy;})||choices[0];
      if(first)select(first.id);
    };
    root().addEventListener('click',event=>{
      const target=event.target.closest('[data-talent-select]');
      if(target)select(target.dataset.talentSelect);
    });
    el('buy').onclick=buy;
    el('help').onclick=()=>{
      el('guide').hidden=!el('guide').hidden;
      el('help').setAttribute('aria-expanded',String(!el('guide').hidden));
    };
  }
  function select(id){
    if(!TalentTree.visible(id))return;
    selected=id;lastNote='';paint();
  }
  async function buy(){
    if(busy)return;
    const id=selected, status=TalentTree.status(id);
    if(!status.canBuy)return;
    busy=true;paint();
    try{
      const result=await purchaseTalent(id,status.rank);
      lastNote=result.message;
    }catch{
      lastNote='저장하지 못했습니다. 다시 시도해 주세요.';
    }finally{
      busy=false;paint();
    }
  }
  function labelForKind(n){
    if(n.route==='shared')return n.requires.map(req=>routes.get(nodes.get(req.id).route).name).join(' × ')+' · 연계 특전';
    const r=routes.get(n.route);
    return r.name+' · '+(n.kind==='sealed'?'기밀':r.theme+' '+kindName[n.kind]);
  }
  function navButton(parent,id,label){
    const link=document.createElement('button');
    link.type='button';link.dataset.talentSelect=id;link.textContent=label;parent.append(link);
    return link;
  }
  function paintList(n){
    const list=el('list');
    {
      list.replaceChildren();list.dataset.route=n.route;
      for(const item of TalentTree.nodes.filter(o=>o.route===n.route && TalentTree.visible(o.id))){
        const entry=navButton(list,item.id,'');
        entry.innerHTML=icon(stageGlyph(item))+'<span></span><small></small>';
        entry.querySelector('span').textContent=item.name;
      }
      const links=el('links');
      links.replaceChildren();
      for(const item of TalentTree.nodes.filter(o=>TalentTree.visible(o.id) && o.kind==='bridge' && o.requires.some(req=>nodes.get(req.id).route===n.route))){
        const other=item.requires.map(req=>nodes.get(req.id).route).find(route=>route!==n.route);
        const entry=navButton(links,item.id,'');
        entry.innerHTML=icon('link')+'<span></span><small></small>';
        entry.querySelector('span').textContent=item.name;
        entry.querySelector('small').textContent=routes.get(other).name+' 연계';
      }
    }
    for(const entry of list.children){
      const id=entry.dataset.talentSelect, item=nodes.get(id), s=TalentTree.status(id);
      entry.setAttribute('aria-pressed',String(id===n.id));
      entry.querySelector('small').textContent=item.kind==='sealed'?'기밀':s.rank+'/'+s.maxRank;
    }
  }
  function paint(){
    if(!TalentTree.visible(selected))selected='command';
    const n=nodes.get(selected), s=TalentTree.status(selected), isSecret=n.kind==='sealed';
    const bought=s.maxRank>0 && s.rank===s.maxRank, missing=s.missing||[];
    const locked=missing.length>0, colors=palette[n.route];
    root().style.setProperty('--active-route',colors);
    el('diamonds').textContent=armory.diamonds.toLocaleString('ko-KR');
    el('tokens').textContent=armory.bossTokens.toLocaleString('ko-KR');
    el('help').setAttribute('aria-label','다이아 '+armory.diamonds+'개, 보스 토큰 '+armory.bossTokens+'개. 훈련 안내');
    for(const opt of el('route').options){
      opt.hidden=!TalentTree.nodes.some(n=>n.route===opt.value && TalentTree.visible(n.id));
      opt.disabled=opt.hidden;
    }
    const radius=Math.max(88,...TalentTree.nodes.filter(n=>TalentTree.visible(n.id)).map(n=>Math.hypot(...nodePosition(n))+38));
    const zoom=Number(el('zoom').value);
    const side=radius/zoom, [centerX,centerY]=zoom>1?nodePosition(n):[0,0];
    board.setAttribute('viewBox',[centerX-side,centerY-side,side*2,side*2].join(' '));
    for(const [id,g] of views){
      const node=nodes.get(id), state=TalentTree.status(id);
      g.style.display=TalentTree.visible(id)?'':'none';
      const early=g.querySelector('.early-route');if(early)early.style.display=TalentTree.visible(node.route+'-2')?'none':'';

      g.classList.toggle('is-bought',state.rank>0);
      g.classList.toggle('is-ready',!state.missing.length && node.kind!=='sealed');
      g.classList.toggle('is-selected',id===selected);
      g.setAttribute('aria-pressed',String(id===selected));
      g.setAttribute('tabindex',id===selected?'0':'-1');
      g.setAttribute('aria-label',labelForKind(node)+' '+node.name+(state.maxRank?' '+state.rank+'/'+state.maxRank:''));
    }
    for(const edge of edges){
      edge.stroke.style.display=TalentTree.visible(edge.node.id)?'':'none';
      edge.stroke.style.setProperty('--route-color',palette[edge.node.route]);
      edge.stroke.classList.toggle('is-lit',edge.parent?TalentTree.status(edge.parent.id).rank>0:edge.node.kind!=='sealed');
    }
    const portrait=portraits[n.route];
    el('image').innerHTML=portrait?'<img src="art/armory/portraits/'+portrait+'-A.png" alt="">':icon(stageGlyph(n));
    el('type').textContent=labelForKind(n);
    el('name').textContent=n.name;
    el('rank').textContent=isSecret?'기밀':s.rank+' / '+s.maxRank;
    const effects=n.effects||[], desc=el('description'), step=el('step');
    desc.textContent=n.description;
    step.hidden=s.maxRank<=1;
    if(!step.hidden)step.textContent=bought?'현재 '+effects[s.rank-1]:'현재 '+(s.rank?effects[s.rank-1]:'미습득')+' → '+effects[s.rank];
    const prereq=el('needs');
    prereq.replaceChildren();prereq.hidden=!locked||isSecret;
    if(!prereq.hidden){
      const prefix=document.createElement('span');prefix.textContent='선행 훈련';prereq.append(prefix);
      for(const req of missing)navButton(prereq,req.id,nodes.get(req.id).name+' '+req.rank+'단계');
    }
    const cost=el('cost'), cur=currencyName[n.currency];
    cost.innerHTML=isSecret||bought?'':icon(n.currency==='diamonds'?'diamond':'token')+'<span></span>';
    if(cost.firstChild)cost.querySelector('span').textContent=cur+' '+s.cost.toLocaleString('ko-KR');
    if(s.cost===0)cost.textContent='무료';
    const button=el('buy');
    button.disabled=busy||!s.canBuy;
    button.textContent=busy?'저장 중':isSecret?'미공개':bought?'훈련 완료':locked?'선행 훈련 필요':!s.canBuy?cur+' 부족':s.rank?'강화하기':'습득하기';
    button.setAttribute('aria-label',n.name+' '+button.textContent);
    el('route').value=n.route;paintList(n);
    el('notice').textContent=lastNote||'';
  }
  function render(){
    if(!root())return;
    if(!board)mount();
    paint();
  }
  window.addEventListener('talents-changed',()=>{if(root()&&!root().hidden)render()});
  return {render};
})();
function renderTalentPage(){talentScreen.render()}

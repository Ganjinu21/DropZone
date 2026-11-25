'use strict';

const lobbyStage = $('lobby-pages');
const lobbyTabs = [...$('hub-nav').querySelectorAll('[data-page]')];
const lobbyPages = lobbyTabs.map(button => $(button.getAttribute('aria-controls')));
const homePageIndex = lobbyPages.indexOf($('main-menu'));
const quietMotion = matchMedia('(prefers-reduced-motion: reduce)');
let lobbyPageIndex = homePageIndex;
let swipe = null;
let swallowSwipeClick = false;
let slideVersion = 0;
let slideAnimations = [];

function settleLobbyPages() {
  slideVersion++;
  for (const animation of slideAnimations) animation.cancel();
  slideAnimations = [];
  for (const [index, page] of lobbyPages.entries()) {
    page.style.transform = '';
    page.hidden = index !== lobbyPageIndex;
    page.inert = page.hidden;
    if (page.hidden) page.setAttribute('aria-hidden','true');
    else page.removeAttribute('aria-hidden');
    if (index === lobbyPageIndex) lobbyTabs[index].setAttribute('aria-current','page');
    else lobbyTabs[index].removeAttribute('aria-current');
  }
}

function prepareLobbyPage(index) {
  const page = lobbyPages[index];
  if (page === $('barracks-page')) renderBarracksPage();
  if (page === $('talent-page')) renderTalentPage();
  if (page === $('shop-page')) updateDiamondDisplay();
}

function slideLobbyPages(from, to, direction, displacement, focus) {
  const width = lobbyStage.clientWidth;
  const commit = from !== to;
  const adjacent = commit ? to : from + direction;
  const version = ++slideVersion;
  const finish = () => {
    if (version === slideVersion) settleLobbyPages();
  };
  const duration = quietMotion.matches ? 0 : 190;
  for (const [index, start, end] of [
    [from, displacement, commit ? direction * width : 0],
    [adjacent, displacement - direction * width, commit ? 0 : -direction * width]
  ]) {
    const page = lobbyPages[index];
    if (!page) continue;
    page.hidden = false;
    page.inert = index !== to;
    if (page.inert) page.setAttribute('aria-hidden','true');
    else page.removeAttribute('aria-hidden');
    page.style.transform = 'translateX(' + end + 'px)';
    if (duration && start !== end) {
      slideAnimations.push(page.animate([
        {transform:'translateX(' + start + 'px)'}, {transform:page.style.transform}
      ], {duration, easing:'cubic-bezier(.21,.72,.28,1)'}));
    }
  }
  if (focus) lobbyTabs[to].focus({preventScroll:true});
  if (slideAnimations.length) Promise.allSettled(slideAnimations.map(a=>a.finished)).then(finish);
  else finish();
}

function showLobbyPage(index, {immediate=false, focus=false}={}) {
  if (!Number.isInteger(index) || !lobbyPages[index]) return;
  if ($('home').querySelector('dialog[open]') || $('replace-run').open) return;
  const from = lobbyPageIndex;
  settleLobbyPages();
  swipe = null;
  lobbyPageIndex = index;
  if (index === from || immediate) {
    settleLobbyPages();
    if (focus) lobbyTabs[index].focus({preventScroll:true});
  } else {
    lobbyTabs[from].removeAttribute('aria-current');
    lobbyTabs[index].setAttribute('aria-current','page');
    slideLobbyPages(from,index,Math.sign(index-from),0,focus);
  }
  if (lobbyPages[index] === $('shop-page')) enterSupplyShop();
  else prepareLobbyPage(index);
}

for (const [index, button] of lobbyTabs.entries()) button.onclick = () => showLobbyPage(index,{focus:true});
$('hub-nav').addEventListener('keydown',event=>{
  const keys = {ArrowRight:1,ArrowLeft:-1};
  if (!(event.key in keys)) return;
  event.preventDefault();
  showLobbyPage(lobbyPageIndex+keys[event.key],{focus:true});
});

lobbyStage.addEventListener('pointerdown',event=>{
  if (!event.isPrimary || event.button !== 0 || document.querySelector('dialog[open]')) return;
  if (event.target.closest('select,input,textarea,[data-no-page-swipe]')) return;
  settleLobbyPages();
  swallowSwipeClick = false;
  swipe = {id:event.pointerId,x:event.clientX,y:event.clientY,dx:0,direction:0};
});

lobbyStage.addEventListener('pointermove',event=>{
  if (event.pointerId !== swipe?.id) return;
  const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
  if (!swipe.direction) {
    if (Math.abs(dy)>10 && Math.abs(dy)>Math.abs(dx)) { swipe=null; return; }
    if (Math.abs(dx)<12 || Math.abs(dx)<1.4*Math.abs(dy)) return;
    const direction=Math.sign(dx), next=lobbyPageIndex+direction;
    if (!lobbyPages[next]) { swipe=null; return; }
    swipe.direction=direction;
    swallowSwipeClick=true;
    lobbyStage.setPointerCapture(event.pointerId);
    lobbyPages[next].hidden=false;
    lobbyPages[next].inert=true;
    prepareLobbyPage(next);
  }
  const direction=swipe.direction, width=lobbyStage.clientWidth;
  swipe.dx=direction*Math.min(width,Math.max(0,dx*direction));
  lobbyPages[lobbyPageIndex].style.transform='translateX('+swipe.dx+'px)';
  lobbyPages[lobbyPageIndex+direction].style.transform='translateX('+(swipe.dx-direction*width)+'px)';
});

function endLobbySwipe(event) {
  if (event.pointerId!==swipe?.id) return;
  const {dx,direction}=swipe;
  swipe=null;
  if (!direction) return;
  const from=lobbyPageIndex;
  if (event.type==='pointerup' && Math.abs(dx)>=Math.min(78,lobbyStage.clientWidth*.17)) lobbyPageIndex+=direction;
  lobbyTabs[from].removeAttribute('aria-current');
  lobbyTabs[lobbyPageIndex].setAttribute('aria-current','page');
  slideLobbyPages(from,lobbyPageIndex,direction,dx,false);
  if (from!==lobbyPageIndex && lobbyPages[lobbyPageIndex]===$('shop-page')) enterSupplyShop();
}
lobbyStage.addEventListener('pointerup',endLobbySwipe);
lobbyStage.addEventListener('pointercancel',endLobbySwipe);
lobbyStage.addEventListener('lostpointercapture',event=>{
  // Touch begins with implicit capture on the child. Taking capture on the
  // page releases that child first and its notification bubbles here.
  if (event.target===lobbyStage) endLobbySwipe(event);
});
lobbyStage.addEventListener('click',event=>{
  if (swallowSwipeClick && event.detail!==0) {
    event.preventDefault();
    event.stopImmediatePropagation();
    swallowSwipeClick=false;
  }
},true);
settleLobbyPages();

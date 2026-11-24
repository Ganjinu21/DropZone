const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const launchSquad = require('./select-test-squad.cjs');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  });
  try {
    const page = await browser.newPage({viewport:{width:780,height:360}, isMobile:true, hasTouch:true});
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0});
    await page.goto(pathToFileURL(path.resolve('game/index.html')).href);
    await page.locator('#shop:enabled').waitFor();
    await page.locator('#select-team:enabled').tap();
    await page.locator('#prep-screen').waitFor();
    assert.equal(await page.locator('[data-inspect]').count(),3);
    await page.locator('[data-slot="shield"]').tap();
    assert.equal(await page.locator('#item-title').textContent(),'초병 방패');
    await page.locator('#item-close').tap();
    assert.equal(await page.locator('[data-item="shield-0"]').count(),1);
    await page.locator('[data-inspect="1"]').tap();
    assert.equal(await page.locator('[data-slot="shield"]').count(),0);
    assert.equal(await page.locator('[data-item="pistol-0"]').count(),0);
    assert.equal(await page.locator('[data-item="smg-0"]').count(),1);
    await page.locator('#change-crew').tap();
    assert.equal(await page.locator('[data-pick]').count(),5);
    await page.locator('[data-pick="1"]').tap();
    assert.ok(await page.locator('#save-team').isDisabled());
    assert.equal(await page.evaluate(()=>window.gameBack()),true);
    assert.equal(await page.evaluate(()=>window.gameBack()),true);
    await page.locator('#select-team').waitFor();
    const ids=[3,2,1];
    await launchSquad(page,ids);
    const buttons=page.locator('#party button');
    assert.deepEqual(await buttons.evaluateAll(nodes=>nodes.map(n=>+n.dataset.i)),ids);
    assert.equal(await page.evaluate(()=>run.lead),3);
    await page.keyboard.press('2');
    assert.equal(await page.evaluate(()=>run.lead),2);
    await page.locator('#pause').tap();
    assert.deepEqual(await page.locator('#loadout [data-operator]').evaluateAll(nodes=>nodes.map(n=>+n.dataset.operator)),ids);
    await page.locator('#resume').tap();
    const partyStatus=await page.evaluate(()=>{
      setLeader(0);
      const afterInvalidTag=run.lead;
      for(const id of run.lineup){run.up[id*2]=3;run.squad[id].gear.evadeChance=0}
      run.up[firepower]=3;
      openUpgrade();
      const offered=offers.slice();
      const upgradeMode=mode;applyUpgrade();
      const enemy={x:run.x,y:run.y,type:0,contactDamage:9999};
      for(const id of run.lineup)hitSquadMember(enemy,run.squad[id],routes[run.floor],9999);
      return {afterInvalidTag,upgradeMode,eligible:offered.length===3 && offered.every(k=>k>=10 || run.lineup.includes(Math.floor(k/2))),result:$('dialog').dataset.state};
    });
    assert.deepEqual(partyStatus,{afterInvalidTag:2,upgradeMode:'upgrade',eligible:true,result:'loss'});
    await page.reload();
    await page.locator('#start:enabled').tap();
    await page.locator('#hud').waitFor();
    assert.deepEqual(await page.evaluate(()=>run.lineup),ids);
    await page.evaluate(()=>localStorage.setItem(squadStorageKey,'[3,3,99]'));
    await page.reload();
    await page.locator('#select-team:enabled').tap();
    await page.locator('#prep-screen').waitFor();
    assert.deepEqual(await page.evaluate(()=>draftSquad),[0,1,2]);
    assert.deepEqual(errors,[]);
    console.log('Fresh, saved and corrupt lineups, mobile back, three selected roles only, tag, offers and defeat verified.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});

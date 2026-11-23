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
    assert.ok(await page.locator('#shop').isDisabled());
    await page.locator('#start:enabled').tap();
    await page.locator('#roster-screen').waitFor();
    assert.ok(await page.locator('.future-operator').first().isDisabled());
    assert.ok(await page.locator('#deploy-team').isDisabled());
    for (const id of [3,0]) await page.locator(`[data-pick="${id}"]`).tap();
    assert.ok(await page.locator('#deploy-team').isDisabled());
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
      run.up.fill(5); run.up[0]=0;
      openUpgrade();
      const upgradeMode=mode;
      const enemy={x:run.x,y:run.y,type:0,contactDamage:9999};
      for(const id of run.lineup)hitSquadMember(enemy,run.squad[id],routes[run.floor],9999);
      return {afterInvalidTag,upgradeMode,result:$('dialog').dataset.state};
    });
    assert.deepEqual(partyStatus,{afterInvalidTag:2,upgradeMode:'play',result:'loss'});
    await page.reload();
    await page.locator('#start:enabled').tap();
    await page.locator('#hud').waitFor();
    assert.deepEqual(await page.evaluate(()=>run.lineup),ids);
    await page.evaluate(()=>localStorage.setItem('dropzone.squad.v1','[3,3,99]'));
    await page.reload();
    await page.locator('#start:enabled').tap();
    await page.locator('#roster-screen').waitFor();
    assert.ok(await page.locator('#deploy-team').isDisabled());
    assert.deepEqual(errors,[]);
    console.log('Fresh, saved and corrupt lineups, mobile back, three selected roles only, tag, offers and defeat verified.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});

// Exercise the same selection and launch path that a player sees.
module.exports = async function selectTestSquad(page, ids = [0, 1, 2]) {
  await page.locator('#start:enabled').waitFor();
  await page.locator('#select-team').click();
  await page.locator('#change-crew').click();
  const selected = page.locator('#roster-screen [data-pick][aria-pressed="true"]');
  while (await selected.count()) await selected.first().click();
  for (const id of ids) await page.locator(`#roster-screen [data-pick="${id}"]`).click();
  await page.locator('#save-team').click();
  await page.locator('#prep-save').click();
  await page.locator('#start').click();
  if (await page.locator('#replace-run').isVisible()){await page.locator('#ask-replace').click();await page.locator('#replace-confirm').click();}
  if (await page.locator('#upgrade').isVisible()) await page.locator('#equip').click();
  await page.locator('#hud').waitFor();
};

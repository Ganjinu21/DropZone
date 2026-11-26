// Use the same captured pointer gesture as a touchscreen, including on a disabled control.
module.exports=async function dragControl(page,locator){
  const box=await locator.boundingBox();
  if(!box)throw new Error('Control is outside the layout');
  const x=box.x+box.width/2,y=box.y+box.height/2;
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.mouse.move(x+18,y,{steps:3});
  await page.mouse.up();
};

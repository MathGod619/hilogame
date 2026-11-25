const {chromium, devices}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
 for(const phone of [false,true]){
  const label=phone?'phone':'desktop';
  const ctx=await browser.newContext({...phone?devices['Pixel 7']:{viewport:{width:1280,height:800}},deviceScaleFactor:1,reducedMotion:'reduce'});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.text().includes('Shader Error'))errors.push(m.text())});
  await page.route('**/hilo-3d/game.js?*',async route=>{
   const res=await route.fetch();
   await route.fulfill({response:res,body:await res.text()+'\nwindow.qaCardCenter = i => project(slots[i].x, CARD_Y + .12, slots[i].z);'});
  });
  await page.goto('http://127.0.0.1:8080/hilo-3d/?debug',{waitUntil:'domcontentloaded'});
  const state=()=>page.evaluate(()=>window.hilo.state());
  const action=async selector=>{const button=page.locator(selector);await (phone?button.tap():button.click())};
  const tapCard=async i=>{const [x,y]=await page.evaluate(i=>window.qaCardCenter(i),i);if(phone)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y)};
  await action('[data-a=start]');await action('.ticket[data-id=lucky]');await action('[data-a=go]');
  await page.waitForFunction(()=>window.hilo?.state()?.phase==='playing');
  await tapCard(1);assert.equal((await state()).selected,1);
  await action('#shield');assert.equal((await state()).protected[1],true);
  await action('#higher');assert.equal((await state()).turns,1);
  await action('#swap');await action('#restart');await action('[data-a=yes]');
  await action('.ticket[data-id=risk]');await action('[data-a=go]');
  await page.waitForFunction(()=>window.hilo.state().phase==='playing');
  await tapCard(1);assert.equal((await state()).swaps,0);assert.equal((await state()).selected,1);
  await page.evaluate(()=>window.hilo.setupStage(4));
  await page.waitForFunction(()=>window.hilo.state().stage===4);
  await tapCard(0);assert.equal((await state()).selected,3);
  await tapCard(1);assert.equal((await state()).selected,1);
  await page.screenshot({path:label+'-elevator.png'});
  await action('#higher');assert.equal((await state()).turns,1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);
  console.log('PASS '+label+' title, ticket, shop, board input, shield, guess, restart, swap reset, Elevator blocked and playable cards, viewport width and shader checks');
  await ctx.close();
 }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

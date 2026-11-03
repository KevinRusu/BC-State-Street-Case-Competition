/* Optional local Playwright inspection; opening the view needs no Node tooling. */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const Model=require('../web/upset-model.js');
const output=path.resolve(process.argv[3]||'outputs/upset');
const cases=JSON.parse(fs.readFileSync(path.join(output,'validation-cases.json'),'utf8'));
const cohorts=JSON.parse(fs.readFileSync(path.join(output,'cohorts.json'),'utf8'));
function verifyResult(actual,expected){
  assert.equal(actual.distinct,expected.distinct);assert.equal(actual.flags,expected.flags);assert.equal(actual.multiple,expected.multiple);
  for(const id of expected.checks)assert.equal(actual.checkTotals[id],expected.check_totals[id]);
  const shape=rows=>rows.map(c=>[JSON.stringify(c.checks||c.check_ids),c.count]).sort((a,b)=>a[0].localeCompare(b[0]));
  assert.deepEqual(shape(actual.all),shape(expected.intersections));
  assert.equal(actual.all.reduce((n,c)=>n+c.count,0),actual.distinct);
  assert.equal(actual.all.reduce((n,c)=>n+c.count*c.size,0),actual.flags);
}
for(const c of cases)verifyResult(Model.compute(cohorts[c.population],c.checks,c.statuses),c);
// Artificial display truncation and multiple-only focus retain all counts.
const stress=Array.from({length:20},(_,i)=>({members:[{check_id:'A',status:'Confirmed defect'},{check_id:'B'+i,status:'Confirmed defect'}],count:i+1,examples:[]}));
const stressResult=Model.compute(stress,['A',...stress.map((_,i)=>'B'+i)],['Confirmed defect'],{limit:6,multipleOnly:true});
assert.equal(stressResult.visible.length,6);assert.equal(stressResult.limitedCombinations,14);assert.equal(stressResult.visibleRecords+stressResult.limitedRecords,stressResult.distinct);

(async()=>{
  const browser=await chromium.launch({executablePath:process.argv[2],headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
    const errors=[],requests=[];page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>requests.push(r.url()));
    await page.goto(pathToFileURL(path.join(output,'index.html')).href);await page.waitForFunction(()=>window.upset);
    const payload=await page.evaluate(()=>window.upset.data);
    let uiSelections=0;
    for(const population of Object.keys(payload.populations)){
      await page.selectOption('#population',population);
      const categoryOptions=await page.locator('#category option').evaluateAll(nodes=>nodes.map(n=>n.value));
      for(const category of categoryOptions){
        await page.selectOption('#category',category);
        for(const status of ['',...payload.status_order]){
          await page.selectOption('#status',status);
          const actual=await page.evaluate(()=>({state:window.upset.state,result:window.upset.current}));
          const expected=cases.find(c=>c.population===population&&JSON.stringify([...c.checks].sort())===JSON.stringify([...actual.state.checks].sort())&&JSON.stringify(c.statuses)===JSON.stringify(status?[status]:payload.status_order));
          assert.ok(expected,'Independent direct-record reference exists for selection');verifyResult(actual.result,expected);
          const displayed=await page.locator('#entity-total').innerText();assert.equal(displayed,expected.distinct.toLocaleString('en-US'));
          const sum=await page.locator('#table-body tr td:nth-child(2)').evaluateAll(nodes=>nodes.reduce((n,node)=>n+(Number(node.textContent.replaceAll(',',''))||0),0));assert.equal(sum,actual.result.focusedRecords);
          const alignment=await page.locator('.combination').evaluateAll(nodes=>nodes.every(node=>[...node.querySelectorAll('circle')].every(dot=>Number(dot.getAttribute('cx'))===Number(node.dataset.center))&&Number(node.querySelector('.intersection-bar').dataset.center)===Number(node.dataset.center)));
          assert.equal(alignment,true);
          const invalid=await page.locator('#chart svg').evaluateAll(nodes=>nodes.some(node=>/NaN|Infinity/.test(node.outerHTML)));assert.equal(invalid,false);
          uiSelections++;
        }
      }
      await page.selectOption('#status','');
    }
    await page.click('#reset');
    await page.screenshot({path:path.join(output,'preview-desktop.png'),fullPage:true});
    const baseline=await page.evaluate(()=>window.upset.current);
    assert.ok(baseline.limitedCombinations>0,'Real holdings view exercises omitted combinations');
    await page.selectOption('#limit','0');assert.equal(await page.locator('.combination').count(),baseline.all.length);
    await page.selectOption('#sort','size');
    const sizes=await page.locator('.combination').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.size)));assert.ok(sizes.every((n,i)=>!i||sizes[i-1]>=n));
    await page.check('#multiple-only');assert.ok(await page.locator('.combination').evaluateAll(nodes=>nodes.every(n=>Number(n.dataset.size)>=2)));
    assert.equal(await page.locator('#entity-total').innerText(),baseline.distinct.toLocaleString('en-US'));
    await page.click('#reset');
    await page.locator('.combination').first().focus();assert.equal(await page.locator('#tooltip').isVisible(),true);await page.keyboard.press('Enter');
    assert.equal(await page.locator('#record-panel').isVisible(),true);assert.ok(await page.locator('#record-body tr').count()>0);
    const evidenceHref=await page.locator('#record-body a').first().getAttribute('href');
    const [evidenceFile,anchor]=evidenceHref.split('#');assert.ok(fs.readFileSync(path.join(output,evidenceFile),'utf8').includes(`id="${anchor}"`));
    await page.keyboard.press('Escape');await page.locator('h1').click();
    await page.screenshot({path:path.join(output,'preview-records.png'),fullPage:true});
    await page.click('#check-picker summary');
    await page.locator('#checks input').first().uncheck();
    const changed=await page.evaluate(()=>({state:window.upset.state,result:window.upset.current}));
    const expected=cases.find(c=>c.population===changed.state.population&&c.statuses.length===3&&JSON.stringify([...c.checks].sort())===JSON.stringify([...changed.state.checks].sort()));verifyResult(changed.result,expected);
    await page.click('#select-none');assert.equal(await page.locator('#empty-state').isVisible(),true);assert.equal(await page.locator('#entity-total').innerText(),'0');
    await page.click('#reset');await page.selectOption('#status','Cleared flag');assert.equal(await page.locator('#empty-state').isVisible(),true);assert.equal(await page.locator('#export-svg').isDisabled(),true);
    await page.screenshot({path:path.join(output,'preview-empty.png'),fullPage:true});
    await page.click('#reset');
    const [download]=await Promise.all([page.waitForEvent('download'),page.click('#export-csv')]);await download.saveAs(path.join(output,'upset-holdings-all-combinations.csv'));
    const csv=fs.readFileSync(path.join(output,'upset-holdings-all-combinations.csv'),'utf8');assert.ok(csv.includes('selected_check_definitions'));assert.equal(csv.split('\r\n').length,baseline.all.length+1);
    const svg=await page.evaluate(()=>window.upset.serializeSvg());assert.ok(svg.includes('Which anomaly flags occur together?'));assert.ok(svg.includes('Unique records grouped by their combination of selected flags.'));assert.ok(svg.includes('Co-occurrence is not correlation or causation.'));
    fs.writeFileSync(path.join(output,'upset-holdings.svg'),svg);
    const png=await page.evaluate(()=>window.upset.pngDataUrl(3));fs.writeFileSync(path.join(output,'upset-holdings.png'),Buffer.from(png.split(',')[1],'base64'));
    await page.goto('about:blank');await page.setContent(`<body style="margin:0;background:white"><img style="display:block;width:100%" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body>`);await page.locator('img').evaluate(img=>img.decode());await page.screenshot({path:path.join(output,'preview-export.png'),fullPage:true});
    await page.goto(pathToFileURL(path.join(output,'index.html')).href);await page.selectOption('#population','issuer_events');await page.screenshot({path:path.join(output,'preview-events.png'),fullPage:true});
    await page.click('#reset');await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(output,'preview-mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);assert.ok(requests.every(url=>/^(file|blob|data|about):/.test(url)));
    fs.writeFileSync(path.join(output,'browser-validation.json'),JSON.stringify({directRecordSelections:cases.length,uiSelections,consoleErrors:errors,networkRequests:requests.filter(url=>/^https?:/.test(url)),exports:['SVG','PNG 3x','CSV'],viewports:[1440,390]},null,2));
    console.log(`PASS: ${cases.length} independent record-level projections; ${uiSelections} UI filter selections; aligned bars/matrix, record drill-down, all-combination CSV, SVG/PNG, empty state and mobile bounds; no network requests.`);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

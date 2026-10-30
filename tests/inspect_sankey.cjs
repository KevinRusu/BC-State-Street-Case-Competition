/* Run with a local installation of playwright and an Edge/Chrome executable.
 * Usage: node tests/inspect_sankey.cjs path/to/browser [output-directory]
 */
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');

(async()=>{
  const output=path.resolve(process.argv[3]||'outputs/sankey');
  const browser=await chromium.launch({executablePath:process.argv[2],headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    const requests=[];page.on('request',r=>requests.push(r.url()));
    await page.goto(pathToFileURL(path.join(output,'index.html')).href);
    await page.waitForFunction(()=>window.sankey);
    const payload=await page.evaluate(()=>window.sankey.data);
    const expected=payload.populations.holdings;
    assert.equal(await page.locator('#flag-total').innerText(),expected.flag_count.toLocaleString('en-US'));
    assert.equal(await page.locator('#entity-total').innerText(),expected.affected_entities.toLocaleString('en-US'));
    // Every status/category combination uses the same filtered denominator.
    let filtersChecked=0;
    for(const population of Object.keys(payload.populations)) {
      await page.selectOption('#population',population);
      const options=await page.locator('#category option').evaluateAll(nodes=>nodes.map(n=>n.value));
      for(const category of options) for(const status of ['',...payload.status_order]) {
        await page.selectOption('#category',category);await page.selectOption('#status',status);
        const actual=await page.evaluate(()=>({total:window.sankey.current.total,affected:window.sankey.current.affected,groups:window.sankey.current.groups}));
        const groups=payload.groups.filter(g=>g.population===population&&(!status||g.status===status)&&(!category||payload.checks.find(c=>c.id===g.check_id).category===category));
        const count=groups.reduce((sum,g)=>sum+g.entities.length,0),unique=new Set(groups.flatMap(g=>g.entities)).size;
        assert.equal(actual.total,count);assert.equal(actual.affected,unique);
        const tableSum=await page.locator('#table-body tr td:nth-child(3)').evaluateAll(nodes=>nodes.reduce((sum,n)=>sum+(Number(n.textContent.replaceAll(',',''))||0),0));
        assert.equal(tableSum,count);
        if(count) {
          const invalid=await page.locator('#chart svg path').evaluateAll(paths=>paths.some(p=>/NaN|Infinity/.test(p.getAttribute('d'))));
          assert.equal(invalid,false);
          const heights=await page.locator('#chart rect.node').evaluateAll(nodes=>nodes.map(n=>Number(n.getAttribute('height'))));
          assert.ok(heights.length>0&&heights.every(h=>h>0),'Every Sankey node must have visible positive flow height');
          for(const stage of ['category-anomaly','anomaly-status']) {
            const sum=await page.locator(`#chart path[data-stage="${stage}"]`).evaluateAll(nodes=>nodes.reduce((s,n)=>s+Number(n.dataset.value),0));
            assert.equal(sum,count,'Incoming and outgoing link counts must reconcile');
          }
        }
        filtersChecked++;
      }
      await page.selectOption('#status','');await page.selectOption('#category','');
    }
    await page.click('#reset');
    await page.locator('#chart rect.node').first().focus();
    assert.equal(await page.locator('#tooltip').isVisible(),true);
    await page.keyboard.press('Escape');
    await page.locator('h1').click();
    await page.screenshot({path:path.join(output,'preview-desktop.png'),fullPage:true});
    const svg=await page.evaluate(()=>window.sankey.serializeSvg());
    assert.ok(svg.includes('Anomaly flags and evidence status.'));
    assert.ok(svg.includes('One record may contribute multiple flags.'));
    assert.ok(svg.includes('Cleared flag'));
    fs.writeFileSync(path.join(output,'anomaly-flags-holdings.svg'),svg);
    const png=await page.evaluate(()=>window.sankey.pngDataUrl(3));
    fs.writeFileSync(path.join(output,'anomaly-flags-holdings.png'),Buffer.from(png.split(',')[1],'base64'));
    // Inspectable standalone exported SVG, not only the surrounding application.
    await page.goto('about:blank');
    await page.setContent(`<html><body style="margin:0;background:white"><img alt="Exported Sankey" style="display:block;width:100%" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`);
    await page.locator('img').evaluate(image=>image.decode());
    assert.ok(await page.locator('img').evaluate(image=>image.naturalWidth>0));
    await page.screenshot({path:path.join(output,'preview-export.png'),fullPage:true});
    await page.goto(pathToFileURL(path.join(output,'index.html')).href);
    await page.selectOption('#status','Cleared flag');
    assert.equal(await page.locator('#empty-state').isVisible(),true);
    assert.equal(await page.locator('#export-svg').isDisabled(),true);
    await page.screenshot({path:path.join(output,'preview-empty.png'),fullPage:true});
    await page.click('#reset');await page.selectOption('#population','issuer_events');
    await page.screenshot({path:path.join(output,'preview-events.png'),fullPage:true});
    await page.click('#reset');await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    await page.screenshot({path:path.join(output,'preview-mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    assert.ok(requests.every(url=>url.startsWith('file:')||url.startsWith('blob:')||url.startsWith('data:')));
    fs.writeFileSync(path.join(output,'browser-validation.json'),JSON.stringify({filtersChecked,consoleErrors:errors,networkRequests:requests.filter(u=>/^https?:/.test(u)),exportScale:3,viewports:[1440,390]},null,2));
    console.log(`PASS: ${filtersChecked} filter combinations; exact totals and entity unions; focus, empty state, mobile layout and SVG/PNG exports; no network requests.`);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

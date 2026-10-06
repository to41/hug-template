'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.json':'application/json' };
const server = http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file = path.resolve(root,'.'+pathname,pathname.endsWith('/')?'index.html':'');
    if (!file.startsWith(root+path.sep)) { res.writeHead(403); res.end(); return; }
    const bytes = await fs.readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}); res.end(bytes);
  } catch { res.writeHead(404); res.end(); }
});

async function run() {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const url = 'http://127.0.0.1:'+server.address().port;
  let browser;
  try {
    browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.CHROMIUM_EXECUTABLE_PATH, args:['--no-sandbox','--disable-dev-shm-usage']} : {})});
    const context = await browser.newContext({viewport:{width:1280,height:900},permissions:['clipboard-read','clipboard-write']});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.locator('#content-container[aria-busy="false"]').waitFor();
    assert.equal(await page.locator('.card').count(),9);
    const specialist = page.locator('[data-template-id="plan-child-specialist-delivery"]');
    await specialist.locator('summary').click();
    assert.match(await specialist.innerText(),/30分以上/);
    assert.match(await specialist.locator('.rule-source a').getAttribute('href'),/www\.cfa\.go\.jp.*#page=36$/);
    await specialist.getByRole('button').click();
    const plan = await page.locator('#custom-text').inputValue();
    assert.match(plan,/専門的支援実施計画/);
    assert.ok(!plan.includes('月利用日数'), 'Rule notes must not be copied into plan text');
    await page.getByRole('button',{name:'家族支援',exact:true}).click();
    assert.equal(await page.locator('.card').count(),7);
    await page.locator('label').filter({hasText:'保育所等訪問支援'}).click();
    assert.equal(await page.locator('.card').count(),6);
    assert.equal(await page.locator('[data-template-id="plan-child-parenting-support"]').count(),0);
    await page.locator('[data-template-id="plan-visit-family-1"] summary').click();
    assert.match(await page.locator('[data-template-id="plan-visit-family-1"]').innerText(),/通常の訪問報告/);
    await page.getByRole('button',{name:'備考（訪問）',exact:true}).click();
    assert.equal(await page.locator('.card').count(),7);
    assert.ok(!(await page.locator('#content-container').innerText()).includes('専門的支援実施加算'));
    await page.locator('#searchInput').fill('訪問支援員特別加算（Ｉ）');
    assert.equal(await page.locator('.card').count(),1);
    await page.locator('#searchInput').fill('ありえない検索語XYZ');
    assert.equal(await page.locator('.card').count(),0);
    assert.match(await page.locator('.empty-state').innerText(),/見つかりません/);
    await page.locator('#searchInput').fill('');
    await page.locator('[data-template-id="original-visit-3"] button').click();
    assert.equal(await page.locator('#custom-text').inputValue(),plan+'\n'+await page.locator('[data-template-id="original-visit-3"] .plan-text').innerText());
    await page.locator('#custom-text').fill('直接編集した文章です。\n二行目😀');
    const custom = await page.locator('#custom-text').inputValue();
    assert.equal(await page.locator('#charCount').innerText(),Array.from(custom).length+'字');
    await page.getByRole('button',{name:'クリップボードにコピー',exact:true}).click();
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),custom);
    await page.evaluate(()=>{ navigator.clipboard.writeText = async ()=>{throw new Error('denied');}; document.execCommand=()=>false; });
    await page.getByRole('button',{name:'クリップボードにコピー',exact:true}).click();
    assert.match(await page.locator('#notification').innerText(),/コピーできませんでした/);
    await page.evaluate(()=>{ document.execCommand=()=>true; });
    await page.getByRole('button',{name:'クリップボードにコピー',exact:true}).click();
    assert.match(await page.locator('#notification').innerText(),/コピーしました/);
    page.once('dialog',dialog=>dialog.dismiss());
    await page.getByRole('button',{name:'クリア',exact:true}).click();
    assert.equal(await page.locator('#custom-text').inputValue(),custom);
    page.once('dialog',dialog=>dialog.accept());
    await page.getByRole('button',{name:'クリア',exact:true}).click();
    assert.equal(await page.locator('#custom-text').inputValue(),'');
    await page.getByText('放課後等デイサービス',{exact:true}).click();
    assert.equal(await page.locator('#sectionTitle').innerText(),'備考（放デイ）');
    assert.equal(await page.locator('.card').count(),12);
    const afterSpecialist=page.locator('[data-template-id="plan-child-specialist-delivery"]');
    await afterSpecialist.locator('summary').click();
    assert.match(await afterSpecialist.innerText(),/6日未満は月2回/);
    assert.match(await afterSpecialist.locator('.rule-source a').getAttribute('href'),/#page=54$/);
    const employment=page.locator('[data-template-id="plan-child-agency-4"]');
    await employment.getByRole('button').click();
    const employmentPlan=await page.locator('#custom-text').inputValue();
    assert.match(employmentPlan,/就職に際して/);
    assert.ok(!employmentPlan.includes('対象外'));
    await page.getByRole('button',{name:'クリップボードにコピー',exact:true}).click();
    // The earlier failure check replaces the clipboard writer; restore the native method.
    await page.reload();
    await page.locator('#content-container[aria-busy="false"]').waitFor();
    await page.getByText('放課後等デイサービス',{exact:true}).click();
    await page.locator('[data-template-id="plan-child-agency-4"] button').click();
    await page.getByRole('button',{name:'クリップボードにコピー',exact:true}).click();
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),employmentPlan);
    assert.equal(await page.locator('[data-template-id="plan-after-individual-support-3"]').count(),1);
    await page.locator('#searchInput').fill('6日未満');
    assert.equal(await page.locator('.card').count(),1);
    await page.locator('label').filter({hasText:'児童発達支援'}).click();
    assert.equal(await page.locator('.card').count(),0);
    await page.locator('#searchInput').fill('');
    assert.equal(await page.locator('#sectionTitle').innerText(),'備考（児発）');
    assert.equal(await page.locator('[data-template-id="plan-after-individual-support-3"]').count(),0);
    await page.getByText('放課後等デイサービス',{exact:true}).click();
    await page.locator('[data-template-id="plan-child-specialist-delivery"] summary').click();
    await page.screenshot({path:path.join(root,'../hug-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    for (const service of ['child','after','visit']) {
      await page.locator(`input[value="${service}"]`).check();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),service+': mobile horizontal overflow');
    }
    await page.getByText('放課後等デイサービス',{exact:true}).click();
    await page.locator('#searchInput').fill('個別サポート');
    await page.locator('[data-template-id="plan-after-individual-support-3"] summary').click();
    assert.match(await page.locator('#content-container').innerText(),/月1回以上/);
    await page.screenshot({path:path.join(root,'../hug-mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    await page.getByRole('link',{name:'旧版を開く'}).click();
    assert.match(page.url(),/\/legacy\/index\.html$/);
    assert.equal(await page.locator('h1').innerText(),'HUG 支援計画作成アシスト');
    await page.route('**/data/additions.json',route=>route.fulfill({status:500,body:'unavailable'}));
    await page.goto(url);
    await page.locator('#content-container[aria-busy="false"]').waitFor();
    assert.match(await page.locator('.empty-state').innerText(),/読み込めません/);
    assert.ok(await page.getByRole('link',{name:'旧版を開く'}).isVisible());
    console.log('Browser checks passed: service filtering, category switching, normalized search, editing, copy success/failure/fallback, clear confirmation, source links, legacy navigation, data-load failure, desktop/mobile.');
  } finally { if (browser) await browser.close(); await new Promise(resolve=>server.close(resolve)); }
}
run().catch(error=>{console.error(error);process.exitCode=1;});

const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox', '--disable-gpu', '--disable-http-cache'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => localStorage.setItem('aifilmora.firstRun.v1', 'skip')); // first-run chooser dismissal (auto-patched)
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // Panel resizers exist
  const rsz = await page.evaluate(() => ({
    sidebar: !!document.getElementById('resizeSidebar'),
    inspector: !!document.getElementById('resizeInspector'),
    timeline: !!document.getElementById('resizeTimeline'),
  }));

  // Resize sidebar by drag
  const sb = await page.locator('#resizeSidebar').boundingBox();
  const beforeW = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w').trim());
  await page.mouse.move(sb.x + sb.width/2, sb.y + 100);
  await page.mouse.down();
  await page.mouse.move(sb.x + 80, sb.y + 100, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  const afterW = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w').trim());

  // Text panel
  await page.click('[data-inspector="textpanel"]');
  await page.click('#btnAddTitle');
  await page.waitForTimeout(200);
  const textClip = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.tl-clip')].find(x => x.dataset.type === 'text');
    return !!c;
  });
  // apply preset — the grid lives in the sidebar's Text view, so open that tab
  // first or the presets are display:none.
  await page.click('[data-sidebar="textpresets"]');
  await page.waitForTimeout(150);
  await page.locator('#textPresetGrid .preset').nth(1).click();
  await page.waitForTimeout(150);

  // Transitions
  await page.click('[data-sidebar="transitions"]');
  await page.click('.tl-clip[data-type="video"]');
  await page.locator('#transGrid .preset').nth(1).click(); // dissolve
  await page.waitForTimeout(150);
  const hasTrans = await page.evaluate(() => document.querySelectorAll('.tl-trans.has').length);

  // AI settings
  await page.click('[data-inspector="aisettings"]');
  const providerOpts = await page.evaluate(() => document.getElementById('aiProviderSelect')?.options.length);
  await page.selectOption('#aiProviderSelect', 'ollama');
  await page.waitForTimeout(100);
  const baseURL = await page.inputValue('#aiBaseURL');

  // Zoom via ctrl+wheel
  const z0 = await page.evaluate(() => document.getElementById('tlZoom').value);
  const body = page.locator('.tl-body');
  const bb = await body.boundingBox();
  await page.mouse.move(bb.x + 200, bb.y + 40);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -240);
  await page.keyboard.up('Control');
  await page.waitForTimeout(100);
  const z1 = await page.evaluate(() => document.getElementById('tlZoom').value);

  // Preview should still paint
  await page.click('#btnPlay');
  await page.waitForTimeout(400);
  const playing = await page.evaluate(() => document.getElementById('btnPlay')?.textContent);

  await page.screenshot({ path: 'D:/000000 Lab/AiFimora/output-playwright.png' });
  console.log(JSON.stringify({ rsz, beforeW, afterW, textClip, hasTrans, providerOpts, baseURL, z0, z1, playing, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

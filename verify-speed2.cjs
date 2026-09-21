const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => localStorage.setItem('aifilmora.firstRun.v1', 'skip')); // first-run chooser dismissal (auto-patched)
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  await page.locator('.tl-clip[data-type="video"]').first().click({ force: true });
  await page.click('[data-inspector="speed"]');
  await page.waitForTimeout(100);

  const before = await page.evaluate(() =>
    [...document.querySelectorAll('.tl-clip[data-type="video"]')].map(c => ({
      name: c.querySelector('.label')?.textContent,
      left: c.style.left,
      w: c.style.width,
    }))
  );

  await page.click('#insp-speed [data-speed="2"]');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() =>
    [...document.querySelectorAll('.tl-clip[data-type="video"]')].map(c => ({
      name: c.querySelector('.label')?.textContent,
      left: c.style.left,
      w: c.style.width,
      sub: c.querySelector('.sub')?.textContent,
    }))
  );

  const stillOnSpeed = await page.evaluate(() => document.querySelector('[data-inspector="speed"]')?.classList.contains('active'));

  const toolbar = await page.evaluate(() => {
    const kids = [...document.querySelector('.tl-toolbar').querySelectorAll('button')].map(b => b.id || b.textContent.trim());
    return {
      kids,
      detachIdx: kids.indexOf('btnDetachAudio'),
      snapIdx: kids.indexOf('btnSnap'),
    };
  });

  await page.click('#btnDetachAudio');
  await page.waitForTimeout(200);

  await page.locator('.tl-clip[data-type="video"]').first().click({ force: true });
  await page.click('[data-inspector="speed"]');
  await page.click('#btnFreezeFrame');
  await page.waitForTimeout(300);
  const freeze = await page.evaluate(() => {
    const f = document.querySelector('.tl-clip.is-freeze');
    return { exists: !!f, name: f?.querySelector('.label')?.textContent };
  });

  console.log(JSON.stringify({ before, after, stillOnSpeed, toolbar, freeze, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

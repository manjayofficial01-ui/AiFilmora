const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  // Native confirm()/prompt() otherwise leave a dialog hanging and the run dies
  // at teardown with "Not attached to an active page".
  page.on('dialog', async (d) => { await d.accept('1'); });
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => localStorage.setItem('aifilmora.firstRun.v1', 'skip')); // first-run chooser dismissal (auto-patched)
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  // select first video
  await page.click('[data-inspector="fx"]');
  await page.locator('.tl-clip[data-type="video"]').first().click({ force: true });
  await page.waitForTimeout(150);
  // The speed presets live in #insp-speed, which is not the default view —
  // open that tab or the [data-speed] buttons are not rendered.
  await page.click('[data-inspector="speed"]');
  await page.waitForTimeout(150);

  const before = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.tl-clip')].find(x => x.dataset.type==='video');
    return { sub: c?.querySelector('.sub')?.textContent, width: c?.style.width };
  });

  await page.click('[data-speed="2"]');
  await page.waitForTimeout(250);
  const afterSpeed = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.tl-clip')].find(x => x.dataset.type==='video');
    return {
      sub: c?.querySelector('.sub')?.textContent,
      width: c?.style.width,
      label: document.getElementById('selectedClipLabel')?.textContent,
      slider: document.getElementById('clipSpeed')?.value,
      out: document.getElementById('clipSpeedOut')?.textContent,
    };
  });

  await page.click('#btnDetachAudio');
  await page.waitForTimeout(250);
  const afterDetach = await page.evaluate(() => {
    const audio = [...document.querySelectorAll('.tl-clip[data-type="audio"]')];
    const video = document.getElementById('selectedClipLabel')?.textContent;
    return {
      audioCount: audio.length,
      audioNames: audio.map(a => a.querySelector('.label')?.textContent),
      videoLabel: video,
      detachDisabled: document.getElementById('btnDetachAudio')?.disabled,
    };
  });

  await page.click('#btnMuteClip');
  await page.waitForTimeout(150);
  const muteLabel = await page.evaluate(() => document.getElementById('btnMuteClip')?.textContent);

  // undo speed
  await page.click('#btnUndo');
  await page.waitForTimeout(150);
  await page.click('#btnUndo');
  await page.waitForTimeout(150);

  console.log(JSON.stringify({ before, afterSpeed, afterDetach, muteLabel, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

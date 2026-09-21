const { chromium } = require('playwright');
const path = require('path');

const OUT = path.join(__dirname, 'output-playwright.png');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const failed = [];
  const notes = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });
  page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });

  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  // Clear previous save so demo seed is deterministic
  await page.evaluate(() => {
    localStorage.removeItem('aifimora.project.v1');
    localStorage.removeItem('aifimora.mateMemory');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Dismiss the first-run chooser with the Demo seed (restores demo timeline)
  const firstRun = await page.evaluate(() =>
    document.getElementById('firstRunModal')?.classList.contains('open')
  );
  if (firstRun) {
    await page.click('#frDemo');
    await page.waitForTimeout(900);
    notes.push('firstRun=demo');
  }

  const boot = await page.evaluate(() => ({
    clips: document.querySelectorAll('.tl-clip').length,
    media: document.querySelectorAll('.media-card').length,
    title: document.getElementById('projectTitleLive')?.textContent,
    credits: document.getElementById('creditsChip')?.textContent,
    seq: document.getElementById('seqDuration')?.textContent,
  }));
  notes.push('boot=' + JSON.stringify(boot));

  // Select a clip
  await page.click('.tl-clip');
  await page.waitForTimeout(100);
  const selected = await page.evaluate(() =>
    document.querySelectorAll('.tl-clip.selected').length
  );
  notes.push('selectedClips=' + selected);

  // Seek via ruler then split
  const ruler = page.locator('.tl-ruler');
  const box = await ruler.boundingBox();
  if (box) {
    await page.mouse.click(box.x + 80, box.y + 10);
    await page.waitForTimeout(100);
  }
  await page.keyboard.press('s');
  await page.waitForTimeout(250);
  const clipsAfterSplit = await page.evaluate(() => document.querySelectorAll('.tl-clip').length);
  notes.push('clipsAfterSplit=' + clipsAfterSplit);

  // Drag first clip
  const clip = page.locator('.tl-clip').first();
  const cb = await clip.boundingBox();
  if (cb) {
    await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
    await page.mouse.down();
    await page.mouse.move(cb.x + cb.width / 2 + 40, cb.y + cb.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(200);
  }

  // Media search
  await page.fill('#mediaSearch', 'city');
  await page.waitForTimeout(150);
  const filtered = await page.evaluate(() => document.querySelectorAll('.media-card').length);
  notes.push('searchCityCards=' + filtered);
  await page.fill('#mediaSearch', '');
  await page.waitForTimeout(100);

  // GenAI Lab generation
  await page.click('[data-inspector="lab"]');
  await page.fill('#genPrompt', 'Ocean cliff aerial');
  await page.click('#genForm button[type="submit"]');
  await page.waitForTimeout(3200);
  const jobs = await page.evaluate(() => ({
    jobs: document.querySelectorAll('.job').length,
    done: document.querySelectorAll('.job.done').length,
    clips: document.querySelectorAll('.tl-clip').length,
  }));
  notes.push('afterGen=' + JSON.stringify(jobs));

  // AI Mate captions
  await page.click('[data-inspector="mate"]');
  await page.locator('[data-quick="Add auto captions"]').click();
  await page.waitForTimeout(500);

  // FX panel
  await page.click('[data-inspector="fx"]');
  await page.selectOption('#fxLut', 'cinematic');
  await page.selectOption('#fxReframe', '9:16');
  await page.waitForTimeout(200);

  // Text edit transcribe
  await page.click('[data-inspector="text"]');
  await page.click('#btnTranscribe');
  await page.waitForTimeout(1600);
  const transcript = await page.evaluate(() => document.querySelectorAll('.t-line').length);
  notes.push('transcriptLines=' + transcript);

  // Select two lines and paper edit would replace — just select + cut one
  const lines = page.locator('.t-line');
  if (await lines.count() > 1) {
    await lines.nth(0).click();
    await lines.nth(1).click();
    await page.click('#btnCutSelected');
    await page.waitForTimeout(200);
    const afterCut = await page.evaluate(() => document.querySelectorAll('.t-line').length);
    notes.push('afterCutSelected=' + afterCut);
  }

  // Export modal open/close + cancel path
  await page.click('#btnExport');
  await page.waitForTimeout(150);
  const exportOpen = await page.evaluate(() =>
    document.getElementById('exportModal')?.classList.contains('open')
  );
  notes.push('exportOpen=' + exportOpen);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const exportClosed = await page.evaluate(() =>
    !document.getElementById('exportModal')?.classList.contains('open')
  );
  notes.push('exportEscClosed=' + exportClosed);

  // Shortcuts modal. #menuShortcuts lives inside the collapsed Tools <details>,
  // so dispatch the click in-page rather than through a hit-test.
  await page.evaluate(() => document.getElementById('menuShortcuts')?.click());
  await page.waitForTimeout(100);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const shortcutsClosed = await page.evaluate(() =>
    !document.getElementById('shortcutsModal')?.classList.contains('open')
  );
  notes.push('shortcutsEscClosed=' + shortcutsClosed);

  // Play / pause via Space
  await page.locator('body').click({ position: { x: 500, y: 200 } });
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  const playing = await page.evaluate(() =>
    document.getElementById('btnPlay')?.textContent === '⏸'
  );
  notes.push('playing=' + playing);
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);

  // Delete selected clip via keyboard
  await page.click('.tl-clip');
  await page.waitForTimeout(50);
  const beforeDel = await page.evaluate(() => document.querySelectorAll('.tl-clip').length);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(150);
  const afterDel = await page.evaluate(() => document.querySelectorAll('.tl-clip').length);
  notes.push(`deleteClip ${beforeDel}->${afterDel}`);

  // Double-click media insert uses playhead (should not throw)
  await page.locator('.media-card').first().dblclick();
  await page.waitForTimeout(200);

  // Save + reload persistence
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(200);
  const savedName = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('aifimora.project.v1') || '{}').name;
    } catch { return null; }
  });
  notes.push('savedName=' + savedName);

  await page.screenshot({ path: OUT });
  console.log(JSON.stringify({ boot, clipsAfterSplit, jobs, transcript, notes, failed, errors }, null, 2));
  await browser.close();
  if (errors.length) process.exitCode = 2;
})().catch(e => { console.error(e); process.exit(1); });

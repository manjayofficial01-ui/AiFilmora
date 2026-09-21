import { chromium } from 'playwright';

const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(1200);

const html = await p.content();
console.log('--- DOM state after JS loaded ---');
console.log('Has Player chip:', html.includes('player-chip') ? 'YES' : 'NO');
console.log('Has cat-rail:', html.includes('cat-rail') ? 'YES' : 'NO');
console.log('Has side-templates:', html.includes('side-templates') ? 'YES' : 'NO');

const tabs = [...html.matchAll(/data-sidebar="([^"]*)"/g)].map(m => m[1]);
console.log('Tabs present:', [...new Set(tabs)]);
const sides = [...html.matchAll(/id="side-([^"]*)"/g)].map(m => m[1]);
console.log('Side panels present:', [...new Set(sides)]);

// What tabs actually render as labels
const tabLabels = await p.$$eval('[data-sidebar]', btns => btns.map(b => b.dataset.sidebar + ' → ' + (b.querySelector('.tab-lbl')?.textContent || '?')));
console.log('Tab labels:', tabLabels);

// Check for rail elements
const rails = await p.$$eval('.cat-rail', rails => rails.length);
console.log('Cat rails on page:', rails);

// Check template grid
const tmplGrid = await p.$eval('#side-templates .template-grid', g => g ? g.children.length : 0).catch(() => 'no grid');
console.log('Template cards:', tmplGrid);

// Take a screenshot
await p.screenshot({ path: 'media-menu-after-init.png', fullPage: false });
console.log('Screenshot: media-menu-after-init.png');

await b.close();

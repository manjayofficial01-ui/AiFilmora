/* analyze-layout.cjs — inspect current index.html panel structure */
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const sideIds = [...html.matchAll(/id="side-([^"]*)"/g)].map(m => m[1]);
const tabs = [...html.matchAll(/data-sidebar="([^"]*)"/g)].map(m => m[1]);
console.log('SIDE PANEL IDs:', sideIds);
console.log('TAB data-sidebar:', [...new Set(tabs)]);

// Find the preview-tabs area
const ptIdx = html.indexOf('class="preview-tabs"');
if (ptIdx >= 0) {
  console.log('\nPREVIEW TABS AREA:', html.slice(ptIdx - 60, ptIdx + 350));
}

// Find the panel-body area just to see structure
const pbIdx = html.indexOf('class="panel-body"');
if (pbIdx >= 0) {
  console.log('\nFIRST PANEL-BODY:', html.slice(pbIdx - 100, pbIdx + 400));
}

// Look for any element wrapping the sidebar panels
const sbIdx = html.indexOf('class="sidebar"');
if (sbIdx >= 0) {
  console.log('\nSIDEBAR START:', html.slice(sbIdx - 40, sbIdx + 300));
}

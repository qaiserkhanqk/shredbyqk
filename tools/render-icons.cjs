// Renders icons/*.svg to the PNG sizes phones need (apple-touch-icon 180, 192, 512, maskable 512, favicon 32). Usage: node tools/render-icons.cjs
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const dir = require('path').join(__dirname, '..', 'icons') + '/';
  const jobs = [['icon-maskable.svg', 'apple-touch-icon.png', 180], ['icon.svg', 'icon-192.png', 192], ['icon.svg', 'icon-512.png', 512], ['icon-maskable.svg', 'maskable-512.png', 512], ['icon.svg', 'favicon-32.png', 32]];
  for (const [src, out, n] of jobs) {
    const p = await b.newPage({ viewport: { width: n, height: n } });
    await p.setContent(`<html><body style="margin:0;background:transparent">${fs.readFileSync(dir + src, 'utf8').replace('<svg ', `<svg width="${n}" height="${n}" `)}</body></html>`);
    await p.screenshot({ path: dir + out, omitBackground: true, clip: { x: 0, y: 0, width: n, height: n } }); await p.close();
  }
  await b.close(); console.log('pngs ok');
})();

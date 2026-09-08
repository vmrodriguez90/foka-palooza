/* Genera assets/og.png (1200x630) a partir de tools/og-source.html
   Uso: node tools/render-og.js   (requiere playwright + chromium) */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(__dirname, 'og-source.html'), { waitUntil: 'networkidle' });
  try { await page.evaluate(() => document.fonts.ready); } catch (_) {}
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.resolve(__dirname, '../assets/og.png'), type: 'png' });
  await browser.close();
  console.log('assets/og.png listo');
})();

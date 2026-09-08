/* Captura index.html en desktop y mobile.
   Inyecta las fuentes desde tools/fonts/ porque el navegador headless
   de este entorno no puede alcanzar el CDN de Google Fonts. */
const { chromium } = require('playwright');
const path = require('path');
const f = n => 'file://' + path.resolve(__dirname, 'fonts', n);
const CSS = `
@font-face{font-family:'Anton';src:url('${f('Anton.ttf')}') format('truetype');font-weight:400;font-display:block}
@font-face{font-family:'Bebas Neue';src:url('${f('BebasNeue.ttf')}') format('truetype');font-weight:400;font-display:block}
@font-face{font-family:'Space Grotesk';src:url('${f('SpaceGrotesk.ttf')}') format('truetype');font-weight:400 700;font-display:block}
`;
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch();
  for (const [name, vp] of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]) {
    const p = await b.newPage({ viewport: vp });
    await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
    await p.addStyleTag({ content: CSS });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(900);
    await p.screenshot({ path: path.join(out, `page-${name}.png`), fullPage: true });
    await p.close();
  }
  await b.close();
  console.log('capturas listas');
})();

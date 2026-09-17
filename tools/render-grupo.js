/* Genera assets/grupo.png (1000x1000) para la foto del grupo de WhatsApp,
   a partir de tools/grupo-source.html.
   Además saca una tira de previews chiquitos, recortados en círculo, para
   ver si se entiende algo en la lista de chats (que es donde se ve).
   Uso: node tools/render-grupo.js   (requiere playwright + chromium) */
const { chromium } = require('playwright');
const path = require('path');

const SALIDA = path.resolve(__dirname, '../assets/grupo.png');

(async () => {
  const browser = await chromium.launch();

  /* 1. la imagen de verdad */
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(__dirname, 'grupo-source.html'), { waitUntil: 'networkidle' });
  try { await page.evaluate(() => document.fonts.ready); } catch (_) {}
  await page.waitForTimeout(800);
  await page.screenshot({ path: SALIDA, type: 'png' });
  await page.close();
  console.log('assets/grupo.png listo');

  /* 2. cómo se ve chiquita y redonda (48, 64 y 128 px, como WhatsApp) */
  const destino = process.argv[2];
  if (destino) {
    /* La imagen va embebida: una página sin origen no puede cargar file:// */
    const datos = 'data:image/png;base64,' + require('fs').readFileSync(SALIDA).toString('base64');
    const tamanios = [48, 64, 128, 240];
    const previa = await browser.newPage({
      viewport: { width: tamanios.reduce((a, t) => a + t + 24, 24), height: 300 },
      deviceScaleFactor: 2
    });
    await previa.setContent(`
      <body style="margin:0;background:#ECE5DD;display:flex;align-items:center;gap:24px;padding:24px;font-family:sans-serif">
        ${tamanios.map(t => `
          <div style="text-align:center">
            <img src="${datos}" style="width:${t}px;height:${t}px;border-radius:50%;object-fit:cover;display:block">
            <div style="font-size:11px;color:#555;margin-top:6px">${t}px</div>
          </div>`).join('')}
      </body>`);
    await previa.waitForTimeout(400);
    await previa.screenshot({ path: path.join(destino, 'grupo-previews.png') });
    await previa.close();
    console.log('previews en ' + destino);
  }

  await browser.close();
})();

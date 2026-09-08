/* Auditoría de mobile: desborde horizontal, elementos más anchos que la
   pantalla, tamaño de los targets táctiles y del texto. */
const { chromium, devices } = require('playwright');
const path = require('path');
const f = n => 'file://' + path.resolve(__dirname, 'fonts', n);
const CSS = `
@font-face{font-family:'Anton';src:url('${f('Anton.ttf')}') format('truetype');font-display:block}
@font-face{font-family:'Bebas Neue';src:url('${f('BebasNeue.ttf')}') format('truetype');font-display:block}
@font-face{font-family:'Space Grotesk';src:url('${f('SpaceGrotesk.ttf')}') format('truetype');font-weight:400 700;font-display:block}`;

const ANCHOS = [320, 360, 390, 414, 768];

(async () => {
  const b = await chromium.launch();
  for (const w of ANCHOS) {
    const p = await b.newPage({ viewport: { width: w, height: 780 }, deviceScaleFactor: 2, isMobile: w < 700, hasTouch: w < 700 });
    await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
    await p.addStyleTag({ content: CSS });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(500);

    const r = await p.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const anchos = [];
      const chicos = [];
      const textoChico = [];
      document.querySelectorAll('body *').forEach(el => {
        const b = el.getBoundingClientRect();
        if (b.width === 0 && b.height === 0) return;
        // ignoramos las marquesinas, que desbordan a propósito y están recortadas
        if (el.closest('.marquee') || el.classList.contains('rays')) return;
        if (b.right > vw + 1 || b.left < -1) anchos.push(el.className || el.tagName);
        if (el.matches('a.btn, button, input, select, textarea, .check span') && b.height < 44) {
          chicos.push((el.className || el.tagName) + ' h=' + Math.round(b.height));
        }
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (el.children.length === 0 && el.textContent.trim() && fs < 12) {
          textoChico.push((el.className || el.tagName) + ' ' + fs.toFixed(1) + 'px');
        }
      });
      return {
        scrollX: document.documentElement.scrollWidth > vw,
        scrollWidth: document.documentElement.scrollWidth, vw,
        desbordan: [...new Set(anchos)].slice(0, 6),
        targetsChicos: [...new Set(chicos)].slice(0, 6),
        textoChico: [...new Set(textoChico)].slice(0, 6)
      };
    });
    console.log(`\n── ${w}px ──`);
    console.log('  scroll horizontal:', r.scrollX ? `SÍ (${r.scrollWidth} > ${r.vw}) ✗` : 'no ✓');
    console.log('  elementos que desbordan:', r.desbordan.length ? r.desbordan : 'ninguno ✓');
    console.log('  targets < 44px:', r.targetsChicos.length ? r.targetsChicos : 'ninguno ✓');
    console.log('  texto < 12px:', r.textoChico.length ? r.textoChico : 'ninguno ✓');
    await p.close();
  }
  await b.close();
})();

/* Prueba funcional de torneo.html: que el torneo terminado se dibuje
   entero sin pedir nada por red.
   Correlo con: node tools/test-torneo-web.js */
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');

const RAIZ = path.resolve(__dirname, '..');

/* Las páginas se sirven por HTTP y no por file://, para que se parezca a
   cómo corren de verdad en GitHub Pages. */
const TIPOS = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
                '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png' };
const servidor = http.createServer((req, res) => {
  const limpio = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  const destino = path.join(RAIZ, limpio);
  if (!destino.startsWith(RAIZ) || !fs.existsSync(destino) || fs.statSync(destino).isDirectory()) {
    res.writeHead(404); return res.end('no');
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(destino)] || 'application/octet-stream' });
  fs.createReadStream(destino).pipe(res);
});

let BASE = '';
const archivo = n => BASE + '/' + n;

let fallos = 0;
const ok = (cond, que, extra) => {
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + que + (extra !== undefined ? '  → ' + extra : ''));
  if (!cond) fallos++;
};

(async () => {
  await new Promise(r => servidor.listen(0, '127.0.0.1', r));
  BASE = 'http://127.0.0.1:' + servidor.address().port;

  const b = await chromium.launch();

  /* ============================ torneo.html ============================ */
  /* El torneo terminado está escrito dentro de la página, así que tiene
     que dibujarse entero sin red: ni planilla, ni archivo, ni nada. */
  console.log('\ntorneo.html (el torneo cerrado, sin red)');
  {
    const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
    p.on('pageerror', e => { console.log('  ✗ ERROR JS: ' + e.message); fallos++; });
    const pedidos = [];
    await p.route('**/*', route => {
      const u = route.request().url();
      if (!u.startsWith(BASE)) { pedidos.push(u); return route.abort(); }
      route.continue();
    });
    await p.goto(archivo('torneo.html'));
    await p.waitForSelector('#posiciones .fila');

    ok(!pedidos.some(u => /torneo\.json|script\.google/.test(u)), 'no pide el torneo por red', pedidos.length);
    ok((await p.locator('#posiciones .fila').count()) === 7, 'dibuja los 7 equipos');
    ok((await p.textContent('#d-parejas')) === '7', 'cuenta 7 parejas');
    ok((await p.textContent('#d-jugadores')) === '14', 'cuenta 14 jugadores');
    ok((await p.textContent('#d-jugadas')) === '5/5', 'las 5 pruebas jugadas', await p.textContent('#d-jugadas'));

    ok(await p.isVisible('#campeon'), 'muestra el cartel de campeones');
    ok(/Focas Bravas/.test(await p.textContent('#campeon-nombre')), 'con Las Focas Bravas');
    ok(/36/.test(await p.textContent('#campeon-gente')), 'y sus 36 puntos');

    const primera = await p.textContent('#posiciones .fila:first-child');
    ok(/Focas Bravas/.test(primera) && /36/.test(primera), 'encabezan la tabla');

    ok((await p.locator('.capitulo').count()) === 6, 'la crónica tiene sus 6 capítulos');
    ok((await p.locator('.prueba-fila').count()) === 5, 'quedan 5 pruebas, sin la sorpresa');
    ok(!/sorpresa|secreta/i.test(await p.textContent('#pruebas')), 'la trivia no jugada no aparece');
    ok(/Torneo cerrado/.test(await p.textContent('#actualizado')), 'avisa que está cerrado');
    await p.close();
  }

  await b.close();
  servidor.close();
  console.log('\n' + (fallos ? fallos + ' prueba(s) fallaron ✗' : 'Todo bien 🦭'));
  process.exit(fallos ? 1 : 0);
})();

/* Prueba funcional de torneo.html y admin.html contra un endpoint simulado.
   Correlo con: node tools/test-torneo-web.js */
const { chromium } = require('playwright');
const path = require('path');

const ENDPOINT = 'https://fake.endpoint/exec';
const archivo = n => 'file://' + path.resolve(__dirname, '..', n);

/* Estado de ejemplo que "devuelve el servidor" */
const ESTADO = {
  version: 1,
  actualizado: new Date().toISOString(),
  fase: 'jugando',
  mensaje: 'Arrancó el mini golf. Las Focas van punteras.',
  participantes: [
    { id: 'p1', nombre: 'Ana' }, { id: 'p2', nombre: 'Beto' },
    { id: 'p3', nombre: 'Cami' }, { id: 'p4', nombre: 'Dani' }
  ],
  parejas: [
    { id: 'd1', nombre: 'Las Focas', emoji: '🦭', integrantes: ['p1', 'p2'] },
    { id: 'd2', nombre: 'Los Mates', emoji: '🧉', integrantes: ['p3', 'p4'] }
  ],
  pruebas: [
    { id: 'golf', nombre: 'Mini golf', emoji: '⛳', estado: 'jugada' },
    { id: 'autos', nombre: 'Carrera de autos', emoji: '🏎️', estado: 'jugando' },
    { id: 'sorpresa', nombre: 'Prueba sorpresa', emoji: '❓', estado: 'pendiente', secreta: true }
  ],
  resultados: { golf: { d1: 'oro', d2: 'plata' } },
  bonus: {},
  bitacora: [{ ts: new Date().toISOString(), texto: 'Terminó el mini golf' }]
};

let fallos = 0;
const ok = (cond, que, extra) => {
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + que + (extra !== undefined ? '  → ' + extra : ''));
  if (!cond) fallos++;
};

/* Cada página arranca con el endpoint falso y con la ruta interceptada. */
async function nuevaPagina(browser, guardadas) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  p.on('pageerror', e => { console.log('  ✗ ERROR JS: ' + e.message); fallos++; });
  await p.addInitScript(ep => { window.FOKA_CONFIG = { endpoint: ep }; }, ENDPOINT);
  await p.route(ENDPOINT + '*', async route => {
    const req = route.request();
    const json = cuerpo => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cuerpo) });
    if (req.method() === 'GET') return json({ ok: true, torneo: ESTADO });
    const body = JSON.parse(req.postData());
    if (guardadas) guardadas.push(body);
    if (body.pin !== '1234') return json({ ok: false, error: 'PIN incorrecto' });
    if (body.tipo === 'torneo_confirmados') {
      return json({ ok: true, confirmados: [
        { nombre: 'Ana', kermesse: 'Sí' }, { nombre: 'Beto', kermesse: 'Sí' },
        { nombre: 'Cami', kermesse: 'Sí' }, { nombre: 'Dani', kermesse: 'Sí' },
        { nombre: 'Elsa', kermesse: 'No' }
      ] });
    }
    return json({ ok: true, torneo: { actualizado: new Date().toISOString() } });
  });
  return p;
}

(async () => {
  const b = await chromium.launch();

  /* ============================ torneo.html ============================ */
  console.log('\ntorneo.html (la página pública)');
  {
    const p = await nuevaPagina(b);
    await p.goto(archivo('torneo.html'));
    await p.waitForFunction(() => document.querySelectorAll('#posiciones .fila').length > 0);

    ok((await p.textContent('#d-parejas')) === '2', 'cuenta 2 parejas');
    ok((await p.textContent('#d-jugadas')) === '1/3', 'cuenta 1 de 3 pruebas jugadas', await p.textContent('#d-jugadas'));
    ok((await p.textContent('#d-jugadores')) === '4', 'cuenta 4 jugadores');

    const primera = await p.textContent('#posiciones .fila:first-child');
    ok(/Las Focas/.test(primera), 'puntea Las Focas');
    ok(/10/.test(primera), 'le suma los 10 puntos del oro');

    ok(await p.isVisible('#aviso'), 'muestra el mensaje del admin');
    ok(/mini golf/i.test(await p.textContent('#aviso-texto')), 'con el texto que mandó');

    const pruebas = await p.textContent('#pruebas');
    ok(/Prueba secreta/.test(pruebas), 'la prueba secreta queda tapada');
    ok(!/Prueba sorpresa/.test(pruebas), 'no se filtra el nombre real de la secreta');
    ok(/Carrera de autos/.test(pruebas), 'las otras se ven con su nombre');
    ok((await p.locator('.prueba-fila.jugando').count()) === 1, 'marca la que se está jugando');

    ok((await p.locator('#bitacora li').count()) === 1, 'la bitácora tiene una línea');
    ok(!(await p.isVisible('#campeon')), 'todavía no hay campeones');
    await p.close();
  }

  /* ---- sin torneo cargado: no tiene que romper ---- */
  console.log('\ntorneo.html sin datos');
  {
    const p = await b.newPage();
    p.on('pageerror', e => { console.log('  ✗ ERROR JS: ' + e.message); fallos++; });
    await p.addInitScript(ep => { window.FOKA_CONFIG = { endpoint: ep }; }, ENDPOINT);
    await p.route(ENDPOINT + '*', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, torneo: null })
    }));
    await p.goto(archivo('torneo.html'));
    await p.waitForFunction(() => !document.getElementById('vacio-tabla').classList.contains('oculto'));
    ok(await p.isVisible('#vacio-tabla'), 'avisa que todavía no hay parejas');
    ok((await p.textContent('#d-parejas')) === '0', 'cuenta 0 parejas');
    await p.close();
  }

  /* ============================ admin.html ============================ */
  console.log('\nadmin.html (la consola)');
  {
    const guardadas = [];
    const p = await nuevaPagina(b, guardadas);
    p.on('dialog', d => d.accept());
    await p.goto(archivo('admin.html'));

    /* 1. PIN equivocado */
    await p.fill('#pin', '9999');
    await p.click('#btn-entrar');
    await p.waitForSelector('#msg-pin.err');
    ok(/PIN incorrecto/.test(await p.textContent('#msg-pin')), 'rechaza el PIN equivocado');
    ok(await p.isVisible('#login'), 'no deja pasar');

    /* 2. PIN bueno */
    await p.fill('#pin', '1234');
    await p.click('#btn-entrar');
    await p.waitForSelector('#consola:not(.oculto)');
    ok(await p.isVisible('#consola'), 'con el PIN bueno entra');
    await p.waitForFunction(() => document.querySelectorAll('#participantes .item').length > 0);
    ok((await p.locator('#participantes .item').count()) === 4, 'trae los 4 jugadores del servidor');

    /* 3. traer confirmados de la planilla */
    await p.click('#btn-confirmados');
    await p.waitForFunction(() => document.querySelectorAll('#participantes .item').length === 5);
    ok((await p.locator('#participantes .item').count()) === 5, 'suma a Elsa, que faltaba');
    ok((await p.locator('#participantes .item.no-juega').count()) === 1, 'Elsa entra destildada porque no juega');

    /* 4. sumar a mano */
    await p.fill('#nuevos', 'Fran\nGabi');
    await p.click('#btn-sumar');
    ok((await p.locator('#participantes .item').count()) === 7, 'suma dos más a mano');

    /* 5. sortear */
    await p.click('#btn-sortear');
    await p.waitForFunction(() => document.querySelectorAll('#parejas .item').length >= 3);
    const parejas = await p.locator('#parejas .item').count();
    ok(parejas === 3, '6 que juegan → 3 parejas (Elsa queda afuera)', parejas);
    ok(/semilla \d+/.test(await p.textContent('#nota-sorteo')), 'avisa con qué semilla se sorteó');

    /* 6. cargar un puesto */
    await p.locator('.prueba-admin').first()
           .locator('.puntos-fila').first()
           .locator('button[data-m="oro"]').click();
    await p.waitForFunction(() => /10/.test(document.querySelector('#preview .pt').textContent));
    ok(/10/.test(await p.textContent('#preview li:first-child .pt')), 'el oro suma 10 en la vista previa');

    /* 7. ponerle nombre real a la prueba secreta */
    const secreta = p.locator('.prueba-admin').last();
    await secreta.locator('input.nombre-prueba').fill('Trivia del cumpleañero');
    await secreta.locator('input.detalle-prueba').fill('Diez preguntas sobre la foca.');
    ok(true, 'se le puede cambiar el nombre a una prueba desde la consola');

    /* 8. anotar en la bitácora */
    await p.fill('#nueva-nota', 'Se picó el mini golf');
    await p.click('#btn-anotar');
    ok(/Se picó el mini golf/.test(await p.textContent('#bitacora')), 'anota en la bitácora');

    /* 9. publicar */
    await p.click('#btn-publicar');
    await p.waitForSelector('#sync.ok');
    const publicado = guardadas.filter(g => g.tipo === 'torneo_guardar').pop();
    ok(!!publicado, 'manda el torneo al servidor');
    ok(publicado.pin === '1234', 'con el PIN');
    ok(publicado.torneo.parejas.length === 3, 'con las 3 parejas');
    ok(publicado.torneo.resultados.golf && Object.keys(publicado.torneo.resultados.golf).length === 1, 'con el puesto cargado');
    const sorpresa = publicado.torneo.pruebas.filter(pr => pr.secreta)[0];
    ok(sorpresa && sorpresa.nombre === 'Trivia del cumpleañero', 'y con el nombre nuevo de la prueba secreta');
    ok(/Publicado/.test(await p.textContent('#sync')), 'avisa que se publicó');
    await p.close();
  }

  /* ---- lo que no se publicó no se pierde al recargar ---- */
  console.log('\nadmin.html sin publicar (se corta internet, se recarga la página)');
  {
    const p = await nuevaPagina(b, []);
    p.on('dialog', d => d.accept());
    await p.goto(archivo('admin.html'));
    await p.fill('#pin', '1234');
    await p.click('#btn-entrar');
    await p.waitForSelector('#consola:not(.oculto)');

    await p.fill('#nuevos', 'Zoe');
    await p.click('#btn-sumar');
    ok(/sin publicar/.test(await p.textContent('#sync')), 'avisa que hay cambios sin publicar');

    await p.reload();                      // se cierra el navegador, se vuelve a abrir
    await p.waitForSelector('#consola:not(.oculto)');
    ok(await p.isVisible('#consola'), 'no vuelve a pedir el PIN en la misma sesión');
    await p.waitForFunction(() => document.querySelectorAll('#participantes .item').length > 0);
    ok(/Zoe/.test(await p.textContent('#participantes')), 'el jugador cargado sigue estando');
    ok(/sin publicar/.test(await p.textContent('#sync')), 'y sigue marcado como pendiente');
    await p.close();
  }

  /* ---- la primera publicación no tiene con qué chocar ---- */
  console.log('\nadmin.html publicando por primera vez');
  {
    const guardadas = [];
    const dialogos = [];
    const p = await b.newPage();
    p.on('pageerror', e => { console.log('  ✗ ERROR JS: ' + e.message); fallos++; });
    p.on('dialog', d => { dialogos.push(d.message()); d.accept(); });
    await p.addInitScript(ep => { window.FOKA_CONFIG = { endpoint: ep }; }, ENDPOINT);
    await p.route(ENDPOINT + '*', route => {
      const r = route.request();
      const j = c => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(c) });
      if (r.method() === 'GET') return j({ ok: true, torneo: null });   // planilla vacía
      const body = JSON.parse(r.postData());
      guardadas.push(body);
      return j({ ok: true, torneo: { actualizado: new Date().toISOString() } });
    });
    await p.goto(archivo('admin.html'));
    await p.fill('#pin', '1234');
    await p.click('#btn-entrar');
    await p.waitForSelector('#consola:not(.oculto)');

    await p.fill('#nuevos', 'Ana\nBeto\nCami\nDani');
    await p.click('#btn-sumar');
    await p.click('#btn-sortear');
    await p.waitForFunction(() => document.querySelectorAll('#parejas .item').length === 2);

    await p.click('#btn-publicar');
    await p.waitForSelector('#sync.ok');
    ok(!dialogos.some(m => /otro lado/.test(m)), 'no inventa un conflicto que no existe', dialogos);
    const publicado = guardadas.filter(g => g.tipo === 'torneo_guardar').pop();
    ok(!!publicado && publicado.torneo.parejas.length === 2, 'publica las 2 parejas');
    ok((await p.locator('#pruebas .prueba-admin').count()) === 5, 'arranca con las 5 pruebas de la kermesse');
    await p.close();
  }

  await b.close();
  console.log('\n' + (fallos ? fallos + ' prueba(s) fallaron ✗' : 'Todo bien 🦭'));
  process.exit(fallos ? 1 : 0);
})();

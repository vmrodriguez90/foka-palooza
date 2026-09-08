/* Prueba funcional rápida de los formularios contra un endpoint simulado. */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const file = 'file://' + path.resolve(__dirname, '..', 'index.html');

  // endpoint simulado
  await p.route('https://fake.endpoint/exec*', async route => {
    const url = route.request().url();
    if (url.includes('action=stats')) return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ok:true,confirmados:3,personas:7}) });
    const body = JSON.parse(route.request().postData());
    console.log('  → POST recibido:', JSON.stringify(body));
    return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ok:true}) });
  });

  await p.goto(file);
  await p.evaluate(() => { FOKA.endpoint = 'https://fake.endpoint/exec'; });

  // 1. validación: sin días marcados
  await p.fill('input[name=nombre]', 'Foka Rodríguez');
  await p.fill('#form-rsvp input[name=whatsapp]', '011 15 5555-5555');
  await p.click('#btn-rsvp');
  console.log('1. sin días  →', await p.textContent('#msg-rsvp'));

  // 2. número inválido
  await p.fill('#form-rsvp input[name=whatsapp]', '123');
  await p.click('.check:nth-child(2) span');
  await p.click('#btn-rsvp');
  console.log('2. tel malo  →', await p.textContent('#msg-rsvp'));

  // 3. envío correcto
  await p.fill('#form-rsvp input[name=whatsapp]', '011 15 5555-5555');
  await p.fill('textarea[name=mensaje]', 'Llevo el fernet');
  await p.click('#btn-rsvp');
  await p.waitForTimeout(500);
  console.log('3. ok        →', await p.textContent('#msg-rsvp'));
  console.log('   stats     →', await p.textContent('#stats'));

  // 4. alta al lineup
  await p.fill('#form-lineup input[name=whatsapp]', '+54 9 351 123-4567');
  await p.click('#btn-lineup');
  await p.waitForTimeout(400);
  console.log('4. lineup    →', await p.textContent('#msg-lineup'));

  // 5. .ics
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#btn-ics')]);
  console.log('5. calendario→', dl.suggestedFilename());

  // 6. countdown vivo
  console.log('6. contador  →', await p.textContent('#cd-d'), 'días /', await p.textContent('#cd-h'), 'hs');

  console.log(errs.length ? 'ERRORES JS: ' + errs.join(' | ') : '\nSin errores de JS ✓');
  await b.close();
})();

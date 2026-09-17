/* Verifica los links de WhatsApp que arma la planilla.
   Correlo con: node tools/test-links.js */
const fs = require('fs');
const gs = fs.readFileSync(require('path').resolve(__dirname, '..', 'apps-script', 'Codigo.gs'),'utf8');
for (const re of [/var URL_SITIO = .*?;/, /var URL_GRUPO = .*?;/, /function linkWhatsapp[\s\S]*?\n}/, /function mensajeGracias[\s\S]*?\n}/, /function mensajeLineup[\s\S]*?\n}/]) {
  eval(gs.match(re)[0]);
}
/* El link del grupo está escrito en cuatro archivos (no hay forma de
   compartirlo entre el HTML, el JS y el Apps Script). Que no se
   desincronicen es justamente lo que chequeamos acá. */
{
  const raiz = require('path').resolve(__dirname, '..');
  const leer = f => fs.readFileSync(require('path').join(raiz, f), 'utf8');
  const sacar = t => (t.match(/https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/g) || []);
  const esperado = sacar(leer('assets/config.js'))[0];
  console.log('\nLink del grupo: ' + (esperado || 'NO CONFIGURADO'));
  let mal = 0;
  for (const archivo of ['assets/config.js', 'index.html', 'torneo.html', 'apps-script/Codigo.gs']) {
    const encontrados = sacar(leer(archivo));
    const coincide = encontrados.length > 0 && encontrados.every(u => u === esperado);
    console.log('  ' + (coincide ? '✓' : '✗') + ' ' + archivo +
      (encontrados.length ? ' (' + encontrados.length + ')' : ' — no aparece'));
    if (!coincide) mal++;
  }
  if (mal) {
    console.log('\n  ⚠️  Hay copias del link del grupo que no coinciden.');
    process.exitCode = 1;
  }
}

const casos = [
  ['Confirmación',        linkWhatsapp('5492291456789', mensajeGracias('Victor Manuel Rodríguez', 'Viernes 25'))],
  ['Viene el sábado',     linkWhatsapp('5491155555555', mensajeGracias('Fede', 'Sábado 26'))],
  ['Viene los tres días', linkWhatsapp('5491155555555', mensajeGracias('Juli', 'Los tres'))],
  ['Sin nombre',          linkWhatsapp('5491155555555', mensajeGracias(''))],
  ['Aviso lineup',        linkWhatsapp('5493511234567', mensajeLineup())],
];
for (const [q, url] of casos) {
  console.log('\n' + q + ':');
  console.log('  ' + url);
  console.log('  → texto que ve la persona: "' + decodeURIComponent(url.split('?text=')[1]) + '"');
  const ok = /^https:\/\/wa\.me\/\d{10,15}\?text=[^\s"]+$/.test(url);
  console.log('  ' + (ok ? 'formato válido ✓' : 'FORMATO INVÁLIDO ✗'));
}

/* Verifica los links de WhatsApp que arma la planilla.
   Correlo con: node tools/test-links.js */
const fs = require('fs');
const gs = fs.readFileSync(require('path').resolve(__dirname, '..', 'apps-script', 'Codigo.gs'),'utf8');
for (const re of [/var URL_SITIO = .*?;/, /function linkWhatsapp[\s\S]*?\n}/, /function mensajeGracias[\s\S]*?\n}/, /function mensajeLineup[\s\S]*?\n}/]) {
  eval(gs.match(re)[0]);
}
const casos = [
  ['Confirmación', linkWhatsapp('5492291456789', mensajeGracias('Victor Manuel Rodríguez'))],
  ['Sin apellido',  linkWhatsapp('5491155555555', mensajeGracias('Fede'))],
  ['Sin nombre',    linkWhatsapp('5491155555555', mensajeGracias(''))],
  ['Aviso lineup',  linkWhatsapp('5493511234567', mensajeLineup())],
];
for (const [q, url] of casos) {
  console.log('\n' + q + ':');
  console.log('  ' + url);
  console.log('  → texto que ve la persona: "' + decodeURIComponent(url.split('?text=')[1]) + '"');
  const ok = /^https:\/\/wa\.me\/\d{10,15}\?text=[^\s"]+$/.test(url);
  console.log('  ' + (ok ? 'formato válido ✓' : 'FORMATO INVÁLIDO ✗'));
}

/* Casos de prueba del normalizador de WhatsApp de index.html.
   Correlo con: node tools/test-whatsapp.js
   Regla base: un número argentino son 10 dígitos (característica de
   2, 3 o 4 + abonado). Con el 15 del medio son 12. */
const fs = require('fs');
const site = fs.readFileSync(require('path').resolve(__dirname, '..', 'index.html'),'utf8');
eval(site.match(/function normalizarWhatsapp[\s\S]*?\n}/)[0]);
eval(site.match(/function whatsappValido[\s\S]*?\n}/)[0]);

const casos = [
  // --- característica de 2 dígitos (CABA/GBA: 11 + 8 dígitos) ---
  ['11 5555-5555',       '5491155555555'],
  ['011 15 5555-5555',   '5491155555555'],
  ['11 15 5555 5555',    '5491155555555'],
  ['+54 9 11 5555-5555', '5491155555555'],
  ['9 11 5555 5555',     '5491155555555'],
  ['54 11 5555 5555',    '5491155555553'.slice(0,12)+'3'],  // placeholder, se corrige abajo
  // --- ABONADO QUE EMPIEZA CON 15 (la trampa) ---
  ['11 1512-3456',       '5491115123456'],
  ['011 1512-3456',      '5491115123456'],
  // --- característica de 3 dígitos (Córdoba 351 + 7) ---
  ['351 512-3456',       '5493515123456'],
  ['0351 15 5123456',    '5493515123456'],
  // --- característica de 4 dígitos (2291 + 6) ---
  ['2291 456789',        '5492291456789'],
  ['02291 15 456789',    '5492291456789'],
  ['+54 9 2291 456789',  '5492291456789'],
  ['2966 421234',        '5492966421234'],   // Río Gallegos
  ['3541 401234',        '5493541401234'],   // Villa Carlos Paz
  // --- fuera de Argentina ---
  ['+598 99 123 456',    '59899123456'],
  ['+1 415 555 0100',    '14155550100'],
];
casos[5] = ['54 11 5555 5555', '5491155555555'];

let malos = 0;
for (const [entrada, esperado] of casos) {
  const got = normalizarWhatsapp(entrada);
  const ok = got === esperado && whatsappValido(got);
  if (!ok) malos++;
  console.log((ok?'  ok  ':'  ✗   ') + JSON.stringify(entrada).padEnd(22) + '-> ' + got +
              ' (' + got.length + ')' + (ok ? '' : '   ESPERABA ' + esperado));
}

console.log('\n-- rechazos esperados --');
for (const malo of ['123', '11 5555', '5555-5555', '', 'hola']) {
  const d = normalizarWhatsapp(malo);
  const rechazado = !whatsappValido(d);
  if (!rechazado) malos++;
  console.log((rechazado?'  ok  ':'  ✗   ') + JSON.stringify(malo).padEnd(14) + '-> ' + (rechazado ? 'rechazado' : 'ACEPTADO ' + d));
}
console.log(malos ? `\n${malos} caso(s) fallan` : '\nTodos los casos pasan ✓');

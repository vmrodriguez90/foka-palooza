/* Corre apps-script/Codigo.gs en node contra una planilla de mentira.
   Sirve para probar el backend sin tener que implementar en Google cada vez.
   Correlo con: node tools/test-apps-script.js */
const fs = require('fs');
const path = require('path');

let fallos = 0;
const ok = (cond, que, extra) => {
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + que + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''));
  if (!cond) fallos++;
};
const titulo = t => console.log('\n' + t);

/* ================= PLANILLA DE MENTIRA ================= */
/* Lo justo de la API de Google Sheets para que Codigo.gs corra igual. */

function columnaANumero(letras) {
  let n = 0;
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64);
  return n;
}

function hojaFalsa(nombre) {
  const datos = [];            // matriz de valores, 1-based por afuera
  const MAX_FILAS = 500;

  const asegurar = (fila, col) => {
    while (datos.length < fila) datos.push([]);
    const f = datos[fila - 1];
    while (f.length < col) f.push('');
    return f;
  };
  const vacio = v => v === '' || v === null || v === undefined;

  const hoja = {
    getName: () => nombre,
    getMaxRows: () => MAX_FILAS,
    getLastRow() {
      for (let i = datos.length; i >= 1; i--) {
        if ((datos[i - 1] || []).some(v => !vacio(v))) return i;
      }
      return 0;
    },
    getLastColumn() {
      let max = 0;
      datos.forEach(f => f.forEach((v, i) => { if (!vacio(v)) max = Math.max(max, i + 1); }));
      return max;
    },
    appendRow(valores) {
      const fila = this.getLastRow() + 1;
      valores.forEach((v, i) => { asegurar(fila, i + 1)[i] = v; });
    },
    setFrozenRows() { return hoja; },
    setColumnWidth() { return hoja; },
    getRange(a, b, c, d) {
      let f0, c0, nf, nc;
      if (typeof a === 'string') {
        const m = a.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
        if (!m) throw new Error('Rango que el test no sabe leer: ' + a);
        c0 = columnaANumero(m[1]); f0 = parseInt(m[2], 10);
        nc = m[3] ? columnaANumero(m[3]) - c0 + 1 : 1;
        nf = m[4] ? parseInt(m[4], 10) - f0 + 1 : 1;
      } else {
        f0 = a; c0 = b; nf = c || 1; nc = d || 1;
      }
      const rango = {
        getValues() {
          const salida = [];
          for (let i = 0; i < nf; i++) {
            const fila = [];
            for (let j = 0; j < nc; j++) fila.push(asegurar(f0 + i, c0 + j)[c0 + j - 1]);
            salida.push(fila);
          }
          return salida;
        },
        setValues(m) {
          m.forEach((fila, i) => fila.forEach((v, j) => { asegurar(f0 + i, c0 + j)[c0 + j - 1] = v; }));
          return rango;
        },
        getValue() { return rango.getValues()[0][0]; },
        setValue(v) { asegurar(f0, c0)[c0 - 1] = v; return rango; },
        setNumberFormat: () => rango,
        setFontWeight: () => rango,
        setBackground: () => rango,
        setFontColor: () => rango
      };
      return rango;
    },
    /* atajo para los tests */
    filas: () => datos.map(f => f.slice())
  };
  return hoja;
}

function cargarBackend() {
  const codigo = fs.readFileSync(path.resolve(__dirname, '..', 'apps-script', 'Codigo.gs'), 'utf8');
  const hojas = new Map();
  const props = {};
  const libro = {
    getSheetByName: n => hojas.get(n) || null,
    insertSheet: n => { const h = hojaFalsa(n); hojas.set(n, h); return h; }
  };
  const entorno = {
    SpreadsheetApp: { getActiveSpreadsheet: () => libro },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: k => (k in props ? props[k] : null),
        setProperty: (k, v) => { props[k] = String(v); }
      })
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(texto) { return { texto, setMimeType() { return this; } }; }
    },
    Logger: { log: () => {} }
  };
  const nombres = Object.keys(entorno);
  /* Las funciones declaradas adentro de un new Function son locales, así
     que hay que devolver a mano las que usan los tests. */
  const fabrica = new Function(...nombres, codigo +
    '\nreturn { doGet, doPost, inicializar, configurarPin, hayPin, estadisticas, numerosParaAvisar };');
  const api = fabrica.apply({}, nombres.map(n => entorno[n]));
  return {
    api, hojas, props, libro,
    /* Llama al endpoint como lo haría la web y devuelve el JSON parseado. */
    post: cuerpo => JSON.parse(api.doPost({ postData: { contents: JSON.stringify(cuerpo) } }).texto),
    get: parametros => JSON.parse(api.doGet({ parameter: parametros || {} }).texto)
  };
}

/* ================= PRUEBAS ================= */

titulo('Arranque');
{
  const b = cargarBackend();
  b.api.inicializar();
  ok(!!b.hojas.get('Confirmaciones'), 'crea la hoja Confirmaciones');
  ok(!!b.hojas.get('Avisos Lineup'), 'crea la hoja Avisos Lineup');
  ok(!!b.hojas.get('Torneo'), 'crea la hoja Torneo');
  const encabezados = b.hojas.get('Confirmaciones').getRange(1, 1, 1, 11).getValues()[0];
  ok(encabezados[10] === 'Juega Kermesse', 'la última columna es la de la kermesse', encabezados[10]);
  ok(b.get({}).ok, 'el ping de salud responde ok');
}

titulo('Confirmaciones');
{
  const b = cargarBackend();
  const r = b.post({
    tipo: 'confirmacion', nombre: 'Ana Pérez', whatsapp: '5492291456789',
    dias: 'Los tres', acompaniantes: '2', dieta: 'De todo',
    mensaje: 'Llevo el fernet', avisar_lineup: 'Sí', kermesse: 'Sí', origen: 'https://fokapalooza.ar/'
  });
  ok(r.ok && r.tipo === 'confirmacion', 'guarda la confirmación');
  ok(r.personas === 2, 'cuenta las 2 personas', r.personas);

  const fila = b.hojas.get('Confirmaciones').getRange(2, 1, 1, 11).getValues()[0];
  ok(fila[1] === 'Ana Pérez', 'guarda el nombre');
  ok(fila[2] === '5492291456789', 'guarda el número normalizado');
  ok(/^https:\/\/wa\.me\/5492291456789\?text=/.test(fila[3]), 'arma el link de WhatsApp');
  ok(fila[10] === 'Sí', 'marca que juega la kermesse');
  ok(b.hojas.get('Avisos Lineup').getLastRow() === 2, 'lo suma también a los avisos');

  /* el mismo número otra vez: corrige, no duplica */
  const r2 = b.post({ tipo: 'confirmacion', nombre: 'Ana Pérez', whatsapp: '5492291456789', dias: 'Sábado 26', acompaniantes: '1', kermesse: 'No' });
  ok(r2.actualizado === true, 'la segunda vez actualiza la fila');
  ok(b.hojas.get('Confirmaciones').getLastRow() === 2, 'sigue habiendo una sola fila');
  ok(b.hojas.get('Confirmaciones').getRange(2, 11).getValue() === 'No', 'y le cambia la kermesse a No');

  ok(b.post({ tipo: 'confirmacion', nombre: 'Bot', whatsapp: '5491155555555', trampa: 'x' }).ignorado === true, 'el honeypot descarta al bot');
  ok(b.post({ tipo: 'confirmacion', nombre: 'Sin tel', whatsapp: '123' }).ok === false, 'rechaza un número inválido');
  ok(b.post({ tipo: 'confirmacion', whatsapp: '5491155555555' }).ok === false, 'rechaza si falta el nombre');
}

titulo('Planilla vieja, sin la columna de la kermesse');
{
  const b = cargarBackend();
  /* simulamos la hoja como estaba antes: 10 columnas */
  const vieja = b.libro.insertSheet('Confirmaciones');
  vieja.appendRow(['Fecha', 'Nombre', 'WhatsApp', 'Escribirle', 'Días', 'Personas', 'Dieta', 'Mensaje', 'Quiere aviso lineup', 'Origen']);
  vieja.appendRow([new Date(), 'Vieja Foka', '5491155555555', '', 'Los tres', 1, 'De todo', '', 'Sí', '']);

  b.post({ tipo: 'confirmacion', nombre: 'Nueva Foka', whatsapp: '5493511234567', dias: 'Sábado 26', kermesse: 'Sí' });
  ok(vieja.getRange(1, 11).getValue() === 'Juega Kermesse', 'le escribe el encabezado que faltaba');
  ok(vieja.getRange(3, 11).getValue() === 'Sí', 'y guarda el dato nuevo en su columna');
  ok(vieja.getRange(2, 2).getValue() === 'Vieja Foka', 'sin tocar las filas que ya estaban');
}

titulo('Torneo: leer y escribir');
{
  const b = cargarBackend();
  b.api.inicializar();

  ok(b.get({ action: 'torneo' }).torneo === null, 'sin nada cargado devuelve null');

  const torneo = { fase: 'jugando', parejas: [{ id: 'd1', nombre: 'Las Focas', integrantes: ['p1'] }], bitacora: [] };
  ok(b.post({ tipo: 'torneo_guardar', pin: '1234', torneo }).ok === false, 'sin PIN configurado no deja guardar');

  b.api.configurarPin('foka2026');
  ok(b.props.PIN_TORNEO === 'foka2026', 'configurarPin lo guarda en las propiedades');
  ok(b.api.hayPin() === true, 'hayPin lo confirma');

  ok(b.post({ tipo: 'torneo_ping', pin: 'otro' }).ok === false, 'el PIN equivocado no entra');
  ok(b.post({ tipo: 'torneo_ping', pin: 'foka2026' }).ok === true, 'el PIN bueno sí');

  const guardado = b.post({ tipo: 'torneo_guardar', pin: 'foka2026', torneo });
  ok(guardado.ok === true, 'guarda el torneo');
  ok(!!guardado.torneo.actualizado, 'devuelve cuándo lo guardó');

  const leido = b.get({ action: 'torneo' });
  ok(leido.ok && leido.torneo.fase === 'jugando', 'y después se lee igual');
  ok(leido.torneo.parejas[0].nombre === 'Las Focas', 'con las parejas adentro');
  ok(leido.torneo.actualizado === guardado.torneo.actualizado, 'con la fecha que puso el servidor');
  ok(b.hojas.get('Torneo').getRange('B3').getValue() instanceof Date, 'deja la fecha legible en la planilla');

  /* pisarlo funciona */
  b.post({ tipo: 'torneo_guardar', pin: 'foka2026', torneo: { fase: 'terminado', parejas: [] } });
  ok(b.get({ action: 'torneo' }).torneo.fase === 'terminado', 'la segunda publicación pisa la primera');

  ok(b.post({ tipo: 'torneo_guardar', pin: 'foka2026' }).ok === false, 'sin torneo en el cuerpo, error');
  ok(b.post({ tipo: 'torneo_cualquiera', pin: 'foka2026' }).ok === false, 'una acción inventada no hace nada');
}

titulo('Torneo: traer los confirmados');
{
  const b = cargarBackend();
  b.api.inicializar();
  b.api.configurarPin('foka2026');
  b.post({ tipo: 'confirmacion', nombre: 'Ana', whatsapp: '5492291456789', dias: 'Los tres', kermesse: 'Sí' });
  b.post({ tipo: 'confirmacion', nombre: 'Beto', whatsapp: '5491155555555', dias: 'Sábado 26', kermesse: 'No' });

  ok(b.post({ tipo: 'torneo_confirmados', pin: 'mal' }).ok === false, 'pide el PIN');

  const r = b.post({ tipo: 'torneo_confirmados', pin: 'foka2026' });
  ok(r.ok && r.confirmados.length === 2, 'trae los dos confirmados');
  ok(r.confirmados[0].nombre === 'Ana' && r.confirmados[0].kermesse === 'Sí', 'con su nombre y si juega');
  ok(r.confirmados[1].kermesse === 'No', 'y respeta al que dijo que no juega');
  ok(!('whatsapp' in r.confirmados[0]), 'no manda teléfonos');
}

console.log('\n' + (fallos ? fallos + ' prueba(s) fallaron ✗' : 'Todo bien 🦭'));
process.exit(fallos ? 1 : 0);

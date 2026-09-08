/**
 * FOKA PALOOZA 2026 — backend de confirmaciones
 * ------------------------------------------------------------------
 * Google Apps Script que expone un endpoint HTTP y guarda cada
 * confirmación / suscripción al lineup en una hoja de cálculo.
 *
 * Cómo se usa (paso a paso en el README del repo):
 *   1. Crear una planilla nueva en Google Sheets.
 *   2. Extensiones > Apps Script, pegar este archivo.
 *   3. Implementar > Nueva implementación > Aplicación web
 *      - Ejecutar como: Yo
 *      - Quién tiene acceso: Cualquier usuario
 *   4. Copiar la URL /exec y pegarla en FOKA.endpoint de index.html
 *
 * Acepta POST con JSON en el body, y también GET con parámetros
 * (ej: ?tipo=lineup&email=foo@bar.com) por si querés probar desde
 * la barra del navegador.
 * ------------------------------------------------------------------
 */

var HOJA_CONFIRMACIONES = 'Confirmaciones';
var HOJA_LINEUP = 'Avisos Lineup';

var COLUMNAS = {
  confirmacion: ['Fecha', 'Nombre', 'Email', 'Días', 'Personas', 'Dieta', 'Mensaje', 'Quiere aviso lineup', 'Origen'],
  lineup:       ['Fecha', 'Email', 'Origen']
};

/* ====================== ENTRADAS HTTP ====================== */

function doPost(e) {
  try {
    var datos = leerDatos(e);
    return json(procesar(datos));
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};

    // ?action=stats -> devuelve el conteo para el contador de la web
    if (params.action === 'stats') {
      return json(estadisticas());
    }

    // Sin parámetros útiles: ping de salud
    if (!params.tipo) {
      return json({ ok: true, servicio: 'Foka Palooza 2026', mensaje: 'Endpoint activo 🦭' });
    }

    return json(procesar(params));
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

/* ====================== LÓGICA ====================== */

function leerDatos(e) {
  // Body JSON (lo que manda la web)
  if (e && e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {
      // Si vino como form-urlencoded, cae en e.parameter
    }
  }
  return (e && e.parameter) || {};
}

function procesar(d) {
  // Honeypot: los bots completan campos ocultos, las personas no.
  if (d.trampa) {
    return { ok: true, ignorado: true };
  }

  var tipo = String(d.tipo || 'confirmacion').toLowerCase();
  var email = String(d.email || '').trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: 'Email inválido' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000); // evita que dos envíos simultáneos pisen la misma fila
  try {
    if (tipo === 'lineup') {
      return guardarLineup(email, d);
    }
    return guardarConfirmacion(email, d);
  } finally {
    lock.releaseLock();
  }
}

function guardarConfirmacion(email, d) {
  var nombre = String(d.nombre || '').trim();
  if (!nombre) return { ok: false, error: 'Falta el nombre' };

  var hoja = hojaCon(HOJA_CONFIRMACIONES, COLUMNAS.confirmacion);
  var personas = Math.max(1, Math.min(20, parseInt(d.acompaniantes, 10) || 1));
  var quiereLineup = String(d.avisar_lineup || '').toLowerCase();
  quiereLineup = (quiereLineup === 'si' || quiereLineup === 'sí' || quiereLineup === 'true') ? 'Sí' : 'No';

  var fila = actualizarOAgregar(hoja, 2 /* col Email */, email, [
    new Date(),
    nombre,
    email,
    String(d.dias || ''),
    personas,
    String(d.dieta || ''),
    String(d.mensaje || ''),
    quiereLineup,
    String(d.origen || '')
  ]);

  // Si además pidió el aviso del lineup, lo sumamos a la otra hoja
  if (quiereLineup === 'Sí') {
    guardarLineup(email, d);
  }

  var stats = estadisticas();
  return {
    ok: true,
    tipo: 'confirmacion',
    actualizado: fila.actualizado,
    personas: stats.personas,
    confirmados: stats.confirmados
  };
}

function guardarLineup(email, d) {
  var hoja = hojaCon(HOJA_LINEUP, COLUMNAS.lineup);
  var res = actualizarOAgregar(hoja, 1 /* col Email */, email, [
    new Date(),
    email,
    String(d.origen || '')
  ]);
  return { ok: true, tipo: 'lineup', actualizado: res.actualizado };
}

/**
 * Escribe la fila. Si el email ya existe, la reemplaza en lugar de
 * duplicarla (así alguien puede corregir su confirmación).
 * indiceEmail es la posición del email DENTRO del array de valores (0-based).
 */
function actualizarOAgregar(hoja, indiceEmail, email, valores) {
  var ultima = hoja.getLastRow();
  if (ultima > 1) {
    var col = indiceEmail + 1;
    var existentes = hoja.getRange(2, col, ultima - 1, 1).getValues();
    for (var i = 0; i < existentes.length; i++) {
      if (String(existentes[i][0]).trim().toLowerCase() === email.toLowerCase()) {
        hoja.getRange(i + 2, 1, 1, valores.length).setValues([valores]);
        return { actualizado: true, fila: i + 2 };
      }
    }
  }
  hoja.appendRow(valores);
  return { actualizado: false, fila: hoja.getLastRow() };
}

function hojaCon(nombre, encabezados) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(nombre);
  if (!hoja) {
    hoja = ss.insertSheet(nombre);
  }
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(encabezados);
    hoja.getRange(1, 1, 1, encabezados.length)
        .setFontWeight('bold')
        .setBackground('#0B3C49')
        .setFontColor('#E0F7F5');
    hoja.setFrozenRows(1);
  }
  return hoja;
}

function estadisticas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(HOJA_CONFIRMACIONES);
  if (!hoja || hoja.getLastRow() < 2) {
    return { ok: true, confirmados: 0, personas: 0 };
  }
  var personasCol = hoja.getRange(2, 5, hoja.getLastRow() - 1, 1).getValues();
  var total = 0;
  for (var i = 0; i < personasCol.length; i++) {
    total += parseInt(personasCol[i][0], 10) || 1;
  }
  return { ok: true, confirmados: personasCol.length, personas: total };
}

/* ====================== UTILIDADES ====================== */

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Ejecutá esta función una vez desde el editor de Apps Script para
 * crear las hojas con sus encabezados y aceptar los permisos.
 */
function inicializar() {
  hojaCon(HOJA_CONFIRMACIONES, COLUMNAS.confirmacion);
  hojaCon(HOJA_LINEUP, COLUMNAS.lineup);
  Logger.log('Hojas listas 🦭');
}

/**
 * Devuelve los emails de quienes pidieron el aviso del lineup,
 * separados por coma, listos para pegar en el campo CCO del mail.
 */
function emailsParaAvisar() {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_LINEUP);
  if (!hoja || hoja.getLastRow() < 2) {
    Logger.log('Todavía no hay nadie anotado.');
    return '';
  }
  var emails = hoja.getRange(2, 2, hoja.getLastRow() - 1, 1)
                   .getValues()
                   .map(function (f) { return String(f[0]).trim(); })
                   .filter(String);
  var lista = emails.join(', ');
  Logger.log(lista);
  return lista;
}

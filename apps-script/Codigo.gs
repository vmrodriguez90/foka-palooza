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

// Sitio del evento: va dentro de los mensajes de WhatsApp que arma la
// planilla. Cambialo acá si el dominio cambia (y acordate de volver a
// implementar el script para que tome el cambio).
var URL_SITIO = 'https://fokapalooza.ar';

var COLUMNAS = {
  confirmacion: ['Fecha', 'Nombre', 'WhatsApp', 'Escribirle', 'Días', 'Personas', 'Dieta', 'Mensaje', 'Quiere aviso lineup', 'Origen'],
  lineup:       ['Fecha', 'WhatsApp', 'Escribirle', 'Origen']
};

// Columnas que se guardan como texto plano, para que la planilla no
// convierta los números largos a notación científica.
var COLUMNAS_TEXTO = { confirmacion: [3], lineup: [2] };

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

  // La web ya manda el número normalizado (solo dígitos, con código de país).
  // Acá igual lo limpiamos, por si el endpoint se llama a mano por GET.
  var whatsapp = String(d.whatsapp || '').replace(/\D/g, '');

  // Argentina son 13 dígitos: 54 + 9 + los 10 del número (la característica
  // puede ser de 2, 3 o 4: 11, 351, 2291...). Del resto del mundo aceptamos
  // un rango amplio porque cada país tiene su largo.
  var valido = whatsapp.indexOf('549') === 0
    ? whatsapp.length === 13
    : (whatsapp.length >= 10 && whatsapp.length <= 15);

  if (!valido) {
    return { ok: false, error: 'Número de WhatsApp inválido' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000); // evita que dos envíos simultáneos pisen la misma fila
  try {
    if (tipo === 'lineup') {
      return guardarLineup(whatsapp, d);
    }
    return guardarConfirmacion(whatsapp, d);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Link directo de WhatsApp. Pegado en la planilla queda clickeable:
 * se abre el chat con esa persona sin tener que agendar el número.
 */
function linkWhatsapp(numero, mensaje) {
  var url = 'https://wa.me/' + numero;
  if (mensaje) {
    url += '?text=' + encodeURIComponent(mensaje);
  }
  return url;
}

/** Mensaje que se abre al tocar el link de alguien que ya confirmó. */
function mensajeGracias(nombre) {
  var primero = String(nombre || '').trim().split(/\s+/)[0];
  var saludo = primero ? '¡Hola ' + primero + '! ' : '¡Hola! ';
  return saludo + '🦭 Gracias por confirmar al Foka Palooza. '
       + 'Toda la info está en ' + URL_SITIO;
}

/** Mensaje para avisar que salió el lineup. */
function mensajeLineup() {
  return '🦭 ¡El lineup del Foka Palooza ya está confirmado! '
       + 'Entrá a ' + URL_SITIO;
}

function guardarConfirmacion(whatsapp, d) {
  var nombre = String(d.nombre || '').trim();
  if (!nombre) return { ok: false, error: 'Falta el nombre' };

  var hoja = hojaCon(HOJA_CONFIRMACIONES, COLUMNAS.confirmacion, COLUMNAS_TEXTO.confirmacion);
  var personas = Math.max(1, Math.min(20, parseInt(d.acompaniantes, 10) || 1));
  var quiereLineup = String(d.avisar_lineup || '').toLowerCase();
  quiereLineup = (quiereLineup === 'si' || quiereLineup === 'sí' || quiereLineup === 'true') ? 'Sí' : 'No';

  var fila = actualizarOAgregar(hoja, 2 /* col WhatsApp */, whatsapp, [
    new Date(),
    nombre,
    whatsapp,
    linkWhatsapp(whatsapp, mensajeGracias(nombre)),
    String(d.dias || ''),
    personas,
    String(d.dieta || ''),
    String(d.mensaje || ''),
    quiereLineup,
    String(d.origen || '')
  ]);

  // Si además pidió el aviso del lineup, lo sumamos a la otra hoja
  if (quiereLineup === 'Sí') {
    guardarLineup(whatsapp, d);
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

function guardarLineup(whatsapp, d) {
  var hoja = hojaCon(HOJA_LINEUP, COLUMNAS.lineup, COLUMNAS_TEXTO.lineup);
  var res = actualizarOAgregar(hoja, 1 /* col WhatsApp */, whatsapp, [
    new Date(),
    whatsapp,
    linkWhatsapp(whatsapp, mensajeLineup()),
    String(d.origen || '')
  ]);
  return { ok: true, tipo: 'lineup', actualizado: res.actualizado };
}

/**
 * Escribe la fila. Si el número ya existe, la reemplaza en lugar de
 * duplicarla (así alguien puede corregir su confirmación).
 * indiceClave es la posición del WhatsApp DENTRO del array de valores (0-based).
 */
function actualizarOAgregar(hoja, indiceClave, clave, valores) {
  var ultima = hoja.getLastRow();
  if (ultima > 1) {
    var col = indiceClave + 1;
    var existentes = hoja.getRange(2, col, ultima - 1, 1).getValues();
    for (var i = 0; i < existentes.length; i++) {
      if (String(existentes[i][0]).trim() === clave) {
        hoja.getRange(i + 2, 1, 1, valores.length).setValues([valores]);
        return { actualizado: true, fila: i + 2 };
      }
    }
  }
  hoja.appendRow(valores);
  return { actualizado: false, fila: hoja.getLastRow() };
}

function hojaCon(nombre, encabezados, columnasTexto) {
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

    // El número de WhatsApp va como texto: si no, la planilla lo muestra
    // como 5,49115E+12 y deja de servir para nada.
    (columnasTexto || []).forEach(function (col) {
      hoja.getRange(2, col, hoja.getMaxRows() - 1, 1).setNumberFormat('@');
    });
  }
  return hoja;
}

function estadisticas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(HOJA_CONFIRMACIONES);
  if (!hoja || hoja.getLastRow() < 2) {
    return { ok: true, confirmados: 0, personas: 0 };
  }
  var personasCol = hoja.getRange(2, 6, hoja.getLastRow() - 1, 1).getValues();
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
  hojaCon(HOJA_CONFIRMACIONES, COLUMNAS.confirmacion, COLUMNAS_TEXTO.confirmacion);
  hojaCon(HOJA_LINEUP, COLUMNAS.lineup, COLUMNAS_TEXTO.lineup);
  Logger.log('Hojas listas 🦭');
}

/**
 * Lista los números de quienes pidieron el aviso del lineup, para armar
 * una lista de difusión de WhatsApp, más el link directo de cada uno.
 * Ejecutala desde el editor y mirá Ver > Registro de ejecución.
 */
function numerosParaAvisar() {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_LINEUP);
  if (!hoja || hoja.getLastRow() < 2) {
    Logger.log('Todavía no hay nadie anotado.');
    return '';
  }
  var numeros = hoja.getRange(2, 2, hoja.getLastRow() - 1, 1)
                    .getValues()
                    .map(function (f) { return String(f[0]).trim(); })
                    .filter(String);

  Logger.log('%s número(s) anotados:', numeros.length);
  Logger.log(numeros.map(function (n) { return '+' + n; }).join(', '));
  Logger.log('---- links directos ----');
  Logger.log(numeros.map(function (n) {
    return linkWhatsapp(n, mensajeLineup());
  }).join('\n'));
  return numeros;
}

/**
 * FOKA PALOOZA 2026 — backend de confirmaciones
 * ------------------------------------------------------------------
 * Google Apps Script que expone un endpoint HTTP y guarda en una
 * planilla las confirmaciones, los avisos de WhatsApp y el estado de
 * La Foka Kermesse (el torneo por parejas del sábado).
 *
 * Cómo se usa (paso a paso en el README del repo):
 *   1. Crear una planilla nueva en Google Sheets.
 *   2. Extensiones > Apps Script, pegar este archivo.
 *   3. Implementar > Nueva implementación > Aplicación web
 *      - Ejecutar como: Yo
 *      - Quién tiene acceso: Cualquier usuario
 *   4. Copiar la URL /exec y pegarla en assets/config.js
 *   5. Para el torneo: poner el PIN del admin (ver configurarPin).
 *
 * Acepta POST con JSON en el body, y también GET con parámetros
 * (ej: ?tipo=lineup&whatsapp=5491155555555) por si querés probar desde
 * la barra del navegador.
 * ------------------------------------------------------------------
 */

var HOJA_CONFIRMACIONES = 'Confirmaciones';
var HOJA_LINEUP = 'Avisos Lineup';
var HOJA_TORNEO = 'Torneo';

// Sitio del evento: va dentro de los mensajes de WhatsApp que arma la
// planilla. Cambialo acá si el dominio cambia (y acordate de volver a
// implementar el script para que tome el cambio).
var URL_SITIO = 'https://fokapalooza.ar';

// Grupo de WhatsApp con las novedades del finde. Va dentro de los
// mensajes que arma la planilla. Si regenerás el link de invitación,
// cambialo acá y también en assets/config.js, index.html y torneo.html.
var URL_GRUPO = 'https://chat.whatsapp.com/JV6Nd6GpgEjBdTMVPJ9eah';

var COLUMNAS = {
  confirmacion: ['Fecha', 'Nombre', 'WhatsApp', 'Escribirle', 'Días', 'Personas', 'Dieta', 'Mensaje', 'Quiere aviso lineup', 'Origen', 'Juega Kermesse'],
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

    // ?action=torneo -> estado de La Foka Kermesse (lo lee torneo.html).
    // Es público a propósito: la tabla se mira sin contraseña.
    if (params.action === 'torneo') {
      return json(torneoLeer());
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

  // Las acciones del torneo no tienen WhatsApp: se atienden antes de
  // validar el número. Todas piden PIN menos la lectura, que va por GET.
  if (tipo.indexOf('torneo') === 0) {
    return torneoAccion(tipo, d);
  }

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

/**
 * Mensaje que se abre al tocar el link de alguien que ya confirmó.
 * Si viene el sábado (o los tres días), le sumamos el recordatorio de las
 * sábanas: ese día es en La Foka House y ahí duerme el que se queda.
 * El link va SIEMPRE al final, para que WhatsApp no se coma la URL.
 */
function mensajeGracias(nombre, dias) {
  var primero = String(nombre || '').trim().split(/\s+/)[0];
  var saludo = primero ? '¡Hola ' + primero + '! ' : '¡Hola! ';
  var duerme = String(dias || '');
  var sabanas = (duerme.indexOf('Sábado') !== -1 || duerme.indexOf('Los tres') !== -1)
    ? 'Si parás en La Foka House, traé sábanas 🛏️. '
    : '';
  return saludo + '🦭 Gracias por confirmar al Foka Palooza. ' + sabanas
       + 'Toda la info está en ' + URL_SITIO
       + ' y las novedades salen por el grupo: ' + URL_GRUPO;
}

/** Mensaje de los avisos del finde (antes era el del lineup). */
function mensajeLineup() {
  return '🦭 Foka Palooza: viernes pool en HISTER Beer Garden, sábado '
       + 'sanguches y La Foka Kermesse en La Foka House, domingo playa en '
       + 'El Náutico. Toda la info en ' + URL_SITIO
       + ' y el grupo del finde es ' + URL_GRUPO;
}

/** 'Sí' / 'No' a partir de lo que mande el formulario. */
function siONo(valor) {
  var v = String(valor || '').toLowerCase();
  return (v === 'si' || v === 'sí' || v === 'true' || v === '1') ? 'Sí' : 'No';
}

function guardarConfirmacion(whatsapp, d) {
  var nombre = String(d.nombre || '').trim();
  if (!nombre) return { ok: false, error: 'Falta el nombre' };

  var hoja = hojaCon(HOJA_CONFIRMACIONES, COLUMNAS.confirmacion, COLUMNAS_TEXTO.confirmacion);
  var personas = Math.max(1, Math.min(20, parseInt(d.acompaniantes, 10) || 1));
  var quiereLineup = siONo(d.avisar_lineup);
  // Si el campo no viene (confirmaciones viejas o un GET a mano), damos
  // por hecho que juega: es más fácil destildarlo desde la consola que
  // andar preguntando uno por uno.
  var juegaKermesse = d.kermesse === undefined ? 'Sí' : siONo(d.kermesse);

  var fila = actualizarOAgregar(hoja, 2 /* col WhatsApp */, whatsapp, [
    new Date(),
    nombre,
    whatsapp,
    linkWhatsapp(whatsapp, mensajeGracias(nombre, d.dias)),
    String(d.dias || ''),
    personas,
    String(d.dieta || ''),
    String(d.mensaje || ''),
    quiereLineup,
    String(d.origen || ''),
    juegaKermesse
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
  if (hoja.getLastRow() > 0) {
    // La hoja ya existía de antes: si le agregamos columnas nuevas al
    // final (por ejemplo "Juega Kermesse"), le escribimos el encabezado
    // que le falta en vez de dejar una columna sin título.
    agregarEncabezadosQueFalten(hoja, encabezados);
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

/**
 * Escribe los encabezados que falten a la derecha. Agregar columnas al
 * final es seguro; cambiarlas de orden no (hay que tocar COLUMNAS).
 */
function agregarEncabezadosQueFalten(hoja, encabezados) {
  var ancho = hoja.getLastColumn();
  if (ancho >= encabezados.length) return;
  var faltan = encabezados.slice(ancho);
  hoja.getRange(1, ancho + 1, 1, faltan.length)
      .setValues([faltan])
      .setFontWeight('bold')
      .setBackground('#0B3C49')
      .setFontColor('#E0F7F5');
}

/* ====================== LA FOKA KERMESSE ====================== */
/*
 * El torneo entero es un solo objeto JSON (parejas, pruebas, puntos y
 * bitácora) guardado en una celda de la hoja "Torneo".
 *
 *   - Leerlo es público:   GET  ?action=torneo        -> lo usa torneo.html
 *   - Escribirlo pide PIN: POST {tipo:'torneo_guardar', pin, torneo}
 *
 * El PIN se guarda en las propiedades del script, NO en el código ni en
 * el repositorio. Ver configurarPin() acá abajo.
 */

var CELDA_TORNEO = 'B2';        // donde vive el JSON
var CELDA_ACTUALIZADO = 'B3';   // la misma fecha, legible para humanos
var MAXIMO_JSON = 45000;        // una celda de Sheets aguanta 50.000 caracteres

function torneoAccion(tipo, d) {
  if (tipo === 'torneo_ping') {           // el admin probando el PIN
    verificarPin(d.pin);
    return { ok: true, tipo: 'torneo_ping' };
  }
  if (tipo === 'torneo_leer') {
    return torneoLeer();
  }
  if (tipo === 'torneo_confirmados') {
    return torneoConfirmados(d);
  }
  if (tipo === 'torneo_guardar') {
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);                 // que no publiquen dos a la vez
    try {
      return torneoGuardar(d);
    } finally {
      lock.releaseLock();
    }
  }
  return { ok: false, error: 'Acción de torneo desconocida: ' + tipo };
}

function hojaTorneo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(HOJA_TORNEO);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_TORNEO);
  }
  if (hoja.getLastRow() === 0) {
    hoja.getRange('A1:B1').setValues([['Qué', 'Valor']])
        .setFontWeight('bold').setBackground('#0B3C49').setFontColor('#E0F7F5');
    hoja.getRange('A2').setValue('Estado del torneo (JSON — no editar a mano)');
    hoja.getRange('A3').setValue('Última publicación');
    hoja.setColumnWidth(1, 260);
    hoja.getRange(CELDA_TORNEO).setNumberFormat('@'); // texto, no fórmula
  }
  return hoja;
}

/** Estado actual del torneo. Si no hay nada guardado, devuelve null. */
function torneoLeer() {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_TORNEO);
  if (!hoja) return { ok: true, torneo: null };
  var crudo = String(hoja.getRange(CELDA_TORNEO).getValue() || '').trim();
  if (!crudo) return { ok: true, torneo: null };
  try {
    return { ok: true, torneo: JSON.parse(crudo) };
  } catch (err) {
    return { ok: false, error: 'El torneo guardado no es un JSON válido' };
  }
}

/** Guarda el torneo que manda admin.html. Pisa lo que hubiera. */
function torneoGuardar(d) {
  verificarPin(d.pin);

  var torneo = d.torneo;
  if (typeof torneo === 'string') {
    torneo = JSON.parse(torneo);
  }
  if (!torneo || typeof torneo !== 'object') {
    return { ok: false, error: 'No vino el torneo' };
  }

  torneo.actualizado = new Date().toISOString();
  var texto = JSON.stringify(torneo);
  if (texto.length > MAXIMO_JSON) {
    return { ok: false, error: 'El torneo no entra en una celda (' + texto.length + ' caracteres). Borrá bitácora vieja.' };
  }

  var hoja = hojaTorneo();
  hoja.getRange(CELDA_TORNEO).setValue(texto);
  hoja.getRange(CELDA_ACTUALIZADO).setValue(new Date());
  return { ok: true, tipo: 'torneo_guardar', torneo: { actualizado: torneo.actualizado } };
}

/**
 * Los nombres de la hoja Confirmaciones, para que el admin los sume al
 * sorteo sin tipearlos. No devuelve teléfonos: la página del torneo es
 * pública y no hace falta que ande dando vueltas ningún número.
 */
function torneoConfirmados(d) {
  verificarPin(d.pin);

  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_CONFIRMACIONES);
  if (!hoja || hoja.getLastRow() < 2) {
    return { ok: true, confirmados: [] };
  }
  var ancho = Math.max(hoja.getLastColumn(), 1);
  var filas = hoja.getRange(2, 1, hoja.getLastRow() - 1, ancho).getValues();

  var iNombre   = COLUMNAS.confirmacion.indexOf('Nombre');
  var iDias     = COLUMNAS.confirmacion.indexOf('Días');
  var iKermesse = COLUMNAS.confirmacion.indexOf('Juega Kermesse');

  var confirmados = [];
  for (var i = 0; i < filas.length; i++) {
    var nombre = String(filas[i][iNombre] || '').trim();
    if (!nombre) continue;
    confirmados.push({
      nombre: nombre,
      dias: String(filas[i][iDias] || ''),
      // Si la columna no existe todavía (planilla vieja), asumimos que sí.
      kermesse: String(filas[i][iKermesse] || 'Sí')
    });
  }
  return { ok: true, confirmados: confirmados };
}

/* ---------------------- PIN del admin ---------------------- */

function pinGuardado() {
  return String(PropertiesService.getScriptProperties().getProperty('PIN_TORNEO') || '');
}

function verificarPin(pin) {
  var guardado = pinGuardado();
  if (!guardado) {
    throw new Error('Falta configurar el PIN del torneo (ver configurarPin en Codigo.gs).');
  }
  if (String(pin || '') !== guardado) {
    throw new Error('PIN incorrecto');
  }
}

/**
 * Poner el PIN que abre admin.html. Dos formas:
 *
 *   A) (recomendada) Configuración del proyecto ⚙ > Propiedades del script
 *      > Agregar propiedad:   PIN_TORNEO  =  elPinQueQuieras
 *
 *   B) Escribilo acá abajo, ejecutá configurarPin() una vez desde el
 *      editor, y después borralo del código así no queda escrito.
 */
function configurarPin(pin) {
  var NUEVO = pin || '';   // ← o poné el PIN acá: 'focaXXXX'
  NUEVO = String(NUEVO).trim();
  if (NUEVO.length < 4) {
    throw new Error('Poné un PIN de 4 caracteres o más.');
  }
  PropertiesService.getScriptProperties().setProperty('PIN_TORNEO', NUEVO);
  Logger.log('PIN del torneo guardado ✓ (%s caracteres)', NUEVO.length);
}

/** Para chequear desde el editor que el PIN está puesto, sin mostrarlo. */
function hayPin() {
  var hay = !!pinGuardado();
  Logger.log(hay ? 'Hay PIN configurado ✓' : 'NO hay PIN: admin.html no va a dejar entrar a nadie.');
  return hay;
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
  hojaTorneo();
  Logger.log('Hojas listas 🦭');
  hayPin();
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

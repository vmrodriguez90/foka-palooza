/* ==================================================================
   LA FOKA KERMESSE — lógica del torneo
   ------------------------------------------------------------------
   Funciones puras (no tocan el DOM ni la red) que comparten la página
   pública (torneo.html), la consola del admin (admin.html) y los tests
   (tools/test-torneo.js). Todo el estado del torneo es un solo objeto
   JSON que se guarda en la hoja "Torneo" de la planilla.

   Forma del estado:
   {
     version: 1,
     actualizado: '2026-09-26T18:05:00.000Z',
     fase: 'inscripcion' | 'sorteo' | 'jugando' | 'terminado',
     mensaje: 'Texto grande que se ve arriba de todo',
     semilla: 12345,                               // del último sorteo
     participantes: [{ id, nombre, juega }],
     parejas:       [{ id, nombre, emoji, integrantes: [idParticipante], fija }],
     pruebas:       [{ id, nombre, emoji, estado, secreta, detalle }],
     resultados:    { idPrueba: { idPareja: 'oro'|'plata'|'bronce'|'jugo' } },
     bonus:         { idPareja: number },          // puntos foka a dedo
     bitacora:      [{ ts, texto }]
   }
   ================================================================== */
(function (raiz) {
  'use strict';

  var VERSION = 1;

  /* Cuánto vale cada puesto en una prueba. Si querés cambiar el puntaje,
     se cambia acá y se recalcula toda la tabla sola. */
  var MEDALLAS = [
    { id: 'oro',    label: '1º', emoji: '🥇', puntos: 10 },
    { id: 'plata',  label: '2º', emoji: '🥈', puntos: 7 },
    { id: 'bronce', label: '3º', emoji: '🥉', puntos: 5 },
    { id: 'jugo',   label: 'Jugó', emoji: '🎽', puntos: 3 }
  ];

  var FASES = [
    { id: 'inscripcion', label: 'Inscripción abierta', ayuda: 'Todavía se puede anotar gente.' },
    { id: 'sorteo',      label: 'Parejas sorteadas',   ayuda: 'Ya están las parejas, falta arrancar.' },
    { id: 'jugando',     label: 'En juego',            ayuda: 'La kermesse está en marcha.' },
    { id: 'terminado',   label: 'Terminado',           ayuda: 'Ya hay campeones.' }
  ];

  /* Las cinco pruebas del sábado. La quinta va tapada hasta que el admin
     la destape: es la intriga. */
  function pruebasPorDefecto() {
    return [
      { id: 'golf',      nombre: 'Mini golf',          emoji: '⛳', estado: 'pendiente', secreta: false, detalle: 'Hoyos improvisados por toda la casa.' },
      { id: 'autos',     nombre: 'Carrera de autos',   emoji: '🏎️', estado: 'pendiente', secreta: false, detalle: 'Largada, vuelta y podio.' },
      { id: 'basket',    nombre: '21 de básket',       emoji: '🏀', estado: 'pendiente', secreta: false, detalle: 'Con mini hoop, a 21 puntos.' },
      { id: 'botellas',  nombre: 'Tiro a las botellas', emoji: '🎯', estado: 'pendiente', secreta: false, detalle: 'Con las Nerf. Cada botella que cae, suma.' },
      { id: 'sorpresa',  nombre: 'Prueba sorpresa',    emoji: '❓', estado: 'pendiente', secreta: true,  detalle: 'Se revela en La Foka House.' }
    ];
  }

  /* Nombres de fantasía para las parejas recién sorteadas. Después el
     admin los edita a mano si se le ocurre algo mejor. */
  var NOMBRES = [
    ['Las Focas Bravas', '🦭'], ['Lobos de Mar', '🌊'], ['Iceberg FC', '🧊'],
    ['Marea Alta', '🌀'], ['Los Sanguches', '🥪'], ['Dúo Dinamita', '🧨'],
    ['Las Gaviotas', '🕊️'], ['Los Médanos', '🏜️'], ['Fondo Blanco', '🍺'],
    ['Los Caracoles', '🐚'], ['Tiburones de Miramar', '🦈'], ['Espuma', '🫧'],
    ['Los Mates', '🧉'], ['Resaca Team', '😵'], ['Las Ballenas', '🐋'],
    ['Los Cangrejos', '🦀'], ['Pura Papita', '🍟'], ['Los Pulpos', '🐙'],
    ['Viento del Sur', '💨'], ['Los Pingüinos', '🐧']
  ];

  /* ====================== UTILIDADES ====================== */

  function esObjeto(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

  function texto(v) { return String(v == null ? '' : v).trim(); }

  function entero(v, sino) {
    var n = parseInt(v, 10);
    return isNaN(n) ? sino : n;
  }

  /* Generador con semilla (mulberry32): mismo número, mismo sorteo.
     Sirve para repetir un sorteo si alguien duda de que fue al azar. */
  function generador(semilla) {
    var a = (entero(semilla, 0) || 1) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Fisher-Yates: devuelve una copia mezclada, no toca el original. */
  function mezclar(lista, semilla) {
    var azar = generador(semilla);
    var copia = lista.slice();
    for (var i = copia.length - 1; i > 0; i--) {
      var j = Math.floor(azar() * (i + 1));
      var tmp = copia[i]; copia[i] = copia[j]; copia[j] = tmp;
    }
    return copia;
  }

  function semillaNueva() {
    return Math.floor(Math.random() * 1000000) + 1;
  }

  /* Un id corto y único dentro de la lista que ya existe. */
  function idNuevo(prefijo, usados) {
    var n = 1;
    var id;
    do { id = prefijo + n; n++; } while (usados.indexOf(id) !== -1);
    return id;
  }

  /* ====================== ESTADO ====================== */

  function estadoInicial() {
    return {
      version: VERSION,
      actualizado: new Date().toISOString(),
      fase: 'inscripcion',
      mensaje: '',
      semilla: 0,
      participantes: [],
      parejas: [],
      pruebas: pruebasPorDefecto(),
      resultados: {},
      bonus: {},
      bitacora: []
    };
  }

  /**
   * Deja cualquier cosa que venga del servidor (o de un JSON pegado a
   * mano) con la forma que esperan las páginas: sin campos faltantes,
   * sin ids repetidos y sin referencias colgadas.
   */
  function normalizar(bruto) {
    var base = estadoInicial();
    var e = esObjeto(bruto) ? bruto : {};

    var salida = {
      version: VERSION,
      actualizado: texto(e.actualizado) || base.actualizado,
      fase: FASES.some(function (f) { return f.id === e.fase; }) ? e.fase : 'inscripcion',
      mensaje: texto(e.mensaje),
      semilla: entero(e.semilla, 0),
      participantes: [],
      parejas: [],
      pruebas: [],
      resultados: {},
      bonus: {},
      bitacora: []
    };

    /* --- participantes --- */
    var idsP = [];
    (Array.isArray(e.participantes) ? e.participantes : []).forEach(function (p) {
      var nombre = texto(esObjeto(p) ? p.nombre : p);
      if (!nombre) return;
      var id = texto(esObjeto(p) && p.id);
      if (!id || idsP.indexOf(id) !== -1) id = idNuevo('p', idsP);
      idsP.push(id);
      salida.participantes.push({
        id: id,
        nombre: nombre,
        juega: esObjeto(p) && p.juega === false ? false : true
      });
    });

    /* --- parejas (sin integrantes fantasma ni repetidos) --- */
    var idsD = [];
    var yaEnPareja = [];
    (Array.isArray(e.parejas) ? e.parejas : []).forEach(function (d, i) {
      if (!esObjeto(d)) return;
      var id = texto(d.id);
      if (!id || idsD.indexOf(id) !== -1) id = idNuevo('d', idsD);
      var integrantes = (Array.isArray(d.integrantes) ? d.integrantes : [])
        .map(texto)
        .filter(function (pid) {
          if (idsP.indexOf(pid) === -1) return false;     // participante borrado
          if (yaEnPareja.indexOf(pid) !== -1) return false; // no puede estar en dos
          yaEnPareja.push(pid);
          return true;
        });
      if (!integrantes.length) return;
      idsD.push(id);
      var auto = NOMBRES[i % NOMBRES.length];
      salida.parejas.push({
        id: id,
        nombre: texto(d.nombre) || auto[0],
        emoji: texto(d.emoji) || auto[1],
        integrantes: integrantes,
        fija: d.fija === true
      });
    });

    /* --- pruebas --- */
    var idsPr = [];
    var pruebas = Array.isArray(e.pruebas) && e.pruebas.length ? e.pruebas : pruebasPorDefecto();
    pruebas.forEach(function (pr) {
      if (!esObjeto(pr)) return;
      /* El nombre se edita desde la consola: si queda vacío a mitad de
         tipear, la prueba NO se borra (se llevaría los puntos puestos). */
      var nombre = texto(pr.nombre) || 'Prueba ' + (idsPr.length + 1);
      var id = texto(pr.id);
      if (!id || idsPr.indexOf(id) !== -1) id = idNuevo('pr', idsPr);
      idsPr.push(id);
      salida.pruebas.push({
        id: id,
        nombre: nombre,
        emoji: texto(pr.emoji) || '🎲',
        estado: ['pendiente', 'jugando', 'jugada'].indexOf(pr.estado) !== -1 ? pr.estado : 'pendiente',
        secreta: pr.secreta === true,
        detalle: texto(pr.detalle)
      });
    });

    /* --- resultados: solo pruebas y parejas que existen --- */
    var medallas = MEDALLAS.map(function (m) { return m.id; });
    if (esObjeto(e.resultados)) {
      idsPr.forEach(function (pid) {
        var fila = e.resultados[pid];
        if (!esObjeto(fila)) return;
        var limpia = {};
        idsD.forEach(function (did) {
          if (medallas.indexOf(fila[did]) !== -1) limpia[did] = fila[did];
        });
        if (Object.keys(limpia).length) salida.resultados[pid] = limpia;
      });
    }

    /* --- bonus --- */
    if (esObjeto(e.bonus)) {
      idsD.forEach(function (did) {
        var n = entero(e.bonus[did], 0);
        if (n) salida.bonus[did] = n;
      });
    }

    /* --- bitácora (lo último arriba, máximo 60 entradas) --- */
    (Array.isArray(e.bitacora) ? e.bitacora : []).forEach(function (b) {
      var t = texto(esObjeto(b) ? b.texto : b);
      if (!t) return;
      salida.bitacora.push({ ts: texto(esObjeto(b) && b.ts) || new Date().toISOString(), texto: t });
    });
    salida.bitacora = salida.bitacora.slice(-60);

    return salida;
  }

  /* ====================== SORTEO ====================== */

  /**
   * Arma las parejas al azar entre los participantes que juegan.
   *   - respeta las parejas marcadas como fijas (los que ya tienen dupla),
   *   - si sobra uno, se suma a la última pareja y queda un trío: la foca
   *     no deja a nadie afuera.
   * Devuelve { parejas, semilla } sin tocar el estado que le pasaste.
   */
  function sortearParejas(estado, opciones) {
    var e = normalizar(estado);
    var op = opciones || {};
    var semilla = entero(op.semilla, 0) || semillaNueva();
    var respetarFijas = op.respetarFijas !== false;

    var juegan = e.participantes.filter(function (p) { return p.juega !== false; });
    var disponibles = juegan.map(function (p) { return p.id; });

    var parejas = [];
    var tomados = [];

    if (respetarFijas) {
      e.parejas.forEach(function (d) {
        if (!d.fija) return;
        var integrantes = d.integrantes.filter(function (id) { return disponibles.indexOf(id) !== -1; });
        if (!integrantes.length) return;
        parejas.push({ id: d.id, nombre: d.nombre, emoji: d.emoji, integrantes: integrantes, fija: true });
        tomados = tomados.concat(integrantes);
      });
    }

    var sueltos = mezclar(disponibles.filter(function (id) { return tomados.indexOf(id) === -1; }), semilla);

    /* Los ids nuevos no pueden repetir ninguno de los que había antes:
       si se reciclara un id, la pareja nueva heredaría los puntos de la
       vieja. Reservamos todos los que ya existen (y los que aparecen en
       los resultados) para que normalizar() después tire lo que sobra. */
    var idsUsados = e.parejas.map(function (d) { return d.id; });
    Object.keys(e.resultados).forEach(function (idPrueba) {
      Object.keys(e.resultados[idPrueba]).forEach(function (idPareja) {
        if (idsUsados.indexOf(idPareja) === -1) idsUsados.push(idPareja);
      });
    });
    var indiceNombre = parejas.length;
    for (var i = 0; i < sueltos.length; i += 2) {
      var dupla = sueltos.slice(i, i + 2);
      /* Impar: el último se suma a la pareja anterior y queda un trío. */
      if (dupla.length === 1 && parejas.length) {
        parejas[parejas.length - 1].integrantes.push(dupla[0]);
        break;
      }
      var auto = NOMBRES[indiceNombre % NOMBRES.length];
      var id = idNuevo('d', idsUsados);
      idsUsados.push(id);
      parejas.push({ id: id, nombre: auto[0], emoji: auto[1], integrantes: dupla, fija: false });
      indiceNombre++;
    }

    return { parejas: parejas, semilla: semilla };
  }

  /* ====================== TABLA DE POSICIONES ====================== */

  function puntosDeMedalla(medalla) {
    for (var i = 0; i < MEDALLAS.length; i++) {
      if (MEDALLAS[i].id === medalla) return MEDALLAS[i].puntos;
    }
    return 0;
  }

  function medalla(id) {
    for (var i = 0; i < MEDALLAS.length; i++) {
      if (MEDALLAS[i].id === id) return MEDALLAS[i];
    }
    return null;
  }

  /**
   * Tabla ordenada. Desempate: más puntos, más oros, más platas, más
   * bronces y, si siguen iguales, por nombre. Las parejas empatadas
   * comparten posición (dos segundos, después un cuarto).
   */
  function tabla(estado) {
    var e = normalizar(estado);
    var filas = e.parejas.map(function (d) {
      var detalle = {};
      var puntos = 0;
      var conteo = { oro: 0, plata: 0, bronce: 0, jugo: 0 };
      e.pruebas.forEach(function (pr) {
        var m = (e.resultados[pr.id] || {})[d.id] || null;
        detalle[pr.id] = m;
        if (m) { puntos += puntosDeMedalla(m); conteo[m]++; }
      });
      var bonus = entero(e.bonus[d.id], 0);
      return {
        pareja: d,
        integrantes: d.integrantes.map(function (id) { return nombreDe(e, id); }),
        detalle: detalle,
        conteo: conteo,
        bonus: bonus,
        jugadas: conteo.oro + conteo.plata + conteo.bronce + conteo.jugo,
        puntos: puntos + bonus
      };
    });

    filas.sort(function (a, b) {
      return (b.puntos - a.puntos)
        || (b.conteo.oro - a.conteo.oro)
        || (b.conteo.plata - a.conteo.plata)
        || (b.conteo.bronce - a.conteo.bronce)
        || a.pareja.nombre.localeCompare(b.pareja.nombre, 'es');
    });

    var pos = 0;
    filas.forEach(function (f, i) {
      var previa = filas[i - 1];
      var empata = previa
        && previa.puntos === f.puntos
        && previa.conteo.oro === f.conteo.oro
        && previa.conteo.plata === f.conteo.plata
        && previa.conteo.bronce === f.conteo.bronce;
      if (!empata) pos = i + 1;
      f.pos = pos;
    });

    return filas;
  }

  function nombreDe(estado, idParticipante) {
    var lista = (estado && estado.participantes) || [];
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === idParticipante) return lista[i].nombre;
    }
    return '¿?';
  }

  /** Números para el encabezado de la página pública. */
  function resumen(estado) {
    var e = normalizar(estado);
    var visibles = e.pruebas.filter(function (pr) { return !pr.secreta || pr.estado !== 'pendiente'; });
    var jugadas = e.pruebas.filter(function (pr) { return pr.estado === 'jugada'; });
    var enJuego = e.pruebas.filter(function (pr) { return pr.estado === 'jugando'; });
    var t = tabla(e);
    var lider = t.length && t[0].puntos > 0 ? t[0] : null;
    return {
      fase: e.fase,
      participantes: e.participantes.filter(function (p) { return p.juega !== false; }).length,
      parejas: e.parejas.length,
      pruebas: e.pruebas.length,
      pruebasVisibles: visibles.length,
      jugadas: jugadas.length,
      enJuego: enJuego[0] || null,
      lider: lider
    };
  }

  /** Agrega una línea a la bitácora (devuelve el estado nuevo). */
  function anotar(estado, texto_, cuando) {
    var e = normalizar(estado);
    var t = texto(texto_);
    if (!t) return e;
    e.bitacora.push({ ts: cuando || new Date().toISOString(), texto: t });
    e.bitacora = e.bitacora.slice(-60);
    return e;
  }

  var api = {
    VERSION: VERSION,
    MEDALLAS: MEDALLAS,
    FASES: FASES,
    NOMBRES: NOMBRES,
    pruebasPorDefecto: pruebasPorDefecto,
    estadoInicial: estadoInicial,
    normalizar: normalizar,
    mezclar: mezclar,
    generador: generador,
    semillaNueva: semillaNueva,
    idNuevo: idNuevo,
    sortearParejas: sortearParejas,
    puntosDeMedalla: puntosDeMedalla,
    medalla: medalla,
    tabla: tabla,
    nombreDe: nombreDe,
    resumen: resumen,
    anotar: anotar
  };

  for (var k in api) { if (api.hasOwnProperty(k)) raiz[k] = api[k]; }

})(typeof module !== 'undefined' && module.exports ? module.exports : (this.FokaTorneo = {}));

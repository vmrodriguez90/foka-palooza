/* Pruebas de la lógica del torneo (sorteo, tabla, normalización).
   Correlo con: node tools/test-torneo.js */
const path = require('path');
const T = require(path.resolve(__dirname, '..', 'assets', 'torneo-core.js'));

let fallos = 0;
function ok(cond, que) {
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + que);
  if (!cond) fallos++;
}
function titulo(t) { console.log('\n' + t); }

const gente = n => Array.from({ length: n }, (_, i) => ({ id: 'p' + (i + 1), nombre: 'Foka ' + (i + 1) }));

/* ------------------------------------------------------------------ */
titulo('Estado inicial');
{
  const e = T.estadoInicial();
  ok(e.fase === 'inscripcion', 'arranca en inscripción');
  ok(e.pruebas.length === 5, 'trae las 5 pruebas de la kermesse');
  ok(e.pruebas.filter(p => p.secreta).length === 1, 'una sola prueba secreta');
  ok(T.normalizar(e).pruebas.length === 5, 'normalizar no las pierde');
}

/* ------------------------------------------------------------------ */
titulo('Normalización de basura');
{
  const e = T.normalizar({
    fase: 'cualquiera',
    participantes: [{ nombre: 'Ana' }, { nombre: '' }, 'Beto', { id: 'p1', nombre: 'Cami' }, { id: 'p1', nombre: 'Dani' }],
    parejas: [{ id: 'd1', integrantes: ['p1', 'fantasma'] }, { id: 'd1', integrantes: ['p1'] }],
    resultados: { golf: { d1: 'oro', borrada: 'oro', d2: 'inventada' } },
    bonus: { d1: '5', otra: 9 },
    bitacora: [{ texto: 'arrancamos' }, { texto: '' }]
  });
  ok(e.fase === 'inscripcion', 'una fase inventada vuelve a inscripción');
  ok(e.participantes.length === 4, 'descarta los participantes sin nombre');
  ok(new Set(e.participantes.map(p => p.id)).size === 4, 'no deja ids repetidos');
  ok(e.parejas.length === 1, 'la pareja que se queda sin integrantes se cae');
  ok(e.parejas[0].integrantes.length === 1, 'saca al integrante fantasma');
  ok(!!e.parejas[0].nombre && !!e.parejas[0].emoji, 'le pone nombre y emoji si no tenía');
  ok(e.resultados.golf.d1 === 'oro' && !e.resultados.golf.borrada && !e.resultados.golf.d2, 'limpia resultados colgados');
  ok(e.bonus.d1 === 5 && !e.bonus.otra, 'el bonus queda numérico y sin parejas fantasma');
  ok(e.bitacora.length === 1, 'descarta las líneas vacías de la bitácora');
}

/* ------------------------------------------------------------------ */
titulo('Nadie en dos parejas a la vez');
{
  const e = T.normalizar({
    participantes: gente(3),
    parejas: [{ id: 'd1', integrantes: ['p1', 'p2'] }, { id: 'd2', integrantes: ['p2', 'p3'] }]
  });
  const todos = e.parejas.flatMap(d => d.integrantes);
  ok(new Set(todos).size === todos.length, 'cada participante aparece una sola vez');
}

/* ------------------------------------------------------------------ */
titulo('Sorteo de parejas');
{
  const e = T.normalizar({ participantes: gente(8) });
  const { parejas, semilla } = T.sortearParejas(e, { semilla: 1234 });
  ok(parejas.length === 4, '8 personas → 4 parejas');
  ok(parejas.every(d => d.integrantes.length === 2), 'todas de a dos');
  ok(semilla === 1234, 'devuelve la semilla usada');

  const otra = T.sortearParejas(e, { semilla: 1234 }).parejas;
  ok(JSON.stringify(otra) === JSON.stringify(parejas), 'misma semilla → mismo sorteo');

  const distinta = T.sortearParejas(e, { semilla: 99 }).parejas;
  ok(JSON.stringify(distinta) !== JSON.stringify(parejas), 'otra semilla → otro sorteo');

  const sinSemilla = T.sortearParejas(e, {});
  ok(sinSemilla.semilla > 0, 'si no le das semilla, inventa una');
}

titulo('Sorteo con número impar');
{
  const e = T.normalizar({ participantes: gente(7) });
  const { parejas } = T.sortearParejas(e, { semilla: 7 });
  const todos = parejas.flatMap(d => d.integrantes);
  ok(todos.length === 7, 'no queda nadie afuera');
  ok(new Set(todos).size === 7, 'nadie repetido');
  ok(parejas.filter(d => d.integrantes.length === 3).length === 1, 'se arma un solo trío');
}

titulo('Sorteo respetando parejas fijas y a los que no juegan');
{
  const e = T.normalizar({
    participantes: gente(6).map((p, i) => (i === 5 ? { ...p, juega: false } : p)),
    parejas: [{ id: 'd1', nombre: 'Los Fijos', integrantes: ['p1', 'p2'], fija: true }]
  });
  const { parejas } = T.sortearParejas(e, { semilla: 5 });
  const fija = parejas.find(d => d.id === 'd1');
  ok(!!fija && fija.integrantes.join() === 'p1,p2', 'la pareja fija queda intacta');
  const todos = parejas.flatMap(d => d.integrantes);
  ok(!todos.includes('p6'), 'el que no juega queda afuera del sorteo');
  ok(todos.length === 5, 'entran los 5 que juegan');
}

titulo('Un sorteo nuevo no hereda los puntos del anterior');
{
  const e = T.normalizar({
    participantes: gente(4),
    parejas: [{ id: 'd1', nombre: 'Vieja', integrantes: ['p1', 'p2'] }, { id: 'd2', nombre: 'Otra', integrantes: ['p3', 'p4'] }],
    pruebas: [{ id: 'golf', nombre: 'Mini golf' }],
    resultados: { golf: { d1: 'oro', d2: 'plata' } }
  });
  const { parejas } = T.sortearParejas(e, { semilla: 3 });
  ok(parejas.every(d => d.id !== 'd1' && d.id !== 'd2'), 'las parejas nuevas estrenan id');

  const despues = T.normalizar({ ...e, parejas });
  ok(Object.keys(despues.resultados).length === 0, 'los puntos viejos se tiran al re-sortear');

  /* pero la pareja fija se queda con su id, y con sus puntos */
  const conFija = T.normalizar({
    ...e,
    parejas: [{ id: 'd1', nombre: 'Vieja', integrantes: ['p1', 'p2'], fija: true }, { id: 'd2', nombre: 'Otra', integrantes: ['p3', 'p4'] }]
  });
  const res2 = T.sortearParejas(conFija, { semilla: 3 });
  const limpio = T.normalizar({ ...conFija, parejas: res2.parejas });
  ok(limpio.resultados.golf && limpio.resultados.golf.d1 === 'oro', 'la pareja fija conserva su oro');
  ok(limpio.resultados.golf && !limpio.resultados.golf.d2, 'la que se volvió a sortear, no');
}

titulo('Sorteo sin nadie');
{
  const { parejas } = T.sortearParejas(T.estadoInicial(), { semilla: 1 });
  ok(parejas.length === 0, 'sin participantes no rompe');
}

/* ------------------------------------------------------------------ */
titulo('Tabla de posiciones');
{
  const e = T.normalizar({
    participantes: gente(4),
    parejas: [
      { id: 'd1', nombre: 'Uno', integrantes: ['p1', 'p2'] },
      { id: 'd2', nombre: 'Dos', integrantes: ['p3', 'p4'] }
    ],
    pruebas: [{ id: 'golf', nombre: 'Mini golf' }, { id: 'basket', nombre: '21' }],
    resultados: {
      golf: { d1: 'oro', d2: 'plata' },
      basket: { d1: 'jugo', d2: 'oro' }
    },
    bonus: { d2: 1 }
  });
  const t = T.tabla(e);
  ok(t[0].pareja.id === 'd2', 'gana la que más puntos suma (7+10+1=18)');
  ok(t[0].puntos === 18 && t[1].puntos === 13, 'los puntos salen bien');
  ok(t[0].pos === 1 && t[1].pos === 2, 'las posiciones van 1 y 2');
  ok(t[1].integrantes.join(' y ') === 'Foka 1 y Foka 2', 'muestra los nombres de la pareja');
  ok(t[0].jugadas === 2, 'cuenta las pruebas jugadas');
}

titulo('Desempate');
{
  const e = T.normalizar({
    participantes: gente(6),
    parejas: [
      { id: 'd1', nombre: 'Aaa', integrantes: ['p1', 'p2'] },
      { id: 'd2', nombre: 'Bbb', integrantes: ['p3', 'p4'] },
      { id: 'd3', nombre: 'Ccc', integrantes: ['p5', 'p6'] }
    ],
    pruebas: [{ id: 'a', nombre: 'A' }, { id: 'b', nombre: 'B' }],
    /* d1: oro + jugo = 13 ; d2: plata + bronce = 12 ; d3: oro + jugo = 13 */
    resultados: {
      a: { d1: 'oro', d2: 'plata', d3: 'oro' },
      b: { d1: 'jugo', d2: 'bronce', d3: 'jugo' }
    }
  });
  const t = T.tabla(e);
  ok(t[0].puntos === 13 && t[1].puntos === 13, 'las dos de 13 van arriba');
  ok(t[0].pos === 1 && t[1].pos === 1, 'empatadas comparten el primer puesto');
  ok(t[2].pos === 3, 'la siguiente es tercera, no segunda');
  ok(t[0].pareja.nombre === 'Aaa', 'si empatan todo, ordena alfabético');
}

/* ------------------------------------------------------------------ */
titulo('Resumen para el encabezado');
{
  let e = T.normalizar({
    participantes: gente(4),
    parejas: [{ id: 'd1', nombre: 'Uno', integrantes: ['p1', 'p2'] }, { id: 'd2', nombre: 'Dos', integrantes: ['p3', 'p4'] }],
    pruebas: [
      { id: 'a', nombre: 'A', estado: 'jugada' },
      { id: 'b', nombre: 'B', estado: 'jugando' },
      { id: 'c', nombre: 'Sorpresa', secreta: true }
    ],
    resultados: { a: { d1: 'oro' } },
    fase: 'jugando'
  });
  const r = T.resumen(e);
  ok(r.parejas === 2 && r.participantes === 4, 'cuenta parejas y jugadores');
  ok(r.jugadas === 1, 'cuenta las pruebas terminadas');
  ok(r.enJuego && r.enJuego.id === 'b', 'sabe cuál se está jugando');
  ok(r.lider && r.lider.pareja.id === 'd1', 'sabe quién puntea');
  ok(r.pruebasVisibles === 2, 'la prueba secreta no se cuenta hasta destaparla');
}

titulo('Bitácora');
{
  let e = T.anotar(T.estadoInicial(), 'Arrancó el mini golf', '2026-09-26T16:00:00.000Z');
  e = T.anotar(e, '   ');
  ok(e.bitacora.length === 1, 'no anota líneas vacías');
  ok(e.bitacora[0].ts === '2026-09-26T16:00:00.000Z', 'respeta la fecha que le pasás');
  for (let i = 0; i < 70; i++) e = T.anotar(e, 'linea ' + i);
  ok(e.bitacora.length === 60, 'guarda las últimas 60 nomás');
  ok(e.bitacora[59].texto === 'linea 69', 'la última es la más nueva');
}

console.log('\n' + (fallos ? fallos + ' prueba(s) fallaron ✗' : 'Todo bien 🦭'));
process.exit(fallos ? 1 : 0);

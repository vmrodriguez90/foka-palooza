# 🦭 FOKA PALOOZA 2026

Landing del cumpleaños. **Miramar, Buenos Aires · Viernes 25, sábado 26 y domingo 27 de septiembre.**

| Día | Qué | Dónde |
|---|---|---|
| **Viernes 25** 🎂 | El cumple. Torneo de pool, birra y papas. La primera birra la paga el cumpleañero. | HISTER Beer Garden |
| **Sábado 26** 🎉 | El festejo grande: sanguches + **La Foka Kermesse**, torneo por parejas con premio. El que se queda a dormir trae sábanas. | La Foka House — Calle 28 nº 1824 (entre 35 y 37) |
| **Domingo 27** 🌊 | Cierre: playa, mates y posible olita. | El Náutico Miramar |

```
index.html             → la landing (cronograma, kermesse, RSVP)
torneo.html            → la tabla del torneo, en vivo y pública
admin.html             → la consola para manejar el torneo (con PIN)
assets/foka.css        → estilos compartidos por las tres páginas
assets/config.js       → la URL del Apps Script, en un solo lugar
assets/torneo-core.js  → sorteo, puntajes y tabla (lo usan las 3 páginas y los tests)
assets/og.png          → imagen de preview para WhatsApp (1200×630)
assets/favicon.svg     → la foca
assets/icon-512.png    → ícono para iOS / accesos directos
apps-script/Codigo.gs  → backend: confirmaciones y estado del torneo en Google Sheets
tools/                 → tests y scripts para regenerar la imagen de preview
```

---

## 1. Conectar el formulario (Google Sheets + Apps Script)

Toma 5 minutos y no requiere servidor ni pagar nada.

1. Creá una planilla nueva en [Google Sheets](https://sheets.new). Llamala *Foka Palooza 2026*.
2. Dentro de la planilla: **Extensiones → Apps Script**.
3. Borrá lo que haya y pegá todo el contenido de [`apps-script/Codigo.gs`](apps-script/Codigo.gs). Guardá (💾).
4. En el selector de funciones elegí **`inicializar`** y dale ▶️ *Ejecutar*.
   Google te va a pedir permisos: **Revisar permisos → tu cuenta → Configuración avanzada → Ir a (nombre del proyecto) → Permitir**.
   Esto crea las hojas `Confirmaciones`, `Avisos Lineup` y `Torneo` con sus encabezados.
5. Arriba a la derecha: **Implementar → Nueva implementación → ⚙️ → Aplicación web**.
   - *Descripción*: `Foka Palooza`
   - *Ejecutar como*: **Yo**
   - *Quién tiene acceso*: **Cualquier usuario** ← importante, si no el formulario da error
6. **Implementar** y copiá la **URL de la aplicación web** (termina en `/exec`).
7. Abrí [`assets/config.js`](assets/config.js) y pegá la URL ahí. Es el **único** lugar donde va:
   las tres páginas la leen de ese archivo.

```js
window.FOKA_CONFIG = window.FOKA_CONFIG || {
  endpoint: 'https://script.google.com/macros/s/AKfy..../exec'
};
```

8. Para que ande la consola del torneo, poné el PIN (ver [sección 3](#3-el-torneo-la-foka-kermesse)).

Listo. Cada confirmación cae como una fila en la planilla, en vivo.

**Probarlo sin llenar el formulario:** abrí en el navegador
`https://script.google.com/macros/s/..../exec?tipo=lineup&whatsapp=5491155555555`
Tiene que responder `{"ok":true,...}` y aparecer la fila en la hoja.

### Qué guarda

**No hace falta que escribas los encabezados a mano**: la función `inicializar()`
crea las hojas con estas columnas, en este orden exacto.

Hoja **`Confirmaciones`**:

| # | Columna | Contenido |
|---|---|---|
| A | `Fecha` | Cuándo confirmó |
| B | `Nombre` | Nombre y apellido |
| C | `WhatsApp` | Número normalizado, solo dígitos con código de país (`5491155555555`). Guardado como **texto**, si no la planilla lo muestra como `5,49115E+12` |
| D | `Escribirle` | `https://wa.me/549...?text=...` — clic y se abre el chat **con el mensaje ya escrito**: *«¡Hola Fede! 🦭 Gracias por confirmar al Foka Palooza. Toda la info está en https://fokapalooza.ar»*. No lo manda solo: lo deja listo y vos apretás enviar |
| E | `Días` | `Viernes 25`, `Sábado 26`, `Domingo 27` o `Los tres` |
| F | `Personas` | Cuántos vienen en total, contándole a él/ella |
| G | `Dieta` | De todo / Vegetariane / Vegane / Sin TACC / Otra |
| H | `Mensaje` | Texto libre |
| I | `Quiere aviso lineup` | `Sí` / `No` |
| J | `Origen` | URL desde donde se envió |
| K | `Juega Kermesse` | `Sí` / `No` — quién entra al sorteo de parejas del sábado |

Hoja **`Avisos Lineup`**: `Fecha` · `WhatsApp` · `Escribirle` · `Origen`.
Es la lista de difusión para los avisos del finde (horarios, punto de encuentro, cómo va
el torneo). El mensaje precargado sale de `mensajeLineup()` y el de las confirmaciones de
`mensajeGracias()`, las dos arriba de todo en `Codigo.gs`. Se pueden probar con
`node tools/test-links.js`.

Hoja **`Torneo`**: una sola celda con todo el estado de la kermesse en JSON. No se
edita a mano (lo escribe `admin.html`); ver la sección 3.

> ⚠️ Si cambiás el **orden** de las columnas, hay que actualizar `COLUMNAS` en
> `Codigo.gs` (y el índice de la columna `Personas` que usa `estadisticas()`).
> Agregar columnas *a la derecha* de las que están es seguro: el script le escribe
> el encabezado que falte la próxima vez que alguien confirme.

Detalles útiles:
- El número se normaliza **antes** de guardarse: `011 15 5555-5555`, `11 5555 5555`
  y `+54 9 11 5555-5555` terminan todos como `5491155555555`. Si alguien pone `+`
  y código de país, se respeta el país que haya puesto (sirve para invitados de afuera).
- Las características argentinas son de **2, 3 o 4 dígitos** (`11`, `351`, `2291`),
  así que no se puede asumir un largo fijo. La regla que usa el normalizador es que
  el número nacional son **siempre 10 dígitos**: si llegan 12, sobra el `15` y se saca;
  si llegan 10, no se toca nada. Eso evita romper abonados que arrancan con 15
  (`11 1512-3456` es un número válido, no un `15` de más).
  Los casos están cubiertos en `tools/test-whatsapp.js` (`node tools/test-whatsapp.js`).
- Si alguien confirma **dos veces con el mismo número**, se **actualiza** su fila en lugar de duplicarla (así puede corregirse).
- Hay un *honeypot* (campo oculto `apodo_foka`): si un bot lo completa, el envío se descarta en silencio.
- `?action=stats` devuelve el total de confirmados; la web lo usa para mostrar el contador de "focas confirmadas".

### Avisarle a todos por WhatsApp

En el editor de Apps Script ejecutá la función **`numerosParaAvisar()`** y mirá el
registro (*Ver → Registro de ejecución*): te lista todos los números separados por coma
—listos para armar una **lista de difusión** de WhatsApp— y abajo los links `wa.me`
de cada uno por si preferís escribirles uno por uno.

> ⚠️ Cada vez que edites `Codigo.gs` tenés que hacer **Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar**, si no sigue corriendo la versión vieja.

---

## 2. Publicar la página

### Dominio propio (fokapalooza.ar)

El sitio se publica en **https://fokapalooza.ar** (archivo `CNAME` en la raíz + los
registros DNS del dominio). `vmrodriguez90.github.io/foka-palooza` sigue existiendo pero
**redirige** al dominio propio: es el comportamiento normal de Pages cuando hay dominio
personalizado.

Los DNS que necesita son cuatro registros `A` de la raíz a `185.199.108.153`,
`185.199.109.153`, `185.199.110.153` y `185.199.111.153`, más un `CNAME` de `www` a
`vmrodriguez90.github.io`. En Settings → Pages tiene que aparecer el tilde verde de
*DNS check successful*, y conviene tildar **Enforce HTTPS** una vez que GitHub emitió
el certificado (puede tardar un rato largo la primera vez).

> ⚠️ Las meta de compartir apuntan a `https://fokapalooza.ar` con URL absoluta. Hasta
> que el dominio resuelva **y** tenga certificado HTTPS válido, WhatsApp no va a poder
> bajar la imagen del preview — y cachea el resultado por varios días. Antes de mandar
> el link a nadie, abrí `https://fokapalooza.ar` y confirmá que carga con candado, y
> después probá el preview en [opengraph.xyz](https://www.opengraph.xyz/).

Si cambiás de dominio otra vez, hay que tocar las URLs absolutas del `<head>` de
`index.html` **y de `torneo.html`** (`canonical`, `og:url`, `og:image`,
`og:image:secure_url`, `twitter:image`), `event.url` en el bloque `const FOKA` de
`index.html`, y `URL_SITIO` en `Codigo.gs`.

### Opción A — GitHub Pages (gratis, recomendada)

1. En el repo: **Settings → Pages**.
2. *Source*: **Deploy from a branch** · *Branch*: `main` · carpeta `/ (root)` → **Save**.
3. En un par de minutos queda publicado (hoy, en `https://fokapalooza.ar`).

### Opción B — Netlify / Vercel

Arrastrá la carpeta a [app.netlify.com/drop](https://app.netlify.com/drop). Sale en 10 segundos.

---

## 3. El torneo (La Foka Kermesse)

El sábado se juega un torneo **por parejas**: se sortean entre los que confirmaron,
se juegan cinco pruebas y la pareja con más puntos se lleva el premio.

- **[`torneo.html`](torneo.html)** — pública. Tabla de posiciones, parejas, pruebas y
  bitácora. Se refresca sola cada 25 segundos; no hace falta que nadie recargue nada.
- **[`admin.html`](admin.html)** — privada (PIN). Desde ahí se arma todo.

### Poner el PIN (una vez)

El PIN **no está en el repositorio**: vive en las propiedades del proyecto de Apps Script.

- **Opción A (recomendada):** en el editor de Apps Script, ⚙️ **Configuración del
  proyecto → Propiedades del script → Agregar propiedad**:
  `PIN_TORNEO` = el PIN que quieras.
- **Opción B:** escribilo dentro de `configurarPin()` en `Codigo.gs`, ejecutá la
  función una vez desde el editor y después borralo del código.

Para chequear que quedó puesto, ejecutá `hayPin()` y mirá el registro. Si no hay PIN,
`admin.html` no deja entrar a nadie (y avisa por qué).

> El PIN cuida que no te cambien la tabla desde afuera, nada más. La página del torneo
> es pública a propósito: cualquiera con el link ve las parejas y los puntos. Lo que
> **no** sale nunca de la planilla son los teléfonos: el estado del torneo guarda
> nombres y nada más.

### El puntaje

| Puesto en la prueba | Puntos |
|---|---|
| 🥇 1º | 10 |
| 🥈 2º | 7 |
| 🥉 3º | 5 |
| 🎽 Jugó y perdió | 3 |

Empate: define quién ganó más pruebas (más oros, después más platas, después más
bronces). Si siguen iguales, comparten el puesto. El puntaje se cambia en un solo
lugar: `MEDALLAS`, arriba de [`assets/torneo-core.js`](assets/torneo-core.js).

### Cómo se usa el día del evento

Todo desde el teléfono, en `fokapalooza.ar/admin.html`:

1. **Jugadores** → *Traer confirmados de la planilla* trae a todos los que dijeron que sí.
   Los que marcaron que no juegan la kermesse entran **destildados**, para que los veas.
   A los que anotaste por fuera los sumás a mano (un nombre por renglón).
2. **Parejas** → *Sortear parejas*. Si sobra uno, se arma un trío: nadie queda afuera.
   - Podés marcar una pareja como **fija** y volver a sortear: esa queda como está y se
     mezclan las demás.
   - Cada sorteo usa una **semilla** que queda anotada. Si alguien grita "¡trampa!",
     con esa semilla se repite el mismo sorteo y se demuestra que salió así.
   - El nombre de cada pareja se puede editar (salen con nombres de fantasía).
3. **Pruebas y puntos** → poné la prueba en *Jugando* cuando arranque y cargá el
   puesto de cada pareja tocando 🥇/🥈/🥉/🎽. La tabla se recalcula sola.
4. **Bitácora** → el minuto a minuto, por si querés contar cómo viene.
5. **Publicar 🦭** → recién ahí se sube todo. Hasta que no toques ese botón, nadie ve
   los cambios.

**Sin señal:** todo lo que tocás queda guardado en el teléfono. Si se
corta internet, seguís cargando igual y publicás cuando vuelva. Si publicaste desde
otro teléfono en el medio, la consola te avisa antes de pisar nada.

**La intriga:** la quinta prueba está marcada como *secreta* y en la web pública sale
tapada ("Prueba secreta", con el nombre borroneado) hasta que la ponés en *Jugando* o
*Jugada*. Recién ahí se revela.

**Al final:** poné el torneo en *Terminado* y la página muestra el cartel de campeones
con la pareja ganadora.

### Si algo sale mal

- **Datos → Bajar copia (JSON)** te guarda todo el torneo en un archivo.
- **Datos → Pegar un JSON** lo vuelve a cargar (sirve para pasar de un teléfono a otro).
- **Datos → Traer del servidor** descarta lo local y trae lo último publicado.
- En la planilla, la hoja `Torneo` tiene el mismo JSON en una celda. Si se rompe algo,
  se puede vaciar esa celda y empezar de cero.

---

## 4. Que se vea bien al compartir por WhatsApp

Ya está resuelto en el `<head>` de `index.html`: etiquetas Open Graph + una imagen
de 1200×630 (`assets/og.png`) diseñada para leerse bien en el preview chico.

**Si publicás en otro dominio, cambiá estas 5 líneas** del `<head>` (WhatsApp no
ejecuta JavaScript, así que las URLs tienen que estar escritas a mano, absolutas y con `https`):

```html
<link rel="canonical" href="https://TU-DOMINIO/">
<meta property="og:url"                content="https://TU-DOMINIO/">
<meta property="og:image"              content="https://TU-DOMINIO/assets/og.png?v=6">
<meta property="og:image:secure_url"   content="https://TU-DOMINIO/assets/og.png?v=6">
<meta name="twitter:image"             content="https://TU-DOMINIO/assets/og.png?v=6">
```

Y en el bloque `const FOKA`, `event.url` (lo usa el botón de compartir y el `.ics`).
`torneo.html` tiene su propio juego de etiquetas, con su título y su descripción.

**Truco importante:** WhatsApp cachea el preview de cada URL por varios días. Si compartiste
el link antes de terminar la página y quedó feo, **subile el número a `?v=7`** (`?v=8`, `?v=9`…)
en las tres etiquetas de imagen y vuelve a generarse.

Para ver el preview antes de mandarlo: [opengraph.xyz](https://www.opengraph.xyz/) o el
[Sharing Debugger de Facebook](https://developers.facebook.com/tools/debug/) (WhatsApp usa el mismo scraper).

### Regenerar la imagen de preview

Si cambiás fechas o textos del afiche:

```bash
npm i playwright          # o usar una instalación existente
node tools/render-og.js   # edita tools/og-source.html y vuelve a correr esto
```

---

## 5. Cosas que vas a querer tocar

| Qué | Dónde |
|---|---|
| URL del Apps Script | `assets/config.js` |
| Hacia dónde corre el contador | `arranqueISO` en el bloque `const FOKA` de `index.html` |
| Horarios y lugares de cada día (botón "Agendar") | `event.days` en `index.html` |
| Mostrar/ocultar el contador de confirmados | `showStats` en `index.html` |
| Cómo se normalizan los números | `normalizarWhatsapp()` en `index.html` |
| Cuántos puntos vale cada puesto | `MEDALLAS` en `assets/torneo-core.js` |
| Cuáles son las pruebas de la kermesse | `pruebasPorDefecto()` en `assets/torneo-core.js` (y las tarjetas de la sección *Kermesse* en `index.html`) |
| Nombres de fantasía de las parejas | `NOMBRES` en `assets/torneo-core.js` |
| Colores y tipografías | `assets/foka.css` |

---

## 6. Tests

Sin CI ni frameworks: son scripts que se corren a mano y cuentan lo que ven.

```bash
npm test                        # todo junto
npm run test:rapido             # solo los que no necesitan navegador

node tools/test-whatsapp.js     # normalización de números
node tools/test-links.js        # los links de WhatsApp que arma la planilla
node tools/test-torneo.js       # sorteo, tabla de posiciones y desempates
node tools/test-apps-script.js  # el backend entero, contra una planilla de mentira
node tools/test-forms.js        # los formularios de index.html, con endpoint simulado
node tools/test-torneo-web.js   # torneo.html y admin.html, con endpoint simulado
node tools/audit-mobile.js      # desborde y tamaños táctiles en 320–768px
node tools/page-shot.js carpeta # capturas de index.html en desktop y mobile
```

Los últimos cuatro necesitan `npm i playwright`. `test-apps-script.js` corre
`Codigo.gs` en node con una planilla simulada: sirve para probar cambios del
backend sin tener que implementar en Google cada vez.

---

## Paleta y tipografías

| | |
|---|---|
| `#062C30` | fondo profundo |
| `#0B3C49` | superficies |
| `#1B6B73` | teal medio (cuerpo de la foca) |
| `#4FBDBB` | acento claro |
| `#E0F7F5` | texto |
| `#FF7A59` | coral (acento cálido) |
| `#FFD166` | dorado (destacados) |

Tipografías: **Anton** (títulos), **Bebas Neue** (etiquetas), **Space Grotesk** (texto), todas de Google Fonts.

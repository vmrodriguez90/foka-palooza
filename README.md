# 🦭 FOKA PALOOZA 2026

Landing del cumpleaños. **Miramar, Buenos Aires · Viernes 25, sábado 26 y domingo 27 de septiembre.**

| Día | Qué | Dónde |
|---|---|---|
| **Viernes 25** 🎂 | El cumple. Torneo de pool, birra y papas. La primera birra la paga el cumpleañero. | HISTER Beer Garden |
| **Sábado 26** 🎉 | El festejo grande: sanguches + **La Foka Kermesse**, torneo por parejas con premio. El que se queda a dormir trae sábanas. | La Foka House — Calle 28 nº 1824 (entre 35 y 37) |
| **Domingo 27** 🌊 | Cierre: playa, mates y posible olita. | El Náutico Miramar |

```
index.html             → la landing: los tres días, la kermesse y cómo terminó
torneo.html            → el torneo 2026, con el resultado escrito adentro
assets/foka.css        → estilos compartidos por las dos páginas
assets/torneo-core.js  → sorteo, puntajes y tabla (los usan torneo.html y los tests)
assets/og.png          → imagen de preview para WhatsApp (1200×630)
assets/grupo.png       → foto de perfil del grupo de WhatsApp (1000×1000)
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
7. Pegá la URL donde la vaya a usar quien la necesite.

> ℹ️ **Hoy nada del sitio llama a este endpoint.** Los formularios de
> confirmación y la consola del torneo se borraron cuando terminó el Foka
> Palooza 2026. El script y la planilla siguen acá porque guardan las
> confirmaciones de esa edición y porque sirven de base para la próxima.

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
edita a mano; la escribía la consola del torneo, que ya no existe.


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

## 2 bis. El grupo de WhatsApp

Las novedades del finde salen por el grupo **Foka Palooza 2026**. El link de
invitación está escrito en **tres** lugares (no hay forma de compartir una
constante entre el HTML, el JS y el Apps Script):

| Dónde | Para qué |
|---|---|
| `index.html` | el botón de *Gracias por venir* y el del pie |
| `torneo.html` | el botón abajo de la bitácora y el del pie |
| `apps-script/Codigo.gs` (`URL_GRUPO`) | los mensajes de WhatsApp que arma la planilla |

Si regenerás el link (WhatsApp deja resetearlo desde *Info del grupo →
Invitar por link → Restablecer*), cambialo en los cuatro.
**`node tools/test-links.js` compara las tres copias y avisa si alguna
quedó distinta**, así que no hace falta acordarse: correlo y listo.

> ⚠️ El link está en una página pública: cualquiera que entre a
> fokapalooza.ar puede sumarse al grupo. Si se llena de gente que no
> invitaste, resetealo desde WhatsApp y actualizá los cuatro lugares.

### La foto del grupo

`assets/grupo.png` es la foto de perfil, pensada para el recorte **circular**
de WhatsApp: la cara de la foca ocupa casi todo, porque en la lista de chats
se ve a 48-64 px y a ese tamaño un cuerpo entero o un texto chico no se
entienden. El nombre no va escrito en la imagen: WhatsApp ya lo muestra al
lado.

```bash
node tools/render-grupo.js                 # regenera assets/grupo.png
node tools/render-grupo.js /tmp/previa     # además, cómo se ve a 48/64/128/240 px
```

---

## 3. El torneo (La Foka Kermesse)

La edición 2026 **ya se jugó y está cerrada**. Catorce personas, siete parejas
sorteadas, cinco pruebas. Campeonas: **Las Focas Bravas** (Juan Pablo + Seba
Menendez) con 36 puntos.

El resultado completo —tabla, parejas, pruebas, crónica y bitácora— está en
[`torneo.html`](torneo.html), escrito adentro de la página en la constante
`TORNEO`. No se baja por red: la página abre con todo dibujado, sin fetch y sin
depender de nada. Editar esa constante es editar el torneo.

### Cómo se jugó

| # | Prueba | Formato | Ganador |
|---|---|---|---|
| 1 | 🍾 Tiro a las botellas | 10 dardos y 60 s por pareja, tirando alternado | Lobos de Mar |
| 2 | 🎯 Dardos | La escalera 20→15, 2 minutos por pareja | Marea Alta |
| 3 | 🏀 21 de básket | Tablero 1, limpio 2, se planta cuando quiere | Las Gaviotas (22) |
| 4 | ⛳ Mini golf | 2 hoyos, golpes alternados, tope de 6, un mulligan | Las Focas Bravas (2 golpes) |
| 5 | 🏎️ Carrera de autos | Vuelta contrarreloj con el mismo auto + final | Dúo Dinamita (40 s) |

Había una sexta prueba secreta —una trivia que valía doble— que no llegó a
jugarse y salió del torneo.

**Puntaje:** 🥇 10 · 🥈 7 · 🥉 5 · y 3 por jugar. Los empates se resuelven por
más oros, después platas, después bronces; si queda un empate en el primer
puesto, muerte súbita al mini hoop.

Las reglas completas de cada prueba están en la propia página, en *Las reglas*.

### El sorteo

Las parejas salieron de `sortearParejas()`, en
[`assets/torneo-core.js`](assets/torneo-core.js), con la **semilla 361566**
anotada en la bitácora: con ese número el sorteo se repite idéntico. La función
respeta las parejas marcadas como fijas y, si sobra alguien, arma un trío en vez
de dejarlo afuera.

> ℹ️ **Para una próxima edición** hace falta volver a armar una consola: la que
> había (`admin.html`) se borró junto con la carga por red, y el backend de
> `Codigo.gs` quedó sin uso. Todo está en el historial de git.

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
| Link del grupo de WhatsApp | `index.html`, `torneo.html` y `URL_GRUPO` en `Codigo.gs` (ver sección 2 bis) |
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
node tools/test-links.js        # los mensajes de WhatsApp y las 3 copias del link del grupo
node tools/test-torneo.js       # sorteo, tabla de posiciones y desempates
node tools/test-apps-script.js  # el backend entero, contra una planilla de mentira
node tools/test-forms.js        # los formularios de index.html, con endpoint simulado
node tools/test-torneo-web.js   # que torneo.html se dibuje entero sin red
node tools/audit-mobile.js      # desborde y tamaños táctiles en 320–768px
node tools/page-shot.js carpeta # capturas de index.html en desktop y mobile
node tools/render-grupo.js      # la foto del grupo de WhatsApp
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

# 🦭 FOKA PALOOZA 2026

Landing del cumpleaños. **Viernes 25, sábado 26 y domingo 27 de septiembre.**
El cumple es el viernes 25; el festejo grande es el sábado 26.
Lineup por confirmarse: se anuncia el **15 de septiembre**.

```
index.html            → la página entera (HTML + CSS + JS, sin dependencias)
assets/og.png         → imagen de preview para WhatsApp (1200×630)
assets/favicon.svg    → la foca
assets/icon-512.png   → ícono para iOS / accesos directos
apps-script/Codigo.gs → backend: guarda las confirmaciones en Google Sheets
tools/                → scripts para regenerar la imagen de preview
```

---

## 1. Conectar el formulario (Google Sheets + Apps Script)

Toma 5 minutos y no requiere servidor ni pagar nada.

1. Creá una planilla nueva en [Google Sheets](https://sheets.new). Llamala *Foka Palooza 2026*.
2. Dentro de la planilla: **Extensiones → Apps Script**.
3. Borrá lo que haya y pegá todo el contenido de [`apps-script/Codigo.gs`](apps-script/Codigo.gs). Guardá (💾).
4. En el selector de funciones elegí **`inicializar`** y dale ▶️ *Ejecutar*.
   Google te va a pedir permisos: **Revisar permisos → tu cuenta → Configuración avanzada → Ir a (nombre del proyecto) → Permitir**.
   Esto crea las hojas `Confirmaciones` y `Avisos Lineup` con sus encabezados.
5. Arriba a la derecha: **Implementar → Nueva implementación → ⚙️ → Aplicación web**.
   - *Descripción*: `Foka Palooza`
   - *Ejecutar como*: **Yo**
   - *Quién tiene acceso*: **Cualquier usuario** ← importante, si no el formulario da error
6. **Implementar** y copiá la **URL de la aplicación web** (termina en `/exec`).
7. Abrí `index.html`, buscá el bloque `const FOKA = {` (cerca del final) y pegá la URL:

```js
const FOKA = {
  endpoint: 'https://script.google.com/macros/s/AKfy..../exec',
  ...
};
```

Listo. Cada confirmación cae como una fila en la planilla, en vivo.

**Probarlo sin llenar el formulario:** abrí en el navegador
`https://script.google.com/macros/s/..../exec?tipo=lineup&whatsapp=5491155555555`
Tiene que responder `{"ok":true,...}` y aparecer la fila en la hoja.

### Qué guarda

**No hace falta que escribas los encabezados a mano**: la función `inicializar()`
crea las dos hojas con estas columnas, en este orden exacto.

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

Hoja **`Avisos Lineup`**: `Fecha` · `WhatsApp` · `Escribirle` · `Origen`.
Acá el mensaje precargado es el del anuncio: *«🦭 ¡El lineup del Foka Palooza ya está
confirmado! Entrá a https://fokapalooza.ar»*. El texto sale de `mensajeLineup()` y el
de las confirmaciones de `mensajeGracias()`, las dos arriba de todo en `Codigo.gs`.
Se pueden probar con `node tools/test-links.js`.

> ⚠️ Si cambiás el **orden** de las columnas, hay que actualizar `COLUMNAS` en
> `Codigo.gs` (y el índice de la columna `Personas` que usa `estadisticas()`).
> Agregar columnas *a la derecha* de las que están es seguro.

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

### Avisar del lineup el 15/9

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

Si cambiás de dominio otra vez, hay que tocar las cinco URLs absolutas del `<head>`
(`canonical`, `og:url`, `og:image`, `og:image:secure_url`, `twitter:image`), `event.url`
en el bloque `const FOKA` de `index.html`, y `URL_SITIO` en `Codigo.gs`.

### Opción A — GitHub Pages (gratis, recomendada)

1. En el repo: **Settings → Pages**.
2. *Source*: **Deploy from a branch** · *Branch*: `main` · carpeta `/ (root)` → **Save**.
3. En un par de minutos queda publicado (hoy, en `https://fokapalooza.ar`).

### Opción B — Netlify / Vercel

Arrastrá la carpeta a [app.netlify.com/drop](https://app.netlify.com/drop). Sale en 10 segundos.

---

## 3. Que se vea bien al compartir por WhatsApp

Ya está resuelto en el `<head>` de `index.html`: etiquetas Open Graph + una imagen
de 1200×630 (`assets/og.png`, 133 KB) diseñada para leerse bien en el preview chico.

**Si publicás en otro dominio, cambiá estas 5 líneas** del `<head>` (WhatsApp no
ejecuta JavaScript, así que las URLs tienen que estar escritas a mano, absolutas y con `https`):

```html
<link rel="canonical" href="https://TU-DOMINIO/">
<meta property="og:url"                content="https://TU-DOMINIO/">
<meta property="og:image"              content="https://TU-DOMINIO/assets/og.png?v=3">
<meta property="og:image:secure_url"   content="https://TU-DOMINIO/assets/og.png?v=3">
<meta name="twitter:image"             content="https://TU-DOMINIO/assets/og.png?v=3">
```

Y en el bloque `const FOKA`, `event.url` (lo usa el botón de compartir y el `.ics`).

**Truco importante:** WhatsApp cachea el preview de cada URL por varios días. Si compartiste
el link antes de terminar la página y quedó feo, **subile el número a `?v=3`** (`?v=4`, `?v=5`…)
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

## 4. Cosas que vas a querer tocar

Todo está en el bloque `const FOKA = {` al final de `index.html`:

| Qué | Dónde |
|---|---|
| URL del Apps Script | `endpoint` |
| Cómo se normalizan los números | función `normalizarWhatsapp()` |
| Fecha del anuncio del lineup (contador) | `revealISO` — hoy `2026-09-15T20:00:00-03:00` |
| Horarios de cada día (para el botón "Agendar") | `event.days` |
| Mostrar/ocultar el contador de confirmados | `showStats` |

**Cuando salga el lineup (15/9):** en la sección *El cronograma*, cada tarjeta tiene
los nombres tapados con `class="blurline"`. Reemplazá esos `<p>` por los artistas reales
y sacá la clase `blurline` (la que aplica el desenfoque). También conviene cambiar el
título de la sección del contador y el texto del `og:description`.

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

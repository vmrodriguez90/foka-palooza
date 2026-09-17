/* ==================================================================
   FOKA PALOOZA 2026 — configuración compartida
   ------------------------------------------------------------------
   La URL del Apps Script vive acá y nada más que acá: la usan
   index.html (confirmaciones), torneo.html (leer el torneo) y
   admin.html (escribirlo).

   Para cambiarla: Implementar > Nueva implementación > Aplicación web
   en el editor de Apps Script, y pegá la URL que termina en /exec.
   Si la dejás vacía, los formularios avisan que falta configurarla.
   ================================================================== */
/* El `|| {}` de abajo es para que los tests (y cualquier prueba local)
   puedan definir otro endpoint antes de que cargue este archivo. */
window.FOKA_CONFIG = window.FOKA_CONFIG || {
  endpoint: 'https://script.google.com/macros/s/AKfycbzdk-u22z5wR1hQgp7UXaKJAjWB35v8RwSlNU_70lkd2FXdIV7EDUH2XqfzK-kNmGrM/exec',

  /* Grupo de WhatsApp donde salen las novedades del finde.
     ⚠️ Si lo cambiás (WhatsApp deja regenerar el link de invitación),
     cambialo TAMBIÉN en los botones de index.html y torneo.html y en
     URL_GRUPO de apps-script/Codigo.gs. `node tools/test-links.js`
     avisa si alguna de las cuatro copias quedó distinta. */
  grupo: 'https://chat.whatsapp.com/JV6Nd6GpgEjBdTMVPJ9eah'
};

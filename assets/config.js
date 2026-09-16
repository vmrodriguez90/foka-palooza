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
  endpoint: 'https://script.google.com/macros/s/AKfycbzdk-u22z5wR1hQgp7UXaKJAjWB35v8RwSlNU_70lkd2FXdIV7EDUH2XqfzK-kNmGrM/exec'
};

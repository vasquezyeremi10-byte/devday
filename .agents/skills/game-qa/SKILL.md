---
name: game-qa
description: Verificar movimiento, colisiones, cámara, excavación y rendimiento de MINA CERO con Vitest y navegador real.
---

Leer docs/QA_REPORT.md y scripts de package.json. Ejecutar typecheck, lint, test y build; comprobar el comportamiento en Edge con test:e2e. Usar npm local mediante npm.cmd si no está en PATH.

- Probar A/D y flechas, salto solo con soporte, caída y aterrizaje sin penetración. Mantener salto pulsado no debe producir saltos automáticos.
- Caminar más allá de media pantalla, verificar scroll y límites. Hacer clic en un bloque después de desplazar la cámara para detectar errores entre pantalla/mundo.
- Verificar selección alcanzable/no alcanzable, excavación del suelo, pared lateral, bloque lejano, fondo y roca protegida. Comparar datos, Tilemap y colisión.
- Reiniciar varias veces y verificar spawn, terreno restaurado y ausencia de listeners duplicados. Revisar errores de consola y solicitudes fallidas.
- Capturar pantalla a 480 × 270 y múltiplos enteros; detectar píxeles borrosos, HUD superpuesto y clipping en pantalla estrecha.
- Medir FPS en el navegador usado e informar duración, navegador y si es headless. No presentar una medición local como garantía para todos los equipos.
- Registrar comandos, resultados y limitaciones reales. Las capturas prueban apariencia; las aserciones físicas y de estado prueban comportamiento.

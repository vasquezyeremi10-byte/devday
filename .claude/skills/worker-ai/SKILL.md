---
name: worker-ai
description: Diseñar trabajadores, tareas y navegación sobre terreno mutable de MINA CERO cuando se solicite automatización.
---

No añadir trabajadores automáticos al prototipo 0.1. Cuando se autoricen, separar planificador, estado del trabajador y navegación de sprites/animación.

- Modelar estados explícitos idle, moving, mining, hauling y blocked, con transición y condición de salida verificables.
- Reservar tareas y destinos de forma exclusiva; liberar la reserva al cancelar, terminar o eliminar al trabajador. Evitar dos asignaciones al mismo bloque.
- Derivar transitabilidad de celdas vacías y soporte, usando tamaño físico y salto permitido del trabajador; no tratar aire sin suelo como ruta caminable.
- Invalidar rutas con una revisión de terreno al excavar; recalcular solo cuando afecte al camino y limitar búsquedas por frame.
- Si no hay ruta, devolver blocked con causa y reintento acotado ante cambio del mundo. No teletransportar trabajadores para ocultar fallos.
- Probar pared creada/eliminada, objetivo excavado por otro actor, depósito lleno y cancelación. Medir planificación con 1, 10 y 50 trabajadores antes de aumentar escala.

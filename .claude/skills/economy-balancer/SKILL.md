---
name: economy-balancer
description: Balancear producción, costos, salarios y mejoras de MINA CERO cuando se autorice la etapa económica.
---

Esta skill no amplía el alcance del prototipo 0.1. Consultar GAME_DESIGN y confirmar en la petición que se solicita economía antes de implementar.

- Expresar cantidades en unidades de mineral, segundos y monedas enteras; separar precio de venta, costo operativo y costo inicial.
- Modelar producción efectiva como mínimo de extracción, capacidad de transporte y procesamiento. No sumar capacidades en serie.
- Para cada mejora calcular costo, incremento de beneficio neto por minuto y tiempo de amortización; si beneficio incremental es cero o negativo, explicitarlo.
- Incluir salarios durante inactividad y comparar escenarios de 1, 3 y 10 trabajadores, disponibilidad baja de mineral y transporte saturado.
- Mantener parámetros en data, fórmulas puras en systems y pruebas de saldo no negativo, conservación de inventario y redondeo. No monetizar dos veces el mismo lote.
- Entregar tabla de supuestos y simulación breve de la primera sesión; no fijar precios definitivos sin medir tiempos reales del juego ni activar compras externas.

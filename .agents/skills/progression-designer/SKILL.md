---
name: progression-designer
description: Diseñar experiencia, niveles, desbloqueos y habilidades de MINA CERO cuando se solicite la etapa de progresión.
---

No implementar progresión en el prototipo inicial. Ante una petición futura, partir de acciones y tiempos medidos, no de curvas arbitrarias.

- Definir qué evento otorga XP, cantidad, frecuencia máxima y si puede repetirse. No otorgar XP por un clic fallido ni por recargar la escena.
- Representar desbloqueos como grafo sin ciclos con requisitos verificables; la primera sesión debe tener un siguiente objetivo alcanzable sin sistemas aún bloqueados.
- Mantener XP acumulada y umbrales monotónicos; manejar varias subidas de nivel en una sola recompensa sin perder excedente.
- Para cada habilidad indicar costo, efecto cuantificable, dependencia y posible sinergia; distinguir mejora de capacidad de mejora de velocidad.
- Simular tiempos de primer desbloqueo y de 3 hitos con producción baja/media/alta. Documentar supuestos y evitar recompensas que salten etapas de transporte o herramientas.
- Probar límites exactos, recompensa duplicada, requisitos cíclicos y carga de una partida de versión anterior cuando exista persistencia.

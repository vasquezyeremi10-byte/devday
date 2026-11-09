# MINA CERO

## Alcance vigente

Prototipo 0.1: una escena MiningScene, movimiento, salto, colisiones, cámara y excavación temporal. No implementar economía, trabajadores, progresión ni maquinaria sin una nueva instrucción explícita. Las skills de esas áreas preparan trabajo futuro; no lo autorizan.

## Entorno y comprobación

- Windows: ejecutar `. ./activar-entorno.ps1` para habilitar Node/npm en esta consola. Alternativa sin modificar PATH: `.\npm.cmd run <script>`.
- Dependencias locales y versiones exactas; conservar package-lock.json. No cambiar configuración global ni instalar aplicaciones del sistema.
- Ejecutar typecheck, lint, test, build y test:e2e después de cambios de comportamiento. Edge está instalado; Playwright usa ese navegador.
- No afirmar que una prueba pasó si no se ejecutó. Registrar limitaciones en docs/QA_REPORT.md.

## Arquitectura

- Lógica pura del terreno y alcance independiente de Phaser, con pruebas Vitest.
- Phaser conecta física, dibujo e input; MiningScene coordina sistemas, no contiene reglas económicas.
- Capas de config/layers.ts: fondos, terreno, estructuras, personajes, maquinaria, primer plano, UI. Nunca deducir colisión desde fondos.
- 480 × 270, tiles 16 × 16, nearest-neighbor y escalado entero cuando hay espacio. Assets provisionales originales; no producir arte definitivo.
- Importaciones de PNG/spritesheets/mapas mediante data/assets.ts y systems/AssetLoader.ts. Consultar docs/ASSET_SPEC.md.
- El terreno se regenera al reiniciar; no hay persistencia en esta etapa.

## Skills

Skills del repositorio en `.agents/skills/`, descubiertas por Codex al abrir este proyecto. Leer solo las pertinentes.

- Oficiales Phaser 4: game-setup-and-config, scenes, physics-arcade, tilemaps, cameras, input-keyboard-mouse-touch, loading-assets, scale-and-responsive, sprites-and-images, v3-to-v4-migration.
- Personalizadas: pixel-art-director, mining-gameplay, economy-balancer, worker-ai, progression-designer, game-qa.
- Las oficiales son documentación: sus rutas `src/...` apuntan al repositorio Phaser, no a este proyecto. Ver procedencia en docs/SKILLS.md. Consultar los tipos de Phaser instalados si un ejemplo difiere de 4.2.1.

## Disciplina

Mantener comentarios y documentación en español, identificadores técnicos en inglés. Evitar dependencias nuevas si Phaser o las APIs del navegador resuelven la necesidad. No clonar repositorios completos para leer documentación. No añadir telemetría.

# MINA CERO

Prototipo jugable de minería 2D con Phaser 4, TypeScript y Vite. Gráficos provisionales originales, 480 × 270 px y tiles de 16 × 16.

## Ejecutar en este equipo

```powershell
cd C:\Users\josel\OneDrive\Desktop\minerito
.\npm.cmd run dev
```

Abrir http://127.0.0.1:5173/. Para habilitar los comandos habituales solo en esta consola:

```powershell
. .\activar-entorno.ps1
npm run dev
```

A/D o flechas: movimiento. Espacio/W/arriba: salto. Apuntar y clic izquierdo: excavar. R o botón: restaurar mina. Acercarse hasta que el borde sea dorado. El carrito y la pala son decorativos. No hay guardado.

## Comprobar

```powershell
.\npm.cmd run typecheck
.\npm.cmd run lint
.\npm.cmd run test
.\npm.cmd run build
.\npm.cmd run test:e2e
.\npm.cmd run format:check
```

Las pruebas de navegador usan Microsoft Edge instalado. No descargan otro navegador. Los resultados JSON quedan en test-results; las capturas revisables en docs/screenshots.

## Documentación

- [Entorno, versiones y reinstalación](docs/SETUP.md)
- [Visión y alcance](docs/GAME_DESIGN.md)
- [Especificación de PNG, spritesheets y mapas](docs/ASSET_SPEC.md)
- [Skills oficiales y personalizadas](docs/SKILLS.md)
- [Informe de comprobaciones](docs/QA_REPORT.md)
- [Reglas de colaboración](AGENTS.md)

## Estructura

```text
.agents/skills/         10 skills oficiales + 6 personalizadas
src/
  main.ts              Inicio y escalado del canvas
  style.css            Interfaz de la página
  game/
    config/            Resolución, física y profundidades
    data/              Manifiesto de assets y capas externas
    entities/          Minero y controles
    scenes/            MiningScene
    systems/           Carga de assets y excavación pura
    ui/                HUD de profundidad y objetivo
    world/             Grilla, Tilemap, capas y arte provisional
public/assets/
  backgrounds/
  characters/
  terrain/
  machines/
  ui/
tests/                 Pruebas Playwright sobre Edge
scripts/               Restauración del entorno portátil
docs/                  Diseño, assets, setup, QA y capturas
```

Terreno y colisiones no dependen de los fondos. Las siete profundidades de render están declaradas en config/layers.ts. No se han implementado economía, automatización ni progresión.

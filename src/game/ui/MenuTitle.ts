import Phaser from 'phaser';
import { MENU_TITLE_LINES, MENU_TITLE_TEXTURE } from '../config/menu';
import { PALETTE as P } from '../config/palette';
import { MenuTitleShine } from './MenuTitleShine';
import { pixelText, smallText } from './PixelFont';

const LOGO_WIDTH = 154;
// Cortes en la textura de 154 × 59, en el orden de lectura.
const FRAMES = [
  { y: 0, height: 15 },
  { y: 15, height: 28 },
  { y: 45, height: 14 },
] as const;
const SUBTITLE_Y = 69;
const RULE_Y = 79;
const RULE_WIDTH = 138;
const LINE_STAGGER = 160;
const DROP = [-3, -2, -1, 0] as const;
const DROP_STEP = 45;
const SUBTITLE_DELAY = 140;
const CHAR_STEP = 22;

type TitleLine = Phaser.GameObjects.Image | Phaser.GameObjects.BitmapText;

/** Logotipo mineral en tres líneas y subtítulo bitmap sobre la rejilla nativa. */
export class MenuTitle {
  private readonly lines: TitleLine[];
  private readonly subtitle: Phaser.GameObjects.BitmapText;
  private readonly shadow: Phaser.GameObjects.BitmapText;
  private readonly rule: Phaser.GameObjects.Graphics;
  private readonly shine?: MenuTitleShine;
  private start = -1;
  private revealedAt = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    private readonly y: number,
    private readonly fullSubtitle: string,
    depth: number,
  ) {
    const center = x + 70;
    const layer = depth + 1;
    const texture = scene.textures.exists(MENU_TITLE_TEXTURE)
      ? scene.textures.get(MENU_TITLE_TEXTURE)
      : null;
    texture?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.lines = FRAMES.map((frame, index) => {
      if (texture) {
        const name = `line-${index}`;
        if (!texture.has(name)) texture.add(name, 0, 0, frame.y, LOGO_WIDTH, frame.height);
        return scene.add
          .image(center - LOGO_WIDTH / 2, y + frame.y, texture.key, name)
          .setOrigin(0)
          .setDepth(layer);
      }
      // Si falla la carga del PNG, el menú conserva un título legible.
      const label = pixelText(scene, 0, y + frame.y, MENU_TITLE_LINES[index]!, P.gold)
        .setScale(index === 1 ? 2 : 1)
        .setDepth(layer);
      return label.setX(center - Math.floor(label.displayWidth / 2));
    });
    const middle = this.lines[1];
    if (middle instanceof Phaser.GameObjects.Image)
      this.shine = new MenuTitleShine(middle, layer + 1);
    this.subtitle = smallText(scene, 0, SUBTITLE_Y, fullSubtitle, 0xffedc5).setDepth(layer);
    const subtitleX = center - Math.floor(this.subtitle.width / 2);
    this.subtitle.setX(subtitleX);
    this.shadow = smallText(scene, subtitleX + 1, SUBTITLE_Y + 1, fullSubtitle, P.ink).setDepth(depth);
    this.rule = scene.add.graphics().setDepth(layer);
    this.rule
      .fillStyle(P.ink).fillRect(x, RULE_Y, RULE_WIDTH + 1, 4)
      .fillStyle(P.gold).fillRect(x + 1, RULE_Y + 1, RULE_WIDTH - 1, 2)
      .fillStyle(P.cream).fillRect(x + 1, RULE_Y + 1, RULE_WIDTH - 1, 1)
      .fillStyle(P.silver).fillRect(x, RULE_Y, 2, 4)
      .fillRect(x + RULE_WIDTH - 1, RULE_Y, 2, 4);
  }

  play(delay: number, reduced: boolean): void {
    if (reduced) return this.showInstant();
    this.start = this.scene.time.now + delay;
    for (const line of this.lines) line.setVisible(false);
    this.setSubtitle('');
    this.rule.setVisible(false);
  }

  showInstant(): void {
    this.start = -1;
    this.revealedAt = this.scene.time.now;
    this.lines.forEach((line, i) => line.setY(this.y + FRAMES[i]!.y).setVisible(true));
    this.setSubtitle(this.fullSubtitle);
    this.rule.setVisible(true);
  }

  get revealed(): boolean {
    return this.start < 0;
  }

  update(time: number, effects: boolean): void {
    if (!this.revealed) this.animateIn(time);
    this.shine?.update(time - this.revealedAt, effects && this.revealed);
  }

  private animateIn(time: number): void {
    if (time < this.start) return;
    const elapsed = time - this.start;
    this.lines.forEach((line, i) => {
      const local = elapsed - i * LINE_STAGGER;
      if (local < 0) return;
      const step = Math.min(DROP.length - 1, Math.floor(local / DROP_STEP));
      line.setY(this.y + FRAMES[i]!.y + DROP[step]!).setVisible(true);
    });
    const subtitleTime =
      elapsed - ((this.lines.length - 1) * LINE_STAGGER + DROP.length * DROP_STEP + SUBTITLE_DELAY);
    if (subtitleTime < 0) return;
    const count = 1 + Math.floor(subtitleTime / CHAR_STEP);
    if (count >= this.fullSubtitle.length) this.showInstant();
    else {
      this.rule.setVisible(true);
      this.setSubtitle(this.fullSubtitle.slice(0, count));
    }
  }

  private setSubtitle(text: string): void {
    this.subtitle.setText(text);
    this.shadow.setText(text);
  }
}

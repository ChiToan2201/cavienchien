import Phaser from 'phaser';
import { GameStateManager } from '../managers/GameStateManager';
import { TASTE_THEME } from '../config/tasteTheme';

export class Player extends Phaser.GameObjects.Container {
  private chefSprite!: Phaser.GameObjects.Image;
  private speechBg!: Phaser.GameObjects.Graphics;
  private speechText!: Phaser.GameObjects.Text;
  private frameIndex = 0;
  private isBusy = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    // `chef_raw` is registered by `SpriteForgeProcessor.processSpritesheetTexture` at 220x280 per frame
    this.chefSprite = scene.add.image(0, 0, 'chef_raw', 0).setScale(0.45);
    this.add(this.chefSprite);

    this.speechBg = scene.add.graphics();
    this.speechText = scene.add
      .text(44, -26, '', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '11px',
        fontStyle: '700',
        color: TASTE_THEME.colors.inkDark,
      })
      .setOrigin(0, 0.5);

    this.add([this.speechBg, this.speechText]);
    this.hideSpeech();

    // Gentle idle breathing + frame swap
    scene.tweens.add({
      targets: this.chefSprite,
      y: -2.5,
      duration: 680,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    scene.time.addEvent({
      delay: 950,
      loop: true,
      callback: () => {
        if (!this.isBusy) {
          this.frameIndex = this.frameIndex === 0 ? 1 : 0;
          this.chefSprite.setFrame(this.frameIndex);
        }
      },
    });
  }

  public playCheer(message?: string): void {
    this.isBusy = true;
    this.chefSprite.setFrame(4);
    if (message) {
      this.showSpeech(message);
    }
    this.scene.time.delayedCall(900, () => {
      this.isBusy = false;
      this.chefSprite.setFrame(3);
      this.hideSpeech();
    });
  }

  public playCookingGesture(): void {
    this.isBusy = true;
    this.chefSprite.setFrame(3);
    this.scene.time.delayedCall(550, () => {
      this.isBusy = false;
      this.chefSprite.setFrame(0);
    });
  }

  private showSpeech(msg: string): void {
    this.speechText.setText(msg);
    this.speechText.setVisible(true);
    const b = this.speechText.getBounds();
    this.speechBg.clear();
    this.speechBg.fillStyle(TASTE_THEME.colors.cardCream, 0.98);
    this.speechBg.fillRoundedRect(36, -39, b.width + 16, 26, 8);
    this.speechBg.lineStyle(1, TASTE_THEME.colors.borderHairlineLight, 1);
    this.speechBg.strokeRoundedRect(36, -39, b.width + 16, 26, 8);
    this.speechBg.setVisible(true);
  }

  private hideSpeech(): void {
    this.speechBg.setVisible(false);
    this.speechText.setVisible(false);
  }
}

export { GameStateManager };

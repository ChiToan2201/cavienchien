import Phaser from 'phaser';
import { FoodDefinition } from '../data/foods';
import { GameStateManager } from '../managers/GameStateManager';
import { TASTE_THEME } from '../config/tasteTheme';

export class FoodTray extends Phaser.GameObjects.Container {
  private gs: GameStateManager;
  public readonly foodDef: FoodDefinition;

  private trayBg!: Phaser.GameObjects.Graphics;
  private foodSprite!: Phaser.GameObjects.Image;
  private nameText!: Phaser.GameObjects.Text;
  private priceText!: Phaser.GameObjects.Text;
  private cookedBadgeBg!: Phaser.GameObjects.Graphics;
  private cookedText!: Phaser.GameObjects.Text;
  private rawText!: Phaser.GameObjects.Text;
  private statusTag!: Phaser.GameObjects.Text;
  private cookProgressBar!: Phaser.GameObjects.Graphics;
  private lockOverlay!: Phaser.GameObjects.Container;

  public readonly trayWidth: number;
  public readonly trayHeight: number;
  private readonly baseY: number;
  private isCookingActive = false;
  private cookingProgressRatio = 0;
  private cookingProgressStatus: 'idle' | 'cooking' | 'ready' | 'burned' = 'idle';
  private isOrderNeeded = false;
  private isHovered = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    foodDef: FoodDefinition,
    onTapTray: (foodDef: FoodDefinition) => void
  ) {
    super(scene, x, y);
    this.gs = GameStateManager.getInstance();
    this.foodDef = foodDef;
    this.trayWidth = width;
    this.trayHeight = height;
    this.baseY = y;

    this.buildTray(onTapTray);
    this.refresh();
  }

  private buildTray(onTapTray: (foodDef: FoodDefinition) => void): void {
    const w = this.trayWidth;
    const h = this.trayHeight;
    const isCompact = h < 92;

    this.trayBg = this.scene.add.graphics();
    this.add(this.trayBg);

    // Registered Food Sprite (`SpriteForgeProcessor` normalized to 256x256 center)
    const spriteY = isCompact ? -4 : -6;
    this.foodSprite = this.scene.add.image(0, spriteY, this.foodDef.textureKey);
    const maxSprW = w - (isCompact ? 20 : 28);
    const maxSprH = h - (isCompact ? 30 : 38);
    const scale = Math.min(
      maxSprW / Math.max(1, this.foodSprite.width),
      maxSprH / Math.max(1, this.foodSprite.height),
      0.56
    );
    this.foodSprite.setScale(scale);
    this.add(this.foodSprite);

    // Bottom Footer: Name on left, Price on right (`cards.md` clean cohesive baseline)
    const footerY = h / 2 - (isCompact ? 11 : 12);
    this.nameText = this.scene.add
      .text(-w / 2 + 8, footerY, this.foodDef.shortName, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: isCompact ? '10px' : '11.5px',
        fontStyle: '800',
        color: TASTE_THEME.colors.inkDark,
      })
      .setOrigin(0, 0.5);
    this.add(this.nameText);

    this.priceText = this.scene.add
      .text(w / 2 - 8, footerY, `${(this.foodDef.sellPrice / 1000).toFixed(0)}K`, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: isCompact ? '9.5px' : '11px',
        fontStyle: '800',
        color: '#b45309',
      })
      .setOrigin(1, 0.5);
    this.add(this.priceText);

    // Top-right badge: Cooked Stock on tray (ready to serve)
    this.cookedBadgeBg = this.scene.add.graphics();
    this.add(this.cookedBadgeBg);

    this.cookedText = this.scene.add
      .text(w / 2 - 23, -h / 2 + 12, '0', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: isCompact ? '10px' : '10.5px',
        fontStyle: '800',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.add(this.cookedText);

    // Top-left mini indicator: Raw stock in freezer (no boxy background)
    this.rawText = this.scene.add
      .text(-w / 2 + 8, -h / 2 + 7, 'Trữ: 0', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: isCompact ? '9.5px' : '10.5px',
        fontStyle: '700',
        color: TASTE_THEME.colors.inkBody,
      })
      .setOrigin(0, 0);
    this.add(this.rawText);

    // Status pill (ĐANG CHIÊN / CHẠM CHIÊN / HẾT KHO)
    this.statusTag = this.scene.add
      .text(0, isCompact ? -1 : 2, '', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: isCompact ? '8.5px' : '10px',
        fontStyle: '800',
        color: '#ffffff',
        backgroundColor: '#d9381e',
        padding: { left: 5, right: 5, top: 2, bottom: 2 },
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.add(this.statusTag);

    // Mini Frying Timing Bar on the tray card
    this.cookProgressBar = this.scene.add.graphics();
    this.add(this.cookProgressBar);

    // Locked overlay container (`cards.md` clean dark glass state)
    this.lockOverlay = this.scene.add.container(0, 0);
    const lockBg = this.scene.add.graphics();
    lockBg.fillStyle(TASTE_THEME.colors.cardLocked, 0.92);
    lockBg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    lockBg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
    lockBg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);

    const lockTitle = this.scene.add
      .text(0, -10, `🔒 Mở ở Cấp ${this.foodDef.unlockLevel}`, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: isCompact ? '10px' : '11px',
        fontStyle: '700',
        color: TASTE_THEME.colors.inkMutedOnDark,
      })
      .setOrigin(0.5);

    const lockPrice = this.scene.add
      .text(0, 9, `${(this.foodDef.unlockCost / 1000).toFixed(0)}.000đ`, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: isCompact ? '11px' : '12.5px',
        fontStyle: '800',
        color: TASTE_THEME.colors.inkGold,
      })
      .setOrigin(0.5);

    this.lockOverlay.add([lockBg, lockTitle, lockPrice]);
    this.add(this.lockOverlay);

    // Interactive touch & mouse hover zone (`motion.md`: 2px card lift on hover, .985 press)
    const hitZone = this.scene.add
      .rectangle(0, 0, w, h, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });

    hitZone.on('pointerover', () => {
      this.isHovered = true;
      this.refresh();
      this.scene.tweens.add({
        targets: this,
        y: this.baseY - 2,
        duration: TASTE_THEME.motion.fast,
        ease: TASTE_THEME.motion.easeOut,
      });
    });

    hitZone.on('pointerout', () => {
      this.isHovered = false;
      this.refresh();
      this.scene.tweens.add({
        targets: this,
        y: this.baseY,
        scaleX: 1.0,
        scaleY: 1.0,
        duration: TASTE_THEME.motion.fast,
        ease: TASTE_THEME.motion.easeOut,
      });
    });

    hitZone.on('pointerdown', () => {
      this.scene.tweens.add({
        targets: this,
        y: this.baseY + 1,
        scaleX: 0.975,
        scaleY: 0.975,
        duration: 75,
        yoyo: true,
        ease: TASTE_THEME.motion.easeOut,
      });
      onTapTray(this.foodDef);
    });
    this.add(hitZone);
  }

  public setCookingActive(active: boolean): void {
    if (this.isCookingActive !== active) {
      this.isCookingActive = active;
      this.refresh();
    }
  }

  public setCookingProgress(
    ratio: number,
    status: 'idle' | 'cooking' | 'ready' | 'burned'
  ): void {
    const clamped = Phaser.Math.Clamp(ratio, 0, 1);
    const active = status !== 'idle';
    const statusChanged =
      this.cookingProgressStatus !== status || this.isCookingActive !== active;
    this.cookingProgressRatio = clamped;
    this.cookingProgressStatus = status;
    this.isCookingActive = active;

    if (statusChanged) {
      this.refresh();
    } else {
      this.drawCookProgressBar();
    }
  }

  private drawCookProgressBar(): void {
    if (!this.cookProgressBar) return;
    this.cookProgressBar.clear();

    const stock = this.gs.state.foods[this.foodDef.id];
    if (!stock || !stock.unlocked || this.cookingProgressStatus === 'idle') {
      return;
    }

    const w = this.trayWidth;
    const h = this.trayHeight;
    const barW = w - 16;
    const barH = h < 92 ? 4.5 : 5.5;
    const barX = -barW / 2;
    const barY = h / 2 - 27;

    this.cookProgressBar.fillStyle(TASTE_THEME.colors.bgBase, 0.85);
    this.cookProgressBar.fillRoundedRect(barX, barY, barW, barH, 2.5);

    if (this.cookingProgressStatus === 'cooking') {
      this.cookProgressBar.fillStyle(TASTE_THEME.colors.accentGold, 1);
      this.cookProgressBar.fillRoundedRect(
        barX,
        barY,
        Math.max(4, barW * this.cookingProgressRatio),
        barH,
        2.5
      );
      // Golden milestone notch at the right end
      this.cookProgressBar.fillStyle(TASTE_THEME.colors.successLight, 1);
      this.cookProgressBar.fillRect(barX + barW - 3, barY - 1, 2, barH + 2);
    } else if (this.cookingProgressStatus === 'ready') {
      const remainRatio = Phaser.Math.Clamp(1 - this.cookingProgressRatio, 0, 1);
      const barColor =
        this.cookingProgressRatio < 0.45
          ? TASTE_THEME.colors.successLight
          : this.cookingProgressRatio < 0.75
            ? TASTE_THEME.colors.accentAmber
            : TASTE_THEME.colors.danger;
      this.cookProgressBar.fillStyle(barColor, 1);
      this.cookProgressBar.fillRoundedRect(
        barX,
        barY,
        Math.max(4, barW * remainRatio),
        barH,
        2.5
      );
    } else if (this.cookingProgressStatus === 'burned') {
      this.cookProgressBar.fillStyle(TASTE_THEME.colors.danger, 1);
      this.cookProgressBar.fillRoundedRect(barX, barY, barW, barH, 2.5);
    }
  }

  public setOrderNeeded(needed: boolean): void {
    if (this.isOrderNeeded !== needed) {
      this.isOrderNeeded = needed;
      this.refresh();
    }
  }

  public refresh(): void {
    const w = this.trayWidth;
    const h = this.trayHeight;
    const stock = this.gs.state.foods[this.foodDef.id];
    const maxTray = this.gs.getMaxTrayCapacity();

    this.trayBg.clear();
    if (this.cookProgressBar) this.cookProgressBar.clear();

    if (!stock || !stock.unlocked) {
      this.lockOverlay.setVisible(true);
      this.cookedBadgeBg.setVisible(false);
      this.cookedText.setVisible(false);
      this.rawText.setVisible(false);
      this.priceText.setVisible(false);
      this.nameText.setVisible(false);
      this.statusTag.setVisible(false);
      this.foodSprite.setAlpha(0.18);
      return;
    }

    this.lockOverlay.setVisible(false);
    this.cookedBadgeBg.setVisible(true);
    this.cookedText.setVisible(true);
    this.rawText.setVisible(true);
    this.priceText.setVisible(true);
    this.nameText.setVisible(true);

    const hasCooked = stock.cookedStock > 0;

    // Single clean card surface (`cards.md` — no 3-level nested boxes)
    const surfaceColor = this.isHovered
      ? TASTE_THEME.colors.cardCreamHover
      : hasCooked
        ? TASTE_THEME.colors.cardCream
        : TASTE_THEME.colors.cardWarmAlt;

    this.trayBg.fillStyle(surfaceColor, 1);
    this.trayBg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);

    // Subtle footer strip for the food name
    this.trayBg.fillStyle(TASTE_THEME.colors.cardMuted, 0.55);
    this.trayBg.fillRoundedRect(-w / 2 + 2, h / 2 - 22, w - 4, 20, {
      tl: 0,
      tr: 0,
      bl: 9,
      br: 9,
    });

    // State-aware border (1px hairline normal, 2px semantic focus when needed or frying)
    if (this.cookingProgressStatus === 'burned') {
      this.trayBg.lineStyle(2, TASTE_THEME.colors.danger, 1);
    } else if (this.cookingProgressStatus === 'ready') {
      this.trayBg.lineStyle(2, TASTE_THEME.colors.successLight, 1);
    } else if (this.isOrderNeeded && !hasCooked) {
      this.trayBg.lineStyle(2, TASTE_THEME.colors.danger, 1);
    } else if (this.isCookingActive) {
      this.trayBg.lineStyle(2, TASTE_THEME.colors.accentAmber, 1);
    } else if (this.isHovered) {
      this.trayBg.lineStyle(1.5, TASTE_THEME.colors.accentPrimary, 0.9);
    } else if (hasCooked) {
      this.trayBg.lineStyle(1, TASTE_THEME.colors.borderHairlineLight, 1);
    } else {
      this.trayBg.lineStyle(1, 0xcabaa6, 1);
    }
    this.trayBg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);

    // Food sprite visibility
    this.foodSprite.setAlpha(hasCooked ? 1.0 : 0.38);

    // Cooked stock pill badge (Top Right)
    this.cookedBadgeBg.clear();
    const badgeColor = hasCooked ? TASTE_THEME.colors.success : TASTE_THEME.colors.danger;
    this.cookedBadgeBg.fillStyle(badgeColor, 1);
    this.cookedBadgeBg.fillRoundedRect(w / 2 - 41, -h / 2 + 5, 36, 15, 6);
    this.cookedText.setText(`${stock.cookedStock}/${maxTray}`);

    // Raw stock count (Top Left)
    this.rawText.setText(`Trữ: ${stock.rawStock}`);
    this.rawText.setColor(
      stock.rawStock < this.foodDef.batchYield ? '#c92a2a' : TASTE_THEME.colors.inkMuted
    );

    // Action / Status tag
    if (this.cookingProgressStatus === 'burned') {
      this.statusTag.setText('💀 CHÁY KHÉT!');
      this.statusTag.setBackgroundColor('#c92a2a');
      this.statusTag.setVisible(true);
    } else if (this.cookingProgressStatus === 'ready') {
      this.statusTag.setText('✓ VỚT NGAY!');
      this.statusTag.setBackgroundColor('#1f8a4c');
      this.statusTag.setVisible(true);
    } else if (this.isCookingActive) {
      this.statusTag.setText('🔥 ĐANG CHIÊN');
      this.statusTag.setBackgroundColor('#d97706');
      this.statusTag.setVisible(true);
    } else if (!hasCooked && stock.rawStock < this.foodDef.batchYield) {
      this.statusTag.setText('HẾT NGUYÊN LIỆU');
      this.statusTag.setBackgroundColor('#991b1b');
      this.statusTag.setVisible(true);
    } else if (!hasCooked) {
      this.statusTag.setText(this.isOrderNeeded ? '⚡ KHÁCH CẦN' : 'CHẠM ĐỂ CHIÊN');
      this.statusTag.setBackgroundColor(this.isOrderNeeded ? '#c92a2a' : '#d9381e');
      this.statusTag.setVisible(true);
    } else {
      this.statusTag.setVisible(false);
    }

    this.drawCookProgressBar();
  }
}

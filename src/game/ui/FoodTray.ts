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

    // Locked overlay container (authentic locked stainless slot with dark interior)
    this.lockOverlay = this.scene.add.container(0, 0);
    const lockBg = this.scene.add.graphics();
    // Drop shadow
    lockBg.fillStyle(0x060403, 0.4);
    lockBg.fillRoundedRect(-w / 2 + 1, -h / 2 + 2, w - 2, h, 8);
    // Dark brushed pan cavity
    lockBg.fillStyle(TASTE_THEME.colors.cardLocked, 0.95);
    lockBg.fillRoundedRect(-w / 2, -h / 2, w, h, 7);
    // Wire mesh pattern for locked empty tray
    lockBg.lineStyle(1, 0x2e2319, 0.45);
    const lMeshTop = -h / 2 + (isCompact ? 10 : 14);
    const lMeshBottom = h / 2 - (isCompact ? 10 : 14);
    for (let gy = lMeshTop; gy <= lMeshBottom; gy += isCompact ? 6 : 8) {
      lockBg.lineBetween(-w / 2 + 8, gy, w / 2 - 8, gy);
    }
    // Rim hairline
    lockBg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
    lockBg.strokeRoundedRect(-w / 2, -h / 2, w, h, 7);

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
    const isCompact = h < 92;

    // 1. Soft Drop Shadow underneath the tray onto the shelf
    this.trayBg.fillStyle(0x060403, 0.42);
    this.trayBg.fillRoundedRect(-w / 2 + 1, -h / 2 + 2, w - 2, h, 8);

    // 2. Outer Stainless Steel Flange / Metallic Rim (Inox 304)
    const rimColor = this.isHovered ? 0x4a4036 : 0x3b332b;
    this.trayBg.fillStyle(rimColor, 1);
    this.trayBg.fillRoundedRect(-w / 2, -h / 2, w, h, 7);

    // Brushed metallic top-edge highlight & bottom bevel shadow
    this.trayBg.lineStyle(1, 0xccd6e0, 0.55);
    this.trayBg.lineBetween(-w / 2 + 3, -h / 2 + 1, w / 2 - 3, -h / 2 + 1);
    this.trayBg.lineStyle(1, 0x1d1712, 0.75);
    this.trayBg.lineBetween(-w / 2 + 3, h / 2 - 1, w / 2 - 3, h / 2 - 1);

    // 3. Recessed Basin (Lòng khay trũng)
    const basinInset = 2.5;
    const basinX = -w / 2 + basinInset;
    const basinY = -h / 2 + basinInset;
    const basinW = w - basinInset * 2;
    const basinH = h - basinInset * 2;
    const basinR = 5;

    // Inner rim depth bevel shadow
    this.trayBg.fillStyle(0x1a130e, 0.45);
    this.trayBg.fillRoundedRect(basinX, basinY, basinW, basinH, basinR);

    // Food-grade tray bed surface
    const bedColor = hasCooked
      ? (this.isHovered ? 0xfffcf5 : 0xfcf6ed)
      : (this.isHovered ? 0xf0e8dc : 0xe9e1d2);
    this.trayBg.fillStyle(bedColor, 1);
    this.trayBg.fillRoundedRect(basinX + 0.5, basinY + 0.5, basinW - 1, basinH - 1, basinR);

    // 4. Warm Golden Underglow when hot cooked snacks are resting on tray
    if (hasCooked) {
      this.trayBg.fillStyle(0xf59e0b, 0.12);
      this.trayBg.fillEllipse(0, isCompact ? -4 : -6, basinW * 0.72, basinH * 0.52);
      this.trayBg.fillStyle(0xd97706, 0.05);
      this.trayBg.fillEllipse(0, isCompact ? -4 : -6, basinW * 0.45, basinH * 0.35);
    }

    // 5. Stainless Steel Wire Mesh Oil-Drip Rack (Vỉ lưới Inox ráo dầu)
    const meshTop = -h / 2 + (isCompact ? 13 : 16);
    const meshBottom = h / 2 - (isCompact ? 17 : 22);
    const meshLeft = -w / 2 + (isCompact ? 8 : 10);
    const meshRight = w / 2 - (isCompact ? 8 : 10);
    const wireStepY = isCompact ? 6 : 7.5;

    // Horizontal wire grid
    this.trayBg.lineStyle(1, hasCooked ? 0xd0c1ad : 0xbfaea0, hasCooked ? 0.45 : 0.35);
    for (let gy = meshTop; gy <= meshBottom; gy += wireStepY) {
      this.trayBg.lineBetween(meshLeft, gy, meshRight, gy);
    }

    // Vertical support rods
    const vRodCount = isCompact ? 3 : 5;
    for (let i = 0; i < vRodCount; i++) {
      const rx = meshLeft + ((meshRight - meshLeft) / (vRodCount - 1)) * i;
      this.trayBg.lineBetween(rx, meshTop, rx, meshBottom);
    }

    // 6. Footer Label Plate Strip (Thanh nẹp tên & giá món)
    const footerH = isCompact ? 16 : 20;
    const footerY = h / 2 - footerH - basinInset;
    this.trayBg.fillStyle(0xeadecc, 0.72);
    this.trayBg.fillRoundedRect(basinX, footerY, basinW, footerH, {
      tl: 0,
      tr: 0,
      bl: basinR,
      br: basinR,
    });
    // Divider hairline on top of footer strip
    this.trayBg.lineStyle(1, 0xcdba9e, 0.8);
    this.trayBg.lineBetween(basinX + 1, footerY, basinX + basinW - 1, footerY);

    // 7. State-aware Rim Border
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
      this.trayBg.lineStyle(1.2, 0xb8a894, 0.9);
    } else {
      this.trayBg.lineStyle(1, 0x8a7966, 0.85);
    }
    this.trayBg.strokeRoundedRect(-w / 2, -h / 2, w, h, 7);

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

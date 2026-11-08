import Phaser from 'phaser';
import { ActiveCustomer, SauceType, VeggieType } from '../systems/CustomerSystem';
import { GameStateManager } from '../managers/GameStateManager';
import { TASTE_THEME } from '../config/tasteTheme';
import { getLogicalDimensions } from '../config/display';

function getVeggieLabel(type: VeggieType, done: boolean): string {
  const name = type === 'dua_leo' ? '🥒 Dưa' : type === 'dau_bap' ? '🫑 Bắp' : '🥗 Lách';
  return done ? `${name} ✓` : name;
}

function getSauceLabel(type: SauceType, done: boolean): string {
  const name = type === 'tuong_ot' ? '🌶️ Ớt' : type === 'tuong_den' ? '🥢 Đen' : '🍑 XíM';
  return done ? `${name} ✓` : name;
}

export class CustomerOrder extends Phaser.GameObjects.Container {
  private gs: GameStateManager;
  public customer: ActiveCustomer;
  private isDesktop: boolean;

  private charSprite!: Phaser.GameObjects.Image;
  private bubbleBg!: Phaser.GameObjects.Graphics;
  private patienceBarFill!: Phaser.GameObjects.Graphics;
  private moodText!: Phaser.GameObjects.Text;
  private veggieBadge!: Phaser.GameObjects.Text;
  private sauceBadge!: Phaser.GameObjects.Text;
  private serveHintBadge!: Phaser.GameObjects.Container;
  private orderItemContainers: Phaser.GameObjects.Container[] = [];

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    customer: ActiveCustomer,
    onTapCustomer: (slotIndex: number) => void
  ) {
    super(scene, x, y);
    this.gs = GameStateManager.getInstance();
    this.customer = customer;
    this.isDesktop = getLogicalDimensions().isDesktop;

    this.buildCustomerView(onTapCustomer);
    this.refreshOrderState();

    // Entrance settle animation (`motion.md`: Cubic.easeOut)
    this.setScale(0.85);
    this.setAlpha(0);
    scene.tweens.add({
      targets: this,
      scale: 1,
      alpha: 1,
      duration: TASTE_THEME.motion.normal,
      ease: TASTE_THEME.motion.easeOut,
    });
  }

  private buildCustomerView(onTapCustomer: (slotIndex: number) => void): void {
    const charScale = this.isDesktop ? 0.41 : 0.35;
    const charY = this.isDesktop ? 22 : 18;

    // Character sprite registered at 220x280 with `feet` anchor
    this.charSprite = this.scene.add.image(0, charY, this.customer.textureKey);
    this.charSprite.setScale(charScale);
    this.add(this.charSprite);

    // Subtle idle breathing animation
    this.scene.tweens.add({
      targets: this.charSprite,
      y: charY - 2.5,
      duration: 760 + this.customer.slotIndex * 110,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Customer Archetype Pill Badge under character
    const isVip = this.customer.archetype.id === 'vip';
    const isBad = this.customer.archetype.id === 'bad';
    const badgeW = this.isDesktop
      ? isVip || isBad ? 96 : 88
      : isVip || isBad ? 78 : 72;
    const badgeH = this.isDesktop ? 16 : 14;
    const badgeY = this.isDesktop ? 53 : 46;

    const badgeBg = this.scene.add.graphics();
    badgeBg.fillStyle(this.customer.archetype.badgeColor, 1);
    badgeBg.fillRoundedRect(-badgeW / 2, badgeY, badgeW, badgeH, 5);
    badgeBg.lineStyle(
      isVip ? 1.5 : 1,
      isVip ? 0xfff3b0 : TASTE_THEME.colors.bgBase,
      isVip ? 0.9 : 0.45
    );
    badgeBg.strokeRoundedRect(-badgeW / 2, badgeY, badgeW, badgeH, 5);

    const displayName = isVip
      ? `👑 ${this.customer.archetype.name}`
      : isBad
        ? `⚡ ${this.customer.archetype.name}`
        : this.customer.archetype.name;

    const nameLbl = this.scene.add
      .text(0, badgeY + badgeH / 2, displayName, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop
          ? isVip || isBad ? '8.5px' : '9.5px'
          : isVip || isBad ? '7.5px' : '8.5px',
        fontStyle: '800',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.add([badgeBg, nameLbl]);

    // Speech Bubble above customer head
    this.bubbleBg = this.scene.add.graphics();
    this.add(this.bubbleBg);

    // Order items inside speech bubble
    const count = this.customer.orders.length;
    const spacing = this.isDesktop
      ? count === 1 ? 0 : count === 2 ? 38 : count === 3 ? 28 : 22
      : count === 1 ? 0 : count === 2 ? 32 : count === 3 ? 24 : 18;
    const startX = -((count - 1) * spacing) / 2;
    const itemY = this.isDesktop ? -45 : -38;
    const iconScale = this.isDesktop ? 0.145 : 0.125;

    this.customer.orders.forEach((req, idx) => {
      const def = this.gs.getFoodDef(req.foodId);
      const itemCon = this.scene.add.container(startX + idx * spacing, itemY);

      const icon = this.scene.add.image(0, -3, def.textureKey).setScale(iconScale);
      const qtyTxt = this.scene.add
        .text(0, this.isDesktop ? 11 : 9, `x${req.quantity}`, {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: this.isDesktop ? '10px' : '8.5px',
          fontStyle: '800',
          color: TASTE_THEME.colors.inkDark,
          backgroundColor: '#f3eadb',
          padding: { left: 3, right: 3, top: 1, bottom: 1 },
        })
        .setOrigin(0.5);

      itemCon.add([icon, qtyTxt]);
      this.orderItemContainers.push(itemCon);
      this.add(itemCon);
    });

    // Mood emoji + Patience progress bar
    const moodX = this.isDesktop ? -37 : -30;
    const moodY = this.isDesktop ? -19 : -16;
    this.moodText = this.scene.add
      .text(moodX, moodY, '😄', { fontSize: this.isDesktop ? '12px' : '10.5px' })
      .setOrigin(0.5);
    this.patienceBarFill = this.scene.add.graphics();

    // Veggie & Sauce request tags at top of speech bubble
    const condimentBadgeY = this.isDesktop ? -74 : -64;
    this.veggieBadge = this.scene.add
      .text(0, condimentBadgeY, '', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop ? '8px' : '7px',
        fontStyle: '800',
        color: '#ffffff',
        backgroundColor: '#1f8a4c',
        padding: { left: 3, right: 3, top: 1, bottom: 1 },
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.sauceBadge = this.scene.add
      .text(0, condimentBadgeY, '', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop ? '8px' : '7px',
        fontStyle: '800',
        color: '#ffffff',
        backgroundColor: '#1f8a4c',
        padding: { left: 3, right: 3, top: 1, bottom: 1 },
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.add([this.moodText, this.patienceBarFill, this.veggieBadge, this.sauceBadge]);

    // Ready-to-serve CTA pill badge
    const serveW = this.isDesktop ? 84 : 72;
    const serveH = this.isDesktop ? 20 : 18;
    this.serveHintBadge = this.scene.add.container(0, 4);
    const serveBg = this.scene.add.graphics();
    serveBg.fillStyle(TASTE_THEME.colors.success, 1);
    serveBg.fillRoundedRect(-serveW / 2, -serveH / 2, serveW, serveH, 7);
    serveBg.lineStyle(1.5, 0xffffff, 0.9);
    serveBg.strokeRoundedRect(-serveW / 2, -serveH / 2, serveW, serveH, 7);
    const serveTxt = this.scene.add
      .text(0, 0, '✓ PHỤC VỤ', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop ? '10px' : '8.5px',
        fontStyle: '800',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.serveHintBadge.add([serveBg, serveTxt]);
    this.add(this.serveHintBadge);

    this.scene.tweens.add({
      targets: this.serveHintBadge,
      y: 2,
      duration: 480,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Hit area covering bubble + character
    const hitW = this.isDesktop ? 98 : 82;
    const hitH = this.isDesktop ? 145 : 126;
    const hit = this.scene.add
      .rectangle(0, -2, hitW, hitH, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });

    hit.on('pointerdown', () => {
      onTapCustomer(this.customer.slotIndex);
    });
    this.add(hit);
  }

  public refreshOrderState(): void {
    let allReady = true;
    this.customer.orders.forEach((req, idx) => {
      const stock = this.gs.state.foods[req.foodId];
      const hasEnough = stock && stock.cookedStock >= req.quantity;
      if (!hasEnough) allReady = false;
      const con = this.orderItemContainers[idx];
      if (con) {
        const qtyTxt = con.list[1] as Phaser.GameObjects.Text;
        qtyTxt.setBackgroundColor(hasEnough ? '#1f8a4c' : '#f8d7da');
        qtyTxt.setColor(hasEnough ? '#ffffff' : '#991b1b');
      }
    });

    const bW = this.isDesktop ? 96 : 82;
    const bH = this.isDesktop ? 63 : 52;
    const bTop = this.isDesktop ? -73 : -62;

    this.bubbleBg.clear();
    this.bubbleBg.fillStyle(allReady ? 0xf2fbf5 : TASTE_THEME.colors.cardCream, 0.98);
    this.bubbleBg.fillRoundedRect(-bW / 2, bTop, bW, bH, 9);
    this.bubbleBg.lineStyle(
      allReady ? 2 : 1,
      allReady ? TASTE_THEME.colors.success : TASTE_THEME.colors.borderHairlineLight,
      1
    );
    this.bubbleBg.strokeRoundedRect(-bW / 2, bTop, bW, bH, 9);
    // Speech pointer triangle
    this.bubbleBg.fillTriangle(-5, bTop + bH, 5, bTop + bH, 0, bTop + bH + 6);

    this.serveHintBadge.setVisible(allReady);

    const hasVeggieReq = Boolean(this.customer.requestedVeggie);
    const hasSauceReq = Boolean(this.customer.requestedSauce);

    if (hasVeggieReq && hasSauceReq) {
      this.veggieBadge.setX(-24);
      this.sauceBadge.setX(24);
    } else {
      this.veggieBadge.setX(0);
      this.sauceBadge.setX(0);
    }

    if (this.customer.requestedVeggie) {
      this.veggieBadge.setVisible(true);
      const done = this.customer.hasVeggie;
      this.veggieBadge.setText(getVeggieLabel(this.customer.requestedVeggie, done));
      this.veggieBadge.setBackgroundColor(done ? '#15803d' : '#d97706');
    } else {
      this.veggieBadge.setVisible(false);
    }

    if (this.customer.requestedSauce) {
      this.sauceBadge.setVisible(true);
      const done = this.customer.hasSauce;
      this.sauceBadge.setText(getSauceLabel(this.customer.requestedSauce, done));
      this.sauceBadge.setBackgroundColor(done ? '#15803d' : '#d97706');
    } else {
      this.sauceBadge.setVisible(false);
    }

    this.updatePatienceBar();
  }

  public updatePatienceBar(): void {
    const ratio = Phaser.Math.Clamp(
      this.customer.remainingPatienceMs / this.customer.maxPatienceMs,
      0,
      1
    );

    let emoji = ratio > 0.55 ? '😄' : ratio > 0.25 ? '😐' : '😡';
    if (this.customer.archetype.id === 'vip') {
      emoji = ratio > 0.55 ? '🤩' : ratio > 0.25 ? '🙂' : '⏱️';
    } else if (this.customer.archetype.id === 'bad') {
      emoji = ratio > 0.55 ? '😒' : ratio > 0.25 ? '😠' : '🤬';
    }
    this.moodText.setText(emoji);

    const barColor =
      ratio > 0.55
        ? TASTE_THEME.colors.successLight
        : ratio > 0.25
          ? TASTE_THEME.colors.accentAmber
          : TASTE_THEME.colors.danger;

    const pX = this.isDesktop ? -24 : -20;
    const pY = this.isDesktop ? -22 : -18;
    const pW = this.isDesktop ? 64 : 52;
    const pH = this.isDesktop ? 6 : 5;

    this.patienceBarFill.clear();
    this.patienceBarFill.fillStyle(0xe5ddd0, 1);
    this.patienceBarFill.fillRoundedRect(pX, pY, pW, pH, 2.5);
    this.patienceBarFill.fillStyle(barColor, 1);
    this.patienceBarFill.fillRoundedRect(pX, pY, Math.max(3, pW * ratio), pH, 2.5);
  }
}

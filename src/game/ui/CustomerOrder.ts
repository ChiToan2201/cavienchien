import Phaser from 'phaser';
import { ActiveCustomer, SauceType, VeggieType } from '../systems/CustomerSystem';
import { GameStateManager } from '../managers/GameStateManager';
import { TASTE_THEME } from '../config/tasteTheme';
import { getLogicalDimensions } from '../config/display';

interface CondimentMeta {
  key: string;
  name: string;
}

const VEGGIE_META: Record<VeggieType, CondimentMeta> = {
  dua_leo: { key: 'veggie_dua_leo', name: 'Dưa leo' },
  dau_bap: { key: 'veggie_dau_bap', name: 'Đậu bắp' },
  xa_lach: { key: 'veggie_xa_lach', name: 'Xà lách' },
};

const SAUCE_META: Record<SauceType, CondimentMeta> = {
  tuong_ot: { key: 'sauce_tuong_ot', name: 'Tương ớt' },
  tuong_den: { key: 'sauce_tuong_den', name: 'Tương đen' },
  tuong_xi_muoi: { key: 'sauce_tuong_xi_muoi', name: 'Xí muội' },
};

export class CustomerOrder extends Phaser.GameObjects.Container {
  private gs: GameStateManager;
  public customer: ActiveCustomer;
  private isDesktop: boolean;

  private charSprite!: Phaser.GameObjects.Image;
  private bubbleBg!: Phaser.GameObjects.Graphics;
  private patienceBarFill!: Phaser.GameObjects.Graphics;
  private moodText!: Phaser.GameObjects.Text;
  private serveHintBadge!: Phaser.GameObjects.Container;
  private orderItemContainers: Phaser.GameObjects.Container[] = [];

  // Icon-only Gourmet Condiment Tray (House Rule 1: No caption text under visual icons)
  private condimentRow!: Phaser.GameObjects.Container;

  private veggieCardCon!: Phaser.GameObjects.Container;
  private veggieCardBg!: Phaser.GameObjects.Graphics;
  private veggieIcon!: Phaser.GameObjects.Image;
  private veggieStatusBadge!: Phaser.GameObjects.Container;
  private veggieCheckBg!: Phaser.GameObjects.Graphics;
  private veggieCheckTxt!: Phaser.GameObjects.Text;

  private sauceCardCon!: Phaser.GameObjects.Container;
  private sauceCardBg!: Phaser.GameObjects.Graphics;
  private sauceIcon!: Phaser.GameObjects.Image;
  private sauceStatusBadge!: Phaser.GameObjects.Container;
  private sauceCheckBg!: Phaser.GameObjects.Graphics;
  private sauceCheckTxt!: Phaser.GameObjects.Text;

  private prevHasVeggie: boolean = false;
  private prevHasSauce: boolean = false;

  private pBarDims = { x: -24, y: -22, w: 64, h: 6 };

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

    this.prevHasVeggie = Boolean(customer.hasVeggie);
    this.prevHasSauce = Boolean(customer.hasSauce);

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
    const itemY = this.isDesktop ? -41 : -37;
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
    const moodX = this.isDesktop ? -36 : -30;
    const moodY = this.isDesktop ? -18 : -16;
    this.moodText = this.scene.add
      .text(moodX, moodY, '😄', { fontSize: this.isDesktop ? '12px' : '10.5px' })
      .setOrigin(0.5);
    this.patienceBarFill = this.scene.add.graphics();
    this.add([this.moodText, this.patienceBarFill]);

    // === GOURMET CONDIMENT ROW: PURE LARGE ICONS (NO CAPTION TEXT) ===
    this.buildCondimentRow();

    // Ready-to-serve CTA pill badge
    const serveW = this.isDesktop ? 86 : 74;
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
    const hitW = this.isDesktop ? 104 : 90;
    const hitH = this.isDesktop ? 152 : 132;
    const hit = this.scene.add
      .rectangle(0, -4, hitW, hitH, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });

    hit.on('pointerdown', () => {
      onTapCustomer(this.customer.slotIndex);
    });
    this.add(hit);
  }

  /**
   * Build prominent, icon-only condiment coasters inside `condimentRow`.
   * Displays the crisp real textures (veggie plate & sauce bottle) in large, unmistakable format.
   */
  private buildCondimentRow(): void {
    this.condimentRow = this.scene.add.container(0, 0);
    this.add(this.condimentRow);

    const hasVeggie = Boolean(this.customer.requestedVeggie);
    const hasSauce = Boolean(this.customer.requestedSauce);

    if (!hasVeggie && !hasSauce) {
      this.condimentRow.setVisible(false);
      return;
    }

    const both = hasVeggie && hasSauce;
    const cardW = both
      ? (this.isDesktop ? 28 : 24)
      : (this.isDesktop ? 34 : 28);
    const cardH = this.isDesktop ? 26 : 22;

    // 1. Veggie Coaster (Large Plate Icon)
    if (hasVeggie && this.customer.requestedVeggie) {
      const vMeta = VEGGIE_META[this.customer.requestedVeggie];
      const posX = both ? (this.isDesktop ? -17 : -14) : 0;

      this.veggieCardCon = this.scene.add.container(posX, 0);
      this.veggieCardBg = this.scene.add.graphics();
      this.veggieCardCon.add(this.veggieCardBg);

      if (this.scene.textures.exists(vMeta.key)) {
        this.veggieIcon = this.scene.add.image(0, 0, vMeta.key);
        const maxDim = Math.max(this.veggieIcon.width, this.veggieIcon.height);
        const targetDim = this.isDesktop ? (both ? 23 : 26) : (both ? 19 : 22);
        this.veggieIcon.setScale(Math.min(targetDim / maxDim, 0.38));
        this.veggieCardCon.add(this.veggieIcon);
      }

      // Micro status badge in top-right corner (+ when waiting, ✓ when served)
      const badgeX = cardW / 2 - (this.isDesktop ? 2 : 1.5);
      const badgeY = -cardH / 2 + (this.isDesktop ? 2 : 1.5);
      this.veggieStatusBadge = this.scene.add.container(badgeX, badgeY);
      this.veggieCheckBg = this.scene.add.graphics();
      this.veggieCheckTxt = this.scene.add
        .text(0, 0, '+', {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: this.isDesktop ? '7.5px' : '6.5px',
          fontStyle: '900',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      this.veggieStatusBadge.add([this.veggieCheckBg, this.veggieCheckTxt]);
      this.veggieCardCon.add(this.veggieStatusBadge);

      this.condimentRow.add(this.veggieCardCon);
    }

    // 2. Sauce Coaster (Large Bottle Icon)
    if (hasSauce && this.customer.requestedSauce) {
      const sMeta = SAUCE_META[this.customer.requestedSauce];
      const posX = both ? (this.isDesktop ? 17 : 14) : 0;

      this.sauceCardCon = this.scene.add.container(posX, 0);
      this.sauceCardBg = this.scene.add.graphics();
      this.sauceCardCon.add(this.sauceCardBg);

      if (this.scene.textures.exists(sMeta.key)) {
        this.sauceIcon = this.scene.add.image(0, 0, sMeta.key);
        const maxDim = Math.max(this.sauceIcon.width, this.sauceIcon.height);
        const targetDim = this.isDesktop ? (both ? 24 : 27) : (both ? 20 : 23);
        this.sauceIcon.setScale(Math.min(targetDim / maxDim, 0.4));
        this.sauceCardCon.add(this.sauceIcon);
      }

      // Micro status badge in top-right corner (+ when waiting, ✓ when served)
      const badgeX = cardW / 2 - (this.isDesktop ? 2 : 1.5);
      const badgeY = -cardH / 2 + (this.isDesktop ? 2 : 1.5);
      this.sauceStatusBadge = this.scene.add.container(badgeX, badgeY);
      this.sauceCheckBg = this.scene.add.graphics();
      this.sauceCheckTxt = this.scene.add
        .text(0, 0, '+', {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: this.isDesktop ? '7.5px' : '6.5px',
          fontStyle: '900',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      this.sauceStatusBadge.add([this.sauceCheckBg, this.sauceCheckTxt]);
      this.sauceCardCon.add(this.sauceStatusBadge);

      this.condimentRow.add(this.sauceCardCon);
    }
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

    const hasVeggieReq = Boolean(this.customer.requestedVeggie);
    const hasSauceReq = Boolean(this.customer.requestedSauce);
    const hasAnyCondiment = hasVeggieReq || hasSauceReq;

    // Dynamic Geometry according to content density
    const count = this.customer.orders.length;
    const bW = this.isDesktop
      ? Math.max(98, count * 36 + 18)
      : Math.max(86, count * 30 + 14);
    const bH = this.isDesktop
      ? (hasAnyCondiment ? 78 : 58)
      : (hasAnyCondiment ? 66 : 50);
    const bTop = -10 - bH;

    // Speech bubble background & pointer
    this.bubbleBg.clear();
    this.bubbleBg.fillStyle(allReady ? 0xf2fbf5 : TASTE_THEME.colors.cardCream, 0.98);
    this.bubbleBg.fillRoundedRect(-bW / 2, bTop, bW, bH, 9);
    this.bubbleBg.lineStyle(
      allReady ? 2 : 1,
      allReady ? TASTE_THEME.colors.success : TASTE_THEME.colors.borderHairlineLight,
      1
    );
    this.bubbleBg.strokeRoundedRect(-bW / 2, bTop, bW, bH, 9);

    // Speech pointer triangle anchored to customer head
    this.bubbleBg.fillTriangle(-5, -10, 5, -10, 0, -4);

    this.serveHintBadge.setVisible(allReady);

    // Align food items nicely
    const itemY = this.isDesktop
      ? (hasAnyCondiment ? bTop + 47 : bTop + 27)
      : (hasAnyCondiment ? bTop + 39 : bTop + 23);
    this.orderItemContainers.forEach((con) => con.setY(itemY));

    // Align Condiment Row
    if (this.condimentRow && hasAnyCondiment) {
      const condY = this.isDesktop ? bTop + 17 : bTop + 15;
      this.condimentRow.setY(condY);
      this.condimentRow.setVisible(true);

      const both = hasVeggieReq && hasSauceReq;
      const cardW = both
        ? (this.isDesktop ? 28 : 24)
        : (this.isDesktop ? 34 : 28);
      const cardH = this.isDesktop ? 26 : 22;
      const badgeR = this.isDesktop ? 5 : 4.2;

      // Update Veggie Card
      if (hasVeggieReq && this.veggieCardCon) {
        const done = Boolean(this.customer.hasVeggie);

        // Checkmark pop micro-interaction
        if (!this.prevHasVeggie && done) {
          this.scene.tweens.add({
            targets: this.veggieCardCon,
            scale: 1.25,
            duration: 110,
            yoyo: true,
            ease: 'Back.easeOut',
          });
        }
        this.prevHasVeggie = done;

        // Draw card coaster background
        this.veggieCardBg.clear();
        this.veggieCardBg.fillStyle(done ? 0x14532d : 0x231b15, 0.96);
        this.veggieCardBg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 5.5);
        this.veggieCardBg.lineStyle(1.5, done ? 0x22c55e : 0xd97706, 1);
        this.veggieCardBg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 5.5);

        // Draw micro badge
        this.veggieCheckBg.clear();
        this.veggieCheckBg.fillStyle(done ? 0x22c55e : 0xd97706, 1);
        this.veggieCheckBg.fillCircle(0, 0, badgeR);
        this.veggieCheckBg.lineStyle(1, 0xffffff, 0.95);
        this.veggieCheckBg.strokeCircle(0, 0, badgeR);

        this.veggieCheckTxt.setText(done ? '✓' : '+');
      }

      // Update Sauce Card
      if (hasSauceReq && this.sauceCardCon) {
        const done = Boolean(this.customer.hasSauce);

        // Checkmark pop micro-interaction
        if (!this.prevHasSauce && done) {
          this.scene.tweens.add({
            targets: this.sauceCardCon,
            scale: 1.25,
            duration: 110,
            yoyo: true,
            ease: 'Back.easeOut',
          });
        }
        this.prevHasSauce = done;

        // Draw card coaster background
        this.sauceCardBg.clear();
        this.sauceCardBg.fillStyle(done ? 0x14532d : 0x231b15, 0.96);
        this.sauceCardBg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 5.5);
        this.sauceCardBg.lineStyle(1.5, done ? 0x22c55e : 0xd97706, 1);
        this.sauceCardBg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 5.5);

        // Draw micro badge
        this.sauceCheckBg.clear();
        this.sauceCheckBg.fillStyle(done ? 0x22c55e : 0xd97706, 1);
        this.sauceCheckBg.fillCircle(0, 0, badgeR);
        this.sauceCheckBg.lineStyle(1, 0xffffff, 0.95);
        this.sauceCheckBg.strokeCircle(0, 0, badgeR);

        this.sauceCheckTxt.setText(done ? '✓' : '+');
      }
    } else if (this.condimentRow) {
      this.condimentRow.setVisible(false);
    }

    // Dynamic Patience Bar coordinates
    const moodX = -bW / 2 + (this.isDesktop ? 13 : 11);
    const moodY = this.isDesktop ? -18 : -16;
    this.moodText.setPosition(moodX, moodY);

    const pX = moodX + (this.isDesktop ? 12 : 10);
    const pRight = bW / 2 - (this.isDesktop ? 10 : 8);
    const pW = pRight - pX;
    const pH = this.isDesktop ? 6 : 5;
    const pY = moodY - (this.isDesktop ? 3 : 2.5);

    this.pBarDims = { x: pX, y: pY, w: pW, h: pH };
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

    const { x, y, w, h } = this.pBarDims;

    this.patienceBarFill.clear();
    this.patienceBarFill.fillStyle(0xe5ddd0, 1);
    this.patienceBarFill.fillRoundedRect(x, y, w, h, 2.5);
    this.patienceBarFill.fillStyle(barColor, 1);
    this.patienceBarFill.fillRoundedRect(x, y, Math.max(3, w * ratio), h, 2.5);
  }
}

import Phaser from 'phaser';
import { ActiveCustomer } from '../systems/CustomerSystem';
import { GameStateManager } from '../managers/GameStateManager';
import { TASTE_THEME } from '../config/tasteTheme';

export class CustomerOrder extends Phaser.GameObjects.Container {
  private gs: GameStateManager;
  public customer: ActiveCustomer;

  private charSprite!: Phaser.GameObjects.Image;
  private bubbleBg!: Phaser.GameObjects.Graphics;
  private patienceBarFill!: Phaser.GameObjects.Graphics;
  private moodText!: Phaser.GameObjects.Text;
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
    // Character sprite registered at 220x280 with `feet` anchor
    this.charSprite = this.scene.add.image(0, 22, this.customer.textureKey);
    this.charSprite.setScale(0.41);
    this.add(this.charSprite);

    // Subtle idle breathing animation
    this.scene.tweens.add({
      targets: this.charSprite,
      y: 19.5,
      duration: 760 + this.customer.slotIndex * 110,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Customer Archetype Pill Badge under character
    const isVip = this.customer.archetype.id === 'vip';
    const isBad = this.customer.archetype.id === 'bad';
    const badgeW = isVip || isBad ? 96 : 88;

    const badgeBg = this.scene.add.graphics();
    badgeBg.fillStyle(this.customer.archetype.badgeColor, 1);
    badgeBg.fillRoundedRect(-badgeW / 2, 53, badgeW, 16, 6);
    badgeBg.lineStyle(isVip ? 1.5 : 1, isVip ? 0xfff3b0 : TASTE_THEME.colors.bgBase, isVip ? 0.9 : 0.45);
    badgeBg.strokeRoundedRect(-badgeW / 2, 53, badgeW, 16, 6);

    const displayName = isVip
      ? `👑 ${this.customer.archetype.name}`
      : isBad
        ? `⚡ ${this.customer.archetype.name}`
        : this.customer.archetype.name;

    const nameLbl = this.scene.add
      .text(0, 61, displayName, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: isVip || isBad ? '8.5px' : '9.5px',
        fontStyle: '800',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.add([badgeBg, nameLbl]);

    // Speech Bubble above customer head
    this.bubbleBg = this.scene.add.graphics();
    this.add(this.bubbleBg);

    // Order items inside speech bubble (using 256x256 normalized food sprites)
    const count = this.customer.orders.length;
    const spacing = count === 1 ? 0 : count === 2 ? 38 : count === 3 ? 28 : 23;
    const startX = -((count - 1) * spacing) / 2;

    this.customer.orders.forEach((req, idx) => {
      const def = this.gs.getFoodDef(req.foodId);
      const itemCon = this.scene.add.container(startX + idx * spacing, -45);

      const icon = this.scene.add.image(0, -3, def.textureKey).setScale(0.145);
      const qtyTxt = this.scene.add
        .text(0, 11, `x${req.quantity}`, {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: '10px',
          fontStyle: '800',
          color: TASTE_THEME.colors.inkDark,
          backgroundColor: '#f3eadb',
          padding: { left: 4, right: 4, top: 1, bottom: 1 },
        })
        .setOrigin(0.5);

      itemCon.add([icon, qtyTxt]);
      this.orderItemContainers.push(itemCon);
      this.add(itemCon);
    });

    // Mood emoji + Patience progress bar
    this.moodText = this.scene.add
      .text(-37, -19, '😄', { fontSize: '12px' })
      .setOrigin(0.5);
    this.patienceBarFill = this.scene.add.graphics();
    this.add([this.moodText, this.patienceBarFill]);

    // Ready-to-serve CTA pill badge
    this.serveHintBadge = this.scene.add.container(0, 5);
    const serveBg = this.scene.add.graphics();
    serveBg.fillStyle(TASTE_THEME.colors.success, 1);
    serveBg.fillRoundedRect(-42, -10, 84, 20, 8);
    serveBg.lineStyle(1.5, 0xffffff, 0.9);
    serveBg.strokeRoundedRect(-42, -10, 84, 20, 8);
    const serveTxt = this.scene.add
      .text(0, 0, '✓ PHỤC VỤ', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '10px',
        fontStyle: '800',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.serveHintBadge.add([serveBg, serveTxt]);
    this.add(this.serveHintBadge);

    this.scene.tweens.add({
      targets: this.serveHintBadge,
      y: 3,
      duration: 480,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Hit area covering bubble + character
    const hit = this.scene.add
      .rectangle(0, -2, 98, 145, 0xffffff, 0)
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

    this.bubbleBg.clear();
    this.bubbleBg.fillStyle(allReady ? 0xf2fbf5 : TASTE_THEME.colors.cardCream, 0.98);
    this.bubbleBg.fillRoundedRect(-48, -73, 96, 63, 10);
    this.bubbleBg.lineStyle(
      allReady ? 2 : 1,
      allReady ? TASTE_THEME.colors.success : TASTE_THEME.colors.borderHairlineLight,
      1
    );
    this.bubbleBg.strokeRoundedRect(-48, -73, 96, 63, 10);
    // Speech pointer triangle
    this.bubbleBg.fillTriangle(-6, -10, 6, -10, 0, -2);

    this.serveHintBadge.setVisible(allReady);
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
    this.patienceBarFill.clear();
    this.patienceBarFill.fillStyle(0xe5ddd0, 1);
    this.patienceBarFill.fillRoundedRect(-24, -22, 64, 6, 3);
    this.patienceBarFill.fillStyle(barColor, 1);
    this.patienceBarFill.fillRoundedRect(-24, -22, Math.max(4, 64 * ratio), 6, 3);
  }
}

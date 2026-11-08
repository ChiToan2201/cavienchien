import Phaser from 'phaser';
import { GameStateManager } from '../managers/GameStateManager';
import { SoundManager } from '../managers/SoundManager';
import { TASTE_THEME } from '../config/tasteTheme';
import { getLogicalDimensions } from '../config/display';

export class HUD extends Phaser.GameObjects.Container {
  private gs: GameStateManager;
  private levelText!: Phaser.GameObjects.Text;
  private dayText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private moneyText!: Phaser.GameObjects.Text;
  private diamondText!: Phaser.GameObjects.Text;
  private ratingText!: Phaser.GameObjects.Text;
  private stockText?: Phaser.GameObjects.Text;
  private xpFill!: Phaser.GameObjects.Graphics;
  private timeBarFill!: Phaser.GameObjects.Graphics;
  private isDesktop: boolean;

  constructor(
    scene: Phaser.Scene,
    onOpenSettings: () => void,
    onOpenSummary: () => void,
    onOpenTutorial?: () => void
  ) {
    super(scene, 0, 0);
    this.gs = GameStateManager.getInstance();
    const { width: W, isDesktop } = getLogicalDimensions();
    this.isDesktop = isDesktop;

    if (this.isDesktop) {
      this.buildDesktopHUD(W, onOpenSettings, onOpenSummary, onOpenTutorial);
    } else {
      this.buildMobileHUD(W, onOpenSettings, onOpenSummary, onOpenTutorial);
    }
    this.refresh();

    this.gs.on('state-changed', this.refresh, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.gs.off('state-changed', this.refresh, this);
    });
  }

  private buildDesktopHUD(
    W: number,
    onOpenSettings: () => void,
    onOpenSummary: () => void,
    onOpenTutorial?: () => void
  ): void {
    const navH = TASTE_THEME.layout.desktop.navHeight; // 64px
    const gut = TASTE_THEME.layout.desktop.gutter; // 20px

    const bg = this.scene.add.graphics();
    bg.fillStyle(TASTE_THEME.colors.bgElevated, 0.98);
    bg.fillRect(0, 0, W, navH);
    bg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
    bg.lineBetween(0, navH, W, navH);
    this.add(bg);

    // Left Edge: Chef Avatar + Level Badge + XP bar aligned to `gut` (x = 20)
    const avatarX = gut + 22;
    const avatarY = navH / 2 - 2;
    const avCircle = this.scene.add.graphics();
    avCircle.fillStyle(TASTE_THEME.colors.bgSurface, 1);
    avCircle.fillCircle(avatarX, avatarY, 21);
    avCircle.lineStyle(1.5, TASTE_THEME.colors.accentAmber, 0.9);
    avCircle.strokeCircle(avatarX, avatarY, 21);
    this.add(avCircle);

    if (this.scene.textures.exists('chef_raw')) {
      const avatarImg = this.scene.add.image(avatarX, avatarY + 2, 'chef_raw', 0).setScale(0.16);
      this.add(avatarImg);
    }

    const lvlBadge = this.scene.add.graphics();
    lvlBadge.fillStyle(TASTE_THEME.colors.accentPrimary, 1);
    lvlBadge.fillRoundedRect(gut, 44, 44, 15, 5);
    this.add(lvlBadge);

    this.levelText = this.scene.add
      .text(avatarX, 51.5, 'Lv.1', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '10.5px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.add(this.levelText);

    this.xpFill = this.scene.add.graphics();
    this.add(this.xpFill);

    // Day & Live 6-Minute Countdown Pill (`game-ui-design` Cooldown/Timer Indicator)
    this.drawStatPill(gut + 52, 9, 174, 46, TASTE_THEME.colors.accentPrimary);
    this.dayText = this.scene.add.text(gut + 64, 14, 'Ngày 1', {
      fontFamily: TASTE_THEME.fonts.display,
      fontSize: '16px',
      fontStyle: 'bold',
      color: TASTE_THEME.colors.inkOnDark,
    });
    this.timeText = this.scene.add.text(gut + 64, 33, '🕒 Chuẩn bị • 06:00', {
      fontFamily: TASTE_THEME.fonts.mono,
      fontSize: '11.5px',
      fontStyle: '700',
      color: TASTE_THEME.colors.inkGold,
    });
    this.timeBarFill = this.scene.add.graphics();
    this.add([this.dayText, this.timeText, this.timeBarFill]);

    // 1. Money Pill
    this.drawStatPill(258, 13, 176, 38, TASTE_THEME.colors.accentGold);
    const coinBadge = this.scene.add.graphics();
    coinBadge.fillStyle(TASTE_THEME.colors.accentGold, 0.18);
    coinBadge.fillCircle(278, 32, 11);
    this.add(coinBadge);

    const coinSym = this.scene.add
      .text(278, 32, '₫', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '13.5px',
        fontStyle: 'bold',
        color: TASTE_THEME.colors.inkGold,
      })
      .setOrigin(0.5);

    this.moneyText = this.scene.add
      .text(358, 32, '350.000đ', {
        fontFamily: TASTE_THEME.fonts.mono,
        fontSize: '15px',
        fontStyle: '800',
        color: TASTE_THEME.colors.inkOnDark,
      })
      .setOrigin(0.5);
    this.add([coinSym, this.moneyText]);

    // 2. Diamond Pill
    this.drawStatPill(444, 13, 102, 38, TASTE_THEME.colors.infoTeal);
    const diaIcon = this.scene.add.text(464, 32, '💎', { fontSize: '13.5px' }).setOrigin(0.5);
    this.diamondText = this.scene.add
      .text(506, 32, '50', {
        fontFamily: TASTE_THEME.fonts.mono,
        fontSize: '15px',
        fontStyle: '800',
        color: TASTE_THEME.colors.inkOnDark,
      })
      .setOrigin(0.5);
    this.add([diaIcon, this.diamondText]);

    // 3. Warehouse Stock Glance Pill (`game-ui-design`: Critical end-of-day resource always visible!)
    this.drawStatPill(556, 13, 152, 38, TASTE_THEME.colors.successLight);
    this.stockText = this.scene.add
      .text(632, 32, '❄️ Kho: 115 phần', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '12.5px',
        fontStyle: '800',
        color: TASTE_THEME.colors.inkOnDark,
      })
      .setOrigin(0.5);
    this.add(this.stockText);

    // 4. Rating Pill
    this.drawStatPill(718, 13, 168, 38, TASTE_THEME.colors.accentAmber);
    this.ratingText = this.scene.add
      .text(802, 32, '★ 4.5 (12)', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '13px',
        fontStyle: '700',
        color: TASTE_THEME.colors.inkGold,
      })
      .setOrigin(0.5);
    this.add(this.ratingText);

    // Keyboard shortcut hint
    const hotkeyText = this.scene.add
      .text(965, 32, '[Space] Mở bán / Vớt\n[1-9] Chiên nhanh', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '11px',
        fontStyle: '600',
        color: TASTE_THEME.colors.inkMutedOnDark,
        align: 'center',
        lineSpacing: 2,
      })
      .setOrigin(0.5);
    this.add(hotkeyText);

    // Right Action Buttons aligned strictly to `W - gut` (`1280 - 20 = 1260`)
    const settingsW = 90;
    const summaryW = 96;
    const tutorialW = 104;
    const btnGap = 8;
    const settingsCenterX = W - gut - settingsW / 2;
    const summaryCenterX = settingsCenterX - settingsW / 2 - btnGap - summaryW / 2;
    const tutorialCenterX = summaryCenterX - summaryW / 2 - btnGap - tutorialW / 2;

    this.createTopButton(tutorialCenterX, 32, tutorialW, 38, '📖 Hướng dẫn', false, () => {
      SoundManager.playPop();
      if (onOpenTutorial) onOpenTutorial();
    });

    this.createTopButton(summaryCenterX, 32, summaryW, 38, '📊 Báo cáo', false, () => {
      SoundManager.playPop();
      onOpenSummary();
    });

    this.createTopButton(settingsCenterX, 32, settingsW, 38, '⚙️ Cài đặt', true, () => {
      SoundManager.playPop();
      onOpenSettings();
    });
  }

  private buildMobileHUD(
    W: number,
    onOpenSettings: () => void,
    onOpenSummary: () => void,
    onOpenTutorial?: () => void
  ): void {
    const navH = TASTE_THEME.layout.mobile.navHeight; // 58px
    const gut = TASTE_THEME.layout.mobile.gutter; // 12px

    const bg = this.scene.add.graphics();
    bg.fillStyle(TASTE_THEME.colors.bgElevated, 0.98);
    bg.fillRect(0, 0, W, navH);
    bg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
    bg.lineBetween(0, navH, W, navH);
    this.add(bg);

    const avatarX = gut + 18;
    const avatarY = 24;
    const avCircle = this.scene.add.graphics();
    avCircle.fillStyle(TASTE_THEME.colors.bgSurface, 1);
    avCircle.fillCircle(avatarX, avatarY, 17);
    avCircle.lineStyle(1.5, TASTE_THEME.colors.accentAmber, 0.9);
    avCircle.strokeCircle(avatarX, avatarY, 17);
    this.add(avCircle);

    if (this.scene.textures.exists('chef_raw')) {
      const avatarImg = this.scene.add.image(avatarX, avatarY + 2, 'chef_raw', 0).setScale(0.13);
      this.add(avatarImg);
    }

    const lvlBadge = this.scene.add.graphics();
    lvlBadge.fillStyle(TASTE_THEME.colors.accentPrimary, 1);
    lvlBadge.fillRoundedRect(gut, 39, 36, 13, 4);
    this.add(lvlBadge);

    this.levelText = this.scene.add
      .text(avatarX, 45.5, 'Lv.1', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '9.5px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.add(this.levelText);

    this.xpFill = this.scene.add.graphics();
    this.timeBarFill = this.scene.add.graphics();
    this.add([this.xpFill, this.timeBarFill]);

    this.dayText = this.scene.add.text(gut + 42, 6, 'Ngày 1', {
      fontFamily: TASTE_THEME.fonts.display,
      fontSize: '13.5px',
      fontStyle: 'bold',
      color: TASTE_THEME.colors.inkOnDark,
    });
    this.timeText = this.scene.add.text(gut + 42, 22, '🕒 06:00', {
      fontFamily: TASTE_THEME.fonts.mono,
      fontSize: '10.5px',
      fontStyle: '700',
      color: TASTE_THEME.colors.inkGold,
    });
    this.ratingText = this.scene.add.text(gut + 42, 38, '★ 4.5 (12)', {
      fontFamily: TASTE_THEME.fonts.sans,
      fontSize: '10.5px',
      fontStyle: '700',
      color: TASTE_THEME.colors.inkGold,
    });
    this.add([this.dayText, this.timeText, this.ratingText]);

    // Compact Money & Warehouse Stock pills
    this.drawStatPill(138, 7, 128, 21, TASTE_THEME.colors.accentGold);
    this.moneyText = this.scene.add
      .text(202, 17.5, '350.000đ', {
        fontFamily: TASTE_THEME.fonts.mono,
        fontSize: '11.5px',
        fontStyle: '800',
        color: TASTE_THEME.colors.inkGold,
      })
      .setOrigin(0.5);
    this.add(this.moneyText);

    this.drawStatPill(138, 31, 128, 20, TASTE_THEME.colors.infoTeal);
    this.diamondText = this.scene.add
      .text(202, 41, '💎 50 • ❄️ 115', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '10.5px',
        fontStyle: '700',
        color: TASTE_THEME.colors.inkOnDark,
      })
      .setOrigin(0.5);
    this.add(this.diamondText);

    // Right Action Buttons aligned strictly to `W - gut` (`420 - 12 = 408`)
    const btnW = 46;
    const gap = 4;
    const settingsX = W - gut - btnW / 2;
    const summaryX = settingsX - btnW - gap;
    const tutorialX = summaryX - btnW - gap;

    this.createTopButton(tutorialX, 29, btnW, 40, '📖\nHD', false, () => {
      SoundManager.playPop();
      if (onOpenTutorial) onOpenTutorial();
    });

    this.createTopButton(summaryX, 29, btnW, 40, '📊\nBáo cáo', false, () => {
      SoundManager.playPop();
      onOpenSummary();
    });

    this.createTopButton(settingsX, 29, btnW, 40, '⚙️\nCài đặt', true, () => {
      SoundManager.playPop();
      onOpenSettings();
    });
  }

  private drawStatPill(x: number, y: number, w: number, h: number, accentDotColor: number): void {
    const g = this.scene.add.graphics();
    g.fillStyle(TASTE_THEME.colors.bgSurface, 1);
    g.fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
    g.strokeRoundedRect(x, y, w, h, 8);
    // Subtle top specular highlight (`ui-design` card depth)
    g.lineStyle(1, 0xffffff, 0.05);
    g.lineBetween(x + 6, y + 1, x + w - 6, y + 1);
    g.fillStyle(accentDotColor, 0.9);
    g.fillRoundedRect(x, y + 6, 3, h - 12, 1.5);
    this.add(g);
  }

  private createTopButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    isAccent: boolean,
    onClick: () => void
  ): void {
    const btn = this.scene.add.container(x, y);
    const g = this.scene.add.graphics();

    const renderState = (hover: boolean) => {
      g.clear();
      const fill = isAccent
        ? hover
          ? TASTE_THEME.colors.accentPrimaryHover
          : TASTE_THEME.colors.accentPrimary
        : hover
          ? 0x382a20
          : TASTE_THEME.colors.bgSurface;
      g.fillStyle(fill, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
      g.lineStyle(
        1,
        isAccent ? TASTE_THEME.colors.accentAmber : TASTE_THEME.colors.borderHairlineDark,
        1
      );
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    };
    renderState(false);

    const lbl = this.scene.add
      .text(0, 0, label, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop ? '12.5px' : '10.5px',
        fontStyle: '700',
        color: TASTE_THEME.colors.inkOnDark,
        align: 'center',
      })
      .setOrigin(0.5);

    const hit = this.scene.add
      .rectangle(0, 0, w, h, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });

    const baseY = y;
    hit.on('pointerover', () => {
      renderState(true);
      this.scene.tweens.add({
        targets: btn,
        y: baseY - 1,
        duration: TASTE_THEME.motion.fast,
        ease: TASTE_THEME.motion.easeOut,
      });
    });

    hit.on('pointerout', () => {
      renderState(false);
      this.scene.tweens.add({
        targets: btn,
        y: baseY,
        scale: 1,
        duration: TASTE_THEME.motion.fast,
        ease: TASTE_THEME.motion.easeOut,
      });
    });

    hit.on('pointerdown', () => {
      this.scene.tweens.add({
        targets: btn,
        y: baseY + 1,
        scale: 0.985,
        duration: 70,
        yoyo: true,
        ease: TASTE_THEME.motion.easeOut,
        onComplete: onClick,
      });
    });

    btn.add([g, lbl, hit]);
    this.add(btn);
  }

  public updateTime(formattedTime: string, remainRatio = 1): void {
    this.timeText.setText(`🕒 ${formattedTime}`);

    const clamped = Phaser.Math.Clamp(remainRatio, 0, 1);
    const barColor =
      clamped > 0.4
        ? TASTE_THEME.colors.successLight
        : clamped > 0.18
          ? TASTE_THEME.colors.accentAmber
          : TASTE_THEME.colors.danger;

    this.timeText.setColor(
      clamped <= 0.18 ? '#fca5a5' : TASTE_THEME.colors.inkGold
    );

    this.timeBarFill.clear();
    if (this.isDesktop) {
      const gut = TASTE_THEME.layout.desktop.gutter;
      this.timeBarFill.fillStyle(0x16110d, 0.9);
      this.timeBarFill.fillRoundedRect(gut + 62, 49, 154, 3.5, 1.5);
      this.timeBarFill.fillStyle(barColor, 1);
      this.timeBarFill.fillRoundedRect(gut + 62, 49, Math.max(4, 154 * clamped), 3.5, 1.5);
    }
  }

  public refresh(): void {
    const s = this.gs.state;
    const totalRaw = this.gs.getTotalRawStock();

    this.levelText.setText(`Lv.${s.level}`);
    this.dayText.setText(`Ngày ${s.day}`);
    this.moneyText.setText(this.gs.formatCurrency(s.money));

    if (this.isDesktop) {
      this.diamondText.setText(`${s.diamonds}`);
      if (this.stockText) {
        this.stockText.setText(`❄️ Kho: ${totalRaw} phần`);
        this.stockText.setColor(
          totalRaw === 0 ? '#fca5a5' : TASTE_THEME.colors.inkOnDark
        );
      }
      this.ratingText.setText(`★ ${s.rating.toFixed(1)} (${s.ratingCount})`);
    } else {
      this.diamondText.setText(`💎 ${s.diamonds} • ❄️ ${totalRaw}`);
      this.ratingText.setText(`★ ${s.rating.toFixed(1)} (${s.ratingCount})`);
    }

    this.xpFill.clear();
    const xpRatio = Math.min(1, s.xp / this.gs.getXpForNextLevel());
    this.xpFill.fillStyle(TASTE_THEME.colors.successLight, 1);
    if (this.isDesktop) {
      const gut = TASTE_THEME.layout.desktop.gutter;
      this.xpFill.fillRoundedRect(gut, 60, Math.max(4, 44 * xpRatio), 3, 1.5);
    } else {
      const gut = TASTE_THEME.layout.mobile.gutter;
      this.xpFill.fillRoundedRect(gut, 53, Math.max(4, 36 * xpRatio), 2.5, 1);
    }
  }
}

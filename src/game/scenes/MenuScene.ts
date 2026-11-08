import Phaser from 'phaser';
import { GameStateManager } from '../managers/GameStateManager';
import { SoundManager } from '../managers/SoundManager';
import { AudioManager } from '../managers/AudioManager';
import { TASTE_THEME } from '../config/tasteTheme';
import { applyHiDPICamera, getLogicalDimensions } from '../config/display';

export class MenuScene extends Phaser.Scene {
  private gs!: GameStateManager;

  constructor() {
    super('MenuScene');
  }

  public create(): void {
    applyHiDPICamera(this);
    this.gs = GameStateManager.getInstance();
    AudioManager.getInstance().setMusicDucked(false);
    SoundManager.playBgm('menu', 550);

    const { width: W, height: H, isDesktop } = getLogicalDimensions();

    // 1. Warm deep espresso night-market surface (`taste-skill` + `ui-design` token system)
    const bg = this.add.graphics();
    bg.fillGradientStyle(
      TASTE_THEME.colors.bgBase,
      TASTE_THEME.colors.bgBase,
      TASTE_THEME.colors.bgElevated,
      TASTE_THEME.colors.bgElevated,
      1
    );
    bg.fillRect(0, 0, W, H);

    // Subtle warm radial street-lamp glow behind hero stage
    bg.fillStyle(TASTE_THEME.colors.accentPrimary, 0.06);
    bg.fillCircle(isDesktop ? 910 : W / 2, isDesktop ? 340 : 250, isDesktop ? 340 : 190);
    bg.fillStyle(TASTE_THEME.colors.accentAmber, 0.05);
    bg.fillCircle(isDesktop ? 280 : W / 2, isDesktop ? 240 : 480, 260);

    // Top ambient street-lantern string
    const lanternCount = isDesktop ? 12 : 6;
    const gut = isDesktop
      ? TASTE_THEME.layout.desktop.gutter * 2
      : TASTE_THEME.layout.mobile.gutter * 2;
    const lanternSpacing = (W - gut * 2) / Math.max(1, lanternCount - 1);
    bg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 0.75);
    bg.lineBetween(0, 26, W, 26);

    for (let i = 0; i < lanternCount; i++) {
      const lx = gut + i * lanternSpacing;
      const ly = 38 + (i % 2) * 8;
      bg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 0.85);
      bg.lineBetween(lx, 26, lx, ly);
      bg.fillStyle(TASTE_THEME.colors.accentAmber, 0.18);
      bg.fillCircle(lx, ly, 16);
      bg.fillStyle(TASTE_THEME.colors.accentGold, 0.95);
      bg.fillCircle(lx, ly, 6);
    }

    if (isDesktop) {
      this.buildDesktopHeroSplit(W, H);
    } else {
      this.buildMobileHeroStack(W, H);
    }

    // Keyboard-first navigation (`game-ui-design`: Enter or Space starts the game)
    if (this.input.keyboard) {
      this.input.keyboard.once('keydown-ENTER', () => {
        SoundManager.playCash();
        this.scene.start('ShopScene');
      });
      this.input.keyboard.once('keydown-SPACE', () => {
        SoundManager.playCash();
        this.scene.start('ShopScene');
      });
    }
  }

  /**
   * Desktop Split Hero (`hero--split` + `game-ui-design` Progressive Disclosure & Diegetic Stage):
   * - Left Column (`x: 64..552`): Eyebrow tag -> Display Title -> Lead copy -> 3-Step Game Loop Strip -> 3-Metric Strip -> CTA Row -> Controls
   * - Right Column (`x: 596..1224`): Framed Kiosk Signboard + `ref_banner` visual stage + Chibi Character Line-up with Chef speech bubble
   */
  private buildDesktopHeroSplit(_W: number, H: number): void {
    const leftX = 64;
    const leftColW = 488;
    const rightCenterX = 910;
    const rightStageW = 628;
    const enterItems: Phaser.GameObjects.GameObject[] = [];

    // 1. Live Eyebrow Pill
    const eyebrowCon = this.add.container(leftX, 82);
    const eyeBg = this.add.graphics();
    eyeBg.fillStyle(TASTE_THEME.colors.bgSurface, 1);
    eyeBg.fillRoundedRect(0, 0, 316, 28, 14);
    eyeBg.lineStyle(1, TASTE_THEME.colors.accentPrimary, 0.7);
    eyeBg.strokeRoundedRect(0, 0, 316, 28, 14);
    eyeBg.fillStyle(TASTE_THEME.colors.successLight, 1);
    eyeBg.fillCircle(16, 14, 4.5);

    const eyeTxt = this.add
      .text(28, 14, 'QUẦY ĐÊM SÀI GÒN  •  PHIÊN BẢN TYCOON PRO', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '10.5px',
        fontStyle: '800',
        color: TASTE_THEME.colors.inkGold,
      })
      .setOrigin(0, 0.5);
    eyebrowCon.add([eyeBg, eyeTxt]);
    enterItems.push(eyebrowCon);

    // 2. Display H1 Title (`ui-design` Type Scale Hierarchy)
    const titleMain = this.add.text(leftX, 122, 'CÁ VIÊN CHIÊN', {
      fontFamily: TASTE_THEME.fonts.display,
      fontSize: '54px',
      fontStyle: 'bold',
      color: TASTE_THEME.colors.inkOnDark,
    });
    const titleSub = this.add.text(leftX, 178, 'STREET FOOD TYCOON', {
      fontFamily: TASTE_THEME.fonts.sans,
      fontSize: '19px',
      fontStyle: '800',
      color: TASTE_THEME.colors.inkGold,
      letterSpacing: 1.5,
    });
    enterItems.push(titleMain, titleSub);

    // 3. Lead Paragraph
    const leadText = this.add.text(
      leftX,
      214,
      'Làm chủ xe cá viên chiên vỉa hè: tính toán vốn nhập hàng trước giờ mở cửa, canh lửa chiên giòn rụm và tối ưu lợi nhuận trong 6 phút cao điểm mỗi ngày.',
      {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '14px',
        fontStyle: '500',
        color: TASTE_THEME.colors.inkMutedOnDark,
        wordWrap: { width: leftColW },
        lineSpacing: 5,
      }
    );
    enterItems.push(leadText);

    // 4. 3-Step Core Loop Strip (`game-ui-design` Glanceable Rules)
    const loopCon = this.add.container(leftX, 278);
    const loopBg = this.add.graphics();
    loopBg.fillStyle(0x231a13, 0.95);
    loopBg.fillRoundedRect(0, 0, leftColW, 44, 10);
    loopBg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
    loopBg.strokeRoundedRect(0, 0, leftColW, 44, 10);
    loopCon.add(loopBg);

    const loopSteps = [
      '1. 📦 Nhập Kho & Bơm Gas',
      '2. 🔥 Mở Bán Tối Đa 06:00',
      '3. 📊 Hết Gas/Kho = Chốt Ngày',
    ];
    loopSteps.forEach((step, idx) => {
      const sx = (leftColW / 3) * idx + leftColW / 6;
      const st = this.add
        .text(sx, 22, step, {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: '11px',
          fontStyle: '700',
          color: idx === 1 ? TASTE_THEME.colors.inkGold : TASTE_THEME.colors.inkOnDark,
        })
        .setOrigin(0.5);
      loopCon.add(st);
    });
    enterItems.push(loopCon);

    // 5. Unified 3-Metric Save Strip (`ui-design` 8pt grid & tabular numbers)
    const metricY = 336;
    const metricCard = this.add.container(leftX, metricY);
    const mBg = this.add.graphics();
    mBg.fillStyle(TASTE_THEME.colors.bgSurface, 0.98);
    mBg.fillRoundedRect(0, 0, leftColW, 84, 12);
    mBg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
    mBg.strokeRoundedRect(0, 0, leftColW, 84, 12);
    mBg.lineStyle(1, 0xffffff, 0.06);
    mBg.lineBetween(14, 1, leftColW - 14, 1);
    mBg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
    mBg.lineBetween(leftColW / 3, 14, leftColW / 3, 70);
    mBg.lineBetween((leftColW * 2) / 3, 14, (leftColW * 2) / 3, 70);
    metricCard.add(mBg);

    const metrics = [
      {
        label: 'TIẾN ĐỘ QUÁN',
        value: `Ngày ${this.gs.state.day} • Lv.${this.gs.state.level}`,
        color: TASTE_THEME.colors.inkOnDark,
      },
      {
        label: 'TIỀN VỐN HIỆN CÓ',
        value: this.gs.formatCurrency(this.gs.state.money),
        color: TASTE_THEME.colors.inkGold,
      },
      {
        label: 'ĐIỂM UY TÍN',
        value: `★ ${this.gs.state.rating.toFixed(1)} (${this.gs.state.ratingCount})`,
        color: '#4ade80',
      },
    ];

    metrics.forEach((m, idx) => {
      const colCenterX = (leftColW / 3) * idx + leftColW / 6;
      const lbl = this.add
        .text(colCenterX, 25, m.label, {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: '10.5px',
          fontStyle: '700',
          color: TASTE_THEME.colors.inkMutedOnDark,
        })
        .setOrigin(0.5);
      const val = this.add
        .text(colCenterX, 52, m.value, {
          fontFamily: TASTE_THEME.fonts.mono,
          fontSize: '15px',
          fontStyle: '800',
          color: m.color,
        })
        .setOrigin(0.5);
      metricCard.add([lbl, val]);
    });
    enterItems.push(metricCard);

    // 6. CTA Action Row (`ui-design` Component State Mapping + Keyboard Prompt)
    const isDay1 = this.gs.state.day === 1;
    const primaryBtn = this.createActionButton(
      leftX + 152,
      462,
      304,
      54,
      isDay1 ? '▶  BẮT ĐẦU NGÀY 1 [Enter]' : `▶  TIẾP TỤC QUÁN • NGÀY ${this.gs.state.day} [Enter]`,
      'primary',
      () => {
        SoundManager.playCash();
        this.scene.start('ShopScene');
      }
    );

    const resetBtn = this.createActionButton(
      leftX + 402,
      462,
      172,
      54,
      '🔄  Chơi Mới',
      'secondary',
      () => {
        SoundManager.playPop();
        this.gs.initState(true);
        this.scene.restart();
      }
    );
    enterItems.push(primaryBtn, resetBtn);

    // 7. Sound Toggle + Keyboard Shortcut Strip
    const footerCon = this.add.container(leftX, 536);
    const soundPill = this.add
      .text(0, 0, this.getSoundText(), {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '12.5px',
        fontStyle: '700',
        color: TASTE_THEME.colors.inkOnDark,
        backgroundColor: '#2c2119',
        padding: { left: 14, right: 14, top: 8, bottom: 8 },
      })
      .setInteractive({ useHandCursor: true });

    soundPill.on('pointerdown', () => {
      SoundManager.enabled = !SoundManager.enabled;
      this.gs.state.soundEnabled = SoundManager.enabled;
      this.gs.save();
      soundPill.setText(this.getSoundText());
      if (SoundManager.enabled) SoundManager.playPop();
    });

    const kbHint = this.add.text(
      0,
      46,
      'Phím tắt: [Space] Mở bán / Vớt & Phục vụ  •  [G] Bơm Gas  •  [R] Nhập đầy kho  •  [1-9] Chiên nhanh',
      {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '11.5px',
        fontStyle: '600',
        color: TASTE_THEME.colors.inkMutedOnDark,
      }
    );
    footerCon.add([soundPill, kbHint]);
    enterItems.push(footerCon);

    // 8. Right Column: Framed Kiosk Stage Card (`ref_banner` + Signboard Header + Character Line-up)
    const stageCon = this.add.container(rightCenterX, H / 2 + 10);
    const stageH = 548;
    const stageBg = this.add.graphics();
    stageBg.fillStyle(TASTE_THEME.colors.bgSurface, 1);
    stageBg.fillRoundedRect(-rightStageW / 2, -stageH / 2, rightStageW, stageH, 16);
    stageBg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
    stageBg.strokeRoundedRect(-rightStageW / 2, -stageH / 2, rightStageW, stageH, 16);
    stageBg.lineStyle(1, 0xffffff, 0.07);
    stageBg.lineBetween(-rightStageW / 2 + 16, -stageH / 2 + 1, rightStageW / 2 - 16, -stageH / 2 + 1);
    stageCon.add(stageBg);

    // Top Kiosk Signboard Header inside the stage card
    const headerBar = this.add.graphics();
    headerBar.fillStyle(TASTE_THEME.colors.bgBase, 0.85);
    headerBar.fillRoundedRect(-rightStageW / 2 + 12, -stageH / 2 + 12, rightStageW - 24, 34, 8);
    headerBar.fillStyle(TASTE_THEME.colors.successLight, 1);
    headerBar.fillCircle(-rightStageW / 2 + 28, -stageH / 2 + 29, 4);
    stageCon.add(headerBar);

    const stageTitle = this.add
      .text(-rightStageW / 2 + 40, -stageH / 2 + 29, 'XE CÁ VIÊN CHIÊN SÀI GÒN  •  12 MÓN NÓNG GIÒN', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '11.5px',
        fontStyle: '800',
        color: TASTE_THEME.colors.inkOnDark,
      })
      .setOrigin(0, 0.5);

    const stageBadge = this.add
      .text(rightStageW / 2 - 24, -stageH / 2 + 29, '🕒 CA BÁN: TỐI ĐA 06:00 / NGÀY', {
        fontFamily: TASTE_THEME.fonts.mono,
        fontSize: '11px',
        fontStyle: '700',
        color: TASTE_THEME.colors.inkGold,
      })
      .setOrigin(1, 0.5);
    stageCon.add([stageTitle, stageBadge]);

    // Reference street-food kiosk artwork inside top half of the visual card
    const imgW = rightStageW - 24;
    const imgH = 324;
    const imgY = -stageH / 2 + 54 + imgH / 2;

    const imgFrame = this.add.graphics();
    imgFrame.fillStyle(TASTE_THEME.colors.cardCream, 1);
    imgFrame.fillRoundedRect(-imgW / 2, imgY - imgH / 2, imgW, imgH, 10);
    stageCon.add(imgFrame);

    if (this.textures.exists('ref_banner')) {
      const banner = this.add.image(0, imgY, 'ref_banner');
      banner.setDisplaySize(imgW - 8, imgH - 8);
      stageCon.add(banner);
    }

    // Bottom Character Stage inside the card: All sprites registered on a single baseline (`feet` anchor)
    const floorY = stageH / 2 - 16;
    const stageFloor = this.add.graphics();
    stageFloor.fillStyle(TASTE_THEME.colors.bgBase, 0.65);
    stageFloor.fillRoundedRect(-imgW / 2, floorY - 132, imgW, 122, 10);
    stageFloor.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 0.9);
    stageFloor.lineBetween(-imgW / 2 + 16, floorY - 14, imgW / 2 - 16, floorY - 14);
    stageCon.add(stageFloor);

    const lineup: Array<{ key: string; frame?: number; scale: number }> = [
      { key: 'cust_bad_bully', scale: 0.37 },
      { key: 'cust_student_boy', scale: 0.37 },
      { key: 'cust_vip_reviewer', scale: 0.37 },
      { key: 'chef_raw', frame: 3, scale: 0.43 },
      { key: 'cust_vip_rich', scale: 0.37 },
      { key: 'cust_college', scale: 0.37 },
      { key: 'cust_bad_cheat', scale: 0.37 },
    ];

    const charSpacing = 82;
    const startCharX = -((lineup.length - 1) * charSpacing) / 2;
    lineup.forEach((item, idx) => {
      if (this.textures.exists(item.key)) {
        const cx = startCharX + idx * charSpacing;
        const cy = floorY - 14;
        const spr =
          item.frame !== undefined
            ? this.add.image(cx, cy, item.key, item.frame)
            : this.add.image(cx, cy, item.key);
        spr.setOrigin(0.5, 1);
        spr.setScale(item.scale);
        stageCon.add(spr);

        this.tweens.add({
          targets: spr,
          y: cy - 4,
          duration: 760 + idx * 70,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    });

    // Diegetic speech pill above the Chef
    const chefBubble = this.add
      .text(0, floorY - 122, '👨‍🍳 "Nhập đầy Kho & Gas trước giờ mở bán nhé!"', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '11.5px',
        fontStyle: '800',
        color: TASTE_THEME.colors.inkDark,
        backgroundColor: '#faf5ed',
        padding: { left: 10, right: 10, top: 4, bottom: 4 },
      })
      .setOrigin(0.5);
    stageCon.add(chefBubble);

    enterItems.push(stageCon);
    this.playStaggeredEntrance(enterItems);
  }

  private buildMobileHeroStack(W: number, _H: number): void {
    const gut = TASTE_THEME.layout.mobile.gutter; // 12px
    const contentW = W - gut * 2;
    const enterItems: Phaser.GameObjects.GameObject[] = [];

    // Header Title Stack
    const eyebrow = this.add
      .text(W / 2, 62, '● QUẦY ĐÊM SÀI GÒN  •  TYCOON PRO', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '10.5px',
        fontStyle: '800',
        color: TASTE_THEME.colors.inkGold,
      })
      .setOrigin(0.5);

    const title = this.add
      .text(W / 2, 92, 'CÁ VIÊN CHIÊN', {
        fontFamily: TASTE_THEME.fonts.display,
        fontSize: '36px',
        fontStyle: 'bold',
        color: TASTE_THEME.colors.inkOnDark,
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(W / 2, 122, 'NHẬP HÀNG ĐẦU NGÀY • MỞ BÁN TỐI ĐA 6 PHÚT', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '11px',
        fontStyle: '800',
        color: TASTE_THEME.colors.inkMutedOnDark,
      })
      .setOrigin(0.5);
    enterItems.push(eyebrow, title, subtitle);

    // Visual Banner Card
    const cardY = 242;
    const cardH = 188;
    const bannerCon = this.add.container(W / 2, cardY);
    const cardBg = this.add.graphics();
    cardBg.fillStyle(TASTE_THEME.colors.bgSurface, 1);
    cardBg.fillRoundedRect(-contentW / 2, -cardH / 2, contentW, cardH, 12);
    cardBg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
    cardBg.strokeRoundedRect(-contentW / 2, -cardH / 2, contentW, cardH, 12);
    bannerCon.add(cardBg);

    if (this.textures.exists('ref_banner')) {
      const banner = this.add.image(0, 0, 'ref_banner');
      banner.setDisplaySize(contentW - 16, cardH - 16);
      bannerCon.add(banner);
    }
    enterItems.push(bannerCon);

    // Registered Chibi Lineup on unified baseline
    const lineupY = 432;
    const lineupCon = this.add.container(W / 2, lineupY);
    const lineup: Array<{ key: string; frame?: number; scale: number }> = [
      { key: 'cust_student_boy', scale: 0.32 },
      { key: 'cust_girl', scale: 0.32 },
      { key: 'chef_raw', frame: 3, scale: 0.36 },
      { key: 'cust_college', scale: 0.32 },
      { key: 'cust_office', scale: 0.32 },
    ];
    const spacing = 72;
    const startX = -((lineup.length - 1) * spacing) / 2;
    lineup.forEach((item, idx) => {
      if (this.textures.exists(item.key)) {
        const cx = startX + idx * spacing;
        const spr =
          item.frame !== undefined
            ? this.add.image(cx, 0, item.key, item.frame)
            : this.add.image(cx, 0, item.key);
        spr.setOrigin(0.5, 1);
        spr.setScale(item.scale);
        lineupCon.add(spr);
      }
    });
    enterItems.push(lineupCon);

    // Save Stats Card
    const statsCon = this.add.container(W / 2, 486);
    const sBg = this.add.graphics();
    sBg.fillStyle(TASTE_THEME.colors.bgSurface, 0.96);
    sBg.fillRoundedRect(-contentW / 2, -36, contentW, 72, 10);
    sBg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
    sBg.strokeRoundedRect(-contentW / 2, -36, contentW, 72, 10);
    const sTxt = this.add
      .text(
        0,
        0,
        `Ngày ${this.gs.state.day}  •  Lv.${this.gs.state.level}  •  Vốn: ${this.gs.formatCurrency(this.gs.state.money)}\nUy tín: ★ ${this.gs.state.rating.toFixed(1)} (${this.gs.state.ratingCount} đánh giá)  •  Ca bán: 06:00`,
        {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: '13px',
          fontStyle: '700',
          color: TASTE_THEME.colors.inkOnDark,
          align: 'center',
          lineSpacing: 5,
        }
      )
      .setOrigin(0.5);
    statsCon.add([sBg, sTxt]);
    enterItems.push(statsCon);

    // Primary & Secondary CTAs
    const isDay1Mobile = this.gs.state.day === 1;
    const playBtn = this.createActionButton(
      W / 2,
      574,
      contentW,
      54,
      isDay1Mobile ? '▶  BẮT ĐẦU NGÀY 1' : `▶  TIẾP TỤC NGÀY ${this.gs.state.day}`,
      'primary',
      () => {
        SoundManager.playCash();
        this.scene.start('ShopScene');
      }
    );

    const resetBtn = this.createActionButton(
      W / 2,
      642,
      contentW,
      44,
      '🔄  Khởi Tạo Quán Mới',
      'secondary',
      () => {
        SoundManager.playPop();
        this.gs.initState(true);
        this.scene.restart();
      }
    );
    enterItems.push(playBtn, resetBtn);

    const soundLabel = this.add
      .text(W / 2, 712, this.getSoundText(), {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '13px',
        fontStyle: '700',
        color: TASTE_THEME.colors.inkGold,
        backgroundColor: '#2c2119',
        padding: { left: 16, right: 16, top: 8, bottom: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    soundLabel.on('pointerdown', () => {
      SoundManager.enabled = !SoundManager.enabled;
      this.gs.state.soundEnabled = SoundManager.enabled;
      this.gs.save();
      soundLabel.setText(this.getSoundText());
      if (SoundManager.enabled) SoundManager.playPop();
    });
    enterItems.push(soundLabel);

    this.playStaggeredEntrance(enterItems);
  }

  private playStaggeredEntrance(items: Phaser.GameObjects.GameObject[]): void {
    items.forEach((item, index) => {
      const target = item as unknown as Phaser.GameObjects.Components.Transform &
        Phaser.GameObjects.Components.Alpha;
      const finalY = target.y;
      target.setAlpha(0);
      target.y = finalY + 14;
      this.tweens.add({
        targets: target,
        y: finalY,
        alpha: 1,
        duration: TASTE_THEME.motion.enter,
        delay: index * 50,
        ease: TASTE_THEME.motion.easeOut,
      });
    });
  }

  private getSoundText(): string {
    return SoundManager.enabled ? '🔊 Âm thanh: ĐANG BẬT' : '🔇 Âm thanh: ĐANG TẮT';
  }

  private createActionButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    variant: 'primary' | 'secondary',
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const bg = this.add.graphics();

    const drawBtn = (hover: boolean) => {
      bg.clear();
      if (variant === 'primary') {
        bg.fillStyle(
          hover ? TASTE_THEME.colors.accentPrimaryHover : TASTE_THEME.colors.accentPrimary,
          1
        );
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
        bg.lineStyle(1, TASTE_THEME.colors.accentAmber, 0.95);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
        // Inner top specular highlight (`ui-design` tactile depth)
        bg.lineStyle(1, 0xffffff, 0.22);
        bg.lineBetween(-w / 2 + 10, -h / 2 + 1, w / 2 - 10, -h / 2 + 1);
      } else {
        bg.fillStyle(hover ? 0x382a20 : TASTE_THEME.colors.bgSurface, 1);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
        bg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
      }
    };
    drawBtn(false);

    const txt = this.add
      .text(0, 0, label, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: variant === 'primary' ? '15.5px' : '14px',
        fontStyle: '800',
        color: TASTE_THEME.colors.inkOnDark,
      })
      .setOrigin(0.5);

    const hitArea = this.add
      .rectangle(0, 0, w, h, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });

    const baseY = y;
    hitArea.on('pointerover', () => {
      drawBtn(true);
      this.tweens.add({
        targets: container,
        y: baseY - 1.5,
        duration: TASTE_THEME.motion.fast,
        ease: TASTE_THEME.motion.easeOut,
      });
    });

    hitArea.on('pointerout', () => {
      drawBtn(false);
      this.tweens.add({
        targets: container,
        y: baseY,
        scale: 1,
        duration: TASTE_THEME.motion.fast,
        ease: TASTE_THEME.motion.easeOut,
      });
    });

    hitArea.on('pointerdown', () => {
      this.tweens.add({
        targets: container,
        y: baseY + 1,
        scale: 0.985,
        duration: 75,
        yoyo: true,
        ease: TASTE_THEME.motion.easeOut,
        onComplete: onClick,
      });
    });

    container.add([bg, txt, hitArea]);
    return container;
  }
}

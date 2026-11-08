import Phaser from 'phaser';
import { INITIAL_FOODS, FoodDefinition } from '../data/foods';
import { GameStateManager } from '../managers/GameStateManager';
import { SoundManager } from '../managers/SoundManager';
import { CookingSystem } from '../systems/CookingSystem';
import { CustomerSystem, ActiveCustomer, SauceType, VeggieType } from '../systems/CustomerSystem';
import { DaySystem } from '../systems/DaySystem';
import { EconomySystem } from '../systems/EconomySystem';
import { InventorySystem } from '../systems/InventorySystem';
import { HUD } from '../ui/HUD';
import { FoodTray } from '../ui/FoodTray';
import { CustomerOrder } from '../ui/CustomerOrder';
import { Player } from '../entities/Player';
import { ModalTab } from './ModalScene';
import { TASTE_THEME } from '../config/tasteTheme';
import { applyHiDPICamera, getLogicalDimensions } from '../config/display';

interface FryerSlotUI {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  foodIcon: Phaser.GameObjects.Image;
  statusText: Phaser.GameObjects.Text;
  progressFill: Phaser.GameObjects.Graphics;
  bubbleEmitter: Phaser.GameObjects.Graphics;
  slotW: number;
  slotH: number;
  baseY: number;
}

export class ShopScene extends Phaser.Scene {
  private gs!: GameStateManager;
  public cookingSystem!: CookingSystem;
  public customerSystem!: CustomerSystem;
  public daySystem!: DaySystem;
  public economySystem!: EconomySystem;
  public inventorySystem!: InventorySystem;

  private hud!: HUD;
  private player!: Player;
  private trays: Map<string, FoodTray> = new Map();
  private customerViews: Map<number, CustomerOrder> = new Map();
  private fryerUIs: FryerSlotUI[] = [];

  private gasFillBar!: Phaser.GameObjects.Graphics;
  private gasPercentText!: Phaser.GameObjects.Text;
  private gasRefillBtnLbl!: Phaser.GameObjects.Text;
  private oilFillBar!: Phaser.GameObjects.Graphics;
  private oilPercentText!: Phaser.GameObjects.Text;
  private oilChangeBtnLbl!: Phaser.GameObjects.Text;
  private veggieStockText!: Phaser.GameObjects.Text;
  private primaryQuickBtnTxt!: Phaser.GameObjects.Text;
  private secondaryQuickBtnTxt!: Phaser.GameObjects.Text;
  private todayRevenueText!: Phaser.GameObjects.Text;
  private tutorialHintContainer?: Phaser.GameObjects.Container;
  private tutorialHintText?: Phaser.GameObjects.Text;
  private bubblePhase = 0;
  private isDesktop = false;
  private endDayPending = false;

  constructor() {
    super('ShopScene');
  }

  public create(): void {
    this.gs = GameStateManager.getInstance();
    this.cookingSystem = new CookingSystem();
    this.customerSystem = new CustomerSystem();
    this.daySystem = new DaySystem();
    this.economySystem = new EconomySystem();
    this.inventorySystem = new InventorySystem();

    this.trays.clear();
    this.customerViews.clear();
    this.fryerUIs = [];

    applyHiDPICamera(this);
    const { width: W, height: H, isDesktop } = getLogicalDimensions();
    this.isDesktop = isDesktop;

    // 1. Environment Background (Desktop Widescreen or Mobile Portrait)
    if (this.isDesktop) {
      this.buildDesktopEnvironment(W, H);
    } else {
      this.buildMobileEnvironment(W, H);
    }

    // 2. Top HUD Bar
    this.hud = new HUD(
      this,
      () => this.openModal('settings'),
      () => this.openModal('daily_result'),
      () => this.openModal('tutorial')
    );
    this.add.existing(this.hud);

    // 3. Customer Queue, Chef & Full Condiment Counter Ledge
    this.buildCustomerAndChefZone();

    // 4. 12 Food Trays Glass Showcase Grid (3 Columns x 4 Rows)
    this.buildTwelveTraysGrid();
    this.buildCondimentStation();

    // 5. Industrial Cooking Station (Gas Tank + Fryer Baskets + Quick Actions)
    this.buildCookingStation();

    // 6. Cohesive Bottom Navigation Bar (`taste-skill` one button system, zero purple)
    this.buildBottomNavBar();

    // 7. Wire up System Events & Desktop Keyboard Shortcuts
    this.bindEvents();
    this.setupKeyboardShortcuts();

    // Start in Pre-Day Preparation ("Trước giờ mở bán là lúc nhập hàng")
    this.enterPrepForDay(false);
  }

  /**
   * Desktop 12-Column Grid Environment (`layout-v4.md` Equal Outer Edges):
   * - Outer Gutter `--gut = 20px`: Left edge = `20`, Right edge = `1260` (`1280 - 20`).
   * - Top HUD: `y: 0..64`
   * - Left Column (`x: 20..704`, width `684`):
   *   - Street Service Counter: `y: 78..304` (height `226`)
   *   - Industrial Fryer & Gas Station: `y: 318..644` (height `326`)
   * - Right Column (`x: 718..1260`, width `542`):
   *   - 12-Tray Glass Showcase Cabinet: `y: 78..644` (height `566`)
   * - Bottom Navigation Bar: `y: 658..720` (height `62`)
   */
  private buildDesktopEnvironment(W: number, H: number): void {
    const bg = this.add.graphics();
    const gut = TASTE_THEME.layout.desktop.gutter; // 20px
    const leftX = gut;
    const leftW = 684;
    const rightX = 718;
    const rightW = W - gut - rightX; // 542px

    // Base warm espresso backdrop
    bg.fillGradientStyle(
      TASTE_THEME.colors.bgBase,
      TASTE_THEME.colors.bgBase,
      TASTE_THEME.colors.bgElevated,
      TASTE_THEME.colors.bgElevated,
      1
    );
    bg.fillRect(0, 0, W, H);

    // === LEFT TOP CARD: Street Service Counter (`y: 78..304`) ===
    bg.fillStyle(TASTE_THEME.colors.bgSurface, 1);
    bg.fillRoundedRect(leftX, 78, leftW, 226, 14);
    // Warm street evening glow inside the counter bay
    bg.fillStyle(0xf59e0b, 0.08);
    bg.fillRoundedRect(leftX + 2, 96, leftW - 4, 174, 12);

    // Crisp red-and-white Vietnamese street cart awning scalloped roof
    const stripeCount = 14;
    const stripeW = leftW / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      const sx = leftX + i * stripeW;
      const isRed = i % 2 === 0;
      bg.fillStyle(isRed ? TASTE_THEME.colors.accentPrimary : TASTE_THEME.colors.cardCream, 1);
      bg.fillRect(sx, 78, stripeW, 16);
      bg.fillCircle(sx + stripeW / 2, 94, stripeW / 2);
    }

    // Warm wooden counter ledge at the bottom of the customer bay (`y: 268..304`)
    bg.fillStyle(TASTE_THEME.colors.woodMid, 1);
    bg.fillRoundedRect(leftX, 270, leftW, 34, { tl: 4, tr: 4, bl: 14, br: 14 });
    bg.fillStyle(TASTE_THEME.colors.woodLight, 0.45);
    bg.fillRect(leftX + 4, 272, leftW - 8, 6);
    bg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
    bg.strokeRoundedRect(leftX, 78, leftW, 226, 14);

    // === LEFT BOTTOM CARD: Industrial Cooking Station (`y: 318..644`) ===
    bg.fillStyle(TASTE_THEME.colors.bgSurface, 1);
    bg.fillRoundedRect(leftX, 318, leftW, 326, 14);
    // Stainless steel recessed workspace
    bg.fillStyle(TASTE_THEME.colors.steelDeep, 0.9);
    bg.fillRoundedRect(leftX + 10, 356, leftW - 20, 278, 10);
    bg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
    bg.strokeRoundedRect(leftX, 318, leftW, 326, 14);

    // Clean Section Header (`layout-v4.md`: concise title + right-aligned muted hint)
    this.add.text(leftX + 16, 330, '🔥 BẾP CHIÊN & TRẠM GAS', {
      fontFamily: TASTE_THEME.fonts.sans,
      fontSize: '13px',
      fontStyle: '800',
      color: TASTE_THEME.colors.inkOnDark,
    });
    this.add
      .text(leftX + leftW - 16, 331, 'Chạm rổ hoặc nhấn [Space] để vớt nhanh', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '11.5px',
        fontStyle: '600',
        color: TASTE_THEME.colors.inkMutedOnDark,
      })
      .setOrigin(1, 0);

    // === RIGHT CARD: 12 Food Trays Glass Showcase Counter (`x: 718..1260, y: 78..644`) ===
    bg.fillStyle(TASTE_THEME.colors.bgGlassShowcase, 1);
    bg.fillRoundedRect(rightX, 78, rightW, 566, 14);
    // Warm wooden cabinet trim at top and bottom of glass showcase
    bg.fillStyle(TASTE_THEME.colors.woodDark, 0.65);
    bg.fillRoundedRect(rightX, 78, rightW, 44, { tl: 14, tr: 14, bl: 0, br: 0 });
    bg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
    bg.strokeRoundedRect(rightX, 78, rightW, 566, 14);
    bg.lineBetween(rightX, 122, rightX + rightW, 122);

    this.add.text(rightX + 18, 92, '🍱 TỦ KHAY ĐỒ CHIÊN (12 MÓN)', {
      fontFamily: TASTE_THEME.fonts.sans,
      fontSize: '13px',
      fontStyle: '800',
      color: TASTE_THEME.colors.inkGold,
    });
    this.add
      .text(rightX + rightW - 18, 93, 'Chạm khay để chiên / Mở khóa', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '11.5px',
        fontStyle: '600',
        color: TASTE_THEME.colors.inkMutedOnDark,
      })
      .setOrigin(1, 0);
  }

  /**
   * Mobile Portrait Environment (`420x780`) with strict `12px` outer gutter (`x: 12..408`):
   * - Top HUD: `y: 0..58`
   * - Street Customer & Chef Zone: `y: 66..230`
   * - 12-Tray Showcase Cabinet: `y: 238..544`
   * - Industrial Cooking Station: `y: 552..714`
   * - Bottom Navigation Bar: `y: 722..780`
   */
  private buildMobileEnvironment(W: number, H: number): void {
    const bg = this.add.graphics();
    const gut = TASTE_THEME.layout.mobile.gutter; // 12px
    const cardW = W - gut * 2; // 396px

    bg.fillGradientStyle(
      TASTE_THEME.colors.bgBase,
      TASTE_THEME.colors.bgBase,
      TASTE_THEME.colors.bgElevated,
      TASTE_THEME.colors.bgElevated,
      1
    );
    bg.fillRect(0, 0, W, H);

    // 1. Customer & Awning Card (`y: 66..230`)
    bg.fillStyle(TASTE_THEME.colors.bgSurface, 1);
    bg.fillRoundedRect(gut, 66, cardW, 164, 12);

    const stripeCount = 10;
    const stripeW = cardW / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      const sx = gut + i * stripeW;
      bg.fillStyle(
        i % 2 === 0 ? TASTE_THEME.colors.accentPrimary : TASTE_THEME.colors.cardCream,
        1
      );
      bg.fillRect(sx, 66, stripeW, 14);
      bg.fillCircle(sx + stripeW / 2, 80, stripeW / 2);
    }

    // Wooden counter ledge
    bg.fillStyle(TASTE_THEME.colors.woodMid, 1);
    bg.fillRoundedRect(gut, 206, cardW, 24, { tl: 3, tr: 3, bl: 12, br: 12 });
    bg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
    bg.strokeRoundedRect(gut, 66, cardW, 164, 12);

    // 2. 12-Tray Showcase Card (`y: 238..544`)
    bg.fillStyle(TASTE_THEME.colors.bgGlassShowcase, 1);
    bg.fillRoundedRect(gut, 238, cardW, 306, 12);
    bg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
    bg.strokeRoundedRect(gut, 238, cardW, 306, 12);

    // 3. Cooking Station Card (`y: 552..714`)
    bg.fillStyle(TASTE_THEME.colors.bgSurface, 1);
    bg.fillRoundedRect(gut, 552, cardW, 162, 12);
    bg.fillStyle(TASTE_THEME.colors.steelDeep, 0.9);
    bg.fillRoundedRect(gut + 6, 574, cardW - 12, 134, 9);
    bg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
    bg.strokeRoundedRect(gut, 552, cardW, 162, 12);
  }

  private buildCustomerAndChefZone(): void {
    if (this.isDesktop) {
      // Chef standing on the left of the wooden service counter
      this.player = new Player(this, 88, 224);
      this.player.setScale(1.12);
      this.add.existing(this.player);

      // Arrange all 12 SpriteForge-keyed sauces, bowls, shakers & toppings along the wooden counter ledge!
      const counterProps: Array<{ key: string; x: number; y: number; scale: number }> = [
        { key: 'prop_chai_tuong_ot', x: 38, y: 282, scale: 0.25 },
        { key: 'prop_chai_tuong_den', x: 60, y: 282, scale: 0.25 },
        { key: 'prop_lo_muoi', x: 124, y: 284, scale: 0.2 },
        { key: 'prop_lo_tieu', x: 142, y: 284, scale: 0.2 },
        { key: 'prop_bat_tuong_ot', x: 168, y: 285, scale: 0.22 },
        { key: 'prop_bat_tuong_den', x: 194, y: 285, scale: 0.22 },
        { key: 'prop_bat_sot_me', x: 220, y: 285, scale: 0.22 },
        { key: 'prop_dua_leo', x: 584, y: 284, scale: 0.24 },
        { key: 'prop_rau_ram', x: 612, y: 284, scale: 0.24 },
        { key: 'prop_topping_tac', x: 638, y: 285, scale: 0.21 },
        { key: 'prop_topping_ot', x: 662, y: 285, scale: 0.21 },
        { key: 'prop_topping_hanh', x: 684, y: 285, scale: 0.21 },
      ];

      for (const p of counterProps) {
        if (this.textures.exists(p.key)) {
          this.add.image(p.x, p.y, p.key).setOrigin(0.5, 1).setScale(p.scale);
        }
      }

      // Top Utility Strip: Revenue Chalkboard (`x: 32..152, y: 97..131`)
      const board = this.add.graphics();
      board.fillStyle(TASTE_THEME.colors.bgBase, 0.94);
      board.fillRoundedRect(32, 97, 120, 34, 7);
      board.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
      board.strokeRoundedRect(32, 97, 120, 34, 7);

      this.add
        .text(42, 114, '₫ Doanh thu:', {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: '9.5px',
          fontStyle: '700',
          color: TASTE_THEME.colors.inkMutedOnDark,
        })
        .setOrigin(0, 0.5);

      this.todayRevenueText = this.add
        .text(142, 114, '0đ', {
          fontFamily: TASTE_THEME.fonts.mono,
          fontSize: '13px',
          fontStyle: '800',
          color: '#4ade80',
        })
        .setOrigin(1, 0.5);
    } else {
      this.player = new Player(this, 36, 176);
      this.add.existing(this.player);

      const mobileProps: Array<{ key: string; x: number; y: number; scale: number }> = [
        { key: 'prop_chai_tuong_ot', x: 26, y: 216, scale: 0.19 },
        { key: 'prop_chai_tuong_den', x: 42, y: 216, scale: 0.19 },
        { key: 'prop_bat_sot_me', x: 62, y: 218, scale: 0.17 },
        { key: 'prop_dua_leo', x: 82, y: 218, scale: 0.18 },
        { key: 'prop_rau_ram', x: 374, y: 218, scale: 0.18 },
        { key: 'prop_topping_tac', x: 394, y: 218, scale: 0.17 },
      ];
      for (const p of mobileProps) {
        if (this.textures.exists(p.key)) {
          this.add.image(p.x, p.y, p.key).setOrigin(0.5, 1).setScale(p.scale);
        }
      }

      // Mobile Top Utility Strip: Revenue Pill (`x: 16..118, y: 82..104`)
      const board = this.add.graphics();
      board.fillStyle(TASTE_THEME.colors.bgBase, 0.94);
      board.fillRoundedRect(16, 82, 102, 22, 5);
      board.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
      board.strokeRoundedRect(16, 82, 102, 22, 5);

      this.add
        .text(24, 93, '💰 Doanh thu:', {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: '8.5px',
          fontStyle: '700',
          color: TASTE_THEME.colors.inkMutedOnDark,
        })
        .setOrigin(0, 0.5);

      this.todayRevenueText = this.add
        .text(110, 93, '0đ', {
          fontFamily: TASTE_THEME.fonts.mono,
          fontSize: '10px',
          fontStyle: '800',
          color: '#4ade80',
        })
        .setOrigin(1, 0.5);
    }

    // Build intelligent Day 1 Tutorial Guidance Banner across the street stall counter
    this.buildDay1GuidanceBanner();
  }

  private buildDay1GuidanceBanner(): void {
    const { width: W, isDesktop } = getLogicalDimensions();
    const bannerX = isDesktop ? 332 : W / 2;
    const bannerY = isDesktop ? 114 : 93;
    const bannerW = isDesktop ? 340 : 380;
    const bannerH = isDesktop ? 30 : 22;

    this.tutorialHintContainer = this.add.container(bannerX, bannerY);

    const bg = this.add.graphics();
    bg.fillStyle(0x1a120b, 0.94);
    bg.fillRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 6);
    bg.lineStyle(1, TASTE_THEME.colors.accentAmber, 0.7);
    bg.strokeRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 6);

    this.tutorialHintText = this.add
      .text(0, 0, '', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: isDesktop ? '11px' : '9.5px',
        fontStyle: '700',
        color: TASTE_THEME.colors.inkGold,
        align: 'center',
      })
      .setOrigin(0.5);

    const hit = this.add
      .rectangle(0, 0, bannerW, bannerH, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      this.openModal('tutorial');
    });

    this.tutorialHintContainer.add([bg, this.tutorialHintText, hit]);
    this.refreshDay1GuidanceHint();
  }

  public refreshDay1GuidanceHint(): void {
    if (!this.tutorialHintContainer || !this.tutorialHintText) return;

    if (this.gs.state.day > 1) {
      this.tutorialHintContainer.setVisible(false);
      return;
    }

    if (!this.isDesktop && this.daySystem.phase === 'selling') {
      // On mobile selling phase, keep the top utility bar clear for Revenue and Veggie widgets
      this.tutorialHintContainer.setVisible(false);
      return;
    }

    this.tutorialHintContainer.setVisible(true);

    if (this.daySystem.phase === 'prep') {
      this.tutorialHintText.setText('💡 Ngày 1: Nhập hàng, kiểm tra Gas rồi nhấn [MỞ BÁN NGAY]!');
      return;
    }

    // In Selling Phase
    const hasReadyFood = this.cookingSystem.slots.some((s) => s.status === 'ready');
    if (hasReadyFood) {
      this.tutorialHintText.setText('🔥 Cá viên đã chín vàng! Chạm chảo hoặc bấm [Space] để vớt ngay!');
      return;
    }

    let canServeAny = false;
    for (let i = 0; i < 4; i++) {
      if (this.customerSystem.activeCustomers[i] && this.customerSystem.canFulfillCustomer(i).canServe) {
        canServeAny = true;
        break;
      }
    }
    if (canServeAny) {
      this.tutorialHintText.setText('🛎️ Đã đủ món chín! Chạm vào khách hoặc bấm [Space] để giao hàng!');
      return;
    }

    const hasActiveCust = this.customerSystem.activeCustomers.some((c) => c !== null);
    if (hasActiveCust) {
      this.tutorialHintText.setText('🍳 Khách đang đợi! Chạm vào khay món tủ kính (phím 1..6) để chiên!');
      return;
    }

    this.tutorialHintText.setText('💡 Mẹo Ngày 1: Bạn có thể chiên sẵn 2-3 phần cá viên trước!');
  }

  private buildTwelveTraysGrid(): void {
    const cols = 3;
    if (this.isDesktop) {
      // Desktop Right Showcase (`x: 718..1260`, width `542`, upper grid `y: 134..486`)
      const trayW = 162;
      const trayH = 82;
      const gapX = 12;
      const gapY = 8;

      const totalGridW = cols * trayW + (cols - 1) * gapX; // 510px
      const panelCenterX = 718 + 542 / 2; // 989
      const startX = panelCenterX - totalGridW / 2 + trayW / 2;
      const startY = 175;

      INITIAL_FOODS.forEach((foodDef, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = startX + col * (trayW + gapX);
        const y = startY + row * (trayH + gapY);

        const tray = new FoodTray(this, x, y, trayW, trayH, foodDef, (clickedFood) => {
          this.onFoodTrayTapped(clickedFood);
        });
        this.add.existing(tray);
        this.trays.set(foodDef.id, tray);
      });
    } else {
      // Mobile Portrait 3x4 Grid (`x: 12..408`, width `396`, `y: 239..486`)
      const trayW = 120;
      const trayH = 58;
      const gapX = 7;
      const gapY = 5;

      const totalGridW = cols * trayW + (cols - 1) * gapX; // 374px
      const { width: screenW } = getLogicalDimensions();
      const startX = (screenW - totalGridW) / 2 + trayW / 2;
      const startY = 268;

      INITIAL_FOODS.forEach((foodDef, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = startX + col * (trayW + gapX);
        const y = startY + row * (trayH + gapY);

        const tray = new FoodTray(this, x, y, trayW, trayH, foodDef, (clickedFood) => {
          this.onFoodTrayTapped(clickedFood);
        });
        this.add.existing(tray);
        this.trays.set(foodDef.id, tray);
      });
    }
  }

  private buildCondimentStation(): void {
    if (this.isDesktop) {
      // Desktop Serving Condiment Station (`x: 718..1260, y: 494..636`, width 542, height 142)
      const stationX = 718;
      const stationY = 494;
      const stationW = 542;
      const stationH = 142;

      const stationCon = this.add.container(stationX, stationY);

      // Warm wooden tray background
      const sBg = this.add.graphics();
      sBg.fillStyle(0x181411, 0.96);
      sBg.fillRoundedRect(0, 0, stationW, stationH, { tl: 0, tr: 0, bl: 14, br: 14 });
      sBg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
      sBg.strokeRoundedRect(0, 0, stationW, stationH, { tl: 0, tr: 0, bl: 14, br: 14 });

      // Subtle vertical divider between Veggies and Sauces
      sBg.lineStyle(1, 0x3d3126, 0.8);
      sBg.lineBetween(271, 10, 271, stationH - 12);
      stationCon.add(sBg);

      // === LEFT BAY: KHAY RAU ĂN KÈM ===
      const vHeader = this.add.text(14, 10, '🥗 KHAY RAU ĂN KÈM', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '11px',
        fontStyle: '800',
        color: '#4ade80',
      });
      this.veggieStockText = this.add.text(14, 26, `Kho: ${this.gs.state.veggieStock}/40 phần`, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '10px',
        fontStyle: '700',
        color: this.gs.state.veggieStock <= 3 ? '#ef4444' : '#a7f3d0',
      });

      // Button: + Nhập rau (15k)
      const restockBtnBg = this.add.graphics();
      restockBtnBg.fillStyle(0x0f766e, 1);
      restockBtnBg.fillRoundedRect(172, 8, 88, 22, 5);
      const restockBtnLbl = this.add
        .text(216, 19, '+ Nhập 15k', {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: '9.5px',
          fontStyle: '800',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      const restockHit = this.add
        .rectangle(216, 19, 88, 24, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      restockHit.on('pointerdown', (e: Phaser.Input.Pointer) => {
        e.event.stopPropagation();
        this.triggerRestockVeggie();
      });
      stationCon.add([vHeader, this.veggieStockText, restockBtnBg, restockBtnLbl, restockHit]);

      // 3 Veggie Plates
      const veggies: Array<{ type: VeggieType; key: string; name: string; keyHint: string }> = [
        { type: 'dua_leo', key: 'veggie_dua_leo', name: 'Dưa leo', keyHint: '[Z]' },
        { type: 'dau_bap', key: 'veggie_dau_bap', name: 'Đậu bắp', keyHint: '[X]' },
        { type: 'xa_lach', key: 'veggie_xa_lach', name: 'Xà lách', keyHint: '[C]' },
      ];

      veggies.forEach((v, idx) => {
        const itemX = 14 + idx * 84;
        const itemY = 48;
        const itemW = 76;
        const itemH = 82;

        const card = this.add.container(itemX, itemY);
        const cBg = this.add.graphics();
        cBg.fillStyle(0x27211b, 0.95);
        cBg.fillRoundedRect(0, 0, itemW, itemH, 8);
        cBg.lineStyle(1, 0x443627, 1);
        cBg.strokeRoundedRect(0, 0, itemW, itemH, 8);
        card.add(cBg);

        if (this.textures.exists(v.key)) {
          const img = this.add.image(itemW / 2, 34, v.key);
          const maxDim = Math.max(img.width, img.height);
          img.setScale(Math.min(50 / maxDim, 0.45));
          card.add(img);
        }

        const lbl = this.add
          .text(itemW / 2, 68, `${v.name} ${v.keyHint}`, {
            fontFamily: TASTE_THEME.fonts.sans,
            fontSize: '9.5px',
            fontStyle: '800',
            color: '#fef08a',
          })
          .setOrigin(0.5);
        card.add(lbl);

        const hit = this.add
          .rectangle(itemW / 2, itemH / 2, itemW, itemH, 0xffffff, 0)
          .setInteractive({ useHandCursor: true });

        hit.on('pointerdown', () => {
          this.tweens.add({
            targets: card,
            scale: 0.94,
            duration: 60,
            yoyo: true,
            onComplete: () => this.onVeggieTapped(v.type),
          });
        });

        hit.on('pointerover', () => {
          cBg.lineStyle(1.5, 0x4ade80, 1);
          cBg.strokeRoundedRect(0, 0, itemW, itemH, 8);
        });
        hit.on('pointerout', () => {
          cBg.lineStyle(1, 0x443627, 1);
          cBg.strokeRoundedRect(0, 0, itemW, itemH, 8);
        });

        card.add(hit);
        stationCon.add(card);
      });

      // === RIGHT BAY: QUẦY NƯỚC CHẤM GIA TRUYỀN ===
      const sHeader = this.add.text(285, 10, '🥢 NƯỚC CHẤM GIA TRUYỀN', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '11px',
        fontStyle: '800',
        color: '#fca311',
      });
      const sSub = this.add
        .text(stationW - 14, 11, 'Vô hạn • +2k/đĩa', {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: '9px',
          fontStyle: '700',
          color: '#94a3b8',
        })
        .setOrigin(1, 0);
      stationCon.add([sHeader, sSub]);

      // 3 Sauces
      const sauces: Array<{ type: SauceType; key: string; name: string; keyHint: string; color: number }> = [
        { type: 'tuong_ot', key: 'sauce_tuong_ot', name: 'Tương Ớt', keyHint: '[V]', color: 0xef4444 },
        { type: 'tuong_den', key: 'sauce_tuong_den', name: 'Tương Đen', keyHint: '[B]', color: 0xa855f7 },
        { type: 'tuong_xi_muoi', key: 'sauce_tuong_xi_muoi', name: 'Xí Muội', keyHint: '[N]', color: 0xf59e0b },
      ];

      sauces.forEach((s, idx) => {
        const itemX = 285 + idx * 82;
        const itemY = 36;
        const itemW = 76;
        const itemH = 94;

        const card = this.add.container(itemX, itemY);
        const cBg = this.add.graphics();
        cBg.fillStyle(0x27211b, 0.95);
        cBg.fillRoundedRect(0, 0, itemW, itemH, 8);
        cBg.lineStyle(1, 0x443627, 1);
        cBg.strokeRoundedRect(0, 0, itemW, itemH, 8);
        card.add(cBg);

        let bottleImg: Phaser.GameObjects.Image | null = null;
        if (this.textures.exists(s.key)) {
          bottleImg = this.add.image(itemW / 2, 40, s.key);
          const maxDim = Math.max(bottleImg.width, bottleImg.height);
          bottleImg.setScale(Math.min(54 / maxDim, 0.42));
          card.add(bottleImg);
        }

        const lbl = this.add
          .text(itemW / 2, 80, `${s.name} ${s.keyHint}`, {
            fontFamily: TASTE_THEME.fonts.sans,
            fontSize: '9.5px',
            fontStyle: '800',
            color: '#fef08a',
          })
          .setOrigin(0.5);
        card.add(lbl);

        const hit = this.add
          .rectangle(itemW / 2, itemH / 2, itemW, itemH, 0xffffff, 0)
          .setInteractive({ useHandCursor: true });

        hit.on('pointerdown', () => {
          if (bottleImg) {
            this.tweens.add({
              targets: bottleImg,
              angle: 15,
              scaleY: bottleImg.scaleY * 0.88,
              duration: 80,
              yoyo: true,
              onComplete: () => {
                bottleImg!.setAngle(0);
              },
            });
          }
          this.tweens.add({
            targets: card,
            scale: 0.94,
            duration: 60,
            yoyo: true,
            onComplete: () => this.onSauceTapped(s.type),
          });
        });

        hit.on('pointerover', () => {
          cBg.lineStyle(1.5, s.color, 1);
          cBg.strokeRoundedRect(0, 0, itemW, itemH, 8);
        });
        hit.on('pointerout', () => {
          cBg.lineStyle(1, 0x443627, 1);
          cBg.strokeRoundedRect(0, 0, itemW, itemH, 8);
        });

        card.add(hit);
        stationCon.add(card);
      });

      this.add.existing(stationCon);
    } else {
      // Mobile Portrait Condiment Station (`x: 12..408, y: 492..546`, width 396, height 54)
      const { width: screenW } = getLogicalDimensions();
      const gut = 12;
      const cardW = screenW - gut * 2;
      const mCon = this.add.container(gut, 492);

      const mBg = this.add.graphics();
      mBg.fillStyle(0x181411, 0.96);
      mBg.fillRoundedRect(0, 0, cardW, 54, 8);
      mBg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
      mBg.strokeRoundedRect(0, 0, cardW, 54, 8);
      mCon.add(mBg);

      // 3 Veggie mini buttons + 3 Sauce mini buttons
      const miniButtons: Array<{ label: string; action: () => void; color: number }> = [
        { label: '🥒 Dưa', action: () => this.onVeggieTapped('dua_leo'), color: 0x22c55e },
        { label: '🫑 Bắp', action: () => this.onVeggieTapped('dau_bap'), color: 0x22c55e },
        { label: '🥗 Lách', action: () => this.onVeggieTapped('xa_lach'), color: 0x22c55e },
        { label: '🌶️ Ớt', action: () => this.onSauceTapped('tuong_ot'), color: 0xef4444 },
        { label: '🥢 Đen', action: () => this.onSauceTapped('tuong_den'), color: 0xa855f7 },
        { label: '🍑 XíM', action: () => this.onSauceTapped('tuong_xi_muoi'), color: 0xf59e0b },
      ];

      const btnW = Math.floor((cardW - 14) / 6);
      miniButtons.forEach((b, i) => {
        const bx = 6 + i * btnW;
        const bBg = this.add.graphics();
        bBg.fillStyle(0x27211b, 1);
        bBg.fillRoundedRect(bx, 6, btnW - 4, 42, 6);
        bBg.lineStyle(1, b.color, 0.8);
        bBg.strokeRoundedRect(bx, 6, btnW - 4, 42, 6);
        mCon.add(bBg);

        const bTxt = this.add
          .text(bx + (btnW - 4) / 2, 27, b.label, {
            fontFamily: TASTE_THEME.fonts.sans,
            fontSize: '10px',
            fontStyle: '800',
            color: '#ffffff',
          })
          .setOrigin(0.5);
        mCon.add(bTxt);

        const bHit = this.add
          .rectangle(bx + (btnW - 4) / 2, 27, btnW - 4, 42, 0xffffff, 0)
          .setInteractive({ useHandCursor: true });
        bHit.on('pointerdown', () => b.action());
        mCon.add(bHit);
      });

      this.add.existing(mCon);
    }
  }

  private buildCookingStation(): void {
    if (this.isDesktop) {
      // Left Top: Registered Gas Tank Widget (`x: 88, y: 430`)
      const gasCon = this.add.container(88, 430);
      const gasPanel = this.add.graphics();
      gasPanel.fillStyle(TASTE_THEME.colors.bgSurface, 1);
      gasPanel.fillRoundedRect(-50, -58, 100, 116, 8);
      gasPanel.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
      gasPanel.strokeRoundedRect(-50, -58, 100, 116, 8);
      gasCon.add(gasPanel);

      if (this.textures.exists('equip_gas_tank')) {
        const gasImg = this.add.image(0, -22, 'equip_gas_tank').setScale(0.32);
        gasCon.add(gasImg);
      }

      this.gasFillBar = this.add.graphics();
      gasCon.add(this.gasFillBar);

      this.gasPercentText = this.add
        .text(0, 14, 'Gas: 100%', {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: '11px',
          fontStyle: '800',
          color: TASTE_THEME.colors.inkOnDark,
        })
        .setOrigin(0.5);
      gasCon.add(this.gasPercentText);

      const refillBtnBg = this.add.graphics();
      refillBtnBg.fillStyle(TASTE_THEME.colors.accentAmber, 1);
      refillBtnBg.fillRoundedRect(-42, 28, 84, 22, 5);
      this.gasRefillBtnLbl = this.add
        .text(0, 39, '+ BƠM GAS [G]', {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: '9.5px',
          fontStyle: '800',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      gasCon.add([refillBtnBg, this.gasRefillBtnLbl]);

      const gasHit = this.add
        .rectangle(0, 0, 100, 116, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      gasHit.on('pointerdown', () => this.triggerRefillGas());
      gasCon.add(gasHit);

      // Left Bottom: Cooking Oil Widget (`x: 88, y: 556`)
      const oilCon = this.add.container(88, 556);
      const oilPanel = this.add.graphics();
      oilPanel.fillStyle(TASTE_THEME.colors.bgSurface, 1);
      oilPanel.fillRoundedRect(-50, -58, 100, 116, 8);
      oilPanel.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
      oilPanel.strokeRoundedRect(-50, -58, 100, 116, 8);
      oilCon.add(oilPanel);

      const oilTitle = this.add
        .text(0, -38, '🛢️ CHẢO DẦU', {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: '10px',
          fontStyle: '800',
          color: TASTE_THEME.colors.inkGold,
        })
        .setOrigin(0.5);
      oilCon.add(oilTitle);

      this.oilFillBar = this.add.graphics();
      oilCon.add(this.oilFillBar);

      this.oilPercentText = this.add
        .text(0, 14, 'Dầu: 100%', {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: '10.5px',
          fontStyle: '800',
          color: TASTE_THEME.colors.inkOnDark,
        })
        .setOrigin(0.5);
      oilCon.add(this.oilPercentText);

      const changeOilBtnBg = this.add.graphics();
      changeOilBtnBg.fillStyle(0xd97706, 1);
      changeOilBtnBg.fillRoundedRect(-42, 28, 84, 22, 5);
      this.oilChangeBtnLbl = this.add
        .text(0, 39, 'THAY DẦU [O]', {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: '9.5px',
          fontStyle: '800',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      oilCon.add([changeOilBtnBg, this.oilChangeBtnLbl]);

      const oilHit = this.add
        .rectangle(0, 0, 100, 116, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      oilHit.on('pointerdown', () => this.triggerChangeOil());
      oilCon.add(oilHit);

      this.refreshGasUI();
      this.refreshOilUI();

      // Center: 2x2 Grid of Fryer Baskets (`x: 152..526, y: 370..618`)
      const slotW = 176;
      const slotH = 116;
      const slotStartX = 242;
      const slotStartY = 430;

      for (let i = 0; i < 4; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const sx = slotStartX + col * (slotW + 14);
        const sy = slotStartY + row * (slotH + 16);

        const slotCon = this.add.container(sx, sy);
        const bg = this.add.graphics();
        const bubbleEmitter = this.add.graphics();
        const foodIcon = this.add
          .image(-48, 0, 'food_ca_vien_truyen_thong')
          .setScale(0.24)
          .setVisible(false);
        const statusText = this.add
          .text(16, -12, '', {
            fontFamily: TASTE_THEME.fonts.sans,
            fontSize: '12.5px',
            fontStyle: '700',
            color: TASTE_THEME.colors.inkOnDark,
            align: 'center',
            lineSpacing: 3,
          })
          .setOrigin(0.5);
        const progressFill = this.add.graphics();

        const hit = this.add
          .rectangle(0, 0, slotW, slotH, 0xffffff, 0)
          .setInteractive({ useHandCursor: true });

        hit.on('pointerover', () => {
          this.tweens.add({
            targets: slotCon,
            y: sy - 2,
            duration: TASTE_THEME.motion.fast,
            ease: TASTE_THEME.motion.easeOut,
          });
        });
        hit.on('pointerout', () => {
          this.tweens.add({
            targets: slotCon,
            y: sy,
            duration: TASTE_THEME.motion.fast,
            ease: TASTE_THEME.motion.easeOut,
          });
        });
        hit.on('pointerdown', () => this.onFryerSlotTapped(i));

        slotCon.add([bg, bubbleEmitter, foodIcon, statusText, progressFill, hit]);
        this.fryerUIs.push({
          container: slotCon,
          bg,
          foodIcon,
          statusText,
          progressFill,
          bubbleEmitter,
          slotW,
          slotH,
          baseY: sy,
        });
        this.refreshFryerSlotUI(i);
      }

      // Right of Kitchen Panel: 2 Quick Action Cards aligned to the right edge of the left column
      this.primaryQuickBtnTxt = this.createStationQuickButton(
        612,
        430,
        146,
        116,
        '🌅 MỞ BÁN NGAY\n[Phím Space]',
        TASTE_THEME.colors.success,
        () => this.onPrimaryQuickAction()
      );

      this.secondaryQuickBtnTxt = this.createStationQuickButton(
        612,
        562,
        146,
        116,
        '📦 NHẬP ĐẦY KHO\n[Phím R]',
        TASTE_THEME.colors.accentPrimary,
        () => this.onSecondaryQuickAction()
      );
    } else {
      // Mobile Cooking Station (`x: 12..408, y: 552..714`)
      this.add.text(22, 557, '🔥 BẾP CHIÊN & NHIÊN LIỆU', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '10.5px',
        fontStyle: '800',
        color: TASTE_THEME.colors.inkGold,
      });

      // Gas Tank Mini Box (`x: 52, y: 606`)
      const gasCon = this.add.container(52, 606);
      const gasPanel = this.add.graphics();
      gasPanel.fillStyle(TASTE_THEME.colors.bgSurface, 1);
      gasPanel.fillRoundedRect(-32, -26, 64, 52, 6);
      gasPanel.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
      gasPanel.strokeRoundedRect(-32, -26, 64, 52, 6);
      gasCon.add(gasPanel);

      this.gasFillBar = this.add.graphics();
      gasCon.add(this.gasFillBar);

      this.gasPercentText = this.add
        .text(0, -6, 'Gas: 100%', {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: '9px',
          fontStyle: '800',
          color: TASTE_THEME.colors.inkOnDark,
        })
        .setOrigin(0.5);
      gasCon.add(this.gasPercentText);

      this.gasRefillBtnLbl = this.add
        .text(0, 13, '+ GAS', {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: '8.5px',
          fontStyle: '800',
          color: '#ffffff',
          backgroundColor: '#d97706',
          padding: { left: 4, right: 4, top: 1, bottom: 1 },
        })
        .setOrigin(0.5);
      gasCon.add(this.gasRefillBtnLbl);

      const gasHit = this.add
        .rectangle(0, 0, 64, 52, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      gasHit.on('pointerdown', () => this.triggerRefillGas());
      gasCon.add(gasHit);

      // Cooking Oil Mini Box (`x: 52, y: 666`)
      const oilCon = this.add.container(52, 666);
      const oilPanel = this.add.graphics();
      oilPanel.fillStyle(TASTE_THEME.colors.bgSurface, 1);
      oilPanel.fillRoundedRect(-32, -26, 64, 52, 6);
      oilPanel.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
      oilPanel.strokeRoundedRect(-32, -26, 64, 52, 6);
      oilCon.add(oilPanel);

      this.oilFillBar = this.add.graphics();
      oilCon.add(this.oilFillBar);

      this.oilPercentText = this.add
        .text(0, -6, 'Dầu: 100%', {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: '9px',
          fontStyle: '800',
          color: TASTE_THEME.colors.inkOnDark,
        })
        .setOrigin(0.5);
      oilCon.add(this.oilPercentText);

      this.oilChangeBtnLbl = this.add
        .text(0, 13, 'THAY DẦU', {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: '8.5px',
          fontStyle: '800',
          color: '#ffffff',
          backgroundColor: '#b45309',
          padding: { left: 4, right: 4, top: 1, bottom: 1 },
        })
        .setOrigin(0.5);
      oilCon.add(this.oilChangeBtnLbl);

      const oilHit = this.add
        .rectangle(0, 0, 64, 52, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      oilHit.on('pointerdown', () => this.triggerChangeOil());
      oilCon.add(oilHit);

      this.refreshGasUI();
      this.refreshOilUI();

      const slotW = 106;
      const slotH = 56;
      const slotStartX = 144;
      const slotStartY = 609;

      for (let i = 0; i < 4; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const sx = slotStartX + col * (slotW + 6);
        const sy = slotStartY + row * (slotH + 8);

        const slotCon = this.add.container(sx, sy);
        const bg = this.add.graphics();
        const bubbleEmitter = this.add.graphics();
        const foodIcon = this.add
          .image(-30, 0, 'food_ca_vien_truyen_thong')
          .setScale(0.15)
          .setVisible(false);
        const statusText = this.add
          .text(10, -7, '', {
            fontFamily: TASTE_THEME.fonts.sans,
            fontSize: '9.5px',
            fontStyle: '700',
            color: TASTE_THEME.colors.inkOnDark,
            align: 'center',
          })
          .setOrigin(0.5);
        const progressFill = this.add.graphics();

        const hit = this.add
          .rectangle(0, 0, slotW, slotH, 0xffffff, 0)
          .setInteractive({ useHandCursor: true });

        hit.on('pointerdown', () => this.onFryerSlotTapped(i));

        slotCon.add([bg, bubbleEmitter, foodIcon, statusText, progressFill, hit]);
        this.fryerUIs.push({
          container: slotCon,
          bg,
          foodIcon,
          statusText,
          progressFill,
          bubbleEmitter,
          slotW,
          slotH,
          baseY: sy,
        });
        this.refreshFryerSlotUI(i);
      }

      this.primaryQuickBtnTxt = this.createStationQuickButton(
        358,
        609,
        84,
        56,
        '🌅 MỞ BÁN\nNGAY',
        TASTE_THEME.colors.success,
        () => this.onPrimaryQuickAction()
      );

      this.secondaryQuickBtnTxt = this.createStationQuickButton(
        358,
        673,
        84,
        56,
        '📦 NHẬP ĐẦY\nKHO',
        TASTE_THEME.colors.accentPrimary,
        () => this.onSecondaryQuickAction()
      );
    }
  }

  public enterPrepForDay(advanceDay = false): void {
    this.endDayPending = false;
    this.cookingSystem.resetAllSlots();
    this.customerSystem.resetAll();
    this.customerViews.forEach((v) => v.destroy());
    this.customerViews.clear();

    if (advanceDay) {
      // Hủy sạch toàn bộ đồ chiên tồn khay qua ngày vì không bán đồ cũ qua đêm
      const wasted = this.gs.clearDayOldCookedStock();
      if (wasted.count > 0) {
        this.showToast(
          `🗑️ Đã bỏ ${wasted.count} xiên đồ chiên cũ qua đêm (-${this.gs.formatCurrency(wasted.cost)})`,
          TASTE_THEME.colors.accentAmber
        );
      }
      this.daySystem.advanceToNextDay();
    } else {
      this.daySystem.enterPrepPhase(false);
    }

    const assisted = this.gs.ensureMinimumPrepCapital();
    this.refreshActionButtonsForPhase();
    this.refreshGasUI();
    this.refreshOilUI();
    this.refreshVeggieUI();
    this.refreshAllTraysAndCustomers();
    this.refreshDay1GuidanceHint();
    for (let i = 0; i < 4; i++) {
      this.refreshFryerSlotUI(i);
    }

    // If first-time playing Day 1, guide player with step-by-step tutorial first
    if (this.gs.state.day === 1 && !this.gs.state.tutorialSeen) {
      this.openModal('tutorial');
    } else {
      // Automatically open Pre-Day Inventory/Restock screen ("Trước ngày mở bán là lúc nhập hàng")
      this.openModal('inventory');
    }

    if (assisted) {
      this.showToast(
        '💡 Quán được hỗ trợ nguyên liệu & Gas khởi nghiệp đầu ngày!',
        TASTE_THEME.colors.infoTeal
      );
    }
  }

  public startSellingDayFromPrep(): boolean {
    if (this.daySystem.phase === 'selling') return true;

    if (!this.gs.hasEnoughGasToCook()) {
      SoundManager.playError();
      this.showToast(
        '⛽ Bình Gas đã cạn! Hãy bơm đầy Gas trước giờ mở bán!',
        TASTE_THEME.colors.danger
      );
      this.openModal('inventory');
      return false;
    }

    if (!this.gs.hasCookableRawStock()) {
      SoundManager.playError();
      this.showToast(
        '📦 Kho nguyên liệu đang trống! Hãy nhập hàng trước giờ mở bán!',
        TASTE_THEME.colors.danger
      );
      this.openModal('inventory');
      return false;
    }

    if (this.scene.isActive('ModalScene')) {
      this.scene.stop('ModalScene');
    }

    this.endDayPending = false;
    this.daySystem.startSellingDay();
    this.refreshActionButtonsForPhase();
    this.refreshGasUI();
    this.refreshOilUI();
    this.refreshVeggieUI();
    this.refreshAllTraysAndCustomers();
    this.refreshDay1GuidanceHint();

    SoundManager.playCash();
    this.player.playCheer(`Mở bán Ngày ${this.gs.state.day}!`);
    this.showToast(
      `🌅 Đã mở bán Ngày ${this.gs.state.day}! (Tối đa 6 phút • Kết thúc khi hết Gas hoặc hết Kho)`,
      TASTE_THEME.colors.success
    );

    this.time.delayedCall(400, () => {
      if (this.daySystem.phase === 'selling' && this.daySystem.isRunning) {
        this.customerSystem.trySpawnCustomer();
      }
    });
    return true;
  }

  private refreshActionButtonsForPhase(): void {
    const isPrep = this.daySystem.phase === 'prep';
    if (this.primaryQuickBtnTxt) {
      this.primaryQuickBtnTxt.setText(
        this.isDesktop
          ? isPrep
            ? '🌅 MỞ BÁN NGAY\n[Phím Space]'
            : '🛎️ PHỤC VỤ NGAY\n[Phím Space]'
          : isPrep
            ? '🌅 MỞ BÁN\nNGAY'
            : '🛎️ PHỤC VỤ\nNGAY'
      );
    }
    if (this.secondaryQuickBtnTxt) {
      this.secondaryQuickBtnTxt.setText(
        this.isDesktop
          ? isPrep
            ? '📦 NHẬP ĐẦY KHO\n[Phím R]'
            : '📊 TỔNG KẾT\n& NGHỈ SỚM'
          : isPrep
            ? '📦 NHẬP ĐẦY\nKHO'
            : '📊 BÁO CÁO\nNGÀY'
      );
    }
    if (this.gasRefillBtnLbl) {
      this.gasRefillBtnLbl.setText(
        this.isDesktop
          ? isPrep
            ? '+ ĐỔI GAS [G]'
            : '🔒 CHỜ MỞ BÁN'
          : isPrep
            ? '+ ĐỔI GAS'
            : '🔒 ĐANG BÁN'
      );
    }
  }

  private onPrimaryQuickAction(): void {
    if (this.daySystem.phase === 'prep') {
      this.startSellingDayFromPrep();
    } else {
      this.serveFirstReadyCustomer();
    }
  }

  private onSecondaryQuickAction(): void {
    if (this.daySystem.phase === 'prep') {
      this.triggerRestockAll();
    } else {
      this.openModal('daily_result');
    }
  }

  private triggerRefillGas(): void {
    if (this.daySystem.phase !== 'prep') {
      SoundManager.playError();
      this.showToast(
        '🔒 Đang mở bán! Chỉ được đổi bình Gas trước giờ mở bán!',
        TASTE_THEME.colors.accentAmber
      );
      return;
    }

    const res = this.gs.refillGas();
    if (!res.ok && res.reason) {
      this.showToast(res.reason, TASTE_THEME.colors.danger);
    } else if (res.ok && res.cost) {
      this.showToast(
        `⛽ Đã đổi bình Gas mới đầy ắp (-${this.gs.formatCurrency(res.cost)})!`,
        TASTE_THEME.colors.success
      );
      this.refreshGasUI();
    }
  }

  private triggerRestockAll(): void {
    if (this.daySystem.phase !== 'prep') {
      SoundManager.playError();
      this.showToast(
        '🔒 Đang mở bán! Chỉ được nhập hàng vào Kho trước giờ mở bán!',
        TASTE_THEME.colors.accentAmber
      );
      return;
    }

    const res = this.inventorySystem.restockAllLowFoods();
    if (res.restockedCount > 0) {
      SoundManager.playCash();
      this.showToast(
        `Đã nhập thêm ${res.restockedCount} lô hàng (-${this.gs.formatCurrency(res.totalSpent)})`,
        TASTE_THEME.colors.success
      );
    } else {
      SoundManager.playPop();
      this.showToast(
        'Kho đông lạnh đã đầy hoặc chưa đủ tiền!',
        TASTE_THEME.colors.accentAmber
      );
    }
  }

  private setupKeyboardShortcuts(): void {
    if (!this.input.keyboard) return;

    this.input.keyboard.on('keydown-SPACE', () => {
      if (this.daySystem.isPaused) return;
      if (this.daySystem.phase === 'prep') {
        this.startSellingDayFromPrep();
        return;
      }
      const readySlot = this.cookingSystem.slots.find((s) => s.status === 'ready');
      if (readySlot) {
        this.onFryerSlotTapped(readySlot.index);
        return;
      }
      const burnedSlot = this.cookingSystem.slots.find((s) => s.status === 'burned');
      if (burnedSlot) {
        this.onFryerSlotTapped(burnedSlot.index);
        return;
      }
      this.serveFirstReadyCustomer();
    });

    this.input.keyboard.on('keydown-G', () => {
      if (!this.daySystem.isPaused) this.triggerRefillGas();
    });

    this.input.keyboard.on('keydown-R', () => {
      if (!this.daySystem.isPaused) this.triggerRestockAll();
    });

    this.input.keyboard.on('keydown-O', () => {
      if (!this.daySystem.isPaused) this.triggerChangeOil();
    });

    this.input.keyboard.on('keydown-V', () => {
      if (!this.daySystem.isPaused) this.triggerServeVeggieToCustomer();
    });
  }

  private createStationQuickButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    color: number,
    onClick: () => void
  ): Phaser.GameObjects.Text {
    const con = this.add.container(x, y);
    const bg = this.add.graphics();

    const drawBtn = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(color, hover ? 1 : 0.92);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      bg.lineStyle(1, 0xffffff, hover ? 0.65 : 0.3);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    };
    drawBtn(false);

    const txt = this.add
      .text(0, 0, label, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop ? '12.5px' : '9.5px',
        fontStyle: '800',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 4,
      })
      .setOrigin(0.5);

    const hit = this.add
      .rectangle(0, 0, w, h, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });

    const baseY = y;
    hit.on('pointerover', () => {
      drawBtn(true);
      this.tweens.add({
        targets: con,
        y: baseY - 2,
        duration: TASTE_THEME.motion.fast,
        ease: TASTE_THEME.motion.easeOut,
      });
    });
    hit.on('pointerout', () => {
      drawBtn(false);
      this.tweens.add({
        targets: con,
        y: baseY,
        scale: 1,
        duration: TASTE_THEME.motion.fast,
        ease: TASTE_THEME.motion.easeOut,
      });
    });
    hit.on('pointerdown', () => {
      this.tweens.add({
        targets: con,
        y: baseY + 1,
        scale: 0.98,
        duration: 75,
        yoyo: true,
        ease: TASTE_THEME.motion.easeOut,
        onComplete: onClick,
      });
    });

    con.add([bg, txt, hit]);
    return txt;
  }

  /**
   * Bottom Navigation Bar (`taste-skill` One System Rule & No-Purple Rule):
   * - Unified dark surface tabs with 1px hairline border and semantic indicator dots.
   * - Left edge of first tab = `gut` (`20px` desktop, `12px` mobile).
   * - Right edge of last tab = `W - gut` (`1260px` desktop, `408px` mobile).
   */
  private buildBottomNavBar(): void {
    const { width: W, height: H } = getLogicalDimensions();
    const navH = this.isDesktop
      ? TASTE_THEME.layout.desktop.bottomBarHeight
      : TASTE_THEME.layout.mobile.bottomBarHeight;
    const navY = H - navH;
    const gut = this.isDesktop
      ? TASTE_THEME.layout.desktop.gutter
      : TASTE_THEME.layout.mobile.gutter;

    const bg = this.add.graphics();
    bg.fillStyle(TASTE_THEME.colors.bgElevated, 0.98);
    bg.fillRect(0, navY, W, navH);
    bg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
    bg.lineBetween(0, navY, W, navY);

    const tabs: Array<{ id: ModalTab; icon: string; label: string; mobileLabel: string; dotColor: number }> = [
      { id: 'shop', icon: '🏪', label: 'Thực Đơn Món', mobileLabel: 'Thực Đơn', dotColor: TASTE_THEME.colors.accentPrimary },
      { id: 'upgrade', icon: '⚡', label: 'Nâng Cấp Quán', mobileLabel: 'Nâng Cấp', dotColor: TASTE_THEME.colors.accentAmber },
      { id: 'mission', icon: '📜', label: 'Nhiệm Vụ Ngày', mobileLabel: 'Nhiệm Vụ', dotColor: TASTE_THEME.colors.successLight },
      { id: 'inventory', icon: '❄️', label: 'Kho Nguyên Liệu', mobileLabel: 'Kho Hàng', dotColor: TASTE_THEME.colors.infoTeal },
      { id: 'achievement', icon: '🏆', label: 'Thành Tựu', mobileLabel: 'Thành Tựu', dotColor: TASTE_THEME.colors.accentGold },
    ];

    const gap = this.isDesktop ? 14 : 6;
    const availW = W - gut * 2;
    const btnW = (availW - gap * (tabs.length - 1)) / tabs.length;
    const btnH = this.isDesktop ? 44 : 44;
    const startX = gut + btnW / 2;

    tabs.forEach((tab, idx) => {
      const bx = startX + idx * (btnW + gap);
      const by = navY + navH / 2;
      const con = this.add.container(bx, by);

      const g = this.add.graphics();
      const renderTab = (hover: boolean) => {
        g.clear();
        g.fillStyle(hover ? 0x382a20 : TASTE_THEME.colors.bgSurface, 1);
        g.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 9);
        g.lineStyle(
          1,
          hover ? tab.dotColor : TASTE_THEME.colors.borderHairlineDark,
          1
        );
        g.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 9);
        // Subtle bottom accent indicator bar
        g.fillStyle(tab.dotColor, hover ? 1 : 0.75);
        g.fillRoundedRect(-18, btnH / 2 - 3, 36, 2.5, 1);
      };
      renderTab(false);

      if (this.isDesktop) {
        const lbl = this.add
          .text(0, -1, `${tab.icon}  ${tab.label}`, {
            fontFamily: TASTE_THEME.fonts.sans,
            fontSize: '13.5px',
            fontStyle: '700',
            color: TASTE_THEME.colors.inkOnDark,
          })
          .setOrigin(0.5);
        con.add([g, lbl]);
      } else {
        const ic = this.add.text(0, -8, tab.icon, { fontSize: '15px' }).setOrigin(0.5);
        const shortLbl = tab.mobileLabel;
        const lbl = this.add
          .text(0, 10, shortLbl, {
            fontFamily: TASTE_THEME.fonts.sans,
            fontSize: '10px',
            fontStyle: '700',
            color: TASTE_THEME.colors.inkOnDark,
          })
          .setOrigin(0.5);
        con.add([g, ic, lbl]);
      }

      const hit = this.add
        .rectangle(0, 0, btnW, btnH, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });

      hit.on('pointerover', () => {
        renderTab(true);
        this.tweens.add({
          targets: con,
          y: by - 1,
          duration: TASTE_THEME.motion.fast,
          ease: TASTE_THEME.motion.easeOut,
        });
      });
      hit.on('pointerout', () => {
        renderTab(false);
        this.tweens.add({
          targets: con,
          y: by,
          scale: 1,
          duration: TASTE_THEME.motion.fast,
          ease: TASTE_THEME.motion.easeOut,
        });
      });
      hit.on('pointerdown', () => {
        SoundManager.playPop();
        this.tweens.add({
          targets: con,
          y: by + 1,
          scale: 0.98,
          duration: 75,
          yoyo: true,
          ease: TASTE_THEME.motion.easeOut,
          onComplete: () => this.openModal(tab.id),
        });
      });

      con.add(hit);
    });
  }

  private bindEvents(): void {
    this.daySystem.on('time-updated', (timeStr: string) => {
      this.hud.updateTime(timeStr);
    });

    this.daySystem.on('day-ended', () => {
      this.openModal('daily_result');
    });

    this.gs.on('state-changed', () => {
      this.refreshGasUI();
      this.refreshOilUI();
      this.refreshVeggieUI();
      this.todayRevenueText.setText(this.gs.formatCurrency(this.gs.dailyStats.revenue));
      this.refreshAllTraysAndCustomers();
    });

    this.gs.on('tray-updated', (foodId: string) => {
      const tray = this.trays.get(foodId);
      if (tray) tray.refresh();
      this.refreshCustomerOrderBadges();
    });

    this.gs.on('upgrade-changed', () => {
      for (let i = 0; i < 4; i++) {
        this.refreshFryerSlotUI(i);
      }
      this.refreshAllTraysAndCustomers();
    });

    this.gs.on('level-up', (newLevel: number) => {
      this.player.playCheer(`Lên Cấp ${newLevel}! +10💎`);
      this.showToast(
        `🎉 Chúc mừng lên Cấp ${newLevel}! Thưởng +10 Kim Cương!`,
        TASTE_THEME.colors.accentAmber
      );
    });

    this.cookingSystem.on('slot-updated', (slotIndex: number) => {
      this.refreshFryerSlotUI(slotIndex);
      this.syncTrayCookingFlags();
    });

    this.cookingSystem.on('slot-ready', (slotIndex: number, foodId: string) => {
      const def = this.gs.getFoodDef(foodId);
      this.showToast(
        `✨ ${def.shortName} đã chín vàng! Chạm rổ #${slotIndex + 1} hoặc [Space] để vớt trước khi cháy!`,
        TASTE_THEME.colors.success
      );
    });

    this.cookingSystem.on('slot-burned', (slotIndex: number, foodId: string) => {
      const def = this.gs.getFoodDef(foodId);
      this.gs.state.rating = Math.max(1.0, +(this.gs.state.rating - 0.05).toFixed(2));
      this.gs.emit('state-changed');
      this.showToast(
        `🔥 Ôi không! Mẻ ${def.shortName} ở rổ #${slotIndex + 1} đã bị cháy khét vì để quá lửa!`,
        TASTE_THEME.colors.danger
      );
    });

    this.customerSystem.on('customer-spawned', (cust: ActiveCustomer) => {
      this.spawnCustomerView(cust);
      this.refreshAllTraysAndCustomers();
    });

    this.customerSystem.on('customer-veggie-added', (cust: ActiveCustomer) => {
      const view = this.customerViews.get(cust.slotIndex);
      if (view) {
        view.refreshOrderState();
        this.tweens.add({
          targets: view,
          scale: this.isDesktop ? 1.09 : 1.05,
          duration: 120,
          yoyo: true,
        });
      }
    });

    this.customerSystem.on('customer-sauce-added', (cust: ActiveCustomer) => {
      const view = this.customerViews.get(cust.slotIndex);
      if (view) {
        view.refreshOrderState();
        this.tweens.add({
          targets: view,
          scale: this.isDesktop ? 1.09 : 1.05,
          duration: 120,
          yoyo: true,
        });
      }
    });

    this.customerSystem.on('customer-left-angry', (cust: ActiveCustomer) => {
      const view = this.customerViews.get(cust.slotIndex);
      if (view) {
        this.tweens.add({
          targets: view,
          alpha: 0,
          y: view.y - 20,
          duration: 220,
          onComplete: () => view.destroy(),
        });
        this.customerViews.delete(cust.slotIndex);
      }
      this.showToast(`😡 ${cust.archetype.name} bỏ đi vì đợi lâu!`, TASTE_THEME.colors.danger);
      this.refreshAllTraysAndCustomers();
    });

    this.customerSystem.on(
      'customer-served',
      (cust: ActiveCustomer, totalEarned: number, tipAmount: number) => {
        const view = this.customerViews.get(cust.slotIndex);
        if (view) {
          this.spawnFloatingReward(
            view.x,
            view.y - 30,
            `+${this.gs.formatCurrency(totalEarned)}`,
            tipAmount
          );
          this.tweens.add({
            targets: view,
            scale: 1.12,
            alpha: 0,
            duration: 220,
            onComplete: () => view.destroy(),
          });
          this.customerViews.delete(cust.slotIndex);
        }
        this.player.playCheer('Cảm ơn quý khách!');
        this.refreshAllTraysAndCustomers();
      }
    );
  }

  private onFoodTrayTapped(foodDef: FoodDefinition): void {
    this.gs.selectedTrayFoodId = foodDef.id;
    const stock = this.gs.state.foods[foodDef.id];

    if (!stock || !stock.unlocked) {
      const res = this.gs.unlockFood(foodDef.id);
      if (res.ok) {
        this.showToast(`🎉 Đã mở khóa món ${foodDef.name}!`, TASTE_THEME.colors.success);
        this.player.playCheer(`Có thêm ${foodDef.shortName}!`);
      } else if (res.reason) {
        this.showToast(res.reason, TASTE_THEME.colors.accentAmber);
      }
      return;
    }

    // In Pre-Day Prep phase ("Trước ngày mở bán là lúc nhập hàng"), tapping a tray imports raw stock
    if (this.daySystem.phase === 'prep') {
      const restockRes = this.gs.restockIngredient(foodDef.id);
      if (restockRes.ok) {
        this.showToast(
          `📦 Đã nhập +${foodDef.restockBatchSize} ${foodDef.shortName} vào Kho chuẩn bị mở bán!`,
          TASTE_THEME.colors.infoTeal
        );
      } else if (restockRes.reason) {
        this.showToast(restockRes.reason, TASTE_THEME.colors.accentAmber);
      }
      return;
    }

    const readySlot = this.cookingSystem.slots.find(
      (s) => s.status === 'ready' && s.foodId === foodDef.id
    );
    if (readySlot) {
      this.onFryerSlotTapped(readySlot.index);
      return;
    }

    const burnedSlot = this.cookingSystem.slots.find(
      (s) => s.status === 'burned' && s.foodId === foodDef.id
    );
    if (burnedSlot) {
      this.onFryerSlotTapped(burnedSlot.index);
      return;
    }

    if (stock.rawStock < foodDef.batchYield) {
      SoundManager.playError();
      this.showToast(
        `📦 Món ${foodDef.shortName} đã hết nguyên liệu trong Kho! (Chỉ được nhập hàng trước giờ mở bán)`,
        TASTE_THEME.colors.danger
      );
      this.checkDayEndConditions();
      return;
    }

    const cookRes = this.cookingSystem.startCooking(foodDef.id);
    if (cookRes.ok) {
      this.player.playCookingGesture();
      this.showToast(
        `🔥 Đang chiên ${foodDef.shortName} (+${foodDef.batchYield} phần)...`,
        TASTE_THEME.colors.accentAmber
      );
      this.checkDayEndConditions();
    } else if (cookRes.reason) {
      this.showToast(cookRes.reason, TASTE_THEME.colors.danger);
      this.checkDayEndConditions();
    }
  }

  private onFryerSlotTapped(slotIndex: number): void {
    if (!this.cookingSystem.isSlotUnlocked(slotIndex)) {
      this.openModal('upgrade');
      return;
    }

    if (this.daySystem.phase === 'prep') {
      this.showToast(
        '🌅 Đang trong giờ nhập hàng! Hãy nhấn [MỞ BÁN NGAY] để bắt đầu chiên.',
        TASTE_THEME.colors.infoTeal
      );
      return;
    }

    const slot = this.cookingSystem.slots[slotIndex];
    if (slot.status === 'ready') {
      const res = this.cookingSystem.collectSlot(slotIndex);
      if (res.ok && res.foodId) {
        const def = this.gs.getFoodDef(res.foodId);
        const tray = this.trays.get(res.foodId);
        if (tray) {
          this.animateFlyToTray(
            this.fryerUIs[slotIndex].container.x,
            this.fryerUIs[slotIndex].container.y,
            tray.x,
            tray.y,
            def.textureKey
          );
        }
        const perfectTag = res.perfect ? ' (Hoàn hảo +15 XP!)' : '';
        this.showToast(
          `🍱 Đã vớt +${res.added} ${def.shortName} lên khay!${perfectTag}`,
          TASTE_THEME.colors.success
        );
        this.checkDayEndConditions();
      } else if (res.reason) {
        this.showToast(res.reason, TASTE_THEME.colors.danger);
      }
    } else if (slot.status === 'burned') {
      const res = this.cookingSystem.collectSlot(slotIndex);
      if (res.ok && res.burned && res.foodId) {
        const def = this.gs.getFoodDef(res.foodId);
        this.showToast(
          `🗑️ Đã đổ bỏ mẻ ${def.shortName} bị cháy khét ở rổ #${slotIndex + 1}!`,
          TASTE_THEME.colors.accentAmber
        );
        this.checkDayEndConditions();
      }
    } else if (slot.status === 'empty') {
      const res = this.cookingSystem.startCooking(this.gs.selectedTrayFoodId, slotIndex);
      if (res.ok) {
        this.player.playCookingGesture();
        this.checkDayEndConditions();
      } else if (res.reason) {
        this.showToast(res.reason, TASTE_THEME.colors.danger);
        this.checkDayEndConditions();
      }
    } else {
      this.showToast(
        '⏳ Món đang chiên trong dầu sôi, chờ chút nhé!',
        TASTE_THEME.colors.accentAmber
      );
    }
  }

  private spawnCustomerView(cust: ActiveCustomer): void {
    const existing = this.customerViews.get(cust.slotIndex);
    if (existing) existing.destroy();

    const maxCust = this.gs.getMaxCustomerQueue();
    const slotX = this.isDesktop
      ? 238 + cust.slotIndex * 116
      : maxCust <= 3
        ? 126 + cust.slotIndex * 92
        : 112 + cust.slotIndex * 72;
    const slotY = this.isDesktop ? 214 : 172;

    const view = new CustomerOrder(this, slotX, slotY, cust, (clickedSlot) => {
      this.onCustomerTapped(clickedSlot);
    });
    if (this.isDesktop) view.setScale(1.04);
    this.add.existing(view);
    this.customerViews.set(cust.slotIndex, view);
  }

  private onCustomerTapped(slotIndex: number): void {
    const res = this.customerSystem.serveCustomer(slotIndex);
    if (!res.ok) {
      if (res.missingFoodIds && res.missingFoodIds.length > 0) {
        const missingNames = res.missingFoodIds
          .map((id) => this.gs.getFoodDef(id).shortName)
          .join(', ');
        this.showToast(
          `⚠️ Thiếu món chín trên khay: ${missingNames}! Chạm khay để chiên!`,
          TASTE_THEME.colors.danger
        );

        res.missingFoodIds.forEach((id) => {
          const tray = this.trays.get(id);
          if (tray) {
            this.tweens.add({
              targets: tray,
              scale: 1.06,
              duration: 120,
              yoyo: true,
              repeat: 2,
            });
          }
        });
      } else if (res.reason) {
        this.showToast(res.reason, TASTE_THEME.colors.danger);
      }
    }
  }

  private serveFirstReadyCustomer(): void {
    for (let i = 0; i < 4; i++) {
      const cust = this.customerSystem.activeCustomers[i];
      if (cust && this.customerSystem.canFulfillCustomer(i).canServe) {
        this.onCustomerTapped(i);
        return;
      }
    }
    SoundManager.playError();
    this.showToast(
      'Chưa có khách nào đủ món chín để phục vụ ngay!',
      TASTE_THEME.colors.accentAmber
    );
  }

  private refreshGasUI(): void {
    const ratio = Phaser.Math.Clamp(this.gs.state.gas / this.gs.state.maxGas, 0, 1);
    this.gasFillBar.clear();
    const barW = this.isDesktop ? 76 : 48;
    const barY = this.isDesktop ? 28 : 10;
    this.gasFillBar.fillStyle(TASTE_THEME.colors.bgBase, 1);
    this.gasFillBar.fillRoundedRect(-barW / 2, barY, barW, 8, 4);
    const barColor =
      ratio > 0.4
        ? TASTE_THEME.colors.successLight
        : ratio > 0.2
          ? TASTE_THEME.colors.accentAmber
          : TASTE_THEME.colors.danger;
    this.gasFillBar.fillStyle(barColor, 1);
    this.gasFillBar.fillRoundedRect(-barW / 2, barY, Math.max(4, barW * ratio), 8, 4);
    this.gasPercentText.setText(`Gas: ${Math.round(ratio * 100)}%`);
  }

  private refreshOilUI(): void {
    if (!this.oilFillBar || !this.oilPercentText) return;
    const ratio = Phaser.Math.Clamp(this.gs.state.oilQuality / 100, 0, 1);
    this.oilFillBar.clear();
    const barW = this.isDesktop ? 76 : 48;
    const barY = this.isDesktop ? -10 : -10;
    this.oilFillBar.fillStyle(TASTE_THEME.colors.bgBase, 1);
    this.oilFillBar.fillRoundedRect(-barW / 2, barY, barW, 7, 3);

    const status = this.gs.getOilStatus();
    const barColor =
      status === 'fresh'
        ? 0xeab308 // Vàng óng
        : status === 'degraded'
          ? 0xb45309 // Nâu sẫm
          : 0x1c1917; // Đen khét
    this.oilFillBar.fillStyle(barColor, 1);
    this.oilFillBar.fillRoundedRect(-barW / 2, barY, Math.max(4, barW * ratio), 7, 3);

    const statusLabel = status === 'fresh' ? 'Vàng' : status === 'degraded' ? 'Nâu' : 'Khét!';
    this.oilPercentText.setText(`Dầu: ${Math.round(ratio * 100)}% (${statusLabel})`);
    if (status === 'burned') {
      this.oilPercentText.setColor('#ef4444');
    } else if (status === 'degraded') {
      this.oilPercentText.setColor('#f59e0b');
    } else {
      this.oilPercentText.setColor(TASTE_THEME.colors.inkOnDark);
    }
  }

  private refreshVeggieUI(): void {
    if (!this.veggieStockText) return;
    this.veggieStockText.setText(`Kho: ${this.gs.state.veggieStock}/40 phần`);
    this.veggieStockText.setColor(this.gs.state.veggieStock <= 3 ? '#ef4444' : '#a7f3d0');
  }

  private onVeggieTapped(type: VeggieType): void {
    const res = this.customerSystem.autoServeVeggie(type);
    if (res.success) {
      this.refreshVeggieUI();
      const name = type === 'dua_leo' ? 'Dưa leo' : type === 'dau_bap' ? 'Đậu bắp' : 'Xà lách';
      this.showToast(`🥒 Đã gắp ${name} cho khách #${res.customerIndex! + 1}!`, TASTE_THEME.colors.success);
    } else if (this.gs.state.veggieStock <= 0) {
      SoundManager.playError();
      this.showToast(res.reason || 'Đã hết rau trong kho! Bấm [+ Nhập 15k] để mua thêm.', TASTE_THEME.colors.danger);
    } else {
      SoundManager.playError();
      this.showToast(res.reason || 'Không có khách nào đang chờ món rau này!', TASTE_THEME.colors.accentAmber);
    }
  }

  private onSauceTapped(type: SauceType): void {
    const res = this.customerSystem.autoServeSauce(type);
    if (res.success) {
      const name = type === 'tuong_ot' ? 'Tương Ớt' : type === 'tuong_den' ? 'Tương Đen' : 'Tương Xí Muội';
      this.showToast(`🥢 Đã chan ${name} (+2.000đ) cho khách #${res.customerIndex! + 1}!`, TASTE_THEME.colors.success);
    } else {
      SoundManager.playError();
      this.showToast(res.reason || 'Không có khách nào đang chờ loại nước chấm này!', TASTE_THEME.colors.accentAmber);
    }
  }

  private triggerChangeOil(): void {
    const res = this.gs.changeCookingOil();
    if (res.ok) {
      this.refreshOilUI();
      SoundManager.playPop();
      this.showToast('🛢️ Đã thay chảo dầu mới vàng óng! (-30.000đ)', TASTE_THEME.colors.success);
    } else if (res.reason) {
      SoundManager.playError();
      this.showToast(res.reason, TASTE_THEME.colors.danger);
    }
  }

  private triggerServeVeggieToCustomer(): void {
    // Default fallback to cucumber
    this.onVeggieTapped('dua_leo');
  }

  private triggerRestockVeggie(): void {
    const res = this.gs.restockVeggies();
    if (res.ok) {
      this.refreshVeggieUI();
      this.showToast('🥒 Đã nhập thêm 15 phần rau ăn kèm (-15.000đ)', TASTE_THEME.colors.success);
    } else if (res.reason) {
      SoundManager.playError();
      this.showToast(res.reason, TASTE_THEME.colors.danger);
    }
  }

  private refreshFryerSlotUI(slotIndex: number): void {
    const ui = this.fryerUIs[slotIndex];
    if (!ui) return;

    const unlocked = this.cookingSystem.isSlotUnlocked(slotIndex);
    const slot = this.cookingSystem.slots[slotIndex];
    const w = ui.slotW;
    const h = ui.slotH;

    ui.bg.clear();
    ui.progressFill.clear();

    if (!unlocked) {
      ui.bg.fillStyle(TASTE_THEME.colors.bgBase, 0.75);
      ui.bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      ui.bg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
      ui.bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
      ui.foodIcon.setVisible(false);
      ui.bubbleEmitter.clear();
      ui.statusText.setPosition(0, 0);
      ui.statusText.setText('🔒 Mở ở Nâng Cấp');
      ui.statusText.setColor(TASTE_THEME.colors.inkMutedOnDark);
      return;
    }

    if (slot.status === 'empty') {
      ui.bg.fillStyle(TASTE_THEME.colors.steelDark, 0.9);
      ui.bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      // Warm golden oil well inside the stainless fryer basket
      ui.bg.fillStyle(0xb45309, 0.28);
      ui.bg.fillRoundedRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 7);
      ui.bg.lineStyle(1, TASTE_THEME.colors.steelMid, 0.65);
      ui.bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
      ui.foodIcon.setVisible(false).clearTint();
      ui.bubbleEmitter.clear();
      ui.statusText.setPosition(0, 0);
      ui.statusText.setText(`Rổ #${slotIndex + 1} Trống\nChạm để chiên`);
      ui.statusText.setColor(TASTE_THEME.colors.inkOnDark);
    } else if (slot.status === 'cooking' && slot.foodId) {
      const def = this.gs.getFoodDef(slot.foodId);
      const ratio = Phaser.Math.Clamp(slot.elapsedMs / slot.durationMs, 0, 1);
      const remainSec = ((slot.durationMs - slot.elapsedMs) / 1000).toFixed(1);

      ui.bg.fillStyle(0x78350f, 1);
      ui.bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      ui.bg.fillStyle(TASTE_THEME.colors.accentAmber, 0.45);
      ui.bg.fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 7);
      ui.bg.lineStyle(2, TASTE_THEME.colors.accentGold, 1);
      ui.bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);

      ui.foodIcon.setTexture(def.textureKey).setVisible(true).clearTint();
      ui.statusText.setPosition(16, -11);
      ui.statusText.setText(`${def.shortName}\n🔥 Đang chiên: ${remainSec}s`);
      ui.statusText.setColor('#ffffff');

      const pBarW = this.isDesktop ? 98 : 62;
      const pBarH = this.isDesktop ? 8 : 6;
      const pBarX = -16;
      const pBarY = this.isDesktop ? 24 : 13;
      ui.progressFill.fillStyle(TASTE_THEME.colors.bgBase, 0.9);
      ui.progressFill.fillRoundedRect(pBarX, pBarY, pBarW, pBarH, 4);
      ui.progressFill.fillStyle(TASTE_THEME.colors.accentGold, 1);
      ui.progressFill.fillRoundedRect(pBarX, pBarY, Math.max(4, pBarW * ratio), pBarH, 4);
      // Golden readiness milestone tick mark at right end
      ui.progressFill.fillStyle(TASTE_THEME.colors.successLight, 1);
      ui.progressFill.fillRect(pBarX + pBarW - 3, pBarY - 2, 2.5, pBarH + 4);
    } else if (slot.status === 'ready' && slot.foodId) {
      const def = this.gs.getFoodDef(slot.foodId);
      const burnRatio = Phaser.Math.Clamp(slot.burnElapsedMs / Math.max(1, slot.burnLimitMs), 0, 1);
      const remainBurnRatio = Phaser.Math.Clamp(1 - burnRatio, 0, 1);
      const remainBurnSec = Math.max(
        0,
        (slot.burnLimitMs - slot.burnElapsedMs) / 1000
      ).toFixed(1);

      const isUrgent = burnRatio >= 0.65;
      const cardColor = isUrgent ? 0x9a3412 : TASTE_THEME.colors.success;
      const borderColor = isUrgent ? TASTE_THEME.colors.danger : 0xffffff;

      ui.bg.fillStyle(cardColor, 1);
      ui.bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      ui.bg.lineStyle(2, borderColor, 0.95);
      ui.bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);

      ui.foodIcon.setTexture(def.textureKey).setVisible(true).clearTint();
      ui.bubbleEmitter.clear();
      ui.statusText.setPosition(16, -11);
      ui.statusText.setText(`${def.shortName}\n✓ VỚT NGAY (${remainBurnSec}s)`);
      ui.statusText.setColor('#ffffff');

      // Burn Countdown Bar (Green -> Amber -> Danger Red as burnRatio increases)
      const pBarW = this.isDesktop ? 98 : 62;
      const pBarH = this.isDesktop ? 8 : 6;
      const pBarX = -16;
      const pBarY = this.isDesktop ? 24 : 13;
      const barColor =
        burnRatio < 0.45
          ? TASTE_THEME.colors.successLight
          : burnRatio < 0.75
            ? TASTE_THEME.colors.accentAmber
            : TASTE_THEME.colors.danger;

      ui.progressFill.fillStyle(TASTE_THEME.colors.bgBase, 0.9);
      ui.progressFill.fillRoundedRect(pBarX, pBarY, pBarW, pBarH, 4);
      ui.progressFill.fillStyle(barColor, 1);
      ui.progressFill.fillRoundedRect(
        pBarX,
        pBarY,
        Math.max(4, pBarW * remainBurnRatio),
        pBarH,
        4
      );
    } else if (slot.status === 'burned' && slot.foodId) {
      const def = this.gs.getFoodDef(slot.foodId);
      ui.bg.fillStyle(0x2b1111, 1);
      ui.bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      ui.bg.fillStyle(TASTE_THEME.colors.danger, 0.22);
      ui.bg.fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 7);
      ui.bg.lineStyle(2, TASTE_THEME.colors.danger, 1);
      ui.bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);

      ui.foodIcon.setTexture(def.textureKey).setVisible(true).setTint(0x3a2e2b);
      ui.statusText.setPosition(16, 0);
      ui.statusText.setText(`💀 CHÁY KHÉT!\nChạm để đổ bỏ`);
      ui.statusText.setColor('#fecaca');
    }
  }

  private syncTrayCookingFlags(): void {
    this.trays.forEach((tray, foodId) => {
      const matchingSlots = this.cookingSystem.slots.filter(
        (s) =>
          s.foodId === foodId &&
          (s.status === 'cooking' || s.status === 'ready' || s.status === 'burned')
      );

      if (matchingSlots.length === 0) {
        tray.setCookingProgress(0, 'idle');
        return;
      }

      // Priority: ready (about to burn) > cooking > burned
      const readySlot = matchingSlots.find((s) => s.status === 'ready');
      if (readySlot) {
        const burnRatio = readySlot.burnElapsedMs / Math.max(1, readySlot.burnLimitMs);
        tray.setCookingProgress(burnRatio, 'ready');
        return;
      }

      const cookingSlot = matchingSlots.find((s) => s.status === 'cooking');
      if (cookingSlot) {
        const cookRatio = cookingSlot.elapsedMs / Math.max(1, cookingSlot.durationMs);
        tray.setCookingProgress(cookRatio, 'cooking');
        return;
      }

      tray.setCookingProgress(1, 'burned');
    });
  }

  private refreshCustomerOrderBadges(): void {
    const neededSet = new Set<string>();
    this.customerSystem.activeCustomers.forEach((cust) => {
      if (!cust) return;
      cust.orders.forEach((req) => neededSet.add(req.foodId));
    });

    this.trays.forEach((tray, foodId) => {
      tray.setOrderNeeded(neededSet.has(foodId));
    });

    this.customerViews.forEach((view) => {
      view.refreshOrderState();
    });
  }

  private refreshAllTraysAndCustomers(): void {
    this.trays.forEach((t) => t.refresh());
    this.refreshCustomerOrderBadges();
  }

  private animateFlyToTray(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    texKey: string
  ): void {
    const flyer = this.add.image(fromX, fromY, texKey).setScale(0.32).setDepth(50);
    this.tweens.add({
      targets: flyer,
      x: toX,
      y: toY,
      scale: 0.42,
      duration: 280,
      ease: TASTE_THEME.motion.easeOut,
      onComplete: () => flyer.destroy(),
    });
  }

  private spawnFloatingReward(x: number, y: number, text: string, tipAmount: number): void {
    const label = tipAmount > 0 ? `${text}\n(Tip +${this.gs.formatCurrency(tipAmount)})` : text;
    const floatTxt = this.add
      .text(x, y, label, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop ? '14px' : '12.5px',
        fontStyle: '800',
        color: '#4ade80',
        backgroundColor: '#16110d',
        padding: { left: 8, right: 8, top: 4, bottom: 4 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(60);

    this.tweens.add({
      targets: floatTxt,
      y: y - 44,
      alpha: 0,
      duration: 1050,
      ease: TASTE_THEME.motion.easeOut,
      onComplete: () => floatTxt.destroy(),
    });
  }

  public showToast(message: string, bgColor: number = TASTE_THEME.colors.bgSurface): void {
    const { width: screenW } = getLogicalDimensions();
    const toastX = this.isDesktop ? 362 : screenW / 2;
    const toastY = this.isDesktop ? 286 : 228;
    const toastCon = this.add.container(toastX, toastY).setDepth(100);
    const txt = this.add
      .text(0, 0, message, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop ? '13px' : '11.5px',
        fontStyle: '700',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5);

    const b = txt.getBounds();
    const padX = 20;
    const padY = 10;
    const g = this.add.graphics();
    g.fillStyle(bgColor, 0.96);
    g.fillRoundedRect(
      -b.width / 2 - padX / 2,
      -b.height / 2 - padY / 2,
      b.width + padX,
      b.height + padY,
      8
    );
    g.lineStyle(1, 0xffffff, 0.35);
    g.strokeRoundedRect(
      -b.width / 2 - padX / 2,
      -b.height / 2 - padY / 2,
      b.width + padX,
      b.height + padY,
      8
    );

    toastCon.add([g, txt]);
    toastCon.setAlpha(0);

    this.tweens.add({
      targets: toastCon,
      alpha: 1,
      y: toastY - 8,
      duration: 160,
      ease: TASTE_THEME.motion.easeOut,
      onComplete: () => {
        this.time.delayedCall(1500, () => {
          this.tweens.add({
            targets: toastCon,
            alpha: 0,
            y: toastY - 20,
            duration: 200,
            onComplete: () => toastCon.destroy(),
          });
        });
      },
    });
  }

  public openModal(tab: ModalTab): void {
    this.daySystem.isPaused = true;
    if (this.scene.isActive('ModalScene')) {
      this.scene.stop('ModalScene');
    }
    this.scene.launch('ModalScene', {
      tab,
      shopScene: this,
    });
  }

  public resumeFromModal(): void {
    this.daySystem.isPaused = false;
    this.refreshActionButtonsForPhase();
    this.refreshGasUI();
    this.refreshOilUI();
    this.refreshVeggieUI();
    this.refreshAllTraysAndCustomers();
    this.refreshDay1GuidanceHint();
    for (let i = 0; i < 4; i++) {
      this.refreshFryerSlotUI(i);
    }
  }

  private checkDayEndConditions(): void {
    if (this.daySystem.phase !== 'selling' || !this.daySystem.isRunning || this.endDayPending) {
      return;
    }

    // Chờ cho mẻ đang chiên hoàn thành
    if (this.cookingSystem.hasCookingSlot()) {
      return;
    }

    const totalRaw = this.gs.getTotalRawStock();
    const totalCooked = this.gs.getUnlockedFoods().reduce(
      (sum, f) => sum + (this.gs.state.foods[f.id]?.cookedStock || 0),
      0
    );
    const hasActiveCooking = this.cookingSystem.hasActiveSlot();
    const activeCustCount = this.customerSystem.activeCustomers.filter(Boolean).length;

    // Cơ chế kết thúc ngày mới: Chỉ kết thúc khi BÁN SẠCH HÀNG trong kho và trên khay!
    // Không còn tự động kết thúc ngày vì hết bình gas.
    const isSoldOut = totalRaw === 0 && totalCooked === 0 && !hasActiveCooking && activeCustCount === 0;

    if (!isSoldOut) {
      return;
    }

    this.endDayPending = true;

    // Tự động thu gom các mẻ chín cuối cùng (nếu có)
    this.cookingSystem.collectAllReadySlots();

    SoundManager.playDing();
    this.showToast('🎉 Đã bán sạch bách không còn một xiên nào! Hết ngày rực rỡ!', TASTE_THEME.colors.success);

    this.time.delayedCall(700, () => {
      this.daySystem.endDay('out_of_stock');
    });
  }

  public update(_time: number, delta: number): void {
    if (this.daySystem.isPaused) return;

    this.daySystem.update(delta);
    this.cookingSystem.update(delta);
    this.customerSystem.update(delta, this.daySystem.isRunning);
    this.checkDayEndConditions();
    this.refreshDay1GuidanceHint();

    this.customerViews.forEach((view) => {
      view.updatePatienceBar();
    });

    this.bubblePhase += delta * 0.01;
    for (let i = 0; i < 4; i++) {
      const slot = this.cookingSystem.slots[i];
      const ui = this.fryerUIs[i];
      if (!ui) continue;
      if (slot.status === 'cooking') {
        ui.bubbleEmitter.clear();
        ui.bubbleEmitter.fillStyle(0xfef08a, 0.72);
        for (let b = 0; b < 4; b++) {
          const bx = -44 + b * 8 + Math.sin(this.bubblePhase + b) * 3;
          const by = 8 - ((this.bubblePhase * 6 + b * 5) % 20);
          ui.bubbleEmitter.fillCircle(bx, by, 2.5);
        }
      } else if (slot.status === 'burned') {
        ui.bubbleEmitter.clear();
        ui.bubbleEmitter.fillStyle(0x9ca3af, 0.55);
        for (let b = 0; b < 4; b++) {
          const bx = -44 + b * 9 + Math.cos(this.bubblePhase * 0.8 + b) * 4;
          const by = 10 - ((this.bubblePhase * 5 + b * 6) % 26);
          ui.bubbleEmitter.fillCircle(bx, by, 3.2);
        }
      }
    }
  }
}

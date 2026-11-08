import Phaser from 'phaser';
import { INITIAL_FOODS } from '../data/foods';
import { UPGRADE_DEFINITIONS, INITIAL_MISSIONS, ACHIEVEMENTS } from '../data/upgrades';
import { GameStateManager } from '../managers/GameStateManager';
import { SoundManager } from '../managers/SoundManager';
import { ShopScene } from './ShopScene';
import { TASTE_THEME } from '../config/tasteTheme';
import { applyHiDPICamera, getLogicalDimensions } from '../config/display';

export type ModalTab =
  | 'shop'
  | 'upgrade'
  | 'mission'
  | 'inventory'
  | 'achievement'
  | 'daily_result'
  | 'settings'
  | 'tutorial';

interface ModalInitData {
  tab: ModalTab;
  shopScene: ShopScene;
}

export class ModalScene extends Phaser.Scene {
  private gs!: GameStateManager;
  private currentTab: ModalTab = 'shop';
  private shopScene!: ShopScene;
  private contentContainer!: Phaser.GameObjects.Container;
  private titleTxt!: Phaser.GameObjects.Text;
  private pageIndex = 0;

  private modalW = 396;
  private modalH = 640;
  private modalX = 12;
  private modalY = 64;
  private isDesktop = false;

  constructor() {
    super('ModalScene');
  }

  public init(data: ModalInitData): void {
    this.currentTab = data.tab || 'shop';
    this.shopScene = data.shopScene;
    this.pageIndex = 0;
  }

  public create(): void {
    applyHiDPICamera(this);
    this.gs = GameStateManager.getInstance();
    const { width: W, height: H, isDesktop } = getLogicalDimensions();
    this.isDesktop = isDesktop;

    this.modalW = this.isDesktop ? 600 : W - 24;
    this.modalH = this.isDesktop ? 620 : 656;
    this.modalX = (W - this.modalW) / 2;
    this.modalY = (H - this.modalH) / 2;

    // Dimmed backdrop
    const overlay = this.add
      .rectangle(0, 0, W, H, 0x0b0806, 0.78)
      .setOrigin(0)
      .setInteractive();

    overlay.on('pointerdown', (_pointer: Phaser.Input.Pointer, localX: number, localY: number) => {
      const outsideX = localX < this.modalX || localX > this.modalX + this.modalW;
      const outsideY = localY < this.modalY || localY > this.modalY + this.modalH;
      if (this.currentTab !== 'daily_result' && (outsideX || outsideY)) {
        this.closeModal();
      }
    });

    if (this.input.keyboard) {
      this.input.keyboard.once('keydown-ESC', () => {
        if (this.currentTab !== 'daily_result') {
          this.closeModal();
        }
      });
    }

    // Main Modal Panel (`cards.md` — clean warm cream surface with 1px hairline border)
    const panel = this.add.graphics();
    panel.fillStyle(TASTE_THEME.colors.cardCream, 1);
    panel.fillRoundedRect(this.modalX, this.modalY, this.modalW, this.modalH, 16);

    // Dark Espresso Header Bar (height = 52px)
    panel.fillStyle(TASTE_THEME.colors.bgElevated, 1);
    panel.fillRoundedRect(this.modalX, this.modalY, this.modalW, 52, {
      tl: 16,
      tr: 16,
      bl: 0,
      br: 0,
    });
    // Subtle brand accent underline under header
    panel.fillStyle(TASTE_THEME.colors.accentPrimary, 1);
    panel.fillRect(this.modalX, this.modalY + 50, this.modalW, 2);

    panel.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
    panel.strokeRoundedRect(this.modalX, this.modalY, this.modalW, this.modalH, 16);

    this.titleTxt = this.add
      .text(this.modalX + 20, this.modalY + 26, '', {
        fontFamily: TASTE_THEME.fonts.display,
        fontSize: this.isDesktop ? '18px' : '15px',
        fontStyle: 'bold',
        color: TASTE_THEME.colors.inkOnDark,
      })
      .setOrigin(0, 0.5);

    // Close Button (X) — strictly isolated on the right (`modalW - 28`)
    const closeBtn = this.add.container(this.modalX + this.modalW - 28, this.modalY + 26);
    const closeBg = this.add.graphics();
    closeBg.fillStyle(TASTE_THEME.colors.bgSurface, 1);
    closeBg.fillRoundedRect(-16, -16, 32, 32, 8);
    closeBg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
    closeBg.strokeRoundedRect(-16, -16, 32, 32, 8);
    const closeTxt = this.add
      .text(0, 0, '✕', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '14px',
        fontStyle: 'bold',
        color: TASTE_THEME.colors.inkOnDark,
      })
      .setOrigin(0.5);
    const closeHit = this.add
      .rectangle(0, 0, 36, 36, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    closeHit.on('pointerdown', () => {
      SoundManager.playPop();
      this.closeModal();
    });
    closeBtn.add([closeBg, closeTxt, closeHit]);

    this.contentContainer = this.add.container(this.modalX, this.modalY);
    this.renderCurrentTab();
  }

  private getTitleForTab(tab: ModalTab): string {
    switch (tab) {
      case 'shop':
        return '🏪 THỰC ĐƠN QUÁN (12 MÓN)';
      case 'upgrade':
        return '⚡ NÂNG CẤP THIẾT BỊ & QUÁN';
      case 'mission':
        return '📜 NHIỆM VỤ KINH DOANH';
      case 'inventory':
        return this.shopScene?.daySystem?.phase === 'prep'
          ? this.isDesktop
            ? `📦 CHUẨN BỊ MỞ BÁN — NGÀY ${this.gs.state.day}`
            : `📦 NHẬP KHO — NGÀY ${this.gs.state.day}`
          : '❄️ KHO NGUYÊN LIỆU & BÌNH GAS';
      case 'achievement':
        return '🏆 DANH HIỆU & THÀNH TỰU';
      case 'daily_result':
        return `📊 BÁO CÁO NGÀY ${this.gs.state.day}`;
      case 'settings':
        return '⚙️ TẠM DỪNG & CÀI ĐẶT';
      case 'tutorial':
        return '📖 CẨM NANG BÁN CÁ VIÊN (NGÀY 1)';
    }
  }

  private renderCurrentTab(): void {
    this.contentContainer.removeAll(true);
    const W = this.modalW;

    if (this.titleTxt) {
      this.titleTxt.setScale(1);
      this.titleTxt.setText(this.getTitleForTab(this.currentTab));
      const maxTitleW = W - 76;
      if (this.titleTxt.width > maxTitleW) {
        this.titleTxt.setScale(maxTitleW / this.titleTxt.width);
      }
    }

    // Top wallet balance bar inside modal (`y: 60..92`, height = 32px)
    const walletBg = this.add.graphics();
    walletBg.fillStyle(TASTE_THEME.colors.cardWarmAlt, 1);
    walletBg.fillRoundedRect(16, 60, W - 32, 32, 8);
    walletBg.lineStyle(1, TASTE_THEME.colors.borderHairlineLight, 1);
    walletBg.strokeRoundedRect(16, 60, W - 32, 32, 8);

    const walletStr = this.isDesktop
      ? `Tiền vốn: ${this.gs.formatCurrency(this.gs.state.money)}   •   Kim cương: ${this.gs.state.diamonds} 💎   •   Cấp quán: Lv.${this.gs.state.level}`
      : `Vốn: ${this.gs.formatCurrency(this.gs.state.money)}  •  ${this.gs.state.diamonds} 💎  •  Lv.${this.gs.state.level}`;

    const walletTxt = this.add
      .text(W / 2, 76, walletStr, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop ? '12.5px' : '11.5px',
        fontStyle: '700',
        color: TASTE_THEME.colors.inkDark,
      })
      .setOrigin(0.5);

    this.contentContainer.add([walletBg, walletTxt]);

    switch (this.currentTab) {
      case 'shop':
        this.renderShopTab();
        break;
      case 'upgrade':
        this.renderUpgradeTab();
        break;
      case 'mission':
        this.renderMissionTab();
        break;
      case 'inventory':
        this.renderInventoryTab();
        break;
      case 'achievement':
        this.renderAchievementTab();
        break;
      case 'daily_result':
        this.renderDailyResultTab();
        break;
      case 'settings':
        this.renderSettingsTab();
        break;
      case 'tutorial':
        this.renderTutorialTab();
        break;
    }
  }

  private renderShopTab(): void {
    const W = this.modalW;
    const perPage = 6;
    const totalPages = Math.ceil(INITIAL_FOODS.length / perPage);
    const items = INITIAL_FOODS.slice(this.pageIndex * perPage, (this.pageIndex + 1) * perPage);

    const btnW = this.isDesktop ? 104 : 88;
    const btnCenterX = W - 16 - 10 - btnW / 2;
    const btnLeftEdge = btnCenterX - btnW / 2;
    const textStartX = 80;
    const maxTextW = btnLeftEdge - textStartX - 10;

    items.forEach((food, idx) => {
      const y = 104 + idx * 74;
      const stock = this.gs.state.foods[food.id];
      const unlocked = stock?.unlocked ?? false;

      const row = this.add.graphics();
      row.fillStyle(unlocked ? 0xffffff : TASTE_THEME.colors.cardWarmAlt, 1);
      row.fillRoundedRect(16, y, W - 32, 66, 10);
      row.lineStyle(1, TASTE_THEME.colors.borderHairlineLight, 1);
      row.strokeRoundedRect(16, y, W - 32, 66, 10);

      const icon = this.add.image(48, y + 33, food.textureKey).setScale(0.19);
      const title = this.add.text(textStartX, y + 12, `${food.name}`, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop ? '14px' : '12.5px',
        fontStyle: '800',
        color: TASTE_THEME.colors.inkDark,
      });
      if (title.width > maxTextW) title.setScale(maxTextW / title.width);

      const subStr = this.isDesktop
        ? `Giá bán: ${this.gs.formatCurrency(food.sellPrice)}/phần  •  Chiên: ${(food.cookTimeMs / 1000).toFixed(1)}s (${food.batchYield} viên/mẻ)`
        : `Bán: ${this.gs.formatCurrency(food.sellPrice)} • Chiên ${(food.cookTimeMs / 1000).toFixed(1)}s`;

      const sub = this.add.text(textStartX, y + 36, subStr, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop ? '11.5px' : '10.5px',
        fontStyle: '600',
        color: TASTE_THEME.colors.inkMuted,
      });
      if (sub.width > maxTextW) sub.setScale(maxTextW / sub.width);

      this.contentContainer.add([row, icon, title, sub]);

      if (unlocked) {
        const badge = this.add
          .text(btnCenterX, y + 33, '✓ ĐÃ MỞ', {
            fontFamily: TASTE_THEME.fonts.sans,
            fontSize: '11px',
            fontStyle: '800',
            color: '#1f8a4c',
            backgroundColor: '#e6f4ea',
            padding: { left: 8, right: 8, top: 5, bottom: 5 },
          })
          .setOrigin(0.5);
        this.contentContainer.add(badge);
      } else {
        const canUnlock =
          this.gs.state.level >= food.unlockLevel && this.gs.state.money >= food.unlockCost;
        const btn = this.createActionButton(
          btnCenterX,
          y + 33,
          btnW,
          42,
          this.gs.state.level < food.unlockLevel
            ? `Cần Cấp ${food.unlockLevel}`
            : `Mở: ${(food.unlockCost / 1000).toFixed(0)}K`,
          canUnlock ? TASTE_THEME.colors.accentPrimary : TASTE_THEME.colors.slateNeutral,
          () => {
            const res = this.gs.unlockFood(food.id);
            if (!res.ok && res.reason) {
              this.shopScene.showToast(res.reason, TASTE_THEME.colors.danger);
            } else {
              this.renderCurrentTab();
            }
          }
        );
        this.contentContainer.add(btn);
      }
    });

    this.renderPaginationControls(totalPages);
  }

  private renderUpgradeTab(): void {
    const W = this.modalW;
    const perPage = 5;
    const totalPages = Math.ceil(UPGRADE_DEFINITIONS.length / perPage);
    const items = UPGRADE_DEFINITIONS.slice(
      this.pageIndex * perPage,
      (this.pageIndex + 1) * perPage
    );

    const btnW = this.isDesktop ? 104 : 88;
    const btnCenterX = W - 16 - 10 - btnW / 2;
    const btnLeftEdge = btnCenterX - btnW / 2;
    const textStartX = 72;
    const maxTextW = btnLeftEdge - textStartX - 10;

    items.forEach((up, idx) => {
      const y = 104 + idx * 88;
      const currentLvl = this.gs.state.upgrades[up.id] || 0;
      const isMax = currentLvl >= up.maxLevel;
      const cost = this.gs.getUpgradeCost(up.id);

      const row = this.add.graphics();
      row.fillStyle(0xffffff, 1);
      row.fillRoundedRect(16, y, W - 32, 80, 10);
      row.lineStyle(1, TASTE_THEME.colors.borderHairlineLight, 1);
      row.strokeRoundedRect(16, y, W - 32, 80, 10);

      const ic = this.add.text(44, y + 40, up.icon, { fontSize: '24px' }).setOrigin(0.5);
      const nameTxt = this.add.text(
        textStartX,
        y + 9,
        `${up.name} (Lv.${currentLvl}/${up.maxLevel})`,
        {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: this.isDesktop ? '13.5px' : '12px',
          fontStyle: '800',
          color: TASTE_THEME.colors.inkDark,
        }
      );
      if (nameTxt.width > maxTextW) nameTxt.setScale(maxTextW / nameTxt.width);

      const descTxt = this.add.text(textStartX, y + 29, up.description, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop ? '11px' : '10px',
        fontStyle: '500',
        color: TASTE_THEME.colors.inkBody,
        wordWrap: { width: maxTextW },
      });
      const effectTxt = this.add.text(
        textStartX,
        y + 57,
        `Hiệu quả: ${up.effectLabel(currentLvl)}`,
        {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: this.isDesktop ? '11px' : '10px',
          fontStyle: '700',
          color: '#1f8a4c',
        }
      );
      if (effectTxt.width > maxTextW) effectTxt.setScale(maxTextW / effectTxt.width);

      this.contentContainer.add([row, ic, nameTxt, descTxt, effectTxt]);

      const btn = this.createActionButton(
        btnCenterX,
        y + 40,
        btnW,
        44,
        isMax ? 'TỐI ĐA' : `Nâng Cấp\n${(cost / 1000).toFixed(0)}K`,
        isMax
          ? TASTE_THEME.colors.slateNeutral
          : this.gs.state.money >= cost
            ? TASTE_THEME.colors.success
            : TASTE_THEME.colors.accentAmber,
        () => {
          const res = this.gs.buyUpgrade(up.id);
          if (!res.ok && res.reason) {
            this.shopScene.showToast(res.reason, TASTE_THEME.colors.danger);
          } else {
            this.renderCurrentTab();
          }
        }
      );
      this.contentContainer.add(btn);
    });

    this.renderPaginationControls(totalPages);
  }

  /**
   * Inventory & Pre-Day Restock Tab (`renderInventoryTab`)
   * Strictly non-overlapping vertical & horizontal zones:
   * - Wallet Bar: `y = 60..92`
   * - Status Banner: `y = 98..126` (height `28px`)
   * - Quick Action Row (`gasBtn` + `restockAllBtn`): center `y = 152`, height `36px` (`y = 134..170`)
   * - 4 Food Rows (`perPage = 4`): `y = 178 + idx * 70`, height `62px` (`y = 178..450`)
   *   - Left Icon: `x = 46`
   *   - Text column: `x = 78` to `btnLeftEdge - 10` (strictly clamped so button never overlaps text!)
   *   - Right Action Button: `x = btnCenterX`, width `106px` (Desktop) / `88px` (Mobile), height `42px`
   * - Pagination Bar: `py = 480` (`y = 463..497`) when `isPrep`, or `this.modalH - 34` when selling
   * - Primary Start Selling Button (`isPrep`): center `y = 548`, height `46px` (`y = 525..571`)
   */
  private renderInventoryTab(): void {
    const W = this.modalW;
    const isPrep = this.shopScene.daySystem.phase === 'prep';
    const gasRatio = Math.round((this.gs.state.gas / this.gs.state.maxGas) * 100);
    const topBtnGap = 10;
    const topBtnW = (W - 32 - topBtnGap) / 2;

    // Separate currently unlocked foods (active inventory for restocking) from locked foods
    const unlockedFoods = INITIAL_FOODS.filter((f) => this.gs.state.foods[f.id]?.unlocked);
    const lockedFoods = INITIAL_FOODS.filter((f) => !this.gs.state.foods[f.id]?.unlocked).sort(
      (a, b) => a.unlockLevel - b.unlockLevel
    );

    // 1. Phase Status Banner (`y: 98..126`, height = 28px)
    const bannerBg = this.add.graphics();
    bannerBg.fillStyle(isPrep ? 0xe6f4ea : 0xfee2e2, 1);
    bannerBg.fillRoundedRect(16, 98, W - 32, 28, 6);
    bannerBg.lineStyle(1, isPrep ? TASTE_THEME.colors.success : TASTE_THEME.colors.danger, 0.5);
    bannerBg.strokeRoundedRect(16, 98, W - 32, 28, 6);

    const bannerCopy = isPrep
      ? this.isDesktop
        ? `🌅 Trước giờ mở bán: Nhập kho ${unlockedFoods.length} món đang bán (${lockedFoods.length} món chưa mở ở trang sau) • Bơm đầy Gas!`
        : `🌅 Nhập kho: ${unlockedFoods.length} món đang bán • ${lockedFoods.length} món chưa mở ở trang sau!`
      : this.isDesktop
        ? '🔒 ĐANG MỞ BÁN — Chỉ được nhập nguyên liệu & bơm Gas trước giờ mở bán!'
        : '🔒 ĐANG MỞ BÁN — Chỉ nhập hàng trước giờ mở bán!';

    const bannerTxt = this.add
      .text(W / 2, 112, bannerCopy, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop ? '11.5px' : '10.5px',
        fontStyle: '700',
        color: isPrep ? '#1f8a4c' : '#c92a2a',
      })
      .setOrigin(0.5);
    if (bannerTxt.width > W - 44) {
      bannerTxt.setScale((W - 44) / bannerTxt.width);
    }
    this.contentContainer.add([bannerBg, bannerTxt]);

    // 2. Top Quick Action Buttons (`y = 152`, height = 36px -> spans `134..170`)
    const gasLabel = isPrep
      ? `⛽ Bình Gas: ${gasRatio}% (Bơm Đầy)`
      : `🔒 Bình Gas: ${gasRatio}%`;

    const gasBtn = this.createActionButton(
      16 + topBtnW / 2,
      152,
      topBtnW,
      36,
      gasLabel,
      isPrep && gasRatio < 100 ? TASTE_THEME.colors.infoTeal : TASTE_THEME.colors.slateNeutral,
      () => {
        if (!isPrep) {
          this.shopScene.showToast(
            '🔒 Đang mở bán! Chỉ được bơm Gas trước giờ mở bán!',
            TASTE_THEME.colors.accentAmber
          );
          return;
        }
        const res = this.gs.refillGas();
        if (!res.ok && res.reason) {
          this.shopScene.showToast(res.reason, TASTE_THEME.colors.danger);
        } else if (res.ok && res.cost) {
          this.shopScene.showToast(
            `⛽ Đã đổi bình Gas mới (-${this.gs.formatCurrency(res.cost)})!`,
            TASTE_THEME.colors.success
          );
        }
        this.renderCurrentTab();
      }
    );

    const restockLabel = isPrep ? '📦 Nhập Hết Món Đang Bán' : '🔒 Kho Đang Khóa';

    const restockAllBtn = this.createActionButton(
      W - 16 - topBtnW / 2,
      152,
      topBtnW,
      36,
      restockLabel,
      isPrep ? TASTE_THEME.colors.success : TASTE_THEME.colors.slateNeutral,
      () => {
        if (!isPrep) {
          this.shopScene.showToast(
            '🔒 Đang mở bán! Chỉ được nhập hàng trước giờ mở bán!',
            TASTE_THEME.colors.accentAmber
          );
          return;
        }
        const res = this.shopScene.inventorySystem.restockAllLowFoods();
        if (res.restockedCount > 0) {
          SoundManager.playCash();
          this.shopScene.showToast(
            `📦 Đã nhập thêm ${res.restockedCount} lô hàng (-${this.gs.formatCurrency(res.totalSpent)})`,
            TASTE_THEME.colors.success
          );
        } else {
          this.shopScene.showToast(
            'Kho đã đầy hoặc chưa đủ tiền vốn!',
            TASTE_THEME.colors.accentAmber
          );
        }
        this.renderCurrentTab();
      }
    );
    this.contentContainer.add([gasBtn, restockAllBtn]);

    // 3. Paginated Food Stock Rows (`y = 178 + idx * 70`, height = 62px -> 4 rows end at `y = 450`)
    const perPage = 4;
    const unlockedPages = Math.max(1, Math.ceil(unlockedFoods.length / perPage));
    const lockedPages = Math.ceil(lockedFoods.length / perPage);
    const totalPages = unlockedPages + lockedPages;

    if (this.pageIndex >= totalPages) this.pageIndex = totalPages - 1;
    if (this.pageIndex < 0) this.pageIndex = 0;

    const isViewingUnlocked = this.pageIndex < unlockedPages;
    const items = isViewingUnlocked
      ? unlockedFoods.slice(this.pageIndex * perPage, (this.pageIndex + 1) * perPage)
      : lockedFoods.slice(
          (this.pageIndex - unlockedPages) * perPage,
          (this.pageIndex - unlockedPages + 1) * perPage
        );

    const maxStorage = this.gs.getMaxStorageCapacity();
    const maxTray = this.gs.getMaxTrayCapacity();

    const rowBtnW = this.isDesktop ? 108 : 88;
    const rowBtnCenterX = W - 16 - 10 - rowBtnW / 2;
    const rowBtnLeftEdge = rowBtnCenterX - rowBtnW / 2;
    const textStartX = 76;
    const maxRowTextW = rowBtnLeftEdge - textStartX - 12;

    items.forEach((food, idx) => {
      const y = 178 + idx * 70;
      const rowH = 62;
      const st = this.gs.state.foods[food.id];
      const isUnlocked = st?.unlocked ?? false;

      const row = this.add.graphics();
      row.fillStyle(isUnlocked ? 0xffffff : TASTE_THEME.colors.cardWarmAlt, 1);
      row.fillRoundedRect(16, y, W - 32, rowH, 10);
      row.lineStyle(
        1,
        isUnlocked ? TASTE_THEME.colors.borderHairlineLight : TASTE_THEME.colors.borderHairlineDark,
        isUnlocked ? 1 : 0.6
      );
      row.strokeRoundedRect(16, y, W - 32, rowH, 10);

      const icon = this.add.image(46, y + rowH / 2, food.textureKey).setScale(0.185);
      if (!isUnlocked) {
        icon.setAlpha(0.45);
      }

      const titlePrefix = isUnlocked ? '' : '🔒 ';
      const title = this.add.text(textStartX, y + 10, `${titlePrefix}${food.name}`, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop ? '13.5px' : '12px',
        fontStyle: '800',
        color: isUnlocked ? TASTE_THEME.colors.inkDark : TASTE_THEME.colors.inkMuted,
      });
      if (title.width > maxRowTextW) {
        title.setScale(maxRowTextW / title.width);
      }

      let stockStr: string;
      let stockColor: string;

      if (isUnlocked) {
        stockStr = this.isDesktop
          ? `Trữ đông: ${st.rawStock}/${maxStorage}   •   Trên khay: ${st.cookedStock}/${maxTray}`
          : `Kho: ${st.rawStock}/${maxStorage}  •  Khay: ${st.cookedStock}/${maxTray}`;
        stockColor = st.rawStock < food.batchYield ? '#c92a2a' : '#1f8a4c';
      } else {
        const canUnlockNow =
          this.gs.state.level >= food.unlockLevel && this.gs.state.money >= food.unlockCost;
        if (canUnlockNow) {
          stockStr = `✨ Đủ điều kiện mở! Phí mở: ${this.gs.formatCurrency(food.unlockCost)} (+35 XP)`;
          stockColor = '#1f8a4c';
        } else if (this.gs.state.level >= food.unlockLevel) {
          stockStr = `Cần ${this.gs.formatCurrency(food.unlockCost)} để mở bán món này`;
          stockColor = '#d97706';
        } else {
          stockStr = `Mở khóa tại Cấp ${food.unlockLevel} • Phí mở: ${this.gs.formatCurrency(food.unlockCost)}`;
          stockColor = '#7c6552';
        }
      }

      const stockInfo = this.add.text(textStartX, y + 34, stockStr, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop ? '11.5px' : '10.5px',
        fontStyle: '700',
        color: stockColor,
      });
      if (stockInfo.width > maxRowTextW) {
        stockInfo.setScale(maxRowTextW / stockInfo.width);
      }

      this.contentContainer.add([row, icon, title, stockInfo]);

      if (isUnlocked) {
        const canBuy = isPrep && st.rawStock < maxStorage;
        const btnLabel = !isPrep
          ? '🔒 Đang bán'
          : st.rawStock >= maxStorage
            ? 'Kho Đầy'
            : `+${food.restockBatchSize} Phần\n${(food.buyCost / 1000).toFixed(0)}K`;

        const btn = this.createActionButton(
          rowBtnCenterX,
          y + rowH / 2,
          rowBtnW,
          42,
          btnLabel,
          canBuy ? TASTE_THEME.colors.infoTeal : TASTE_THEME.colors.slateNeutral,
          () => {
            if (!isPrep) {
              this.shopScene.showToast(
                '🔒 Đang mở bán! Chỉ được nhập hàng trước giờ mở bán!',
                TASTE_THEME.colors.accentAmber
              );
              return;
            }
            const res = this.gs.restockIngredient(food.id);
            if (!res.ok && res.reason) {
              this.shopScene.showToast(res.reason, TASTE_THEME.colors.danger);
            } else {
              this.renderCurrentTab();
            }
          }
        );
        this.contentContainer.add(btn);
      } else {
        const canUnlock =
          this.gs.state.level >= food.unlockLevel && this.gs.state.money >= food.unlockCost;
        let btnText: string;
        let btnColor: number;

        if (canUnlock) {
          btnText = `Mở Món\n${(food.unlockCost / 1000).toFixed(0)}K`;
          btnColor = TASTE_THEME.colors.accentPrimary;
        } else if (this.gs.state.level < food.unlockLevel) {
          btnText = `Cần Cấp ${food.unlockLevel}`;
          btnColor = TASTE_THEME.colors.slateNeutral;
        } else {
          btnText = `Thiếu Tiền\n${(food.unlockCost / 1000).toFixed(0)}K`;
          btnColor = TASTE_THEME.colors.slateNeutral;
        }

        const btn = this.createActionButton(
          rowBtnCenterX,
          y + rowH / 2,
          rowBtnW,
          42,
          btnText,
          btnColor,
          () => {
            if (!canUnlock) {
              if (this.gs.state.level < food.unlockLevel) {
                this.shopScene.showToast(
                  `🔒 Cần đạt Cấp ${food.unlockLevel} để mở món này!`,
                  TASTE_THEME.colors.accentAmber
                );
              } else {
                this.shopScene.showToast(
                  `Cần ${this.gs.formatCurrency(food.unlockCost)} để mở món này!`,
                  TASTE_THEME.colors.danger
                );
              }
              return;
            }

            const res = this.gs.unlockFood(food.id);
            if (res.ok) {
              SoundManager.playCash();
              this.shopScene.showToast(
                `🎉 Đã mở khóa ${food.name}! Món đã được chuyển sang danh sách Đang Bán.`,
                TASTE_THEME.colors.success
              );
              this.renderCurrentTab();
            } else if (res.reason) {
              this.shopScene.showToast(res.reason, TASTE_THEME.colors.danger);
            }
          }
        );
        this.contentContainer.add(btn);
      }
    });

    // Helpful Callout Card when unlocked page has less than 4 items
    if (isViewingUnlocked && items.length < perPage && lockedFoods.length > 0) {
      const emptyIdx = items.length;
      const y = 178 + emptyIdx * 70;
      const rowH = 62;

      const calloutBg = this.add.graphics();
      calloutBg.fillStyle(TASTE_THEME.colors.cardWarmAlt, 1);
      calloutBg.fillRoundedRect(16, y, W - 32, rowH, 10);
      calloutBg.lineStyle(1, TASTE_THEME.colors.borderAccent, 0.7);
      calloutBg.strokeRoundedRect(16, y, W - 32, rowH, 10);

      const lockIcon = this.add.text(46, y + rowH / 2, '🔒', { fontSize: '20px' }).setOrigin(0.5);

      const calloutTitle = this.add.text(
        textStartX,
        y + 12,
        `Còn ${lockedFoods.length} món chưa mở khóa ở các trang sau`,
        {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: this.isDesktop ? '13px' : '11.5px',
          fontStyle: '800',
          color: TASTE_THEME.colors.inkDark,
        }
      );
      if (calloutTitle.width > maxRowTextW) {
        calloutTitle.setScale(maxRowTextW / calloutTitle.width);
      }

      const calloutSub = this.add.text(
        textStartX,
        y + 34,
        'Lên cấp & mở món mới để bán được nhiều tiền hơn',
        {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: this.isDesktop ? '11px' : '10px',
          fontStyle: '500',
          color: TASTE_THEME.colors.inkMuted,
        }
      );
      if (calloutSub.width > maxRowTextW) {
        calloutSub.setScale(maxRowTextW / calloutSub.width);
      }

      const viewLockedBtn = this.createActionButton(
        rowBtnCenterX,
        y + rowH / 2,
        rowBtnW,
        42,
        'Xem Món\nChưa Mở ▶',
        TASTE_THEME.colors.infoTeal,
        () => {
          this.pageIndex = unlockedPages;
          this.renderCurrentTab();
        }
      );

      this.contentContainer.add([calloutBg, lockIcon, calloutTitle, calloutSub, viewLockedBtn]);
    }

    // Return to Page 1 Callout Card when on the last page of locked items
    if (!isViewingUnlocked && items.length < perPage) {
      const emptyIdx = items.length;
      const y = 178 + emptyIdx * 70;
      const rowH = 62;

      const calloutBg = this.add.graphics();
      calloutBg.fillStyle(TASTE_THEME.colors.cardWarmAlt, 1);
      calloutBg.fillRoundedRect(16, y, W - 32, rowH, 10);
      calloutBg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 0.6);
      calloutBg.strokeRoundedRect(16, y, W - 32, rowH, 10);

      const bulbIcon = this.add.text(46, y + rowH / 2, '💡', { fontSize: '20px' }).setOrigin(0.5);

      const calloutTitle = this.add.text(
        textStartX,
        y + 12,
        'Đã hiển thị hết danh sách món chưa mở khóa',
        {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: this.isDesktop ? '13px' : '11.5px',
          fontStyle: '800',
          color: TASTE_THEME.colors.inkDark,
        }
      );
      if (calloutTitle.width > maxRowTextW) {
        calloutTitle.setScale(maxRowTextW / calloutTitle.width);
      }

      const calloutSub = this.add.text(
        textStartX,
        y + 34,
        'Bấm nút bên phải để quay lại danh sách món đang bán',
        {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: this.isDesktop ? '11px' : '10px',
          fontStyle: '500',
          color: TASTE_THEME.colors.inkMuted,
        }
      );
      if (calloutSub.width > maxRowTextW) {
        calloutSub.setScale(maxRowTextW / calloutSub.width);
      }

      const backBtn = this.createActionButton(
        rowBtnCenterX,
        y + rowH / 2,
        rowBtnW,
        42,
        '◀ Về Món\nĐang Bán',
        TASTE_THEME.colors.bgSurface,
        () => {
          this.pageIndex = 0;
          this.renderCurrentTab();
        }
      );

      this.contentContainer.add([calloutBg, bulbIcon, calloutTitle, calloutSub, backBtn]);
    }

    // 4. Pagination Controls
    const paginationY = isPrep ? 484 : this.modalH - 36;
    const pageLabel = isViewingUnlocked
      ? `Trang ${this.pageIndex + 1} / ${totalPages} • Đang Bán (${unlockedFoods.length} món)`
      : `Trang ${this.pageIndex + 1} / ${totalPages} • Chưa Mở (${lockedFoods.length} món)`;
    this.renderPaginationControls(totalPages, paginationY, pageLabel);

    // 5. Primary CTA to Start Selling Day (`y = 548`, height = 46 -> spans `525..571`)
    if (isPrep) {
      const startDayLabel = this.isDesktop
        ? `🌅 BẮT ĐẦU MỞ BÁN NGÀY ${this.gs.state.day} (CA BÁN 6 PHÚT)`
        : `🌅 BẮT ĐẦU MỞ BÁN NGÀY ${this.gs.state.day}`;

      const startDayBtn = this.createActionButton(
        W / 2,
        548,
        W - 32,
        46,
        startDayLabel,
        TASTE_THEME.colors.accentPrimary,
        () => {
          this.shopScene.startSellingDayFromPrep();
        }
      );
      this.contentContainer.add(startDayBtn);
    }
  }

  private renderMissionTab(): void {
    const W = this.modalW;
    const btnW = this.isDesktop ? 98 : 84;
    const btnCenterX = W - 16 - 10 - btnW / 2;
    const btnLeftEdge = btnCenterX - btnW / 2;
    const textStartX = 28;
    const maxTextW = btnLeftEdge - textStartX - 10;

    INITIAL_MISSIONS.forEach((m, idx) => {
      const y = 104 + idx * 80;
      const prog = this.gs.getMissionProgress(m.id);

      const row = this.add.graphics();
      row.fillStyle(0xffffff, 1);
      row.fillRoundedRect(16, y, W - 32, 72, 10);
      row.lineStyle(
        1,
        prog.completed ? TASTE_THEME.colors.success : TASTE_THEME.colors.borderHairlineLight,
        1
      );
      row.strokeRoundedRect(16, y, W - 32, 72, 10);

      const title = this.add.text(textStartX, y + 9, `${m.title} (${prog.current}/${prog.target})`, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop ? '13.5px' : '12px',
        fontStyle: '800',
        color: TASTE_THEME.colors.inkDark,
      });
      if (title.width > maxTextW) title.setScale(maxTextW / title.width);

      const desc = this.add.text(textStartX, y + 29, m.description, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop ? '11.5px' : '10.5px',
        fontStyle: '500',
        color: TASTE_THEME.colors.inkBody,
      });
      if (desc.width > maxTextW) desc.setScale(maxTextW / desc.width);

      const reward = this.add.text(
        textStartX,
        y + 49,
        `Thưởng: +${this.gs.formatCurrency(m.rewardMoney)}  •  +${m.rewardDiamonds}💎  •  +${m.rewardXp} XP`,
        {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: this.isDesktop ? '11px' : '10px',
          fontStyle: '700',
          color: '#b45309',
        }
      );
      if (reward.width > maxTextW) reward.setScale(maxTextW / reward.width);

      this.contentContainer.add([row, title, desc, reward]);

      const btn = this.createActionButton(
        btnCenterX,
        y + 36,
        btnW,
        40,
        prog.claimed ? 'ĐÃ NHẬN' : prog.completed ? 'NHẬN QUÀ' : 'Đang làm',
        prog.claimed
          ? TASTE_THEME.colors.slateNeutral
          : prog.completed
            ? TASTE_THEME.colors.success
            : TASTE_THEME.colors.accentAmber,
        () => {
          if (this.gs.claimMission(m.id)) {
            this.renderCurrentTab();
          }
        }
      );
      this.contentContainer.add(btn);
    });
  }

  private renderAchievementTab(): void {
    const W = this.modalW;
    const btnW = this.isDesktop ? 98 : 84;
    const btnCenterX = W - 16 - 10 - btnW / 2;
    const btnLeftEdge = btnCenterX - btnW / 2;
    const textStartX = 72;
    const maxTextW = btnLeftEdge - textStartX - 10;

    ACHIEVEMENTS.forEach((ach, idx) => {
      const y = 108 + idx * 90;
      const prog = this.gs.getAchievementProgress(ach.id);

      const row = this.add.graphics();
      row.fillStyle(0xffffff, 1);
      row.fillRoundedRect(16, y, W - 32, 80, 10);
      row.lineStyle(1, TASTE_THEME.colors.borderHairlineLight, 1);
      row.strokeRoundedRect(16, y, W - 32, 80, 10);

      const ic = this.add.text(44, y + 40, ach.icon, { fontSize: '24px' }).setOrigin(0.5);
      const title = this.add.text(textStartX, y + 10, `${ach.title}`, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop ? '14px' : '12.5px',
        fontStyle: '800',
        color: TASTE_THEME.colors.inkDark,
      });
      if (title.width > maxTextW) title.setScale(maxTextW / title.width);

      const desc = this.add.text(
        textStartX,
        y + 32,
        `${ach.description} (${prog.current}/${prog.target})`,
        {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: this.isDesktop ? '11.5px' : '10.5px',
          fontStyle: '500',
          color: TASTE_THEME.colors.inkBody,
        }
      );
      if (desc.width > maxTextW) desc.setScale(maxTextW / desc.width);

      const rew = this.add.text(textStartX, y + 54, `Phần thưởng: +${ach.rewardDiamonds} 💎`, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop ? '11.5px' : '10.5px',
        fontStyle: '700',
        color: '#0f766e',
      });

      this.contentContainer.add([row, ic, title, desc, rew]);

      const btn = this.createActionButton(
        btnCenterX,
        y + 40,
        btnW,
        40,
        prog.claimed ? 'ĐÃ NHẬN' : prog.completed ? 'NHẬN 💎' : 'Chưa đạt',
        prog.claimed
          ? TASTE_THEME.colors.slateNeutral
          : prog.completed
            ? TASTE_THEME.colors.success
            : TASTE_THEME.colors.slateNeutral,
        () => {
          if (this.gs.claimAchievement(ach.id)) {
            this.renderCurrentTab();
          }
        }
      );
      this.contentContainer.add(btn);
    });
  }

  private renderDailyResultTab(): void {
    const W = this.modalW;
    const d = this.gs.dailyStats;
    const totalExpenses =
      d.ingredientCost +
      d.gasCost +
      (d.oilCost || 0) +
      (d.veggieCost || 0) +
      (d.wastedFoodCost || 0);
    const netProfit = d.revenue + d.tipsEarned - totalExpenses;
    const daySys = this.shopScene.daySystem;

    // Reason banner at top of daily report
    const reasonBg = this.add.graphics();
    const isEnded = daySys.phase === 'ended';
    reasonBg.fillStyle(isEnded ? 0xfef3c7 : 0xe6f4ea, 1);
    reasonBg.fillRoundedRect(20, 104, W - 40, 32, 8);
    reasonBg.lineStyle(
      1,
      isEnded ? TASTE_THEME.colors.accentAmber : TASTE_THEME.colors.success,
      0.6
    );
    reasonBg.strokeRoundedRect(20, 104, W - 40, 32, 8);

    const reasonTxt = this.add
      .text(W / 2, 120, daySys.getEndReasonLabel(), {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop ? '12px' : '11px',
        fontStyle: '800',
        color: isEnded ? '#92400e' : '#1f8a4c',
      })
      .setOrigin(0.5);
    if (reasonTxt.width > W - 56) {
      reasonTxt.setScale((W - 56) / reasonTxt.width);
    }
    this.contentContainer.add([reasonBg, reasonTxt]);

    const card = this.add.graphics();
    card.fillStyle(0xffffff, 1);
    card.fillRoundedRect(20, 144, W - 40, 340, 12);
    card.lineStyle(1, TASTE_THEME.colors.borderHairlineLight, 1);
    card.strokeRoundedRect(20, 144, W - 40, 340, 12);
    this.contentContainer.add(card);

    const lines: Array<[string, string, string]> = [
      ['Khách phục vụ thành công', `${d.customersServed} lượt`, '#1f8a4c'],
      ['Khách bỏ đi (quá giờ)', `${d.customersMissed} lượt`, '#c92a2a'],
      ['Doanh thu bán hàng', `+${this.gs.formatCurrency(d.revenue)}`, '#1f8a4c'],
      ['Tiền Tip khách thưởng', `+${this.gs.formatCurrency(d.tipsEarned)}`, '#0f766e'],
      ['Chi phí nhập nguyên liệu', `-${this.gs.formatCurrency(d.ingredientCost)}`, '#c92a2a'],
      ['Chi phí bơm bình Gas', `-${this.gs.formatCurrency(d.gasCost)}`, '#c92a2a'],
    ];

    if ((d.oilCost || 0) > 0) {
      lines.push(['Chi phí thay dầu chiên', `-${this.gs.formatCurrency(d.oilCost!)}`, '#c92a2a']);
    }
    if ((d.veggieCost || 0) > 0) {
      lines.push(['Chi phí mua rau ăn kèm', `-${this.gs.formatCurrency(d.veggieCost!)}`, '#c92a2a']);
    }
    if ((d.wastedFoodCount || 0) > 0) {
      lines.push([
        `Đồ chiên ế bỏ đi (${d.wastedFoodCount} xiên)`,
        `-${this.gs.formatCurrency(d.wastedFoodCost || 0)}`,
        '#d97706',
      ]);
    }

    lines.push(['────────────────────', '──────────', '#9ca3af']);
    lines.push([
      'LỢI NHUẬN RÒNG HÔM NAY',
      `${netProfit >= 0 ? '+' : ''}${this.gs.formatCurrency(netProfit)}`,
      netProfit >= 0 ? '#1f8a4c' : '#c92a2a',
    ]);

    const lineSpacing = Math.min(32, Math.floor(300 / lines.length));
    lines.forEach(([label, val, color], idx) => {
      const ly = 158 + idx * lineSpacing;
      const isTotal = idx === lines.length - 1;
      const lTxt = this.add.text(36, ly, label, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: isTotal ? '13px' : '11.5px',
        fontStyle: isTotal ? '800' : '600',
        color: TASTE_THEME.colors.inkDark,
      });
      const vTxt = this.add
        .text(W - 36, ly, val, {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: isTotal ? '13.5px' : '12px',
          fontStyle: '800',
          color,
        })
        .setOrigin(1, 0);
      this.contentContainer.add([lTxt, vTxt]);
    });

    if (daySys.phase === 'ended') {
      const nextBtn = this.createActionButton(
        W / 2,
        504,
        Math.min(320, W - 40),
        50,
        `📦 NHẬP HÀNG CHO NGÀY ${this.gs.state.day + 1} ▶`,
        TASTE_THEME.colors.success,
        () => {
          this.shopScene.enterPrepForDay(true);
        }
      );
      this.contentContainer.add(nextBtn);
    } else if (daySys.phase === 'prep') {
      const prepBtn = this.createActionButton(
        W / 2,
        504,
        Math.min(310, W - 40),
        50,
        `📦 QUAY LẠI NHẬP HÀNG & MỞ BÁN`,
        TASTE_THEME.colors.infoTeal,
        () => {
          this.currentTab = 'inventory';
          this.pageIndex = 0;
          this.renderCurrentTab();
        }
      );
      this.contentContainer.add(prepBtn);
    } else {
      const nextBtn = this.createActionButton(
        W / 2,
        496,
        268,
        48,
        '▶ TIẾP TỤC BÁN HÀNG',
        TASTE_THEME.colors.success,
        () => {
          this.closeModal();
        }
      );
      this.contentContainer.add(nextBtn);

      const endEarlyBtn = this.createActionButton(
        W / 2,
        558,
        250,
        42,
        '🌙 Đóng Quán Sớm & Kết Thúc Ngày',
        TASTE_THEME.colors.accentPrimary,
        () => {
          this.shopScene.daySystem.endDayEarly();
          this.renderCurrentTab();
        }
      );
      this.contentContainer.add(endEarlyBtn);
    }
  }

  private renderSettingsTab(): void {
    const W = this.modalW;
    const soundBtn = this.createActionButton(
      W / 2,
      168,
      276,
      48,
      SoundManager.enabled ? '🔊 Âm Thanh: ĐANG BẬT' : '🔇 Âm Thanh: ĐANG TẮT',
      TASTE_THEME.colors.infoTeal,
      () => {
        SoundManager.enabled = !SoundManager.enabled;
        this.gs.state.soundEnabled = SoundManager.enabled;
        this.gs.save();
        this.renderCurrentTab();
      }
    );

    const resumeBtn = this.createActionButton(
      W / 2,
      232,
      276,
      48,
      '▶ TIẾP TỤC KINH DOANH',
      TASTE_THEME.colors.success,
      () => this.closeModal()
    );

    const menuBtn = this.createActionButton(
      W / 2,
      296,
      276,
      48,
      '🏠 VỀ MÀN HÌNH CHÍNH',
      TASTE_THEME.colors.accentAmber,
      () => {
        this.gs.save();
        this.scene.stop('ModalScene');
        this.scene.stop('ShopScene');
        this.scene.start('MenuScene');
      }
    );

    const tutorialBtn = this.createActionButton(
      W / 2,
      356,
      276,
      44,
      '📖 Cẩm Nang Hướng Dẫn Ngày 1',
      TASTE_THEME.colors.accentPrimary,
      () => {
        this.currentTab = 'tutorial';
        this.pageIndex = 0;
        this.renderCurrentTab();
      }
    );

    const resetBtn = this.createActionButton(
      W / 2,
      412,
      276,
      42,
      '🗑️ Xóa Dữ Liệu & Chơi Lại',
      TASTE_THEME.colors.danger,
      () => {
        this.gs.initState(true);
        this.scene.stop('ModalScene');
        this.scene.stop('ShopScene');
        this.scene.start('MenuScene');
      }
    );

    const guideCard = this.add.graphics();
    guideCard.fillStyle(TASTE_THEME.colors.cardWarmAlt, 1);
    guideCard.fillRoundedRect(24, 468, W - 48, 126, 10);
    guideCard.lineStyle(1, TASTE_THEME.colors.borderHairlineLight, 1);
    guideCard.strokeRoundedRect(24, 468, W - 48, 126, 10);

    const guideTxt = this.add
      .text(
        W / 2,
        531,
        '💡 PHÍM TẮT NHANH:\n• [Space]: Mở bán / Vớt cá / Phục vụ khách\n• [1..6]: Chọn nhanh món để chiên vào chảo\n• [R]: Nạp đầy bình Gas & Nhập kho nhanh',
        {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: '12px',
          fontStyle: '600',
          color: TASTE_THEME.colors.inkBody,
          align: 'center',
          lineSpacing: 6,
          wordWrap: { width: W - 76 },
        }
      )
      .setOrigin(0.5);

    this.contentContainer.add([soundBtn, resumeBtn, menuBtn, tutorialBtn, resetBtn, guideCard, guideTxt]);
  }

  private renderTutorialTab(): void {
    const W = this.modalW;
    const totalSteps = 4;
    const step = Phaser.Math.Clamp(this.pageIndex, 0, totalSteps - 1);

    // 1. Step Indicator Pills Row
    const stepLabels = ['1. Nhập Kho', '2. Chiên Món', '3. Phục Vụ', '4. Khách VIP'];
    const pillGap = this.isDesktop ? 8 : 4;
    const availPillW = W - 32;
    const pillW = (availPillW - pillGap * (totalSteps - 1)) / totalSteps;
    const pillY = 112;

    stepLabels.forEach((label, idx) => {
      const px = 16 + idx * (pillW + pillGap) + pillW / 2;
      const isCurrent = idx === step;
      const isPast = idx < step;
      const pillBg = this.add.graphics();
      pillBg.fillStyle(
        isCurrent
          ? TASTE_THEME.colors.accentPrimary
          : isPast
            ? TASTE_THEME.colors.accentAmber
            : TASTE_THEME.colors.cardWarmAlt,
        1
      );
      pillBg.fillRoundedRect(px - pillW / 2, pillY - 14, pillW, 28, 6);
      pillBg.lineStyle(
        1,
        isCurrent ? TASTE_THEME.colors.accentPrimary : TASTE_THEME.colors.borderHairlineLight,
        1
      );
      pillBg.strokeRoundedRect(px - pillW / 2, pillY - 14, pillW, 28, 6);

      const pillTxt = this.add
        .text(px, pillY, label, {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: this.isDesktop ? '11px' : '9.5px',
          fontStyle: isCurrent ? '800' : '600',
          color: isCurrent || isPast ? '#ffffff' : TASTE_THEME.colors.inkDark,
        })
        .setOrigin(0.5);

      const hit = this.add
        .rectangle(px, pillY, pillW, 28, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        SoundManager.playPop();
        this.pageIndex = idx;
        this.renderCurrentTab();
      });

      this.contentContainer.add([pillBg, pillTxt, hit]);
    });

    // 2. Main Tutorial Step Card
    const cardY = 138;
    const cardH = this.modalH - 208;
    const cardBg = this.add.graphics();
    cardBg.fillStyle(0xffffff, 1);
    cardBg.fillRoundedRect(16, cardY, W - 32, cardH, 12);
    cardBg.lineStyle(1, TASTE_THEME.colors.borderHairlineLight, 1);
    cardBg.strokeRoundedRect(16, cardY, W - 32, cardH, 12);
    this.contentContainer.add(cardBg);

    // Step-specific details
    const stepConfigs = [
      {
        badge: 'BƯỚC 1: CHUẨN BỊ MỞ BÁN',
        badgeColor: TASTE_THEME.colors.infoTeal,
        title: '📦 Kiểm Tra Kho Nguyên Liệu & Bơm Bình Gas',
        desc:
          'Trước giờ mở bán xe cá viên mỗi sáng, hãy chuẩn bị 2 thứ sống còn:\n\n' +
          '• ⛽ BÌNH GAS ĐẦU NGÀY: Đun sôi dầu trong chảo. Hết gas = không thể chiên cá!\n\n' +
          '• 📦 KHO NGUYÊN LIỆU: Nhập sẵn các bịch cá viên, bò viên, tôm viên, đậu hũ...\n\n' +
          '• 🌅 BẤM "MỞ BÁN NGAY": Khi xong chuẩn bị, nhấn nút to màu xanh hoặc phím [Space] để mở cửa xe đón khách vỉa hè!',
        tip: '💡 Mẹo Ngày 1: Quán đã được cấp sẵn 350.000đ vốn và bình gas đầy để bạn khởi nghiệp!',
      },
      {
        badge: 'BƯỚC 2: KỸ NGHỆ CHIÊN RÁN',
        badgeColor: TASTE_THEME.colors.accentPrimary,
        title: '🍳 Canh Thời Gian Chiên Vừa Chín Vàng Giòn Rụm',
        desc:
          'Chiên cá viên là nghệ thuật canh lửa chuẩn xác của đầu bếp:\n\n' +
          '• 1. CHỌN MÓN: Chạm vào khay món ở tủ kính bên phải (hoặc phím tắt [1..6]).\n\n' +
          '• 2. QUAN SÁT THANH TIẾN ĐỘ DẦU SÔI:\n' +
          '   - 🟡 Đang sôi: Chưa chín, vớt sớm khách sẽ chê!\n' +
          '   - 🟢 CHÍN VÀNG GIÒN: Vớt ngay lúc này để nhận thưởng +15 XP!\n' +
          '   - 🔴 CHÁY KHÉT: Sau khi chín chỉ có 5 giây để vớt trước khi bị khét đen, phải đổ bỏ!',
        tip: '💡 Mẹo: Bấm trực tiếp vào chảo dầu hoặc phím [Space] để vớt nhanh mẻ chín lên khay!',
      },
      {
        badge: 'BƯỚC 3: PHỤC VỤ KHÁCH HÀNG',
        badgeColor: TASTE_THEME.colors.success,
        title: '🛎️ Giao Món Nóng Hổi & Nhận Tiền Tip Hậu Hĩnh',
        desc:
          'Khách hàng sẽ lần lượt ghé xe đứng chờ và gọi món:\n\n' +
          '• 💬 BONG BÓNG YÊU CẦU: Hiển thị hình món ăn và số lượng xiên khách cần.\n\n' +
          '• ✓ NÚT PHỤC VỤ XANH LÁ: Khi trên khay đã đủ món chín, nút sẽ sáng rực lên!\n\n' +
          '• 💰 TÍNH TIỀN & TIP: Chạm vào khách hoặc bấm phím [Space] để giao hàng. Phục vụ càng nhanh khách càng vui, tip càng nhiều tiền và tăng sao đánh giá 5★!',
        tip: '💡 Mẹo: Luôn chiên sẵn 2-3 phần cá viên trước trên khay để khách tới là có giao liền!',
      },
      {
        badge: 'BƯỚC 4: KHÁCH ĐẶC BIỆT',
        badgeColor: TASTE_THEME.colors.accentAmber,
        title: '👑 Khách VIP Triệu View & ⚡ Khách Xấu Tính',
        desc:
          'Quán cá viên của bạn sẽ đón những vị khách vô cùng thú vị:\n\n' +
          '• 👑 KHÁCH VIP (Food Reviewer / Đại Gia):\n' +
          '   - Huy hiệu vàng óng, gọi combo lớn 3-5 món.\n' +
          '   - Thưởng cực khủng: x2.5 TIỀN TIP, nhận +55 XP và đánh giá 5★!\n\n' +
          '• ⚡ KHÁCH XẤU TÍNH (Đầu Gấu / Khách Bặm Trợn):\n' +
          '   - Huy hiệu viền đỏ cảnh báo, cực kỳ thiếu kiên nhẫn (chỉ đợi 16 giây!).\n' +
          '   - Nếu để họ giận bỏ đi, quán sẽ bị phạt tụt nặng xuống 1.0★! Hãy ưu tiên phục vụ sớm!',
        tip: '💡 Nhắc nhở: Khi đã hiểu rõ cách vận hành, hãy bấm nút bắt đầu bên dưới để mở bán Ngày 1!',
      },
    ];

    const cur = stepConfigs[step];

    // Badge
    const badgeW = 190;
    const badgeBg = this.add.graphics();
    badgeBg.fillStyle(cur.badgeColor, 1);
    badgeBg.fillRoundedRect(28, cardY + 14, badgeW, 20, 6);
    const badgeTxt = this.add
      .text(28 + badgeW / 2, cardY + 24, cur.badge, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '10px',
        fontStyle: '800',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Title
    const titleTxt = this.add
      .text(28, cardY + 44, cur.title, {
        fontFamily: TASTE_THEME.fonts.display,
        fontSize: this.isDesktop ? '15.5px' : '13.5px',
        fontStyle: 'bold',
        color: TASTE_THEME.colors.inkDark,
        wordWrap: { width: W - 56 },
      })
      .setOrigin(0, 0);

    // Description body
    const descTxt = this.add
      .text(28, cardY + 72, cur.desc, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop ? '12px' : '11px',
        fontStyle: '500',
        color: TASTE_THEME.colors.inkBody,
        lineSpacing: 4,
        wordWrap: { width: W - 56 },
      })
      .setOrigin(0, 0);

    // Tip Callout Box at bottom of card
    const tipBoxY = cardY + cardH - 64;
    const tipBg = this.add.graphics();
    tipBg.fillStyle(TASTE_THEME.colors.cardWarmAlt, 1);
    tipBg.fillRoundedRect(28, tipBoxY, W - 56, 48, 8);
    tipBg.lineStyle(1, cur.badgeColor, 0.4);
    tipBg.strokeRoundedRect(28, tipBoxY, W - 56, 48, 8);

    const tipTxt = this.add
      .text(W / 2, tipBoxY + 24, cur.tip, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop ? '11px' : '10px',
        fontStyle: '600',
        color: TASTE_THEME.colors.inkDark,
        align: 'center',
        wordWrap: { width: W - 72 },
      })
      .setOrigin(0.5);

    this.contentContainer.add([
      badgeBg,
      badgeTxt,
      titleTxt,
      descTxt,
      tipBg,
      tipTxt,
    ]);

    // 3. Bottom Controls Row
    const botY = this.modalH - 34;
    const btnW = this.isDesktop ? 120 : 100;

    // Previous step button
    if (step > 0) {
      const prevBtn = this.createActionButton(
        16 + btnW / 2,
        botY,
        btnW,
        36,
        '◀ Bước trước',
        TASTE_THEME.colors.bgSurface,
        () => {
          this.pageIndex = step - 1;
          this.renderCurrentTab();
        }
      );
      this.contentContainer.add(prevBtn);
    }

    // Next step or Finish button
    if (step < totalSteps - 1) {
      const nextBtn = this.createActionButton(
        W - 16 - btnW / 2,
        botY,
        btnW,
        36,
        'Bước sau ▶',
        TASTE_THEME.colors.accentPrimary,
        () => {
          this.pageIndex = step + 1;
          this.renderCurrentTab();
        }
      );
      this.contentContainer.add(nextBtn);

      // Skip button in middle
      const skipTxt = this.add
        .text(W / 2, botY, 'Vào bán ngay ➔', {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: '11.5px',
          fontStyle: '700',
          color: TASTE_THEME.colors.inkMutedOnDark,
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      skipTxt.on('pointerdown', () => {
        this.finishTutorialAndStartDay();
      });
      this.contentContainer.add(skipTxt);
    } else {
      // Final CTA on Step 4
      const startBtnW = this.isDesktop ? 260 : 210;
      const startBtn = this.createActionButton(
        W / 2,
        botY,
        startBtnW,
        38,
        '🚀 BẮT ĐẦU MỞ BÁN NGÀY 1',
        TASTE_THEME.colors.success,
        () => {
          this.finishTutorialAndStartDay();
        }
      );
      this.contentContainer.add(startBtn);
    }
  }

  private finishTutorialAndStartDay(): void {
    this.gs.state.tutorialSeen = true;
    this.gs.save();
    SoundManager.playCash();
    this.currentTab = 'inventory';
    this.pageIndex = 0;
    this.renderCurrentTab();
    if (this.shopScene) {
      this.shopScene.showToast(
        '🎉 Bạn đã nắm rõ luật chơi! Hãy nhập hàng và bấm "MỞ BÁN NGAY" (phím Space)!',
        TASTE_THEME.colors.success
      );
    }
  }

  private renderPaginationControls(
    totalPages: number,
    customY?: number,
    customLabel?: string
  ): void {
    if (totalPages <= 1) return;
    const W = this.modalW;
    const py = customY ?? this.modalH - 36;
    const btnW = this.isDesktop ? 112 : 96;

    const prevBtn = this.createActionButton(
      16 + btnW / 2,
      py,
      btnW,
      34,
      '◀ Trang trước',
      this.pageIndex > 0 ? TASTE_THEME.colors.bgSurface : TASTE_THEME.colors.slateNeutral,
      () => {
        if (this.pageIndex > 0) {
          this.pageIndex--;
          this.renderCurrentTab();
        }
      }
    );

    const pageLbl = this.add
      .text(W / 2, py, customLabel ?? `Trang ${this.pageIndex + 1} / ${totalPages}`, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: this.isDesktop ? '12px' : '11px',
        fontStyle: '700',
        color: TASTE_THEME.colors.inkDark,
      })
      .setOrigin(0.5);

    const maxLblW = W - 32 - btnW * 2 - 12;
    if (pageLbl.width > maxLblW) {
      pageLbl.setScale(maxLblW / pageLbl.width);
    }

    const nextBtn = this.createActionButton(
      W - 16 - btnW / 2,
      py,
      btnW,
      34,
      'Trang sau ▶',
      this.pageIndex < totalPages - 1
        ? TASTE_THEME.colors.bgSurface
        : TASTE_THEME.colors.slateNeutral,
      () => {
        if (this.pageIndex < totalPages - 1) {
          this.pageIndex++;
          this.renderCurrentTab();
        }
      }
    );

    this.contentContainer.add([prevBtn, pageLbl, nextBtn]);
  }

  private createActionButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    color: number,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const con = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.lineStyle(1, 0xffffff, 0.25);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);

    const txt = this.add
      .text(0, 0, label, {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: h >= 46 ? '13px' : '11.5px',
        fontStyle: '800',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 2,
      })
      .setOrigin(0.5);

    // Guarantee button text never overflows button bounds
    const maxLabelW = w - 12;
    if (txt.width > maxLabelW && maxLabelW > 20) {
      txt.setScale(maxLabelW / txt.width);
    }

    const hit = this.add
      .rectangle(0, 0, w, h, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });

    const baseY = y;
    hit.on('pointerover', () => {
      this.tweens.add({
        targets: con,
        y: baseY - 1,
        duration: TASTE_THEME.motion.fast,
        ease: TASTE_THEME.motion.easeOut,
      });
    });

    hit.on('pointerout', () => {
      this.tweens.add({
        targets: con,
        y: baseY,
        scale: 1,
        duration: TASTE_THEME.motion.fast,
        ease: TASTE_THEME.motion.easeOut,
      });
    });

    hit.on('pointerdown', () => {
      SoundManager.playPop();
      this.tweens.add({
        targets: con,
        y: baseY + 1,
        scale: 0.98,
        duration: 70,
        yoyo: true,
        ease: TASTE_THEME.motion.easeOut,
        onComplete: onClick,
      });
    });

    con.add([bg, txt, hit]);
    return con;
  }

  private closeModal(): void {
    this.shopScene.resumeFromModal();
    this.scene.stop('ModalScene');
  }
}

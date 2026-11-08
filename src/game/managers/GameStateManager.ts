import Phaser from 'phaser';
import { INITIAL_FOODS, FoodDefinition } from '../data/foods';
import { UPGRADE_DEFINITIONS, UpgradeId, INITIAL_MISSIONS, ACHIEVEMENTS } from '../data/upgrades';
import { DailyStats, FoodStockState, SaveDataSchema, SaveManager } from './SaveManager';
import { SoundManager } from './SoundManager';
import { AudioManager } from './AudioManager';

export class GameStateManager extends Phaser.Events.EventEmitter {
  private static instance: GameStateManager;

  public state!: SaveDataSchema;
  public dailyStats!: DailyStats;
  public selectedTrayFoodId: string = 'ca_vien_truyen_thong';

  private constructor() {
    super();
    this.initState();
  }

  public static getInstance(): GameStateManager {
    if (!GameStateManager.instance) {
      GameStateManager.instance = new GameStateManager();
    }
    return GameStateManager.instance;
  }

  public initState(forceReset = false): void {
    if (forceReset) {
      SaveManager.clear();
    }
    const saved = SaveManager.load();
    if (saved && !forceReset) {
      this.state = saved;
      // Ensure any new foods exist in save state
      for (const f of INITIAL_FOODS) {
        if (!this.state.foods[f.id]) {
          this.state.foods[f.id] = {
            unlocked: f.initialUnlocked,
            rawStock: f.initialRawStock,
            cookedStock: f.initialCookedStock,
          };
        }
      }
      const audio = AudioManager.getInstance();
      const currentAudio = audio.getSettings();
      const muted =
        typeof this.state.muted === 'boolean'
          ? this.state.muted
          : this.state.soundEnabled !== undefined
            ? !this.state.soundEnabled
            : currentAudio.muted;
      const musicVolume =
        typeof this.state.musicVolume === 'number'
          ? this.state.musicVolume
          : currentAudio.musicVolume;
      const sfxVolume =
        typeof this.state.sfxVolume === 'number'
          ? this.state.sfxVolume
          : currentAudio.sfxVolume;

      this.state.muted = muted;
      this.state.soundEnabled = !muted;
      this.state.musicVolume = musicVolume;
      this.state.sfxVolume = sfxVolume;
      audio.syncSettings({ musicVolume, sfxVolume, muted }, true);
    } else {
      const audio = AudioManager.getInstance().getSettings();
      const foodsRecord: Record<string, FoodStockState> = {};
      for (const f of INITIAL_FOODS) {
        foodsRecord[f.id] = {
          unlocked: f.initialUnlocked,
          rawStock: f.initialRawStock,
          cookedStock: f.initialCookedStock,
        };
      }
      const upgradesRecord: Record<UpgradeId, number> = {
        fryer_slots: 1, // Start with 2 slots unlocked (1 + 1) so frying feels active right away
        cook_speed: 0,
        tray_capacity: 0,
        storage_capacity: 0,
        service_tip: 0,
        queue_capacity: 1, // Start with 3 queue slots
        shop_decor: 0,
      };
      this.state = {
        version: 1,
        money: 350000,
        diamonds: 50,
        level: 1,
        xp: 0,
        day: 1,
        tutorialSeen: false,
        rating: 4.5,
        ratingCount: 12,
        gas: 100,
        maxGas: 100,
        oilQuality: 100,
        veggieStock: 15,
        soundEnabled: !audio.muted,
        musicVolume: audio.musicVolume,
        sfxVolume: audio.sfxVolume,
        muted: audio.muted,
        foods: foodsRecord,
        upgrades: upgradesRecord,
        completedMissions: [],
        claimedMissions: [],
        claimedAchievements: [],
        stats: {
          totalServed: 0,
          totalCookedBatches: 0,
          totalRevenue: 0,
          totalUpgradesBought: 0,
        },
      };
      SaveManager.save(this.state);
    }

    this.resetDailyStats();
  }

  public resetDailyStats(): void {
    this.dailyStats = {
      revenue: 0,
      ingredientCost: 0,
      gasCost: 0,
      oilCost: 0,
      veggieCost: 0,
      wastedFoodCount: 0,
      wastedFoodCost: 0,
      customersServed: 0,
      customersMissed: 0,
      tipsEarned: 0,
    };
  }

  public save(): void {
    const audio = AudioManager.getInstance().getSettings();
    this.state.musicVolume = audio.musicVolume;
    this.state.sfxVolume = audio.sfxVolume;
    this.state.muted = audio.muted;
    this.state.soundEnabled = !audio.muted;
    SaveManager.save(this.state);
  }

  public getFoodDef(foodId: string): FoodDefinition {
    const found = INITIAL_FOODS.find((f) => f.id === foodId);
    if (!found) throw new Error(`Unknown foodId: ${foodId}`);
    return found;
  }

  public getUnlockedFoods(): FoodDefinition[] {
    return INITIAL_FOODS.filter((f) => this.state.foods[f.id]?.unlocked);
  }

  public getMinGasCost(): number {
    const unlocked = this.getUnlockedFoods();
    if (unlocked.length === 0) return 4;
    return Math.min(...unlocked.map((f) => f.gasCost));
  }

  public hasEnoughGasToCook(): boolean {
    return this.state.gas >= this.getMinGasCost();
  }

  public hasCookableRawStock(): boolean {
    return this.getUnlockedFoods().some((f) => {
      const st = this.state.foods[f.id];
      return st && st.rawStock >= f.batchYield;
    });
  }

  public getTotalRawStock(): number {
    return this.getUnlockedFoods().reduce((sum, f) => {
      const st = this.state.foods[f.id];
      return sum + (st ? st.rawStock : 0);
    }, 0);
  }

  /**
   * Safeguard so the player is never soft-locked before a day starts if they ran out of money, gas, and raw stock.
   */
  public ensureMinimumPrepCapital(): boolean {
    let assisted = false;
    if (!this.hasEnoughGasToCook() && this.state.money < 45000) {
      this.state.gas = this.state.maxGas;
      assisted = true;
    }
    if (!this.hasCookableRawStock() && this.state.money < 45000) {
      const firstFood = INITIAL_FOODS[0];
      const st = this.state.foods[firstFood.id];
      if (st) {
        st.unlocked = true;
        st.rawStock = Math.max(st.rawStock, firstFood.restockBatchSize);
        assisted = true;
      }
    }
    if (assisted) {
      this.emit('state-changed');
      this.save();
    }
    return assisted;
  }

  public getMaxTrayCapacity(): number {
    return 10 + (this.state.upgrades.tray_capacity || 0) * 5;
  }

  public getMaxStorageCapacity(): number {
    return 30 + (this.state.upgrades.storage_capacity || 0) * 15;
  }

  public getActiveFryerSlots(): number {
    return Math.min(4, 1 + (this.state.upgrades.fryer_slots || 0));
  }

  public getMaxCustomerQueue(): number {
    return Math.min(4, 2 + (this.state.upgrades.queue_capacity || 0));
  }

  public getCookTimeMs(foodId: string): number {
    const def = this.getFoodDef(foodId);
    const speedLvl = this.state.upgrades.cook_speed || 0;
    const multiplier = Math.max(0.35, 1 - speedLvl * 0.12);
    return Math.round(def.cookTimeMs * multiplier);
  }

  public getTipBonusMultiplier(): number {
    return 1 + (this.state.upgrades.service_tip || 0) * 0.1;
  }

  public getSpawnIntervalMs(): number {
    const decorLvl = this.state.upgrades.shop_decor || 0;
    return Math.max(2600, 6200 - decorLvl * 600);
  }

  public getXpForNextLevel(): number {
    return this.state.level * 120;
  }

  public addXp(amount: number): boolean {
    this.state.xp += amount;
    let leveledUp = false;
    while (this.state.xp >= this.getXpForNextLevel()) {
      this.state.xp -= this.getXpForNextLevel();
      this.state.level += 1;
      this.state.diamonds += 10;
      leveledUp = true;
      this.emit('level-up', this.state.level);
    }
    this.emit('state-changed');
    this.save();
    return leveledUp;
  }

  public addMoney(amount: number, isRevenue = false): void {
    this.state.money += amount;
    if (isRevenue && amount > 0) {
      this.dailyStats.revenue += amount;
      this.state.stats.totalRevenue += amount;
    }
    this.emit('state-changed');
    this.save();
  }

  public spendMoney(amount: number): boolean {
    if (this.state.money < amount) return false;
    this.state.money -= amount;
    this.emit('state-changed');
    this.save();
    return true;
  }

  public addRating(scoreDelta: number): void {
    const totalScore = this.state.rating * this.state.ratingCount + scoreDelta;
    this.state.ratingCount += 1;
    this.state.rating = Math.min(5.0, Math.max(1.0, Number((totalScore / this.state.ratingCount).toFixed(1))));
    this.emit('state-changed');
  }

  public getOilStatus(): 'fresh' | 'degraded' | 'burned' {
    const q = this.state.oilQuality;
    if (q >= 60) return 'fresh';
    if (q >= 25) return 'degraded';
    return 'burned';
  }

  public getOilCookingMultiplier(): number {
    const status = this.getOilStatus();
    if (status === 'fresh') return 1.0;
    if (status === 'degraded') return 1.15;
    return 1.35;
  }

  public changeCookingOil(): { ok: boolean; reason?: string } {
    if (this.state.oilQuality >= 98) {
      return { ok: false, reason: 'Chảo dầu còn rất mới, chưa cần thay!' };
    }
    const cost = 30000;
    if (!this.spendMoney(cost)) {
      return { ok: false, reason: `Không đủ ${this.formatCurrency(cost)} để thay dầu mới!` };
    }
    this.state.oilQuality = 100;
    this.dailyStats.oilCost = (this.dailyStats.oilCost || 0) + cost;
    SoundManager.playPop();
    this.emit('state-changed');
    return { ok: true };
  }

  public restockVeggies(): { ok: boolean; reason?: string } {
    const maxVeggies = 40;
    if (this.state.veggieStock >= maxVeggies) {
      return { ok: false, reason: 'Khay rau ăn kèm đã đầy ắp!' };
    }
    const cost = 15000;
    if (!this.spendMoney(cost)) {
      return { ok: false, reason: `Không đủ ${this.formatCurrency(cost)} để nhập rau ăn kèm!` };
    }
    this.state.veggieStock = Math.min(maxVeggies, this.state.veggieStock + 15);
    this.dailyStats.veggieCost = (this.dailyStats.veggieCost || 0) + cost;
    SoundManager.playPop();
    this.emit('state-changed');
    return { ok: true };
  }

  public consumeVeggie(): boolean {
    if (this.state.veggieStock <= 0) return false;
    this.state.veggieStock -= 1;
    this.emit('state-changed');
    return true;
  }

  public clearDayOldCookedStock(): { count: number; cost: number } {
    let wastedCount = 0;
    let wastedCost = 0;

    for (const f of this.getUnlockedFoods()) {
      const stock = this.state.foods[f.id];
      if (stock && stock.cookedStock > 0) {
        wastedCount += stock.cookedStock;
        // Chi phí nguyên liệu ước tính của mỗi phần
        const unitCost = Math.round(f.buyCost / f.restockBatchSize);
        wastedCost += stock.cookedStock * unitCost;
        stock.cookedStock = 0;
        this.emit('tray-updated', f.id);
      }
    }

    this.dailyStats.wastedFoodCount = wastedCount;
    this.dailyStats.wastedFoodCost = wastedCost;
    this.emit('state-changed');
    this.save();
    return { count: wastedCount, cost: wastedCost };
  }

  public refillGas(): { ok: boolean; cost?: number; reason?: string } {
    if (this.state.gas >= this.state.maxGas) {
      return { ok: false, reason: 'Bình gas đang đầy!' };
    }
    const missing = this.state.maxGas - this.state.gas;
    // Tăng giá nhập gas: 950đ mỗi 1% gas (tương đương 95.000đ khi cạn bình, tối thiểu 20.000đ)
    const cost = Math.max(20000, Math.round(missing * 950));
    if (!this.spendMoney(cost)) {
      return { ok: false, reason: `Không đủ ${this.formatCurrency(cost)} để đổi gas!` };
    }
    this.dailyStats.gasCost += cost;
    this.state.gas = this.state.maxGas;
    SoundManager.playPop();
    this.emit('state-changed');
    return { ok: true, cost };
  }

  public restockIngredient(foodId: string): { ok: boolean; reason?: string } {
    const def = this.getFoodDef(foodId);
    const stock = this.state.foods[foodId];
    if (!stock.unlocked) {
      return { ok: false, reason: 'Món này chưa mở khóa!' };
    }
    const maxStorage = this.getMaxStorageCapacity();
    if (stock.rawStock >= maxStorage) {
      return { ok: false, reason: 'Kho đông lạnh của món này đã đầy!' };
    }
    if (!this.spendMoney(def.buyCost)) {
      return { ok: false, reason: `Cần ${this.formatCurrency(def.buyCost)} để nhập nguyên liệu!` };
    }
    this.dailyStats.ingredientCost += def.buyCost;
    stock.rawStock = Math.min(maxStorage, stock.rawStock + def.restockBatchSize);
    SoundManager.playPop();
    this.emit('state-changed');
    this.emit('tray-updated', foodId);
    return { ok: true };
  }

  public unlockFood(foodId: string): { ok: boolean; reason?: string } {
    const def = this.getFoodDef(foodId);
    const stock = this.state.foods[foodId];
    if (stock.unlocked) {
      return { ok: false, reason: 'Món này đã mở khóa rồi!' };
    }
    if (this.state.level < def.unlockLevel) {
      return { ok: false, reason: `Cần đạt Cấp ${def.unlockLevel} để mở khóa!` };
    }
    if (!this.spendMoney(def.unlockCost)) {
      return { ok: false, reason: `Không đủ ${this.formatCurrency(def.unlockCost)}!` };
    }
    stock.unlocked = true;
    stock.rawStock = Math.max(stock.rawStock, 15);
    stock.cookedStock = Math.max(stock.cookedStock, 4);
    this.addXp(35);
    SoundManager.playUpgradeSuccess();
    this.emit('state-changed');
    this.emit('tray-updated', foodId);
    return { ok: true };
  }

  public getUpgradeCost(id: UpgradeId): number {
    const def = UPGRADE_DEFINITIONS.find((u) => u.id === id)!;
    const currentLvl = this.state.upgrades[id] || 0;
    return Math.round((def.baseCost * Math.pow(def.costMultiplier, currentLvl)) / 1000) * 1000;
  }

  public buyUpgrade(id: UpgradeId): { ok: boolean; reason?: string } {
    const def = UPGRADE_DEFINITIONS.find((u) => u.id === id)!;
    const currentLvl = this.state.upgrades[id] || 0;
    if (currentLvl >= def.maxLevel) {
      return { ok: false, reason: 'Đã đạt cấp tối đa!' };
    }
    const cost = this.getUpgradeCost(id);
    if (!this.spendMoney(cost)) {
      return { ok: false, reason: `Cần ${this.formatCurrency(cost)} để nâng cấp!` };
    }
    this.state.upgrades[id] = currentLvl + 1;
    this.state.stats.totalUpgradesBought += 1;
    this.addXp(30);
    SoundManager.playUpgradeSuccess();
    this.emit('state-changed');
    this.emit('upgrade-changed', id);
    return { ok: true };
  }

  public getMissionProgress(missionId: string): { current: number; target: number; completed: boolean; claimed: boolean } {
    const m = INITIAL_MISSIONS.find((item) => item.id === missionId)!;
    let current = 0;
    switch (m.type) {
      case 'serve_customers':
        current = this.state.stats.totalServed;
        break;
      case 'cook_batches':
        current = this.state.stats.totalCookedBatches;
        break;
      case 'earn_money':
        current = this.state.stats.totalRevenue;
        break;
      case 'unlock_foods':
        current = this.getUnlockedFoods().length;
        break;
      case 'upgrade_any':
        current = this.state.stats.totalUpgradesBought;
        break;
    }
    const completed = current >= m.target;
    const claimed = this.state.claimedMissions.includes(missionId);
    return { current: Math.min(current, m.target), target: m.target, completed, claimed };
  }

  public claimMission(missionId: string): boolean {
    const progress = this.getMissionProgress(missionId);
    if (!progress.completed || progress.claimed) return false;
    const m = INITIAL_MISSIONS.find((item) => item.id === missionId)!;
    this.state.claimedMissions.push(missionId);
    this.state.money += m.rewardMoney;
    this.state.diamonds += m.rewardDiamonds;
    this.addXp(m.rewardXp);
    SoundManager.playCash();
    this.emit('state-changed');
    this.save();
    return true;
  }

  public getAchievementProgress(achId: string): { current: number; target: number; completed: boolean; claimed: boolean } {
    const ach = ACHIEVEMENTS.find((a) => a.id === achId)!;
    let current = 0;
    switch (ach.conditionType) {
      case 'total_served':
        current = this.state.stats.totalServed;
        break;
      case 'total_revenue':
        current = this.state.stats.totalRevenue;
        break;
      case 'level_reached':
        current = this.state.level;
        break;
      case 'all_foods_unlocked':
        current = this.getUnlockedFoods().length;
        break;
    }
    const completed = current >= ach.target;
    const claimed = this.state.claimedAchievements.includes(achId);
    return { current: Math.min(current, ach.target), target: ach.target, completed, claimed };
  }

  public claimAchievement(achId: string): boolean {
    const progress = this.getAchievementProgress(achId);
    if (!progress.completed || progress.claimed) return false;
    const ach = ACHIEVEMENTS.find((a) => a.id === achId)!;
    this.state.claimedAchievements.push(achId);
    this.state.diamonds += ach.rewardDiamonds;
    SoundManager.playCash();
    this.emit('state-changed');
    this.save();
    return true;
  }

  public formatCurrency(value: number): string {
    return value.toLocaleString('vi-VN') + 'đ';
  }
}

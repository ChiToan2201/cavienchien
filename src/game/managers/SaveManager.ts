import { UpgradeId } from '../data/upgrades';

export interface FoodStockState {
  unlocked: boolean;
  rawStock: number;
  cookedStock: number;
}

export interface DailyStats {
  revenue: number;
  ingredientCost: number;
  gasCost: number;
  oilCost?: number;
  veggieCost?: number;
  wastedFoodCount?: number;
  wastedFoodCost?: number;
  customersServed: number;
  customersMissed: number;
  tipsEarned: number;
}

export interface SaveDataSchema {
  version: number;
  money: number;
  diamonds: number;
  level: number;
  xp: number;
  day: number;
  tutorialSeen?: boolean;
  rating: number;
  ratingCount: number;
  gas: number;
  maxGas: number;
  oilQuality: number; // 0 - 100 (% chất lượng dầu chiên)
  veggieStock: number; // Số phần rau ăn kèm (dưa leo & đồ chua)
  soundEnabled: boolean;
  musicVolume?: number;
  sfxVolume?: number;
  muted?: boolean;
  foods: Record<string, FoodStockState>;
  upgrades: Record<UpgradeId, number>;
  completedMissions: string[];
  claimedMissions: string[];
  claimedAchievements: string[];
  stats: {
    totalServed: number;
    totalCookedBatches: number;
    totalRevenue: number;
    totalUpgradesBought: number;
  };
}

const STORAGE_KEY = 'ca_vien_chien_tycoon_save_v1';

export class SaveManager {
  public static save(data: SaveDataSchema): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('Could not save to LocalStorage:', err);
    }
  }

  public static load(): SaveDataSchema | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SaveDataSchema;
      if (!parsed || typeof parsed.money !== 'number') return null;
      if (typeof parsed.oilQuality !== 'number') parsed.oilQuality = 100;
      if (typeof parsed.veggieStock !== 'number') parsed.veggieStock = 15;
      return parsed;
    } catch (err) {
      console.warn('Could not load from LocalStorage:', err);
      return null;
    }
  }

  public static clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('Could not clear LocalStorage:', err);
    }
  }
}

import { INITIAL_FOODS } from '../data/foods';
import { GameStateManager } from '../managers/GameStateManager';

export class InventorySystem {
  private gs: GameStateManager;

  constructor() {
    this.gs = GameStateManager.getInstance();
  }

  public getLowStockFoods(): string[] {
    return INITIAL_FOODS.filter((f) => {
      const st = this.gs.state.foods[f.id];
      return st && st.unlocked && st.rawStock < f.batchYield;
    }).map((f) => f.id);
  }

  public restockAllLowFoods(): { restockedCount: number; totalSpent: number } {
    let restockedCount = 0;
    let totalSpent = 0;
    const maxStorage = this.gs.getMaxStorageCapacity();

    for (const f of INITIAL_FOODS) {
      const st = this.gs.state.foods[f.id];
      if (st && st.unlocked && st.rawStock < maxStorage) {
        if (this.gs.state.money >= f.buyCost) {
          this.gs.restockIngredient(f.id);
          restockedCount += 1;
          totalSpent += f.buyCost;
        }
      }
    }

    return { restockedCount, totalSpent };
  }
}

import { GameStateManager } from '../managers/GameStateManager';

export class EconomySystem {
  private gs: GameStateManager;

  constructor() {
    this.gs = GameStateManager.getInstance();
  }

  public getNetProfitToday(): number {
    const s = this.gs.dailyStats;
    return s.revenue - s.ingredientCost - s.gasCost;
  }

  public getFormattedNetProfitToday(): string {
    const net = this.getNetProfitToday();
    const prefix = net >= 0 ? '+' : '';
    return `${prefix}${this.gs.formatCurrency(net)}`;
  }
}

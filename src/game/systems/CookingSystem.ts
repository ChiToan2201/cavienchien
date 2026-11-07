import Phaser from 'phaser';
import { GameStateManager } from '../managers/GameStateManager';
import { SoundManager } from '../managers/SoundManager';

export type FryerSlotStatus = 'empty' | 'cooking' | 'ready' | 'burned';

export interface FryerSlotState {
  index: number;
  status: FryerSlotStatus;
  foodId: string | null;
  elapsedMs: number;
  durationMs: number;
  burnElapsedMs: number;
  burnLimitMs: number;
}

export class CookingSystem extends Phaser.Events.EventEmitter {
  private gs: GameStateManager;
  public slots: FryerSlotState[] = [];

  constructor() {
    super();
    this.gs = GameStateManager.getInstance();
    for (let i = 0; i < 4; i++) {
      this.slots.push({
        index: i,
        status: 'empty',
        foodId: null,
        elapsedMs: 0,
        durationMs: 0,
        burnElapsedMs: 0,
        burnLimitMs: 9000,
      });
    }
  }

  public isSlotUnlocked(slotIndex: number): boolean {
    return slotIndex < this.gs.getActiveFryerSlots();
  }

  public hasCookingSlot(): boolean {
    return this.slots.some((s) => s.status === 'cooking');
  }

  public hasActiveSlot(): boolean {
    return this.slots.some(
      (s) => s.status === 'cooking' || s.status === 'ready' || s.status === 'burned'
    );
  }

  public resetAllSlots(): void {
    for (const slot of this.slots) {
      slot.status = 'empty';
      slot.foodId = null;
      slot.elapsedMs = 0;
      slot.durationMs = 0;
      slot.burnElapsedMs = 0;
      this.emit('slot-updated', slot.index);
    }
  }

  public startCooking(
    foodId: string,
    preferredSlotIndex?: number
  ): { ok: boolean; reason?: string; slotIndex?: number } {
    const def = this.gs.getFoodDef(foodId);
    const stock = this.gs.state.foods[foodId];

    if (!stock || !stock.unlocked) {
      SoundManager.playError();
      return { ok: false, reason: 'Món này chưa mở khóa!' };
    }

    if (stock.rawStock < def.batchYield) {
      SoundManager.playError();
      return {
        ok: false,
        reason: `Món ${def.shortName} đã hết nguyên liệu trong Kho!`,
      };
    }

    if (!this.gs.hasEnoughGasToCook()) {
      SoundManager.playError();
      return { ok: false, reason: 'Bình Gas đã cạn!' };
    }

    let targetSlot: FryerSlotState | undefined;
    if (preferredSlotIndex !== undefined && this.isSlotUnlocked(preferredSlotIndex)) {
      if (this.slots[preferredSlotIndex].status === 'empty') {
        targetSlot = this.slots[preferredSlotIndex];
      }
    }
    if (!targetSlot) {
      targetSlot = this.slots.find((s) => this.isSlotUnlocked(s.index) && s.status === 'empty');
    }

    if (!targetSlot) {
      SoundManager.playError();
      return { ok: false, reason: 'Tất cả chảo chiên đang bận hoặc đầy!' };
    }

    // Consume raw stock & gas
    stock.rawStock = Math.max(0, stock.rawStock - def.batchYield);
    const nextGas = Math.max(0, this.gs.state.gas - def.gasCost);
    // Snap gas to 0 if remaining gas is less than minimum gas cost of any dish
    this.gs.state.gas = nextGas < this.gs.getMinGasCost() ? 0 : nextGas;

    targetSlot.status = 'cooking';
    targetSlot.foodId = foodId;
    targetSlot.elapsedMs = 0;
    targetSlot.durationMs = this.gs.getCookTimeMs(foodId);
    targetSlot.burnElapsedMs = 0;
    targetSlot.burnLimitMs = Math.max(7500, Math.round(targetSlot.durationMs * 2.4));

    SoundManager.playSizzle();
    this.gs.emit('state-changed');
    this.gs.emit('tray-updated', foodId);
    this.emit('slot-updated', targetSlot.index);

    return { ok: true, slotIndex: targetSlot.index };
  }

  public collectSlot(
    slotIndex: number,
    ignoreTrayCap = false
  ): {
    ok: boolean;
    reason?: string;
    foodId?: string;
    added?: number;
    burned?: boolean;
    perfect?: boolean;
  } {
    const slot = this.slots[slotIndex];
    if (!slot || !slot.foodId || (slot.status !== 'ready' && slot.status !== 'burned')) {
      return { ok: false, reason: 'Mẻ chiên chưa sẵn sàng!' };
    }

    const foodId = slot.foodId;

    if (slot.status === 'burned') {
      slot.status = 'empty';
      slot.foodId = null;
      slot.elapsedMs = 0;
      slot.durationMs = 0;
      slot.burnElapsedMs = 0;
      SoundManager.playPop();
      this.emit('slot-updated', slotIndex);
      return { ok: true, foodId, added: 0, burned: true };
    }

    const def = this.gs.getFoodDef(foodId);
    const stock = this.gs.state.foods[foodId];
    const maxTray = this.gs.getMaxTrayCapacity();

    if (!ignoreTrayCap && stock.cookedStock >= maxTray) {
      SoundManager.playError();
      return { ok: false, reason: `Khay ${def.shortName} đã đầy (${maxTray}/${maxTray})!` };
    }

    const added = ignoreTrayCap
      ? def.batchYield
      : Math.min(def.batchYield, maxTray - stock.cookedStock);
    stock.cookedStock = Math.min(maxTray, stock.cookedStock + added);
    this.gs.state.stats.totalCookedBatches += 1;

    const perfect = slot.burnElapsedMs <= slot.burnLimitMs * 0.45;
    this.gs.addXp(perfect ? 15 : 10);

    slot.status = 'empty';
    slot.foodId = null;
    slot.elapsedMs = 0;
    slot.durationMs = 0;
    slot.burnElapsedMs = 0;

    SoundManager.playPop();
    this.gs.emit('state-changed');
    this.gs.emit('tray-updated', foodId);
    this.emit('slot-updated', slotIndex);
    this.emit('batch-collected', foodId, added, slotIndex);

    return { ok: true, foodId, added, burned: false, perfect };
  }

  public collectAllReadySlots(): number {
    let collected = 0;
    for (const slot of this.slots) {
      if (slot.status === 'ready') {
        const res = this.collectSlot(slot.index, true);
        if (res.ok) collected += 1;
      } else if (slot.status === 'burned') {
        this.collectSlot(slot.index, true);
      }
    }
    return collected;
  }

  public update(deltaMs: number): void {
    for (const slot of this.slots) {
      if (slot.status === 'cooking' && slot.foodId) {
        slot.elapsedMs += deltaMs;
        if (slot.elapsedMs >= slot.durationMs) {
          slot.elapsedMs = slot.durationMs;
          slot.status = 'ready';
          slot.burnElapsedMs = 0;
          SoundManager.playDing();
          this.emit('slot-ready', slot.index, slot.foodId);
        }
        this.emit('slot-updated', slot.index);
      } else if (slot.status === 'ready' && slot.foodId) {
        slot.burnElapsedMs += deltaMs;
        if (slot.burnElapsedMs >= slot.burnLimitMs) {
          slot.burnElapsedMs = slot.burnLimitMs;
          slot.status = 'burned';
          SoundManager.playError();
          this.emit('slot-burned', slot.index, slot.foodId);
        }
        this.emit('slot-updated', slot.index);
      }
    }
  }

  public getCookingCountForFood(foodId: string): number {
    return this.slots.filter(
      (s) =>
        s.foodId === foodId &&
        (s.status === 'cooking' || s.status === 'ready' || s.status === 'burned')
    ).length;
  }
}

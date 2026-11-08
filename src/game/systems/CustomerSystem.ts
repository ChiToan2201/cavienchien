import Phaser from 'phaser';
import { CUSTOMER_ARCHETYPES, CustomerArchetype } from '../data/customers';
import { GameStateManager } from '../managers/GameStateManager';
import { SoundManager } from '../managers/SoundManager';

export interface OrderRequirement {
  foodId: string;
  quantity: number;
}

export type CustomerMood = 'happy' | 'normal' | 'impatient';

export interface ActiveCustomer {
  uid: string;
  slotIndex: number;
  archetype: CustomerArchetype;
  textureKey: string;
  greeting: string;
  orders: OrderRequirement[];
  maxPatienceMs: number;
  remainingPatienceMs: number;
  mood: CustomerMood;
  totalBasePrice: number;
}

export class CustomerSystem extends Phaser.Events.EventEmitter {
  private gs: GameStateManager;
  public activeCustomers: (ActiveCustomer | null)[] = [null, null, null, null];
  private spawnTimerMs = 1500;
  private uidCounter = 1;

  constructor() {
    super();
    this.gs = GameStateManager.getInstance();
  }

  public resetAll(): void {
    this.activeCustomers = [null, null, null, null];
    this.spawnTimerMs = 1200;
    this.emit('customers-changed');
  }

  public update(deltaMs: number, canSpawn: boolean): void {
    if (canSpawn) {
      this.spawnTimerMs -= deltaMs;
      if (this.spawnTimerMs <= 0) {
        this.trySpawnCustomer();
        this.spawnTimerMs = this.gs.getSpawnIntervalMs();
      }
    }

    for (let i = 0; i < this.activeCustomers.length; i++) {
      const cust = this.activeCustomers[i];
      if (!cust) continue;

      cust.remainingPatienceMs = Math.max(0, cust.remainingPatienceMs - deltaMs);
      const ratio = cust.remainingPatienceMs / cust.maxPatienceMs;
      const newMood: CustomerMood = ratio > 0.55 ? 'happy' : ratio > 0.25 ? 'normal' : 'impatient';
      if (newMood !== cust.mood) {
        cust.mood = newMood;
        this.emit('customer-mood-changed', cust);
      }

      if (cust.remainingPatienceMs <= 0) {
        // Customer walks away angry
        this.activeCustomers[i] = null;
        this.gs.dailyStats.customersMissed += 1;
        // Troublemaker or VIP walking away angry gives severe rating penalties
        const penaltyRating = cust.archetype.id === 'bad' ? 1.0 : cust.archetype.id === 'vip' ? 1.5 : 2.0;
        this.gs.addRating(penaltyRating);
        SoundManager.playError();
        this.emit('customer-left-angry', cust);
        this.emit('customers-changed');
      }
    }
  }

  private pickArchetype(): CustomerArchetype {
    const totalWeight = CUSTOMER_ARCHETYPES.reduce((sum, a) => sum + a.spawnWeight, 0);
    let rand = Math.random() * totalWeight;
    for (const arch of CUSTOMER_ARCHETYPES) {
      if (rand < arch.spawnWeight) return arch;
      rand -= arch.spawnWeight;
    }
    return CUSTOMER_ARCHETYPES[0];
  }

  public trySpawnCustomer(): ActiveCustomer | null {
    const maxQueue = this.gs.getMaxCustomerQueue();
    let emptySlot = -1;
    for (let i = 0; i < maxQueue; i++) {
      if (!this.activeCustomers[i]) {
        emptySlot = i;
        break;
      }
    }
    if (emptySlot === -1) return null;

    const unlockedFoods = this.gs.getUnlockedFoods();
    if (unlockedFoods.length === 0) return null;

    // Prefer foods that still have stock in warehouse or on tray today
    const availableFoods = unlockedFoods.filter((f) => {
      const st = this.gs.state.foods[f.id];
      return st && (st.rawStock >= f.batchYield || st.cookedStock > 0);
    });
    const pool = availableFoods.length > 0 ? availableFoods : unlockedFoods;

    const archetype = this.pickArchetype();
    const textureKey = archetype.textureKeys[Math.floor(Math.random() * archetype.textureKeys.length)];
    const greeting = archetype.greetings[Math.floor(Math.random() * archetype.greetings.length)];

    const numItems = Phaser.Math.Between(archetype.minItems, archetype.maxItems);
    const orderMap = new Map<string, number>();

    for (let i = 0; i < numItems; i++) {
      const randomFood = pool[Math.floor(Math.random() * pool.length)];
      const st = this.gs.state.foods[randomFood.id];
      const currentOrdered = orderMap.get(randomFood.id) || 0;
      // If no raw stock left to fry this item, do not order more than what is left on the tray
      if (st && st.rawStock < randomFood.batchYield && st.cookedStock > 0) {
        if (currentOrdered < st.cookedStock) {
          orderMap.set(randomFood.id, currentOrdered + 1);
        }
      } else {
        orderMap.set(randomFood.id, currentOrdered + 1);
      }
    }

    if (orderMap.size === 0) {
      const fallback = pool[0];
      orderMap.set(fallback.id, 1);
    }

    const orders: OrderRequirement[] = [];
    let totalBasePrice = 0;
    orderMap.forEach((qty, foodId) => {
      orders.push({ foodId, quantity: qty });
      totalBasePrice += this.gs.getFoodDef(foodId).sellPrice * qty;
    });

    const maxPatienceMs = archetype.patienceSeconds * 1000;
    const customer: ActiveCustomer = {
      uid: `cust_${this.uidCounter++}`,
      slotIndex: emptySlot,
      archetype,
      textureKey,
      greeting,
      orders,
      maxPatienceMs,
      remainingPatienceMs: maxPatienceMs,
      mood: 'happy',
      totalBasePrice,
    };

    this.activeCustomers[emptySlot] = customer;
    SoundManager.playCustomerArrival();
    this.emit('customer-spawned', customer);
    this.emit('customers-changed');
    return customer;
  }

  public canFulfillCustomer(slotIndex: number): { canServe: boolean; missingFoodIds: string[] } {
    const cust = this.activeCustomers[slotIndex];
    if (!cust) return { canServe: false, missingFoodIds: [] };

    const missingFoodIds: string[] = [];
    for (const req of cust.orders) {
      const stock = this.gs.state.foods[req.foodId];
      if (!stock || stock.cookedStock < req.quantity) {
        missingFoodIds.push(req.foodId);
      }
    }
    return { canServe: missingFoodIds.length === 0, missingFoodIds };
  }

  public serveCustomer(slotIndex: number): {
    ok: boolean;
    reason?: string;
    missingFoodIds?: string[];
    totalEarned?: number;
    tipAmount?: number;
    customer?: ActiveCustomer;
  } {
    const cust = this.activeCustomers[slotIndex];
    if (!cust) return { ok: false, reason: 'Không có khách ở vị trí này!' };

    const check = this.canFulfillCustomer(slotIndex);
    if (!check.canServe) {
      SoundManager.playError();
      return {
        ok: false,
        reason: 'Chưa đủ món chín trên khay! Hãy chiên thêm món khách gọi.',
        missingFoodIds: check.missingFoodIds,
      };
    }

    // Deduct cooked stock from trays
    for (const req of cust.orders) {
      this.gs.state.foods[req.foodId].cookedStock -= req.quantity;
      this.gs.emit('tray-updated', req.foodId);
    }

    // Calculate payment + patience tip + upgrade bonus
    const patienceRatio = cust.remainingPatienceMs / cust.maxPatienceMs;
    const moodMultiplier = patienceRatio > 0.6 ? 1.2 : patienceRatio > 0.3 ? 1.05 : 1.0;
    const rawTotal = cust.totalBasePrice * cust.archetype.tipMultiplier * this.gs.getTipBonusMultiplier() * moodMultiplier;
    const totalEarned = Math.round(rawTotal / 1000) * 1000;
    const tipAmount = Math.max(0, totalEarned - cust.totalBasePrice);

    this.activeCustomers[slotIndex] = null;
    this.gs.dailyStats.customersServed += 1;
    this.gs.dailyStats.tipsEarned += tipAmount;
    this.gs.state.stats.totalServed += 1;
    this.gs.addMoney(totalEarned, true);

    // Custom XP and Rating rewards based on customer archetype
    const xpReward = cust.archetype.id === 'vip' ? 55 : cust.archetype.id === 'bad' ? 18 : 22;
    this.gs.addXp(xpReward);

    const starRating = cust.archetype.id === 'vip'
      ? 5.0
      : cust.archetype.id === 'bad'
        ? (patienceRatio > 0.5 ? 4.2 : 3.0)
        : (patienceRatio > 0.5 ? 5.0 : 4.3);
    this.gs.addRating(starRating);

    SoundManager.playCash();
    this.emit('customer-served', cust, totalEarned, tipAmount);
    this.emit('customers-changed');

    return { ok: true, totalEarned, tipAmount, customer: cust };
  }
}

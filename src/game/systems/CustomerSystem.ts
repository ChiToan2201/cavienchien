import Phaser from 'phaser';
import { CUSTOMER_ARCHETYPES, CustomerArchetype } from '../data/customers';
import { GameStateManager } from '../managers/GameStateManager';
import { SoundManager } from '../managers/SoundManager';

export interface OrderRequirement {
  foodId: string;
  quantity: number;
}

export type CustomerMood = 'happy' | 'normal' | 'impatient';
export type VeggieType = 'dua_leo' | 'dau_bap' | 'xa_lach';
export type SauceType = 'tuong_ot' | 'tuong_den' | 'tuong_xi_muoi';

export interface ActiveCustomer {
  uid: string;
  slotIndex: number;
  archetype: CustomerArchetype;
  textureKey: string;
  greeting: string;
  orders: OrderRequirement[];
  wantsVeggie: boolean;
  hasVeggie: boolean;
  requestedVeggie?: VeggieType | null;
  requestedSauce?: SauceType | null;
  hasSauce: boolean;
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
    const wantsVeggie = Math.random() < 0.6; // 60% khách muốn ăn kèm rau
    const veggieOptions: VeggieType[] = ['dua_leo', 'dau_bap', 'xa_lach'];
    const requestedVeggie = wantsVeggie
      ? veggieOptions[Math.floor(Math.random() * veggieOptions.length)]
      : null;

    const wantsSauce = Math.random() < 0.7; // 70% khách muốn có nước chấm
    const sauceOptions: SauceType[] = ['tuong_ot', 'tuong_den', 'tuong_xi_muoi'];
    const requestedSauce = wantsSauce
      ? sauceOptions[Math.floor(Math.random() * sauceOptions.length)]
      : null;

    const customer: ActiveCustomer = {
      uid: `cust_${this.uidCounter++}`,
      slotIndex: emptySlot,
      archetype,
      textureKey,
      greeting,
      orders,
      wantsVeggie,
      hasVeggie: false,
      requestedVeggie,
      requestedSauce,
      hasSauce: false,
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

  public addVeggieToCustomer(slotIndex: number): boolean {
    const cust = this.activeCustomers[slotIndex];
    if (!cust || !cust.requestedVeggie || cust.hasVeggie) return false;
    if (!this.gs.consumeVeggie()) return false;
    cust.hasVeggie = true;
    SoundManager.playPop();
    this.emit('customer-veggie-added', cust, cust.requestedVeggie);
    this.emit('customers-changed');
    return true;
  }

  public autoServeVeggie(type: VeggieType): { success: boolean; customerIndex?: number; reason?: string } {
    if (this.gs.state.veggieStock <= 0) {
      return { success: false, reason: 'Đã hết rau trong kho! Bấm [+] để nhập thêm.' };
    }
    const idx = this.activeCustomers.findIndex(
      (c) => c !== null && c.requestedVeggie === type && !c.hasVeggie
    );
    if (idx === -1) {
      return { success: false, reason: 'Không có khách nào đang chờ món rau này!' };
    }
    if (!this.gs.consumeVeggie()) {
      return { success: false, reason: 'Không thể lấy rau từ kho!' };
    }
    const cust = this.activeCustomers[idx]!;
    cust.hasVeggie = true;
    SoundManager.playPop();
    this.emit('customer-veggie-added', cust, type);
    this.emit('customers-changed');
    return { success: true, customerIndex: idx };
  }

  public autoServeSauce(type: SauceType): { success: boolean; customerIndex?: number; reason?: string } {
    const idx = this.activeCustomers.findIndex(
      (c) => c !== null && c.requestedSauce === type && !c.hasSauce
    );
    if (idx === -1) {
      return { success: false, reason: 'Không có khách nào đang chờ loại nước chấm này!' };
    }
    const cust = this.activeCustomers[idx]!;
    cust.hasSauce = true;
    SoundManager.playSizzle();
    this.emit('customer-sauce-added', cust, type);
    this.emit('customers-changed');
    return { success: true, customerIndex: idx };
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

    let veggieBonus = 0;
    if (cust.requestedVeggie && cust.hasVeggie) {
      veggieBonus = 3000; // Phụ thu tiền rau 3k
    }

    let sauceBonus = 0;
    if (cust.requestedSauce && cust.hasSauce) {
      sauceBonus = 2000; // Phụ thu tiền sốt đặc biệt 2k
    }

    const rawTotal = cust.totalBasePrice * cust.archetype.tipMultiplier * this.gs.getTipBonusMultiplier() * moodMultiplier;
    let tipAmount = Math.max(0, Math.round(rawTotal / 1000) * 1000 - cust.totalBasePrice);

    // Ảnh hưởng của Rau & Nước chấm
    const missedVeggie = cust.requestedVeggie && !cust.hasVeggie;
    const missedSauce = cust.requestedSauce && !cust.hasSauce;

    if (missedVeggie || missedSauce) {
      tipAmount = 0; // Quên rau hoặc nước chấm: khách không boa
    } else {
      if (cust.requestedVeggie && cust.hasVeggie) tipAmount += 1500;
      if (cust.requestedSauce && cust.hasSauce) tipAmount += 1500;
      // Perfect combo bonus: cả rau và sốt đều chuẩn vị
      if (cust.requestedVeggie && cust.hasVeggie && cust.requestedSauce && cust.hasSauce) {
        this.gs.addXp(5);
      }
    }

    // Ảnh hưởng của Dầu chiên
    const oilStatus = this.gs.getOilStatus();
    if (oilStatus === 'burned') {
      tipAmount = 0; // Dầu đen khét: mất sạch tiền boa
    } else if (oilStatus === 'degraded') {
      tipAmount = Math.round(tipAmount * 0.5); // Dầu sẫm màu: giảm 50% tiền boa
    }

    const totalEarned = cust.totalBasePrice + veggieBonus + sauceBonus + tipAmount;

    this.activeCustomers[slotIndex] = null;
    this.gs.dailyStats.customersServed += 1;
    this.gs.dailyStats.tipsEarned += tipAmount;
    this.gs.state.stats.totalServed += 1;
    this.gs.addMoney(totalEarned, true);

    // Custom XP and Rating rewards based on customer archetype & oil quality
    const xpReward = cust.archetype.id === 'vip' ? 55 : cust.archetype.id === 'bad' ? 18 : 22;
    this.gs.addXp(xpReward);

    let starRating = cust.archetype.id === 'vip'
      ? 5.0
      : cust.archetype.id === 'bad'
        ? (patienceRatio > 0.5 ? 4.2 : 3.0)
        : (patienceRatio > 0.5 ? 5.0 : 4.3);

    if (oilStatus === 'burned') {
      starRating = Math.max(1.0, starRating - 1.5); // Dầu đen khét bị trừ sao nặng
    }

    this.gs.addRating(starRating);

    SoundManager.playCash();
    this.emit('customer-served', cust, totalEarned, tipAmount);
    this.emit('customers-changed');

    return { ok: true, totalEarned, tipAmount, customer: cust };
  }
}

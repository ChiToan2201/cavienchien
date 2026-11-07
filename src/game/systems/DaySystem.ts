import Phaser from 'phaser';
import { GameStateManager } from '../managers/GameStateManager';

export type DayPhase = 'prep' | 'selling' | 'ended';
export type DayEndReason = 'time_up' | 'out_of_gas' | 'out_of_stock' | 'manual' | null;

export class DaySystem extends Phaser.Events.EventEmitter {
  private gs: GameStateManager;
  public phase: DayPhase = 'prep';
  public isRunning = false;
  public isPaused = false;
  public endReason: DayEndReason = null;

  // Game day runs from 15:00 (3 PM street food opening) to 22:00 (10 PM closing)
  // Maximum real gameplay duration per day = 6 minutes (360,000 ms)
  public readonly startMinutes = 15 * 60;
  public readonly endMinutes = 22 * 60;
  public currentMinutes = 15 * 60;

  public readonly maxDayDurationMs = 6 * 60 * 1000; // 6 minutes max per day
  public elapsedDayMs = 0;
  private uiTickAccumulatorMs = 0;

  constructor() {
    super();
    this.gs = GameStateManager.getInstance();
  }

  /**
   * Enter the pre-day preparation phase ("Trước giờ mở bán - Nhập hàng & Bơm Gas")
   */
  public enterPrepPhase(resetStats = false): void {
    this.phase = 'prep';
    this.isRunning = false;
    this.isPaused = false;
    this.endReason = null;
    this.elapsedDayMs = 0;
    this.uiTickAccumulatorMs = 0;
    this.currentMinutes = this.startMinutes;

    if (resetStats) {
      this.gs.resetDailyStats();
    }

    this.emit('prep-started', this.gs.state.day);
    this.emit('time-updated', this.getFormattedTime());
  }

  /**
   * Open the shop and start the 6-minute selling countdown
   */
  public startSellingDay(): void {
    this.phase = 'selling';
    this.isRunning = true;
    this.isPaused = false;
    this.endReason = null;
    this.elapsedDayMs = 0;
    this.uiTickAccumulatorMs = 0;
    this.currentMinutes = this.startMinutes;

    this.emit('day-started', this.gs.state.day);
    this.emit('time-updated', this.getFormattedTime());
  }

  /**
   * Legacy alias that starts selling day
   */
  public startNewDay(): void {
    this.startSellingDay();
  }

  public update(deltaMs: number): void {
    if (this.phase !== 'selling' || !this.isRunning || this.isPaused) return;

    this.elapsedDayMs += deltaMs;
    this.uiTickAccumulatorMs += deltaMs;

    const progress = Phaser.Math.Clamp(this.elapsedDayMs / this.maxDayDurationMs, 0, 1);
    this.currentMinutes =
      this.startMinutes + progress * (this.endMinutes - this.startMinutes);

    if (this.elapsedDayMs >= this.maxDayDurationMs) {
      this.elapsedDayMs = this.maxDayDurationMs;
      this.currentMinutes = this.endMinutes;
      this.endDay('time_up');
      return;
    }

    if (this.uiTickAccumulatorMs >= 250) {
      this.uiTickAccumulatorMs = 0;
      this.emit('time-updated', this.getFormattedTime());
    }
  }

  public endDay(reason: DayEndReason): void {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.isRunning = false;
    this.endReason = reason;
    this.emit('time-updated', this.getFormattedTime());
    this.emit('day-ended', reason);
  }

  public endDayEarly(): void {
    if (this.phase !== 'selling') return;
    this.endDay('manual');
  }

  public advanceToNextDay(): void {
    this.gs.state.day += 1;
    this.gs.resetDailyStats();
    this.gs.save();
    this.enterPrepPhase(false);
  }

  public getRemainingSeconds(): number {
    return Math.max(0, Math.ceil((this.maxDayDurationMs - this.elapsedDayMs) / 1000));
  }

  public getFormattedCountdown(): string {
    const totalSec = this.getRemainingSeconds();
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  public getFormattedClock(): string {
    const hrs = Math.floor(this.currentMinutes / 60);
    const mins = Math.floor(this.currentMinutes % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  public getFormattedTime(): string {
    if (this.phase === 'prep') {
      return `Chuẩn bị • 06:00`;
    }
    if (this.phase === 'ended') {
      return `Đóng quán • ${this.getFormattedCountdown()}`;
    }
    return `${this.getFormattedClock()} • ${this.getFormattedCountdown()}`;
  }

  public getEndReasonLabel(): string {
    switch (this.endReason) {
      case 'time_up':
        return '⏰ Hết giờ: Đã kết thúc 6 phút mở bán tối đa trong ngày';
      case 'out_of_gas':
        return '⛽ Kết thúc sớm: Bình Gas đã cạn sạch trong giờ bán';
      case 'out_of_stock':
        return '📦 Kết thúc sớm: Đã hết sạch nguyên liệu trong Kho';
      case 'manual':
        return '🌙 Kết thúc sớm: Chủ quán chủ động đóng cửa sớm';
      default:
        return '📊 Báo cáo tình hình kinh doanh trong ngày';
    }
  }
}

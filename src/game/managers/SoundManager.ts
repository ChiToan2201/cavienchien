import { AudioManager, BgmTrackId } from './AudioManager';

/**
 * SoundManager Facade
 * -------------------------------------------------------------------------
 * Delegates all audio operations to the unified `AudioManager` singleton so
 * existing call sites and new semantic audio events share one single engine.
 */
export class SoundManager {
  public static get enabled(): boolean {
    return !AudioManager.getInstance().isMuted();
  }

  public static set enabled(value: boolean) {
    AudioManager.getInstance().setMuted(!value);
  }

  // === Semantic Sound Effects (9 Events) ===

  public static playButtonClick(): void {
    AudioManager.getInstance().playSfx('button_click');
  }

  public static playFryingFood(): void {
    AudioManager.getInstance().playSfx('frying_food');
  }

  public static playFoodReady(): void {
    AudioManager.getInstance().playSfx('food_ready');
  }

  public static playCustomerArrival(): void {
    AudioManager.getInstance().playSfx('customer_arrival');
  }

  public static playCustomerOrdering(): void {
    AudioManager.getInstance().playSfx('customer_ordering');
  }

  public static playPaymentSuccess(): void {
    AudioManager.getInstance().playSfx('payment_success');
  }

  public static playUpgradeSuccess(): void {
    AudioManager.getInstance().playSfx('upgrade_success');
  }

  public static playWarning(): void {
    AudioManager.getInstance().playSfx('warning');
  }

  public static playDayCompleted(): void {
    AudioManager.getInstance().playSfx('day_completed');
  }

  // === Background Music Controls ===

  public static playBgm(track: BgmTrackId, crossfadeMs = 550): void {
    AudioManager.getInstance().playBgm(track, crossfadeMs);
  }

  public static pauseBgm(): void {
    AudioManager.getInstance().pauseBgm();
  }

  public static resumeBgm(): void {
    AudioManager.getInstance().resumeBgm();
  }

  public static stopBgm(fadeOutMs = 350): void {
    AudioManager.getInstance().stopBgm(fadeOutMs);
  }

  // === Legacy Aliases (Mapped to the 9 Semantic SFX) ===

  public static playPop(): void {
    AudioManager.getInstance().playSfx('button_click');
  }

  public static playSizzle(): void {
    AudioManager.getInstance().playSfx('frying_food');
  }

  public static playDing(): void {
    AudioManager.getInstance().playSfx('food_ready');
  }

  public static playCash(): void {
    AudioManager.getInstance().playSfx('payment_success');
  }

  public static playError(): void {
    AudioManager.getInstance().playSfx('warning');
  }
}

/**
 * Complete Game Audio System (`AudioManager`)
 * -------------------------------------------------------------------------
 * Zero-dependency Web Audio API engine tailored for "Cá Viên Chiên Tycoon":
 * 1. User-Gesture Unlock Gate: Never initializes or plays audio before first player interaction.
 * 2. 3-Bus Gain Graph: `MasterGain` (Mute/Unmute) -> `MusicGain` (BGM) + `SfxGain` (SFX).
 * 3. Anti-Spam Throttling & Polyphony Cap: Prevents overlapping sound spam and FPS drops.
 * 4. Pre-allocated Shared Noise Buffer: Reuses a single white-noise buffer for frying sizzles
 *    so zero garbage collection or allocation spikes occur during gameplay.
 * 5. Smooth BGM Crossfading (`menu` | `shop` | `day_end`): Sequenced procedural music tracks
 *    with smooth fade-in / fade-out transitions and automatic node cleanup (`onended`).
 */

export type SfxId =
  | 'button_click'
  | 'frying_food'
  | 'food_ready'
  | 'customer_arrival'
  | 'customer_ordering'
  | 'payment_success'
  | 'upgrade_success'
  | 'warning'
  | 'day_completed';

export type BgmTrackId = 'menu' | 'shop' | 'day_end';

export interface AudioSettings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

interface BgmLoopController {
  trackId: BgmTrackId;
  branchGain: GainNode;
  timerId: number | null;
  stopped: boolean;
}

const AUDIO_STORAGE_KEY = 'ca_vien_chien_tycoon_audio_v1';

const SFX_COOLDOWN_MS: Record<SfxId, number> = {
  button_click: 45,
  frying_food: 120,
  food_ready: 110,
  customer_arrival: 180,
  customer_ordering: 150,
  payment_success: 100,
  upgrade_success: 160,
  warning: 220,
  day_completed: 450,
};

interface NoteStep {
  leadFreq: number;
  bassFreq?: number;
  harmonyFreq?: number;
  durationSec: number;
}

const BGM_PATTERNS: Record<BgmTrackId, { stepMs: number; notes: NoteStep[] }> = {
  // Warm, laid-back Saigon evening acoustic lo-fi melody
  menu: {
    stepMs: 460,
    notes: [
      { leadFreq: 392.0, bassFreq: 130.81, harmonyFreq: 246.94, durationSec: 0.42 }, // G4 + C3
      { leadFreq: 493.88, durationSec: 0.38 }, // B4
      { leadFreq: 587.33, harmonyFreq: 329.63, durationSec: 0.42 }, // D5
      { leadFreq: 523.25, durationSec: 0.42 }, // C5
      { leadFreq: 440.0, bassFreq: 110.0, harmonyFreq: 261.63, durationSec: 0.44 }, // A4 + A2
      { leadFreq: 523.25, durationSec: 0.38 }, // C5
      { leadFreq: 659.25, harmonyFreq: 329.63, durationSec: 0.44 }, // E5
      { leadFreq: 587.33, durationSec: 0.42 }, // D5
      { leadFreq: 349.23, bassFreq: 174.61, harmonyFreq: 261.63, durationSec: 0.44 }, // F4 + F3
      { leadFreq: 440.0, durationSec: 0.38 }, // A4
      { leadFreq: 523.25, harmonyFreq: 349.23, durationSec: 0.42 }, // C5
      { leadFreq: 493.88, durationSec: 0.42 }, // B4
      { leadFreq: 392.0, bassFreq: 196.0, harmonyFreq: 293.66, durationSec: 0.45 }, // G4 + G3
      { leadFreq: 440.0, durationSec: 0.38 }, // A4
      { leadFreq: 493.88, harmonyFreq: 246.94, durationSec: 0.42 }, // B4
      { leadFreq: 392.0, durationSec: 0.44 }, // G4
    ],
  },
  // Upbeat, cheerful street-food tycoon rhythm during active service
  shop: {
    stepMs: 320,
    notes: [
      { leadFreq: 523.25, bassFreq: 130.81, durationSec: 0.24 }, // C5
      { leadFreq: 659.25, durationSec: 0.22 }, // E5
      { leadFreq: 783.99, bassFreq: 196.0, durationSec: 0.24 }, // G5
      { leadFreq: 659.25, durationSec: 0.22 }, // E5
      { leadFreq: 587.33, bassFreq: 146.83, durationSec: 0.24 }, // D5
      { leadFreq: 698.46, durationSec: 0.22 }, // F5
      { leadFreq: 880.0, bassFreq: 220.0, durationSec: 0.24 }, // A5
      { leadFreq: 698.46, durationSec: 0.22 }, // F5
      { leadFreq: 659.25, bassFreq: 164.81, durationSec: 0.24 }, // E5
      { leadFreq: 783.99, durationSec: 0.22 }, // G5
      { leadFreq: 987.77, bassFreq: 246.94, durationSec: 0.24 }, // B5
      { leadFreq: 783.99, durationSec: 0.22 }, // G5
      { leadFreq: 783.99, bassFreq: 196.0, harmonyFreq: 493.88, durationSec: 0.28 }, // G5
      { leadFreq: 659.25, durationSec: 0.22 }, // E5
      { leadFreq: 587.33, bassFreq: 146.83, durationSec: 0.24 }, // D5
      { leadFreq: 523.25, harmonyFreq: 392.0, durationSec: 0.28 }, // C5
    ],
  },
  // Calm, rewarding night-closing reflection melody
  day_end: {
    stepMs: 540,
    notes: [
      { leadFreq: 523.25, bassFreq: 130.81, harmonyFreq: 329.63, durationSec: 0.5 }, // C5
      { leadFreq: 659.25, durationSec: 0.45 }, // E5
      { leadFreq: 783.99, harmonyFreq: 392.0, durationSec: 0.5 }, // G5
      { leadFreq: 659.25, durationSec: 0.48 }, // E5
      { leadFreq: 698.46, bassFreq: 174.61, harmonyFreq: 440.0, durationSec: 0.5 }, // F5
      { leadFreq: 587.33, durationSec: 0.45 }, // D5
      { leadFreq: 523.25, bassFreq: 130.81, harmonyFreq: 329.63, durationSec: 0.6 }, // C5
      { leadFreq: 392.0, durationSec: 0.5 }, // G4
    ],
  },
};

export class AudioManager {
  private static instance: AudioManager | null = null;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private sharedNoiseBuffer: AudioBuffer | null = null;

  private musicVolume = 0.55;
  private sfxVolume = 0.8;
  private muted = false;
  private musicDucked = false;

  private isUnlocked = false;
  private unlockListenersBound = false;
  private desiredBgmTrack: BgmTrackId | null = null;
  private activeBgm: BgmLoopController | null = null;
  private fadingBgms: Set<BgmLoopController> = new Set();

  private lastSfxTimestamp: Map<SfxId, number> = new Map();
  private activeSfxCount = 0;
  private readonly maxConcurrentSfx = 8;

  private constructor() {
    this.loadSettingsFromStorage();
    this.bindInteractionUnlock();
    this.bindVisibilityLifecycle();
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /**
   * Synchronize settings from SaveDataSchema or external state.
   */
  public syncSettings(partial: Partial<AudioSettings>, persist = true): void {
    if (typeof partial.musicVolume === 'number') {
      this.musicVolume = Math.max(0, Math.min(1, partial.musicVolume));
    }
    if (typeof partial.sfxVolume === 'number') {
      this.sfxVolume = Math.max(0, Math.min(1, partial.sfxVolume));
    }
    if (typeof partial.muted === 'boolean') {
      this.muted = partial.muted;
    }
    this.applyGainValues();
    if (persist) {
      this.saveSettingsToStorage();
    }
  }

  public getSettings(): AudioSettings {
    return {
      musicVolume: this.musicVolume,
      sfxVolume: this.sfxVolume,
      muted: this.muted,
    };
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.applyGainValues();
    this.saveSettingsToStorage();
  }

  public setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.applyGainValues();
    this.saveSettingsToStorage();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyGainValues();
    this.saveSettingsToStorage();
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * Lower BGM slightly when a modal is open so UI SFX stand out clearly.
   */
  public setMusicDucked(ducked: boolean): void {
    if (this.musicDucked === ducked) return;
    this.musicDucked = ducked;
    this.applyGainValues();
  }

  /**
   * Play or crossfade to a background music track (`menu` | `shop` | `day_end`).
   * Will wait until first player gesture if not yet unlocked.
   */
  public playBgm(trackId: BgmTrackId, crossfadeMs = 550): void {
    this.desiredBgmTrack = trackId;

    if (!this.isUnlocked) {
      return;
    }

    if (this.activeBgm && this.activeBgm.trackId === trackId && !this.activeBgm.stopped) {
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx || !this.musicGain) return;

    // Crossfade out previous BGM track
    if (this.activeBgm) {
      this.fadeOutAndDisposeBgm(this.activeBgm, crossfadeMs);
      this.activeBgm = null;
    }

    // Create new BGM branch gain node and fade it in smoothly
    const branchGain = ctx.createGain();
    const now = ctx.currentTime;
    branchGain.gain.setValueAtTime(0.0001, now);
    branchGain.gain.linearRampToValueAtTime(1.0, now + Math.max(0.08, crossfadeMs / 1000));
    branchGain.connect(this.musicGain);

    const controller: BgmLoopController = {
      trackId,
      branchGain,
      timerId: null,
      stopped: false,
    };
    this.activeBgm = controller;
    this.startBgmSequencer(controller);
  }

  public pauseBgm(): void {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  public resumeBgm(): void {
    if (!this.isUnlocked) return;
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public stopBgm(fadeOutMs = 350): void {
    this.desiredBgmTrack = null;
    if (this.activeBgm) {
      this.fadeOutAndDisposeBgm(this.activeBgm, fadeOutMs);
      this.activeBgm = null;
    }
  }

  /**
   * Release all active BGM timers and close AudioContext when completely disposing the game.
   */
  public dispose(): void {
    this.stopBgm(0);
    this.fadingBgms.forEach((ctrl) => this.disposeControllerImmediate(ctrl));
    this.fadingBgms.clear();

    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.sharedNoiseBuffer = null;
  }

  /**
   * Play one of the 9 game sound effects with cooldown throttling & polyphony limit.
   */
  public playSfx(id: SfxId): void {
    if (!this.isUnlocked || this.muted || this.sfxVolume <= 0.001) {
      return;
    }

    const nowMs = performance.now();
    const lastMs = this.lastSfxTimestamp.get(id) ?? -Infinity;
    const cooldown = SFX_COOLDOWN_MS[id];
    if (nowMs - lastMs < cooldown) {
      return;
    }

    if (this.activeSfxCount >= this.maxConcurrentSfx) {
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    this.lastSfxTimestamp.set(id, nowMs);

    switch (id) {
      case 'button_click':
        this.synthButtonClick(ctx, this.sfxGain);
        break;
      case 'frying_food':
        this.synthFryingFood(ctx, this.sfxGain);
        break;
      case 'food_ready':
        this.synthFoodReady(ctx, this.sfxGain);
        break;
      case 'customer_arrival':
        this.synthCustomerArrival(ctx, this.sfxGain);
        break;
      case 'customer_ordering':
        this.synthCustomerOrdering(ctx, this.sfxGain);
        break;
      case 'payment_success':
        this.synthPaymentSuccess(ctx, this.sfxGain);
        break;
      case 'upgrade_success':
        this.synthUpgradeSuccess(ctx, this.sfxGain);
        break;
      case 'warning':
        this.synthWarning(ctx, this.sfxGain);
        break;
      case 'day_completed':
        this.synthDayCompleted(ctx, this.sfxGain);
        break;
    }
  }

  // ===========================================================================
  // INTERNAL SYNTHESIZERS (Auto-disconnecting nodes for zero memory leaks)
  // ===========================================================================

  private playTone(
    ctx: AudioContext,
    dest: AudioNode,
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    startTime: number,
    durationSec: number,
    peakGain: number,
    trackAsSfx = true
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    if (Math.abs(endFreq - startFreq) > 0.5) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + durationSec);
    }

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + Math.min(0.015, durationSec * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + durationSec);

    osc.connect(gain);
    gain.connect(dest);

    if (trackAsSfx) {
      this.activeSfxCount += 1;
    }

    osc.onended = () => {
      if (trackAsSfx) {
        this.activeSfxCount = Math.max(0, this.activeSfxCount - 1);
      }
      osc.disconnect();
      gain.disconnect();
    };

    osc.start(startTime);
    osc.stop(startTime + durationSec + 0.01);
  }

  private synthButtonClick(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    this.playTone(ctx, dest, 'sine', 460, 780, now, 0.065, 0.14);
  }

  private synthFryingFood(ctx: AudioContext, dest: AudioNode): void {
    if (!this.sharedNoiseBuffer) {
      this.sharedNoiseBuffer = this.createSharedNoiseBuffer(ctx);
    }

    const now = ctx.currentTime;
    const durationSec = 0.22;

    const source = ctx.createBufferSource();
    source.buffer = this.sharedNoiseBuffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(2600, now);
    bandpass.frequency.linearRampToValueAtTime(3400, now + durationSec);
    bandpass.Q.setValueAtTime(1.4, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.002, now + durationSec);

    source.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(dest);

    this.activeSfxCount += 1;
    source.onended = () => {
      this.activeSfxCount = Math.max(0, this.activeSfxCount - 1);
      source.disconnect();
      bandpass.disconnect();
      gain.disconnect();
    };

    // Random offset into the 1-second shared noise buffer so each sizzle sounds organic
    const maxOffset = Math.max(0, this.sharedNoiseBuffer.duration - durationSec - 0.02);
    const randomOffset = Math.random() * maxOffset;
    source.start(now, randomOffset, durationSec);
  }

  private synthFoodReady(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    this.playTone(ctx, dest, 'triangle', 880, 880, now, 0.14, 0.18);
    this.playTone(ctx, dest, 'triangle', 1318.51, 1318.51, now + 0.075, 0.28, 0.2);
  }

  private synthCustomerArrival(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    // Warm two-note shop door chime (E5 -> G5)
    this.playTone(ctx, dest, 'sine', 659.25, 659.25, now, 0.12, 0.12);
    this.playTone(ctx, dest, 'sine', 783.99, 783.99, now + 0.08, 0.18, 0.14);
  }

  private synthCustomerOrdering(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    // Soft speech bubble pop-in marimba tap
    this.playTone(ctx, dest, 'triangle', 523.25, 659.25, now, 0.08, 0.11);
  }

  private synthPaymentSuccess(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    const notes = [987.77, 1318.51, 1567.98]; // B5 - E6 - G6
    notes.forEach((freq, idx) => {
      this.playTone(ctx, dest, 'sine', freq, freq, now + idx * 0.055, 0.22, 0.16);
    });
  }

  private synthUpgradeSuccess(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5]; // C5 - E5 - G5 - C6 ascending fanfare
    chord.forEach((freq, idx) => {
      this.playTone(ctx, dest, 'triangle', freq, freq, now + idx * 0.06, 0.26, 0.17);
    });
  }

  private synthWarning(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    // Double low-mid alert pulse
    this.playTone(ctx, dest, 'sawtooth', 240, 175, now, 0.12, 0.12);
    this.playTone(ctx, dest, 'sawtooth', 210, 145, now + 0.13, 0.15, 0.13);
  }

  private synthDayCompleted(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    const fanfare: Array<{ freq: number; delay: number; dur: number }> = [
      { freq: 523.25, delay: 0, dur: 0.16 }, // C5
      { freq: 659.25, delay: 0.12, dur: 0.16 }, // E5
      { freq: 783.99, delay: 0.24, dur: 0.18 }, // G5
      { freq: 1046.5, delay: 0.38, dur: 0.42 }, // C6
    ];
    fanfare.forEach((n) => {
      this.playTone(ctx, dest, 'triangle', n.freq, n.freq, now + n.delay, n.dur, 0.18);
    });
  }

  // ===========================================================================
  // BGM SEQUENCER & SMOOTH CROSSFADE
  // ===========================================================================

  private startBgmSequencer(controller: BgmLoopController): void {
    const pattern = BGM_PATTERNS[controller.trackId];
    let stepIndex = 0;

    const tick = () => {
      if (controller.stopped || !this.ctx) return;

      if (this.ctx.state === 'running' && !this.muted && this.musicVolume > 0.001) {
        const step = pattern.notes[stepIndex % pattern.notes.length];
        const now = this.ctx.currentTime;

        // Lead melody note
        this.playTone(
          this.ctx,
          controller.branchGain,
          'triangle',
          step.leadFreq,
          step.leadFreq,
          now,
          step.durationSec,
          0.075,
          false
        );

        // Warm bass root note
        if (step.bassFreq) {
          this.playTone(
            this.ctx,
            controller.branchGain,
            'sine',
            step.bassFreq,
            step.bassFreq,
            now,
            step.durationSec * 1.35,
            0.065,
            false
          );
        }

        // Gentle harmony pad note
        if (step.harmonyFreq) {
          this.playTone(
            this.ctx,
            controller.branchGain,
            'sine',
            step.harmonyFreq,
            step.harmonyFreq,
            now,
            step.durationSec * 1.15,
            0.04,
            false
          );
        }
      }

      stepIndex = (stepIndex + 1) % pattern.notes.length;
      controller.timerId = window.setTimeout(tick, pattern.stepMs);
    };

    tick();
  }

  private fadeOutAndDisposeBgm(controller: BgmLoopController, fadeOutMs: number): void {
    controller.stopped = true;
    if (controller.timerId !== null) {
      window.clearTimeout(controller.timerId);
      controller.timerId = null;
    }

    if (!this.ctx || fadeOutMs <= 0) {
      this.disposeControllerImmediate(controller);
      return;
    }

    this.fadingBgms.add(controller);
    const now = this.ctx.currentTime;
    const fadeSec = Math.max(0.05, fadeOutMs / 1000);
    try {
      controller.branchGain.gain.cancelScheduledValues(now);
      controller.branchGain.gain.setValueAtTime(
        Math.max(0.0001, controller.branchGain.gain.value),
        now
      );
      controller.branchGain.gain.linearRampToValueAtTime(0.0001, now + fadeSec);
    } catch {
      // Ignore Web Audio scheduling edge cases
    }

    window.setTimeout(() => {
      this.fadingBgms.delete(controller);
      this.disposeControllerImmediate(controller);
    }, fadeOutMs + 60);
  }

  private disposeControllerImmediate(controller: BgmLoopController): void {
    controller.stopped = true;
    if (controller.timerId !== null) {
      window.clearTimeout(controller.timerId);
      controller.timerId = null;
    }
    try {
      controller.branchGain.disconnect();
    } catch {
      // Already disconnected
    }
  }

  // ===========================================================================
  // CONTEXT, GAIN GRAPH, STORAGE & MOBILE LIFECYCLE
  // ===========================================================================

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const win = window as Window & { webkitAudioContext?: typeof AudioContext };
      const AudioCtx = window.AudioContext || win.webkitAudioContext;
      if (!AudioCtx) return null;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.sharedNoiseBuffer = this.createSharedNoiseBuffer(this.ctx);
      this.applyGainValues();
    }

    if (this.ctx.state === 'suspended' && this.isUnlocked) {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  private createSharedNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate; // 1.0 second reusable white noise buffer
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private applyGainValues(): void {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const masterTarget = this.muted ? 0 : 1;
    const duckFactor = this.musicDucked ? 0.45 : 1.0;
    const musicTarget = this.musicVolume * duckFactor;
    const sfxTarget = this.sfxVolume;

    this.masterGain.gain.setTargetAtTime(masterTarget, now, 0.02);
    this.musicGain.gain.setTargetAtTime(musicTarget, now, 0.03);
    this.sfxGain.gain.setTargetAtTime(sfxTarget, now, 0.02);
  }

  private bindInteractionUnlock(): void {
    if (typeof window === 'undefined' || this.unlockListenersBound) return;
    this.unlockListenersBound = true;

    const unlockHandler = () => {
      if (this.isUnlocked) return;
      this.isUnlocked = true;

      const ctx = this.ensureContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      if (this.desiredBgmTrack) {
        this.playBgm(this.desiredBgmTrack, 400);
      }

      window.removeEventListener('pointerdown', unlockHandler);
      window.removeEventListener('keydown', unlockHandler);
      window.removeEventListener('touchstart', unlockHandler);
    };

    window.addEventListener('pointerdown', unlockHandler, { passive: true });
    window.addEventListener('keydown', unlockHandler, { passive: true });
    window.addEventListener('touchstart', unlockHandler, { passive: true });
  }

  private bindVisibilityLifecycle(): void {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseBgm();
      } else {
        this.resumeBgm();
      }
    });
  }

  private loadSettingsFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(AUDIO_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<AudioSettings>;
      if (typeof parsed.musicVolume === 'number') {
        this.musicVolume = Math.max(0, Math.min(1, parsed.musicVolume));
      }
      if (typeof parsed.sfxVolume === 'number') {
        this.sfxVolume = Math.max(0, Math.min(1, parsed.sfxVolume));
      }
      if (typeof parsed.muted === 'boolean') {
        this.muted = parsed.muted;
      }
    } catch {
      // Ignore malformed storage
    }
  }

  private saveSettingsToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const payload: AudioSettings = {
        musicVolume: Number(this.musicVolume.toFixed(2)),
        sfxVolume: Number(this.sfxVolume.toFixed(2)),
        muted: this.muted,
      };
      localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }
}

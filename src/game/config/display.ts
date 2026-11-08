import Phaser from 'phaser';

/**
 * HiDPI & Ultra High-Resolution Rendering Engine for Cá Viên Chiên Tycoon.
 *
 * Coordinates throughout the game are built on fixed logical spaces:
 * - Portrait: 420 × 780 (Mobile street-food layout)
 * - Landscape: 1280 × 720 (Desktop widescreen counter)
 *
 * To achieve razor-sharp, crystal-clear graphics on modern Retina, Full HD, 2K,
 * and 4K displays without distorting UI layout, we render the WebGL canvas at
 * high internal resolution:
 *   Canvas Buffer = Logical Dimensions × RENDER_SCALE
 *
 * Each scene's camera is zoomed to RENDER_SCALE with origin (0, 0), so vector
 * shapes (Graphics), high-res fonts (Text), and sprites render with native screen
 * density and subpixel precision.
 */

export const PORTRAIT_WIDTH = 420;
export const PORTRAIT_HEIGHT = 780;

export const LANDSCAPE_WIDTH = 1280;
export const LANDSCAPE_HEIGHT = 720;

export type LayoutMode = 'portrait' | 'landscape';

/**
 * Determines whether the user is on a desktop widescreen or mobile portrait view.
 */
export function detectLayoutMode(): LayoutMode {
  if (typeof window === 'undefined') return 'portrait';
  return window.innerWidth >= 820 && window.innerWidth > window.innerHeight * 1.05
    ? 'landscape'
    : 'portrait';
}

/**
 * Calculates the optimal high-resolution render scale based on devicePixelRatio
 * and display size.
 *
 * By default, uses at least 2.0x (e.g. 2560×1440 for desktop, 1050×1950 for portrait)
 * and up to 3.0x on high-DPI/Retina screens for pristine sharpness.
 */
export function computeOptimalRenderScale(): number {
  if (typeof window === 'undefined') return 2;
  const dpr = window.devicePixelRatio || 1;
  // At least 2.0x for crisp supersampling, up to 3.0x on Retina/4K displays
  const scale = Math.max(2, Math.min(3, Math.round(dpr * 10) / 10));
  return scale;
}

let activeRenderScale: number = computeOptimalRenderScale();

export function getRenderScale(): number {
  return activeRenderScale;
}

export function updateRenderScale(): number {
  activeRenderScale = computeOptimalRenderScale();
  return activeRenderScale;
}

/**
 * Returns the logical dimensions and layout classification for scene UI construction.
 */
export function getLogicalDimensions(mode: LayoutMode = detectLayoutMode()): {
  width: number;
  height: number;
  isDesktop: boolean;
} {
  const isDesktop = mode === 'landscape';
  return isDesktop
    ? { width: LANDSCAPE_WIDTH, height: LANDSCAPE_HEIGHT, isDesktop: true }
    : { width: PORTRAIT_WIDTH, height: PORTRAIT_HEIGHT, isDesktop: false };
}

/**
 * Returns physical canvas buffer dimensions (logical dimensions × renderScale).
 */
export function getTargetDimensions(mode: LayoutMode = detectLayoutMode()): {
  width: number;
  height: number;
} {
  const logical = getLogicalDimensions(mode);
  const scale = getRenderScale();
  return {
    width: Math.round(logical.width * scale),
    height: Math.round(logical.height * scale),
  };
}

/**
 * Configures the scene's primary camera to zoom to the active high-resolution scale,
 * mapping logical coordinates (0..W, 0..H) directly across the high-res canvas buffer.
 */
export function applyHiDPICamera(scene: Phaser.Scene): void {
  const scale = getRenderScale();
  const cam = scene.cameras.main;
  cam.setOrigin(0, 0);
  cam.setZoom(scale);
  cam.setScroll(0, 0);
}

let textPatched = false;

/**
 * Patches Phaser's Text factory and TextStyle to ensure all text glyphs
 * (Baloo 2, Plus Jakarta Sans, JetBrains Mono) are rasterized at high resolution
 * matching the display's render scale, producing razor-sharp typography.
 */
export function patchTextResolution(): void {
  if (textPatched) return;
  textPatched = true;

  // 1. Patch GameObjectFactory.text for all `this.add.text()` invocations
  const origAddText = Phaser.GameObjects.GameObjectFactory.prototype.text;
  Phaser.GameObjects.GameObjectFactory.prototype.text = function (
    x: number,
    y: number,
    text: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle
  ) {
    const scale = getRenderScale();
    const resolvedStyle: Phaser.Types.GameObjects.Text.TextStyle = Object.assign(
      { resolution: Math.max(2, Math.ceil(scale)) },
      style
    );
    if (!resolvedStyle.resolution || resolvedStyle.resolution < scale) {
      resolvedStyle.resolution = Math.max(2, Math.ceil(scale));
    }
    return origAddText.call(this, x, y, text, resolvedStyle);
  };

  // 2. Patch TextStyle.setStyle so dynamic setStyle calls also preserve high resolution
  const origSetStyle = Phaser.GameObjects.TextStyle.prototype.setStyle;
  Phaser.GameObjects.TextStyle.prototype.setStyle = function (
    this: Phaser.GameObjects.TextStyle,
    style: Phaser.Types.GameObjects.Text.TextStyle,
    updateText?: boolean,
    setDefaults?: boolean
  ) {
    const scale = getRenderScale();
    const userRes = style?.resolution;
    const res = origSetStyle.call(this, style, false, setDefaults);
    if (!userRes) {
      this.resolution = Math.max(2, Math.ceil(scale));
    }
    if (updateText !== false) {
      this.update(true);
    }
    return res;
  };
}

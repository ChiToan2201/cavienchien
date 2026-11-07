import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { MenuScene } from '../scenes/MenuScene';
import { ShopScene } from '../scenes/ShopScene';
import { ModalScene } from '../scenes/ModalScene';

export type LayoutMode = 'portrait' | 'landscape';

export const PORTRAIT_WIDTH = 420;
export const PORTRAIT_HEIGHT = 780;

export const LANDSCAPE_WIDTH = 1280;
export const LANDSCAPE_HEIGHT = 720;

export function detectLayoutMode(): LayoutMode {
  if (typeof window === 'undefined') return 'portrait';
  return window.innerWidth >= 820 && window.innerWidth > window.innerHeight * 1.05
    ? 'landscape'
    : 'portrait';
}

export function getTargetDimensions(mode: LayoutMode = detectLayoutMode()): { width: number; height: number } {
  return mode === 'landscape'
    ? { width: LANDSCAPE_WIDTH, height: LANDSCAPE_HEIGHT }
    : { width: PORTRAIT_WIDTH, height: PORTRAIT_HEIGHT };
}

// Legacy exports for compatibility
export const GAME_WIDTH = PORTRAIT_WIDTH;
export const GAME_HEIGHT = PORTRAIT_HEIGHT;

const initialDims = getTargetDimensions();

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: initialDims.width,
  height: initialDims.height,
  backgroundColor: '#16110d',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: initialDims.width,
    height: initialDims.height,
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: true,
  },
  scene: [BootScene, PreloadScene, MenuScene, ShopScene, ModalScene],
};

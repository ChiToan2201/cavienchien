import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { MenuScene } from '../scenes/MenuScene';
import { ShopScene } from '../scenes/ShopScene';
import { ModalScene } from '../scenes/ModalScene';
import {
  PORTRAIT_WIDTH,
  PORTRAIT_HEIGHT,
  LANDSCAPE_WIDTH,
  LANDSCAPE_HEIGHT,
  LayoutMode,
  detectLayoutMode,
  getLogicalDimensions,
  getTargetDimensions,
  getRenderScale,
} from './display';

export {
  PORTRAIT_WIDTH,
  PORTRAIT_HEIGHT,
  LANDSCAPE_WIDTH,
  LANDSCAPE_HEIGHT,
  LayoutMode,
  detectLayoutMode,
  getLogicalDimensions,
  getTargetDimensions,
  getRenderScale,
};

// Legacy exports for backwards compatibility
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
    antialiasGL: true,
    pixelArt: false,
    roundPixels: false, // subpixel rendering gives smooth, high-fidelity lines and fonts
    powerPreference: 'high-performance',
    clearBeforeRender: true,
  },
  scene: [BootScene, PreloadScene, MenuScene, ShopScene, ModalScene],
};

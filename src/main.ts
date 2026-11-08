import Phaser from 'phaser';
import './styles/main.css';
import {
  gameConfig,
  detectLayoutMode,
  getTargetDimensions,
  LayoutMode,
} from './game/config/gameConfig';
import { patchTextResolution, updateRenderScale } from './game/config/display';

// Enable high-DPI text resolution before game initialization
patchTextResolution();

window.addEventListener('DOMContentLoaded', () => {
  let currentMode: LayoutMode = detectLayoutMode();
  const game = new Phaser.Game(gameConfig);

  let resizeTimeout: number | undefined;
  window.addEventListener('resize', () => {
    if (resizeTimeout) window.clearTimeout(resizeTimeout);
    resizeTimeout = window.setTimeout(() => {
      const nextMode = detectLayoutMode();
      const prevScale = gameConfig.width;
      updateRenderScale();
      const nextDims = getTargetDimensions(nextMode);

      if (nextMode !== currentMode || prevScale !== nextDims.width) {
        currentMode = nextMode;
        game.scale.setGameSize(nextDims.width, nextDims.height);

        // Restart active main scene so it rebuilds cleanly in the new orientation / resolution
        const activeScenes = game.scene.getScenes(true);
        const hasModal = activeScenes.some((s) => s.scene.key === 'ModalScene');
        if (hasModal) {
          game.scene.stop('ModalScene');
        }
        for (const sc of activeScenes) {
          if (sc.scene.key === 'ShopScene' || sc.scene.key === 'MenuScene') {
            sc.scene.restart();
          }
        }
      }
    }, 150);
  });
});

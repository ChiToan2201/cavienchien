import Phaser from 'phaser';

/**
 * SpriteForgeProcessor
 * --------------------
 * Runtime pipeline implementing the deterministic `agent-sprite-forge` skill suite:
 * 1. `forge_matte.py` — Border palette sampling, Soft-Matte Keying (t0..t1 linear ramp),
 *    inward alpha monotonicity, and Color Un-mixing / Despill: F = (C - (1 - a) * K) / a.
 * 2. `forge_core.py` — Connected-component artifact filtering (strips border crop remnants),
 *    tight subject bounding-box trimming (`subject_bbox`), and anchor registration
 *    (`feet` baseline alignment for characters; `center` uniform padding for food & props).
 * 3. `codeart2d` — Structured multi-tone cel-shaded procedural art (`art_source: "code"`)
 *    for the 6 food items without external PNG files, matching the chibi palette & specular style.
 */

export type AnchorMode = 'feet' | 'center';

export interface ForgeSpriteConfig {
  anchor: AnchorMode;
  targetWidth?: number;
  targetHeight?: number;
  paddingRatio?: number;
  t0?: number;
  t1?: number;
  stripBorderComponents?: boolean;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export class SpriteForgeProcessor {
  /**
   * Estimate background key color K from border pixels using median RGB,
   * plus build a set of border-sampled background palettes for multi-tone cream/checkered matte.
   */
  private static sampleBorderKey(data: Uint8ClampedArray, w: number, h: number): { primaryKey: RGB; samples: RGB[] } {
    const samples: RGB[] = [];
    const rs: number[] = [];
    const gs: number[] = [];
    const bs: number[] = [];
    let transparentBorders = 0;
    let checkedBorders = 0;

    const pushPixel = (x: number, y: number) => {
      const idx = (y * w + x) * 4;
      const a = data[idx + 3];
      checkedBorders++;
      if (a < 16) {
        transparentBorders++;
        return;
      }
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // Ignore very dark border crop artifacts when estimating the cream background key
      if (r + g + b < 420) return;
      rs.push(r);
      gs.push(g);
      bs.push(b);
    };

    const stepX = Math.max(1, Math.floor(w / 32));
    const stepY = Math.max(1, Math.floor(h / 32));

    for (let x = 0; x < w; x += stepX) {
      pushPixel(x, 0);
      pushPixel(x, h - 1);
      if (h > 4) {
        pushPixel(x, 2);
        pushPixel(x, h - 3);
      }
    }
    for (let y = 0; y < h; y += stepY) {
      pushPixel(0, y);
      pushPixel(w - 1, y);
      if (w > 4) {
        pushPixel(2, y);
        pushPixel(w - 3, y);
      }
    }

    // If border is already predominantly transparent (>35%), the texture has no solid background key.
    // Prevent sampling foreground parts touching the frame boundary as a background key!
    if (checkedBorders > 0 && transparentBorders / checkedBorders > 0.35) {
      const fallback = { r: 251, g: 245, b: 229 };
      return { primaryKey: fallback, samples: [fallback] };
    }

    if (rs.length === 0) {
      const fallback = { r: 251, g: 245, b: 229 };
      return { primaryKey: fallback, samples: [fallback] };
    }

    rs.sort((a, b) => a - b);
    gs.sort((a, b) => a - b);
    bs.sort((a, b) => a - b);
    const mid = Math.floor(rs.length / 2);
    const primaryKey: RGB = { r: rs[mid], g: gs[mid], b: bs[mid] };

    // Collect up to 8 representative border samples
    const stride = Math.max(1, Math.floor(rs.length / 8));
    for (let i = 0; i < rs.length; i += stride) {
      samples.push({ r: rs[i], g: gs[i], b: bs[i] });
    }
    samples.push(primaryKey);

    return { primaryKey, samples };
  }

  private static colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  private static minPaletteDistance(r: number, g: number, b: number, samples: RGB[]): number {
    let minD = Infinity;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const d = this.colorDistance(r, g, b, s.r, s.g, s.b);
      if (d < minD) minD = d;
    }
    return minD;
  }

  /**
   * Warm cream heuristic matching the AI-generated cream canvas background
   */
  private static isWarmCreamBg(r: number, g: number, b: number, primaryKey: RGB, samples: RGB[]): boolean {
    if (this.minPaletteDistance(r, g, b, samples) < 38) return true;
    if (this.colorDistance(r, g, b, primaryKey.r, primaryKey.g, primaryKey.b) < 42) return true;
    // Warm cream canvas signature: high R & G, slightly lower B, low saturation
    if (r > 232 && g > 222 && b > 195 && r >= b && g >= b - 5 && Math.abs(r - g) < 24) {
      return true;
    }
    return false;
  }

  /**
   * Process a single image or frame buffer with `forge_matte` + `forge_core`:
   * 1. Strip thin border frame lines (within 3px of image edges if dark/grey crop artifact).
   * 2. Flood-fill background from border seeds (reaching past edge crop remnants).
   * 3. Connected-component filtering (`forge_core.connected_components`) to eliminate
   *    disconnected border crop blobs (e.g. left dark bar on `gas-tank`, left speck on `cust-student-boy`,
   *    left leaf tip on `topping-hanh` / `topping-ot`, bottom-left speck on `ca-vien-trung-ca`).
   * 4. Soft-Matte Keying + Color Un-mixing (`F = (C - (1 - a) * K) / a`) on the 2px boundary halo
   *    so anti-aliased dark-brown outlines blend cleanly without cream fringes.
   */
  public static cleanFramePixels(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    options: { t0?: number; t1?: number; stripBorderComponents?: boolean } = {}
  ): BBox {
    const t0 = options.t0 ?? 14;
    const t1 = options.t1 ?? 54;
    const stripBorder = options.stripBorderComponents ?? true;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const total = w * h;

    const { primaryKey, samples } = this.sampleBorderKey(data, w, h);

    // Mask: 0 = foreground candidate, 1 = background
    const bgMask = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;

    const enqueueBg = (x: number, y: number) => {
      if (x < 0 || x >= w || y < 0 || y >= h) return;
      const pos = y * w + x;
      if (bgMask[pos] === 1) return;
      const idx = pos * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      if (a < 20 || this.isWarmCreamBg(r, g, b, primaryKey, samples)) {
        bgMask[pos] = 1;
        queue[tail++] = pos;
      }
    };

    // Seed from outer border AND 4px inset ring so edge crop bars don't block flood fill
    const inset = Math.min(5, Math.floor(Math.min(w, h) * 0.04));
    for (let x = 0; x < w; x++) {
      enqueueBg(x, 0);
      enqueueBg(x, h - 1);
      if (inset > 0) {
        enqueueBg(x, inset);
        enqueueBg(x, h - 1 - inset);
      }
    }
    for (let y = 0; y < h; y++) {
      enqueueBg(0, y);
      enqueueBg(w - 1, y);
      if (inset > 0) {
        enqueueBg(inset, y);
        enqueueBg(w - 1 - inset, y);
      }
    }

    // 8-connected flood fill for background matte
    while (head < tail) {
      const pos = queue[head++];
      const x = pos % w;
      const y = (pos - x) / w;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const npos = ny * w + nx;
          if (bgMask[npos] === 0) {
            const nidx = npos * 4;
            if (
              data[nidx + 3] < 20 ||
              this.isWarmCreamBg(data[nidx], data[nidx + 1], data[nidx + 2], primaryKey, samples)
            ) {
              bgMask[npos] = 1;
              queue[tail++] = npos;
            }
          }
        }
      }
    }

    // Connected-component analysis on foreground (bgMask === 0)
    // Removes isolated border crop artifacts (like the dark bar on gas-tank.png or edge specks)
    if (stripBorder) {
      const compId = new Int32Array(total);
      let currentComp = 0;
      let maxMainArea = 0;
      let mainCompId = -1;

      const compMeta: Array<{
        id: number;
        area: number;
        touchesEdge: boolean;
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
        sumX: number;
        sumY: number;
      }> = [];

      const ccQueue = new Int32Array(total);

      for (let pos = 0; pos < total; pos++) {
        if (bgMask[pos] === 1 || compId[pos] !== 0) continue;
        currentComp++;
        const id = currentComp;
        let cHead = 0;
        let cTail = 0;
        ccQueue[cTail++] = pos;
        compId[pos] = id;

        let area = 0;
        let touchesEdge = false;
        let minX = w;
        let maxX = 0;
        let minY = h;
        let maxY = 0;
        let sumX = 0;
        let sumY = 0;

        while (cHead < cTail) {
          const p = ccQueue[cHead++];
          const px = p % w;
          const py = (p - px) / w;
          area++;
          sumX += px;
          sumY += py;
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
          if (px <= 2 || px >= w - 3 || py <= 2 || py >= h - 3) {
            touchesEdge = true;
          }

          for (let dy = -1; dy <= 1; dy++) {
            const ny = py + dy;
            if (ny < 0 || ny >= h) continue;
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = px + dx;
              if (nx < 0 || nx >= w) continue;
              const np = ny * w + nx;
              if (bgMask[np] === 0 && compId[np] === 0) {
                compId[np] = id;
                ccQueue[cTail++] = np;
              }
            }
          }
        }

        compMeta.push({ id, area, touchesEdge, minX, maxX, minY, maxY, sumX, sumY });
        if (area > maxMainArea) {
          maxMainArea = area;
          mainCompId = id;
        }
      }

      if (mainCompId !== -1 && compMeta.length > 1) {
        const removeIds = new Set<number>();
        const edgeBandX = Math.max(6, Math.floor(w * 0.06));
        const edgeBandY = Math.max(6, Math.floor(h * 0.06));

        for (const comp of compMeta) {
          if (comp.id === mainCompId) continue;
          const cw = comp.maxX - comp.minX + 1;
          const ch = comp.maxY - comp.minY + 1;
          const cx = comp.sumX / comp.area;
          const cy = comp.sumY / comp.area;

          // Strip any secondary component that:
          // 1. Touches the outer border and is smaller than 25% of the main subject
          // 2. Is a thin vertical/horizontal border bar hugging the edge (e.g. gas-tank.png)
          // 3. Is a tiny isolated speck (< 1.2% of main subject area)
          const isEdgeStrip =
            comp.touchesEdge &&
            (comp.maxX < edgeBandX * 2 ||
              comp.minX > w - edgeBandX * 2 ||
              comp.maxY < edgeBandY * 2 ||
              comp.minY > h - edgeBandY * 2 ||
              cw < Math.max(12, w * 0.05) ||
              ch < Math.max(12, h * 0.05));

          const isSmallEdgeArtifact = comp.touchesEdge && comp.area < maxMainArea * 0.22;
          const isTinySpeck = comp.area < maxMainArea * 0.008;
          const isFarCornerSpeck =
            comp.area < maxMainArea * 0.05 &&
            (cx < w * 0.12 || cx > w * 0.88 || cy < h * 0.12 || cy > h * 0.88);

          if (isEdgeStrip || isSmallEdgeArtifact || isTinySpeck || isFarCornerSpeck) {
            removeIds.add(comp.id);
          }
        }

        if (removeIds.size > 0) {
          for (let pos = 0; pos < total; pos++) {
            if (removeIds.has(compId[pos])) {
              bgMask[pos] = 1;
            }
          }
        }
      }
    }

    // Also strip 2px thin border bars that happened to touch the subject at a single bridge
    // (specifically handles top border line on chef-sheet or vertical edge bar on gas-tank)
    const borderMargin = Math.max(3, Math.floor(w * 0.018));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < borderMargin; x++) {
        // Check if there is a background gap between x and the center subject
        let hasGap = false;
        const probeEnd = Math.min(w - 1, borderMargin * 4);
        for (let px = x + 1; px <= probeEnd; px++) {
          if (bgMask[y * w + px] === 1) {
            hasGap = true;
            break;
          }
        }
        if (hasGap) bgMask[y * w + x] = 1;
      }
      for (let x = w - borderMargin; x < w; x++) {
        let hasGap = false;
        const probeStart = Math.max(0, w - 1 - borderMargin * 4);
        for (let px = x - 1; px >= probeStart; px--) {
          if (bgMask[y * w + px] === 1) {
            hasGap = true;
            break;
          }
        }
        if (hasGap) bgMask[y * w + x] = 1;
      }
    }

    // Apply `forge_matte` Soft-Matte Keying + Color Un-mixing (`unmix`)
    // For background pixels -> alpha = 0
    // For foreground pixels within 2px of background -> compute soft ramp alpha & unmix key color K
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const pos = y * w + x;
        const idx = pos * 4;

        if (bgMask[pos] === 1) {
          data[idx + 3] = 0;
          continue;
        }

        // Check distance to background (1px or 2px ring for soft-matte & despill)
        let adjBgDist = 0; // 0 = interior, 1 = 1px from bg, 2 = 2px from bg
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= h) {
            adjBgDist = 1;
            break;
          }
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= w || bgMask[ny * w + nx] === 1) {
              adjBgDist = 1;
              break;
            }
          }
          if (adjBgDist === 1) break;
        }

        if (adjBgDist === 0) {
          // Check 2-pixel neighborhood
          for (let dy = -2; dy <= 2; dy += 2) {
            const ny = y + dy;
            if (ny < 0 || ny >= h) continue;
            for (let dx = -2; dx <= 2; dx += 2) {
              const nx = x + dx;
              if (nx >= 0 && nx < w && bgMask[ny * w + nx] === 1) {
                adjBgDist = 2;
                break;
              }
            }
            if (adjBgDist === 2) break;
          }
        }

        if (adjBgDist > 0) {
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const d = this.colorDistance(r, g, b, primaryKey.r, primaryKey.g, primaryKey.b);

          // Linear ramp in [t0, t1] (forge_matte.soft_alpha)
          let softA = (d - t0) / Math.max(1, t1 - t0);
          softA = Math.max(0, Math.min(1, softA));

          if (adjBgDist === 2) {
            // Inward monotonicity: 2px ring is at least 0.72 alpha unless strongly cream
            softA = Math.max(softA, d > t0 * 1.4 ? 0.82 : softA);
          }

          if (softA < 0.08) {
            data[idx + 3] = 0;
            continue;
          }

          // Color un-mixing (`forge_matte.unmix`): F = (C - (1 - a) * K) / a
          const invA = Math.max(0.22, softA);
          const unmixR = Math.max(0, Math.min(255, Math.round((r - (1 - softA) * primaryKey.r) / invA)));
          const unmixG = Math.max(0, Math.min(255, Math.round((g - (1 - softA) * primaryKey.g) / invA)));
          const unmixB = Math.max(0, Math.min(255, Math.round((b - (1 - softA) * primaryKey.b) / invA)));

          data[idx] = unmixR;
          data[idx + 1] = unmixG;
          data[idx + 2] = unmixB;
          data[idx + 3] = Math.round(softA * 255);
        }

        if (data[idx + 3] > 20) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    if (maxX < minX || maxY < minY) {
      return { minX: 0, minY: 0, maxX: w - 1, maxY: h - 1, width: w, height: h };
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  /**
   * Process a standalone image texture in Phaser:
   * - Cleans background with `forge_matte`
   * - Removes border crop artifacts with `forge_core` connected components
   * - Registers subject into a normalized canvas (`feet` baseline alignment for characters,
   *   `center` uniform padding for food & props)
   */
  public static processSingleTexture(
    scene: Phaser.Scene,
    key: string,
    config: ForgeSpriteConfig
  ): void {
    if (!scene.textures.exists(key)) return;
    const tex = scene.textures.get(key);
    const src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    if (!src || !src.width || !src.height) return;

    const srcW = src.width;
    const srcH = src.height;

    const workCanvas = document.createElement('canvas');
    workCanvas.width = srcW;
    workCanvas.height = srcH;
    const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });
    if (!workCtx) return;

    workCtx.drawImage(src, 0, 0);
    const bbox = this.cleanFramePixels(workCtx, srcW, srcH, {
      t0: config.t0,
      t1: config.t1,
      stripBorderComponents: config.stripBorderComponents ?? true,
    });

    const outW = config.targetWidth ?? srcW;
    const outH = config.targetHeight ?? srcH;
    const padRatio = config.paddingRatio ?? (config.anchor === 'feet' ? 0.04 : 0.08);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return;

    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = 'high';

    const availW = outW * (1 - padRatio * 2);
    const availH = outH * (1 - padRatio * 2);
    const scale = Math.min(availW / Math.max(1, bbox.width), availH / Math.max(1, bbox.height));

    const drawW = Math.round(bbox.width * scale);
    const drawH = Math.round(bbox.height * scale);
    const destX = Math.round((outW - drawW) / 2);

    // `feet` anchor pins the bottom of the character's shoes to a consistent baseline
    const destY =
      config.anchor === 'feet'
        ? Math.round(outH * (1 - padRatio * 0.65) - drawH)
        : Math.round((outH - drawH) / 2);

    outCtx.drawImage(
      workCanvas,
      bbox.minX,
      bbox.minY,
      bbox.width,
      bbox.height,
      destX,
      destY,
      drawW,
      drawH
    );

    scene.textures.remove(key);
    scene.textures.addCanvas(key, outCanvas);
  }

  /**
   * Process a horizontal spritesheet (`chef-sheet.png`) with per-frame `forge_matte`
   * and unified `feet` anchor registration so all 5 frames share the exact same
   * baseline and character height without jitter.
   */
  public static processSpritesheetTexture(
    scene: Phaser.Scene,
    key: string,
    frameCount: number,
    outFrameWidth: number,
    outFrameHeight: number
  ): void {
    if (!scene.textures.exists(key)) return;
    const tex = scene.textures.get(key);
    const src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    if (!src || !src.width || !src.height) return;

    const srcFrameH = src.height;

    // In chef-sheet.png (width 251px), the 5 character frames are non-uniform:
    // Chars are at: Frame 0 (12..53), Frame 1 (63..103), Frame 2 (110..149), Frame 3 (160..200), Frame 4 (205..246).
    // Slicing rigidly at src.width / 5 (50px) slices off the right edge of Character 0's face, ear and hat!
    // Using exact non-overlapping interval cuts between the empty column gaps preserves all 5 characters completely:
    const frameCuts: Array<{ startX: number; endX: number }> =
      key === 'chef_raw' && src.width === 251
        ? [
            { startX: 0, endX: 58 },
            { startX: 58, endX: 107 },
            { startX: 107, endX: 155 },
            { startX: 155, endX: 203 },
            { startX: 203, endX: 251 },
          ]
        : Array.from({ length: frameCount }, (_, i) => ({
            startX: Math.floor((src.width / frameCount) * i),
            endX: Math.floor((src.width / frameCount) * (i + 1)),
          }));

    const frameCanvases: HTMLCanvasElement[] = [];
    const bboxes: BBox[] = [];
    let maxSubjectH = 1;

    for (let i = 0; i < frameCount; i++) {
      const cut = frameCuts[i];
      const cutW = cut.endX - cut.startX;
      const fCanvas = document.createElement('canvas');
      fCanvas.width = cutW;
      fCanvas.height = srcFrameH;
      const fCtx = fCanvas.getContext('2d', { willReadFrequently: true })!;
      fCtx.drawImage(src, cut.startX, 0, cutW, srcFrameH, 0, 0, cutW, srcFrameH);

      const bbox = this.cleanFramePixels(fCtx, cutW, srcFrameH, {
        t0: 15,
        t1: 56,
        stripBorderComponents: false, // Preserves complete character outlines
      });

      frameCanvases.push(fCanvas);
      bboxes.push(bbox);
      if (bbox.height > maxSubjectH) maxSubjectH = bbox.height;
    }

    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = outFrameWidth * frameCount;
    sheetCanvas.height = outFrameHeight;
    const sheetCtx = sheetCanvas.getContext('2d')!;
    sheetCtx.imageSmoothingEnabled = true;
    sheetCtx.imageSmoothingQuality = 'high';

    const padRatio = 0.04;
    const availH = outFrameHeight * (1 - padRatio * 2);
    const unifiedScale = availH / maxSubjectH;
    const baselineY = Math.round(outFrameHeight * (1 - padRatio * 0.6));

    for (let i = 0; i < frameCount; i++) {
      const bbox = bboxes[i];
      const fCanvas = frameCanvases[i];
      const maxFrameW = outFrameWidth * (1 - padRatio * 1.5);
      const scale = Math.min(unifiedScale, maxFrameW / Math.max(1, bbox.width));

      const drawW = Math.round(bbox.width * scale);
      const drawH = Math.round(bbox.height * scale);
      const destX = i * outFrameWidth + Math.round((outFrameWidth - drawW) / 2);
      const destY = baselineY - drawH;

      sheetCtx.drawImage(
        fCanvas,
        bbox.minX,
        bbox.minY,
        bbox.width,
        bbox.height,
        destX,
        destY,
        drawW,
        drawH
      );
    }

    scene.textures.remove(key);
    scene.textures.addSpriteSheet(key, sheetCanvas as unknown as HTMLImageElement, {
      frameWidth: outFrameWidth,
      frameHeight: outFrameHeight,
    });

    // Generate dedicated high-resolution circular portrait avatar for HUD focused on the chef's face & hat
    if (key === 'chef_raw' && frameCanvases.length > 0) {
      const avatarSize = 128;
      const avatarCanvas = document.createElement('canvas');
      avatarCanvas.width = avatarSize;
      avatarCanvas.height = avatarSize;
      const avCtx = avatarCanvas.getContext('2d')!;
      avCtx.imageSmoothingEnabled = true;
      avCtx.imageSmoothingQuality = 'high';

      // Clip circle with 2px inner margin
      avCtx.save();
      avCtx.beginPath();
      avCtx.arc(avatarSize / 2, avatarSize / 2, avatarSize / 2 - 2, 0, Math.PI * 2);
      avCtx.clip();

      // Warm surface background inside circle
      avCtx.fillStyle = '#211913';
      avCtx.fillRect(0, 0, avatarSize, avatarSize);

      // Character 0 face is centered at x=33, y=30 with size ~38px in fCanvas[0]
      const f0 = frameCanvases[0];
      const b0 = bboxes[0];
      const headX = Math.max(0, b0.minX);
      const headY = Math.max(0, b0.minY);
      const headW = Math.min(f0.width - headX, b0.width);
      const headH = Math.min(f0.height - headY, Math.round(b0.height * 0.58));

      const destPadding = 10;
      const destDrawSize = avatarSize - destPadding * 2;
      const avScale = destDrawSize / Math.max(headW, headH);
      const avDrawW = headW * avScale;
      const avDrawH = headH * avScale;
      const avDestX = (avatarSize - avDrawW) / 2;
      const avDestY = (avatarSize - avDrawH) / 2 + 3;

      avCtx.drawImage(f0, headX, headY, headW, headH, avDestX, avDestY, avDrawW, avDrawH);
      avCtx.restore();

      // Crisp gold border ring
      avCtx.strokeStyle = '#f59e0b';
      avCtx.lineWidth = 4;
      avCtx.beginPath();
      avCtx.arc(avatarSize / 2, avatarSize / 2, avatarSize / 2 - 2, 0, Math.PI * 2);
      avCtx.stroke();

      scene.textures.remove('chef_avatar');
      scene.textures.addCanvas('chef_avatar', avatarCanvas);
    }
  }

  /**
   * Generate structured multi-tone cel-shaded food sprites (`codeart2d` skill workflow,
   * `art_source: "code"`) for the 6 food items without external PNG files, matching
   * the chibi ceramic plate base, dark-brown outline (`#381a08`), 3-tone shading, and specular glints.
   */
  public static generateCodeArt2DFoods(scene: Phaser.Scene): void {
    const size = 256;

    const createPlateCanvas = (plateTint: 'warm_ceramic' | 'bamboo_tray' = 'warm_ceramic') => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Soft ambient shadow beneath plate
      ctx.fillStyle = 'rgba(42, 22, 8, 0.22)';
      ctx.beginPath();
      ctx.ellipse(128, 194, 96, 36, 0, 0, Math.PI * 2);
      ctx.fill();

      // Outer plate rim with 3-tone cel shading & dark selective outline (#381a08)
      const rimGrad = ctx.createLinearGradient(0, 125, 0, 210);
      if (plateTint === 'warm_ceramic') {
        rimGrad.addColorStop(0, '#fffdf9');
        rimGrad.addColorStop(0.65, '#f5e6cf');
        rimGrad.addColorStop(1, '#d9bd96');
      } else {
        rimGrad.addColorStop(0, '#f7deb0');
        rimGrad.addColorStop(0.65, '#e2b874');
        rimGrad.addColorStop(1, '#b88642');
      }

      ctx.fillStyle = rimGrad;
      ctx.strokeStyle = '#381a08';
      ctx.lineWidth = 7.5;
      ctx.beginPath();
      ctx.ellipse(128, 174, 94, 38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner recessed dish well
      ctx.fillStyle = plateTint === 'warm_ceramic' ? '#efe0c8' : '#d4a55f';
      ctx.strokeStyle = plateTint === 'warm_ceramic' ? '#c9b18c' : '#a67635';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(128, 172, 72, 25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Fresh garnish leaf on back-left of plate for street-food authenticity
      ctx.save();
      ctx.translate(64, 154);
      ctx.rotate(-0.35);
      ctx.fillStyle = '#5bb338';
      ctx.strokeStyle = '#381a08';
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#8be05e';
      ctx.beginPath();
      ctx.ellipse(-4, -3, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      return { canvas, ctx };
    };

    const drawCelSphere = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      r: number,
      baseHex: string,
      shadowHex: string,
      highlightHex: string
    ) => {
      // Base fill
      ctx.fillStyle = baseHex;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Bottom crescent cel shadow
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = shadowHex;
      ctx.beginPath();
      ctx.arc(cx + r * 0.16, cy + r * 0.24, r * 0.95, 0, Math.PI * 2);
      ctx.fill();

      // Mid-upper warm body restore
      ctx.fillStyle = baseHex;
      ctx.beginPath();
      ctx.arc(cx - r * 0.12, cy - r * 0.15, r * 0.86, 0, Math.PI * 2);
      ctx.fill();

      // Top-left soft highlight zone
      ctx.fillStyle = highlightHex;
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.28, cy - r * 0.3, r * 0.42, r * 0.28, -0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Crisp dark-brown outline (#381a08)
      ctx.strokeStyle = '#381a08';
      ctx.lineWidth = 6.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // Specular white glint + secondary dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.34, cy - r * 0.36, r * 0.2, r * 0.11, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx - r * 0.12, cy - r * 0.48, r * 0.07, 0, Math.PI * 2);
      ctx.fill();
    };

    // 0. Cá Viên Truyền Thống (`food_ca_vien_truyen_thong`) — Signature golden fried fish balls with savory dark soy & chili drizzle
    if (!scene.textures.exists('food_ca_vien_truyen_thong')) {
      const { canvas, ctx } = createPlateCanvas('warm_ceramic');
      const coords = [
        { x: 96, y: 128, r: 28 },
        { x: 156, y: 130, r: 28 },
        { x: 78, y: 158, r: 29 },
        { x: 174, y: 156, r: 28 },
        { x: 126, y: 112, r: 30 },
        { x: 126, y: 156, r: 32 },
      ];
      for (const c of coords) {
        // Golden fried fish ball: warm golden crust (#e79442), deep amber shadow (#a85a1a), crispy yellow highlight (#ffc570)
        drawCelSphere(ctx, c.x, c.y, c.r, '#e79442', '#a85a1a', '#ffc570');
        // Blistered golden frying bubbles on fish balls
        ctx.fillStyle = '#ffcf7d';
        ctx.beginPath();
        ctx.arc(c.x + 8, c.y - 10, 3, 0, Math.PI * 2);
        ctx.arc(c.x - 10, c.y + 8, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Sriracha sweet chili sauce drizzle across front fish balls
      ctx.strokeStyle = '#d9381e';
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(90, 142);
      ctx.quadraticCurveTo(110, 168, 128, 152);
      ctx.quadraticCurveTo(145, 138, 162, 160);
      ctx.stroke();

      // Deep dark soy sauce accent (#261208)
      ctx.strokeStyle = '#261208';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(102, 148);
      ctx.quadraticCurveTo(124, 172, 148, 154);
      ctx.stroke();

      // Golden toasted garlic & scallion sprinkles
      const sprinkles = [
        { x: 118, y: 148, color: '#4ade80' },
        { x: 134, y: 145, color: '#22c55e' },
        { x: 126, y: 168, color: '#fef08a' },
        { x: 110, y: 160, color: '#fef08a' },
        { x: 142, y: 162, color: '#4ade80' },
        { x: 124, y: 132, color: '#fef08a' },
      ];
      for (const s of sprinkles) {
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2 Bamboo skewers sticking out to the right for authentic street food style
      ctx.strokeStyle = '#cda168';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(150, 125);
      ctx.lineTo(210, 100);
      ctx.moveTo(165, 148);
      ctx.lineTo(218, 132);
      ctx.stroke();

      scene.textures.addCanvas('food_ca_vien_truyen_thong', canvas);
    }

    // 1. Cá Viên Phô Mai (`food_ca_vien_pho_mai`) — Crispy golden balls with molten cheese ooze
    if (!scene.textures.exists('food_ca_vien_pho_mai')) {
      const { canvas, ctx } = createPlateCanvas('warm_ceramic');
      const coords = [
        { x: 96, y: 128, r: 28 },
        { x: 156, y: 130, r: 28 },
        { x: 78, y: 158, r: 29 },
        { x: 174, y: 156, r: 28 },
        { x: 126, y: 112, r: 30 },
        { x: 126, y: 156, r: 32 },
      ];
      for (const c of coords) {
        drawCelSphere(ctx, c.x, c.y, c.r, '#f59f18', '#c96f08', '#ffc952');
      }
      // Melted cheddar & mozzarella cheese pull from front-center ball
      ctx.fillStyle = '#ffe14d';
      ctx.strokeStyle = '#381a08';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(112, 150);
      ctx.quadraticCurveTo(126, 136, 142, 152);
      ctx.quadraticCurveTo(146, 172, 134, 182);
      ctx.quadraticCurveTo(126, 188, 118, 178);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fff9c4';
      ctx.beginPath();
      ctx.ellipse(126, 158, 9, 6, -0.2, 0, Math.PI * 2);
      ctx.fill();

      scene.textures.addCanvas('food_ca_vien_pho_mai', canvas);
    }

    // 2. Bò Viên (`food_bo_vien`) — Deep savory roasted beef meatballs with X-cut & pepper specks
    if (!scene.textures.exists('food_bo_vien')) {
      const { canvas, ctx } = createPlateCanvas('warm_ceramic');
      const coords = [
        { x: 94, y: 126, r: 28 },
        { x: 156, y: 128, r: 28 },
        { x: 82, y: 158, r: 29 },
        { x: 170, y: 158, r: 29 },
        { x: 126, y: 112, r: 30 },
        { x: 126, y: 156, r: 31 },
      ];
      for (const c of coords) {
        drawCelSphere(ctx, c.x, c.y, c.r, '#7c4728', '#522b14', '#a3643e');
        // Signature street-style scored X-cut on top of each beef ball
        ctx.strokeStyle = '#3d1d0a';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(c.x - 9, c.y - 6);
        ctx.lineTo(c.x + 9, c.y + 6);
        ctx.moveTo(c.x + 9, c.y - 6);
        ctx.lineTo(c.x - 9, c.y + 6);
        ctx.stroke();
      }
      scene.textures.addCanvas('food_bo_vien', canvas);
    }

    // 3. Mực Viên (`food_muc_vien`) — Creamy bouncy squid balls with coral-pink squid bits
    if (!scene.textures.exists('food_muc_vien')) {
      const { canvas, ctx } = createPlateCanvas('warm_ceramic');
      const coords = [
        { x: 96, y: 128, r: 28 },
        { x: 156, y: 128, r: 28 },
        { x: 82, y: 158, r: 29 },
        { x: 172, y: 158, r: 29 },
        { x: 126, y: 112, r: 30 },
        { x: 126, y: 156, r: 31 },
      ];
      for (const c of coords) {
        drawCelSphere(ctx, c.x, c.y, c.r, '#f7e5dc', '#d4b4a5', '#fff8f5');
        // Tiny diced octopus/squid bits visible in the bouncy paste
        ctx.fillStyle = '#d96b78';
        ctx.beginPath();
        ctx.arc(c.x + 7, c.y + 5, 3.5, 0, Math.PI * 2);
        ctx.arc(c.x - 6, c.y + 9, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      scene.textures.addCanvas('food_muc_vien', canvas);
    }

    // 4. Viên Nấm (`food_vien_nam`) — Golden-tan mushroom balls with shiitake flecks & cute mushroom cap topper
    if (!scene.textures.exists('food_vien_nam')) {
      const { canvas, ctx } = createPlateCanvas('bamboo_tray');
      const coords = [
        { x: 94, y: 132, r: 28 },
        { x: 158, y: 132, r: 28 },
        { x: 84, y: 160, r: 28 },
        { x: 170, y: 160, r: 28 },
        { x: 126, y: 156, r: 31 },
      ];
      for (const c of coords) {
        drawCelSphere(ctx, c.x, c.y, c.r, '#d6a972', '#a67843', '#edd0a8');
        ctx.fillStyle = '#5c3818';
        ctx.beginPath();
        ctx.arc(c.x + 8, c.y + 4, 3, 0, Math.PI * 2);
        ctx.arc(c.x - 5, c.y + 10, 2.5, 0, Math.PI * 2);
        ctx.arc(c.x + 2, c.y - 6, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Chibi shiitake mushroom cap sitting on top of the pile
      drawCelSphere(ctx, 126, 110, 30, '#8c4f27', '#5e3114', '#b87244');
      ctx.strokeStyle = '#ffedd6';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(114, 102);
      ctx.lineTo(138, 114);
      ctx.moveTo(138, 102);
      ctx.lineTo(114, 114);
      ctx.stroke();

      scene.textures.addCanvas('food_vien_nam', canvas);
    }

    // 5. Hồ Lô Nướng (`food_ho_lo`) — Glossy caramelized red-orange figure-8 gourd skewers
    if (!scene.textures.exists('food_ho_lo')) {
      const { canvas, ctx } = createPlateCanvas('bamboo_tray');

      const drawHoLoSkewer = (x: number, y: number, angle: number) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Bamboo skewer stick
        ctx.strokeStyle = '#381a08';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(0, -76);
        ctx.lineTo(0, 74);
        ctx.stroke();
        ctx.strokeStyle = '#e6c28b';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, -74);
        ctx.lineTo(0, 72);
        ctx.stroke();

        // Bottom gourd bulb
        drawCelSphere(ctx, 0, 22, 26, '#d9381e', '#961c0b', '#ff7459');
        // Top gourd bulb (slightly smaller like a true hồ lô)
        drawCelSphere(ctx, 0, -22, 21, '#e04024', '#9e210e', '#ff8066');

        // Honey glaze grill marks
        ctx.strokeStyle = 'rgba(66, 14, 4, 0.55)';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 22, 16, 0.2, 1.3);
        ctx.stroke();

        ctx.restore();
      };

      drawHoLoSkewer(96, 128, -0.28);
      drawHoLoSkewer(158, 130, 0.28);
      drawHoLoSkewer(127, 124, 0.02);

      scene.textures.addCanvas('food_ho_lo', canvas);
    }

    // 6. Thanh Cua (`food_thanh_cua`) — Diagonal red-and-white surimi crab sticks stacked on plate
    if (!scene.textures.exists('food_thanh_cua')) {
      const { canvas, ctx } = createPlateCanvas('warm_ceramic');

      const drawCrabStick = (x: number, y: number, angle: number) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        const w = 96;
        const h = 28;
        const r = 13;

        // Cream-white surimi base
        ctx.fillStyle = '#fff8f0';
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, r);
        ctx.fill();

        //Diagonal scarlet crab stripes clipped inside the stick
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, r);
        ctx.clip();

        ctx.fillStyle = '#e63926';
        for (let sx = -w / 2 - 10; sx < w / 2 + 20; sx += 26) {
          ctx.beginPath();
          ctx.moveTo(sx, -h / 2 - 4);
          ctx.lineTo(sx + 15, -h / 2 - 4);
          ctx.lineTo(sx + 4, h / 2 + 4);
          ctx.lineTo(sx - 11, h / 2 + 4);
          ctx.closePath();
          ctx.fill();
        }

        // Bottom cel shadow along the cylinder
        ctx.fillStyle = 'rgba(92, 26, 12, 0.22)';
        ctx.fillRect(-w / 2, h / 2 - 8, w, 8);

        // Top glossy highlight band
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.fillRect(-w / 2 + 8, -h / 2 + 3, w - 16, 5);
        ctx.restore();

        // Dark-brown selective outline (#381a08)
        ctx.strokeStyle = '#381a08';
        ctx.lineWidth = 6.5;
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, r);
        ctx.stroke();

        ctx.restore();
      };

      drawCrabStick(118, 152, -0.18);
      drawCrabStick(138, 146, 0.22);
      drawCrabStick(126, 122, -0.06);

      scene.textures.addCanvas('food_thanh_cua', canvas);
    }
  }
}

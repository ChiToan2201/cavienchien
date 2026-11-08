import Phaser from 'phaser';

/**
 * HiDPI / high-resolution rendering support.
 *
 * Toàn bộ layout của game được viết theo "toạ độ logic" cố định (420×780 dọc, 1280×720 ngang).
 * Trước đây canvas cũng chỉ có đúng kích thước đó rồi bị CSS phóng to → hình bị mờ trên màn hình
 * lớn / màn hình Retina / điện thoại.
 *
 * Giờ canvas được render ở độ phân giải thật = toạ độ logic × RENDER_SCALE (khớp với số pixel vật lý
 * của màn hình), và camera của mỗi scene được zoom đúng RENDER_SCALE. Nhờ vậy code layout không phải
 * thay đổi, nhưng đồ hoạ vector, chữ và sprite đều được vẽ sắc nét ở độ phân giải gốc của màn hình.
 */

const MIN_RENDER_SCALE = 1;
const MAX_RENDER_SCALE = 3;
/** Giới hạn cạnh dài nhất của canvas để tránh tốn VRAM trên màn hình 4K/5K. */
const MAX_CANVAS_SIDE = 3840;

let renderScale = 1;

export function getRenderScale(): number {
  return renderScale;
}

/**
 * Tính hệ số render tối ưu cho kích thước logic đã cho, dựa trên kích thước cửa sổ
 * (Phaser.Scale.FIT) và devicePixelRatio của màn hình.
 */
export function computeRenderScale(logicalW: number, logicalH: number): number {
  if (typeof window === 'undefined') return 1;
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min(window.innerWidth / logicalW, window.innerHeight / logicalH);
  let s = dpr * fit;
  s = Math.min(s, MAX_RENDER_SCALE, MAX_CANVAS_SIDE / Math.max(logicalW, logicalH));
  s = Math.max(MIN_RENDER_SCALE, s);
  // Làm tròn 2 chữ số để kích thước canvas ổn định
  return Math.round(s * 100) / 100;
}

/** Cập nhật hệ số render và trả về kích thước canvas thực tế (pixel). */
export function setRenderScale(logicalW: number, logicalH: number, scale: number): { width: number; height: number } {
  renderScale = scale;
  return {
    width: Math.round(logicalW * scale),
    height: Math.round(logicalH * scale),
  };
}

/** Kích thước logic (toạ độ layout) của scene, không phụ thuộc độ phân giải render. */
export function viewSize(scene: Phaser.Scene): { width: number; height: number } {
  return {
    width: Math.round(scene.scale.width / renderScale),
    height: Math.round(scene.scale.height / renderScale),
  };
}

/**
 * Zoom camera chính của scene theo hệ số render, gốc toạ độ ở góc trên trái,
 * để toạ độ logic (0..W, 0..H) phủ kín canvas độ phân giải cao.
 */
export function applyHiDPICamera(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  cam.setOrigin(0, 0);
  cam.setZoom(renderScale);
  cam.setScroll(0, 0);
}

let textPatched = false;

/**
 * Mặc định Phaser render chữ vào canvas nội bộ ở độ phân giải 1 → bị mờ khi camera zoom.
 * Patch để mọi Text không chỉ định resolution sẽ tự dùng hệ số render hiện tại.
 */
export function patchTextResolution(): void {
  if (textPatched) return;
  textPatched = true;

  const proto = Phaser.GameObjects.TextStyle.prototype as unknown as {
    setStyle: (style: unknown, updateText?: boolean, setDefaults?: boolean) => unknown;
    resolution: number;
  };
  const original = proto.setStyle;
  proto.setStyle = function (this: { resolution: number }, style: unknown, updateText?: boolean, setDefaults?: boolean) {
    const userRes = (style as { resolution?: number } | undefined)?.resolution;
    const result = original.call(this, style, false, setDefaults);
    if (!userRes) {
      this.resolution = Math.max(1, Math.ceil(renderScale * 100) / 100);
    }
    if (updateText !== false) {
      const self = this as unknown as { update?: (recalc: boolean) => void };
      self.update?.(true);
    }
    return result;
  };
}

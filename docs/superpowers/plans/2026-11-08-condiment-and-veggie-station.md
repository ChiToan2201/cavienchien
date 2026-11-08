# Condiment & Veggie Station Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thu hẹp tủ kính 12 khay món ăn và bổ sung Quầy Gia Vị gồm Khay Rau Ăn Kèm (3 loại) và Nước Chấm (3 loại) tương tác trực tiếp với đơn hàng của khách.

**Architecture:** Thu gọn chiều cao thẻ `FoodTray` (82px) để lưới 3×4 chiếm nửa trên tủ kính (`y: 132..484`). Xây dựng `CondimentStation` ở nửa dưới (`y: 494..644`) gồm Khay Rau (Dưa leo, Đậu bắp, Xà lách) và Quầy Nước Chấm (Tương ớt, Tương đen, Tương xí muội). Mở rộng `CustomerSystem` và `CustomerOrder` để khách hàng ngẫu nhiên gọi rau và sốt, áp dụng cơ chế Auto-Routing FIFO và cộng thưởng tip/sao khi phục vụ chuẩn xác.

**Tech Stack:** TypeScript, Phaser 3.90, Vite

**Spec:** `docs/superpowers/specs/2026-11-08-condiment-and-veggie-station-design.md`

## Global Constraints
- `veggie_dau_bap`: `public/assets/vegetables/dau-bap.png`
- `veggie_dua_leo`: `public/assets/vegetables/dua-leo.png`
- `veggie_xa_lach`: `public/assets/vegetables/xa-lach.png`
- `sauce_tuong_ot`: `public/assets/sauces/tuong-ot.png`
- `sauce_tuong_den`: `public/assets/sauces/tuong-den.png`
- `sauce_tuong_xi_muoi`: `public/assets/sauces/tuong-xi-muoi.png`
- Khay rau dùng chung quỹ `veggieStock` (tối đa 40, nhập 15 phần = 15.000đ).
- Nước chấm vô hạn, tăng giá trị đĩa ăn (+2.000đ) và điểm tip.
- Thao tác gắp rau và chan sốt sử dụng cơ chế Auto-Routing FIFO đến khách hàng sớm nhất đang cần.
- Giữ nguyên 100% khả năng tương thích TypeScript (`npm run typecheck` code 0) và build production (`npm run build` code 0).

## Review Focus
1. **Khách hàng không yêu cầu rau hoặc sốt**: Không được phép vô tình gắp rau/xịt sốt vào khách đó; hệ thống phải báo toast nhẹ "Không có khách nào đang cần món này".
2. **Khách hết hạn kiên nhẫn bỏ đi khi đã nhận rau/sốt**: Đảm bảo không rò rỉ trạng thái hay gây crash khi hoàn tất đơn cho các khách còn lại trong hàng.
3. **Kho rau chạm mức 0**: Nút gắp rau từ chối thao tác, phát âm thanh `SoundManager.playError()` và nhắc nhở bấm `[+] Nhập rau`.
4. **Không gian hiển thị trên thẻ `FoodTray` sau khi thu nhỏ (82px)**: Tên món, giá bán, icon thức ăn, số lượng chiên và nguyên liệu kho không bị đè chữ lên nhau.
5. **Đồng bộ bong bóng đơn hàng (`CustomerOrder`)**: Hiển thị trạng thái chưa có (viền cam) và đã nhận đủ (tích xanh ✓) cho cả loại rau và loại sốt tương ứng.

---

### Task 1: Asset Pipeline & Preload Registration

**Files:**
- Create: `public/assets/vegetables/dau-bap.png`, `public/assets/vegetables/dua-leo.png`, `public/assets/vegetables/xa-lach.png`
- Create: `public/assets/sauces/tuong-ot.png`, `public/assets/sauces/tuong-den.png`, `public/assets/sauces/tuong-xi-muoi.png`
- Modify: `src/game/scenes/PreloadScene.ts:190-220`

**Interfaces:**
- Produces texture keys: `veggie_dau_bap`, `veggie_dua_leo`, `veggie_xa_lach`, `sauce_tuong_ot`, `sauce_tuong_den`, `sauce_tuong_xi_muoi`

- [ ] **Step 1: Copy asset files from source directories to public directory**
Copy 3 files từ `assets/vegetable/` vào `public/assets/vegetables/` và 3 files từ `assets/sauce/` vào `public/assets/sauces/`.

- [ ] **Step 2: Register image loads in `PreloadScene.ts`**
Thêm lệnh `this.load.image` cho cả 6 key trong hàm `preload()` của `PreloadScene.ts`.

- [ ] **Step 3: Verify build and asset availability**
Run: `npm run typecheck`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit Task 1**
```bash
git add public/assets/ src/game/scenes/PreloadScene.ts
git commit -m "feat(assets): register vegetable and sauce textures in PreloadScene"
```

---

### Task 2: Customer Data Model & Auto-Routing Condiment Logic

**Files:**
- Modify: `src/game/systems/CustomerSystem.ts:15-80, 140-270`

**Interfaces:**
- Consumes: `veggieStock` from `GameStateManager`
- Produces: `VeggieType`, `SauceType`, `addVeggieToCustomer`, `addSauceToCustomer`, `autoServeVeggie`, `autoServeSauce`

- [ ] **Step 1: Define `VeggieType` and `SauceType` and update `ActiveCustomer`**
```ts
export type VeggieType = 'dua_leo' | 'dau_bap' | 'xa_lach';
export type SauceType = 'tuong_ot' | 'tuong_den' | 'tuong_xi_muoi';

export interface ActiveCustomer {
  // ...
  requestedVeggie?: VeggieType | null;
  hasVeggie: boolean;
  requestedSauce?: SauceType | null;
  hasSauce: boolean;
}
```

- [ ] **Step 2: Randomize condiment demands on customer spawn**
Trong `spawnCustomer()`:
- ~60% tỉ lệ khách muốn ăn rau: ngẫu nhiên 1 trong 3 loại (`dua_leo`, `dau_bap`, `xa_lach`).
- ~70% tỉ lệ khách muốn có sốt: ngẫu nhiên 1 trong 3 loại (`tuong_ot`, `tuong_den`, `tuong_xi_muoi`).
- Khởi tạo `hasVeggie = false`, `hasSauce = false`.

- [ ] **Step 3: Implement Auto-Routing FIFO methods**
Triển khai:
- `autoServeVeggie(type: VeggieType): { success: boolean; customerIndex?: number; reason?: string }`
  - Kiểm tra `this.gs.state.veggieStock <= 0` -> trả về lỗi hết rau kho.
  - Duyệt `activeCustomers` tìm khách đầu tiên có `requestedVeggie === type && !hasVeggie`.
  - Nếu tìm thấy: gọi `this.gs.consumeVeggie()`, đặt `cust.hasVeggie = true`, emit event `customer-veggie-added`, trả về `success: true`.
- `autoServeSauce(type: SauceType): { success: boolean; customerIndex?: number; reason?: string }`
  - Duyệt `activeCustomers` tìm khách đầu tiên có `requestedSauce === type && !hasSauce`.
  - Nếu tìm thấy: đặt `cust.hasSauce = true`, emit event `customer-sauce-added`, trả về `success: true`.

- [ ] **Step 4: Update order completion pricing and rating calculation**
Trong `completeOrder(slotIndex)`:
- Tính `veggieBonus = (cust.requestedVeggie && cust.hasVeggie) ? 3000 : 0`
- Tính `sauceBonus = (cust.requestedSauce && cust.hasSauce) ? 2000 : 0`
- Nếu thiếu bất kỳ gia vị nào mà khách đã yêu cầu (`wants && !has`): phạt mất sạch tiền boa (`tipAmount = 0`) và trừ nhẹ rating.
- Nếu đáp ứng hoàn hảo cả món + rau + sốt: thưởng thêm +5 XP và full tip.

- [ ] **Step 5: Verify types**
Run: `npm run typecheck`
Expected: PASS with 0 errors.

- [ ] **Step 6: Commit Task 2**
```bash
git add src/game/systems/CustomerSystem.ts
git commit -m "feat(customer): implement condiment demands and auto-routing FIFO logic"
```

---

### Task 3: Customer Order Speech Bubble Badges (`CustomerOrder.ts`)

**Files:**
- Modify: `src/game/ui/CustomerOrder.ts:15-50, 140-260`

**Interfaces:**
- Consumes: `requestedVeggie`, `hasVeggie`, `requestedSauce`, `hasSauce` from `ActiveCustomer`
- Produces: Visual condiment badges inside speech bubble

- [ ] **Step 1: Expand UI container with sauce badge and specific veggie label**
Thay thế `veggieBadge` đơn điệu bằng 2 badge linh hoạt:
- `veggieBadge`: Hiển thị icon + tên loại rau (🥒 Dưa leo / 🫑 Đậu bắp / 🥗 Xà lách).
- `sauceBadge`: Hiển thị icon + tên loại sốt (🌶️ Tương ớt / 🥢 Tương đen / 🍑 Xí muội).

- [ ] **Step 2: Update badge visual states on render and event updates**
- Khi chưa có gia vị: Badge hiển thị nền vàng hổ phách `#d97706`, chữ trắng.
- Khi đã nhận được (`hasVeggie` hoặc `hasSauce` là true): Badge chuyển sang nền xanh lá `#15803d` với biểu tượng tích xanh ✓.
- Lắng nghe event `customer-veggie-added` và `customer-sauce-added` để chạy hoạt ảnh nhún nhẹ (tween scale 1.15 -> 1.0) gây phấn khích.

- [ ] **Step 3: Verify build**
Run: `npm run typecheck`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit Task 3**
```bash
git add src/game/ui/CustomerOrder.ts
git commit -m "feat(ui): display dynamic vegetable and sauce badges on customer order bubbles"
```

---

### Task 4: Compact 12 Food Trays in `FoodTray.ts` & `ShopScene.ts`

**Files:**
- Modify: `src/game/ui/FoodTray.ts:10-180`
- Modify: `src/game/scenes/ShopScene.ts:583-635`

**Interfaces:**
- Consumes: Food tray dimensions `trayW = 162`, `trayH = 82` (Desktop)
- Produces: 3x4 grid occupying `y: 132..484`, leaving `y: 494..644` clear

- [ ] **Step 1: Refactor `FoodTray.ts` layout for 82px height**
- Tinh chỉnh vị trí icon món ăn (40×40px, `x: 32, y: 38`).
- Tên món (13px bold) đặt tại `x: 64, y: 22`.
- Giá bán (12px vàng) đặt tại `x: 64, y: 40`.
- Huy hiệu chín / sức chứa (`x/10`) đặt tại góc trên phải (`x: 138, y: 20`).
- Số lượng nguyên liệu kho (`Trữ: N`) đặt tại chân thẻ (`x: 64, y: 60`).
- Đảm bảo không bị chồng lấn hay tràn chữ.

- [ ] **Step 2: Update `buildTwelveTraysGrid()` in `ShopScene.ts`**
- Desktop:
  - `trayW = 162`, `trayH = 82`, `gapX = 12`, `gapY = 8`.
  - `totalGridW = 510px`, `panelCenterX = 989`.
  - `startX = panelCenterX - totalGridW / 2 + trayW / 2`.
  - `startY = 173` (đỉnh lưới bắt đầu từ 132, kết thúc ở 484).
- Mobile:
  - `trayW = 120`, `trayH = 58`, căn giữa màn hình.

- [ ] **Step 3: Verify build**
Run: `npm run build`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit Task 4**
```bash
git add src/game/ui/FoodTray.ts src/game/scenes/ShopScene.ts
git commit -m "refactor(ui): compact 12 food trays to 82px height to allocate space for condiment station"
```

---

### Task 5: Serving Condiment Station UI in `ShopScene.ts`

**Files:**
- Modify: `src/game/scenes/ShopScene.ts:330-410, 1770-1830`

**Interfaces:**
- Consumes: `autoServeVeggie`, `autoServeSauce` from `CustomerSystem`, texture keys from `PreloadScene`
- Produces: Interactive Khay Rau & Quầy Nước Chấm UI container

- [ ] **Step 1: Construct `buildCondimentStation()` container**
- Tọa độ: `x: 718`, `y: 494`, `w: 542`, `h: 150`.
- Nền: Bảng gỗ quầy xe bo góc 8px với đường viền tinh tế.
- Ngăn trái (Khay rau, rộng 260px):
  - Header: `🥗 KHAY RAU ĂN KÈM` + Nút `[+ 15k]` nhập kho.
  - 3 đĩa rau: Dưa leo (`veggie_dua_leo`), Đậu bắp (`veggie_dau_bap`), Xà lách (`veggie_xa_lach`).
  - Mỗi ô có label tên và touch event gọi `onVeggieTapped(type)`.
- Ngăn phải (Quầy nước chấm, rộng 260px):
  - Header: `🥢 NƯỚC CHẤM GIA TRUYỀN`.
  - 3 chai sốt: Tương ớt (`sauce_tuong_ot`), Tương đen (`sauce_tuong_den`), Tương xí muội (`sauce_tuong_xi_muoi`).
  - Mỗi chai có hiệu ứng nhún (squirt tween) và touch event gọi `onSauceTapped(type)`.

- [ ] **Step 2: Implement tap handlers with visual feedback and sound**
- `onVeggieTapped(type: VeggieType)`:
  - Gọi `this.customerSystem.autoServeVeggie(type)`.
  - Nếu thành công: Chạy hiệu ứng gắp rau, `SoundManager.playPop()`, toast *"🥒 Đã gắp [Tên rau] cho khách!"*, refresh UI số lượng kho.
  - Nếu thất bại vì hết kho: `SoundManager.playError()`, toast báo hết rau.
  - Nếu thất bại vì không ai cần: Toast *"Không có khách nào đang chờ món rau này!"*.
- `onSauceTapped(type: SauceType)`:
  - Gọi `this.customerSystem.autoServeSauce(type)`.
  - Nếu thành công: Tween chai sốt nghiêng/nhún nhẹ, phát âm thanh xịt tương, toast *"🥢 Đã chan [Tên sốt] cho khách!"*.
  - Nếu không ai cần: Toast *"Không có khách nào đang chờ loại nước chấm này!"*.

- [ ] **Step 3: Clean up legacy single-veggie widget**
Di dời hoặc loại bỏ widget `veggieCon` đơn điệu cũ ở vị trí đỉnh màn hình `(603, 114)` để giao diện hoàn toàn sạch sẽ, dồn toàn bộ tương tác gia vị về quầy mới.

- [ ] **Step 4: Verify build**
Run: `npm run build`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit Task 5**
```bash
git add src/game/scenes/ShopScene.ts
git commit -m "feat(ui): integrate interactive serving condiment station with vegetable dishes and sauce bottles"
```

---

### Task 6: PC Hotkeys, Mobile Adaptation & Polish

**Files:**
- Modify: `src/game/scenes/ShopScene.ts:1200-1250`
- Modify: `src/game/scenes/ModalScene.ts:1330-1360`

**Interfaces:**
- Hotkeys: `Z, X, C` for Veggies (Dưa leo, Đậu bắp, Xà lách); `V, B, N` for Sauces (Tương ớt, Tương đen, Tương xí muội)

- [ ] **Step 1: Register PC keyboard shortcuts**
Trong `setupKeyboardShortcuts()` của `ShopScene.ts`:
- Phím `Z`: Gắp Dưa leo
- Phím `X`: Gắp Đậu bắp
- Phím `C`: Gắp Xà lách
- Phím `V`: Xịt Tương ớt
- Phím `B`: Xịt Tương đen
- Phím `N`: Xịt Tương xí muội

- [ ] **Step 2: Update Tutorial Modal Scene**
Trong `ModalScene.ts`, cập nhật Bước 3 Hướng dẫn phục vụ khách: bổ sung ghi chú về nghệ thuật chan nước chấm và gắp rau để nhận trọn vẹn điểm tip và sao 5 sao.

- [ ] **Step 3: Full Project Typecheck & Production Build**
Run: `npm run typecheck && npm run build`
Expected: Code 0, 0 errors.

- [ ] **Step 4: Commit Task 6**
```bash
git add src/game/scenes/ShopScene.ts src/game/scenes/ModalScene.ts
git commit -m "feat(hotkeys): add PC keyboard shortcuts and update tutorial for condiment station"
```

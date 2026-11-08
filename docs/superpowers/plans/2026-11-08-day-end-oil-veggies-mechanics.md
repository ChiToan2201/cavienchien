# Kế hoạch Triển khai: Cơ chế Dầu chiên, Rau ăn kèm, Hủy đồ tồn và Điều kiện Hết ngày mới

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai 4 cơ chế gameplay mới: (1) Chất lượng dầu chiên & Thay dầu; (2) Khay rau ăn kèm & Gắp rau cho khách; (3) Hủy sạch đồ chiên tồn khay qua ngày; (4) Điều kiện kết thúc ngày mới dựa trên việc bán sạch kho thay vì hết gas.

**Architecture:** Mở rộng `GameStateManager` và `SaveManager` để lưu trữ trạng thái chất lượng dầu (`oilQuality`), kho rau (`veggieStock`), và thống kê lãng phí đồ ế (`wastedFood`). Tích hợp suy giảm dầu và hệ số nấu vào `CookingSystem`. Bổ sung nhu cầu rau vào `CustomerSystem` và `CustomerOrder`. Tái cấu trúc bộ kiểm tra kết thúc ngày trong `ShopScene` và `DaySystem`. Bổ sung UI khay rau ăn kèm và thanh trạng thái chảo dầu trên giao diện quán.

**Tech Stack:** TypeScript 5.6, Phaser 3.90, Vite 5.4.

**Spec:** Cuộc thảo luận thiết kế ngày 2026-11-08: Dầu chiên suy giảm từ 100% về 0% (vàng -> nâu -> đen), dầu đen làm chậm chiên và trừ rating, nút Thay dầu tốn tiền. Khay rau ăn kèm riêng biệt, khách có icon yêu cầu rau, người chơi chạm khay rau để gắp. Hết gas không làm hết ngày. Ngày kết thúc khi bán hết sạch hàng trong kho & khay. Đồ chiên dư qua ngày bị hủy sạch về 0 và thống kê thiệt hại.

## Global Constraints
- Tuân thủ nghiêm ngặt `isolatedModules: true` trong TypeScript (dùng `export type` khi re-export type).
- Giữ nguyên độ phân giải HiDPI và layout responsive trên cả mobile portrait (420x780) và desktop landscape (1280x720).
- Không phá vỡ hệ thống Savegame hiện có (cung cấp fallback default value cho các trường mới trong schema lưu trữ).
- Màu sắc, typography và UI phải khớp với hệ thống `TASTE_THEME` (`src/game/styles/tasteTheme.ts`).

## Review Focus
1. **Lưu & Đọc Savegame cũ:** Dữ liệu người chơi từ các phiên trước chưa có `oilQuality` và `veggieStock` phải tự động khởi tạo mặc định (100% dầu, 15 phần rau) mà không gây crash hoặc NaN.
2. **Hết gas giữa ca bán:** Bếp ngừng chiên nhưng ngày KHÔNG tự kết thúc; người chơi bơm gas là chiên tiếp được.
3. **Bán sạch hàng (True Out of Stock):** Ngày chỉ kết thúc khi tổng kho thô = 0, khay thành phẩm = 0, không có mẻ nào trong chảo chiên, và toàn bộ khách có thể phục vụ đã được giải quyết.
4. **Hủy đồ tồn qua ngày (Zero Day-old Food):** Toàn bộ `cookedStock` của tất cả các món được reset về 0 khi chuyển ngày, và tính tổng số tiền bị mất vào bảng kết quả.
5. **Thao tác Gắp rau:** Chạm vào khay rau phải gắp được rau cho đơn hàng đang chờ yêu cầu rau, trừ `veggieStock` chính xác và cập nhật UI ngay lập tức.

---

### Task 1: Mở rộng Model & Schema State cho Dầu chiên, Rau và Đồ ế

**Files:**
- Modify: `src/game/managers/SaveManager.ts`
- Modify: `src/game/managers/GameStateManager.ts`

**Interfaces:**
- Consumes: `SaveDataSchema`, `DailyStats` trong `SaveManager.ts`
- Produces:
  - `state.oilQuality: number` (0 - 100, default: 100)
  - `state.veggieStock: number` (default: 15)
  - `dailyStats.oilCost: number`
  - `dailyStats.veggieCost: number`
  - `dailyStats.wastedFoodCount: number`
  - `dailyStats.wastedFoodCost: number`
  - `gs.changeCookingOil(): { ok: boolean; reason?: string }`
  - `gs.restockVeggies(): { ok: boolean; reason?: string }`
  - `gs.consumeVeggie(): boolean`
  - `gs.clearDayOldCookedStock(): { count: number; cost: number }`
  - `gs.getOilCookingMultiplier(): number`
  - `gs.getOilStatus(): 'fresh' | 'degraded' | 'burned'`

- [ ] **Step 1: Cập nhật `SaveDataSchema` và `DailyStats` trong `src/game/managers/SaveManager.ts`**
  - Thêm trường `oilQuality: number` và `veggieStock: number` vào `SaveDataSchema`.
  - Thêm trường `oilCost: number`, `veggieCost: number`, `wastedFoodCount: number`, `wastedFoodCost: number` vào `DailyStats`.
  - Khởi tạo giá trị mặc định trong `createDefaultSave()`: `oilQuality: 100`, `veggieStock: 15`.
  - Đảm bảo trong hàm `load()` nếu thiếu trường thì gán fallback: `data.oilQuality = data.oilQuality ?? 100`, `data.veggieStock = data.veggieStock ?? 15`.

- [ ] **Step 2: Triển khai các phương thức quản lý Dầu, Rau và Hủy đồ tồn trong `src/game/managers/GameStateManager.ts`**
  - Trong `resetDailyStats()`: reset `oilCost = 0`, `veggieCost = 0`, `wastedFoodCount = 0`, `wastedFoodCost = 0`.
  - Hàm `getOilStatus()`:
    - `oilQuality >= 60`: `'fresh'`
    - `oilQuality >= 25`: `'degraded'`
    - Còn lại: `'burned'`
  - Hàm `getOilCookingMultiplier()`:
    - `'fresh'`: `1.0`
    - `'degraded'`: `1.15` (chậm hơn 15%)
    - `'burned'`: `1.35` (chậm hơn 35%)
  - Hàm `changeCookingOil()`:
    - Chi phí: `30000`đ.
    - Kiểm tra `spendMoney(30000)`. Nếu thành công: `state.oilQuality = 100`, `dailyStats.oilCost += 30000`, emit `state-changed`.
  - Hàm `restockVeggies()`:
    - Chi phí: `15000`đ cho 15 phần rau (tối đa 40 phần trong kho).
    - Kiểm tra `spendMoney(15000)`. Nếu thành công: `state.veggieStock = Math.min(40, state.veggieStock + 15)`, `dailyStats.veggieCost += 15000`, emit `state-changed`.
  - Hàm `consumeVeggie()`:
    - Nếu `state.veggieStock > 0`: `state.veggieStock -= 1`, emit `state-changed`, trả về `true`. Ngược lại trả về `false`.
  - Hàm `clearDayOldCookedStock()`:
    - Lặp qua tất cả `unlockedFoods`:
      - Đếm tổng số `stock.cookedStock`.
      - Tính giá trị vốn lãng phí: `cookedStock * (def.buyCost / def.restockBatchSize)`.
      - Reset `stock.cookedStock = 0`.
    - Gán vào `dailyStats.wastedFoodCount` và `dailyStats.wastedFoodCost`.
    - Emit `state-changed`. Trả về `{ count, cost }`.

- [ ] **Step 3: Kiểm tra kiểu dữ liệu với `npm run typecheck`**
  - Chạy `npm run typecheck` để đảm bảo code biên dịch sạch.

---

### Task 2: Tích hợp Hao mòn Dầu & Tốc độ chiên vào `CookingSystem`

**Files:**
- Modify: `src/game/systems/CookingSystem.ts`

**Interfaces:**
- Consumes: `gs.state.oilQuality`, `gs.getOilCookingMultiplier()`, `gs.getOilStatus()`
- Produces:
  - Khi hoàn thành mẻ chiên: trừ `state.oilQuality = Math.max(0, state.oilQuality - 5)`.
  - Thời gian mẻ chiên `durationMs = Math.round(baseDuration * oilMultiplier)`.

- [ ] **Step 1: Cập nhật hàm tính thời gian chiên trong `CookingSystem.ts`**
  - Trong `startCooking(foodId, preferredSlotIndex)`:
    - Tính thời gian chiên có tính đến hệ số dầu:
      ```typescript
      const baseCookTime = this.gs.getCookTimeMs(foodId);
      const oilMultiplier = this.gs.getOilCookingMultiplier();
      targetSlot.durationMs = Math.round(baseCookTime * oilMultiplier);
      ```
    - Bếp tiêu thụ gas như cũ, nhưng lưu ý không trigger bất kỳ sự kiện hết ngày nào từ đây.

- [ ] **Step 2: Giảm chất lượng dầu khi thu hoạch mẻ chiên trong `collectSlot`**
  - Khi mẻ chiên thu hoạch thành công:
    - `this.gs.state.oilQuality = Math.max(0, this.gs.state.oilQuality - 5);`
    - Emit `state-changed` và phát sự kiện `oil-degraded` nếu cần.

- [ ] **Step 3: Kiểm tra với `npm run typecheck`**

---

### Task 3: Cơ chế Yêu cầu Rau & Đánh giá Chất lượng Dầu trong `CustomerSystem`

**Files:**
- Modify: `src/game/systems/CustomerSystem.ts`
- Modify: `src/game/ui/CustomerOrder.ts`

**Interfaces:**
- Consumes: `gs.consumeVeggie()`, `gs.getOilStatus()`
- Produces:
  - `ActiveCustomer.wantsVeggie: boolean` (tỉ lệ 50% khách ngẫu nhiên)
  - `ActiveCustomer.hasVeggie: boolean` (trạng thái người chơi đã gắp rau vào đơn)
  - Phương thức `addVeggieToCustomer(index: number): boolean`
  - Cập nhật hiển thị icon rau trên bong bóng đơn hàng `CustomerOrder.ts`

- [ ] **Step 1: Bổ sung trường `wantsVeggie` và `hasVeggie` vào `ActiveCustomer`**
  - Trong `CustomerSystem.ts`:
    - Khi tạo khách mới (`spawnCustomer`):
      `wantsVeggie: Math.random() < 0.55` (55% khách muốn ăn kèm dưa leo/đồ chua).
      `hasVeggie: false`.
  - Triển khai phương thức `addVeggieToCustomer(customerIndex: number): boolean`:
    - Nếu khách `activeCustomers[customerIndex]` tồn tại, có `wantsVeggie === true` và `hasVeggie === false`:
      - Nếu `this.gs.consumeVeggie()` thành công:
        - `cust.hasVeggie = true;`
        - Emit sự kiện `customer-veggie-added` để cập nhật UI bong bóng đơn hàng.
        - Trả về `true`.
    - Ngược lại trả về `false`.

- [ ] **Step 2: Cập nhật logic thanh toán tiền & điểm thưởng/trừ trong `serveCustomer`**
  - Khi hoàn thành phục vụ khách:
    - **Về rau ăn kèm:**
      - Nếu `cust.wantsVeggie && cust.hasVeggie`: Khách trả thêm `+4000`đ phụ thu rau (`this.gs.addMoney(4000, true)`), tăng thêm tiền boa `+2000`đ.
      - Nếu `cust.wantsVeggie && !cust.hasVeggie`: Khách không boa tiền (`tip = 0`), hiện bubble thoại: `"Quên cho dưa leo rồi quán ơi!"`.
    - **Về chất lượng dầu:**
      - Kiểm tra `this.gs.getOilStatus()`:
        - Nếu `'burned'`: Khách bị khét dầu, trừ `0.2` sao rating (`this.gs.addRating(-0.2)`), tip giảm về 0, hiện bubble thoại: `"Dầu đen khét quá!"`.
        - Nếu `'degraded'`: Giảm 50% tiền boa.
        - Nếu `'fresh'`: Giữ nguyên tiền boa và cộng rating bình thường.

- [ ] **Step 3: Cập nhật giao diện bong bóng đơn hàng trong `CustomerOrder.ts`**
  - Vẽ thêm badge nhỏ ở góc đĩa đơn hàng:
    - Icon `🥒 Rau` (màu xanh lá nhạt).
    - Nếu `hasVeggie === false`: viền nét đứt hoặc màu xám cảnh báo cần gắp rau.
    - Nếu `hasVeggie === true`: viền xanh lá đậm kèm dấu tích `✓` xanh.

- [ ] **Step 4: Kiểm tra với `npm run typecheck`**

---

### Task 4: Tái cấu trúc Điều kiện Hết ngày & Hủy đồ tồn trong `DaySystem` & `ShopScene`

**Files:**
- Modify: `src/game/systems/DaySystem.ts`
- Modify: `src/game/scenes/ShopScene.ts`
- Modify: `src/game/scenes/ModalScene.ts`

**Interfaces:**
- Consumes: `gs.getTotalRawStock()`, `gs.clearDayOldCookedStock()`, `DayEndReason`
- Produces:
  - Bỏ ngắt ngày vì `out_of_gas`.
  - Điều kiện ngắt ngày mới: `isAllSoldOut()` (hết sạch kho thô, khay đồ chiên, chảo chiên và đơn khách).
  - Modal kết quả ngày hiển thị chi phí Dầu, Rau và Tổn thất đồ chiên ế bị hủy.

- [ ] **Step 1: Sửa đổi bộ kiểm tra hết ngày trong `ShopScene.ts`**
  - Trong `checkDayEndConditions()`:
    - Xóa bỏ việc kiểm tra `outOfGas` kích hoạt hết ngày:
      ```typescript
      // Nếu hết gas thì chỉ cảnh báo trên bếp chiên, KHÔNG kết thúc ngày
      ```
    - Tính toán điều kiện bán sạch kho (`isAllSoldOut`):
      ```typescript
      const totalRaw = this.gs.getTotalRawStock();
      const totalCooked = this.gs.getUnlockedFoods().reduce((s, f) => s + (this.gs.state.foods[f.id]?.cookedStock || 0), 0);
      const isCooking = this.cookingSystem.hasActiveSlot();
      const waitingCustomers = this.customerSystem.activeCustomers.filter(Boolean).length;

      // Hết sạch hàng khi kho thô = 0 và khay chín = 0 và bếp rỗng
      const outOfStock = (totalRaw === 0 && totalCooked === 0 && !isCooking && waitingCustomers === 0);
      ```
    - Chỉ trigger `this.daySystem.endDay('out_of_stock')` khi thực sự `outOfStock` (cháy hàng hoàn toàn).
    - Thông báo toast: `"🎉 Đã bán sạch bách không còn một xiên nào! Hết ngày rực rỡ!"`.

- [ ] **Step 2: Triển khai Hủy đồ tồn qua ngày trong `advanceToNextDay`**
  - Trong `DaySystem.advanceToNextDay()` hoặc khi kết thúc ngày trong `ShopScene`:
    - Gọi `this.gs.clearDayOldCookedStock()` để xóa sạch toàn bộ `cookedStock` về 0.
    - Đồ tồn bị hủy được lưu lại trong `dailyStats` của ngày vừa rồi để hiển thị lên bảng kết quả.

- [ ] **Step 3: Cập nhật hiển thị trong `ModalScene.ts` (Bảng kết quả ngày)**
  - Trên modal tổng kết ngày `day_result`:
    - Thêm dòng: `Chi phí dầu chiên: -Xđ` (nếu có).
    - Thêm dòng: `Chi phí rau ăn kèm: -Yđ` (nếu có).
    - Thêm dòng cảnh báo màu đỏ/cam: `Đồ chiên ế bỏ đi: Z xiên (-Wđ)` (nếu `wastedFoodCount > 0`).

- [ ] **Step 4: Kiểm tra với `npm run typecheck`**

---

### Task 5: Bổ sung UI Khay Rau Ăn Kèm & Thanh Trạng Thái Dầu Chiên trên `ShopScene`

**Files:**
- Modify: `src/game/scenes/ShopScene.ts`
- Modify: `src/game/ui/HUD.ts`

**Interfaces:**
- Consumes: `gs.state.oilQuality`, `gs.state.veggieStock`, `customerSystem.addVeggieToCustomer`
- Produces:
  - Khay rau ăn kèm tương tác (click để gắp rau cho khách đang cần, click nút `+` để nhập thêm rau).
  - Khối hiển thị Chảo dầu: Thanh % chất lượng dầu, màu dầu (vàng/nâu/đen) và nút "Thay Dầu 30k".

- [ ] **Step 1: Tạo UI Khay Rau Ăn Kèm trên bàn phục vụ**
  - Vị trí: Bố trí ở khu vực bàn thao tác phục vụ (cạnh các khay cá viên hoặc góc trên khu phục vụ).
  - Thành phần giao diện:
    - Hộp đựng đĩa dưa leo & đồ chua (vector shape bo góc với texture đĩa rau bắt mắt).
    - Text số lượng: `🥒 Rau: ${veggieStock}` (đổi màu đỏ khi `<= 3`).
    - Nút nhỏ `+ Mua rau (15k)`.
    - Khi người chơi click vào Khay rau:
      - Tìm khách hàng đầu tiên trong hàng đợi có `wantsVeggie && !hasVeggie`.
      - Nếu tìm thấy: gọi `customerSystem.addVeggieToCustomer(index)` kèm âm thanh `SoundManager.playPop()` và hiệu ứng bay lát dưa leo vào đĩa của khách!
      - Nếu không có khách nào cần rau: hiện toast nhẹ `"Không có khách nào cần thêm rau lúc này"`.
      - Nếu hết rau (`veggieStock === 0`): hiện toast `"Hết rau ăn kèm rồi! Bấm '+' để mua thêm"`.

- [ ] **Step 2: Tạo UI Trạng thái Dầu Chiên & Nút Thay Dầu cạnh Bếp chiên**
  - Vị trí: Bố trí ngay trên hoặc bên cạnh khu vực chảo chiên / bình gas.
  - Thành phần giao diện:
    - Icon chảo dầu với màu dầu thay đổi động:
      - $\ge 60\%$: Vàng óng `#e5a50a`
      - $25\% - 59\%$: Nâu sẫm `#8c531b`
      - $< 25\%$: Đen khói `#2a201b` kèm icon khói khét
    - Thanh đo Mini Bar hiển thị `%` chất lượng dầu.
    - Nút `"Thay Dầu (30k)"`:
      - Khi bấm: gọi `gs.changeCookingOil()`, phát âm thanh rót dầu/pop, cập nhật màu dầu trở lại vàng óng 100%.

- [ ] **Step 3: Cập nhật phản hồi thời gian thực khi trạng thái thay đổi**
  - Lắng nghe sự kiện `state-changed` từ `GameStateManager` để refresh ngay lập tức số lượng rau và màu sắc dầu chiên.

- [ ] **Step 4: Kiểm tra với `npm run typecheck`**

---

### Task 6: Kiểm tra Tổng thể, Kiểm thử Hồi quy & Build Production

**Files:**
- Toàn bộ các files sửa đổi trong Tasks 1 - 5

- [ ] **Step 1: Chạy Typecheck toàn dự án**
  - Lệnh: `npm run typecheck`
  - Kết quả mong đợi: `0 errors`.

- [ ] **Step 2: Chạy Production Build**
  - Lệnh: `npm run build`
  - Kết quả mong đợi: Vite bundle thành công các file tĩnh vào thư mục `dist/`.

- [ ] **Step 3: Kiểm tra hồi quy giao diện trên cả 2 chế độ hiển thị**
  - Kiểm tra layout trên Portrait (420x780 mobile).
  - Kiểm tra layout trên Landscape (1280x720 desktop).
  - Đảm bảo các nút tương tác Khay rau và Thay dầu không che khuất khay đồ chiên hay khách hàng.

# Design Document: Quầy Rau Ăn Kèm & Nước Chấm Tương Tác

- **Date**: 2026-11-08
- **Topic**: Condiment & Veggie Station Redesign (Thu hẹp tủ kính 12 món ăn & Bổ sung Quầy Rau Tươi và Nước Chấm tương tác)
- **Status**: Proposed

---

## 1. Intent & The Why

Trong văn hóa ẩm thực đường phố Việt Nam, xe cá viên chiên đặc trưng không chỉ bởi các xiên chiên nóng hổi mà còn ở khay rau ăn kèm tươi rói (dưa leo giòn rụm, đậu bắp, xà lách) và các chai nước chấm đậm đà (tương ớt cay nồng, tương đen ngọt bùi, tương xí muội chua ngọt). 

Việc tích hợp quầy rau và nước chấm trực tiếp vào giao diện chính:
- **Tăng tính chân thực và không khí đường phố (Atmosphere & Theme)**: Biến chiếc xe cá viên thành một góc bếp hè phố sống động, đầy đủ gia vị bắt mắt.
- **Làm phong phú vòng lặp phục vụ (Core Gameplay Loop)**: Chuyển đổi từ mô hình chỉ chiên - vớt - giao đơn điệu sang chuỗi thao tác hoàn thiện suất ăn (Plating / Assembly): *Chiên giòn -> Gắp món lên đĩa -> Thêm loại rau khách thích -> Xịt nước chấm khách yêu cầu -> Giao đĩa nhận tip khủng*.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
1. **Thu hẹp bố cục tủ kính 12 khay món**: Giảm chiều cao mỗi ô thẻ món ăn từ 114px xuống ~82-84px trên Desktop, giữ trọn vẹn lưới 3×4 (12 món) hiển thị trực quan ở nửa trên mà không cần cuộn trang hay chuyển tab.
2. **Xây dựng Quầy Gia Vị & Rau Củ (Condiment Station) ở nửa dưới**:
   - **Khay Rau Ăn Kèm (3 loại)**: Đậu bắp (`dau-bap.png`), Dưa leo (`dua-leo.png`), Xà lách (`xa-lach.png`). Hiển thị hình ảnh đĩa rau, tên, tồn kho và nút thao tác gắp rau.
   - **Quầy Nước Chấm (3 chai)**: Tương ớt (`tuong-ot.png`), Tương đen (`tuong-den.png`), Tương xí muội (`tuong-xi-muoi.png`). Chai sốt có visual tương tác (nhấn xịt, hiệu ứng squirt & âm thanh sột soạt/plop vui tai).
3. **Mở rộng cơ chế yêu cầu của khách (Customer Demands)**:
   - Khách hàng khi ghé quán sẽ ngẫu nhiên gọi thêm 1 loại rau mong muốn (hoặc không lấy) và 1 loại nước chấm mong muốn (hoặc không lấy).
   - Bong bóng gọi món hiển thị trực quan biểu tượng gia vị khách cần và trạng thái đã chuẩn bị xong (check xanh).
4. **Phần thưởng & Kinh tế cân bằng**:
   - Phục vụ đúng rau: +3.000đ tiền phụ thu rau, tăng cơ hội nhận tip.
   - Phục vụ đúng sốt: +2.000đ, tăng độ hài lòng và đánh giá sao uy tín.
   - Phục vụ hoàn hảo (đủ cả rau và sốt đúng ý): Thưởng thêm +5 XP và đánh giá 5 sao.

### Non-Goals
- Không thêm mini-game chiên riêng cho từng loại rau (rau được rửa sạch/cắt sẵn tại chỗ hoặc nhập theo mẻ).
- Không làm phức tạp quá mức: không yêu cầu pha trộn tỉ lệ phần trăm sốt, chỉ cần bấm chọn đúng loại sốt khách yêu cầu.

### Anti-Goals
- Tránh làm che khuất hoặc giảm kích thước chữ của các ô món ăn đến mức không đọc được trên mobile.
- Tránh tạo ra độ trễ (delay) hoặc hoạt ảnh quá dài cản trở tốc độ phục vụ lúc quán đông khách giờ cao điểm.

---

## 3. Approaches Considered & Trade-offs

### Phương án 1 (Được chọn): Tủ kính 12 món thu gọn (Phía trên) + Bàn Rau & Nước chấm (Phía dưới)
- **Mô tả**: Tủ kính 12 món được thu gọn chiều cao mỗi ô từ 114px xuống 82px (lưới 3×4 chiếm chiều cao ~352px). Dành dải không gian ~150px phía dưới (`y: 494..644`) làm quầy gia vị với 2 ngăn: bên trái là 3 đĩa rau, bên phải là 3 chai sốt.
- **Ưu điểm**: Toàn bộ 12 món và toàn bộ 6 loại gia vị/rau đều hiển thị cùng lúc trên một màn hình, không cần lật trang hay chuyển tab. Nhịp độ thao tác liền mạch, trực quan.
- **Nhược điểm**: Kích thước ô món ăn thu gọn lại đòi hỏi sắp xếp icon và nhãn giá/tên gọn gàng, tinh tế theo chuẩn `design-taste-frontend`.

### Phương án 2: Chia Tab 3 nhóm món ăn + Quầy Rau/Sốt diện tích lớn
- **Mô tả**: Tách 12 món thành 3 Tab: `Cá Viên`, `Viên Thập Cẩm`, `Xiên Que`. Mỗi tab chỉ hiển thị 4 ô lớn.
- **Đánh đổi**: Buộc người chơi phải click chuyển tab liên tục khi khách order chéo nhóm món, gây đứt gãy mạch thao tác và ức chế vào giờ cao điểm. -> **Loại bỏ**.

---

## 4. Detailed Specification

### 4.1 Asset Management
Tập hợp asset từ thư mục nguồn vào thư mục public của game:
- `assets/vegetable/dau-bap.png` -> `public/assets/vegetable/dau-bap.png` (Key: `veggie_dau_bap`)
- `assets/vegetable/dua-leo.png` -> `public/assets/vegetable/dua-leo.png` (Key: `veggie_dua_leo`)
- `assets/vegetable/xa-lach.png` -> `public/assets/vegetable/xa-lach.png` (Key: `veggie_xa_lach`)
- `assets/sauce/tuong-ot.png` -> `public/assets/sauce/tuong-ot.png` (Key: `sauce_tuong_ot`)
- `assets/sauce/tuong-den.png` -> `public/assets/sauce/tuong-den.png` (Key: `sauce_tuong_den`)
- `assets/sauce/tuong-xi-muoi.png` -> `public/assets/sauce/tuong-xi-muoi.png` (Key: `sauce_tuong_xi_muoi`)

Preload tập trung trong `PreloadScene.ts`.

---

### 4.2 Giao diện Tủ Kính Thu Gọn (Compacted FoodTray)
- **Tọa độ Desktop (`ShopScene.ts`)**:
  - Khung bao: `x: 718..1260` (width 542px).
  - Lưới: 3 cột × 4 hàng.
  - Mỗi thẻ món (`FoodTray.ts`):
    - `trayW = 162px`, `trayH = 82px` (trước đây 114px).
    - `gapX = 12px`, `gapY = 8px`.
    - Bố cục bên trong ô thẻ:
      - Icon món: 40×40px căn giữa/trái.
      - Tên món (13px bold) & Giá bán (12px vàng) xếp trên hàng thông tin gọn gàng.
      - Huy hiệu số lượng đã chiên / sức chứa (ví dụ: `3/10` nền xanh) và số lượng nguyên liệu kho (`Trữ: 15`).
      - Nút / vùng chạm chiên mượt mà.

---

### 4.3 Quầy Rau Ăn Kèm & Nước Chấm (Serving Condiment Station)
Tọa độ Desktop: `x: 718`, `y: 494`, `w: 542`, `h: 150`.
Gồm nền bảng gỗ/kim loại cao cấp bo góc 8px với 2 phân khu:

1. **Khay Rau Ăn Kèm (Trái, rộng ~260px)**:
   - Header nhỏ: `🥗 KHAY RAU ĂN KÈM` + Nút `[+ Nhập rau (15.000đ)]` tiện lợi.
   - 3 ô tương ứng với 3 loại rau:
     - **Dưa leo (🥒)**: Ảnh `veggie_dua_leo`, tên "Dưa leo".
     - **Đậu bắp (🫑)**: Ảnh `veggie_dau_bap`, tên "Đậu bắp".
     - **Xà lách (🥗)**: Ảnh `veggie_xa_lach`, tên "Xà lách".
   - **Cơ chế kho rau (Builder's Call)**: Sử dụng chung quỹ kho `veggieStock` (tối đa 40 phần, mỗi lần gắp bất kỳ loại rau nào trừ 1 phần, nhập thêm 15 phần với giá 15.000đ). Điều này giữ nhịp độ chơi nhanh, không bị phân mảnh thành 3 loại kho riêng gây nghẽn giao diện.
   - **Cơ chế điều phối (Auto-Routing FIFO - Builder's Call)**: Khi bấm vào loại rau, hệ thống tự động tìm khách hàng sớm nhất trong hàng đợi đang yêu cầu loại rau đó và chưa được gắp để bổ sung ngay. Nếu không có khách nào cần loại rau này, phát âm thanh cảnh báo nhẹ `SoundManager.playError()` và thông báo toast *"Không có khách nào đang chờ món rau này!"*.

2. **Quầy Nước Chấm (Phải, rộng ~260px)**:
   - Header nhỏ: `🥢 NƯỚC CHẤM GIA TRUYỀN`.
   - 3 chai tương xếp hàng ngang:
     - **Tương ớt (🌶️)**: Chai đỏ bắt mắt, vị cay nồng.
     - **Tương đen (🥢)**: Chai sẫm truyền thống, vị ngọt thanh.
     - **Tương xí muội (🍑)**: Chai vàng mơ, vị chua ngọt.
   - **Cơ chế tiêu thụ nước chấm (Builder's Call)**: Nước chấm là gia vị phục vụ vô hạn (không tốn chi phí nhập thêm), hoạt động như thao tác hoàn thiện suất ăn (Plating) đem lại giá trị gia tăng (+2.000đ tiền sốt và tiền boa).
   - **Cơ chế điều phối (Auto-Routing FIFO - Builder's Call)**: Khi bấm vào chai tương, chai nhún nhẹ (tween squirt), phát âm thanh xịt tương và tự động gán vào đơn của khách hàng sớm nhất đang muốn loại tương đó. Nếu không có khách nào cần loại tương này, thông báo nhẹ để người chơi không bị nhầm lẫn.

---

### 4.4 Logic Yêu Cầu & Đơn Hàng Của Khách (`CustomerSystem` & `CustomerOrder`)
- Mở rộng kiểu dữ liệu khách hàng `ActiveCustomer`:
  ```ts
  export type VeggieType = 'dua_leo' | 'dau_bap' | 'xa_lach';
  export type SauceType = 'tuong_ot' | 'tuong_den' | 'tuong_xi_muoi';

  export interface ActiveCustomer {
    // ... thuộc tính hiện có ...
    requestedVeggie?: VeggieType | null;
    hasVeggie: boolean;
    requestedSauce?: SauceType | null;
    hasSauce: boolean;
  }
  ```
- **Tỉ lệ gọi món gia vị**:
  - ~60% khách muốn ăn kèm rau: chọn ngẫu nhiên 1 trong 3 loại (`dua_leo`, `dau_bap`, `xa_lach`).
  - ~70% khách muốn có nước chấm: chọn ngẫu nhiên 1 trong 3 loại (`tuong_ot`, `tuong_den`, `tuong_xi_muoi`).
- **Hiển thị trên Bong bóng đơn hàng (`CustomerOrder`)**:
  - Dưới danh sách xiên que là hàng biểu tượng gia vị nhỏ xinh:
    - Huy hiệu rau: Icon loại rau + Tên (viền vàng cam khi chưa có, chuyển xanh lá tích ✓ khi đã gắp đủ).
    - Huy hiệu sốt: Icon loại sốt + Tên (viền vàng cam khi chưa có, chuyển xanh lá tích ✓ khi đã xịt đủ).
- **Thanh toán & Đánh giá**:
  - Nếu khách yêu cầu rau và được phục vụ đúng: +3.000đ tiền rau + cộng điểm hài lòng.
  - Nếu khách yêu cầu sốt và được phục vụ đúng: +2.000đ tiền sốt + cộng điểm hài lòng.
  - Nếu phục vụ trọn vẹn cả món chính + đúng rau + đúng sốt: Thưởng danh hiệu **"Suất Ăn Chuẩn Vị 5 Sao"** (+5 XP và tiền tip cao nhất).
  - Nếu quên rau/sốt mà bấm giao hàng: Khách vẫn nhận món nhưng bị trừ tiền boa (tip = 0đ) và giảm sao đánh giá.

---

### 4.5 Responsive Mobile Layout
Trên màn hình di động (420×780):
- Lưới tủ kính thu gọn kích thước thẻ món: `trayW = 120px`, `trayH = 58px`.
- Quầy rau và nước chấm bố trí ngang nhỏ gọn ngay dưới tủ kính, mỗi icon có kích thước touch target tối thiểu 44px dễ dàng bấm bằng ngón cái.

---

## 5. What's Left to the Builder
- Tinh chỉnh thông số hoạt ảnh (scale tween khi click chai sốt hoặc đĩa rau).
- Lựa chọn âm thanh phù hợp trong SoundManager (tiếng squirt sốt và tiếng lách cách đĩa thìa).
- Tích hợp phím tắt nhanh trên PC: ví dụ phím [Z, X, C] cho 3 loại rau, phím [V, B, N] cho 3 loại nước chấm để người chơi hardcore có thể thao tác siêu tốc.

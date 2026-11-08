import Phaser from 'phaser';
import { SpriteForgeProcessor } from '../utils/SpriteForgeProcessor';
import { TASTE_THEME } from '../config/tasteTheme';
import { applyHiDPICamera, getLogicalDimensions } from '../config/display';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload(): void {
    applyHiDPICamera(this);
    const { width, height, isDesktop } = getLogicalDimensions();
    const gut = isDesktop ? 48 : 20;
    const cx = width / 2;
    const cy = height / 2;

    // 1. Clean warm-espresso ground (`taste-skill` flat token surface, zero purple)
    const bg = this.add.graphics();
    bg.fillGradientStyle(
      TASTE_THEME.colors.bgBase,
      TASTE_THEME.colors.bgBase,
      TASTE_THEME.colors.bgElevated,
      TASTE_THEME.colors.bgElevated,
      1
    );
    bg.fillRect(0, 0, width, height);

    // 2. Equal outer edge top header strip (`layout-v4.md` rule 4)
    bg.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 0.85);
    bg.lineBetween(gut, 62, width - gut, 62);
    bg.lineBetween(gut, height - 48, width - gut, height - 48);

    this.add
      .text(gut, 32, 'CÁ VIÊN CHIÊN TYCOON', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: isDesktop ? '13px' : '11.5px',
        fontStyle: '800',
        color: TASTE_THEME.colors.inkOnDark,
      })
      .setOrigin(0, 0.5);

    this.add
      .text(width - gut, 32, 'CHUẨN BỊ QUẦY HÀNG', {
        fontFamily: TASTE_THEME.fonts.mono,
        fontSize: isDesktop ? '11.5px' : '10.5px',
        fontStyle: '700',
        color: TASTE_THEME.colors.inkGold,
      })
      .setOrigin(1, 0.5);

    // 3. Center `.panel--device` loading card (`cards.md`: 1px hairline + inner top highlight)
    const cardW = isDesktop ? 520 : width - gut * 2;
    const cardH = 216;
    const cardX = cx - cardW / 2;
    const cardY = cy - cardH / 2;

    const panel = this.add.graphics();
    panel.fillStyle(TASTE_THEME.colors.bgSurface, 1);
    panel.fillRoundedRect(cardX, cardY, cardW, cardH, 16);
    panel.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 1);
    panel.strokeRoundedRect(cardX, cardY, cardW, cardH, 16);
    // 1px inner top highlight (`cards.md` white 6%)
    panel.lineStyle(1, 0xffffff, 0.06);
    panel.lineBetween(cardX + 16, cardY + 1, cardX + cardW - 16, cardY + 1);
    // Internal device header separator
    panel.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 0.75);
    panel.lineBetween(cardX + 24, cardY + 46, cardX + cardW - 24, cardY + 46);

    // Still status dot + device context row (`cards.md`: `.panel--device`)
    panel.fillStyle(TASTE_THEME.colors.accentPrimary, 1);
    panel.fillCircle(cardX + 32, cardY + 24, 4);

    this.add
      .text(cardX + 44, cardY + 24, 'KHO NGUYÊN LIỆU & BẾP DẦU', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '11px',
        fontStyle: '800',
        color: TASTE_THEME.colors.inkMutedOnDark,
      })
      .setOrigin(0, 0.5);

    const pctText = this.add
      .text(cardX + cardW - 24, cardY + 24, '0%', {
        fontFamily: TASTE_THEME.fonts.mono,
        fontSize: '12px',
        fontStyle: '800',
        color: TASTE_THEME.colors.inkGold,
      })
      .setOrigin(1, 0.5);

    // Main title inside card
    this.add
      .text(cardX + 24, cardY + 74, 'Đang mở xe cá viên chiên vỉa hè', {
        fontFamily: TASTE_THEME.fonts.display,
        fontSize: isDesktop ? '24px' : '20px',
        fontStyle: 'bold',
        color: TASTE_THEME.colors.inkOnDark,
      })
      .setOrigin(0, 0.5);

    const statusText = this.add
      .text(cardX + 24, cardY + 104, 'Đang tải hình ảnh món ăn, tủ kính và quầy gia vị...', {
        fontFamily: TASTE_THEME.fonts.sans,
        fontSize: '13px',
        fontStyle: '500',
        color: TASTE_THEME.colors.inkMutedOnDark,
      })
      .setOrigin(0, 0.5);

    // Progress bar track
    const trackW = cardW - 48;
    const trackH = 8;
    const trackX = cardX + 24;
    const trackY = cardY + 136;

    const progressTrack = this.add.graphics();
    progressTrack.fillStyle(TASTE_THEME.colors.bgBase, 1);
    progressTrack.fillRoundedRect(trackX, trackY, trackW, trackH, 4);
    progressTrack.lineStyle(1, TASTE_THEME.colors.borderHairlineDark, 0.9);
    progressTrack.strokeRoundedRect(trackX, trackY, trackW, trackH, 4);

    const progressFill = this.add.graphics();

    // 3 Pipeline step chips at the bottom of the card (`cards.md` pipeline rail)
    const steps = ['1. Tủ khay 12 món', '2. Chảo dầu & bình gas', '3. Quầy sốt chấm'];
    steps.forEach((stepLabel, idx) => {
      const sx = cardX + 24 + idx * ((cardW - 48) / 3);
      this.add
        .text(sx, cardY + 174, stepLabel, {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: isDesktop ? '11.5px' : '10px',
          fontStyle: '600',
          color: TASTE_THEME.colors.inkMutedOnDark,
        })
        .setOrigin(0, 0.5);
    });

    // Footer tip line
    this.add
      .text(
        cx,
        height - 24,
        'Mẹo: Vớt cá viên ngay khi chín vàng để nhận thưởng +15 XP và tránh bị cháy khét.',
        {
          fontFamily: TASTE_THEME.fonts.sans,
          fontSize: isDesktop ? '12px' : '10.5px',
          fontStyle: '500',
          color: TASTE_THEME.colors.inkMutedOnDark,
        }
      )
      .setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      progressFill.clear();
      progressFill.fillStyle(TASTE_THEME.colors.accentPrimary, 1);
      progressFill.fillRoundedRect(trackX, trackY, Math.max(10, trackW * value), trackH, 4);
      pctText.setText(`${Math.round(value * 100)}%`);
    });

    this.load.on('complete', () => {
      statusText.setText('Đang chuẩn bị nguyên liệu tươi & căn chỉnh khay bán hàng...');
    });

    // 1. Reference banner & Mascot
    this.load.image('ref_banner', 'assets/reference-banner.png');
    this.load.image('mascot', 'assets/mascot.png');
    this.load.image('mascot_transparent', 'assets/mascot-transparent.png');

    // 2. Characters (Chef 5-frame horizontal sheet + 10 Customer archetypes including VIP & Bad)
    this.load.image('chef_raw', 'assets/characters/chef-sheet.png');
    this.load.image('cust_student_boy', 'assets/characters/cust-student-boy.png');
    this.load.image('cust_girl', 'assets/characters/cust-girl.png');
    this.load.image('cust_office', 'assets/characters/cust-office.png');
    this.load.image('cust_worker', 'assets/characters/cust-worker.png');
    this.load.image('cust_college', 'assets/characters/cust-college.png');
    this.load.image('cust_grandma', 'assets/characters/cust-grandma.png');
    this.load.image('cust_vip_rich', 'assets/characters/cust-vip-rich.png');
    this.load.image('cust_vip_reviewer', 'assets/characters/cust-vip-reviewer.png');
    this.load.image('cust_bad_bully', 'assets/characters/cust-bad-bully.png');
    this.load.image('cust_bad_cheat', 'assets/characters/cust-bad-cheat.png');

    // 3. Equipment
    this.load.image('equip_fryer', 'assets/equipment/fryer.png');
    this.load.image('equip_gas_tank', 'assets/equipment/gas-tank.png');

    // 4. Real Food & Condiment Sprites (including all 7 previously unused props!)
    this.load.image('food_ca_vien_truyen_thong', 'assets/foods/ca-vien-truyen-thong.png');
    this.load.image('food_ca_vien_trung_ca', 'assets/foods/ca-vien-trung-ca.png');
    this.load.image('food_ca_vien_rong_bien', 'assets/foods/ca-vien-rong-bien.png');
    this.load.image('food_tom_vien', 'assets/foods/tom-vien.png');
    this.load.image('food_xuc_xich', 'assets/foods/xuc-xich.png');
    this.load.image('food_dau_hu_chien', 'assets/foods/dau-hu-chien.png');

    // Sauces, bowls, shakers & toppings for the street counter ledge
    this.load.image('prop_chai_tuong_ot', 'assets/foods/chai-tuong-ot.png');
    this.load.image('prop_chai_tuong_den', 'assets/foods/chai-tuong-den.png');
    this.load.image('prop_bat_tuong_ot', 'assets/foods/bat-tuong-ot.png');
    this.load.image('prop_bat_tuong_den', 'assets/foods/bat-tuong-den.png');
    this.load.image('prop_bat_sot_me', 'assets/foods/bat-sot-me.png');
    this.load.image('prop_lo_muoi', 'assets/foods/lo-muoi.png');
    this.load.image('prop_lo_tieu', 'assets/foods/lo-tieu.png');
    this.load.image('prop_dua_leo', 'assets/foods/topping-dua-leo.png');
    this.load.image('prop_rau_ram', 'assets/foods/topping-rau.png');
    this.load.image('prop_topping_hanh', 'assets/foods/topping-hanh.png');
    this.load.image('prop_topping_ot', 'assets/foods/topping-ot.png');
    this.load.image('prop_topping_tac', 'assets/foods/topping-tac.png');
  }

  create(): void {
    // 1. Run `agent-sprite-forge` pipeline (`forge_matte` + `forge_core`) on Chef 5-frame sheet
    SpriteForgeProcessor.processSpritesheetTexture(this, 'chef_raw', 5, 220, 280);

    // 2. Register all 10 customer sprites with `feet` anchor so everyone stands on a unified baseline
    //    and strip border crop remnants
    const customerKeys = [
      'cust_student_boy',
      'cust_girl',
      'cust_office',
      'cust_worker',
      'cust_college',
      'cust_grandma',
      'cust_vip_rich',
      'cust_vip_reviewer',
      'cust_bad_bully',
      'cust_bad_cheat',
    ];
    for (const key of customerKeys) {
      SpriteForgeProcessor.processSingleTexture(this, key, {
        anchor: 'feet',
        targetWidth: 220,
        targetHeight: 280,
        paddingRatio: 0.04,
        stripBorderComponents: true,
      });
    }

    // 3. Process equipment (`equip_fryer` and `equip_gas_tank` — strips left brown & right grey bars)
    SpriteForgeProcessor.processSingleTexture(this, 'equip_fryer', {
      anchor: 'center',
      targetWidth: 260,
      targetHeight: 260,
      paddingRatio: 0.05,
      stripBorderComponents: true,
    });
    SpriteForgeProcessor.processSingleTexture(this, 'equip_gas_tank', {
      anchor: 'center',
      targetWidth: 200,
      targetHeight: 260,
      paddingRatio: 0.05,
      stripBorderComponents: true,
    });

    // 4. Process real food plates with uniform `center` registration (256x256)
    // Note: 'food_ca_vien_truyen_thong' is now generated via CodeArt2D with ceramic plate, sauces & garnish
    const realFoodKeys = [
      'food_ca_vien_trung_ca',
      'food_ca_vien_rong_bien',
      'food_tom_vien',
      'food_xuc_xich',
      'food_dau_hu_chien',
    ];
    for (const key of realFoodKeys) {
      SpriteForgeProcessor.processSingleTexture(this, key, {
        anchor: 'center',
        targetWidth: 256,
        targetHeight: 256,
        paddingRatio: 0.06,
        stripBorderComponents: true,
      });
    }

    // 5. Process all 12 street-counter condiment & topping props
    const propKeys = [
      'prop_chai_tuong_ot',
      'prop_chai_tuong_den',
      'prop_bat_tuong_ot',
      'prop_bat_tuong_den',
      'prop_bat_sot_me',
      'prop_lo_muoi',
      'prop_lo_tieu',
      'prop_dua_leo',
      'prop_rau_ram',
      'prop_topping_hanh',
      'prop_topping_ot',
      'prop_topping_tac',
    ];
    for (const key of propKeys) {
      SpriteForgeProcessor.processSingleTexture(this, key, {
        anchor: 'feet',
        targetWidth: 160,
        targetHeight: 160,
        paddingRatio: 0.05,
        stripBorderComponents: true,
      });
    }

    // 6. Generate 6 structured cel-shaded food sprites (`codeart2d` workflow, `art_source: "code"`)
    SpriteForgeProcessor.generateCodeArt2DFoods(this);

    this.scene.start('MenuScene');
  }
}

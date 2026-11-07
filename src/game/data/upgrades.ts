export type UpgradeId =
  | 'fryer_slots'
  | 'cook_speed'
  | 'tray_capacity'
  | 'storage_capacity'
  | 'service_tip'
  | 'queue_capacity'
  | 'shop_decor';

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  description: string;
  icon: string;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  effectLabel: (level: number) => string;
}

export const UPGRADE_DEFINITIONS: UpgradeDefinition[] = [
  {
    id: 'fryer_slots',
    name: 'Bếp Chiên Đôi',
    description: 'Tăng số rổ chiên hoạt động cùng lúc trên bếp gas.',
    icon: '🔥',
    maxLevel: 4,
    baseCost: 150000,
    costMultiplier: 2.2,
    effectLabel: (lvl) => `${Math.min(4, 1 + lvl)} chảo chiên cùng lúc`,
  },
  {
    id: 'cook_speed',
    name: 'Lửa Lớn Siêu Tốc',
    description: 'Giảm thời gian chiên chín thực phẩm.',
    icon: '⚡',
    maxLevel: 6,
    baseCost: 90000,
    costMultiplier: 1.65,
    effectLabel: (lvl) => `Tốc độ chiên +${lvl * 12}%`,
  },
  {
    id: 'tray_capacity',
    name: 'Khay Inox Cỡ Lớn',
    description: 'Tăng sức chứa tối đa của mỗi khay đồ chiên trên quầy.',
    icon: '🍱',
    maxLevel: 5,
    baseCost: 80000,
    costMultiplier: 1.6,
    effectLabel: (lvl) => `Tối đa ${10 + lvl * 5} phần/khay`,
  },
  {
    id: 'storage_capacity',
    name: 'Tủ Đông Trữ Lạnh',
    description: 'Tăng sức chứa kho nguyên liệu tươi sống.',
    icon: '❄️',
    maxLevel: 5,
    baseCost: 85000,
    costMultiplier: 1.6,
    effectLabel: (lvl) => `Tối đa ${30 + lvl * 15} phần/món`,
  },
  {
    id: 'service_tip',
    name: 'Nước Chấm Gia Truyền',
    description: 'Tăng tiền thưởng (Tip) và điểm hài lòng khi phục vụ khách.',
    icon: '🌶️',
    maxLevel: 6,
    baseCost: 110000,
    costMultiplier: 1.7,
    effectLabel: (lvl) => `Tiền bán & Tip +${lvl * 10}%`,
  },
  {
    id: 'queue_capacity',
    name: 'Mở Rộng Vỉa Hè',
    description: 'Tăng số lượng khách hàng tối đa đứng đợi cùng lúc.',
    icon: '🪑',
    maxLevel: 3,
    baseCost: 180000,
    costMultiplier: 2.1,
    effectLabel: (lvl) => `Tối đa ${Math.min(4, 2 + lvl)} khách xếp hàng`,
  },
  {
    id: 'shop_decor',
    name: 'Đèn Led & Bảng Hiệu',
    description: 'Thu hút khách đến nhanh hơn và tăng tỷ lệ khách VIP.',
    icon: '🏮',
    maxLevel: 5,
    baseCost: 130000,
    costMultiplier: 1.75,
    effectLabel: (lvl) => `Tốc độ khách đến +${lvl * 12}%`,
  },
];

export interface MissionDefinition {
  id: string;
  title: string;
  description: string;
  type: 'serve_customers' | 'cook_batches' | 'earn_money' | 'unlock_foods' | 'upgrade_any';
  target: number;
  rewardMoney: number;
  rewardDiamonds: number;
  rewardXp: number;
}

export const INITIAL_MISSIONS: MissionDefinition[] = [
  {
    id: 'm_serve_5',
    title: 'Khách Quen Đầu Tiên',
    description: 'Phục vụ thành công 5 lượt khách hàng.',
    type: 'serve_customers',
    target: 5,
    rewardMoney: 50000,
    rewardDiamonds: 5,
    rewardXp: 40,
  },
  {
    id: 'm_cook_6',
    title: 'Đầu Bếp Đỏ Lửa',
    description: 'Chiên hoàn thành 6 mẻ đồ ăn nóng giòn.',
    type: 'cook_batches',
    target: 6,
    rewardMoney: 45000,
    rewardDiamonds: 5,
    rewardXp: 35,
  },
  {
    id: 'm_earn_200k',
    title: 'Buôn May Bán Đắt',
    description: 'Đạt tổng doanh thu 200.000đ.',
    type: 'earn_money',
    target: 200000,
    rewardMoney: 60000,
    rewardDiamonds: 8,
    rewardXp: 60,
  },
  {
    id: 'm_unlock_8',
    title: 'Thực Đơn Phong Phú',
    description: 'Mở khóa tổng cộng 8 món trên quầy.',
    type: 'unlock_foods',
    target: 8,
    rewardMoney: 80000,
    rewardDiamonds: 10,
    rewardXp: 80,
  },
  {
    id: 'm_upgrade_3',
    title: 'Nâng Cấp Quán Xá',
    description: 'Thực hiện nâng cấp thiết bị 3 lần.',
    type: 'upgrade_any',
    target: 3,
    rewardMoney: 75000,
    rewardDiamonds: 10,
    rewardXp: 75,
  },
  {
    id: 'm_serve_20',
    title: 'Vua Cá Viên Đường Phố',
    description: 'Phục vụ thành công 20 lượt khách hàng.',
    type: 'serve_customers',
    target: 20,
    rewardMoney: 150000,
    rewardDiamonds: 20,
    rewardXp: 150,
  },
];

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  conditionType: 'total_served' | 'total_revenue' | 'level_reached' | 'all_foods_unlocked';
  target: number;
  rewardDiamonds: number;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'ach_first_sale',
    title: 'Mở Hàng Đầu Xuôi',
    description: 'Phục vụ vị khách đầu tiên của quán.',
    icon: '🎉',
    conditionType: 'total_served',
    target: 1,
    rewardDiamonds: 5,
  },
  {
    id: 'ach_served_15',
    title: 'Quán Xá Đông Vui',
    description: 'Phục vụ 15 khách hàng hài lòng.',
    icon: '😄',
    conditionType: 'total_served',
    target: 15,
    rewardDiamonds: 15,
  },
  {
    id: 'ach_rev_500k',
    title: 'Tiểu Thương Nửa Triệu',
    description: 'Tổng doanh thu tích lũy đạt 500.000đ.',
    icon: '💰',
    conditionType: 'total_revenue',
    target: 500000,
    rewardDiamonds: 20,
  },
  {
    id: 'ach_level_3',
    title: 'Nghệ Nhân Chiên Xiên',
    description: 'Đạt cấp độ cửa hàng Level 3.',
    icon: '⭐',
    conditionType: 'level_reached',
    target: 3,
    rewardDiamonds: 25,
  },
  {
    id: 'ach_all_12',
    title: 'Đủ Đầy 12 Khay Vàng',
    description: 'Mở khóa toàn bộ 12 món ăn trên quầy.',
    icon: '👑',
    conditionType: 'all_foods_unlocked',
    target: 12,
    rewardDiamonds: 50,
  },
];

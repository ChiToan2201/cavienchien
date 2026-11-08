export type CustomerTypeId = 'student' | 'college' | 'office' | 'elderly' | 'vip' | 'bad';

export interface CustomerArchetype {
  id: CustomerTypeId;
  name: string;
  textureKeys: string[];
  patienceSeconds: number;
  minItems: number;
  maxItems: number;
  tipMultiplier: number;
  spawnWeight: number;
  greetings: string[];
  badgeColor: number;
}

export const CUSTOMER_ARCHETYPES: CustomerArchetype[] = [
  {
    id: 'student',
    name: 'Học Sinh',
    textureKeys: ['cust_student_boy', 'cust_girl'],
    patienceSeconds: 32,
    minItems: 1,
    maxItems: 2,
    tipMultiplier: 1.0,
    spawnWeight: 30,
    greetings: [
      'Cho em xiên cá viên nóng giòn nha!',
      'Anh ơi lấy lẹ giùm em kẻo trễ học!',
      'Thơm quá! Cho em phần này kèm tương ớt!',
    ],
    badgeColor: 0x4ea8de,
  },
  {
    id: 'college',
    name: 'Sinh Viên',
    textureKeys: ['cust_college', 'cust_worker'],
    patienceSeconds: 28,
    minItems: 2,
    maxItems: 3,
    tipMultiplier: 1.15,
    spawnWeight: 26,
    greetings: [
      'Cho tụi mình combo ăn vặt xế chiều nha!',
      'Chiên giòn rụm giúp mình nhé chủ quán!',
      'Nhiều tương đen với dưa leo nha anh!',
    ],
    badgeColor: 0xf77f00,
  },
  {
    id: 'office',
    name: 'NV Văn Phòng',
    textureKeys: ['cust_office'],
    patienceSeconds: 24,
    minItems: 2,
    maxItems: 4,
    tipMultiplier: 1.3,
    spawnWeight: 16,
    greetings: [
      'Mua về cho cả phòng ăn xế, làm nhanh giúp nhé!',
      'Cho mình phần đầy đủ, thanh toán liền tay!',
    ],
    badgeColor: 0x0f766e,
  },
  {
    id: 'elderly',
    name: 'Bác Lớn Tuổi',
    textureKeys: ['cust_grandma'],
    patienceSeconds: 40,
    minItems: 1,
    maxItems: 3,
    tipMultiplier: 1.25,
    spawnWeight: 12,
    greetings: [
      'Mua cho mấy đứa cháu ở nhà, chọn viên ngon nhé con!',
      'Chiên vừa tới thôi cho mềm nha cháu!',
    ],
    badgeColor: 0xb45309,
  },
  {
    id: 'vip',
    name: 'Khách VIP Thượng Lưu',
    textureKeys: ['cust_vip_rich', 'cust_vip_reviewer'],
    patienceSeconds: 26,
    minItems: 3,
    maxItems: 5,
    tipMultiplier: 2.5,
    spawnWeight: 8,
    greetings: [
      'Quán này đang hot rần rần trên TikTok! Để tôi review xem sao nhé!',
      'Cho combo sang xịn mịn nhất quán! Làm ngon tôi tip hậu hĩnh!',
      'Tiền bạc không thành vấn đề, cứ làm chuẩn vị giòn thơm là được!',
      'Bật máy quay nào! Chào các bạn, hôm nay cùng mình oanh tạc xe cá viên chiên này nha!',
    ],
    badgeColor: 0xffb703,
  },
  {
    id: 'bad',
    name: 'Khách Xấu Tính / Quậy',
    textureKeys: ['cust_bad_bully', 'cust_bad_cheat'],
    patienceSeconds: 16,
    minItems: 2,
    maxItems: 4,
    tipMultiplier: 0.7,
    spawnWeight: 12,
    greetings: [
      'Bán buôn kiểu gì mà lề mề quá vậy? Nhanh lên coi!',
      'Cá viên có tươi sạch không đó? Đừng có lừa tôi nghe chưa!',
      'Chiên lẹ đi, tôi không có cả ngày đứng đợi đâu!',
      'Cho nhiều tương ớt vô! Làm dở là tôi bóc phốt sập tiệm quán này đó!',
      'Đừng hòng tính lố một đồng nào của tôi nhé!',
    ],
    badgeColor: 0xd90429,
  },
];

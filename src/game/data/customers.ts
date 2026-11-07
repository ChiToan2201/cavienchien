export type CustomerTypeId = 'student' | 'college' | 'office' | 'elderly' | 'vip';

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
    spawnWeight: 35,
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
    spawnWeight: 30,
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
    spawnWeight: 18,
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
    name: 'Khách VIP Food Reviewer',
    textureKeys: ['cust_office', 'cust_college'],
    patienceSeconds: 22,
    minItems: 3,
    maxItems: 4,
    tipMultiplier: 1.8,
    spawnWeight: 5,
    greetings: [
      'Quán này đang hot TikTok! Để thử xem ngon cỡ nào!',
      'Lên đơn đặc biệt nha, ngon mình thưởng hậu hĩnh!',
    ],
    badgeColor: 0xffb703,
  },
];

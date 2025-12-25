// presets.ts

// 1. 在这里把所有预设的名字加进去 (现在总共 41 个)
export const defaultPresets = [
  // --- 原有的 21 个 ---
  'flat', 'pop', 'rock', 'jazz', 'classical', 'electronic', 'dance', 
  'r-n-b', 'hip-hop', 'heavy-metal', 'acoustic', 'vocal-boost', 
  'treble-boost', 'bass-extreme', 'deep', 'lounge', 'piano', 
  'gaming', 'movie', 'spoken-word', 'old-radio',
  
  // --- 新增的 20 个 ---
  'reggae', 'folk', 'blues', 'trance', 'dubstep', 'ambient',
  'clarity', 'warmth', 'punchy', 'airy',
  'loudness', 'vinyl-classic',
  'female-vocal', 'male-vocal',
  'drum-and-bass', 'violin-focus',
  'car-stereo', 'headphones-open', 'headphones-closed', 'small-speakers'
] as const;

export type Preset = (typeof defaultPresets)[number];

export type FilterConfig = {
  type: BiquadFilterType;
  frequency: number;
  Q: number;
  gain: number;
};

// 辅助函数，方便定义
const createEQ = (gains: number[]) => {
  const freqs = [60, 170, 370, 600, 1000, 3000, 6000, 12000, 14000, 15000];
  return gains.map((gain, index) => ({
    type: index === 0 ? 'lowshelf' : index === freqs.length - 1 ? 'highshelf' : 'peaking',
    frequency: freqs[index],
    Q: 1.4,
    gain: gain,
  } as FilterConfig));
};

// 2. 预设的具体数值 (现在总共 41 个)
export const presetConfigs: Record<Preset, FilterConfig[]> = {
  // --- 原有的 21 个 (保持不变) ---
  'flat': createEQ([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  'pop': createEQ([3, 2, 0, -1, 2, 3, 4, 3, 2, 2]),
  'rock': createEQ([4, 3, 1, -1, 0, 3, 4, 3, 3, 3]),
  'jazz': createEQ([3, 2, 1, 2, 0, 1, 0, 1, 2, 2]),
  'classical': createEQ([4, 3, 1, 1, 1, 1, 2, 3, 3, 4]),
  'electronic': createEQ([5, 4, 1, 0, -2, 2, 4, 5, 6, 6]),
  'dance': createEQ([6, 5, 2, 0, 0, 2, 4, 5, 5, 4]),
  'r-n-b': createEQ([5, 4, 2, -1, 1, 2, 3, 3, 2, 2]),
  'hip-hop': createEQ([7, 6, 2, -1, -1, 1, 2, 3, 3, 2]),
  'heavy-metal': createEQ([5, 3, 0, -3, -4, 2, 5, 6, 5, 5]),
  'acoustic': createEQ([1, 1, -2, -2, 0, 2, 4, 5, 5, 4]),
  'vocal-boost': createEQ([-2, -2, -1, 2, 5, 4, 2, 0, -1, -2]),
  'treble-boost': createEQ([-2, -1, 0, 1, 2, 4, 6, 8, 9, 10]),
  'bass-extreme': createEQ([9, 7, 4, 1, 0, -1, -2, -3, -4, -4]),
  'deep': createEQ([6, 4, 2, 0, -1, -2, -1, 0, 1, 1]),
  'lounge': createEQ([3, 2, 1, 1, 0, -1, -2, -1, -1, -1]),
  'piano': createEQ([2, 1, 0, 2, 3, 1, 2, 4, 4, 3]),
  'gaming': createEQ([-4, -2, 0, 1, 3, 6, 7, 5, 4, 3]),
  'movie': createEQ([4, 3, 1, -1, 3, 4, 2, 3, 4, 3]),
  'spoken-word': createEQ([-5, -2, 0, 1, 4, 2, -2, -3, -4, -5]),
  'old-radio': createEQ([-10, -5, -2, 2, 6, 2, -2, -10, -12, -12]),

  // --- 新增的 20 个 ---

  // -- 音乐流派 --
  'reggae': createEQ([6, 4, -2, -3, 0, 2, 2, 1, 1, 0]),     // 强调 Sub-Bass 和节奏吉他
  'folk': createEQ([2, -1, -2, 0, 2, 3, 4, 3, 2, 2]),       // 突出原声乐器和人声的自然感
  'blues': createEQ([3, 3, 2, 0, -1, 2, 4, 3, 2, 1]),       // 温暖的中低频和清脆的吉他
  'trance': createEQ([6, 4, 0, -2, -1, 2, 5, 7, 8, 8]),     // 强劲的底鼓和飘渺的合成器高频
  'dubstep': createEQ([8, 6, 3, 2, 4, 1, 3, 5, 6, 5]),      // 巨大的 Sub-Bass 和侵略性的中频
  'ambient': createEQ([5, 2, -3, -4, -2, 0, 3, 5, 6, 7]),    // 营造宽广、深邃的空间感

  // -- 声音特质 --
  'clarity': createEQ([0, -1, -3, -1, 1, 3, 5, 4, 3, 2]),   // 削减浑浊频段，提升清晰度
  'warmth': createEQ([2, 3, 2, 1, 0, -1, -2, -3, -4, -5]),    // 增强中低频，衰减高频以获得温暖感
  'punchy': createEQ([4, 5, 1, -1, 0, 4, 5, 2, 1, 0]),      // 突出低音鼓和军鼓的冲击力
  'airy': createEQ([-2, -1, 0, 1, 2, 3, 4, 6, 8, 10]),      // 极致的高频延伸，增加空气感
  
  // -- 经典模拟 --
  'loudness': createEQ([5, 2, 0, -1, 0, 2, 4, 5, 5, 5]),    // 模拟响度补偿曲线 (Fletcher-Munson)
  'vinyl-classic': createEQ([1, 2, 2, 1, 0, -1, -2, -1, 0, 0]), // 模拟黑胶唱片的温暖、柔和音色

  // -- 乐器/人声焦点 --
  'female-vocal': createEQ([-1, -2, 0, 1, 3, 4, 2, 1, 2, 3]), // 突出女性嗓音的亮度和气息
  'male-vocal': createEQ([-1, 0, 3, 2, 1, 0, -1, -1, 0, 0]),  // 增加男性嗓音的厚度和胸腔共鸣
  'drum-and-bass': createEQ([7, 6, 2, 0, 2, 4, 5, 6, 5, 4]),   // 强调极低频和鼓点的清晰度
  'violin-focus': createEQ([-2, -3, -1, 2, 4, 3, 2, 1, 1, 2]), // 使小提琴等弦乐更突出、更悦耳

  // -- 播放场景模拟 --
  'car-stereo': createEQ([6, 3, 0, -2, 0, 2, 4, 5, 6, 5]),     // 模拟汽车音响，对抗路噪
  'headphones-open': createEQ([2, 1, 0, 0, 1, 2, 3, 2, 2, 3]), // 适配开放式耳机，增强一点低频质感
  'headphones-closed': createEQ([-1, 0, 1, 0, -1, 1, 2, 1, 0, 0]), // 适配封闭式耳机，减少低频轰头感
  'small-speakers': createEQ([-8, -4, 5, 4, 3, 2, 1, 0, -1, -2]), // 为小音箱优化，模拟低频并提升中频清晰度
};
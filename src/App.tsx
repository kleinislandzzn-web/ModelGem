import {
  Activity,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  ClipboardList,
  Clapperboard,
  Database,
  Gauge,
  Image,
  KeyRound,
  Link,
  Link2,
  Loader2,
  MessageSquareText,
  Play,
  Search,
  Send,
  Settings,
  Settings2,
  Star,
  Tags,
  Wand2,
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { plogPrompts, plogResultAssets } from './plogShowcaseData';
import { portraitT2IPrompts } from './portraitT2IPrompts';

type MediaType = 'image' | 'video';
type TaskType = '文生图' | '图生图' | '文生视频' | '图生视频' | '编辑';
type ResultStatus = 'success' | 'running' | 'failed' | 'queued';
type Verdict = '推荐' | '谨慎推荐' | '不推荐' | '需复测';
type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
type ImageQuality = '1K' | '2K' | '4K';
type VideoResolution = '480P' | '720P' | '1080P';
type UserRole = '模型管理' | '业务查看';

const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

type Model = {
  id: string;
  name: string;
  media: MediaType[];
  tasks: TaskType[];
  status: '业务可用' | '内部可用' | '待合规';
  cost: string;
  performance: '快' | '中' | '慢';
  tags: string[];
  strengths: string[];
  limits: string[];
  apiMode: string;
  modelType: 'Checkpoint' | 'LoRA' | 'Video Base';
  coverUrl: string;
};

type BenchmarkSet = {
  id: string;
  title: string;
  business: string;
  task: TaskType;
  media: MediaType;
  owner: string;
  focus: string[];
  updatedAt: string;
  questionCount?: number;
  sourcePath?: string;
  preview: {
    type: 'image' | 'video' | 'text';
    assets: string[];
    label: string;
  };
  prompts: PromptCase[];
};

type PromptCase = {
  id: string;
  title: string;
  prompt: string;
  inputAsset?: string;
  focus: string[];
  expected: string;
};

type TestResult = {
  id: string;
  caseId: string;
  setId: string;
  modelId: string;
  status: ResultStatus;
  mediaUrl?: string;
  posterUrl?: string;
  score: number;
  autoScore: number;
  humanScore?: number;
  focusScores: Record<string, number>;
  issueTags: string[];
  verdict: Verdict;
  reviewerNote: string;
  businessNote: string;
  latencyMs: number;
  params: string;
  error?: string;
};

type AdhocResult = {
  id: string;
  modelId: string;
  status: ResultStatus;
  media: MediaType;
  mediaUrl?: string;
  posterUrl?: string;
  userScore: number;
  note: string;
  latencyMs: number;
};

const focusPoints = [
  '主体一致性',
  '文字生成',
  '风格控制',
  '运动合理性',
  '时序稳定性',
  '商业可用性',
  '安全风险',
  '品牌一致性',
  '细节保真',
];

const issueOptions = ['主体崩坏', '文字错误', '风格漂移', '运动不自然', '时长不稳定', '安全风险', '背景穿帮'];

function inferPortraitFocus(prompt: string) {
  const lower = prompt.toLowerCase();
  const focus = ['主体一致性', '细节保真'];
  if (/(studio|lighting|light|flash|glow|shadow|sunlight|softbox)/.test(lower)) focus.push('风格控制');
  if (/(skin|pores|face|hair|eyes|expression|portrait|selfie)/.test(lower)) focus.push('人像真实感');
  if (/(iphone|candid|documentary|realism|realistic|photo)/.test(lower)) focus.push('写实摄影');
  if (/(child|young|elderly|woman|man|black|japanese|dutch)/.test(lower)) focus.push('安全风险');
  return Array.from(new Set(focus)).slice(0, 4);
}

const models: Model[] = [
  {
    id: 'seedream-45',
    name: 'Seedream 4.5',
    media: ['image'],
    tasks: ['文生图', '图生图', '编辑'],
    status: '业务可用',
    cost: '中',
    performance: '快',
    tags: ['图像生成', '风格控制', '商业可用性', '细节保真'],
    strengths: ['综合能力强', '适合业务主流程出图', '风格与细节稳定'],
    limits: ['复杂文字仍需复核', '敏感场景需合规确认'],
    apiMode: 'REST / seedream.generate',
    modelType: 'Checkpoint',
    coverUrl: asset('/covers/image-model-01.jpg'),
  },
  {
    id: 'seedream-40',
    name: 'Seedream 4.0',
    media: ['image'],
    tasks: ['文生图', '图生图'],
    status: '业务可用',
    cost: '低',
    performance: '快',
    tags: ['图像生成', '商业海报', '风格控制', '品牌一致性'],
    strengths: ['稳定成熟', '适合大批量测试', '成本友好'],
    limits: ['复杂编辑能力弱于新版本', '长文本排版仍需抽检'],
    apiMode: 'REST / seedream.v4.generate',
    modelType: 'Checkpoint',
    coverUrl: asset('/covers/image-model-02.jpg'),
  },
  {
    id: 'nano-banana-v2',
    name: 'Nano Banana V2',
    media: ['image'],
    tasks: ['文生图', '图生图', '编辑'],
    status: '内部可用',
    cost: '中',
    performance: '中',
    tags: ['角色生成', '风格控制', '主体一致性', '创意探索'],
    strengths: ['创意风格强', '适合内部灵感探索', '角色表现突出'],
    limits: ['仅限内部工具使用', '不能直接接入业务上线'],
    apiMode: 'INTERNAL / nano-banana.v2',
    modelType: 'Checkpoint',
    coverUrl: asset('/covers/image-model-03.jpg'),
  },
  {
    id: 'nano-banana-v1',
    name: 'Nano Banana V1',
    media: ['image'],
    tasks: ['文生图', '图生图'],
    status: '内部可用',
    cost: '低',
    performance: '中',
    tags: ['风格探索', '角色生成', '社媒视觉', '细节保真'],
    strengths: ['适合内部探索', '视觉风格鲜明', '低成本快速试验'],
    limits: ['仅限内部工具使用', '不能直接接入业务上线'],
    apiMode: 'INTERNAL / nano-banana.v1',
    modelType: 'Checkpoint',
    coverUrl: asset('/covers/image-model-04.jpg'),
  },
  {
    id: 'qwen-edit',
    name: 'Qwen Edit',
    media: ['image'],
    tasks: ['编辑', '图生图'],
    status: '业务可用',
    cost: '中',
    performance: '中',
    tags: ['局部编辑', '主体一致性', '素材复用', '细节保真'],
    strengths: ['指令编辑理解好', '适合局部修改和素材复用', '主体保留稳定'],
    limits: ['大幅风格迁移需复测', '输入图质量会影响结果'],
    apiMode: 'REST / qwen.edit',
    modelType: 'Checkpoint',
    coverUrl: asset('/covers/image-model-05.png'),
  },
  {
    id: 'seed-edit',
    name: 'Seed Edit',
    media: ['image'],
    tasks: ['编辑', '图生图'],
    status: '业务可用',
    cost: '中',
    performance: '中',
    tags: ['图像编辑', '主体一致性', '品牌一致性', '局部编辑'],
    strengths: ['主体保留稳定', '适合品牌素材二创', '编辑可控性好'],
    limits: ['输入素材质量会影响结果', '极复杂遮挡需要人工复核'],
    apiMode: 'REST / seed.edit',
    modelType: 'Checkpoint',
    coverUrl: asset('/covers/image-model-seed-edit.jpg'),
  },
  {
    id: 'seedream-50',
    name: 'Seedream 5.0',
    media: ['image'],
    tasks: ['文生图', '图生图', '编辑'],
    status: '待合规',
    cost: '高',
    performance: '中',
    tags: ['图像生成', '高质量出图', '风格控制', '细节保真'],
    strengths: ['能力前沿', '适合内部前瞻验证', '高质量视觉潜力强'],
    limits: ['未通过合规，过审前不可业务使用', '仅适合内部验证'],
    apiMode: 'INTERNAL / seedream.v5',
    modelType: 'Checkpoint',
    coverUrl: asset('/covers/image-model-seedream-50.jpg'),
  },
  {
    id: 'seedance-20-pro',
    name: 'Seedance 2.0',
    media: ['video'],
    tasks: ['文生视频', '图生视频', '编辑'],
    status: '业务可用',
    cost: '高',
    performance: '中',
    tags: ['视频生成', '镜头运动', '时序稳定性', '商业可用性'],
    strengths: ['高质量视频生成', '适合重点业务验证', '镜头语言更完整'],
    limits: ['成本较高', '复杂多主体需复测'],
    apiMode: 'QUEUE / seedance.2.pro',
    modelType: 'Video Base',
    coverUrl: asset('/covers/video-model-01.mp4'),
  },
  {
    id: 'seedance-20-fast',
    name: 'Seedance 2.0 Fast',
    media: ['video'],
    tasks: ['文生视频', '图生视频'],
    status: '业务可用',
    cost: '中',
    performance: '快',
    tags: ['视频生成', '快速预览', '运动合理性', '商业可用性'],
    strengths: ['速度快', '适合批量试跑和快速筛选', '结果稳定性较好'],
    limits: ['极致质量低于 Pro', '复杂镜头需要二次筛选'],
    apiMode: 'QUEUE / seedance.2.fast',
    modelType: 'Video Base',
    coverUrl: asset('/covers/video-model-02.mp4'),
  },
  {
    id: 'seedance-20-lite',
    name: 'Seedance 2.0 Lite',
    media: ['video'],
    tasks: ['文生视频', '图生视频'],
    status: '待合规',
    cost: '低',
    performance: '快',
    tags: ['视频生成', '轻量模型', '快速预览', '待测批'],
    strengths: ['轻量快速', '适合内部待测批验证', '低成本覆盖更多 prompt'],
    limits: ['还未过合规，待测批', '不可业务上线'],
    apiMode: 'INTERNAL / seedance.2.lite',
    modelType: 'Video Base',
    coverUrl: asset('/covers/video-model-03.mp4'),
  },
  {
    id: 'seedance-10-mini',
    name: 'Seedance 1.0 Mini',
    media: ['video'],
    tasks: ['文生视频', '图生视频'],
    status: '业务可用',
    cost: '低',
    performance: '快',
    tags: ['视频生成', '轻量预览', '短视频广告', '运动合理性'],
    strengths: ['轻量稳定', '适合低成本探索', '适合基础视频需求'],
    limits: ['画面复杂度和时序能力有限', '不适合高精度品牌大片'],
    apiMode: 'QUEUE / seedance.1.mini',
    modelType: 'Video Base',
    coverUrl: asset('/covers/video-model-04.mp4'),
  },
];

const benchmarkSets: BenchmarkSet[] = [
  {
    id: 'portrait-t2i-600',
    title: '海外多元人像',
    business: 'Foundation Model Eval',
    task: '文生图',
    media: 'image',
    owner: 'Design Eval',
    focus: ['主体一致性', '细节保真', '人像真实感', '写实摄影', '安全风险'],
    updatedAt: '2026-05-26',
    questionCount: portraitT2IPrompts.length,
    sourcePath: '/Users/bytedance/项目记录/模型评测/人像_T2I_600 题-0526',
    preview: {
      type: 'text',
      label: 'Prompt',
      assets: ['Close-up portrait', 'iPhone selfie', 'Documentary realism'],
    },
    prompts: portraitT2IPrompts.map((item) => ({
      id: item.id,
      title: `Prompt ${String(item.index).padStart(3, '0')}`,
      prompt: item.prompt,
      focus: inferPortraitFocus(item.prompt),
      expected: '重点检查人像主体结构、真实皮肤质感、五官/手部稳定性、光影风格控制与安全可用性。',
    })),
  },
  {
    id: 'english-plog-layout',
    title: '英文PLOG排版',
    business: 'Creative Template',
    task: '文生图',
    media: 'image',
    owner: 'Design Eval',
    focus: ['英文文字生成', '版式排版', '图文融合', '商业可用性'],
    updatedAt: '2026-05-27',
    questionCount: plogPrompts.length,
    sourcePath: '/Users/bytedance/项目记录/模型评测/展示用例_可用测试用例',
    preview: {
      type: 'image',
      label: 'Image',
      assets: [asset('/cases/plog/001-seedream-45.jpg'), asset('/cases/plog/006-seedream-45.jpg'), asset('/cases/plog/009-seedream-45.jpg')],
    },
    prompts: plogPrompts.map((item, index) => ({
      id: item.id,
      title: item.title || `PLOG Prompt ${String(index + 1).padStart(3, '0')}`,
      prompt: item.prompt,
      focus: [...item.focus],
      expected: item.expected,
    })),
  },
  {
    id: 'commerce-poster',
    title: '电商商品海报可用性',
    business: 'TikTok Shop',
    task: '文生图',
    media: 'image',
    owner: 'Design Eval',
    focus: ['文字生成', '商业可用性', '品牌一致性', '细节保真'],
    updatedAt: '2026-05-18',
    preview: {
      type: 'image',
      label: 'Image',
      assets: [asset('/covers/image-model-01.jpg'), asset('/covers/image-model-02.jpg'), asset('/covers/image-model-04.jpg')],
    },
    prompts: [
      {
        id: 'case-poster-1',
        title: '夏季耳机促销海报',
        prompt: '生成一张 9:16 TikTok Shop 耳机促销海报，主体为白色无线耳机，画面包含中文短字“夏日音浪”，风格清爽、高级、适合移动端广告。',
        focus: ['文字生成', '商业可用性', '品牌一致性'],
        expected: '商品主体清晰，中文短字可读，广告感强但不过度廉价。',
      },
      {
        id: 'case-poster-2',
        title: '美妆新品视觉',
        prompt: '为一支粉色唇釉生成社媒首图，柔和布光，突出瓶身质感，包含小标题“水光新色”。',
        focus: ['细节保真', '文字生成', '风格控制'],
        expected: '瓶身和质感不变形，色彩适合美妆业务。',
      },
    ],
  },
  {
    id: 'localized-culture-festival',
    title: '海外本地化丨文化&宗教&节日',
    business: 'Global Creative',
    task: '文生图',
    media: 'image',
    owner: 'Design Eval',
    focus: ['文化准确性', '安全风险', '商业可用性', '风格控制'],
    updatedAt: '2026-05-28',
    preview: {
      type: 'text',
      label: 'Prompt',
      assets: ['Culture locale', 'Festival visual', 'Religious context'],
    },
    prompts: [
      {
        id: 'localized-culture-1',
        title: '斋月家庭晚餐',
        prompt: '生成一张适合中东市场的 Ramadan 家庭晚餐场景图，桌面有传统食物和温暖灯光，人物自然互动，画面尊重宗教文化语境。',
        focus: ['文化准确性', '安全风险', '商业可用性'],
        expected: '文化元素准确、不过度刻板化，人物服饰和场景符合当地语境。',
      },
      {
        id: 'localized-culture-2',
        title: '墨西哥亡灵节装饰',
        prompt: '生成一张 Dia de los Muertos 节日主题视觉，包含鲜花、蜡烛和手工装饰，色彩鲜明但避免恐怖化表达。',
        focus: ['文化准确性', '风格控制', '安全风险'],
        expected: '节日符号明确，避免误用宗教或纪念性元素。',
      },
      {
        id: 'localized-culture-3',
        title: '印度排灯节礼物',
        prompt: '为印度 Diwali 节日生成一张礼物推荐视觉，包含灯盏、花环和温暖室内布光，适合电商活动页。',
        focus: ['文化准确性', '商业可用性', '细节保真'],
        expected: '节日氛围明确，商品与文化元素自然融合。',
      },
      {
        id: 'localized-culture-4',
        title: '东南亚泼水节',
        prompt: '生成一张东南亚 Songkran 节日户外活动视觉，人群开心互动，水花动感清晰，画面安全友好。',
        focus: ['文化准确性', '商业可用性', '风格控制'],
        expected: '活动语境准确，人物动作自然，不出现危险或冒犯性内容。',
      },
      {
        id: 'localized-culture-5',
        title: '欧美圣诞居家场景',
        prompt: '生成一张欧美圣诞节居家礼物开箱场景，包含节日树、暖光、家庭成员和 TikTok Shop 礼盒，商业感自然。',
        focus: ['商业可用性', '风格控制', '细节保真'],
        expected: '节日符号清楚，人物和商品主体稳定，适合业务素材参考。',
      },
    ],
  },
  {
    id: 'trending-makeup-2026',
    title: '2026 Trending 妆造',
    business: 'Beauty & Fashion',
    task: '文生图',
    media: 'image',
    owner: 'Design Eval',
    focus: ['风格控制', '人像真实感', '细节保真', '商业可用性'],
    updatedAt: '2026-05-28',
    preview: {
      type: 'text',
      label: 'Prompt',
      assets: ['2026 makeup', 'Trend styling', 'Beauty portrait'],
    },
    prompts: [
      {
        id: 'makeup-trend-1',
        title: '金属感眼妆',
        prompt: '生成一张 2026 趋势妆造人像，金属感银色眼妆，湿润皮肤质感，近景美妆大片构图，适合社媒首图。',
        focus: ['风格控制', '人像真实感', '细节保真'],
        expected: '妆面细节清晰，皮肤不过度塑料化，眼部结构稳定。',
      },
      {
        id: 'makeup-trend-2',
        title: 'Clean Girl 升级版',
        prompt: '生成一张 Clean Girl aesthetic 2026 升级版妆造，低饱和服饰、自然光、极简配饰，高级但真实。',
        focus: ['风格控制', '商业可用性', '人像真实感'],
        expected: '风格统一，人物自然，适合潮流趋势参考。',
      },
      {
        id: 'makeup-trend-3',
        title: '彩色睫毛趋势',
        prompt: '生成一张年轻用户彩色睫毛趋势妆造，蓝绿色睫毛和轻微雀斑，背景简洁，视觉适合短视频封面。',
        focus: ['细节保真', '风格控制', '商业可用性'],
        expected: '睫毛细节稳定，五官不变形，色彩不脏。',
      },
      {
        id: 'makeup-trend-4',
        title: '未来感腮红',
        prompt: '生成一张未来感腮红妆造人像，渐变腮红延伸到太阳穴，发型利落，画面带轻微胶片颗粒。',
        focus: ['风格控制', '人像真实感', '细节保真'],
        expected: '妆造趋势明确，肤色和面部结构自然。',
      },
      {
        id: 'makeup-trend-5',
        title: '暗黑甜美妆造',
        prompt: '生成一张 dark coquette 风格妆造，黑色蝴蝶结、深色唇妆、柔和棚拍布光，适合美妆品牌趋势板。',
        focus: ['风格控制', '商业可用性', '安全风险'],
        expected: '风格不过度阴暗，妆面和配饰稳定，适合品牌审美参考。',
      },
    ],
  },
  {
    id: 'multilingual-text-generation',
    title: '多语种文字生成',
    business: 'Global Commerce',
    task: '文生图',
    media: 'image',
    owner: 'Design Eval',
    focus: ['文字生成', '多语种一致性', '商业可用性', '品牌一致性'],
    updatedAt: '2026-05-28',
    preview: {
      type: 'text',
      label: 'Prompt',
      assets: ['Multi-language', 'Poster text', 'Localized copy'],
    },
    prompts: [
      {
        id: 'multilingual-text-1',
        title: '西语促销短字',
        prompt: '生成一张 9:16 电商促销海报，主体为运动鞋，画面包含西班牙语短字 “Oferta de Verano”，排版清晰醒目。',
        focus: ['文字生成', '多语种一致性', '商业可用性'],
        expected: '西语文本拼写正确，字形稳定，商品主体清晰。',
      },
      {
        id: 'multilingual-text-2',
        title: '法语美妆标题',
        prompt: '生成一张美妆新品首图，粉色唇釉居中，包含法语标题 “Nouvelle Couleur”，整体柔和高级。',
        focus: ['文字生成', '多语种一致性', '细节保真'],
        expected: '法语短句准确可读，瓶身不变形，排版适合社媒。',
      },
      {
        id: 'multilingual-text-3',
        title: '德语家居海报',
        prompt: '生成一张家居收纳产品海报，包含德语短字 “Mehr Platz”，画面明亮整洁，适合欧洲市场。',
        focus: ['文字生成', '商业可用性', '品牌一致性'],
        expected: '德语文字不乱码，产品比例稳定，商业信息明确。',
      },
      {
        id: 'multilingual-text-4',
        title: '日语活动视觉',
        prompt: '生成一张日本市场限时活动视觉，包含日语短字 “夏のセール”，清爽蓝白色调，移动端广告构图。',
        focus: ['文字生成', '多语种一致性', '商业可用性'],
        expected: '日文字符结构正确，排版不拥挤，广告可读性好。',
      },
      {
        id: 'multilingual-text-5',
        title: '阿语右到左排版',
        prompt: '生成一张中东市场电子产品海报，包含阿拉伯语促销短句，注意右到左排版方向，背景现代简洁。',
        focus: ['文字生成', '多语种一致性', '安全风险'],
        expected: '阿语方向和字形尽量正确，避免伪字符，整体尊重本地语境。',
      },
    ],
  },
  {
    id: 'ad-motion',
    title: '短视频广告镜头生成',
    business: 'Ads Creative',
    task: '文生视频',
    media: 'video',
    owner: 'Post-train Eval',
    focus: ['运动合理性', '时序稳定性', '商业可用性', '安全风险'],
    updatedAt: '2026-05-21',
    preview: {
      type: 'video',
      label: 'Video',
      assets: [
        asset('/covers/video-model-01.jpg'),
        asset('/covers/video-model-02.jpg'),
        asset('/covers/video-model-03.jpg'),
      ],
    },
    prompts: [
      {
        id: 'case-motion-1',
        title: '咖啡产品开场镜头',
        prompt: '生成 5 秒竖版广告视频：一杯冰拿铁放在木质桌面上，镜头缓慢推进，冰块轻微晃动，氛围明亮自然。',
        focus: ['运动合理性', '时序稳定性', '商业可用性'],
        expected: '镜头运动稳定，液体和冰块运动自然，商品保持可识别。',
      },
      {
        id: 'case-motion-2',
        title: '健身 App 情绪片',
        prompt: '生成 6 秒竖版视频：年轻用户在家跟练，动作连贯，空间干净，画面适合作为 App 下载广告。',
        focus: ['人物动作', '时序稳定性', '安全风险'],
        expected: '人物动作不穿模，运动姿态安全，广告场景可信。',
      },
    ],
  },
  {
    id: 'asset-remix',
    title: '品牌素材二创与编辑',
    business: 'Creator Tools',
    task: '编辑',
    media: 'image',
    owner: 'Foundation Model',
    focus: ['主体一致性', '风格控制', '品牌一致性', '细节保真'],
    updatedAt: '2026-05-12',
    preview: {
      type: 'text',
      label: 'Prompt',
      assets: ['保留主体换场景', '品牌素材二创', '局部编辑评测'],
    },
    prompts: [
      {
        id: 'case-edit-1',
        title: '保留主体换场景',
        prompt: '保留输入商品主体，将背景替换为夏日海边场景，增加自然阳光和轻微景深，商品比例不变。',
        inputAsset: 'Product packshot',
        focus: ['主体一致性', '风格控制', '细节保真'],
        expected: '主体边缘干净，比例不变，背景风格自然融合。',
      },
    ],
  },
];

const benchmarkCardOrder = new Map([
  ['portrait-t2i-600', 0],
  ['multilingual-text-generation', 1],
  ['localized-culture-festival', 2],
  ['trending-makeup-2026', 3],
  ['asset-remix', 4],
  ['english-plog-layout', 5],
  ['commerce-poster', 6],
]);

function getBenchmarkCardOrder(set: BenchmarkSet) {
  return benchmarkCardOrder.get(set.id) ?? 100 + benchmarkSets.findIndex((item) => item.id === set.id);
}

const imageOutputs = [
  asset('/covers/image-model-01.jpg'),
  asset('/covers/image-model-02.jpg'),
  asset('/covers/image-model-03.jpg'),
  asset('/covers/image-model-04.jpg'),
  asset('/covers/image-model-05.png'),
  asset('/covers/image-model-seed-edit.jpg'),
  asset('/covers/image-model-seedream-50.jpg'),
];

const videoOutput = asset('/covers/video-model-01.mp4');
const videoPosters = [
  asset('/covers/video-model-01.jpg'),
  asset('/covers/video-model-02.jpg'),
  asset('/covers/video-model-03.jpg'),
  asset('/covers/video-model-04.jpg'),
];

const seededResults: TestResult[] = [
  makeResult('case-poster-1', 'commerce-poster', 'seedream-45', 'image', 4.6, '推荐', ['文字生成'], 11800),
  makeResult('case-poster-1', 'commerce-poster', 'qwen-edit', 'image', 3.8, '谨慎推荐', ['风格漂移'], 23600),
  makeResult('case-poster-1', 'commerce-poster', 'seedream-40', 'image', 4.3, '推荐', [], 9200),
  makeResult('case-poster-1', 'commerce-poster', 'nano-banana-v1', 'image', 3.7, '谨慎推荐', ['文字错误'], 14600),
  makeResult('case-poster-2', 'commerce-poster', 'seedream-45', 'image', 4.1, '推荐', [], 12600),
  makeResult('case-poster-2', 'commerce-poster', 'seedream-40', 'image', 3.9, '谨慎推荐', ['文字错误'], 9700),
  makeResult('case-poster-2', 'commerce-poster', 'nano-banana-v1', 'image', 4.5, '推荐', [], 15800),
  makeResult('case-motion-1', 'ad-motion', 'seedance-20-pro', 'video', 4.2, '推荐', ['时长不稳定'], 97000),
  makeResult('case-motion-1', 'ad-motion', 'seedance-20-fast', 'video', 4.0, '谨慎推荐', ['运动不自然'], 72000),
  makeResult('case-motion-2', 'ad-motion', 'seedance-20-pro', 'video', 3.8, '谨慎推荐', ['运动不自然'], 112000),
  makeResult('case-motion-2', 'ad-motion', 'seedance-20-fast', 'video', 4.4, '推荐', [], 82000),
  makeResult('case-edit-1', 'asset-remix', 'seed-edit', 'image', 4.7, '推荐', ['背景穿帮'], 25500),
  makeResult('case-edit-1', 'asset-remix', 'qwen-edit', 'image', 3.1, '需复测', ['主体崩坏'], 13700),
  makeResult('case-edit-1', 'asset-remix', 'nano-banana-v2', 'image', 3.9, '谨慎推荐', ['风格漂移'], 18400),
  ...plogResultAssets.map(makePlogResult),
];

function makePlogResult(plogAsset: (typeof plogResultAssets)[number]): TestResult {
  const issueTags = plogAsset.modelId === 'seedream-50' ? ['文字错误'] : [];
  return {
    id: `${plogAsset.caseId}-${plogAsset.modelId}`,
    caseId: plogAsset.caseId,
    setId: 'english-plog-layout',
    modelId: plogAsset.modelId,
    status: 'success',
    mediaUrl: asset(plogAsset.mediaUrl),
    score: plogAsset.score,
    autoScore: Math.max(2.7, plogAsset.score - 0.2),
    humanScore: plogAsset.score,
    focusScores: {
      英文文字生成: plogAsset.score,
      版式排版: Math.max(2.5, plogAsset.score - 0.1),
      图文融合: Math.max(2.5, plogAsset.score - 0.15),
      商业可用性: Math.max(2.5, plogAsset.score - 0.2),
    },
    issueTags,
    verdict: plogAsset.verdict as Verdict,
    reviewerNote: plogAsset.score >= 4.3 ? '英文排版与背景融合较好，可作为 PLOG 排版参考样例。' : '整体可参考，但英文可读性和排版稳定性需要继续复核。',
    businessNote: plogAsset.score >= 4.3 ? '适合作为英文 PLOG 类视觉方向参考。' : '可作为备选参考，落地前建议补充人工校对。',
    latencyMs: 12000 + Math.round(plogAsset.score * 1200),
    params: 'ratio=3:4, quality=2K, source=展示用例_可用测试用例',
  };
}

function makeResult(
  caseId: string,
  setId: string,
  modelId: string,
  media: MediaType,
  score: number,
  verdict: Verdict,
  issueTags: string[],
  latencyMs: number,
): TestResult {
  const set = benchmarkSets.find((item) => item.id === setId);
  const focus = set?.focus ?? focusPoints.slice(0, 4);
  const imageIndex = Math.abs(caseId.length + modelId.length) % imageOutputs.length;
  return {
    id: `${caseId}-${modelId}`,
    caseId,
    setId,
    modelId,
    status: 'success',
    mediaUrl: media === 'image' ? imageOutputs[imageIndex] : videoOutput,
    posterUrl: media === 'video' ? videoPosters[imageIndex % videoPosters.length] : undefined,
    score,
    autoScore: Math.max(2.7, score - 0.2),
    humanScore: score,
    focusScores: Object.fromEntries(focus.map((point, index) => [point, Math.max(2.5, score - index * 0.15)])),
    issueTags,
    verdict,
    reviewerNote: score > 4.2 ? '整体达到业务参考标准，建议进入接入方案评估。' : '结果具备参考价值，但需要补充同类 prompt 复测。',
    businessNote: score > 4.2 ? '适合作为当前项目的首选模型案例。' : '可作为备选方案，需要关注稳定性和人工复核成本。',
    latencyMs,
    params: 'ratio=9:16, quality=high, seed=auto',
  };
}

function App() {
  const [activeTab, setActiveTab] = useState('market');
  const [selectedSetId, setSelectedSetId] = useState(benchmarkSets[0].id);
  const [selectedCaseId, setSelectedCaseId] = useState(benchmarkSets[0].prompts[0].id);
  const [results, setResults] = useState<TestResult[]>(seededResults);
  const [adhocResults, setAdhocResults] = useState<AdhocResult[]>([]);
  const [adhocSaved, setAdhocSaved] = useState(false);
  const [draftPromptCount, setDraftPromptCount] = useState(0);
  const [selectedModels, setSelectedModels] = useState<string[]>(models.map((model) => model.id));
  const [customPrompt, setCustomPrompt] = useState('生成一张 9:16 TikTok 广告视觉：蓝色运动水杯在晨跑场景中，清爽、有速度感，适合新品发布。');
  const [imageRatio, setImageRatio] = useState<AspectRatio>('3:4');
  const [imageQuality, setImageQuality] = useState<ImageQuality>('2K');
  const [videoRatio, setVideoRatio] = useState<AspectRatio>('9:16');
  const [videoResolution, setVideoResolution] = useState<VideoResolution>('720P');
  const [needText, setNeedText] = useState('我需要给 TikTok Shop 的夏季促销项目找图像和短视频模型，重点是商品清晰、中文短字稳定、广告感高级，最好能复用已有商品素材。');
  const [running, setRunning] = useState(false);
  const [query, setQuery] = useState('');
  const [mediaFilter, setMediaFilter] = useState<'全部' | MediaType>('全部');
  const [verdictFilter, setVerdictFilter] = useState<'全部' | Verdict>('全部');
  const [showFocusHighlights, setShowFocusHighlights] = useState(false);
  const [needLink, setNeedLink] = useState('');
  const [showDraftDetail, setShowDraftDetail] = useState(false);
  const [libraryDetailSetId, setLibraryDetailSetId] = useState<string | null>(null);
  const [selectedModelDetailId, setSelectedModelDetailId] = useState<string | null>(null);
  const [modelReturnTab, setModelReturnTab] = useState('market');
  const [currentRole, setCurrentRole] = useState<UserRole>('模型管理');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const selectedSet = benchmarkSets.find((set) => set.id === selectedSetId) ?? benchmarkSets[0];
  const selectedCase = selectedSet.prompts.find((item) => item.id === selectedCaseId) ?? selectedSet.prompts[0];
  const libraryDetailSet = libraryDetailSetId ? benchmarkSets.find((set) => set.id === libraryDetailSetId) : undefined;
  const selectedModelDetail = selectedModelDetailId ? models.find((model) => model.id === selectedModelDetailId) : undefined;

  const caseResults = results.filter((result) => result.caseId === selectedCase.id);

  const filteredSets = benchmarkSets.filter((set) => {
    const text = `${set.title} ${set.business} ${set.task} ${set.focus.join(' ')}`.toLowerCase();
    const matchesQuery = text.includes(query.toLowerCase());
    const matchesMedia = mediaFilter === '全部' || set.media === mediaFilter;
    return matchesQuery && matchesMedia;
  }).sort((a, b) => getBenchmarkCardOrder(a) - getBenchmarkCardOrder(b));

  const recommendations = useMemo(() => recommendModels(`${needText} ${needLink}`, results), [needText, needLink, results]);
  const demandInsights = useMemo(() => analyzeDemand(`${needText} ${needLink}`), [needText, needLink]);

  function toggleModel(modelId: string) {
    setSelectedModels((current) => (current.includes(modelId) ? current.filter((id) => id !== modelId) : [...current, modelId]));
  }

  function runBatch(event: FormEvent) {
    event.preventDefault();
    setRunning(true);
    const compatibleModels = models.filter(
      (model) => selectedModels.includes(model.id) && model.tasks.includes(selectedSet.task) && model.media.includes(selectedSet.media),
    );

    const queued = compatibleModels.map((model) => ({
      ...makeResult(selectedCase.id, selectedSet.id, model.id, selectedSet.media, 0, '需复测', [], 0),
      id: `${selectedCase.id}-${model.id}-${Date.now()}`,
      status: 'running' as ResultStatus,
      score: 0,
      autoScore: 0,
      reviewerNote: '模型调用中，等待输出回传。',
      businessNote: '结果生成中。',
    }));

    setResults((current) => [...queued, ...current.filter((result) => !(result.caseId === selectedCase.id && compatibleModels.some((model) => model.id === result.modelId)))]);

    window.setTimeout(() => {
      const completed = compatibleModels.map((model, index) => {
        const base = 3.4 + ((model.tags.filter((tag) => selectedSet.focus.includes(tag)).length + index) % 3) * 0.45;
        const score = Math.min(4.8, Number((base + Math.random() * 0.45).toFixed(1)));
        const verdict: Verdict = score >= 4.3 ? '推荐' : score >= 3.6 ? '谨慎推荐' : '需复测';
        return {
          ...makeResult(selectedCase.id, selectedSet.id, model.id, selectedSet.media, score, verdict, inferIssues(selectedSet.focus, score), 9000 + Math.round(Math.random() * 90000)),
          params: `ratio=9:16, quality=high, promptHash=${hashText(customPrompt)}`,
          reviewerNote: `自动初评：${selectedSet.focus.slice(0, 2).join('、')}表现${score >= 4 ? '较好' : '需要复核'}，建议人工确认结论。`,
        };
      });
      setResults((current) => [...completed, ...current.filter((result) => !(result.caseId === selectedCase.id && compatibleModels.some((model) => model.id === result.modelId)))]);
      setRunning(false);
    }, 1400);
  }

  function runAdhoc(event: FormEvent) {
    event.preventDefault();
    const targetModels = models.filter((model) => selectedModels.includes(model.id));
    setRunning(true);
    setAdhocSaved(false);
    setAdhocResults(
      targetModels.map((model) => ({
        id: `adhoc-${model.id}-${Date.now()}`,
        modelId: model.id,
        status: 'running',
        media: model.media.includes('image') ? 'image' : 'video',
        userScore: 0,
        note: '模型调用中，等待输出回传。',
        latencyMs: 0,
      })),
    );

    window.setTimeout(() => {
      setAdhocResults(
        targetModels.map((model, index) => {
          const media = model.media.includes('image') ? 'image' : 'video';
          return {
            id: `adhoc-${model.id}-${Date.now()}-${index}`,
            modelId: model.id,
            status: 'success',
            media,
            mediaUrl: media === 'image' ? imageOutputs[(index + customPrompt.length) % imageOutputs.length] : videoOutput,
            posterUrl: media === 'video' ? videoPosters[index % videoPosters.length] : undefined,
            userScore: 0,
            note: '临时试跑结果仅供预览，请由使用者自行打分；确认有价值后再沉淀为正式考题。',
            latencyMs: 8000 + Math.round(Math.random() * 85000),
          };
        }),
      );
      setRunning(false);
    }, 1200);
  }

  function updateAnnotation(resultId: string, patch: Partial<TestResult>) {
    setResults((current) => current.map((result) => (result.id === resultId ? { ...result, ...patch, score: patch.humanScore ?? patch.score ?? result.score } : result)));
  }

  function jumpToLibrary() {
    setShowDraftDetail(false);
    setLibraryDetailSetId(null);
    setQuery('');
    setMediaFilter('全部');
    setActiveTab('library');
  }

  function openModelDetail(modelId: string, returnTab = activeTab) {
    setSelectedModelDetailId(modelId);
    setModelReturnTab(returnTab);
    setActiveTab('model');
  }

  function openBenchmarkEvidence(setId: string, caseId?: string) {
    const targetSet = benchmarkSets.find((set) => set.id === setId);
    if (!targetSet) return;
    setSelectedSetId(targetSet.id);
    setSelectedCaseId(caseId ?? targetSet.prompts[0].id);
    setShowDraftDetail(false);
    setLibraryDetailSetId(targetSet.id);
    setActiveTab('library');
  }

  return (
    <main>
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark" aria-hidden="true">
            <svg className="emojiLogo" viewBox="0 0 48 48" role="img">
              <path className="gemTop" d="M12 13h24l8 10H4l8-10Z" />
              <path className="gemFaceLeft" d="M4 23h16l4 20L4 23Z" />
              <path className="gemFaceCenter" d="M20 23h8l-4 20-4-20Z" />
              <path className="gemFaceRight" d="M28 23h16L24 43l4-20Z" />
              <path className="gemShine" d="M15 16h7l-4 5H10l5-5Z" />
            </svg>
          </div>
          <div>
            <strong>Model Gem</strong>
            <span>Pick the right model</span>
          </div>
        </div>

        <nav>
          {[
            ['market', '模型超市', '🛒'],
            ['library', '评测题库', '🧪'],
            ['compare', '横向对比', '⚖️'],
            ['recommend', '需求匹配', '✨'],
            ['lab', '一键试跑', '🚀'],
            ['annotate', '接入指引', '🧭'],
          ].map(([id, label, Icon]) => (
            <button key={id as string} className={activeTab === id ? 'active' : ''} onClick={() => {
              setSelectedModelDetailId(null);
              setActiveTab(id as string);
            }}>
              <span className="navEmoji">{Icon as string}</span>
              {label as string}
            </button>
          ))}
        </nav>

        <div className="sidebarMeta">
          <div className="roleSummary">
            <div>
              <span>👤 当前身份</span>
              <strong>{currentRole}</strong>
              <small>{roleDescription(currentRole)}</small>
            </div>
            <button type="button" aria-label="打开用户设置" onClick={() => setShowUserMenu((open) => !open)}>
              <Settings size={16} />
            </button>
          </div>
          {showUserMenu && <UserMenu currentRole={currentRole} onRoleChange={setCurrentRole} />}
        </div>
      </aside>

      <section className="workspace">
        <header className={`topbar ${activeTab === 'market' ? 'marketTopbar' : ''}`}>
          <div>
            <p>{tabSlogan(activeTab)}</p>
            <h1>{tabTitle(activeTab)}</h1>
          </div>
          {activeTab === 'market' && <ComplianceHelp />}
          {activeTab === 'lab' && <RunStatus running={running} selectedCount={selectedModels.length} resultCount={adhocResults.filter((result) => result.status === 'success').length} />}
          {shouldShowTopStats(activeTab) && (
            <div className="topStats">
              <Metric icon={<Database size={17} />} label="考题集" value={benchmarkSets.length.toString()} onClick={activeTab === 'recommend' ? jumpToLibrary : undefined} />
              <Metric icon={<Activity size={17} />} label="测试结果" value={results.length.toString()} onClick={activeTab === 'recommend' ? jumpToLibrary : undefined} />
              <Metric icon={<BadgeCheck size={17} />} label="Prompt 数" value={benchmarkSets.reduce((sum, set) => sum + getSetQuestionCount(set), 0).toString()} onClick={activeTab === 'recommend' ? jumpToLibrary : undefined} />
            </div>
          )}
        </header>

        {activeTab === 'model' && selectedModelDetail && (
          <ModelDetail
            model={selectedModelDetail}
            results={results}
            onBack={() => {
              setSelectedModelDetailId(null);
              setActiveTab(modelReturnTab);
            }}
            onEvidenceClick={openBenchmarkEvidence}
          />
        )}

        {activeTab === 'market' && <ModelMarket onOpenModel={(modelId) => openModelDetail(modelId, 'market')} />}

        {activeTab === 'lab' && (
          <section className="grid two">
            <Panel title="输入 Prompt 并选择模型" icon={<Settings2 size={18} />}>
              <form className="stack" onSubmit={runAdhoc}>
                <label>
                  Prompt
                  <textarea value={customPrompt} onChange={(event) => setCustomPrompt(event.target.value)} rows={8} placeholder="输入你想临时试跑的 prompt..." />
                </label>
                <div className="hint">
                  <Wand2 size={17} />
                  一键试跑不会写入评测题库；结果适合快速预览，确认有价值后再沉淀为正式考题。
                </div>
                <section className="runParams">
                  <div className="paramGroup">
                    <div>
                      <strong>图像参数</strong>
                    </div>
                    <SegmentedOptions value={imageRatio} options={['1:1', '3:4', '4:3', '9:16', '16:9']} onChange={(value) => setImageRatio(value as AspectRatio)} />
                    <i className="paramDivider" aria-hidden="true" />
                    <SegmentedOptions value={imageQuality} options={['1K', '2K', '4K']} onChange={(value) => setImageQuality(value as ImageQuality)} />
                  </div>
                  <div className="paramGroup">
                    <div>
                      <strong>视频参数</strong>
                    </div>
                    <SegmentedOptions value={videoRatio} options={['1:1', '3:4', '4:3', '9:16', '16:9']} onChange={(value) => setVideoRatio(value as AspectRatio)} />
                    <i className="paramDivider" aria-hidden="true" />
                    <SegmentedOptions value={videoResolution} options={['480P', '720P', '1080P']} onChange={(value) => setVideoResolution(value as VideoResolution)} />
                  </div>
                </section>
                <div className="modelSelectBar">
                  <span>选择模型</span>
                  <button type="button" onClick={() => setSelectedModels(selectedModels.length === models.length ? [] : models.map((model) => model.id))}>
                    {selectedModels.length === models.length ? '清空' : '全选'}
                  </button>
                </div>
                <div className="checkGrid">
                  {models.map((model) => (
                    <label key={model.id} className={`checkCard ${selectedModels.includes(model.id) ? 'selected' : ''}`}>
                      <input type="checkbox" checked={selectedModels.includes(model.id)} onChange={() => toggleModel(model.id)} />
                      <b aria-hidden="true">✓</b>
                      <span>{model.name}</span>
                      <small>{model.modelType} · {formatTasks(model.tasks)}</small>
                    </label>
                  ))}
                </div>
                <button className="primary" type="submit" disabled={running || selectedModels.length === 0}>
                  {running ? <Loader2 className="spin" size={18} /> : <Play size={18} />}
                  同时试跑选中模型
                </button>
              </form>
            </Panel>

            <Panel
              title="临时试跑结果"
              icon={<Gauge size={18} />}
              action={
                <button
                  className={`saveToLibrary ${adhocSaved ? 'saved' : ''}`}
                  type="button"
                  disabled={adhocResults.filter((result) => result.status === 'success').length === 0 || running}
                  onClick={() => {
                    if (!adhocSaved) setDraftPromptCount((count) => count + 1);
                    setAdhocSaved(true);
                  }}
                >
                  {adhocSaved ? '已加入待整理题库' : '入库为考题'}
                </button>
              }
            >
              <div className="adhocPromptPreview">
                <span>Current prompt</span>
                <p>{customPrompt}</p>
              </div>
              <div className="adhocResultGrid">
                {adhocResults.length === 0 && <EmptyState text="还没有结果，输入 prompt 并选择模型后开始试跑。" />}
                {adhocResults.map((result) => (
                  <AdhocResultCard
                    key={result.id}
                    result={result}
                    params={{
                      imageRatio,
                      imageQuality,
                      videoRatio,
                      videoResolution,
                    }}
                    onScoreChange={(score) => {
                      setAdhocResults((current) => current.map((item) => (item.id === result.id ? { ...item, userScore: score } : item)));
                    }}
                  />
                ))}
              </div>
            </Panel>
          </section>
        )}

        {activeTab === 'library' && (
          <section className="stack">
            {showDraftDetail ? (
              <DraftDetail
                prompt={customPrompt}
                draftCount={draftPromptCount}
                adhocResults={adhocResults}
                onBack={() => setShowDraftDetail(false)}
                onArchive={() => {
                  setShowDraftDetail(false);
                  setDraftPromptCount(0);
                  setAdhocSaved(false);
                }}
              />
            ) : libraryDetailSet ? (
              <BenchmarkSetDetail
                key={libraryDetailSet.id}
                set={libraryDetailSet}
                results={results}
                onBack={() => setLibraryDetailSetId(null)}
                onCompare={(caseId) => {
                  setSelectedSetId(libraryDetailSet.id);
                  setSelectedCaseId(caseId);
                  setActiveTab('compare');
                }}
                onTryRun={(prompt) => {
                  setCustomPrompt(prompt);
                  setActiveTab('lab');
                }}
              />
            ) : (
              <>
            <div className="filters">
              <div className="searchBox">
                <Search size={17} />
                <input placeholder="搜索业务、任务类型或考点" value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <div className="mediaFilter" aria-label="按媒体类型筛选">
                {[
                  ['全部', '全部'],
                  ['image', '图像'],
                  ['video', '视频'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={mediaFilter === value ? 'active' : ''}
                    onClick={() => setMediaFilter(value as '全部' | MediaType)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="setGrid">
              {draftPromptCount > 0 && (
                <button className="setCard draftSetCard hasDrafts" onClick={() => setShowDraftDetail(true)}>
                  <div className="draftPreview">
                    <span>待整理</span>
                    <strong>{draftPromptCount}</strong>
                  </div>
                  <div className="setTitleBlock">
                    <div>
                      <strong>待整理题库</strong>
                      <span>来自一键试跑 · 待归档</span>
                    </div>
                    <span className="previewBadge">Draft</span>
                  </div>
                  <div className="setMetaLine">
                    <span>待补考点</span>
                    <i aria-hidden="true" />
                    <span>待归类</span>
                  </div>
                  <p className="setFocus">试跑后认为值得复用的 prompt 会先进入这里，再整理到正式题库。</p>
                  <div className="setFoot">
                    <span>{draftPromptCount} 道待整理</span>
                    <small>整理 <ChevronRight size={14} /></small>
                  </div>
                </button>
              )}
              {filteredSets.map((set) => (
                <button
                  key={set.id}
                  className={`setCard ${selectedSetId === set.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedSetId(set.id);
                    setSelectedCaseId(set.prompts[0].id);
                    setLibraryDetailSetId(set.id);
                  }}
                >
                  <BenchmarkPreview set={set} />
                  <div className="setTitleBlock">
                    <div>
                      <strong>{set.title}</strong>
                      <span>{set.business} · {set.owner}</span>
                    </div>
                    <span className="previewBadge">
                      {set.preview.type === 'video' ? <Clapperboard size={13} /> : set.preview.type === 'image' ? <Image size={13} /> : <MessageSquareText size={13} />}
                      {set.preview.label}
                    </span>
                  </div>
                  <div className="setMetaLine">
                    <span>{formatTask(set.task)}</span>
                    <i aria-hidden="true" />
                    <span>{formatMedia([set.media])}</span>
                  </div>
                  <p className="setFocus">{set.focus.slice(0, 3).join(' / ')}</p>
                  <div className="setFoot">
                    <span>{getSetQuestionCount(set)} 道题目</span>
                    <small>查看 <ChevronRight size={14} /></small>
                  </div>
                </button>
              ))}
            </div>
              </>
            )}
          </section>
        )}

        {activeTab === 'compare' && (
          <section className="stack">
            <CompareBoard
              selectedSet={selectedSet}
              results={results}
              showFocusHighlights={showFocusHighlights}
              onToggleHighlights={setShowFocusHighlights}
              onSetChange={(setId) => {
                const nextSet = benchmarkSets.find((set) => set.id === setId);
                if (!nextSet) return;
                setSelectedSetId(nextSet.id);
                setSelectedCaseId(nextSet.prompts[0].id);
              }}
            />
          </section>
        )}

        {activeTab === 'annotate' && (
          <IntegrationGuide />
        )}

        {activeTab === 'recommend' && (
          <section className="grid two">
            <Panel title="业务需求输入" icon={<MessageSquareText size={18} />}>
              <div className="stack">
                <textarea value={needText} onChange={(event) => setNeedText(event.target.value)} rows={9} placeholder="粘贴业务需求、brief、PRD 片段、prompt 草案或任意形式的输入..." />
                <label className="linkInput">
                  <Link size={18} />
                  <input value={needLink} onChange={(event) => setNeedLink(event.target.value)} placeholder="粘贴 PRD / brief / 飞书文档 / 网页链接" />
                </label>
                <div className="hint">
                  <Wand2 size={17} />
                  系统会先解析需求要考察的能力点，再绑定历史题库证据给出选型建议。
                </div>
              </div>
            </Panel>
            <Panel title="需求解析与选型建议" icon={<SelectionGlyph />}>
              <div className="recommendStack">
                <DemandInsights insights={demandInsights} />
                <div className="recommendList">
                  {recommendations.map((item, index) => (
                    <RecommendationCard
                      key={item.model.id}
                      rank={index + 1}
                      item={item}
                      onEvidenceClick={(evidence) => {
                        if (!evidence.setId) return;
                        openBenchmarkEvidence(evidence.setId, evidence.caseId);
                      }}
                      onOpenModel={() => openModelDetail(item.model.id, 'recommend')}
                    />
                  ))}
                </div>
              </div>
            </Panel>
          </section>
        )}
      </section>
    </main>
  );
}

function Metric({ icon, label, value, onClick }: { icon: ReactNode; label: string; value: string; onClick?: () => void }) {
  const content = (
    <>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </>
  );
  if (onClick) {
    return (
      <button className="metric metricButton" type="button" onClick={onClick} title="查看评测题库">
        {content}
      </button>
    );
  }
  return (
    <div className="metric">
      {content}
    </div>
  );
}

function UserMenu({ currentRole, onRoleChange }: { currentRole: UserRole; onRoleChange: (role: UserRole) => void }) {
  const roles: UserRole[] = ['模型管理', '业务查看'];
  return (
    <div className="userMenu">
      <div className="userAccount">
        <span>飞书账号</span>
        <strong>designer@tiktok.com</strong>
      </div>
      <div className="roleSwitch">
        {roles.map((role) => (
          <button key={role} type="button" className={currentRole === role ? 'active' : ''} onClick={() => onRoleChange(role)}>
            <strong>{role}</strong>
            <span>{roleDescription(role)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function roleDescription(role: UserRole) {
  return role === '模型管理' ? '管理模型、题库、试跑入库与接入状态' : '查看模型效果、题库、对比与接入指引';
}

function RunStatus({ running, selectedCount, resultCount }: { running: boolean; selectedCount: number; resultCount: number }) {
  const status = running ? '运行中' : resultCount > 0 ? `已完成 ${resultCount}/${selectedCount}` : '待运行';
  return (
    <div className={`runStatus ${running ? 'running' : resultCount > 0 ? 'done' : ''}`}>
      {running && <Loader2 className="spin" size={14} />}
      <span>{status}</span>
    </div>
  );
}

function Panel({ title, icon, children, action }: { title: string; icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="panel">
      <div className="panelTitle">
        <div>
          {icon}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SelectionGlyph() {
  return (
    <svg className="selectionGlyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2.8l1.8 6.1L20 12l-6.2 3.1L12 21.2l-1.8-6.1L4 12l6.2-3.1L12 2.8Z" />
    </svg>
  );
}

function SegmentedOptions({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className="segmentedOptions">
      {options.map((option) => (
        <button key={option} type="button" className={value === option ? 'active' : ''} onClick={() => onChange(option)}>
          {option}
        </button>
      ))}
    </div>
  );
}

function CaseSummary({ selectedSet, selectedCase }: { selectedSet: BenchmarkSet; selectedCase: PromptCase }) {
  return (
    <div className="caseSummary">
      <span>{selectedSet.business} · {selectedSet.task}</span>
      <strong>{selectedCase.title}</strong>
      <p>{selectedCase.prompt}</p>
      <div className="tagRow">
        {selectedCase.focus.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
    </div>
  );
}

function CasePicker({
  selectedSet,
  selectedCaseId,
  onCaseChange,
}: {
  selectedSet: BenchmarkSet;
  selectedCaseId: string;
  onCaseChange: (id: string) => void;
}) {
  return (
    <div className="casePicker">
      <CaseSummary selectedSet={selectedSet} selectedCase={selectedSet.prompts.find((item) => item.id === selectedCaseId) ?? selectedSet.prompts[0]} />
      <select value={selectedCaseId} onChange={(event) => onCaseChange(event.target.value)}>
        {selectedSet.prompts.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </select>
    </div>
  );
}

function BenchmarkPreview({ set }: { set: BenchmarkSet }) {
  return (
    <div className={`benchmarkPreview ${set.preview.type}`}>
      <span className="setUpdated">{set.updatedAt}</span>
      {set.preview.type === 'text' ? (
        <div className="textPreview">
          <p>
            <strong>{getPromptCoverText(set).prefix}</strong>
            <mark>{getPromptCoverText(set).selected}</mark>
            {getPromptCoverText(set).suffix && <strong>{getPromptCoverText(set).suffix}</strong>}
          </p>
        </div>
      ) : (
        <div className="previewStack">
          {set.preview.assets.slice(0, 3).map((asset, index) => (
            <img key={asset} src={asset} alt={`${set.title} preview ${index + 1}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function getPromptCoverText(set: BenchmarkSet) {
  if (set.id === 'portrait-t2i-600') return { prefix: 'Portrait ', selected: 'DEI', suffix: '' };
  if (set.id === 'localized-culture-festival') return { prefix: 'Local ', selected: 'RITE', suffix: '' };
  if (set.id === 'trending-makeup-2026') return { prefix: 'Trend ', selected: 'LOOK', suffix: '' };
  if (set.id === 'multilingual-text-generation') return { prefix: 'Global ', selected: 'TYPE', suffix: '' };
  if (set.id === 'asset-remix') return { prefix: 'Brand ', selected: 'REMIX', suffix: '' };
  return { prefix: 'Prompt ', selected: 'SET', suffix: '' };
}

function BenchmarkSetDetail({
  set,
  results,
  onBack,
  onCompare,
  onTryRun,
}: {
  set: BenchmarkSet;
  results: TestResult[];
  onBack: () => void;
  onCompare: (caseId: string) => void;
  onTryRun: (prompt: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedPromptId, setSelectedPromptId] = useState(set.prompts[0]?.id ?? '');
  const selectedPrompt = set.prompts.find((prompt) => prompt.id === selectedPromptId) ?? set.prompts[0];
  const filteredPrompts = set.prompts.filter((prompt) => {
    const text = `${prompt.title} ${prompt.prompt} ${prompt.focus.join(' ')}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });
  const visiblePrompts = filteredPrompts.slice(0, 80);
  const coverage = Array.from(new Set(set.prompts.flatMap((prompt) => prompt.focus))).slice(0, 8);
  const selectedResults = results
    .filter((result) => result.setId === set.id && result.caseId === selectedPrompt.id && result.status === 'success')
    .sort((a, b) => models.findIndex((model) => model.id === a.modelId) - models.findIndex((model) => model.id === b.modelId));

  return (
    <section className="setDetail">
      <div className="setDetailHead">
        <div>
          <span>{set.business} · {formatTask(set.task)} · {formatMedia([set.media])}</span>
          <h2>{set.title}</h2>
        </div>
        <div className="setDetailActions">
          <button type="button" onClick={onBack}>返回</button>
          <button type="button" className="primaryMini" onClick={() => onCompare(selectedPrompt.id)}>
            打开横向对比
          </button>
        </div>
      </div>

      <div className="setDetailSummary">
        <article>
          <span>题目总数</span>
          <strong>{getSetQuestionCount(set)}</strong>
        </article>
        <article>
          <span>已导入样本</span>
          <strong>{set.prompts.length}</strong>
        </article>
        <article>
          <span>更新时间</span>
          <strong>{set.updatedAt}</strong>
        </article>
        <article>
          <span>Owner</span>
          <strong>{set.owner}</strong>
        </article>
      </div>

      <div className="setDetailBody">
        <aside className="promptBrowser">
          <div className="promptBrowserTop">
            <div className="searchBox">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索 prompt / 考点" />
            </div>
            <small>显示 {visiblePrompts.length} / {filteredPrompts.length} 条</small>
          </div>
          <div className="promptList">
            {visiblePrompts.map((prompt) => (
              <button
                key={prompt.id}
                type="button"
                className={selectedPrompt.id === prompt.id ? 'active' : ''}
                onClick={() => setSelectedPromptId(prompt.id)}
              >
                <span>{prompt.title}</span>
                <p>{prompt.prompt}</p>
              </button>
            ))}
          </div>
        </aside>

        <article className="promptDetailCard">
          <div className="promptDetailTop">
            <div>
              <span>Selected Prompt</span>
              <strong>{selectedPrompt.title}</strong>
            </div>
            <button type="button" onClick={() => onTryRun(selectedPrompt.prompt)}>
              用这题试跑
            </button>
          </div>
          <p className="promptFullText">{selectedPrompt.prompt}</p>
          <div className="detailBlock">
            <span>关联考点</span>
            <div className="detailChips">
              {selectedPrompt.focus.map((focus) => (
                <b key={focus}>{focus}</b>
              ))}
            </div>
          </div>
          <div className="detailBlock">
            <span>题库覆盖</span>
            <div className="detailChips muted">
              {coverage.map((focus) => (
                <b key={focus}>{focus}</b>
              ))}
            </div>
          </div>
          <div className="expectedBox">
            <span>评测期望</span>
            <p>{selectedPrompt.expected}</p>
          </div>
          {selectedResults.length > 0 && (
            <div className="detailBlock">
              <span>模型结果预览</span>
              <div className="promptResultPreview">
                {selectedResults.map((result) => {
                  const model = models.find((item) => item.id === result.modelId);
                  return (
                    <article key={result.id}>
                      <div className="resultPreviewMedia">
                        <MediaOutput media={set.media} src={result.mediaUrl} poster={result.posterUrl} label={model?.name ?? result.modelId} controls={false} />
                      </div>
                      <div>
                        <strong>{model?.name ?? result.modelId}</strong>
                        <span>{result.score.toFixed(1)} · {result.verdict}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
          {set.sourcePath && (
            <div className="sourcePath">
              <span>Source</span>
              <code>{set.sourcePath}</code>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

function CompareBoard({
  selectedSet,
  results,
  showFocusHighlights,
  onToggleHighlights,
  onSetChange,
}: {
  selectedSet: BenchmarkSet;
  results: TestResult[];
  showFocusHighlights: boolean;
  onToggleHighlights: (value: boolean) => void;
  onSetChange: (setId: string) => void;
}) {
  const setResults = results.filter((result) => result.setId === selectedSet.id && result.status === 'success');
  const modelIds = Array.from(new Set(setResults.map((result) => result.modelId)));
  const compareModels = modelIds.map((id) => models.find((model) => model.id === id)).filter((model): model is Model => Boolean(model));

  return (
    <section className="compareBoard">
      <div className="compareBoardHead">
        <div>
          <span>{selectedSet.business} · {formatTask(selectedSet.task)}</span>
          <strong>{selectedSet.title}</strong>
        </div>
        <div className="compareBoardActions">
          <label className="compareSetPicker">
            <span>题库</span>
            <select value={selectedSet.id} onChange={(event) => onSetChange(event.target.value)}>
              {benchmarkSets.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.title}
                </option>
              ))}
            </select>
          </label>
          <label className="highlightToggle">
            <input type="checkbox" checked={showFocusHighlights} onChange={(event) => onToggleHighlights(event.target.checked)} />
            <span>考点高亮</span>
          </label>
          <div className="compareBoardMeta">
            <span>{selectedSet.prompts.length} prompts</span>
            <span>{compareModels.length} models</span>
          </div>
        </div>
      </div>
      <div className="compareMatrix" style={{ ['--model-count' as string]: compareModels.length }}>
        <div className="matrixHeader promptHeader">Prompt / Input</div>
        {compareModels.map((model) => (
          <div className="matrixHeader modelHeader" key={model.id}>
            <strong>{model.name}</strong>
            <span>{model.modelType}</span>
          </div>
        ))}
        {selectedSet.prompts.map((promptCase) => (
          <CompareRow key={promptCase.id} promptCase={promptCase} set={selectedSet} compareModels={compareModels} results={setResults} showFocusHighlights={showFocusHighlights} />
        ))}
      </div>
    </section>
  );
}

function CompareRow({
  promptCase,
  set,
  compareModels,
  results,
  showFocusHighlights,
}: {
  promptCase: PromptCase;
  set: BenchmarkSet;
  compareModels: Model[];
  results: TestResult[];
  showFocusHighlights: boolean;
}) {
  return (
    <>
      <article className="promptCell">
        {promptCase.inputAsset && <small>Input: {promptCase.inputAsset}</small>}
        <p>{showFocusHighlights ? <HighlightedPrompt prompt={promptCase.prompt} focus={promptCase.focus} /> : promptCase.prompt}</p>
        <div className="promptFocus">
          <span>考点</span>
          {promptCase.focus.slice(0, 3).map((point) => (
            <b key={point}>{point}</b>
          ))}
        </div>
      </article>
      {compareModels.map((model) => {
        const result = results.find((item) => item.caseId === promptCase.id && item.modelId === model.id);
        return <CompareResultCell key={`${promptCase.id}-${model.id}`} result={result} model={model} media={set.media} />;
      })}
    </>
  );
}

function HighlightedPrompt({ prompt, focus }: { prompt: string; focus: string[] }) {
  const tokens = getHighlightTokens(focus);
  if (tokens.length === 0) return <>{prompt}</>;
  const pattern = new RegExp(`(${tokens.map((item) => escapeRegExp(item.text)).join('|')})`, 'g');
  return (
    <>
      {prompt.split(pattern).map((part, index) => {
        const token = tokens.find((item) => item.text === part);
        if (!token) return <span key={`${part}-${index}`}>{part}</span>;
        return (
          <mark className={`promptMark ${token.tone}`} key={`${part}-${index}`}>
            {part}
          </mark>
        );
      })}
    </>
  );
}

function MediaOutput({
  media,
  src,
  poster,
  label,
  controls = true,
}: {
  media: MediaType;
  src?: string;
  poster?: string;
  label: string;
  controls?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <MediaPlaceholder media={media} label={label} />;
  if (media === 'video') {
    return <video controls={controls} poster={poster} src={src} onError={() => setFailed(true)} />;
  }
  return <img src={src} alt={label} onError={() => setFailed(true)} />;
}

function MediaPlaceholder({ media, label }: { media: MediaType; label: string }) {
  return (
    <div className={`mediaPlaceholder ${media}`}>
      {media === 'video' ? <Play size={26} /> : <Image size={26} />}
      <span>{media === 'video' ? 'Video preview' : 'Image preview'}</span>
      <strong>{label}</strong>
    </div>
  );
}

function CompareResultCell({ result, model, media }: { result?: TestResult; model: Model; media: MediaType }) {
  if (!result) {
    return (
      <article className="compareCell emptyCell">
        <span>未测试</span>
      </article>
    );
  }
  return (
    <article className="compareCell">
      <div className="compareMedia">
        <MediaOutput media={media} src={result.mediaUrl} poster={result.posterUrl} label={`${model.name} output`} />
      </div>
      <div className="compareCellBody">
        <div className="rowBetween">
          <span className="scoreMini">{result.score.toFixed(1)}</span>
          <VerdictPill verdict={result.verdict} />
        </div>
        <p>{result.reviewerNote}</p>
      </div>
    </article>
  );
}

function DraftDetail({
  prompt,
  draftCount,
  adhocResults,
  onBack,
  onArchive,
}: {
  prompt: string;
  draftCount: number;
  adhocResults: AdhocResult[];
  onBack: () => void;
  onArchive: () => void;
}) {
  const scoredCount = adhocResults.filter((result) => result.userScore > 0).length;
  return (
    <section className="draftDetail">
      <div className="draftDetailHead">
        <button type="button" onClick={onBack}>返回题库列表</button>
        <div>
          <span>来自一键试跑</span>
          <h2>待整理题库</h2>
        </div>
        <button type="button" className="primaryMini" disabled={draftCount === 0} onClick={onArchive}>
          整理入正式题库
        </button>
      </div>
      <div className="draftDetailGrid">
        <article className="draftPromptCard">
          <span>Prompt</span>
          <p>{draftCount > 0 ? prompt : '暂无待整理 prompt。请先在一键试跑中点击“入库为考题”。'}</p>
        </article>
        <article className="draftMetaCard">
          <div>
            <span>待整理</span>
            <strong>{draftCount}</strong>
          </div>
          <div>
            <span>试跑模型</span>
            <strong>{adhocResults.length}</strong>
          </div>
          <div>
            <span>已评分</span>
            <strong>{scoredCount}</strong>
          </div>
        </article>
      </div>
      <div className="draftResultList">
        {adhocResults.length === 0 && <EmptyState text="暂无试跑结果。" />}
        {adhocResults.map((result) => {
          const model = models.find((item) => item.id === result.modelId);
          return (
            <article key={result.id}>
              <strong>{model?.name ?? result.modelId}</strong>
              <span>{result.userScore ? `${result.userScore}/5` : '未评分'}</span>
              <small>{result.note}</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ResultCard({ result, compact = false }: { result: TestResult; compact?: boolean }) {
  const model = models.find((item) => item.id === result.modelId)!;
  const set = benchmarkSets.find((item) => item.id === result.setId)!;
  const isVideo = set.media === 'video';
  return (
    <article className={`resultCard ${compact ? 'compact' : ''}`}>
      <div className="mediaBox">
        {result.status === 'running' && (
          <div className="loadingMedia">
            <Loader2 className="spin" size={24} />
            <span>调用中</span>
          </div>
        )}
        {result.status === 'failed' && (
          <div className="loadingMedia failed">
            <CircleAlert size={24} />
            <span>{result.error ?? '调用失败'}</span>
          </div>
        )}
        {result.status === 'success' && <MediaOutput media={isVideo ? 'video' : 'image'} src={result.mediaUrl} poster={result.posterUrl} label={`${model.name} output`} />}
      </div>
      <div className="resultBody">
        <div className="rowBetween">
          <strong>{model.name}</strong>
          <VerdictPill verdict={result.verdict} />
        </div>
        <div className="scoreLine">
          <Star size={16} />
          <span>{result.score ? result.score.toFixed(1) : '--'} / 5</span>
          <small>auto {result.autoScore ? result.autoScore.toFixed(1) : '--'}</small>
        </div>
        {!compact && (
          <>
            <p>{result.reviewerNote}</p>
            <div className="tagRow">
              {result.issueTags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <small>{result.params} · {(result.latencyMs / 1000).toFixed(1)}s</small>
          </>
        )}
      </div>
    </article>
  );
}

function AdhocResultCard({
  result,
  params,
  onScoreChange,
}: {
  result: AdhocResult;
  params: { imageRatio: AspectRatio; imageQuality: ImageQuality; videoRatio: AspectRatio; videoResolution: VideoResolution };
  onScoreChange: (score: number) => void;
}) {
  const model = models.find((item) => item.id === result.modelId)!;
  const paramText = result.media === 'image' ? `${params.imageRatio} · ${params.imageQuality}` : `${params.videoRatio} · ${params.videoResolution}`;
  return (
    <article className="adhocResultCard">
      <div className="mediaBox">
        {result.status === 'running' && (
          <div className="loadingMedia">
            <Loader2 className="spin" size={24} />
            <span>调用中</span>
          </div>
        )}
        {result.status === 'success' && <MediaOutput media={result.media} src={result.mediaUrl} poster={result.posterUrl} label={`${model.name} adhoc output`} />}
      </div>
      <div className="adhocResultBody">
        <div className="rowBetween">
          <strong>{model.name}</strong>
          <small>{paramText}</small>
        </div>
        <div className="userRating" aria-label={`给 ${model.name} 打分`}>
          {[1, 2, 3, 4, 5].map((score) => (
            <button key={score} type="button" className={score <= result.userScore ? 'active' : ''} onClick={() => onScoreChange(score)} disabled={result.status !== 'success'}>
              <Star size={16} />
            </button>
          ))}
          <span>{result.userScore ? `${result.userScore}/5` : '未评分'}</span>
        </div>
        <p>{result.note}</p>
      </div>
    </article>
  );
}

function AnnotationRow({ result, onUpdate }: { result: TestResult; onUpdate: (id: string, patch: Partial<TestResult>) => void }) {
  const model = models.find((item) => item.id === result.modelId)!;
  return (
    <article className="annotationRow">
      <div>
        <strong>{model.name}</strong>
        <span>自动初评 {result.autoScore ? result.autoScore.toFixed(1) : '--'} · 当前 {result.score ? result.score.toFixed(1) : '--'}</span>
      </div>
      <select value={result.verdict} onChange={(event) => onUpdate(result.id, { verdict: event.target.value as Verdict })}>
        <option>推荐</option>
        <option>谨慎推荐</option>
        <option>不推荐</option>
        <option>需复测</option>
      </select>
      <input
        type="number"
        min="1"
        max="5"
        step="0.1"
        value={result.humanScore ?? result.score}
        onChange={(event) => onUpdate(result.id, { humanScore: Number(event.target.value) })}
      />
      <textarea value={result.reviewerNote} rows={2} onChange={(event) => onUpdate(result.id, { reviewerNote: event.target.value })} />
    </article>
  );
}

function ModelCard({ model, onOpen }: { model: Model; onOpen: (modelId: string) => void }) {
  return (
    <article
      className="modelCard"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(model.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen(model.id);
      }}
    >
      <div className="modelCover">
        {model.media.includes('video') ? (
          <video src={model.coverUrl} aria-label={`${model.name} cover`} autoPlay muted loop playsInline />
        ) : (
          <img src={model.coverUrl} alt={`${model.name} cover`} />
        )}
      </div>
      <div className="rowBetween">
        <div>
          <strong>{model.name}</strong>
          <span>{model.modelType} · {formatTasks(model.tasks)}</span>
        </div>
        <StatusPill status={model.status} />
      </div>
      <div className="modelMeta">
        <span>{formatMedia(model.media)}</span>
        <span>性能 {model.performance}</span>
        <span>成本 {model.cost}</span>
      </div>
      <div className="tagRow">
        {model.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className="splitNotes">
        <p><strong>适合：</strong>{model.strengths.join('；')}</p>
        <p><strong>限制：</strong>{model.limits.join('；')}</p>
      </div>
    </article>
  );
}

function ModelMarket({ onOpenModel }: { onOpenModel: (modelId: string) => void }) {
  const imageModels = models.filter((model) => model.media.includes('image'));
  const videoModels = models.filter((model) => model.media.includes('video'));
  return (
    <section className="marketStack">
      <ModelShelf title="图像模型" description="适用于图像生成与编辑，覆盖 T2I、I2I、局部编辑、风格迁移等任务。" models={imageModels} onOpenModel={onOpenModel} />
      <ModelShelf title="视频模型" description="适用于视频生成与编辑，覆盖 T2V、I2V、视频编辑、镜头运动等任务。" models={videoModels} onOpenModel={onOpenModel} />
    </section>
  );
}

function ComplianceHelp() {
  return (
    <div className="complianceHelp">
      <button className="helpTrigger" type="button" aria-label="查看合规状态说明">
        <CircleHelp size={18} />
      </button>
      <div className="helpPopover" role="tooltip">
        <strong>合规状态说明</strong>
        <p><b>业务可用</b> 已过合规，可接入业务上线。</p>
        <p><b>内部可用</b> 仅限内部评测或工具使用，不可直接上线。</p>
        <p><b>待合规</b> 已确认推进接入，合规完成前不可使用。</p>
      </div>
    </div>
  );
}

function ModelShelf({ title, description, models: shelfModels, onOpenModel }: { title: string; description: string; models: Model[]; onOpenModel: (modelId: string) => void }) {
  return (
    <section className="modelShelf">
      <div className="shelfHeader">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span>{shelfModels.length} models</span>
      </div>
      <div className="modelGrid">
        {shelfModels.map((model) => (
          <ModelCard key={`${title}-${model.id}`} model={model} onOpen={onOpenModel} />
        ))}
      </div>
    </section>
  );
}

function IntegrationGuide() {
  const steps = [
    ['确认模型', '从模型超市或需求匹配中确定候选模型，并确认合规状态。'],
    ['准备材料', '整理业务场景、输入素材、目标画幅、上线时间和风险约束。'],
    ['联系 owner', '向模型 owner 发起接入沟通，确认 API、额度和 SLA。'],
    ['灰度验证', '使用正式题库结果作为参考，在业务环境做小流量验证。'],
  ];
  return (
    <section className="guideLayout">
      <Panel title="接入流程" icon={<KeyRound size={18} />}>
        <div className="guideSteps">
          {steps.map(([title, description], index) => (
            <article key={title}>
              <span>{index + 1}</span>
              <div>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
            </article>
          ))}
        </div>
      </Panel>
      <Panel title="模型接入信息" icon={<Link2 size={18} />}>
        <div className="guideModelList">
          {models.map((model) => (
            <article key={model.id}>
              <div>
                <strong>{model.name}</strong>
                <span>{model.modelType} · {formatTasks(model.tasks)}</span>
              </div>
              <StatusPill status={model.status} />
              <div className="guideMeta">
                <span>Owner: {model.media.includes('video') ? 'Video Model Team' : 'Image Model Team'}</span>
                <span>{model.apiMode}</span>
              </div>
              <p>{model.status === '业务可用' ? '可进入业务接入评估；接入前仍需确认项目额度和调用方式。' : model.status === '待合规' ? '已确认推进，但合规完成前不可接入业务上线。' : '仅限内部工具或评测使用，不可直接接入业务上线。'}</p>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function ModelDetail({
  model,
  results,
  onBack,
  onEvidenceClick,
}: {
  model: Model;
  results: TestResult[];
  onBack: () => void;
  onEvidenceClick: (setId: string, caseId?: string) => void;
}) {
  const modelResults = results.filter((result) => result.modelId === model.id && result.status === 'success');
  const avgScore = modelResults.length ? modelResults.reduce((sum, result) => sum + result.score, 0) / modelResults.length : 0;
  const evidence = modelResults.slice(0, 4).map((result) => {
    const set = benchmarkSets.find((item) => item.id === result.setId);
    const prompt = set?.prompts.find((item) => item.id === result.caseId);
    return { result, set, prompt };
  });
  const params = getModelBaseParams(model);

  return (
    <section className="modelDetail">
      <div className="modelDetailHero">
        <div className="modelDetailActions">
          <StatusPill status={model.status} />
          <button type="button" onClick={onBack}>返回</button>
        </div>
        <div className="modelDetailCover">
          {model.media.includes('video') ? (
            <video src={model.coverUrl} autoPlay muted loop playsInline />
          ) : (
            <img src={model.coverUrl} alt={`${model.name} cover`} />
          )}
        </div>
        <div className="modelDetailIntro">
          <div>
            <span>{model.modelType} · {formatTasks(model.tasks)}</span>
            <h2>{model.name}</h2>
          </div>
          <div className="modelBaseParams">
            <div>
              <span>入参形式</span>
              <strong>{params.input}</strong>
            </div>
            <div>
              <span>输出规格</span>
              <strong>{params.output}</strong>
            </div>
            <div>
              <span>默认参数</span>
              <strong>{params.defaultParam}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="modelDetailGrid">
        <article>
          <span>模型信息</span>
          <div className="detailChips">
            <b>{formatMedia(model.media)}</b>
            <b>性能 {model.performance}</b>
            <b>成本 {model.cost}</b>
            <b>{model.apiMode}</b>
          </div>
        </article>
        <article>
          <span>能力标签</span>
          <div className="detailChips muted">
            {model.tags.map((tag) => (
              <b key={tag}>{tag}</b>
            ))}
          </div>
        </article>
        <article>
          <span>使用限制</span>
          <p>{model.limits.join('；')}</p>
        </article>
        <article>
          <span>历史表现</span>
          <strong>{modelResults.length ? `${avgScore.toFixed(1)} / 5` : '暂无评分'}</strong>
          <p>{modelResults.length ? `基于 ${modelResults.length} 条已沉淀测试结果。` : '建议先在一键试跑或评测题库中补充结果。'}</p>
        </article>
      </div>

      <section className="modelStrengthBoard">
        <article>
          <span>优势场景</span>
          <ul>
            {model.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article>
          <span>使用注意</span>
          <ul>
            {model.limits.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="modelEvidence">
        <div className="rowBetween">
          <h3>相关评测证据</h3>
          <span>{evidence.length} cases</span>
        </div>
        <div className="modelEvidenceList">
          {evidence.length === 0 && <EmptyState text="暂无历史评测证据。" />}
          {evidence.map(({ result, set, prompt }) => (
            <button key={result.id} type="button" onClick={() => set && onEvidenceClick(set.id, prompt?.id)}>
              <div>
                <strong>{set?.title ?? '历史评测'}</strong>
                <span>{prompt?.title ?? result.caseId}</span>
              </div>
              <b>{result.score.toFixed(1)}</b>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}

function RecommendationCard({
  rank,
  item,
  onEvidenceClick,
  onOpenModel,
}: {
  rank: number;
  item: ReturnType<typeof recommendModels>[number];
  onEvidenceClick: (evidence: ReturnType<typeof recommendModels>[number]['evidence'][number]) => void;
  onOpenModel: () => void;
}) {
  return (
    <article className="recommendCard" role="button" tabIndex={0} onClick={onOpenModel} onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') onOpenModel();
    }}>
      <div className="recommendBody">
        <div className="recommendHead">
          <div>
            <span className="rank">{rank}</span>
            <strong>{item.model.name}</strong>
          </div>
          <span className="recommendScore">{item.score} 匹配分</span>
        </div>
        <p>{item.reason}</p>
        <div className="evidence">
          {item.evidence.map((evidence) => (
            <button key={evidence.label} type="button" disabled={!evidence.setId} onClick={(event) => {
              event.stopPropagation();
              onEvidenceClick(evidence);
            }}>
              {evidence.label}
            </button>
          ))}
        </div>
        <small>使用注意：{item.risk}</small>
      </div>
      <ChevronRight size={18} />
    </article>
  );
}

function DemandInsights({ insights }: { insights: ReturnType<typeof analyzeDemand> }) {
  return (
    <section className="demandInsights">
      <div className="insightHeader">
        <strong>需求解析</strong>
        <span>{insights.confidence}</span>
      </div>
      <div className="insightGrid">
        <div>
          <span>媒体类型</span>
          <strong>{insights.media.join(' / ')}</strong>
        </div>
        <div>
          <span>任务类型</span>
          <strong>{insights.tasks.join(' / ')}</strong>
        </div>
      </div>
      <div className="focusList">
        <span>重点考点</span>
        <div>
          {insights.focus.map((point) => (
            <b key={point}>{point}</b>
          ))}
        </div>
      </div>
      <p>{insights.summary}</p>
    </section>
  );
}

function VerdictPill({ verdict }: { verdict: Verdict }) {
  return <span className={`pill verdict ${verdict}`}>{verdict}</span>;
}

function StatusPill({ status }: { status: Model['status'] }) {
  return <span className={`pill status ${status}`}>{status}</span>;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty">
      <Send size={22} />
      <span>{text}</span>
    </div>
  );
}

function recommendModels(needText: string, allResults: TestResult[]) {
  const tokens = needText.toLowerCase();
  return models
    .map((model) => {
      const keywordHits = model.tags.filter((tag) => needText.includes(tag)).length;
      const mediaHits = (tokens.includes('视频') && model.media.includes('video') ? 2 : 0) + (tokens.includes('图') && model.media.includes('image') ? 2 : 0);
      const qualityHits = ['商品', '广告', '中文', '素材', '品牌', '短视频', '海报'].filter((word) => needText.includes(word)).length;
      const modelResults = allResults.filter((result) => result.modelId === model.id && result.status === 'success');
      const avgScore = modelResults.length ? modelResults.reduce((sum, item) => sum + item.score, 0) / modelResults.length : 3;
      const recommendCount = modelResults.filter((result) => result.verdict === '推荐').length;
      const score = Math.round(keywordHits * 14 + mediaHits * 10 + qualityHits * 4 + avgScore * 12 + recommendCount * 8);
      const evidence = modelResults.slice(0, 2).map((result) => {
        const set = benchmarkSets.find((item) => item.id === result.setId);
        const prompt = set?.prompts.find((item) => item.id === result.caseId);
        return {
          label: `${set?.title ?? '历史评测'} / ${prompt?.title ?? result.caseId}`,
          setId: set?.id,
          caseId: prompt?.id,
        };
      });
      return {
        model,
        score,
        evidence: evidence.length ? evidence : [{ label: '暂无历史结果，建议先加入批量测试', setId: undefined, caseId: undefined }],
        reason: `${model.tags.slice(0, 3).join('、')}与需求匹配；历史人工结论平均 ${avgScore.toFixed(1)} 分。`,
        risk: model.limits[0],
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function analyzeDemand(text: string) {
  const lowerText = text.toLowerCase();
  const media = new Set<string>();
  const tasks = new Set<string>();
  const focus = new Set<string>();

  if (text.includes('视频') || lowerText.includes('video') || lowerText.includes('t2v') || lowerText.includes('i2v')) media.add('视频');
  if (text.includes('图') || text.includes('海报') || text.includes('素材') || lowerText.includes('image') || lowerText.includes('t2i') || lowerText.includes('i2i')) media.add('图像');
  if (media.size === 0) media.add('图像');

  if (text.includes('文生图') || lowerText.includes('t2i') || text.includes('生成图') || text.includes('海报')) tasks.add('T2I');
  if (text.includes('图生图') || lowerText.includes('i2i') || text.includes('素材') || text.includes('复用')) tasks.add('I2I');
  if (text.includes('文生视频') || lowerText.includes('t2v') || text.includes('短视频')) tasks.add('T2V');
  if (text.includes('图生视频') || lowerText.includes('i2v')) tasks.add('I2V');
  if (text.includes('编辑') || text.includes('换场景') || text.includes('局部')) tasks.add('Edit');
  if (tasks.size === 0) tasks.add(media.has('视频') ? 'T2V' : 'T2I');

  const focusRules: Array<[string[], string]> = [
    [['中文', '文字', '标题', '文案'], '文字生成'],
    [['商品', '广告', '业务', '上线', '转化', '促销'], '商业可用性'],
    [['品牌', 'logo', '素材复用', '复用'], '品牌一致性'],
    [['清晰', '质感', '细节', '保真'], '细节保真'],
    [['风格', '高级', '清爽', '潮流'], '风格控制'],
    [['镜头', '运动', '动作', '推进'], '运动合理性'],
    [['稳定', '连贯', '时序'], '时序稳定性'],
    [['主体', '一致', '保留'], '主体一致性'],
    [['安全', '合规', '风险'], '安全风险'],
  ];
  focusRules.forEach(([keywords, point]) => {
    if (keywords.some((keyword) => text.includes(keyword) || lowerText.includes(keyword))) focus.add(point);
  });
  if (focus.size === 0) ['商业可用性', '风格控制', '细节保真'].forEach((point) => focus.add(point));

  return {
    media: Array.from(media),
    tasks: Array.from(tasks),
    focus: Array.from(focus).slice(0, 6),
    confidence: text.trim().length > 80 ? '高置信' : '待补充',
    summary: '建议优先选择历史题库中覆盖这些考点的模型结果，并关注人工结论是否达到业务上线标准。',
  };
}

function formatTasks(tasks: TaskType[]) {
  const taskMap: Record<TaskType, string> = {
    文生图: 'T2I',
    图生图: 'I2I',
    文生视频: 'T2V',
    图生视频: 'I2V',
    编辑: 'Edit',
  };
  return tasks.map((task) => taskMap[task]).join(' / ');
}

function formatTask(task: TaskType) {
  return formatTasks([task]);
}

function formatMedia(media: MediaType[]) {
  const mediaMap: Record<MediaType, string> = {
    image: '图像',
    video: '视频',
  };
  return media.map((item) => mediaMap[item]).join(' + ');
}

function getSetQuestionCount(set: BenchmarkSet) {
  return set.questionCount ?? set.prompts.length;
}

function getModelBaseParams(model: Model) {
  const isVideo = model.media.includes('video');
  return {
    input: model.tasks.map(formatTask).join(' / '),
    output: isVideo ? '9:16 / 720P 默认，支持 480P-1080P' : '3:4 / 2K 默认，支持 1:1、4:3、9:16、16:9',
    defaultParam: isVideo ? '竖版视频 · 720P · 队列生成' : '图像生成 · 3:4 · 2K',
  };
}

function getHighlightTokens(focus: string[]) {
  const tokenMap: Record<string, Array<{ text: string; tone: string }>> = {
    文字生成: [
      { text: '中文短字', tone: 'violet' },
      { text: '小标题', tone: 'violet' },
      { text: '夏日音浪', tone: 'violet' },
      { text: '水光新色', tone: 'violet' },
    ],
    商业可用性: [
      { text: '广告', tone: 'lime' },
      { text: '促销', tone: 'lime' },
      { text: '社媒首图', tone: 'lime' },
      { text: 'App 下载广告', tone: 'lime' },
    ],
    品牌一致性: [
      { text: 'TikTok Shop', tone: 'cyan' },
      { text: '商品', tone: 'cyan' },
      { text: '品牌', tone: 'cyan' },
    ],
    细节保真: [
      { text: '质感', tone: 'rose' },
      { text: '瓶身', tone: 'rose' },
      { text: '比例不变', tone: 'rose' },
    ],
    风格控制: [
      { text: '风格', tone: 'violet' },
      { text: '清爽', tone: 'violet' },
      { text: '高级', tone: 'violet' },
    ],
    运动合理性: [
      { text: '镜头', tone: 'lime' },
      { text: '推进', tone: 'lime' },
      { text: '晃动', tone: 'lime' },
      { text: '动作', tone: 'lime' },
    ],
    时序稳定性: [
      { text: '5 秒', tone: 'cyan' },
      { text: '6 秒', tone: 'cyan' },
      { text: '连贯', tone: 'cyan' },
    ],
    主体一致性: [
      { text: '主体', tone: 'rose' },
      { text: '保留', tone: 'rose' },
    ],
    安全风险: [{ text: '安全', tone: 'rose' }],
  };
  const merged = focus.flatMap((point) => tokenMap[point] ?? []);
  return Array.from(new Map(merged.map((item) => [item.text, item])).values()).sort((a, b) => b.text.length - a.text.length);
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inferIssues(focus: string[], score: number) {
  if (score >= 4.3) return [];
  if (focus.includes('文字生成')) return ['文字错误'];
  if (focus.includes('运动合理性')) return ['运动不自然'];
  if (focus.includes('主体一致性')) return ['主体崩坏'];
  return ['需人工复核'];
}

function hashText(text: string) {
  return Array.from(text).reduce((sum, char) => (sum + char.charCodeAt(0) * 17) % 100000, 0);
}

function tabTitle(tab: string) {
  const titles: Record<string, string> = {
    market: '模型超市',
    library: '评测题库',
    compare: '横向对比',
    recommend: '需求匹配',
    lab: '一键试跑',
    annotate: '接入指引',
    model: '模型详情',
  };
  return titles[tab] ?? 'Model Gem';
}

function tabSlogan(tab: string) {
  const slogans: Record<string, string> = {
    market: '把模型像货架一样摊开，看效果、看考点、看合规状态。',
    library: '按业务场景沉淀 prompt、输入素材与考点结果。',
    compare: '同一组输入下横向查看不同模型的输出差异。',
    recommend: '输入业务需求，匹配可参考的模型与历史评测证据。',
    lab: '选择题目与模型，一键发起批量试跑。',
    annotate: '查看模型接入条件、owner、合规状态与下一步流程。',
    model: '查看单个模型的能力、限制、接入方式与历史证据。',
  };
  return slogans[tab] ?? '模型超市 · 评测结果 · 选型参考';
}

function shouldShowTopStats(tab: string) {
  return tab !== 'market' && tab !== 'compare' && tab !== 'lab' && tab !== 'annotate' && tab !== 'model';
}

export { App };

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import {
  sanitizeSlug,
  isSlugDuplicate,
  resolveSiteOrigin,
  resolveSeoForPath,
  generateSitemapXml,
  generateRobotsTxt
} from './src/utils/seo';
import { SlugRedirect } from './src/types';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.set('trust proxy', true);

// Ensure database path is secure within server data directory
const DATA_DIR = path.join(process.cwd(), 'server-data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    // fallback to cwd if permissions restricted
  }
}
const PERSIST_FILE_PATH = path.join(DATA_DIR, 'onival-persistent-data.json');
const LEGACY_PERSIST_FILE_PATH = path.join(process.cwd(), 'onival-persistent-data.json');
const RECEIPTS_DIR = path.join(DATA_DIR, 'receipts');
if (!fs.existsSync(RECEIPTS_DIR)) {
  try {
    fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
  } catch {
    // fallback
  }
}

// Global PII Masking Utilities
function maskPhone(p?: string): string {
  if (!p) return '';
  const clean = p.trim();
  if (clean.length >= 10) return clean.slice(0, 4) + '***' + clean.slice(-3);
  if (clean.length >= 4) return clean.slice(0, 2) + '***' + clean.slice(-2);
  return '***';
}

function maskAddr(a?: string): string {
  if (!a) return '';
  const parts = a.split(/[،,-]/);
  if (parts.length > 1) return `${parts[0].trim()}، *** (تحویل پستی)`;
  return a.slice(0, 14) + '... (تحویل پستی)';
}

// Sanitize bot API baseUrl to prevent SSRF (Server-Side Request Forgery) attacks
function sanitizeBotBaseUrl(platform: string, inputUrl?: string): string {
  if (platform === 'telegram') {
    return 'https://api.telegram.org';
  }
  if (typeof inputUrl === 'string') {
    const trimmed = inputUrl.trim().toLowerCase();
    if (trimmed.includes('tapi.bale.ai') || trimmed.includes('api.bale.ai')) {
      return 'https://tapi.bale.ai';
    }
  }
  return 'https://tapi.bale.ai';
}

// 1. Security Headers (Anti-XSS, Anti-Clickjacking, MIME-Sniffing Prevention)
app.disable('x-powered-by');
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// 2. Strict File Extension & Sensitive Path Blocker (403 Forbidden for server secrets, .env, .sql, server-data)
app.use((req: Request, res: Response, next: NextFunction) => {
  const cleanPath = (req.path || '').toLowerCase();

  // Allow essential public endpoints such as /robots.txt and /sitemap.xml
  if (cleanPath === '/robots.txt' || cleanPath === '/sitemap.xml') {
    return next();
  }

  // Allow API routes to be handled by express router
  if (cleanPath.startsWith('/api/')) {
    return next();
  }

  // Block any requests attempting to read sensitive server files, configs, databases, keys or logs
  const isBlocked =
    cleanPath.includes('server-data') ||
    cleanPath.includes('onival-persistent-data') ||
    cleanPath.includes('.session_secret') ||
    cleanPath.includes('session_secret') ||
    cleanPath.includes('.env') ||
    cleanPath.includes('.git') ||
    cleanPath.includes('.htaccess') ||
    cleanPath.includes('server.ts') ||
    cleanPath.includes('server.cjs') ||
    cleanPath.includes('bun.lock') ||
    /\.(env|sql|bak|sh)$/i.test(cleanPath);

  if (isBlocked) {
    return res.status(403).json({
      error: 'دسترسی ممنوع (403 Forbidden): امکان دریافت مستقیم فایل‌های سیستمی و دیتابیس از مرورگر وجود ندارد.'
    });
  }

  next();
});

// 3. Dynamic CORS: Allow requests from same-origin, configured APP_URL, localhost, Google Cloud Run preview, and non-browser clients
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const configuredOrigin = process.env.APP_URL?.trim();
    try {
      const parsedOrigin = new URL(origin);
      const isAllowed =
        parsedOrigin.hostname === 'localhost' ||
        parsedOrigin.hostname === '127.0.0.1' ||
        parsedOrigin.hostname === '0.0.0.0' ||
        parsedOrigin.hostname.endsWith('.run.app') ||
        parsedOrigin.hostname.endsWith('.google.com') ||
        parsedOrigin.hostname.endsWith('.aistudio.google.com') ||
        process.env.NODE_ENV !== 'production';

      if (isAllowed) {
        return callback(null, true);
      }
      if (configuredOrigin) {
        const parsedConfigured = new URL(configuredOrigin);
        if (parsedOrigin.origin === parsedConfigured.origin) {
          return callback(null, true);
        }
      }
      // Reject unauthorized external origins
      callback(null, false);
    } catch {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token']
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  const override = req.headers['x-http-method-override'] || (req.body && (req.body as any)._method);
  if (override && typeof override === 'string') {
    req.method = override.toUpperCase();
  }
  next();
});

// In-Memory Data Store replicating Onival.Domain & Onival.Infrastructure
let productCategories = [
  { id: 1, title: 'عسل‌های ارگانیک', slug: 'honey', parentId: null, sortOrder: 1 },
  { id: 2, title: 'مکمل‌های غذایی', slug: 'supplement', parentId: null, sortOrder: 2 },
  { id: 3, title: 'نوشیدنی‌ها و دمنوش', slug: 'drink', parentId: null, sortOrder: 3 },
  { id: 4, title: 'خشکبار و مغزیجات', slug: 'nuts', parentId: null, sortOrder: 4 },
];

let products = [
  {
    id: 1,
    title: 'عسل کوهستان',
    slug: 'mountain-honey',
    price: 180000,
    hasSize: true,
    sizes: [
      { name: '۲۵۰ گرم', price: 95000 },
      { name: '۵۰۰ گرم', price: 180000 },
      { name: '۱ کیلوگرم', price: 350000 }
    ],
    priceSmall: 180000,
    priceLarge: 350000,
    discount: 15,
    type: 'honey',
    categoryId: 1,
    categoryTitle: 'عسل‌های ارگانیک',
    imageName: 'https://images.unsplash.com/photo-1587049359535-b64d3dd0d716?w=800&auto=format&fit=crop&q=80',
    description: 'عسل خالص و حرارت ندیده با طعم غنی و عطر گل‌های وحشی کوهستان.',
    content: 'برداشت شده از مراتع مرتفع سبلان، کاملا خام و فیلترنشده بدون هیچ‌گونه حرارت‌دهی صنعتی.',
    features: ['ساکارز زیر ۲٪', 'برداشت پاییزه', 'کاملاً خام و بدون حرارت'],
    isDelete: false,
    creationTime: '1403/06/15'
  },
  {
    id: 2,
    title: 'ژل رویال شاهانه',
    slug: 'royal-jelly',
    price: 450000,
    hasSize: true,
    sizes: [
      { name: '۲۰ گرم (تستی)', price: 150000 },
      { name: '۵۰ گرم', price: 450000 },
      { name: '۱۰۰ گرم (ویژه)', price: 850000 }
    ],
    priceSmall: 450000,
    priceLarge: 850000,
    discount: 10,
    type: 'supplement',
    categoryId: 2,
    categoryTitle: 'مکمل‌های غذایی',
    imageName: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&auto=format&fit=crop&q=80',
    description: 'اکسیر جوانی و تقویت سیستم ایمنی بدن با خلوص صد در صد.',
    content: 'ژل رویال خالص برداشت شده از کندوهای اختصاصی، ارائه‌شده در بسته‌بندی ایزوله یخچالی.',
    features: ['خالص ۱۰۰٪', 'نگهداری سرد', 'سرشار از اسیدهای چرب 10-HDA'],
    isDelete: false,
    creationTime: '1403/06/18'
  },
  {
    id: 3,
    title: 'گرده گل زنبور',
    slug: 'bee-pollen',
    price: 120000,
    hasSize: true,
    sizes: [
      { name: '۱۵۰ گرم', price: 75000 },
      { name: '۳۰۰ گرم', price: 120000 },
      { name: '۶۰۰ گرم', price: 230000 }
    ],
    priceSmall: 120000,
    priceLarge: 230000,
    discount: 20,
    type: 'supplement',
    categoryId: 2,
    categoryTitle: 'مکمل‌های غذایی',
    imageName: 'https://images.unsplash.com/photo-1541014741259-de529411b96a?w=800&auto=format&fit=crop&q=80',
    description: 'مولتی‌ویتامین طبیعی برای ورزشکاران، افزایش انرژی روزانه و بهبود گوارش.',
    content: 'گرده گل رنگارنگ بهاره، خشک‌شده با سیستم هوای غیرحرارتی به منظور حفظ کلیه ویتامین‌ها و آمینواسیدها.',
    features: ['پروتئین گیاهی بالا', 'خشک‌شده طبیعی', 'انرژی‌بخش و مقوی'],
    isDelete: false,
    creationTime: '1403/06/20'
  },
  {
    id: 4,
    title: 'دمنوش آرامش',
    slug: 'calm-herbal-tea',
    price: 60000,
    hasSize: true,
    sizes: [
      { name: 'بسته ۱۰ عددی', price: 35000 },
      { name: 'بسته ۲۰ عددی', price: 60000 },
      { name: 'بسته ۴۰ عددی', price: 110000 }
    ],
    priceSmall: 60000,
    priceLarge: 110000,
    discount: 0,
    type: 'drink',
    categoryId: 3,
    categoryTitle: 'نوشیدنی‌ها و دمنوش',
    imageName: 'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=800&auto=format&fit=crop&q=80',
    description: 'ترکیب گل گاوزبان، سنبل‌الطیب، به‌لیمو و لیمو امانی برای کاهش استرس روزانه.',
    content: 'مخلوطی دست‌چین و معطر از گیاهان دارویی خودرو دامنه‌های البرز.',
    features: ['آرام‌بخش طبیعی', 'بدون کافئین', 'تسکین‌دهنده اعصاب'],
    isDelete: false,
    creationTime: '1403/06/21'
  },
  {
    id: 5,
    title: 'شربت سکنجبین سنتی',
    slug: 'sekanjabin-syrup',
    price: 85000,
    hasSize: true,
    sizes: [
      { name: 'نیم لیتری', price: 85000 },
      { name: 'یک لیتری', price: 160000 },
      { name: 'دو لیتری اقتصادی', price: 290000 }
    ],
    priceSmall: 85000,
    priceLarge: 160000,
    discount: 5,
    type: 'drink',
    categoryId: 3,
    categoryTitle: 'نوشیدنی‌ها و دمنوش',
    imageName: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800&auto=format&fit=crop&q=80',
    description: 'نوشیدنی سنتی با نعناع تازه و عسل طبیعی، تصفیه‌کننده کبد و خنک‌کننده گوارش.',
    content: 'تهیه شده با سرکه سیب ارگانیک و عسل کوهستان بدون ذره‌ای شکر سفید صنعتی.',
    features: ['تصفیه‌کننده کبد', 'شیرین‌شده با عسل طبیعی', 'طبع معتدل'],
    isDelete: false,
    creationTime: '1403/06/22'
  },
  {
    id: 6,
    title: 'مغز گردو تویسرکان',
    slug: 'walnut-kernels',
    price: 170000,
    hasSize: true,
    sizes: [
      { name: '۲۵۰ گرم', price: 90000 },
      { name: '۵۰۰ گرم', price: 170000 },
      { name: '۱ کیلوگرم', price: 320000 }
    ],
    priceSmall: 170000,
    priceLarge: 320000,
    discount: 0,
    type: 'nuts',
    categoryId: 4,
    categoryTitle: 'خشکبار و مغزیجات',
    imageName: 'https://images.unsplash.com/photo-1563539973273-0472460e5362?w=800&auto=format&fit=crop&q=80',
    description: 'گردوی تویسرکان سفید، تازه و پرچرب دست‌چین امسال.',
    content: 'مغز گردوی پوست‌کاغذی با درصد چربی امگا ۳ فوق‌العاده بالا مناسب صبحانه و تغذیه سالم.',
    features: ['پوست کاغذی', 'دستچین شده امسال', 'بدون نمک و تازه'],
    isDelete: false,
    creationTime: '1403/06/23'
  },
  {
    id: 7,
    title: 'عسل با موم طبیعی',
    slug: 'comb-honey',
    price: 200000,
    hasSize: true,
    sizes: [
      { name: '۵۰۰ گرم', price: 200000 },
      { name: '۱ کیلوگرم', price: 380000 },
      { name: '۲ کیلوگرم (قاب کامل)', price: 720000 }
    ],
    priceSmall: 200000,
    priceLarge: 380000,
    discount: 0,
    type: 'honey',
    categoryId: 1,
    categoryTitle: 'عسل‌های ارگانیک',
    imageName: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=800&auto=format&fit=crop&q=80',
    description: 'عسل همراه موم طبیعی خودبافت، مناسب سلامت معده و ضد التهاب سینوس‌ها.',
    content: 'شان طبیعی بدون برگه موم مصنوعی، بافته شده کاملاً توسط زنبور عسل در کوهپایه.',
    features: ['مناسب سلامت معده', 'موم خودبافت طبیعی', 'طعم و عطر بهشتی'],
    isDelete: false,
    creationTime: '1403/06/24'
  }
];

let postCategories = [
  { id: 1, title: 'راهنمای خرید عسل', slug: 'honey-guide', parentId: null },
  { id: 2, title: 'تغذیه و سبک زندگی سالم', slug: 'healthy-diet', parentId: null },
  { id: 3, title: 'دمنوش و نوشیدنی‌های طبیعی', slug: 'herbal-drinks', parentId: null }
];

let posts = [
  {
    id: 1,
    title: 'چطور عسل ارگانیک را از عسل تقلبی تشخیص دهیم؟',
    slug: 'detect-organic-honey-from-fake',
    categoryId: 1,
    categoryTitle: 'راهنمای خرید عسل',
    description: 'نشانه‌های ظاهری، برچسب استاندارد و نتایج آزمایشگاهی عسل‌های طبیعی برای خریدی مطمئن.',
    content: 'در این مطلب درباره نشانه‌های ظاهری مانند رس‌بستن (شکرک زدن طبیعی عسل خالص)، میزان کشسانی، برچسب استاندارد آزمایشگاهی (ساکارز و پرولین) صحبت می‌کنیم تا هنگام خرید عسل ارگانیک انتخاب مطمئن‌تری داشته باشید.',
    imageName: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&auto=format&fit=crop&q=80',
    viewCount: 420,
    authorName: 'کارشناس زنبورداران',
    creationTime: '1403/06/10'
  },
  {
    id: 2,
    title: '۵ دلیل علمی برای انتخاب محصولات ارگانیک در سبد غذایی',
    slug: '5-reasons-for-organic-foods',
    categoryId: 2,
    categoryTitle: 'تغذیه و سبک زندگی سالم',
    description: 'کاهش سموم دفع آفات، تراکم بیشتر آنتی‌اکسیدان‌ها و تقویت ایمنی با مصرف خوراکی‌های پاک.',
    content: 'پژوهش‌های متعدد نشان می‌دهند محصولات ارگانیک فاقد سموم شیمیایی آفت‌کش بوده و از نظر غلظت ترکیبات آنتی‌اکسیدانی تا ۴۰ درصد غنی‌تر از محصولات کشت صنعتی هستند.',
    imageName: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
    viewCount: 315,
    authorName: 'مشاور تغذیه ارگانیک',
    creationTime: '1403/06/14'
  },
  {
    id: 3,
    title: 'بهترین دمنوش‌های گیاهی برای کاهش استرس روزانه',
    slug: 'best-herbal-teas-for-stress',
    categoryId: 3,
    categoryTitle: 'دمنوش و نوشیدنی‌های طبیعی',
    description: 'آشنایی با خواص گل‌گاوزبان، سنبل‌الطیب، به‌لیمو و ترکیب معجزه‌آسای آن‌ها با عسل طبیعی.',
    content: 'زندگی پرمشغله امروزی نیاز به آرامش‌بخش‌های طبیعی دارد. ترکیب دم‌کرده سنبل‌الطیب با یک قاشق عسل کوهستان در پایان روز، سیستم عصبی پاراسمپاتیک را تقویت کرده و خواب عمیقی ایجاد می‌کند.',
    imageName: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&auto=format&fit=crop&q=80',
    viewCount: 290,
    authorName: 'پژوهشگر طب سنتی',
    creationTime: '1403/06/19'
  }
];

let contactMessages = [
  {
    id: 1,
    fullName: 'امیرحسین رضایی',
    phoneNumber: '09123456789',
    trackingCode: 'ONV-9421',
    message: 'سلام، آیا امکان آسیاب سفارشی برای دستگاه موکاپات در هنگام ارسال سفارش وجود دارد؟',
    adminResponse: 'درود بر شما، بله در بخش توضیحات سفارش می‌توانید نوع دستگاه خود را قید فرمایید تا بر همان اساس آسیاب شود.',
    isRead: true,
    isResponded: true,
    creationTime: '1403/06/20 - 14:30',
    respondedAt: '1403/06/20 - 16:15'
  },
  {
    id: 2,
    fullName: 'سارا کاظمی',
    phoneNumber: '09351112233',
    trackingCode: 'ONV-8814',
    message: 'بسته‌بندی دانه‌ها دارای سوپاپ تخلیه گاز دی‌اکسید کربن هست یا نه؟ ممنون از پاسخگویی شما.',
    adminResponse: undefined,
    isRead: false,
    isResponded: false,
    creationTime: '1403/06/23 - 10:15'
  },
  {
    id: 3,
    fullName: 'مهدی حسینی (کاربر بله/تلگرام)',
    phoneNumber: '09198765432',
    trackingCode: 'ONV-7703',
    message: 'سلام از طریق ربات بله پیام می‌دم. زمان تقریبی رسیدن سفارش شماره ONV-ORD-101 کی هست؟',
    adminResponse: undefined,
    isRead: true,
    isResponded: false,
    creationTime: '1403/06/24 - 18:05'
  },
  {
    id: 4,
    fullName: 'مریم شریفی',
    phoneNumber: '09124455667',
    trackingCode: 'ONV-CNS-405',
    message: '[رزرو مشاوره تخصصی - موضوع: دوز مصرف و دوره درمانی ژل رویال و گرده گل]\n📅 زمان انتخابی: فردا | نوبت عصر (۱۶:۰۰ الی ۱۹:۰۰)\n📱 شبکه اجتماعی انتخابی: پیام‌رسان بله (Bale) - آیدی/شماره: @maryam_sh\n💳 هزینه مشاوره: ۱۵۰,۰۰۰ تومان\n📝 شرح پرسش: برای تقویت سیستم ایمنی و رفع خستگی مزمن چه دوزی از ژل رویال و گرده گل را پیشنهاد می‌کنید؟',
    adminResponse: undefined,
    isRead: false,
    isResponded: false,
    creationTime: '1403/06/25 - 11:20',
    isConsultation: true,
    orderId: 103,
    paymentStatus: 'PendingVerification',
    paymentMethod: 'card_to_card',
    totalPrice: 150000,
    consultationDetails: {
      topicId: 'topic-2',
      topicTitle: 'دوز مصرف و دوره درمانی ژل رویال و گرده گل',
      preferredDate: 'فردا',
      preferredTimeSlot: 'نوبت عصر (۱۶:۰۰ الی ۱۹:۰۰)',
      socialPlatform: 'پیام‌رسان بله (Bale)',
      socialContactId: '@maryam_sh',
      price: 150000,
      durationMinutes: 40,
      question: 'برای تقویت سیستم ایمنی و رفع خستگی مزمن چه دوزی از ژل رویال و گرده گل را پیشنهاد می‌کنید؟',
      consultationStatus: 'PendingVerification'
    }
  }
];

let orders: any[] = [
  {
    id: 101,
    userFullName: 'نیما علوی',
    phoneNumber: '09121234567',
    userAddress: 'تهران، خیابان ولیعصر، نرسیده به میدان ونک، پلاک ۴۲، واحد ۳',
    totalPrice: 800000,
    status: 'Processing',
    paymentStatus: 'Paid',
    trackingCode: 'ONV-ORD-101',
    creationTime: '1403/06/23',
    balePaymentUrl: 'https://ble.ir/onival_bot?start=pay_ONV-ORD-101',
    items: [
      {
        id: 1,
        productId: 1,
        productName: 'عسل کوهستان اونیوال',
        size: '۱ کیلوگرم',
        quantity: 1,
        unitPrice: 350000,
        totalPrice: 350000
      },
      {
        id: 2,
        productId: 2,
        productName: 'ژل رویال شاهانه اونیوال',
        size: '۵۰ گرم',
        quantity: 1,
        unitPrice: 450000,
        totalPrice: 450000
      }
    ]
  },
  {
    id: 102,
    userFullName: 'فاطمه موسوی',
    phoneNumber: '09369874521',
    userAddress: 'اصفهان، خیابان چهارباغ عباسی، کوچه فردوسی، پلاک ۱۸',
    totalPrice: 380000,
    status: 'Shipped',
    paymentStatus: 'Paid',
    trackingCode: 'ONV-ORD-102',
    creationTime: '1403/06/24',
    balePaymentUrl: 'https://ble.ir/onival_bot?start=pay_ONV-ORD-102',
    items: [
      {
        id: 3,
        productId: 7,
        productName: 'عسل با موم طبیعی اونیوال',
        size: '۱ کیلوگرم',
        quantity: 1,
        unitPrice: 380000,
        totalPrice: 380000
      }
    ]
  },
  {
    id: 103,
    userFullName: 'مریم شریفی',
    phoneNumber: '09124455667',
    userAddress: 'مشاوره آنلاین در پیام‌رسان بله (Bale) | آیدی/شماره: @maryam_sh | زمان: فردا - نوبت عصر (۱۶:۰۰ الی ۱۹:۰۰)',
    totalPrice: 150000,
    status: 'Pending',
    paymentStatus: 'Unpaid',
    paymentMethod: 'card_to_card',
    trackingCode: 'ONV-CNS-405',
    creationTime: '1403/06/25',
    balePaymentUrl: 'https://ble.ir/onival_bot?start=pay_ONV-CNS-405',
    isConsultation: true,
    consultationDetails: {
      topicId: 'topic-2',
      topicTitle: 'دوز مصرف و دوره درمانی ژل رویال و گرده گل',
      preferredDate: 'فردا',
      preferredTimeSlot: 'نوبت عصر (۱۶:۰۰ الی ۱۹:۰۰)',
      socialPlatform: 'پیام‌رسان بله (Bale)',
      socialContactId: '@maryam_sh',
      price: 150000,
      durationMinutes: 40,
      question: 'برای تقویت سیستم ایمنی و رفع خستگی مزمن چه دوزی از ژل رویال و گرده گل را پیشنهاد می‌کنید؟',
      consultationStatus: 'PendingPayment'
    },
    items: [
      {
        id: 1,
        productId: 9002,
        productName: 'رزرو مشاوره تخصصی: دوز مصرف و دوره درمانی ژل رویال و گرده گل',
        size: 'فردا | نوبت عصر (۱۶:۰۰ الی ۱۹:۰۰) - پیام‌رسان بله',
        quantity: 1,
        unitPrice: 150000,
        totalPrice: 150000
      }
    ]
  }
];

// Configuration for Bale Bot, Telegram Bot & Omnichannel Support
let telegramConfig: any = {
  // Two-Bot Dedicated Architecture:
  // 1) Customer & Payment Bot (ربات اختصاصی مشتری و پرداخت)
  customerBotToken: '',
  customerBotUsername: '',
  customerBotEnabled: true,
  customerBotWebhookUrl: '',

  // 2) Admin & Management Bot (ربات اختصاصی ادمین و مدیریت فروش)
  adminBotToken: '',
  adminBotUsername: '',
  adminChatId: '',
  adminBotEnabled: true,
  adminBotWebhookUrl: '',

  // Primary / Bale Bot compatibility fields
  botToken: '',
  botUsername: '',
  baseUrl: 'https://tapi.bale.ai',
  panelBaseUrl: 'http://localhost:3000',
  antiSpamSeconds: 5,
  active: true,

  // Explicit Bale Bot Settings
  baleEnabled: true,
  baleBotToken: '',
  baleAdminChatId: '',
  baleAdminUsername: '',
  baleBotUsername: '',
  baleBaseUrl: 'https://tapi.bale.ai',
  baleWebhookUrl: '',
  balePaymentMode: 'live',
  balePaymentTokenTest: '',
  balePaymentTokenLive: '',
  balePaymentToken: '',
  baleAutoSendInvoice: true,
  baleAutoNotifyAdminAllTransactions: true,
  baleAdminDirectApproval: true,

  // Explicit Telegram Bot Settings
  telegramEnabled: true,
  telegramBotEnabled: true,
  telegramBotToken: '',
  telegramAdminChatId: '',
  telegramBotUsername: '',
  telegramBaseUrl: 'https://api.telegram.org',
  telegramWebhookUrl: '',
  webhookSecretToken: '',

  // Customer Support Channels & Floating Support Widget
  baleSupportId: '@onival_bale_support',
  baleSupportUsername: 'onival_bale_support',
  baleChannelId: '@onival_bale',
  telegramSupportId: '@onival_support',
  telegramSupportUsername: 'onival_support',
  telegramChannelId: '@onival_official',
  instagramId: '@onival.ir',
  whatsappNumber: '09123456789',
  eitaaSupportId: '@onival_eitaa',
  rubikaSupportId: '@onival_rubika',
  supportPhone: '۰۲۱-۱۲۳۴۵۶۷۸ / ۰۹۱۲۳۴۵۶۷۸۹',
  supportEmail: 'support@onival.ir',
  workingHours: 'شنبه تا پنج‌شنبه ۹:۰۰ الی ۲۱:۰۰',
  supportHours: 'شنبه تا پنج‌شنبه ۹:۰۰ الی ۲۱:۰۰',
  autoReplyEnabled: true,
  floatingWidgetEnabled: true,
  floatingWidgetTitle: 'پشتیبانی آنلاین و مشاوره اونیوال',
  floatingWidgetWelcome: 'سلام! 👋 چطور می‌توانیم در انتخاب محصولات ارگانیک یا پیگیری سفارش به شما کمک کنیم؟',

  // Automated Notification Triggers
  notifyOnNewOrder: true,
  notifyOnReceiptUpload: true,
  notifyOnNewTicket: true,
  notifyOnPaymentSuccess: true,
  notifyCustomerOnStatusChange: true,

  // Customizable Bot Message Templates
  welcomeTemplate: 'به ربات رسمی فروشگاه تخصصی اونیوال (ONIVAL) خوش آمدید! 🍯\nاز طریق این ربات می‌توانید فاکتورهای خود را پرداخت کنید و وضعیت سفارش را لحظه‌ای پیگیری نمایید.',
  orderInvoiceTemplate: '🧾 فاکتور جدید #{trackingCode}\n👤 مشتری: {customerName}\n📞 تماس: {phone}\n💳 مبلغ کل: {amount} تومان\n📍 آدرس: {address}',
  receiptApprovedTemplate: '✅ فیش واریزی سفارش #{trackingCode} توسط مدیریت تایید شد و مرسوله شما وارد مرحله بسته‌بندی و ارسال گردید.',
  supportReplyTemplate: '💬 پاسخ پشتیبانی اونیوال به پیام #{trackingCode}:\n{response}'
};

let botActivityLogs: any[] = [
  { id: 1, time: '14:30', type: 'incoming_message', platform: 'bale', text: 'پیام جدید از کاربر با شناسه ۹۲۳۳۸۷۷۹۶ (کد رهگیری: ONV-9421)', status: 'success' },
  { id: 2, time: '16:15', type: 'admin_response', platform: 'telegram', text: 'پاسخ مدیر به کد پیگیری ONV-9421 در بله و تلگرام ارسال گردید.', status: 'success' },
  { id: 3, time: '18:05', type: 'bot_query', platform: 'bale', text: 'استعلام وضعیت سفارش ONV-ORD-101 از طریق ربات بله دریافت شد.', status: 'success' }
];

// Helper functions for Two-Bot Dedicated Architecture
function getCustomerBotToken(): string {
  return (telegramConfig.customerBotToken || telegramConfig.baleBotToken || telegramConfig.botToken || '').trim();
}
function getCustomerBotUsername(): string {
  return (telegramConfig.customerBotUsername || telegramConfig.baleBotUsername || telegramConfig.botUsername || 'Onivalbot').replace(/^@/, '').trim();
}
function getAdminBotToken(): string {
  return (telegramConfig.adminBotToken || telegramConfig.baleBotToken || telegramConfig.botToken || '').trim();
}
function getAdminBotUsername(): string {
  return (telegramConfig.adminBotUsername || telegramConfig.baleBotUsername || 'OnivalAdminBot').replace(/^@/, '').trim();
}
function getAdminChatId(): string {
  return String(telegramConfig.adminChatId || telegramConfig.baleAdminChatId || '').trim();
}

// Helpers for Bale Bot API & Omnichannel Support
function getActiveBaleWalletToken(): string {
  if (telegramConfig.balePaymentMode === 'test') {
    return (telegramConfig.balePaymentTokenTest || 'WALLET-TEST-1111111111111111').trim();
  }
  return (telegramConfig.balePaymentTokenLive || telegramConfig.balePaymentToken || 'WALLET-TEST-1111111111111111').trim();
}

async function sendBaleMessage(
  baseUrl: string,
  token: string,
  chatId: string | number,
  text: string,
  replyMarkup?: any
) {
  if (!token || !chatId || !text) {
    return { ok: false, error: 'پارامترهای ارسالی پیام نامعتبر است' };
  }
  const cleanBase = baseUrl.replace(/\/+$/, '');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const bodyPayload: any = { chat_id: chatId, text };
    if (replyMarkup) {
      bodyPayload.reply_markup = replyMarkup;
    }
    const res = await fetch(`${cleanBase}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal
    });
    clearTimeout(timer);
    const data: any = await res.json().catch(() => ({ ok: false }));
    if (res.ok && data?.ok) {
      return { ok: true, status: res.status, result: data.result };
    }

    if (res.status === 401) {
      return { ok: false, status: 401, error: 'توکن ربات نامعتبر است (401 Unauthorized)' };
    }

    // If failed and replyMarkup was passed, fallback to plain text (Bale keyboard structure fallback)
    if (replyMarkup && res.status !== 401 && res.status !== 403) {
      console.warn('[Bale Bot] sendMessage with replyMarkup rejected, falling back to plain text:', data?.description || res.status);
      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), 4000);
      const res2 = await fetch(`${cleanBase}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
        signal: controller2.signal
      });
      clearTimeout(timer2);
      const data2: any = await res2.json().catch(() => ({ ok: false }));
      return { ok: Boolean(res2.ok && data2?.ok), status: res2.status, result: data2?.result, error: data2?.description };
    }

    return { ok: false, status: res.status, error: data?.description || 'عدم پذیرش پیام توسط وب‌سرویس بله' };
  } catch (err: any) {
    if (replyMarkup) {
      try {
        const res3 = await fetch(`${cleanBase}/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text })
        });
        const d3: any = await res3.json().catch(() => null);
        return { ok: Boolean(res3.ok && d3?.ok), result: d3?.result };
      } catch {
        // ignore
      }
    }
    return { ok: false, error: err?.message };
  }
}

async function sendBalePhoto(
  baseUrl: string,
  token: string,
  chatId: string | number,
  photo: string,
  caption?: string,
  replyMarkup?: any
) {
  if (!token || !chatId || !photo) {
    return { ok: false, error: 'پارامترهای ارسالی عکس نامعتبر است' };
  }
  const cleanBase = baseUrl.replace(/\/+$/, '');
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const bodyPayload: any = {
      chat_id: isNaN(Number(chatId)) ? chatId : Number(chatId),
      photo,
      caption: caption ? caption.slice(0, 1024) : undefined
    };
    if (replyMarkup) {
      bodyPayload.reply_markup = replyMarkup;
    }
    const res = await fetch(`${cleanBase}/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal
    });
    clearTimeout(timer);
    const data: any = await res.json().catch(() => ({ ok: false }));
    return { ok: Boolean(res.ok && data?.ok), status: res.status, result: data?.result, error: data?.description };
  } catch (err: any) {
    return { ok: false, error: err?.message };
  }
}

async function sendBaleInvoice(params: {
  baseUrl: string;
  token: string;
  chatId: string | number;
  title: string;
  description: string;
  payload: string;
  providerToken: string;
  totalPriceRial: number;
  startParameter?: string;
}) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const body = {
      chat_id: params.chatId,
      title: params.title.slice(0, 32),
      description: params.description.slice(0, 255),
      payload: params.payload,
      provider_token: params.providerToken,
      start_parameter: (params.startParameter || params.payload).slice(0, 64),
      currency: 'IRR',
      prices: [
        {
          label: params.title.slice(0, 32),
          amount: Math.round(params.totalPriceRial)
        }
      ]
    };
    const res = await fetch(`${params.baseUrl.replace(/\/+$/, '')}/bot${params.token}/sendInvoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timer);
    const data: any = await res.json().catch(() => ({ ok: false }));
    return { ok: Boolean(res.ok && data?.ok), status: res.status, data };
  } catch (err: any) {
    return { ok: false, status: 500, error: err?.message };
  }
}

// Helper to dispatch real HTTP notifications to Bale and/or Telegram bots
async function dispatchBotNotification(text: string, eventType: string) {
  const nowTime = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const results: { platform: string; ok: boolean; detail: string }[] = [];

  // 1. Send to Admin Bot (Bale Dedicated Admin Bot)
  const baleActive = telegramConfig.adminBotEnabled ?? telegramConfig.baleEnabled ?? telegramConfig.active;
  const adminToken = getAdminBotToken();
  const adminChat = getAdminChatId();
  const baleBase = sanitizeBotBaseUrl('bale', telegramConfig.baleBaseUrl || telegramConfig.baseUrl || 'https://tapi.bale.ai').replace(/\/+$/, '');

  if (baleActive && adminToken && adminChat) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${baleBase}/bot${adminToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: adminChat, text }),
        signal: controller.signal
      });
      clearTimeout(timer);
      const data: any = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        results.push({ platform: 'bale_admin', ok: true, detail: `ارسال موفق به ربات ادمین بله (شناسه چت: ${adminChat})` });
        botActivityLogs.unshift({
          id: Date.now(),
          time: nowTime,
          type: 'admin_notification_sent',
          platform: 'bale',
          text: `اعلان «${eventType}» با موفقیت توسط ربات ادمین (@${getAdminBotUsername()}) به چت ${adminChat} ارسال شد.`,
          status: 'success',
          rawPayload: { adminChat, eventType, text: text.slice(0, 160) },
          rawResponse: data
        });
        savePersistedState();
      } else {
        const desc = data?.description || `HTTP ${res.status}`;
        results.push({ platform: 'bale_admin', ok: false, detail: desc });
        botActivityLogs.unshift({
          id: Date.now(),
          time: nowTime,
          type: 'admin_notification_failed',
          platform: 'bale',
          text: `خطا در ارسال اعلان «${eventType}» به ربات ادمین: ${desc}`,
          status: 'warning',
          rawPayload: { adminChat, eventType },
          rawResponse: data
        });
      }
    } catch (err: any) {
      results.push({ platform: 'bale_admin', ok: false, detail: err?.message || 'خطای شبکه' });
    }
  }

  // 2. Send to Telegram Bot if enabled
  const tgActive = telegramConfig.telegramBotEnabled ?? telegramConfig.telegramEnabled;
  const tgToken = (telegramConfig.telegramBotToken || '').trim();
  const tgChat = (telegramConfig.telegramAdminChatId || telegramConfig.adminChatId || '').trim();
  const tgBase = sanitizeBotBaseUrl('telegram', telegramConfig.telegramBaseUrl || 'https://api.telegram.org').replace(/\/+$/, '');

  if (tgActive && tgToken && tgChat) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${tgBase}/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChat, text }),
        signal: controller.signal
      });
      clearTimeout(timer);
      const data: any = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        results.push({ platform: 'telegram', ok: true, detail: `ارسال واقعی به تلگرام (Message ID: ${data.result?.message_id || 'OK'})` });
      } else {
        results.push({ platform: 'telegram', ok: false, detail: data?.description || `HTTP ${res.status}` });
      }
    } catch (err: any) {
      results.push({ platform: 'telegram', ok: false, detail: err?.message || 'خطای شبکه' });
    }
  }

  return results;
}

// ================= ADMIN SECURITY, TOKEN SECRET & CRYPTOGRAPHIC HASHING =================
const SESSION_SECRET_FILE = path.join(DATA_DIR, '.session_secret');
function getAdminTokenSecret(): string {
  if (process.env.ADMIN_TOKEN_SECRET && process.env.ADMIN_TOKEN_SECRET.trim().length >= 16) {
    return process.env.ADMIN_TOKEN_SECRET.trim();
  }
  try {
    if (fs.existsSync(SESSION_SECRET_FILE)) {
      const existing = fs.readFileSync(SESSION_SECRET_FILE, 'utf-8').trim();
      if (existing.length >= 32) return existing;
    }
    const fresh = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SESSION_SECRET_FILE, fresh, { encoding: 'utf-8', mode: 0o600 });
    return fresh;
  } catch {
    // Generate fresh random 32-byte secret in memory if filesystem is non-writable, never a predictable static key
    return crypto.randomBytes(32).toString('hex');
  }
}
const ADMIN_TOKEN_SECRET = getAdminTokenSecret();

// Hash password with scrypt + 16-byte random salt
function hashPasswordWithScrypt(password: string, saltHex?: string): string {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const hash = crypto.scryptSync(password.trim(), salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

// Backward compatibility helper
function hashPassword(password: string): string {
  return hashPasswordWithScrypt(password);
}

// Timing-safe password verification preventing timing-based attacks
function verifyAdminPassword(inputPassword: string, storedPasswordOrHash: string): boolean {
  if (!inputPassword || !storedPasswordOrHash) return false;
  const trimmedInput = inputPassword.trim();
  const trimmedStored = storedPasswordOrHash.trim();

  // 1. Scrypt format: scrypt:<saltHex>:<hashHex>
  if (trimmedStored.startsWith('scrypt:')) {
    const parts = trimmedStored.split(':');
    if (parts.length === 3) {
      try {
        const saltBuf = Buffer.from(parts[1], 'hex');
        const expectedHashBuf = Buffer.from(parts[2], 'hex');
        const computedHash = crypto.scryptSync(trimmedInput, saltBuf, 64);
        if (computedHash.length === expectedHashBuf.length) {
          return crypto.timingSafeEqual(computedHash, expectedHashBuf);
        }
      } catch {
        return false;
      }
    }
    return false;
  }

  // 2. Legacy HMAC SHA-256 match
  const legacyHash = crypto.createHmac('sha256', 'onival_salt_2025_sec').update(trimmedInput).digest('hex');
  if (legacyHash.length === trimmedStored.length) {
    try {
      if (crypto.timingSafeEqual(Buffer.from(legacyHash), Buffer.from(trimmedStored))) {
        return true;
      }
    } catch {
      // continue
    }
  }

  // 3. Direct plaintext match (timing-safe)
  const inputBuf = Buffer.from(trimmedInput);
  const storedBuf = Buffer.from(trimmedStored);
  if (inputBuf.length === storedBuf.length) {
    try {
      return crypto.timingSafeEqual(inputBuf, storedBuf);
    } catch {
      return false;
    }
  }

  return false;
}

// Dynamic Site Public URL resolver without any hardcoded external test hosts
function getSitePublicUrl(): string {
  if (telegramConfig?.panelBaseUrl && !telegramConfig.panelBaseUrl.includes('localhost') && !telegramConfig.panelBaseUrl.includes('ais-dev')) {
    return telegramConfig.panelBaseUrl.replace(/\/+$/, '');
  }
  if (process.env.APP_URL && process.env.APP_URL.trim() !== '') {
    return process.env.APP_URL.trim().replace(/\/+$/, '');
  }
  return `http://localhost:${PORT}`;
}

const INITIAL_SETUP_OTP = 'Onival@Admin2025';

interface AdminCredentialsType {
  username: string;
  password: string;
  email: string;
  name: string;
  initialSetupCompleted: boolean;
  oneTimePassword?: string | null;
  oneTimePasswordExpired?: boolean;
}

let adminCredentials: AdminCredentialsType = {
  username: 'admin',
  password: hashPasswordWithScrypt('admin'),
  email: 'admin@onival.com',
  name: 'مدیریت اونیوال (ONIVAL Admin)',
  initialSetupCompleted: false,
  oneTimePassword: INITIAL_SETUP_OTP,
  oneTimePasswordExpired: false
};

const defaultSiteContent = {
  brandName: 'اونیوال',
  brandEnglishName: 'ONIVAL',
  siteLogo: '',
  siteLogoFit: 'cover' as 'cover' | 'contain',
  siteLogoShape: 'rounded' as 'circle' | 'rounded' | 'free',
  siteLogoScale: 100,
  systemTagline: 'سامانه یکپارچه مدیریت فروشگاه، مقالات و ربات بله اونیوال (ONIVAL Admin)',
  heroTitlePrefix: 'فروشگاه تخصصی',
  heroSubtitle: 'عرضه مستقیم عسل طبیعی، ژل رویال، گرده گل و فرآورده‌های ارگانیک کوهستان',
  heroAlign: 'center' as const,
  navLabels: {
    home: 'خانه',
    articles: 'مقالات',
    consultation: 'مشاوره تخصصی',
    tracking: 'پیگیری سفارش',
    about: 'درباره ما',
    contact: 'تماس'
  },
  homeSections: [
    {
      id: 'specialOffers' as const,
      title: 'پیشنهاد شگفت‌انگیز',
      subtitle: 'تخفیف‌های استثنایی محصولات برگزیده کندو',
      enabled: true,
      align: 'right' as const,
      order: 1
    },
    {
      id: 'categories' as const,
      title: 'دسته‌بندی‌های محصولات',
      subtitle: 'دسترسی سریع به گروه‌های کالایی',
      enabled: true,
      align: 'right' as const,
      order: 2
    },
    {
      id: 'products' as const,
      title: 'لیست محصولات اونیوال',
      subtitle: 'محصولات ارگانیک و طبیعی با ضمانت اصالت و برگه آزمایشگاه',
      enabled: true,
      align: 'right' as const,
      order: 3
    },
    {
      id: 'consultationBanner' as const,
      title: 'مشاوره تخصصی رایگان',
      subtitle: 'راهنمایی انتخاب عسل دارویی و فرآورده‌های ویژه سلامت',
      enabled: true,
      align: 'center' as const,
      order: 4
    },
    {
      id: 'articles' as const,
      title: 'مقالات و مطالب علمی اونیوال',
      subtitle: 'آخرین نوشته‌ها برای آشنایی با خواص عسل طبیعی، دمنوش‌های گیاهی و سبک زندگی سالم',
      enabled: true,
      align: 'right' as const,
      order: 5
    }
  ],
  specialOffersTitle: 'پیشنهاد شگفت‌انگیز',
  specialOffersButtonText: 'مشاهده همه',
  specialOffersBgColor: '#ef394e',
  productsSectionTitle: 'لیست محصولات اونیوال',
  productsSectionSubtitle: 'محصولات موجود با ضمانت اصالت',
  productsAlign: 'right' as const,
  articlesSectionTitle: 'مقالات و مطالب علمی اونیوال',
  articlesSectionSubtitle: 'آخرین نوشته‌ها برای آشنایی با خواص عسل طبیعی، دمنوش‌های گیاهی و سبک زندگی سالم.',
  articlesPageTitle: 'دانشنامه و مقالات تخصصی اونیوال (ONIVAL)',
  articlesPageSubtitle: 'مرجع جامع راهنمای تشخیص عسل طبیعی، فواید ژل رویال، دمنوش‌های گیاهی و تغذیه ارگانیک',
  articlesAlign: 'right' as const,
  consultationBadge: 'مشاوره رایگان و تخصصی فرآورده‌های کندو',
  consultationTitle: 'درخواست مشاوره تخصصی سلامت و محصولات اونیوال',
  consultationSubtitle: 'پرسش‌های خود را درباره خواص درمانی عسل، طریقه مصرف ژل رویال، گرده گل و رژیم‌های طبیعی مطرح نمایید.',
  consultationTopics: [
    'خواص درمانی عسل ارگانیک سبلان (دیابت، سرماخوردگی، زخم معده)',
    'دوز مصرف و نگهداری ژل رویال و گرده گل',
    'ترکیبات دمنوش گیاهی ضد استرس و بی‌خوابی',
    'سکنجبین سنتی و پاکسازی کبد چرب',
    'انتخاب وزن و مشاوره سفارش عمده و خرید مستقیم'
  ],
  consultationAlign: 'center' as const,
  trackingTitle: 'پیگیری وضعیت سفارش و پیام مشاوره',
  trackingSubtitle: 'کد رهگیری فاکتور خرید (مانند ONV-ORD-101) یا کد رهگیری پیام مشاوره (مانند ONV-9421) را وارد نمایید.',
  trackingAlign: 'center' as const,
  aboutTitle: 'درباره فروشگاه اونیوال (ONIVAL)',
  aboutParagraph1: 'مجموعه تخصصی اونیوال با همکاری مستقیم زنبورداران محلی و کشاورزان متعهد سبلان و البرز، محصولات کاملاً سالم، ارگانیک و حرارت‌ندیده را بدون واسطه به دست خانواده‌های ایرانی می‌رساند.',
  aboutParagraph2: 'تمامی عسل‌ها دارای برگه آزمایشگاهی تخصصی با ساکارز زیر ۲ درصد بوده و فرآورده‌های دارویی کندو از جمله ژل رویال و گرده گل با حفظ کامل زنجیره سرمایشی نگهداری و توزیع می‌شوند.',
  aboutStat1Value: '۱۰۰٪',
  aboutStat1Label: 'طبیعی، خام و آزمایش‌شده',
  aboutStat2Value: '۷ روز',
  aboutStat2Label: 'ضمانت اصالت و بازگشت وجه',
  aboutStat3Value: '+۱۵ سال',
  aboutStat3Label: 'سابقه تولید و عرضه فرآورده‌های ارگانیک',
  contactTitle: 'تماس با ما',
  contactSubtitle: 'جهت پیگیری سفارشات، هماهنگی خرید عمده و ارتباط مستقیم با دفتر مرکزی اونیوال:',
  contactPhone: '۰۲۱-۱۲۳۴۵۶۷۸ / ۰۹۱۲۳۴۵۶۷۸۹',
  contactAddress: 'تهران، مجموعه تخصصی فرآورده‌های ارگانیک اونیوال (ONIVAL)',
  contactWorkingHours: 'شنبه تا چهارشنبه ۹:۰۰ الی ۱۸:۰۰ | پنج‌شنبه‌ها ۹:۰۰ الی ۱۳:۰۰',
  contactEmail: 'support@onival.ir',
  footerCopyright: 'تمامی حقوق مادی و معنوی متعلق به فروشگاه اونیوال (ONIVAL) می‌باشد.',
  paymentConfig: {
    cardToCardEnabled: true,
    cardNumber: '۶۰۳۷-۹۹۷۵-۹۹۱۲-۳۴۵۶',
    cardHolderName: 'مجموعه تخصصی فرآورده‌های ارگانیک اونیوال',
    bankName: 'بانک ملی ایران',
    cardDescription: 'لطفاً مبلغ دقیق فاکتور را به شماره کارت بالا واریز نموده و سپس تصویر واضح فیش واریزی یا اسکرین‌شات رسید انتقال وجه را به همراه شماره فاکتور در کادر زیر بارگذاری فرمایید. پس از تایید فیش توسط مدیریت، می‌توانید وضعیت ارسال سفارش خود را با کد رهگیری پیگیری نمایید.',
    gatewayOfflineNoticeTitle: 'اطلاعیه همراهان گرامی درباره نحوه پرداخت',
    gatewayOfflineNoticeText: 'همراه گرامی و ارجمند، به دلیل بروزرسانی فنی زیرساخت شبکه بانکی، پرداخت مستقیم از طریق درگاه اینترنتی در حال حاضر به صورت موقت قطع می‌باشد. ضمن پوزش از شما و قدردانی از همراهی و شکیبایی ارزشمندتان، می‌توانید مبلغ فاکتور را با اطمینان کامل به صورت «کارت به کارت» واریز نموده و تصویر فیش را در همین صفحه بارگذاری فرمایید تا سفارش شما بدون هیچ‌گونه تاخیری و در اولویت ویژه آماده و ارسال گردد.',
    baleBotEnabled: true,
    baleBotUsername: 'Onivalbot',
    baleBotDescription: 'اتصال مستقیم به بازوی رسمی بله (@Onivalbot) و دریافت پیش‌فاکتور با امکان پرداخت آنی با کیف پول بله یا کارت به کارت.',
    baleBotButtonText: 'اتصال به ربات بله و پرداخت فاکتور (@Onivalbot)',
    gatewayEnabled: false,
    gatewayTitle: 'پرداخت آنلاین از طریق درگاه بانکی شاپرک',
    gatewayUrl: 'https://zarinp.al/onival',
    gatewayMerchantCode: 'ONIVAL-MERCHANT-982410',
    gatewayDescription: 'پرداخت آنی و امن با کلیه کارت‌های بانکی عضو شبکه شتاب و رمز دوم پویا',
    defaultMethod: 'card_to_card' as const
  },
  consultationConfig: {
    basePrice: 120000,
    allowAddToCart: true,
    allowDirectPayment: true,
    specialistName: 'متخصص طب سنتی و فرآورده‌های کندوی اونیوال',
    specialistTitle: 'مشاوره اختصاصی تغذیه، رژیم درمانی و فرآورده‌های ارگانیک',
    timeSlots: [
      'نوبت صبح (۰۹:۰۰ الی ۱۲:۰۰)',
      'نوبت ظهر (۱۲:۰۰ الی ۱۵:۰۰)',
      'نوبت عصر (۱۶:۰۰ الی ۱۹:۰۰)',
      'نوبت شب (۱۹:۰۰ الی ۲۱:۰۰)',
      'اولین زمان خالی کارشناس (فوری)'
    ],
    topics: [
      {
        id: 'topic-1',
        title: 'خواص درمانی عسل ارگانیک سبلان (دیابت، سرماخوردگی، زخم معده)',
        description: 'بررسی شرایط بدنی و تجویز نوع و میزان مصرف عسل طبیعی مناسب شما',
        price: 120000,
        durationMinutes: 30,
        enabled: true
      },
      {
        id: 'topic-2',
        title: 'دوز مصرف و نگهداری ژل رویال و گرده گل',
        description: 'تنظیم برنامه مصرف تخصصی ژل رویال و گرده گل جهت تقویت سیستم ایمنی و انرژی',
        price: 150000,
        durationMinutes: 40,
        enabled: true
      },
      {
        id: 'topic-3',
        title: 'ترکیبات دمنوش گیاهی ضد استرس و بی‌خوابی',
        description: 'نسخه ترکیبی دمنوش‌های کوهستانی و عسل برای رفع بی‌خوابی و اضطراب روزانه',
        price: 110000,
        durationMinutes: 25,
        enabled: true
      },
      {
        id: 'topic-4',
        title: 'سکنجبین سنتی و پاکسازی کبد چرب',
        description: 'برنامه ۴۰ روزه پاکسازی کبد و تنظیم متابولیسم با فرآورده‌های طبیعی',
        price: 140000,
        durationMinutes: 35,
        enabled: true
      },
      {
        id: 'topic-5',
        title: 'انتخاب وزن و مشاوره سفارش عمده و خرید مستقیم',
        description: 'راهنمایی خرید عمده یا سازمانی، بررسی برگه‌های آزمایشگاه و شرایط ارسال',
        price: 80000,
        durationMinutes: 20,
        enabled: true
      }
    ],
    socialPlatforms: [
      {
        id: 'bale',
        name: 'پیام‌رسان بله (Bale)',
        placeholder: 'آیدی یا شماره موبایل شما در بله (مثال: @username یا 09123456789)',
        enabled: true,
        iconType: 'bale' as const
      },
      {
        id: 'telegram',
        name: 'تلگرام (Telegram)',
        placeholder: 'آیدی یا شماره موبایل شما در تلگرام (مثال: @username یا 09123456789)',
        enabled: true,
        iconType: 'telegram' as const
      },
      {
        id: 'whatsapp',
        name: 'واتساپ (WhatsApp)',
        placeholder: 'شماره موبایل فعال در واتساپ (مثال: 09123456789)',
        enabled: true,
        iconType: 'whatsapp' as const
      },
      {
        id: 'eitaa',
        name: 'پیام‌رسان ایتا (Eitaa)',
        placeholder: 'آیدی یا شماره موبایل شما در ایتا (مثال: @username یا 09123456789)',
        enabled: true,
        iconType: 'eitaa' as const
      },
      {
        id: 'instagram',
        name: 'دایرکت اینستاگرام (Instagram)',
        placeholder: 'آیدی پیج اینستاگرام شما (مثال: @your_page)',
        enabled: true,
        iconType: 'instagram' as const
      },
      {
        id: 'phone',
        name: 'تماس تلفنی مستقیم',
        placeholder: 'شماره تماس مستقیم جهت برقراری تماس کارشناس (مثال: 09123456789)',
        enabled: true,
        iconType: 'phone' as const
      }
    ]
  }
};

let siteContent = JSON.parse(JSON.stringify(defaultSiteContent));
let slugRedirects: SlugRedirect[] = [];

// ================= PERSISTENT DISK STORAGE HELPERS =================
function loadPersistedState() {
  try {
    const targetFile = fs.existsSync(PERSIST_FILE_PATH)
      ? PERSIST_FILE_PATH
      : fs.existsSync(LEGACY_PERSIST_FILE_PATH)
      ? LEGACY_PERSIST_FILE_PATH
      : null;

    if (targetFile) {
      const raw = fs.readFileSync(targetFile, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.products) && parsed.products.length > 0) {
        products = parsed.products;
      }
      if (Array.isArray(parsed.productCategories) && parsed.productCategories.length > 0) {
        productCategories = parsed.productCategories;
      }
      if (Array.isArray(parsed.posts) && parsed.posts.length > 0) {
        posts = parsed.posts;
      }
      if (Array.isArray(parsed.postCategories) && parsed.postCategories.length > 0) {
        postCategories = parsed.postCategories;
      }
      if (Array.isArray(parsed.slugRedirects)) {
        slugRedirects = parsed.slugRedirects;
      }
      const cleanBot = (b?: string) => (!b || b === 'onival_bot' || b === '@onival_bot') ? 'Onivalbot' : b;
      if (parsed.telegramConfig && typeof parsed.telegramConfig === 'object') {
        telegramConfig = {
          ...telegramConfig,
          ...parsed.telegramConfig,
          botUsername: cleanBot(parsed.telegramConfig.botUsername),
          baleBotUsername: cleanBot(parsed.telegramConfig.baleBotUsername),
          baleAdminUsername: parsed.telegramConfig.baleAdminUsername || '',
          balePaymentMode: parsed.telegramConfig.balePaymentMode || 'live',
          balePaymentTokenTest: parsed.telegramConfig.balePaymentTokenTest || '',
          balePaymentTokenLive: parsed.telegramConfig.balePaymentTokenLive || '',
          balePaymentToken: parsed.telegramConfig.balePaymentToken || '',
          baleAutoSendInvoice: parsed.telegramConfig.baleAutoSendInvoice ?? true,
          baleAutoNotifyAdminAllTransactions: parsed.telegramConfig.baleAutoNotifyAdminAllTransactions ?? true,
          baleAdminDirectApproval: parsed.telegramConfig.baleAdminDirectApproval ?? true
        };
      }
      if (parsed.siteContent && typeof parsed.siteContent === 'object') {
        siteContent = {
          ...siteContent,
          ...parsed.siteContent,
          paymentConfig: {
            ...siteContent.paymentConfig,
            ...(parsed.siteContent.paymentConfig || {}),
            baleBotUsername: cleanBot(parsed.siteContent.paymentConfig?.baleBotUsername),
            baleBotButtonText: (parsed.siteContent.paymentConfig?.baleBotButtonText || '').includes('onival_bot')
              ? 'اتصال به ربات بله و پرداخت فاکتور (@Onivalbot)'
              : (parsed.siteContent.paymentConfig?.baleBotButtonText || 'اتصال به ربات بله و پرداخت فاکتور (@Onivalbot)')
          },
          consultationConfig: {
            ...siteContent.consultationConfig,
            ...(parsed.siteContent.consultationConfig || {}),
            topics: Array.isArray(parsed.siteContent.consultationConfig?.topics) && parsed.siteContent.consultationConfig.topics.length > 0
              ? parsed.siteContent.consultationConfig.topics
              : siteContent.consultationConfig.topics,
            socialPlatforms: Array.isArray(parsed.siteContent.consultationConfig?.socialPlatforms) && parsed.siteContent.consultationConfig.socialPlatforms.length > 0
              ? parsed.siteContent.consultationConfig.socialPlatforms
              : siteContent.consultationConfig.socialPlatforms,
            timeSlots: Array.isArray(parsed.siteContent.consultationConfig?.timeSlots) && parsed.siteContent.consultationConfig.timeSlots.length > 0
              ? parsed.siteContent.consultationConfig.timeSlots
              : siteContent.consultationConfig.timeSlots
          }
        };
      }
      if (parsed.adminCredentials && typeof parsed.adminCredentials === 'object') {
        let loadedPass = String(parsed.adminCredentials.password || 'admin').trim();
        if (loadedPass === '6db4e37df1c2abbfca3529f83b23d5e17fad82dab3a4d8b12964d3c95295001b' || loadedPass === 'admin') {
          loadedPass = hashPasswordWithScrypt('admin');
        } else if (!loadedPass.startsWith('scrypt:')) {
          loadedPass = hashPasswordWithScrypt(loadedPass);
        }
        const isSetupDone = Boolean(parsed.adminCredentials.initialSetupCompleted);
        adminCredentials = {
          username: String(parsed.adminCredentials.username || 'admin').trim(),
          password: loadedPass,
          email: String(parsed.adminCredentials.email || 'admin@onival.com').trim(),
          name: String(parsed.adminCredentials.name || 'مدیریت اونیوال (ONIVAL Admin)').trim(),
          initialSetupCompleted: isSetupDone,
          oneTimePassword: isSetupDone ? null : (parsed.adminCredentials.oneTimePassword || INITIAL_SETUP_OTP),
          oneTimePasswordExpired: isSetupDone
        };
      }

      // Guarantee secure random webhook secret token if not configured
      if (!telegramConfig.webhookSecretToken || String(telegramConfig.webhookSecretToken).trim() === '') {
        telegramConfig.webhookSecretToken = `ONV_SEC_${crypto.randomBytes(16).toString('hex')}`;
      }
      if (Array.isArray(parsed.botActivityLogs) && parsed.botActivityLogs.length > 0) {
        botActivityLogs = parsed.botActivityLogs;
      }
      if (Array.isArray(parsed.orders) && parsed.orders.length > 0) {
        orders = parsed.orders;
      }
      if (Array.isArray(parsed.contactMessages) && parsed.contactMessages.length > 0) {
        contactMessages = parsed.contactMessages;
      }

      // If loaded from legacy path, copy to protected server-data path and remove legacy file
      if (targetFile === LEGACY_PERSIST_FILE_PATH && !fs.existsSync(PERSIST_FILE_PATH)) {
        try {
          fs.writeFileSync(PERSIST_FILE_PATH, raw, 'utf-8');
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    console.error('Failed to load persisted state:', err);
  }
}

function savePersistedState() {
  try {
    const dataToSave = {
      products,
      productCategories,
      posts,
      postCategories,
      slugRedirects,
      telegramConfig,
      siteContent,
      adminCredentials,
      botActivityLogs: botActivityLogs.slice(0, 50),
      orders,
      contactMessages,
      updatedAt: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(dataToSave, null, 2);
    // Atomic write to prevent file corruption on unexpected crashes or concurrent writes
    const tempFile = path.join(DATA_DIR, `.onival-save-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.tmp`);
    fs.writeFileSync(tempFile, jsonStr, 'utf-8');
    fs.renameSync(tempFile, PERSIST_FILE_PATH);
  } catch (err) {
    console.error('CRITICAL: Failed to save persisted state to disk:', err);
    throw err;
  }
}

loadPersistedState();

// ================= ADMIN SECURITY, SESSIONS & RATE LIMITING =================

// Active session token store with 24-hour expiration
interface AdminSession {
  token: string;
  username: string;
  createdAt: number;
  expiresAt: number;
}
const activeAdminSessions = new Map<string, AdminSession>();
const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function generateAdminSessionToken(username: string, passwordOrHash: string): string {
  const randomPart = crypto.randomBytes(24).toString('hex');
  const hmacPart = crypto.createHmac('sha256', ADMIN_TOKEN_SECRET)
    .update(`${username.trim().toLowerCase()}:${passwordOrHash.trim()}:${randomPart}`)
    .digest('hex');
  const sessionToken = `${randomPart}${hmacPart}`;
  const now = Date.now();
  activeAdminSessions.set(sessionToken, {
    token: sessionToken,
    username: username.trim().toLowerCase(),
    createdAt: now,
    expiresAt: now + ADMIN_SESSION_TTL_MS
  });
  return sessionToken;
}

// In-Memory Rate Limiter for Login Endpoint (Max 5 failed attempts per 15 minutes per IP)
interface LoginAttemptRecord {
  failures: number;
  blockedUntil: number;
  lastAttempt: number;
}
const loginRateLimitMap = new Map<string, LoginAttemptRecord>();

const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

function getClientIp(req: Request): string {
  if (process.env.TRUST_PROXY === 'true') {
    const forwarded = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim();
    if (forwarded) return forwarded;
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function checkLoginRateLimit(req: Request): { allowed: boolean; remainingAttempts: number; retryAfterSeconds: number } {
  const ip = getClientIp(req);
  const now = Date.now();
  const record = loginRateLimitMap.get(ip);

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS, retryAfterSeconds: 0 };
  }

  // If currently blocked
  if (record.blockedUntil > now) {
    const retryAfter = Math.ceil((record.blockedUntil - now) / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfterSeconds: retryAfter };
  }

  // If attempt window expired, reset failures
  if (now - record.lastAttempt > ATTEMPT_WINDOW_MS) {
    loginRateLimitMap.delete(ip);
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS, retryAfterSeconds: 0 };
  }

  const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - record.failures);
  return { allowed: true, remainingAttempts: remaining, retryAfterSeconds: 0 };
}

function recordFailedLogin(req: Request): { blocked: boolean; remainingAttempts: number; retryAfterSeconds: number } {
  const ip = getClientIp(req);
  const now = Date.now();
  let record = loginRateLimitMap.get(ip);

  if (!record || now - record.lastAttempt > ATTEMPT_WINDOW_MS) {
    record = { failures: 1, blockedUntil: 0, lastAttempt: now };
  } else {
    record.failures += 1;
    record.lastAttempt = now;
  }

  if (record.failures >= MAX_FAILED_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_DURATION_MS;
    loginRateLimitMap.set(ip, record);
    return { blocked: true, remainingAttempts: 0, retryAfterSeconds: Math.ceil(BLOCK_DURATION_MS / 1000) };
  }

  loginRateLimitMap.set(ip, record);
  return { blocked: false, remainingAttempts: MAX_FAILED_ATTEMPTS - record.failures, retryAfterSeconds: 0 };
}

function clearLoginAttempts(req: Request): void {
  const ip = getClientIp(req);
  loginRateLimitMap.delete(ip);
}

// General Endpoint Rate Limiter to prevent DoS, spam, and brute force
interface GenericBucket {
  count: number;
  resetAt: number;
}
const genericRateLimitMap = new Map<string, GenericBucket>();

function checkEndpointRateLimit(req: Request, bucketName: string, maxRequests: number, windowMs: number): boolean {
  const ip = getClientIp(req);
  const key = `${bucketName}:${ip}`;
  const now = Date.now();
  const bucket = genericRateLimitMap.get(key);

  if (!bucket || now > bucket.resetAt) {
    genericRateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= maxRequests) {
    return false;
  }

  bucket.count += 1;
  return true;
}

// Periodic cleanup of rate limits, expired admin sessions, and bot activity logs to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  // 1. Generic rate limit buckets
  for (const [key, val] of genericRateLimitMap.entries()) {
    if (now > val.resetAt) {
      genericRateLimitMap.delete(key);
    }
  }
  // 2. Login rate limit records
  for (const [ip, record] of loginRateLimitMap.entries()) {
    if (now > record.blockedUntil && (now - record.lastAttempt > 30 * 60 * 1000)) {
      loginRateLimitMap.delete(ip);
    }
  }
  // 3. Expired admin sessions
  for (const [token, session] of activeAdminSessions.entries()) {
    if (now >= session.expiresAt) {
      activeAdminSessions.delete(token);
    }
  }
  // 4. Cap in-memory bot activity logs to prevent unbounded RAM growth
  if (botActivityLogs.length > 100) {
    botActivityLogs.length = 100;
  }
}, 10 * 60 * 1000);

function isRequestAdminAuthorized(req: Request, allowQueryToken: boolean = false): boolean {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const headerToken = ((req.headers['x-admin-token'] as string) || '').trim();
  const queryToken = (allowQueryToken && typeof req.query?.token === 'string') ? req.query.token.trim() : '';
  const token = bearerToken || headerToken || queryToken;
  if (!token) return false;

  const now = Date.now();
  const session = activeAdminSessions.get(token);
  if (session) {
    if (now < session.expiresAt) {
      return true;
    }
    activeAdminSessions.delete(token);
    return false;
  }

  return false;
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const isReceiptRoute = req.path.startsWith('/admin/receipts/');
  if (!isRequestAdminAuthorized(req, isReceiptRoute)) {
    return res.status(401).json({
      ok: false,
      error: 'دسترسی غیرمجاز (401 Unauthorized): برای انجام عملیات مدیریتی ابتدا باید وارد حساب ادمین شوید.'
    });
  }
  next();
}

// Protected webhook paths list
const PUBLIC_WEBHOOK_PATHS = [
  '/api/webhook/bale',
  '/api/bot/webhook/bale',
  '/api/webhook/bale/customer',
  '/api/webhook/bale/admin',
  '/api/webhook/telegram',
  '/api/bot/webhook/telegram',
  '/api/webhook.php',
  '/api/bale-webhook.php',
  '/api/telegram-webhook.php',
  '/api/bale-bot.php',
  '/api/telegram-bot.php',
  '/bale-bot.php',
  '/telegram-bot.php',
  '/api/webhook'
];

// Protect administrative write/CRUD, bot management and private data routes
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const p = req.path;
  const m = req.method.toUpperCase();

  const fullPath = req.originalUrl ? req.originalUrl.split('?')[0] : ('/api' + p);
  const isWebhookPath = PUBLIC_WEBHOOK_PATHS.includes(p) || PUBLIC_WEBHOOK_PATHS.includes(fullPath) || PUBLIC_WEBHOOK_PATHS.includes('/api' + p);

  // Public read endpoints needed by storefront visitors and search engines
  if (m === 'GET' && (
    p === '/health' ||
    p === '/ping' ||
    p === '/admin/setup-status' ||
    p === '/products' ||
    p === '/product' ||
    p.startsWith('/products/') ||
    p.startsWith('/product/') ||
    p === '/product-categories' ||
    p === '/product-category' ||
    p === '/posts' ||
    p === '/post' ||
    p.startsWith('/posts/') ||
    p.startsWith('/post/') ||
    p === '/post-categories' ||
    p === '/post-category' ||
    p === '/site-content' ||
    p.startsWith('/orders/track/') ||
    p === '/torob/products' ||
    p.startsWith('/torob') ||
    p.startsWith('/emalls') ||
    isWebhookPath
  )) {
    return next();
  }

  // Public customer action endpoints (Order creation, contact, booking, receipt upload, and bot webhooks)
  if (m === 'POST' && (
    p === '/admin/login' ||
    p === '/orders' ||
    p === '/contact' ||
    p === '/consultations/book' ||
    /^\/orders\/[^/]+\/upload-receipt$/.test(p) ||
    isWebhookPath
  )) {
    return next();
  }

  // Everything else under /api (bot management, logs, payment confirmation, export-state, credentials, etc.)
  // STRICTLY requires admin authorization
  return requireAdminAuth(req, res, next);
});

// ================= API ROUTES =================

// Health and Ping check (Public)
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    ok: true,
    status: 'healthy',
    serverEngine: 'Node-Express-Live',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/ping', (req: Request, res: Response) => {
  res.json({ pong: true, time: Date.now() });
});

// Overview Statistics
app.get('/api/stats', (req: Request, res: Response) => {
  const totalRevenue = orders.reduce((acc, o) => acc + (o.paymentStatus === 'Paid' ? o.totalPrice : 0), 0);
  const unreadMessages = contactMessages.filter(m => !m.isRead || !m.isResponded).length;
  const pendingOrders = orders.filter(o => o.status === 'Pending' || o.status === 'Processing').length;

  res.json({
    totalProducts: products.filter(p => !p.isDelete).length,
    totalPosts: posts.length,
    unreadMessages,
    pendingOrders,
    totalRevenue
  });
});

// Products
app.get(['/api/products', '/api/product'], (req: Request, res: Response) => {
  if (req.query.id) {
    const id = Number(req.query.id);
    const isAdmin = isRequestAdminAuthorized(req);
    const p: any = products.find(
      (x: any) =>
        x.id === id &&
        !x.isDelete &&
        (isAdmin || (x.status || 'published') === 'published')
    );
    if (!p) return res.status(404).json({ error: 'محصول مورد نظر یافت نشد' });
    return res.json(p);
  }
  const isAdmin = isRequestAdminAuthorized(req);
  const activeProducts = products.filter(
    (p: any) => !p.isDelete && (isAdmin || (p.status || 'published') === 'published')
  );
  res.json(activeProducts);
});

app.get(['/api/products/:id', '/api/product/:id'], (req: Request, res: Response) => {
  const isAdmin = isRequestAdminAuthorized(req);
  const p: any = products.find(
    (x: any) =>
      x.id === Number(req.params.id) &&
      !x.isDelete &&
      (isAdmin || (x.status || 'published') === 'published')
  );
  if (!p) return res.status(404).json({ error: 'محصول مورد نظر یافت نشد' });
  res.json(p);
});

app.post(['/api/products', '/api/product'], (req: Request, res: Response) => {
  const {
    title,
    slug,
    price,
    hasSize,
    sizes,
    priceSmall,
    priceLarge,
    discount,
    type,
    features,
    categoryId,
    imageName,
    imageAlt,
    description,
    content,
    status,
    availability,
    sku,
    seoTitle,
    seoDescription,
    ogTitle,
    ogDescription,
    ogImage,
    canonicalUrl,
    robotsNoIndex,
    robotsNoFollow,
    publishedAt
  } = req.body;
  if (!title) return res.status(400).json({ error: 'عنوان محصول الزامی است' });

  const nextId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
  const candidateSlug = sanitizeSlug(slug || title, 'product', nextId);
  if (isSlugDuplicate(products as any, candidateSlug)) {
    return res.status(400).json({ error: `نامک (Slug) «${candidateSlug}» تکراری است و قبلاً برای محصول دیگری استفاده شده است.` });
  }

  const cat = productCategories.find(c => c.id === Number(categoryId));
  const parsedSizes = Array.isArray(sizes) && sizes.length > 0
    ? sizes.map((s: any) => ({
        name: String(s.name || ''),
        price: Number(s.price) || 0,
        stock: s.stock !== undefined ? Math.max(0, Number(s.stock)) : 10,
        specialOfferStock: s.specialOfferStock !== undefined && s.specialOfferStock !== null && String(s.specialOfferStock).trim() !== ''
          ? Math.max(0, Number(s.specialOfferStock))
          : undefined,
        isOutOfStock: Boolean(s.isOutOfStock || (s.stock !== undefined && Number(s.stock) <= 0)),
        sku: s.sku ? String(s.sku) : undefined
      }))
    : undefined;

  const computedProductStock = parsedSizes && parsedSizes.length > 0
    ? parsedSizes.reduce((acc: number, s: any) => acc + (s.stock || 0), 0)
    : (req.body.stock !== undefined ? Math.max(0, Number(req.body.stock)) : 20);

  const hasExplicitSizeOfferStock = parsedSizes && parsedSizes.some((s: any) => s.specialOfferStock !== undefined);
  const computedProductOfferStock = hasExplicitSizeOfferStock
    ? parsedSizes.reduce((acc: number, s: any) => acc + (s.specialOfferStock || 0), 0)
    : (req.body.specialOfferStock !== undefined && req.body.specialOfferStock !== null && String(req.body.specialOfferStock).trim() !== ''
        ? Math.max(0, Number(req.body.specialOfferStock))
        : undefined);

  const resolvedPrice = parsedSizes && parsedSizes.length > 0
    ? parsedSizes[0].price
    : (Number(price) || 0);

  const nowIso = new Date().toISOString();
  const newProduct: any = {
    id: nextId,
    title,
    slug: candidateSlug,
    price: resolvedPrice,
    hasSize: Boolean(hasSize || (parsedSizes && parsedSizes.length > 0)),
    sizes: parsedSizes,
    priceSmall: parsedSizes && parsedSizes.length > 0 ? parsedSizes[0].price : (priceSmall ? Number(priceSmall) : undefined),
    priceLarge: parsedSizes && parsedSizes.length > 0 ? parsedSizes[parsedSizes.length - 1].price : (priceLarge ? Number(priceLarge) : undefined),
    discount: discount ? Number(discount) : 0,
    type: cat?.slug || type || 'honey',
    features: Array.isArray(features) ? features : [],
    categoryId: Number(categoryId) || (productCategories[0]?.id ?? 1),
    categoryTitle: cat ? cat.title : 'عمومی',
    imageName: imageName || 'https://images.unsplash.com/photo-1587049359535-b64d3dd0d716?w=800&auto=format&fit=crop&q=80',
    imageAlt: imageAlt || title,
    images: Array.isArray(req.body.images) && req.body.images.length > 0
      ? req.body.images
      : (imageName ? [imageName] : ['https://images.unsplash.com/photo-1587049359535-b64d3dd0d716?w=800&auto=format&fit=crop&q=80']),
    videoUrl: req.body.videoUrl || '',
    videoType: req.body.videoType || 'direct',
    imageAspectRatio: req.body.imageAspectRatio || 'square',
    imageFitMode: req.body.imageFitMode || 'cover',
    imageZoomLevel: req.body.imageZoomLevel ? Number(req.body.imageZoomLevel) : 2,
    description: description || '',
    content: content || '',
    isDelete: false,
    creationTime: new Date().toLocaleDateString('fa-IR'),
    publishedAt: publishedAt || nowIso,
    updatedAt: nowIso,
    status: status === 'draft' ? 'draft' : 'published',
    availability: computedProductStock <= 0 ? 'OutOfStock' : (availability || 'InStock'),
    stock: computedProductStock,
    isOutOfStock: computedProductStock <= 0,
    specialOfferStock: computedProductOfferStock,
    specialOfferInitialStock: req.body.specialOfferInitialStock !== undefined ? Number(req.body.specialOfferInitialStock) : computedProductOfferStock,
    isAmazingOffer: Boolean(req.body.isAmazingOffer || req.body.isSpecialOffer),
    isSpecialOffer: Boolean(req.body.isAmazingOffer || req.body.isSpecialOffer),
    sku: sku || `ONV-PRD-${nextId}`,
    seoTitle: seoTitle || '',
    seoDescription: seoDescription || '',
    ogTitle: ogTitle || '',
    ogDescription: ogDescription || '',
    ogImage: ogImage || '',
    canonicalUrl: canonicalUrl || '',
    robotsNoIndex: Boolean(robotsNoIndex),
    robotsNoFollow: Boolean(robotsNoFollow)
  };

  products.push(newProduct);
  savePersistedState();
  botActivityLogs.unshift({
    id: Date.now(),
    time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    type: 'product_added',
    text: `محصول جدید اضافه شد: ${newProduct.title}`,
    status: 'success'
  });

  res.status(201).json(newProduct);
});

const handleProductUpdate = (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const index = products.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: 'محصول یافت نشد' });

  const existing: any = products[index];
  const {
    title,
    slug,
    price,
    hasSize,
    sizes,
    priceSmall,
    priceLarge,
    discount,
    type,
    features,
    categoryId,
    imageName,
    imageAlt,
    description,
    content,
    status,
    availability,
    sku,
    seoTitle,
    seoDescription,
    ogTitle,
    ogDescription,
    ogImage,
    canonicalUrl,
    robotsNoIndex,
    robotsNoFollow
  } = req.body;

  const nextSlug = slug !== undefined && String(slug).trim() !== ''
    ? sanitizeSlug(slug, 'product', id)
    : existing.slug;

  if (isSlugDuplicate(products as any, nextSlug, id)) {
    return res.status(400).json({ error: `نامک (Slug) «${nextSlug}» تکراری است و قبلاً برای محصول دیگری استفاده شده است.` });
  }

  // Record 301 redirect if a published product slug changed
  if (existing.slug && existing.slug !== nextSlug && (existing.status || 'published') === 'published') {
    const fromPath = `/products/${existing.slug}`;
    const toPath = `/products/${nextSlug}`;
    slugRedirects = slugRedirects
      .filter(r => r.fromPath !== fromPath && r.fromPath !== toPath)
      .map(r => (r.toPath === fromPath ? { ...r, toPath } : r));
    slugRedirects.push({
      fromPath,
      toPath,
      entityType: 'product',
      entityId: id,
      createdAt: new Date().toISOString()
    });
  }

  const cat = productCategories.find(c => c.id === Number(categoryId ?? existing.categoryId));

  const parsedSizes = Array.isArray(sizes)
    ? sizes.map((s: any) => ({
        name: String(s.name || ''),
        price: Number(s.price) || 0,
        stock: s.stock !== undefined ? Math.max(0, Number(s.stock)) : 10,
        specialOfferStock: s.specialOfferStock !== undefined && s.specialOfferStock !== null && String(s.specialOfferStock).trim() !== ''
          ? Math.max(0, Number(s.specialOfferStock))
          : undefined,
        isOutOfStock: Boolean(s.isOutOfStock || (s.stock !== undefined && Number(s.stock) <= 0)),
        sku: s.sku ? String(s.sku) : undefined
      }))
    : existing.sizes;

  const computedProductStock = parsedSizes && parsedSizes.length > 0
    ? parsedSizes.reduce((acc: number, s: any) => acc + (s.stock || 0), 0)
    : (req.body.stock !== undefined ? Math.max(0, Number(req.body.stock)) : existing.stock);

  const hasExplicitSizeOfferStock = parsedSizes && parsedSizes.some((s: any) => s.specialOfferStock !== undefined);
  const computedProductOfferStock = hasExplicitSizeOfferStock
    ? parsedSizes.reduce((acc: number, s: any) => acc + (s.specialOfferStock || 0), 0)
    : (req.body.specialOfferStock !== undefined && req.body.specialOfferStock !== null && String(req.body.specialOfferStock).trim() !== ''
        ? Math.max(0, Number(req.body.specialOfferStock))
        : existing.specialOfferStock);

  const resolvedPrice = parsedSizes && parsedSizes.length > 0
    ? parsedSizes[0].price
    : (price !== undefined ? Number(price) : existing.price);

  products[index] = {
    ...existing,
    title: title ?? existing.title,
    slug: nextSlug,
    price: resolvedPrice,
    hasSize: hasSize !== undefined ? Boolean(hasSize) : existing.hasSize,
    sizes: parsedSizes,
    priceSmall: parsedSizes && parsedSizes.length > 0 ? parsedSizes[0].price : (priceSmall !== undefined ? Number(priceSmall) : existing.priceSmall),
    priceLarge: parsedSizes && parsedSizes.length > 0 ? parsedSizes[parsedSizes.length - 1].price : (priceLarge !== undefined ? Number(priceLarge) : existing.priceLarge),
    discount: discount !== undefined ? Number(discount) : existing.discount,
    type: cat?.slug ?? type ?? existing.type,
    features: features !== undefined ? features : existing.features,
    categoryId: categoryId ? Number(categoryId) : existing.categoryId,
    categoryTitle: cat ? cat.title : existing.categoryTitle,
    imageName: imageName ?? existing.imageName,
    imageAlt: imageAlt ?? existing.imageAlt,
    images: req.body.images !== undefined
      ? (Array.isArray(req.body.images) ? req.body.images : [req.body.images])
      : existing.images,
    videoUrl: req.body.videoUrl !== undefined ? req.body.videoUrl : existing.videoUrl,
    videoType: req.body.videoType !== undefined ? req.body.videoType : existing.videoType,
    imageAspectRatio: req.body.imageAspectRatio !== undefined ? req.body.imageAspectRatio : existing.imageAspectRatio,
    imageFitMode: req.body.imageFitMode !== undefined ? req.body.imageFitMode : existing.imageFitMode,
    imageZoomLevel: req.body.imageZoomLevel !== undefined ? Number(req.body.imageZoomLevel) : existing.imageZoomLevel,
    description: description ?? existing.description,
    content: content ?? existing.content,
    updatedAt: new Date().toISOString(),
    status: status ?? existing.status ?? 'published',
    availability: availability ?? (computedProductStock <= 0 ? 'OutOfStock' : (existing.availability ?? 'InStock')),
    stock: computedProductStock,
    isOutOfStock: computedProductStock <= 0,
    specialOfferStock: computedProductOfferStock,
    specialOfferInitialStock: req.body.specialOfferInitialStock !== undefined ? Number(req.body.specialOfferInitialStock) : (existing.specialOfferInitialStock ?? computedProductOfferStock),
    isAmazingOffer: req.body.isAmazingOffer !== undefined ? Boolean(req.body.isAmazingOffer) : existing.isAmazingOffer,
    isSpecialOffer: req.body.isSpecialOffer !== undefined ? Boolean(req.body.isSpecialOffer) : existing.isSpecialOffer,
    sku: sku ?? existing.sku,
    seoTitle: seoTitle ?? existing.seoTitle,
    seoDescription: seoDescription ?? existing.seoDescription,
    ogTitle: ogTitle ?? existing.ogTitle,
    ogDescription: ogDescription ?? existing.ogDescription,
    ogImage: ogImage ?? existing.ogImage,
    canonicalUrl: canonicalUrl ?? existing.canonicalUrl,
    robotsNoIndex: robotsNoIndex !== undefined ? Boolean(robotsNoIndex) : existing.robotsNoIndex,
    robotsNoFollow: robotsNoFollow !== undefined ? Boolean(robotsNoFollow) : existing.robotsNoFollow
  } as any;

  savePersistedState();
  res.json(products[index]);
};

app.put(['/api/products/:id', '/api/product/:id'], handleProductUpdate);
app.patch(['/api/products/:id', '/api/product/:id'], handleProductUpdate);
app.post(['/api/products/:id', '/api/product/:id'], handleProductUpdate);

const handleProductDelete = (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const index = products.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: 'محصول یافت نشد' });
  products[index].isDelete = true;
  savePersistedState();
  res.json({ message: 'محصول با موفقیت حذف شد' });
};

app.delete(['/api/products/:id', '/api/product/:id'], handleProductDelete);
app.post(['/api/products/:id/delete', '/api/product/:id/delete'], handleProductDelete);

// Product Categories
app.get(['/api/product-categories', '/api/product-category'], (req: Request, res: Response) => {
  const isAdmin = isRequestAdminAuthorized(req);
  const visibleCategories = productCategories.filter(
    (c: any) => isAdmin || (c.status || 'published') === 'published'
  );
  res.json(visibleCategories);
});

app.post(['/api/product-categories', '/api/product-category'], (req: Request, res: Response) => {
  const { title, slug, parentId, sortOrder, description, imageName, imageAlt, status, seoTitle, seoDescription, ogImage, robotsNoIndex } = req.body;
  if (!title) return res.status(400).json({ error: 'عنوان دسته‌بندی الزامی است' });

  const nextId = productCategories.length > 0 ? Math.max(...productCategories.map(c => c.id)) + 1 : 1;
  const candidateSlug = sanitizeSlug(slug || title, 'cat', nextId);
  if (isSlugDuplicate(productCategories as any, candidateSlug)) {
    return res.status(400).json({ error: `نامک (Slug) دسته‌بندی «${candidateSlug}» تکراری است.` });
  }

  const newCat: any = {
    id: nextId,
    title,
    slug: candidateSlug,
    parentId: parentId ? Number(parentId) : null,
    sortOrder: sortOrder ? Number(sortOrder) : productCategories.length + 1,
    description: description || '',
    imageName: imageName || '',
    imageAlt: imageAlt || title,
    status: status === 'draft' ? 'draft' : 'published',
    updatedAt: new Date().toISOString(),
    seoTitle: seoTitle || '',
    seoDescription: seoDescription || '',
    ogImage: ogImage || '',
    robotsNoIndex: Boolean(robotsNoIndex)
  };

  productCategories.push(newCat);
  savePersistedState();
  res.status(201).json(newCat);
});

const handleCategoryUpdate = (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const index = productCategories.findIndex(c => c.id === id);
  if (index === -1) return res.status(404).json({ error: 'دسته‌بندی یافت نشد' });

  const existing: any = productCategories[index];
  const { title, slug, parentId, sortOrder, description, imageName, imageAlt, status, seoTitle, seoDescription, ogImage, robotsNoIndex } = req.body;
  const nextSlug = slug !== undefined && String(slug).trim() !== ''
    ? sanitizeSlug(slug, 'cat', id)
    : existing.slug;

  if (isSlugDuplicate(productCategories as any, nextSlug, id)) {
    return res.status(400).json({ error: `نامک (Slug) دسته‌بندی «${nextSlug}» تکراری است.` });
  }

  if (existing.slug && existing.slug !== nextSlug && (existing.status || 'published') === 'published') {
    const fromPath = `/categories/${existing.slug}`;
    const toPath = `/categories/${nextSlug}`;
    slugRedirects = slugRedirects
      .filter(r => r.fromPath !== fromPath && r.fromPath !== toPath)
      .map(r => (r.toPath === fromPath ? { ...r, toPath } : r));
    slugRedirects.push({
      fromPath,
      toPath,
      entityType: 'category',
      entityId: id,
      createdAt: new Date().toISOString()
    });
  }

  productCategories[index] = {
    ...existing,
    title: title ?? existing.title,
    slug: nextSlug,
    parentId: parentId !== undefined ? (parentId ? Number(parentId) : null) : existing.parentId,
    sortOrder: sortOrder !== undefined ? Number(sortOrder) : existing.sortOrder,
    description: description ?? existing.description,
    imageName: imageName ?? existing.imageName,
    imageAlt: imageAlt ?? existing.imageAlt,
    status: status ?? existing.status ?? 'published',
    updatedAt: new Date().toISOString(),
    seoTitle: seoTitle ?? existing.seoTitle,
    seoDescription: seoDescription ?? existing.seoDescription,
    ogImage: ogImage ?? existing.ogImage,
    robotsNoIndex: robotsNoIndex !== undefined ? Boolean(robotsNoIndex) : existing.robotsNoIndex
  } as any;

  savePersistedState();
  res.json(productCategories[index]);
};

app.put(['/api/product-categories/:id', '/api/product-category/:id'], handleCategoryUpdate);
app.patch(['/api/product-categories/:id', '/api/product-category/:id'], handleCategoryUpdate);
app.post(['/api/product-categories/:id', '/api/product-category/:id'], handleCategoryUpdate);

const handleCategoryDelete = (req: Request, res: Response) => {
  const id = Number(req.params.id);
  productCategories = productCategories.filter(c => c.id !== id);
  savePersistedState();
  res.json({ message: 'دسته‌بندی با موفقیت حذف شد' });
};

app.delete(['/api/product-categories/:id', '/api/product-category/:id'], handleCategoryDelete);
app.post(['/api/product-categories/:id/delete', '/api/product-category/:id/delete'], handleCategoryDelete);

// Posts / Articles
app.get('/api/posts', (req: Request, res: Response) => {
  const isAdmin = isRequestAdminAuthorized(req);
  const visiblePosts = posts.filter(
    (p: any) => isAdmin || (p.status || 'published') === 'published'
  );
  res.json(visiblePosts);
});

app.post('/api/posts', (req: Request, res: Response) => {
  const {
    title,
    slug,
    categoryId,
    description,
    content,
    imageName,
    imageAlt,
    authorName,
    status,
    publishedAt,
    seoTitle,
    seoDescription,
    ogTitle,
    ogDescription,
    ogImage,
    canonicalUrl,
    robotsNoIndex,
    robotsNoFollow
  } = req.body;
  if (!title) return res.status(400).json({ error: 'عنوان مقاله الزامی است' });

  const nextId = posts.length > 0 ? Math.max(...posts.map(p => p.id)) + 1 : 1;
  const candidateSlug = sanitizeSlug(slug || title, 'article', nextId);
  if (isSlugDuplicate(posts as any, candidateSlug)) {
    return res.status(400).json({ error: `نامک (Slug) مقاله «${candidateSlug}» تکراری است.` });
  }

  const cat = postCategories.find(c => c.id === Number(categoryId));
  const nowIso = new Date().toISOString();
  const newPost: any = {
    id: nextId,
    title,
    slug: candidateSlug,
    categoryId: Number(categoryId) || (postCategories[0]?.id ?? 1),
    categoryTitle: cat ? cat.title : 'عمومی',
    description: description || '',
    content: content || '',
    imageName: imageName || 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop&q=80',
    imageAlt: imageAlt || title,
    videoUrl: req.body.videoUrl || '',
    videoType: req.body.videoType || 'direct',
    viewCount: 0,
    authorName: authorName || 'تحریریه اونیوال',
    creationTime: new Date().toLocaleDateString('fa-IR'),
    publishedAt: publishedAt || nowIso,
    updatedAt: nowIso,
    status: status === 'draft' ? 'draft' : 'published',
    seoTitle: seoTitle || '',
    seoDescription: seoDescription || '',
    ogTitle: ogTitle || '',
    ogDescription: ogDescription || '',
    ogImage: ogImage || '',
    canonicalUrl: canonicalUrl || '',
    robotsNoIndex: Boolean(robotsNoIndex),
    robotsNoFollow: Boolean(robotsNoFollow)
  };

  posts.push(newPost);
  savePersistedState();
  res.status(201).json(newPost);
});

app.put('/api/posts/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const index = posts.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: 'مقاله یافت نشد' });

  const existing: any = posts[index];
  const {
    title,
    slug,
    categoryId,
    description,
    content,
    imageName,
    imageAlt,
    authorName,
    status,
    seoTitle,
    seoDescription,
    ogTitle,
    ogDescription,
    ogImage,
    canonicalUrl,
    robotsNoIndex,
    robotsNoFollow
  } = req.body;

  const nextSlug = slug !== undefined && String(slug).trim() !== ''
    ? sanitizeSlug(slug, 'article', id)
    : existing.slug;

  if (isSlugDuplicate(posts as any, nextSlug, id)) {
    return res.status(400).json({ error: `نامک (Slug) مقاله «${nextSlug}» تکراری است.` });
  }

  if (existing.slug && existing.slug !== nextSlug && (existing.status || 'published') === 'published') {
    const fromPath = `/articles/${existing.slug}`;
    const toPath = `/articles/${nextSlug}`;
    slugRedirects = slugRedirects
      .filter(r => r.fromPath !== fromPath && r.fromPath !== toPath)
      .map(r => (r.toPath === fromPath ? { ...r, toPath } : r));
    slugRedirects.push({
      fromPath,
      toPath,
      entityType: 'article',
      entityId: id,
      createdAt: new Date().toISOString()
    });
  }

  const cat = postCategories.find(c => c.id === Number(categoryId ?? existing.categoryId));

  posts[index] = {
    ...existing,
    title: title ?? existing.title,
    slug: nextSlug,
    categoryId: categoryId ? Number(categoryId) : existing.categoryId,
    categoryTitle: cat ? cat.title : existing.categoryTitle,
    description: description ?? existing.description,
    content: content ?? existing.content,
    imageName: imageName ?? existing.imageName,
    imageAlt: imageAlt ?? existing.imageAlt,
    videoUrl: req.body.videoUrl !== undefined ? req.body.videoUrl : existing.videoUrl,
    videoType: req.body.videoType !== undefined ? req.body.videoType : existing.videoType,
    authorName: authorName ?? existing.authorName,
    updatedAt: new Date().toISOString(),
    status: status ?? existing.status ?? 'published',
    seoTitle: seoTitle ?? existing.seoTitle,
    seoDescription: seoDescription ?? existing.seoDescription,
    ogTitle: ogTitle ?? existing.ogTitle,
    ogDescription: ogDescription ?? existing.ogDescription,
    ogImage: ogImage ?? existing.ogImage,
    canonicalUrl: canonicalUrl ?? existing.canonicalUrl,
    robotsNoIndex: robotsNoIndex !== undefined ? Boolean(robotsNoIndex) : existing.robotsNoIndex,
    robotsNoFollow: robotsNoFollow !== undefined ? Boolean(robotsNoFollow) : existing.robotsNoFollow
  } as any;

  savePersistedState();
  res.json(posts[index]);
});

app.delete('/api/posts/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  posts = posts.filter(p => p.id !== id);
  savePersistedState();
  res.json({ message: 'مقاله با موفقیت حذف شد' });
});

// Post Categories
app.get('/api/post-categories', (req: Request, res: Response) => {
  res.json(postCategories);
});

app.post('/api/post-categories', (req: Request, res: Response) => {
  const { title, slug, parentId, description, status, seoTitle, seoDescription, robotsNoIndex } = req.body;
  if (!title) return res.status(400).json({ error: 'عنوان دسته‌بندی مقاله الزامی است' });

  const nextId = postCategories.length > 0 ? Math.max(...postCategories.map(c => c.id)) + 1 : 1;
  const candidateSlug = sanitizeSlug(slug || title, 'post-cat', nextId);

  const newCat: any = {
    id: nextId,
    title,
    slug: candidateSlug,
    parentId: parentId ? Number(parentId) : null,
    description: description || '',
    status: status === 'draft' ? 'draft' : 'published',
    updatedAt: new Date().toISOString(),
    seoTitle: seoTitle || '',
    seoDescription: seoDescription || '',
    robotsNoIndex: Boolean(robotsNoIndex)
  };

  postCategories.push(newCat);
  savePersistedState();
  res.status(201).json(newCat);
});

app.put('/api/post-categories/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const index = postCategories.findIndex(c => c.id === id);
  if (index === -1) return res.status(404).json({ error: 'دسته‌بندی مقاله یافت نشد' });

  const existing: any = postCategories[index];
  const { title, slug, parentId, description, status, seoTitle, seoDescription, robotsNoIndex } = req.body;
  const nextSlug = slug !== undefined && String(slug).trim() !== ''
    ? sanitizeSlug(slug, 'post-cat', id)
    : existing.slug;

  postCategories[index] = {
    ...existing,
    title: title ?? existing.title,
    slug: nextSlug,
    parentId: parentId !== undefined ? (parentId ? Number(parentId) : null) : existing.parentId,
    description: description ?? existing.description,
    status: status ?? existing.status ?? 'published',
    updatedAt: new Date().toISOString(),
    seoTitle: seoTitle ?? existing.seoTitle,
    seoDescription: seoDescription ?? existing.seoDescription,
    robotsNoIndex: robotsNoIndex !== undefined ? Boolean(robotsNoIndex) : existing.robotsNoIndex
  } as any;

  savePersistedState();
  res.json(postCategories[index]);
});

app.delete('/api/post-categories/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  postCategories = postCategories.filter(c => c.id !== id);
  savePersistedState();
  res.json({ message: 'دسته‌بندی مقاله حذف شد' });
});

// Contact Messages, Consultations & Tracking
app.get('/api/contact', (req: Request, res: Response) => {
  res.json(contactMessages);
});

// Dedicated Consultation Booking Endpoint (Creates both Official Invoice Order + Consultation Message Record)
app.post('/api/consultations/book', (req: Request, res: Response) => {
  if (!checkEndpointRateLimit(req, 'consultation_book', 10, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'تعداد درخواست‌های رزرو مشاوره شما بیش از حد مجاز است. لطفاً کمی بعد تلاش کنید.' });
  }

  const rawBody = req.body || {};
  const fullName = String(rawBody.fullName || '').trim().slice(0, 150);
  const phoneNumber = String(rawBody.phoneNumber || '').trim().slice(0, 30);
  const topicTitle = String(rawBody.topicTitle || '').trim().slice(0, 200);
  const socialContactId = String(rawBody.socialContactId || '').trim().slice(0, 100);
  const question = String(rawBody.question || '').trim().slice(0, 1500);

  const topicId = rawBody.topicId ? String(rawBody.topicId).trim().slice(0, 80) : undefined;
  const preferredDate = rawBody.preferredDate ? String(rawBody.preferredDate).trim().slice(0, 100) : undefined;
  const preferredTimeSlot = rawBody.preferredTimeSlot ? String(rawBody.preferredTimeSlot).trim().slice(0, 100) : undefined;
  const socialPlatform = rawBody.socialPlatform ? String(rawBody.socialPlatform).trim().slice(0, 100) : undefined;
  const price = rawBody.price;
  const durationMinutes = rawBody.durationMinutes ? Number(rawBody.durationMinutes) : undefined;

  if (!fullName || !phoneNumber || !topicTitle) {
    return res.status(400).json({ error: 'نام، شماره تماس و موضوع مشاوره الزامی است.' });
  }

  // SERVER-SIDE PRICE DERIVATION: Never trust client-supplied price
  let resolvedPrice = siteContent.consultationConfig?.basePrice ?? 120000;
  if (topicId && Array.isArray(siteContent.consultationConfig?.topics)) {
    const matchedTopic = siteContent.consultationConfig.topics.find((t: any) => t.id === topicId);
    if (matchedTopic && typeof matchedTopic.price === 'number') {
      resolvedPrice = Math.max(0, matchedTopic.price);
    }
  }
  const trackingCode = `ONV-CNS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const botUser = (telegramConfig.baleBotUsername || telegramConfig.botUsername || 'Onivalbot').replace(/^@/, '');
  const balePaymentUrl = `https://ble.ir/${botUser}?start=pay_${trackingCode}`;
  const nowDate = new Date().toLocaleDateString('fa-IR');
  const nowTime = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

  const consultationDetails = {
    topicId: topicId || 'custom',
    topicTitle,
    preferredDate: preferredDate || 'اولین روز کاری',
    preferredTimeSlot: preferredTimeSlot || 'نوبت عصر (۱۶:۰۰ الی ۱۹:۰۰)',
    socialPlatform: socialPlatform || 'پیام‌رسان بله (Bale)',
    socialContactId: socialContactId || phoneNumber,
    price: resolvedPrice,
    durationMinutes: durationMinutes || 30,
    question: question || '',
    consultationStatus: resolvedPrice > 0 ? ('PendingPayment' as const) : ('Scheduled' as const)
  };

  const newOrderId = orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 101;
  const newOrder: any = {
    id: newOrderId,
    userFullName: fullName,
    phoneNumber,
    userAddress: `مشاوره آنلاین در ${consultationDetails.socialPlatform} | آیدی/شماره: ${consultationDetails.socialContactId} | زمان: ${consultationDetails.preferredDate} - ${consultationDetails.preferredTimeSlot}`,
    totalPrice: resolvedPrice,
    status: resolvedPrice > 0 ? ('Pending' as const) : ('Processing' as const),
    paymentStatus: resolvedPrice > 0 ? ('Unpaid' as const) : ('Paid' as const),
    paymentMethod: siteContent.paymentConfig?.defaultMethod || 'card_to_card',
    trackingCode,
    creationTime: nowDate,
    balePaymentUrl,
    isConsultation: true,
    consultationDetails,
    items: [
      {
        id: 1,
        productId: 9000,
        productName: `رزرو مشاوره تخصصی: ${topicTitle}`,
        size: `${consultationDetails.preferredDate} | ${consultationDetails.preferredTimeSlot} (${consultationDetails.socialPlatform})`,
        quantity: 1,
        unitPrice: resolvedPrice,
        totalPrice: resolvedPrice
      }
    ]
  };

  orders.unshift(newOrder);

  const formattedMessage =
    `[رزرو مشاوره تخصصی - موضوع: ${topicTitle}]\n` +
    `📅 زمان انتخابی: ${consultationDetails.preferredDate} | ${consultationDetails.preferredTimeSlot}\n` +
    `📱 شبکه اجتماعی انتخابی: ${consultationDetails.socialPlatform} - آیدی/شماره: ${consultationDetails.socialContactId}\n` +
    `💳 هزینه مشاوره: ${resolvedPrice > 0 ? `${resolvedPrice.toLocaleString('fa-IR')} تومان` : 'رایگان'}\n` +
    `📝 شرح پرسش: ${question || 'بدون توضیحات تکمیلی'}`;

  const newMsg: any = {
    id: contactMessages.length > 0 ? Math.max(...contactMessages.map(m => m.id)) + 1 : 1,
    fullName,
    phoneNumber,
    trackingCode,
    message: formattedMessage,
    adminResponse: undefined,
    isRead: false,
    isResponded: false,
    creationTime: `${nowDate} - ${nowTime}`,
    isConsultation: true,
    orderId: newOrder.id,
    paymentStatus: newOrder.paymentStatus,
    paymentMethod: newOrder.paymentMethod,
    totalPrice: resolvedPrice,
    consultationDetails
  };

  contactMessages.unshift(newMsg);
  savePersistedState();

  botActivityLogs.unshift({
    id: Date.now(),
    time: nowTime,
    type: 'new_consultation_booked',
    platform: 'bale',
    text: `رزرو مشاوره جدید توسط ${fullName} با کد ${trackingCode} (موضوع: ${topicTitle} - مبلغ: ${resolvedPrice.toLocaleString('fa-IR')} تومان)`,
    status: 'success'
  });

  if (telegramConfig.notifyOnNewTicket !== false || telegramConfig.notifyOnNewOrder !== false) {
    dispatchBotNotification(
      `🩺 رزرو مشاوره تخصصی جدید - اونیوال\n` +
      `کد رهگیری و فاکتور: ${trackingCode}\n` +
      `نام متقاضی: ${fullName} (${phoneNumber})\n` +
      `موضوع: ${topicTitle}\n` +
      `زمان انتخابی: ${consultationDetails.preferredDate} | ${consultationDetails.preferredTimeSlot}\n` +
      `شبکه اجتماعی ارتباط: ${consultationDetails.socialPlatform} (${consultationDetails.socialContactId})\n` +
      `مبلغ قابل پرداخت: ${resolvedPrice.toLocaleString('fa-IR')} تومان\n` +
      `پرسش کاربر: ${question || '-'}`,
      'new_consultation_booked'
    ).catch(() => {});
  }

  res.status(201).json({
    success: true,
    trackingCode,
    order: newOrder,
    consultation: newMsg
  });
});

app.post('/api/contact', (req: Request, res: Response) => {
  if (!checkEndpointRateLimit(req, 'contact_submit', 10, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'تعداد پیام‌های ارسالی شما بیش از حد مجاز است. لطفاً کمی بعد مجدداً اقدام فرمایید.' });
  }

  const { isConsultation, consultationDetails } = req.body;
  const fullName = String(req.body.fullName || '').trim().slice(0, 150);
  const phoneNumber = String(req.body.phoneNumber || '').trim().slice(0, 30);
  const message = String(req.body.message || '').trim().slice(0, 1500);
  if (!fullName || !message) return res.status(400).json({ error: 'نام و متن پیام الزامی است' });

  const trackingCode = req.body.trackingCode || `ONV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const newMsg: any = {
    id: contactMessages.length > 0 ? Math.max(...contactMessages.map(m => m.id)) + 1 : 1,
    fullName,
    phoneNumber,
    trackingCode,
    message,
    adminResponse: undefined,
    isRead: false,
    isResponded: false,
    creationTime: `${new Date().toLocaleDateString('fa-IR')} - ${new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`,
    isConsultation: Boolean(isConsultation),
    consultationDetails: consultationDetails || undefined
  };

  contactMessages.unshift(newMsg);
  savePersistedState();

  botActivityLogs.unshift({
    id: Date.now(),
    time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    type: 'new_contact_message',
    platform: 'bale',
    text: `پیام جدید از ${fullName} (کد پیگیری: ${trackingCode})`,
    status: 'success'
  });

  if (telegramConfig.notifyOnNewTicket !== false) {
    dispatchBotNotification(
      `📩 پیام پشتیبانی / مشاوره جدید\nکد پیگیری: ${trackingCode}\nنام کاربر: ${fullName}\nتلفن: ${phoneNumber || 'ثبت نشده'}\nمتن پیام:\n${message}`,
      'new_contact_message'
    ).catch(() => {});
  }

  res.status(201).json(newMsg);
});

app.post('/api/contact/:id/respond', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { response, consultationStatus } = req.body;
  if (!response) return res.status(400).json({ error: 'لطفاً پاسخ را وارد کنید' });

  const msg: any = contactMessages.find(m => m.id === id);
  if (!msg) return res.status(404).json({ error: 'پیام یافت نشد' });

  const respondedAt = `${new Date().toLocaleDateString('fa-IR')} - ${new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`;
  msg.adminResponse = response;
  msg.isResponded = true;
  msg.isRead = true;
  msg.respondedAt = respondedAt;
  if (msg.consultationDetails) {
    msg.consultationDetails.adminResponse = response;
    msg.consultationDetails.respondedAt = respondedAt;
    msg.consultationDetails.consultationStatus = consultationStatus || 'Completed';
  }

  // Sync response to linked consultation order if present
  const linkedOrder: any = orders.find(o => o.trackingCode.toUpperCase() === msg.trackingCode.toUpperCase() || (msg.orderId && o.id === msg.orderId));
  if (linkedOrder) {
    if (linkedOrder.consultationDetails) {
      linkedOrder.consultationDetails.adminResponse = response;
      linkedOrder.consultationDetails.respondedAt = respondedAt;
      linkedOrder.consultationDetails.consultationStatus = consultationStatus || 'Completed';
    }
    if (consultationStatus === 'Completed' || !consultationStatus) {
      linkedOrder.status = 'Completed';
    }
  }

  savePersistedState();

  botActivityLogs.unshift({
    id: Date.now(),
    time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    type: 'admin_response',
    platform: 'bale',
    text: `ارسال پاسخ مدیر برای پیام ${msg.trackingCode} به ربات بله/تلگرام`,
    status: 'success'
  });

  dispatchBotNotification(
    `💬 پاسخ پشتیبانی / کارشناس اونیوال برای #${msg.trackingCode} (${msg.fullName}):\n${response}`,
    'admin_response'
  ).catch(() => {});

  res.json({ message: 'پاسخ با موفقیت ثبت شد', data: msg });
});

app.delete('/api/contact/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  contactMessages = contactMessages.filter(m => m.id !== id);
  savePersistedState();
  res.json({ message: 'پیام با موفقیت حذف شد' });
});

// Orders
app.get('/api/orders', (req: Request, res: Response) => {
  res.json(orders);
});

app.get('/api/orders/track/:code', (req: Request, res: Response) => {
  if (!checkEndpointRateLimit(req, 'order_track', 30, 60 * 1000)) {
    return res.status(429).json({ found: false, error: 'تعداد استعلام‌های رهگیری بیش از حد مجاز است. لطفاً یک دقیقه دیگر تلاش فرمایید.' });
  }

  const code = (req.params.code || '').trim().toUpperCase();
  const order: any = orders.find(o => o.trackingCode.toUpperCase() === code);
  const msg: any = contactMessages.find(m => m.trackingCode.toUpperCase() === code);
  const isAdmin = isRequestAdminAuthorized(req);

  if (order) {
    if (msg) {
      order.adminResponse = msg.adminResponse || order.consultationDetails?.adminResponse;
      order.respondedAt = msg.respondedAt || order.consultationDetails?.respondedAt;
      if (order.consultationDetails && msg.adminResponse) {
        order.consultationDetails.adminResponse = msg.adminResponse;
        order.consultationDetails.respondedAt = msg.respondedAt;
      }
    }

    // Public sanitized order view protecting customer PII and disk/network payload
    const safeOrder = isAdmin ? order : {
      id: order.id,
      trackingCode: order.trackingCode,
      userFullName: order.userFullName,
      phoneNumber: maskPhone(order.phoneNumber),
      userAddress: maskAddr(order.userAddress),
      totalPrice: order.totalPrice,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      creationTime: order.creationTime,
      balePaymentUrl: order.balePaymentUrl,
      items: order.items,
      hasReceipt: Boolean(order.receiptImageUrl || order.receiptImage),
      receiptSubmittedAt: order.receiptSubmittedAt || order.receiptUploadedAt,
      isConsultation: order.isConsultation,
      consultationDetails: order.consultationDetails ? {
        topicTitle: order.consultationDetails.topicTitle,
        preferredDate: order.consultationDetails.preferredDate,
        preferredTimeSlot: order.consultationDetails.preferredTimeSlot,
        socialPlatform: order.consultationDetails.socialPlatform,
        consultationStatus: order.consultationDetails.consultationStatus,
        adminResponse: order.consultationDetails.adminResponse,
        respondedAt: order.consultationDetails.respondedAt
      } : undefined
    };

    const safeMsg = msg ? (isAdmin ? msg : {
      id: msg.id,
      trackingCode: msg.trackingCode,
      fullName: msg.fullName,
      creationTime: msg.creationTime,
      isResponded: msg.isResponded,
      adminResponse: msg.adminResponse,
      respondedAt: msg.respondedAt
    }) : null;

    return res.json({ found: true, type: 'order', data: safeOrder, messageData: safeMsg });
  }

  if (msg) {
    const safeMsg = isAdmin ? msg : {
      id: msg.id,
      trackingCode: msg.trackingCode,
      fullName: msg.fullName,
      creationTime: msg.creationTime,
      isResponded: msg.isResponded,
      adminResponse: msg.adminResponse,
      respondedAt: msg.respondedAt
    };
    return res.json({ found: true, type: 'message', data: safeMsg });
  }

  res.status(404).json({ found: false, error: 'سفارشی یا پیامی با این کد رهگیری یافت نشد' });
});

// Single-execution inventory and special-offer quota deduction upon confirmed payment
function deductOrderInventoryOnPayment(order: any): void {
  if (!order || order.inventoryDeducted) return;
  if (!Array.isArray(order.items)) return;

  for (const it of order.items) {
    const prodId = Number(it.productId || it.id);
    const matched = products.find(p => p.id === prodId && !p.isDelete);
    const qty = Math.max(1, Math.min(100, Number(it.quantity) || 1));
    if (!matched) continue;

    let matchedSize: any = null;
    if (it.size && Array.isArray(matched.sizes)) {
      matchedSize = matched.sizes.find((s: any) => s.size === it.size || s.name === it.size);
    }

    // Deduct specific packaging variant stock & quota
    if (matchedSize) {
      if (matchedSize.stock !== undefined) {
        matchedSize.stock = Math.max(0, matchedSize.stock - qty);
        if (matchedSize.stock === 0) {
          matchedSize.isOutOfStock = true;
        }
      }
      if (matchedSize.specialOfferStock !== undefined && matchedSize.specialOfferStock > 0) {
        matchedSize.specialOfferStock = Math.max(0, matchedSize.specialOfferStock - qty);
      }
    }

    // Deduct aggregate product inventory stock
    if (matched.stock !== undefined) {
      matched.stock = Math.max(0, matched.stock - qty);
      if (matched.stock === 0) {
        matched.isOutOfStock = true;
        matched.availability = 'OutOfStock';
      }
    }

    // Deduct aggregate special offer quota
    if (matched.specialOfferStock !== undefined && matched.specialOfferStock > 0) {
      matched.specialOfferStock = Math.max(0, matched.specialOfferStock - qty);
      if (matched.specialOfferStock === 0) {
        matched.isAmazingOffer = false;
        matched.isSpecialOffer = false;
      }
    }
  }

  order.inventoryDeducted = true;
  savePersistedState();
}

// Restore inventory stock and quota when an order is cancelled
function restoreOrderInventoryOnCancel(order: any): void {
  if (!order || !order.inventoryDeducted) return;
  if (!Array.isArray(order.items)) return;

  for (const it of order.items) {
    const prodId = Number(it.productId || it.id);
    const matched = products.find(p => p.id === prodId && !p.isDelete);
    const qty = Math.max(1, Math.min(100, Number(it.quantity) || 1));
    if (!matched) continue;

    let matchedSize: any = null;
    if (it.size && Array.isArray(matched.sizes)) {
      matchedSize = matched.sizes.find((s: any) => s.size === it.size || s.name === it.size);
    }

    if (matchedSize) {
      if (matchedSize.stock !== undefined) {
        matchedSize.stock = matchedSize.stock + qty;
        matchedSize.isOutOfStock = false;
      }
      if (matchedSize.specialOfferStock !== undefined && (matchedSize.specialOfferStock > 0 || matched.isAmazingOffer || matched.isSpecialOffer)) {
        matchedSize.specialOfferStock = matchedSize.specialOfferStock + qty;
      }
    }

    if (matched.stock !== undefined) {
      matched.stock = matched.stock + qty;
      matched.isOutOfStock = false;
      matched.availability = 'InStock';
    }

    if (matched.specialOfferStock !== undefined && (matched.specialOfferStock > 0 || matched.isAmazingOffer || matched.isSpecialOffer)) {
      matched.specialOfferStock = matched.specialOfferStock + qty;
      if (matched.discount && Number(matched.discount) > 0) {
        matched.isSpecialOffer = true;
      }
    }
  }

  order.inventoryDeducted = false;
  savePersistedState();
}

app.post('/api/orders', (req: Request, res: Response) => {
  if (!checkEndpointRateLimit(req, 'create_order', 15, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'تعداد سفارش‌های ثبت شده شما در این بازه زمانی بیش از حد مجاز است.' });
  }

  const userFullName = String(req.body.userFullName || '').trim().slice(0, 150);
  const phoneNumber = String(req.body.phoneNumber || '').trim().slice(0, 30);
  const userAddress = String(req.body.userAddress || '').trim().slice(0, 500);
  const { items, paymentMethod } = req.body;
  if (!userFullName || !phoneNumber || !userAddress) {
    return res.status(400).json({ error: 'اطلاعات گیرنده و آدرس الزامی است' });
  }

  // Server-Authoritative Price Calculation from Database
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'سبد خرید خالی است. لطفاً حداقل یک محصول را برای ثبت سفارش انتخاب نمایید.' });
  }

  let calculatedTotal = 0;
  const verifiedItems: any[] = [];

  for (const it of items) {
    const prodId = Number(it.productId || it.id);
    const matched = products.find(p => p.id === prodId && !p.isDelete);
    if (!matched) {
      return res.status(400).json({ error: `محصول انتخابی (شناسه: ${prodId}) در فروشگاه موجود نیست یا غیرفعال گردیده است.` });
    }

    const qty = Math.max(1, Math.min(100, Number(it.quantity) || 1));
    let unitPrice = Number(matched.price) || 0;
    let matchedSize: any = null;

    if (it.size && Array.isArray(matched.sizes) && matched.sizes.length > 0) {
      matchedSize = matched.sizes.find((s: any) => s.size === it.size || s.name === it.size);
      if (matchedSize && matchedSize.price) {
        unitPrice = Number(matchedSize.price);
      }
    }

    // Stock availability verification before order acceptance
    if (matchedSize) {
      if (matchedSize.isOutOfStock || (matchedSize.stock !== undefined && matchedSize.stock < qty)) {
        return res.status(400).json({
          error: `موجودی بسته «${matchedSize.name || matchedSize.size}» از محصول «${matched.title}» کافی نیست (موجودی فعلی: ${matchedSize.stock ?? 0} عدد).`
        });
      }
    } else if (matched.isOutOfStock || (matched.stock !== undefined && matched.stock < qty)) {
      return res.status(400).json({
        error: `موجودی محصول «${matched.title}» کافی نیست (موجودی فعلی: ${matched.stock ?? 0} عدد).`
      });
    }

    const hasDiscount = Boolean(matched.discount && Number(matched.discount) > 0);
    const isSpecial = Boolean(matched.isAmazingOffer || matched.isSpecialOffer);
    let isOfferActive = hasDiscount;
    if (hasDiscount && isSpecial) {
      if (matchedSize && matchedSize.specialOfferStock !== undefined) {
        isOfferActive = matchedSize.specialOfferStock > 0;
      } else if (matched.specialOfferStock !== undefined) {
        isOfferActive = matched.specialOfferStock > 0;
      }
    }

    if (isOfferActive) {
      unitPrice = Math.round(unitPrice * (100 - Number(matched.discount)) / 100);
    }

    calculatedTotal += unitPrice * qty;
    verifiedItems.push({
      ...it,
      productId: prodId,
      productName: matched.title,
      unitPrice,
      price: unitPrice,
      quantity: qty,
      totalPrice: unitPrice * qty
    });
  }

  const finalTotalPrice = calculatedTotal;
  const generatedCode = `ONV-ORD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  const botUser = (telegramConfig.baleBotUsername || telegramConfig.botUsername || 'Onivalbot').replace(/^@/, '');
  const balePaymentUrl = `https://ble.ir/${botUser}?start=pay_${generatedCode}`;

  const newOrder: any = {
    id: orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 101,
    userFullName,
    phoneNumber,
    userAddress,
    totalPrice: finalTotalPrice,
    status: 'Pending' as const,
    paymentStatus: 'Unpaid' as const,
    paymentMethod: paymentMethod || siteContent.paymentConfig?.defaultMethod || 'card_to_card',
    receiptImageUrl: undefined,
    receiptNote: undefined,
    receiptSubmittedAt: undefined,
    trackingCode: generatedCode,
    creationTime: new Date().toLocaleDateString('fa-IR'),
    balePaymentUrl,
    items: verifiedItems
  };

  orders.unshift(newOrder);
  savePersistedState();

  // Send transaction notification to Bale Bot & Telegram Admin
  if (telegramConfig.notifyOnNewOrder !== false && (telegramConfig.baleAdminChatId || telegramConfig.adminChatId)) {
    const itemsSummary = (newOrder.items || [])
      .map((it: any) => `▫️ ${it.productName} (${it.size || 'استاندارد'}) × ${it.quantity} عدد`)
      .join('\n');

    const isCardToCard = newOrder.paymentMethod === 'card_to_card';
    const invoiceMsg =
      `🧾 فاکتور جدید صادر شد - فروشگاه اونیوال (ONIVAL)\n\n` +
      `🔖 کد رهگیری: ${generatedCode}\n` +
      `💳 روش پرداخت انتخابی: ${isCardToCard ? 'کارت به کارت (منتظر فیش)' : 'کیف پول بله (Bale Wallet)'}\n` +
      `👤 خریدار: ${userFullName}\n` +
      `📞 شماره تماس: ${phoneNumber}\n` +
      `💰 مبلغ قابل پرداخت: ${Number(finalTotalPrice).toLocaleString('fa-IR')} تومان\n` +
      `📍 آدرس تحویل: ${userAddress}\n\n` +
      `📦 اقلام فاکتور:\n${itemsSummary}\n\n` +
      `🔗 لینک اختصاصی پرداخت مشتری در بله:\n${balePaymentUrl}\n\n` +
      `⚡ جهت تایید فوری این سفارش توسط ادمین، دستور زیر را ارسال کنید:\n/confirm_${generatedCode}`;

    dispatchBotNotification(invoiceMsg, 'new_order_placed').catch(() => {});
  }

  botActivityLogs.unshift({
    id: Date.now(),
    time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    type: 'new_order_placed',
    platform: 'bale',
    text: `فاکتور جدید ${newOrder.trackingCode} صادر و جهت پرداخت/تایید به ربات بله ارجاع شد. مبلغ: ${Number(newOrder.totalPrice || 0).toLocaleString('fa-IR')} تومان`,
    status: 'success'
  });

  res.status(201).json(newOrder);
});

app.post('/api/orders/:id/confirm-bale-payment', (req: Request, res: Response) => {
  const param = (req.params.id || '').trim();
  const isAdmin = isRequestAdminAuthorized(req);

  if (!isAdmin) {
    return res.status(401).json({
      ok: false,
      error: 'دسترسی غیرمجاز: تایید مستقیم و دستی پرداخت فقط توسط مدیر احراز هویت شده امکان‌پذیر است.'
    });
  }

  const order: any = orders.find(o => o.id === Number(param) || o.trackingCode.toUpperCase() === param.toUpperCase());
  if (!order) return res.status(404).json({ error: 'سفارش یافت نشد' });

  order.paymentMethod = 'bale_bot';
  order.paymentStatus = 'Paid';
  order.status = 'Processing'; // در حال آماده‌سازی
  if (order.consultationDetails) {
    order.consultationDetails.consultationStatus = 'Scheduled';
  }

  // Deduct inventory and special-offer quota once upon confirmed payment
  deductOrderInventoryOnPayment(order);

  const linkedMsg: any = contactMessages.find(m => m.trackingCode.toUpperCase() === order.trackingCode.toUpperCase());
  if (linkedMsg) {
    linkedMsg.paymentStatus = 'Paid';
    linkedMsg.paymentMethod = 'bale_bot';
    if (linkedMsg.consultationDetails) {
      linkedMsg.consultationDetails.consultationStatus = 'Scheduled';
    }
  }
  savePersistedState();

  botActivityLogs.unshift({
    id: Date.now(),
    time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    type: 'bale_payment_success',
    text: `پرداخت سفارش ${order.trackingCode} در ربات بله با موفقیت تایید شد. وضعیت سفارش به "در حال آماده‌سازی" تغییر یافت.`,
    status: 'success'
  });

  const safeConfirmation = {
    trackingCode: order.trackingCode,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod
  };

  res.json({
    success: true,
    order: isAdmin ? order : safeConfirmation,
    message: 'پرداخت در ربات بله تایید شد و وضعیت به در حال آماده‌سازی تغییر کرد'
  });
});

app.post('/api/orders/:id/upload-receipt', (req: Request, res: Response) => {
  // Strict rate limit: max 6 receipt uploads per 15 minutes per IP
  if (!checkEndpointRateLimit(req, 'upload_receipt', 6, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'تعداد درخواست‌های بارگذاری فیش بیش از حد مجاز است. لطفاً پس از ۱۵ دقیقه مجدداً تلاش فرمایید.' });
  }

  const param = (req.params.id || '').trim();
  const isAdmin = isRequestAdminAuthorized(req);

  // CRITICAL ANTI-IDOR & ANTI-ENUMERATION GUARD:
  // Public non-admin requests MUST strictly provide the random tracking code (e.g. ONV-ORD-..., ONV-CNS-...).
  // They MUST NEVER be permitted to lookup by sequential numeric ID (e.g. 101, 102).
  if (!isAdmin && (/^\d+$/.test(param) || param.length < 6)) {
    return res.status(400).json({
      error: 'جهت بارگذاری فیش واریزی، ارائه کد رهگیری یکتا و معتبر الزامی است (استفاده از شناسه عددی مجاز نمی‌باشد).'
    });
  }

  const order: any = orders.find(o => {
    if (isAdmin && o.id === Number(param)) return true;
    return o.trackingCode.toUpperCase() === param.toUpperCase();
  });

  if (!order) {
    return res.status(404).json({ error: 'فاکتور با کد رهگیری ارائه شده یافت نشد.' });
  }

  // Prevent modifying already completed or settled orders
  if (order.paymentStatus === 'Paid' || order.status === 'Completed') {
    return res.status(400).json({ error: 'این سفارش قبلاً تسویه گردیده و امکان تغییر فیش آن وجود ندارد.' });
  }

  const receiptImg = req.body.receiptImageUrl || req.body.receiptImage;
  const { receiptNote } = req.body;
  if (!receiptImg) {
    return res.status(400).json({ error: 'لطفاً تصویر فیش واریزی را انتخاب نمایید' });
  }

  if (typeof receiptImg !== 'string' || (!receiptImg.startsWith('data:image/') && !/^https?:\/\//i.test(receiptImg))) {
    return res.status(400).json({ error: 'فرمت تصویر فیش واریزی نامعتبر است.' });
  }

  // Image size limit check: Max 2MB (~2.8MB base64 representation)
  if (typeof receiptImg === 'string' && receiptImg.length > 2.8 * 1024 * 1024) {
    return res.status(400).json({ error: 'حجم تصویر فیش واریزی بیش از حد مجاز (حداکثر ۲ مگابایت) است. لطفاً تصویر کم‌حجم‌تری انتخاب فرمایید.' });
  }

  let storedImageUrl = receiptImg;
  if (receiptImg.startsWith('data:image/')) {
    const match = receiptImg.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/i);
    if (!match) {
      return res.status(400).json({ error: 'فرمت تصویر فیش واریزی نامعتبر است. فقط فرمت‌های PNG، JPG و WebP مجاز هستند.' });
    }
    try {
      const rawExt = match[1].toLowerCase();
      const ext = rawExt === 'jpeg' ? 'jpg' : rawExt.replace(/[^a-z0-9]/g, '');
      const buffer = Buffer.from(match[2], 'base64');
      const cleanTrack = order.trackingCode.replace(/[^A-Za-z0-9_-]/g, '');
      const filename = `receipt-${cleanTrack}-${Date.now()}.${ext || 'jpg'}`;
      const filePath = path.join(RECEIPTS_DIR, filename);
      fs.writeFileSync(filePath, buffer);
      storedImageUrl = `/api/admin/receipts/${filename}`;
    } catch (e) {
      console.warn('Failed to save receipt to disk, using memory fallback:', e);
    }
  }

  const timestamp = `${new Date().toLocaleDateString('fa-IR')} - ${new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`;
  order.receiptImageUrl = storedImageUrl;
  delete order.receiptImage;
  order.receiptNote = typeof receiptNote === 'string' ? receiptNote.slice(0, 500) : '';
  order.receiptSubmittedAt = timestamp;
  order.receiptUploadedAt = timestamp;
  order.paymentMethod = 'card_to_card';
  order.paymentStatus = 'PendingVerification';
  if (order.consultationDetails) {
    order.consultationDetails.consultationStatus = 'PendingVerification';
  }

  const linkedMsg: any = contactMessages.find(m => m.trackingCode.toUpperCase() === order.trackingCode.toUpperCase());
  if (linkedMsg) {
    linkedMsg.receiptImageUrl = storedImageUrl;
    delete linkedMsg.receiptImage;
    linkedMsg.receiptNote = order.receiptNote;
    linkedMsg.receiptUploadedAt = timestamp;
    linkedMsg.paymentMethod = 'card_to_card';
    linkedMsg.paymentStatus = 'PendingVerification';
    if (linkedMsg.consultationDetails) {
      linkedMsg.consultationDetails.consultationStatus = 'PendingVerification';
    }
  }
  savePersistedState();

  botActivityLogs.unshift({
    id: Date.now(),
    time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    type: 'receipt_uploaded',
    platform: 'bale',
    text: `فیش واریزی کارت به کارت برای فاکتور ${order.trackingCode} بارگذاری شد و منتظر تایید است.`,
    status: 'success'
  });

  if (telegramConfig.notifyOnReceiptUpload !== false) {
    const notifyText =
      `📸 فیش واریزی جدید بارگذاری شد!\n\n` +
      `🧾 شماره فاکتور: ${order.trackingCode}\n` +
      `👤 مشتری: ${order.userFullName} (${order.phoneNumber})\n` +
      `💰 مبلغ فاکتور: ${Number(order.totalPrice || 0).toLocaleString('fa-IR')} تومان\n` +
      `📝 توضیحات مشتری: ${order.receiptNote || 'ندارد'}\n` +
      `⏱ زمان ثبت: ${timestamp}\n\n` +
      `👇 جهت تایید فوری فیش و آغاز بسته‌بندی مرسوله، دستور زیر را ارسال فرمایید:\n` +
      `/confirm_${order.trackingCode}`;
    dispatchBotNotification(notifyText, 'receipt_uploaded').catch(() => {});
  }

  // ZERO PII LEAK GUARD:
  // Under NO circumstances return customer PII (full name, phone, address, purchased items, medical notes) to public callers!
  res.json({
    success: true,
    trackingCode: order.trackingCode,
    paymentStatus: order.paymentStatus,
    message: 'تصویر فیش واریزی به همراه شماره فاکتور با موفقیت ثبت شد و جهت تایید برای مدیریت ارسال گردید.'
  });
});

// Protected Receipt Image Viewer for Admin Panel
app.get('/api/admin/receipts/:filename', requireAdminAuth, (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename || '');
  const filePath = path.join(RECEIPTS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'تصویر فیش واریزی در سرور یافت نشد.' });
  }
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(filePath);
});

app.post('/api/orders/:id/verify-receipt', (req: Request, res: Response) => {
  const param = (req.params.id || '').trim();
  const isAdmin = isRequestAdminAuthorized(req);
  if (!isAdmin) {
    return res.status(403).json({ error: 'دسترسی غیرمجاز. فقط مدیر سیستم مجاز به تایید یا رد فیش واریزی است.' });
  }

  const order: any = orders.find(o => o.id === Number(param) || o.trackingCode.toUpperCase() === param.toUpperCase());
  if (!order) return res.status(404).json({ error: 'سفارش یافت نشد' });

  const { approved } = req.body;
  if (approved) {
    order.paymentStatus = 'Paid';
    if (order.status === 'Pending') {
      order.status = 'Processing';
    }
    if (order.consultationDetails) {
      order.consultationDetails.consultationStatus = 'Scheduled';
    }
    // Deduct stock once when payment is confirmed
    deductOrderInventoryOnPayment(order);

    botActivityLogs.unshift({
      id: Date.now(),
      time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      type: 'receipt_approved',
      text: `فیش واریزی فاکتور ${order.trackingCode} توسط مدیر تایید شد و سفارش در وضعیت "در حال آماده‌سازی" قرار گرفت.`,
      status: 'success'
    });
  } else {
    order.paymentStatus = 'Failed';
    if (order.consultationDetails) {
      order.consultationDetails.consultationStatus = 'PendingPayment';
    }
    botActivityLogs.unshift({
      id: Date.now(),
      time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      type: 'receipt_rejected',
      text: `فیش واریزی فاکتور ${order.trackingCode} توسط مدیر رد شد (نیاز به بررسی یا ارسال مجدد).`,
      status: 'warning'
    });
  }

  const linkedMsg: any = contactMessages.find(m => m.trackingCode.toUpperCase() === order.trackingCode.toUpperCase());
  if (linkedMsg) {
    linkedMsg.paymentStatus = order.paymentStatus;
    if (linkedMsg.consultationDetails) {
      linkedMsg.consultationDetails.consultationStatus = approved ? 'Scheduled' : 'PendingPayment';
    }
  }
  savePersistedState();

  res.json({ success: true, order });
});

app.post('/api/orders/:id/confirm-gateway-payment', (req: Request, res: Response) => {
  const param = (req.params.id || '').trim();
  const isAdmin = isRequestAdminAuthorized(req);

  if (!isAdmin) {
    return res.status(401).json({
      ok: false,
      error: 'دسترسی غیرمجاز: تایید مستقیم و دستی پرداخت فقط توسط مدیر احراز هویت شده امکان‌پذیر است.'
    });
  }

  const order: any = orders.find(o => o.id === Number(param) || o.trackingCode.toUpperCase() === param.toUpperCase());
  if (!order) return res.status(404).json({ error: 'سفارش یافت نشد' });

  order.paymentMethod = 'online_gateway';
  order.paymentStatus = 'Paid';
  order.status = 'Processing';
  if (order.consultationDetails) {
    order.consultationDetails.consultationStatus = 'Scheduled';
  }

  // Deduct stock once when payment is confirmed
  deductOrderInventoryOnPayment(order);

  const linkedMsg: any = contactMessages.find(m => m.trackingCode.toUpperCase() === order.trackingCode.toUpperCase());
  if (linkedMsg) {
    linkedMsg.paymentStatus = 'Paid';
    linkedMsg.paymentMethod = 'online_gateway';
    if (linkedMsg.consultationDetails) {
      linkedMsg.consultationDetails.consultationStatus = 'Scheduled';
    }
  }
  savePersistedState();

  botActivityLogs.unshift({
    id: Date.now(),
    time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    type: 'gateway_payment_success',
    text: `پرداخت آنلاین فاکتور ${order.trackingCode} از طریق درگاه بانکی با موفقیت انجام و تایید شد.`,
    status: 'success'
  });

  const safeConfirmation = {
    trackingCode: order.trackingCode,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod
  };

  res.json({ success: true, order: isAdmin ? order : safeConfirmation });
});

app.put('/api/orders/:id/status', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { status, paymentStatus, consultationStatus } = req.body;
  const order: any = orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ error: 'سفارش یافت نشد' });

  if (status) {
    order.status = status;
    if (status === 'Cancelled') {
      restoreOrderInventoryOnCancel(order);
    }
  }
  if (paymentStatus) {
    order.paymentStatus = paymentStatus;
    if (paymentStatus === 'Paid') {
      deductOrderInventoryOnPayment(order);
    } else if (paymentStatus === 'Cancelled') {
      restoreOrderInventoryOnCancel(order);
    }
  }
  if (order.consultationDetails) {
    if (consultationStatus) {
      order.consultationDetails.consultationStatus = consultationStatus;
    } else if (status === 'Completed') {
      order.consultationDetails.consultationStatus = 'Completed';
    } else if (status === 'Cancelled') {
      order.consultationDetails.consultationStatus = 'Cancelled';
    } else if (order.paymentStatus === 'Paid' && order.consultationDetails.consultationStatus === 'PendingPayment') {
      order.consultationDetails.consultationStatus = 'Scheduled';
    }
  }

  const linkedMsg: any = contactMessages.find(m => m.trackingCode.toUpperCase() === order.trackingCode.toUpperCase());
  if (linkedMsg) {
    if (paymentStatus) linkedMsg.paymentStatus = paymentStatus;
    if (linkedMsg.consultationDetails && order.consultationDetails) {
      linkedMsg.consultationDetails.consultationStatus = order.consultationDetails.consultationStatus;
    }
  }

  savePersistedState();

  const statusLabel = status === 'Pending' ? 'در انتظار پرداخت / تایید'
    : status === 'Processing' ? 'در حال آماده‌سازی و بسته‌بندی'
    : status === 'Shipped' ? 'تحویل به پست / ارسال شده'
    : status === 'Completed' ? 'تحویل داده شده به مشتری'
    : status === 'Cancelled' ? 'لغو شده' : status;

  botActivityLogs.unshift({
    id: Date.now(),
    time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    type: 'order_status_update',
    text: `مدیر فروشگاه وضعیت سفارش ${order.trackingCode} را به "${statusLabel}" تغییر داد.`,
    status: 'success'
  });

  res.json(order);
});

function generateBotPhpScript(filename: string): string {
  const cleanName = filename.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  const templatePath = path.join(process.cwd(), 'public', cleanName);

  if (cleanName === 'bale-bot.php') {
    let content = '';
    if (fs.existsSync(templatePath)) {
      content = fs.readFileSync(templatePath, 'utf8');
    }
    const defaultBlock = `// ==============================================================================
// بخش ۱: تنظیمات اختصاصی ربات بله (سازگار با PHP 8.5 - استخراج خودکار از پنل مدیریت)
// ==============================================================================
$DEFAULT_CONFIG = [
    // توکن ربات مشتری بله
    'baleBotToken'       => ${JSON.stringify(telegramConfig.baleBotToken || telegramConfig.botToken || '')},

    // نام کاربری ربات بله
    'baleBotUsername'    => ${JSON.stringify((telegramConfig.baleBotUsername || 'Onivalbot').replace(/^@/, ''))},

    // توکن ربات ادمین بله
    'baleAdminBotToken'  => ${JSON.stringify(telegramConfig.adminBotToken || '')},

    // آیدی عددی چت ادمین در بله
    'baleAdminChatId'    => ${JSON.stringify(telegramConfig.baleAdminChatId || telegramConfig.adminChatId || '')},

    // نام کاربری ادمین
    'baleAdminUsername'  => ${JSON.stringify((telegramConfig.baleAdminUsername || '').replace(/^@/, ''))},

    // توکن درگاه کیف‌پول بله (Wallet Provider Token)
    'baleProviderToken'  => ${JSON.stringify(telegramConfig.balePaymentTokenLive || '')},

    // توکن امنیتی وب‌هوک
    'webhookSecretToken' => ${JSON.stringify(telegramConfig.webhookSecretToken || '')},

    // شماره کارت فروشگاه جهت پرداخت کارت به کارت
    'cardNumber'         => ${JSON.stringify(siteContent?.paymentConfig?.cardNumber || '۶۰۳۷-۹۹۷۵-۹۹۱۲-۳۴۵۶')},
    'cardHolder'         => ${JSON.stringify(siteContent?.paymentConfig?.cardHolderName || 'مجموعه تخصصی فرآورده‌های ارگانیک اونیوال')},
    'bankName'           => ${JSON.stringify(siteContent?.paymentConfig?.bankName || 'بانک ملی ایران')},

    // آدرس وب‌سایت فروشگاه
    'storeUrl'           => ${JSON.stringify(telegramConfig.panelBaseUrl || '')},
    'storeName'          => 'فروشگاه تخصصی محصولات ارگانیک اونیوال'
];`;

    if (content.includes('$DEFAULT_CONFIG = [')) {
      content = content.replace(/\$DEFAULT_CONFIG\s*=\s*\[[\s\S]*?\];/, () => defaultBlock);
    } else {
      content = `<?php\n${defaultBlock}\n`;
    }
    return content;
  }

  if (cleanName === 'telegram-bot.php') {
    let content = '';
    if (fs.existsSync(templatePath)) {
      content = fs.readFileSync(templatePath, 'utf8');
    }
    const defaultBlock = `// ==============================================================================
// بخش ۱: تنظیمات اختصاصی ربات تلگرام (سازگار با PHP 8.5 - استخراج خودکار از پنل مدیریت)
// ==============================================================================
$DEFAULT_CONFIG = [
    // توکن ربات تلگرام
    'telegramBotToken'     => ${JSON.stringify(telegramConfig.telegramBotToken || '')},

    // نام کاربری ربات تلگرام
    'telegramBotUsername'  => ${JSON.stringify((telegramConfig.telegramBotUsername || '').replace(/^@/, ''))},

    // آیدی عددی چت ادمین در تلگرام
    'adminChatId'          => ${JSON.stringify(telegramConfig.telegramAdminChatId || '')},

    // نام کاربری ادمین
    'adminUsername'        => '',

    // توکن امنیتی وب‌هوک
    'webhookSecretToken'   => ${JSON.stringify(telegramConfig.webhookSecretToken || '')},

    // آدرس وب‌سایت فروشگاه
    'storeUrl'             => ${JSON.stringify(telegramConfig.panelBaseUrl || '')},

    // نام فروشگاه
    'storeName'            => 'فروشگاه تخصصی محصولات ارگانیک اونیوال'
];`;

    if (content.includes('$DEFAULT_CONFIG = [')) {
      content = content.replace(/\$DEFAULT_CONFIG\s*=\s*\[[\s\S]*?\];/, () => defaultBlock);
    } else {
      content = `<?php\n${defaultBlock}\n`;
    }
    return content;
  }

  throw new Error('فایل درخواستی معتبر نیست.');
}

// Telegram & Bale Bot settings, real connection testers, webhook manager & simulator
app.get('/api/bot/config', (req: Request, res: Response) => {
  res.json({
    config: telegramConfig,
    logs: botActivityLogs.slice(0, 30)
  });
});

app.get('/api/bot/php-code/:filename', (req: Request, res: Response) => {
  try {
    const filename = req.params.filename || '';
    const code = generateBotPhpScript(filename);
    res.json({ ok: true, filename, code });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message || 'خطا در تولید فایل PHP' });
  }
});

app.get('/api/bot/download-php/:filename', (req: Request, res: Response) => {
  try {
    const filename = req.params.filename || '';
    const code = generateBotPhpScript(filename);
    res.setHeader('Content-Type', 'application/x-httpd-php; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(code);
  } catch (err: any) {
    res.status(400).send(`Error: ${err.message}`);
  }
});

const handleSaveBotConfig = (req: Request, res: Response) => {
  const incoming = req.body || {};

  const resolvedBaleToken = (incoming.baleBotToken && String(incoming.baleBotToken).trim() !== '')
    ? String(incoming.baleBotToken).trim()
    : ((incoming.botToken && String(incoming.botToken).trim() !== '') ? String(incoming.botToken).trim() : String(telegramConfig.baleBotToken || telegramConfig.botToken || '').trim());

  const resolvedCustomerToken = (incoming.customerBotToken && String(incoming.customerBotToken).trim() !== '')
    ? String(incoming.customerBotToken).trim()
    : ((incoming.baleCustomerBotToken && String(incoming.baleCustomerBotToken).trim() !== '') ? String(incoming.baleCustomerBotToken).trim() : (telegramConfig.customerBotToken || resolvedBaleToken));

  const resolvedAdminToken = (incoming.adminBotToken && String(incoming.adminBotToken).trim() !== '')
    ? String(incoming.adminBotToken).trim()
    : ((incoming.baleAdminBotToken && String(incoming.baleAdminBotToken).trim() !== '') ? String(incoming.baleAdminBotToken).trim() : (telegramConfig.adminBotToken || ''));

  const resolvedTelegramBotToken = (incoming.telegramBotToken && String(incoming.telegramBotToken).trim() !== '')
    ? String(incoming.telegramBotToken).trim()
    : String(telegramConfig.telegramBotToken || '').trim();

  const rawChatId = incoming.baleAdminChatId !== undefined
    ? incoming.baleAdminChatId
    : (incoming.adminChatId !== undefined ? incoming.adminChatId : (telegramConfig.baleAdminChatId || telegramConfig.adminChatId || ''));
  const resolvedBaleChatId = String(rawChatId).trim();
  const resolvedBaleAdminUser = String(incoming.baleAdminUsername !== undefined ? incoming.baleAdminUsername : (telegramConfig.baleAdminUsername || '')).trim();
  const rawUsername = incoming.baleBotUsername !== undefined
    ? incoming.baleBotUsername
    : (incoming.botUsername !== undefined ? incoming.botUsername : (telegramConfig.baleBotUsername || telegramConfig.botUsername || 'Onivalbot'));
  const resolvedBaleUsername = String(rawUsername).replace(/^@/, '').trim();
  const resolvedBaleBaseUrl = sanitizeBotBaseUrl('bale', incoming.baleBaseUrl || incoming.baseUrl || telegramConfig.baleBaseUrl || 'https://tapi.bale.ai');
  const resolvedTgBaseUrl = sanitizeBotBaseUrl('telegram', incoming.telegramBaseUrl || telegramConfig.telegramBaseUrl || 'https://api.telegram.org');
  const resolvedBaleActive = incoming.active !== undefined ? Boolean(incoming.active) : (incoming.baleEnabled !== undefined ? Boolean(incoming.baleEnabled) : telegramConfig.active);

  const resolvedWebhookSecret = (incoming.webhookSecretToken && String(incoming.webhookSecretToken).trim().length >= 16)
    ? String(incoming.webhookSecretToken).trim()
    : (telegramConfig.webhookSecretToken || `ONV_SEC_${crypto.randomBytes(16).toString('hex')}`);

  const resolvedPaymentMode = incoming.balePaymentMode || telegramConfig.balePaymentMode || 'live';
  const resolvedTokenLive = incoming.balePaymentTokenLive !== undefined ? String(incoming.balePaymentTokenLive).trim() : String(telegramConfig.balePaymentTokenLive || '').trim();
  const resolvedTokenTest = incoming.balePaymentTokenTest !== undefined ? String(incoming.balePaymentTokenTest).trim() : String(telegramConfig.balePaymentTokenTest || '').trim();
  const resolvedActiveToken = resolvedPaymentMode === 'test' ? resolvedTokenTest : resolvedTokenLive;

  const resolvedTgEnabled = incoming.telegramBotEnabled !== undefined
    ? Boolean(incoming.telegramBotEnabled)
    : (incoming.telegramEnabled !== undefined ? Boolean(incoming.telegramEnabled) : telegramConfig.telegramBotEnabled);
  const resolvedTgUsername = String(incoming.telegramBotUsername !== undefined ? incoming.telegramBotUsername : (telegramConfig.telegramBotUsername || 'onival_shop_bot')).replace(/^@/, '').trim();

  const resolvedTgSupport = incoming.telegramSupportId !== undefined ? incoming.telegramSupportId : telegramConfig.telegramSupportId;
  const resolvedBaleSupport = incoming.baleSupportId !== undefined ? incoming.baleSupportId : telegramConfig.baleSupportId;
  const resolvedWorkingHours = incoming.workingHours !== undefined ? incoming.workingHours : telegramConfig.workingHours;

  telegramConfig = {
    ...telegramConfig,
    ...incoming,
    // Strictly preserve and protect Webhook Secret Token from being wiped
    webhookSecretToken: resolvedWebhookSecret,
    // Keep primary & explicit Bale fields 100% synced
    botToken: resolvedBaleToken,
    baleBotToken: resolvedBaleToken,
    customerBotToken: resolvedCustomerToken,
    baleCustomerBotToken: resolvedCustomerToken,
    adminBotToken: resolvedAdminToken,
    baleAdminBotToken: resolvedAdminToken,
    telegramBotToken: resolvedTelegramBotToken,
    adminChatId: resolvedBaleChatId,
    baleAdminChatId: resolvedBaleChatId,
    baleAdminUsername: resolvedBaleAdminUser,
    botUsername: resolvedBaleUsername,
    baleBotUsername: resolvedBaleUsername,
    baseUrl: resolvedBaleBaseUrl,
    baleBaseUrl: resolvedBaleBaseUrl,
    telegramBaseUrl: resolvedTgBaseUrl,
    active: resolvedBaleActive,
    baleEnabled: resolvedBaleActive,

    // Bale Wallet Payment Config
    balePaymentMode: resolvedPaymentMode,
    balePaymentTokenLive: resolvedTokenLive,
    balePaymentTokenTest: resolvedTokenTest,
    balePaymentToken: resolvedActiveToken,
    baleAutoSendInvoice: incoming.baleAutoSendInvoice !== undefined ? Boolean(incoming.baleAutoSendInvoice) : (telegramConfig.baleAutoSendInvoice ?? true),
    baleAutoNotifyAdminAllTransactions: incoming.baleAutoNotifyAdminAllTransactions !== undefined ? Boolean(incoming.baleAutoNotifyAdminAllTransactions) : (telegramConfig.baleAutoNotifyAdminAllTransactions ?? true),
    baleAdminDirectApproval: incoming.baleAdminDirectApproval !== undefined ? Boolean(incoming.baleAdminDirectApproval) : (telegramConfig.baleAdminDirectApproval ?? true),

    // Keep Telegram fields 100% synced
    telegramBotEnabled: resolvedTgEnabled,
    telegramEnabled: resolvedTgEnabled,
    telegramBotUsername: resolvedTgUsername,

    // Keep Support IDs & hours synced
    telegramSupportId: resolvedTgSupport,
    telegramSupportUsername: resolvedTgSupport,
    baleSupportId: resolvedBaleSupport,
    baleSupportUsername: resolvedBaleSupport,
    workingHours: resolvedWorkingHours,
    supportHours: resolvedWorkingHours,

    antiSpamSeconds: incoming.antiSpamSeconds !== undefined ? Number(incoming.antiSpamSeconds) : telegramConfig.antiSpamSeconds,
  };

  // Sync support channels & bot IDs with siteContent so Storefront Contact Page, Footer & Payment Config stay in sync
  if (telegramConfig.supportPhone) siteContent.contactPhone = telegramConfig.supportPhone;
  if (telegramConfig.supportEmail) siteContent.contactEmail = telegramConfig.supportEmail;
  if (telegramConfig.workingHours) siteContent.contactWorkingHours = telegramConfig.workingHours;
  if (telegramConfig.telegramSupportId) siteContent.contactTelegramId = telegramConfig.telegramSupportId;
  if (telegramConfig.baleSupportId) siteContent.contactBaleId = telegramConfig.baleSupportId;
  if (telegramConfig.instagramId) siteContent.contactInstagramId = telegramConfig.instagramId;
  if (telegramConfig.whatsappNumber) siteContent.contactWhatsapp = telegramConfig.whatsappNumber;
  if (telegramConfig.eitaaSupportId) siteContent.contactEitaaId = telegramConfig.eitaaSupportId;
  if (telegramConfig.rubikaSupportId) siteContent.contactRubikaId = telegramConfig.rubikaSupportId;

  if (!siteContent.pages) siteContent.pages = {};
  if (!siteContent.pages.contact) siteContent.pages.contact = {};
  siteContent.pages.contact.phone = `تلفن پشتیبانی و سفارشات: ${telegramConfig.supportPhone}`;
  siteContent.pages.contact.baleBotId = `@${resolvedBaleUsername}`;
  siteContent.pages.contact.telegramSupportId = telegramConfig.telegramSupportId;
  siteContent.pages.contact.baleSupportId = telegramConfig.baleSupportId;

  if (!siteContent.paymentConfig) {
    siteContent.paymentConfig = {
      cardToCardEnabled: true,
      cardNumber: '۶۰۳۷-۹۹۷۵-۹۹۱۲-۳۴۵۶',
      cardHolderName: 'مجموعه تخصصی فرآورده‌های ارگانیک اونیوال',
      bankName: 'بانک ملی ایران',
      cardDescription: '',
      gatewayOfflineNoticeTitle: '',
      gatewayOfflineNoticeText: '',
      baleBotEnabled: true,
      baleBotUsername: resolvedBaleUsername,
      baleBotButtonText: `اتصال به بازوی رسمی بله و پرداخت فاکتور (@${resolvedBaleUsername})`,
      gatewayEnabled: false,
      gatewayTitle: 'پرداخت آنلاین از طریق درگاه بانکی شاپرک',
      gatewayUrl: 'https://zarinp.al/onival',
      gatewayMerchantCode: '',
      gatewayDescription: '',
      defaultMethod: 'card_to_card'
    };
  } else {
    siteContent.paymentConfig.baleBotUsername = resolvedBaleUsername;
    siteContent.paymentConfig.baleBotButtonText = `اتصال به بازوی رسمی بله و پرداخت فاکتور (@${resolvedBaleUsername})`;
  }

  botActivityLogs.unshift({
    id: Date.now(),
    time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    type: 'config_saved',
    platform: 'system',
    text: `تنظیمات ربات بله (@${resolvedBaleUsername})، آیدی ادمین (${resolvedBaleAdminUser}) و توکن‌های پرداخت با موفقیت در سرور و فروشگاه همگام‌سازی شد.`,
    status: 'success'
  });

  savePersistedState();

  res.json({
    success: true,
    message: 'تمامی تنظیمات ربات‌های بله، توکن‌های پرداخت کیف پول و آیدی ادمین به صورت دائمی ذخیره و با فروشگاه همگام‌سازی گردید.',
    config: telegramConfig,
    siteContent,
    logs: botActivityLogs.slice(0, 30)
  });
};

app.post('/api/bot/config', handleSaveBotConfig);
app.put('/api/bot/config', handleSaveBotConfig);

// Real live Bot API Connection Test (calls /getMe on Bale or Telegram API)
app.post('/api/bot/test-connection', async (req: Request, res: Response) => {
  const { platform = 'bale', botToken, baseUrl } = req.body || {};
  const resolvedToken = (
    botToken ||
    (platform === 'telegram' ? telegramConfig.telegramBotToken : telegramConfig.baleBotToken || telegramConfig.botToken) ||
    ''
  ).trim();

  const rawBase = (
    baseUrl ||
    (platform === 'telegram' ? telegramConfig.telegramBaseUrl || 'https://api.telegram.org' : telegramConfig.baleBaseUrl || telegramConfig.baseUrl || 'https://tapi.bale.ai')
  ).replace(/\/+$/, '');
  const resolvedBaseUrl = sanitizeBotBaseUrl(platform, rawBase);

  const platformName = platform === 'telegram' ? 'تلگرام (Telegram)' : 'بله (Bale)';
  const time = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (!resolvedToken) {
    return res.status(400).json({
      ok: false,
      connected: false,
      platform,
      message: `توکن ربات ${platformName} وارد نشده است. لطفاً ابتدا توکن را از @BotFather دریافت و در کادر مربوطه وارد نمایید.`
    });
  }

  const startMs = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const apiRes = await fetch(`${resolvedBaseUrl}/bot${resolvedToken}/getMe`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startMs;
    const data: any = await apiRes.json().catch(() => null);

    if (apiRes.ok && data && data.ok && data.result) {
      const botUser = data.result.username || data.result.first_name || 'Bot';
      botActivityLogs.unshift({
        id: Date.now(),
        time,
        type: 'connection_test_ok',
        platform: platform === 'telegram' ? 'telegram' : 'bale',
        text: `تست اتصال واقعی ${platformName} موفق بود: @${botUser} (پینگ: ${latencyMs}ms)`,
        status: 'success'
      });

      return res.json({
        ok: true,
        success: true,
        connected: true,
        mode: 'live_api',
        platform,
        latencyMs,
        httpStatus: apiRes.status,
        botInfo: data.result,
        message: `اتصال واقعی با سرور ${platformName} برقرار شد! نام ربات: ${data.result.first_name || ''} (@${data.result.username || ''}) - پینگ: ${latencyMs} میلی‌ثانیه`,
        logs: botActivityLogs.slice(0, 30)
      });
    } else {
      const errDesc = data?.description || `کد وضعیت HTTP ${apiRes.status} (توکن نامعتبر یا عدم تطابق با سرور ${resolvedBaseUrl})`;
      botActivityLogs.unshift({
        id: Date.now(),
        time,
        type: 'connection_test_fail',
        platform: platform === 'telegram' ? 'telegram' : 'bale',
        text: `پاسخ سرور ${platformName} در تست getMe: ${errDesc} (پینگ سرور: ${latencyMs}ms)`,
        status: 'warning'
      });

      const isTokenFormatValid = /^\d+:[A-Za-z0-9_-]{15,}$/.test(resolvedToken);

      return res.json({
        ok: true,
        success: isTokenFormatValid,
        connected: false,
        mode: 'validated_format',
        serverReachable: true,
        platform,
        latencyMs,
        httpStatus: apiRes.status,
        errorDescription: errDesc,
        message: isTokenFormatValid
          ? `ارتباط با سرور ${resolvedBaseUrl} برقرار شد (پینگ: ${latencyMs}ms). ساختار توکن معتبر است (پاسخ سرور برای این توکن: ${errDesc}).`
          : `ارتباط با سرور ${resolvedBaseUrl} برقرار شد (پینگ: ${latencyMs}ms)، اما توکن وارد شده معتبر نیست: «${errDesc}».`,
        logs: botActivityLogs.slice(0, 30)
      });
    }
  } catch (err: any) {
    const latencyMs = Date.now() - startMs;
    const isAbort = err?.name === 'AbortError';
    const errMsg = isAbort
      ? `عدم پاسخگویی سرور ${resolvedBaseUrl} پس از ۸ ثانیه (در صورت استفاده از تلگرام روی سرور ایران، می‌توانید آدرس پروکسی/ورکر کلودفلر را در فیلد آدرس پایه قرار دهید).`
      : `خطای شبکه در اتصال به ${resolvedBaseUrl}: ${err?.message || 'Unknown error'}`;

    botActivityLogs.unshift({
      id: Date.now(),
      time,
      type: 'connection_test_error',
      platform: platform === 'telegram' ? 'telegram' : 'bale',
      text: `خطای شبکه در تست ربات ${platformName}: ${errMsg}`,
      status: 'error'
    });

    return res.json({
      ok: true,
      connected: false,
      serverReachable: false,
      platform,
      latencyMs,
      errorDescription: errMsg,
      message: errMsg,
      logs: botActivityLogs.slice(0, 30)
    });
  }
});

// Real live Message Sender (calls /sendMessage on Bale, Telegram, or Both)
const handleSendLiveBotMessage = async (req: Request, res: Response) => {
  const { platform = 'bale', chatId, text, botToken, baseUrl } = req.body || {};
  const msgText = (text || '').trim() || `🔔 پیام تست ارتباطی از پنل مدیریت فروشگاه اونیوال (ONIVAL)\n⏱ زمان ارسال: ${new Date().toLocaleString('fa-IR')}`;
  const time = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const targets: Array<{
    platform: 'bale' | 'telegram';
    name: string;
    token: string;
    chatId: string;
    baseUrl: string;
  }> = [];

  if (platform === 'bale' || platform === 'both') {
    const rawBaleBase = (baseUrl || telegramConfig.baleBaseUrl || telegramConfig.baseUrl || 'https://tapi.bale.ai').replace(/\/+$/, '');
    targets.push({
      platform: 'bale',
      name: 'بله (Bale)',
      token: (botToken || telegramConfig.baleBotToken || telegramConfig.botToken || '').trim(),
      chatId: (chatId || telegramConfig.baleAdminChatId || telegramConfig.adminChatId || '').trim(),
      baseUrl: sanitizeBotBaseUrl('bale', rawBaleBase)
    });
  }

  if (platform === 'telegram' || platform === 'both') {
    const rawTgBase = (baseUrl || telegramConfig.telegramBaseUrl || 'https://api.telegram.org').replace(/\/+$/, '');
    targets.push({
      platform: 'telegram',
      name: 'تلگرام (Telegram)',
      token: (botToken || telegramConfig.telegramBotToken || '').trim(),
      chatId: (chatId || telegramConfig.telegramAdminChatId || telegramConfig.adminChatId || '').trim(),
      baseUrl: sanitizeBotBaseUrl('telegram', rawTgBase)
    });
  }

  const results: any[] = [];

  for (const t of targets) {
    if (!t.token || !t.chatId) {
      results.push({
        platform: t.platform,
        delivered: false,
        simulated: true,
        message: `توکن یا شناسه چت برای ${t.name} کامل نیست (در لاگ محلی ثبت شد).`
      });
      botActivityLogs.unshift({
        id: Date.now() + Math.random(),
        time,
        type: 'send_message_simulated',
        platform: t.platform,
        text: `[ثبت در صف / شبیه‌سازی ${t.name}] ارسال پیام به ${t.chatId || 'ادمین'}: "${msgText.slice(0, 60)}..."`,
        status: 'warning'
      });
      continue;
    }

    const startMs = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const apiRes = await fetch(`${t.baseUrl}/bot${t.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: t.chatId,
          text: msgText
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - startMs;
      const data: any = await apiRes.json().catch(() => null);

      if (apiRes.ok && data && data.ok) {
        results.push({
          platform: t.platform,
          delivered: true,
          latencyMs,
          messageId: data.result?.message_id,
          message: `پیام واقعاً از طریق سرور ${t.name} به چت ${t.chatId} تحویل داده شد (Message ID: ${data.result?.message_id || 'OK'} - ${latencyMs}ms).`
        });
        botActivityLogs.unshift({
          id: Date.now() + Math.random(),
          time,
          type: 'send_message_real_ok',
          platform: t.platform,
          text: `ارسال واقعی موفق در ${t.name} به چت ${t.chatId} (پینگ: ${latencyMs}ms)`,
          status: 'success'
        });
      } else {
        const desc = data?.description || `HTTP ${apiRes.status}`;
        results.push({
          platform: t.platform,
          delivered: false,
          latencyMs,
          errorDescription: desc,
          message: `پاسخ سرور ${t.name}: «${desc}» (رویداد در لاگ سامانه نیز ثبت گردید).`
        });
        botActivityLogs.unshift({
          id: Date.now() + Math.random(),
          time,
          type: 'send_message_api_response',
          platform: t.platform,
          text: `تلاش ارسال به ${t.name} (چت ${t.chatId}): پاسخ سرور «${desc}»`,
          status: 'warning'
        });
      }
    } catch (err: any) {
      const latencyMs = Date.now() - startMs;
      const errMsg = err?.name === 'AbortError' ? 'Timeout (۸ ثانیه)' : (err?.message || 'خطای شبکه');
      results.push({
        platform: t.platform,
        delivered: false,
        latencyMs,
        errorDescription: errMsg,
        message: `عدم دسترسی مستقیم به سرور ${t.name} (${errMsg}) - پیام در لاگ داخلی ثبت شد.`
      });
      botActivityLogs.unshift({
        id: Date.now() + Math.random(),
        time,
        type: 'send_message_network_err',
        platform: t.platform,
        text: `خطای شبکه در ارسال به ${t.name}: ${errMsg}`,
        status: 'error'
      });
    }
  }

  savePersistedState();
  const anyDelivered = results.some(r => r.delivered);
  const firstMsg = results[0]?.message || (anyDelivered ? 'پیام تست با موفقیت ارسال شد.' : 'عدم تحویل پیام به سرور مقصد.');
  return res.json({
    ok: anyDelivered,
    success: anyDelivered,
    delivered: anyDelivered,
    results,
    message: results.map(r => r.message).join(' | ') || firstMsg,
    summary: results.map(r => r.message).join(' | '),
    logs: botActivityLogs.slice(0, 30)
  });
};

app.post('/api/bot/send-real-message', handleSendLiveBotMessage);
app.post('/api/bot/send-test-message', handleSendLiveBotMessage);

// Test Bale Connection & Send Official Welcome Message to Admin
app.post(['/api/bot/test-admin-welcome', '/api/bale/test-admin-welcome'], async (req: Request, res: Response) => {
  const { botToken, chatId, baseUrl } = req.body || {};
  const activeToken = (botToken || telegramConfig.baleBotToken || telegramConfig.botToken || '').trim();
  const activeChatId = (chatId || telegramConfig.baleAdminChatId || telegramConfig.adminChatId || '').trim();
  const rawBase = (baseUrl || telegramConfig.baleBaseUrl || telegramConfig.baseUrl || 'https://tapi.bale.ai').replace(/\/+$/, '');
  const activeBaseUrl = sanitizeBotBaseUrl('bale', rawBase);

  // If new values were provided in the test, save them to active config
  if (botToken) {
    telegramConfig.botToken = activeToken;
    telegramConfig.baleBotToken = activeToken;
  }
  if (chatId) {
    telegramConfig.adminChatId = activeChatId;
    telegramConfig.baleAdminChatId = activeChatId;
  }

  if (!activeToken) {
    return res.status(400).json({
      ok: false,
      delivered: false,
      status: 400,
      usedChatId: activeChatId,
      message: 'توکن ربات بله وارد نشده است.',
      description: 'لطفاً توکن ربات دریافتی از @BotFather را در کادر تنظیمات وارد کنید.'
    });
  }

  if (!activeChatId) {
    return res.status(400).json({
      ok: false,
      delivered: false,
      status: 400,
      usedChatId: '',
      message: 'شناسه عددی چت ادمین (Chat ID) وارد نشده است.',
      description: 'شناسه عددی چت ادمین برای ارسال پیام لازم است.'
    });
  }

  const welcomeText = 'اتصال ربات به هاست با موفقیت انجام شد. شما به عنوان ادمین شناسایی شدید';
  const startMs = Date.now();
  const time = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const apiRes = await fetch(`${activeBaseUrl}/bot${activeToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: activeChatId,
        text: welcomeText
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startMs;
    const data: any = await apiRes.json().catch(() => null);

    if (apiRes.ok && data?.ok) {
      botActivityLogs.unshift({
        id: Date.now(),
        time,
        type: 'admin_welcome_ok',
        platform: 'bale',
        text: `پیام خوش‌آمدگویی تست اتصال به چت ادمین (${activeChatId}) ارسال شد (Message ID: ${data.result?.message_id || 'OK'})`,
        status: 'success'
      });
      savePersistedState();

      return res.json({
        ok: true,
        delivered: true,
        status: apiRes.status,
        latencyMs,
        messageId: data.result?.message_id,
        message: 'پیام «اتصال ربات به هاست با موفقیت انجام شد. شما به عنوان ادمین شناسایی شدید» با موفقیت به بله شما تحویل داده شد.',
        rawResponse: data,
        usedChatId: activeChatId,
        logs: botActivityLogs.slice(0, 30)
      });
    } else {
      const desc = data?.description || (apiRes.status === 401 ? 'Unauthorized' : `HTTP ${apiRes.status}`);
      const isForbiddenStart = apiRes.status === 403 || /Forbidden|can't initiate conversation/i.test(desc);
      const cleanBotName = (telegramConfig.baleBotUsername || telegramConfig.botUsername || 'Onivalbot').replace(/^@/, '');

      botActivityLogs.unshift({
        id: Date.now(),
        time,
        type: isForbiddenStart ? 'admin_welcome_start_required' : 'admin_welcome_failed',
        platform: 'bale',
        text: isForbiddenStart
          ? `ارسال پیام به چت (${activeChatId}) نیازمند استارت ربات توسط ادمین در بله است (Forbidden).`
          : `تست ارسال پیام خوش‌آمدگویی به ادمین (${activeChatId}) ناموفق بود: ${desc}`,
        status: isForbiddenStart ? 'warning' : 'error'
      });
      savePersistedState();

      return res.json({
        ok: false,
        delivered: false,
        status: apiRes.status,
        latencyMs,
        forbiddenStartRequired: isForbiddenStart,
        botUsername: cleanBotName,
        botLink: `https://ble.ir/${cleanBotName}`,
        description: desc,
        message: isForbiddenStart
          ? 'خطای امنیتی بله (Forbidden): ربات نمی‌تواند شروع‌کننده مکالمه با کاربر باشد.'
          : `پاسخ وب‌سرویس بله: ${desc}`,
        rawResponse: data,
        usedChatId: activeChatId,
        hint: isForbiddenStart
          ? `مدیر گرامی، ربات‌های بله و تلگرام به دلایل امنیتی تا زمانی که دکمه «شروع» یا /start را در ربات نزده باشید، اجازه ارسال پیام به شما را ندارند. لطفاً ابتدا روی لینک ربات (ble.ir/${cleanBotName}) کلیک کرده و دکمه «شروع» (Start) را لمس فرمایید، سپس مجدداً دکمه تست را بزنید.`
          : apiRes.status === 401
          ? 'توکن وارد شده معتبر نیست یا منقضی شده است. لطفاً توکن جدید را از @BotFather در بله کپی کرده، در کادر بالا وارد و ذخیره فرمایید.'
          : 'در صورت خطای chat not found، ابتدا با اکانت خود در بله به ربات پیام /start بفرستید.',
        logs: botActivityLogs.slice(0, 30)
      });
    }
  } catch (err: any) {
    const latencyMs = Date.now() - startMs;
    const errMsg = err?.name === 'AbortError' ? 'Timeout (۸ ثانیه)' : (err?.message || 'خطای شبکه');
    return res.json({
      ok: false,
      delivered: false,
      status: 0,
      latencyMs,
      description: errMsg,
      message: `خطای شبکه در اتصال به بله: ${errMsg}`,
      usedChatId: activeChatId,
      hint: 'ارتباط مستقیم با سرور بله برقرار نشد. وضعیت اینترنت هاست یا سرور بله را بررسی کنید.'
    });
  }
});

// Real Webhook Management (setWebhook / deleteWebhook / getWebhookInfo)
app.post('/api/bot/webhook-action', async (req: Request, res: Response) => {
  const { platform = 'bale', action = 'info', webhookUrl, botToken, baseUrl } = req.body || {};
  const resolvedToken = (
    botToken ||
    (platform === 'telegram' ? telegramConfig.telegramBotToken : telegramConfig.baleBotToken || telegramConfig.botToken) ||
    ''
  ).trim();
  const rawBase = (
    baseUrl ||
    (platform === 'telegram' ? telegramConfig.telegramBaseUrl || 'https://api.telegram.org' : telegramConfig.baleBaseUrl || telegramConfig.baseUrl || 'https://tapi.bale.ai')
  ).replace(/\/+$/, '');
  const resolvedBaseUrl = sanitizeBotBaseUrl(platform, rawBase);
  const platformName = platform === 'telegram' ? 'تلگرام' : 'بله';
  const time = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (!resolvedToken) {
    return res.status(400).json({
      ok: false,
      message: `توکن ربات ${platformName} وارد نشده است.`
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let endpoint = 'getWebhookInfo';
    let fetchOptions: any = { method: 'GET', signal: controller.signal };

    if (action === 'set') {
      endpoint = 'setWebhook';
      const targetUrl = (webhookUrl || `${telegramConfig.panelBaseUrl}/api/bot/webhook/${platform}`).trim();
      if (platform === 'telegram') {
        telegramConfig.telegramWebhookUrl = targetUrl;
      } else {
        telegramConfig.baleWebhookUrl = targetUrl;
      }
      const secretTokenToRegister = (telegramConfig.webhookSecretToken || '').trim();
      const webhookPayload: any = { url: targetUrl };
      if (secretTokenToRegister) {
        webhookPayload.secret_token = secretTokenToRegister;
      }
      fetchOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
        signal: controller.signal
      };
    } else if (action === 'delete') {
      endpoint = 'deleteWebhook';
      fetchOptions = { method: 'POST', signal: controller.signal };
    }

    const apiRes = await fetch(`${resolvedBaseUrl}/bot${resolvedToken}/${endpoint}`, fetchOptions);
    clearTimeout(timeoutId);
    const data: any = await apiRes.json().catch(() => null);

    const statusMsg = data?.ok
      ? `عملیات ${endpoint} روی ربات ${platformName} با موفقیت انجام شد.`
      : `پاسخ سرور ${platformName} برای ${endpoint}: ${data?.description || `HTTP ${apiRes.status}`}`;

    botActivityLogs.unshift({
      id: Date.now(),
      time,
      type: `webhook_${action}`,
      platform: platform === 'telegram' ? 'telegram' : 'bale',
      text: statusMsg,
      status: data?.ok ? 'success' : 'warning'
    });
    savePersistedState();

    return res.json({
      ok: Boolean(data?.ok),
      success: true,
      apiData: data,
      message: statusMsg,
      logs: botActivityLogs.slice(0, 30)
    });
  } catch (err: any) {
    const msg = `خطا در ارتباط با وب‌هوک ${platformName}: ${err?.message || 'خطای شبکه'}`;
    botActivityLogs.unshift({
      id: Date.now(),
      time,
      type: `webhook_error`,
      platform: platform === 'telegram' ? 'telegram' : 'bale',
      text: msg,
      status: 'error'
    });
    return res.json({
      ok: false,
      message: msg,
      logs: botActivityLogs.slice(0, 30)
    });
  }
});

app.delete('/api/bot/logs', (req: Request, res: Response) => {
  botActivityLogs = [
    {
      id: Date.now(),
      time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      type: 'logs_cleared',
      platform: 'system',
      text: 'تاریخچه لاگ‌های مخابراتی توسط مدیر پاکسازی شد.',
      status: 'success'
    }
  ];
  res.json({ ok: true, logs: botActivityLogs });
});

app.post('/api/bot/simulate-event', async (req: Request, res: Response) => {
  const { type, payload } = req.body;
  const time = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

  if (type === 'test_notification') {
    const testText = payload || `🔔 تست ارتباط پنل مدیریت اونیوال با ربات‌های پشتیبانی (${time})`;
    const dispatchRes = await dispatchBotNotification(testText, 'test_notification');

    botActivityLogs.unshift({
      id: Date.now(),
      time,
      type: 'test_notification',
      platform: 'bale',
      text: `پیام تستی به شناسه ادمین (${telegramConfig.adminChatId}) ارسال شد: ${testText}`,
      status: 'success'
    });
    return res.json({
      success: true,
      dispatchResults: dispatchRes.results,
      message: 'پیام تستی پردازش و به درگاه ربات‌های فعال ارسال گردید.',
      logs: botActivityLogs.slice(0, 30)
    });
  }

  if (type === 'incoming_support_ticket') {
    const trackingCode = `ONV-${Math.floor(1000 + Math.random() * 9000)}`;
    const senderPlatform = payload?.platform === 'telegram' ? 'تلگرام' : 'بله';
    const newMsg = {
      id: contactMessages.length > 0 ? Math.max(...contactMessages.map(m => m.id)) + 1 : 1,
      fullName: payload?.fullName || `کاربر پشتیبانی ${senderPlatform}`,
      phoneNumber: payload?.phoneNumber || '09123456789',
      trackingCode,
      message: payload?.message || `[دریافتی از ربات ${senderPlatform}] سلام، می‌خواستم درباره نحوه ارسال عسل کوهستان و زمان تحویل در تهران سوال کنم.`,
      adminResponse: undefined,
      isRead: false,
      isResponded: false,
      creationTime: `${new Date().toLocaleDateString('fa-IR')} - ${time}`
    };
    contactMessages.unshift(newMsg);

    botActivityLogs.unshift({
      id: Date.now(),
      time,
      type: 'incoming_support_ticket',
      platform: payload?.platform === 'telegram' ? 'telegram' : 'bale',
      text: `تیکت پشتیبانی جدید از ربات ${senderPlatform} ثبت شد (کد رهگیری: ${trackingCode})`,
      status: 'success'
    });

    if (telegramConfig.notifyOnNewTicket !== false) {
      await dispatchBotNotification(
        `📩 تیکت پشتیبانی جدید (${senderPlatform})\nکد رهگیری: ${trackingCode}\nفرستنده: ${newMsg.fullName}\nمتن: ${newMsg.message}`,
        'incoming_support_ticket'
      );
    }

    return res.json({
      success: true,
      ticket: newMsg,
      message: `تیکت پشتیبانی جدید با کد رهگیری ${trackingCode} ثبت و در بخش پیام‌های پشتیبانی قرار گرفت.`,
      logs: botActivityLogs.slice(0, 30)
    });
  }

  if (type === 'incoming_order') {
    const newOrderId = orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 101;
    const trackingCode = `ONV-ORD-${newOrderId}`;
    const newOrder: any = {
      id: newOrderId,
      userFullName: payload?.fullName || 'کاربر ربات هوشمند اونیوال',
      phoneNumber: payload?.phone || '09121112233',
      userAddress: payload?.address || 'تهران، میدان ونک، سفارش ثبت شده از طریق ربات',
      totalPrice: 350000,
      status: 'Processing' as const,
      paymentStatus: 'Paid' as const,
      paymentMethod: 'bale_bot' as const,
      trackingCode,
      creationTime: new Date().toLocaleDateString('fa-IR'),
      balePaymentUrl: `https://ble.ir/${telegramConfig.baleBotUsername || 'Onivalbot'}?start=pay_${trackingCode}`,
      items: [
        {
          id: 1,
          productId: 1,
          productName: 'عسل کوهستان اونیوال',
          size: '۱ کیلوگرم',
          quantity: 1,
          unitPrice: 350000,
          totalPrice: 350000
        }
      ]
    };
    orders.unshift(newOrder);

    botActivityLogs.unshift({
      id: Date.now(),
      time,
      type: 'notify_new_order',
      platform: 'bale',
      text: `سفارش جدید ${trackingCode} از طریق ربات ثبت شد و نوتیفیکیشن به ادمین (${telegramConfig.adminChatId}) ارسال گردید.`,
      status: 'success'
    });

    if (telegramConfig.notifyOnNewOrder !== false) {
      await dispatchBotNotification(
        `🛒 سفارش جدید از ربات ثبت شد!\nکد فاکتور: ${trackingCode}\nمشتری: ${newOrder.userFullName}\nمبلغ: ۳۵۰,۰۰۰ تومان`,
        'incoming_order'
      );
    }

    return res.json({
      success: true,
      order: newOrder,
      message: `سفارش جدید با کد ${trackingCode} ثبت شد و به لیست سفارشات اضافه گردید.`,
      logs: botActivityLogs.slice(0, 30)
    });
  }

  res.status(400).json({ error: 'رویداد نامعتبر است' });
});

// Helper to convert Persian/Arabic digits to English digits
function toEnglishDigits(str: string): string {
  if (!str) return '';
  return str
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

// ================= BALE & TELEGRAM WEBHOOK & LONG POLLING PROCESSOR =================
function extractTrackingCodeFromText(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  const rawTrimmed = text.trim();
  const trimmed = toEnglishDigits(rawTrimmed);

  // If pure generic single commands or default interactive buttons, return null
  if (/^[\/!#]?(start|help|admin|orders|شروع|راهنما|سفارشات|فروشگاه|محصولات|تماس|پشتیبانی|پیگیری|پرداخت)$/iu.test(trimmed)) {
    return null;
  }
  if (/^(🛍️|🛒|📞|☎️|📦|🔍|💳|🧾)/u.test(trimmed)) {
    return null;
  }

  // 1. /start with parameter (e.g. /start pay_ONV-ORD-949, /start ONV-ORD-949, /start pay_ONV_ORD_949)
  const startParamMatch = trimmed.match(/^\/start(?:[\s_]+)(?:pay_|order_|پرداخت_)?(ONV[-_][A-Za-z0-9_-]+|ORD[-_][A-Za-z0-9_-]+|[A-Za-z0-9_-]+)/iu);
  if (startParamMatch) {
    const candidate = startParamMatch[1].replace(/^(?:pay_|order_|پرداخت_)/iu, '').trim();
    if (candidate && !/^(admin|help|orders|start)$/iu.test(candidate) && (candidate.toUpperCase().startsWith('ONV') || candidate.toUpperCase().startsWith('ORD'))) {
      return candidate;
    }
  }

  // 2. Direct order pattern anywhere in text: ONV-ORD-949, ONV_ORD_949, ONV-..., ORD-...
  const onvMatch = trimmed.match(/(ONV[-_][A-Za-z0-9_-]+|ORD[-_][A-Za-z0-9_-]+)/iu);
  if (onvMatch) {
    return onvMatch[1].trim();
  }

  // 3. Persian prefix queries: e.g. "فاکتور ONV-ORD-915", "کد رهگیری ONV-915"
  const prefixMatch = trimmed.match(/(?:فاکتور|سفارش|کد|رهگیری|پرداخت|شماره|invoice|order)\s*[:#-]?\s*(ONV[-_][A-Za-z0-9_-]+|ORD[-_][A-Za-z0-9_-]+)/iu);
  if (prefixMatch) {
    return prefixMatch[1].trim();
  }

  // 4. Direct pay or order command: pay_ONV-ORD-949, پرداخت_ONV-ORD-949, order_ONV-ORD-949
  const directPayMatch = trimmed.match(/^(?:[\/!#])?(?:pay_|order_|پرداخت_)\s*(ONV[-_][A-Za-z0-9_-]+|ORD[-_][A-Za-z0-9_-]+|[A-Za-z0-9_-]+)/iu);
  if (directPayMatch) {
    const candidate = directPayMatch[1].trim();
    if (candidate.toUpperCase().startsWith('ONV') || candidate.toUpperCase().startsWith('ORD')) {
      return candidate;
    }
  }

  return null;
}

function findOrderByTrackingOrCode(code: string): any {
  if (!code) return null;
  const rawCode = String(code).trim();
  if (rawCode.length < 4) return null;
  const cleanSearch = rawCode.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const normalizedCode = rawCode.replace(/-/g, '_').toUpperCase();
  const hyphenCode = rawCode.replace(/_/g, '-').toUpperCase();

  // Search only in memory (fast and non-blocking)
  return orders.find(o => {
    const oRaw = String(o.trackingCode || '').toUpperCase();
    const oClean = oRaw.replace(/[^A-Z0-9]/gi, '');
    const oNorm = oRaw.replace(/-/g, '_');
    const oHyphen = oRaw.replace(/_/g, '-');
    return oRaw === rawCode.toUpperCase() ||
           oNorm === normalizedCode ||
           oHyphen === hyphenCode ||
           (cleanSearch.length >= 6 && oClean === cleanSearch) ||
           (o.orderNumber && String(o.orderNumber).toUpperCase() === rawCode.toUpperCase());
  }) || null;
}

async function processIncomingBotUpdate(update: any, botOrigin: 'customer' | 'admin' = 'customer') {
  if (!update || typeof update !== 'object') return;
  const time = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

  const customerToken = getCustomerBotToken();
  const adminToken = getAdminBotToken();
  const baleToken = botOrigin === 'admin' ? (adminToken || customerToken) : (customerToken || adminToken);
  const activeToken = baleToken;
  const baleBase = sanitizeBotBaseUrl('bale', telegramConfig.baleBaseUrl || telegramConfig.baseUrl || 'https://tapi.bale.ai').replace(/\/+$/, '');
  const siteUrl = (telegramConfig.panelBaseUrl || 'http://localhost:3000').replace(/\/+$/, '');
  const configuredAdminUser = (telegramConfig.baleAdminUsername || '').replace(/^@/, '').toLowerCase();
  const configuredAdminChat = getAdminChatId();

  // 0. Handle Callback Query (e.g. inline button clicks in Bale)
  if (update.callback_query) {
    const cb = update.callback_query;
    const cbData = String(cb.data || '');
    const cbSenderChatId = cb.message?.chat?.id || cb.from?.id;
    if (baleToken && cb.id) {
      fetch(`${baleBase}/bot${baleToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: cb.id, text: 'در حال پردازش...' })
      }).catch(() => {});
    }
    if (cbData) {
      update.message = {
        chat: { id: cbSenderChatId },
        from: cb.from,
        text: cbData
      };
    }
  }

  // 1. Handle Pre-Checkout Query (Bale Wallet Payment Step 1)
  if (update.pre_checkout_query) {
    const preCheckout = update.pre_checkout_query;
    const invoicePayload = String(preCheckout.invoice_payload || '');
    const cleanCode = invoicePayload.replace(/^(order_|pay_)/i, '').trim().toUpperCase();
    const order = orders.find(o => o.trackingCode.toUpperCase() === cleanCode);
    const expectedRials = order ? Math.round(Number(order.totalPrice || 0) * 10) : 0;

    let ok = true;
    let errorMessage = '';
    if (!order) {
      ok = false;
      errorMessage = 'فاکتور سفارش مورد نظر در سامانه اونیوال یافت نشد یا منقضی گردیده است.';
    } else if (order.paymentStatus === 'Paid') {
      ok = false;
      errorMessage = 'این فاکتور قبلاً با موفقیت پرداخت شده است.';
    } else if (Number(preCheckout.total_amount) !== expectedRials) {
      ok = false;
      errorMessage = 'مبلغ تراکنش با مبلغ فاکتور تطابق ندارد.';
    }

    if (baleToken) {
      try {
        await fetch(`${baleBase}/bot${baleToken}/answerPreCheckoutQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pre_checkout_query_id: preCheckout.id,
            ok,
            error_message: errorMessage || undefined
          })
        });
      } catch (err) {
        console.error('Error answering preCheckoutQuery:', err);
      }
    }

    botActivityLogs.unshift({
      id: Date.now(),
      time,
      type: 'bale_pre_checkout',
      platform: 'bale',
      text: `درخواست پیش‌پرداخت فاکتور ${order ? order.trackingCode : invoicePayload} از کاربر دریافت و ${ok ? 'تایید شد' : 'رد شد: ' + errorMessage}.`,
      status: ok ? 'success' : 'warning'
    });
    savePersistedState();
    return;
  }

  // 2. Handle Successful Payment (Bale Wallet Payment Step 2)
  if (update.message?.successful_payment) {
    const msg = update.message;
    const pay = msg.successful_payment;
    const invoicePayload = String(pay.invoice_payload || '');
    const cleanCode = invoicePayload.replace(/^(order_|pay_)/i, '').trim().toUpperCase();
    const order = orders.find(o => o.trackingCode.toUpperCase() === cleanCode);
    const expectedRials = order ? Math.round(Number(order.totalPrice || 0) * 10) : 0;

    if (order && Number(pay.total_amount) >= expectedRials) {
      order.paymentMethod = 'bale_bot';
      order.paymentStatus = 'Paid';
      order.status = 'Processing';
      if (order.consultationDetails) {
        order.consultationDetails.consultationStatus = 'Scheduled';
      }

      // Deduct inventory and special offer quota on confirmed payment
      deductOrderInventoryOnPayment(order);

      const linkedMsg: any = contactMessages.find(m => m.trackingCode.toUpperCase() === order.trackingCode.toUpperCase());
      if (linkedMsg) {
        linkedMsg.paymentStatus = 'Paid';
        linkedMsg.paymentMethod = 'bale_bot';
        if (linkedMsg.consultationDetails) {
          linkedMsg.consultationDetails.consultationStatus = 'Scheduled';
        }
      }

      const customerChatId = msg.chat?.id;
      const siteTrackUrl = `${siteUrl}/?track=${order.trackingCode}`;

      // Reply to Customer in Bale
      if (customerChatId && baleToken) {
        const customerReceiptText =
          `✅ پرداخت فاکتور با موفقیت در بله انجام شد!\n\n` +
          `🧾 فاکتور سفارش: ${order.trackingCode}\n` +
          `💰 مبلغ پرداخت شده: ${Number(order.totalPrice || 0).toLocaleString('fa-IR')} تومان\n` +
          `📦 وضعیت سفارش: در حال آماده‌سازی و ارسال\n\n` +
          `🔍 پیگیری لحظه‌ای مرسوله در وب‌سایت اونیوال:\n${siteTrackUrl}\n\n` +
          `از حسن انتخاب شما سپاسگزاریم 🍯🌿`;

        sendBaleMessage(baleBase, baleToken, customerChatId, customerReceiptText).catch(() => {});
      }

      // Notify Store Admin (baleAdminChatId)
      const itemsSummary = (order.items || [])
        .map((it: any) => `▫️ ${it.productName} (${it.size || 'استاندارد'}) × ${it.quantity} عدد`)
        .join('\n');

      const adminAlertText =
        `💰 تراکنش جدید در کیف پول بله!\n\n` +
        `🔖 کد رهگیری: ${order.trackingCode}\n` +
        `👤 خریدار: ${order.userFullName} (${order.phoneNumber})\n` +
        `💵 مبلغ تسویه شده: ${Number(order.totalPrice || 0).toLocaleString('fa-IR')} تومان\n` +
        `📍 آدرس: ${order.userAddress}\n\n` +
        `🛍 اقلام سفارش:\n${itemsSummary}\n\n` +
        `⚡ وضعیت سفارش به صورت خودکار به «در حال پردازش / آماده‌سازی» تغییر یافت.\n` +
        `🔗 مشاهده در سایت: ${siteTrackUrl}`;

      dispatchBotNotification(adminAlertText, 'bale_payment_success').catch(() => {});

      botActivityLogs.unshift({
        id: Date.now(),
        time,
        type: 'bale_payment_success',
        platform: 'bale',
        text: `تراکنش فاکتور ${order.trackingCode} در کیف پول بله تایید شد. مبلغ: ${Number(order.totalPrice).toLocaleString('fa-IR')} تومان. نوتیفیکیشن برای ادمین (@${configuredAdminUser}) ارسال شد.`,
        status: 'success'
      });
      savePersistedState();
    }

    return;
  }

  // 3. Handle Messages & Commands
  const msg = update.message;
  if (msg) {
    const text = (msg.text || msg.caption || '').trim();
    const sender = msg.from || {};
    const senderChatId = String(msg.chat?.id || '');
    const senderUsername = sender.username || msg.chat?.username || '';

    // Strictly verify if sender is the configured admin by numeric Chat ID match only
    const isAdmin = Boolean(
      configuredAdminChat && senderChatId && senderChatId === String(configuredAdminChat)
    );

    // CHECK FOR RECEIPT PHOTO / DOCUMENT UPLOAD
    const hasPhoto = Array.isArray(msg.photo) && msg.photo.length > 0;
    const hasDoc = msg.document && (msg.document.mime_type?.includes('image') || msg.document.file_name?.match(/\.(jpe?g|png|webp)$/i));

    if (hasPhoto || hasDoc) {
      const fileId = hasPhoto ? msg.photo[msg.photo.length - 1]?.file_id : msg.document?.file_id;
      const detectedCode = extractTrackingCodeFromText(text);
      let targetOrder = detectedCode ? findOrderByTrackingOrCode(detectedCode) : null;
      if (!targetOrder) {
        targetOrder = orders.find(o => o.paymentStatus !== 'Paid' && (o.baleChatId === senderChatId || o.chatId === senderChatId)) || null;
      }

      if (targetOrder) {
        if (targetOrder.paymentStatus === 'Paid' || targetOrder.status === 'Completed') {
          const settledText = `سفارش شماره ${targetOrder.trackingCode} قبلاً تسویه گردیده است و نیازی به ارسال مجدد فیش ندارد. 🙏`;
          await sendBaleMessage(baleBase, activeToken, senderChatId, settledText);
          return;
        }
        targetOrder.receiptFileId = fileId;
        if (!targetOrder.baleChatId) {
          targetOrder.baleChatId = senderChatId;
        }
        targetOrder.paymentMethod = 'card_to_card';
        targetOrder.paymentStatus = 'PendingVerification';
        savePersistedState();
      }

      const orderCode = targetOrder ? targetOrder.trackingCode : (detectedCode || 'ثبت‌شده');
      const orderAmount = targetOrder ? Number(targetOrder.finalTotal || targetOrder.totalPrice || targetOrder.price || 0) : 0;
      const custDisplayName = targetOrder?.userFullName || `${sender.first_name || ''} ${sender.last_name || ''}`.trim() || 'مشتری گرامی';

      // 1. Thank customer and confirm receipt received
      const customerThanksText =
        `از خرید و حسن اعتماد شما به محصولات ارگانیک اونیوال صمیمانه سپاسگزاریم! 🌿🍯\n\n` +
        `📸 تصویر فیش واریزی شما با موفقیت در سامانه ثبت گردید و جهت بررسی و تأیید نهایی در اختیار واحد مالی و مدیریت قرار گرفت.\n\n` +
        `🔖 شماره فاکتور: ${orderCode}\n` +
        (orderAmount > 0 ? `💰 مبلغ فاکتور: ${orderAmount.toLocaleString('fa-IR')} تومان\n` : '') +
        `⏳ وضعیت: در انتظار بررسی و تأیید مدیریت\n\n` +
        `به محض بررسی و تأیید رسید توسط حسابداری، پیام تایید نهایی از همین طریق برای شما ارسال خواهد شد. 📦✨`;

      const replyKeyboard = {
        keyboard: [
          [{ text: '🧾 استعلام و پرداخت فاکتور من' }],
          [{ text: '🛍️ فروشگاه اونیوال' }, { text: '📦 پیگیری سفارش' }],
          [{ text: '💳 راهنمای روش‌های پرداخت' }, { text: '📞 تماس با ما و پشتیبانی' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      };

      await sendBaleMessage(baleBase, activeToken, senderChatId, customerThanksText, replyKeyboard);

      // 2. Forward photo to admin
      const adminChat = configuredAdminChat || '';
      const adminTokenToUse = adminToken || activeToken;
      if (adminChat && adminTokenToUse) {
        const itemsList = (targetOrder?.items || [])
          .map((it: any, i: number) => `▫️ ${i + 1}. ${it.productName || it.title} × ${it.quantity || 1} عدد`)
          .join('\n') || '▫️ فیش واریز مستقیم کارت به کارت';

        const adminCaption =
          `🔔 رسید واریز کارت‌به‌کارت جدید دریافت شد!\n\n` +
          `📦 شماره فاکتور: ${orderCode}\n` +
          `👤 خریدار: ${custDisplayName}\n` +
          `📱 شماره تماس: ${targetOrder?.phoneNumber || 'ثبت نشده'}\n` +
          `💰 مبلغ فاکتور: ${orderAmount.toLocaleString('fa-IR')} تومان\n` +
          `⏰ زمان ارسال رسید: ${time}\n\n` +
          `📦 اقلام سفارش:\n${itemsList}\n\n` +
          `⚡ جهت تأیید و تسویه روی دستور زیر کلیک فرمایید:\n` +
          `/confirm_${orderCode}`;

        const adminKb = {
          inline_keyboard: [
            [{ text: '✅ تایید این فیش واریزی', callback_data: `confirm_${orderCode}` }],
            [{ text: '🌐 مشاهده سفارش در سایت', url: `${siteUrl}/?track=${orderCode}` }]
          ]
        };

        const photoRes = await sendBalePhoto(baleBase, adminTokenToUse, adminChat, fileId, adminCaption, adminKb);
        if (!photoRes.ok) {
          await sendBaleMessage(baleBase, adminTokenToUse, adminChat, adminCaption, adminKb);
        }
      }

      botActivityLogs.unshift({
        id: Date.now(),
        time,
        type: 'receipt_photo_received',
        platform: 'bale',
        text: `تصویر فیش سفارش ${orderCode} از کاربر (${senderChatId}) دریافت شد${adminChat ? ` و به ادمین (${adminChat}) ارسال شد.` : '.'}`,
        status: 'info'
      });
      savePersistedState();
      return;
    }

    // Dedicated Helper: Send full order invoice and payment options to the customer/user in Bale
    const deliverOrderInvoice = async (targetOrder: any, noteHeading?: string) => {
      const isPaid = targetOrder.paymentStatus === 'Paid';
      // Ensure siteUrl is HTTPS for Bale inline buttons
      const originBase = (telegramConfig.panelBaseUrl && !telegramConfig.panelBaseUrl.includes('localhost'))
        ? telegramConfig.panelBaseUrl.replace(/\/+$/, '')
        : getSitePublicUrl();
      const siteTrackUrl = `${originBase}/?track=${targetOrder.trackingCode}`;

      const buyerName = targetOrder.userFullName || targetOrder.customerName || targetOrder.fullName || 'مشتری گرامی';
      const buyerPhone = targetOrder.phoneNumber || targetOrder.customerPhone || targetOrder.phone || '';
      const orderTotalToman = Number(targetOrder.finalTotal || targetOrder.totalPrice || targetOrder.total || targetOrder.price || 150000);

      const itemsSummary = (targetOrder.items && targetOrder.items.length > 0)
        ? targetOrder.items.map((it: any, idx: number) => {
            const pName = it.productName || it.title || it.name || 'محصول ارگانیک';
            const size = it.size || it.weight || 'استاندارد';
            const qty = it.quantity || it.count || 1;
            const price = Number(it.totalPrice || (it.unitPrice ? it.unitPrice * qty : (it.price ? it.price * qty : 0)));
            return `▫️ ${idx + 1}. ${pName}${size && size !== 'استاندارد' ? ` (${size})` : ''} × ${qty} عدد - ${price.toLocaleString('fa-IR')} تومان`;
          }).join('\n')
        : (targetOrder.isConsultation || targetOrder.consultationDetails
            ? `▫️ ۱. رزرو مشاوره تخصصی: ${targetOrder.consultationDetails?.topicTitle || 'مشاوره ارگانیک'}`
            : '▫️ ۱. فرآورده‌های ارگانیک اونیوال (بسته انتخابی)');

      const isOwnerOrAdmin = isAdmin || (targetOrder.baleChatId && String(targetOrder.baleChatId) === String(senderChatId));
      const displayedPhone = isOwnerOrAdmin ? buyerPhone : maskPhone(buyerPhone);
      const displayedAddress = targetOrder.userAddress
        ? (isOwnerOrAdmin ? targetOrder.userAddress : maskAddr(targetOrder.userAddress))
        : '';

      let invoiceDetailText =
        `🧾 درخواست پرداخت فاکتور فروشگاه اینترنتی اونیوال (ONIVAL):\n\n` +
        (noteHeading ? `💡 ${noteHeading}\n\n` : '') +
        `🔖 شماره فاکتور: ${targetOrder.trackingCode}\n` +
        `👤 خریدار: ${buyerName}${displayedPhone ? ` (${displayedPhone})` : ''}\n` +
        `💰 مبلغ کل قابل پرداخت: ${orderTotalToman.toLocaleString('fa-IR')} تومان\n` +
        (displayedAddress ? `📍 نشانی تحویل مرسوله: ${displayedAddress}\n\n` : '\n') +
        `📦 اقلام سفارش:\n${itemsSummary}\n\n` +
        `⏳ وضعیت پرداخت: ${isPaid ? '✅ پرداخت شده و ثبت نهایی (در حال آماده‌سازی و ارسال)' : '⏳ در انتظار پرداخت'}\n\n`;

      if (!isPaid) {
        invoiceDetailText +=
          `──────────────────\n` +
          `💳 روش‌های پرداخت سریع فاکتور:\n\n` +
          `۱️⃣ پرداخت مستقیم در بله: لمس دکمه «پرداخت» در کارت درخواست پول بله\n` +
          `۲️⃣ پرداخت اینترنتی در سایت: با لمس دکمه زیر همین پیام\n` +
          `۳️⃣ کارت به کارت شتاب:\n` +
          `▫️ شماره کارت: ${siteContent?.paymentConfig?.cardNumber || '۶۰۳۷-۹۹۷۵-۹۹۱۲-۳۴۵۶'}\n` +
          `▫️ به نام: ${siteContent?.paymentConfig?.cardHolderName || 'فروشگاه تخصصی اونیوال'}\n` +
          `▫️ بانک: ${siteContent?.paymentConfig?.bankName || 'بانک ملی ایران'}\n\n` +
          `📌 راهنما: پس از پرداخت مستقیم در ربات با کیف پول بله یا پرداخت آنلاین در سایت، سفارش شما به طور خودکار ثبت نهایی شده و با همین شماره فاکتور (${targetOrder.trackingCode}) قابل پیگیری لحظه‌ای است.\n\n`;
      }

      invoiceDetailText += `🌐 مشاهده فاکتور و پیگیری لحظه‌ای در سایت:\n${siteTrackUrl}`;

      const inlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: isPaid ? '✅ مشاهده فاکتور در سایت' : `💳 پرداخت آنلاین فاکتور (${targetOrder.trackingCode})`,
              url: siteTrackUrl
            }
          ],
          [
            {
              text: '🔍 پیگیری سفارش در سایت',
              url: siteTrackUrl
            },
            {
              text: '📞 پشتیبانی فروشگاه',
              url: `https://ble.ir/${(telegramConfig.baleSupportId || telegramConfig.baleBotUsername || 'onival_bale_support').replace(/^@/, '')}`
            }
          ]
        ]
      };

      if (baleToken && senderChatId) {
        // 1. Send detailed invoice text with inline keyboard buttons
        const msgRes = await sendBaleMessage(baleBase, baleToken, senderChatId, invoiceDetailText, inlineKeyboard);

        // 2. Issue Bale Wallet native Invoice («درخواست پول») if unpaid
        let invoiceResult: any = null;
        if (!isPaid) {
          const walletToken = getActiveBaleWalletToken();
          invoiceResult = await sendBaleInvoice({
            baseUrl: baleBase,
            token: baleToken,
            chatId: isNaN(Number(senderChatId)) ? senderChatId : Number(senderChatId),
            title: `فاکتور ${targetOrder.trackingCode}`.slice(0, 32),
            description: `پرداخت سفارش ${targetOrder.trackingCode} فروشگاه اونیوال`.slice(0, 255),
            payload: `order_${targetOrder.trackingCode}`,
            providerToken: walletToken,
            startParameter: `pay_${targetOrder.trackingCode.replace(/-/g, '_')}`,
            totalPriceRial: orderTotalToman * 10
          });
        }

        // Send persistent quick buttons to customer
        const replyKeyboard = {
          keyboard: [
            [{ text: '🧾 استعلام و پرداخت فاکتور من' }],
            [{ text: '🛍️ فروشگاه اونیوال' }, { text: '📦 پیگیری سفارش' }],
            [{ text: '💳 راهنمای روش‌های پرداخت' }, { text: '📞 تماس با ما و پشتیبانی' }]
          ],
          resize_keyboard: true,
          one_time_keyboard: false
        };
        sendBaleMessage(baleBase, baleToken, senderChatId, '📌 گزینه‌های دسترسی سریع:', replyKeyboard).catch(() => {});

        botActivityLogs.unshift({
          id: Date.now(),
          time,
          type: 'invoice_opened_in_bot',
          platform: 'bale',
          text: `فاکتور سفارش ${targetOrder.trackingCode} با موفقیت شناسایی شد و اقلام آن (${(targetOrder.items || []).length} قلم کالا به مبلغ کل ${Number(targetOrder.totalPrice || 0).toLocaleString('fa-IR')} تومان) از دیتابیس خوانده و درخواست پرداخت برای کاربر در بله صادر گردید.`,
          status: (invoiceResult ? invoiceResult.ok : msgRes.ok) ? 'success' : 'warning',
          details: `چت‌آیدی کاربر: ${senderChatId} | وضعیت ارسال پیام فاکتور: ${msgRes.ok ? 'موفق' : 'خطا'} | وضعیت درخواست پول بله: ${invoiceResult ? (invoiceResult.ok ? 'موفق' : (invoiceResult.data?.description || `HTTP ${invoiceResult.status}`)) : 'پیشتر تسویه شده'}`,
          rawPayload: {
            chatId: senderChatId,
            trackingCode: targetOrder.trackingCode,
            totalPrice: targetOrder.totalPrice,
            itemsCount: (targetOrder.items || []).length,
            userFullName: targetOrder.userFullName,
            phoneNumber: targetOrder.phoneNumber,
            paymentStatus: targetOrder.paymentStatus
          },
          rawResponse: {
            messageDelivery: msgRes,
            invoiceDelivery: invoiceResult
          },
          orderInfo: {
            id: targetOrder.id,
            trackingCode: targetOrder.trackingCode,
            userFullName: targetOrder.userFullName,
            totalPrice: targetOrder.totalPrice,
            paymentStatus: targetOrder.paymentStatus,
            items: targetOrder.items
          }
        });
        savePersistedState();

        // Note: Admin is only notified upon confirmed payment (successful_payment), not when browsing invoice
      }
    };

    // Shared default URLs for interactive bot response buttons
    const originBase = (telegramConfig.panelBaseUrl && !telegramConfig.panelBaseUrl.includes('localhost'))
      ? telegramConfig.panelBaseUrl.replace(/\/+$/, '')
      : getSitePublicUrl();
    const storeUrl = originBase;
    const supportUsername = (telegramConfig.baleSupportId || telegramConfig.baleBotUsername || 'onival_bale_support').replace(/^@/, '');
    const supportUrl = `https://ble.ir/${supportUsername}`;

    // =========================================================================
    // STEP A: PAYMENT & INVOICE REQUEST (Explicit Code in message or /start param)
    // Matches: /start pay_ONV-ORD-949, /start ONV-ORD-949, pay_ONV-ORD-949, 104, etc.
    // =========================================================================
    const detectedCode = extractTrackingCodeFromText(text);

    if (detectedCode) {
      const code = detectedCode.toUpperCase();
      let order = findOrderByTrackingOrCode(code);

      if (!order) {
        if (activeToken && senderChatId) {
          const notFoundText =
            `⚠️ فاکتور یا سفارشی با کد «${code}» در سامانه اونیوال یافت نشد.\n\n` +
            `▫️ لطفاً کد رهگیری دقیق فاکتور (مانند ONV-ORD-XXX) را ارسال فرمایید.\n` +
            `▫️ در صورت نیاز به راهنمایی بیشتر می‌توانید با پشتیبانی ما در ارتباط باشید.`;
          await sendBaleMessage(baleBase, activeToken, senderChatId, notFoundText);
        }
        return;
      }

      await deliverOrderInvoice(order);
      return;
    }

    // =========================================================================
    // STEP B: DEFAULT INTERACTIVE USER BUTTONS (Shop, Contact, Tracking, Guide)
    // Responds to user clicking default menu buttons or typing standard commands
    // =========================================================================

    // 1. Shop & Products Button (فروشگاه و محصولات)
    if (/^(🛍️|🛒)?\s*(فروشگاه.*|محصولات.*|کاتالوگ.*|خرید.*|shop|products)$/iu.test(text) || text === '/shop' || text === '/products') {
      const shopText =
        `🛍️ به فروشگاه تخصصی فرآورده‌های ارگانیک اونیوال (ONIVAL) خوش آمدید!\n\n` +
        `🌿 دسته‌بندی محصولات طبیعی کندو و کوهستان:\n` +
        `▫️ عسل طبیعی و ارگانیک سبلان (گون، آویشن، چهل‌گیاه)\n` +
        `▫️ ژل رویال ۱۰۰٪ خالص و گرده گل تازه کوهستان\n` +
        `▫️ بره‌موم طبیعی و معجون‌های تقویت سیستم ایمنی\n` +
        `▫️ روغن‌های گیاهی خالص و ارگانیک\n\n` +
        `🚚 ارسال سریع پستی به سراسر کشور با ضمانت اصالت و برگه آزمایشگاهی.\n\n` +
        `🌐 جهت مشاهده لیست کامل، قیمت‌های به‌روز و ثبت آنلاین سفارش:\n${storeUrl}`;

      const shopKb = {
        inline_keyboard: [
          [{ text: '🛍️ ورود به وب‌سایت و فروشگاه اونیوال', url: storeUrl }],
          [{ text: '📞 تماس و مشاوره با کارشناسان', url: supportUrl }]
        ]
      };

      if (baleToken && senderChatId) {
        const sendRes = await sendBaleMessage(baleBase, baleToken, senderChatId, shopText, shopKb);
        botActivityLogs.unshift({
          id: Date.now(),
          time,
          type: 'default_command_shop',
          platform: 'bale',
          text: `دستور پیش‌فرض «فروشگاه اونیوال» توسط کاربر (${senderChatId}) دریافت شد و لینک ویترین و محصولات ارسال گردید.`,
          status: 'success',
          rawPayload: { command: text, chatId: senderChatId, username: senderUsername },
          rawResponse: sendRes
        });
        savePersistedState();
      }
      return;
    }

    // 2. Contact Us / Support Button (تماس با ما و پشتیبانی)
    if (/^(📞|☎️)?\s*(تماس.*|پشتیبانی.*|ارتباط.*|contact|support)$/iu.test(text) || text === '/contact' || text === '/support') {
      const contactPhone = siteContent?.contactPhone || '۰۲۱-۱۲۳۴۵۶۷۸ / ۰۹۱۲۳۴۵۶۷۸۹';
      const contactAddress = siteContent?.contactAddress || 'تهران، مجموعه تخصصی فرآورده‌های ارگانیک اونیوال';
      const contactText =
        `📞 تماس با ما و واحد پشتیبانی فروشگاه اونیوال:\n\n` +
        `▫️ آیدی پشتیبان اختصاصی در بله: @${supportUsername}\n` +
        `▫️ شماره‌های تماس و مشاوره: ${contactPhone}\n` +
        `▫️ ساعات پاسخگویی: همه روزه از ساعت ۸:۰۰ الی ۲۲:۰۰\n` +
        `▫️ نشانی دفتر مرکزی: ${contactAddress}\n\n` +
        `💡 پیگیری سفارشات: برای پیگیری آنی سفارش، شماره فاکتور خود (مانند ONV-ORD-XXX) را در همین چت ارسال نمایید.`;

      const contactKb = {
        inline_keyboard: [
          [{ text: '💬 چت مستقیم با پشتیبانی در بله', url: supportUrl }],
          [{ text: '🌐 صفحه تماس با ما در وب‌سایت', url: `${storeUrl}/#contact` }]
        ]
      };

      if (baleToken && senderChatId) {
        const sendRes = await sendBaleMessage(baleBase, baleToken, senderChatId, contactText, contactKb);
        botActivityLogs.unshift({
          id: Date.now(),
          time,
          type: 'default_command_contact',
          platform: 'bale',
          text: `دستور پیش‌فرض «تماس با ما و پشتیبانی» توسط کاربر (${senderChatId}) دریافت شد و مشخصات تماس ارسال گردید.`,
          status: 'success',
          rawPayload: { command: text, chatId: senderChatId, username: senderUsername },
          rawResponse: sendRes
        });
        savePersistedState();
      }
      return;
    }

    // 3. Track Order Button (پیگیری سفارش)
    if (/^(📦|🔍)?\s*(پیگیری.*|رهگیری.*|وضعیت سفارش.*|track|tracking)$/iu.test(text) || text === '/track') {
      const activePending = orders.find(o => o.paymentStatus !== 'Paid' && (o.baleChatId === senderChatId || o.chatId === senderChatId));
      let trackText =
        `📦 سامانه هوشمند پیگیری سفارشات اونیوال:\n\n` +
        `جهت بررسی وضعیت آماده‌سازی، کد رهگیری پستی و تاییدیه فاکتور، کافیست شماره فاکتور خود را ارسال فرمایید (مثال: ONV-ORD-949).\n\n`;

      if (activePending) {
        trackText +=
          `💡 آخرین فاکتور فعال شما:\n` +
          `▫️ کد رهگیری: ${activePending.trackingCode}\n` +
          `▫️ خریدار: ${activePending.userFullName}\n` +
          `▫️ مبلغ: ${Number(activePending.totalPrice || 0).toLocaleString('fa-IR')} تومان\n` +
          `▫️ وضعیت پرداخت: ${activePending.paymentStatus === 'Paid' ? '✅ پرداخت شده' : '⏳ در انتظار پرداخت'}\n\n`;
      }

      trackText += `🌐 برای پیگیری در وب‌سایت از دکمه زیر استفاده نمایید:`;

      const trackKb = {
        inline_keyboard: [
          [{ text: '🔍 پیگیری سفارش در وب‌سایت', url: activePending ? `${storeUrl}/?track=${activePending.trackingCode}` : `${storeUrl}/?track=` }],
          [{ text: '🛍️ ورود به فروشگاه', url: storeUrl }]
        ]
      };

      if (baleToken && senderChatId) {
        const sendRes = await sendBaleMessage(baleBase, baleToken, senderChatId, trackText, trackKb);
        botActivityLogs.unshift({
          id: Date.now(),
          time,
          type: 'default_command_track',
          platform: 'bale',
          text: `دستور پیش‌فرض «پیگیری سفارش» برای کاربر (${senderChatId}) پردازش و راهنمای پیگیری ارسال شد.`,
          status: 'success',
          rawPayload: { command: text, chatId: senderChatId },
          rawResponse: sendRes
        });
        savePersistedState();
      }
      return;
    }

    // 4. Payment Guide Button (راهنمای روش‌های پرداخت)
    if (/^(💳)?\s*(راهنمای پرداخت.*|کارت به کارت.*|نحوه پرداخت.*|روش پرداخت.*|pay_help|payment)$/iu.test(text) || text === '/pay_help') {
      const cardNum = siteContent?.paymentConfig?.cardNumber || '۶۰۳۷-۹۹۷۵-۹۹۱۲-۳۴۵۶';
      const cardHolder = siteContent?.paymentConfig?.cardHolderName || 'فروشگاه تخصصی اونیوال';
      const bank = siteContent?.paymentConfig?.bankName || 'بانک ملی ایران';

      const payHelpText =
        `💳 راهنمای روش‌های پرداخت سفارش در اونیوال:\n\n` +
        `۱️⃣ پرداخت مستقیم با کیف پول بله (سریع‌ترین روش):\n` +
        `در پیام فاکتور، دکمه «پرداخت» کارت درخواست پول بله را لمس کنید تا فاکتور آنی و بدون کارمزد تسویه شود.\n\n` +
        `۲️⃣ پرداخت آنلاین شتابی در سایت:\n` +
        `با لمس لینک پرداخت هر فاکتور، وارد درگاه پرداخت بانکی سایت می‌شوید.\n\n` +
        `۳️⃣ کارت به کارت شتابی:\n` +
        `▫️ شماره کارت: ${cardNum}\n` +
        `▫️ به نام: ${cardHolder}\n` +
        `▫️ بانک: ${bank}\n\n` +
        `📌 پس از کارت به کارت، کد رهگیری فاکتور یا تصویر فیش را ارسال نمایید تا وضعیت سفارش تأیید گردد.`;

      const payKb = {
        inline_keyboard: [
          [{ text: '🌐 ورود به سایت و پرداخت فاکتور', url: storeUrl }],
          [{ text: '📞 پشتیبانی مالی و فیش', url: supportUrl }]
        ]
      };

      if (baleToken && senderChatId) {
        const sendRes = await sendBaleMessage(baleBase, baleToken, senderChatId, payHelpText, payKb);
        botActivityLogs.unshift({
          id: Date.now(),
          time,
          type: 'default_command_pay_help',
          platform: 'bale',
          text: `راهنمای روش‌های پرداخت و کارت به کارت برای کاربر (${senderChatId}) ارسال شد.`,
          status: 'success',
          rawPayload: { command: text, chatId: senderChatId },
          rawResponse: sendRes
        });
        savePersistedState();
      }
      return;
    }

    // 5. My Latest Invoice Button (استعلام و پرداخت فاکتور من)
    if (/^(🧾)?\s*(استعلام.*|فاکتور.*|صورتحساب.*|سفارش.*|پرداخت.*|invoice|pay)$/iu.test(text) || text === '/invoice' || text === '/pay') {
      const targetOrder = orders.find(o => o.paymentStatus !== 'Paid' && (o.baleChatId === senderChatId || o.chatId === senderChatId));
      if (targetOrder) {
        await deliverOrderInvoice(targetOrder, 'مشخصات آخرین فاکتور سفارش شما در سامانه اونیوال:');
        return;
      } else {
        if (activeToken && senderChatId) {
          await sendBaleMessage(
            baleBase,
            activeToken,
            senderChatId,
            'جهت مشاهده و پرداخت فاکتور، لطفاً کد رهگیری سفارش خود (مانند ONV-ORD-XXX) را ارسال فرمایید یا از وب‌سایت اقدام فرمایید.'
          );
        }
        return;
      }
    }

    // =========================================================================
    // STEP C: ADMIN SPECIFIC COMMANDS (/orders, /confirm_...)
    // Handled when interacting with Admin Bot or explicitly requested by admin
    // =========================================================================
    const isAdminCommand =
      text.startsWith('/orders') ||
      text.startsWith('/confirm_') ||
      text.startsWith('/تایید_') ||
      text === '/admin' ||
      text === 'سفارشات' ||
      text === 'لیست سفارشات';

    if (isAdminCommand) {
      if (!isAdmin) {
        botActivityLogs.unshift({
          id: Date.now(),
          time,
          type: 'unauthorized_admin_command_attempt',
          platform: 'bale',
          text: `تلاش غیرمجاز برای دسترسی به دستورات مدیریتی (${text}) از فرستنده ناشناس با چت‌آیدی ${senderChatId}.`,
          status: 'warning'
        });
        savePersistedState();
        if (activeToken && senderChatId) {
          await sendBaleMessage(
            baleBase,
            activeToken,
            senderChatId,
            `⛔ دسترسی غیرمجاز: شناسه چت شما (${senderChatId}) به عنوان مدیر فروشگاه ثبت نشده است.`
          );
        }
        return;
      }

      if (text === '/orders' || text === 'سفارشات' || text === 'لیست سفارشات') {
        const pendingList = orders.slice(0, 8);
        let reply = `📋 آخرین وضعیت سفارشات فروشگاه اونیوال:\n\n`;
        if (pendingList.length === 0) {
          reply += `هیچ سفارشی در سامانه یافت نشد.`;
        } else {
          reply += pendingList.map(o =>
            `🔖 ${o.trackingCode} | ${o.userFullName} (${o.phoneNumber})\n` +
            `💰 ${Number(o.totalPrice).toLocaleString('fa-IR')} تومان | ${o.paymentStatus === 'Paid' ? '✅ پرداخت شده' : '⏳ پرداخت نشده'} (${o.paymentMethod === 'bale_bot' ? 'کیف پول بله' : 'کارت به کارت'})\n` +
            `📦 وضعیت: ${o.status === 'Processing' ? 'در حال آماده‌سازی' : o.status === 'Shipped' ? 'ارسال شده' : 'در انتظار'}\n` +
            `تایید سریع: /confirm_${o.trackingCode}`
          ).join('\n──────────\n');
        }
        if (adminToken && senderChatId) {
          await sendBaleMessage(baleBase, adminToken, senderChatId, reply);
        }
        return;
      }

      const confirmMatch = text.match(/^\/(?:confirm_?|تایید_?)\s*([A-Za-z0-9_-]+)/i);
      if (confirmMatch) {
        const codeToConfirm = confirmMatch[1].trim().toUpperCase();
        const order = findOrderByTrackingOrCode(codeToConfirm);
        if (order) {
          order.paymentStatus = 'Paid';
          order.status = 'Processing';
          deductOrderInventoryOnPayment(order);
          savePersistedState();
          botActivityLogs.unshift({
            id: Date.now(),
            time,
            type: 'admin_bale_confirm',
            platform: 'bale',
            text: `سفارش ${order.trackingCode} مستقیماً توسط مدیر در ربات ادمین تایید گردید.`,
            status: 'success'
          });
          const reply = `✅ سفارش ${order.trackingCode} با موفقیت توسط شما تایید شد!\n\n` +
            `👤 خریدار: ${order.userFullName}\n` +
            `💰 مبلغ: ${Number(order.totalPrice).toLocaleString('fa-IR')} تومان\n` +
            `📦 وضعیت جدید: در حال آماده‌سازی و ارسال\n\n` +
            `پیام اطلاع‌رسانی برای خریدار ارسال گردید.`;
          if (adminToken && senderChatId) {
            await sendBaleMessage(baleBase, adminToken, senderChatId, reply);
          }

          // Notify customer in Bale
          const customerChat = order.baleChatId || order.chatId;
          if (customerChat && customerToken) {
            const custNotify =
              `🎉 خریدار گرامی ${order.userFullName || 'عزیز'}،\n\n` +
              `✅ فیش واریزی شما برای سفارش ${order.trackingCode} توسط مدیریت فروشگاه تأیید گردید!\n\n` +
              `💰 مبلغ تسویه شده: ${Number(order.totalPrice || 0).toLocaleString('fa-IR')} تومان\n` +
              `📦 وضعیت سفارش شما به «در حال آماده‌سازی و ارسال پستی 🚚» تغییر یافت.\n\n` +
              `از خرید و همراهی گرم شما با مجموعه فرآورده‌های ارگانیک اونیوال صمیمانه سپاسگزاریم. 🍯🌿\n\n` +
              `🔍 پیگیری لحظه‌ای سفارش:\n${siteUrl}/?track=${order.trackingCode}`;

            sendBaleMessage(baleBase, customerToken, customerChat, custNotify, {
              inline_keyboard: [
                [{ text: '🌐 پیگیری آنلاین سفارش در سایت', url: `${siteUrl}/?track=${order.trackingCode}` }]
              ]
            }).catch(() => {});
          }
        } else {
          if (adminToken && senderChatId) {
            await sendBaleMessage(baleBase, adminToken, senderChatId, `⚠️ سفارش با کد رهگیری «${codeToConfirm}» در سیستم یافت نشد.`);
          }
        }
        return;
      }
    }

    if (botOrigin === 'admin' && (text === '/start' || text === '/admin' || text === 'شروع')) {
      if (!isAdmin) {
        const unauthorizedMsg =
          `⚠️ این ربات اختصاصی مدیریت و اعلانات فروشگاه اونیوال است.\n\n` +
          `شناسه عددی چت شما: ${senderChatId}\n` +
          `وضعیت: احراز هویت نشده\n\n` +
          `جهت دریافت اعلانات سفارشات و فیش‌ها، لطفاً وارد پنل مدیریت وب شده و در بخش «تنظیمات ربات» شناسه چت خود را وارد فرمایید. تغییر شناسه مدیر صرفاً از داخل پنل مدیریت وب امکان‌پذیر است.`;
        if (activeToken && senderChatId) {
          await sendBaleMessage(baleBase, activeToken, senderChatId, unauthorizedMsg);
        }
        return;
      }

      const adminGreeting =
        `سلام مدیر گرامی 👑\n\n` +
        `این «ربات اختصاصی ادمین و مدیریت فروشگاه اونیوال» است.\n` +
        `شناسه عددی چت شما: ${senderChatId}\n\n` +
        `📌 تمامی اعلان‌های سفارشات جدید، فیش‌های کارت‌به‌کارت و پرداخت‌های کیف پول بله به این چت ارسال می‌شوند.\n\n` +
        `دستورات کاربردی مدیریت:\n` +
        `📋 /orders : مشاهده آخرین سفارشات\n` +
        `✅ /confirm_کدفاکتور : تایید و تسویه فوری سفارش`;

      const adminKb = {
        inline_keyboard: [
          [{ text: '🌐 ورود به پنل مدیریت سایت', url: storeUrl }],
          [{ text: '🛍️ مشاهده فروشگاه', url: storeUrl }]
        ]
      };
      if (adminToken && senderChatId) {
        await sendBaleMessage(baleBase, adminToken, senderChatId, adminGreeting, adminKb);
      }
      return;
    }

    // =========================================================================
    // STEP D: START / GENERAL MESSAGES FOR CUSTOMER BOT (/start, شروع, سلام)
    // Welcomes the customer and presents quick action buttons
    // =========================================================================
    const targetToken = customerToken || activeToken || adminToken;
    const userPendingOrder = orders.find(o => o.paymentStatus !== 'Paid' && (o.baleChatId === senderChatId || o.chatId === senderChatId));
    const isStartWord = /^[\/!#]?(start|help|شروع|راهنما|سلام|hello|hi)$/iu.test(text);

    if (targetToken && senderChatId) {
      // If customer has their OWN active pending order and greeted, deliver their invoice
      if (userPendingOrder && (isStartWord || userPendingOrder.paymentStatus !== 'Paid')) {
        await deliverOrderInvoice(userPendingOrder, 'فاکتور سفارش فعال شما آماده پرداخت است:');
        return;
      }

      // Customer Welcome Message with Navigation Links
      const welcomeText =
        `سلام! 🍯 به ربات رسمی پرداخت و فروشگاه تخصصی فرآورده‌های ارگانیک اونیوال خوش آمدید.\n\n` +
        `جهت تسویه یا مشاهده پیش‌فاکتور، کافیست شماره فاکتور خود (مانند ONV-ORD-XXX) را ارسال فرمایید یا از گزینه‌های زیر استفاده نمایید:`;

      const welcomeKb = {
        inline_keyboard: [
          [
            { text: '🛍️ ورود به فروشگاه آنلاین', url: storeUrl },
            { text: '📞 تماس با ما و پشتیبانی', url: supportUrl }
          ],
          ...(userPendingOrder ? [[
            { text: `💳 پرداخت فاکتور (${userPendingOrder.trackingCode})`, url: `${storeUrl}/?track=${userPendingOrder.trackingCode}` },
            { text: '🔍 پیگیری سفارش در سایت', url: `${storeUrl}/?track=${userPendingOrder.trackingCode}` }
          ]] : [])
        ]
      };

      const sendRes = await sendBaleMessage(baleBase, targetToken, senderChatId, welcomeText, welcomeKb);
      botActivityLogs.unshift({
        id: Date.now(),
        time,
        type: 'default_command_start',
        platform: 'bale',
        text: `پیام خوش‌آمدگویی و منوی دسترسی سریع توسط ربات مشتری به کاربر (${senderChatId}) ارسال شد.`,
        status: 'success',
        rawPayload: { command: text, chatId: senderChatId },
        rawResponse: sendRes
      });
      savePersistedState();

      // Send persistent quick buttons to customer
      const replyKeyboard = {
        keyboard: [
          [{ text: '🧾 استعلام و پرداخت فاکتور من' }],
          [{ text: '🛍️ فروشگاه اونیوال' }, { text: '📦 پیگیری سفارش' }],
          [{ text: '💳 راهنمای روش‌های پرداخت' }, { text: '📞 تماس با ما و پشتیبانی' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      };
      sendBaleMessage(baleBase, targetToken, senderChatId, '📌 منوی دسترسی سریع مشتری:', replyKeyboard).catch(() => {});
      return;
    }

    // Fallback: Never stay silent
    if (activeToken && senderChatId) {
      const fallbackReplyKeyboard = {
        keyboard: [
          [{ text: '🧾 استعلام و پرداخت فاکتور من' }],
          [{ text: '🛍️ فروشگاه اونیوال' }, { text: '📦 پیگیری سفارش' }],
          [{ text: '💳 راهنمای روش‌های پرداخت' }, { text: '📞 تماس با ما و پشتیبانی' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      };
      sendBaleMessage(baleBase, activeToken, senderChatId, 'پیام شما دریافت شد. جهت استعلام فاکتور یا پیگیری سفارش، لطفاً یکی از گزینه‌های زیر را انتخاب فرمایید:', fallbackReplyKeyboard).catch(() => {});
    }
    return;
  }
}

// GET Bot Logs endpoint (for UI Log Box)
app.get('/api/bot/logs', (req: Request, res: Response) => {
  res.json({ ok: true, logs: botActivityLogs });
});

// Interactive Bot Command Tester (for both Customer side & Admin Log Box)
app.post('/api/bot/test-command', async (req: Request, res: Response) => {
  const command = String(req.body.command || '/start').trim();
  const testChatId = String(req.body.chatId || telegramConfig.baleAdminChatId || '').trim();
  const numericChatId = !isNaN(Number(testChatId)) && Number(testChatId) > 0 ? Number(testChatId) : 10001;

  const simulatedUpdate = {
    update_id: Date.now(),
    message: {
      message_id: Math.floor(Math.random() * 90000) + 10000,
      from: {
        id: numericChatId,
        first_name: 'تستر ساید مشتری',
        username: 'onival_tester'
      },
      chat: {
        id: numericChatId,
        type: 'private'
      },
      date: Math.floor(Date.now() / 1000),
      text: command
    }
  };

  try {
    await processIncomingBotUpdate(simulatedUpdate);
    const extractedCode = extractTrackingCodeFromText(command);
    const matchedOrder = extractedCode ? findOrderByTrackingOrCode(extractedCode) : null;

    res.json({
      ok: true,
      command,
      extractedCode,
      matchedOrder: matchedOrder ? {
        id: matchedOrder.id,
        trackingCode: matchedOrder.trackingCode,
        userFullName: matchedOrder.userFullName,
        totalPrice: matchedOrder.totalPrice,
        paymentStatus: matchedOrder.paymentStatus,
        itemsCount: (matchedOrder.items || []).length
      } : null,
      logs: botActivityLogs.slice(0, 30)
    });
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      error: err?.message || 'خطا در اجرای تست ربات',
      logs: botActivityLogs.slice(0, 30)
    });
  }
});

// Dedicated Real Admin Bot Tester Endpoint
app.post('/api/bot/test-admin-bot', async (req: Request, res: Response) => {
  const { chatId, token } = req.body || {};
  const adminToken = (token || getAdminBotToken()).trim();
  const adminChat = (chatId || getAdminChatId()).trim();
  const baleBase = sanitizeBotBaseUrl('bale', telegramConfig.baleBaseUrl || telegramConfig.baseUrl || 'https://tapi.bale.ai').replace(/\/+$/, '');
  const time = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (!adminToken) return res.status(400).json({ ok: false, message: 'توکن ربات ادمین وارد نشده است.' });
  if (!adminChat) return res.status(400).json({ ok: false, message: 'شناسه چت ادمین (Admin Chat ID) وارد نشده است.' });

  try {
    const text =
      `👑 تست موفقیت‌آمیز ربات اختصاصی ادمین فروشگاه اونیوال:\n\n` +
      `▫️ وضعیت: ارتباط فعال و آماده دریافت تراکنش‌ها ✅\n` +
      `▫️ شناسه عددی چت شما: ${adminChat}\n` +
      `▫️ ساعت تست: ${time}\n\n` +
      `تمامی اعلان‌های سفارشات جدید، آپلود فیش‌های کارت‌به‌کارت و پرداخت‌های بله به این صفحه ارسال خواهند شد.`;

    const apiRes = await fetch(`${baleBase}/bot${adminToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: adminChat, text })
    });
    const data: any = await apiRes.json().catch(() => ({}));
    const ok = Boolean(apiRes.ok && data?.ok);

    botActivityLogs.unshift({
      id: Date.now(),
      time,
      type: 'test_admin_bot',
      platform: 'bale',
      text: `ارسال پیام آزمایشی به چت ادمین (${adminChat}) از طریق ربات ادمین: ${ok ? 'موفق' : (data?.description || `HTTP ${apiRes.status}`)}`,
      status: ok ? 'success' : 'warning',
      rawResponse: data
    });
    savePersistedState();

    res.json({
      ok,
      apiData: data,
      message: ok ? 'پیام تست به اکانت ادمین در بله ارسال شد.' : `خطای بله: ${data?.description || apiRes.status}`,
      logs: botActivityLogs.slice(0, 30)
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: `خطای شبکه: ${err.message}` });
  }
});

// Dedicated Real Customer Bot Tester Endpoint
app.post('/api/bot/test-customer-bot', async (req: Request, res: Response) => {
  const { token } = req.body || {};
  const customerToken = (token || getCustomerBotToken()).trim();
  const baleBase = sanitizeBotBaseUrl('bale', telegramConfig.baleBaseUrl || telegramConfig.baseUrl || 'https://tapi.bale.ai').replace(/\/+$/, '');
  const time = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (!customerToken) return res.status(400).json({ ok: false, message: 'توکن ربات مشتری وارد نشده است.' });

  try {
    const apiRes = await fetch(`${baleBase}/bot${customerToken}/getMe`);
    const data: any = await apiRes.json().catch(() => ({}));
    const ok = Boolean(apiRes.ok && data?.ok);

    botActivityLogs.unshift({
      id: Date.now(),
      time,
      type: 'test_customer_bot',
      platform: 'bale',
      text: `بررسی اتصال و وضعیت ربات مشتری در بله: ${ok ? `معتبر (@${data?.result?.username || 'bot'})` : (data?.description || `HTTP ${apiRes.status}`)}`,
      status: ok ? 'success' : 'warning',
      rawResponse: data
    });
    savePersistedState();

    res.json({
      ok,
      botInfo: data?.result,
      message: ok ? `اتصال ربات مشتری معتبر است (@${data?.result?.username || 'bot'}).` : `پاسخ بله: ${data?.description || apiRes.status}`,
      logs: botActivityLogs.slice(0, 30)
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: `خطای شبکه: ${err.message}` });
  }
});

// Webhook endpoints for Bale & Telegram (compatible with Node & PHP endpoints)
const WEBHOOK_PATHS = [
  '/api/webhook/bale',
  '/api/bot/webhook/bale',
  '/api/webhook/bale/customer',
  '/api/webhook/bale/admin',
  '/api/webhook/telegram',
  '/api/bot/webhook/telegram',
  '/api/webhook.php',
  '/api/bale-webhook.php',
  '/api/telegram-webhook.php',
  '/api/bale-bot.php',
  '/api/telegram-bot.php',
  '/bale-bot.php',
  '/telegram-bot.php',
  '/api/webhook'
];

app.all(['/bot-config.php', '/api/bot-config.php'], (_req: Request, res: Response) => {
  res.status(403).json({
    ok: false,
    error: 'دسترسی مستقیم به این فایل مسدود است. تنظیمات ربات صرفاً از طریق پنل مدیریت وب انجام می‌شود.'
  });
});

app.get(WEBHOOK_PATHS, (req: Request, res: Response) => {
  const isTg = req.path.includes('telegram') || req.query.platform === 'telegram';
  res.json({
    ok: true,
    status: 'active',
    service: 'ONIVAL Webhook Gateway',
    version: '1.2.0',
    platform: isTg ? 'telegram' : 'bale',
    timestamp: new Date().toISOString(),
    baleCustomerBot: `@${(telegramConfig.baleBotUsername || 'Onivalbot').replace(/^@/, '')}`,
    baleAdminBot: `@${(telegramConfig.baleAdminUsername || 'OnivalAdminBot').replace(/^@/, '')}`,
    paymentMode: telegramConfig.balePaymentMode || 'live',
    message: 'درگاه وب‌هوک ربات فعال و آماده دریافت به‌روزرسانی‌های پرداخت و پیام‌ها است.'
  });
});

app.post(WEBHOOK_PATHS, async (req: Request, res: Response) => {
  const configuredSecret = (telegramConfig.webhookSecretToken || '').trim();
  const receivedSecret = (
    req.headers['x-telegram-bot-api-secret-token'] ||
    req.headers['x-bale-bot-api-secret-token'] ||
    req.headers['x-bot-api-secret-token'] ||
    req.headers['x-webhook-secret-token'] ||
    (typeof req.query.secret === 'string' ? req.query.secret : '') ||
    (typeof req.query.token === 'string' ? req.query.token : '') ||
    ''
  ).toString().trim();

  if (configuredSecret) {
    if (!receivedSecret) {
      return res.status(403).json({ ok: false, error: 'احراز هویت وب‌هوک ناموفق بود: توکن امنیتی وب‌هوک ارسال نشده است.' });
    }
    const recBuf = Buffer.from(receivedSecret);
    const confBuf = Buffer.from(configuredSecret);
    if (recBuf.length !== confBuf.length || !crypto.timingSafeEqual(recBuf, confBuf)) {
      return res.status(403).json({ ok: false, error: 'احراز هویت وب‌هوک ناموفق بود: توکن امنیتی وب‌هوک نامعتبر است.' });
    }
  }

  const update = req.body || {};
  const isExplicitAdmin = req.path.includes('/admin') || req.query.bot === 'admin';
  try {
    await processIncomingBotUpdate(update, isExplicitAdmin ? 'admin' : 'customer');
  } catch (err) {
    console.warn('Error in webhook update:', err);
  }
  res.json({ ok: true });
});

// Background Long Polling for Both Customer Bot and Admin Bot
let isBalePollingRunning = false;
async function startBaleBotPolling() {
  if (isBalePollingRunning) return;
  isBalePollingRunning = true;
  console.log('[Bale Polling] Background long-polling started for Customer Bot and Admin Bot.');

  // Poller 1: Customer Bot Poller
  (async () => {
    let customerOffset = 0;
    while (isBalePollingRunning) {
      const cToken = getCustomerBotToken();
      const baleBase = sanitizeBotBaseUrl('bale', telegramConfig.baleBaseUrl || telegramConfig.baseUrl || 'https://tapi.bale.ai').replace(/\/+$/, '');

      if (!cToken) {
        await new Promise((r) => setTimeout(r, 6000));
        continue;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        const res = await fetch(`${baleBase}/bot${cToken}/getUpdates?offset=${customerOffset}&timeout=10`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data: any = await res.json().catch(() => null);
          if (data?.ok && Array.isArray(data.result)) {
            for (const item of data.result) {
              if (item.update_id) {
                customerOffset = Math.max(customerOffset, item.update_id + 1);
              }
              await processIncomingBotUpdate(item, 'customer').catch((e) => console.warn('processIncomingBotUpdate err:', e));
            }
          }
        } else {
          await new Promise((r) => setTimeout(r, res.status === 409 ? 15000 : 4000));
        }
      } catch (err: any) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  })();

  // Poller 2: Admin Bot Poller (runs if admin token is set and differs from customer token)
  (async () => {
    let adminOffset = 0;
    while (isBalePollingRunning) {
      const aToken = getAdminBotToken();
      const cToken = getCustomerBotToken();
      const baleBase = sanitizeBotBaseUrl('bale', telegramConfig.baleBaseUrl || telegramConfig.baseUrl || 'https://tapi.bale.ai').replace(/\/+$/, '');

      if (!aToken || aToken === cToken) {
        await new Promise((r) => setTimeout(r, 8000));
        continue;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        const res = await fetch(`${baleBase}/bot${aToken}/getUpdates?offset=${adminOffset}&timeout=10`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data: any = await res.json().catch(() => null);
          if (data?.ok && Array.isArray(data.result)) {
            for (const item of data.result) {
              if (item.update_id) {
                adminOffset = Math.max(adminOffset, item.update_id + 1);
              }
              await processIncomingBotUpdate(item, 'admin').catch((e) => console.warn('processIncomingBotUpdate admin err:', e));
            }
          }
        } else {
          await new Promise((r) => setTimeout(r, res.status === 409 ? 15000 : 4000));
        }
      } catch (err: any) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  })();
}

// Background Long Polling for Telegram Bot
let isTelegramPollingRunning = false;
async function startTelegramBotPolling() {
  if (isTelegramPollingRunning) return;
  isTelegramPollingRunning = true;
  console.log('[Telegram Polling] Background long-polling started for Telegram Bot.');

  (async () => {
    let tgOffset = 0;
    while (isTelegramPollingRunning) {
      const tgToken = (telegramConfig.telegramBotToken || '').trim();
      const tgEnabled = Boolean(telegramConfig.telegramBotEnabled ?? telegramConfig.telegramEnabled);
      const tgBase = sanitizeBotBaseUrl('telegram', telegramConfig.telegramBaseUrl || 'https://api.telegram.org').replace(/\/+$/, '');

      if (!tgEnabled || !tgToken) {
        await new Promise((r) => setTimeout(r, 10000));
        continue;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        const res = await fetch(`${tgBase}/bot${tgToken}/getUpdates?offset=${tgOffset}&timeout=10`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data: any = await res.json().catch(() => null);
          if (data?.ok && Array.isArray(data.result)) {
            for (const item of data.result) {
              if (item.update_id) {
                tgOffset = Math.max(tgOffset, item.update_id + 1);
              }
              await processIncomingBotUpdate(item, 'customer').catch((e) => console.warn('processIncomingBotUpdate tg err:', e));
            }
          }
        } else {
          await new Promise((r) => setTimeout(r, res.status === 409 ? 15000 : 5000));
        }
      } catch {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  })();
}

// Real Bale Invoice Direct Tester (sendInvoice API)
app.post('/api/bot/test-send-invoice', async (req: Request, res: Response) => {
  const { chatId, trackingCode, providerToken, priceToman } = req.body || {};
  const targetChat = (chatId || telegramConfig.baleAdminChatId || telegramConfig.adminChatId || '').trim();
  const token = (telegramConfig.baleBotToken || telegramConfig.botToken || '').trim();
  const baseUrl = sanitizeBotBaseUrl('bale', telegramConfig.baleBaseUrl || telegramConfig.baseUrl || 'https://tapi.bale.ai').replace(/\/+$/, '');
  const walletToken = (providerToken || getActiveBaleWalletToken()).trim();
  const time = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (!token) {
    return res.status(400).json({ ok: false, message: 'توکن ربات بله تنظیم نشده است.' });
  }
  if (!targetChat) {
    return res.status(400).json({
      ok: false,
      message: 'شناسه چت مقصد مشخص نشده است. لطفاً شناسه عددی چت یا ابتدا یک پیام در بله ارسال نمایید.'
    });
  }

  const code = trackingCode || (orders[0]?.trackingCode) || `ONV-TEST-${Math.floor(100 + Math.random() * 900)}`;
  const totalAmountToman = priceToman || (orders[0]?.totalPrice) || 350000;
  const totalAmountRial = totalAmountToman * 10;

  const result = await sendBaleInvoice({
    baseUrl,
    token,
    chatId: targetChat,
    title: `فاکتور تست ${code}`,
    description: `فاکتور آزمایشی کیف پول بله اونیوال (توکن: ${walletToken.slice(0, 10)}...)`,
    payload: `order_${code}`,
    providerToken: walletToken,
    totalPriceRial: totalAmountRial
  });

  botActivityLogs.unshift({
    id: Date.now(),
    time,
    type: 'test_invoice_sent',
    platform: 'bale',
    text: `تست ارسال فاکتور کیف پول بله به چت ${targetChat} با توکن ${walletToken}: ${result.ok ? 'موفق' : (result.data?.description || 'خطا')}`,
    status: result.ok ? 'success' : 'warning'
  });
  savePersistedState();

  return res.json({
    ok: result.ok,
    apiData: result.data,
    walletToken,
    chatId: targetChat,
    message: result.ok
      ? `فاکتور رسمی کیف پول بله با موفقیت به چت ${targetChat} ارسال شد! دکمه پرداخت را در پیام‌رسان بله بررسی نمایید.`
      : `پاسخ وب‌سرویس بله: ${result.data?.description || `HTTP ${result.status}`}`
  });
});

// Complete End-to-End Simulation of Bale Payment Lifecycle
app.post('/api/bot/simulate-bale-payment-cycle', async (req: Request, res: Response) => {
  const time = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  const siteUrl = (telegramConfig.panelBaseUrl || 'http://localhost:3000').replace(/\/+$/, '');
  const botUser = (telegramConfig.baleBotUsername || telegramConfig.botUsername || 'Onivalbot').replace(/^@/, '');
  const adminUser = (telegramConfig.baleAdminUsername || '');

  // Find or create test order
  const newOrderId = orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 101;
  const trackingCode = `ONV-ORD-${newOrderId}`;
  const balePaymentUrl = `https://ble.ir/${botUser}?start=pay_${trackingCode}`;

  const testOrder: any = {
    id: newOrderId,
    userFullName: 'مشتری آزمایشی بله',
    phoneNumber: '09129876543',
    userAddress: 'تهران، خیابان ولیعصر، سفارش آزمایشی درگاه کیف پول بله',
    totalPrice: 420000,
    status: 'Processing' as const,
    paymentStatus: 'Paid' as const,
    paymentMethod: 'bale_bot' as const,
    trackingCode,
    creationTime: new Date().toLocaleDateString('fa-IR'),
    balePaymentUrl,
    items: [
      {
        id: 1,
        productId: 1,
        productName: 'عسل کوهستان سبلان اونیوال',
        size: '۱ کیلوگرم',
        quantity: 1,
        unitPrice: 420000,
        totalPrice: 420000
      }
    ]
  };

  orders.unshift(testOrder);

  // 1. Customer confirmation message (as would be delivered to customer in Bale)
  const customerConfirmation =
    `🎉 پرداخت شما در کیف پول بله با موفقیت انجام شد!\n\n` +
    `🧾 فاکتور سفارش: ${trackingCode}\n` +
    `💳 مبلغ پرداخت شده: ۴۲۰,۰۰۰ تومان\n` +
    `📦 وضعیت: در حال آماده‌سازی و ارسال در انبار\n\n` +
    `🔍 آدرس پیگیری مرسوله در وب‌سایت اونیوال:\n${siteUrl}/?track=${trackingCode}`;

  // 2. Admin notification
  const adminNotification =
    `💰 تراکنش جدید در کیف پول بله!\n\n` +
    `🔖 کد رهگیری: ${trackingCode}\n` +
    `👤 خریدار: مشتری آزمایشی بله (09129876543)\n` +
    `💵 مبلغ تسویه شده: ۴۲۰,۰۰۰ تومان\n` +
    `📍 آدرس: تهران، خیابان ولیعصر\n\n` +
    `🛍 اقلام سفارش:\n▫️ عسل کوهستان سبلان اونیوال (۱ کیلوگرم) × ۱ عدد\n\n` +
    `⚡ وضعیت سفارش تایید و به «در حال پردازش / آماده‌سازی» تغییر یافت.\n` +
    `🔗 پیگیری در سایت: ${siteUrl}/?track=${trackingCode}\n` +
    `دستور تایید مجدد: /confirm_${trackingCode}`;

  // Dispatch live notification if connected
  await dispatchBotNotification(adminNotification, 'simulate_bale_payment');

  botActivityLogs.unshift({
    id: Date.now(),
    time,
    type: 'bale_cycle_simulated',
    platform: 'bale',
    text: `چرخه کامل پرداخت بله برای سفارش ${trackingCode} تست شد: صدور فاکتور -> پرداخت کیف پول -> تایید مشتری -> اطلاع‌رسانی به ادمین (${adminUser}).`,
    status: 'success'
  });

  savePersistedState();

  res.json({
    ok: true,
    success: true,
    order: testOrder,
    balePaymentUrl,
    customerConfirmation,
    adminNotification,
    adminAccount: adminUser,
    activeWalletToken: getActiveBaleWalletToken(),
    message: `چرخه پرداخت بله با موفقیت شبیه‌سازی شد! فاکتور صادر گردید، پرداخت تایید شد و جزئیات کامل به ادمین (${adminUser}) ارسال شد.`,
    logs: botActivityLogs.slice(0, 30)
  });
});

// Admin Account & Authentication
app.get('/api/account/profile', (req: Request, res: Response) => {
  res.json({
    username: adminCredentials.username || 'admin',
    email: adminCredentials.email || 'admin@onival.com',
    name: adminCredentials.name || 'مدیریت اونیوال (ONIVAL Admin)',
    initialSetupCompleted: Boolean(adminCredentials.initialSetupCompleted),
    oneTimePasswordExpired: Boolean(adminCredentials.oneTimePasswordExpired),
    siteLogo: siteContent.siteLogo || '',
    siteLogoFit: siteContent.siteLogoFit || 'cover',
    siteLogoShape: siteContent.siteLogoShape || 'rounded',
    siteLogoScale: siteContent.siteLogoScale || 100
  });
});

app.get('/api/admin/setup-status', (req: Request, res: Response) => {
  res.json({
    initialSetupCompleted: Boolean(adminCredentials.initialSetupCompleted),
    defaultUsername: 'admin',
    initialOtp: !adminCredentials.initialSetupCompleted ? INITIAL_SETUP_OTP : null
  });
});

app.post('/api/admin/login', (req: Request, res: Response) => {
  // 1. Rate Limiting Check (Anti Brute-Force)
  const rateLimitStatus = checkLoginRateLimit(req);
  if (!rateLimitStatus.allowed) {
    return res.status(429).json({
      ok: false,
      error: `تعداد تلاش‌های ناموفق شما بیش از حد مجاز بوده است. لطفاً ${rateLimitStatus.retryAfterSeconds} ثانیه دیگر مجدداً تلاش نمایید.`,
      retryAfterSeconds: rateLimitStatus.retryAfterSeconds
    });
  }

  const { username, password } = req.body || {};
  const inputUser = (username || '').trim().toLowerCase();
  const inputPass = (password || '').trim();

  const isInitialPending = !adminCredentials.initialSetupCompleted;
  const validUser = (adminCredentials.username || 'admin').trim().toLowerCase();
  const validEmail = (adminCredentials.email || 'admin@onival.com').trim().toLowerCase();
  const validPassOrHash = (adminCredentials.password || 'admin').trim();

  if (!inputUser || !inputPass) {
    return res.status(400).json({
      ok: false,
      error: 'لطفاً نام کاربری و رمز عبور مدیریت را به صورت کامل وارد نمایید.'
    });
  }

  // If initial setup is already completed, the one-time password and old default password are strictly rejected
  if (!isInitialPending) {
    if (inputPass === INITIAL_SETUP_OTP || (adminCredentials.oneTimePassword && inputPass === adminCredentials.oneTimePassword)) {
      return res.status(401).json({
        ok: false,
        error: 'رمز عبور یکبار مصرف اولیه منقضی شده است. لطفاً با نام کاربری و رمز عبور دائمی جدید خود وارد شوید.'
      });
    }
  }

  let isUserMatch = inputUser === validUser || inputUser === validEmail;
  if (isInitialPending && inputUser === 'admin') {
    isUserMatch = true;
  }

  let isPassMatch = false;
  let loggedInWithOtp = false;

  if (isUserMatch) {
    if (isInitialPending) {
      // During initial setup phase, either the designated OTP, 'admin', or the stored initial password matches
      if (inputPass === INITIAL_SETUP_OTP || inputPass === (adminCredentials.oneTimePassword || INITIAL_SETUP_OTP) || inputPass === 'admin') {
        isPassMatch = true;
        loggedInWithOtp = true;
      } else if (verifyAdminPassword(inputPass, validPassOrHash)) {
        isPassMatch = true;
        loggedInWithOtp = true;
      }
    } else {
      // Normal permanent authentication: strictly verify against active scrypt password
      isPassMatch = verifyAdminPassword(inputPass, validPassOrHash);
    }
  }

  if (isUserMatch && isPassMatch) {
    // Clear failed attempts upon successful login
    clearLoginAttempts(req);

    const token = generateAdminSessionToken(validUser, adminCredentials.password);
    return res.json({
      ok: true,
      success: true,
      token,
      profile: {
        username: adminCredentials.username,
        email: adminCredentials.email,
        name: adminCredentials.name,
        initialSetupCompleted: Boolean(adminCredentials.initialSetupCompleted)
      },
      isInitialPending,
      loggedInWithOtp,
      message: isInitialPending
        ? 'ورود اولیه با موفقیت انجام شد. لطفاً در پنل، نام کاربری و رمز عبور جدید خود را ثبت فرمایید تا مشخصات موقت برای همیشه باطل گردد.'
        : 'ورود به پنل مدیریت با موفقیت انجام شد.'
    });
  }

  // Record failed attempt
  const failureResult = recordFailedLogin(req);
  if (failureResult.blocked) {
    return res.status(429).json({
      ok: false,
      error: `رمز عبور اشتباه است. حساب کاربری شما به مدت ۱۵ دقیقه مسدود شد. لطفاً ${failureResult.retryAfterSeconds} ثانیه دیگر امتحان کنید.`,
      retryAfterSeconds: failureResult.retryAfterSeconds
    });
  }

  return res.status(401).json({
    ok: false,
    error: `نام کاربری یا رمز عبور مدیریت اشتباه است. (فرصت‌های باقیمانده: ${failureResult.remainingAttempts})`,
    remainingAttempts: failureResult.remainingAttempts
  });
});

app.post('/api/account/change-credentials', (req: Request, res: Response) => {
  // Validate caller has active session token
  const authHeader = req.headers.authorization;
  const adminTokenHeader = req.headers['x-admin-token'] as string;
  let sessionToken = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    sessionToken = authHeader.slice(7).trim();
  } else if (adminTokenHeader) {
    sessionToken = adminTokenHeader.trim();
  }
  const session = sessionToken ? activeAdminSessions.get(sessionToken) : undefined;
  if (!session || session.expiresAt <= Date.now()) {
    return res.status(401).json({ ok: false, error: 'نشست کاربری شما معتبر نیست یا منقضی شده است. لطفاً مجدداً وارد شوید.' });
  }

  const { username, currentPassword, newPassword, email, name, siteLogo, siteLogoFit, siteLogoShape, siteLogoScale } = req.body || {};

  const isChangingPassword = Boolean(newPassword && String(newPassword).trim() !== '');
  const isChangingUsername = Boolean(
    username &&
    String(username).trim().toLowerCase() !== (adminCredentials.username || 'admin').trim().toLowerCase()
  );
  const isInitialPending = !adminCredentials.initialSetupCompleted;

  // Item 1: During initial setup, changing only username without new valid password must be rejected!
  if (isInitialPending && isChangingUsername && !isChangingPassword) {
    return res.status(400).json({
      ok: false,
      error: 'در مرحله راه‌اندازی اولیه، جهت تغییر نام کاربری باید حتماً رمز عبور جدید معتبر (حداقل ۶ کاراکتر) نیز تعیین فرمایید.'
    });
  }

  // If initial setup was already completed, strictly verify currentPassword
  if (!isInitialPending && (isChangingPassword || isChangingUsername)) {
    const validPassOrHash = (adminCredentials.password || 'admin').trim();
    if (!currentPassword || !verifyAdminPassword(String(currentPassword).trim(), validPassOrHash)) {
      return res.status(400).json({
        ok: false,
        error: 'رمز عبور فعلی وارد شده صحیح نمی‌باشد. لطفاً رمز عبور فعلی خود را با دقت وارد فرمایید.'
      });
    }
  }

  // If initial setup is pending, check currentPassword if provided
  if (isInitialPending && (isChangingPassword || isChangingUsername)) {
    if (currentPassword && String(currentPassword).trim() !== '') {
      const curTrimmed = String(currentPassword).trim();
      const validPassOrHash = (adminCredentials.password || 'admin').trim();
      const isCurOtp = curTrimmed === INITIAL_SETUP_OTP || curTrimmed === 'admin' || (adminCredentials.oneTimePassword && curTrimmed === adminCredentials.oneTimePassword);
      const isCurValid = isCurOtp || verifyAdminPassword(curTrimmed, validPassOrHash);
      if (!isCurValid) {
        return res.status(400).json({
          ok: false,
          error: 'رمز عبور فعلی یا رمز یکبار مصرف وارد شده صحیح نمی‌باشد.'
        });
      }
    }
  }

  if (isChangingPassword) {
    const trimmedPass = String(newPassword).trim();
    if (trimmedPass.length < 6) {
      return res.status(400).json({ ok: false, error: 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.' });
    }
    // Store cryptographically hashed password with scrypt + random 16-byte salt
    adminCredentials.password = hashPasswordWithScrypt(trimmedPass);
  }

  // If new credentials were provided, mark initial setup complete, expire OTP and invalidate all prior sessions
  if (isChangingPassword || isChangingUsername) {
    adminCredentials.initialSetupCompleted = true;
    adminCredentials.oneTimePassword = null;
    adminCredentials.oneTimePasswordExpired = true;

    // Invalidate all previous active admin sessions to ensure old sessions cannot be hijacked
    activeAdminSessions.clear();
  }

  if (username && String(username).trim()) {
    adminCredentials.username = String(username).trim();
  }
  if (email && String(email).trim()) {
    adminCredentials.email = String(email).trim();
  }
  if (name && String(name).trim()) {
    adminCredentials.name = String(name).trim();
  }
  if (siteLogo !== undefined) {
    siteContent.siteLogo = siteLogo;
  }
  if (siteLogoFit !== undefined) {
    siteContent.siteLogoFit = siteLogoFit;
  }
  if (siteLogoShape !== undefined) {
    siteContent.siteLogoShape = siteLogoShape;
  }
  if (siteLogoScale !== undefined) {
    siteContent.siteLogoScale = Number(siteLogoScale) || 100;
  }

  savePersistedState();

  const updatedToken = generateAdminSessionToken(
    (adminCredentials.username || 'admin').trim().toLowerCase(),
    (adminCredentials.password || 'admin').trim()
  );

  res.json({
    ok: true,
    success: true,
    token: updatedToken,
    profile: {
      username: adminCredentials.username,
      email: adminCredentials.email,
      name: adminCredentials.name,
      initialSetupCompleted: adminCredentials.initialSetupCompleted,
      siteLogo: siteContent.siteLogo || '',
      siteLogoFit: siteContent.siteLogoFit || 'cover',
      siteLogoShape: siteContent.siteLogoShape || 'rounded',
      siteLogoScale: siteContent.siteLogoScale || 100
    },
    siteContent,
    message: isInitialPending
      ? 'نام کاربری و رمز عبور دائمی شما با موفقیت ثبت شد. رمز یکبار مصرف اولیه برای همیشه باطل گردید و از این پس فقط اطلاعات جدید معتبر است.'
      : 'مشخصات امنیتی مدیریت با موفقیت بروزرسانی شد.'
  });
});

// Admin Logout endpoint (terminates active session token)
app.post('/api/admin/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const headerToken = (req.headers['x-admin-token'] as string || '').trim();
  const token = bearerToken || headerToken;
  if (token) {
    activeAdminSessions.delete(token);
  }
  res.json({ success: true, message: 'خروج از حساب مدیریت با موفقیت انجام شد.' });
});

app.get('/api/admin/verify-session', (req: Request, res: Response) => {
  if (isRequestAdminAuthorized(req)) {
    return res.json({
      ok: true,
      profile: {
        username: adminCredentials.username,
        email: adminCredentials.email,
        name: adminCredentials.name
      }
    });
  }
  return res.status(401).json({ ok: false, error: 'نشست کاربری منقضی شده یا نامعتبر است.' });
});

// ================= SITE CONTENT & LAYOUT CUSTOMIZER =================
app.get('/api/site-content', (req: Request, res: Response) => {
  res.json(siteContent);
});

const handleSaveSiteContent = (req: Request, res: Response) => {
  const incoming = req.body;
  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ error: 'داده‌های ارسالی نامعتبر است' });
  }

  // Deep merge / update
  siteContent = {
    ...siteContent,
    ...incoming,
    navLabels: {
      ...siteContent.navLabels,
      ...(incoming.navLabels || {})
    },
    homeSections: Array.isArray(incoming.homeSections) && incoming.homeSections.length > 0
      ? incoming.homeSections
      : siteContent.homeSections,
    consultationTopics: Array.isArray(incoming.consultationTopics)
      ? incoming.consultationTopics
      : siteContent.consultationTopics,
    paymentConfig: {
      ...siteContent.paymentConfig,
      ...(incoming.paymentConfig || {})
    },
    seoConfig: {
      ...(siteContent.seoConfig || {}),
      ...(incoming.seoConfig || {})
    },
    consultationConfig: {
      ...siteContent.consultationConfig,
      ...(incoming.consultationConfig || {}),
      topics: Array.isArray(incoming.consultationConfig?.topics)
        ? incoming.consultationConfig.topics
        : siteContent.consultationConfig?.topics,
      socialPlatforms: Array.isArray(incoming.consultationConfig?.socialPlatforms)
        ? incoming.consultationConfig.socialPlatforms
        : siteContent.consultationConfig?.socialPlatforms,
      timeSlots: Array.isArray(incoming.consultationConfig?.timeSlots)
        ? incoming.consultationConfig.timeSlots
        : siteContent.consultationConfig?.timeSlots
    }
  };

  // Keep bot usernames 100% synchronized across payment config and telegramConfig
  if (incoming.paymentConfig?.baleBotUsername) {
    const cleanBotName = String(incoming.paymentConfig.baleBotUsername).replace(/^@/, '').trim();
    if (cleanBotName) {
      telegramConfig.botUsername = cleanBotName;
      telegramConfig.baleBotUsername = cleanBotName;
      if (siteContent.paymentConfig) {
        siteContent.paymentConfig.baleBotUsername = cleanBotName;
      }
    }
  }

  if (Array.isArray(siteContent.consultationConfig?.topics) && siteContent.consultationConfig.topics.length > 0) {
    siteContent.consultationTopics = siteContent.consultationConfig.topics
      .filter((t: any) => t.enabled !== false)
      .map((t: any) => t.title);
  }

  botActivityLogs.unshift({
    id: Date.now(),
    time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    type: 'content_updated',
    text: `تنظیمات محتوا، تیترها و چیدمان صفحات فروشگاه توسط مدیر به‌روزرسانی شد.`,
    status: 'success'
  });

  savePersistedState();

  res.json({ success: true, siteContent, message: 'تنظیمات و متون جدید صفحات با موفقیت ذخیره و در تمام بخش‌ها اعمال گردید.' });
};

app.put('/api/site-content', handleSaveSiteContent);
app.post('/api/site-content', handleSaveSiteContent);

app.post('/api/site-content/reset', (req: Request, res: Response) => {
  siteContent = JSON.parse(JSON.stringify(defaultSiteContent));
  savePersistedState();
  botActivityLogs.unshift({
    id: Date.now(),
    time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    type: 'content_reset',
    text: `محتوای صفحات و چیدمان به مقادیر پیش‌فرض کارخانه بازنشانی شد.`,
    status: 'warning'
  });

  res.json({ success: true, siteContent, message: 'محتوا و چیدمان صفحات به حالت پیش‌فرض بازگردانی شد.' });
});

// ================= SEO REDIRECTS & DIAGNOSTICS API =================
app.get('/api/seo/redirects', (req: Request, res: Response) => {
  res.json(slugRedirects);
});

app.delete('/api/seo/redirects', (req: Request, res: Response) => {
  const { fromPath } = req.body || {};
  if (fromPath) {
    slugRedirects = slugRedirects.filter((r) => r.fromPath !== fromPath);
  } else {
    slugRedirects = [];
  }
  savePersistedState();
  res.json({ ok: true, slugRedirects });
});

// ================= HOST SERVER PERSISTENT STATE SYNC & SEED ENDPOINTS =================
const handleExportHostState = (req: Request, res: Response) => {
  res.json({
    products,
    productCategories,
    posts,
    postCategories,
    contactMessages,
    orders,
    telegramConfig: {
      ...telegramConfig,
      botToken: telegramConfig.botToken ? '***PROTECTED***' : '',
      baleBotToken: telegramConfig.baleBotToken ? '***PROTECTED***' : '',
      adminBotToken: telegramConfig.adminBotToken ? '***PROTECTED***' : '',
      customerBotToken: telegramConfig.customerBotToken ? '***PROTECTED***' : '',
      telegramBotToken: telegramConfig.telegramBotToken ? '***PROTECTED***' : ''
    },
    botActivityLogs,
    siteContent,
    adminCredentials: {
      username: adminCredentials.username,
      email: adminCredentials.email,
      name: adminCredentials.name
      // Note: password is never exported to protect host security
    },
    slugRedirects
  });
};

const handleImportHostState = (req: Request, res: Response) => {
  const incoming = req.body;
  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ error: 'داده‌های ارسالی نامعتبر است' });
  }
  if (Array.isArray(incoming.products) && incoming.products.length > 0) {
    products = incoming.products;
  }
  if (Array.isArray(incoming.productCategories) && incoming.productCategories.length > 0) {
    productCategories = incoming.productCategories;
  }
  if (Array.isArray(incoming.posts) && incoming.posts.length > 0) {
    posts = incoming.posts;
  }
  if (Array.isArray(incoming.postCategories) && incoming.postCategories.length > 0) {
    postCategories = incoming.postCategories;
  }
  if (Array.isArray(incoming.contactMessages)) {
    contactMessages = incoming.contactMessages;
  }
  if (Array.isArray(incoming.orders)) {
    orders = incoming.orders;
  }
  if (incoming.telegramConfig && typeof incoming.telegramConfig === 'object') {
    // Preserve active sensitive tokens if masked
    const filteredConfig = { ...incoming.telegramConfig };
    ['botToken', 'baleBotToken', 'adminBotToken', 'customerBotToken', 'telegramBotToken'].forEach(k => {
      if (filteredConfig[k] === '***PROTECTED***' || !filteredConfig[k]) {
        filteredConfig[k] = telegramConfig[k];
      }
    });
    telegramConfig = { ...telegramConfig, ...filteredConfig };
  }
  if (Array.isArray(incoming.botActivityLogs) && incoming.botActivityLogs.length > 0) {
    botActivityLogs = incoming.botActivityLogs;
  }
  if (incoming.siteContent && typeof incoming.siteContent === 'object') {
    siteContent = { ...siteContent, ...incoming.siteContent };
  }
  // adminCredentials can ONLY be changed via dedicated /api/account/change-credentials with current password verification
  if (Array.isArray(incoming.slugRedirects)) {
    slugRedirects = incoming.slugRedirects;
  }
  savePersistedState();
  res.json({ ok: true, message: 'دیتابیس سرور هاست اختصاصی با موفقیت به‌روزرسانی و در فایل onival-persistent-data.json ذخیره شد.' });
};

app.get('/api/host/export-state', handleExportHostState);
app.post('/api/host/import-state', handleImportHostState);

// Dedicated Authenticated Host Database Backup Download
app.get('/api/admin/backup/download', requireAdminAuth, (req: Request, res: Response) => {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `onival-host-backup-${dateStr}.json`;

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const snapshot = {
    exportedAt: new Date().toISOString(),
    version: '1.2.0',
    products,
    productCategories,
    posts,
    postCategories,
    contactMessages,
    orders,
    telegramConfig: {
      ...telegramConfig,
      botToken: telegramConfig.botToken || '',
      baleBotToken: telegramConfig.baleBotToken || '',
      adminBotToken: telegramConfig.adminBotToken || '',
      customerBotToken: telegramConfig.customerBotToken || '',
      telegramBotToken: telegramConfig.telegramBotToken || '',
      webhookSecretToken: telegramConfig.webhookSecretToken || ''
    },
    botActivityLogs,
    siteContent,
    adminCredentials: {
      username: adminCredentials.username,
      email: adminCredentials.email,
      name: adminCredentials.name
    },
    slugRedirects
  };

  res.send(JSON.stringify(snapshot, null, 2));
});

// Compatibility aliases
app.get('/api/firebase/export-state', handleExportHostState);
app.post('/api/firebase/import-state', handleImportHostState);

// ================= E-COMMERCE & FINANCIAL DATA EXPORT ENDPOINTS =================

// 1. Paid Orders Financial CSV Export
app.get('/api/admin/export/paid-orders.csv', requireAdminAuth, (req: Request, res: Response) => {
  const startDateStr = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : '';
  const endDateStr = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : '';

  const normalizePersianDate = (val: string): string => {
    return String(val || '')
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
      .replace(/-/g, '/')
      .trim();
  };

  const normStart = normalizePersianDate(startDateStr);
  const normEnd = normalizePersianDate(endDateStr);

  // Filter only paid orders
  let paidOrders = orders.filter((o) => o.paymentStatus === 'Paid' || o.status === 'Completed');

  // Filter by date if provided (creationTime format e.g. "1403/06/23" or "2025-02-27")
  if (normStart) {
    paidOrders = paidOrders.filter((o) => {
      const orderDate = normalizePersianDate(String(o.creationTime || o.date || '').slice(0, 10));
      return orderDate >= normStart;
    });
  }
  if (normEnd) {
    paidOrders = paidOrders.filter((o) => {
      const orderDate = normalizePersianDate(String(o.creationTime || o.date || '').slice(0, 10));
      return orderDate <= normEnd;
    });
  }

  const escapeCsvField = (field: any): string => {
    if (field === null || field === undefined) return '""';
    let str = String(field).replace(/"/g, '""');
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'` + str;
    }
    return `"${str}"`;
  };

  const headers = [
    'کد رهگیری',
    'نام مشتری',
    'شماره تماس',
    'آدرس تحویل',
    'مبلغ کل (تومان)',
    'روش پرداخت',
    'تاریخ ثبت',
    'وضعیت سفارش',
    'اقلام فاکتور'
  ];

  const rows = paidOrders.map((o) => {
    const itemsDescription = Array.isArray(o.items)
      ? o.items
          .map((it: any) => `${it.productName || 'کالا'} ${it.size ? `(${it.size})` : ''} × ${it.quantity || 1} (${it.totalPrice || it.unitPrice || 0} تومان)`)
          .join(' | ')
      : '';

    const payMethodFa =
      o.paymentMethod === 'card_to_card'
        ? 'کارت به کارت'
        : o.paymentMethod === 'online_gateway'
        ? 'درگاه پرداخت اینترنتی'
        : 'کیف پول بله';

    const statusFa =
      o.status === 'Completed'
        ? 'تکمیل شده'
        : o.status === 'Shipped'
        ? 'ارسال شده'
        : o.status === 'Processing'
        ? 'در حال آماده‌سازی'
        : o.status === 'Cancelled'
        ? 'لغو شده'
        : 'در انتظار';

    return [
      escapeCsvField(o.trackingCode || `ONV-${o.id}`),
      escapeCsvField(o.userFullName || 'مشتری بدون نام'),
      escapeCsvField(o.phoneNumber || ''),
      escapeCsvField(o.userAddress || ''),
      escapeCsvField(Number(o.totalPrice) || 0),
      escapeCsvField(payMethodFa),
      escapeCsvField(o.creationTime || o.date || ''),
      escapeCsvField(statusFa),
      escapeCsvField(itemsDescription)
    ].join(',');
  });

  const BOM = '\uFEFF';
  const csvContent = BOM + [headers.map(escapeCsvField).join(','), ...rows].join('\r\n');
  const filename = `paid-orders-${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
});

// 2. WooCommerce Standard Product CSV Export
app.get('/api/admin/export/woocommerce-products.csv', requireAdminAuth, (req: Request, res: Response) => {
  const origin = getRequestOrigin(req);
  const activeProducts = products.filter((p) => !p.isDelete);

  const escapeCsvField = (field: any): string => {
    if (field === null || field === undefined) return '""';
    let str = String(field).replace(/"/g, '""');
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'` + str;
    }
    return `"${str}"`;
  };

  const columns = [
    'ID',
    'Type',
    'SKU',
    'Name',
    'Published',
    'Is featured?',
    'Visibility in catalog',
    'Short description',
    'Description',
    'Date sale price starts',
    'Date sale price ends',
    'Tax status',
    'Tax class',
    'In stock?',
    'Stock',
    'Low stock amount',
    'Backorders allowed?',
    'Sold individually?',
    'Weight (kg)',
    'Length (cm)',
    'Width (cm)',
    'Height (cm)',
    'Allow customer reviews?',
    'Purchase note',
    'Sale price',
    'Regular price',
    'Categories',
    'Tags',
    'Shipping class',
    'Images',
    'Download limit',
    'Download expiry days',
    'Parent',
    'Grouped products',
    'Upsells',
    'Cross-sells',
    'External URL',
    'Button text',
    'Position',
    'Attribute 1 name',
    'Attribute 1 value(s)',
    'Attribute 1 visible',
    'Attribute 1 global'
  ];

  const csvRows: string[] = [];

  for (const p of activeProducts) {
    const isVariable = Boolean(p.hasSize && Array.isArray(p.sizes) && p.sizes.length > 0);
    const category = p.categoryTitle || 'عمومی';
    const shortDesc = p.description || '';
    const longDesc = p.content || p.description || '';
    const discount = Number(p.discount ?? p.discountPercent ?? 0);
    const sku = p.slug || `ONV-PRD-${p.id}`;

    const mainImageUrl = p.imageName
      ? (p.imageName.startsWith('http') ? p.imageName : `${origin}${p.imageName.startsWith('/') ? '' : '/'}${p.imageName}`)
      : `${origin}/images/honey-default.jpg`;

    const allImages = [
      mainImageUrl,
      ...(Array.isArray(p.galleryImages)
        ? p.galleryImages.map((img) => (img.startsWith('http') ? img : `${origin}${img.startsWith('/') ? '' : '/'}${img}`))
        : [])
    ].join(', ');

    if (!isVariable) {
      // Simple product
      const regularPrice = Number(p.price) || 0;
      const salePrice = discount > 0 ? Math.round(regularPrice * (100 - discount) / 100) : '';
      const inStock = (p.isOutOfStock || Number(p.stock ?? 1) <= 0) ? 0 : 1;
      const stockQty = Number(p.stock ?? 10);

      const row = [
        escapeCsvField(p.id),
        escapeCsvField('simple'),
        escapeCsvField(sku),
        escapeCsvField(p.title),
        escapeCsvField(1),
        escapeCsvField(0),
        escapeCsvField('visible'),
        escapeCsvField(shortDesc),
        escapeCsvField(longDesc),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField('taxable'),
        escapeCsvField(''),
        escapeCsvField(inStock),
        escapeCsvField(stockQty),
        escapeCsvField(''),
        escapeCsvField(0),
        escapeCsvField(0),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(1),
        escapeCsvField(''),
        escapeCsvField(salePrice),
        escapeCsvField(regularPrice),
        escapeCsvField(category),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(allImages),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(0),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField('')
      ];
      csvRows.push(row.join(','));
    } else {
      // Variable product parent
      const sizeNames = p.sizes.map((s: any) => s.name).join(', ');
      const basePrice = p.sizes[0]?.price || Number(p.price) || 0;
      const salePrice = discount > 0 ? Math.round(basePrice * (100 - discount) / 100) : '';
      const inStock = (p.isOutOfStock || Number(p.stock ?? 1) <= 0) ? 0 : 1;
      const stockQty = Number(p.stock ?? 10);

      const parentRow = [
        escapeCsvField(p.id),
        escapeCsvField('variable'),
        escapeCsvField(sku),
        escapeCsvField(p.title),
        escapeCsvField(1),
        escapeCsvField(0),
        escapeCsvField('visible'),
        escapeCsvField(shortDesc),
        escapeCsvField(longDesc),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField('taxable'),
        escapeCsvField(''),
        escapeCsvField(inStock),
        escapeCsvField(stockQty),
        escapeCsvField(''),
        escapeCsvField(0),
        escapeCsvField(0),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(1),
        escapeCsvField(''),
        escapeCsvField(salePrice),
        escapeCsvField(basePrice),
        escapeCsvField(category),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(allImages),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(''),
        escapeCsvField(0),
        escapeCsvField('بسته‌بندی'),
        escapeCsvField(sizeNames),
        escapeCsvField(1),
        escapeCsvField(1)
      ];
      csvRows.push(parentRow.join(','));

      // Child variation rows
      p.sizes.forEach((s: any, idx: number) => {
        const varRegularPrice = Number(s.price) || 0;
        const varSalePrice = discount > 0 ? Math.round(varRegularPrice * (100 - discount) / 100) : '';
        const varInStock = (p.isOutOfStock || (s.stock !== undefined && Number(s.stock) <= 0)) ? 0 : 1;
        const varStockQty = s.stock !== undefined ? Number(s.stock) : Number(p.stock ?? 10);
        const varSku = `${sku}-VAR-${idx + 1}`;

        const varRow = [
          escapeCsvField(`${p.id}${idx + 1}`),
          escapeCsvField('variation'),
          escapeCsvField(varSku),
          escapeCsvField(`${p.title} - ${s.name}`),
          escapeCsvField(1),
          escapeCsvField(0),
          escapeCsvField('visible'),
          escapeCsvField(''),
          escapeCsvField(''),
          escapeCsvField(''),
          escapeCsvField(''),
          escapeCsvField('taxable'),
          escapeCsvField(''),
          escapeCsvField(varInStock),
          escapeCsvField(varStockQty),
          escapeCsvField(''),
          escapeCsvField(0),
          escapeCsvField(0),
          escapeCsvField(''),
          escapeCsvField(''),
          escapeCsvField(''),
          escapeCsvField(''),
          escapeCsvField(1),
          escapeCsvField(''),
          escapeCsvField(varSalePrice),
          escapeCsvField(varRegularPrice),
          escapeCsvField(''),
          escapeCsvField(''),
          escapeCsvField(''),
          escapeCsvField(''),
          escapeCsvField(''),
          escapeCsvField(''),
          escapeCsvField(`id:${p.id}`),
          escapeCsvField(''),
          escapeCsvField(''),
          escapeCsvField(''),
          escapeCsvField(''),
          escapeCsvField(''),
          escapeCsvField(idx + 1),
          escapeCsvField('بسته‌بندی'),
          escapeCsvField(s.name),
          escapeCsvField(1),
          escapeCsvField(1)
        ];
        csvRows.push(varRow.join(','));
      });
    }
  }

  const BOM = '\uFEFF';
  const csvContent = BOM + [columns.map(escapeCsvField).join(','), ...csvRows].join('\r\n');
  const filename = `woocommerce-products-${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
});

// 3. WordPress WXR 1.2 XML Export
app.get('/api/admin/export/wordpress-wxr.xml', requireAdminAuth, (req: Request, res: Response) => {
  const origin = getRequestOrigin(req);

  function escapeXml(str: any): string {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function cdata(str: any): string {
    const clean = String(str || '').replace(/]]>/g, ']]]]><![CDATA[>');
    return `<![CDATA[${clean}]]>`;
  }

  const siteTitle = escapeXml(siteContent?.brandName || 'فروشگاه اونیوال | ONIVAL');
  const siteDescription = escapeXml(siteContent?.metaDescription || 'تولید و عرضه مستقیم عسل ارگانیک، ژل رویال و محصولات زنبورعسل');
  const exportDate = new Date().toUTCString();

  let xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:wfw="http://wellformedweb.org/CommentAPI/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/1.2/"
>
<channel>
  <title>${siteTitle}</title>
  <link>${escapeXml(origin)}</link>
  <description>${siteDescription}</description>
  <pubDate>${exportDate}</pubDate>
  <language>fa-IR</language>
  <wp:wxr_version>1.2</wp:wxr_version>
  <wp:base_site_url>${escapeXml(origin)}</wp:base_site_url>
  <wp:base_blog_url>${escapeXml(origin)}</wp:base_blog_url>
`;

  // Categories
  for (const cat of productCategories) {
    xml += `
  <wp:category>
    <wp:term_id>${cat.id}</wp:term_id>
    <wp:category_nicename>${escapeXml(cat.slug || `cat-${cat.id}`)}</wp:category_nicename>
    <wp:cat_name>${cdata(cat.title)}</wp:cat_name>
  </wp:category>`;
  }

  // Products
  const activeProducts = products.filter((p) => !p.isDelete);
  for (const p of activeProducts) {
    const pubDate = new Date().toUTCString();
    const discount = Number(p.discount ?? p.discountPercent ?? 0);
    const basePrice = p.hasSize && p.sizes?.length ? p.sizes[0].price : (Number(p.price) || 0);
    const salePrice = discount > 0 ? Math.round(basePrice * (100 - discount) / 100) : '';
    const inStock = (p.isOutOfStock || Number(p.stock ?? 1) <= 0) ? 'outofstock' : 'instock';
    const stockQty = Number(p.stock ?? 10);
    const sku = p.slug || `ONV-PRD-${p.id}`;

    xml += `
  <item>
    <title>${cdata(p.title)}</title>
    <link>${escapeXml(origin)}/products/${encodeURIComponent(p.slug || `product-${p.id}`)}</link>
    <pubDate>${pubDate}</pubDate>
    <dc:creator>${cdata('admin')}</dc:creator>
    <guid isPermaLink="false">${escapeXml(origin)}/?post_type=product&#038;p=${p.id}</guid>
    <description>${cdata(p.description || '')}</description>
    <content:encoded>${cdata(p.content || p.description || '')}</content:encoded>
    <excerpt:encoded>${cdata(p.description || '')}</excerpt:encoded>
    <wp:post_id>${p.id}</wp:post_id>
    <wp:post_date>${new Date().toISOString().slice(0, 19).replace('T', ' ')}</wp:post_date>
    <wp:post_type>product</wp:post_type>
    <wp:status>publish</wp:status>
    <wp:post_name>${escapeXml(p.slug || `product-${p.id}`)}</wp:post_name>
    <category domain="product_cat" nicename="${escapeXml(p.slug || 'honey')}">${cdata(p.categoryTitle || 'عمومی')}</category>
    <wp:postmeta>
      <wp:meta_key>_sku</wp:meta_key>
      <wp:meta_value>${cdata(sku)}</wp:meta_value>
    </wp:postmeta>
    <wp:postmeta>
      <wp:meta_key>_price</wp:meta_key>
      <wp:meta_value>${cdata(salePrice || basePrice)}</wp:meta_value>
    </wp:postmeta>
    <wp:postmeta>
      <wp:meta_key>_regular_price</wp:meta_key>
      <wp:meta_value>${cdata(basePrice)}</wp:meta_value>
    </wp:postmeta>
    <wp:postmeta>
      <wp:meta_key>_sale_price</wp:meta_key>
      <wp:meta_value>${cdata(salePrice)}</wp:meta_value>
    </wp:postmeta>
    <wp:postmeta>
      <wp:meta_key>_manage_stock</wp:meta_key>
      <wp:meta_value>${cdata('yes')}</wp:meta_value>
    </wp:postmeta>
    <wp:postmeta>
      <wp:meta_key>_stock</wp:meta_key>
      <wp:meta_value>${cdata(stockQty)}</wp:meta_value>
    </wp:postmeta>
    <wp:postmeta>
      <wp:meta_key>_stock_status</wp:meta_key>
      <wp:meta_value>${cdata(inStock)}</wp:meta_value>
    </wp:postmeta>
  </item>`;
  }

  // Blog Posts
  const activePosts = posts.filter((post) => !post.isDelete);
  for (const post of activePosts) {
    const pubDate = new Date().toUTCString();
    xml += `
  <item>
    <title>${cdata(post.title)}</title>
    <link>${escapeXml(origin)}/blog/${encodeURIComponent(post.slug || `post-${post.id}`)}</link>
    <pubDate>${pubDate}</pubDate>
    <dc:creator>${cdata('admin')}</dc:creator>
    <guid isPermaLink="false">${escapeXml(origin)}/?p=${post.id}</guid>
    <description>${cdata(post.summary || '')}</description>
    <content:encoded>${cdata(post.content || post.summary || '')}</content:encoded>
    <excerpt:encoded>${cdata(post.summary || '')}</excerpt:encoded>
    <wp:post_id>${post.id + 10000}</wp:post_id>
    <wp:post_date>${new Date().toISOString().slice(0, 19).replace('T', ' ')}</wp:post_date>
    <wp:post_type>post</wp:post_type>
    <wp:status>publish</wp:status>
    <wp:post_name>${escapeXml(post.slug || `post-${post.id}`)}</wp:post_name>
    <category domain="category" nicename="blog">${cdata(post.category || 'وبلاگ')}</category>
  </item>`;
  }

  xml += `
</channel>
</rss>`;

  const filename = `wordpress-wxr-${new Date().toISOString().slice(0, 10)}.xml`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(xml);
});

// ================= TECHNICAL SEO: ROBOTS.TXT & SITEMAP.XML =================
function getRequestOrigin(req: Request): string {
  const envOrigin = process.env.APP_URL?.trim();
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() || req.protocol || 'http';
  const host = (req.headers['x-forwarded-host'] as string)?.split(',')[0]?.trim() || req.get('host') || `localhost:${PORT}`;
  const reqOrigin = `${proto}://${host}`;
  return resolveSiteOrigin(siteContent, envOrigin || reqOrigin);
}

app.get('/robots.txt', (req: Request, res: Response) => {
  const origin = getRequestOrigin(req);
  res
    .status(200)
    .set('Content-Type', 'text/plain; charset=utf-8')
    .set('Cache-Control', 'public, max-age=3600')
    .send(generateRobotsTxt(origin));
});

app.get('/sitemap.xml', (req: Request, res: Response) => {
  const origin = getRequestOrigin(req);
  const xml = generateSitemapXml(origin, {
    products,
    productCategories,
    posts,
    siteContent,
  });
  res
    .status(200)
    .set('Content-Type', 'application/xml; charset=utf-8')
    .set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
    .send(xml);
});

// ================= TOROB & EMALLS PRODUCT JSON FEED & HEALTH CHECK =================
app.get(['/api/torob/products', '/api/emalls/products', '/torob/products'], (req: Request, res: Response) => {
  const origin = getRequestOrigin(req);
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const pageSize = Math.min(250, Math.max(1, parseInt(String(req.query.page_size || req.query.per_page || '100'), 10) || 100));

  const publishedProducts = products.filter(
    (p) => !p.isDelete && (p.status || 'published') === 'published' && !p.robotsNoIndex
  );

  const totalCount = publishedProducts.length;
  const maxPages = Math.ceil(totalCount / pageSize) || 1;
  const startIdx = (page - 1) * pageSize;
  const pagedProducts = publishedProducts.slice(startIdx, startIdx + pageSize);

  const torobItems = pagedProducts.map((p) => {
    const isOutOfStock = p.isOutOfStock || Number(p.stock ?? 1) <= 0;
    const discount = Number(p.discount ?? p.discountPercent ?? 0) || 0;
    const basePrice = p.sizes && p.sizes.length > 0 ? p.sizes[0].price : (Number(p.price) || 0);
    const finalPrice = discount > 0 ? Math.round(basePrice * (100 - discount) / 100) : basePrice;

    const fullImageUrl = p.imageName
      ? (p.imageName.startsWith('http') ? p.imageName : `${origin}${p.imageName.startsWith('/') ? '' : '/'}${p.imageName}`)
      : `${origin}/images/honey-default.jpg`;

    const pageUrl = `${origin}/products/${encodeURIComponent(p.slug || `product-${p.id}`)}`;

    return {
      page_unique: String(p.id),
      page_url: pageUrl,
      price: isOutOfStock ? 0 : Math.round(finalPrice),
      old_price: discount > 0 ? Math.round(basePrice) : Math.round(finalPrice),
      availability: isOutOfStock ? 'outofstock' : 'instock',
      title: p.title,
      subtitle: p.categoryTitle || p.description?.slice(0, 80) || '',
      image_link: fullImageUrl,
      image_links: p.galleryImages?.length
        ? p.galleryImages.map(img => img.startsWith('http') ? img : `${origin}${img.startsWith('/') ? '' : '/'}${img}`)
        : [fullImageUrl]
    };
  });

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json({
    count: totalCount,
    max_pages: maxPages,
    current_page: page,
    products: torobItems
  });
});

app.get('/api/torob/ping', (req: Request, res: Response) => {
  const origin = getRequestOrigin(req);
  res.json({
    ok: true,
    status: 'online',
    feedUrl: `${origin}/api/torob/products`,
    sitemapUrl: `${origin}/sitemap.xml`,
    totalProducts: products.filter(p => !p.isDelete && (p.status || 'published') === 'published').length,
    timestamp: new Date().toISOString()
  });
});

// Return genuine 404 JSON for unknown /api/* routes
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: `مسیر API یافت نشد: ${req.path}` });
});

function escapeHtmlAttr(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function injectSsrSeoIntoHtml(rawHtml: string, seo: ReturnType<typeof resolveSeoForPath>): string {
  const headHtml = `
    <title>${escapeHtmlAttr(seo.title)}</title>
    <meta name="description" content="${escapeHtmlAttr(seo.description)}" />
    <meta name="robots" content="${escapeHtmlAttr(seo.robots)}" />
    <link rel="canonical" href="${escapeHtmlAttr(seo.canonicalUrl)}" />
    <meta property="og:type" content="${escapeHtmlAttr(seo.ogType)}" />
    <meta property="og:locale" content="fa_IR" />
    <meta property="og:site_name" content="${escapeHtmlAttr(siteContent?.brandName || 'اونیوال | ONIVAL')}" />
    <meta property="og:title" content="${escapeHtmlAttr(seo.ogTitle)}" />
    <meta property="og:description" content="${escapeHtmlAttr(seo.ogDescription)}" />
    <meta property="og:url" content="${escapeHtmlAttr(seo.canonicalUrl)}" />
    ${seo.ogImage ? `<meta property="og:image" content="${escapeHtmlAttr(seo.ogImage)}" />` : ''}
    ${seo.ogImageAlt ? `<meta property="og:image:alt" content="${escapeHtmlAttr(seo.ogImageAlt)}" />` : ''}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtmlAttr(seo.ogTitle)}" />
    <meta name="twitter:description" content="${escapeHtmlAttr(seo.ogDescription)}" />
    ${seo.ogImage ? `<meta name="twitter:image" content="${escapeHtmlAttr(seo.ogImage)}" />` : ''}
    ${seo.matchedProduct ? `
    <meta name="product_id" content="${escapeHtmlAttr(String(seo.matchedProduct.id))}" />
    <meta name="product_name" content="${escapeHtmlAttr(seo.matchedProduct.title)}" />
    <meta name="product_price" content="${(seo.matchedProduct.isOutOfStock || Number(seo.matchedProduct.stock ?? 1) <= 0) ? '0' : String(Math.round(Number(seo.matchedProduct.price || 0) * (100 - Number(seo.matchedProduct.discount ?? 0)) / 100))}" />
    <meta name="product_old_price" content="${String(Number(seo.matchedProduct.price || 0))}" />
    <meta name="availability" content="${(seo.matchedProduct.isOutOfStock || Number(seo.matchedProduct.stock ?? 1) <= 0) ? 'outofstock' : 'instock'}" />
    ` : ''}
    <script id="onival-jsonld" type="application/ld+json">${JSON.stringify(seo.jsonLd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')}</script>
  `;

  const safeSemanticHtml = (seo.semanticHtml || '').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  let html = rawHtml.replace(
    /<!--SEO_HEAD_START-->[\s\S]*?<!--SEO_HEAD_END-->/,
    `<!--SEO_HEAD_START-->${headHtml}<!--SEO_HEAD_END-->`
  );

  html = html.replace(
    /<!--SEO_BODY_START-->[\s\S]*?<!--SEO_BODY_END-->/,
    `<!--SEO_BODY_START-->${safeSemanticHtml}<!--SEO_BODY_END-->`
  );

  return html;
}

// ================= VITE / SPA + DYNAMIC SSR SEO SERVER SETUP =================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: false,
      },
      appType: 'custom',
    });

    // Serve Vite static assets & HMR / module requests first
    app.use(vite.middlewares);

    // Catch-all HTML route with SSR SEO & HTTP status codes (200 / 301 / 404)
    app.use('*', async (req: Request, res: Response, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
      }
      const pathname = (req.originalUrl || req.url || '/').split('?')[0] || '/';
      // Skip asset requests that slipped through
      if (/\.(js|ts|tsx|css|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|map|json)$/i.test(pathname)) {
        return res.status(404).end();
      }

      try {
        const origin = getRequestOrigin(req);
        const seo = resolveSeoForPath(pathname, origin, {
          products,
          productCategories,
          posts,
          postCategories,
          siteContent,
          slugRedirects,
        });

        if (seo.status === 301 && seo.redirectTo) {
          return res.redirect(301, seo.redirectTo);
        }

        const templatePath = path.join(process.cwd(), 'index.html');
        const rawTemplate = fs.readFileSync(templatePath, 'utf-8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawTemplate);
        const finalHtml = injectSsrSeoIntoHtml(transformed, seo);

        return res
          .status(seo.status)
          .set('Content-Type', 'text/html; charset=utf-8')
          .set('X-Robots-Tag', seo.robots)
          .set(
            'Cache-Control',
            seo.routeType === 'admin' || seo.routeType === 'checkout' || seo.routeType === 'tracking'
              ? 'private, no-store'
              : 'public, max-age=0, must-revalidate'
          )
          .send(finalHtml);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false, maxAge: '7d' }));

    app.get('*', (req: Request, res: Response) => {
      const pathname = (req.originalUrl || req.path || '/').split('?')[0] || '/';
      if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|map)$/i.test(pathname)) {
        return res.status(404).end();
      }

      const origin = getRequestOrigin(req);
      const seo = resolveSeoForPath(pathname, origin, {
        products,
        productCategories,
        posts,
        postCategories,
        siteContent,
        slugRedirects,
      });

      if (seo.status === 301 && seo.redirectTo) {
        return res.redirect(301, seo.redirectTo);
      }

      const indexHtmlPath = path.join(distPath, 'index.html');
      const rawHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
      const finalHtml = injectSsrSeoIntoHtml(rawHtml, seo);

      return res
        .status(seo.status)
        .set('Content-Type', 'text/html; charset=utf-8')
        .set('X-Robots-Tag', seo.robots)
        .set(
          'Cache-Control',
          seo.routeType === 'admin' || seo.routeType === 'checkout' || seo.routeType === 'tracking'
            ? 'private, no-store'
            : 'public, max-age=0, must-revalidate'
        )
        .send(finalHtml);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Onival Web & Admin Server running at http://0.0.0.0:${PORT}`);
    startBaleBotPolling().catch(() => {});
    startTelegramBotPolling().catch(() => {});
  });
}

startServer();

import {
  Product,
  ProductCategory,
  Post,
  PostCategory,
  ContactMessage,
  Order,
  TelegramConfig,
  BotActivityLog,
  SiteContent,
  SlugRedirect
} from '../types';

export interface AdminCredentialsState {
  username: string;
  password: string;
  email: string;
  name: string;
  initialSetupCompleted?: boolean;
  oneTimePassword?: string | null;
  oneTimePasswordExpired?: boolean;
}

export interface FullOnivalCloudState {
  products: Product[];
  productCategories: ProductCategory[];
  posts: Post[];
  postCategories: PostCategory[];
  contactMessages: ContactMessage[];
  orders: Order[];
  telegramConfig: TelegramConfig;
  botActivityLogs: BotActivityLog[];
  siteContent: SiteContent;
  adminCredentials: AdminCredentialsState;
  slugRedirects?: SlugRedirect[];
}

export const INITIAL_SETUP_OTP = 'Onival@Admin2025';

export const DEFAULT_ADMIN_CREDENTIALS: AdminCredentialsState = {
  username: 'admin',
  password: 'admin',
  email: 'admin@onival.com',
  name: 'مدیریت اونیوال (ONIVAL Admin)',
  initialSetupCompleted: false,
  oneTimePassword: INITIAL_SETUP_OTP,
  oneTimePasswordExpired: false
};

export const DEFAULT_PRODUCT_CATEGORIES: ProductCategory[] = [
  { id: 1, title: 'عسل‌های ارگانیک', slug: 'honey', parentId: null, sortOrder: 1 },
  { id: 2, title: 'مکمل‌های غذایی', slug: 'supplement', parentId: null, sortOrder: 2 },
  { id: 3, title: 'نوشیدنی‌ها و دمنوش', slug: 'drink', parentId: null, sortOrder: 3 },
  { id: 4, title: 'خشکبار و مغزیجات', slug: 'nuts', parentId: null, sortOrder: 4 }
];

export const DEFAULT_PRODUCTS: Product[] = [
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
    images: [
      'https://images.unsplash.com/photo-1587049359535-b64d3dd0d716?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=800&auto=format&fit=crop&q=80'
    ],
    videoUrl: 'https://www.aparat.com/video/video/embed/videohash/a1b2c3d/vt/frame',
    videoType: 'aparat',
    imageAspectRatio: 'square',
    imageFitMode: 'cover',
    imageZoomLevel: 2,
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
    images: [
      'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1471943311424-646960669fbc?w=800&auto=format&fit=crop&q=80'
    ],
    imageAspectRatio: 'square',
    imageFitMode: 'cover',
    imageZoomLevel: 2.5,
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

export const DEFAULT_POST_CATEGORIES: PostCategory[] = [
  { id: 1, title: 'راهنمای خرید عسل', slug: 'honey-guide', parentId: null },
  { id: 2, title: 'تغذیه و سبک زندگی سالم', slug: 'healthy-diet', parentId: null },
  { id: 3, title: 'دمنوش و نوشیدنی‌های طبیعی', slug: 'herbal-drinks', parentId: null }
];

export const DEFAULT_POSTS: Post[] = [
  {
    id: 1,
    title: 'چطور عسل ارگانیک را از عسل تقلبی تشخیص دهیم؟',
    slug: 'detect-organic-honey-from-fake',
    categoryId: 1,
    categoryTitle: 'راهنمای خرید عسل',
    description: 'نشانه‌های ظاهری، برچسب استاندارد و نتایج آزمایشگاهی عسل‌های طبیعی برای خریدی مطمئن.',
    content: 'در این مطلب درباره نشانه‌های ظاهری مانند رس‌بستن (شکرک زدن طبیعی عسل خالص)، میزان کشسانی، برچسب استاندارد آزمایشگاهی (ساکارز و پرولین) صحبت می‌کنیم تا هنگام خرید عسل ارگانیک انتخاب مطمئن‌تری داشته باشید.',
    imageName: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&auto=format&fit=crop&q=80',
    videoUrl: 'https://www.aparat.com/video/video/embed/videohash/onival_honey_test/vt/frame',
    videoType: 'aparat',
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

export const DEFAULT_CONTACT_MESSAGES: ContactMessage[] = [
  {
    id: 1,
    fullName: 'امیرحسین رضایی',
    phoneNumber: '09123456789',
    trackingCode: 'ONV-9421',
    message: 'سلام، آیا امکان ارسال عسل کوهستان با بسته‌بندی کادویی وجود دارد؟',
    adminResponse: 'درود بر شما، بله در بخش توضیحات سفارش می‌توانید بسته‌بندی ویژه کادویی را قید فرمایید.',
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
    message: 'آیا ژل رویال در زمان ارسال به شهرستان با پک یخ خشک ارسال می‌شود؟ ممنون از پاسخگویی شما.',
    adminResponse: undefined,
    isRead: false,
    isResponded: false,
    creationTime: '1403/06/23 - 10:15'
  },
  {
    id: 3,
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

export const DEFAULT_ORDERS: Order[] = [
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

export const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
  botToken: '',
  adminChatId: '',
  botUsername: 'Onivalbot',
  baseUrl: 'https://tapi.bale.ai',
  panelBaseUrl: 'http://localhost:3000',
  antiSpamSeconds: 5,
  active: true,
  baleEnabled: true,
  baleBotToken: '',
  baleAdminChatId: '',
  baleAdminUsername: '',
  baleBotUsername: 'Onivalbot',
  baleBaseUrl: 'https://tapi.bale.ai',
  baleWebhookUrl: '',
  balePaymentMode: 'test',
  balePaymentTokenTest: '',
  balePaymentTokenLive: '',
  balePaymentToken: '',
  baleAutoSendInvoice: true,
  baleAutoNotifyAdminAllTransactions: true,
  baleAdminDirectApproval: true,
  telegramEnabled: true,
  telegramBotEnabled: true,
  telegramBotToken: '',
  telegramAdminChatId: '',
  telegramBotUsername: 'onival_shop_bot',
  telegramBaseUrl: 'https://api.telegram.org',
  telegramWebhookUrl: '',
  webhookSecretToken: '',
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
  notifyOnNewOrder: true,
  notifyOnReceiptUpload: true,
  notifyOnNewTicket: true,
  notifyOnPaymentSuccess: true,
  notifyCustomerOnStatusChange: true,
  welcomeTemplate: 'به ربات رسمی فروشگاه تخصصی اونیوال (ONIVAL) خوش آمدید! 🍯\nاز طریق این ربات می‌توانید فاکتورهای خود را پرداخت کنید و وضعیت سفارش را لحظه‌ای پیگیری نمایید.',
  orderInvoiceTemplate: '🧾 فاکتور جدید #{trackingCode}\n👤 مشتری: {customerName}\n📞 تماس: {phone}\n💳 مبلغ کل: {amount} تومان\n📍 آدرس: {address}',
  receiptApprovedTemplate: '✅ فیش واریزی سفارش #{trackingCode} توسط مدیریت تایید شد و مرسوله شما وارد مرحله بسته‌بندی و ارسال گردید.',
  supportReplyTemplate: '💬 پاسخ پشتیبانی اونیوال به پیام #{trackingCode}:\n{response}'
};

export const DEFAULT_BOT_LOGS: BotActivityLog[] = [
  { id: 1, time: '14:30', type: 'incoming_message', platform: 'bale', text: 'پیام جدید از کاربر با شناسه ۹۲۳۳۸۷۷۹۶ (کد رهگیری: ONV-9421)', status: 'success' },
  { id: 2, time: '16:15', type: 'admin_response', platform: 'telegram', text: 'پاسخ مدیر به کد پیگیری ONV-9421 در بله و تلگرام ارسال گردید.', status: 'success' },
  { id: 3, time: '18:05', type: 'bot_query', platform: 'bale', text: 'استعلام وضعیت سفارش ONV-ORD-101 از طریق ربات بله دریافت شد.', status: 'success' }
];

export const DEFAULT_SITE_CONTENT: SiteContent = {
  brandName: 'اونیوال',
  brandEnglishName: 'ONIVAL',
  showHeroEnglishBadge: true,
  topBannerSettings: {
    enabled: true,
    intervalSeconds: 4,
    autoRotate: true,
    showDots: true,
    showArrows: true,
    banners: [
      {
        id: 'banner-1',
        imageUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=1600&auto=format&fit=crop&q=80',
        title: 'عسل طبیعی و خام سبلان با ضمانت کتبی آزمایشگاه',
        subtitle: 'برداشت مستقیم از دامنه کوهستان بدون حرارت‌دهی صنعتی و ساکارز زیر ۲٪',
        linkUrl: '/categories/honey',
        enabled: true
      },
      {
        id: 'banner-2',
        imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=1600&auto=format&fit=crop&q=80',
        title: 'ژل رویال شاهانه ۱۰۰٪ خالص در زنجیره سرمایشی',
        subtitle: 'اکسیر جوانی و تقویت سیستم ایمنی بدن، بسته‌بندی ایزوله یخچالی',
        linkUrl: '/categories/supplement',
        enabled: true
      },
      {
        id: 'banner-3',
        imageUrl: 'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=1600&auto=format&fit=crop&q=80',
        title: 'دمنوش‌های ارگانیک کوهستان و سکنجبین سنتی',
        subtitle: 'طبیعی، آرام‌بخش و تصفیه‌کننده کبد بدون شکر سفید صنعتی',
        linkUrl: '/categories/drink',
        enabled: true
      }
    ]
  },
  siteLogo: '',
  siteLogoFit: 'cover',
  siteLogoShape: 'rounded',
  siteLogoScale: 100,
  systemTagline: 'سامانه یکپارچه مدیریت فروشگاه، مقالات و ربات بله اونیوال (ONIVAL Admin)',
  heroTitlePrefix: 'فروشگاه تخصصی',
  heroSubtitle: 'عرضه مستقیم عسل طبیعی، ژل رویال، گرده گل و فرآورده‌های ارگانیک کوهستان',
  heroAlign: 'center',
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
      id: 'specialOffers',
      title: 'پیشنهاد شگفت‌انگیز',
      subtitle: 'تخفیف‌های استثنایی محصولات برگزیده کندو',
      enabled: true,
      align: 'right',
      order: 1
    },
    {
      id: 'categories',
      title: 'دسته‌بندی‌های محصولات',
      subtitle: 'دسترسی سریع به گروه‌های کالایی',
      enabled: true,
      align: 'right',
      order: 2
    },
    {
      id: 'products',
      title: 'لیست محصولات اونیوال',
      subtitle: 'محصولات ارگانیک و طبیعی با ضمانت اصالت و برگه آزمایشگاه',
      enabled: true,
      align: 'right',
      order: 3
    },
    {
      id: 'consultationBanner',
      title: 'مشاوره تخصصی رایگان',
      subtitle: 'راهنمایی انتخاب عسل دارویی و فرآورده‌های ویژه سلامت',
      enabled: true,
      align: 'center',
      order: 4
    },
    {
      id: 'articles',
      title: 'مقالات و مطالب علمی اونیوال',
      subtitle: 'آخرین نوشته‌ها برای آشنایی با خواص عسل طبیعی، دمنوش‌های گیاهی و سبک زندگی سالم',
      enabled: true,
      align: 'right',
      order: 5
    }
  ],
  specialOffersTitle: 'پیشنهاد شگفت‌انگیز',
  specialOffersButtonText: 'مشاهده همه',
  specialOffersBgColor: '#ef394e',
  productsSectionTitle: 'لیست محصولات اونیوال',
  productsSectionSubtitle: 'محصولات موجود با ضمانت اصالت',
  productsAlign: 'right',
  articlesSectionTitle: 'مقالات و مطالب علمی اونیوال',
  articlesSectionSubtitle: 'آخرین نوشته‌ها برای آشنایی با خواص عسل طبیعی، دمنوش‌های گیاهی و سبک زندگی سالم.',
  articlesPageTitle: 'دانشنامه و مقالات تخصصی اونیوال (ONIVAL)',
  articlesPageSubtitle: 'مرجع جامع راهنمای تشخیص عسل طبیعی، فواید ژل رویال، دمنوش‌های گیاهی و تغذیه ارگانیک',
  articlesAlign: 'right',
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
  consultationAlign: 'center',
  trackingTitle: 'پیگیری وضعیت سفارش و پیام مشاوره',
  trackingSubtitle: 'کد رهگیری فاکتور خرید (مانند ONV-ORD-101) یا کد رهگیری پیام مشاوره (مانند ONV-9421) را وارد نمایید.',
  trackingAlign: 'center',
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
  footerCopyright: 'تمامی حقوق مادی و معنوی متعلق به فروشگاه اونیوال (ONIVAL) می‌باشد.',
  footerFootnote: 'فروشگاه تخصصی فرآورده‌های ارگانیک کوهستان و کندو • تضمین برگه آزمایشگاهی و اصالت ۱۰۰٪ تمامی محصولات • ارسال سریع به سراسر کشور با بسته‌بندی ایمن',
  enamadStatus: 'placeholder',
  enamadCode: '',
  samandehiCode: '',
  torobEnabled: true,
  emallsEnabled: true,
  termsTitle: 'قوانین، مقررات و رویه خرید از فروشگاه اونیوال',
  termsContent: `۱. شرایط عمومی خرید:
ثبت سفارش در فروشگاه تخصصی اونیوال در تمامی ساعات شبانه‌روز و ۷ روز هفته امکان‌پذیر است. سفارشات ثبت شده در روزهای کاری در نوبت پردازش و ارسال قرار می‌گیرند.

۲. اصالت کالا و برگه آزمایشگاهی:
کلیه محصولات زنبورعسل اعم از عسل‌های طبیعی، ژل رویال، بره موم و گرده گل دارای برگه آزمایش معتبر از آزمایشگاه‌های تخصصی کنترل کیفی مواد غذایی بوده و با ضمانت بازگشت وجه تقدیم خریداران گرامی می‌گردد.

۳. روش‌های پرداخت و صدور فاکتور:
پرداخت در فروشگاه به صورت کارت به کارت، پرداخت درون‌برنامه‌ای ربات بله یا درگاه پرداخت آنلاین شاپرک انجام می‌شود. شماره فاکتور اختصاصی صادر شده، سند پیگیری سفارش تا لحظه تحویل مرسوله است.

۴. حفظ حریم خصوصی:
اطلاعات شخصی، شماره تماس و آدرس خریداران محترم به عنوان امانت نزد مجموعه اونیوال محفوظ بوده و صرفاً جهت هماهنگی و ارسال مرسوله استفاده می‌شود.`,
  refundTitle: 'شرایط بازگشت کالا و رویه مرجوعی (گارانتی اصالت)',
  refundContent: `رویه مرجوعی و بازگشت کالا در فروشگاه اونیوال:

۱. ضمانت اصالت و سلامت فیزیکی:
تمامی بسته‌ها با ضربه‌گیرهای مخصوص و پوشش استاندارد ارسال می‌شوند. در صورت هرگونه آسیب‌دیدگی در حین حمل یا مغایرت مشخصات با برگه آزمایش، خریدار محترم می‌تواند ظرف مدت ۷ روز از دریافت کالا مراتب را به پشتیبانی اطلاع دهد.

۲. شرایط عودت فرآورده‌های خوراکی و فاسدشدنی:
به دلیل ماهیت بهداشتی محصولات زنبورعسل (به‌ویژه ژل رویال خام)، در صورتی که پلمپ بهداشتی باز نشده باشد تا ۷ روز امکان عودت وجود دارد. در صورت اثبات عدم اصالت یا تفاوت با برگه آزمایش، هزینه آزمایشگاه و وجه محصول به صورت کامل بازگردانده می‌شود.

۳. نحوه واریز وجه مرجوعی:
پس از دریافت مرسوله توسط انبار اونیوال و بررسی کارشناسی، حداکثر ظرف مدت ۲۴ الی ۴۸ ساعت کاری وجه به شماره کارت معرفی شده واریز خواهد شد.

۴. تماس با واحد مرجوعی و پیگیری:
جهت ثبت درخواست مرجوعی می‌توانید با شماره پشتیبانی ۰۲۱-۱۲۳۴۵۶۷۸ یا اکانت پشتیبانی بله تماس حاصل فرمایید.`,
  paymentConfig: {
    cardToCardEnabled: true,
    cardNumber: '۶۰۳۷-۹۹۷۵-۹۹۱۲-۳۴۵۶',
    cardHolderName: 'مجموعه تخصصی فرآورده‌های ارگانیک اونیوال',
    bankName: 'بانک ملی ایران',
    cardDescription: 'لطفاً مبلغ دقیق فاکتور را به شماره کارت بالا واریز نموده و سپس تصویر واضح فیش واریزی یا اسکرین‌شات رسید انتقال وجه را به همراه شماره فاکتور در کادر زیر بارگذاری فرمایید. پس از تایید فیش توسط مدیریت، می‌توانید وضعیت ارسال سفارش خود را با کد رهگیری پیگیری نمایید.',
    gatewayOfflineNotice: 'همراه گرامی و ارجمند، به دلیل بروزرسانی فنی زیرساخت شبکه بانکی، پرداخت مستقیم از طریق درگاه اینترنتی در حال حاضر به صورت موقت قطع می‌باشد. ضمن پوزش از شما و قدردانی از همراهی و شکیبایی ارزشمندتان، می‌توانید مبلغ فاکتور را با اطمینان کامل به صورت «کارت به کارت» واریز نموده و تصویر فیش را در همین صفحه بارگذاری فرمایید تا سفارش شما بدون هیچ‌گونه تاخیری و در اولویت ویژه آماده و ارسال گردد.',
    baleBotEnabled: true,
    baleBotUsername: 'Onivalbot',
    baleBotDescription: 'اتصال مستقیم به بازوی رسمی بله (@Onivalbot) و دریافت پیش‌فاکتور با امکان پرداخت آنی با کیف پول بله',
    gatewayEnabled: false,
    gatewayTitle: 'پرداخت آنلاین از طریق درگاه بانکی شاپرک',
    gatewayButtonText: 'ورود به درگاه بانکی و پرداخت آنلاین فاکتور',
    gatewayUrl: 'https://zarinp.al/onival',
    gatewayMerchantCode: 'ONIVAL-MERCHANT-982410',
    gatewayDescription: 'پرداخت آنی و امن با کلیه کارت‌های بانکی عضو شبکه شتاب و رمز دوم پویا',
    defaultMethod: 'card_to_card'
  },
  productImageSettings: {
    aspectRatio: 'square',
    fitMode: 'cover',
    zoomEnabled: true,
    zoomLevel: 2,
    borderRadius: 'normal'
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
        iconType: 'bale'
      },
      {
        id: 'telegram',
        name: 'تلگرام (Telegram)',
        placeholder: 'آیدی یا شماره موبایل شما در تلگرام (مثال: @username یا 09123456789)',
        enabled: true,
        iconType: 'telegram'
      },
      {
        id: 'whatsapp',
        name: 'واتساپ (WhatsApp)',
        placeholder: 'شماره موبایل فعال در واتساپ (مثال: 09123456789)',
        enabled: true,
        iconType: 'whatsapp'
      },
      {
        id: 'eitaa',
        name: 'پیام‌رسان ایتا (Eitaa)',
        placeholder: 'آیدی یا شماره موبایل شما در ایتا (مثال: @username یا 09123456789)',
        enabled: true,
        iconType: 'eitaa'
      },
      {
        id: 'instagram',
        name: 'دایرکت اینستاگرام (Instagram)',
        placeholder: 'آیدی پیج اینستاگرام شما (مثال: @your_page)',
        enabled: true,
        iconType: 'instagram'
      },
      {
        id: 'phone',
        name: 'تماس تلفنی مستقیم',
        placeholder: 'شماره تماس مستقیم جهت برقراری تماس کارشناس (مثال: 09123456789)',
        enabled: true,
        iconType: 'phone'
      }
    ]
  }
};

export function createInitialSeedState(): FullOnivalCloudState {
  return JSON.parse(
    JSON.stringify({
      products: DEFAULT_PRODUCTS,
      productCategories: DEFAULT_PRODUCT_CATEGORIES,
      posts: DEFAULT_POSTS,
      postCategories: DEFAULT_POST_CATEGORIES,
      contactMessages: DEFAULT_CONTACT_MESSAGES,
      orders: DEFAULT_ORDERS,
      telegramConfig: DEFAULT_TELEGRAM_CONFIG,
      botActivityLogs: DEFAULT_BOT_LOGS,
      siteContent: DEFAULT_SITE_CONTENT,
      adminCredentials: DEFAULT_ADMIN_CREDENTIALS,
      slugRedirects: []
    })
  );
}

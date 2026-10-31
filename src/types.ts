export interface ProductSize {
  name: string;
  price: number;
  stock?: number;
  specialOfferStock?: number;
  isOutOfStock?: boolean;
  sku?: string;
}

export type PublicationStatus = 'published' | 'draft';
export type StockAvailability = 'InStock' | 'OutOfStock' | 'PreOrder';

export interface SlugRedirect {
  id?: string | number;
  fromPath: string;
  toPath: string;
  entityType: 'product' | 'category' | 'article' | 'article-category';
  entityId: number;
  createdAt: string;
  updatedAt?: string;
}

export interface Product {
  id: number;
  title: string;
  slug: string;
  price: number;
  hasSize: boolean;
  sizes?: ProductSize[];
  priceSmall?: number;
  priceLarge?: number;
  discount?: number;
  discountPercent?: number;
  isAmazingOffer?: boolean;
  isSpecialOffer?: boolean;
  stock?: number;
  isOutOfStock?: boolean;
  specialOfferStock?: number;
  specialOfferInitialStock?: number;
  features?: string[];
  type?: string;
  categoryId: number;
  productCategoryId?: number;
  categoryTitle?: string;
  productCategoryTitle?: string;
  shortDescription?: string;
  brand?: string;
  imageName: string;
  imageAlt?: string;
  images?: string[];
  videoUrl?: string;
  videoType?: 'direct' | 'aparat' | 'youtube';
  imageAspectRatio?: 'square' | 'portrait' | 'wide' | 'auto';
  imageFitMode?: 'cover' | 'contain';
  imageZoomLevel?: number;
  description: string;
  content: string;
  isDelete?: boolean;
  creationTime: string;
  publishedAt?: string;
  updatedAt?: string;
  status?: PublicationStatus;
  availability?: StockAvailability;
  sku?: string;
  seoTitle?: string;
  seoDescription?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
  robotsNoIndex?: boolean;
  robotsNoFollow?: boolean;
}

export interface ProductCategory {
  id: number;
  title: string;
  slug: string;
  parentId?: number | null;
  parentTitle?: string;
  sortOrder?: number;
  description?: string;
  imageName?: string;
  imageAlt?: string;
  status?: PublicationStatus;
  updatedAt?: string;
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: string;
  robotsNoIndex?: boolean;
}

export interface Post {
  id: number;
  title: string;
  slug: string;
  categoryId: number;
  categoryTitle?: string;
  description: string;
  content: string;
  imageName: string;
  imageAlt?: string;
  videoUrl?: string;
  videoType?: 'direct' | 'aparat' | 'youtube';
  viewCount: number;
  authorName: string;
  creationTime: string;
  isDelete?: boolean;
  publishedAt?: string;
  updatedAt?: string;
  status?: PublicationStatus;
  seoTitle?: string;
  seoDescription?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
  robotsNoIndex?: boolean;
  robotsNoFollow?: boolean;
}

export interface PostCategory {
  id: number;
  title: string;
  slug: string;
  parentId?: number | null;
  description?: string;
  status?: PublicationStatus;
  updatedAt?: string;
  seoTitle?: string;
  seoDescription?: string;
  robotsNoIndex?: boolean;
}

export interface ConsultationDetails {
  topicId?: string;
  topicTitle: string;
  preferredDate: string;
  preferredTimeSlot: string;
  socialPlatform: string;
  socialContactId: string;
  price: number;
  durationMinutes?: number;
  question: string;
  adminResponse?: string;
  respondedAt?: string;
  consultationStatus?: 'PendingPayment' | 'PendingVerification' | 'Scheduled' | 'Completed' | 'Cancelled';
}

export interface ConsultationTopicItem {
  id: string;
  title: string;
  description?: string;
  price: number;
  durationMinutes?: number;
  enabled: boolean;
}

export interface ConsultationSocialOption {
  id: string;
  name: string;
  placeholder?: string;
  enabled: boolean;
  iconType?: 'bale' | 'telegram' | 'whatsapp' | 'eitaa' | 'instagram' | 'phone' | 'other';
}

export interface ConsultationConfig {
  basePrice: number;
  allowAddToCart?: boolean;
  allowDirectPayment?: boolean;
  specialistName?: string;
  specialistTitle?: string;
  timeSlots: string[];
  topics: ConsultationTopicItem[];
  socialPlatforms: ConsultationSocialOption[];
}

export interface ContactMessage {
  id: number;
  fullName: string;
  name?: string;
  phoneNumber?: string;
  trackingCode: string;
  message: string;
  adminResponse?: string;
  adminReply?: string;
  isRead: boolean;
  isResponded: boolean;
  creationTime: string;
  respondedAt?: string;
  replyTime?: string;
  isConsultation?: boolean;
  consultationDetails?: ConsultationDetails;
  orderId?: number;
  paymentStatus?: 'Unpaid' | 'PendingVerification' | 'Paid' | 'Failed';
  paymentMethod?: 'card_to_card' | 'bale_bot' | 'bale_wallet' | 'gateway' | 'online_gateway';
  totalPrice?: number;
  receiptImage?: string;
  receiptImageUrl?: string;
  receiptNote?: string;
  receiptUploadedAt?: string;
}

export interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  size?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: number;
  userFullName: string;
  phoneNumber: string;
  userAddress: string;
  totalPrice: number;
  status: 'Pending' | 'Processing' | 'Shipped' | 'Cancelled' | 'Completed';
  paymentStatus: 'Unpaid' | 'PendingVerification' | 'Paid' | 'Failed';
  paymentMethod?: 'card_to_card' | 'bale_bot' | 'bale_wallet' | 'gateway' | 'online_gateway';
  receiptImageUrl?: string;
  receiptImage?: string;
  receiptNote?: string;
  receiptSubmittedAt?: string;
  receiptUploadedAt?: string;
  receiptAdminNote?: string;
  receiptApproved?: boolean;
  trackingCode: string;
  creationTime: string;
  items: OrderItem[];
  balePaymentUrl?: string;
  isConsultation?: boolean;
  consultationDetails?: ConsultationDetails;
}

export interface PaymentConfig {
  cardToCardEnabled: boolean;
  cardNumber: string;
  cardHolderName: string;
  bankName: string;
  cardDescription: string;
  gatewayOfflineNoticeTitle?: string;
  gatewayOfflineNoticeText?: string;
  gatewayOfflineNotice?: string;
  baleBotEnabled: boolean;
  baleBotUsername?: string;
  baleAdminUsername?: string;
  baleWalletId?: string;
  baleBotDescription?: string;
  baleBotButtonText?: string;
  gatewayEnabled: boolean;
  gatewayTitle: string;
  gatewayButtonText?: string;
  gatewayUrl: string;
  gatewayMerchantCode: string;
  gatewayDescription?: string;
  gatewaySimulatorMode?: boolean;
  gatewayProvider?: 'zarinpal' | 'zibal' | 'nextpay' | 'idpay' | 'custom';
  defaultMethod: 'card_to_card' | 'bale_bot' | 'gateway' | 'online_gateway';
}

export interface BotActivityLog {
  id: number;
  time: string;
  timestamp?: string | number;
  type: string;
  platform?: 'bale' | 'telegram' | 'system';
  text: string;
  status: 'success' | 'warning' | 'error';
  details?: string;
  rawPayload?: any;
  rawResponse?: any;
  orderInfo?: any;
  technicalDetails?: Record<string, any>;
}

export interface TelegramConfig {
  // Primary / Legacy compatibility fields
  botToken: string;
  adminChatId: string;
  botUsername?: string;
  baseUrl: string;
  panelBaseUrl: string;
  antiSpamSeconds: number;
  active: boolean;

  // Two-Bot Dedicated Architecture:
  // 1. Customer & Payment Bot (ربات اختصاصی مشتری و پرداخت)
  customerBotEnabled?: boolean;
  customerBotToken?: string;
  customerBotUsername?: string;
  customerBotWebhookUrl?: string;

  // 2. Admin & Management Bot (ربات اختصاصی ادمین و مدیریت فروش)
  adminBotEnabled?: boolean;
  adminBotToken?: string;
  adminBotUsername?: string;
  adminBotWebhookUrl?: string;

  // Explicit Bale Bot Settings (Legacy & Compatibility)
  baleEnabled?: boolean;
  baleBotToken?: string;
  baleAdminChatId?: string;
  baleAdminUsername?: string;
  baleBotUsername?: string;
  baleBaseUrl?: string;
  baleWebhookUrl?: string;
  baleAdminWebhookUrl?: string;
  balePaymentMode?: 'test' | 'live';
  balePaymentTokenTest?: string;
  balePaymentTokenLive?: string;
  balePaymentToken?: string;
  baleAutoSendInvoice?: boolean;
  baleAutoNotifyAdminAllTransactions?: boolean;
  baleAdminDirectApproval?: boolean;

  // Explicit Telegram Bot Settings
  telegramEnabled?: boolean;
  telegramBotEnabled?: boolean;
  telegramBotToken?: string;
  telegramAdminChatId?: string;
  telegramBotUsername?: string;
  telegramBaseUrl?: string;
  telegramWebhookUrl?: string;
  webhookSecretToken?: string;

  // Direct Support Channels & Floating Support Widget
  baleSupportId?: string;
  baleSupportUsername?: string;
  baleChannelId?: string;
  telegramSupportId?: string;
  telegramSupportUsername?: string;
  telegramChannelId?: string;
  whatsappNumber?: string;
  instagramId?: string;
  rubikaSupportId?: string;
  eitaaSupportId?: string;
  supportPhone?: string;
  supportEmail?: string;
  supportHours?: string;
  workingHours?: string;
  autoReplyEnabled?: boolean;
  floatingWidgetEnabled?: boolean;
  floatingWidgetTitle?: string;
  floatingWidgetWelcome?: string;

  // Automated Notification Triggers
  notifyOnNewOrder?: boolean;
  notifyOnReceiptUpload?: boolean;
  notifyOnNewTicket?: boolean;
  notifyOnPaymentSuccess?: boolean;
  notifyCustomerOnStatusChange?: boolean;

  // Customizable Bot Message Templates
  welcomeTemplate?: string;
  orderInvoiceTemplate?: string;
  receiptApprovedTemplate?: string;
  supportReplyTemplate?: string;
}

export interface AdminStats {
  totalProducts: number;
  totalPosts: number;
  unreadMessages: number;
  pendingOrders: number;
  totalRevenue: number;
}

export interface HomeSectionConfig {
  id: 'specialOffers' | 'categories' | 'products' | 'articles' | 'consultationBanner';
  title: string;
  subtitle?: string;
  enabled: boolean;
  align: 'right' | 'center' | 'left';
  order: number;
}

export interface AdminCredentials {
  username: string;
  password?: string;
  email: string;
  name: string;
}

export interface TopBanner {
  id: string;
  imageUrl: string;
  title?: string;
  subtitle?: string;
  badge?: string;
  buttonText?: string;
  buttonLink?: string;
  gradientOverlay?: string;
  linkUrl?: string;
  enabled?: boolean;
}

export interface TopBannerSettings {
  enabled: boolean;
  intervalSeconds: number; // e.g. 4 or 5 seconds
  autoRotate: boolean;
  showDots?: boolean;
  showArrows?: boolean;
  height?: string;
  banners?: TopBanner[];
}

export interface SiteContent {
  brandName: string;
  brandEnglishName: string;
  showHeroEnglishBadge?: boolean;
  topBannerSettings?: TopBannerSettings;
  topBanners?: TopBanner[];
  siteLogo?: string;
  siteLogoFit?: 'cover' | 'contain';
  siteLogoShape?: 'circle' | 'rounded' | 'free';
  siteLogoScale?: number;
  systemTagline: string;
  tagline?: string;
  brandDescription?: string;
  heroTitlePrefix: string;
  heroSubtitle: string;
  heroAlign: 'right' | 'center' | 'left';
  navLabels: {
    home: string;
    articles: string;
    consultation: string;
    tracking: string;
    about: string;
    contact: string;
  };
  navigation?: {
    home?: string;
    articles?: string;
    consultation?: string;
    tracking?: string;
    about?: string;
    contact?: string;
    [key: string]: string | undefined;
  };
  pages?: {
    home?: any;
    articles?: any;
    consultation?: any;
    tracking?: any;
    about?: any;
    contact?: any;
    [key: string]: any;
  };
  homeSections: HomeSectionConfig[];
  specialOffersTitle: string;
  specialOffersButtonText: string;
  specialOffersBgColor: string;
  productsSectionTitle: string;
  productsSectionSubtitle: string;
  productsAlign: 'right' | 'center' | 'left';
  articlesSectionTitle: string;
  articlesSectionSubtitle: string;
  articlesPageTitle: string;
  articlesPageSubtitle: string;
  articlesAlign: 'right' | 'center' | 'left';
  consultationBadge: string;
  consultationTitle: string;
  consultationSubtitle: string;
  consultationTopics: string[];
  consultationAlign: 'right' | 'center' | 'left';
  trackingTitle: string;
  trackingSubtitle: string;
  trackingAlign: 'right' | 'center' | 'left';
  aboutTitle: string;
  aboutParagraph1: string;
  aboutParagraph2: string;
  aboutStat1Value: string;
  aboutStat1Label: string;
  aboutStat2Value: string;
  aboutStat2Label: string;
  aboutStat3Value: string;
  aboutStat3Label: string;
  contactTitle: string;
  contactSubtitle: string;
  contactPhone: string;
  contactAddress: string;
  contactWorkingHours: string;
  contactEmail?: string;
  footerCopyright: string;
  footerFootnote?: string;
  enamadCode?: string;
  enamadStatus?: 'active' | 'pending' | 'placeholder' | 'hidden';
  samandehiCode?: string;
  termsTitle?: string;
  termsContent?: string;
  refundTitle?: string;
  refundContent?: string;
  torobEnabled?: boolean;
  emallsEnabled?: boolean;
  paymentConfig?: PaymentConfig;
  consultationConfig?: ConsultationConfig;
  productImageSettings?: {
    aspectRatio?: 'square' | 'portrait' | 'wide' | 'auto';
    fitMode?: 'cover' | 'contain';
    zoomEnabled?: boolean;
    zoomLevel?: number;
    borderRadius?: 'none' | 'normal' | 'large' | 'full';
  };
  [key: string]: any;
}

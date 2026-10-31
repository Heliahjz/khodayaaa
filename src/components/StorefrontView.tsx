import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingBag, 
  Percent, 
  ArrowLeft, 
  ArrowRight, 
  LayoutGrid, 
  Hexagon, 
  Pill, 
  Coffee, 
  Nut, 
  X, 
  Check, 
  CheckCircle2, 
  Plus, 
  Minus, 
  Search, 
  Lock, 
  KeyRound, 
  Phone, 
  MapPin, 
  Sparkles, 
  Clock, 
  Truck, 
  Package, 
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Send,
  AlertCircle,
  BookOpen,
  Info,
  PhoneCall,
  CreditCard,
  Upload,
  Copy,
  Globe,
  HeartHandshake,
  Image as ImageIcon,
  XCircle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Video,
  Play,
  Film,
  Images,
  ChevronLeft,
  ShieldCheck,
  Terminal,
  Zap,
  Code2,
  FileText,
  MessageSquare
} from 'lucide-react';
import { Product, ProductCategory, Post, ContactMessage, Order, OrderItem, ProductSize, SiteContent, PaymentConfig, TelegramConfig, BotActivityLog } from '../types';
import { apiFetch, setAdminSessionToken, getCachedLocalState } from '../services/dataService';
import { BotTechnicalLogBox } from './BotTechnicalLogBox';
import { TopBannerCarousel } from './TopBannerCarousel';
import { ArticleContentRenderer } from './ArticleContentRenderer';
import {
  DEFAULT_PRODUCTS,
  DEFAULT_PRODUCT_CATEGORIES,
  DEFAULT_POSTS,
  DEFAULT_SITE_CONTENT,
  DEFAULT_ADMIN_CREDENTIALS,
} from '../services/seedData';
import { getActiveBotConfig, sendBaleAdminOrderNotification } from '../services/baleService';
import {
  resolveSeoForPath,
  applyClientDocumentSeo,
  resolveSiteOrigin,
  sanitizeSlug
} from '../utils/seo';
import { sanitizeTrustBadgeHtml } from '../utils/sanitizeHtml';

interface StorefrontViewProps {
  products: Product[];
  categories: ProductCategory[];
  posts: Post[];
  messages: ContactMessage[];
  botConfig?: TelegramConfig;
  siteContent?: SiteContent;
  onBackToAdmin: () => void;
  onPlaceOrder: (orderData: Partial<Order>) => Promise<any>;
  onSubmitContact: (contactData: { fullName: string; phoneNumber?: string; message: string }) => Promise<any>;
  onOrderUpdated?: () => void;
}

interface CartItem {
  cartId: string;
  id: number;
  name: string;
  img: string;
  size: string;
  price: number;
  qty: number;
}

export const StorefrontView: React.FC<StorefrontViewProps> = ({
  products,
  categories,
  posts,
  messages,
  botConfig,
  siteContent,
  onBackToAdmin,
  onPlaceOrder,
  onSubmitContact,
  onOrderUpdated,
}) => {
  // Navigation tabs - includes terms and refund for legal compliance (Torob, Emalls & eNamad)
  const [activePage, setActivePage] = useState<'home' | 'articles' | 'consultation' | 'tracking' | 'about' | 'contact' | 'checkout' | 'terms' | 'refund' | 'not_found'>('home');
  const [notFoundPath, setNotFoundPath] = useState<string>('');
  
  // Category filter: 'all' | 'discounted' | 'honey' | 'supplement' | 'drink' | 'nuts' | or number
  const [activeCategory, setActiveCategory] = useState<string>('all');
  
  // Cart state persisted in localStorage
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = window.localStorage.getItem('onival_cart_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('onival_cart_v1', JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);
  
  // Single Product View & Scroll Restoration
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('استاندارد');
  const [activeProductImageIndex, setActiveProductImageIndex] = useState<number>(0);
  const [productMediaMode, setProductMediaMode] = useState<'gallery' | 'video'>('gallery');
  const [isZoomLensActive, setIsZoomLensActive] = useState<boolean>(false);
  const [zoomMousePos, setZoomMousePos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [lightboxZoomLevel, setLightboxZoomLevel] = useState<number>(2);
  const lastScrollYRef = useRef<number>(0);
  
  const [storefrontNotification, setStorefrontNotification] = useState<string | null>(null);
  const showStorefrontNotice = (msg: string) => {
    setStorefrontNotification(msg);
    setTimeout(() => setStorefrontNotification(null), 4000);
  };

  // Article Reader View
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // Filter out drafts and soft-deleted items for public storefront display (with automatic fallback to seed data)
  const effectiveProducts = React.useMemo(
    () => (products && products.length > 0 ? products : DEFAULT_PRODUCTS),
    [products]
  );
  const effectiveCategories = React.useMemo(
    () => (categories && categories.length > 0 ? categories : DEFAULT_PRODUCT_CATEGORIES),
    [categories]
  );
  const effectivePosts = React.useMemo(
    () => (posts && posts.length > 0 ? posts : DEFAULT_POSTS),
    [posts]
  );

  const publicProducts = React.useMemo(
    () => effectiveProducts.filter((p) => !p.isDelete && (p.status || 'published') === 'published'),
    [effectiveProducts]
  );
  const publicCategories = React.useMemo(
    () => effectiveCategories.filter((c) => (c.status || 'published') === 'published'),
    [effectiveCategories]
  );
  const publicPosts = React.useMemo(
    () => effectivePosts.filter((p) => (p.status || 'published') === 'published'),
    [effectivePosts]
  );

  // Sync browser URL pathname -> Storefront state & document <head> SEO metadata
  const syncRouteFromLocation = React.useCallback(
    (pathname: string) => {
      const origin = resolveSiteOrigin(siteContent, typeof window !== 'undefined' ? window.location.origin : '');
      const resolved = resolveSeoForPath(pathname, origin, {
        products: publicProducts,
        productCategories: publicCategories,
        posts: publicPosts,
        siteContent
      });

      if (resolved.status === 301 && resolved.redirectTo) {
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', resolved.redirectTo);
        }
        const redirected = resolveSeoForPath(resolved.redirectTo, origin, {
          products: publicProducts,
          productCategories: publicCategories,
          posts: publicPosts,
          siteContent
        });
        applyClientDocumentSeo(redirected);
      } else {
        applyClientDocumentSeo(resolved);
      }

      if (resolved.routeType === 'product' && resolved.matchedProduct) {
        setSelectedPost(null);
        setSelectedProduct(resolved.matchedProduct);
        if (resolved.matchedProduct.sizes && resolved.matchedProduct.sizes.length > 0) {
          setSelectedSize(resolved.matchedProduct.sizes[0].name);
        } else {
          setSelectedSize('کوچک');
        }
        setActivePage('home');
        return;
      }

      if (resolved.routeType === 'article' && resolved.matchedPost) {
        setSelectedProduct(null);
        setSelectedPost(resolved.matchedPost);
        setActivePage('articles');
        return;
      }

      if (resolved.routeType === 'category' && resolved.matchedCategory) {
        setSelectedProduct(null);
        setSelectedPost(null);
        setActivePage('home');
        setActiveCategory(resolved.matchedCategory.slug || resolved.matchedCategory.title);
        return;
      }

      if (resolved.routeType === 'not_found') {
        setSelectedProduct(null);
        setSelectedPost(null);
        setNotFoundPath(pathname);
        setActivePage('not_found');
        return;
      }

      setSelectedProduct(null);
      setSelectedPost(null);
      if (
        resolved.routeType === 'home' ||
        resolved.routeType === 'articles' ||
        resolved.routeType === 'consultation' ||
        resolved.routeType === 'tracking' ||
        resolved.routeType === 'about' ||
        resolved.routeType === 'contact' ||
        resolved.routeType === 'checkout' ||
        resolved.routeType === 'terms' ||
        resolved.routeType === 'refund'
      ) {
        setActivePage(resolved.routeType);
        if (resolved.routeType === 'home') {
          setActiveCategory('all');
        }
      }
    },
    [publicProducts, publicCategories, publicPosts, siteContent]
  );

  const syncRouteRef = React.useRef(syncRouteFromLocation);
  syncRouteRef.current = syncRouteFromLocation;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    syncRouteRef.current(window.location.pathname);

    const handlePopState = () => {
      syncRouteRef.current(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Secret Admin Access Modal
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);
  const [adminUsernameInput, setAdminUsernameInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');
  const [isAuthenticatingAdmin, setIsAuthenticatingAdmin] = useState(false);
  const [copyrightClickCount, setCopyrightClickCount] = useState(0);

  // Checkout Form & Active Invoice State
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [checkoutAddress, setCheckoutAddress] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<Order | null>(null);
  const [isConfirmingBale, setIsConfirmingBale] = useState(false);
  const [isConfirmingGateway, setIsConfirmingGateway] = useState(false);

  // Reactive Bale / Telegram Bot Configuration (synced live with admin panel saves)
  const [activeBotConfig, setActiveBotConfig] = useState<TelegramConfig>(() => botConfig || getActiveBotConfig());
  useEffect(() => {
    if (botConfig) setActiveBotConfig(botConfig);
  }, [botConfig]);

  useEffect(() => {
    const handleBotConfigUpdated = (e: any) => {
      if (e?.detail) {
        setActiveBotConfig(prev => ({ ...prev, ...e.detail }));
      }
    };
    window.addEventListener('onival_bot_config_updated', handleBotConfigUpdated);
    return () => window.removeEventListener('onival_bot_config_updated', handleBotConfigUpdated);
  }, []);

  const activeBaleBotUsername = (
    botConfig?.customerBotUsername ||
    botConfig?.baleBotUsername ||
    botConfig?.botUsername ||
    siteContent?.paymentConfig?.baleBotUsername ||
    activeBotConfig?.customerBotUsername ||
    activeBotConfig?.baleBotUsername ||
    activeBotConfig?.botUsername ||
    'Onivalbot'
  ).replace(/^@/, '').trim();

  // Payment Configuration & Card-to-Card Receipt Upload State
  const paymentConfig: PaymentConfig = {
    defaultMethod: siteContent?.paymentConfig?.defaultMethod || 'card_to_card',
    cardToCardEnabled: siteContent?.paymentConfig?.cardToCardEnabled ?? true,
    baleBotEnabled: siteContent?.paymentConfig?.baleBotEnabled ?? true,
    gatewayEnabled: siteContent?.paymentConfig?.gatewayEnabled ?? false,
    gatewayOfflineNotice:
      siteContent?.paymentConfig?.gatewayOfflineNotice ||
      'همراه گرامی، در حال حاضر اتصال مستقیم به درگاه بانکی شاپرک به دلیل به‌روزرسانی زیرساخت بانکی موقتاً غیرفعال است. ضمن پوزش از شکیبایی شما، می‌توانید مبلغ فاکتور را با اطمینان خاطر از طریق «کارت به کارت» واریز نموده و تصویر فیش را در همین صفحه بارگذاری فرمایید تا سفارش شما در اولویت پردازش و ارسال فوری قرار گیرد.',
    cardNumber: siteContent?.paymentConfig?.cardNumber || '6037-9975-9912-3456',
    cardHolderName: siteContent?.paymentConfig?.cardHolderName || 'مجموعه فرآورده‌های ارگانیک اونیوال (سارا محمدی)',
    bankName: siteContent?.paymentConfig?.bankName || 'بانک ملی ایران',
    cardDescription:
      siteContent?.paymentConfig?.cardDescription ||
      'لطفاً پس از انتقال وجه به شماره کارت فوق، تصویر واضح رسید یا اسکرین‌شات واریزی را در کادر زیر انتخاب و ارسال نمایید. شماره فاکتور شما به صورت خودکار به همراه تصویر فیش برای واحد مالی ارسال می‌شود و پس از تایید، می‌توانید با کد رهگیری وضعیت بسته‌بندی و ارسال مرسوله را پیگیری فرمایید.',
    baleBotUsername: activeBaleBotUsername,
    baleAdminUsername: activeBotConfig.baleAdminUsername || siteContent?.paymentConfig?.baleAdminUsername || '',
    baleWalletId: activeBotConfig.balePaymentTokenLive || siteContent?.paymentConfig?.baleWalletId || '',
    baleBotDescription:
      siteContent?.paymentConfig?.baleBotDescription ||
      'جهت تکمیل پرداخت امن و خودکار از طریق پیام‌رسان بله، روی دکمه زیر کلیک کرده و در ربات رسمی اونیوال گزینه شروع (Start) را بزنید.',
    gatewayTitle: siteContent?.paymentConfig?.gatewayTitle || 'درگاه پرداخت اینترنتی شاپرک (کلیه کارت‌های عضو شتاب)',
    gatewayButtonText: siteContent?.paymentConfig?.gatewayButtonText || 'ورود به درگاه بانکی و پرداخت آنلاین فاکتور',
    gatewayUrl: siteContent?.paymentConfig?.gatewayUrl || 'https://sandbox.zarinpal.com/pg/StartPay/',
    gatewayMerchantCode: siteContent?.paymentConfig?.gatewayMerchantCode || '',
    gatewayDescription:
      siteContent?.paymentConfig?.gatewayDescription ||
      'پرداخت آنلاین و آنی با تمامی کارت‌های بانکی عضو شبکه شتاب از طریق رمز دوم پویا.',
  };

  const resolveDefaultPaymentTab = (): 'card_to_card' | 'bale_bot' | 'gateway' => {
    const def = paymentConfig.defaultMethod;
    if (def === 'card_to_card' && paymentConfig.cardToCardEnabled) return 'card_to_card';
    if (def === 'bale_bot' && paymentConfig.baleBotEnabled) return 'bale_bot';
    if (def === 'gateway' && paymentConfig.gatewayEnabled) return 'gateway';
    if (paymentConfig.cardToCardEnabled) return 'card_to_card';
    if (paymentConfig.baleBotEnabled) return 'bale_bot';
    if (paymentConfig.gatewayEnabled) return 'gateway';
    return 'card_to_card';
  };

  const [selectedPaymentTab, setSelectedPaymentTab] = useState<'card_to_card' | 'bale_bot' | 'gateway'>(resolveDefaultPaymentTab);
  const [copiedCard, setCopiedCard] = useState(false);
  const [copiedWalletId, setCopiedWalletId] = useState(false);
  const [copiedTrackingLink, setCopiedTrackingLink] = useState(false);
  const [copiedInvoiceCode, setCopiedInvoiceCode] = useState(false);
  const [copiedPayCmd, setCopiedPayCmd] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string>('');
  const [receiptNote, setReceiptNote] = useState<string>('');
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [receiptUploadError, setReceiptUploadError] = useState('');

  useEffect(() => {
    setSelectedPaymentTab(resolveDefaultPaymentTab());
  }, [
    siteContent?.paymentConfig?.defaultMethod,
    siteContent?.paymentConfig?.cardToCardEnabled,
    siteContent?.paymentConfig?.baleBotEnabled,
    siteContent?.paymentConfig?.gatewayEnabled,
  ]);

  // Specialized Consultation Configuration & State
  const consultationConfig = React.useMemo(() => {
    const raw = siteContent?.consultationConfig;
    const basePrice = raw?.basePrice ?? 120000;
    const defaultTopics = [
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
    ];

    let resolvedTopics =
      raw?.topics && raw.topics.length > 0
        ? raw.topics.filter(t => t.enabled !== false)
        : siteContent?.consultationTopics && siteContent.consultationTopics.length > 0
        ? siteContent.consultationTopics.map((titleStr, idx) => ({
            id: `topic-legacy-${idx}`,
            title: titleStr,
            description: 'مشاوره تخصصی با کارشناس سلامت اونیوال',
            price: basePrice,
            durationMinutes: 30,
            enabled: true
          }))
        : defaultTopics;

    if (resolvedTopics.length === 0) resolvedTopics = defaultTopics;

    const defaultSocials = [
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
    ];

    const resolvedSocials =
      raw?.socialPlatforms && raw.socialPlatforms.filter(s => s.enabled !== false).length > 0
        ? raw.socialPlatforms.filter(s => s.enabled !== false)
        : defaultSocials;

    const resolvedTimeSlots =
      raw?.timeSlots && raw.timeSlots.length > 0
        ? raw.timeSlots
        : [
            'نوبت صبح (۰۹:۰۰ الی ۱۲:۰۰)',
            'نوبت ظهر (۱۲:۰۰ الی ۱۵:۰۰)',
            'نوبت عصر (۱۶:۰۰ الی ۱۹:۰۰)',
            'نوبت شب (۱۹:۰۰ الی ۲۱:۰۰)',
            'اولین زمان خالی کارشناس (فوری)'
          ];

    return {
      basePrice,
      allowAddToCart: raw?.allowAddToCart !== false,
      allowDirectPayment: raw?.allowDirectPayment !== false,
      specialistName: raw?.specialistName || 'متخصص طب سنتی و فرآورده‌های کندوی اونیوال',
      specialistTitle: raw?.specialistTitle || 'مشاوره اختصاصی تغذیه، رژیم درمانی و فرآورده‌های ارگانیک',
      topics: resolvedTopics,
      socialPlatforms: resolvedSocials,
      timeSlots: resolvedTimeSlots
    };
  }, [siteContent]);

  const [consultSelectedTopicId, setConsultSelectedTopicId] = useState<string>('');
  const [consultPreferredDate, setConsultPreferredDate] = useState<string>('فردا');
  const [consultPreferredTimeSlot, setConsultPreferredTimeSlot] = useState<string>('');
  const [consultSelectedSocialId, setConsultSelectedSocialId] = useState<string>('');
  const [consultSocialContactId, setConsultSocialContactId] = useState<string>('');
  const [consultName, setConsultName] = useState('');
  const [consultPhone, setConsultPhone] = useState('');
  const [consultQuestion, setConsultQuestion] = useState('');
  const [consultBookingError, setConsultBookingError] = useState('');
  const [isSubmittingConsult, setIsSubmittingConsult] = useState(false);
  const [consultSuccessCode, setConsultSuccessCode] = useState<string | null>(null);

  const activeConsultTopic =
    consultationConfig.topics.find(t => t.id === consultSelectedTopicId) || consultationConfig.topics[0];
  const activeConsultSocial =
    consultationConfig.socialPlatforms.find(s => s.id === consultSelectedSocialId) || consultationConfig.socialPlatforms[0];
  const activeConsultTimeSlot =
    consultPreferredTimeSlot || consultationConfig.timeSlots[0] || 'نوبت عصر (۱۶:۰۰ الی ۱۹:۰۰)';
  const activeConsultPrice = activeConsultTopic ? activeConsultTopic.price : consultationConfig.basePrice;

  // Tracking Query State
  const [trackingCodeInput, setTrackingCodeInput] = useState('');
  const [trackingResult, setTrackingResult] = useState<{
    type: 'order' | 'message';
    data: any;
  } | null>(null);
  const [trackingSearched, setTrackingSearched] = useState(false);
  const [isSearchingTracking, setIsSearchingTracking] = useState(false);

  // Fix scrolling bug: When navigating tabs or pages, always scroll to the top
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [activePage]);

  // Lock background body scroll when Cart Drawer or Admin Modal is open on mobile
  useEffect(() => {
    if (isCartOpen || isAdminAuthModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isCartOpen, isAdminAuthModalOpen]);

  // Navigate to a storefront page and clear any open product/article detail view
  const handleSelectPage = (page: 'home' | 'articles' | 'consultation' | 'tracking' | 'about' | 'contact' | 'checkout' | 'terms' | 'refund') => {
    setSelectedProduct(null);
    setSelectedPost(null);
    setActivePage(page);
    if (page === 'home') {
      setActiveCategory('all');
    }
    const targetPath = page === 'home' ? '/' : `/${page}`;
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    const origin = resolveSiteOrigin(siteContent, typeof window !== 'undefined' ? window.location.origin : '');
    const seo = resolveSeoForPath(targetPath, origin, {
      products: publicProducts,
      productCategories: publicCategories,
      posts: publicPosts,
      siteContent
    });
    applyClientDocumentSeo(seo);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  // Select category and update URL to /categories/:slug if a real category is chosen
  const handleSelectCategory = (catValue: string, catObj?: ProductCategory) => {
    setActiveCategory(catValue);
    let targetPath = '/';
    if (catObj && catObj.slug) {
      targetPath = `/categories/${encodeURIComponent(catObj.slug)}`;
    } else {
      const foundCat = publicCategories.find(
        c => c.slug === catValue || c.title === catValue
      );
      if (foundCat && foundCat.slug) {
        targetPath = `/categories/${encodeURIComponent(foundCat.slug)}`;
      }
    }
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    const origin = resolveSiteOrigin(siteContent, typeof window !== 'undefined' ? window.location.origin : '');
    const seo = resolveSeoForPath(targetPath, origin, {
      products: publicProducts,
      productCategories: publicCategories,
      posts: publicPosts,
      siteContent
    });
    applyClientDocumentSeo(seo);
  };

  // Keyboard shortcut for hidden admin: Ctrl + Shift + A
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a' || e.key === 'ش')) {
        e.preventDefault();
        setIsAdminAuthModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Format Persian currency safely
  const formatPrice = (num?: any) => {
    const val = Number(num);
    return new Intl.NumberFormat('fa-IR').format(isNaN(val) ? 0 : val);
  };

  // Dynamic brand values & site content
  const brandName = siteContent?.brandName || 'اونیوال';
  const brandEnglishName = siteContent?.brandEnglishName || 'ONIVAL';
  const brandDescription = siteContent?.brandDescription || 'عرضه مستقیم عسل طبیعی، ژل رویال، گرده گل و فرآورده‌های ارگانیک کوهستان';
  const tagline = siteContent?.tagline || 'فروشگاه تخصصی محصولات ارگانیک و کندوی اونیوال';
  const navigation = {
    home: siteContent?.navLabels?.home || siteContent?.navigation?.home || 'خانه',
    articles: siteContent?.navLabels?.articles || siteContent?.navigation?.articles || 'مقالات',
    consultation: siteContent?.navLabels?.consultation || siteContent?.navigation?.consultation || 'مشاوره تخصصی',
    tracking: siteContent?.navLabels?.tracking || siteContent?.navigation?.tracking || 'پیگیری سفارش',
    about: siteContent?.navLabels?.about || siteContent?.navigation?.about || 'درباره ما',
    contact: siteContent?.navLabels?.contact || siteContent?.navigation?.contact || 'تماس',
  };

  // Section id normalizer to seamlessly support both camelCase and snake_case formats
  const normalizeSectionId = (rawId: string): string => {
    const id = (rawId || '').toLowerCase().replace(/[-_]/g, '');
    if (id.includes('hero')) return 'hero';
    if (id.includes('special') || id.includes('offer')) return 'special_offers';
    if (id.includes('categor')) return 'categories';
    if (id.includes('product')) return 'products';
    if (id.includes('consult')) return 'consultation';
    if (id.includes('article') || id.includes('post') || id.includes('blog')) return 'articles';
    if (id.includes('about')) return 'about';
    return id;
  };

  const homeSections = siteContent?.homeSections && siteContent.homeSections.length > 0
    ? [...siteContent.homeSections].sort((a, b) => a.order - b.order)
    : [
        { id: 'specialOffers', title: 'پیشنهاد شگفت‌انگیز', subtitle: 'تخفیف‌های استثنایی محصولات برگزیده کندو', enabled: true, order: 1 },
        { id: 'categories', title: 'دسته‌بندی‌های محصولات', subtitle: 'دسترسی سریع به گروه‌های کالایی', enabled: true, order: 2 },
        { id: 'products', title: 'لیست محصولات اونیوال', subtitle: 'محصولات ارگانیک و طبیعی با ضمانت اصالت و برگه آزمایشگاه', enabled: true, order: 3 },
        { id: 'consultationBanner', title: 'مشاوره تخصصی رایگان', subtitle: 'راهنمایی انتخاب عسل دارویی و فرآورده‌های ویژه سلامت', enabled: true, order: 4 },
        { id: 'articles', title: 'مقالات و مطالب علمی اونیوال', subtitle: 'آخرین نوشته‌ها برای آشنایی با خواص عسل طبیعی، دمنوش‌های گیاهی و سبک زندگی سالم', enabled: true, order: 5 },
        { id: 'about', title: 'درباره اصالت و کیفیت', subtitle: '۱۰۰٪ طبیعی، خام و بدون حرارت‌دیدگی', enabled: true, order: 6 },
      ];

  const hasExplicitHero = homeSections.some(s => s.enabled && normalizeSectionId(s.id) === 'hero');

  // Check if a specific product variant / packaging is active in special offer
  const isSizeSpecialOfferActive = (product: Product, sizeName: string): boolean => {
    const hasDiscount = (product.discount || 0) > 0;
    if (!hasDiscount) return false;

    // Check variant stock
    const sizeObj = product.sizes?.find(s => s.name === sizeName);
    const sizeStock = sizeObj?.stock !== undefined ? sizeObj.stock : product.stock;
    const isOut = (sizeObj && (sizeObj.isOutOfStock || (sizeObj.stock !== undefined && sizeObj.stock <= 0))) ||
      ((product.stock !== undefined && product.stock <= 0) || product.isOutOfStock || product.availability === 'OutOfStock');
    if (isOut) return false;

    // Check variant quota
    if (sizeObj && sizeObj.specialOfferStock !== undefined) {
      return sizeObj.specialOfferStock > 0;
    }
    return product.specialOfferStock === undefined || product.specialOfferStock > 0;
  };

  // Special offers: published products with discount > 0 and remaining specialOfferStock > 0 and in-stock
  const isSpecialOfferActive = (p: Product): boolean => {
    const hasDiscount = (p.discount || 0) > 0;
    const inStock = (p.stock === undefined || p.stock > 0) && !p.isOutOfStock && p.availability !== 'OutOfStock';
    if (!hasDiscount || !inStock) return false;

    if (p.sizes && p.sizes.length > 0) {
      return p.sizes.some(s => {
        const szStock = s.stock !== undefined ? s.stock : (p.stock ?? 20);
        const szQuota = s.specialOfferStock !== undefined ? s.specialOfferStock : (p.specialOfferStock ?? 3);
        const szOut = Boolean(s.isOutOfStock || szStock <= 0);
        return !szOut && szQuota > 0;
      });
    }
    return p.specialOfferStock === undefined || p.specialOfferStock > 0;
  };

  const specialOffers = publicProducts.filter(p => isSpecialOfferActive(p));

  // Filter published products by category
  const filteredProducts = publicProducts.filter(p => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'discounted') return isSpecialOfferActive(p);
    if (p.type === activeCategory) return true;
    if (p.categoryTitle && p.categoryTitle.includes(activeCategory)) return true;
    const matchedCat = publicCategories.find(c => c.slug === activeCategory || c.title === activeCategory);
    if (matchedCat) {
      if (p.categoryId === matchedCat.id || p.type === matchedCat.slug || p.categoryTitle === matchedCat.title) {
        return true;
      }
    }
    return false;
  });

  // Calculate base price for a given product and size name
  const getBasePrice = (product: Product, sizeName: string): number => {
    if (product.sizes && product.sizes.length > 0) {
      const found = product.sizes.find(s => s.name === sizeName);
      if (found) return found.price;
      return product.sizes[0].price;
    }
    if (sizeName === 'بزرگ' || sizeName === 'large') {
      return product.priceLarge || product.price;
    }
    return product.priceSmall || product.price;
  };

  // Calculate final discounted price for product and size
  const calculateFinalPrice = (product: Product, sizeName: string): number => {
    const base = getBasePrice(product, sizeName);
    const activeOffer = isSizeSpecialOfferActive(product, sizeName);
    const discount = activeOffer ? (product.discount || 0) : 0;
    return discount > 0 ? Math.round(base * (100 - discount) / 100) : base;
  };

  // Get lowest price among available sizes
  const getMinPrice = (product: Product): number => {
    if (product.sizes && product.sizes.length > 0) {
      const validPrices = product.sizes.map(s => Number(s.price) || 0).filter(p => p > 0);
      if (validPrices.length > 0) {
        return Math.min(...validPrices);
      }
    }
    return Number(product.priceSmall) || Number(product.price) || 0;
  };

  // Cart actions with strict inventory stock validation per packaging variant
  const totalCartCount = cart.reduce((acc, item) => acc + item.qty, 0);
  const totalCartPrice = cart.reduce((acc, item) => acc + item.price * item.qty, 0);

  const addToCart = (product: Product, sizeName: string) => {
    const sizeObj = product.sizes?.find(s => s.name === sizeName);
    const availableStock = sizeObj?.stock !== undefined ? sizeObj.stock : (product.stock !== undefined ? product.stock : 999);
    const isOutOfStock = (sizeObj && (sizeObj.isOutOfStock || (sizeObj.stock !== undefined && sizeObj.stock <= 0))) ||
      ((product.stock !== undefined && product.stock <= 0) || product.isOutOfStock || product.availability === 'OutOfStock');

    if (isOutOfStock || availableStock <= 0) {
      showStorefrontNotice(`بسته‌بندی «${sizeName}» این محصول در حال حاضر در انبار ناموجود است.`);
      return;
    }

    const finalPrice = calculateFinalPrice(product, sizeName);
    const cartId = `${product.id}-${sizeName}`;

    let exceeded = false;
    setCart(prev => {
      const existing = prev.find(item => item.cartId === cartId);
      if (existing) {
        if (existing.qty + 1 > availableStock) {
          exceeded = true;
          return prev;
        }
        return prev.map(item => item.cartId === cartId ? { ...item, qty: item.qty + 1 } : item);
      }
      if (1 > availableStock) {
        exceeded = true;
        return prev;
      }
      return [
        ...prev,
        {
          cartId,
          id: product.id,
          name: product.title,
          img: product.imageName,
          size: sizeName,
          price: finalPrice,
          qty: 1
        }
      ];
    });

    if (exceeded) {
      showStorefrontNotice(`موجودی بسته «${sizeName}» در انبار ${availableStock} عدد است و امکان افزودن تعداد بیشتر وجود ندارد.`);
      return;
    }

    setIsCartOpen(true);
    setSelectedProduct(null);
  };

  const updateCartQty = (cartId: string, delta: number) => {
    setCart(prev => {
      const targetItem = prev.find(item => item.cartId === cartId);
      if (targetItem && delta > 0) {
        const prod = publicProducts.find(p => p.id === targetItem.id);
        const sizeObj = prod?.sizes?.find(s => s.name === targetItem.size);
        const maxStock = sizeObj?.stock !== undefined ? sizeObj.stock : (prod && prod.stock !== undefined ? prod.stock : 999);
        if (targetItem.qty + delta > maxStock) {
          showStorefrontNotice(`حداکثر موجودی قابل سفارش برای بسته «${targetItem.size || prod?.title}»، ${maxStock} عدد می‌باشد.`);
          return prev;
        }
      }

      return prev
        .map(item => {
          if (item.cartId === cartId) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeCartItem = (cartId: string) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId));
  };

  // Phone validation
  const validatePhone = (val: string) => {
    const clean = val.trim();
    if (!clean) {
      setPhoneError('شماره موبایل الزامی است');
      return false;
    }
    if (!/^09\d{9}$/.test(clean)) {
      setPhoneError('شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.');
      return false;
    }
    setPhoneError('');
    return true;
  };

  // Handle Checkout submission -> Generate Invoice connected to Bale Bot
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhone(checkoutPhone)) return;

    if (!checkoutName.trim() || !checkoutAddress.trim()) {
      setCheckoutError('لطفاً نام و نام خانوادگی و آدرس کامل پستی را وارد فرمایید.');
      return;
    }

    setCheckoutError('');
    setIsSubmittingOrder(true);
    try {
      const trackingCode = `ONV-ORD-${Math.floor(100 + Math.random() * 900)}`;
      const orderItems: OrderItem[] = cart.map((item, idx) => ({
        id: idx + 1,
        productId: item.id,
        productName: item.name,
        size: item.size,
        quantity: item.qty,
        unitPrice: item.price,
        totalPrice: item.price * item.qty
      }));

      const createdOrder = await onPlaceOrder({
        userFullName: checkoutName,
        phoneNumber: checkoutPhone,
        userAddress: checkoutAddress,
        totalPrice: totalCartPrice,
        trackingCode,
        items: orderItems,
      });

      // Clear shopping cart and set the official issued invoice
      setCart([]);
      setReceiptPreview('');
      setReceiptNote('');
      setReceiptUploadError('');
      setCheckoutError('');
      setSelectedPaymentTab(resolveDefaultPaymentTab());

      const actualOrder: Order = (createdOrder?.order ? createdOrder.order : (createdOrder?.items ? createdOrder : null)) || {
        id: Date.now(),
        userFullName: checkoutName,
        phoneNumber: checkoutPhone,
        userAddress: checkoutAddress,
        totalPrice: totalCartPrice,
        status: 'Pending',
        paymentStatus: 'Unpaid',
        paymentMethod: resolveDefaultPaymentTab(),
        trackingCode,
        creationTime: new Date().toLocaleDateString('fa-IR'),
        items: orderItems,
        balePaymentUrl: `https://ble.ir/${activeBaleBotUsername}?start=pay_${trackingCode.replace(/-/g, '_')}`
      };

      if (!Array.isArray(actualOrder.items) || actualOrder.items.length === 0) {
        actualOrder.items = orderItems;
      }
      if (!actualOrder.userFullName) actualOrder.userFullName = checkoutName;
      if (!actualOrder.phoneNumber) actualOrder.phoneNumber = checkoutPhone;
      if (!actualOrder.userAddress) actualOrder.userAddress = checkoutAddress;
      if (!actualOrder.totalPrice) actualOrder.totalPrice = totalCartPrice;
      if (!actualOrder.trackingCode) actualOrder.trackingCode = trackingCode;
      if (!actualOrder.paymentStatus) actualOrder.paymentStatus = 'Unpaid';
      actualOrder.balePaymentUrl = `https://ble.ir/${activeBaleBotUsername}?start=pay_${actualOrder.trackingCode.replace(/-/g, '_')}`;

      setCurrentInvoice(actualOrder);

      // Instantly dispatch order notification to Bale Admin (direct client-side & host sync)
      sendBaleAdminOrderNotification(actualOrder).catch((err) => {
        console.warn('sendBaleAdminOrderNotification notice:', err);
      });

      // Stay on checkout page which now renders the official invoice and configured payment modes
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    } catch (err: any) {
      setCheckoutError(err?.message || 'خطا در ثبت سفارش. لطفاً دوباره تلاش فرمایید.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Copy card number helper
  const handleCopyCardNumber = () => {
    const rawDigits = (paymentConfig.cardNumber || '').replace(/[^0-9]/g, '');
    navigator.clipboard?.writeText(rawDigits || paymentConfig.cardNumber);
    setCopiedCard(true);
    setTimeout(() => setCopiedCard(false), 2500);
  };

  // Convert selected receipt image file to base64 DataURL (compressed if large)
  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReceiptUploadError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setReceiptUploadError('لطفاً یک فایل تصویری معتبر (JPG یا PNG) انتخاب نمایید.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const resultStr = ev.target?.result as string;
      if (!resultStr) return;

      // Compress image onto canvas so upload is fast and reliable
      const img = new Image();
      img.onload = () => {
        const maxDim = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setReceiptPreview(compressedDataUrl);
        } else {
          setReceiptPreview(resultStr);
        }
      };
      img.onerror = () => {
        setReceiptPreview(resultStr);
      };
      img.src = resultStr;
    };
    reader.readAsDataURL(file);
  };

  // Submit receipt image + invoice trackingCode to server for admin verification
  const handleUploadReceipt = async (orderTrackingCode: string) => {
    if (!receiptPreview) {
      setReceiptUploadError('لطفاً ابتدا تصویر فیش واریزی یا اسکرین‌شات تراکنش را انتخاب نمایید.');
      return;
    }
    setReceiptUploadError('');
    setIsUploadingReceipt(true);
    try {
      const res = await apiFetch(`/api/orders/${encodeURIComponent(orderTrackingCode)}/upload-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptImage: receiptPreview,
          receiptNote: receiptNote.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const updatedOrder: Order = data.order || {
          ...(currentInvoice || trackingResult?.data),
          paymentMethod: 'card_to_card',
          paymentStatus: 'PendingVerification',
          receiptImage: receiptPreview,
          receiptNote: receiptNote.trim() || undefined,
          receiptUploadedAt: new Date().toLocaleString('fa-IR'),
        };
        if (currentInvoice && currentInvoice.trackingCode === orderTrackingCode) {
          setCurrentInvoice(updatedOrder);
        }
        if (trackingResult && trackingResult.type === 'order' && trackingResult.data.trackingCode === orderTrackingCode) {
          setTrackingResult({ type: 'order', data: updatedOrder });
        }
        setReceiptPreview('');
        setReceiptNote('');
        onOrderUpdated?.();
      } else {
        setReceiptUploadError('خطا در ارسال تصویر فیش. لطفاً مجدداً تلاش کنید.');
      }
    } catch (err) {
      console.error(err);
      setReceiptUploadError('خطا در برقراری ارتباط با سرور.');
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  // Build formatted gateway URL with dynamic replacements
  const buildGatewayLink = (order?: Order | null) => {
    if (!order) return '';
    const rawUrl = (paymentConfig.gatewayUrl || '').trim();
    if (!rawUrl) return '';
    return rawUrl
      .replace(/\{amount\}/gi, String(order.totalPrice || 0))
      .replace(/\{invoice\}/gi, encodeURIComponent(order.trackingCode || ''))
      .replace(/\{merchant\}/gi, encodeURIComponent(paymentConfig.gatewayMerchantCode || ''));
  };

  // Handle Online Payment Gateway confirmation
  const handleConfirmGatewayPayment = async (orderTrackingCode: string) => {
    setIsConfirmingGateway(true);
    try {
      const res = await apiFetch(`/api/orders/${encodeURIComponent(orderTrackingCode)}/confirm-gateway-payment`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        if (currentInvoice && currentInvoice.trackingCode === orderTrackingCode) {
          setCurrentInvoice(
            data.order || {
              ...currentInvoice,
              paymentMethod: 'gateway',
              paymentStatus: 'Paid',
              status: 'Processing',
            }
          );
        }
        if (trackingResult && trackingResult.type === 'order' && trackingResult.data.trackingCode === orderTrackingCode) {
          setTrackingResult({
            type: 'order',
            data:
              data.order || {
                ...trackingResult.data,
                paymentMethod: 'gateway',
                paymentStatus: 'Paid',
                status: 'Processing',
              },
          });
        }
        onOrderUpdated?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsConfirmingGateway(false);
    }
  };

  // Handle Bale payment confirmation simulator
  const handleConfirmBalePayment = async (orderTrackingCode: string) => {
    setIsConfirmingBale(true);
    try {
      const res = await apiFetch(`/api/orders/${orderTrackingCode}/confirm-bale-payment`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        if (currentInvoice) {
          setCurrentInvoice({
            ...currentInvoice,
            paymentMethod: 'bale_bot',
            paymentStatus: 'Paid',
            status: 'Processing'
          });
        }
        onOrderUpdated?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsConfirmingBale(false);
    }
  };

  // Handle Consultation Booking & Direct Invoice Payment
  const handleConsultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConsultBookingError('');

    const cleanPhone = consultPhone
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
      .replace(/\s+/g, '')
      .replace(/^\+98/, '0');

    if (!consultName.trim()) {
      setConsultBookingError('لطفاً نام و نام خانوادگی خود را وارد فرمایید.');
      return;
    }
    if (!/^09\d{9}$/.test(cleanPhone)) {
      setConsultBookingError('لطفاً شماره موبایل معتبر ۱۱ رقمی (با شروع ۰۹) وارد نمایید.');
      return;
    }
    if (!consultSocialContactId.trim()) {
      setConsultBookingError(`لطفاً آیدی یا شماره ارتباطی خود در «${activeConsultSocial?.name || 'شبکه اجتماعی انتخابی'}» را وارد نمایید.`);
      return;
    }

    setIsSubmittingConsult(true);
    try {
      const res = await apiFetch('/api/consultations/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: consultName.trim(),
          phoneNumber: cleanPhone,
          topicId: activeConsultTopic?.id,
          topicTitle: activeConsultTopic?.title || 'مشاوره تخصصی سلامت',
          preferredDate: consultPreferredDate || 'فردا',
          preferredTimeSlot: activeConsultTimeSlot,
          socialPlatform: activeConsultSocial?.name || 'پیام‌رسان بله',
          socialContactId: consultSocialContactId.trim(),
          price: activeConsultPrice,
          durationMinutes: activeConsultTopic?.durationMinutes || 30,
          question: consultQuestion.trim() || 'درخواست مشاوره در زمان انتخابی'
        })
      });

      if (res.ok) {
        const data = await res.json();

        if (data.order) {
          // Open Official Invoice & 3-Mode Payment Screen (just like product checkout!)
          setReceiptPreview('');
          setReceiptNote('');
          setReceiptUploadError('');
          setSelectedPaymentTab(resolveDefaultPaymentTab());
          setCurrentInvoice(data.order);
          handleSelectPage('checkout');
        } else {
          setConsultSuccessCode(data.trackingCode || `ONV-CNS-${Math.floor(100 + Math.random() * 900)}`);
        }
        setConsultQuestion('');
        onOrderUpdated?.();
      } else {
        const errData = await res.json().catch(() => ({}));
        setConsultBookingError(errData.error || 'خطا در ثبت رزرو مشاوره. لطفاً مجدداً تلاش کنید.');
      }
    } catch (err) {
      setConsultBookingError('خطا در برقراری ارتباط با سرور.');
    } finally {
      setIsSubmittingConsult(false);
    }
  };

  // Add Consultation Session directly to Shopping Cart
  const handleAddConsultationToCart = () => {
    setConsultBookingError('');
    const topicTitle = activeConsultTopic?.title || 'مشاوره تخصصی سلامت';
    const socialName = activeConsultSocial?.name || 'پیام‌رسان بله';
    const contactHandle = consultSocialContactId.trim() ? ` (${consultSocialContactId.trim()})` : '';
    const sizeSummary = `${consultPreferredDate || 'فردا'} | ${activeConsultTimeSlot} - ${socialName}${contactHandle}`;
    const cartId = `consult-${activeConsultTopic?.id || 'default'}-${consultPreferredDate}-${activeConsultTimeSlot}`;

    setCart(prev => {
      const existing = prev.find(it => it.cartId === cartId);
      if (existing) {
        return prev.map(it => (it.cartId === cartId ? { ...it, qty: it.qty + 1 } : it));
      }
      return [
        ...prev,
        {
          cartId,
          id: 9000 + Math.floor(Math.random() * 900),
          name: `رزرو مشاوره تخصصی: ${topicTitle}`,
          img: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&auto=format&fit=crop&q=80',
          size: sizeSummary,
          price: activeConsultPrice,
          qty: 1
        }
      ];
    });

    if (consultName.trim() && !checkoutName) setCheckoutName(consultName.trim());
    if (consultPhone.trim() && !checkoutPhone) setCheckoutPhone(consultPhone.trim());
    if (!checkoutAddress.trim()) {
      setCheckoutAddress(
        `مشاوره آنلاین در ${socialName}${contactHandle} | زمان: ${consultPreferredDate || 'فردا'} - ${activeConsultTimeSlot}${
          consultQuestion.trim() ? ` | شرح: ${consultQuestion.trim()}` : ''
        }`
      );
    }

    setIsCartOpen(true);
  };

  // Execute Tracking Search by Code
  const executeTrackingSearch = async (targetCode: string) => {
    const code = targetCode.trim().toUpperCase();
    if (!code) return;

    setTrackingCodeInput(code);
    setIsSearchingTracking(true);
    setTrackingSearched(true);

    try {
      const trackRes = await apiFetch(`/api/orders/track/${encodeURIComponent(code)}`);
      if (trackRes.ok) {
        const json = await trackRes.json();
        if (json.found) {
          setTrackingResult({ type: json.type, data: json.data });
          setIsSearchingTracking(false);
          return;
        }
      }

      // Fallback check in local state cache without triggering 401 on protected admin routes
      const localState = getCachedLocalState();
      const localOrder = localState.orders?.find(o => o.trackingCode.toUpperCase() === code);
      if (localOrder) {
        setTrackingResult({ type: 'order', data: localOrder });
        setIsSearchingTracking(false);
        return;
      }

      const localMsg = localState.contactMessages?.find(m => m.trackingCode.toUpperCase() === code);
      if (localMsg) {
        setTrackingResult({ type: 'message', data: localMsg });
        setIsSearchingTracking(false);
        return;
      }

      setTrackingResult(null);
    } catch {
      setTrackingResult(null);
    } finally {
      setIsSearchingTracking(false);
    }
  };

  // Handle Tracking Search Form
  const handleTrackingSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeTrackingSearch(trackingCodeInput);
  };

  // Listen for direct URL navigation to /track-order or query ?track=... / ?code=...
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('track') || urlParams.get('code') || urlParams.get('tracking');
    const path = window.location.pathname.toLowerCase();

    if (codeParam) {
      setActivePage('tracking');
      executeTrackingSearch(codeParam);
    } else if (path === '/track-order' || path === '/track' || path === '/tracking') {
      setActivePage('tracking');
    }
  }, []);

  // Handle opening product detail view (native page scroll on mobile & desktop) + clean URL
  const handleOpenProduct = (product: Product, e?: React.MouseEvent) => {
    if (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
    }
    lastScrollYRef.current = window.scrollY || 0;
    setSelectedPost(null);
    setSelectedProduct(product);
    setActiveProductImageIndex(0);
    setProductMediaMode('gallery');
    setIsZoomLensActive(false);
    setIsLightboxOpen(false);
    if (product.sizes && product.sizes.length > 0) {
      setSelectedSize(product.sizes[0].name);
    } else {
      setSelectedSize('کوچک');
    }
    const targetPath = `/products/${encodeURIComponent(product.slug || sanitizeSlug(product.title, 'product', product.id))}`;
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    const origin = resolveSiteOrigin(siteContent, typeof window !== 'undefined' ? window.location.origin : '');
    const seo = resolveSeoForPath(targetPath, origin, {
      products: publicProducts,
      productCategories: publicCategories,
      posts: publicPosts,
      siteContent
    });
    applyClientDocumentSeo(seo);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  // Handle closing product detail view and restoring scroll position
  const handleCloseProduct = () => {
    const prevScroll = lastScrollYRef.current;
    setSelectedProduct(null);
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/products/')) {
      window.history.pushState({}, '', '/');
    }
    const origin = resolveSiteOrigin(siteContent, typeof window !== 'undefined' ? window.location.origin : '');
    const seo = resolveSeoForPath('/', origin, {
      products: publicProducts,
      productCategories: publicCategories,
      posts: publicPosts,
      siteContent
    });
    applyClientDocumentSeo(seo);
    setTimeout(() => {
      window.scrollTo({ top: prevScroll, left: 0, behavior: 'instant' });
    }, 0);
  };

  // Handle opening article detail view + clean URL
  const handleOpenPost = (post: Post, e?: React.MouseEvent) => {
    if (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
    }
    lastScrollYRef.current = window.scrollY || 0;
    setSelectedProduct(null);
    setSelectedPost(post);
    const targetPath = `/articles/${encodeURIComponent(post.slug || sanitizeSlug(post.title, 'article', post.id))}`;
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    const origin = resolveSiteOrigin(siteContent, typeof window !== 'undefined' ? window.location.origin : '');
    const seo = resolveSeoForPath(targetPath, origin, {
      products: publicProducts,
      productCategories: publicCategories,
      posts: publicPosts,
      siteContent
    });
    applyClientDocumentSeo(seo);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  const handleClosePost = () => {
    const prevScroll = lastScrollYRef.current;
    setSelectedPost(null);
    const backPath = activePage === 'articles' ? '/articles' : '/';
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/articles/')) {
      window.history.pushState({}, '', backPath);
    }
    const origin = resolveSiteOrigin(siteContent, typeof window !== 'undefined' ? window.location.origin : '');
    const seo = resolveSeoForPath(backPath, origin, {
      products: publicProducts,
      productCategories: publicCategories,
      posts: publicPosts,
      siteContent
    });
    applyClientDocumentSeo(seo);
    setTimeout(() => {
      window.scrollTo({ top: prevScroll, left: 0, behavior: 'instant' });
    }, 0);
  };

  // Handle "View All" in Amazing Deals banner
  const handleViewAllOffers = () => {
    setActiveCategory('discounted');
    setTimeout(() => {
      document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  // Secret Admin Login Check (validates both Username and Password against server)
  const handleSecretAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError('');

    const u = adminUsernameInput.trim();
    const p = adminPasswordInput.trim();

    if (!u || !p) {
      setAdminAuthError('لطفاً هم نام کاربری و هم رمز عبور مدیریت را وارد نمایید.');
      return;
    }

    setIsAuthenticatingAdmin(true);
    try {
      const res = await apiFetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        if (data.token) {
          setAdminSessionToken(data.token);
        }
        setIsAdminAuthModalOpen(false);
        setAdminUsernameInput('');
        setAdminPasswordInput('');
        setAdminAuthError('');
        onBackToAdmin();
      } else {
        // Respect the server's rejection (e.g., 401 Wrong password or 429 Rate limit)
        setAdminAuthError(data.error || 'نام کاربری یا رمز عبور مدیریت اشتباه است.');
      }
    } catch {
      setAdminAuthError('خطا در برقراری ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی نمایید.');
    } finally {
      setIsAuthenticatingAdmin(false);
    }
  };

  const handleCopyrightClick = () => {
    const newCount = copyrightClickCount + 1;
    setCopyrightClickCount(newCount);
    if (newCount >= 3) {
      setIsAdminAuthModalOpen(true);
      setCopyrightClickCount(0);
    }
  };

  return (
    <div className="min-h-screen bg-[#FEFDF5] text-[#292524] font-sans selection:bg-amber-200" dir="rtl">
      {/* ================= FLOATING HEADER ISLAND ================= */}
      <header className="fixed top-5 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none transition-all">
        <nav className="pointer-events-auto bg-white/95 backdrop-blur-md px-4 sm:px-7 py-2.5 rounded-full shadow-lg border border-white/60 flex items-center justify-between gap-3 sm:gap-8 max-w-4xl w-full">
          {/* Brand Logo: Custom Uploaded Logo OR Hexagon Fallback + Persian brandName + English brandEnglishName */}
          <div 
            onClick={() => handleSelectPage('home')}
            className="flex items-center gap-2.5 cursor-pointer select-none group shrink-0"
          >
            {siteContent?.siteLogo ? (
              <div
                className={
                  siteContent.siteLogoShape === 'free'
                    ? 'h-9 sm:h-10 max-w-[115px] flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition'
                    : `w-9 h-9 sm:w-10 sm:h-10 ${
                        siteContent.siteLogoShape === 'circle' ? 'rounded-full' : 'rounded-xl'
                      } bg-white border border-stone-200/70 flex items-center justify-center overflow-hidden shrink-0 shadow-xs group-hover:scale-105 transition`
                }
              >
                <img
                  src={siteContent.siteLogo}
                  alt={brandName}
                  style={{
                    transform:
                      siteContent.siteLogoScale && siteContent.siteLogoScale !== 100
                        ? `scale(${siteContent.siteLogoScale / 100})`
                        : undefined,
                    transformOrigin: 'center center'
                  }}
                  className={`w-full h-full ${
                    siteContent.siteLogoShape === 'free'
                      ? 'object-contain max-h-10 w-auto'
                      : (siteContent.siteLogoFit || 'cover') === 'cover'
                      ? 'object-cover'
                      : 'object-contain'
                  }`}
                />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 group-hover:rotate-12 transition">
                <Hexagon className="w-5 h-5 fill-amber-500/20 text-amber-600 stroke-[2.2]" />
              </div>
            )}
            <div className="flex items-baseline gap-1.5 text-stone-900 tracking-tight">
              <span className="font-black text-base sm:text-lg">{brandName}</span>
              <span className="font-mono text-[10px] sm:text-xs font-bold text-amber-600 tracking-wider">{brandEnglishName}</span>
            </div>
          </div>

          {/* Navigation Tabs (Desktop) */}
          <ul className="hidden md:flex items-center gap-5 text-[13px] font-bold text-stone-600">
            <li>
              <a 
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  handleSelectPage('home');
                }}
                className={`transition pb-0.5 ${activePage === 'home' && !selectedProduct && !selectedPost ? 'text-stone-900 border-b-2 border-stone-900 font-extrabold' : 'hover:text-stone-900'}`}
              >
                {navigation.home || 'خانه'}
              </a>
            </li>
            <li>
              <a 
                href="/articles"
                onClick={(e) => {
                  e.preventDefault();
                  handleSelectPage('articles');
                }}
                className={`transition pb-0.5 ${activePage === 'articles' && !selectedProduct ? 'text-stone-900 border-b-2 border-stone-900 font-extrabold' : 'hover:text-stone-900'}`}
              >
                {navigation.articles || 'مقالات'}
              </a>
            </li>
            <li>
              <a 
                href="/consultation"
                onClick={(e) => {
                  e.preventDefault();
                  handleSelectPage('consultation');
                }}
                className={`transition pb-0.5 font-black text-xs cursor-pointer select-none tracking-wide text-amber-800 hover:text-amber-900 hover:scale-105 ${
                  activePage === 'consultation' && !selectedProduct && !selectedPost
                    ? 'border-b-2 border-amber-600 text-amber-950 font-black'
                    : ''
                }`}
                style={{
                  textShadow: '0 1px 2px rgba(217, 119, 6, 0.45), 0 2px 8px rgba(245, 158, 11, 0.38), 0 0 14px rgba(251, 191, 36, 0.5)'
                }}
              >
                {navigation.consultation || 'مشاوره تخصصی'}
              </a>
            </li>
            <li>
              <a 
                href="/tracking"
                onClick={(e) => {
                  e.preventDefault();
                  handleSelectPage('tracking');
                }}
                className={`transition pb-0.5 ${activePage === 'tracking' && !selectedProduct && !selectedPost ? 'text-stone-900 border-b-2 border-stone-900 font-extrabold' : 'hover:text-stone-900'}`}
              >
                {navigation.tracking || 'پیگیری سفارش'}
              </a>
            </li>
            <li>
              <a 
                href="/about"
                onClick={(e) => {
                  e.preventDefault();
                  handleSelectPage('about');
                }}
                className={`transition pb-0.5 ${activePage === 'about' && !selectedProduct && !selectedPost ? 'text-stone-900 border-b-2 border-stone-900 font-extrabold' : 'hover:text-stone-900'}`}
              >
                {navigation.about || 'درباره ما'}
              </a>
            </li>
            <li>
              <a 
                href="/contact"
                onClick={(e) => {
                  e.preventDefault();
                  handleSelectPage('contact');
                }}
                className={`transition pb-0.5 ${activePage === 'contact' && !selectedProduct && !selectedPost ? 'text-stone-900 border-b-2 border-stone-900 font-extrabold' : 'hover:text-stone-900'}`}
              >
                {navigation.contact || 'تماس'}
              </a>
            </li>
          </ul>

          {/* Right Actions: Cart & Hidden Admin Key */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              id="btn-open-cart"
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 rounded-full bg-stone-100 hover:bg-amber-100 text-stone-800 hover:text-amber-700 transition flex items-center justify-center shadow-xs"
              aria-label="سبد خرید"
            >
              <ShoppingBag className="w-4 h-4" />
              {totalCartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#f59e0b] text-white text-[11px] font-extrabold flex items-center justify-center shadow-xs animate-scale">
                  {totalCartCount}
                </span>
              )}
            </button>

            {/* Admin Panel Quick Entrance Button */}
            <button
              id="btn-header-admin-entrance"
              onClick={() => setIsAdminAuthModalOpen(true)}
              title="ورود به پنل مدیریت"
              className="px-2.5 py-1.5 rounded-full bg-stone-100 hover:bg-slate-800 text-stone-600 hover:text-white transition flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-2xs"
            >
              <Lock className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline text-[11px]">ورود مدیریت</span>
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Sub-Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 py-2 px-3 shadow-lg flex items-center justify-around text-[11px] font-bold text-stone-600">
        <button
          onClick={() => handleSelectPage('home')}
          className={`flex flex-col items-center gap-1 ${activePage === 'home' && !selectedProduct && !selectedPost ? 'text-amber-600 font-black' : 'hover:text-stone-900'}`}
        >
          <Hexagon className="w-4 h-4" />
          <span>{navigation.home || 'خانه'}</span>
        </button>
        <button
          onClick={() => handleSelectPage('articles')}
          className={`flex flex-col items-center gap-1 ${activePage === 'articles' && !selectedProduct ? 'text-amber-600 font-black' : 'hover:text-stone-900'}`}
        >
          <BookOpen className="w-4 h-4" />
          <span>{navigation.articles || 'مقالات'}</span>
        </button>
        <button
          onClick={() => handleSelectPage('consultation')}
          className={`flex flex-col items-center justify-center transition select-none py-1 px-1.5 ${
            activePage === 'consultation' && !selectedProduct && !selectedPost
              ? 'text-amber-900 font-black scale-105'
              : 'text-amber-700 font-black hover:text-amber-900'
          }`}
        >
          <span 
            className="text-[11px] font-black tracking-tight"
            style={{
              textShadow: '0 1px 2px rgba(217, 119, 6, 0.45), 0 2px 7px rgba(245, 158, 11, 0.35), 0 0 10px rgba(251, 191, 36, 0.45)'
            }}
          >
            {navigation.consultation || 'مشاوره تخصصی'}
          </span>
        </button>
        <button
          onClick={() => handleSelectPage('tracking')}
          className={`flex flex-col items-center gap-1 ${activePage === 'tracking' && !selectedProduct && !selectedPost ? 'text-amber-600 font-black' : 'hover:text-stone-900'}`}
        >
          <Search className="w-4 h-4" />
          <span>پیگیری</span>
        </button>
        <button
          onClick={() => handleSelectPage('about')}
          className={`flex flex-col items-center gap-1 ${activePage === 'about' && !selectedProduct && !selectedPost ? 'text-amber-600 font-black' : 'hover:text-stone-900'}`}
        >
          <Info className="w-4 h-4" />
          <span>{navigation.about || 'درباره'}</span>
        </button>
        <button
          onClick={() => handleSelectPage('contact')}
          className={`flex flex-col items-center gap-1 ${activePage === 'contact' && !selectedProduct && !selectedPost ? 'text-amber-600 font-black' : 'hover:text-stone-900'}`}
        >
          <PhoneCall className="w-4 h-4" />
          <span>{navigation.contact || 'تماس'}</span>
        </button>
      </div>

      {/* Main Content Body */}
      <main className="pt-24 pb-24 md:pb-16 px-4 sm:px-6 max-w-6xl mx-auto">
        {/* ================= SINGLE PRODUCT PAGE VIEW (NATIVE SCROLL ON MOBILE & DESKTOP) ================= */}
        {selectedProduct ? (
          <div className="max-w-4xl mx-auto animate-fadeIn">
            {/* Semantic Breadcrumb Navigation for SEO & Users */}
            <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-stone-400">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  handleCloseProduct();
                }}
                className="hover:text-amber-600 transition"
              >
                خانه
              </a>
              <span>/</span>
              {selectedProduct.categoryTitle && (
                <>
                  <a
                    href={`/categories/${encodeURIComponent(
                      publicCategories.find(c => c.id === selectedProduct.categoryId || c.title === selectedProduct.categoryTitle)?.slug ||
                      selectedProduct.type ||
                      'honey'
                    )}`}
                    onClick={(e) => {
                      e.preventDefault();
                      const cat = publicCategories.find(c => c.id === selectedProduct.categoryId || c.title === selectedProduct.categoryTitle);
                      setSelectedProduct(null);
                      handleSelectCategory(cat?.slug || selectedProduct.type || 'all', cat);
                    }}
                    className="hover:text-amber-600 transition"
                  >
                    {selectedProduct.categoryTitle}
                  </a>
                  <span>/</span>
                </>
              )}
              <span className="text-stone-700 truncate max-w-[220px] sm:max-w-md" aria-current="page">
                {selectedProduct.title}
              </span>
            </nav>

            <div className="flex items-center justify-between gap-3 mb-5">
              <button 
                type="button"
                onClick={handleCloseProduct}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-stone-200 font-bold text-stone-700 hover:text-stone-900 hover:bg-stone-50 text-xs sm:text-sm transition shadow-2xs cursor-pointer"
              >
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                <span>بازگشت به لیست محصولات</span>
              </button>

              {totalCartCount > 0 && (
                <button
                  type="button"
                  onClick={() => setIsCartOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 font-bold text-xs transition hover:bg-amber-100 cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4 text-amber-600" />
                  <span>سبد خرید ({totalCartCount})</span>
                </button>
              )}
            </div>

            <div className="bg-white rounded-[28px] p-4 sm:p-8 shadow-sm border border-stone-100">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-10 items-start">
                {/* Product Gallery, Video & Zoom Box */}
                <div className="md:col-span-5 space-y-3">
                  {/* Media Mode Tabs (if product has video) */}
                  {selectedProduct.videoUrl && (
                    <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-2xl">
                      <button
                        type="button"
                        onClick={() => setProductMediaMode('gallery')}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          productMediaMode === 'gallery'
                            ? 'bg-white text-stone-900 shadow-sm'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        <Images className="w-3.5 h-3.5 text-amber-600" />
                        <span>عکس‌ها ({Array.isArray(selectedProduct.images) && selectedProduct.images.length > 0 ? selectedProduct.images.length : 1})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductMediaMode('video')}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          productMediaMode === 'video'
                            ? 'bg-white text-stone-900 shadow-sm'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        <Film className="w-3.5 h-3.5 text-rose-600" />
                        <span>ویدیو و تیزر محصول</span>
                      </button>
                    </div>
                  )}

                  {productMediaMode === 'video' && selectedProduct.videoUrl ? (
                    /* Product Video View */
                    <div className="rounded-2xl sm:rounded-[26px] overflow-hidden aspect-square sm:aspect-[4/3] bg-black shadow-md border border-stone-800 relative flex items-center justify-center">
                      {selectedProduct.videoType === 'aparat' || selectedProduct.videoUrl.includes('aparat.com') ? (
                        <iframe
                          src={
                            selectedProduct.videoUrl.includes('/v/')
                              ? selectedProduct.videoUrl.replace('/v/', '/video/video/embed/videohash/') + '/vt/frame'
                              : selectedProduct.videoUrl
                          }
                          title={`ویدیو معرفی ${selectedProduct.title}`}
                          allowFullScreen
                          className="w-full h-full border-0"
                        />
                      ) : selectedProduct.videoType === 'youtube' || selectedProduct.videoUrl.includes('youtube.com') || selectedProduct.videoUrl.includes('youtu.be') ? (
                        <iframe
                          src={
                            selectedProduct.videoUrl.includes('watch?v=')
                              ? selectedProduct.videoUrl.replace('watch?v=', 'embed/')
                              : selectedProduct.videoUrl.includes('youtu.be/')
                              ? selectedProduct.videoUrl.replace('youtu.be/', 'www.youtube.com/embed/')
                              : selectedProduct.videoUrl
                          }
                          title={`ویدیو معرفی ${selectedProduct.title}`}
                          allowFullScreen
                          className="w-full h-full border-0"
                        />
                      ) : (
                        <video
                          src={selectedProduct.videoUrl}
                          controls
                          playsInline
                          className="w-full h-full object-contain"
                        />
                      )}
                    </div>
                  ) : (
                    /* Product Image Gallery with Zoom */
                    (() => {
                      const gallery = (Array.isArray(selectedProduct.images) && selectedProduct.images.length > 0)
                        ? selectedProduct.images
                        : [selectedProduct.imageName || 'https://images.unsplash.com/photo-1587049359535-b64d3dd0d716?w=800&auto=format&fit=crop&q=80'];
                      const activeImg = gallery[activeProductImageIndex] || gallery[0];
                      const frameAspect = selectedProduct.imageAspectRatio || siteContent?.productImageSettings?.aspectRatio || 'square';
                      const frameFit = selectedProduct.imageFitMode || siteContent?.productImageSettings?.fitMode || 'cover';
                      const zoomFactor = selectedProduct.imageZoomLevel || siteContent?.productImageSettings?.zoomLevel || 2;

                      const aspectClass =
                        frameAspect === 'square'
                          ? 'aspect-square'
                          : frameAspect === 'portrait'
                          ? 'aspect-[4/5]'
                          : frameAspect === 'wide'
                          ? 'aspect-[16/9]'
                          : 'h-64 sm:h-80 md:h-[390px]';

                      return (
                        <div className="space-y-3">
                          {/* Main Image Container */}
                          <div
                            className={`rounded-2xl sm:rounded-[26px] overflow-hidden ${aspectClass} bg-stone-50 shadow-xs border border-stone-100 relative group select-none cursor-crosshair`}
                            onMouseEnter={() => setIsZoomLensActive(true)}
                            onMouseLeave={() => setIsZoomLensActive(false)}
                            onMouseMove={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                              const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
                              setZoomMousePos({ x, y });
                            }}
                            onClick={() => setIsLightboxOpen(true)}
                          >
                            <img
                              src={activeImg}
                              alt={selectedProduct.imageAlt || selectedProduct.title}
                              width={700}
                              height={700}
                              style={{
                                transformOrigin: `${zoomMousePos.x}% ${zoomMousePos.y}%`,
                                transform: isZoomLensActive ? `scale(${zoomFactor})` : 'scale(1)',
                                transition: isZoomLensActive ? 'transform 0.05s ease-out' : 'transform 0.25s ease-out',
                              }}
                              className={`w-full h-full pointer-events-none transition-transform ${
                                frameFit === 'contain' ? 'object-contain p-2' : 'object-cover'
                              }`}
                            />

                            {/* Discount Tag */}
                            {(selectedProduct.discount || 0) > 0 && (
                              <span className="absolute top-3 right-3 bg-[#ef394e] text-white text-xs font-black px-3 py-1 rounded-xl shadow-sm z-10 pointer-events-none">
                                {selectedProduct.discount}% تخفیف ویژه
                              </span>
                            )}

                            {/* Zoom Magnifier Indicator & Fullscreen Button */}
                            <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsLightboxOpen(true);
                                }}
                                className="p-2 rounded-xl bg-white/90 hover:bg-white text-stone-700 hover:text-stone-900 shadow-md backdrop-blur-xs transition cursor-pointer"
                                title="بزرگ‌نمایی تمام‌صفحه و ذره‌بین"
                              >
                                <Maximize2 className="w-4 h-4" />
                              </button>
                              <span className="px-2 py-1 rounded-lg bg-stone-900/70 text-white text-[10px] font-bold backdrop-blur-xs flex items-center gap-1 pointer-events-none">
                                <ZoomIn className="w-3 h-3 text-amber-400" />
                                <span>{zoomFactor}x زوم</span>
                              </span>
                            </div>

                            {/* Gallery Navigation Overlay Arrows (if multiple images) */}
                            {gallery.length > 1 && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveProductImageIndex((prev) => (prev > 0 ? prev - 1 : gallery.length - 1));
                                  }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white text-stone-800 shadow-md transition opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
                                  title="تصویر قبلی"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveProductImageIndex((prev) => (prev < gallery.length - 1 ? prev + 1 : 0));
                                  }}
                                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white text-stone-800 shadow-md transition opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
                                  title="تصویر بعدی"
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="absolute bottom-3 left-3 bg-stone-900/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-xs pointer-events-none z-10">
                                  {activeProductImageIndex + 1} از {gallery.length}
                                </span>
                              </>
                            )}

                            <div className="absolute bottom-3 right-3 bg-white/80 backdrop-blur-xs text-stone-700 text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-2xs pointer-events-none opacity-0 group-hover:opacity-100 transition">
                              حرکت ماوس برای مشاهده جزئیات با ذره‌بین
                            </div>
                          </div>

                          {/* Thumbnails Strip */}
                          {gallery.length > 1 && (
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
                              {gallery.map((imgUrl, idx) => {
                                const isCurrent = idx === activeProductImageIndex;
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setActiveProductImageIndex(idx)}
                                    className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                                      isCurrent
                                        ? 'border-amber-500 ring-2 ring-amber-500/30 scale-102 shadow-sm'
                                        : 'border-stone-200 opacity-70 hover:opacity-100'
                                    }`}
                                  >
                                    <img
                                      src={imgUrl}
                                      alt={`${selectedProduct.title} - تصویر ${idx + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                    {isCurrent && (
                                      <div className="absolute inset-0 bg-amber-500/10 pointer-events-none" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* Product Info & Dynamic Size Selector */}
                <div className="md:col-span-7 flex flex-col justify-between space-y-5">
                  <div>
                    <span className="inline-block text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full mb-2">
                      {selectedProduct.categoryTitle || 'محصول ارگانیک اونیوال'}
                    </span>
                    <h1 className="text-xl sm:text-2xl font-black text-stone-900 mb-3 leading-snug">
                      {selectedProduct.title}
                    </h1>
                    <p className="text-xs sm:text-sm text-stone-600 leading-relaxed mb-5 whitespace-pre-line">
                      {selectedProduct.description}
                    </p>

                    {/* DYNAMIC SIZE SELECTOR */}
                    <div className="mb-5">
                      <span className="text-xs font-bold text-stone-800 block mb-2.5">
                        انتخاب اندازه / وزن محصول:
                      </span>

                      {selectedProduct.sizes && selectedProduct.sizes.length > 0 ? (
                        <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2">
                          {selectedProduct.sizes.map((s, idx) => {
                            const isSel = selectedSize === s.name;
                            const sizeStock = s.stock !== undefined ? s.stock : (selectedProduct.stock ?? 20);
                            const isSizeOut = Boolean(s.isOutOfStock || sizeStock <= 0);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedSize(s.name)}
                                className={`px-4 py-3 sm:py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between sm:justify-center gap-2 cursor-pointer border ${
                                  isSel
                                    ? 'bg-stone-900 text-white border-stone-900 shadow-md'
                                    : isSizeOut
                                    ? 'bg-stone-100 text-stone-400 border-stone-200'
                                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                                }`}
                              >
                                <div className="flex items-center gap-1.5">
                                  <span>{s.name}</span>
                                  {isSizeOut && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold">
                                      ناموجود
                                    </span>
                                  )}
                                </div>
                                <span className={`text-[11px] font-extrabold ${isSel ? 'text-amber-300' : 'text-stone-500'}`}>
                                  ({formatPrice(s.price)} تومان)
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1.5 rounded-2xl">
                          <button
                            type="button"
                            onClick={() => setSelectedSize('کوچک')}
                            className={`px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                              selectedSize === 'کوچک'
                                ? 'bg-white text-stone-900 shadow-sm'
                                : 'text-stone-500 hover:text-stone-800'
                            }`}
                          >
                            کوچک (بسته ۲۵۰ گرمی)
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedSize('بزرگ')}
                            className={`px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                              selectedSize === 'بزرگ'
                                ? 'bg-white text-stone-900 shadow-sm'
                                : 'text-stone-500 hover:text-stone-800'
                            }`}
                          >
                            بزرگ (بسته ۱ کیلوگرمی)
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Stock & Quota Status Indicator for Selected Packaging */}
                    {(() => {
                      const activeSizeObj = selectedProduct.sizes?.find(s => s.name === selectedSize);
                      const currentSizeStock = activeSizeObj?.stock !== undefined ? activeSizeObj.stock : (selectedProduct.stock ?? 20);
                      const isCurrentSizeOut = (activeSizeObj && (activeSizeObj.isOutOfStock || activeSizeObj.stock <= 0)) ||
                        ((selectedProduct.stock !== undefined && selectedProduct.stock <= 0) || selectedProduct.isOutOfStock || selectedProduct.availability === 'OutOfStock');
                      const isOffer = isSizeSpecialOfferActive(selectedProduct, selectedSize);
                      const currentSizeQuota = activeSizeObj?.specialOfferStock !== undefined ? activeSizeObj.specialOfferStock : selectedProduct.specialOfferStock;

                      return (
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          {isCurrentSizeOut ? (
                            <span className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-800 text-white flex items-center gap-1.5">
                              <span>بسته‌بندی «{selectedSize}» در انبار ناموجود است</span>
                            </span>
                          ) : currentSizeStock <= 5 ? (
                            <span className="px-3 py-1 rounded-xl text-xs font-bold bg-rose-100 text-rose-800 flex items-center gap-1.5 animate-pulse">
                              <span>تنها {currentSizeStock} عدد از بسته «{selectedSize}» باقیست</span>
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
                              <span>موجود در انبار: {currentSizeStock} عدد ({selectedSize})</span>
                            </span>
                          )}

                          {isOffer && currentSizeQuota !== undefined && currentSizeQuota > 0 && (
                            <span className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              🔥 سهمیه با قیمت تخفیفی: {currentSizeQuota} عدد باقیست
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {/* Price Display */}
                    <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs font-bold text-stone-700">
                        قیمت اندازه «{selectedSize}»:
                      </span>
                      {isSizeSpecialOfferActive(selectedProduct, selectedSize) ? (
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-xs sm:text-sm text-stone-400 line-through">
                            {formatPrice(getBasePrice(selectedProduct, selectedSize))}
                          </span>
                          <span className="text-lg sm:text-2xl font-black text-[#ef394e]">
                            {formatPrice(calculateFinalPrice(selectedProduct, selectedSize))} تومان
                          </span>
                        </div>
                      ) : (
                        <div className="text-lg sm:text-2xl font-black text-stone-900">
                          {formatPrice(calculateFinalPrice(selectedProduct, selectedSize))} تومان
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 pt-1">
                    {(() => {
                      const activeSizeObj = selectedProduct.sizes?.find(s => s.name === selectedSize);
                      const isCurrentSizeOut = (activeSizeObj && (activeSizeObj.isOutOfStock || (activeSizeObj.stock !== undefined && activeSizeObj.stock <= 0))) ||
                        ((selectedProduct.stock !== undefined && selectedProduct.stock <= 0) || selectedProduct.isOutOfStock || selectedProduct.availability === 'OutOfStock');

                      if (isCurrentSizeOut) {
                        return (
                          <button
                            type="button"
                            disabled
                            className="w-full py-4 bg-slate-200 text-slate-500 font-black text-sm rounded-2xl cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            <span>بسته‌بندی «{selectedSize}» در حال حاضر ناموجود است</span>
                          </button>
                        );
                      }
                      return (
                        <button
                          type="button"
                          onClick={() => addToCart(selectedProduct, selectedSize)}
                          className="w-full py-4 bg-[#f59e0b] hover:bg-[#d97706] text-white font-black text-sm rounded-2xl shadow-md transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <ShoppingBag className="w-4 h-4" />
                          <span>افزودن بسته‌بندی «{selectedSize}» به سبد خرید</span>
                        </button>
                      );
                    })()}

                    {/* Features List */}
                    {selectedProduct.features && selectedProduct.features.length > 0 && (
                      <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                        <h4 className="text-xs font-bold text-stone-800 mb-2.5">ویژگی‌های تاییدشده محصول:</h4>
                        <ul className="space-y-2 text-xs text-stone-600">
                          {selectedProduct.features.map((f, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-[#4CAF50] shrink-0" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Fullscreen Lightbox & Interactive Zoom Modal */}
            {isLightboxOpen && (
              <div 
                className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 select-none animate-fadeIn"
                onClick={() => setIsLightboxOpen(false)}
              >
                {/* Lightbox Header */}
                <div 
                  className="flex items-center justify-between text-white z-10 pb-3 border-b border-white/10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm sm:text-base font-black truncate max-w-xs sm:max-w-md">
                      {selectedProduct.title}
                    </span>
                    <span className="text-xs text-amber-400 font-bold bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                      بزرگ‌نمایی {lightboxZoomLevel}x برابر
                    </span>
                  </div>

                  {/* Zoom Controls & Close */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setLightboxZoomLevel((prev) => Math.max(1, prev - 0.5))}
                        disabled={lightboxZoomLevel <= 1}
                        className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                        title="کوچک‌نمایی"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-mono font-bold px-2">{lightboxZoomLevel}x</span>
                      <button
                        type="button"
                        onClick={() => setLightboxZoomLevel((prev) => Math.min(4, prev + 0.5))}
                        disabled={lightboxZoomLevel >= 4}
                        className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                        title="بزرگ‌نمایی"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsLightboxOpen(false)}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                      title="بستن (Esc)"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Lightbox Image Container */}
                <div 
                  className="flex-1 flex items-center justify-center relative overflow-hidden py-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  {(() => {
                    const gallery = (Array.isArray(selectedProduct.images) && selectedProduct.images.length > 0)
                      ? selectedProduct.images
                      : [selectedProduct.imageName || ''];
                    const activeImg = gallery[activeProductImageIndex] || gallery[0];
                    return (
                      <div className="relative max-w-4xl max-h-full flex items-center justify-center overflow-auto p-2">
                        <img
                          src={activeImg}
                          alt={selectedProduct.title}
                          style={{
                            transform: `scale(${lightboxZoomLevel})`,
                            transition: 'transform 0.2s ease-out'
                          }}
                          className="max-h-[70vh] sm:max-h-[75vh] w-auto max-w-full object-contain rounded-xl select-none"
                        />

                        {gallery.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={() => setActiveProductImageIndex((prev) => (prev > 0 ? prev - 1 : gallery.length - 1))}
                              className="fixed right-4 sm:right-8 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/15 hover:bg-white/30 text-white shadow-xl transition cursor-pointer z-20"
                              title="تصویر قبلی"
                            >
                              <ChevronRight className="w-6 h-6" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveProductImageIndex((prev) => (prev < gallery.length - 1 ? prev + 1 : 0))}
                              className="fixed left-4 sm:left-8 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/15 hover:bg-white/30 text-white shadow-xl transition cursor-pointer z-20"
                              title="تصویر بعدی"
                            >
                              <ChevronLeft className="w-6 h-6" />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Lightbox Thumbnails Strip */}
                {(() => {
                  const gallery = (Array.isArray(selectedProduct.images) && selectedProduct.images.length > 0)
                    ? selectedProduct.images
                    : [selectedProduct.imageName || ''];
                  if (gallery.length <= 1) return null;
                  return (
                    <div 
                      className="flex items-center justify-center gap-2 overflow-x-auto py-2 z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {gallery.map((img, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveProductImageIndex(idx)}
                          className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                            idx === activeProductImageIndex
                              ? 'border-amber-400 ring-2 ring-amber-400/40 scale-105'
                              : 'border-white/20 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ) : selectedPost ? (
          /* ================= ARTICLE READER PAGE VIEW ================= */
          <div className="max-w-3xl mx-auto animate-fadeIn">
            {/* Semantic Breadcrumb Navigation */}
            <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-stone-400">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  handleSelectPage('home');
                }}
                className="hover:text-amber-600 transition"
              >
                خانه
              </a>
              <span>/</span>
              <a
                href="/articles"
                onClick={(e) => {
                  e.preventDefault();
                  handleSelectPage('articles');
                }}
                className="hover:text-amber-600 transition"
              >
                مقالات علمی
              </a>
              <span>/</span>
              <span className="text-stone-700 truncate max-w-[220px] sm:max-w-md" aria-current="page">
                {selectedPost.title}
              </span>
            </nav>

            <button 
              type="button"
              onClick={handleClosePost}
              className="mb-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-stone-200 font-bold text-stone-700 hover:text-stone-900 hover:bg-stone-50 text-xs sm:text-sm transition shadow-2xs cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
              <span>بازگشت به مقالات</span>
            </button>

            <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-stone-100">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                  {selectedPost.categoryTitle || 'دانشنامه اونیوال'}
                </span>
                <div className="text-[11px] text-stone-400 flex items-center gap-3">
                  <span>{selectedPost.creationTime}</span>
                  <span>نویسنده: {selectedPost.authorName}</span>
                </div>
              </div>

              <img 
                src={selectedPost.imageName} 
                alt={selectedPost.imageAlt || selectedPost.title} 
                width={800}
                height={450}
                {...({ fetchpriority: 'high' } as any)}
                className="w-full h-56 sm:h-72 object-cover rounded-2xl mb-5"
              />

              <h1 className="text-lg sm:text-2xl font-black text-stone-900 mb-3 leading-snug">
                {selectedPost.title}
              </h1>

              <p className="text-xs sm:text-sm text-stone-600 font-semibold mb-4 leading-relaxed">
                {selectedPost.description}
              </p>

              {/* Article Video / Teaser Player */}
              {selectedPost.videoUrl && (
                <div className="mb-6 rounded-2xl overflow-hidden bg-black shadow-md border border-stone-800">
                  <div className="bg-stone-900/90 px-4 py-2 text-stone-200 text-xs font-bold flex items-center justify-between border-b border-stone-800">
                    <span className="flex items-center gap-2">
                      <Film className="w-4 h-4 text-amber-400" />
                      <span>ویدیو و تیزر این مقاله</span>
                    </span>
                    <span className="text-[10px] text-stone-400">
                      {selectedPost.videoType === 'aparat' || selectedPost.videoUrl.includes('aparat.com')
                        ? 'پخش از آپارات'
                        : selectedPost.videoType === 'youtube' || selectedPost.videoUrl.includes('youtube.com') || selectedPost.videoUrl.includes('youtu.be')
                        ? 'پخش از یوتیوب'
                        : 'پخش مستقیم ویدیو'}
                    </span>
                  </div>
                  <div className="aspect-video w-full bg-black flex items-center justify-center">
                    {selectedPost.videoType === 'aparat' || selectedPost.videoUrl.includes('aparat.com') ? (
                      <iframe
                        src={
                          selectedPost.videoUrl.includes('/v/')
                            ? selectedPost.videoUrl.replace('/v/', '/video/video/embed/videohash/') + '/vt/frame'
                            : selectedPost.videoUrl
                        }
                        title={`ویدیو ${selectedPost.title}`}
                        allowFullScreen
                        className="w-full h-full border-0"
                      />
                    ) : selectedPost.videoType === 'youtube' || selectedPost.videoUrl.includes('youtube.com') || selectedPost.videoUrl.includes('youtu.be') ? (
                      <iframe
                        src={
                          selectedPost.videoUrl.includes('watch?v=')
                            ? selectedPost.videoUrl.replace('watch?v=', 'embed/')
                            : selectedPost.videoUrl.includes('youtu.be/')
                            ? selectedPost.videoUrl.replace('youtu.be/', 'www.youtube.com/embed/')
                            : selectedPost.videoUrl
                        }
                        title={`ویدیو ${selectedPost.title}`}
                        allowFullScreen
                        className="w-full h-full border-0"
                      />
                    ) : (
                      <video
                        src={selectedPost.videoUrl}
                        controls
                        playsInline
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                </div>
              )}

              <div className="p-4 sm:p-6 bg-stone-50 rounded-2xl border border-stone-100 mb-6">
                <ArticleContentRenderer content={selectedPost.content} />
              </div>

              <div className="flex justify-end">
                <button 
                  type="button"
                  onClick={handleClosePost}
                  className="px-6 py-2.5 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 cursor-pointer"
                >
                  بازگشت
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
        {/* ================= PAGE 1: HOME ================= */}
        {activePage === 'home' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Always display Hero Header if not explicitly positioned in sections */}
            {!hasExplicitHero && (
              <div className="text-center pt-4 pb-1">
                <h1 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight flex items-center justify-center gap-2 flex-wrap">
                  <span>{siteContent?.heroTitlePrefix || 'فروشگاه تخصصی'}</span>
                  <span className="text-amber-600">{brandName}</span>
                  {(siteContent?.showHeroEnglishBadge ?? true) && (
                    <span className="text-xs font-mono font-bold text-stone-400 border border-stone-200 px-2 py-0.5 rounded-md self-center">
                      {brandEnglishName}
                    </span>
                  )}
                </h1>
                <p className="text-xs sm:text-sm text-stone-500 font-medium mt-2">
                  {siteContent?.heroSubtitle || brandDescription}
                </p>
                {siteContent?.systemTagline && (
                  <p className="text-xs text-stone-400 mt-1 max-w-xl mx-auto">
                    {siteContent.systemTagline}
                  </p>
                )}
              </div>
            )}

            {homeSections.map(sec => {
              if (!sec.enabled) return null;

              const secKey = normalizeSectionId(sec.id);
              switch (secKey) {
                case 'hero':
                  return (
                    <div key={sec.id} className="text-center pt-4 pb-1">
                      <h1 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight flex items-center justify-center gap-2 flex-wrap">
                        <span>{sec.title || siteContent?.heroTitlePrefix || 'فروشگاه تخصصی'}</span>
                        <span className="text-amber-600">{brandName}</span>
                        {(siteContent?.showHeroEnglishBadge ?? true) && (
                          <span className="text-xs font-mono font-bold text-stone-400 border border-stone-200 px-2 py-0.5 rounded-md self-center">
                            {brandEnglishName}
                          </span>
                        )}
                      </h1>
                      <p className="text-xs sm:text-sm text-stone-500 font-medium mt-2">
                        {sec.subtitle || siteContent?.heroSubtitle || brandDescription}
                      </p>
                      {sec.customText && (
                        <p className="text-xs text-stone-400 mt-1 max-w-xl mx-auto">
                          {sec.customText}
                        </p>
                      )}
                    </div>
                  );

                case 'special_offers':
                  return (
                    <React.Fragment key={sec.id}>
                      {specialOffers.length > 0 && (
                        <section className="bg-[#ef394e] rounded-[22px] p-5 text-white shadow-lg relative overflow-hidden flex flex-col sm:flex-row items-stretch sm:items-center gap-5">
                          <div className="flex sm:flex-col items-center justify-between sm:justify-center text-center shrink-0 sm:w-36 border-b sm:border-b-0 sm:border-l border-white/20 pb-3 sm:pb-0 sm:pl-4">
                            <div className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center mb-1">
                              <Percent className="w-6 h-6 stroke-[2.5]" />
                            </div>
                            <div>
                              <h2 className="text-base sm:text-lg font-black tracking-tight mt-1">
                                {sec.title || 'پیشنهاد شگفت‌انگیز'}
                              </h2>
                              {sec.subtitle && (
                                <p className="text-[11px] text-white/80 hidden sm:block mt-0.5">{sec.subtitle}</p>
                              )}
                              <button 
                                id="btn-view-all-deals"
                                onClick={handleViewAllOffers}
                                className="mt-2 text-xs border border-white rounded-lg px-3 py-1 font-bold hover:bg-white hover:text-[#ef394e] transition inline-block cursor-pointer"
                              >
                                مشاهده همه
                              </button>
                            </div>
                          </div>

                          {/* Offer Horizontal Scroll */}
                          <div className="flex-1 flex gap-3.5 overflow-x-auto pb-2 scrollbar-none items-center">
                            {specialOffers.map(p => {
                              const basePrice = getBasePrice(p, p.sizes?.[0]?.name || 'کوچک');
                              const finalPrice = calculateFinalPrice(p, p.sizes?.[0]?.name || 'کوچک');
                              return (
                                <div
                                  key={p.id}
                                  onClick={() => handleOpenProduct(p)}
                                  className="w-40 shrink-0 bg-white rounded-2xl p-2.5 text-center relative cursor-pointer hover:scale-102 transition shadow-sm"
                                >
                                  <span className="absolute top-2 right-2 bg-[#ef394e] text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-xs">
                                    {p.discount}%
                                  </span>
                                  <img 
                                    src={p.imageName} 
                                    alt={p.title} 
                                    className="w-full h-24 object-cover rounded-xl mb-2"
                                  />
                                  <div className="text-xs font-bold text-stone-800 line-clamp-1 h-5">{p.title}</div>
                                  <span className="text-[11px] text-stone-400 line-through block mt-1">
                                    {formatPrice(basePrice)}
                                  </span>
                                  <div className="text-xs font-black text-stone-900 mt-0.5">
                                    {formatPrice(finalPrice)} ت
                                  </div>
                                  {p.specialOfferStock !== undefined && p.specialOfferStock > 0 && (
                                    <div className="text-[10px] font-bold text-rose-600 bg-rose-50 rounded px-1.5 py-0.5 mt-1 truncate">
                                      تنها {p.specialOfferStock} عدد با تخفیف
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            <div 
                              onClick={handleViewAllOffers}
                              className="w-24 h-40 shrink-0 bg-white/95 rounded-2xl flex flex-col items-center justify-center text-[#ef394e] font-black text-xs cursor-pointer p-2 text-center hover:bg-white transition shadow-sm"
                            >
                              <div className="w-8 h-8 rounded-full border-2 border-[#ef394e] flex items-center justify-center mb-2">
                                <ArrowLeft className="w-4 h-4" />
                              </div>
                              <span>موارد<br />بیشتر</span>
                            </div>
                          </div>
                        </section>
                      )}

                      {/* Top Rotating Banner with Standard Auto-Switch right below Special Offers */}
                      <TopBannerCarousel
                        settings={siteContent?.topBannerSettings}
                        banners={siteContent?.topBanners}
                        onBannerClick={(banner) => {
                          if (banner.linkUrl) {
                            if (banner.linkUrl.startsWith('/')) {
                              const pageKey = banner.linkUrl.replace('/', '');
                              if (pageKey === 'articles' || pageKey === 'consultation' || pageKey === 'tracking' || pageKey === 'about' || pageKey === 'contact') {
                                handleSelectPage(pageKey as any);
                              } else if (pageKey.startsWith('categories/')) {
                                const catSlug = pageKey.replace('categories/', '');
                                handleSelectCategory(catSlug);
                              } else {
                                window.location.href = banner.linkUrl;
                              }
                            } else {
                              window.location.href = banner.linkUrl;
                            }
                          }
                        }}
                      />
                    </React.Fragment>
                  );

                case 'categories':
                  return (
                    <div key={sec.id} className="space-y-2">
                      {sec.title && sec.title !== 'دسته‌بندی‌ها' && (
                        <div className="text-xs font-bold text-stone-700">{sec.title}</div>
                      )}
                      <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
                        <a
                          href="/"
                          onClick={(e) => {
                            e.preventDefault();
                            handleSelectCategory('all');
                          }}
                          className={`whitespace-nowrap px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-2 transition ${
                            activeCategory === 'all'
                              ? 'bg-stone-900 text-white shadow-md'
                              : 'bg-white border border-stone-200 text-stone-600 hover:border-amber-400'
                          }`}
                        >
                          <LayoutGrid className="w-4 h-4" />
                          <span>همه محصولات</span>
                        </a>

                        <button
                          id="cat-discounted"
                          onClick={() => handleSelectCategory('discounted')}
                          className={`whitespace-nowrap px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-2 transition ${
                            activeCategory === 'discounted'
                              ? 'bg-[#ef394e] text-white shadow-md'
                              : 'bg-white border border-rose-200 text-rose-700 hover:bg-rose-50'
                          }`}
                        >
                          <Percent className="w-4 h-4 text-[#ef394e]" />
                          <span>پیشنهاد شگفت‌انگیز (تخفیف‌دار)</span>
                          {specialOffers.length > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${activeCategory === 'discounted' ? 'bg-white text-rose-700' : 'bg-rose-100 text-rose-800'}`}>
                              {specialOffers.length}
                            </span>
                          )}
                        </button>

                        <a
                          href="/categories/honey"
                          onClick={(e) => {
                            e.preventDefault();
                            handleSelectCategory('honey');
                          }}
                          className={`whitespace-nowrap px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-2 transition ${
                            activeCategory === 'honey'
                              ? 'bg-stone-900 text-white shadow-md'
                              : 'bg-white border border-stone-200 text-stone-600 hover:border-amber-400'
                          }`}
                        >
                          <Hexagon className="w-4 h-4" />
                          <span>عسل‌های طبیعی و کوهستان</span>
                        </a>

                        <a
                          href="/categories/supplement"
                          onClick={(e) => {
                            e.preventDefault();
                            handleSelectCategory('supplement');
                          }}
                          className={`whitespace-nowrap px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-2 transition ${
                            activeCategory === 'supplement'
                              ? 'bg-stone-900 text-white shadow-md'
                              : 'bg-white border border-stone-200 text-stone-600 hover:border-amber-400'
                          }`}
                        >
                          <Pill className="w-4 h-4" />
                          <span>مکمل‌ها (ژل رویال و گرده)</span>
                        </a>

                        <a
                          href="/categories/drink"
                          onClick={(e) => {
                            e.preventDefault();
                            handleSelectCategory('drink');
                          }}
                          className={`whitespace-nowrap px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-2 transition ${
                            activeCategory === 'drink'
                              ? 'bg-stone-900 text-white shadow-md'
                              : 'bg-white border border-stone-200 text-stone-600 hover:border-amber-400'
                          }`}
                        >
                          <Coffee className="w-4 h-4" />
                          <span>نوشیدنی و دمنوش</span>
                        </a>

                        <a
                          href="/categories/nuts"
                          onClick={(e) => {
                            e.preventDefault();
                            handleSelectCategory('nuts');
                          }}
                          className={`whitespace-nowrap px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-2 transition ${
                            activeCategory === 'nuts'
                              ? 'bg-stone-900 text-white shadow-md'
                              : 'bg-white border border-stone-200 text-stone-600 hover:border-amber-400'
                          }`}
                        >
                          <Nut className="w-4 h-4" />
                          <span>خشکبار و گردو</span>
                        </a>

                        {/* Dynamic categories from backend */}
                        {publicCategories
                          .filter(cat => !['honey', 'supplement', 'drink', 'nuts'].includes(cat.slug))
                          .map(cat => (
                          <a
                            key={cat.id}
                            href={`/categories/${encodeURIComponent(cat.slug)}`}
                            onClick={(e) => {
                              e.preventDefault();
                              handleSelectCategory(cat.slug || cat.title, cat);
                            }}
                            className={`whitespace-nowrap px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-2 transition ${
                              activeCategory === cat.title || activeCategory === cat.slug
                                ? 'bg-stone-900 text-white shadow-md'
                                : 'bg-white border border-stone-200 text-stone-600 hover:border-amber-400'
                            }`}
                          >
                            <span>{cat.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  );

                case 'products':
                  return (
                    <div key={sec.id} id="products-section" className="scroll-mt-24">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-base sm:text-lg font-black text-stone-900">
                            {sec.title || ('لیست محصولات ' + brandName)}
                          </h3>
                          {sec.subtitle && (
                            <p className="text-xs text-stone-500 mt-0.5">{sec.subtitle}</p>
                          )}
                        </div>
                        <span className="text-xs text-stone-400 font-medium">
                          {filteredProducts.length} محصول موجود
                        </span>
                      </div>

                      {filteredProducts.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-3xl border border-stone-100 text-stone-400 text-xs">
                          محصولی در این دسته‌بندی یافت نشد.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {filteredProducts.map(product => {
                            const hasDiscount = (product.discount || 0) > 0;
                            const defaultSizeName = product.sizes?.[0]?.name || 'کوچک';
                            const basePrice = getBasePrice(product, defaultSizeName);
                            const finalPrice = calculateFinalPrice(product, defaultSizeName);
                            const prodUrl = `/products/${encodeURIComponent(product.slug || sanitizeSlug(product.title, 'product', product.id))}`;

                            return (
                              <a
                                key={product.id}
                                href={prodUrl}
                                onClick={(e) => handleOpenProduct(product, e)}
                                className="bg-white rounded-[25px] overflow-hidden shadow-xs hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 border border-stone-100 cursor-pointer group flex flex-col justify-between block text-right"
                              >
                                <div>
                                  {(() => {
                                    const cardAspect = product.imageAspectRatio || siteContent?.productImageSettings?.aspectRatio || 'square';
                                    const cardFit = product.imageFitMode || siteContent?.productImageSettings?.fitMode || 'cover';
                                    const aspectClass =
                                      cardAspect === 'square'
                                        ? 'aspect-square'
                                        : cardAspect === 'portrait'
                                        ? 'aspect-[4/5]'
                                        : cardAspect === 'wide'
                                        ? 'aspect-[16/9]'
                                        : 'h-48';

                                    return (
                                      <div className={`${aspectClass} overflow-hidden bg-stone-50 relative group/img`}>
                                        <img 
                                          src={product.imageName} 
                                          alt={product.imageAlt || product.title} 
                                          width={400}
                                          height={300}
                                          loading="lazy"
                                          decoding="async"
                                          className={`w-full h-full transition duration-500 group-hover:scale-105 ${
                                            cardFit === 'contain' ? 'object-contain p-2' : 'object-cover'
                                          }`}
                                        />
                                        {hasDiscount && isSpecialOfferActive(product) && (
                                          <span className="absolute top-3 right-3 bg-[#ef394e] text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-sm">
                                            {product.discount}% تخفیف
                                            {product.specialOfferStock !== undefined && product.specialOfferStock > 0 ? ` (${product.specialOfferStock} عدد)` : ''}
                                          </span>
                                        )}
                                        {((product.stock !== undefined && product.stock <= 0) || product.isOutOfStock || product.availability === 'OutOfStock') ? (
                                          <span className="absolute top-3 left-3 bg-slate-900/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                                            ناموجود
                                          </span>
                                        ) : (product.stock !== undefined && product.stock <= 5) ? (
                                          <span className="absolute top-3 left-3 bg-amber-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                                            تنها {product.stock} عدد
                                          </span>
                                        ) : product.videoUrl ? (
                                          <span className="absolute top-3 left-3 bg-stone-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                                            <Play className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                                            <span>ویدیو</span>
                                          </span>
                                        ) : null}
                                        {product.sizes && product.sizes.length > 1 && (
                                          <span className="absolute bottom-2.5 right-2.5 bg-stone-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                                            {product.sizes.length} اندازه مختلف
                                          </span>
                                        )}
                                        {product.images && product.images.length > 1 && (
                                          <span className="absolute bottom-2.5 left-2.5 bg-stone-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                            <Images className="w-2.5 h-2.5 text-amber-300" />
                                            <span>{product.images.length} عکس</span>
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  <div className="p-4">
                                    <span className="text-[11px] font-bold text-stone-400 block mb-1">
                                      {product.categoryTitle || 'محصول ارگانیک'}
                                    </span>
                                    <h4 className="text-sm font-extrabold text-stone-800 line-clamp-1 mb-1">
                                      {product.title}
                                    </h4>
                                    <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                                      {product.description}
                                    </p>
                                  </div>
                                </div>

                                <div className="px-4 pb-4 pt-2 border-t border-stone-50 flex items-center justify-between">
                                  <div className="flex flex-col">
                                    {hasDiscount && (
                                      <span className="text-[11px] text-stone-400 line-through">
                                        {formatPrice(basePrice)}
                                      </span>
                                    )}
                                    <span className={`text-sm font-black ${hasDiscount ? 'text-[#ef394e]' : 'text-stone-800'}`}>
                                      {product.sizes && product.sizes.length > 1 && (
                                        <span className="text-[10px] font-normal text-stone-400 ml-1">از</span>
                                      )}
                                      {formatPrice(finalPrice)} <span className="text-[10px] font-normal text-stone-500">تومان</span>
                                    </span>
                                  </div>

                                  <span 
                                    className="w-9 h-9 rounded-xl bg-stone-900 group-hover:bg-amber-500 text-white flex items-center justify-center transition shadow-xs"
                                    title="مشاهده اندازه‌ها و خرید"
                                  >
                                    <ArrowLeft className="w-4 h-4" />
                                  </span>
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );

                case 'consultation':
                  return (
                    <section key={sec.id} className="bg-gradient-to-l from-amber-500 via-amber-600 to-amber-700 rounded-[24px] p-6 sm:p-8 text-white shadow-md relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6">
                      <div className="space-y-2 text-center sm:text-right max-w-xl">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-bold text-white mb-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>مشاوره تخصصی و رایگان</span>
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black text-white">
                          {sec.title || ('مشاوره تخصصی سلامت و محصولات ' + brandName)}
                        </h3>
                        <p className="text-xs sm:text-sm text-amber-50 leading-relaxed">
                          {sec.subtitle || 'برای انتخاب بهترین فرآورده کندو متناسب با شرایط بدنی خود، با کارشناسان تخصصی ما در ارتباط باشید.'}
                        </p>
                      </div>
                      <a
                        href="/consultation"
                        onClick={(e) => {
                          e.preventDefault();
                          handleSelectPage('consultation');
                        }}
                        className="px-6 py-3.5 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl text-xs font-extrabold shadow-lg transition flex items-center gap-2 shrink-0 cursor-pointer"
                      >
                        <span>درخواست مشاوره فوری</span>
                        <ArrowLeft className="w-4 h-4" />
                      </a>
                    </section>
                  );

                case 'articles':
                  return (
                    <section key={sec.id} className="mt-8 pt-8 border-t border-stone-200/80">
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-black text-stone-900">
                          {sec.title || ('مقالات و مطالب علمی ' + brandName)}
                        </h2>
                        <a 
                          href="/articles"
                          onClick={(e) => {
                            e.preventDefault();
                            handleSelectPage('articles');
                          }}
                          className="text-xs text-amber-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>همه مقالات</span>
                          <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                        </a>
                      </div>
                      <p className="text-xs text-stone-500 mb-6">
                        {sec.subtitle || 'آخرین نوشته‌ها برای آشنایی با خواص عسل طبیعی، دمنوش‌های گیاهی و سبک زندگی سالم.'}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {publicPosts.map(post => {
                          const postUrl = `/articles/${encodeURIComponent(post.slug || sanitizeSlug(post.title, 'article', post.id))}`;
                          return (
                            <a 
                              key={post.id}
                              href={postUrl}
                              onClick={(e) => handleOpenPost(post, e)}
                              className="bg-white rounded-2xl p-5 shadow-xs border border-stone-100 hover:shadow-md transition cursor-pointer flex flex-col justify-between block text-right"
                            >
                              <div>
                                <div className="text-[11px] font-extrabold text-[#4CAF50] mb-2">
                                  {post.categoryTitle || 'سبک زندگی ارگانیک'}
                                </div>
                                <h3 className="text-sm font-black text-stone-900 leading-snug mb-2 line-clamp-2">
                                  {post.title}
                                </h3>
                                <div className="text-[10px] text-stone-400 mb-3 flex items-center gap-2">
                                  <Clock className="w-3 h-3" />
                                  <span>زمان مطالعه: ۵ دقیقه</span>
                                </div>
                                <p className="text-xs text-stone-500 leading-relaxed line-clamp-3 mb-4">
                                  {post.description}
                                </p>
                              </div>

                              <span className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 mt-auto">
                                ادامه مطلب
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </span>
                            </a>
                          );
                        })}
                      </div>
                    </section>
                  );

                case 'about':
                  return (
                    <section key={sec.id} className="bg-white rounded-[26px] p-6 sm:p-8 border border-stone-100 shadow-xs space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
                        <div>
                          <h3 className="text-lg font-black text-stone-900">
                            {sec.title || ('درباره اصالت و تعهد ' + brandName)}
                          </h3>
                          <p className="text-xs text-stone-500 mt-1">
                            {sec.subtitle || 'تضمین اصالت آزمایشگاهی و خلوص ۱۰۰ درصدی کلیه محصولات'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setActivePage('about');
                            window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
                          }}
                          className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                        >
                          <span>داستان ما</span>
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                        {sec.customText || siteContent?.pages?.about?.content || 'مجموعه تخصصی اونیوال با همکاری مستقیم زنبورداران محلی و کشاورزان متعهد، محصولات کاملاً سالم، ارگانیک و حرارت‌ندیده را بدون واسطه به دست خانواده‌های ایرانی می‌رساند.'}
                      </p>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                        <div className="p-3 bg-stone-50 rounded-xl text-center">
                          <div className="text-emerald-600 font-black text-base">۱۰۰٪</div>
                          <div className="text-[11px] text-stone-500 mt-0.5">خام و آزمایش‌شده</div>
                        </div>
                        <div className="p-3 bg-stone-50 rounded-xl text-center">
                          <div className="text-amber-600 font-black text-base">زیر ۲٪</div>
                          <div className="text-[11px] text-stone-500 mt-0.5">ساکارز طبیعی سبلان</div>
                        </div>
                        <div className="p-3 bg-stone-50 rounded-xl text-center">
                          <div className="text-blue-600 font-black text-base">زنجیره سرد</div>
                          <div className="text-[11px] text-stone-500 mt-0.5">ارسال ژل رویال</div>
                        </div>
                        <div className="p-3 bg-stone-50 rounded-xl text-center">
                          <div className="text-rose-600 font-black text-base">۷ روز</div>
                          <div className="text-[11px] text-stone-500 mt-0.5">ضمانت بازگشت وجه</div>
                        </div>
                      </div>
                    </section>
                  );

                default:
                  return null;
              }
            })}
          </div>
        )}

        {/* ================= PAGE 2: ARTICLES ================= */}
        {activePage === 'articles' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center max-w-2xl mx-auto mb-8">
              <h1 className="text-2xl sm:text-3xl font-black text-stone-900">
                {siteContent?.pages?.articles?.title || `دانشنامه و مقالات تخصصی ${brandName} (${brandEnglishName})`}
              </h1>
              <p className="text-xs text-stone-500 mt-2">
                {siteContent?.pages?.articles?.subtitle || 'مرجع جامع راهنمای تشخیص عسل طبیعی، فواید ژل رویال، دمنوش‌های گیاهی و تغذیه ارگانیک'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {publicPosts.map(post => {
                const postUrl = `/articles/${encodeURIComponent(post.slug || sanitizeSlug(post.title, 'article', post.id))}`;
                return (
                  <a 
                    key={post.id}
                    href={postUrl}
                    onClick={(e) => handleOpenPost(post, e)}
                    className="bg-white rounded-2xl overflow-hidden shadow-xs border border-stone-100 hover:shadow-lg transition cursor-pointer flex flex-col block text-right"
                  >
                    <img 
                      src={post.imageName} 
                      alt={post.imageAlt || post.title} 
                      width={400}
                      height={240}
                      loading="lazy"
                      decoding="async"
                      className="h-44 w-full object-cover"
                    />
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="text-[11px] font-bold text-[#4CAF50] mb-1">
                          {post.categoryTitle || 'مقالات اونیوال'}
                        </div>
                        <h3 className="text-sm font-black text-stone-900 mb-2 leading-snug">
                          {post.title}
                        </h3>
                        <p className="text-xs text-stone-500 line-clamp-3 leading-relaxed mb-4">
                          {post.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-stone-400 pt-3 border-t border-stone-50">
                        <span>نویسنده: {post.authorName}</span>
                        <span className="text-amber-600 font-bold flex items-center gap-1">
                          مطالعه
                          <ArrowLeft className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= 404 NOT FOUND PAGE ================= */}
        {activePage === 'not_found' && (
          <div className="max-w-xl mx-auto bg-white rounded-3xl p-8 sm:p-12 shadow-xs border border-stone-200 text-center space-y-4 animate-fadeIn my-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto font-black text-2xl">
              ۴۰۴
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-stone-900">
              صفحه مورد نظر یافت نشد (۴۰۴)
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 leading-relaxed">
              آدرس درخواستی شما (<code className="font-mono text-rose-600 bg-rose-50 px-2 py-0.5 rounded" dir="ltr">{notFoundPath}</code>) در فروشگاه {brandName} وجود ندارد، حذف شده یا به آدرس جدیدی منتقل شده است.
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-3">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  handleSelectPage('home');
                }}
                className="px-6 py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl text-xs font-black transition inline-flex items-center gap-2 cursor-pointer"
              >
                <span>بازگشت به صفحه اصلی فروشگاه</span>
                <ArrowLeft className="w-4 h-4" />
              </a>
              <a
                href="/articles"
                onClick={(e) => {
                  e.preventDefault();
                  handleSelectPage('articles');
                }}
                className="px-5 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-2xl text-xs font-bold transition cursor-pointer"
              >
                مشاهده مقالات علمی
              </a>
            </div>
          </div>
        )}

        {/* ================= PAGE 3: SPECIALIZED CONSULTATION ================= */}
        {activePage === 'consultation' && (
          <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-black mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{siteContent?.consultationBadge || 'مشاوره تخصصی و رزرو آنلاین کارشناس سلامت'}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-stone-900">
                {siteContent?.consultationTitle || 'رزرو نوبت مشاوره تخصصی سلامت و محصولات اونیوال'}
              </h1>
              <p className="text-xs sm:text-sm text-stone-500 mt-2 max-w-xl mx-auto leading-relaxed">
                {siteContent?.consultationSubtitle ||
                  'موضوع مشاوره، زمان مورد نظر و شبکه اجتماعی دلخواه خود را مشخص نمایید تا پس از صدور فاکتور، کارشناس سلامت اونیوال در زمان مقرر با شما ارتباط برقرار کند.'}
              </p>
            </div>

            {consultSuccessCode ? (
              <div className="bg-white rounded-3xl p-8 border border-emerald-200 shadow-lg text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-stone-900">رزرو نوبت مشاوره شما با موفقیت ثبت شد</h3>
                <p className="text-xs text-stone-600 max-w-md mx-auto leading-relaxed">
                  کارشناس سلامت اونیوال در زمان انتخاب‌شده از طریق شبکه اجتماعی تعیین‌شده با شما ارتباط برقرار خواهد کرد.
                </p>
                <div className="p-4 rounded-2xl bg-amber-50 border border-dashed border-amber-400 max-w-sm mx-auto">
                  <span className="text-[11px] text-amber-700 block mb-1">کد رهگیری و فاکتور مشاوره شما:</span>
                  <span className="text-lg font-mono font-black text-stone-900 tracking-wider">
                    {consultSuccessCode}
                  </span>
                </div>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTrackingCodeInput(consultSuccessCode);
                      setActivePage('tracking');
                      setConsultSuccessCode(null);
                    }}
                    className="px-5 py-2.5 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition cursor-pointer"
                  >
                    پیگیری وضعیت نوبت مشاوره
                  </button>
                  <button
                    type="button"
                    onClick={() => setConsultSuccessCode(null)}
                    className="px-5 py-2.5 border border-stone-200 text-stone-600 rounded-xl text-xs font-bold hover:bg-stone-50 cursor-pointer"
                  >
                    رزرو نوبت جدید
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-stone-100 space-y-6">
                {/* Specialist Info Banner */}
                <div className="bg-gradient-to-r from-amber-50 via-stone-50 to-amber-50/60 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-black text-stone-900">
                        {consultationConfig.specialistName}
                      </div>
                      <div className="text-[11px] text-stone-500 mt-0.5">
                        {consultationConfig.specialistTitle}
                      </div>
                    </div>
                  </div>
                  <div className="bg-white px-3.5 py-2 rounded-xl border border-amber-200 text-right sm:text-left shrink-0">
                    <span className="text-[10px] text-stone-400 block">تعرفه جلسه انتخابی:</span>
                    <span className="text-sm font-black text-amber-700">
                      {activeConsultPrice > 0 ? `${formatPrice(activeConsultPrice)} تومان` : 'رایگان'}
                    </span>
                  </div>
                </div>

                <form onSubmit={handleConsultSubmit} className="space-y-6">
                  {/* STEP 1: SELECT CONSULTATION TOPIC & PRICE */}
                  <div className="space-y-3">
                    <label className="block text-xs sm:text-sm font-black text-stone-900">
                      ۱. انتخاب موضوع مشاوره تخصصی:
                    </label>
                    <div className="grid grid-cols-1 gap-2.5">
                      {consultationConfig.topics.map(topic => {
                        const isSelected = activeConsultTopic?.id === topic.id;
                        return (
                          <div
                            key={topic.id}
                            onClick={() => setConsultSelectedTopicId(topic.id)}
                            className={`p-4 rounded-2xl border-2 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isSelected
                                ? 'border-amber-500 bg-amber-50/40 shadow-xs'
                                : 'border-stone-200/80 bg-white hover:border-amber-300'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                                  isSelected ? 'border-amber-600 bg-amber-500 text-white' : 'border-stone-300'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div>
                                <div className="text-xs sm:text-sm font-black text-stone-900">{topic.title}</div>
                                {topic.description && (
                                  <div className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                                    {topic.description}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1.5 pr-8 sm:pr-0 shrink-0">
                              <span className="text-xs sm:text-sm font-black text-amber-700 bg-amber-100/80 px-3 py-1 rounded-xl">
                                {topic.price > 0 ? `${formatPrice(topic.price)} تومان` : 'رایگان'}
                              </span>
                              <span className="text-[10px] text-stone-400 font-bold flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>مدت: {topic.durationMinutes || 30} دقیقه</span>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* STEP 2: SELECT DATE & TIME SLOT */}
                  <div className="space-y-4 pt-4 border-t border-stone-100">
                    <label className="block text-xs sm:text-sm font-black text-stone-900">
                      ۲. انتخاب روز و زمان دلخواه مشاوره:
                    </label>

                    <div className="space-y-2">
                      <span className="text-xs font-bold text-stone-600 block">انتخاب روز مشاوره:</span>
                      <div className="flex flex-wrap gap-2">
                        {['امروز', 'فردا', 'پس‌فردا', 'پنج‌شنبه این هفته', 'شنبه آینده'].map(dayLabel => (
                          <button
                            key={dayLabel}
                            type="button"
                            onClick={() => setConsultPreferredDate(dayLabel)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                              consultPreferredDate === dayLabel
                                ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                                : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                            }`}
                          >
                            {dayLabel}
                          </button>
                        ))}
                        <input
                          type="text"
                          value={consultPreferredDate}
                          onChange={e => setConsultPreferredDate(e.target.value)}
                          placeholder="یا تاریخ دلخواه (مثلاً ۱۴۰۳/۰۷/۲۰)..."
                          className="flex-1 min-w-[180px] px-3.5 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-800 focus:ring-2 focus:ring-amber-400/20"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-bold text-stone-600 block">انتخاب بازه ساعتی تماس کارشناس:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {consultationConfig.timeSlots.map(slot => {
                          const isSlotSelected = activeConsultTimeSlot === slot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setConsultPreferredTimeSlot(slot)}
                              className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                                isSlotSelected
                                  ? 'border-amber-500 bg-amber-50 text-amber-950 shadow-xs'
                                  : 'border-stone-200 bg-stone-50/60 text-stone-700 hover:bg-stone-100'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Clock className={`w-4 h-4 ${isSlotSelected ? 'text-amber-600' : 'text-stone-400'}`} />
                                <span>{slot}</span>
                              </div>
                              {isSlotSelected && <Check className="w-4 h-4 text-amber-600" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* STEP 3: SELECT SOCIAL MEDIA PLATFORM FOR COMMUNICATION */}
                  <div className="space-y-4 pt-4 border-t border-stone-100">
                    <div>
                      <label className="block text-xs sm:text-sm font-black text-stone-900">
                        ۳. انتخاب شبکه اجتماعی یا پیام‌رسان جهت ارتباط کارشناس با شما:
                      </label>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        مشخص نمایید در زمان تعیین‌شده، کارشناس از طریق کدام پیام‌رسان یا شبکه اجتماعی با شما ارتباط بگیرد.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {consultationConfig.socialPlatforms.map(social => {
                        const isSocialSelected = activeConsultSocial?.id === social.id;
                        return (
                          <button
                            key={social.id}
                            type="button"
                            onClick={() => setConsultSelectedSocialId(social.id)}
                            className={`p-3 rounded-2xl border-2 text-xs font-black flex items-center justify-between gap-2 transition cursor-pointer ${
                              isSocialSelected
                                ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 shadow-xs'
                                : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                            }`}
                          >
                            <span className="truncate">{social.name}</span>
                            {isSocialSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-4 space-y-2">
                      <label className="block text-xs font-black text-emerald-950">
                        آیدی یا شماره اکانت شما در «{activeConsultSocial?.name}»:
                      </label>
                      <input
                        type="text"
                        required
                        value={consultSocialContactId}
                        onChange={e => setConsultSocialContactId(e.target.value)}
                        placeholder={
                          activeConsultSocial?.placeholder ||
                          'آیدی (مثلاً @username) یا شماره موبایل متصل به این پیام‌رسان را وارد کنید...'
                        }
                        className="w-full px-4 py-2.5 rounded-xl border border-emerald-300 bg-white text-xs font-mono font-bold text-stone-900 focus:ring-2 focus:ring-emerald-500/20"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {/* STEP 4: CUSTOMER INFO & QUESTION */}
                  <div className="space-y-4 pt-4 border-t border-stone-100">
                    <label className="block text-xs sm:text-sm font-black text-stone-900">
                      ۴. مشخصات فردی و شرح موضوع مشاوره:
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1.5">
                          نام و نام خانوادگی
                        </label>
                        <input
                          type="text"
                          required
                          value={consultName}
                          onChange={e => setConsultName(e.target.value)}
                          placeholder="مثال: علی احمدی"
                          className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-xs focus:ring-2 focus:ring-amber-400/20"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1.5">
                          شماره موبایل (جهت صدور فاکتور و کد رهگیری)
                        </label>
                        <input
                          type="tel"
                          required
                          value={consultPhone}
                          onChange={e => setConsultPhone(e.target.value)}
                          placeholder="09123456789"
                          className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-xs focus:ring-2 focus:ring-amber-400/20 font-mono text-left"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">
                        شرح پرسش، علائم یا هدف درمانی شما (اختیاری)
                      </label>
                      <textarea
                        rows={3}
                        value={consultQuestion}
                        onChange={e => setConsultQuestion(e.target.value)}
                        placeholder="اگر توضیح یا سوال خاصی پیش از جلسه مشاوره دارید، اینجا بنویسید..."
                        className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-xs focus:ring-2 focus:ring-amber-400/20 leading-relaxed font-sans"
                      />
                    </div>
                  </div>

                  {/* STEP 5: SUMMARY INVOICE BOX & PAYMENT / CART ACTIONS */}
                  <div className="bg-stone-900 text-white rounded-3xl p-5 sm:p-6 space-y-4 shadow-lg">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-800">
                      <div className="text-xs sm:text-sm font-black text-amber-400 flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        <span>خلاصه رزرو و صورتحساب جلسه مشاوره</span>
                      </div>
                      <span className="text-xs font-mono bg-white/10 px-3 py-1 rounded-full text-stone-200">
                        مدت جلسه: {activeConsultTopic?.durationMinutes || 30} دقیقه
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                        <span className="text-stone-400 block text-[11px] mb-0.5">موضوع انتخاب‌شده:</span>
                        <span className="font-bold text-white">{activeConsultTopic?.title}</span>
                      </div>
                      <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                        <span className="text-stone-400 block text-[11px] mb-0.5">زمان و شبکه اجتماعی ارتباط:</span>
                        <span className="font-bold text-emerald-400">
                          {consultPreferredDate || 'فردا'} | {activeConsultTimeSlot} ({activeConsultSocial?.name})
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      <span className="text-xs sm:text-sm text-stone-300 font-bold">مبلغ قابل پرداخت مشاوره:</span>
                      <span className="text-lg sm:text-2xl font-black text-amber-400">
                        {activeConsultPrice > 0 ? `${formatPrice(activeConsultPrice)} تومان` : 'رایگان'}
                      </span>
                    </div>

                    {consultBookingError && (
                      <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-200 text-xs font-bold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{consultBookingError}</span>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={isSubmittingConsult}
                        className="flex-1 py-3.5 px-5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-2xl text-xs sm:text-sm font-black shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <CreditCard className="w-4 h-4 shrink-0" />
                        <span>
                          {isSubmittingConsult
                            ? 'در حال صدور فاکتور مشاوره...'
                            : activeConsultPrice > 0
                            ? 'ثبت رزرو و ادامه جهت پرداخت فاکتور'
                            : 'ثبت نهایی درخواست مشاوره رایگان'}
                        </span>
                      </button>

                      {consultationConfig.allowAddToCart && activeConsultPrice > 0 && (
                        <button
                          type="button"
                          onClick={handleAddConsultationToCart}
                          className="py-3.5 px-5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
                        >
                          <ShoppingBag className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>افزودن به سبد خرید</span>
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ================= PAGE 4: TRACKING ================= */}
        {activePage === 'tracking' && (
          <div className="max-w-2xl mx-auto space-y-5 sm:space-y-6 animate-fadeIn">
            <div className="text-center mb-4 sm:mb-6 px-1">
              <h1 className="text-xl sm:text-3xl font-black text-stone-900 leading-snug">
                پیگیری وضعیت سفارش و پیام مشاوره
              </h1>
              <p className="text-xs text-stone-500 mt-2 leading-relaxed">
                کد رهگیری فاکتور خرید (مانند ONV-ORD-101) یا کد رهگیری پیام مشاوره (مانند ONV-9421) را وارد نمایید.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-4 sm:p-8 shadow-sm border border-stone-100 overflow-hidden">
              <form onSubmit={handleTrackingSearch} className="flex flex-col sm:flex-row gap-2.5">
                <input 
                  type="text" 
                  required
                  placeholder="مثلاً: ONV-ORD-101"
                  value={trackingCodeInput}
                  onChange={e => setTrackingCodeInput(e.target.value)}
                  className="w-full sm:flex-1 min-w-0 px-4 py-3.5 sm:py-3 rounded-xl border border-stone-200 text-xs font-mono font-bold tracking-wider uppercase text-center sm:text-right focus:ring-2 focus:ring-amber-400/20"
                  dir="ltr"
                />
                <button
                  type="submit"
                  disabled={isSearchingTracking}
                  className="w-full sm:w-auto px-6 py-3.5 sm:py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                >
                  <Search className="w-4 h-4 shrink-0" />
                  <span>{isSearchingTracking ? 'در حال جستجو...' : 'استعلام وضعیت'}</span>
                </button>
              </form>

              {trackingSearched && (
                <div className="mt-6 pt-6 border-t border-stone-100">
                  {trackingResult ? (
                    trackingResult.type === 'order' ? (
                      /* Live Order Status & Stepper Tracker */
                      <div className="space-y-5 sm:space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
                          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 shrink-0" />
                            <span>سفارش فروشگاه اونیوال</span>
                          </span>
                          <span className="text-xs text-stone-500 font-mono font-bold break-all">
                            {trackingResult.data.trackingCode}
                          </span>
                        </div>

                        {/* Interactive Visual Order Timeline Stepper */}
                        <div className="bg-stone-50 p-3.5 sm:p-5 rounded-2xl border border-stone-200/80">
                          <div className="text-xs font-black text-stone-800 mb-4">
                            مراحل پردازش و ارسال مرسوله:
                          </div>
                          
                          <div className="space-y-4">
                            {/* Step 1: Invoice created */}
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                                <Check className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-stone-900">۱. صدور فاکتور اولیه</div>
                                <div className="text-[11px] text-stone-500 leading-relaxed">فاکتور ثبت شد و کد رهگیری اختصاص یافت.</div>
                              </div>
                            </div>

                            {/* Step 2: Payment & Receipt Verification Status */}
                            <div className="flex items-start gap-3">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 ${
                                trackingResult.data.paymentStatus === 'Paid'
                                  ? 'bg-emerald-500 text-white'
                                  : trackingResult.data.paymentStatus === 'PendingVerification'
                                  ? 'bg-blue-600 text-white animate-pulse'
                                  : trackingResult.data.paymentStatus === 'Failed'
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-amber-500 text-white animate-pulse'
                              }`}>
                                {trackingResult.data.paymentStatus === 'Paid' ? <Check className="w-3.5 h-3.5" /> : '۲'}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-stone-900 flex flex-wrap items-center justify-between gap-1.5">
                                  <span>۲. وضعیت پرداخت و تأیید مالی فاکتور</span>
                                  <span className={`text-[10px] px-2.5 py-0.5 rounded-md font-bold ${
                                    trackingResult.data.paymentStatus === 'Paid'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : trackingResult.data.paymentStatus === 'PendingVerification'
                                      ? 'bg-blue-100 text-blue-800'
                                      : trackingResult.data.paymentStatus === 'Failed'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {trackingResult.data.paymentStatus === 'Paid'
                                      ? 'پرداخت تایید شده'
                                      : trackingResult.data.paymentStatus === 'PendingVerification'
                                      ? 'فیش واریزی در انتظار تایید مدیر'
                                      : trackingResult.data.paymentStatus === 'Failed'
                                      ? 'فیش رد شده (نیاز به ارسال مجدد)'
                                      : 'در انتظار پرداخت'}
                                  </span>
                                </div>

                                <div className="text-[11px] text-stone-600 mt-1 leading-relaxed">
                                  {trackingResult.data.paymentStatus === 'Paid' ? (
                                    <span className="text-emerald-700 font-bold">
                                      واریزی فاکتور شماره {trackingResult.data.trackingCode} توسط مدیریت تایید شد و سفارش وارد مرحله آماده‌سازی انبار گردید.
                                    </span>
                                  ) : trackingResult.data.paymentStatus === 'PendingVerification' ? (
                                    <span>
                                      تصویر فیش واریزی شما به همراه شماره فاکتور <strong>{trackingResult.data.trackingCode}</strong> ثبت شده و در صف بررسی مدیریت سفارشات قرار دارد. به محض تایید مدیر، وضعیت سفارش شما به «آماده‌سازی در انبار» تغییر خواهد یافت.
                                    </span>
                                  ) : trackingResult.data.paymentStatus === 'Failed' ? (
                                    <span className="text-rose-600 font-bold">
                                      فیش ارسالی قبلی مورد تایید قرار نگرفت. {trackingResult.data.receiptAdminNote ? `توضیح مدیر: «${trackingResult.data.receiptAdminNote}»` : 'لطفاً تصویر واضح فیش واریزی را مجدداً بارگذاری نمایید.'}
                                    </span>
                                  ) : (
                                    <span>مبلغ این فاکتور هنوز تسویه نشده است. می‌توانید فیش کارت‌به‌کارت را ارسال کنید یا از روش‌های فعال پرداخت نمایید.</span>
                                  )}
                                </div>

                                {/* Show uploaded receipt thumbnail if present */}
                                {trackingResult.data.receiptImage && (
                                  <div className="mt-3 p-3 rounded-xl bg-white border border-stone-200 flex items-center gap-3">
                                    <img
                                      src={trackingResult.data.receiptImage}
                                      alt="Receipt"
                                      className="w-14 h-14 object-cover rounded-lg border border-stone-200 shrink-0"
                                    />
                                    <div className="min-w-0 flex-1 text-[11px] space-y-0.5">
                                      <div className="font-bold text-stone-800 truncate">
                                        فیش پیوست‌شده به فاکتور {trackingResult.data.trackingCode}
                                      </div>
                                      {trackingResult.data.receiptUploadedAt && (
                                        <div className="text-stone-400">زمان ارسال: {trackingResult.data.receiptUploadedAt}</div>
                                      )}
                                      {trackingResult.data.receiptNote && (
                                        <div className="text-stone-600 truncate">توضیح: {trackingResult.data.receiptNote}</div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* If not Paid, allow customer to pay or upload receipt right from Tracking Page */}
                                {trackingResult.data.paymentStatus !== 'Paid' && (
                                  <div className="mt-3 space-y-2.5">
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCurrentInvoice(trackingResult.data);
                                          setActivePage('checkout');
                                          window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
                                        }}
                                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold transition cursor-pointer shadow-xs"
                                      >
                                        <CreditCard className="w-3.5 h-3.5 shrink-0" />
                                        <span>
                                          {trackingResult.data.paymentStatus === 'PendingVerification'
                                            ? 'مشاهده فاکتور / ویرایش فیش واریزی'
                                            : 'مشاهده صفحه پرداخت و ارسال فیش واریزی'}
                                        </span>
                                      </button>

                                      {paymentConfig.baleBotEnabled && (
                                        <a
                                          href={trackingResult.data.balePaymentUrl || `https://ble.ir/${(paymentConfig.baleBotUsername || 'Onivalbot').replace(/^@/, '')}?start=pay_${trackingResult.data.trackingCode}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition"
                                        >
                                          <span>پرداخت در ربات بله</span>
                                          <ExternalLink className="w-3 h-3 shrink-0" />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Step 3: Processing in warehouse */}
                            <div className="flex items-start gap-3">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 ${
                                ['Processing', 'Shipped', 'Completed'].includes(trackingResult.data.status)
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-stone-200 text-stone-600'
                              }`}>
                                {['Shipped', 'Completed'].includes(trackingResult.data.status) ? <Check className="w-3.5 h-3.5" /> : '۳'}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-stone-900">۳. آماده‌سازی و بسته‌بندی در انبار مرکزی اونیوال</div>
                                <div className="text-[11px] text-stone-500 leading-relaxed">
                                  {['Processing', 'Shipped', 'Completed'].includes(trackingResult.data.status)
                                    ? 'مرسوله در واحد بسته‌بندی تخصصی اونیوال قرار دارد.'
                                    : 'پس از تایید پرداخت، انبارداری آغاز می‌شود.'}
                                </div>
                              </div>
                            </div>

                            {/* Step 4: Shipped */}
                            <div className="flex items-start gap-3">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 ${
                                ['Shipped', 'Completed'].includes(trackingResult.data.status)
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-stone-200 text-stone-600'
                              }`}>
                                {trackingResult.data.status === 'Completed' ? <Check className="w-3.5 h-3.5" /> : '۴'}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-stone-900">۴. تحویل به اداره پست / پیک و ارسال</div>
                                <div className="text-[11px] text-stone-500 leading-relaxed">
                                  {['Shipped', 'Completed'].includes(trackingResult.data.status)
                                    ? 'بسته تحویل مامور پست شده و در مسیر مقصد می‌باشد.'
                                    : 'در نوبت ارسال قرار می‌گیرد.'}
                                </div>
                              </div>
                            </div>

                            {/* Step 5: Completed */}
                            <div className="flex items-start gap-3">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 ${
                                trackingResult.data.status === 'Completed'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-stone-200 text-stone-600'
                              }`}>
                                ۵
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-stone-900">۵. تحویل نهایی به خریدار</div>
                                <div className="text-[11px] text-stone-500 leading-relaxed">
                                  {trackingResult.data.status === 'Completed'
                                    ? 'مرسوله با موفقیت به مشتری تحویل داده شد.'
                                    : 'در انتظار تحویل حضوری.'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Consultation Details & Specialist Response if this order is a consultation booking */}
                        {(trackingResult.data.isConsultation || trackingResult.data.consultationDetails) && (
                          <div className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200 space-y-3 text-xs">
                            <div className="font-black text-amber-950 flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-amber-600" />
                              <span>جزئیات نوبت مشاوره تخصصی شما:</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div className="bg-white p-2.5 rounded-xl border border-amber-100">
                                <span className="text-stone-400 block text-[10px]">موضوع مشاوره:</span>
                                <span className="font-bold text-stone-900">
                                  {trackingResult.data.consultationDetails?.topicTitle || 'مشاوره تخصصی سلامت'}
                                </span>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-amber-100">
                                <span className="text-stone-400 block text-[10px]">زمان انتخابی شما:</span>
                                <span className="font-bold text-blue-800">
                                  {trackingResult.data.consultationDetails?.preferredDate} | {trackingResult.data.consultationDetails?.preferredTimeSlot}
                                </span>
                              </div>
                              <div className="sm:col-span-2 bg-white p-2.5 rounded-xl border border-amber-100 flex flex-wrap justify-between gap-2">
                                <div>
                                  <span className="text-stone-400 block text-[10px]">شبکه اجتماعی انتخابی جهت تماس کارشناس:</span>
                                  <span className="font-bold text-emerald-800">
                                    {trackingResult.data.consultationDetails?.socialPlatform}
                                  </span>
                                </div>
                                <div className="text-left">
                                  <span className="text-stone-400 block text-[10px]">آیدی / شماره ثبت‌شده:</span>
                                  <span className="font-mono font-bold text-stone-900">
                                    {trackingResult.data.consultationDetails?.socialContactId}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {(trackingResult.data.adminResponse || trackingResult.data.consultationDetails?.adminResponse) ? (
                              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-1.5">
                                <div className="font-black text-emerald-900 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                  <span>پاسخ و توصیه کارشناس سلامت اونیوال:</span>
                                </div>
                                <p className="text-emerald-950 leading-relaxed whitespace-pre-line bg-white p-3 rounded-lg border border-emerald-100">
                                  {trackingResult.data.adminResponse || trackingResult.data.consultationDetails?.adminResponse}
                                </p>
                              </div>
                            ) : (
                              <div className="text-[11px] text-amber-800 font-medium">
                                پس از تایید پرداخت، کارشناس در زمان تعیین‌شده از طریق شبکه اجتماعی انتخابی با شما ارتباط گرفته و نتیجه مشاوره نیز در همین بخش درج خواهد شد.
                              </div>
                            )}
                          </div>
                        )}

                        {/* Order Meta details */}
                        <div className="bg-white rounded-2xl p-4 border border-stone-200 space-y-2.5 text-xs">
                          <div className="flex flex-wrap justify-between gap-1">
                            <span className="text-stone-500">تحویل‌گیرنده:</span>
                            <span className="font-bold text-stone-800">{trackingResult.data.userFullName}</span>
                          </div>
                          <div className="flex flex-wrap justify-between gap-1">
                            <span className="text-stone-500">شماره تماس:</span>
                            <span className="font-mono text-stone-800">{trackingResult.data.phoneNumber}</span>
                          </div>
                          <div className="flex flex-wrap justify-between gap-1">
                            <span className="text-stone-500">مبلغ کل فاکتور:</span>
                            <span className="font-extrabold text-stone-900">{formatPrice(trackingResult.data.totalPrice)} تومان</span>
                          </div>
                          <div className="pt-2 border-t border-stone-100 text-stone-500 leading-relaxed break-words">
                            <span>آدرس ثبت‌شده: </span>
                            <span className="text-stone-700">{trackingResult.data.userAddress}</span>
                          </div>
                        </div>

                        {/* Items preview */}
                        {trackingResult.data.items && trackingResult.data.items.length > 0 && (
                          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                            <div className="text-xs font-bold text-stone-700 mb-2">اقلام فاکتور:</div>
                            <div className="space-y-2">
                              {trackingResult.data.items.map((it: any, i: number) => (
                                <div key={i} className="flex flex-wrap justify-between gap-1 text-xs text-stone-600">
                                  <span className="font-medium">{it.productName} ({it.size || 'استاندارد'}) × {it.quantity}</span>
                                  <span className="font-bold text-stone-800">{formatPrice(it.totalPrice || it.unitPrice * it.quantity)} تومان</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Consultation Tracking Card */
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span>پیام مشاوره و پشتیبانی</span>
                          </span>
                          <span className="text-xs text-stone-400 font-mono font-bold break-all">
                            {trackingResult.data.trackingCode}
                          </span>
                        </div>

                        <div className="bg-stone-50 rounded-2xl p-4 text-xs space-y-2">
                          <div className="font-bold text-stone-800">متن پیام ارسالی شما:</div>
                          <p className="text-stone-600 leading-relaxed bg-white p-3 rounded-xl border border-stone-100">
                            {trackingResult.data.message}
                          </p>
                          <div className="text-[11px] text-stone-400 pt-1">
                            ثبت شده در: {trackingResult.data.creationTime}
                          </div>
                        </div>

                        {trackingResult.data.adminResponse ? (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs space-y-2">
                            <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>پاسخ متخصص سلامت اونیوال:</span>
                            </div>
                            <p className="text-emerald-950 leading-relaxed bg-white/80 p-3 rounded-xl">
                              {trackingResult.data.adminResponse}
                            </p>
                          </div>
                        ) : (
                          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 text-xs flex items-center gap-2">
                            <Clock className="w-4 h-4 shrink-0 text-amber-600" />
                            <span>پیام شما در صف بررسی کارشناس قرار دارد و تا ساعاتی دیگر پاسخ آن ثبت می‌گردد.</span>
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    <div className="text-center py-6 text-xs text-rose-600 font-bold">
                      هیچ سفارش یا پیامی با این کد رهگیری یافت نشد. لطفاً کد را مجدداً بررسی فرمایید.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= PAGE 5: ABOUT US ================= */}
        {activePage === 'about' && (
          <div className="max-w-2xl mx-auto bg-white rounded-3xl p-8 shadow-xs border border-stone-100 space-y-4 animate-fadeIn">
            <h1 className="text-2xl font-black text-stone-900 mb-2">
              {siteContent?.pages?.about?.title || `درباره فروشگاه ${brandName} (${brandEnglishName})`}
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed whitespace-pre-line">
              {siteContent?.pages?.about?.content ||
                `مجموعه تخصصی ${brandName} با همکاری مستقیم زنبورداران محلی و کشاورزان متعهد سبلان و البرز، محصولات کاملاً سالم، ارگانیک و حرارت‌ندیده را بدون واسطه به دست خانواده‌های ایرانی می‌رساند.`}
            </p>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-stone-100 text-center">
              <div className="p-4 rounded-2xl bg-stone-50">
                <span className="text-xl font-black text-[#4CAF50] block">۱۰۰٪</span>
                <span className="text-xs text-stone-500">طبیعی، خام و آزمایش‌شده</span>
              </div>
              <div className="p-4 rounded-2xl bg-stone-50">
                <span className="text-xl font-black text-amber-500 block">۷ روز</span>
                <span className="text-xs text-stone-500">ضمانت اصالت و بازگشت وجه</span>
              </div>
            </div>
          </div>
        )}

        {/* ================= PAGE 6: CONTACT US ================= */}
        {activePage === 'contact' && (
          <div className="max-w-2xl mx-auto bg-white rounded-3xl p-8 shadow-xs border border-stone-100 space-y-5 animate-fadeIn">
            <div>
              <h1 className="text-2xl font-black text-stone-900 mb-2">
                {siteContent?.contactTitle || siteContent?.pages?.contact?.title || 'تماس با ما و ارتباط با پشتیبانی'}
              </h1>
              <p className="text-xs text-stone-600 leading-relaxed">
                {siteContent?.contactSubtitle || siteContent?.pages?.contact?.subtitle || `جهت پیگیری سفارشات، هماهنگی خرید عمده و ارتباط مستقیم با پشتیبانی ${brandName}:`}
              </p>
            </div>

            <div className="space-y-3 text-xs text-stone-700">
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-stone-50 border border-stone-100">
                <Phone className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <span className="text-stone-400 block text-[11px] mb-0.5">تلفن مرکز تماس و پشتیبانی:</span>
                  <span className="font-bold text-stone-800">
                    {siteContent?.contactPhone || siteContent?.pages?.contact?.phone || '۰۲۱-۱۲۳۴۵۶۷۸ / ۰۹۱۲۳۴۵۶۷۸۹'}
                  </span>
                </div>
              </div>

              {(siteContent?.contactWorkingHours || siteContent?.supportHours) && (
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-stone-50 border border-stone-100">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="text-stone-400 block text-[11px] mb-0.5">ساعات پاسخگویی:</span>
                    <span className="font-bold text-stone-800">
                      {siteContent?.contactWorkingHours || siteContent?.supportHours}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-stone-50 border border-stone-100">
                <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <span className="text-stone-400 block text-[11px] mb-0.5">نشانی دفتر مرکزی:</span>
                  <span className="font-bold text-stone-800">
                    {siteContent?.contactAddress || siteContent?.pages?.contact?.address || `تهران، مجموعه تخصصی فرآورده‌های ارگانیک ${brandName} (${brandEnglishName})`}
                  </span>
                </div>
              </div>

              {/* Direct Support Messengers Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <a
                  href={`https://ble.ir/${(siteContent?.contactBaleId || siteContent?.paymentConfig?.baleBotUsername || 'Onivalbot').replace(/^@/, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 hover:bg-emerald-100/70 transition"
                >
                  <div>
                    <div className="text-[11px] text-emerald-700 font-bold">پشتیبانی و ربات بله</div>
                    <div className="font-mono font-black text-xs mt-0.5" dir="ltr">
                      @{(siteContent?.contactBaleId || siteContent?.paymentConfig?.baleBotUsername || 'Onivalbot').replace(/^@/, '')}
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-emerald-600 shrink-0" />
                </a>

                <a
                  href={`https://t.me/${(siteContent?.contactTelegramId || 'onival_support').replace(/^@/, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-sky-950 hover:bg-sky-100/70 transition"
                >
                  <div>
                    <div className="text-[11px] text-sky-700 font-bold">پشتیبانی مستقیم تلگرام</div>
                    <div className="font-mono font-black text-xs mt-0.5" dir="ltr">
                      @{(siteContent?.contactTelegramId || 'onival_support').replace(/^@/, '')}
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-sky-600 shrink-0" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ================= PAGE 6.1: TERMS & CONDITIONS ================= */}
        {activePage === 'terms' && (
          <div className="max-w-3xl mx-auto bg-white rounded-3xl p-6 sm:p-10 shadow-xs border border-stone-100 space-y-6 animate-fadeIn">
            <div className="border-b border-stone-100 pb-4">
              <div className="flex items-center gap-2 text-xs text-amber-700 font-bold mb-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <span>الزامات قانونی و شفافیت خرید اینترنتی</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-stone-900">
                {siteContent?.termsTitle || `قوانین، مقررات و رویه خرید از فروشگاه ${brandName}`}
              </h1>
            </div>

            <div className="text-xs sm:text-sm text-stone-700 leading-relaxed space-y-4 whitespace-pre-line font-sans">
              {siteContent?.termsContent || `۱. شرایط عمومی خرید:
ثبت سفارش در فروشگاه تخصصی ${brandName} در تمامی ساعات شبانه‌روز و ۷ روز هفته امکان‌پذیر است. سفارشات در اولین روز کاری پردازش و وارد نوبت آماده‌سازی می‌شوند.

۲. اصالت کالا و برگه آزمایشگاهی:
تمامی عسل‌ها و فرآورده‌های کندو همراه با برگه آزمایش تخصصی (ساکارز طبیعی، هیدروکسی متیل فورفورال مجاز و پرولین و دیاستاز استاندارد) ارسال می‌گردند.

۳. امنیت پرداخت و صدور فاکتور:
کلیه سفارشات دارای فاکتور رسمی سیستمی با کد رهگیری اختصاصی بوده و پرداخت از طریق درگاه‌های امن بانکی، کارت به کارت یا ربات رسمی بله صورت می‌گیرد.

۴. حریم خصوصی و امنیت اطلاعات خریداران:
اطلاعات شخصی، شماره تماس و نشانی پستی خریداران محترم صرفاً جهت تحویل کالا و اطلاع‌رسانی پیامکی استفاده شده و نزد فروشگاه محفوظ است.`}
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-stone-600">سوالی در خصوص شرایط و قوانین خرید دارید؟</span>
              <button
                type="button"
                onClick={() => handleSelectPage('contact')}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-bold transition cursor-pointer"
              >
                ارتباط با پشتیبانی
              </button>
            </div>
          </div>
        )}

        {/* ================= PAGE 6.2: REFUND POLICY ================= */}
        {activePage === 'refund' && (
          <div className="max-w-3xl mx-auto bg-white rounded-3xl p-6 sm:p-10 shadow-xs border border-stone-100 space-y-6 animate-fadeIn">
            <div className="border-b border-stone-100 pb-4">
              <div className="flex items-center gap-2 text-xs text-emerald-700 font-bold mb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>ضمانت اصالت، سلامت و حقوق مصرف‌کننده</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-stone-900">
                {siteContent?.refundTitle || `شرایط بازگشت کالا و رویه مرجوعی ۷ روزه ${brandName}`}
              </h1>
            </div>

            <div className="text-xs sm:text-sm text-stone-700 leading-relaxed space-y-4 whitespace-pre-line font-sans">
              {siteContent?.refundContent || `۱. ضمانت بازگشت ۷ روزه وجه:
خریدار محترم حق دارد تا ۷ روز پس از تحویل مرسوله پستی، در صورت هرگونه عدم رضایت از اصالت عسل یا عدم انطباق با برگه آزمایش، کالا را مرجوع نماید.

۲. تضمین سلامت فیزیکی حین ارسال:
ظروف شیشه‌ای با ضربه‌گیرهای چندلایه حباب‌دار و کارتن‌های مقاوم پستی بسته‌بندی می‌شوند. در صورت بروز هرگونه شکستگی یا آسیب‌دیدگی در حین حمل‌ونقل توسط شرکت پست، محصول فوراً و به صورت کاملاً رایگان مجدداً ارسال می‌گردد.

۳. فرآیند عودت وجه:
پس از دریافت کالای مرجوعی توسط انبار، کارشناسان ما بسته را بررسی نموده و مبلغ پرداختی ظرف حداکثر ۲۴ الی ۴۸ ساعت کاری به شماره شبا یا شماره کارت خریدار مسترد می‌گردد.`}
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-emerald-950 font-bold">جهت ثبت درخواست مرجوعی یا پیگیری ضمانت، با واحد امور مشتریان در تماس باشید.</span>
              <button
                type="button"
                onClick={() => handleSelectPage('contact')}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold transition cursor-pointer"
              >
                ثبت پیام مرجوعی
              </button>
            </div>
          </div>
        )}

        {/* ================= PAGE 7: CHECKOUT & INVOICE FLOW ================= */}
        {activePage === 'checkout' && (
          <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
            {/* If an official invoice has been issued, show the Invoice & Bale Bot Payment Screen */}
            {currentInvoice ? (
              <div className="bg-white rounded-[30px] p-6 sm:p-10 shadow-lg border border-amber-200/80 space-y-6">
                {/* Invoice Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-stone-100 gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black">
                      <Hexagon className="w-6 h-6 stroke-[2]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-stone-900">
                        فاکتور رسمی سفارش فروشگاه اونیوال
                      </h2>
                      <div className="text-xs text-stone-400 font-mono font-bold">
                        ONIVAL Official Invoice
                      </div>
                    </div>
                  </div>

                  <div className="text-left sm:text-right bg-stone-50 px-4 py-2 rounded-xl border border-stone-200">
                    <div className="text-[11px] text-stone-400">کد رهگیری فاکتور:</div>
                    <div className="text-base font-mono font-black text-stone-900 tracking-wider">
                      {currentInvoice.trackingCode}
                    </div>
                  </div>
                </div>

                  {/* Recipient / Consultation Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-stone-50 p-4 rounded-2xl text-xs">
                    <div>
                      <span className="text-stone-400 block mb-0.5">
                        {currentInvoice.isConsultation ? 'نام متقاضی مشاوره:' : 'نام تحویل‌گیرنده:'}
                      </span>
                      <span className="font-bold text-stone-800">{currentInvoice.userFullName}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 block mb-0.5">شماره تماس:</span>
                      <span className="font-mono font-bold text-stone-800">{currentInvoice.phoneNumber}</span>
                    </div>
                    {currentInvoice.consultationDetails ? (
                      <>
                        <div className="pt-2 border-t border-stone-200/60">
                          <span className="text-stone-400 block mb-0.5">زمان انتخابی مشاوره:</span>
                          <span className="font-bold text-amber-800">
                            {currentInvoice.consultationDetails.preferredDate} | {currentInvoice.consultationDetails.preferredTimeSlot}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-stone-200/60">
                          <span className="text-stone-400 block mb-0.5">شبکه اجتماعی ارتباط با کارشناس:</span>
                          <span className="font-bold text-emerald-800">
                            {currentInvoice.consultationDetails.socialPlatform} ({currentInvoice.consultationDetails.socialContactId})
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="sm:col-span-2 pt-2 border-t border-stone-200/60">
                        <span className="text-stone-400 block mb-0.5">آدرس پستی تحویل / مشخصات:</span>
                        <span className="font-medium text-stone-800">{currentInvoice.userAddress}</span>
                      </div>
                    )}
                  </div>

                {/* Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead>
                      <tr className="border-b-2 border-stone-100 text-stone-500">
                        <th className="pb-3 px-2">#</th>
                        <th className="pb-3 px-2">شرح کالا</th>
                        <th className="pb-3 px-2 text-center">اندازه / وزن</th>
                        <th className="pb-3 px-2 text-center">تعداد</th>
                        <th className="pb-3 px-2">فی (تومان)</th>
                        <th className="pb-3 px-2">جمع (تومان)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {(currentInvoice.items || []).map((it, idx) => (
                        <tr key={idx}>
                          <td className="py-3 px-2 text-stone-400">{idx + 1}</td>
                          <td className="py-3 px-2 font-bold text-stone-800">{it.productName}</td>
                          <td className="py-3 px-2 text-center text-stone-600 bg-stone-50/50 rounded">
                            {it.size || 'استاندارد'}
                          </td>
                          <td className="py-3 px-2 text-center font-bold">{it.quantity}</td>
                          <td className="py-3 px-2">{formatPrice(it.unitPrice)}</td>
                          <td className="py-3 px-2 font-bold text-stone-900">{formatPrice(it.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Total box */}
                <div className="flex flex-wrap justify-between items-center gap-2 bg-[#fffbeb] p-4 sm:p-5 rounded-2xl font-bold text-sm sm:text-base text-[#d97706] border border-dashed border-[#f59e0b]">
                  <span>مبلغ کل قابل پرداخت:</span>
                  <span className="text-lg sm:text-xl font-black">{formatPrice(currentInvoice.totalPrice)} تومان</span>
                </div>

                {/* ================= CONFIGURABLE 3-MODE PAYMENT SYSTEM ================= */}
                {currentInvoice.paymentStatus === 'Paid' ? (
                  /* Paid Confirmation Banner */
                  <div className="bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-5 sm:p-7 space-y-4 shadow-sm animate-fadeIn">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="text-sm font-black text-emerald-900 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span>پرداخت فاکتور با موفقیت تأیید شد!</span>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-mono font-bold">
                        شماره فاکتور: {currentInvoice.trackingCode}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      سفارش شما به صورت خودکار تایید و وارد مرحله <strong>«آماده‌سازی و بسته‌بندی در انبار مرکزی اونیوال»</strong> شد. همچنین نوتیفیکیشن ثبت این سفارش برای ادمین ارسال گردید.
                    </p>

                    <div className="bg-white/90 p-4 rounded-2xl border border-emerald-200 space-y-2.5">
                      <div className="text-xs font-bold text-stone-700 flex items-center justify-between flex-wrap gap-2">
                        <span>لینک صفحه اختصاصی پیگیری سفارش شما:</span>
                        <span className="font-mono text-emerald-700 text-[11px] font-bold">/track-order?code={currentInvoice.trackingCode}</span>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          readOnly
                          value={`${typeof window !== 'undefined' ? window.location.origin : ''}/track-order?code=${currentInvoice.trackingCode}`}
                          className="flex-1 px-3 py-2 bg-stone-50 border border-emerald-200 rounded-xl text-xs font-mono text-stone-700 text-left"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/track-order?code=${currentInvoice.trackingCode}`;
                            navigator.clipboard?.writeText(url);
                            setCopiedTrackingLink(true);
                            setTimeout(() => setCopiedTrackingLink(false), 2500);
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                        >
                          {copiedTrackingLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedTrackingLink ? 'لینک کپی شد' : 'کپی لینک پیگیری'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActivePage('tracking');
                            executeTrackingSearch(currentInvoice.trackingCode);
                            window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
                          }}
                          className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>ورود به صفحه پیگیری سفارش</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Payment Method Selector Tabs (shown when more than 1 method is enabled in admin panel) */}
                    {([paymentConfig.cardToCardEnabled, paymentConfig.baleBotEnabled, paymentConfig.gatewayEnabled].filter(Boolean).length > 1) && (
                      <div className="bg-stone-100 p-1.5 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                        {paymentConfig.cardToCardEnabled && (
                          <button
                            type="button"
                            onClick={() => setSelectedPaymentTab('card_to_card')}
                            className={`py-3 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
                              selectedPaymentTab === 'card_to_card'
                                ? 'bg-white text-amber-700 shadow-sm border border-amber-200'
                                : 'text-stone-600 hover:text-stone-900'
                            }`}
                          >
                            <CreditCard className="w-4 h-4 shrink-0" />
                            <span>کارت به کارت و آپلود فیش</span>
                          </button>
                        )}
                        {paymentConfig.baleBotEnabled && (
                          <button
                            type="button"
                            onClick={() => setSelectedPaymentTab('bale_bot')}
                            className={`py-3 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
                              selectedPaymentTab === 'bale_bot'
                                ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200'
                                : 'text-stone-600 hover:text-stone-900'
                            }`}
                          >
                            <Send className="w-4 h-4 shrink-0" />
                            <span>پرداخت در ربات بله</span>
                          </button>
                        )}
                        {paymentConfig.gatewayEnabled && (
                          <button
                            type="button"
                            onClick={() => setSelectedPaymentTab('gateway')}
                            className={`py-3 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
                              selectedPaymentTab === 'gateway'
                                ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                                : 'text-stone-600 hover:text-stone-900'
                            }`}
                          >
                            <Globe className="w-4 h-4 shrink-0" />
                            <span>درگاه پرداخت اینترنتی</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* ==================== MODE 1: CARD-TO-CARD & RECEIPT UPLOAD ==================== */}
                    {selectedPaymentTab === 'card_to_card' && (
                      <div className="space-y-4 animate-fadeIn">
                        {/* Polite Gateway Offline Reassurance Box above Card Number */}
                        <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 sm:p-5 flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                            <HeartHandshake className="w-5 h-5" />
                          </div>
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="text-xs font-black text-amber-950 flex flex-wrap items-center gap-1.5">
                              <span>اطلاعیه راهنمای پرداخت امن (اختلال موقت درگاه مستقیم بانکی)</span>
                            </div>
                            <p className="text-xs text-amber-900/90 leading-relaxed whitespace-pre-line">
                              {paymentConfig.gatewayOfflineNotice}
                            </p>
                          </div>
                        </div>

                        {/* Bank Card Box */}
                        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 text-white p-5 sm:p-7 shadow-lg border border-stone-700">
                          <div className="absolute -top-12 -left-12 w-40 h-40 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />
                          <div className="absolute -bottom-12 -right-12 w-40 h-40 rounded-full bg-amber-400/10 blur-2xl pointer-events-none" />

                          <div className="relative z-10 space-y-5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-amber-400 shrink-0" />
                                <span className="text-xs sm:text-sm font-black text-amber-400">
                                  {paymentConfig.bankName || 'شماره کارت رسمی جهت واریز کارت به کارت'}
                                </span>
                              </div>
                              <span className="text-[11px] bg-white/10 px-3 py-1 rounded-full font-mono text-stone-200">
                                شماره فاکتور: {currentInvoice.trackingCode}
                              </span>
                            </div>

                            {/* Card Number Display + Copy Button */}
                            <div className="bg-black/30 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                              <div
                                className="text-lg sm:text-2xl font-mono font-black tracking-widest text-white select-all text-center sm:text-left"
                                dir="ltr"
                              >
                                {paymentConfig.cardNumber}
                              </div>
                              <button
                                type="button"
                                onClick={handleCopyCardNumber}
                                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
                              >
                                {copiedCard ? (
                                  <>
                                    <Check className="w-4 h-4" />
                                    <span>شماره کارت کپی شد</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4" />
                                    <span>کپی شماره کارت</span>
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Cardholder Name & Payable Amount */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                                <span className="text-stone-400 block mb-1 text-[11px]">به نام صاحب حساب:</span>
                                <span className="font-bold text-white text-xs sm:text-sm">
                                  {paymentConfig.cardHolderName}
                                </span>
                              </div>
                              <div className="bg-amber-500/15 rounded-xl p-3 border border-amber-400/30">
                                <span className="text-amber-300 block mb-1 text-[11px]">مبلغ دقیق قابل واریز:</span>
                                <span className="font-black text-amber-400 text-sm sm:text-base">
                                  {formatPrice(currentInvoice.totalPrice)} تومان
                                </span>
                              </div>
                            </div>

                            {/* Admin Custom Description */}
                            {paymentConfig.cardDescription && (
                              <div className="text-xs text-stone-300 leading-relaxed bg-white/5 p-3.5 rounded-xl border border-white/10 whitespace-pre-line">
                                {paymentConfig.cardDescription}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Receipt Upload & Verification Box */}
                        <div className="bg-stone-50 rounded-3xl p-5 sm:p-6 border border-stone-200/90 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs sm:text-sm font-black text-stone-900 flex items-center gap-2">
                              <Upload className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>ارسال تصویر فیش واریزی به همراه شماره فاکتور</span>
                            </div>

                            <span className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
                              currentInvoice.paymentStatus === 'PendingVerification'
                                ? 'bg-blue-100 text-blue-800'
                                : currentInvoice.paymentStatus === 'Failed'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {currentInvoice.paymentStatus === 'PendingVerification' ? (
                                <>
                                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                                  <span>فیش ارسال شد (در انتظار تایید مدیر)</span>
                                </>
                              ) : currentInvoice.paymentStatus === 'Failed' ? (
                                <>
                                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                  <span>فیش رد شد - لطفاً مجدداً ارسال کنید</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  <span>در انتظار بارگذاری فیش واریزی</span>
                                </>
                              )}
                            </span>
                          </div>

                          {/* If receipt is already uploaded & pending verification, show reassuring status card */}
                          {currentInvoice.paymentStatus === 'PendingVerification' && currentInvoice.receiptImage && (
                            <div className="bg-blue-50/90 border border-blue-200 rounded-2xl p-4 space-y-3">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <img
                                  src={currentInvoice.receiptImage}
                                  alt="فیش ارسالی"
                                  className="w-24 h-24 object-cover rounded-xl border-2 border-white shadow-sm shrink-0"
                                />
                                <div className="space-y-1.5 text-xs text-blue-950 flex-1">
                                  <div className="font-black text-blue-900 flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                                    <span>تصویر فیش واریزی شما با موفقیت برای مدیریت ارسال گردید!</span>
                                  </div>
                                  <p className="leading-relaxed text-blue-800">
                                    شماره فاکتور و کد پیگیری اختصاصی شما <strong className="font-mono bg-white px-2 py-0.5 rounded border border-blue-200">{currentInvoice.trackingCode}</strong> است.
                                    تصویر فیش در پنل مدیریت سفارشات ثبت شده و پس از تایید توسط مدیر، وضعیت سفارش در بخش <strong>«پیگیری سفارش»</strong> به صورت خودکار به‌روزرسانی می‌شود.
                                  </p>
                                  {currentInvoice.receiptUploadedAt && (
                                    <div className="text-[11px] text-blue-600">
                                      زمان ثبت فیش: {currentInvoice.receiptUploadedAt}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Upload Form (allows initial upload or replacing existing image) */}
                          <div className="space-y-3">
                            <div className="bg-white rounded-2xl p-3.5 border border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="text-stone-500">شماره فاکتور متصل به این فیش:</span>
                              <span className="font-mono font-black text-stone-900 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
                                {currentInvoice.trackingCode}
                              </span>
                            </div>

                            <label className="block cursor-pointer">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleReceiptFileChange}
                                className="hidden"
                              />
                              <div className="border-2 border-dashed border-amber-300 hover:border-amber-500 bg-white hover:bg-amber-50/30 transition rounded-2xl p-5 text-center space-y-2">
                                {receiptPreview ? (
                                  <div className="space-y-2">
                                    <img
                                      src={receiptPreview}
                                      alt="پیش‌نمایش فیش"
                                      className="max-h-52 mx-auto rounded-xl border border-stone-200 shadow-xs object-contain"
                                    />
                                    <span className="inline-block text-[11px] text-amber-700 font-bold bg-amber-50 px-3 py-1 rounded-full">
                                      تصویر انتخاب شد (برای تغییر تصویر کلیک کنید)
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                                      <ImageIcon className="w-6 h-6" />
                                    </div>
                                    <div className="text-xs font-black text-stone-800">
                                      {currentInvoice.receiptImage
                                        ? 'انتخاب تصویر جدید جهت جایگزینی فیش قبلی'
                                        : 'برای انتخاب تصویر فیش واریزی یا اسکرین‌شات تراکنش کلیک کنید'}
                                    </div>
                                    <div className="text-[11px] text-stone-400">
                                      فرمت‌های مجاز: JPG, PNG (تصویر رسید عابربانک یا اسکرین‌شات همراه بانک)
                                    </div>
                                  </>
                                )}
                              </div>
                            </label>

                            <div>
                              <label className="block text-xs font-bold text-stone-700 mb-1">
                                توضیحات اختیاری (مثال: ۴ رقم آخر کارت یا ساعت واریز):
                              </label>
                              <input
                                type="text"
                                value={receiptNote}
                                onChange={(e) => setReceiptNote(e.target.value)}
                                placeholder="مثال: واریز از کارت ۶۰۳۷ به نام سارا محمدی..."
                                className="w-full px-4 py-2.5 rounded-xl bg-white border border-stone-200 text-xs focus:ring-2 focus:ring-amber-400/20"
                              />
                            </div>

                            {receiptUploadError && (
                              <div className="text-xs text-rose-600 font-bold bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center gap-1.5">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{receiptUploadError}</span>
                              </div>
                            )}

                            <button
                              type="button"
                              disabled={isUploadingReceipt || !receiptPreview}
                              onClick={() => handleUploadReceipt(currentInvoice.trackingCode)}
                              className={`w-full py-4 rounded-2xl text-xs sm:text-sm font-black shadow-md transition flex items-center justify-center gap-2 cursor-pointer ${
                                receiptPreview
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  : 'bg-stone-200 text-stone-500 cursor-not-allowed'
                              }`}
                            >
                              <Upload className="w-4 h-4 shrink-0" />
                              <span>
                                {isUploadingReceipt
                                  ? 'در حال ارسال فیش و ثبت در پنل سفارشات...'
                                  : `ثبت و ارسال فیش واریزی برای فاکتور ${currentInvoice.trackingCode}`}
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ==================== MODE 2: BALE BOT PAYMENT (Clean, Uncluttered, Fast) ==================== */}
                    {selectedPaymentTab === 'bale_bot' && (
                      <div className="bg-emerald-50/50 rounded-3xl p-5 sm:p-7 border border-emerald-200/90 space-y-4 animate-fadeIn">
                        {/* Header & Status */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-emerald-100">
                          <div className="text-xs sm:text-sm font-black text-emerald-950 flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                              <Send className="w-4 h-4" />
                            </div>
                            <div>
                              <span>پرداخت سریع با ربات بله</span>
                              <div className="text-[11px] font-normal text-emerald-700">تکمیل آنی سفارش بدون نیاز به ارسال فیش</div>
                            </div>
                          </div>

                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>در انتظار پرداخت</span>
                          </span>
                        </div>

                        {/* Invoice Summary */}
                        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-2xs space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200/80 flex items-center justify-between">
                              <span className="text-stone-500 font-bold">شماره فاکتور:</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-black text-stone-900 text-xs sm:text-sm">{currentInvoice.trackingCode}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard?.writeText(currentInvoice.trackingCode);
                                    setCopiedInvoiceCode(true);
                                    setTimeout(() => setCopiedInvoiceCode(false), 2000);
                                  }}
                                  className="text-stone-400 hover:text-emerald-700 p-1 rounded cursor-pointer"
                                  title="کپی شماره فاکتور"
                                >
                                  {copiedInvoiceCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>

                            <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 flex items-center justify-between">
                              <span className="text-emerald-800 font-bold">مبلغ قابل پرداخت:</span>
                              <span className="font-black text-emerald-950 text-xs sm:text-sm">
                                {formatPrice(currentInvoice.totalPrice)} تومان
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Primary Customer Action: Direct to Customer Bale Bot */}
                        <div className="pt-1 space-y-3">
                          <a
                            href={`https://ble.ir/${(activeBaleBotUsername || 'Onivalbot').replace(/^@/, '')}?start=pay_${currentInvoice.trackingCode.replace(/-/g, '_')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2.5 text-center cursor-pointer"
                          >
                            <Send className="w-4 h-4 shrink-0" />
                            <span>ورود به ربات بله و دریافت فاکتور (@{(activeBaleBotUsername || 'Onivalbot').replace(/^@/, '')})</span>
                            <ExternalLink className="w-4 h-4 opacity-75 shrink-0 mr-auto" />
                          </a>

                          {/* Quick Copy Command Box */}
                          <div className="p-3.5 bg-white rounded-2xl border border-emerald-200/90 shadow-2xs space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-stone-700 flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                <span>دستور آماده برای ارسال دستی در ربات:</span>
                              </span>
                              <span className="text-[11px] text-stone-400 font-mono">/start pay_...</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl font-mono text-xs text-stone-800 dir-ltr text-left select-all overflow-x-auto whitespace-nowrap">
                                /start pay_{currentInvoice.trackingCode.replace(/-/g, '_')}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard?.writeText(`/start pay_${currentInvoice.trackingCode.replace(/-/g, '_')}`);
                                  setCopiedPayCmd(true);
                                  setTimeout(() => setCopiedPayCmd(false), 2500);
                                }}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                              >
                                {copiedPayCmd ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                                <span>{copiedPayCmd ? 'کپی شد!' : 'کپی دستور'}</span>
                              </button>
                            </div>
                            <p className="text-[10px] text-stone-500">
                              💡 چنانچه با لمس دکمه بالا صفحه چت بدون پیش‌نویس باز شد، کافیست دستور کپی‌شده بالا را در کادر پیام ربات Paste و ارسال فرمایید.
                            </p>
                          </div>
                        </div>

                        {/* Customer 3-Step Guidance */}
                        <div className="bg-white/90 border border-emerald-200 rounded-2xl p-4 text-xs text-stone-700 space-y-2 leading-relaxed">
                          <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>مراحل تسویه فاکتور در ربات بله:</span>
                          </div>
                          <ol className="text-[11px] text-stone-600 list-decimal list-inside space-y-1 leading-relaxed">
                            <li>با لمس دکمه سبز رنگ بالا وارد ربات رسمی شوید.</li>
                            <li>دکمه «شروع» را بزنید یا دستور پرداخت کپی‌شده را ارسال کنید.</li>
                            <li>پیش‌فاکتور به همراه دکمه درخواست پول بله صادر می‌شود؛ با پرداخت آنی سفارش شما تأیید و آماده‌سازی می‌گردد.</li>
                          </ol>
                        </div>

                        {/* Action buttons: Track or Back */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setActivePage('tracking');
                              executeTrackingSearch(currentInvoice.trackingCode);
                              window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
                            }}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Search className="w-3.5 h-3.5" />
                            <span>پیگیری وضعیت سفارش با شماره فاکتور</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setCurrentInvoice(null);
                              setActivePage('home');
                            }}
                            className="w-full sm:w-auto text-stone-400 hover:text-stone-700 py-1.5 text-center font-medium cursor-pointer"
                          >
                            بستن و بازگشت به صفحه اصلی
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ==================== MODE 3: DIRECT ONLINE PAYMENT GATEWAY ==================== */}
                    {selectedPaymentTab === 'gateway' && (
                      <div className="bg-blue-50/60 rounded-3xl p-5 sm:p-6 border border-blue-200 space-y-4 animate-fadeIn">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs sm:text-sm font-black text-blue-950 flex items-center gap-2">
                            <Globe className="w-5 h-5 text-blue-600 shrink-0" />
                            <span>{paymentConfig.gatewayTitle || 'درگاه پرداخت اینترنتی شاپرک'}</span>
                          </div>
                          <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                            <span>متصل به شبکه شتاب</span>
                          </span>
                        </div>

                        <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-line">
                          {paymentConfig.gatewayDescription}
                        </p>

                        <div className="bg-white rounded-2xl p-4 border border-blue-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="flex justify-between sm:block">
                            <span className="text-stone-400 block mb-0.5">شماره فاکتور:</span>
                            <span className="font-mono font-black text-stone-900">{currentInvoice.trackingCode}</span>
                          </div>
                          <div className="flex justify-between sm:block">
                            <span className="text-stone-400 block mb-0.5">مبلغ قابل پرداخت در درگاه:</span>
                            <span className="font-black text-blue-700">{formatPrice(currentInvoice.totalPrice)} تومان</span>
                          </div>
                          {paymentConfig.gatewayMerchantCode && (
                            <div className="sm:col-span-2 pt-2 border-t border-stone-100 flex justify-between items-center text-[11px] text-stone-500">
                              <span>کد پذیرنده / مرچنت درگاه:</span>
                              <span className="font-mono font-bold text-stone-700">{paymentConfig.gatewayMerchantCode}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-1">
                          {buildGatewayLink(currentInvoice) ? (
                            <a
                              href={buildGatewayLink(currentInvoice)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 py-4 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs sm:text-sm font-black shadow-md transition flex items-center justify-center gap-2 text-center"
                            >
                              <Globe className="w-4 h-4 shrink-0" />
                              <span>{paymentConfig.gatewayButtonText || 'ورود به درگاه بانکی و پرداخت آنلاین'}</span>
                              <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />
                            </a>
                          ) : null}

                          <button
                            type="button"
                            disabled={isConfirmingGateway}
                            onClick={() => handleConfirmGatewayPayment(currentInvoice.trackingCode)}
                            className={`${
                              buildGatewayLink(currentInvoice) ? 'px-5' : 'flex-1'
                            } py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer`}
                          >
                            <CheckCircle2 className={`w-4 h-4 shrink-0 ${isConfirmingGateway ? 'animate-spin' : ''}`} />
                            <span>
                              {buildGatewayLink(currentInvoice)
                                ? 'تایید و تکمیل پرداخت درگاه بانکی'
                                : paymentConfig.gatewayButtonText || 'پرداخت آنلاین از طریق درگاه بانکی'}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom Navigation Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTrackingCodeInput(currentInvoice.trackingCode);
                      setActivePage('tracking');
                      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
                    }}
                    className="flex-1 py-3 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition cursor-pointer text-center"
                  >
                    پیگیری وضعیت لحظه‌ای این سفارش با کد رهگیری
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentInvoice(null);
                      setActivePage('home');
                      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
                    }}
                    className="py-3 px-6 border border-stone-200 text-stone-600 rounded-xl text-xs font-bold hover:bg-stone-50 transition cursor-pointer text-center"
                  >
                    بازگشت به فروشگاه
                  </button>
                </div>
              </div>
            ) : cart.length === 0 ? (
              /* Empty Cart State */
              <div className="text-center py-16 bg-white rounded-3xl border border-stone-100 p-8">
                <ShoppingBag className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-stone-800">سبد خرید شما خالی است</h3>
                <button 
                  onClick={() => setActivePage('home')}
                  className="mt-4 px-6 py-2.5 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition cursor-pointer"
                >
                  بازگشت به فروشگاه
                </button>
              </div>
            ) : (
              /* Cart Review & Customer Checkout Form */
              <div className="bg-white rounded-[30px] p-6 sm:p-10 shadow-sm border border-stone-100">
                <h2 className="text-xl font-black text-stone-900 text-center mb-6">
                  پیش‌فاکتور و ثبت اطلاعات تحویل
                </h2>

                {/* Items in cart table */}
                <div className="overflow-x-auto mb-6">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead>
                      <tr className="border-b-2 border-stone-100 text-stone-500">
                        <th className="pb-3 px-2">#</th>
                        <th className="pb-3 px-2">شرح کالا</th>
                        <th className="pb-3 px-2 text-center">اندازه / وزن</th>
                        <th className="pb-3 px-2 text-center">تعداد</th>
                        <th className="pb-3 px-2">فی (تومان)</th>
                        <th className="pb-3 px-2">جمع (تومان)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {cart.map((item, idx) => (
                        <tr key={item.cartId}>
                          <td className="py-3 px-2 text-stone-400">{idx + 1}</td>
                          <td className="py-3 px-2 font-bold text-stone-800">{item.name}</td>
                          <td className="py-3 px-2 text-center text-stone-600 bg-stone-50/60 rounded">
                            {item.size}
                          </td>
                          <td className="py-3 px-2 text-center font-bold">{item.qty}</td>
                          <td className="py-3 px-2">{formatPrice(item.price)}</td>
                          <td className="py-3 px-2 font-bold text-stone-900">{formatPrice(item.price * item.qty)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center bg-[#fffbeb] p-4 rounded-2xl font-bold text-base text-[#d97706] border border-dashed border-[#f59e0b] mb-6">
                  <span>مبلغ قابل پرداخت:</span>
                  <span className="text-lg font-black">{formatPrice(totalCartPrice)} تومان</span>
                </div>

                {/* Customer Details Form */}
                <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                  {checkoutError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{checkoutError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">
                      نام و نام خانوادگی تحویل‌گیرنده
                    </label>
                    <input 
                      type="text" 
                      required
                      value={checkoutName}
                      onChange={e => setCheckoutName(e.target.value)}
                      placeholder="مثال: سارا محمدی"
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 text-xs focus:ring-2 focus:ring-amber-400/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">
                      شماره تلفن همراه (جهت دریافت لینک فاکتور و کد رهگیری)
                    </label>
                    <input 
                      type="tel" 
                      required
                      value={checkoutPhone}
                      onChange={e => {
                        setCheckoutPhone(e.target.value);
                        if (phoneError) validatePhone(e.target.value);
                      }}
                      placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 text-xs font-mono text-left focus:ring-2 focus:ring-amber-400/20"
                      dir="ltr"
                    />
                    {phoneError && (
                      <p className="text-rose-500 text-[11px] font-bold mt-1">{phoneError}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">
                      آدرس دقیق پستی جهت ارسال مرسوله
                    </label>
                    <textarea 
                      rows={3}
                      required
                      value={checkoutAddress}
                      onChange={e => setCheckoutAddress(e.target.value)}
                      placeholder="استان، شهر، خیابان، کوچه، پلاک، واحد..."
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 text-xs focus:ring-2 focus:ring-amber-400/20 font-sans"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingOrder}
                    className="w-full py-4 bg-[#f59e0b] hover:bg-[#d97706] text-white rounded-2xl text-sm font-black shadow-md transition cursor-pointer"
                  >
                    {isSubmittingOrder ? 'در حال صدور فاکتور رسمی و انتقال به صفحه پرداخت...' : 'ثبت سفارش و ادامه جهت پرداخت فاکتور'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectPage('home')}
                    className="w-full py-2.5 text-center text-xs text-stone-500 hover:text-stone-800 font-bold transition cursor-pointer"
                  >
                    بازگشت به فروشگاه
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
          </>
        )}
      </main>

      {/* ================= FOOTER ================= */}
      {/* ================= FOOTER ================= */}
      <footer className="bg-stone-900 text-white pt-14 pb-24 md:pb-8 px-6 rounded-t-[40px] mt-20">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 justify-between items-start">
          {/* Column 1: Brand Info & Contact */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 font-black text-base sm:text-lg">
              {siteContent?.siteLogo ? (
                <div
                  className={
                    siteContent.siteLogoShape === 'free'
                      ? 'h-9 max-w-[110px] flex items-center justify-center overflow-hidden shrink-0'
                      : `w-9 h-9 ${
                          siteContent.siteLogoShape === 'circle' ? 'rounded-full' : 'rounded-xl'
                        } bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-xs`
                  }
                >
                  <img
                    src={siteContent.siteLogo}
                    alt={brandName}
                    style={{
                      transform:
                        siteContent.siteLogoScale && siteContent.siteLogoScale !== 100
                          ? `scale(${siteContent.siteLogoScale / 100})`
                          : undefined,
                      transformOrigin: 'center center'
                    }}
                    className={`w-full h-full ${
                      siteContent.siteLogoShape === 'free'
                        ? 'object-contain max-h-9 w-auto'
                        : (siteContent.siteLogoFit || 'cover') === 'cover'
                        ? 'object-cover'
                        : 'object-contain'
                    }`}
                  />
                </div>
              ) : (
                <Hexagon className="w-5 h-5 text-amber-500 fill-amber-500/20" />
              )}
              <span>فروشگاه تخصصی {brandName} ({brandEnglishName})</span>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed">
              {brandDescription}
            </p>
            {siteContent?.contactPhone && (
              <div className="text-[11px] text-stone-400 pt-1">
                <span className="text-stone-300 font-bold">تلفن پشتیبانی:</span> {siteContent.contactPhone}
              </div>
            )}
            {siteContent?.contactWorkingHours && (
              <div className="text-[11px] text-stone-400">
                <span className="text-stone-300 font-bold">ساعات پاسخگویی:</span> {siteContent.contactWorkingHours}
              </div>
            )}
            {siteContent?.contactAddress && (
              <div className="text-[11px] text-stone-400">
                <span className="text-stone-300 font-bold">نشانی:</span> {siteContent.contactAddress}
              </div>
            )}
          </div>

          {/* Column 2: Quick Access */}
          <div>
            <h4 className="text-sm font-bold text-amber-400 mb-3">دسترسی سریع</h4>
            <ul className="space-y-2 text-xs text-stone-300">
              <li><a href="/" onClick={(e) => { e.preventDefault(); handleSelectPage('home'); }} className="hover:text-white cursor-pointer">{navigation.home || 'خانه'}</a></li>
              <li><a href="/articles" onClick={(e) => { e.preventDefault(); handleSelectPage('articles'); }} className="hover:text-white cursor-pointer">{navigation.articles || 'مقالات علمی'}</a></li>
              <li><a href="/consultation" onClick={(e) => { e.preventDefault(); handleSelectPage('consultation'); }} className="hover:text-white cursor-pointer">{navigation.consultation || 'مشاوره تخصصی'}</a></li>
              <li><a href="/tracking" onClick={(e) => { e.preventDefault(); handleSelectPage('tracking'); }} className="hover:text-white cursor-pointer">{navigation.tracking || 'پیگیری سفارش'}</a></li>
            </ul>
          </div>

          {/* Column 3: Legal & Trust Policies (Torob, Emalls & eNamad compliant) */}
          <div>
            <h4 className="text-sm font-bold text-amber-400 mb-3">قوانین و پشتیبانی</h4>
            <ul className="space-y-2 text-xs text-stone-300">
              <li><a href="/about" onClick={(e) => { e.preventDefault(); handleSelectPage('about'); }} className="hover:text-white cursor-pointer">{navigation.about || 'درباره ما'}</a></li>
              <li><a href="/contact" onClick={(e) => { e.preventDefault(); handleSelectPage('contact'); }} className="hover:text-white cursor-pointer">{navigation.contact || 'تماس با ما'}</a></li>
              <li><a href="/terms" onClick={(e) => { e.preventDefault(); handleSelectPage('terms'); }} className="hover:text-amber-300 text-amber-200/90 font-medium cursor-pointer">قوانین و مقررات خرید</a></li>
              <li><a href="/refund" onClick={(e) => { e.preventDefault(); handleSelectPage('refund'); }} className="hover:text-amber-300 text-amber-200/90 font-medium cursor-pointer">شرایط بازگشت کالا (رویه مرجوعی)</a></li>
            </ul>
          </div>

          {/* Column 4: eNamad & Trust Badges */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-amber-400 mb-3">نماد اعتماد و اعتبار</h4>
            <div className="bg-stone-800/80 p-3.5 rounded-2xl border border-stone-700/80 space-y-2">
              {siteContent?.enamadCode ? (
                <div
                  className="enamad-container flex items-center justify-center p-2 bg-white rounded-xl"
                  dangerouslySetInnerHTML={{ __html: sanitizeTrustBadgeHtml(siteContent.enamadCode) }}
                />
              ) : siteContent?.enamadStatus === 'hidden' ? null : (
                <div className="text-center p-3 rounded-xl bg-stone-900 border border-stone-700 space-y-1.5">
                  <div className="w-10 h-10 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-black text-stone-200">نماد اعتماد الکترونیکی</div>
                  <div className="text-[10px] text-stone-400 leading-tight">در مرحله استعلام و اخذ شناسه کسب‌وکار</div>
                  <div className="inline-block mt-1 px-2 py-0.5 rounded-md bg-stone-800 text-[10px] text-amber-400 border border-stone-700 font-mono">
                    eNamad Pending
                  </div>
                </div>
              )}
              <div className="text-[10px] text-stone-400 text-center leading-relaxed">
                کلیه معاملات و سفارشات دارای فاکتور رسمی و ضمانت سلامت آزمایشگاهی است.
              </div>
            </div>
          </div>
        </div>

        {/* Footnote text across all pages */}
        {siteContent?.footerFootnote && (
          <div className="max-w-5xl mx-auto border-t border-stone-800/80 mt-10 pt-5 text-center text-xs text-stone-400 leading-relaxed font-sans">
            {siteContent.footerFootnote}
          </div>
        )}

        {/* Footer Bottom with Editable Copyright & Hidden Admin Access Button */}
        <div className="max-w-5xl mx-auto border-t border-stone-800 mt-4 pt-5 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-3">
          <div 
            onClick={handleCopyrightClick}
            className="cursor-pointer select-none hover:text-stone-400 transition flex items-center gap-1.5"
            title="کلیک برای ورود ادمین"
          >
            <span>{siteContent?.footerCopyright || `© ۲۰۲۶ ${brandName} (${brandEnglishName}) • کلیه حقوق محفوظ است.`}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-stone-700 hover:bg-amber-500 transition inline-block"></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-secret-admin-entrance"
              onClick={() => setIsAdminAuthModalOpen(true)}
              className="text-[11px] text-stone-600 hover:text-amber-400 transition flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-stone-800/80 cursor-pointer"
              title="دکمه پنهانی پنل مدیریت سیستم"
            >
              <Lock className="w-3 h-3 opacity-60" />
              <span>ورود مدیریت</span>
            </button>
          </div>
        </div>
      </footer>

      {/* ================= MODAL: HIDDEN ADMIN LOGIN GATE ================= */}
      {isAdminAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-100 text-center animate-scale">
            {siteContent?.siteLogo ? (
              <div
                className={
                  siteContent.siteLogoShape === 'free'
                    ? 'h-14 max-w-[140px] flex items-center justify-center mx-auto mb-3 overflow-hidden'
                    : `w-14 h-14 ${
                        siteContent.siteLogoShape === 'circle' ? 'rounded-full' : 'rounded-2xl'
                      } bg-white border border-stone-200 flex items-center justify-center mx-auto mb-3 shadow-md overflow-hidden`
                }
              >
                <img
                  src={siteContent.siteLogo}
                  alt="Logo"
                  style={{
                    transform:
                      siteContent.siteLogoScale && siteContent.siteLogoScale !== 100
                        ? `scale(${siteContent.siteLogoScale / 100})`
                        : undefined,
                    transformOrigin: 'center center'
                  }}
                  className={`w-full h-full ${
                    siteContent.siteLogoShape === 'free'
                      ? 'object-contain max-h-14 w-auto'
                      : (siteContent.siteLogoFit || 'cover') === 'cover'
                      ? 'object-cover'
                      : 'object-contain'
                  }`}
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-amber-500/20 overflow-hidden">
                <KeyRound className="w-6 h-6" />
              </div>
            )}
            <h3 className="text-base font-black text-stone-900">
              ورود به پنل مدیریت سیستم ({brandEnglishName} Admin)
            </h3>
            <p className="text-xs text-stone-500 mt-1 mb-4">
              لطفاً نام کاربری و رمز عبور مدیریت را جهت ورود به پنل وارد نمایید
            </p>

            <form onSubmit={handleSecretAdminLogin} className="space-y-3.5 text-right">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  نام کاربری یا ایمیل مدیریت:
                </label>
                <input 
                  type="text"
                  autoFocus
                  required
                  dir="ltr"
                  placeholder="نام کاربری یا ایمیل مدیریت"
                  value={adminUsernameInput}
                  onChange={e => {
                    setAdminUsernameInput(e.target.value);
                    setAdminAuthError('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-center font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  رمز عبور مدیریت:
                </label>
                <input 
                  type="password"
                  required
                  dir="ltr"
                  placeholder="••••••••"
                  value={adminPasswordInput}
                  onChange={e => {
                    setAdminPasswordInput(e.target.value);
                    setAdminAuthError('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-center font-mono outline-none"
                />
              </div>

              {adminAuthError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-[11px] font-bold text-center">
                  {adminAuthError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminAuthModalOpen(false);
                    setAdminUsernameInput('');
                    setAdminPasswordInput('');
                    setAdminAuthError('');
                  }}
                  className="flex-1 py-2.5 border border-stone-200 text-stone-600 rounded-xl text-xs font-bold hover:bg-stone-50 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isAuthenticatingAdmin}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  {isAuthenticatingAdmin ? 'در حال بررسی...' : 'ورود به پنل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= DRAWER: SHOPPING CART ================= */}
      {isCartOpen && (
        <div 
          onClick={() => setIsCartOpen(false)}
          className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs"
        />
      )}

      <div
        className={`fixed top-0 left-0 z-50 w-[86vw] max-w-sm sm:w-96 h-[100dvh] max-h-screen bg-white shadow-2xl p-4 sm:p-5 flex flex-col justify-start overflow-y-auto overscroll-contain transition-transform duration-300 ease-in-out ${
          isCartOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 shrink-0">
          <div className="flex items-center gap-2 font-black text-stone-900 text-sm">
            <ShoppingBag className="w-4 h-4 text-amber-500" />
            <span>سبد خرید شما ({totalCartCount})</span>
          </div>
          <button 
            type="button"
            onClick={() => setIsCartOpen(false)}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart Items List & Immediate Summary (No flex-1 pushing button to bottom of page) */}
        {cart.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-xs space-y-3">
            <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto" />
            <div>سبد خرید شما هنوز خالی است.</div>
            <button
              type="button"
              onClick={() => setIsCartOpen(false)}
              className="px-5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              ادامه مشاهده محصولات
            </button>
          </div>
        ) : (
          <div className="flex flex-col space-y-3 pt-2">
            {/* Scrollable Items Container with bounded max-height so confirm button is always right below */}
            <div className="max-h-[45vh] sm:max-h-[52vh] overflow-y-auto overscroll-contain divide-y divide-stone-100 pr-0.5">
              {cart.map(item => (
                <div key={item.cartId} className="py-3 flex gap-3 items-center">
                  <img 
                    src={item.img} 
                    alt={item.name} 
                    className="w-14 h-14 rounded-xl object-cover shrink-0 border border-stone-100"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-xs text-stone-800 truncate">{item.name}</div>
                    <div className="text-[10px] text-stone-400 mb-1">اندازه: {item.size}</div>
                    <div className="text-xs font-black text-stone-900">{formatPrice(item.price)} ت</div>
                  </div>

                  <div className="flex items-center gap-1.5 bg-stone-50 p-1 rounded-lg border border-stone-200 shrink-0">
                    <button 
                      type="button"
                      onClick={() => updateCartQty(item.cartId, 1)}
                      className="w-6 h-6 rounded-md bg-white text-stone-700 flex items-center justify-center hover:bg-stone-100 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold w-5 text-center">{item.qty}</span>
                    <button 
                      type="button"
                      onClick={() => updateCartQty(item.cartId, -1)}
                      className="w-6 h-6 rounded-md bg-white text-stone-700 flex items-center justify-center hover:bg-stone-100 cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Cart Summary & Confirm Button directly below items for instant mobile access */}
            <div className="pt-3 border-t border-stone-200 bg-amber-50/60 rounded-2xl p-3.5 space-y-3 shrink-0">
              <div className="flex justify-between items-center text-sm font-bold">
                <span className="text-stone-600 text-xs">جمع کل قابل پرداخت:</span>
                <span className="font-black text-stone-900 text-sm sm:text-base">{formatPrice(totalCartPrice)} تومان</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsCartOpen(false);
                  setCurrentInvoice(null);
                  handleSelectPage('checkout');
                }}
                className="w-full py-3.5 bg-[#f59e0b] hover:bg-[#d97706] text-white rounded-xl text-xs font-black shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>مشاهده فاکتور و ثبت سفارش</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="w-full py-2 text-center text-[11px] font-bold text-stone-500 hover:text-stone-800 transition cursor-pointer"
              >
                ادامه خرید در فروشگاه
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating in-app notification toast (replaces window.alert for iframe sandbox compliance) */}
      {storefrontNotification && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-stone-900/95 backdrop-blur-md text-amber-100 border border-amber-500/30 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3 text-xs font-bold animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-sm">⚠️</span>
            <span>{storefrontNotification}</span>
          </div>
          <button
            type="button"
            onClick={() => setStorefrontNotification(null)}
            className="text-stone-400 hover:text-white font-black text-sm cursor-pointer mr-2"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

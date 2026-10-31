import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Calendar,
  Clock,
  CreditCard,
  CheckCircle2,
  XCircle,
  Send,
  Plus,
  Trash2,
  Save,
  Copy,
  Check,
  Search,
  Phone,
  Hash,
  MessageSquare,
  Globe,
  Image as ImageIcon,
  Eye,
  Sliders,
  UserCheck,
  Share2,
  DollarSign,
  X
} from 'lucide-react';
import {
  SiteContent,
  ConsultationConfig,
  ConsultationTopicItem,
  ConsultationSocialOption,
  Order,
  ContactMessage
} from '../types';
import { getReceiptImageUrlWithAuth } from '../services/dataService';

interface ConsultationsAdminViewProps {
  siteContent: SiteContent;
  orders: Order[];
  messages: ContactMessage[];
  onSaveSiteContent: (updatedContent: SiteContent) => Promise<void>;
  onRespondMessage: (id: number, response: string) => Promise<void>;
  onUpdateOrderStatus: (id: number, status: Order['status'], paymentStatus?: Order['paymentStatus']) => Promise<void>;
  onVerifyReceipt: (id: number, approved: boolean) => Promise<void>;
  onOpenPaymentSettings?: () => void;
  onViewStorefront?: () => void;
}

const DEFAULT_CONSULTATION_CONFIG: ConsultationConfig = {
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
};

export const ConsultationsAdminView: React.FC<ConsultationsAdminViewProps> = ({
  siteContent,
  orders,
  messages,
  onSaveSiteContent,
  onRespondMessage,
  onUpdateOrderStatus,
  onVerifyReceipt,
  onOpenPaymentSettings,
  onViewStorefront
}) => {
  const [activeTab, setActiveTab] = useState<'bookings' | 'topics-pricing' | 'socials-times'>('bookings');
  const [searchTerm, setSearchTerm] = useState('');
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending_payment' | 'pending_receipt' | 'paid' | 'completed'>('all');

  // Config state
  const [config, setConfig] = useState<ConsultationConfig>(() => ({
    ...DEFAULT_CONSULTATION_CONFIG,
    ...(siteContent?.consultationConfig || {}),
    topics:
      siteContent?.consultationConfig?.topics && siteContent.consultationConfig.topics.length > 0
        ? siteContent.consultationConfig.topics
        : DEFAULT_CONSULTATION_CONFIG.topics,
    socialPlatforms:
      siteContent?.consultationConfig?.socialPlatforms && siteContent.consultationConfig.socialPlatforms.length > 0
        ? siteContent.consultationConfig.socialPlatforms
        : DEFAULT_CONSULTATION_CONFIG.socialPlatforms,
    timeSlots:
      siteContent?.consultationConfig?.timeSlots && siteContent.consultationConfig.timeSlots.length > 0
        ? siteContent.consultationConfig.timeSlots
        : DEFAULT_CONSULTATION_CONFIG.timeSlots
  }));

  const [consultationBadge, setConsultationBadge] = useState(siteContent?.consultationBadge || 'مشاوره تخصصی و رزرو آنلاین کارشناس سلامت');
  const [consultationTitle, setConsultationTitle] = useState(siteContent?.consultationTitle || 'درخواست مشاوره تخصصی سلامت و محصولات اونیوال');
  const [consultationSubtitle, setConsultationSubtitle] = useState(
    siteContent?.consultationSubtitle ||
      'موضوع مشاوره، زمان دلخواه و شبکه اجتماعی مورد نظر خود را انتخاب نمایید تا پس از ثبت فاکتور، کارشناس اونیوال در زمان مقرر با شما ارتباط برقرار کند.'
  );

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  // New Topic form
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicDesc, setNewTopicDesc] = useState('');
  const [newTopicPrice, setNewTopicPrice] = useState<number>(120000);
  const [newTopicDuration, setNewTopicDuration] = useState<number>(30);

  // New Social Media form
  const [newSocialName, setNewSocialName] = useState('');
  const [newSocialPlaceholder, setNewSocialPlaceholder] = useState('');
  const [newSocialIcon, setNewSocialIcon] = useState<ConsultationSocialOption['iconType']>('other');

  // New Time Slot form
  const [newTimeSlot, setNewTimeSlot] = useState('');

  // Modals for Bookings
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewReceiptOrder, setPreviewReceiptOrder] = useState<Order | null>(null);
  const [respondingItem, setRespondingItem] = useState<{
    messageId?: number;
    orderId?: number;
    trackingCode: string;
    fullName: string;
    topicTitle: string;
    socialPlatform: string;
    socialContactId: string;
    preferredDate: string;
    preferredTimeSlot: string;
    question: string;
    existingResponse?: string;
  } | null>(null);
  const [responseText, setResponseText] = useState('');
  const [isSendingResponse, setIsSendingResponse] = useState(false);
  const [verifyingOrderId, setVerifyingOrderId] = useState<number | null>(null);

  useEffect(() => {
    if (!isDirty && siteContent?.consultationConfig) {
      setConfig({
        ...DEFAULT_CONSULTATION_CONFIG,
        ...siteContent.consultationConfig,
        topics:
          siteContent.consultationConfig.topics?.length > 0
            ? siteContent.consultationConfig.topics
            : DEFAULT_CONSULTATION_CONFIG.topics,
        socialPlatforms:
          siteContent.consultationConfig.socialPlatforms?.length > 0
            ? siteContent.consultationConfig.socialPlatforms
            : DEFAULT_CONSULTATION_CONFIG.socialPlatforms,
        timeSlots:
          siteContent.consultationConfig.timeSlots?.length > 0
            ? siteContent.consultationConfig.timeSlots
            : DEFAULT_CONSULTATION_CONFIG.timeSlots
      });
      setConsultationBadge(siteContent.consultationBadge || '');
      setConsultationTitle(siteContent.consultationTitle || '');
      setConsultationSubtitle(siteContent.consultationSubtitle || '');
    }
  }, [siteContent, isDirty]);

  const formatPrice = (val: number) => {
    if (!val || val <= 0) return 'رایگان';
    return new Intl.NumberFormat('fa-IR').format(val) + ' تومان';
  };

  const handleSaveAllConfig = async () => {
    setIsSaving(true);
    try {
      const updatedTopicsStrings = config.topics.filter(t => t.enabled).map(t => t.title);
      await onSaveSiteContent({
        ...siteContent,
        consultationBadge,
        consultationTitle,
        consultationSubtitle,
        consultationTopics: updatedTopicsStrings,
        consultationConfig: config
      });
      setIsDirty(false);
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  // Topic CRUD
  const handleAddTopic = () => {
    if (!newTopicTitle.trim()) return;
    const item: ConsultationTopicItem = {
      id: `topic-${Date.now()}`,
      title: newTopicTitle.trim(),
      description: newTopicDesc.trim() || 'مشاوره تخصصی با کارشناس سلامت اونیوال',
      price: Number(newTopicPrice) >= 0 ? Number(newTopicPrice) : config.basePrice,
      durationMinutes: Number(newTopicDuration) > 0 ? Number(newTopicDuration) : 30,
      enabled: true
    };
    setConfig(prev => ({
      ...prev,
      topics: [...prev.topics, item]
    }));
    setNewTopicTitle('');
    setNewTopicDesc('');
    setIsDirty(true);
  };

  const handleUpdateTopic = (id: string, patch: Partial<ConsultationTopicItem>) => {
    setConfig(prev => ({
      ...prev,
      topics: prev.topics.map(t => (t.id === id ? { ...t, ...patch } : t))
    }));
    setIsDirty(true);
  };

  const handleDeleteTopic = (id: string) => {
    setConfig(prev => ({
      ...prev,
      topics: prev.topics.filter(t => t.id !== id)
    }));
    setIsDirty(true);
  };

  const handleApplyBasePriceToAll = () => {
    setConfig(prev => ({
      ...prev,
      topics: prev.topics.map(t => ({ ...t, price: prev.basePrice }))
    }));
    setIsDirty(true);
  };

  // Social Media CRUD
  const handleAddSocial = () => {
    if (!newSocialName.trim()) return;
    const item: ConsultationSocialOption = {
      id: `social-${Date.now()}`,
      name: newSocialName.trim(),
      placeholder: newSocialPlaceholder.trim() || `آیدی یا شماره شما در ${newSocialName.trim()}`,
      enabled: true,
      iconType: newSocialIcon || 'other'
    };
    setConfig(prev => ({
      ...prev,
      socialPlatforms: [...prev.socialPlatforms, item]
    }));
    setNewSocialName('');
    setNewSocialPlaceholder('');
    setIsDirty(true);
  };

  const handleUpdateSocial = (id: string, patch: Partial<ConsultationSocialOption>) => {
    setConfig(prev => ({
      ...prev,
      socialPlatforms: prev.socialPlatforms.map(s => (s.id === id ? { ...s, ...patch } : s))
    }));
    setIsDirty(true);
  };

  const handleDeleteSocial = (id: string) => {
    setConfig(prev => ({
      ...prev,
      socialPlatforms: prev.socialPlatforms.filter(s => s.id !== id)
    }));
    setIsDirty(true);
  };

  // Time Slots CRUD
  const handleAddTimeSlot = () => {
    if (!newTimeSlot.trim()) return;
    setConfig(prev => ({
      ...prev,
      timeSlots: [...prev.timeSlots, newTimeSlot.trim()]
    }));
    setNewTimeSlot('');
    setIsDirty(true);
  };

  const handleUpdateTimeSlot = (index: number, val: string) => {
    setConfig(prev => ({
      ...prev,
      timeSlots: prev.timeSlots.map((slot, i) => (i === index ? val : slot))
    }));
    setIsDirty(true);
  };

  const handleDeleteTimeSlot = (index: number) => {
    setConfig(prev => ({
      ...prev,
      timeSlots: prev.timeSlots.filter((_, i) => i !== index)
    }));
    setIsDirty(true);
  };

  // Build unified list of Consultation Bookings from Orders and Messages
  const unifiedConsultations = React.useMemo(() => {
    const map = new Map<string, {
      trackingCode: string;
      order?: Order;
      message?: ContactMessage;
      fullName: string;
      phoneNumber: string;
      creationTime: string;
      topicTitle: string;
      preferredDate: string;
      preferredTimeSlot: string;
      socialPlatform: string;
      socialContactId: string;
      price: number;
      durationMinutes: number;
      question: string;
      paymentStatus: Order['paymentStatus'];
      paymentMethod?: Order['paymentMethod'];
      receiptImage?: string;
      receiptNote?: string;
      receiptUploadedAt?: string;
      adminResponse?: string;
      respondedAt?: string;
      status: Order['status'];
    }>();

    // 1. Check orders that are consultations or contain consultation items
    orders.forEach(o => {
      const isCons =
        o.isConsultation ||
        o.trackingCode.toUpperCase().startsWith('ONV-CNS') ||
        Boolean(o.consultationDetails) ||
        o.items?.some(it => it.productId >= 9000 || it.productName.includes('مشاوره'));

      if (!isCons) return;

      const cd = o.consultationDetails;
      map.set(o.trackingCode.toUpperCase(), {
        trackingCode: o.trackingCode,
        order: o,
        fullName: o.userFullName,
        phoneNumber: o.phoneNumber,
        creationTime: o.creationTime,
        topicTitle: cd?.topicTitle || o.items?.[0]?.productName?.replace('رزرو مشاوره تخصصی: ', '') || 'مشاوره تخصصی سلامت',
        preferredDate: cd?.preferredDate || 'ثبت شده در فاکتور',
        preferredTimeSlot: cd?.preferredTimeSlot || o.items?.[0]?.size || 'نوبت هماهنگ‌شده',
        socialPlatform: cd?.socialPlatform || 'پیام‌رسان بله / تلگرام',
        socialContactId: cd?.socialContactId || o.phoneNumber,
        price: cd?.price ?? o.totalPrice,
        durationMinutes: cd?.durationMinutes || 30,
        question: cd?.question || o.userAddress,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        receiptImage: o.receiptImage || o.receiptImageUrl,
        receiptNote: o.receiptNote,
        receiptUploadedAt: o.receiptUploadedAt || o.receiptSubmittedAt,
        adminResponse: cd?.adminResponse,
        respondedAt: cd?.respondedAt,
        status: o.status
      });
    });

    // 2. Merge or add from contactMessages
    messages.forEach(m => {
      const isCons =
        m.isConsultation ||
        m.trackingCode.toUpperCase().startsWith('ONV-CNS') ||
        Boolean(m.consultationDetails) ||
        m.message.includes('[مشاوره') ||
        m.message.includes('[رزرو مشاوره');

      if (!isCons) return;

      const key = m.trackingCode.toUpperCase();
      const existing = map.get(key);
      const cd = m.consultationDetails;

      if (existing) {
        existing.message = m;
        existing.adminResponse = m.adminResponse || existing.adminResponse;
        existing.respondedAt = m.respondedAt || existing.respondedAt;
        if (cd?.question) existing.question = cd.question;
        if (!existing.receiptImage && (m.receiptImage || m.receiptImageUrl)) {
          existing.receiptImage = m.receiptImage || m.receiptImageUrl;
        }
      } else {
        map.set(key, {
          trackingCode: m.trackingCode,
          message: m,
          fullName: m.fullName,
          phoneNumber: m.phoneNumber || '',
          creationTime: m.creationTime,
          topicTitle: cd?.topicTitle || 'مشاوره تخصصی سلامت',
          preferredDate: cd?.preferredDate || 'روز جاری',
          preferredTimeSlot: cd?.preferredTimeSlot || 'اولین زمان خالی',
          socialPlatform: cd?.socialPlatform || 'تلفنی / پیام‌رسان',
          socialContactId: cd?.socialContactId || m.phoneNumber || '-',
          price: cd?.price ?? m.totalPrice ?? 0,
          durationMinutes: cd?.durationMinutes || 30,
          question: cd?.question || m.message,
          paymentStatus: m.paymentStatus || 'Paid',
          paymentMethod: m.paymentMethod,
          receiptImage: m.receiptImage || m.receiptImageUrl,
          receiptNote: m.receiptNote,
          receiptUploadedAt: m.receiptUploadedAt,
          adminResponse: m.adminResponse,
          respondedAt: m.respondedAt,
          status: m.isResponded ? 'Completed' : 'Processing'
        });
      }
    });

    return Array.from(map.values());
  }, [orders, messages]);

  const filteredConsultations = unifiedConsultations.filter(c => {
    const matchSearch =
      c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.trackingCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.topicTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.socialPlatform.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.socialContactId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phoneNumber.includes(searchTerm);

    if (!matchSearch) return false;
    if (bookingFilter === 'pending_payment') return c.paymentStatus === 'Unpaid' || c.paymentStatus === 'Failed';
    if (bookingFilter === 'pending_receipt') return c.paymentStatus === 'PendingVerification';
    if (bookingFilter === 'paid') return c.paymentStatus === 'Paid' && c.status !== 'Completed';
    if (bookingFilter === 'completed') return c.status === 'Completed' || Boolean(c.adminResponse);
    return true;
  });

  const handleCopyContact = (text: string, code: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReceiptVerifyDecision = async (order: Order, approved: boolean) => {
    setVerifyingOrderId(order.id);
    try {
      await onVerifyReceipt(order.id, approved);
      if (previewReceiptOrder?.id === order.id) {
        setPreviewReceiptOrder(null);
      }
    } finally {
      setVerifyingOrderId(null);
    }
  };

  const handleSubmitSpecialistResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondingItem || !responseText.trim()) return;
    setIsSendingResponse(true);
    try {
      if (respondingItem.messageId) {
        await onRespondMessage(respondingItem.messageId, responseText.trim());
      } else {
        // Fallback if only order exists: create/respond or update status
        if (respondingItem.orderId) {
          await onUpdateOrderStatus(respondingItem.orderId, 'Completed', 'Paid');
        }
      }
      if (respondingItem.orderId) {
        await onUpdateOrderStatus(respondingItem.orderId, 'Completed');
      }
      setRespondingItem(null);
      setResponseText('');
    } finally {
      setIsSendingResponse(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900">
                  مدیریت و تنظیمات جامع مشاوره تخصصی
                </h1>
                {isDirty && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                    تغییرات ذخیره نشده
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                مدیریت رزروها و فیش‌های واریزی مشاوره، تعیین قیمت هر موضوع، تنظیم زمان‌بندی و شبکه‌های اجتماعی ارتباط با مشتری
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onViewStorefront && (
            <button
              type="button"
              onClick={onViewStorefront}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Eye className="w-4 h-4 text-amber-600" />
              <span>مشاهده صفحه مشاوره مشتری</span>
            </button>
          )}

          {onOpenPaymentSettings && (
            <button
              type="button"
              onClick={onOpenPaymentSettings}
              className="px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-amber-600" />
              <span>تنظیمات کارت و درگاه پرداخت</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveAllConfig}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black flex items-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
            <span>{isSaving ? 'در حال ذخیره...' : 'ذخیره و اعمال تنظیمات مشاوره'}</span>
          </button>
        </div>
      </div>

      {saveToast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-5 py-3.5 rounded-2xl flex items-center justify-between text-xs font-bold animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>تمامی تنظیمات قیمت، موضوعات، زمان‌بندی و شبکه‌های اجتماعی مشاوره با موفقیت ذخیره و در صفحه مشتری اعمال شد!</span>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('bookings')}
          className={`py-3 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'bookings'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4 text-amber-600" />
          <span>درخواست‌ها، فیش‌ها و پاسخ‌دهی ({unifiedConsultations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('topics-pricing')}
          className={`py-3 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'topics-pricing'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <DollarSign className="w-4 h-4 text-emerald-600" />
          <span>تنظیم قیمت و موضوعات مشاوره ({config.topics.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('socials-times')}
          className={`py-3 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'socials-times'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Share2 className="w-4 h-4 text-blue-600" />
          <span>شبکه‌های اجتماعی و زمان‌بندی ({config.socialPlatforms.filter(s => s.enabled).length} فعال)</span>
        </button>
      </div>

      {/* ================= TAB 1: CONSULTATION BOOKINGS & RECEIPTS ================= */}
      {activeTab === 'bookings' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Filters & Search */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="جستجو بر اساس کد رهگیری (ONV-CNS-...)، نام مشتری، موضوع یا آیدی شبکه اجتماعی..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-amber-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setBookingFilter('all')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  bookingFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                همه ({unifiedConsultations.length})
              </button>
              <button
                type="button"
                onClick={() => setBookingFilter('pending_receipt')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  bookingFilter === 'pending_receipt' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                فیش منتظر تایید ({unifiedConsultations.filter(c => c.paymentStatus === 'PendingVerification').length})
              </button>
              <button
                type="button"
                onClick={() => setBookingFilter('paid')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  bookingFilter === 'paid' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-800 border border-blue-200'
                }`}
              >
                آماده تماس و مشاوره ({unifiedConsultations.filter(c => c.paymentStatus === 'Paid' && c.status !== 'Completed').length})
              </button>
              <button
                type="button"
                onClick={() => setBookingFilter('completed')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  bookingFilter === 'completed' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                تکمیل شده ({unifiedConsultations.filter(c => c.status === 'Completed' || Boolean(c.adminResponse)).length})
              </button>
            </div>
          </div>

          {filteredConsultations.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400 text-xs font-bold">
              هیچ رزرو مشاوره‌ای با این فیلتر یافت نشد.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredConsultations.map(item => (
                <div
                  key={item.trackingCode}
                  className={`bg-white rounded-3xl p-5 sm:p-6 border transition shadow-xs ${
                    item.paymentStatus === 'PendingVerification'
                      ? 'border-amber-300 bg-amber-50/15'
                      : item.status === 'Completed'
                      ? 'border-emerald-200'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Top Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono text-xs font-black flex items-center gap-1">
                        <Hash className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{item.trackingCode}</span>
                      </span>

                      <span className="text-sm font-black text-slate-900">{item.fullName}</span>

                      {item.phoneNumber && (
                        <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{item.phoneNumber}</span>
                        </span>
                      )}

                      <span className="text-[11px] text-slate-400">{item.creationTime}</span>
                    </div>

                    {/* Payment & Status Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-black">
                        هزینه جلسه: {formatPrice(item.price)}
                      </span>

                      {item.paymentStatus === 'Paid' ? (
                        <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>پرداخت تایید شده</span>
                        </span>
                      ) : item.paymentStatus === 'PendingVerification' ? (
                        <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1 animate-pulse">
                          <ImageIcon className="w-3.5 h-3.5 text-amber-700" />
                          <span>فیش واریزی منتظر تایید</span>
                        </span>
                      ) : item.paymentStatus === 'Failed' ? (
                        <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>فیش رد شده</span>
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>در انتظار پرداخت مشتری</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Consultation Booking Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                      <span className="text-[11px] text-slate-400 block mb-1">موضوع انتخاب‌شده توسط مشتری:</span>
                      <div className="text-xs font-black text-slate-900 leading-snug">{item.topicTitle}</div>
                      <span className="inline-block mt-1.5 text-[10px] font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md">
                        مدت زمان جلسه: {item.durationMinutes} دقیقه
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-200/70">
                      <span className="text-[11px] text-blue-600 block mb-1">زمان انتخابی مشتری جهت مشاوره:</span>
                      <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{item.preferredDate}</span>
                      </div>
                      <div className="text-xs font-bold text-blue-800 mt-1 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>{item.preferredTimeSlot}</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200/70 flex flex-col justify-between">
                      <div>
                        <span className="text-[11px] text-emerald-700 block mb-1">شبکه اجتماعی انتخابی جهت ارتباط:</span>
                        <div className="text-xs font-black text-emerald-950">{item.socialPlatform}</div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-emerald-200/60 flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-slate-800 dir-ltr truncate">
                          آیدی/شماره: {item.socialContactId}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyContact(item.socialContactId, item.trackingCode)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          {copiedId === item.trackingCode ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>کپی شد</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>کپی آیدی</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Customer's Question / Description */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed mb-4">
                    <span className="font-bold text-slate-900 block mb-1">شرح پرسش، علائم یا توضیحات مشتری:</span>
                    <p className="whitespace-pre-line">{item.question}</p>
                  </div>

                  {/* Receipt Verification Box (if receipt uploaded) */}
                  {item.receiptImage && item.order && (
                    <div className="mb-4 p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={getReceiptImageUrlWithAuth(item.receiptImage)}
                          alt="فیش واریزی مشاوره"
                          onClick={() => setPreviewReceiptOrder(item.order!)}
                          className="w-16 h-16 object-cover rounded-xl border-2 border-white shadow-sm cursor-pointer hover:scale-105 transition"
                        />
                        <div className="text-xs space-y-1">
                          <div className="font-black text-amber-950">
                            تصویر فیش واریزی پیوست شده به فاکتور مشاوره ({item.trackingCode})
                          </div>
                          {item.receiptNote && (
                            <div className="text-amber-800">توضیح واریز مشتری: {item.receiptNote}</div>
                          )}
                          {item.receiptUploadedAt && (
                            <div className="text-[11px] text-amber-600">زمان بارگذاری: {item.receiptUploadedAt}</div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => setPreviewReceiptOrder(item.order!)}
                          className="px-3 py-2 rounded-xl bg-white border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-1.5 hover:bg-amber-100 transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>بزرگنمایی فیش</span>
                        </button>

                        {item.paymentStatus !== 'Paid' && (
                          <button
                            type="button"
                            disabled={verifyingOrderId === item.order.id}
                            onClick={() => handleReceiptVerifyDecision(item.order!, true)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>تایید فیش واریزی</span>
                          </button>
                        )}

                        {item.paymentStatus !== 'Failed' && (
                          <button
                            type="button"
                            disabled={verifyingOrderId === item.order.id}
                            onClick={() => handleReceiptVerifyDecision(item.order!, false)}
                            className="px-3 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>رد فیش</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Specialist Response (if already responded) */}
                  {item.adminResponse && (
                    <div className="mb-4 p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs space-y-1.5">
                      <div className="font-black text-emerald-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>پاسخ و توصیه ثبت‌شده توسط کارشناس سلامت اونیوال:</span>
                      </div>
                      <p className="text-emerald-950 leading-relaxed whitespace-pre-line bg-white/80 p-3 rounded-xl border border-emerald-100">
                        {item.adminResponse}
                      </p>
                      {item.respondedAt && (
                        <div className="text-[10px] text-emerald-600 text-left font-mono">
                          زمان ثبت پاسخ: {item.respondedAt}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bottom Actions Bar */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.order && (
                        <>
                          <span className="text-xs font-bold text-slate-500">تغییر وضعیت جلسه مشاوره:</span>
                          <select
                            value={item.order.status}
                            onChange={e => onUpdateOrderStatus(item.order!.id, e.target.value as Order['status'])}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50"
                          >
                            <option value="Pending">در انتظار تایید پرداخت</option>
                            <option value="Processing">هماهنگ‌شده جهت تماس در شبکه اجتماعی</option>
                            <option value="Completed">مشاوره انجام و تکمیل شد</option>
                            <option value="Cancelled">لغو شده</option>
                          </select>

                          {item.paymentStatus !== 'Paid' && (
                            <button
                              type="button"
                              onClick={() => onUpdateOrderStatus(item.order!.id, 'Processing', 'Paid')}
                              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition cursor-pointer"
                            >
                              تایید دستی پرداخت
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setRespondingItem({
                          messageId: item.message?.id,
                          orderId: item.order?.id,
                          trackingCode: item.trackingCode,
                          fullName: item.fullName,
                          topicTitle: item.topicTitle,
                          socialPlatform: item.socialPlatform,
                          socialContactId: item.socialContactId,
                          preferredDate: item.preferredDate,
                          preferredTimeSlot: item.preferredTimeSlot,
                          question: item.question,
                          existingResponse: item.adminResponse
                        });
                        setResponseText(item.adminResponse || '');
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5 text-amber-400" />
                      <span>{item.adminResponse ? 'ویرایش پاسخ و نتیجه مشاوره' : 'ثبت نتیجه مشاوره / ارسال پاسخ به مشتری'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: TOPICS & PRICING SETTINGS ================= */}
      {activeTab === 'topics-pricing' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Base Price & Header Texts */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-black text-slate-900">تنظیمات پایه قیمت، کارشناس و نحوه پرداخت مشاوره</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  تعیین هزینه پایه مشاوره، مشخصات کارشناس و فعال‌سازی مکانیزم سبد خرید و صدور فاکتور پرداخت
                </p>
              </div>
              <button
                type="button"
                onClick={handleApplyBasePriceToAll}
                className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition cursor-pointer"
              >
                اعمال قیمت پایه روی تمام موضوعات
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  قیمت پایه مشاوره (به تومان - ۰ یعنی رایگان):
                </label>
                <input
                  type="number"
                  min={0}
                  step={10000}
                  value={config.basePrice}
                  onChange={e => {
                    setConfig(prev => ({ ...prev, basePrice: Number(e.target.value) || 0 }));
                    setIsDirty(true);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold text-slate-900 focus:bg-white"
                />
                <span className="text-[11px] text-amber-700 font-bold mt-1 block">
                  نمایش به مشتری: {formatPrice(config.basePrice)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">نام یا عنوان کارشناس مشاور:</label>
                <input
                  type="text"
                  value={config.specialistName || ''}
                  onChange={e => {
                    setConfig(prev => ({ ...prev, specialistName: e.target.value }));
                    setIsDirty(true);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white"
                  placeholder="مثال: متخصص طب سنتی و فرآورده‌های کندوی اونیوال"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">تخصص و زیرعنوان کارشناس:</label>
                <input
                  type="text"
                  value={config.specialistTitle || ''}
                  onChange={e => {
                    setConfig(prev => ({ ...prev, specialistTitle: e.target.value }));
                    setIsDirty(true);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:bg-white"
                  placeholder="مثال: مشاوره اختصاصی تغذیه و رژیم درمانی"
                />
              </div>
            </div>

            {/* Payment Mechanism Checkboxes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <label className="flex items-start gap-3 p-4 rounded-2xl border border-slate-200 bg-slate-50/70 cursor-pointer hover:border-amber-300 transition">
                <input
                  type="checkbox"
                  checked={config.allowDirectPayment !== false}
                  onChange={e => {
                    setConfig(prev => ({ ...prev, allowDirectPayment: e.target.checked }));
                    setIsDirty(true);
                  }}
                  className="mt-1 w-4 h-4 accent-amber-600 rounded"
                />
                <div className="text-xs">
                  <div className="font-black text-slate-900">صدور مستقیم فاکتور مشاوره و ورود به صفحه پرداخت</div>
                  <p className="text-slate-500 mt-0.5 leading-relaxed">
                    مشتری پس از انتخاب موضوع، زمان و شبکه اجتماعی، مستقیماً وارد صفحه پرداخت (کارت به کارت + آپلود فیش، ربات بله یا درگاه بانکی) می‌شود.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 rounded-2xl border border-slate-200 bg-slate-50/70 cursor-pointer hover:border-amber-300 transition">
                <input
                  type="checkbox"
                  checked={config.allowAddToCart !== false}
                  onChange={e => {
                    setConfig(prev => ({ ...prev, allowAddToCart: e.target.checked }));
                    setIsDirty(true);
                  }}
                  className="mt-1 w-4 h-4 accent-amber-600 rounded"
                />
                <div className="text-xs">
                  <div className="font-black text-slate-900">امکان افزودن جلسه مشاوره به سبد خرید</div>
                  <p className="text-slate-500 mt-0.5 leading-relaxed">
                    مشتری می‌تواند جلسه مشاوره را مانند یک محصول به سبد خرید خود اضافه کرده و همزمان با سایر محصولات تسویه نماید.
                  </p>
                </div>
              </label>
            </div>

            {/* Page Titles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">برچسب بالای صفحه مشاوره:</label>
                <input
                  type="text"
                  value={consultationBadge}
                  onChange={e => {
                    setConsultationBadge(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">تیتر اصلی صفحه مشاوره:</label>
                <input
                  type="text"
                  value={consultationTitle}
                  onChange={e => {
                    setConsultationTitle(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">توضیحات راهنمای بالای فرم مشاوره:</label>
                <textarea
                  rows={2}
                  value={consultationSubtitle}
                  onChange={e => {
                    setConsultationSubtitle(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* Topics List & Pricing Editor */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-black text-slate-900">مدیریت موضوعات مشاوره، مدت زمان و قیمت هر موضوع</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                موضوعاتی که مشتری در صفحه مشاوره انتخاب می‌کند؛ هر موضوع می‌تواند قیمت و مدت زمان اختصاصی خود را داشته باشد.
              </p>
            </div>

            {/* Add New Topic Box */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3">
              <div className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-amber-700" />
                <span>افزودن موضوع مشاوره جدید</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">عنوان موضوع مشاوره:</label>
                  <input
                    type="text"
                    value={newTopicTitle}
                    onChange={e => setNewTopicTitle(e.target.value)}
                    placeholder="مثال: مشاوره تخصصی تقویت سیستم ایمنی کودکان"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">قیمت جلسه (تومان):</label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={newTopicPrice}
                    onChange={e => setNewTopicPrice(Number(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">مدت (دقیقه):</label>
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={newTopicDuration}
                    onChange={e => setNewTopicDuration(Number(e.target.value) || 30)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold"
                  />
                </div>
                <div className="sm:col-span-2 flex items-end">
                  <button
                    type="button"
                    onClick={handleAddTopic}
                    className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>افزودن</span>
                  </button>
                </div>
                <div className="sm:col-span-12">
                  <input
                    type="text"
                    value={newTopicDesc}
                    onChange={e => setNewTopicDesc(e.target.value)}
                    placeholder="توضیح کوتاه موضوع برای نمایش به مشتری (اختیاری)..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Existing Topics List */}
            <div className="space-y-3">
              {config.topics.map((topic, index) => (
                <div
                  key={topic.id}
                  className={`p-4 rounded-2xl border transition ${
                    topic.enabled ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200/60 opacity-60'
                  }`}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                    <div className="lg:col-span-5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-black flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <input
                          type="text"
                          value={topic.title}
                          onChange={e => handleUpdateTopic(topic.id, { title: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900"
                        />
                      </div>
                      <input
                        type="text"
                        value={topic.description || ''}
                        onChange={e => handleUpdateTopic(topic.id, { description: e.target.value })}
                        placeholder="توضیحات تکمیلی موضوع..."
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-100 bg-slate-50 text-[11px] text-slate-600"
                      />
                    </div>

                    <div className="lg:col-span-3">
                      <label className="block text-[10px] text-slate-400 mb-1">هزینه مشاوره (تومان):</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          step={10000}
                          value={topic.price}
                          onChange={e => handleUpdateTopic(topic.id, { price: Number(e.target.value) || 0 })}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900"
                        />
                        <span className="text-[11px] font-bold text-amber-700 shrink-0">
                          {formatPrice(topic.price)}
                        </span>
                      </div>
                    </div>

                    <div className="lg:col-span-2">
                      <label className="block text-[10px] text-slate-400 mb-1">مدت زمان (دقیقه):</label>
                      <input
                        type="number"
                        min={5}
                        step={5}
                        value={topic.durationMinutes || 30}
                        onChange={e => handleUpdateTopic(topic.id, { durationMinutes: Number(e.target.value) || 30 })}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900"
                      />
                    </div>

                    <div className="lg:col-span-2 flex items-center justify-end gap-2 pt-2 lg:pt-0">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={topic.enabled}
                          onChange={e => handleUpdateTopic(topic.id, { enabled: e.target.checked })}
                          className="w-4 h-4 accent-emerald-600 rounded"
                        />
                        <span>{topic.enabled ? 'فعال' : 'غیرفعال'}</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => handleDeleteTopic(topic.id)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                        title="حذف موضوع"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: SOCIAL MEDIA PLATFORMS & TIME SLOTS ================= */}
      {activeTab === 'socials-times' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          {/* Social Media Platforms Configuration (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-black text-slate-900">
                لیست شبکه‌های اجتماعی جهت برقراری ارتباط مشاوره
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                مخاطب در صفحه انتخاب مشاوره مشخص می‌کند که کارشناس در کدام پیام‌رسان یا شبکه اجتماعی با او تماس بگیرد.
              </p>
            </div>

            {/* Add New Social Platform */}
            <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200/80 space-y-3">
              <div className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>افزودن شبکه اجتماعی / پیام‌رسان جدید</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">نام شبکه اجتماعی / پیام‌رسان:</label>
                  <input
                    type="text"
                    value={newSocialName}
                    onChange={e => setNewSocialName(e.target.value)}
                    placeholder="مثال: پیام‌رسان روبیکا (Rubika)"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">نوع آیکون نمایشی:</label>
                  <select
                    value={newSocialIcon}
                    onChange={e => setNewSocialIcon(e.target.value as ConsultationSocialOption['iconType'])}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold"
                  >
                    <option value="bale">بله (Bale)</option>
                    <option value="telegram">تلگرام (Telegram)</option>
                    <option value="whatsapp">واتساپ (WhatsApp)</option>
                    <option value="eitaa">ایتا (Eitaa)</option>
                    <option value="instagram">اینستاگرام (Instagram)</option>
                    <option value="phone">تماس تلفنی</option>
                    <option value="other">سایر شبکه‌های اجتماعی</option>
                  </select>
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <input
                    type="text"
                    value={newSocialPlaceholder}
                    onChange={e => setNewSocialPlaceholder(e.target.value)}
                    placeholder="متن راهنمای دریافت آیدی/شماره از مشتری (مثال: آیدی یا شماره موبایل در روبیکا)..."
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddSocial}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1 shrink-0 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>افزودن</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Social Platforms List */}
            <div className="space-y-3">
              {config.socialPlatforms.map(social => (
                <div
                  key={social.id}
                  className={`p-4 rounded-2xl border transition ${
                    social.enabled ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200/60 opacity-60'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={social.name}
                        onChange={e => handleUpdateSocial(social.id, { name: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-black text-slate-900"
                      />
                      <input
                        type="text"
                        value={social.placeholder || ''}
                        onChange={e => handleUpdateSocial(social.id, { placeholder: e.target.value })}
                        placeholder="متن راهنمای دریافت آیدی/شماره از مشتری..."
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-100 bg-slate-50 text-[11px] text-slate-600"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 shrink-0">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={social.enabled}
                          onChange={e => handleUpdateSocial(social.id, { enabled: e.target.checked })}
                          className="w-4 h-4 accent-emerald-600 rounded"
                        />
                        <span>{social.enabled ? 'فعال در فرم' : 'غیرفعال'}</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => handleDeleteSocial(social.id)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                        title="حذف شبکه اجتماعی"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Time Slots Configuration (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-black text-slate-900">
                تنظیم بازه‌های زمانی قابل انتخاب برای مشاوره
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ساعت‌ها و شیفت‌هایی که مشتری می‌تواند هنگام رزرو مشاوره انتخاب نماید.
              </p>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newTimeSlot}
                onChange={e => setNewTimeSlot(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTimeSlot()}
                placeholder="مثال: نوبت ویژه پنج‌شنبه (۱۰ الی ۱۴)"
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold"
              />
              <button
                type="button"
                onClick={handleAddTimeSlot}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black flex items-center gap-1 shrink-0 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>افزودن</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {config.timeSlots.map((slot, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200"
                >
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mr-1" />
                  <input
                    type="text"
                    value={slot}
                    onChange={e => handleUpdateTimeSlot(idx, e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteTimeSlot(idx)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Receipt Image Lightbox Modal */}
      {previewReceiptOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  بررسی تصویر فیش واریزی مشاوره ({previewReceiptOrder.trackingCode})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  مشتری: {previewReceiptOrder.userFullName} | مبلغ: {formatPrice(previewReceiptOrder.totalPrice)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReceiptOrder(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 rounded-2xl p-3 flex items-center justify-center max-h-96 overflow-hidden">
              <img
                src={getReceiptImageUrlWithAuth(previewReceiptOrder.receiptImage || previewReceiptOrder.receiptImageUrl)}
                alt="Receipt"
                className="max-h-80 object-contain rounded-xl"
              />
            </div>

            {previewReceiptOrder.receiptNote && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <strong>توضیح مشتری:</strong> {previewReceiptOrder.receiptNote}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleReceiptVerifyDecision(previewReceiptOrder, false)}
                className="px-4 py-2.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-bold cursor-pointer"
              >
                رد فیش واریزی
              </button>
              <button
                type="button"
                onClick={() => handleReceiptVerifyDecision(previewReceiptOrder, true)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>تایید نهایی فیش واریزی</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Specialist Response Modal */}
      {respondingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-amber-600" />
                <span>ثبت نتیجه و پاسخ مشاوره ({respondingItem.trackingCode})</span>
              </h3>
              <button
                type="button"
                onClick={() => setRespondingItem(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div><strong>نام متقاضی:</strong> {respondingItem.fullName}</div>
              <div><strong>موضوع مشاوره:</strong> {respondingItem.topicTitle}</div>
              <div><strong>زمان انتخابی:</strong> {respondingItem.preferredDate} | {respondingItem.preferredTimeSlot}</div>
              <div><strong>شبکه اجتماعی ارتباط:</strong> {respondingItem.socialPlatform} ({respondingItem.socialContactId})</div>
              <div className="pt-1 text-slate-600"><strong>شرح پرسش:</strong> {respondingItem.question}</div>
            </div>

            <form onSubmit={handleSubmitSpecialistResponse} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  متن پاسخ، نسخه پیشنهادی یا گزارش هماهنگی جلسه (نمایش در پیگیری سفارش مشتری و ارسال به ربات):
                </label>
                <textarea
                  rows={5}
                  required
                  value={responseText}
                  onChange={e => setResponseText(e.target.value)}
                  placeholder="مثال: جلسه مشاوره شما برای فردا ساعت ۱۷ در پیام‌رسان بله هماهنگ شد. همچنین توصیه اولیه کارشناس: مصرف روزانه یک قاشق مرباخوری عسل سبلان ناشتا..."
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs leading-relaxed focus:outline-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRespondingItem(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSendingResponse}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingResponse ? 'در حال ثبت...' : 'ثبت پاسخ و تکمیل وضعیت مشتری'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Save, 
  RotateCcw, 
  Eye, 
  Check, 
  MoveUp, 
  MoveDown, 
  EyeOff, 
  AlignRight, 
  AlignCenter, 
  AlignLeft, 
  Type, 
  Layers, 
  Sparkles, 
  HelpCircle, 
  FileText, 
  Info, 
  Phone, 
  Plus, 
  Trash2, 
  Store,
  ExternalLink,
  ShieldCheck,
  Palette,
  Image as ImageIcon,
  Clock
} from 'lucide-react';
import { SiteContent, HomeSectionConfig, TopBanner, TopBannerSettings } from '../types';

interface PageEditorViewProps {
  initialContent?: SiteContent;
  siteContent?: SiteContent;
  onSave: (updatedContent: SiteContent) => Promise<void>;
  onReset: () => Promise<void>;
  onViewStorefront?: () => void;
  onPreviewStorefront?: () => void;
}

type EditorSubTab = 
  | 'brand-header'
  | 'top-banner'
  | 'sections-order'
  | 'nav-tabs'
  | 'home-content'
  | 'consultation'
  | 'tracking'
  | 'about'
  | 'contact'
  | 'terms-refund';

export const PageEditorView: React.FC<PageEditorViewProps> = ({
  initialContent,
  siteContent,
  onSave,
  onReset,
  onViewStorefront,
  onPreviewStorefront
}) => {
  const actualInitial = siteContent || initialContent!;
  const handlePreview = onViewStorefront || onPreviewStorefront || (() => {});
  const [content, setContent] = useState<SiteContent>(actualInitial);
  const [activeSubTab, setActiveSubTab] = useState<EditorSubTab>('brand-header');
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [newTopicInput, setNewTopicInput] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (siteContent) {
      setContent(siteContent);
      setIsDirty(false);
    } else if (initialContent) {
      setContent(initialContent);
      setIsDirty(false);
    }
  }, [siteContent, initialContent]);

  const handleFieldChange = <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => {
    setContent(prev => ({
      ...prev,
      [key]: value
    }));
    setIsDirty(true);
  };

  const handleNavLabelChange = (tabKey: keyof SiteContent['navLabels'], value: string) => {
    setContent(prev => ({
      ...prev,
      navLabels: {
        ...prev.navLabels,
        [tabKey]: value
      }
    }));
    setIsDirty(true);
  };

  // Sections reordering
  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const sections = [...content.homeSections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const temp = sections[index];
    sections[index] = sections[targetIndex];
    sections[targetIndex] = temp;

    // update orders
    const updated = sections.map((sec, idx) => ({ ...sec, order: idx + 1 }));
    handleFieldChange('homeSections', updated);
  };

  const handleToggleSection = (index: number) => {
    const sections = [...content.homeSections];
    sections[index] = {
      ...sections[index],
      enabled: !sections[index].enabled
    };
    handleFieldChange('homeSections', sections);
  };

  const handleSectionAlignChange = (index: number, align: 'right' | 'center' | 'left') => {
    const sections = [...content.homeSections];
    sections[index] = {
      ...sections[index],
      align
    };
    handleFieldChange('homeSections', sections);
  };

  const handleSectionTitleChange = (index: number, title: string) => {
    const sections = [...content.homeSections];
    sections[index] = {
      ...sections[index],
      title
    };
    handleFieldChange('homeSections', sections);
  };

  const handleSectionSubtitleChange = (index: number, subtitle: string) => {
    const sections = [...content.homeSections];
    sections[index] = {
      ...sections[index],
      subtitle
    };
    handleFieldChange('homeSections', sections);
  };

  // Top Banner Carousel Management
  const handleToggleBannerEnabled = (enabled: boolean) => {
    setContent(prev => ({
      ...prev,
      topBannerSettings: {
        ...(prev.topBannerSettings || {
          enabled: true,
          autoRotate: true,
          intervalSeconds: 4,
          height: 'standard'
        }),
        enabled
      }
    }));
    setIsDirty(true);
  };

  const handleBannerIntervalChange = (intervalSeconds: number) => {
    setContent(prev => ({
      ...prev,
      topBannerSettings: {
        ...(prev.topBannerSettings || {
          enabled: true,
          autoRotate: true,
          intervalSeconds: 4,
          height: 'standard'
        }),
        intervalSeconds
      }
    }));
    setIsDirty(true);
  };

  const handleToggleBannerAutoRotate = (autoRotate: boolean) => {
    setContent(prev => ({
      ...prev,
      topBannerSettings: {
        ...(prev.topBannerSettings || {
          enabled: true,
          autoRotate: true,
          intervalSeconds: 4,
          height: 'standard'
        }),
        autoRotate
      }
    }));
    setIsDirty(true);
  };

  const handleUpdateBanner = (index: number, updated: Partial<TopBanner>) => {
    const list = [...(content.topBanners || [])];
    if (list[index]) {
      list[index] = { ...list[index], ...updated };
      setContent(prev => ({ ...prev, topBanners: list }));
      setIsDirty(true);
    }
  };

  const handleAddBanner = () => {
    const newBanner: TopBanner = {
      id: `banner-${Date.now()}`,
      title: 'محصولات طبیعی و ارگانیک اونیوال',
      subtitle: 'تخفیف ویژه سفارش مستقیم از زنبورستان با ارسال سریع',
      imageUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=1600&q=80',
      badge: 'پیشنهاد ویژه',
      buttonText: 'مشاهده و خرید آنلاین',
      buttonLink: '#products',
      gradientOverlay: 'from-amber-950/80 via-slate-900/60 to-transparent',
      enabled: true,
    };
    setContent(prev => ({
      ...prev,
      topBanners: [...(prev.topBanners || []), newBanner]
    }));
    setIsDirty(true);
  };

  const handleRemoveBanner = (index: number) => {
    const list = [...(content.topBanners || [])];
    list.splice(index, 1);
    setContent(prev => ({ ...prev, topBanners: list }));
    setIsDirty(true);
  };

  const handleBannerImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          handleUpdateBanner(index, { imageUrl: reader.result });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Topics management
  const handleAddTopic = () => {
    if (!newTopicInput.trim()) return;
    const title = newTopicInput.trim();
    const current = content.consultationTopics || [];
    const basePrice = content.consultationConfig?.basePrice ?? 120000;
    const existingTopics = content.consultationConfig?.topics || [];
    const newTopicObj = {
      id: `topic-${Date.now()}`,
      title,
      description: 'مشاوره تخصصی با کارشناس سلامت اونیوال',
      price: basePrice,
      durationMinutes: 30,
      enabled: true
    };
    setContent(prev => ({
      ...prev,
      consultationTopics: [...current, title],
      consultationConfig: {
        basePrice,
        timeSlots: prev.consultationConfig?.timeSlots || [
          'نوبت صبح (۰۹:۰۰ الی ۱۲:۰۰)',
          'نوبت ظهر (۱۲:۰۰ الی ۱۵:۰۰)',
          'نوبت عصر (۱۶:۰۰ الی ۱۹:۰۰)',
          'نوبت شب (۱۹:۰۰ الی ۲۱:۰۰)'
        ],
        socialPlatforms: prev.consultationConfig?.socialPlatforms || [],
        ...(prev.consultationConfig || {}),
        topics: [...existingTopics, newTopicObj]
      }
    }));
    setIsDirty(true);
    setNewTopicInput('');
  };

  const handleRemoveTopic = (indexToRemove: number) => {
    const current = content.consultationTopics || [];
    const removedTitle = current[indexToRemove];
    const updatedStrings = current.filter((_, idx) => idx !== indexToRemove);
    setContent(prev => ({
      ...prev,
      consultationTopics: updatedStrings,
      consultationConfig: prev.consultationConfig
        ? {
            ...prev.consultationConfig,
            topics: (prev.consultationConfig.topics || []).filter(t => t.title !== removedTitle)
          }
        : undefined
    }));
    setIsDirty(true);
  };

  const handleSaveClick = async () => {
    try {
      setIsSaving(true);
      setErrorToast(null);
      await onSave(content);
      setIsDirty(false);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 4000);
    } catch (err) {
      console.error(err);
      setErrorToast('خطا در ذخیره‌سازی محتوا');
      setTimeout(() => setErrorToast(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetClick = async () => {
    try {
      setIsResetting(true);
      setErrorToast(null);
      await onReset();
      setIsDirty(false);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 4000);
    } catch (err) {
      console.error(err);
      setErrorToast('خطا در بازگردانی تنظیمات به پیش‌فرض');
      setTimeout(() => setErrorToast(null), 4000);
    } finally {
      setIsResetting(false);
    }
  };

  const subTabs = [
    { id: 'brand-header', label: 'سربرگ و برند', icon: Type },
    { id: 'top-banner', label: 'اسلایدر بنر متحرک بالای صفحه', icon: ImageIcon, badge: 'ویژه' },
    { id: 'sections-order', label: 'چیدمان و موقعیت بخش‌ها', icon: Layers, badge: `${content.homeSections?.length || 5} بخش` },
    { id: 'nav-tabs', label: 'عناوین تب‌های ناوبری', icon: Sliders },
    { id: 'home-content', label: 'محتوای صفحه اصلی', icon: Sparkles },
    { id: 'consultation', label: 'صفحه مشاوره تخصصی', icon: HelpCircle },
    { id: 'tracking', label: 'صفحه پیگیری سفارش', icon: ShieldCheck },
    { id: 'about', label: 'صفحه درباره ما', icon: Info },
    { id: 'contact', label: 'تماس با ما، فوتر و فوت‌نت', icon: Phone },
    { id: 'terms-refund', label: 'قوانین و رویه مرجوعی (ترب/اینماد)', icon: FileText, badge: 'الزامی' },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60">
              <Sliders className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              اصلاح صفحات، تیترها و چیدمان فروشگاه
            </h1>
            {isDirty && (
              <span className="text-[11px] bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-full animate-pulse">
                تغییرات ذخیره نشده
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            شخصی‌سازی زنده متون، عنوان‌ها، تراز متن‌ها، چیدمان و ترتیب بخش‌ها در فروشگاه و پنل مدیریت
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            id="btn-preview-storefront"
            onClick={handlePreview}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Eye className="w-4 h-4 text-amber-600" />
            <span>مشاهده در فروشگاه</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            id="btn-reset-defaults"
            onClick={handleResetClick}
            disabled={isResetting || isSaving}
            className="px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
            <span>{isResetting ? 'در حال بازنشانی...' : 'بازنشانی به پیش‌فرض'}</span>
          </button>

          <button
            id="btn-save-content"
            onClick={handleSaveClick}
            disabled={isSaving || isResetting}
            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
            <span>{isSaving ? 'در حال ثبت تغییرات...' : 'ثبت و اعمال تغییرات'}</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {showSuccessToast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-5 py-3.5 rounded-2xl flex items-center justify-between text-xs font-bold shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <span>تغییرات با موفقیت ذخیره گردید و بلافاصله در تمام صفحات فروشگاه و پنل مدیریت اعمال شد!</span>
          </div>
          <button
            onClick={onViewStorefront}
            className="underline hover:text-emerald-950 font-black cursor-pointer mr-2"
          >
            دیدن فروشگاه &larr;
          </button>
        </div>
      )}

      {/* Error Notification Banner */}
      {errorToast && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-5 py-3.5 rounded-2xl flex items-center justify-between text-xs font-bold shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
              ✕
            </div>
            <span>{errorToast}</span>
          </div>
          <button
            onClick={() => setErrorToast(null)}
            className="text-rose-600 hover:text-rose-950 font-black cursor-pointer mr-2"
          >
            بستن ×
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {subTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as EditorSubTab)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100/80 border border-slate-200/80'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[10px] px-2 py-0.5 rounded-md ${
                  isActive ? 'bg-slate-800 text-amber-300' : 'bg-slate-100 text-slate-600'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sub-tab 1: Brand & Main Header */}
      {activeSubTab === 'brand-header' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-black text-slate-800">هویت برند و تیتر سربرگ</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                نام فروشگاه، شعار و عنوان شاخصی که در بالای تمام صفحات نمایش داده می‌شود.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">نام برند (فارسی):</label>
                <input
                  type="text"
                  value={content.brandName}
                  onChange={e => handleFieldChange('brandName', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:outline-amber-500 transition"
                  placeholder="مثلاً: اونیوال"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">نام برند (انگلیسی / لاتین):</label>
                <input
                  type="text"
                  value={content.brandEnglishName}
                  onChange={e => handleFieldChange('brandEnglishName', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:outline-amber-500 transition font-mono"
                  placeholder="مثلاً: ONIVAL"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                پیشوند تیتر سربرگ صفحه اصلی:
              </label>
              <input
                type="text"
                value={content.heroTitlePrefix}
                onChange={e => handleFieldChange('heroTitlePrefix', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 focus:bg-white focus:outline-amber-500 transition"
                placeholder="مثلاً: فروشگاه تخصصی"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                ترکیب نهایی: {content.heroTitlePrefix} {content.brandName} ({content.brandEnglishName})
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                زیرعنوان و توضیحات سربرگ صفحه اصلی:
              </label>
              <textarea
                rows={3}
                value={content.heroSubtitle}
                onChange={e => handleFieldChange('heroSubtitle', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs leading-relaxed text-slate-800 focus:bg-white focus:outline-amber-500 transition"
                placeholder="توضیحات معرفی فروشگاه در زیر تیتر اصلی..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                موقعیت تراز متن سربرگ:
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleFieldChange('heroAlign', 'right')}
                  className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                    content.heroAlign === 'right'
                      ? 'border-amber-500 bg-amber-50 text-amber-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <AlignRight className="w-4 h-4" />
                  <span>راست‌چین</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleFieldChange('heroAlign', 'center')}
                  className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                    content.heroAlign === 'center'
                      ? 'border-amber-500 bg-amber-50 text-amber-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <AlignCenter className="w-4 h-4" />
                  <span>وسط‌چین (پیش‌فرض)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleFieldChange('heroAlign', 'left')}
                  className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                    content.heroAlign === 'left'
                      ? 'border-amber-500 bg-amber-50 text-amber-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <AlignLeft className="w-4 h-4" />
                  <span>چپ‌چین</span>
                </button>
              </div>
            </div>

            {/* Optional English Badge Toggle (ONIVAL box opposite hero title) */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="block text-xs font-black text-slate-800">
                  نمایش باکس کوچک لاتین برند ({content.brandEnglishName || 'ONIVAL'}) روبه‌روی تیتر اصلی:
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  کادر کوچک انگلیسی که رو به روی تیتر اصلی فروشگاه قرار دارد. می‌توانید آن را خاموش یا روشن کنید.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer shrink-0 bg-white px-3.5 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                <span className="text-xs font-bold text-slate-700">
                  {(content.showHeroEnglishBadge ?? true) ? 'فعال (نمایش)' : 'غیرفعال (مخفی)'}
                </span>
                <input
                  type="checkbox"
                  checked={content.showHeroEnglishBadge ?? true}
                  onChange={e => handleFieldChange('showHeroEnglishBadge', e.target.checked)}
                  className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                شعار پنل ادمین و نوار بالا:
              </label>
              <input
                type="text"
                value={content.systemTagline}
                onChange={e => handleFieldChange('systemTagline', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:bg-white focus:outline-amber-500 transition"
              />
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="bg-slate-900 rounded-3xl p-6 text-white flex flex-col justify-between border border-slate-800 shadow-md">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                <span className="text-xs font-mono font-bold text-amber-400">پیش‌نمایش زنده سربرگ</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>

              <div 
                className={`bg-slate-800/80 p-6 rounded-2xl border border-slate-700/60 ${
                  content.heroAlign === 'right' 
                    ? 'text-right' 
                    : content.heroAlign === 'left' 
                    ? 'text-left' 
                    : 'text-center'
                }`}
              >
                <h3 className="text-2xl font-black tracking-tight flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                  <span className="text-slate-100">{content.heroTitlePrefix || 'فروشگاه تخصصی'}</span>
                  <span className="text-amber-400">{content.brandName || 'اونیوال'}</span>
                  {(content.showHeroEnglishBadge ?? true) && (
                    <span className="text-[10px] font-mono font-bold text-slate-400 border border-slate-600 px-2 py-0.5 rounded">
                      {content.brandEnglishName || 'ONIVAL'}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                  {content.heroSubtitle || 'توضیحات سربرگ'}
                </p>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div>✓ اعمال بر روی صفحه اصلی مشتری</div>
              <div>✓ وضعیت کادر لاتین: {(content.showHeroEnglishBadge ?? true) ? 'نمایش داده می‌شود' : 'مخفی است'}</div>
              <div>✓ موقعیت تراز: {content.heroAlign === 'right' ? 'راست' : content.heroAlign === 'left' ? 'چپ' : 'وسط'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab: Top Banner Slider Settings & Images */}
      {activeSubTab === 'top-banner' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & Main Toggle Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                    <ImageIcon className="w-5 h-5" />
                  </span>
                  <h2 className="text-base font-black text-slate-800">
                    اسلایدر و بنر متحرک بالای صفحه (زیر بردر پیشنهاد شگفت‌انگیز)
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  عکس‌های بنر با زمان‌بندی استاندارد به صورت خودکار جابه‌جا می‌شوند. امکان تغییر ثانیه‌های سوییچ، تصاویر، عناوین و لینک‌ها.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-xs font-black text-slate-800">
                    {(content.topBannerSettings?.enabled ?? true) ? 'اسلایدر فعال است' : 'اسلایدر غیرفعال'}
                  </span>
                  <input
                    type="checkbox"
                    checked={content.topBannerSettings?.enabled ?? true}
                    onChange={e => handleToggleBannerEnabled(e.target.checked)}
                    className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Rotation Controls (Fixed standard 4s) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  چرخش اتوماتیک بنرها (زمان‌بندی ثابت ۴ ثانیه):
                </label>
                <div className="flex items-center gap-2 mt-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={content.topBannerSettings?.autoRotate ?? true}
                      onChange={e => handleToggleBannerAutoRotate(e.target.checked)}
                      className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                    />
                    <span className="text-xs text-slate-700 font-semibold">
                      {(content.topBannerSettings?.autoRotate ?? true) ? 'جابه‌جایی خودکار روشن (هر ۴ ثانیه)' : 'فقط با کلیک فلش‌ها'}
                    </span>
                  </label>
                </div>
                <span className="text-[10px] text-slate-400 mt-2 block">اسلایدها بر اساس زمان استاندارد ۴ ثانیه جابه‌جا می‌شوند. با نگه داشتن ماوس یا لمس روی بنر، چرخش موقتاً مکث می‌کند.</span>
              </div>

              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    تعداد اسلایدهای بنر:
                  </label>
                  <span className="text-xl font-black text-amber-600">
                    {(content.topBanners || []).length} بنر فعال
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddBanner}
                  className="mt-2 w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن اسلاید بنر جدید</span>
                </button>
              </div>
            </div>
          </div>

          {/* Banner Slides List */}
          <div className="space-y-4">
            {(content.topBanners || []).map((banner, index) => (
              <div
                key={banner.id || index}
                className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-slate-200/90 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-amber-500 text-white font-black text-xs flex items-center justify-center shadow-xs">
                      {index + 1}
                    </span>
                    <h3 className="text-sm font-black text-slate-800">
                      اسلاید بنر شماره {index + 1}: {banner.title || 'بدون تیتر'}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRemoveBanner(index)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف این بنر</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Left Column: Image Preview & URL */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-700">تصویر بنر:</label>
                    <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-inner group">
                      <img
                        src={banner.imageUrl}
                        alt={banner.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=1600&q=80';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2.5">
                        <span className="text-[10px] text-white font-bold bg-black/40 px-2 py-0.5 rounded backdrop-blur-xs">
                          {banner.badge || 'بنر تبلیغاتی'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          dir="ltr"
                          value={banner.imageUrl}
                          onChange={e => handleUpdateBanner(index, { imageUrl: e.target.value })}
                          className="flex-1 min-w-0 px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-amber-500"
                          placeholder="https://..."
                        />
                        <label className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1 shrink-0">
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>آپلود عکس</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => handleBannerImageUpload(index, e)}
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="text-[10px] text-slate-400">عکس‌های پیشنهادی:</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateBanner(index, { imageUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=1600&q=80' })}
                          className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded hover:bg-amber-100 cursor-pointer"
                        >
                          عسل سبلان
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateBanner(index, { imageUrl: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=1600&q=80' })}
                          className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded hover:bg-amber-100 cursor-pointer"
                        >
                          شهد طبیعی
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateBanner(index, { imageUrl: 'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?auto=format&fit=crop&w=1600&q=80' })}
                          className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded hover:bg-amber-100 cursor-pointer"
                        >
                          گیاهان دارویی
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right 2 Columns: Title, Subtitle, Button, Badge */}
                  <div className="lg:col-span-2 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">تیتر اصلی بنر:</label>
                        <input
                          type="text"
                          value={banner.title}
                          onChange={e => handleUpdateBanner(index, { title: e.target.value })}
                          className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-amber-500"
                          placeholder="مثلاً: جشنواره تابستانه عسل طبیعی سبلان"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">برچسب کوچک بالای تیتر (Badge):</label>
                        <input
                          type="text"
                          value={banner.badge || ''}
                          onChange={e => handleUpdateBanner(index, { badge: e.target.value })}
                          className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-amber-500"
                          placeholder="مثلاً: تخفیف ویژه ۴۰٪ یا تضمین کیفیت"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">زیرعنوان و توضیحات بنر:</label>
                      <textarea
                        rows={2}
                        value={banner.subtitle || ''}
                        onChange={e => handleUpdateBanner(index, { subtitle: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-amber-500"
                        placeholder="توضیح کوتاه و جذاب در مورد پیشنهاد..."
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">متن دکمه بنر:</label>
                        <input
                          type="text"
                          value={banner.buttonText || ''}
                          onChange={e => handleUpdateBanner(index, { buttonText: e.target.value })}
                          className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-amber-500"
                          placeholder="مثلاً: مشاهده و خرید آنلاین"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">لینک دکمه (آدرس یا آیدی سکشن):</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={banner.buttonLink || ''}
                          onChange={e => handleUpdateBanner(index, { buttonLink: e.target.value })}
                          className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-amber-500"
                          placeholder="#products یا /products یا لینک کامل"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {(content.topBanners || []).length === 0 && (
              <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-slate-300">
                <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">هنوز هیچ اسلاید بنری ثبت نشده است.</p>
                <button
                  type="button"
                  onClick={handleAddBanner}
                  className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition cursor-pointer"
                >
                  افزودن اولین اسلاید بنر
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-tab 2: Sections Layout & Reordering */}
      {activeSubTab === 'sections-order' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 space-y-6 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-black text-slate-800">چیدمان، موقعیت و اولویت بخش‌های صفحه اصلی</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                می‌توانید ترتیب قرارگیری سکشن‌ها را بالا/پایین ببرید، عنوان آن‌ها را تغییر دهید و یا نمایان/پنهان کنید.
              </p>
            </div>
            <span className="text-xs bg-amber-50 text-amber-800 font-bold px-3 py-1 rounded-full border border-amber-200 self-start sm:self-auto">
              {content.homeSections.filter(s => s.enabled).length} بخش فعال از {content.homeSections.length}
            </span>
          </div>

          <div className="space-y-4">
            {content.homeSections.map((sec, index) => (
              <div
                key={sec.id}
                className={`p-5 rounded-2xl border transition ${
                  sec.enabled
                    ? 'bg-white border-slate-200 shadow-xs hover:border-amber-300'
                    : 'bg-slate-50/70 border-slate-200/60 opacity-60'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Reorder Controls & Index */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 font-black text-slate-700 text-xs flex items-center justify-center shrink-0 border border-slate-200">
                      {index + 1}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveSection(index, 'up')}
                        disabled={index === 0}
                        title="انتقال به بالا"
                        className="p-2 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-800 disabled:opacity-30 disabled:hover:bg-slate-100 disabled:hover:text-slate-700 transition cursor-pointer"
                      >
                        <MoveUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSection(index, 'down')}
                        disabled={index === content.homeSections.length - 1}
                        title="انتقال به پایین"
                        className="p-2 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-800 disabled:opacity-30 disabled:hover:bg-slate-100 disabled:hover:text-slate-700 transition cursor-pointer"
                      >
                        <MoveDown className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <span className="text-[11px] font-mono text-slate-400 block">شناسه: {sec.id}</span>
                      <span className="text-xs font-black text-slate-800">
                        {sec.id === 'specialOffers' && 'نوار پیشنهاد شگفت‌انگیز'}
                        {sec.id === 'categories' && 'دکمه‌ها و فیلترهای دسته‌بندی'}
                        {sec.id === 'products' && 'لیست محصولات و ویترین کارت‌ها'}
                        {sec.id === 'consultationBanner' && 'باکس معرفی مشاوره تخصصی سلامت'}
                        {sec.id === 'articles' && 'بخش مقالات و وبلاگ علمی'}
                      </span>
                    </div>
                  </div>

                  {/* Middle: Title & Subtitle Editors */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <input
                        type="text"
                        value={sec.title}
                        onChange={e => handleSectionTitleChange(index, e.target.value)}
                        placeholder="عنوان بخش..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-amber-500 bg-white"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={sec.subtitle || ''}
                        onChange={e => handleSectionSubtitleChange(index, e.target.value)}
                        placeholder="زیرعنوان توضیحی بخش..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 focus:outline-amber-500 bg-white"
                      />
                    </div>
                  </div>

                  {/* Right: Align & Visibility */}
                  <div className="flex items-center gap-2 justify-end">
                    {/* Align toggle */}
                    <div className="flex items-center border border-slate-200 rounded-xl p-0.5 bg-slate-50">
                      <button
                        type="button"
                        onClick={() => handleSectionAlignChange(index, 'right')}
                        title="راست‌چین"
                        className={`p-1.5 rounded-lg transition ${
                          sec.align === 'right' ? 'bg-white text-amber-600 shadow-xs' : 'text-slate-400'
                        }`}
                      >
                        <AlignRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSectionAlignChange(index, 'center')}
                        title="وسط‌چین"
                        className={`p-1.5 rounded-lg transition ${
                          sec.align === 'center' ? 'bg-white text-amber-600 shadow-xs' : 'text-slate-400'
                        }`}
                      >
                        <AlignCenter className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSectionAlignChange(index, 'left')}
                        title="چپ‌چین"
                        className={`p-1.5 rounded-lg transition ${
                          sec.align === 'left' ? 'bg-white text-amber-600 shadow-xs' : 'text-slate-400'
                        }`}
                      >
                        <AlignLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Enable / Disable toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleSection(index)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                        sec.enabled
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {sec.enabled ? (
                        <>
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          <span>فعال</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                          <span>مخفی</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-tab 3: Navigation Tab Labels */}
      {activeSubTab === 'nav-tabs' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 space-y-6 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-black text-slate-800">عناوین تب‌های ناوبری بالای صفحه فروشگاه</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              متن کلیدهای ناوبری هدر فروشگاه مشتری را تغییر دهید (مثلاً تغییر نام «مشاوره تخصصی» به «ارتباط با متخصص»).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">عنوان تب صفحه اصلی:</label>
              <input
                type="text"
                value={content.navLabels.home}
                onChange={e => handleNavLabelChange('home', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:outline-amber-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">عنوان تب مقالات و وبلاگ:</label>
              <input
                type="text"
                value={content.navLabels.articles}
                onChange={e => handleNavLabelChange('articles', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:outline-amber-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">عنوان تب مشاوره تخصصی:</label>
              <input
                type="text"
                value={content.navLabels.consultation}
                onChange={e => handleNavLabelChange('consultation', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:outline-amber-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">عنوان تب پیگیری سفارش:</label>
              <input
                type="text"
                value={content.navLabels.tracking}
                onChange={e => handleNavLabelChange('tracking', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:outline-amber-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">عنوان تب درباره ما:</label>
              <input
                type="text"
                value={content.navLabels.about}
                onChange={e => handleNavLabelChange('about', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:outline-amber-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">عنوان تب تماس با ما:</label>
              <input
                type="text"
                value={content.navLabels.contact}
                onChange={e => handleNavLabelChange('contact', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:outline-amber-500 transition"
              />
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 4: Home Sections Content */}
      {activeSubTab === 'home-content' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Special Offers Banner Customizer */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-black text-slate-800">بخش پیشنهاد شگفت‌انگیز (تخفیف‌های استثنایی)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                تنظیم تیتر، متن دکمه و رنگ پس‌زمینه نوار سرخ‌رنگ تخفیف‌های ویژه در صفحه اصلی
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">تیتر نوار تخفیف:</label>
                <input
                  type="text"
                  value={content.specialOffersTitle}
                  onChange={e => handleFieldChange('specialOffersTitle', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:outline-amber-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">متن دکمه مشاهده همه:</label>
                <input
                  type="text"
                  value={content.specialOffersButtonText}
                  onChange={e => handleFieldChange('specialOffersButtonText', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:outline-amber-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">رنگ پس‌زمینه نوار:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={content.specialOffersBgColor || '#ef394e'}
                    onChange={e => handleFieldChange('specialOffersBgColor', e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer border border-slate-200 p-0.5"
                  />
                  <input
                    type="text"
                    value={content.specialOffersBgColor || '#ef394e'}
                    onChange={e => handleFieldChange('specialOffersBgColor', e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-800"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Products Section Customizer */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-black text-slate-800">بخش محصولات و ویترین کارت‌ها</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                تیتر و زیرعنوان بالای گرید کارت‌های محصولات فروشگاه
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">تیتر بخش محصولات:</label>
                <input
                  type="text"
                  value={content.productsSectionTitle}
                  onChange={e => handleFieldChange('productsSectionTitle', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:outline-amber-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">موقعیت تراز عنوان:</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleFieldChange('productsAlign', 'right')}
                    className={`flex-1 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      content.productsAlign === 'right' ? 'bg-amber-50 border-amber-400 text-amber-800' : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                    <span>راست</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFieldChange('productsAlign', 'center')}
                    className={`flex-1 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      content.productsAlign === 'center' ? 'bg-amber-50 border-amber-400 text-amber-800' : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                    <span>وسط</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFieldChange('productsAlign', 'left')}
                    className={`flex-1 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      content.productsAlign === 'left' ? 'bg-amber-50 border-amber-400 text-amber-800' : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                    <span>چپ</span>
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-2">توضیحات و زیرعنوان بخش محصولات:</label>
                <input
                  type="text"
                  value={content.productsSectionSubtitle}
                  onChange={e => handleFieldChange('productsSectionSubtitle', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:bg-white focus:outline-amber-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Articles Section & Page Customizer */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-black text-slate-800">بخش و صفحه مقالات و وبلاگ</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                تنظیم متون بخش مقالات در صفحه اول و صفحه اختصاصی مقالات
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">تیتر مقالات در صفحه اول:</label>
                <input
                  type="text"
                  value={content.articlesSectionTitle}
                  onChange={e => handleFieldChange('articlesSectionTitle', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:outline-amber-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">زیرعنوان مقالات در صفحه اول:</label>
                <input
                  type="text"
                  value={content.articlesSectionSubtitle}
                  onChange={e => handleFieldChange('articlesSectionSubtitle', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:bg-white focus:outline-amber-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">تیتر اصلی صفحه مستقل مقالات:</label>
                <input
                  type="text"
                  value={content.articlesPageTitle}
                  onChange={e => handleFieldChange('articlesPageTitle', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:outline-amber-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">زیرعنوان صفحه مستقل مقالات:</label>
                <input
                  type="text"
                  value={content.articlesPageSubtitle}
                  onChange={e => handleFieldChange('articlesPageSubtitle', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:bg-white focus:outline-amber-500 transition"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 5: Consultation Page & Topics */}
      {activeSubTab === 'consultation' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 space-y-6 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-black text-slate-800">صفحه و فرم مشاوره تخصصی سلامت</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ویرایش عنوان، نشان بالای فرم و فهرست موضوعات انتخابی که کاربران در فرم مشاوره انتخاب می‌کنند.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">نشان / برچسب بالای فرم:</label>
              <input
                type="text"
                value={content.consultationBadge}
                onChange={e => handleFieldChange('consultationBadge', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:outline-amber-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">موقعیت تراز متن فرم مشاوره:</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleFieldChange('consultationAlign', 'right')}
                  className={`flex-1 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    content.consultationAlign === 'right' ? 'bg-amber-50 border-amber-400 text-amber-800' : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <AlignRight className="w-3.5 h-3.5" />
                  <span>راست</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleFieldChange('consultationAlign', 'center')}
                  className={`flex-1 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    content.consultationAlign === 'center' ? 'bg-amber-50 border-amber-400 text-amber-800' : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                  <span>وسط</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleFieldChange('consultationAlign', 'left')}
                  className={`flex-1 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    content.consultationAlign === 'left' ? 'bg-amber-50 border-amber-400 text-amber-800' : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                  <span>چپ</span>
                </button>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-2">تیتر اصلی فرم مشاوره:</label>
              <input
                type="text"
                value={content.consultationTitle}
                onChange={e => handleFieldChange('consultationTitle', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:outline-amber-500 transition"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-2">زیرعنوان توضیحی فرم:</label>
              <textarea
                rows={2}
                value={content.consultationSubtitle}
                onChange={e => handleFieldChange('consultationSubtitle', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:bg-white focus:outline-amber-500 transition leading-relaxed"
              />
            </div>
          </div>

          {/* Consultation Topics Manager */}
          <div className="pt-6 border-t border-slate-100">
            <h3 className="text-xs font-black text-slate-800 mb-1">مدیریت موضوعات پیش‌فرض منوی کشویی مشاوره:</h3>
            <p className="text-[11px] text-slate-400 mb-3">
              کاربران هنگام ثبت پیام مشاوره، یکی از این موضوعات را از منوی کشویی انتخاب می‌کنند:
            </p>

            {/* Add Topic Bar */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newTopicInput}
                onChange={e => setNewTopicInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTopic()}
                placeholder="افزودن موضوع جدید (مثلاً: مشاوره ژل رویال برای بارداری)..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-amber-500"
              />
              <button
                type="button"
                onClick={handleAddTopic}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>افزودن</span>
              </button>
            </div>

            {/* Topics List */}
            <div className="space-y-2">
              {content.consultationTopics && content.consultationTopics.map((topic, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-800"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span>{topic}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveTopic(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                    title="حذف موضوع"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 6: Tracking Page */}
      {activeSubTab === 'tracking' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 space-y-6 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-black text-slate-800">صفحه پیگیری سفارش و استعلام پیام</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              تنظیم تیتر و متن راهنمای صفحه استعلام کد رهگیری فاکتور خرید و پیام مشاوره
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">تیتر اصلی صفحه پیگیری:</label>
              <input
                type="text"
                value={content.trackingTitle}
                onChange={e => handleFieldChange('trackingTitle', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:outline-amber-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">موقعیت تراز متن:</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleFieldChange('trackingAlign', 'right')}
                  className={`flex-1 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    content.trackingAlign === 'right' ? 'bg-amber-50 border-amber-400 text-amber-800' : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <AlignRight className="w-3.5 h-3.5" />
                  <span>راست</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleFieldChange('trackingAlign', 'center')}
                  className={`flex-1 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    content.trackingAlign === 'center' ? 'bg-amber-50 border-amber-400 text-amber-800' : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                  <span>وسط</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleFieldChange('trackingAlign', 'left')}
                  className={`flex-1 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    content.trackingAlign === 'left' ? 'bg-amber-50 border-amber-400 text-amber-800' : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                  <span>چپ</span>
                </button>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-2">متن راهنمای وارد کردن کد:</label>
              <textarea
                rows={2}
                value={content.trackingSubtitle}
                onChange={e => handleFieldChange('trackingSubtitle', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:bg-white focus:outline-amber-500 transition leading-relaxed"
              />
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 7: About Page */}
      {activeSubTab === 'about' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 space-y-6 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-black text-slate-800">صفحه درباره ما (معرفی برند و داستان فروشگاه)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              متن‌ها، داستان زنبورداری و آمار افتخارات که در صفحه «درباره ما» نمایش داده می‌شوند.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">عنوان اصلی صفحه درباره ما:</label>
            <input
              type="text"
              value={content.aboutTitle}
              onChange={e => handleFieldChange('aboutTitle', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:outline-amber-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">پاراگراف اول (معرفی و رسالت):</label>
            <textarea
              rows={3}
              value={content.aboutParagraph1}
              onChange={e => handleFieldChange('aboutParagraph1', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs leading-relaxed text-slate-800 focus:bg-white focus:outline-amber-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">پاراگراف دوم (تضمین کیفیت و اصالت):</label>
            <textarea
              rows={3}
              value={content.aboutParagraph2}
              onChange={e => handleFieldChange('aboutParagraph2', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs leading-relaxed text-slate-800 focus:bg-white focus:outline-amber-500 transition"
            />
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-xs font-black text-slate-800 mb-3">باکس‌های آمار و افتخارات شاخص:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <label className="text-[11px] font-bold text-slate-500 block">آمار اول (ارزش و عنوان):</label>
                <input
                  type="text"
                  value={content.aboutStat1Value}
                  onChange={e => handleFieldChange('aboutStat1Value', e.target.value)}
                  placeholder="۱۰۰٪"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-black text-emerald-600 bg-white"
                />
                <input
                  type="text"
                  value={content.aboutStat1Label}
                  onChange={e => handleFieldChange('aboutStat1Label', e.target.value)}
                  placeholder="طبیعی و آزمایش‌شده"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white"
                />
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <label className="text-[11px] font-bold text-slate-500 block">آمار دوم (ارزش و عنوان):</label>
                <input
                  type="text"
                  value={content.aboutStat2Value}
                  onChange={e => handleFieldChange('aboutStat2Value', e.target.value)}
                  placeholder="۷ روز"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-black text-amber-600 bg-white"
                />
                <input
                  type="text"
                  value={content.aboutStat2Label}
                  onChange={e => handleFieldChange('aboutStat2Label', e.target.value)}
                  placeholder="ضمانت اصالت"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white"
                />
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <label className="text-[11px] font-bold text-slate-500 block">آمار سوم (ارزش و عنوان):</label>
                <input
                  type="text"
                  value={content.aboutStat3Value || ''}
                  onChange={e => handleFieldChange('aboutStat3Value', e.target.value)}
                  placeholder="+۱۵ سال"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-black text-blue-600 bg-white"
                />
                <input
                  type="text"
                  value={content.aboutStat3Label || ''}
                  onChange={e => handleFieldChange('aboutStat3Label', e.target.value)}
                  placeholder="سابقه تخصصی"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 8: Contact Page & Footer */}
      {activeSubTab === 'contact' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 space-y-6 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-black text-slate-800">اطلاعات تماس با ما و کپی‌رایت فوتر</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              آدرس، شماره تماس، ساعات کاری و متن انتهای تمام صفحات فروشگاه
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">عنوان اصلی صفحه تماس:</label>
              <input
                type="text"
                value={content.contactTitle}
                onChange={e => handleFieldChange('contactTitle', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:outline-amber-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">شماره تلفن‌ها و پشتیبانی:</label>
              <input
                type="text"
                value={content.contactPhone}
                onChange={e => handleFieldChange('contactPhone', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:bg-white focus:outline-amber-500 transition"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-2">آدرس پستی و موقعیت دفتر مرکزی:</label>
              <input
                type="text"
                value={content.contactAddress}
                onChange={e => handleFieldChange('contactAddress', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:bg-white focus:outline-amber-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">ساعات پاسخگویی و کاری:</label>
              <input
                type="text"
                value={content.contactWorkingHours}
                onChange={e => handleFieldChange('contactWorkingHours', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:bg-white focus:outline-amber-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">ایمیل سازمانی و پشتیبانی:</label>
              <input
                type="email"
                value={content.contactEmail}
                onChange={e => handleFieldChange('contactEmail', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:bg-white focus:outline-amber-500 transition"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-2">متن کپی‌رایت فوتر فروشگاه:</label>
              <input
                type="text"
                value={content.footerCopyright}
                onChange={e => handleFieldChange('footerCopyright', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:bg-white focus:outline-amber-500 transition"
              />
            </div>

            <div className="sm:col-span-2 p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
              <label className="block text-xs font-black text-amber-900 mb-1">
                متن فوت‌نت (Footnote) پایین صفحه (پاورقی ثابت تمامی صفحات):
              </label>
              <textarea
                rows={2}
                value={content.footerFootnote || ''}
                onChange={e => handleFieldChange('footerFootnote', e.target.value)}
                placeholder="فروشگاه تخصصی فرآورده‌های ارگانیک کوهستان و کندو • تضمین برگه آزمایشگاهی و اصالت ۱۰۰٪..."
                className="w-full px-4 py-2.5 rounded-xl border border-amber-300 bg-white text-xs text-slate-800 focus:outline-amber-500 transition leading-relaxed"
              />
              <span className="text-[11px] text-amber-800 block">
                این متن در انتهای تمام صفحات سایت بالای کپی‌رایت و دکمه‌های فوتر به عنوان فوت‌نت ثابت به مخاطبان نمایش داده می‌شود.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 9: Terms & Conditions and Refund Policy */}
      {activeSubTab === 'terms-refund' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 space-y-6 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                <span>ویرایش متن صفحات قوانین و مقررات و رویه مرجوعی کالا</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                وجود این دو صفحه و شفافیت شرایط خرید برای تایید و اتصال در <strong>ترب</strong>، <strong>ایمالز</strong> و <strong>اینماد</strong> الزامی است.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/terms"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200 font-bold flex items-center gap-1"
              >
                <span>مشاهده صفحه قوانین</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="/refund"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200 font-bold flex items-center gap-1"
              >
                <span>مشاهده صفحه مرجوعی</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="space-y-6">
            {/* Terms Section */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>۱. متن صفحه قوانین و مقررات خرید (/terms):</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">Route: /terms</span>
              </div>
              <input
                type="text"
                value={content.termsTitle || ''}
                onChange={e => handleFieldChange('termsTitle', e.target.value)}
                placeholder="عنوان صفحه قوانین (مثال: قوانین، مقررات و رویه خرید از فروشگاه اونیوال)"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-amber-500 transition"
              />
              <textarea
                rows={6}
                value={content.termsContent || ''}
                onChange={e => handleFieldChange('termsContent', e.target.value)}
                placeholder="متن کامل بندهای قوانین، شرایط سفارش، اصالت و حریم خصوصی..."
                className="w-full p-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-amber-500 transition leading-relaxed font-sans"
              />
            </div>

            {/* Refund Section */}
            <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-amber-600" />
                  <span>۲. متن صفحه شرایط بازگشت کالا و رویه مرجوعی (/refund):</span>
                </label>
                <span className="text-[10px] text-amber-800 font-mono">Route: /refund</span>
              </div>
              <input
                type="text"
                value={content.refundTitle || ''}
                onChange={e => handleFieldChange('refundTitle', e.target.value)}
                placeholder="عنوان صفحه مرجوعی (مثال: شرایط بازگشت کالا و رویه مرجوعی ۷ روزه)"
                className="w-full px-4 py-2.5 rounded-xl border border-amber-200 bg-white text-xs font-bold text-slate-800 focus:outline-amber-500 transition"
              />
              <textarea
                rows={6}
                value={content.refundContent || ''}
                onChange={e => handleFieldChange('refundContent', e.target.value)}
                placeholder="توضیحات فرآیند عودت کالا، ضمانت اصالت، آزمایشگاه و واریز وجه مرجوعی..."
                className="w-full p-4 rounded-xl border border-amber-200 bg-white text-xs text-slate-800 focus:outline-amber-500 transition leading-relaxed font-sans"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

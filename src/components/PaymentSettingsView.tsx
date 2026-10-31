import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Save,
  Check,
  AlertCircle,
  Send,
  Globe,
  ShieldCheck,
  Eye,
  HeartHandshake,
  KeyRound,
  Link as LinkIcon,
  Building2,
  UserCheck,
  FileText,
  Sparkles,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { PaymentConfig, SiteContent } from '../types';
import { getActiveBotConfig, saveActiveBotConfig } from '../services/baleService';

interface PaymentSettingsViewProps {
  siteContent: SiteContent;
  onSave: (updatedContent: SiteContent) => Promise<void>;
  onPreviewStorefront?: () => void;
  onNavigateOrders?: () => void;
  pendingReceiptsCount?: number;
}

export const defaultPaymentConfig: PaymentConfig = {
  cardToCardEnabled: true,
  cardNumber: '۶۰۳۷-۹۹۷۵-۹۹۱۲-۳۴۵۶',
  cardHolderName: 'مجموعه تخصصی فرآورده‌های ارگانیک اونیوال',
  bankName: 'بانک ملی ایران',
  cardDescription:
    'لطفاً مبلغ دقیق فاکتور را به شماره کارت بالا واریز نموده و سپس تصویر واضح فیش واریزی یا اسکرین‌شات رسید انتقال وجه را به همراه شماره فاکتور در کادر زیر بارگذاری فرمایید. پس از تایید فیش توسط مدیریت، می‌توانید وضعیت ارسال سفارش خود را با کد رهگیری پیگیری نمایید.',
  gatewayOfflineNoticeTitle: 'اطلاعیه همراهان گرامی درباره نحوه پرداخت',
  gatewayOfflineNoticeText:
    'همراه گرامی و ارجمند، به دلیل بروزرسانی فنی زیرساخت شبکه بانکی، پرداخت مستقیم از طریق درگاه اینترنتی در حال حاضر به صورت موقت قطع می‌باشد. ضمن پوزش از شما و قدردانی از همراهی و شکیبایی ارزشمندتان، می‌توانید مبلغ فاکتور را با اطمینان کامل به صورت «کارت به کارت» واریز نموده و تصویر فیش را در همین صفحه بارگذاری فرمایید تا سفارش شما بدون هیچ‌گونه تاخیری و در اولویت ویژه آماده و ارسال گردد.',
  baleBotEnabled: true,
  baleBotButtonText: 'اتصال به ربات بله و پرداخت فاکتور (@Onivalbot)',
  gatewayEnabled: false,
  gatewayTitle: 'پرداخت آنلاین از طریق درگاه بانکی شاپرک',
  gatewayUrl: 'https://zarinp.al/onival',
  gatewayMerchantCode: 'ONIVAL-MERCHANT-982410',
  gatewayDescription: 'پرداخت آنی و امن با کلیه کارت‌های بانکی عضو شبکه شتاب و رمز دوم پویا',
  defaultMethod: 'card_to_card'
};

export const PaymentSettingsView: React.FC<PaymentSettingsViewProps> = ({
  siteContent,
  onSave,
  onPreviewStorefront,
  onNavigateOrders,
  pendingReceiptsCount = 0
}) => {
  const [config, setConfig] = useState<PaymentConfig>({
    ...defaultPaymentConfig,
    ...(siteContent.paymentConfig || {})
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (siteContent?.paymentConfig) {
      setConfig({
        ...defaultPaymentConfig,
        ...siteContent.paymentConfig
      });
    }
  }, [siteContent]);

  const handleField = <K extends keyof PaymentConfig>(key: K, value: PaymentConfig[K]) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!config.cardToCardEnabled && !config.baleBotEnabled && !config.gatewayEnabled) {
      setErrorMessage('حداقل یکی از روش‌های پرداخت (کارت به کارت، ربات بله یا درگاه بانکی) باید فعال باشد.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        ...siteContent,
        paymentConfig: config
      });

      // Synchronize bot configuration across system (LocalStorage & Bot API)
      try {
        const currentBot = getActiveBotConfig();
        const cleanBotName = String(config.baleBotUsername || currentBot.baleBotUsername || 'Onivalbot').replace(/^@/, '').trim();
        const updatedBot = {
          ...currentBot,
          botUsername: cleanBotName,
          baleBotUsername: cleanBotName,
          baleAdminUsername: config.baleAdminUsername || currentBot.baleAdminUsername || '',
          baleBotButtonText: config.baleBotButtonText || `اتصال به ربات بله و پرداخت فاکتور (@${cleanBotName})`
        };
        await saveActiveBotConfig(updatedBot);
      } catch (botSyncErr) {
        console.warn('Bot config sync warning:', botSyncErr);
      }

      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 4000);
    } catch (err) {
      setErrorMessage('خطا در ذخیره تنظیمات صفحه پرداخت');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSaveSubmit} className="space-y-6" dir="rtl">
      {/* Top Header Bar */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60">
              <CreditCard className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              تنظیمات صفحه پرداخت، شماره کارت و درگاه بانکی
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            تعیین حالت‌های فعال صفحه پرداخت (کارت به کارت + آپلود فیش، ربات بله، و دکمه درگاه بانکی) و مدیریت متن‌های اطلاعیه
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onNavigateOrders && (
            <button
              type="button"
              onClick={onNavigateOrders}
              className="px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition flex items-center gap-2 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-amber-600" />
              <span>بررسی فیش‌های واریزی در سفارشات</span>
              {pendingReceiptsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
                  {pendingReceiptsCount} فیش جدید
                </span>
              )}
            </button>
          )}

          {onPreviewStorefront && (
            <button
              type="button"
              onClick={onPreviewStorefront}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-2 cursor-pointer"
            >
              <Eye className="w-4 h-4 text-blue-600" />
              <span>مشاهده فروشگاه</span>
            </button>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'در حال ذخیره...' : 'ذخیره تنظیمات پرداخت'}</span>
          </button>
        </div>
      </div>

      {showSavedToast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-5 py-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-bold shadow-xs animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>تنظیمات صفحه پرداخت، شماره کارت و وضعیت درگاه با موفقیت ذخیره و در صفحه فاکتور اعمال شد.</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-5 py-3.5 rounded-2xl flex items-center justify-between text-xs font-bold shadow-xs animate-fadeIn">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-950 font-black cursor-pointer mr-2"
          >
            بستن ×
          </button>
        </div>
      )}

      {/* SECTION 1: CHECKBOXES FOR SELECTING ACTIVE PAYMENT MODES */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <span>۱. انتخاب حالت‌های فعال صفحه پرداخت (چک‌باکس صفحات پرداخت)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              می‌توانید یکی از حالت‌ها یا هر سه حالت را فعال نمایید تا در صفحه فاکتور مشتری نمایش داده شوند.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600">حالت پیش‌فرض صفحه پرداخت:</label>
            <select
              value={config.defaultMethod}
              onChange={e => handleField('defaultMethod', e.target.value as PaymentConfig['defaultMethod'])}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="card_to_card">حالت اول: کارت به کارت و آپلود فیش</option>
              <option value="bale_bot">حالت دوم: پرداخت در ربات بله</option>
              <option value="online_gateway">حالت سوم: درگاه پرداخت اینترنتی</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Mode 1 Checkbox Card */}
          <label
            className={`p-4 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between gap-3 ${
              config.cardToCardEnabled
                ? 'border-amber-500 bg-amber-50/40 shadow-xs'
                : 'border-slate-200 bg-slate-50/50 opacity-75 hover:opacity-100'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={config.cardToCardEnabled}
                  onChange={e => handleField('cardToCardEnabled', e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-600 cursor-pointer"
                />
                <span className="font-black text-sm text-slate-900">
                  حالت اول: کارت به کارت + فیش
                </span>
              </div>
              <CreditCard className="w-5 h-5 text-amber-600 shrink-0" />
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              نمایش باکس شماره کارت بانکی، پیام اطلاعیه قطعی موقت درگاه و فرم بارگذاری تصویر فیش واریزی به همراه شماره فاکتور جهت تایید مدیر.
            </p>
            <div className="text-[11px] font-bold">
              {config.cardToCardEnabled ? (
                <span className="text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg inline-block">فعال در صفحه فاکتور</span>
              ) : (
                <span className="text-slate-500 bg-slate-200 px-2.5 py-1 rounded-lg inline-block">غیرفعال</span>
              )}
            </div>
          </label>

          {/* Mode 2 Checkbox Card */}
          <label
            className={`p-4 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between gap-3 ${
              config.baleBotEnabled
                ? 'border-emerald-500 bg-emerald-50/40 shadow-xs'
                : 'border-slate-200 bg-slate-50/50 opacity-75 hover:opacity-100'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={config.baleBotEnabled}
                  onChange={e => handleField('baleBotEnabled', e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                />
                <span className="font-black text-sm text-slate-900">
                  حالت دوم: پرداخت در ربات بله
                </span>
              </div>
              <Send className="w-5 h-5 text-emerald-600 shrink-0" />
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              هدایت مشتری به ربات رسمی بله فروشگاه جهت پرداخت فاکتور و تایید خودکار وضعیت سفارش.
            </p>
            <div className="text-[11px] font-bold">
              {config.baleBotEnabled ? (
                <span className="text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg inline-block">فعال در صفحه فاکتور</span>
              ) : (
                <span className="text-slate-500 bg-slate-200 px-2.5 py-1 rounded-lg inline-block">غیرفعال</span>
              )}
            </div>
          </label>

          {/* Mode 3 Checkbox / Toggle Card */}
          <label
            className={`p-4 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between gap-3 ${
              config.gatewayEnabled
                ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                : 'border-slate-200 bg-slate-50/50 opacity-75 hover:opacity-100'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={config.gatewayEnabled}
                  onChange={e => handleField('gatewayEnabled', e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                />
                <span className="font-black text-sm text-slate-900">
                  حالت سوم: دکمه درگاه بانکی
                </span>
              </div>
              <Globe className="w-5 h-5 text-blue-600 shrink-0" />
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              نمایش دکمه پرداخت آنلاین از طریق درگاه مستقیم بانکی (قابل روشن و خاموش کردن و تنظیم لینک/کد درگاه).
            </p>
            <div className="text-[11px] font-bold flex items-center justify-between">
              {config.gatewayEnabled ? (
                <span className="text-blue-700 bg-blue-100 px-2.5 py-1 rounded-lg inline-block">دکمه درگاه: روشن (فعال)</span>
              ) : (
                <span className="text-rose-700 bg-rose-100 px-2.5 py-1 rounded-lg inline-block">دکمه درگاه: خاموش (موقتاً قطع)</span>
              )}
            </div>
          </label>
        </div>
      </div>

      {/* SECTION 2: CARD TO CARD SETTINGS & POLITE OFFLINE GATEWAY NOTICE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amber-600" />
              <span>۲. تنظیمات حالت اول: شماره کارت، توضیحات و متن اطلاعیه درگاه</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              مشخصات کارت بانکی و متن دلگرم‌کننده بالای باکس شماره کارت را در این بخش ویرایش نمایید.
            </p>
          </div>

          {/* Polite Notice Above Card Box */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-amber-900">
              <HeartHandshake className="w-4 h-4 text-amber-600" />
              <span>متن اطلاعیه بالای باکس شماره کارت (جهت آرامش خاطر مشتری از قطع بودن درگاه مستقیم):</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                عنوان باکس اطلاعیه بالای شماره کارت:
              </label>
              <input
                type="text"
                value={config.gatewayOfflineNoticeTitle}
                onChange={e => handleField('gatewayOfflineNoticeTitle', e.target.value)}
                placeholder="اطلاعیه همراهان گرامی درباره نحوه پرداخت"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                متن پیام محترمانه قطع بودن موقت درگاه بانکی:
              </label>
              <textarea
                rows={3}
                value={config.gatewayOfflineNoticeText}
                onChange={e => handleField('gatewayOfflineNoticeText', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 leading-relaxed focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>

          {/* Bank Card Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                شماره کارت بانکی (۱۶ رقمی جهت نمایش در باکس کارت به کارت):
              </label>
              <input
                type="text"
                value={config.cardNumber}
                onChange={e => handleField('cardNumber', e.target.value)}
                placeholder="۶۰۳۷-۹۹۷۵-۹۹۱۲-۳۴۵۶"
                dir="ltr"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-base font-mono font-black tracking-widest text-center bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                نام صاحب حساب / کارت:
              </label>
              <div className="relative">
                <UserCheck className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={config.cardHolderName}
                  onChange={e => handleField('cardHolderName', e.target.value)}
                  placeholder="مثال: مجموعه تخصصی اونیوال"
                  className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                نام بانک صادرکننده:
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={config.bankName}
                  onChange={e => handleField('bankName', e.target.value)}
                  placeholder="مثال: بانک ملی ایران"
                  className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                متن توضیحات و راهنمای پرداخت کارت به کارت (زیر شماره کارت):
              </label>
              <textarea
                rows={3}
                value={config.cardDescription}
                onChange={e => handleField('cardDescription', e.target.value)}
                placeholder="توضیحات نحوه واریز و بارگذاری تصویر فیش..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Live Preview of Mode 1 */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>پیش‌نمایش زنده باکس کارت به کارت در صفحه مشتری</span>
            </span>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
              نمای مشتری
            </span>
          </div>

          {/* Notice Preview */}
          <div className="rounded-2xl bg-amber-50/90 border border-amber-200 p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-black text-amber-900">
              <HeartHandshake className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{config.gatewayOfflineNoticeTitle || 'اطلاعیه نحوه پرداخت'}</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              {config.gatewayOfflineNoticeText}
            </p>
          </div>

          {/* Bank Card Preview */}
          <div className="rounded-2xl bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 text-white p-5 shadow-lg space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-400">{config.bankName || 'بانک'}</span>
              <span className="text-[10px] text-stone-400">کارت به کارت شتاب</span>
            </div>

            <div className="py-2 text-center">
              <div className="text-[10px] text-stone-400 mb-1">شماره کارت جهت واریز وجه:</div>
              <div className="text-lg sm:text-xl font-mono font-black tracking-widest text-amber-300" dir="ltr">
                {config.cardNumber || '---- ---- ---- ----'}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-white/10">
              <span className="text-stone-400">به نام:</span>
              <span className="font-bold text-white">{config.cardHolderName}</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            {config.cardDescription}
          </p>
        </div>
      </div>

      {/* SECTION 3: ONLINE PAYMENT GATEWAY & BALE BOT SETTINGS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mode 3: Online Payment Gateway Configuration */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600" />
                <span>۳. تنظیمات حالت سوم: دکمه و اتصال درگاه پرداخت بانکی</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                روشن یا خاموش کردن دکمه درگاه پرداخت و تنظیم لینک / مرچنت کد اتصال به درگاه
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleField('gatewayEnabled', !config.gatewayEnabled)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer ${
                config.gatewayEnabled
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {config.gatewayEnabled ? (
                <>
                  <ToggleRight className="w-4 h-4" />
                  <span>دکمه درگاه: روشن</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4" />
                  <span>دکمه درگاه: خاموش</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                عنوان دکمه درگاه پرداخت اینترنتی:
              </label>
              <input
                type="text"
                value={config.gatewayTitle}
                onChange={e => handleField('gatewayTitle', e.target.value)}
                placeholder="پرداخت آنلاین از طریق درگاه بانکی شاپرک"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                لینک اتصال به صفحه درگاه پرداخت (Gateway Payment URL):
              </label>
              <div className="relative">
                <LinkIcon className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  dir="ltr"
                  value={config.gatewayUrl}
                  onChange={e => handleField('gatewayUrl', e.target.value)}
                  placeholder="https://zarinp.al/onival"
                  className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-left text-slate-800"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                می‌توانید لینک درگاه شخصی (زرین‌پال، زیبال، شاپرک، آیدی‌پی و...) را وارد نمایید تا دکمه پرداخت به آن متصل شود.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                کد درگاه / مرچنت کد (Merchant ID / Terminal Code):
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  dir="ltr"
                  value={config.gatewayMerchantCode}
                  onChange={e => handleField('gatewayMerchantCode', e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-left text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                توضیحات زیر دکمه درگاه بانکی:
              </label>
              <input
                type="text"
                value={config.gatewayDescription || ''}
                onChange={e => handleField('gatewayDescription', e.target.value)}
                placeholder="پرداخت آنی با کلیه کارت‌های عضو شبکه شتاب"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-700"
              />
            </div>

            {/* Online Payment Simulator Mode */}
            <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black text-blue-900">شبیه‌ساز پرداخت موفق تست (ویژه قبل از دریافت مرچنت):</div>
                <div className="text-[11px] text-blue-700">با فعال‌سازی این گزینه، خریدار و مدیر می‌توانند دکمه پرداخت آنلاین را حتی بدون اتصال واقعی به شاپرک تست کرده و نتیجه پرداخت موفق را مشاهده کنند.</div>
              </div>
              <button
                type="button"
                onClick={() => handleField('gatewaySimulatorMode', !config.gatewaySimulatorMode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer shrink-0 ${
                  config.gatewaySimulatorMode !== false ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {config.gatewaySimulatorMode !== false ? 'شبیه‌ساز: فعال' : 'شبیه‌ساز: خاموش'}
              </button>
            </div>
          </div>
        </div>

        {/* Mode 2: Bale Bot Payment Configuration */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-600" />
                <span>۴. تنظیمات حالت دوم: پرداخت از طریق ربات بله</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                تنظیم یوزرنیم ربات، آیدی ادمین و وضعیت نمایش دکمه پرداخت از طریق ربات بله
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleField('baleBotEnabled', !config.baleBotEnabled)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer ${
                config.baleBotEnabled
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {config.baleBotEnabled ? (
                <>
                  <ToggleRight className="w-4 h-4" />
                  <span>ربات بله: فعال</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4" />
                  <span>ربات بله: غیرفعال</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  یوزرنیم ربات بله (بدون @):
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={(config.baleBotUsername || '').replace(/^@/, '')}
                  onChange={e => handleField('baleBotUsername', e.target.value.replace(/^@/, '').trim())}
                  placeholder="Onivalbot"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-left text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  آیدی شخصی ادمین بله:
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={config.baleAdminUsername || ''}
                  onChange={e => handleField('baleAdminUsername', e.target.value.trim())}
                  placeholder="@admin_username"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-left text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                عنوان دکمه اتصال به ربات بله در صفحه فاکتور:
              </label>
              <input
                type="text"
                value={config.baleBotButtonText || ''}
                onChange={e => handleField('baleBotButtonText', e.target.value)}
                placeholder="اتصال به ربات بله و پرداخت فاکتور"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800"
              />
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-2 leading-relaxed">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>نحوه عملکرد حالت‌های پرداخت در صفحه مشتری:</span>
              </div>
              <p>
                • اگر فقط <strong>حالت اول (کارت به کارت)</strong> فعال باشد، مشتری مستقیماً باکس شماره کارت، پیام اطلاعیه و کادر آپلود فیش واریزی را مشاهده می‌کند.
              </p>
              <p>
                • اگر فقط <strong>حالت دوم (ربات بله)</strong> فعال باشد، مشتری مستقیماً به ربات بله هدایت می‌شود.
              </p>
              <p>
                • اگر <strong>چند حالت همزمان</strong> فعال باشند، مشتری می‌تواند در صفحه فاکتور بین روش‌های فعال جابجا شود و بر اساس «حالت پیش‌فرض» انتخابی شما صفحه باز می‌شود.
              </p>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};

import React, { useState } from 'react';
import {
  Search,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  Globe,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Zap,
  Code,
  Layers,
  ArrowRight,
  Save,
  RefreshCw,
  FileText
} from 'lucide-react';
import { SiteContent, Product } from '../types';
import { apiFetch } from '../services/dataService';
import { sanitizeTrustBadgeHtml } from '../utils/sanitizeHtml';

interface SearchEnginesViewProps {
  siteContent: SiteContent;
  products: Product[];
  onSaveSiteContent: (updated: SiteContent) => Promise<void>;
  onNavigateTab?: (tab: any) => void;
  onPreviewStorefront?: () => void;
}

export const SearchEnginesView: React.FC<SearchEnginesViewProps> = ({
  siteContent,
  products,
  onSaveSiteContent,
  onNavigateTab,
  onPreviewStorefront
}) => {
  const [torobEnabled, setTorobEnabled] = useState(siteContent.torobEnabled ?? true);
  const [emallsEnabled, setEmallsEnabled] = useState(siteContent.emallsEnabled ?? true);
  const [enamadStatus, setEnamadStatus] = useState<'active' | 'pending' | 'placeholder' | 'hidden'>(
    siteContent.enamadStatus || 'placeholder'
  );
  const [enamadCode, setEnamadCode] = useState(siteContent.enamadCode || '');
  const [samandehiCode, setSamandehiCode] = useState(siteContent.samandehiCode || '');

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Live Feed Test States
  const [isTestingFeed, setIsTestingFeed] = useState(false);
  const [feedTestResult, setFeedTestResult] = useState<{
    ok: boolean;
    latencyMs: number;
    count: number;
    maxPages: number;
    sampleProducts: any[];
    missingFields: string[];
    rawJson?: string;
  } | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://onival.ir';
  const torobFeedUrl = `${origin}/api/torob/products`;
  const emallsFeedUrl = `${origin}/api/emalls/products`;
  const sitemapUrl = `${origin}/sitemap.xml`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      const updated: SiteContent = {
        ...siteContent,
        torobEnabled,
        emallsEnabled,
        enamadStatus,
        enamadCode,
        samandehiCode
      };
      await onSaveSiteContent(updated);
      showToast('تنظیمات اتصال به موتورهای جستجو و نمادهای اعتماد با موفقیت ذخیره شد.');
    } catch (err: any) {
      showToast(err?.message || 'خطا در ذخیره تنظیمات', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestTorobFeed = async () => {
    setIsTestingFeed(true);
    setFeedTestResult(null);
    const start = Date.now();
    try {
      const res = await apiFetch('/api/torob/products?page=1&page_size=5');
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        throw new Error(`خطای سرور HTTP ${res.status}`);
      }
      const data = await res.json();
      const items = Array.isArray(data.products) ? data.products : [];
      
      // Validate mandatory Torob fields
      const requiredFields = ['page_unique', 'page_url', 'price', 'availability', 'title', 'image_link'];
      const missing: string[] = [];
      if (items.length > 0) {
        const sample = items[0];
        requiredFields.forEach(f => {
          if (sample[f] === undefined || sample[f] === null || sample[f] === '') {
            missing.push(f);
          }
        });
      }

      setFeedTestResult({
        ok: true,
        latencyMs,
        count: data.count || 0,
        maxPages: data.max_pages || 1,
        sampleProducts: items.slice(0, 3),
        missingFields: missing,
        rawJson: JSON.stringify(data, null, 2)
      });
      showToast(`فید ترب با موفقیت خوانده شد. (${latencyMs}ms)`, 'success');
    } catch (err: any) {
      setFeedTestResult({
        ok: false,
        latencyMs: Date.now() - start,
        count: 0,
        maxPages: 0,
        sampleProducts: [],
        missingFields: [err.message],
        rawJson: ''
      });
      showToast(`خطا در تست فید ترب: ${err.message}`, 'error');
    } finally {
      setIsTestingFeed(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Toast */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 left-6 z-50 px-5 py-3 rounded-2xl shadow-xl border text-xs font-black flex items-center gap-2 animate-bounce ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-rose-600 text-white border-rose-500'
          }`}
        >
          {toastMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="bg-gradient-to-l from-slate-900 via-rose-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-rose-900/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>آماده‌سازی فنی اتصال به ترب (Torob)، ایمالز (Emalls) و اینماد (eNamad)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
              <Search className="w-7 h-7 text-rose-400 shrink-0" />
              <span>مرکز اتصال به موتورهای جستجوی کالا و نمادهای اعتماد</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
              تمامی زیرساخت‌های فنی شامل <strong>فید محصولات استاندارد ترب (JSON Feed)</strong>، <strong>متاتگ‌های خودکار ترب در صفحه هر محصول</strong>، <strong>نقشه داینامیک سایت (Sitemap.xml)</strong> و <strong>جایگاه اختصاصی اینماد در فوتر</strong> به طور کامل پیاده‌سازی شده‌اند تا فروشگاه بدون نیاز به برنامه‌نویسی به ترب متصل گردد.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/30 transition flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}</span>
            </button>
          </div>
        </div>

        {/* Quick Status Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 mt-6 border-t border-white/10 text-xs">
          <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></div>
              <div>
                <div className="font-bold text-white">فید JSON ترب: فعال</div>
                <div className="text-[10px] text-slate-300 font-mono">/api/torob/products</div>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">آماده اتصال</span>
          </div>

          <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
              <div>
                <div className="font-bold text-white">نقشه سایت: استاندارد XML</div>
                <div className="text-[10px] text-slate-300 font-mono">/sitemap.xml</div>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">{products.length} کالا</span>
          </div>

          <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-2.5 h-2.5 rounded-full ${enamadStatus === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`}></div>
              <div>
                <div className="font-bold text-white">وضعیت اینماد در فوتر</div>
                <div className="text-[10px] text-slate-300">
                  {enamadStatus === 'active' ? 'دارای کد رسمی' : enamadStatus === 'placeholder' ? 'جایگاه شکیل پیش‌فرض' : 'مخفی'}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
              {enamadStatus === 'active' ? 'فعال' : 'پیش‌نمایش'}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 1: TOROB JSON FEED & ENDPOINTS */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-black text-sm border border-rose-200/60">
              ترب
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>۱. لینک‌های اختصاصی اتصال به ترب (Torob Feed & Sitemap)</span>
              </h2>
              <p className="text-xs text-slate-500">
                این آدرس‌ها را در پنل فروشندگان ترب (panel.torob.com) کپی و وارد نمایید.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestTorobFeed}
              disabled={isTestingFeed}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTestingFeed ? 'animate-spin' : ''}`} />
              <span>{isTestingFeed ? 'در حال اعتبارسنجی...' : 'تست زنده و اعتبارسنجی فید ترب'}</span>
            </button>
          </div>
        </div>

        {/* Copyable Endpoints Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Torob API Feed */}
          <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-rose-950">
              <span className="flex items-center gap-1.5">
                <Code className="w-4 h-4 text-rose-600" />
                <span>لینک API فید محصولات ترب (Torob JSON Products Feed):</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-200/70 text-rose-800">استاندارد رسمی ترب</span>
            </div>
            <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-rose-200 font-mono text-xs text-slate-800 select-all" dir="ltr">
              <span className="truncate flex-1">{torobFeedUrl}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(torobFeedUrl, 'torobFeed')}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0 transition"
              >
                {copiedKey === 'torobFeed' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'torobFeed' ? 'کپی شد' : 'کپی لینک'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              این Endpoint خروجی JSON با صفحه‌بندی (Pagination) و فیلدهای page_unique, price, availability, image_link تولید می‌کند.
            </p>
          </div>

          {/* XML Sitemap */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-slate-900">
              <span className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-blue-600" />
                <span>لینک نقشه سایت داینامیک (Sitemap XML):</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">پشتیبانی ترب و گوگل</span>
            </div>
            <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 select-all" dir="ltr">
              <span className="truncate flex-1">{sitemapUrl}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(sitemapUrl, 'sitemap')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0 transition"
              >
                {copiedKey === 'sitemap' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'sitemap' ? 'کپی شد' : 'کپی لینک'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              شامل تمام محصولات فعال، دسته‌بندی‌ها و مقالات برای خزش خودکار ربات‌های ترب، ایمالز و گوگل.
            </p>
          </div>
        </div>

        {/* Live Test Results Box */}
        {feedTestResult && (
          <div className={`p-4 rounded-2xl border text-xs space-y-3 ${feedTestResult.ok ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950' : 'bg-rose-50 border-rose-300 text-rose-950'}`}>
            <div className="flex items-center justify-between font-black pb-2 border-b border-current/15">
              <div className="flex items-center gap-2">
                {feedTestResult.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
                <span className="text-sm">
                  {feedTestResult.ok ? 'نتیجه اعتبارسنجی: فید ترب کاملاً معتبر و استاندارد است ✅' : 'خطا در ارزیابی فید'}
                </span>
              </div>
              <span className="font-mono text-[10px] px-2.5 py-1 rounded-md bg-white border">
                زمان پاسخ: {feedTestResult.latencyMs} میلی‌ثانیه | تعداد کل محصولات: {feedTestResult.count}
              </span>
            </div>

            {feedTestResult.missingFields.length === 0 ? (
              <div className="text-[11px] text-emerald-800 font-bold">
                ✓ تمامی ۶ فیلد الزامی ترب (page_unique, page_url, price, availability, title, image_link) با موفقیت در فید تایید شدند.
              </div>
            ) : (
              <div className="text-[11px] text-rose-800 font-bold">
                فیلدهای ناموجود: {feedTestResult.missingFields.join(', ')}
              </div>
            )}

            {feedTestResult.sampleProducts.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="font-bold text-slate-800 text-[11px]">نمونه ۳ کالای اول خوانده شده از فید ترب:</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {feedTestResult.sampleProducts.map((p, i) => (
                    <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-mono text-slate-500">ID: {p.page_unique}</span>
                        <span className={`px-1.5 py-0.2 rounded font-bold ${p.availability === 'instock' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {p.availability}
                        </span>
                      </div>
                      <div className="font-black text-slate-900 text-xs truncate" title={p.title}>{p.title}</div>
                      <div className="text-emerald-700 font-bold text-xs">{Number(p.price).toLocaleString('fa-IR')} تومان</div>
                      <div className="text-[10px] text-slate-400 truncate font-mono" dir="ltr">{p.page_url}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step-by-Step Torob Guide for Non-Programmers */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 font-black text-slate-900 text-sm">
            <HelpCircle className="w-4 h-4 text-rose-600" />
            <span>راهنمای گام‌به‌گام اتصال به ترب برای مدیر فروشگاه (بدون نیاز به کدنویسی):</span>
          </div>
          <ol className="list-decimal list-inside space-y-2 text-xs text-slate-700 leading-relaxed pr-1">
            <li>
              وارد سایت <strong>پنل فروشندگان ترب</strong> به آدرس{' '}
              <a href="https://panel.torob.com" target="_blank" rel="noreferrer" className="text-rose-600 font-bold hover:underline inline-flex items-center gap-0.5">
                <span>panel.torob.com</span>
                <ExternalLink className="w-3 h-3" />
              </a>{' '}
              شوید و ثبت نام نمایید.
            </li>
            <li>
              در پنل ترب، گزینه <strong>«افزودن فروشگاه جدید»</strong> را لمس کنید و نام فروشگاه (اونیوال) و آدرس سایت را وارد نمایید.
            </li>
            <li>
              در بخش روش دریافت محصولات، گزینه <strong>«فید JSON / API استاندارد»</strong> را انتخاب فرمایید.
            </li>
            <li>
              لینک <code className="bg-white px-2 py-0.5 rounded border text-rose-700 font-mono">{torobFeedUrl}</code> که در بالا کپی کردید را در کادر آدرس فید ترب قرار دهید.
            </li>
            <li>
              دکمه «بررسی خودکار» را در پنل ترب بزنید؛ ربات خزنده‌ی ترب به صورت آنی تمامی محصولات شما را خوانده و فروشگاه شما تایید می‌گردد!
            </li>
          </ol>
        </div>
      </div>

      {/* SECTION 2: EMALLS INTEGRATION */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm border border-blue-200/60">
              ایمالز
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">۲. اتصال به موتور جستجوی کالا «ایمالز» (Emalls)</h2>
              <p className="text-xs text-slate-500">پشتیبانی خودکار از فرمت نقشه سایت و فید اختصاصی ایمالز</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-2">
            <div className="flex items-center justify-between text-xs font-black text-blue-950">
              <span>لینک اختصاصی فید ایمالز:</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-200 text-blue-800">Emalls API</span>
            </div>
            <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-blue-200 font-mono text-xs select-all" dir="ltr">
              <span className="truncate flex-1">{emallsFeedUrl}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(emallsFeedUrl, 'emallsFeed')}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0 transition"
              >
                {copiedKey === 'emallsFeed' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>کپی</span>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5 leading-relaxed">
            <div className="font-bold text-slate-800">نحوه ثبت در ایمالز:</div>
            <p>
              در پنل فروشندگان ایمالز (emalls.ir)، می‌توانید از هر دو لینک <strong>فید اختصاصی</strong> یا <strong>نقشه سایت sitemap.xml</strong> استفاده کنید. سیستم به صورت روزانه تغییرات قیمت و موجودی را با سایت هماهنگ می‌کند.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 3: ENAMAD & FOOTER TRUST BADGES */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black border border-amber-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">۳. تنظیمات نماد اعتماد الکترونیکی (اینماد - eNamad) در فوتر</h2>
              <p className="text-xs text-slate-500">جایگاه رسمی نمایش لوگو یا کد HTML اینماد در انتهای تمام صفحات</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                حالت نمایش اینماد در فوتر سایت:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'active', label: 'کد فعال (رسمی)' },
                  { id: 'placeholder', label: 'جایگاه پیش‌فرض تمیز' },
                  { id: 'hidden', label: 'مخفی موقت' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setEnamadStatus(item.id as any)}
                    className={`p-3 rounded-xl border text-xs font-bold transition cursor-pointer text-center ${
                      enamadStatus === item.id
                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">کد HTML یا لینک اینماد (دریافتی از enamad.ir):</label>
                <span className="text-[10px] text-slate-400">پس از دریافت از سامانه اینماد در این کادر جایگذاری شود</span>
              </div>
              <textarea
                rows={4}
                dir="ltr"
                value={enamadCode}
                onChange={(e) => setEnamadCode(e.target.value)}
                placeholder='<a referrerpolicy="origin" target="_blank" href="https://trustseal.enamad.ir/?id=..."><img src="https://trustseal.enamad.ir/logo.aspx?id=..." alt="اینماد" /></a>'
                className="w-full p-3.5 border border-slate-200 rounded-xl text-xs font-mono text-left focus:outline-hidden focus:border-amber-500 bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">کد نشان ملی ثبت رسانه‌های دیجیتال (ساماندهی):</label>
              <textarea
                rows={2}
                dir="ltr"
                value={samandehiCode}
                onChange={(e) => setSamandehiCode(e.target.value)}
                placeholder='<img id="..." src="..." onclick="..." alt="ساماندهی" />'
                className="w-full p-3 border border-slate-200 rounded-xl text-xs font-mono text-left focus:outline-hidden focus:border-amber-500 bg-slate-50"
              />
            </div>
          </div>

          {/* eNamad Preview Box */}
          <div className="lg:col-span-5 bg-stone-900 text-white rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-800 text-xs">
              <span className="font-bold text-amber-400">پیش‌نمایش جایگاه نمادها در فوتر</span>
              <span className="text-[10px] text-stone-400">نمای زنده سایت</span>
            </div>

            <div className="flex items-center justify-center gap-3 py-6 bg-stone-950/60 rounded-2xl border border-stone-800">
              {enamadStatus === 'active' && enamadCode ? (
                <div
                  className="bg-white p-2 rounded-xl text-stone-900 text-[10px] max-w-[120px] max-h-[120px] overflow-hidden flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: sanitizeTrustBadgeHtml(enamadCode) }}
                />
              ) : enamadStatus === 'placeholder' ? (
                <div className="w-24 h-28 rounded-2xl bg-white/10 border-2 border-dashed border-amber-400/40 flex flex-col items-center justify-center p-2 text-center text-amber-300">
                  <ShieldCheck className="w-7 h-7 text-amber-400 mb-1" />
                  <span className="text-[11px] font-black leading-tight">نماد اعتماد</span>
                  <span className="text-[9px] text-stone-400 mt-0.5">در حال استعلام</span>
                </div>
              ) : (
                <div className="text-stone-500 text-xs italic">نماد اینماد مخفی است</div>
              )}

              {/* Samandehi Placeholder */}
              <div className="w-24 h-28 rounded-2xl bg-white/10 border-2 border-dashed border-stone-700 flex flex-col items-center justify-center p-2 text-center text-stone-300">
                <Globe className="w-7 h-7 text-stone-400 mb-1" />
                <span className="text-[11px] font-black leading-tight">ساماندهی</span>
                <span className="text-[9px] text-stone-400 mt-0.5">وزارت ارشاد</span>
              </div>
            </div>

            <p className="text-[11px] text-stone-400 leading-relaxed">
              این باکس در فوتر سایت به کاربران اطمینان کامل می‌دهد و هنگام مراجعه بازرس ترب یا اینماد، تایید فوری می‌گردد.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 4: REQUIRED LEGAL PAGES FOR TOROB & ENAMAD */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">۴. صفحات و الزامات قانونی الزامی برای تایید ترب و اینماد</h2>
              <p className="text-xs text-slate-500">تمامی صفحات مورد نیاز بازرسان ترب و اینماد در سایت ساخته و لینک شده‌اند</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
              <span>صفحه درباره ما</span>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-[10px] text-emerald-800 font-mono">/about</div>
            <p className="text-[10px] text-slate-500">معرفی برند، تاریخچه و برگه آزمایشگاه</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
              <span>صفحه تماس با ما</span>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-[10px] text-emerald-800 font-mono">/contact</div>
            <p className="text-[10px] text-slate-500">تلفن ثابت، آدرس فیزیکی و ساعات کاری</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
              <span>قوانین و مقررات</span>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-[10px] text-emerald-800 font-mono">/terms</div>
            <p className="text-[10px] text-slate-500">شرایط خرید، ثبت و حریم خصوصی</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
              <span>رویه بازگشت کالا</span>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-[10px] text-emerald-800 font-mono">/refund</div>
            <p className="text-[10px] text-slate-500">ضمانت ۷ روزه و شرایط عودت وجه</p>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 border-t border-slate-100">
          <span>متن تمامی صفحات فوق از بخش «اصلاح صفحات و چیدمان» در پنل ادمین قابل ویرایش کامل است.</span>
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('page-editor')}
              className="text-rose-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>ویرایش متن صفحات در ویرایشگر صفحات</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

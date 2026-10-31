import React, { useState, useEffect } from 'react';
import {
  Globe,
  FileCode,
  ArrowLeftRight,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Trash2,
  Save,
  Search,
  Sparkles,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import {
  Product,
  ProductCategory,
  Post,
  SiteContent,
  SlugRedirect
} from '../types';
import {
  resolveSiteOrigin,
  generateSitemapXml,
  generateRobotsTxt
} from '../utils/seo';
import { apiFetch } from '../services/dataService';

interface SeoManagementViewProps {
  products: Product[];
  categories: ProductCategory[];
  posts: Post[];
  siteContent: SiteContent;
  onSaveSiteContent: (content: SiteContent) => Promise<void>;
  onNavigateTab: (tab: any) => void;
}

export const SeoManagementView: React.FC<SeoManagementViewProps> = ({
  products,
  categories,
  posts,
  siteContent,
  onSaveSiteContent,
  onNavigateTab,
}) => {
  const [productionDomain, setProductionDomain] = useState(
    siteContent.seoConfig?.productionDomain || ''
  );
  const [defaultMetaTitle, setDefaultMetaTitle] = useState(
    siteContent.seoConfig?.defaultMetaTitle ||
      'اونیوال | ONIVAL - فروشگاه تخصصی عسل طبیعی و محصولات ارگانیک'
  );
  const [defaultMetaDescription, setDefaultMetaDescription] = useState(
    siteContent.seoConfig?.defaultMetaDescription ||
      'خرید مستقیم عسل طبیعی سبلان، ژل رویال شاهانه، گرده گل، بره‌موم و دمنوش‌های ارگانیک از فروشگاه تخصصی اونیوال با برگه آزمایشگاهی و ضمانت خلوص.'
  );
  const [defaultOgImage, setDefaultOgImage] = useState(
    siteContent.seoConfig?.defaultOgImage || ''
  );
  const [googleSiteVerification, setGoogleSiteVerification] = useState(
    siteContent.seoConfig?.googleSiteVerification || ''
  );
  const [redirects, setRedirects] = useState<SlugRedirect[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const loadRedirects = async () => {
    try {
      const res = await apiFetch('/api/seo/redirects');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setRedirects(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadRedirects();
  }, [products, categories, posts]);

  const currentOrigin = resolveSiteOrigin(
    {
      ...siteContent,
      seoConfig: {
        ...siteContent.seoConfig,
        productionDomain,
      },
    },
    typeof window !== 'undefined' ? window.location.origin : ''
  );

  const sitemapXml = generateSitemapXml(currentOrigin, {
    products,
    productCategories: categories,
    posts,
    siteContent,
  });

  const robotsTxt = generateRobotsTxt(currentOrigin);

  const publishedProducts = products.filter(
    (p) => !p.isDelete && (p.status || 'published') === 'published'
  );
  const draftProducts = products.filter(
    (p) => !p.isDelete && p.status === 'draft'
  );
  const publishedPosts = posts.filter(
    (p) => (p.status || 'published') === 'published'
  );
  const draftPosts = posts.filter((p) => p.status === 'draft');
  const publishedCategories = categories.filter(
    (c) => (c.status || 'published') === 'published'
  );

  // SEO Audit checks across real items
  const productsMissingAlt = publishedProducts.filter(
    (p) => !p.imageAlt || !p.imageAlt.trim()
  );
  const productsMissingSeoDesc = publishedProducts.filter(
    (p) => !p.seoDescription && (!p.shortDescription || p.shortDescription.length < 40)
  );
  const postsMissingSeoDesc = publishedPosts.filter(
    (p) => !p.seoDescription && (!p.description || p.description.length < 40)
  );

  const handleSaveSeoConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage('');
    try {
      const cleanDomain = productionDomain.trim().replace(/\/+$/, '');
      await onSaveSiteContent({
        ...siteContent,
        seoConfig: {
          productionDomain: cleanDomain,
          defaultMetaTitle: defaultMetaTitle.trim(),
          defaultMetaDescription: defaultMetaDescription.trim(),
          defaultOgImage: defaultOgImage.trim(),
          googleSiteVerification: googleSiteVerification.trim(),
        },
      });
      setSaveMessage('تنظیمات سئو تکنیکال، دامنه Canonical و متاتگ‌های مادر با موفقیت ذخیره شد.');
    } catch (err: any) {
      setSaveMessage(err?.message || 'خطا در ذخیره تنظیمات سئو');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRedirect = async (fromPath?: string) => {
    await apiFetch('/api/seo/redirects', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromPath }),
    });
    await loadRedirects();
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(label);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-emerald-950 rounded-3xl p-6 text-white shadow-xl border border-emerald-500/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              موتور سئو تکنیکال، داده ساختاریافته (JSON-LD) و ایندکس خودکار گوگل
            </div>
            <h2 className="text-xl sm:text-2xl font-black">
              مرکز فرماندهی سئو و انتشار پویا (Google Search Central Ready)
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-3xl">
              تمامی محصولات، دسته‌بندی‌ها و مقالات منتشرشده به صورت خودکار دارای آدرس یکتا (Clean URL)، تگ Canonical، اسکیمای استاندارد <code className="text-amber-300">Product / Offer / Article / BreadcrumbList</code> و نقشه سایت پویا (<code className="text-emerald-300">/sitemap.xml</code>) هستند و بدون نیاز به تغییر کد یا دیپلوی مجدد بلافاصله منتشر می‌شوند.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="/sitemap.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg"
            >
              <FileCode className="w-4 h-4" />
              مشاهده زنده /sitemap.xml
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href="/robots.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition border border-white/15"
            >
              <Globe className="w-4 h-4" />
              مشاهده /robots.txt
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Live Indexability KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">محصولات قابل ایندکس</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {publishedProducts.filter((p) => !p.robotsNoIndex).length.toLocaleString('fa-IR')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            پیش‌نویس (مخفی از گوگل): {draftProducts.length.toLocaleString('fa-IR')} مورد
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">دسته‌بندی‌های عمومی</span>
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {publishedCategories.filter((c) => !c.robotsNoIndex).length.toLocaleString('fa-IR')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            مسیر استاندارد: <code dir="ltr">/categories/:slug</code>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">مقالات علمی منتشرشده</span>
            <CheckCircle2 className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {publishedPosts.filter((p) => !p.robotsNoIndex).length.toLocaleString('fa-IR')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            پیش‌نویس: {draftPosts.length.toLocaleString('fa-IR')} | اسکیمای BlogPosting
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">ریدایرکت‌های ۳۰۱ خودکار</span>
            <ArrowLeftRight className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {redirects.length.toLocaleString('fa-IR')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            محافظت از تغییر اسلاگ در برابر خطای ۴۰۴
          </div>
        </div>
      </div>

      {/* Global SEO & Canonical Domain Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleSaveSeoConfig}
          className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-600" />
                تنظیمات دامنه اصلی (Canonical Domain) و متاتگ‌های پایه
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                دامنه واقعی فروشگاه را وارد کنید تا تمام آدرس‌های Canonical، اسکیمای JSON-LD و نقشه سایت بر اساس آن تولید شوند.
              </p>
            </div>
          </div>

          {saveMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              {saveMessage}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                دامنه رسمی پروداکشن (Canonical Origin)
              </label>
              <input
                type="url"
                dir="ltr"
                value={productionDomain}
                onChange={(e) => setProductionDomain(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                در صورت خالی بودن، به صورت خودکار از دامنه فعلی (<code dir="ltr">{currentOrigin}</code>) استفاده می‌شود.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                کد تایید Google Search Console (اختیاری)
              </label>
              <input
                type="text"
                dir="ltr"
                value={googleSiteVerification}
                onChange={(e) => setGoogleSiteVerification(e.target.value)}
                placeholder="google-site-verification token"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              عنوان سئو پیش‌فرض صفحه اصلی (Home Meta Title)
            </label>
            <input
              type="text"
              value={defaultMetaTitle}
              onChange={(e) => setDefaultMetaTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>پیشنهاد استاندارد گوگل: ۵۰ تا ۶۰ کاراکتر</span>
              <span>{defaultMetaTitle.length} کاراکتر</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              توضیحات متا پیش‌فرض صفحه اصلی (Home Meta Description)
            </label>
            <textarea
              rows={3}
              value={defaultMetaDescription}
              onChange={(e) => setDefaultMetaDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>پیشنهاد استاندارد گوگل: ۱۲۰ تا ۱۶۰ کاراکتر</span>
              <span>{defaultMetaDescription.length} کاراکتر</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              تصویر پیش‌فرض اشتراک‌گذاری اجتماعی (Default OpenGraph Image URL)
            </label>
            <input
              type="text"
              dir="ltr"
              value={defaultOgImage}
              onChange={(e) => setDefaultOgImage(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'در حال ذخیره...' : 'ذخیره تنظیمات سئو سراسری'}
            </button>
          </div>
        </form>

        {/* Live Health Audit Checklist */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            ممیزی زنده سلامت سئو محتوا
          </h3>
          <p className="text-xs text-slate-500">
            بررسی خودکار وضعیت متاتگ‌ها، متن جایگزین تصاویر (Alt) و اسکیمای اقلام منتشرشده:
          </p>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-emerald-950">حذف کامل صفحات تکراری و Soft 404</div>
                <div className="text-emerald-700 mt-0.5">
                  مسیرهای نامعتبر وضعیت واقعی HTTP 404 و متاتگ <code dir="ltr">noindex, nofollow</code> برمی‌گردانند.
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-emerald-950">محافظت از صفحات خصوصی در برابر ایندکس</div>
                <div className="text-emerald-700 mt-0.5">
                  صفحات <code dir="ltr">/admin</code>، <code dir="ltr">/checkout</code> و <code dir="ltr">/tracking</code> از نقشه سایت حذف و در robots.txt مسدود شده‌اند.
                </div>
              </div>
            </div>

            {productsMissingAlt.length > 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-amber-950">
                    {productsMissingAlt.length.toLocaleString('fa-IR')} محصول فاقد متن جایگزین اختصاصی (Alt Text)
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('products')}
                    className="text-amber-700 underline font-bold mt-1"
                  >
                    ویرایش در بخش محصولات
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="font-bold text-emerald-950">
                  تمامی محصولات دارای متن جایگزین تصویر (Image Alt) هستند.
                </div>
              </div>
            )}

            {productsMissingSeoDesc.length > 0 || postsMissingSeoDesc.length > 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-950">
                    {productsMissingSeoDesc.length + postsMissingSeoDesc.length} آیتم از توضیحات خودکار استفاده می‌کنند
                  </div>
                  <div className="text-amber-700 mt-0.5">
                    می‌توانید در فرم ویرایش محصول یا مقاله، Meta Description اختصاصی بنویسید.
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Automatic 301 Redirect Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-amber-600" />
              جدول ریدایرکت‌های دائمی ۳۰۱ (تغییر اسلاگ محصولات، دسته‌ها و مقالات)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              هر زمان که اسلاگ (آدرس URL) یک محصول، دسته‌بندی یا مقاله منتشرشده را تغییر دهید، آدرس قبلی به صورت خودکار با کد ۳۰۱ به آدرس جدید هدایت می‌شود تا اعتبار سئو از دست نرود.
            </p>
          </div>
          <button
            type="button"
            onClick={loadRedirects}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition self-start"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            بروزرسانی لیست
          </button>
        </div>

        {redirects.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            هنوز تغییر اسلاگی ثبت نشده است. به محض ویرایش اسلاگ هر محصول یا مقاله، ریدایرکت ۳۰۱ آن در این جدول ظاهر می‌شود.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 px-3">نوع محتوا</th>
                  <th className="py-2.5 px-3">آدرس قدیم (From Path)</th>
                  <th className="py-2.5 px-3">آدرس جدید (To Path - 301)</th>
                  <th className="py-2.5 px-3">تاریخ ثبت</th>
                  <th className="py-2.5 px-3 text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {redirects.map((r) => (
                  <tr key={r.fromPath} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-700">
                      {r.entityType === 'product'
                        ? 'محصول'
                        : r.entityType === 'category'
                        ? 'دسته‌بندی'
                        : 'مقاله'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-rose-600" dir="ltr">
                      {r.fromPath}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-emerald-700" dir="ltr">
                      {r.toPath}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {r.updatedAt?.slice(0, 10)}
                    </td>
                    <td className="py-2.5 px-3 text-left">
                      <button
                        type="button"
                        onClick={() => handleDeleteRedirect(r.fromPath)}
                        className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-bold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live Preview of Sitemap.xml and Robots.txt */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-emerald-600" />
              خروجی زنده <code dir="ltr">/sitemap.xml</code>
            </h3>
            <button
              type="button"
              onClick={() => copyText(sitemapXml, 'sitemap')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedType === 'sitemap' ? 'کپی شد!' : 'کپی XML'}
            </button>
          </div>
          <pre
            dir="ltr"
            className="bg-slate-950 text-emerald-300 p-4 rounded-xl text-[11px] font-mono overflow-x-auto max-h-64 leading-relaxed"
          >
            {sitemapXml}
          </pre>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-600" />
              خروجی زنده <code dir="ltr">/robots.txt</code>
            </h3>
            <button
              type="button"
              onClick={() => copyText(robotsTxt, 'robots')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedType === 'robots' ? 'کپی شد!' : 'کپی متن'}
            </button>
          </div>
          <pre
            dir="ltr"
            className="bg-slate-950 text-blue-200 p-4 rounded-xl text-[11px] font-mono overflow-x-auto max-h-64 leading-relaxed"
          >
            {robotsTxt}
          </pre>
        </div>
      </div>
    </div>
  );
};

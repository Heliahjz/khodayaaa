import React, { useState } from 'react';
import {
  Server,
  CloudDownload,
  FileJson,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Copy,
  Check,
  Terminal,
  ShieldCheck,
  HelpCircle,
  Layers,
  Sparkles,
  Info,
  Bot,
  Download,
  FileSpreadsheet,
  FileCode
} from 'lucide-react';
import {
  runManualSeedDatabase,
  getCachedLocalState,
  getAdminSessionToken,
  apiFetch,
  getServerConnectionStatus,
  testServerConnection,
  subscribeServerConnectionStatus,
} from '../services/dataService';

interface HostDataManagementCardProps {
  onRefreshAppData?: () => Promise<void> | void;
}

export const HostDataManagementCard: React.FC<HostDataManagementCardProps> = ({
  onRefreshAppData,
}) => {
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'offline_fallback'>(() =>
    getServerConnectionStatus()
  );
  const [isCheckingConn, setIsCheckingConn] = useState(false);
  const [connMessage, setConnMessage] = useState<string>('');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [downloadingExport, setDownloadingExport] = useState<string | null>(null);

  const handleDownloadExport = async (endpoint: string, filename: string, title: string) => {
    setDownloadingExport(endpoint);
    try {
      const res = await apiFetch(endpoint);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setFeedback({
          type: 'success',
          message: `فایل «${title}» با موفقیت از سرور دانلود شد.`,
        });
        return;
      }
      throw new Error('خطا در دریافت فایل خروجی از سرور');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || `خطا در دریافت فایل «${title}».`,
      });
    } finally {
      setDownloadingExport(null);
    }
  };

  React.useEffect(() => {
    const unsub = subscribeServerConnectionStatus((st) => {
      setConnectionStatus(st);
    });
    return () => unsub();
  }, []);

  const handleTestConnection = async () => {
    setIsCheckingConn(true);
    setConnMessage('');
    try {
      const res = await testServerConnection();
      setConnectionStatus(res.connected ? 'connected' : 'offline_fallback');
      setConnMessage(res.message);
    } catch {
      setConnectionStatus('offline_fallback');
      setConnMessage('خطا در آزمایش اتصال به سرور.');
    } finally {
      setIsCheckingConn(false);
    }
  };

  // ۱. راه‌اندازی اولیه و بازنشانی محصولات پیش‌فرض روی سرور لینوکس
  const handleSeedDatabase = async (resetToFactory = false) => {
    setIsSeeding(true);
    setFeedback({ type: null, message: '' });
    try {
      const res = await runManualSeedDatabase({ resetAllToDefault: resetToFactory });
      setFeedback({
        type: 'success',
        message: res.message,
      });
      await onRefreshAppData?.();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'خطا در راه‌اندازی اولیه داده‌ها روی هاست',
      });
    } finally {
      setIsSeeding(false);
    }
  };

  // ۲. همگام‌سازی فوری و ذخیره دائمی دیتابیس در فایل onival-persistent-data.json
  const handleSyncCurrentState = async () => {
    setIsSyncing(true);
    setFeedback({ type: null, message: '' });
    try {
      const currentState = getCachedLocalState();
      const token = getAdminSessionToken();
      const res = await apiFetch('/api/host/import-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(currentState),
      });

      if (res.ok) {
        setFeedback({
          type: 'success',
          message: 'تمامی اطلاعات سایت (محصولات، دسته‌بندی‌ها، سفارشات، مقالات، تنظیمات سئو و حساب مدیریت) با موفقیت در دیسک هاست شما (onival-persistent-data.json) ذخیره شد.',
        });
      } else {
        throw new Error('سرور هاست وضعیت ناموفق برگرداند.');
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'خطا در ذخیره‌سازی داده‌ها روی هاست سرور.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // ۳. خروجی گرفتن کامل از دیتابیس (JSON Backup)
  const handleExportFullBackup = async () => {
    try {
      const res = await apiFetch('/api/admin/backup/download');
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `onival-host-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setFeedback({
          type: 'success',
          message: 'فایل پشتیبان کامل دیتابیس مستقیماً از سرور هاست اختصاصی شما دانلود شد.',
        });
        return;
      }
    } catch {
      // fallback
    }

    const state = getCachedLocalState();
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `onival-host-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setFeedback({
      type: 'success',
      message: 'فایل پشتیبان دیتابیس با موفقیت دانلود شد.',
    });
  };

  // ۴. بازگردانی فایل پشتیبان دیتابیس (Import JSON Backup)
  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const raw = ev.target?.result as string;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('فرمت فایل پشتیبان معتبر نیست.');
        }
        setIsSyncing(true);
        const token = getAdminSessionToken();
        const res = await apiFetch('/api/host/import-state', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify(parsed),
        });

        if (res.ok) {
          await onRefreshAppData?.();
          setFeedback({
            type: 'success',
            message: 'تمامی اطلاعات فایل پشتیبان با موفقیت در سرور هاست اختصاصی شما ذخیره و بارگذاری گردید.',
          });
        } else {
          throw new Error('خطا در بارگذاری اطلاعات روی سرور هاست.');
        }
      } catch (err: any) {
        setFeedback({
          type: 'error',
          message: err?.message || 'خطا در پردازش فایل پشتیبان JSON.',
        });
      } finally {
        setIsSyncing(false);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadBotPhp = async (fileName: string) => {
    try {
      const res = await apiFetch(`/api/bot/php-code/${fileName}`);
      if (!res.ok) throw new Error('خطا در دریافت فایل');
      const data = await res.json();
      const blob = new Blob([data.code], { type: 'application/x-httpd-php;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setFeedback({
        type: 'success',
        message: `فایل اختصاصی ${fileName} بر اساس پیکربندی امن سرور دانلود شد.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || `خطا در دریافت فایل ${fileName}`,
      });
    }
  };

  const sampleEnvConfig = `# تنظیمات محیطی هاست لینوکسی سی‌پنل (.env)
NODE_ENV=production
PORT=3000
APP_URL=https://yourdomain.com
ADMIN_TOKEN_SECRET=your_random_secure_secret_here

# تنظیمات ربات‌های بله و تلگرام
BALE_BOT_TOKEN=
TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_CHAT_ID=
BALE_API_BASE_URL=https://tapi.bale.ai
PANEL_BASE_URL=https://yourdomain.com`;

  const handleCopyEnv = () => {
    navigator.clipboard?.writeText(sampleEnvConfig);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2500);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-l from-indigo-50/70 via-white to-amber-50/40">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-800">
                مدیریت بک‌اند و دیتابیس اختصاصی هاست لینوکس (cPanel / Node.js)
              </h3>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">
                <ShieldCheck className="w-3.5 h-3.5" />
                مستقل از سرورهای شخص ثالث
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              تمام اطلاعات، سفارشات، محصولات، فایل‌های سئو و احراز هویت مستقیماً روی سرور و هاست خودتان مدیریت می‌شوند.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowGuide(!showGuide)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
        >
          <HelpCircle className="w-4 h-4 text-indigo-600" />
          <span>
            {showGuide
              ? 'بستن راهنمای استقرار در cPanel'
              : 'مشاهده راهنمای گام‌به‌گام استقرار در cPanel'}
          </span>
        </button>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {feedback.type && (
          <div
            className={`p-4 rounded-xl flex items-center gap-3 text-xs sm:text-sm font-bold ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* وضعیت اتصال زنده به بک‌اند و دیتابیس کلاینت خودکفا */}
        <div className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          connectionStatus === 'connected'
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
            : 'bg-amber-50/70 border-amber-200 text-amber-900'
        }`}>
          <div className="flex items-start sm:items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold shadow-xs ${
              connectionStatus === 'connected' ? 'bg-emerald-600' : 'bg-amber-600'
            }`}>
              {connectionStatus === 'connected' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <HardDrive className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black">
                  {connectionStatus === 'connected'
                    ? 'وضعیت اتصال: متصل مستقیم به سرور Node.js هاست (Live Backend)'
                    : 'وضعیت اتصال: حالت خودکفا و ذخیره‌سازی محلی (Client-Side Local Storage Fallback)'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  connectionStatus === 'connected' ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'
                }`}>
                  {connectionStatus === 'connected' ? 'آنلاین' : 'خودکفا / آماده به کار'}
                </span>
              </div>
              <p className="text-[11px] opacity-80 mt-1 leading-relaxed">
                {connectionStatus === 'connected'
                  ? 'تمامی اطلاعات به صورت مستقیم با فایل سرور (server-data/onival-persistent-data.json) و همزمان با LocalStorage مرورگر همگام است.'
                  : 'پروژه در حالت کاملاً Self-Contained اجرا می‌شود. حتی در صورتی که سرور Node.js در هاست استارت نخورده باشد، تمامی محصولات اولیه، بلاگ، دسته‌ها، سفارشات و پنل مدیریت به طور کامل از حافظه مستقل مرورگر تغذیه و ذخیره می‌شوند.'}
              </p>
              {connMessage && (
                <div className="text-[11px] font-bold mt-1.5 text-slate-700 bg-white/70 px-2.5 py-1 rounded-lg inline-block border border-black/5">
                  {connMessage}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={isCheckingConn}
            onClick={handleTestConnection}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold shrink-0 transition shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingConn ? 'animate-spin' : ''}`} />
            <span>{isCheckingConn ? 'در حال بررسی...' : 'تست مجدد اتصال به سرور Node'}</span>
          </button>
        </div>

        {/* ۱. وضعیت ذخیره‌سازی محلی روی هاست و دکمه‌های عملیاتی */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-indigo-600" />
                <span>۱. ذخیره‌سازی دائمی دیتابیس، راه‌اندازی اولیه و پشتیبان‌گیری</span>
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                داده‌های سایت در فایل پایدار <code className="font-mono font-bold text-slate-700">onival-persistent-data.json</code> در ریشه هاست شما ذخیره می‌شوند و بدون نیاز به هیچ دیتابیس ابری خارجی اجرا می‌گردند:
              </p>
            </div>
          </div>

          {/* راهنمای امنیت ذخیره‌سازی، بکاپ و انتقال به هاست دیگر */}
          <div className="p-4 rounded-xl bg-white border border-slate-200/90 space-y-2">
            <div className="flex items-center gap-2 text-xs font-black text-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>پایگاه‌داده امن و روش پشتیبان‌گیری و جابه‌جایی اطلاعات:</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              اطلاعات سایت مستقیماً در مسیر اختصاصی <code dir="ltr" className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">server-data/onival-persistent-data.json</code> ذخیره می‌شوند. این پوشه در لایه سرور قرار داشته و دسترسی عمومی وب به آن مسدود است تا اطلاعات کاربران و رمزها محافظت گردد.
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              <span className="font-bold text-amber-700">📌 نحوه بکاپ‌گیری و انتقال:</span> برای انتقال به هاست دیگر، کافی است دکمه «دانلود فایل پشتیبان کامل دیتابیس (JSON Backup)» را بزنید و در هاست جدید دکمه «بازگردانی فایل پشتیبان در هاست» را کلیک کنید، یا کل پوشه <code dir="ltr" className="font-mono text-indigo-700">server-data/</code> را از طریق File Manager یا FTP در ریشه هاست مقصد کپی نمایید.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              disabled={isSeeding}
              onClick={() => handleSeedDatabase(false)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSeeding ? 'animate-spin' : ''}`} />
              <span>
                {isSeeding
                  ? 'در حال مقداردهی اولیه داده‌ها...'
                  : 'راه‌اندازی داده‌های اولیه محصولات و ادمین (Seed Data)'}
              </span>
            </button>

            <button
              type="button"
              disabled={isSyncing}
              onClick={handleSyncCurrentState}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer"
            >
              <HardDrive className="w-4 h-4" />
              <span>
                {isSyncing
                  ? 'در حال ذخیره‌سازی در دیسک هاست...'
                  : 'ذخیره فوری کل اطلاعات در دیسک هاست (Save to Disk)'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleExportFullBackup}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
            >
              <CloudDownload className="w-4 h-4 text-amber-400" />
              <span>دانلود فایل پشتیبان کامل دیتابیس (JSON Backup)</span>
            </button>

            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs transition">
              <FileJson className="w-4 h-4 text-indigo-600" />
              <span>بازگردانی فایل پشتیبان در هاست (Restore Backup)</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleImportBackupFile}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={() => handleDownloadBotPhp('bale-bot.php')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs cursor-pointer"
            >
              <Bot className="w-4 h-4 text-emerald-200" />
              <span>دانلود فایل ربات بله (bale-bot.php برای public_html)</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadBotPhp('telegram-bot.php')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-sky-200" />
              <span>دانلود فایل ربات تلگرام (telegram-bot.php برای public_html)</span>
            </button>
          </div>

          {/* بخش خروجی‌های استاندارد وردپرس، ووکامرس و اکسل */}
          <div className="mt-4 pt-4 border-t border-slate-200/80 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-black text-slate-800">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>خروجی‌های استاندارد فروشگاهی، حسابداری و مهاجرت اطلاعات (Export Data):</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              جهت ورود اطلاعات به وردپرس، سیستم‌های مالی یا تحلیل حسابداری، از فایل‌های استاندارد زیر با کدگذاری UTF-8 استفاده کنید:
            </p>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                disabled={Boolean(downloadingExport)}
                onClick={() => handleDownloadExport(
                  '/api/admin/export/woocommerce-products.csv',
                  `woocommerce-products-${new Date().toISOString().slice(0, 10)}.csv`,
                  'محصولات استاندارد ووکامرس (CSV)'
                )}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-purple-700/20 transition cursor-pointer"
              >
                <FileSpreadsheet className={`w-4 h-4 ${downloadingExport === '/api/admin/export/woocommerce-products.csv' ? 'animate-bounce' : 'text-purple-200'}`} />
                <span>خروجی محصولات ووکامرس (WooCommerce Products CSV)</span>
              </button>

              <button
                type="button"
                disabled={Boolean(downloadingExport)}
                onClick={() => handleDownloadExport(
                  '/api/admin/export/wordpress-wxr.xml',
                  `wordpress-wxr-${new Date().toISOString().slice(0, 10)}.xml`,
                  'خروجی جامع وردپرس (WXR XML)'
                )}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-blue-700/20 transition cursor-pointer"
              >
                <FileCode className={`w-4 h-4 ${downloadingExport === '/api/admin/export/wordpress-wxr.xml' ? 'animate-bounce' : 'text-blue-200'}`} />
                <span>خروجی جامع وردپرس (WordPress WXR 1.2 XML)</span>
              </button>

              <button
                type="button"
                disabled={Boolean(downloadingExport)}
                onClick={() => handleDownloadExport(
                  '/api/admin/export/paid-orders.csv',
                  `paid-orders-${new Date().toISOString().slice(0, 10)}.csv`,
                  'گزارش مالی سفارش‌های پرداخت‌شده (CSV)'
                )}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-700/20 transition cursor-pointer"
              >
                <Download className={`w-4 h-4 ${downloadingExport === '/api/admin/export/paid-orders.csv' ? 'animate-bounce' : 'text-emerald-200'}`} />
                <span>گزارش مالی سفارش‌های پرداخت شده (Paid Orders CSV)</span>
              </button>
            </div>
          </div>
        </div>

        {/* ۲. راهنمای گام‌به‌گام راه‌اندازی در cPanel */}
        {showGuide && (
          <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-200/80 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>راهنمای راه‌اندازی پروژه روی هاست لینوکس در cPanel (بخش Setup Node.js App)</span>
              </h4>
              <button
                type="button"
                onClick={handleCopyEnv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                {copiedEnv ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>متغیرها کپی شد</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    <span>کپی نمونه تنظیمات .env</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-2xs">
                <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] flex items-center justify-center font-bold">۱</span>
                  <span>آپلود فایل‌ها در هاست</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  فایل‌های پروژه را از طریق File Manager یا Git در پوشه دلخواه خود (مثلاً <code className="font-mono text-indigo-700">public_html</code> یا یک زیرپوشه) قرار دهید.
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-2xs">
                <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] flex items-center justify-center font-bold">۲</span>
                  <span>پیکربندی Node.js یا PHP</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  نسخه Node.js را روی 18 یا بالاتر بگذارید یا با وب‌هوک‌های مستقل PHP پروژه را روی هاست‌های اشتراکی استاندارد مستقر نمایید.
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-2xs">
                <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] flex items-center justify-center font-bold">۳</span>
                  <span>اجرای بیلد و راه‌اندازی</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  با دستور <code className="font-mono text-indigo-700">npm run build</code> پروژه کامپایل و فایل‌های آماده در پوشه dist قرار می‌گیرند.
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-2xs">
                <div className="font-bold text-emerald-950 mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center font-bold">۴</span>
                  <span>وب‌هوک PHP ربات‌ها</span>
                </div>
                <p className="text-emerald-900 text-[11px] leading-relaxed">
                  فایل‌های <code className="font-mono font-bold text-emerald-800">/api/bale-webhook.php</code> و <code className="font-mono font-bold text-emerald-800">/api/telegram-webhook.php</code> بدون نیاز به ماندن Node همیشه فعال هستند.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <span className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-slate-600" />
                <span>نمونه فایل تنظیمات محیطی (.env) برای هاست شما:</span>
              </span>
              <pre
                dir="ltr"
                className="text-[11px] font-mono bg-slate-950 text-indigo-300 p-4 rounded-xl overflow-x-auto leading-relaxed border border-slate-800"
              >
                {sampleEnvConfig}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

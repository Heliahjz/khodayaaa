import React, { useState, useEffect, useMemo } from 'react';
import {
  Terminal,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  Search,
  Filter,
  Send,
  Zap,
  ShoppingBag,
  PhoneCall,
  Package,
  CreditCard,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Database,
  Code2,
  ExternalLink,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { BotActivityLog, Order, TelegramConfig } from '../types';
import { apiFetch } from '../services/dataService';

interface BotTechnicalLogBoxProps {
  logs: BotActivityLog[];
  config?: TelegramConfig;
  currentOrder?: Order | null;
  onRefreshLogs?: () => Promise<void> | void;
  onClearLogs?: () => Promise<void> | void;
  isOpenAsModal?: boolean;
  onCloseModal?: () => void;
  title?: string;
  subtitle?: string;
}

export const BotTechnicalLogBox: React.FC<BotTechnicalLogBoxProps> = ({
  logs = [],
  config,
  currentOrder,
  onRefreshLogs,
  onClearLogs,
  isOpenAsModal = false,
  onCloseModal,
  title = 'لاگ باکس و تله‌متری فنی ربات بله (کد و دیتای خام)',
  subtitle = 'بررسی بلادرنگ ارتباط با سرور بله، تفکیک فاکتور، خواندن دیتابیس و اقلام سفارش'
}) => {
  const [filterType, setFilterType] = useState<'all' | 'invoices' | 'commands' | 'webhooks' | 'errors'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copiedLogId, setCopiedLogId] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  // Command Testing State
  const [testCommand, setTestCommand] = useState<string>('');
  const [isExecutingTest, setIsExecutingTest] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [localLogs, setLocalLogs] = useState<BotActivityLog[]>(logs);

  // Sync props logs to localLogs
  useEffect(() => {
    if (logs && logs.length > 0) {
      setLocalLogs(logs);
    }
  }, [logs]);

  // Set default test command based on current order if available
  useEffect(() => {
    if (currentOrder?.trackingCode) {
      setTestCommand(`/start pay_${currentOrder.trackingCode.replace(/-/g, '_')}`);
    } else if (!testCommand) {
      setTestCommand('/start pay_ONV-ORD-949');
    }
  }, [currentOrder?.trackingCode]);

  // Auto-refresh interval (every 3 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(async () => {
      try {
        const res: any = await apiFetch('/api/bot/logs');
        if (Array.isArray(res)) {
          setLocalLogs(res);
        } else if (res?.logs && Array.isArray(res.logs)) {
          setLocalLogs(res.logs);
        }
      } catch {
        // silent polling catch
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleManualRefresh = async () => {
    try {
      if (onRefreshLogs) {
        await onRefreshLogs();
      }
      const res: any = await apiFetch('/api/bot/logs');
      if (Array.isArray(res)) {
        setLocalLogs(res);
      } else if (res?.logs && Array.isArray(res.logs)) {
        setLocalLogs(res.logs);
      }
    } catch (err) {
      console.warn('Manual refresh error:', err);
    }
  };

  const handleClear = async () => {
    try {
      if (onClearLogs) {
        await onClearLogs();
      } else {
        await apiFetch('/api/bot/logs', { method: 'DELETE' });
      }
      setLocalLogs([]);
      setTestResult(null);
    } catch (err) {
      console.warn('Error clearing logs:', err);
    }
  };

  const handleCopyLogJson = (log: BotActivityLog) => {
    const payload = JSON.stringify(log, null, 2);
    navigator.clipboard?.writeText(payload);
    setCopiedLogId(log.id);
    setTimeout(() => setCopiedLogId(null), 2000);
  };

  const handleCopyAllLogs = () => {
    const payload = JSON.stringify(localLogs, null, 2);
    navigator.clipboard?.writeText(payload);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  // Run test command against backend router
  const handleExecuteTest = async (cmdToRun?: string) => {
    const cmd = (cmdToRun || testCommand || '').trim();
    if (!cmd) return;
    setIsExecutingTest(true);
    setTestResult(null);

    try {
      const res: any = await apiFetch('/api/bot/test-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: cmd,
          trackingCode: currentOrder?.trackingCode,
          chatId: config?.baleAdminChatId || config?.adminChatId || ''
        })
      });

      setTestResult(res);
      if (res?.logs && Array.isArray(res.logs)) {
        setLocalLogs(res.logs);
        // Expand the latest log entry to show technical details
        if (res.logs[0]?.id) {
          setExpandedLogId(res.logs[0].id);
        }
      } else {
        await handleManualRefresh();
      }
    } catch (err: any) {
      setTestResult({
        ok: false,
        error: err?.message || 'خطا در ارتباط با سرور'
      });
    } finally {
      setIsExecutingTest(false);
    }
  };

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return localLogs.filter((log) => {
      // Type Filter
      if (filterType === 'invoices') {
        const isInvoice = /invoice|pay|order|فاکتور|پرداخت|سفارش/i.test(log.type || '') ||
                          /invoice|pay|order|فاکتور|پرداخت|سفارش/i.test(log.text || '');
        if (!isInvoice) return false;
      } else if (filterType === 'commands') {
        const isCmd = /command|start|shop|contact|track|help|دکمه|فروشگاه|تماس/i.test(log.type || '') ||
                      /command|start|shop|contact|track|help|دکمه|فروشگاه|تماس/i.test(log.text || '');
        if (!isCmd) return false;
      } else if (filterType === 'webhooks') {
        const isWh = /webhook|polling|incoming|ورودی/i.test(log.type || '');
        if (!isWh) return false;
      } else if (filterType === 'errors') {
        if (log.status !== 'error' && !/error|failed|رد شد|خطا/i.test(log.type || '')) return false;
      }

      // Search Filter
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase();
        const inText = (log.text || '').toLowerCase().includes(s);
        const inType = (log.type || '').toLowerCase().includes(s);
        const inDetails = (log.details || '').toLowerCase().includes(s);
        const inRaw = JSON.stringify(log.rawPayload || {}).toLowerCase().includes(s) ||
                      JSON.stringify(log.rawResponse || {}).toLowerCase().includes(s);
        if (!inText && !inType && !inDetails && !inRaw) return false;
      }

      return true;
    });
  }, [localLogs, filterType, searchTerm]);

  const activeBotName = (config?.baleBotUsername || config?.botUsername || 'Onivalbot').replace(/^@/, '');

  return (
    <div className={`flex flex-col bg-slate-950 text-slate-100 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden font-sans ${isOpenAsModal ? 'w-full max-w-5xl max-h-[92vh]' : 'w-full'}`}>
      {/* Header Bar */}
      <div className="p-4 sm:p-5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-white">{title}</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/80">
                @{activeBotName}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Auto Refresh Toggle */}
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              autoRefresh
                ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/80 shadow-xs'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
            title="به‌روزرسانی خودکار هر ۳ ثانیه"
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>{autoRefresh ? 'همگام‌سازی زنده فعال' : 'همگام‌سازی خودکار خاموش'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={handleManualRefresh}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            title="به‌روزرسانی دستی لاگ‌ها"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Copy All Logs */}
          <button
            type="button"
            onClick={handleCopyAllLogs}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            title="کپی کردن کل لاگ‌ها به صورت دیتای خام JSON"
          >
            {copiedAll ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline">{copiedAll ? 'کپی شد!' : 'کپی کل JSON'}</span>
          </button>

          {/* Clear Logs */}
          <button
            type="button"
            onClick={handleClear}
            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 transition cursor-pointer"
            title="پاکسازی لاگ‌ها"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Close Modal (if in modal mode) */}
          {isOpenAsModal && onCloseModal && (
            <button
              type="button"
              onClick={onCloseModal}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer mr-2"
            >
              بستن
            </button>
          )}
        </div>
      </div>

      {/* Interactive Command & Default Buttons Tester Section */}
      <div className="p-4 sm:p-5 bg-slate-900/60 border-b border-slate-800/80 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-black text-amber-300">
              شبیه‌ساز و تستر تعاملی ربات (ساید مشتری و بررسی فاکتور)
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            برای تست دقیق و تفکیک علت مشکل (شناخت فاکتور vs اتصال به سرور vs خواندن اقلام) روی دکمه‌های زیر کلیک کنید:
          </span>
        </div>

        {/* Quick Action Default Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {/* Button 1: Test Current / Sample Order Invoice */}
          <button
            type="button"
            disabled={isExecutingTest}
            onClick={() => {
              const code = currentOrder?.trackingCode || 'ONV-ORD-949';
              setTestCommand(`/start pay_${code.replace(/-/g, '_')}`);
              handleExecuteTest(`/start pay_${code.replace(/-/g, '_')}`);
            }}
            className="p-2.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-300 text-xs font-bold transition flex flex-col items-center gap-1.5 text-center cursor-pointer shadow-xs disabled:opacity-50"
          >
            <div className="flex items-center gap-1 text-[11px]">
              <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
              <span>تست ارسال فاکتور</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400/90 truncate max-w-full dir-ltr">
              /start pay_{currentOrder?.trackingCode ? currentOrder.trackingCode.slice(-7) : 'ONV-ORD-949'}
            </span>
          </button>

          {/* Button 2: Test Shop Button */}
          <button
            type="button"
            disabled={isExecutingTest}
            onClick={() => {
              setTestCommand('🛍️ فروشگاه اونیوال');
              handleExecuteTest('🛍️ فروشگاه اونیوال');
            }}
            className="p-2.5 rounded-xl bg-blue-950/80 hover:bg-blue-900 border border-blue-700/80 text-blue-300 text-xs font-bold transition flex flex-col items-center gap-1.5 text-center cursor-pointer shadow-xs disabled:opacity-50"
          >
            <div className="flex items-center gap-1 text-[11px]">
              <ShoppingBag className="w-3.5 h-3.5 text-blue-400" />
              <span>تست دکمه فروشگاه</span>
            </div>
            <span className="text-[10px] font-mono text-blue-400/90 truncate max-w-full">
              🛍️ مشاهده فروشگاه و کاتالوگ
            </span>
          </button>

          {/* Button 3: Test Contact Us Button */}
          <button
            type="button"
            disabled={isExecutingTest}
            onClick={() => {
              setTestCommand('📞 تماس با ما و پشتیبانی');
              handleExecuteTest('📞 تماس با ما و پشتیبانی');
            }}
            className="p-2.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/80 text-indigo-300 text-xs font-bold transition flex flex-col items-center gap-1.5 text-center cursor-pointer shadow-xs disabled:opacity-50"
          >
            <div className="flex items-center gap-1 text-[11px]">
              <PhoneCall className="w-3.5 h-3.5 text-indigo-400" />
              <span>تست دکمه تماس با ما</span>
            </div>
            <span className="text-[10px] font-mono text-indigo-400/90 truncate max-w-full">
              📞 پشتیبانی و اطلاعات تماس
            </span>
          </button>

          {/* Button 4: Test Track Order Button */}
          <button
            type="button"
            disabled={isExecutingTest}
            onClick={() => {
              setTestCommand('📦 پیگیری سفارش');
              handleExecuteTest('📦 پیگیری سفارش');
            }}
            className="p-2.5 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-700/80 text-amber-300 text-xs font-bold transition flex flex-col items-center gap-1.5 text-center cursor-pointer shadow-xs disabled:opacity-50"
          >
            <div className="flex items-center gap-1 text-[11px]">
              <Package className="w-3.5 h-3.5 text-amber-400" />
              <span>تست دکمه پیگیری</span>
            </div>
            <span className="text-[10px] font-mono text-amber-400/90 truncate max-w-full">
              📦 پیگیری مرسوله و فاکتور
            </span>
          </button>

          {/* Button 5: Test Empty /start */}
          <button
            type="button"
            disabled={isExecutingTest}
            onClick={() => {
              setTestCommand('/start');
              handleExecuteTest('/start');
            }}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition flex flex-col items-center gap-1.5 text-center cursor-pointer shadow-xs disabled:opacity-50"
          >
            <div className="flex items-center gap-1 text-[11px]">
              <Send className="w-3.5 h-3.5 text-slate-300" />
              <span>تست دستور /start</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 truncate max-w-full">
              ورود اولیه و منوی اصلی
            </span>
          </button>
        </div>

        {/* Custom Input Runner */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
          <div className="relative flex-1 w-full">
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
              دستور آزمایشی:
            </span>
            <input
              type="text"
              value={testCommand}
              onChange={(e) => setTestCommand(e.target.value)}
              placeholder="مثال: /start pay_ONV-ORD-949 یا شماره سفارش یا فروشگاه..."
              className="w-full pl-4 pr-28 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-emerald-300 placeholder:text-slate-600 focus:outline-hidden focus:border-emerald-500"
              dir="ltr"
            />
          </div>
          <button
            type="button"
            disabled={isExecutingTest || !testCommand.trim()}
            onClick={() => handleExecuteTest()}
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/30 disabled:opacity-50 shrink-0"
          >
            {isExecutingTest ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>{isExecutingTest ? 'در حال ارسال و ارزیابی...' : 'ارسال به بک‌اند ربات'}</span>
          </button>
        </div>

        {/* Test Result Execution Verdict Banner */}
        {testResult && (
          <div className={`p-4 rounded-2xl border ${testResult.ok ? 'bg-emerald-950/40 border-emerald-800' : 'bg-rose-950/40 border-rose-800'} space-y-3`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {testResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
                <span className="text-xs font-black text-white">
                  {testResult.ok ? 'نتیجه تحلیل و پردازش درخواست در بک‌اند ربات:' : 'خطا در ارزیابی درخواست:'}
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 dir-ltr">{testResult.command}</span>
            </div>

            {/* Pipeline Diagnostic Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              {/* Step 1: Tracking Code Extraction */}
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400">۱. تفکیک و شناسایی کد رهگیری:</div>
                <div className="font-mono font-bold text-amber-300 truncate dir-ltr">
                  {testResult.extractedCode ? `کد شناسایی شد: ${testResult.extractedCode}` : 'کد فاکتور وجود ندارد (دستور متنی عمومی)'}
                </div>
              </div>

              {/* Step 2: Database Order Lookup */}
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400">۲. جستجو و خواندن اقلام در دیتابیس:</div>
                <div className="font-bold text-slate-200">
                  {testResult.matchedOrder ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>{testResult.matchedOrder.userFullName} ({Number(testResult.matchedOrder.totalPrice || 0).toLocaleString('fa-IR')} ت)</span>
                    </span>
                  ) : testResult.extractedCode ? (
                    <span className="text-amber-400">سفارش جدید ساخته شد و در دیتابیس ثبت گردید</span>
                  ) : (
                    <span className="text-slate-400">بدون نیاز به جستجوی سفارش</span>
                  )}
                </div>
              </div>

              {/* Step 3: Bale API & Invoice Status */}
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400">۳. ارسال فاکتور و درخواست پول بله:</div>
                <div className="font-bold text-slate-200">
                  <span className="text-emerald-400">لاگ خام پیام و فاکتور در جدول زیر ثبت شد</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Toolbar & Search */}
      <div className="p-3 sm:p-4 bg-slate-900/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: `همه رویدادها (${localLogs.length})` },
            { id: 'invoices', label: '💳 فاکتورها و پرداخت' },
            { id: 'commands', label: '⚡ دکمه‌ها و دستورات' },
            { id: 'webhooks', label: '📡 وب‌هوک و ورودی‌ها' },
            { id: 'errors', label: '⚠️ خطاها' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterType === tab.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجو در متن یا JSON لاگ..."
            className="w-full pl-3 pr-8 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Main Log List Area (Terminal / Code Style) */}
      <div className="p-3 sm:p-4 overflow-y-auto max-h-[520px] space-y-2.5 font-mono text-xs">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-16 text-slate-500 font-sans space-y-2">
            <Terminal className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs">هیچ رویدادی با این فیلتر در تاریخچه لاگ ربات ثبت نشده است.</p>
            <p className="text-[11px] text-slate-600">برای ایجاد رویداد، از دکمه‌های تستر بالا یکی از دستورات را ارسال فرمایید.</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isExpanded = expandedLogId === log.id;
            const hasRawData = Boolean(log.rawPayload || log.rawResponse || log.orderInfo || log.technicalDetails);

            return (
              <div
                key={log.id}
                className={`rounded-2xl border transition overflow-hidden ${
                  log.status === 'error'
                    ? 'bg-rose-950/20 border-rose-900/60'
                    : log.status === 'warning'
                    ? 'bg-amber-950/20 border-amber-900/60'
                    : 'bg-slate-900/70 border-slate-800/80'
                }`}
              >
                {/* Summary Row */}
                <div className="p-3 sm:p-3.5 flex flex-wrap sm:flex-nowrap items-start justify-between gap-3">
                  <div className="space-y-1.5 font-sans flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Status indicator */}
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          log.status === 'error'
                            ? 'bg-rose-500 shadow-sm shadow-rose-500/50'
                            : log.status === 'warning'
                            ? 'bg-amber-400'
                            : 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                        }`}
                      />

                      {/* Platform Tag */}
                      <span className="text-[11px] font-bold text-amber-400 font-mono">
                        {log.platform === 'telegram' ? '[Telegram API]' : '[Bale API]'}
                      </span>

                      {/* Event Type */}
                      <span className="text-[10px] text-slate-300 font-mono bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                        {log.type}
                      </span>

                      {/* Timestamp */}
                      <span className="text-[10px] text-slate-400 font-mono mr-auto">
                        {log.time}
                      </span>
                    </div>

                    {/* Human readable text */}
                    <div className="text-xs text-slate-100 font-medium leading-relaxed pr-4">
                      {log.text}
                    </div>

                    {/* Details if available */}
                    {log.details && (
                      <div className="text-[11px] text-slate-400 font-mono pr-4 leading-normal">
                        {log.details}
                      </div>
                    )}
                  </div>

                  {/* Actions (Copy JSON & Expand) */}
                  <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleCopyLogJson(log)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-sans flex items-center gap-1 transition cursor-pointer"
                      title="کپی کردن اطلاعات این لاگ به صورت JSON"
                    >
                      {copiedLogId === log.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{copiedLogId === log.id ? 'کپی شد' : 'کپی'}</span>
                    </button>

                    {hasRawData && (
                      <button
                        type="button"
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className={`p-1.5 rounded-lg text-[10px] font-sans flex items-center gap-1 transition cursor-pointer ${
                          isExpanded
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                        title="نمایش دیتای خام JSON"
                      >
                        <Code2 className="w-3.5 h-3.5" />
                        <span>{isExpanded ? 'بستن کد' : 'کد و دیتای خام'}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Collapsible Raw JSON Viewer */}
                {isExpanded && hasRawData && (
                  <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-3 font-mono text-[11px] text-slate-300">
                    {/* Raw Payload Block */}
                    {log.rawPayload && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold">
                          <span>📦 داده‌های ارسالی / دریافتی (Raw Payload):</span>
                        </div>
                        <pre className="p-3 rounded-xl bg-slate-900 border border-slate-800 overflow-x-auto text-emerald-300 leading-relaxed dir-ltr">
                          {JSON.stringify(log.rawPayload, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Raw Response Block */}
                    {log.rawResponse && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-blue-400 font-bold">
                          <span>🌐 پاسخ وب‌سرویس بله (Raw Response from tapi.bale.ai):</span>
                        </div>
                        <pre className="p-3 rounded-xl bg-slate-900 border border-slate-800 overflow-x-auto text-blue-300 leading-relaxed dir-ltr">
                          {JSON.stringify(log.rawResponse, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Order & Database Details */}
                    {log.orderInfo && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold">
                          <span>🗄️ اطلاعات خوانده شده از دیتابیس (Database Record):</span>
                        </div>
                        <pre className="p-3 rounded-xl bg-slate-900 border border-slate-800 overflow-x-auto text-amber-300 leading-relaxed dir-ltr">
                          {JSON.stringify(log.orderInfo, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Status Bar */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>وب‌هوک فعال: /api/webhook/bale</span>
          </span>
          <span className="text-slate-600">|</span>
          <span>ربات: @{activeBotName}</span>
        </div>

        <div className="flex items-center gap-2">
          <span>تعداد کل رویدادها: {localLogs.length}</span>
          <span className="text-slate-600">|</span>
          <a
            href={`https://ble.ir/${activeBotName}`}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 hover:underline flex items-center gap-1 font-bold"
          >
            <span>باز کردن ربات در بله</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};

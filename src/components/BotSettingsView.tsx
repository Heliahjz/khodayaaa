import React, { useState, useEffect } from 'react';
import {
  Bot,
  Send,
  RefreshCw,
  ShieldCheck,
  Activity,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Zap,
  MessageSquare,
  Globe,
  PhoneCall,
  Mail,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  Trash2,
  Radio,
  Sparkles,
  FileText,
  Bell,
  Webhook,
  Link2,
  UserCheck,
  Headphones,
  ArrowUpRight,
  Play,
  Settings2,
  Server,
  BookOpen,
  AlertTriangle,
  ShoppingBag,
  Download,
  Code,
  FileCode
} from 'lucide-react';
import { TelegramConfig, BotActivityLog, ContactMessage, Order, SiteContent } from '../types';
import { apiFetch } from '../services/dataService';
import { sendBaleAdminWelcomeTest, saveActiveBotConfig, TestAdminWelcomeResult, LOCAL_STORAGE_BOT_CONFIG_KEY } from '../services/baleService';
import { BotTechnicalLogBox } from './BotTechnicalLogBox';

interface BotSettingsViewProps {
  config: TelegramConfig;
  logs?: BotActivityLog[];
  messages?: ContactMessage[];
  orders?: Order[];
  siteContent?: SiteContent | null;
  onUpdateConfig: (newConfig: Partial<TelegramConfig>) => Promise<void>;
  onSimulateEvent: (type: string, payload?: any) => Promise<any>;
  onRespondMessage?: (id: number, response: string) => Promise<void>;
  onNavigate?: (tab: any) => void;
  onRefreshData?: () => Promise<void>;
}

type HubTab = 'bots-config' | 'live-tester' | 'support-channels' | 'templates-automation' | 'logs-desk';



export const BotSettingsView: React.FC<BotSettingsViewProps> = ({
  config,
  logs = [],
  messages = [],
  orders = [],
  siteContent,
  onUpdateConfig,
  onSimulateEvent,
  onRespondMessage,
  onNavigate,
  onRefreshData,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<HubTab>('bots-config');
  const [formData, setFormData] = useState<TelegramConfig>(() => ({
    customerBotToken: config?.customerBotToken || config?.baleBotToken || config?.botToken || '',
    customerBotUsername: config?.customerBotUsername || config?.baleBotUsername || config?.botUsername || 'Onivalbot',
    customerBotEnabled: config?.customerBotEnabled ?? true,
    adminBotToken: config?.adminBotToken || '',
    adminBotUsername: config?.adminBotUsername || 'onivaladminbot',
    adminChatId: config?.adminChatId || config?.baleAdminChatId || '',
    adminBotEnabled: config?.adminBotEnabled ?? true,

    botToken: config?.botToken || config?.baleBotToken || '',
    botUsername: config?.botUsername || 'Onivalbot',
    baleAdminUsername: config?.baleAdminUsername || '',
    balePaymentMode: config?.balePaymentMode || 'live',
    balePaymentTokenLive: config?.balePaymentTokenLive || '',
    balePaymentTokenTest: config?.balePaymentTokenTest || '',
    balePaymentToken: config?.balePaymentToken || '',
    baleAutoSendInvoice: config?.baleAutoSendInvoice ?? true,
    baleAutoNotifyAdminAllTransactions: config?.baleAutoNotifyAdminAllTransactions ?? true,
    baleAdminDirectApproval: config?.baleAdminDirectApproval ?? true,
    baseUrl: config?.baseUrl || 'https://tapi.bale.ai',
    panelBaseUrl: config?.panelBaseUrl || window.location.origin,
    antiSpamSeconds: config?.antiSpamSeconds ?? 5,
    active: config?.active ?? true,

    telegramBotEnabled: config?.telegramBotEnabled ?? true,
    telegramBotToken: config?.telegramBotToken || '',
    telegramAdminChatId: config?.telegramAdminChatId || '',
    telegramBotUsername: config?.telegramBotUsername || 'onival_shop_bot',
    telegramBaseUrl: config?.telegramBaseUrl || 'https://api.telegram.org',
    telegramWebhookUrl: config?.telegramWebhookUrl || `${window.location.origin}/api/webhook/telegram`,

    baleWebhookUrl: config?.baleWebhookUrl || `${window.location.origin}/api/webhook/bale`,
    webhookSecretToken: config?.webhookSecretToken || '',

    telegramSupportId: config?.telegramSupportId || siteContent?.contactTelegramId || '@onival_support',
    telegramChannelId: config?.telegramChannelId || '@onival_official',
    baleSupportId: config?.baleSupportId || siteContent?.contactBaleId || '@onival_bale_support',
    baleChannelId: config?.baleChannelId || '@onival_bale',
    instagramId: config?.instagramId || siteContent?.contactInstagramId || '@onival.ir',
    whatsappNumber: config?.whatsappNumber || '09123456789',
    eitaaSupportId: config?.eitaaSupportId || '@onival_eitaa',
    rubikaSupportId: config?.rubikaSupportId || '@onival_rubika',
    supportPhone: config?.supportPhone || siteContent?.contactPhone || '021-88776655',
    supportEmail: config?.supportEmail || siteContent?.contactEmail || 'support@onival.ir',
    workingHours: config?.workingHours || siteContent?.contactWorkingHours || 'شنبه تا پنجشنبه از ساعت ۹ صبح الی ۲۱ شب',
    autoReplyEnabled: config?.autoReplyEnabled ?? true,
    floatingWidgetEnabled: config?.floatingWidgetEnabled ?? true,

    notifyOnNewOrder: config?.notifyOnNewOrder ?? true,
    notifyOnReceiptUpload: config?.notifyOnReceiptUpload ?? true,
    notifyOnNewTicket: config?.notifyOnNewTicket ?? true,
    notifyCustomerOnStatusChange: config?.notifyCustomerOnStatusChange ?? true,

    welcomeTemplate:
      config?.welcomeTemplate ||
      'سلام {name} عزیز! 🌸 به ربات رسمی فروشگاه تخصصی فرآورده‌های ارگانیک اونیوال خوش آمدید.\nبرای پیگیری سفارش یا پرداخت فاکتور، کد پیگیری خود را ارسال نمایید.',
    orderInvoiceTemplate:
      config?.orderInvoiceTemplate ||
      '🛍 سفارش جدید در فروشگاه اونیوال ثبت شد!\n🔖 کد پیگیری: {trackingCode}\n👤 مشتری: {customerName}\n💳 مبلغ کل: {totalPrice} تومان\n📍 وضعیت: در انتظار پرداخت',
    receiptApprovedTemplate:
      config?.receiptApprovedTemplate ||
      '✅ مشتری گرامی {customerName}، فیش واریزی شما برای سفارش #{trackingCode} تایید شد و بسته شما وارد مرحله آماده‌سازی گردید.',
    supportReplyTemplate:
      config?.supportReplyTemplate ||
      '💬 پاسخ پشتیبانی اونیوال به پیام شما (کد پیگیری #{trackingCode}):\n\n{response}\n\nبا تشکر از همراهی شما🌺',
  }));

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const updateField = (patch: Partial<TelegramConfig>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
    setHasUnsavedChanges(true);
  };

  // Only sync from parent config when the user doesn't have unsaved local edits
  useEffect(() => {
    if (!hasUnsavedChanges && config) {
      setFormData((prev) => ({
        ...prev,
        ...config,
      }));
    }
  }, [config, hasUnsavedChanges]);

  // UI states
  const [showBaleToken, setShowBaleToken] = useState(false);
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // Bale Welcome Test State
  const [welcomeTestResult, setWelcomeTestResult] = useState<TestAdminWelcomeResult | null>(null);
  const [isSendingWelcomeTest, setIsSendingWelcomeTest] = useState(false);

  // Live Connection Tester States
  const [testingPlatform, setTestingPlatform] = useState<'bale' | 'telegram' | null>(null);
  const [baleDiagnostics, setBaleDiagnostics] = useState<any | null>(null);
  const [telegramDiagnostics, setTelegramDiagnostics] = useState<any | null>(null);

  // Live Message Dispatcher States
  const [testTargetPlatform, setTestTargetPlatform] = useState<'bale' | 'telegram' | 'both'>('both');
  const [testChatId, setTestChatId] = useState<string>(config.adminChatId || '');
  const [testMessageText, setTestMessageText] = useState<string>(
    '🔔 پیام تست مستقیم از مرکز فرماندهی پشتیبانی اونیوال\n✅ ارتباط وب‌سرویس ربات برقرار و آماده دریافت سفارشات است.'
  );
  const [isSendingTestMsg, setIsSendingTestMsg] = useState(false);
  const [lastSendResult, setLastSendResult] = useState<any | null>(null);

  // Webhook Tester States
  const [webhookLoading, setWebhookLoading] = useState<string | null>(null);
  const [webhookResult, setWebhookResult] = useState<any | null>(null);

  // Bale Invoice & Payment Cycle Simulator States
  const [isSendingInvoiceTest, setIsSendingInvoiceTest] = useState(false);
  const [invoiceTestResult, setInvoiceTestResult] = useState<any | null>(null);
  const [isSimulatingBaleCycle, setIsSimulatingBaleCycle] = useState(false);
  const [baleCycleResult, setBaleCycleResult] = useState<any | null>(null);

  // Quick Reply State for Support Desk
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // Standalone PHP Files Viewer & Downloader for public_html
  const [phpModal, setPhpModal] = useState<{ open: boolean; filename: string; title: string; code: string; loading: boolean } | null>(null);

  const fetchDynamicPhpCode = async (fileName: string): Promise<string> => {
    const cleanFile = fileName.replace(/[^a-zA-Z0-9_.-]/g, '');
    const res = await apiFetch(`/api/bot/php-code/${cleanFile}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || errData.message || 'خطا در دریافت کد فایل از سرور');
    }
    const data = await res.json();
    return data.code;
  };

  const handleDownloadPhp = async (fileName: string) => {
    try {
      const code = await fetchDynamicPhpCode(fileName);
      const blob = new Blob([code], { type: 'application/x-httpd-php;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`فایل استاندارد و ایمن ${fileName} بر اساس تنظیمات فعلی دانلود گردید.`, 'success');
    } catch (err: any) {
      showToast(`خطا در دانلود ${fileName}: ${err.message}`, 'error');
    }
  };

  const handleOpenPhpCodeModal = async (fileName: string, title: string) => {
    setPhpModal({ open: true, filename: fileName, title, code: 'در حال تولید امن کدهای سازگار با PHP 8.5...', loading: true });
    try {
      const code = await fetchDynamicPhpCode(fileName);
      setPhpModal({ open: true, filename: fileName, title, code, loading: false });
    } catch (err: any) {
      setPhpModal(prev => prev ? { ...prev, code: `// خطا در بارگذاری: ${err.message}`, loading: false } : null);
    }
  };

  const handleCopyPhpCode = async (fileName: string) => {
    try {
      const code = await fetchDynamicPhpCode(fileName);
      await navigator.clipboard.writeText(code);
      showToast(`کدهای به‌روز فایل ${fileName} در حافظه کپی شد. می‌توانید در File Manager هاست ذخیره نمایید.`, 'success');
    } catch (err: any) {
      showToast(`خطا در کپی کدهای ${fileName}: ${err.message}`, 'error');
    }
  };

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleTestSendInvoice = async () => {
    setIsSendingInvoiceTest(true);
    setInvoiceTestResult(null);
    try {
      const activeToken = formData.balePaymentMode === 'test' ? formData.balePaymentTokenTest : formData.balePaymentTokenLive;
      const res = await apiFetch('/api/bot/test-send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: testChatId || formData.adminChatId,
          providerToken: activeToken || '',
          priceToman: 350000
        }),
      });
      const data = await res.json();
      setInvoiceTestResult(data);
      if (onRefreshData) await onRefreshData();
      showToast(data.message || 'فاکتور تست ارسال شد.', data.ok ? 'success' : 'error');
    } catch (err: any) {
      showToast(`خطا در ارسال فاکتور آزمایشی: ${err.message}`, 'error');
    } finally {
      setIsSendingInvoiceTest(false);
    }
  };

  const handleSimulateBaleCycle = async () => {
    setIsSimulatingBaleCycle(true);
    setBaleCycleResult(null);
    try {
      const res = await apiFetch('/api/bot/simulate-bale-payment-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setBaleCycleResult(data);
      if (onRefreshData) await onRefreshData();
      showToast(data.message || 'چرخه پرداخت بله با موفقیت شبیه‌سازی شد.', 'success');
    } catch (err: any) {
      showToast(`خطا در اجرای چرخه شبیه‌ساز: ${err.message}`, 'error');
    } finally {
      setIsSimulatingBaleCycle(false);
    }
  };

  const [showCustomerBotToken, setShowCustomerBotToken] = useState(false);
  const [showAdminBotToken, setShowAdminBotToken] = useState(false);
  const [isTestingCustomerBot, setIsTestingCustomerBot] = useState(false);
  const [customerBotTestResult, setCustomerBotTestResult] = useState<any | null>(null);
  const [isTestingAdminBot, setIsTestingAdminBot] = useState(false);
  const [adminBotTestResult, setAdminBotTestResult] = useState<any | null>(null);

  const handleTestCustomerBot = async () => {
    setIsTestingCustomerBot(true);
    setCustomerBotTestResult(null);
    try {
      const res = await apiFetch('/api/bot/test-customer-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: formData.customerBotToken || formData.baleBotToken || formData.botToken
        })
      });
      const data = await res.json();
      setCustomerBotTestResult(data);
      if (onRefreshData) await onRefreshData();
      showToast(data.message || 'وضعیت ربات مشتری استعلام شد.', data.ok ? 'success' : 'error');
    } catch (err: any) {
      showToast(`خطا در بررسی ربات مشتری: ${err.message}`, 'error');
    } finally {
      setIsTestingCustomerBot(false);
    }
  };

  const handleTestAdminBot = async () => {
    setIsTestingAdminBot(true);
    setAdminBotTestResult(null);
    try {
      const res = await apiFetch('/api/bot/test-admin-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: formData.adminBotToken || '',
          chatId: formData.adminChatId || formData.baleAdminChatId
        })
      });
      const data = await res.json();
      setAdminBotTestResult(data);
      if (onRefreshData) await onRefreshData();
      showToast(data.message || 'پیام تست به اکانت ادمین ارسال شد.', data.ok ? 'success' : 'error');
    } catch (err: any) {
      showToast(`خطا در ارسال پیام به ادمین: ${err.message}`, 'error');
    } finally {
      setIsTestingAdminBot(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveAll = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      const { savedAt } = await saveActiveBotConfig(formData);
      await onUpdateConfig(formData);
      setHasUnsavedChanges(false);
      setSaveSuccessNotice('تنظیمات، توکن‌های ربات‌ها و اطلاعات ادمین با موفقیت روی دیسک سرور ذخیره شد.');
      setTimeout(() => setSaveSuccessNotice(null), 6000);
      if (onRefreshData) await onRefreshData();
      showToast('تمامی توکن‌ها، چت‌آیدی‌ها و تنظیمات ربات‌ها با موفقیت در دیتابیس سرور ذخیره شدند.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'خطا در ذخیره‌سازی تنظیمات', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Real Test: Send Welcome Message to Admin on Bale
  const handleSendAdminWelcomeTest = async () => {
    setIsSendingWelcomeTest(true);
    setWelcomeTestResult(null);
    try {
      const tokenToUse = String(formData.botToken || formData.baleBotToken || '').trim();
      const chatIdToUse = String(formData.adminChatId || formData.baleAdminChatId || '').trim();
      const baseUrlToUse = String(formData.baseUrl || formData.baleBaseUrl || 'https://tapi.bale.ai').trim();
      const botUserToUse = String(formData.botUsername || formData.baleBotUsername || 'Onivalbot').replace(/^@/, '').trim();

      const syncedForm = {
        ...formData,
        botToken: tokenToUse,
        baleBotToken: tokenToUse,
        adminChatId: chatIdToUse,
        baleAdminChatId: chatIdToUse,
        botUsername: botUserToUse,
        baleBotUsername: botUserToUse,
      };

      // 1. Immediately save current form data to LocalStorage so any new token or chatId typed is active
      await saveActiveBotConfig(syncedForm);
      setLastSavedAt(new Date().toLocaleTimeString('fa-IR'));
      setHasUnsavedChanges(false);

      // 2. Dispatch real welcome test
      const res = await sendBaleAdminWelcomeTest({
        botToken: tokenToUse,
        chatId: chatIdToUse,
        baseUrl: baseUrlToUse,
      });
      setWelcomeTestResult(res);
      if (res.ok) {
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
      if (onRefreshData) await onRefreshData();
    } catch (err: any) {
      showToast(`خطا در ارسال پیام به ادمین: ${err?.message || 'خطای اتصال'}`, 'error');
    } finally {
      setIsSendingWelcomeTest(false);
    }
  };

  // Real API Test Connection (getMe)
  const handleTestBotConnection = async (platform: 'bale' | 'telegram') => {
    setTestingPlatform(platform);
    try {
      const token = platform === 'bale' ? formData.botToken : formData.telegramBotToken;
      const baseUrl = platform === 'bale' ? formData.baseUrl : formData.telegramBaseUrl;

      const res = await apiFetch('/api/bot/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, botToken: token, baseUrl }),
      });
      const data = await res.json();
      if (platform === 'bale') {
        setBaleDiagnostics(data);
      } else {
        setTelegramDiagnostics(data);
      }
      if (onRefreshData) await onRefreshData();
      showToast(data.message || 'تست اتصال انجام شد.', data.success ? 'success' : 'error');
    } catch (err: any) {
      showToast(`خطا در تست اتصال: ${err.message}`, 'error');
    } finally {
      setTestingPlatform(null);
    }
  };

  // Real API Send Test Message (sendMessage)
  const handleSendRealMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testMessageText.trim()) return;
    setIsSendingTestMsg(true);
    setLastSendResult(null);

    try {
      if (testTargetPlatform === 'both') {
        const [resBale, resTg] = await Promise.all([
          apiFetch('/api/bot/send-test-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              platform: 'bale',
              botToken: formData.botToken,
              baseUrl: formData.baseUrl,
              chatId: testChatId || formData.adminChatId,
              text: testMessageText,
            }),
          }).then((r) => r.json()),
          apiFetch('/api/bot/send-test-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              platform: 'telegram',
              botToken: formData.telegramBotToken,
              baseUrl: formData.telegramBaseUrl,
              chatId: testChatId || formData.telegramAdminChatId,
              text: testMessageText,
            }),
          }).then((r) => r.json()),
        ]);

        setLastSendResult({
          mode: 'both',
          bale: resBale,
          telegram: resTg,
          time: new Date().toLocaleTimeString('fa-IR'),
        });
        showToast('پیام تست به هر دو ربات بله و تلگرام ارسال گردید.', 'success');
      } else {
        const isBale = testTargetPlatform === 'bale';
        const res = await apiFetch('/api/bot/send-test-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: testTargetPlatform,
            botToken: isBale ? formData.botToken : formData.telegramBotToken,
            baseUrl: isBale ? formData.baseUrl : formData.telegramBaseUrl,
            chatId: testChatId || (isBale ? formData.adminChatId : formData.telegramAdminChatId),
            text: testMessageText,
          }),
        });
        const data = await res.json();
        setLastSendResult({
          mode: 'single',
          platform: testTargetPlatform,
          result: data,
          time: new Date().toLocaleTimeString('fa-IR'),
        });
        showToast(data.message || 'پیام تست ارسال شد.', data.success ? 'success' : 'error');
      }
      if (onRefreshData) await onRefreshData();
    } catch (err: any) {
      showToast(`خطا در ارسال پیام: ${err.message}`, 'error');
    } finally {
      setIsSendingTestMsg(false);
    }
  };

  // Real Webhook Action
  const handleWebhookAction = async (platform: 'bale' | 'telegram', action: 'set' | 'delete' | 'info') => {
    const key = `${platform}-${action}`;
    setWebhookLoading(key);
    try {
      const isBale = platform === 'bale';
      const res = await apiFetch('/api/bot/webhook-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          action,
          botToken: isBale ? formData.botToken : formData.telegramBotToken,
          baseUrl: isBale ? formData.baseUrl : formData.telegramBaseUrl,
          webhookUrl: isBale ? formData.baleWebhookUrl : formData.telegramWebhookUrl,
        }),
      });
      const data = await res.json();
      setWebhookResult({ platform, action, ...data });
      if (onRefreshData) await onRefreshData();
      showToast(data.message || 'عملیات وب‌هوک انجام شد.', 'success');
    } catch (err: any) {
      showToast(`خطا در عملیات وب‌هوک: ${err.message}`, 'error');
    } finally {
      setWebhookLoading(null);
    }
  };

  // Clear logs
  const handleClearLogs = async () => {
    try {
      await apiFetch('/api/bot/logs', { method: 'DELETE' });
      if (onRefreshData) await onRefreshData();
      showToast('گزارش‌های فعالیت ربات پاکسازی شد.', 'info');
    } catch {
      showToast('خطا در پاکسازی لاگ‌ها', 'error');
    }
  };

  // Simulate event helper
  const handleQuickSimulate = async (type: string, payload?: any) => {
    try {
      const res = await onSimulateEvent(type, payload);
      showToast(res?.message || 'رویداد با موفقیت اجرا شد.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'خطا در اجرای رویداد', 'error');
    }
  };

  // Quick reply to ticket
  const handleQuickReplySubmit = async (msgId: number) => {
    if (!replyText.trim() || !onRespondMessage) return;
    setIsSubmittingReply(true);
    try {
      await onRespondMessage(msgId, replyText);
      setReplyText('');
      setReplyingId(null);
      showToast('پاسخ شما ثبت شد و از طریق ربات به اطلاع کاربر رسید.', 'success');
    } catch {
      showToast('خطا در ارسال پاسخ', 'error');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const unreadMessages = messages.filter((m) => !m.adminResponse);
  const pendingReceiptOrders = orders.filter(
    (o) => o.paymentStatus === 'PendingVerification' || Boolean((o.receiptImageUrl || o.receiptImage) && o.paymentStatus !== 'Paid')
  );

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Top Command Center Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 text-white shadow-lg border border-slate-700/60 relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>مرکز جامع ارتباطات پشتیبانی، ربات‌های بله و تلگرام و وب‌هوک‌ها</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
              <Bot className="w-7 h-7 text-amber-400 shrink-0" />
              <span>مدیریت یکپارچه ربات‌های تلگرام و بله و درگاه‌های پشتیبانی</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              در این بخش می‌توانید توکن ربات‌های <strong className="text-white">بله (Bale)</strong> و <strong className="text-white">تلگرام (Telegram)</strong> را تنظیم کنید، اتصال واقعی به سرورهای API را تست نمایید، پیام آزمایشی زنده بفرستید و آیدی‌های پشتیبانی سایت را مدیریت کنید.
            </p>
          </div>

          {/* Live Status Badges & Save Button */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-2xl px-4 py-2.5 flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${formData.active ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-rose-400'}`} />
              <div>
                <div className="text-[11px] text-slate-300">ربات بله (Bale Bot)</div>
                <div className="text-xs font-bold text-white font-mono">@{formData.botUsername || 'Onivalbot'}</div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-2xl px-4 py-2.5 flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${formData.telegramBotEnabled ? 'bg-sky-400 shadow-sm shadow-sky-400' : 'bg-slate-400'}`} />
              <div>
                <div className="text-[11px] text-slate-300">ربات تلگرام (Telegram)</div>
                <div className="text-xs font-bold text-white font-mono">@{formData.telegramBotUsername || 'onival_shop_bot'}</div>
              </div>
            </div>

            <button
              onClick={() => handleSaveAll()}
              disabled={isSaving}
              className={`px-5 py-3 rounded-2xl font-black text-xs shadow-lg transition flex items-center gap-2 cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-400/30 ring-2 ring-white/40 animate-pulse'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSaving
                  ? 'در حال ثبت و ذخیره دائمی...'
                  : hasUnsavedChanges
                  ? 'ذخیره تغییرات جدید (ثبت نشده)'
                  : 'ذخیره و اعمال کل تنظیمات'}
              </span>
            </button>
            {lastSavedAt && (
              <div className="text-[11px] text-emerald-300 font-medium bg-emerald-950/60 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
                آخرین ذخیره دائمی: {lastSavedAt}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-sm transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : toastMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-xs opacity-70 hover:opacity-100 font-bold">
            بستن
          </button>
        </div>
      )}

      {/* Quick KPI Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">وضعیت سرویس بله</span>
            <div className="text-base font-black text-slate-800 mt-0.5 flex items-center gap-1.5">
              <span>{formData.active ? 'متصل و فعال' : 'غیرفعال'}</span>
              <span className="text-[11px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">tapi.bale.ai</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">وضعیت سرویس تلگرام</span>
            <div className="text-base font-black text-slate-800 mt-0.5 flex items-center gap-1.5">
              <span>{formData.telegramBotEnabled ? 'متصل و فعال' : 'غیرفعال'}</span>
              <span className="text-[11px] font-mono text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md">api.telegram.org</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <Send className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">تیکت‌های منتظر پاسخ</span>
            <div className="text-base font-black text-slate-800 mt-0.5">
              {unreadMessages.length} پیام پشتیبانی
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Headphones className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">فیش‌های منتظر تایید</span>
            <div className="text-base font-black text-slate-800 mt-0.5">
              {pendingReceiptOrders.length} فیش واریزی
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-2">
        {[
          { id: 'bots-config', label: '۱. توکن و پیکربندی ربات‌ها (بله و تلگرام)', icon: Bot },
          { id: 'live-tester', label: '۲. تست واقعی اتصال، ارسال پیام و وب‌هوک', icon: Zap },
          { id: 'support-channels', label: '۳. کانال‌های پشتیبانی و ارتباطات مشتری', icon: Headphones },
          { id: 'templates-automation', label: '۴. قالب پیام‌های خودکار و اعلان‌ها', icon: Bell },
          { id: 'logs-desk', label: '۵. میز کار پشتیبانی و لاگ زنده ربات', icon: Terminal, badge: logs.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as HubTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-700'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: BOTS CONFIGURATION (BALE & TELEGRAM TOKENS) */}
      {activeSubTab === 'bots-config' && (
        <form onSubmit={handleSaveAll} className="space-y-6">
          {/* STANDALONE PHP BOT FILES FOR PUBLIC_HTML */}
          <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 text-white shadow-xl border border-indigo-500/30 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                  <Server className="w-3.5 h-3.5 text-emerald-400" />
                  <span>راهکار ۱۰۰٪ مستقل و خودکفا برای آپلود دستی در پوشه public_html هاست</span>
                </div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-amber-400" />
                  <span>فایل‌های اختصاصی PHP ربات‌ها (بدون نیاز به روشن ماندن Node.js)</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                  این فایل‌ها مستقل از Node.js هستند و توسط وب‌سرورهای آپاچی و لایت‌اسپید هاست‌های اشتراکی سی‌پنل اجرا می‌شوند. کافیست فایل‌ها را دانلود کرده و مستقیماً در پوشه <code className="bg-black/40 px-2 py-0.5 rounded text-amber-300 font-mono font-bold">public_html</code> قرار دهید.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPhp('bale-bot.php')}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-950" />
                  <span>دانلود bale-bot.php</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadPhp('telegram-bot.php')}
                  className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-slate-950 font-black text-xs transition flex items-center gap-2 shadow-lg shadow-sky-500/20 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-950" />
                  <span>دانلود telegram-bot.php</span>
                </button>
              </div>
            </div>

            {/* Grid of File Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* File 1: bale-bot.php */}
              <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-emerald-400/30 flex flex-col justify-between space-y-4 hover:border-emerald-400/60 transition">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500 text-slate-950">مخصوص بله (اصلی)</span>
                    <span className="text-[11px] font-mono text-slate-400">PHP 7.4+</span>
                  </div>
                  <h4 className="text-sm font-black text-white font-mono flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-emerald-400" />
                    <span>bale-bot.php</span>
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    شامل منوی کامل دکمه‌های شیشه‌ای، صدور فاکتور کیف‌پول، پاسخگویی به استعلام فاکتور و اطلاع به ادمین پس از پرداخت قطعی.
                  </p>
                  <div className="mt-3 p-2 rounded-xl bg-black/40 border border-white/5 space-y-1 text-[11px]">
                    <div className="text-slate-400">مسیر آپلود در هاست:</div>
                    <code className="text-amber-300 font-mono block">public_html/bale-bot.php</code>
                    <div className="text-slate-400 mt-1">آدرس وب‌هوک در بله:</div>
                    <code className="text-emerald-300 font-mono block truncate" title={`${formData.panelBaseUrl || window.location.origin}/bale-bot.php`}>
                      {(formData.panelBaseUrl || window.location.origin).replace(/\/+$/, '')}/bale-bot.php
                    </code>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadPhp('bale-bot.php')}
                      className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>دانلود فایل</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyPhpCode('bale-bot.php')}
                      className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>کپی کدها</span>
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenPhpCodeModal('bale-bot.php', 'کدهای کامل فایل اختصاصی بله (bale-bot.php)')}
                      className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition text-center cursor-pointer"
                    >
                      مشاهده آنلاین کدهای PHP
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const origin = (formData.panelBaseUrl || window.location.origin).replace(/\/+$/, '');
                        updateField({ baleWebhookUrl: `${origin}/bale-bot.php` });
                        showToast('آدرس وب‌هوک بله به فایل روت bale-bot.php تغییر یافت. دکمه «ثبت در بله» را بزنید.', 'info');
                      }}
                      className="px-2 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-bold transition text-center cursor-pointer"
                      title="تنظیم آدرس این فایل به عنوان وب‌هوک ربات مشتری"
                    >
                      تنظیم به عنوان وب‌هوک
                    </button>
                  </div>
                </div>
              </div>

              {/* File 2: telegram-bot.php */}
              <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-sky-400/30 flex flex-col justify-between space-y-4 hover:border-sky-400/60 transition">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-sky-500 text-slate-950">مخصوص تلگرام</span>
                    <span className="text-[11px] font-mono text-slate-400">PHP 7.4+</span>
                  </div>
                  <h4 className="text-sm font-black text-white font-mono flex items-center gap-1.5">
                    <Send className="w-4 h-4 text-sky-400" />
                    <span>telegram-bot.php</span>
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    دریافت و پاسخ پیام‌ها در تلگرام، منوی دکمه‌ها، استعلام فاکتور و اطلاع به ادمین پس از پرداخت.
                  </p>
                  <div className="mt-3 p-2 rounded-xl bg-black/40 border border-white/5 space-y-1 text-[11px]">
                    <div className="text-slate-400">مسیر آپلود در هاست:</div>
                    <code className="text-amber-300 font-mono block">public_html/telegram-bot.php</code>
                    <div className="text-slate-400 mt-1">آدرس وب‌هوک در تلگرام:</div>
                    <code className="text-sky-300 font-mono block truncate" title={`${formData.panelBaseUrl || window.location.origin}/telegram-bot.php`}>
                      {(formData.panelBaseUrl || window.location.origin).replace(/\/+$/, '')}/telegram-bot.php
                    </code>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadPhp('telegram-bot.php')}
                      className="px-3 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>دانلود فایل</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyPhpCode('telegram-bot.php')}
                      className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>کپی کدها</span>
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenPhpCodeModal('telegram-bot.php', 'کدهای کامل فایل اختصاصی تلگرام (telegram-bot.php)')}
                      className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition text-center cursor-pointer"
                    >
                      مشاهده آنلاین کدهای PHP
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const origin = (formData.panelBaseUrl || window.location.origin).replace(/\/+$/, '');
                        updateField({ telegramWebhookUrl: `${origin}/telegram-bot.php` });
                        showToast('آدرس وب‌هوک تلگرام به فایل روت telegram-bot.php تغییر یافت. دکمه «ثبت در تلگرام» را بزنید.', 'info');
                      }}
                      className="px-2 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-[10px] font-bold transition text-center cursor-pointer"
                      title="تنظیم آدرس این فایل به عنوان وب‌هوک ربات تلگرام"
                    >
                      تنظیم به عنوان وب‌هوک
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 3: PHP 8.5 & cPanel Deployment Guide */}
              <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-indigo-400/30 flex flex-col justify-between space-y-4 hover:border-indigo-400/60 transition">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-500 text-white">سازگار با PHP 8.5 و 8.x</span>
                    <span className="text-[11px] font-mono text-slate-400">بدون وابستگی خارجی</span>
                  </div>
                  <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-indigo-400" />
                    <span>مراحل استقرار در cPanel</span>
                  </h4>
                  <ul className="text-[11px] text-slate-300 mt-2 space-y-1.5 list-disc list-inside leading-relaxed">
                    <li>فایل <strong className="text-emerald-300 font-mono">bale-bot.php</strong> را از دکمه بالا دانلود فرمایید.</li>
                    <li>در سی‌پنل وارد <strong className="text-white">File Manager</strong> شده و فایل را در روت <strong className="text-amber-300 font-mono">public_html</strong> آپلود فرمایید.</li>
                    <li>در کارت زیر دکمه <strong className="text-emerald-400">«ثبت وب‌هوک در بله»</strong> را بزنید؛ توکن امنیتی به صورت خودکار ثبت می‌گردد.</li>
                  </ul>
                </div>

                <div className="pt-2 border-t border-white/10 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadPhp('bale-bot.php')}
                    className="flex-1 px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>دانلود bale-bot.php (PHP 8.5)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* TWO-BOT DEDICATED ARCHITECTURE (Customer Bot & Admin Bot) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-full min-w-0">
            {/* Card 1: ربات ۱: ربات اختصاصی پرداخت و ارتباط با مشتریان (Customer & Payment Bot) */}
            <div className="w-full max-w-full min-w-0 bg-white rounded-2xl border-2 border-emerald-400/80 shadow-md overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-4 sm:p-5 bg-gradient-to-l from-emerald-100/90 via-emerald-50 to-white border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-600/30 shrink-0">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-700 text-white shadow-xs shrink-0">ربات ۱</span>
                        <h3 className="text-sm font-black text-slate-900 break-words">ربات مشتری و پرداخت (@{(formData.customerBotUsername || formData.botUsername || 'Onivalbot').replace('@', '')})</h3>
                      </div>
                      <p className="text-[11px] text-emerald-800 font-medium break-words mt-0.5">ساید مشتری: صدور پیش‌فاکتور، دکمه پرداخت مستقیم کیف پول بله، دکمه‌های فروشگاه و پشتیبانی</p>
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-emerald-200 shadow-2xs shrink-0">
                    <span className="text-xs font-black text-slate-800">{formData.customerBotEnabled !== false ? 'فعال' : 'غیرفعال'}</span>
                    <input
                      type="checkbox"
                      checked={formData.customerBotEnabled !== false}
                      onChange={(e) => updateField({ customerBotEnabled: e.target.checked, active: e.target.checked })}
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                  </label>
                </div>

                <div className="p-4 sm:p-5 space-y-4">
                  {/* Notice: Customer sees only this */}
                  <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-3 text-xs text-emerald-950 flex items-start sm:items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
                    <span className="break-words">مشتریان در وب‌سایت فقط نام و آدرس این ربات را می‌بینند (<strong className="font-mono text-emerald-900">ble.ir/{(formData.customerBotUsername || formData.botUsername || 'Onivalbot').replace('@', '')}</strong>) و فاکتورها در این ربات صادر و تسویه می‌شوند.</span>
                  </div>

                  {/* Customer Bot Token */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                      <label className="text-xs font-bold text-slate-700">توکن بازوی مشتری (از @BotFather در بله)</label>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowCustomerBotToken(!showCustomerBotToken)}
                          className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                        >
                          {showCustomerBotToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{showCustomerBotToken ? 'مخفی' : 'نمایش'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(formData.customerBotToken || formData.botToken, 'customerBotToken')}
                          className="text-[11px] text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-semibold cursor-pointer"
                        >
                          {copiedKey === 'customerBotToken' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedKey === 'customerBotToken' ? 'کپی شد' : 'کپی'}</span>
                        </button>
                      </div>
                    </div>
                    <input
                      type={showCustomerBotToken ? 'text' : 'password'}
                      dir="ltr"
                      value={formData.customerBotToken || formData.botToken}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        updateField({ customerBotToken: val, botToken: val, baleBotToken: val });
                      }}
                      placeholder="توکن ربات بله (دریافت شده از BotFather@)"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono text-left bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  {/* Customer Bot Username */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                      <label className="text-xs font-bold text-slate-700">آیدی / یوزرنیم ربات مشتری در بله</label>
                      <a
                        href={`https://ble.ir/${(formData.customerBotUsername || formData.botUsername || 'Onivalbot').replace('@', '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-emerald-600 hover:underline flex items-center gap-0.5 shrink-0"
                      >
                        <span className="break-all">ble.ir/{(formData.customerBotUsername || formData.botUsername || 'Onivalbot').replace('@', '')}</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                    </div>
                    <input
                      type="text"
                      dir="ltr"
                      value={formData.customerBotUsername || formData.botUsername || ''}
                      onChange={(e) => {
                        const clean = e.target.value.replace('@', '').trim();
                        updateField({ customerBotUsername: clean, botUsername: clean, baleBotUsername: clean });
                      }}
                      placeholder="Onivalbot"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono text-left focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  {/* BALE WALLET PAYMENT TOKENS SECTION */}
                  <div className="p-3.5 sm:p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                        <h4 className="text-xs font-black text-emerald-950">توکن‌های پرداخت کیف پول برای ربات مشتری</h4>
                      </div>
                      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-emerald-200 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => updateField({ balePaymentMode: 'live' })}
                          className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                            formData.balePaymentMode !== 'test'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          واقعی (Live)
                        </button>
                        <button
                          type="button"
                          onClick={() => updateField({ balePaymentMode: 'test' })}
                          className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                            formData.balePaymentMode === 'test'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          آزمایشی (Test)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">توکن پرداخت واقعی کیف پول (Live)</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={formData.balePaymentTokenLive || ''}
                          onChange={(e) => updateField({ balePaymentTokenLive: e.target.value })}
                          placeholder="WALLET-XXXXX-XXXXXXXX (از پشتیبانی بله)"
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono text-left bg-white focus:outline-hidden focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">توکن پرداخت تستی (Test)</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={formData.balePaymentTokenTest || ''}
                          onChange={(e) => updateField({ balePaymentTokenTest: e.target.value })}
                          placeholder="WALLET-TEST-1111111111111111"
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono text-left bg-white focus:outline-hidden focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Bale Webhook Configuration Box for Host */}
                    <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <label className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                          <Webhook className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>آدرس وب‌هوک ربات بله روی هاست (Bale Webhook URL)</span>
                        </label>
                        <span className="text-[10px] bg-emerald-200/80 text-emerald-900 font-bold px-2 py-0.5 rounded-full shrink-0">
                          مبتنی بر PHP هاست
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          dir="ltr"
                          value={formData.baleWebhookUrl || (formData.panelBaseUrl ? `${formData.panelBaseUrl.replace(/\/+$/, '')}/api/bale-webhook.php` : `${window.location.origin}/api/bale-webhook.php`)}
                          onChange={(e) => updateField({ baleWebhookUrl: e.target.value })}
                          placeholder="https://yourdomain.com/api/bale-webhook.php"
                          className="w-full sm:flex-1 min-w-0 px-3 py-2 border border-emerald-300 rounded-xl text-xs font-mono text-left bg-white focus:outline-hidden focus:border-emerald-600 font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const origin = formData.panelBaseUrl ? formData.panelBaseUrl.replace(/\/+$/, '') : window.location.origin;
                            updateField({ baleWebhookUrl: `${origin}/api/bale-webhook.php` });
                            showToast('آدرس پیش‌فرض فایل PHP وبهوک هاست قرار داده شد.', 'info');
                          }}
                          className="w-full sm:w-auto px-3 py-2 sm:py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100/70 text-emerald-900 rounded-xl text-[11px] font-bold transition shrink-0 cursor-pointer text-center justify-center flex items-center"
                          title="تنظیم خودکار آدرس پیش‌فرض فایل PHP هاست"
                        >
                          پیش‌فرض هاست
                        </button>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-emerald-200/60">
                        <p className="text-[10px] text-emerald-800 leading-relaxed max-w-sm break-words">
                          💡 ساختار وبهوک PHP هاست: <code className="bg-white/90 px-1.5 py-0.5 rounded font-mono font-bold text-emerald-950">/api/bale-webhook.php</code> (پشتیبانی کامل از دکمه‌های شیشه‌ای، منوی کیبورد و صدور فاکتور کیف پول).
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => handleWebhookAction('bale', 'set')}
                            disabled={webhookLoading !== null}
                            className="flex-1 sm:flex-initial justify-center px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>{webhookLoading === 'bale-set' ? 'در حال ثبت...' : 'ثبت وب‌هوک در بله'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleWebhookAction('bale', 'info')}
                            disabled={webhookLoading !== null}
                            className="flex-1 sm:flex-initial justify-center px-2.5 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-900 rounded-xl text-[11px] font-bold transition cursor-pointer"
                          >
                            <span>{webhookLoading === 'bale-info' ? 'استعلام...' : 'وضعیت'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Customer Bot Test Results Box */}
                  {customerBotTestResult && (
                    <div className={`p-3.5 rounded-xl border text-xs ${customerBotTestResult.ok ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-rose-50 border-rose-300 text-rose-950'}`}>
                      <div className="flex items-center justify-between font-bold pb-1 mb-1 border-b border-current/15 gap-2">
                        <span className="flex items-center gap-1.5 min-w-0">
                          {customerBotTestResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                          <span className="truncate">نتیجه استعلام وضعیت ربات مشتری</span>
                        </span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white border shrink-0">
                          @{customerBotTestResult.botInfo?.username || 'bot'}
                        </span>
                      </div>
                      <p className="text-[11px] break-words">{customerBotTestResult.message}</p>
                      {customerBotTestResult && !customerBotTestResult.ok && /401|unauthorized/i.test(customerBotTestResult.message || '') && (
                        <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-[11px] leading-relaxed break-words">
                          ⚠️ <strong>توکن ربات منقضی شده است:</strong> در پیام‌رسان بله به <strong>@BotFather</strong> مراجعه نمایید، با دستور <code className="bg-white px-1 py-0.5 rounded font-mono font-bold">/token</code> توکن جدید ربات را دریافت و در کادر توکن بالا قرار دهید.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <a
                  href={`https://ble.ir/${(formData.customerBotUsername || formData.botUsername || 'Onivalbot').replace('@', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 w-full sm:w-auto"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span className="break-all">صفحه چت ربات مشتری در بله</span>
                </a>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleTestCustomerBot}
                    disabled={isTestingCustomerBot}
                    className="w-full sm:w-auto justify-center px-3 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isTestingCustomerBot ? 'animate-spin' : ''}`} />
                    <span>تست اتصال ربات مشتری</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleTestSendInvoice}
                    disabled={isSendingInvoiceTest}
                    className="w-full sm:w-auto justify-center px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Send className={`w-3.5 h-3.5 shrink-0 ${isSendingInvoiceTest ? 'animate-pulse' : ''}`} />
                    <span>تست صدور فاکتور (sendInvoice)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 2: ربات ۲: ربات اختصاصی ادمین و مدیریت سفارش‌ها و فیش‌ها (Admin & Management Bot) */}
            <div className="w-full max-w-full min-w-0 bg-white rounded-2xl border-2 border-indigo-400/80 shadow-md overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-4 sm:p-5 bg-gradient-to-l from-indigo-100/90 via-indigo-50 to-white border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-600/30 shrink-0">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-700 text-white shadow-xs shrink-0">ربات ۲</span>
                        <h3 className="text-sm font-black text-slate-900 break-words">ربات ادمین و مدیریت سفارش‌ها (@{(formData.adminBotUsername || 'OnivalAdminBot').replace('@', '')})</h3>
                      </div>
                      <p className="text-[11px] text-indigo-800 font-medium break-words mt-0.5">ساید ادمین: ارسال فوری فیش‌ها، گزارش سفارشات جدید، اعلان پرداخت‌ها و تایید سفارش</p>
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shadow-2xs shrink-0">
                    <span className="text-xs font-black text-slate-800">{formData.adminBotEnabled !== false ? 'فعال' : 'غیرفعال'}</span>
                    <input
                      type="checkbox"
                      checked={formData.adminBotEnabled !== false}
                      onChange={(e) => updateField({ adminBotEnabled: e.target.checked })}
                      className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                    />
                  </label>
                </div>

                <div className="p-4 sm:p-5 space-y-4">
                  {/* Notice: Exclusive to admin */}
                  <div className="bg-indigo-50/70 border border-indigo-200/90 rounded-xl p-3 text-xs text-indigo-950 flex items-start sm:items-center gap-2">
                    <Bell className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5 sm:mt-0" />
                    <span className="break-words">تمامی اعلان‌های سفارشات جدید، تصاویر فیش‌های واریزی کارت‌به‌کارت و پیام‌های مشتری مستقیماً توسط این ربات به پیوی مدیر فرستاده می‌شوند.</span>
                  </div>

                  {/* Admin Bot Token */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                      <label className="text-xs font-bold text-slate-700">توکن بازوی اختصاصی ادمین (از @BotFather)</label>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowAdminBotToken(!showAdminBotToken)}
                          className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                        >
                          {showAdminBotToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{showAdminBotToken ? 'مخفی' : 'نمایش'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(formData.adminBotToken || '', 'adminBotToken')}
                          className="text-[11px] text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-semibold cursor-pointer"
                        >
                          {copiedKey === 'adminBotToken' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedKey === 'adminBotToken' ? 'کپی شد' : 'کپی'}</span>
                        </button>
                      </div>
                    </div>
                    <input
                      type={showAdminBotToken ? 'text' : 'password'}
                      dir="ltr"
                      value={formData.adminBotToken || ''}
                      onChange={(e) => updateField({ adminBotToken: e.target.value.trim() })}
                      placeholder="توکن ربات ادمین (دریافت شده از BotFather@)"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono text-left bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">می‌توانید همان توکن یا یک توکن اختصاصی دیگر برای تفکیک پیام‌های ادمین وارد کنید.</span>
                  </div>

                  {/* Admin Bot Username & Admin Personal Account */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">یوزرنیم ربات ادمین بله</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={formData.adminBotUsername || ''}
                        onChange={(e) => updateField({ adminBotUsername: e.target.value.replace('@', '').trim() })}
                        placeholder="OnivalAdminBot"
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono text-left focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">آیدی اکانت شخصی ادمین بله</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={formData.baleAdminUsername || ''}
                        onChange={(e) => updateField({ baleAdminUsername: e.target.value.trim() })}
                        placeholder="@admin_username"
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono text-left focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Admin Chat ID & API Server URL */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">شناسه عددی چت ادمین (Chat ID)</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={formData.adminChatId || formData.baleAdminChatId || ''}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          updateField({ adminChatId: val, baleAdminChatId: val });
                        }}
                        placeholder="12345678"
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono text-left focus:outline-hidden focus:border-indigo-500 font-bold"
                      />
                      <span className="text-[10px] text-indigo-700 font-medium mt-1 block">چت‌آیدی حسابی که پیام‌ها و فیش‌ها به آن تحویل داده می‌شود.</span>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">آدرس سرور API بله</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={formData.baseUrl}
                        onChange={(e) => updateField({ baseUrl: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono text-left focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Admin Bot Webhook Configuration Box for Host */}
                  <div className="p-3.5 bg-indigo-50/80 border border-indigo-200/90 rounded-2xl space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <label className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                        <Webhook className="w-4 h-4 text-indigo-700 shrink-0" />
                        <span>آدرس وب‌هوک ربات ادمین روی هاست (Admin Webhook URL)</span>
                      </label>
                      <span className="text-[10px] bg-indigo-200/70 text-indigo-950 font-bold px-2 py-0.5 rounded-full shrink-0">
                        مبتنی بر PHP هاست
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        dir="ltr"
                        value={formData.baleAdminWebhookUrl || (formData.panelBaseUrl ? `${formData.panelBaseUrl.replace(/\/+$/, '')}/api/bale-webhook.php?bot=admin` : `${window.location.origin}/api/bale-webhook.php?bot=admin`)}
                        onChange={(e) => updateField({ baleAdminWebhookUrl: e.target.value })}
                        placeholder="https://yourdomain.com/api/bale-webhook.php?bot=admin"
                        className="w-full sm:flex-1 min-w-0 px-3 py-2 border border-indigo-300 rounded-xl text-xs font-mono text-left bg-white focus:outline-hidden focus:border-indigo-600 font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const origin = formData.panelBaseUrl ? formData.panelBaseUrl.replace(/\/+$/, '') : window.location.origin;
                          updateField({ baleAdminWebhookUrl: `${origin}/api/bale-webhook.php?bot=admin` });
                          showToast('آدرس پیش‌فرض وب‌هوک ربات ادمین روی هاست تنظیم شد.', 'info');
                        }}
                        className="w-full sm:w-auto px-3 py-2 sm:py-1.5 bg-white border border-indigo-300 hover:bg-indigo-100 text-indigo-950 rounded-xl text-[11px] font-bold transition shrink-0 cursor-pointer text-center justify-center flex items-center"
                        title="تنظیم خودکار آدرس پیش‌فرض وبهوک ربات ادمین روی هاست"
                      >
                        پیش‌فرض هاست
                      </button>
                    </div>

                    <p className="text-[10px] text-indigo-800 leading-relaxed break-words">
                      💡 این وبهوک دستورات مدیریتی نظیر <code className="bg-white/90 px-1 py-0.5 rounded font-mono font-bold text-indigo-950">/orders</code> و تسویه آنی سفارشات <code className="bg-white/90 px-1 py-0.5 rounded font-mono font-bold text-indigo-950">/confirm_کد</code> را روی هاست دریافت و بلافاصله پردازش می‌کند.
                    </p>
                  </div>

                  {/* Admin Bot Test Results Box */}
                  {adminBotTestResult && (
                    <div className={`p-3.5 rounded-xl border text-xs ${adminBotTestResult.ok ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-rose-50 border-rose-300 text-rose-950'}`}>
                      <div className="flex items-center justify-between font-bold pb-1 mb-1 border-b border-current/15 gap-2">
                        <span className="flex items-center gap-1.5 min-w-0">
                          {adminBotTestResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                          <span className="truncate">نتیجه تست ارسال پیام به ادمین</span>
                        </span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white border shrink-0">
                          چت: {formData.adminChatId}
                        </span>
                      </div>
                      <p className="text-[11px] break-words">{adminBotTestResult.message}</p>
                      {adminBotTestResult && !adminBotTestResult.ok && /401|unauthorized/i.test(adminBotTestResult.message || '') && (
                        <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-[11px] leading-relaxed break-words">
                          ⚠️ <strong>توکن ربات منقضی شده است:</strong> در پیام‌رسان بله به <strong>@BotFather</strong> مراجعه نمایید، با دستور <code className="bg-white px-1 py-0.5 rounded font-mono font-bold">/token</code> توکن جدید را دریافت و در کادر توکن قرار دهید.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <a
                  href={`https://ble.ir/${(formData.adminBotUsername || 'OnivalAdminBot').replace('@', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-indigo-700 hover:text-indigo-800 flex items-center gap-1 w-full sm:w-auto"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span className="break-all">صفحه چت ربات ادمین در بله</span>
                </a>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleTestAdminBot}
                    disabled={isTestingAdminBot}
                    className="w-full sm:w-auto justify-center px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md transition flex items-center gap-2 cursor-pointer"
                  >
                    <Send className={`w-3.5 h-3.5 shrink-0 ${isTestingAdminBot ? 'animate-bounce' : ''}`} />
                    <span>{isTestingAdminBot ? 'در حال ارسال به ادمین...' : 'ارسال پیام تست به اکانت ادمین'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Telegram Bot Configuration Card */}
            <div className="col-span-1 lg:col-span-2 w-full max-w-full bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between min-w-0">
              <div>
                <div className="p-5 bg-gradient-to-l from-sky-50/80 to-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
                      <Send className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-slate-800 break-words">پیکربندی ربات تلگرام (Telegram Bot)</h3>
                      <p className="text-[11px] text-slate-500 break-words">ارسال همزمان اعلان سفارشات، فیش‌های واریزی و تیکت‌های پشتیبانی در تلگرام</p>
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shrink-0">
                    <span className="text-xs font-bold text-slate-700">{formData.telegramBotEnabled ? 'فعال' : 'غیرفعال'}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(formData.telegramBotEnabled)}
                      onChange={(e) => updateField({ telegramBotEnabled: e.target.checked })}
                      className="w-4 h-4 accent-sky-600 rounded cursor-pointer"
                    />
                  </label>
                </div>

                <div className="p-5 space-y-4">
                  {/* Telegram Token */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <label className="text-xs font-bold text-slate-700">توکن ربات تلگرام (Telegram Bot Token - از @BotFather)</label>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowTelegramToken(!showTelegramToken)}
                          className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                        >
                          {showTelegramToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{showTelegramToken ? 'مخفی' : 'نمایش'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(formData.telegramBotToken || '', 'tgToken')}
                          className="text-[11px] text-sky-600 hover:text-sky-700 flex items-center gap-1 font-semibold cursor-pointer"
                        >
                          {copiedKey === 'tgToken' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedKey === 'tgToken' ? 'کپی شد' : 'کپی'}</span>
                        </button>
                      </div>
                    </div>
                    <input
                      type={showTelegramToken ? 'text' : 'password'}
                      dir="ltr"
                      value={formData.telegramBotToken || ''}
                      onChange={(e) => updateField({ telegramBotToken: e.target.value })}
                      placeholder="توکن ربات تلگرام (مثال: 123456789:ABCdefGHI...)"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono text-left bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">شناسه چت مدیر در تلگرام (Admin Chat ID)</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={formData.telegramAdminChatId || ''}
                        onChange={(e) => updateField({ telegramAdminChatId: e.target.value })}
                        placeholder="شناسه عددی چت مدیر در تلگرام"
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono text-left focus:outline-hidden focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">یوزرنیم ربات تلگرام (بدون @)</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={formData.telegramBotUsername || ''}
                        onChange={(e) => updateField({ telegramBotUsername: e.target.value.replace('@', '') })}
                        placeholder="onival_shop_bot"
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono text-left focus:outline-hidden focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">آدرس سرور API تلگرام</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={formData.telegramBaseUrl || 'https://api.telegram.org'}
                        onChange={(e) => updateField({ telegramBaseUrl: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono text-left focus:outline-hidden focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                        <label className="text-xs font-bold text-slate-700">آدرس وب‌هوک تلگرام روی هاست</label>
                        <button
                          type="button"
                          onClick={() => {
                            const origin = formData.panelBaseUrl ? formData.panelBaseUrl.replace(/\/+$/, '') : window.location.origin;
                            updateField({ telegramWebhookUrl: `${origin}/api/telegram-webhook.php` });
                            showToast('آدرس پیش‌فرض وب‌هوک PHP تلگرام تنظیم شد.', 'info');
                          }}
                          className="text-[10px] text-sky-700 font-bold hover:underline cursor-pointer"
                        >
                          تنظیم به پیش‌فرض PHP هاست
                        </button>
                      </div>
                      <div className="flex flex-wrap sm:flex-nowrap gap-2">
                        <input
                          type="text"
                          dir="ltr"
                          value={formData.telegramWebhookUrl || ''}
                          onChange={(e) => updateField({ telegramWebhookUrl: e.target.value })}
                          placeholder="https://yourdomain.com/api/telegram-webhook.php"
                          className="flex-1 min-w-0 px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono text-left focus:outline-hidden focus:border-sky-500 font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => handleWebhookAction('telegram', 'set')}
                          disabled={webhookLoading !== null}
                          className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
                        >
                          {webhookLoading === 'telegram-set' ? 'در حال ثبت...' : 'ثبت وب‌هوک'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Quick Test Result Box if tested */}
                  {telegramDiagnostics && (
                    <div className={`p-3.5 rounded-xl border text-xs ${telegramDiagnostics.success ? 'bg-sky-50/70 border-sky-200 text-sky-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-1 font-bold mb-1">
                        <span>نتیجه تست اتصال تلگرام ({telegramDiagnostics.latencyMs}ms):</span>
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white border">
                          {telegramDiagnostics.mode === 'live_api' ? 'متصل به سرور واقعی تلگرام' : 'تایید ساختار و شبیه‌ساز'}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed break-words">{telegramDiagnostics.message}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <a
                  href={`https://t.me/${(formData.telegramBotUsername || 'onival_shop_bot').replace('@', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-sky-700 hover:text-sky-800 flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>باز کردن ربات در تلگرام</span>
                </a>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveAll()}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                    <span>{isSaving ? 'در حال ذخیره...' : 'ذخیره توکن و تنظیمات تلگرام'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTestBotConnection('telegram')}
                    disabled={testingPlatform === 'telegram'}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingPlatform === 'telegram' ? 'animate-spin' : ''}`} />
                    <span>{testingPlatform === 'telegram' ? 'در حال استعلام...' : 'تست آنلاین اتصال تلگرام'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* Bale Bot Payment & Admin Workflow Guide */}
          <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 rounded-3xl p-6 text-white shadow-md border border-emerald-800/60 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold border border-emerald-500/30">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">راهنمای فعال‌سازی، پرداخت کیف پول و تایید سفارشات در پیام‌رسان بله</h4>
                  <p className="text-xs text-slate-300">جریان یکپارچه پرداخت مشتری، صدور فاکتور و کنترل تراکنش‌ها توسط اکانت شخصی ادمین {formData.baleAdminUsername ? `(@${formData.baleAdminUsername.replace('@', '')})` : ''}</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                پیکربندی اختصاصی بازوی @{(formData.botUsername || 'Onivalbot').replace('@', '')}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs leading-relaxed">
              <div className="bg-white/5 backdrop-blur-xs p-4 rounded-2xl border border-white/10 space-y-2">
                <div className="font-black text-emerald-300 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center text-[10px]">۱</span>
                  <span>اتصال اکانت شخصی ادمین</span>
                </div>
                <p className="text-slate-300">
                  جهت دریافت اعلانات سفارشات توسط ادمین، شناسه عددی چت و آیدی کاربری خود را در کادرهای بالا وارد نموده و ذخیره فرمایید. تمامی رویدادها بلافاصله به حساب شما ارسال می‌شوند.
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-xs p-4 rounded-2xl border border-white/10 space-y-2">
                <div className="font-black text-emerald-300 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center text-[10px]">۲</span>
                  <span>فرایند پرداخت مشتری در بله</span>
                </div>
                <p className="text-slate-300">
                  مشتری پس از ثبت سفارش و انتخاب پرداخت در بله، به ربات هدایت شده، پیش‌فاکتور رسمی را دریافت کرده و با کیف پول بله پرداخت می‌کند. سپس بلافاصله پیام تایید به همراه کد رهگیری و آدرس سایت جهت پیگیری مرسوله برای وی ارسال می‌گردد.
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-xs p-4 rounded-2xl border border-white/10 space-y-2">
                <div className="font-black text-emerald-300 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center text-[10px]">۳</span>
                  <span>تایید کلیه تراکنش‌ها توسط ادمین</span>
                </div>
                <p className="text-slate-300">
                  ادمین تمامی سفارش‌ها اعم از پرداخت بله و کارت‌به‌کارت را به صورت کامل با مشخصات فاکتور و اقلام دریافت می‌کند. ادمین می‌تواند با ارسال دستور <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-300">/confirm_کد</code> در چت ربات، سفارش را درجا تایید و نهایی کند.
                </p>
              </div>
            </div>
          </div>

          {/* Security & Rate Limit Parameters */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 font-bold text-slate-800 text-sm">
              <Settings2 className="w-4 h-4 text-indigo-600" />
              <span>پارامترهای امنیتی، ضد اسپم و اتصال پنل (Server & Webhook Security)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">آدرس پایه پنل مدیریت (Panel Base URL)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={formData.panelBaseUrl}
                  onChange={(e) => updateField({ panelBaseUrl: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono text-left"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">محدودیت ضد اسپم پیام‌ها (ثانیه)</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={formData.antiSpamSeconds}
                  onChange={(e) => updateField({ antiSpamSeconds: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">توکن امنیتی هدر وب‌هوک (Secret Token)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={formData.webhookSecretToken || ''}
                  onChange={(e) => updateField({ webhookSecretToken: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono text-left"
                />
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                با کلیک بر روی دکمه ذخیره، تمامی توکن‌ها، چت‌آیدی‌ها و آدرس‌های وب‌هوک در سرور و حافظه دائمی ثبت می‌شوند.
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto px-7 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSaving ? 'در حال ذخیره دائمی...' : 'ثبت و ذخیره دائمی توکن‌ها و تنظیمات ربات‌ها'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: LIVE CONNECTION TESTER, REAL MESSAGE DISPATCHER & WEBHOOK MANAGER */}
      {activeSubTab === 'live-tester' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Live Message Sender Console (7 Cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Send className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="text-sm font-black text-slate-800">فرستنده مستقیم پیام تست به ربات (Live Bot Message Dispatcher)</h3>
                    <p className="text-[11px] text-slate-500">ارسال واقعی پیام از طریق متد sendMessage به چت‌آیدی مدیر یا مشتری</p>
                  </div>
                </div>
                <span className="text-[11px] font-mono bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-200 font-bold">
                  POST /sendMessage
                </span>
              </div>

              <form onSubmit={handleSendRealMessage} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">انتخاب پلتفرم مقصد</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'both', label: 'هر دو ربات' },
                        { id: 'bale', label: 'فقط بله' },
                        { id: 'telegram', label: 'فقط تلگرام' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setTestTargetPlatform(item.id as any)}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            testTargetPlatform === item.id
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">شناسه چت مقصد (Chat ID)</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={testChatId}
                      onChange={(e) => setTestChatId(e.target.value)}
                      placeholder="شناسه عددی چت برای تست (Chat ID)"
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-mono text-left"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">متن پیام آزمایشی</label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setTestMessageText(
                            '🛍 تست فاکتور جدید اونیوال\nکد پیگیری: ONV-88412\nمبلغ: ۳,۴۵۰,۰۰۰ تومان\nوضعیت: فیش واریزی آپلود شد.'
                          )
                        }
                        className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md transition"
                      >
                        نمونه فاکتور
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setTestMessageText(
                            '💬 تست تیکت پشتیبانی اونیوال\nمشتری: سارا احمدی\nپیام: سلام، سفارش من کی ارسال میشه؟'
                          )
                        }
                        className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md transition"
                      >
                        نمونه تیکت پشتیبانی
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    value={testMessageText}
                    onChange={(e) => setTestMessageText(e.target.value)}
                    className="w-full p-3.5 border border-slate-200 rounded-xl text-xs leading-relaxed focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-500">
                    پاسخ سرور بلافاصله در باکس زیر و در ترمینال لاگ ثبت می‌شود.
                  </span>
                  <button
                    type="submit"
                    disabled={isSendingTestMsg}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-2 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSendingTestMsg ? 'در حال ارسال پیام به سرور...' : 'ارسال فوری پیام تست'}</span>
                  </button>
                </div>
              </form>

              {lastSendResult && (
                <div className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono space-y-2">
                  <div className="flex items-center justify-between text-amber-400 border-b border-slate-800 pb-1.5">
                    <span>پاسخ دریافتی از سرور ربات ({lastSendResult.time}):</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">HTTP 200 OK</span>
                  </div>
                  {lastSendResult.mode === 'both' ? (
                    <div className="space-y-1.5 text-[11px] font-sans">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">● بله:</span>
                        <span>{lastSendResult.bale?.message}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sky-400 font-bold">● تلگرام:</span>
                        <span>{lastSendResult.telegram?.message}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] font-sans">
                      {lastSendResult.result?.message}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Webhook & Scenario Simulator (5 Cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Webhook Operations */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <Webhook className="w-5 h-5 text-purple-600" />
                  <div>
                    <h3 className="text-sm font-black text-slate-800">عملیات مستقیم وب‌هوک (Webhook Manager)</h3>
                    <p className="text-[11px] text-slate-500">ثبت، استعلام وضعیت یا حذف وب‌هوک در سرور بله و تلگرام</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-2">
                    <div className="text-xs font-bold text-emerald-900 flex items-center justify-between">
                      <span>وب‌هوک ربات بله (tapi.bale.ai)</span>
                      <span className="text-[10px] font-mono text-emerald-700">setWebhook</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleWebhookAction('bale', 'set')}
                        disabled={webhookLoading !== null}
                        className="py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition cursor-pointer"
                      >
                        ثبت وب‌هوک
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWebhookAction('bale', 'info')}
                        disabled={webhookLoading !== null}
                        className="py-1.5 px-2 rounded-lg bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-[11px] font-bold transition cursor-pointer"
                      >
                        استعلام وضعیت
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWebhookAction('bale', 'delete')}
                        disabled={webhookLoading !== null}
                        className="py-1.5 px-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-[11px] font-bold transition cursor-pointer"
                      >
                        حذف وب‌هوک
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-sky-50/50 border border-sky-100 space-y-2">
                    <div className="text-xs font-bold text-sky-900 flex items-center justify-between">
                      <span>وب‌هوک ربات تلگرام (api.telegram.org)</span>
                      <span className="text-[10px] font-mono text-sky-700">setWebhook</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleWebhookAction('telegram', 'set')}
                        disabled={webhookLoading !== null}
                        className="py-1.5 px-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold transition cursor-pointer"
                      >
                        ثبت وب‌هوک
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWebhookAction('telegram', 'info')}
                        disabled={webhookLoading !== null}
                        className="py-1.5 px-2 rounded-lg bg-white border border-sky-300 text-sky-800 hover:bg-sky-50 text-[11px] font-bold transition cursor-pointer"
                      >
                        استعلام وضعیت
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWebhookAction('telegram', 'delete')}
                        disabled={webhookLoading !== null}
                        className="py-1.5 px-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-[11px] font-bold transition cursor-pointer"
                      >
                        حذف وب‌هوک
                      </button>
                    </div>
                  </div>
                </div>

                {webhookResult && (
                  <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs">
                    <div className="font-bold mb-0.5">نتیجه عملیات وب‌هوک ({webhookResult.platform === 'bale' ? 'بله' : 'تلگرام'}):</div>
                    <div className="text-[11px]">{webhookResult.message}</div>
                  </div>
                )}
              </div>

              {/* Complete E-Commerce Bot Event Simulator */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Play className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-black text-slate-800">شبیه‌ساز سناریوهای عملیاتی فروشگاه در ربات</h3>
                </div>
                <p className="text-[11px] text-slate-500">
                  با کلیک روی هر سناریو، یک رویداد واقعی در سیستم ثبت شده و به ربات‌های فعال ارسال می‌گردد:
                </p>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickSimulate('incoming_order', {
                        fullName: 'امیرحسین رضایی (کاربر ربات بله)',
                        phone: '09124455667',
                        address: 'تهران، سعادت‌آباد، بلوار دریا، پلاک ۴۲',
                      })
                    }
                    className="w-full p-3 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 text-right transition flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800">۱. شبیه‌سازی ثبت سفارش جدید از داخل ربات</div>
                      <div className="text-[11px] text-slate-500">ایجاد فاکتور جدید در سفارشات + ارسال اعلان به مدیر</div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-emerald-600 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleQuickSimulate('test_notification', '🔔 تست سلامت درگاه اعلان‌های بله و تلگرام (همه سرویس‌ها پایدار هستند)')
                    }
                    className="w-full p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-right transition flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800">۲. تست هشدار فوری سیستم به چت ادمین</div>
                      <div className="text-[11px] text-slate-500">بررسی دریافت نوتیفیکیشن آنی روی گوشی مدیر</div>
                    </div>
                    <Zap className="w-4 h-4 text-blue-600 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={handleSimulateBaleCycle}
                    disabled={isSimulatingBaleCycle}
                    className="w-full p-3 rounded-xl border border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100/70 text-right transition flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                        <span>۳. تست چرخه پرداخت کیف پول بله و اعلان به مدیر</span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900 text-[10px]">پیشنهادی</span>
                      </div>
                      <div className="text-[11px] text-emerald-700">شبیه‌سازی صدور فاکتور، پرداخت کیف پول، تایید مشتری و نوتیفیکیشن ادمین</div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={handleTestSendInvoice}
                    disabled={isSendingInvoiceTest}
                    className="w-full p-3 rounded-xl border border-amber-300 bg-amber-50/60 hover:bg-amber-100/70 text-right transition flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-bold text-amber-950">۴. تست ارسال فاکتور کیف پول بله (sendInvoice API)</div>
                      <div className="text-[11px] text-amber-700">ارسال فاکتور مستقیم به چت مدیر با توکن {formData.balePaymentMode === 'test' ? 'تستی' : 'اصلی'}</div>
                    </div>
                    <Send className="w-4 h-4 text-amber-600 shrink-0" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SUPPORT CHANNELS & CUSTOMER COMMUNICATIONS */}
      {activeSubTab === 'support-channels' && (
        <form onSubmit={handleSaveAll} className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Headphones className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-black text-slate-800">شناسه پشتیبان‌ها و شبکه‌های اجتماعی (سینک خودکار با سایت)</h3>
                  <p className="text-xs text-slate-500">
                    هر تغییری در این بخش مستقیماً در صفحه «تماس با ما»، فوتر سایت و دکمه‌های چت پشتیبانی اعمال می‌شود.
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                متصل به ویترین فروشگاه
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Telegram Support ID */}
              <div className="p-4 rounded-2xl border border-sky-100 bg-sky-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-sky-900">پشتیبانی مستقیم تلگرام</span>
                  <a
                    href={`https://t.me/${(formData.telegramSupportId || '').replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-sky-600 hover:underline flex items-center gap-1 font-bold"
                  >
                    <span>تست لینک</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">آیدی پشتیبان تلگرام (Support ID)</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={formData.telegramSupportId || ''}
                    onChange={(e) => updateField({ telegramSupportId: e.target.value })}
                    placeholder="@onival_support"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-left"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">کانال رسمی تلگرام فروشگاه</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={formData.telegramChannelId || ''}
                    onChange={(e) => updateField({ telegramChannelId: e.target.value })}
                    placeholder="@onival_official"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-left"
                  />
                </div>
              </div>

              {/* Bale Support ID */}
              <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-900">پشتیبانی مستقیم پیام‌رسان بله</span>
                  <a
                    href={`https://ble.ir/${(formData.baleSupportId || '').replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-emerald-600 hover:underline flex items-center gap-1 font-bold"
                  >
                    <span>تست لینک</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">آیدی پشتیبان در بله (Bale Support)</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={formData.baleSupportId || ''}
                    onChange={(e) => updateField({ baleSupportId: e.target.value })}
                    placeholder="@onival_bale_support"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-left"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">کانال رسمی بله فروشگاه</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={formData.baleChannelId || ''}
                    onChange={(e) => updateField({ baleChannelId: e.target.value })}
                    placeholder="@onival_bale"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-left"
                  />
                </div>
              </div>

              {/* Domestic & Other Messengers (Eitaa, Rubika, WhatsApp, Instagram) */}
              <div className="p-4 rounded-2xl border border-amber-100 bg-amber-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-900">واتساپ، اینستاگرام، ایتا و روبیکا</span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">چندکاناله</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">شماره واتساپ پشتیبانی</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={formData.whatsappNumber || ''}
                      onChange={(e) => updateField({ whatsappNumber: e.target.value })}
                      placeholder="09123456789"
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-left"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">پیج اینستاگرام</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={formData.instagramId || ''}
                      onChange={(e) => updateField({ instagramId: e.target.value })}
                      placeholder="@onival.ir"
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-left"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">پشتیبانی ایتا (Eitaa)</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={formData.eitaaSupportId || ''}
                      onChange={(e) => updateField({ eitaaSupportId: e.target.value })}
                      placeholder="@onival_eitaa"
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-left"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">پشتیبانی روبیکا</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={formData.rubikaSupportId || ''}
                      onChange={(e) => updateField({ rubikaSupportId: e.target.value })}
                      placeholder="@onival_rubika"
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-left"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Phone, Email & Working Hours */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <PhoneCall className="w-3.5 h-3.5 text-blue-600" />
                  <span>تلفن مرکز تماس و پشتیبانی</span>
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={formData.supportPhone || ''}
                  onChange={(e) => updateField({ supportPhone: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono text-left"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span>ایمیل رسمی پشتیبانی</span>
                </label>
                <input
                  type="email"
                  dir="ltr"
                  value={formData.supportEmail || ''}
                  onChange={(e) => updateField({ supportEmail: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono text-left"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>ساعات پاسخگویی پشتیبانی</span>
                </label>
                <input
                  type="text"
                  value={formData.workingHours || ''}
                  onChange={(e) => updateField({ workingHours: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
              >
                {isSaving ? 'در حال ذخیره...' : 'ذخیره و بروزرسانی اطلاعات پشتیبانی در کل سایت'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 4: AUTOMATION TRIGGERS & MESSAGE TEMPLATES */}
      {activeSubTab === 'templates-automation' && (
        <form onSubmit={handleSaveAll} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Event Triggers Checkboxes (5 Cols) */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Bell className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-sm font-black text-slate-800">رویدادهای ارسال خودکار اعلان (Auto Triggers)</h3>
                  <p className="text-[11px] text-slate-500">تعیین کنید در چه مواقعی ربات بله و تلگرام به صورت خودکار پیام بفرستند</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  {
                    key: 'notifyOnNewOrder',
                    title: 'اعلان ثبت سفارش جدید به مدیر',
                    desc: 'به محض ثبت فاکتور توسط مشتری در سایت، جزئیات سفارش به بله و تلگرام مدیر ارسال شود.',
                  },
                  {
                    key: 'notifyOnReceiptUpload',
                    title: 'اعلان آپلود فیش واریزی کارت به کارت',
                    desc: 'هنگامی که مشتری تصویر فیش واریزی را بارگذاری می‌کند، هشدار بررسی فیش ارسال شود.',
                  },
                  {
                    key: 'notifyOnNewTicket',
                    title: 'اعلان ثبت پیام و تیکت پشتیبانی جدید',
                    desc: 'ارسال فوری متن پیام فرم تماس با ما به همراه کد رهگیری به چت ادمین.',
                  },
                  {
                    key: 'notifyCustomerOnStatusChange',
                    title: 'اطلاع‌رسانی تایید فیش و تغییر وضعیت سفارش',
                    desc: 'هنگام تایید فیش واریزی یا ارسال مرسوله، پیام خودکار در ربات ثبت گردد.',
                  },
                  {
                    key: 'autoReplyEnabled',
                    title: 'پاسخگوی خودکار هوشمند ربات (Auto-Responder)',
                    desc: 'پاسخ خودکار اولیه به دستور /start و استعلام کد پیگیری در ربات بله و تلگرام.',
                  },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean((formData as any)[item.key])}
                      onChange={(e) => updateField({ [item.key]: e.target.checked })}
                      className="mt-1 w-4 h-4 accent-blue-600 rounded cursor-pointer"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">{item.title}</div>
                      <div className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{item.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Customizable Bot Message Templates (7 Cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <div>
                    <h3 className="text-sm font-black text-slate-800">قالب پیام‌های خودکار ربات (Message Templates)</h3>
                    <p className="text-[11px] text-slate-500">
                      می‌توانید از متغیرهای <code className="text-indigo-600 font-mono">{'{customerName}'}</code>،{' '}
                      <code className="text-indigo-600 font-mono">{'{trackingCode}'}</code> و{' '}
                      <code className="text-indigo-600 font-mono">{'{totalPrice}'}</code> استفاده کنید
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">۱. متن خوش‌آمدگویی شروع ربات (/start)</label>
                  <textarea
                    rows={2}
                    value={formData.welcomeTemplate || ''}
                    onChange={(e) => updateField({ welcomeTemplate: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl text-xs leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">۲. قالب اعلان ثبت سفارش جدید</label>
                  <textarea
                    rows={3}
                    value={formData.orderInvoiceTemplate || ''}
                    onChange={(e) => updateField({ orderInvoiceTemplate: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl text-xs leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">۳. قالب پیام تایید فیش واریزی مشتری</label>
                  <textarea
                    rows={2}
                    value={formData.receiptApprovedTemplate || ''}
                    onChange={(e) => updateField({ receiptApprovedTemplate: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl text-xs leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">۴. قالب ارسال پاسخ پشتیبانی به کاربر</label>
                  <textarea
                    rows={3}
                    value={formData.supportReplyTemplate || ''}
                    onChange={(e) => updateField({ supportReplyTemplate: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl text-xs leading-relaxed"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                >
                  {isSaving ? 'در حال ذخیره...' : 'ذخیره قالب‌ها و تنظیمات خودکارسازی'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 5: LIVE LOGS TERMINAL & QUICK SUPPORT DESK */}
      {activeSubTab === 'logs-desk' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Quick Support Desk (6 Cols) */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-rose-600" />
                  <div>
                    <h3 className="text-sm font-black text-slate-800">میز پاسخگویی سریع تیکت‌های پشتیبانی</h3>
                    <p className="text-[11px] text-slate-500">پاسخ شما هم در صفحه پیگیری سایت ثبت می‌شود و هم به ربات ارسال می‌گردد</p>
                  </div>
                </div>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('messages')}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    مشاهده همه پیام‌ها
                  </button>
                )}
              </div>

              {messages.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400">هیچ پیام پشتیبانی ثبت نشده است.</div>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {messages.slice(0, 6).map((msg) => (
                    <div key={msg.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{msg.fullName}</span>
                          <span className="text-[10px] font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">
                            {msg.trackingCode}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            msg.adminResponse ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {msg.adminResponse ? 'پاسخ داده شده' : 'در انتظار پاسخ'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">{msg.message}</p>

                      {msg.adminResponse ? (
                        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900">
                          <span className="font-bold">پاسخ ادمین: </span>
                          {msg.adminResponse}
                        </div>
                      ) : replyingId === msg.id ? (
                        <div className="space-y-2 pt-1">
                          <textarea
                            rows={2}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="پاسخ خود را بنویسید..."
                            className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setReplyingId(null)}
                              className="px-3 py-1 rounded-lg text-xs text-slate-600 hover:bg-slate-200"
                            >
                              انصراف
                            </button>
                            <button
                              type="button"
                              disabled={isSubmittingReply}
                              onClick={() => handleQuickReplySubmit(msg.id)}
                              className="px-3.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
                            >
                              {isSubmittingReply ? 'در حال ارسال...' : 'ثبت و ارسال به ربات'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingId(msg.id);
                              setReplyText('');
                            }}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" />
                            <span>ارسال پاسخ سریع</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Full Technical Bot Log Box with Raw JSON and Command Runner (6 Cols) */}
          <div className="lg:col-span-6 flex flex-col">
            <BotTechnicalLogBox
              logs={logs}
              config={config}
              onRefreshLogs={onRefreshData}
              onClearLogs={handleClearLogs}
              title="ترمینال و لاگ باکس فنی ربات بله"
              subtitle="نمایش بلادرنگ رویدادها، دیتای خام JSON، استخراج فاکتور و بررسی اتصال"
            />
          </div>
        </div>
      )}

      {/* Modal for viewing and copying PHP bot scripts */}
      {phpModal?.open && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">{phpModal.title}</h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">مسیر پیشنهادی آپلود: public_html/{phpModal.filename}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPhp(phpModal.filename)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>دانلود فایل</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyPhpCode(phpModal.filename)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>کپی کدها</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPhpModal(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  بستن
                </button>
              </div>
            </div>

            <div className="p-4 flex-1 overflow-auto bg-slate-950">
              <pre dir="ltr" className="font-mono text-xs text-sky-300 leading-relaxed whitespace-pre selection:bg-indigo-500 selection:text-white">
                {phpModal.code}
              </pre>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
              <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>سازگار با PHP 7.4 تا 8.3 و هاست‌های لایت‌اسپید / آپاچی سی‌پنل</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPhpModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  متوجه شدم، بستن پنجره
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

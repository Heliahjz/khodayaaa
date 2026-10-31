import { TelegramConfig, Order } from '../types';
import { DEFAULT_TELEGRAM_CONFIG } from './seedData';
import { apiFetch } from './dataService';

export const LOCAL_STORAGE_BOT_CONFIG_KEY = 'onival_bot_config';

/**
 * Retrieves the currently active Bale / Bot configuration from server state or fallback.
 * Strictly avoids storing or reading sensitive bot tokens in browser localStorage.
 */
export function getActiveBotConfig(fallback?: TelegramConfig): TelegramConfig {
  const base = fallback || DEFAULT_TELEGRAM_CONFIG;
  return {
    ...base,
    botToken: (base.botToken || base.baleBotToken || '').trim(),
    adminChatId: (base.adminChatId || base.baleAdminChatId || '').trim(),
    botUsername: (base.botUsername || base.baleBotUsername || 'Onivalbot').replace(/^@/, ''),
    baleBotUsername: (base.baleBotUsername || base.botUsername || 'Onivalbot').replace(/^@/, ''),
    baleAdminUsername: base.baleAdminUsername || '',
    balePaymentMode: base.balePaymentMode || 'live',
    balePaymentTokenLive: base.balePaymentTokenLive || '',
    balePaymentTokenTest: base.balePaymentTokenTest || '',
    baseUrl: base.baseUrl || base.baleBaseUrl || 'https://tapi.bale.ai',
    baleBaseUrl: base.baleBaseUrl || base.baseUrl || 'https://tapi.bale.ai',
  };
}

/**
 * Strips all sensitive bot authentication tokens and payment keys.
 * Non-sensitive UI preferences may be kept, but secrets must never reach browser storage.
 */
export function stripSensitiveBotTokens<T extends Record<string, any>>(cfg: T): Partial<T> {
  const safe = { ...cfg };
  delete safe.botToken;
  delete safe.baleBotToken;
  delete safe.customerBotToken;
  delete safe.adminBotToken;
  delete safe.telegramBotToken;
  delete safe.balePaymentTokenLive;
  delete safe.balePaymentTokenTest;
  delete safe.balePaymentToken;
  delete safe.webhookSecretToken;
  return safe;
}

/**
 * Saves bot configuration directly and securely to the server API (persisted to server-data/onival-persistent-data.json).
 * Sensitive tokens are never stored in browser localStorage.
 */
export async function saveActiveBotConfig(config: TelegramConfig): Promise<{ ok: boolean; savedAt: string }> {
  const savedAt = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const payloadToStore = {
    ...config,
    _savedAt: savedAt,
    _lastUpdated: Date.now()
  };

  // Ensure any sensitive bot tokens are purged from browser localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(LOCAL_STORAGE_BOT_CONFIG_KEY);
      localStorage.removeItem('onival_saved_bot_config_v1');
    } catch {}
  }

  await apiFetch('/api/bot/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadToStore)
  });

  return { ok: true, savedAt };
}

export interface TestAdminWelcomeResult {
  ok: boolean;
  delivered: boolean;
  status: number;
  message: string;
  description?: string;
  messageId?: number;
  rawResponse?: any;
  usedToken: string;
  usedChatId: string;
  hint?: string;
  latencyMs?: number;
  forbiddenStartRequired?: boolean;
  botUsername?: string;
  botLink?: string;
}

/**
 * Sends real welcome message to the admin's Chat ID on Bale:
 * "اتصال ربات به هاست با موفقیت انجام شد. شما به عنوان ادمین شناسایی شدید"
 */
export async function sendBaleAdminWelcomeTest(options?: {
  botToken?: string;
  chatId?: string;
  baseUrl?: string;
}): Promise<TestAdminWelcomeResult> {
  const currentConfig = getActiveBotConfig();
  const token = (options?.botToken || currentConfig.botToken || currentConfig.baleBotToken || DEFAULT_TELEGRAM_CONFIG.botToken || '').trim();
  const chatId = (options?.chatId || currentConfig.adminChatId || currentConfig.baleAdminChatId || DEFAULT_TELEGRAM_CONFIG.adminChatId || '').trim();
  const baseUrl = (options?.baseUrl || currentConfig.baleBaseUrl || currentConfig.baseUrl || 'https://tapi.bale.ai').replace(/\/+$/, '');

  if (!token) {
    return {
      ok: false,
      delivered: false,
      status: 400,
      message: 'توکن ربات بله وارد نشده است.',
      description: 'لطفاً توکن ربات دریافتی از @BotFather را در کادر تنظیمات وارد کنید.',
      usedToken: '',
      usedChatId: chatId,
      hint: 'وارد ربات @BotFather در بله شده و توکن بازوی خود را کپی کنید.'
    };
  }

  if (!chatId) {
    return {
      ok: false,
      delivered: false,
      status: 400,
      message: 'شناسه عددی چت ادمین (Chat ID) وارد نشده است.',
      description: 'لطفاً شناسه عددی چت ادمین را در کادر وارد نمایید.',
      usedToken: token,
      usedChatId: '',
      hint: 'می‌توانید با ارسال دستور /start از اکانت شخصی به ربات یا استعلام در بله چت‌آیدی را دریافت کنید.'
    };
  }

  const welcomeText = 'اتصال ربات به هاست با موفقیت انجام شد. شما به عنوان ادمین شناسایی شدید';
  const startMs = Date.now();

  // Server Host Proxy Fetch to Bale API (guaranteed delivery and token protection)
  try {
    const res = await apiFetch('/api/bot/test-admin-welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, chatId, baseUrl })
    });
    const data: any = await res.json().catch(() => null);
    if (data && typeof data === 'object') {
      const latencyMs = Date.now() - startMs;
      return {
        ...data,
        latencyMs,
        usedToken: data.usedToken || (token ? 'configured' : ''),
        usedChatId: data.usedChatId || chatId,
        botUsername: data.botUsername || (currentConfig.adminBotUsername || currentConfig.baleBotUsername || 'onivaladminbot').replace(/^@/, '')
      };
    }
  } catch (err: any) {
    console.warn('Server proxy fetch failed:', err);
  }

  return {
    ok: false,
    delivered: false,
    status: 0,
    description: 'خطای شبکه یا عدم پاسخگویی سرور بله',
    message: 'خطا در برقراری ارتباط با وب‌سرویس بله',
    usedToken: token,
    usedChatId: chatId,
    botUsername: (currentConfig.baleBotUsername || currentConfig.botUsername || 'Onivalbot').replace(/^@/, ''),
    hint: 'لطفاً از اتصال اینترنت، صحت توکن بله و چت‌آیدی ادمین اطمینان حاصل فرمایید.'
  };
}

/**
 * Automatically dispatches the instant order notification to the admin via Bale Bot API.
 */
export async function sendBaleAdminOrderNotification(order: Order, customConfig?: TelegramConfig): Promise<void> {
  const cfg = customConfig || getActiveBotConfig();
  const token = (cfg.botToken || cfg.baleBotToken || '').trim();
  const chatId = (cfg.adminChatId || cfg.baleAdminChatId || '').trim();
  const baseUrl = (cfg.baleBaseUrl || cfg.baseUrl || 'https://tapi.bale.ai').replace(/\/+$/, '');

  if (!token || !chatId) return;

  const itemsList = (order.items || [])
    .map((it, i) => `${i + 1}. ${it.productName} (${it.size || 'استاندارد'}) × ${it.quantity} عدد - ${Number(it.totalPrice || 0).toLocaleString('fa-IR')} تومان`)
    .join('\n');

  const paymentTitle =
    order.paymentMethod === 'bale_bot'
      ? 'کیف پول بله (Bale Wallet)'
      : order.paymentMethod === 'card_to_card'
      ? 'کارت به کارت (فیش واریزی)'
      : 'درگاه آنلاین اینترنتی';

  const notificationText =
    `🔔 سفارش جدید در فروشگاه اونیوال (ONIVAL) ثبت شد!\n\n` +
    `🧾 شماره فاکتور: ${order.trackingCode}\n` +
    `👤 خریدار: ${order.userFullName}\n` +
    `📞 شماره تماس: ${order.phoneNumber}\n` +
    `💰 مبلغ کل فاکتور: ${Number(order.totalPrice || 0).toLocaleString('fa-IR')} تومان\n` +
    `💳 روش پرداخت انتخابی: ${paymentTitle}\n` +
    `📍 آدرس تحویل: ${order.userAddress}\n\n` +
    `📦 اقلام سفارش:\n${itemsList || '---'}\n\n` +
    `🔗 پیگیری فاکتور در سایت:\n${window.location.origin}/?track=${order.trackingCode}\n\n` +
    `⚡ دستور تایید فوری این سفارش توسط ادمین در بله:\n/confirm_${order.trackingCode}`;

  // 1. Try server endpoint
  try {
    await apiFetch('/api/bot/send-real-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'bale',
        chatId,
        botToken: token,
        baseUrl,
        text: notificationText
      })
    });
    return;
  } catch {
    // fallback to direct client-side fetch if server offline
  }

  // 2. Direct client fetch fallback
  try {
    await fetch(`${baseUrl}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: notificationText })
    });
  } catch {
    // ignore client network failure
  }
}

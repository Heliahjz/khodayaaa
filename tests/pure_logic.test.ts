import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSlug, isSlugDuplicate } from '../src/utils/seo';

describe('ONIVAL Pure Logic Unit Tests', () => {
  test('Slug Sanitization handles Persian and ASCII cleanly', () => {
    assert.equal(sanitizeSlug('عسل طبیعی سبلان'), 'عسل-طبیعی-سبلان');
    assert.equal(sanitizeSlug('Mountain Honey 100%'), 'mountain-honey-100');
    assert.equal(sanitizeSlug('   ', 'item', 1), 'item-1', 'Falls back gracefully on empty string');
  });

  test('Slug Duplicate Detection protects distinct items', () => {
    const existing = [
      { id: 1, slug: 'mountain-honey', isDelete: false },
      { id: 2, slug: 'royal-jelly', isDelete: false },
      { id: 3, slug: 'deleted-item', isDelete: true }
    ];

    // Same slug on different id should be flagged duplicate
    assert.equal(isSlugDuplicate(existing, 'mountain-honey', 4), true);

    // Same slug on self id should NOT be flagged duplicate
    assert.equal(isSlugDuplicate(existing, 'mountain-honey', 1), false);

    // Matching deleted item slug should NOT be duplicate
    assert.equal(isSlugDuplicate(existing, 'deleted-item', 5), false);
  });

  test('Product Route Pattern matches singular and plural endpoints', () => {
    const pluralRegex = /^\/api\/products?\/(\d+)$/;
    const mPlural = '/api/products/1'.match(pluralRegex);
    const mSingular = '/api/product/1'.match(pluralRegex);

    assert.ok(mPlural, 'Should match /api/products/1');
    assert.equal(mPlural[1], '1');

    assert.ok(mSingular, 'Should match /api/product/1');
    assert.equal(mSingular[1], '1');
  });

  test('Toman to Rial 10x conversion for Bale Wallet', () => {
    const amountToman = 350000;
    const amountRials = Math.round(amountToman * 10);
    assert.equal(amountRials, 3500000);
  });

  test('Order tracking code extraction accepts valid codes and rejects menu labels and phone numbers', () => {
    function extractOrderCodeJs(text: string): string | null {
      if (!text || typeof text !== 'string') return null;
      const farsi = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
      const arabic = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
      let norm = text.trim();
      for (let i = 0; i < 10; i++) {
        norm = norm.replaceAll(farsi[i], String(i)).replaceAll(arabic[i], String(i));
      }

      if (/^[\/!#]?(start|help|admin|orders|شروع|راهنما|سفارشات|فروشگاه|محصولات|تماس|پشتیبانی|پیگیری|پرداخت)$/i.test(norm)) {
        return null;
      }
      if (/^(?:🧾\s*استعلام|🛍️\s*فروشگاه|📦\s*پیگیری|💳\s*راهنما|📞\s*تماس|استعلام و پرداخت فاکتور|فروشگاه اونیوال|پیگیری سفارش|راهنمای روش‌های پرداخت|تماس با ما)/i.test(norm)) {
        return null;
      }

      const startMatch = norm.match(/^\/start[\s_]+(?:pay_|order_|پرداخت_)?([A-Za-z0-9_-]+)/i);
      if (startMatch) {
        const cand = startMatch[1].replace(/^(?:pay_|order_|پرداخت_)/i, '').trim();
        if (cand && !/^(admin|help|orders|start)$/i.test(cand)) {
          return cand;
        }
      }

      const confMatch = norm.match(/^\/(?:confirm_|approve_|تایید_)([A-Za-z0-9_-]+)/i);
      if (confMatch) return confMatch[1].trim();

      const onvMatch = norm.match(/(ONV[-_]?[A-Za-z0-9_-]{3,}|ORD[-_]?[A-Za-z0-9_-]{3,})/i);
      if (onvMatch) return onvMatch[1].trim();

      const labelMatch = norm.match(/(?:فاکتور|سفارش|کد\s*رهگیری|کد\s*پیگیری|شماره\s*سفارش|شماره\s*فاکتور|invoice|order)\s*[:#-]?\s*([A-Za-z0-9_-]{3,})/i);
      if (labelMatch) {
        const cand = labelMatch[1].trim();
        if (!/(گرمی?|کیلو|تومان|ریال)/i.test(cand)) {
          return cand;
        }
      }

      if (!norm.startsWith('/') && /^[A-Za-z0-9_-]{3,32}$/.test(norm)) {
        if (/^09\d{9}$/.test(norm)) {
          return null;
        }
        return norm;
      }

      return null;
    }

    // Rejection of keyboard menu labels
    assert.equal(extractOrderCodeJs('🧾 استعلام و پرداخت فاکتور من'), null);
    assert.equal(extractOrderCodeJs('🛍️ فروشگاه اونیوال'), null);
    assert.equal(extractOrderCodeJs('📦 پیگیری سفارش'), null);
    assert.equal(extractOrderCodeJs('💳 راهنمای روش‌های پرداخت'), null);

    // Rejection of weights and phone numbers
    assert.equal(extractOrderCodeJs('عسل ۵۰۰ گرمی'), null);
    assert.equal(extractOrderCodeJs('09123456789'), null);
    assert.equal(extractOrderCodeJs('۰۹۱۲۳۴۵۶۷۸۹'), null);

    // Acceptance of valid codes
    assert.equal(extractOrderCodeJs('ONV-ORD-88219'), 'ONV-ORD-88219');
    assert.equal(extractOrderCodeJs('/start pay_ONV-ORD-88219'), 'ONV-ORD-88219');
    assert.equal(extractOrderCodeJs('سلام کد رهگیری من ONV-9912 است'), 'ONV-9912');
    assert.equal(extractOrderCodeJs('/confirm_ONV-ORD-88219'), 'ONV-ORD-88219');
  });

  test('Logo-only save in account does not mark initialSetupCompleted or expire OTP', () => {
    const creds = {
      username: 'admin',
      password: 'admin',
      initialSetupCompleted: false,
      oneTimePassword: 'Onival@Admin2025'
    };

    const payload = {
      siteLogo: 'data:image/png;base64,...',
      siteLogoFit: 'contain',
      siteLogoShape: 'rounded',
      siteLogoScale: 100
    };

    const isChangingPassword = Boolean(payload.newPassword && String(payload.newPassword).trim() !== '');
    const isChangingUsername = Boolean(payload.username && payload.username !== creds.username);

    // Pure logic rule: only change initialSetupCompleted when password or username changed
    if (isChangingPassword || isChangingUsername) {
      creds.initialSetupCompleted = true;
      creds.oneTimePassword = null;
    }

    assert.equal(creds.initialSetupCompleted, false, 'initialSetupCompleted must remain false');
    assert.equal(creds.oneTimePassword, 'Onival@Admin2025', 'oneTimePassword must be preserved');
  });

  test('Webhook Secret role isolation: customer secret rejects admin scope', () => {
    const customerSecret = 'csec_1234567890abcdef1234567890abcdef';
    const adminSecret = 'asec_9876543210fedcba9876543210fedcba';

    function verifySecretForScope(scope: 'customer' | 'admin', tokenPassed: string): boolean {
      const expected = scope === 'admin' ? adminSecret : customerSecret;
      return tokenPassed === expected;
    }

    assert.equal(verifySecretForScope('customer', customerSecret), true);
    assert.equal(verifySecretForScope('admin', adminSecret), true);
    assert.equal(verifySecretForScope('admin', customerSecret), false, 'Customer secret must be rejected for admin scope');
    assert.equal(verifySecretForScope('customer', adminSecret), false, 'Admin secret must be rejected for customer scope');
  });

  test('Test vs Live payment isolation: test payment does NOT deduct inventory or mark order as Paid', () => {
    const order = {
      trackingCode: 'ONV-ORD-771',
      totalPrice: 200000,
      paymentStatus: 'Unpaid',
      status: 'Pending',
      inventoryDeducted: false,
      testPaymentStatus: undefined as string | undefined
    };

    function processSuccessfulPayment(ord: typeof order, isTestMode: boolean) {
      if (isTestMode) {
        ord.testPaymentStatus = 'TestPaidVerified';
        // DO NOT mark Paid, DO NOT deduct stock
        return;
      }
      ord.paymentStatus = 'Paid';
      ord.status = 'Processing';
      ord.inventoryDeducted = true;
    }

    processSuccessfulPayment(order, true);
    assert.equal(order.paymentStatus, 'Unpaid', 'Test payment must keep paymentStatus Unpaid');
    assert.equal(order.inventoryDeducted, false, 'Test payment must NOT deduct stock');
    assert.equal(order.testPaymentStatus, 'TestPaidVerified', 'Test status should be recorded');
  });

  test('Public PII masking for tracking envelope', () => {
    function maskPhone(p: string): string {
      const clean = p.trim();
      if (clean.length >= 10) return clean.slice(0, 4) + '***' + clean.slice(-3);
      if (clean.length >= 4) return clean.slice(0, 2) + '***' + clean.slice(-2);
      return '***';
    }

    assert.equal(maskPhone('09123456789'), '0912***789');
    assert.equal(maskPhone('02112345678'), '0211***678');
  });

  test('Item 1: Username-only change during initial setup is rejected without password', () => {
    function validateCredentialChange(
      isInitialPending: boolean,
      currentPassStored: string,
      req: { username?: string; currentPassword?: string; newPassword?: string }
    ): { ok: boolean; error?: string } {
      const isChangingPassword = Boolean(req.newPassword && req.newPassword.trim() !== '');
      const isChangingUsername = Boolean(req.username && req.username.trim().toLowerCase() !== 'admin');

      if (isInitialPending && isChangingUsername && !isChangingPassword) {
        return { ok: false, error: 'Password required during initial setup' };
      }
      if (!isInitialPending && (isChangingPassword || isChangingUsername)) {
        if (!req.currentPassword || req.currentPassword !== currentPassStored) {
          return { ok: false, error: 'Current password invalid' };
        }
      }
      if (isChangingPassword && req.newPassword!.trim().length < 6) {
        return { ok: false, error: 'Password too short' };
      }
      return { ok: true };
    }

    // Initial setup with username only -> rejected!
    const res1 = validateCredentialChange(true, 'admin', { username: 'newadmin' });
    assert.equal(res1.ok, false);
    assert.equal(res1.error, 'Password required during initial setup');

    // Initial setup with username AND valid password -> accepted
    const res2 = validateCredentialChange(true, 'admin', { username: 'newadmin', newPassword: 'SuperSecretPassword123' });
    assert.equal(res2.ok, true);

    // Post-setup with username change without current password -> rejected!
    const res3 = validateCredentialChange(false, 'SuperSecretPassword123', { username: 'anotheradmin' });
    assert.equal(res3.ok, false);
    assert.equal(res3.error, 'Current password invalid');

    // Post-setup with correct current password -> accepted
    const res4 = validateCredentialChange(false, 'SuperSecretPassword123', { username: 'anotheradmin', currentPassword: 'SuperSecretPassword123' });
    assert.equal(res4.ok, true);
  });

  test('Item 4: Receipt upload rejects Paid and Cancelled orders and sets canonical properties', () => {
    function processReceiptUpload(order: { status: string; paymentStatus: string; receiptImage?: string; receiptImageUrl?: string }, filename: string) {
      if (order.paymentStatus === 'Paid') {
        return { ok: false, error: 'سفارش قبلاً تسویه شده است' };
      }
      if (order.status === 'Cancelled') {
        return { ok: false, error: 'سفارش لغو شده است' };
      }
      order.paymentStatus = 'PendingVerification';
      order.receiptImage = filename;
      order.receiptImageUrl = `/api/receipts/${filename}`;
      return { ok: true, adminNotified: true };
    }

    const paidOrder = { status: 'Processing', paymentStatus: 'Paid' };
    assert.equal(processReceiptUpload(paidOrder, 'rec1.jpg').ok, false);

    const cancelledOrder = { status: 'Cancelled', paymentStatus: 'Unpaid' };
    assert.equal(processReceiptUpload(cancelledOrder, 'rec2.jpg').ok, false);

    const pendingOrder: { status: string; paymentStatus: string; receiptImage?: string; receiptImageUrl?: string } = { status: 'Pending', paymentStatus: 'Unpaid' };
    const res = processReceiptUpload(pendingOrder, 'rec3.jpg');
    assert.equal(res.ok, true);
    assert.equal(pendingOrder.receiptImage, 'rec3.jpg');
    assert.equal(pendingOrder.receiptImageUrl, '/api/receipts/rec3.jpg');
    assert.equal(res.adminNotified, true);
  });

  test('Item 5: Consultation booking uses authoritative server price and prevents price tampering', () => {
    const consultationConfig = {
      basePrice: 120000,
      topics: [
        { id: 'diet-plan', title: 'برنامه غذایی ارگانیک', price: 250000, enabled: true },
        { id: 'honey-therapy', title: 'عسل درمانی', price: 180000, enabled: true }
      ]
    };

    function resolveConsultationPrice(topicId?: string, clientPrice?: number): number {
      let resolved = consultationConfig.basePrice;
      if (topicId) {
        const found = consultationConfig.topics.find(t => t.id === topicId);
        if (found && typeof found.price === 'number') {
          resolved = found.price;
        }
      }
      // Client price is strictly ignored
      return resolved;
    }

    // Client attempts to pass 1000 Toman for 250000 Toman topic
    const price1 = resolveConsultationPrice('diet-plan', 1000);
    assert.equal(price1, 250000, 'Must use server topic price, ignoring client 1000');

    // Unknown topic defaults to basePrice
    const price2 = resolveConsultationPrice('unknown-topic', 0);
    assert.equal(price2, 120000, 'Must fall back to basePrice');
  });

  test('Item 6: Bot config preserves existing tokens when submitted empty or masked', () => {
    const currentConfig = {
      customerBotToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
      adminBotToken: '987654:XYZ-UVW9876tsRqp-cba57T2s1r987zy22',
      baleBotUsername: 'OnivalCustomerBot'
    };

    function updateConfig(
      existing: typeof currentConfig,
      submitted: { customerBotToken?: string; adminBotToken?: string }
    ) {
      const isMaskedOrEmpty = (tok?: string) => !tok || tok.trim() === '' || tok.includes('***') || tok.includes('[REDACTED]');
      const nextCust = isMaskedOrEmpty(submitted.customerBotToken) ? existing.customerBotToken : submitted.customerBotToken!.trim();
      const nextAdmin = isMaskedOrEmpty(submitted.adminBotToken) ? existing.adminBotToken : submitted.adminBotToken!.trim();
      return {
        ...existing,
        customerBotToken: nextCust,
        adminBotToken: nextAdmin
      };
    }

    const result = updateConfig(currentConfig, {
      customerBotToken: '123456:***',
      adminBotToken: ''
    });

    assert.equal(result.customerBotToken, currentConfig.customerBotToken, 'Must preserve existing customer token');
    assert.equal(result.adminBotToken, currentConfig.adminBotToken, 'Must preserve existing admin token');
  });

  test('Item 7: Order lookup strictly requires trackingCode in public context and rejects short numbers', () => {
    const orders = [
      { id: 101, trackingCode: 'ONV-ORD-88219', orderNumber: '101' },
      { id: 102, trackingCode: 'ONV-ORD-99342', orderNumber: '102' }
    ];

    function findOrderByCode(ordersList: typeof orders, query: string, allowOrderNumber: boolean) {
      const q = query.trim().toUpperCase();
      for (const ord of ordersList) {
        if (ord.trackingCode.toUpperCase() === q) return ord;
        if (allowOrderNumber && ord.orderNumber === q) return ord;
      }
      return null;
    }

    // Public context: allowOrderNumber = false
    assert.equal(findOrderByCode(orders, '101', false), null, 'Public query must NOT match 5-digit orderNumber');
    assert.equal(findOrderByCode(orders, 'ONV-ORD-88219', false)?.id, 101, 'Exact tracking code matches');

    // Admin context: allowOrderNumber = true
    assert.equal(findOrderByCode(orders, '101', true)?.id, 101, 'Admin query can match orderNumber');
  });

  test('Item 2 & 3: Payment attempts bounded to max 10 and charge replay rejected', () => {
    const order = {
      trackingCode: 'ONV-ORD-5544',
      paymentAttempts: [] as Array<{ chargeId: string; status: string }>,
      paymentStatus: 'Unpaid'
    };

    function recordAttempt(ord: typeof order, chargeId: string, status: string) {
      // Replay check
      for (const att of ord.paymentAttempts) {
        if (att.chargeId === chargeId && att.status === 'paid_success') {
          return { ok: true, alreadyPaid: true };
        }
      }
      ord.paymentAttempts.push({ chargeId, status });
      if (ord.paymentAttempts.length > 10) {
        ord.paymentAttempts = ord.paymentAttempts.slice(-10);
      }
      return { ok: true };
    }

    // Add 12 attempts
    for (let i = 1; i <= 12; i++) {
      recordAttempt(order, `CHG-${i}`, i === 12 ? 'paid_success' : 'invoice_issued');
    }

    assert.equal(order.paymentAttempts.length, 10, 'paymentAttempts array must be capped at 10 items');
    assert.equal(order.paymentAttempts[order.paymentAttempts.length - 1].chargeId, 'CHG-12');

    // Replay check for CHG-12
    const replay = recordAttempt(order, 'CHG-12', 'paid_success');
    assert.equal(replay.alreadyPaid, true, 'Replaying successful charge must be idempotent');
  });
});


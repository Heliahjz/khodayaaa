<?php
/**
 * ==============================================================================
 * ONIVAL Unified Bale & Telegram Webhook Processor
 * ==============================================================================
 * Single active webhook engine supporting dedicated customer and admin bots,
 * atomic inventory deduction, and verified Bale wallet / receipt payments.
 * ==============================================================================
 */

require_once __DIR__ . '/common.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['ok' => true]);
    exit;
}

$db = loadDatabaseReadonly();
$tgCfg = $db['telegramConfig'] ?? [];
$siteCfg = $db['siteContent'] ?? [];
$payCfg = $siteCfg['paymentConfig'] ?? [];

// Ensure persistent role-isolated secret tokens exist
$secrets = getOrCreateWebhookSecrets($tgCfg);
if (!empty($secrets['updated'])) {
    withDatabaseTransaction(function(&$dbRef) use ($secrets) {
        if (!isset($dbRef['telegramConfig'])) $dbRef['telegramConfig'] = [];
        $dbRef['telegramConfig']['customerWebhookSecretToken'] = $secrets['customer'];
        $dbRef['telegramConfig']['adminWebhookSecretToken'] = $secrets['admin'];
        $dbRef['telegramConfig']['webhookSecretToken'] = $secrets['customer'];
    });
}

$scope = strtolower(trim($_GET['bot'] ?? 'customer')); // 'customer' or 'admin'
$customerToken = trim((string)($tgCfg['customerBotToken'] ?? $tgCfg['baleBotToken'] ?? $tgCfg['botToken'] ?? ''));
$adminToken = trim((string)($tgCfg['adminBotToken'] ?? $tgCfg['baleAdminBotToken'] ?? ''));

// Strict token & secret resolution per bot scope without cross-scope fallback
$activeToken = ($scope === 'admin') ? $adminToken : $customerToken;
$expectedSecret = ($scope === 'admin')
    ? ($tgCfg['adminWebhookSecretToken'] ?? '')
    : ($tgCfg['customerWebhookSecretToken'] ?? $tgCfg['webhookSecretToken'] ?? '');

// ------------------------------------------------------------------------------
// 1. Explicit Webhook Setup / Info / Delete via GET or Query Actions
// ------------------------------------------------------------------------------
$requestedAction = strtolower(trim($_GET['action'] ?? ''));

if ($requestedAction !== '') {
    // Only authenticated admin session can trigger setup/info/delete on webhook.php
    if (!isRequestAdminAuthorized($db)) {
        http_response_code(401);
        echo json_encode([
            'ok' => false,
            'code' => 'AUTH_REQUIRED',
            'error' => 'دسترسی غیرمجاز. تنظیم وب‌هوک نیازمند احراز هویت نشست مدیریت است.'
        ]);
        exit;
    }

    if (empty($activeToken)) {
        http_response_code(400);
        echo json_encode([
            'ok' => false,
            'code' => 'TOKEN_MISSING',
            'error' => "توکن ربات '{$scope}' در تنظیمات ثبت نشده است."
        ]);
        exit;
    }

    $canonicalHookUrl = "https://onival.ir/api/webhook/bale?bot={$scope}&k=" . urlencode($expectedSecret);

    if ($requestedAction === 'setup' || $requestedAction === 'set') {
        $setRes = callBaleApi($activeToken, 'setWebhook', [
            'url' => $canonicalHookUrl,
            'secret_token' => $expectedSecret
        ]);
        $infoRes = callBaleApi($activeToken, 'getWebhookInfo', []);
        $isSuccess = !empty($setRes['ok']);

        http_response_code($isSuccess ? 200 : 502);
        echo json_encode([
            'ok' => $isSuccess,
            'action' => 'setup',
            'service' => 'onival-bale-webhook',
            'botScope' => $scope,
            'registeredUrl' => "https://onival.ir/api/webhook/bale?bot={$scope}&k=[PROTECTED]",
            'baleSetResponse' => $setRes,
            'baleWebhookInfo' => $infoRes,
            'message' => $isSuccess
                ? "وب‌هوک ربات {$scope} با موفقیت در سرورهای بله ثبت شد."
                : ("خطا در ثبت وب‌هوک بله: " . ($setRes['description'] ?? 'عدم پاسخگویی وب‌سرویس'))
        ]);
        exit;
    }

    if ($requestedAction === 'info') {
        $infoRes = callBaleApi($activeToken, 'getWebhookInfo', []);
        echo json_encode([
            'ok' => !empty($infoRes['ok']),
            'action' => 'info',
            'botScope' => $scope,
            'baleWebhookInfo' => $infoRes
        ]);
        exit;
    }

    if ($requestedAction === 'delete') {
        $delRes = callBaleApi($activeToken, 'deleteWebhook', []);
        echo json_encode([
            'ok' => !empty($delRes['ok']),
            'action' => 'delete',
            'botScope' => $scope,
            'baleDeleteResponse' => $delRes
        ]);
        exit;
    }
}

// ------------------------------------------------------------------------------
// 2. Health Check on GET (Without misleading "active webhook" claim)
// ------------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode([
        'ok' => true,
        'service' => 'onival-bale-webhook',
        'status' => 'listener_ready',
        'scope' => $scope,
        'hasToken' => !empty($activeToken),
        'note' => 'پایانه پردازش وب‌هوک اونیوال روی هاست آماده است. این پاسخ صرفاً دسترسی به وب‌سرور را نشان می‌دهد و به معنی تایید دریافت آپدیت از بله نیست. جهت استعلام ثبت وب‌هوک در بله از بخش تنظیمات ربات در پنل ادمین استفاده فرمایید.'
    ]);
    exit;
}

// ------------------------------------------------------------------------------
// 3. Webhook Secret Token Verification on POST Updates (Fail-Closed & Role Isolated)
// ------------------------------------------------------------------------------
if ($expectedSecret !== '') {
    $incomingSecret = $_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? ($_GET['k'] ?? ($_GET['secret'] ?? ''));
    if (empty($incomingSecret) || !hash_equals($expectedSecret, $incomingSecret)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'code' => 'FORBIDDEN', 'error' => 'Forbidden: Invalid webhook secret token for this bot role']);
        onival_log('webhook', 'auth_failure', 'Webhook secret token mismatch or missing', [
            'scope' => $scope,
            'ip' => $_SERVER['REMOTE_ADDR'] ?? null
        ]);
        exit;
    }
}

if (empty($activeToken)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => "Bot token for scope '{$scope}' is not configured on server"]);
    onival_log('webhook', 'token_missing', "Attempted to process {$scope} webhook without configured token");
    exit;
}

// Admin chat identity: strictly numeric from config without arbitrary default
$rawAdminChatId = trim((string)($tgCfg['adminChatId'] ?? $tgCfg['baleAdminChatId'] ?? ''));
$adminChatId = preg_replace('/\D/', '', $rawAdminChatId);

$customerBotUsername = ltrim(trim((string)($tgCfg['customerBotUsername'] ?? $tgCfg['baleBotUsername'] ?? 'Onivalbot')), '@');
$adminBotUsername = ltrim(trim((string)($tgCfg['adminBotUsername'] ?? 'onivaladminbot')), '@');

$paymentMode = strtolower(trim((string)($tgCfg['balePaymentMode'] ?? 'live')));
$walletToken = '';
if ($paymentMode === 'test') {
    $walletToken = trim((string)($tgCfg['balePaymentTokenTest'] ?? 'WALLET-TEST-1111111111111111'));
} else {
    $walletToken = trim((string)($tgCfg['balePaymentTokenLive'] ?? $tgCfg['balePaymentToken'] ?? ''));
}

$cardNumber = trim((string)($payCfg['cardNumber'] ?? '۶۰۳۷-۹۹۷۵-۹۹۱۲-۳۴۵۶'));
$cardHolder = trim((string)($payCfg['cardHolderName'] ?? 'مجموعه تخصصی فرآورده‌های ارگانیک اونیوال'));
$bankName   = trim((string)($payCfg['bankName'] ?? 'بانک ملی ایران'));
$storeUrl   = 'https://onival.ir';

// ------------------------------------------------------------------------------
// 4. Parse Incoming JSON Payload
// ------------------------------------------------------------------------------
$rawInput = file_get_contents('php://input');
$update = @json_decode($rawInput, true);

if (!$update || !is_array($update)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'No valid JSON payload']);
    exit;
}

$correlationId = onival_log('webhook', 'update_received', 'Received update from Bale', [
    'update_id' => $update['update_id'] ?? null,
    'scope' => $scope
]);

// ------------------------------------------------------------------------------
// 5. Handle pre_checkout_query (Bale Wallet Payment Verification)
// ------------------------------------------------------------------------------
if (isset($update['pre_checkout_query'])) {
    $pcq = $update['pre_checkout_query'];
    $pcqId = $pcq['id'] ?? '';
    $orderPayload = $pcq['invoice_payload'] ?? '';
    $cleanOrderCode = str_replace(['_', 'pay-', 'order-'], ['-', '', ''], $orderPayload);

    $matchedOrder = findOrderByCodePhp($db['orders'] ?? [], $cleanOrderCode);
    $paidRials = intval($pcq['total_amount'] ?? 0);

    if (!$matchedOrder) {
        callBaleApi($activeToken, 'answerPreCheckoutQuery', [
            'pre_checkout_query_id' => $pcqId,
            'ok' => false,
            'error_message' => 'فاکتور سفارش در سیستم یافت نشد.'
        ]);
        echo json_encode(['ok' => false, 'error' => 'Order not found']);
        exit;
    }

    if (($matchedOrder['paymentStatus'] ?? '') === 'Paid') {
        callBaleApi($activeToken, 'answerPreCheckoutQuery', [
            'pre_checkout_query_id' => $pcqId,
            'ok' => false,
            'error_message' => 'این سفارش قبلاً پرداخت و تسویه شده است.'
        ]);
        echo json_encode(['ok' => false, 'error' => 'Order already paid']);
        exit;
    }

    if (($matchedOrder['status'] ?? '') === 'Cancelled') {
        callBaleApi($activeToken, 'answerPreCheckoutQuery', [
            'pre_checkout_query_id' => $pcqId,
            'ok' => false,
            'error_message' => 'این سفارش لغو گردیده است.'
        ]);
        echo json_encode(['ok' => false, 'error' => 'Order cancelled']);
        exit;
    }

    $expectedToman = getOrderAmountTomanPhp($matchedOrder);
    $expectedRials = round($expectedToman * 10);

    if ($expectedRials > 0 && $paidRials < $expectedRials) {
        callBaleApi($activeToken, 'answerPreCheckoutQuery', [
            'pre_checkout_query_id' => $pcqId,
            'ok' => false,
            'error_message' => 'مبلغ پرداختی کمتر از مبلغ فاکتور سفارش است.'
        ]);
        onival_log('payment', 'pre_checkout_underpaid', 'Amount mismatch in pre_checkout_query', [
            'orderCode' => $cleanOrderCode,
            'paidRials' => $paidRials,
            'expectedRials' => $expectedRials
        ], $correlationId);
        echo json_encode(['ok' => false, 'error' => 'Insufficient payment amount']);
        exit;
    }

    // Stock availability check before answering pre_checkout_query without prematurely deducting inventory
    $stockCheck = checkOrderStockAvailablePhp($db, $matchedOrder);
    if (!$stockCheck['ok']) {
        callBaleApi($activeToken, 'answerPreCheckoutQuery', [
            'pre_checkout_query_id' => $pcqId,
            'ok' => false,
            'error_message' => $stockCheck['error'] ?? 'موجودی انبار برای برخی از اقلام کافی نیست.'
        ]);
        onival_log('payment', 'pre_checkout_out_of_stock', 'Stock conflict during pre_checkout_query', [
            'orderCode' => $cleanOrderCode,
            'error' => $stockCheck['error']
        ], $correlationId);
        echo json_encode(['ok' => false, 'error' => 'Stock insufficient']);
        exit;
    }

    callBaleApi($activeToken, 'answerPreCheckoutQuery', [
        'pre_checkout_query_id' => $pcqId,
        'ok' => true
    ]);

    onival_log('payment', 'pre_checkout_approved', "Pre-checkout approved for {$cleanOrderCode}", [], $correlationId);
    echo json_encode(['ok' => true]);
    exit;
}

// ------------------------------------------------------------------------------
// 6. Shared Helpers for Admin Actions (Unified across Callbacks & Text Commands)
// ------------------------------------------------------------------------------
$approveOrderPayment = function($codeToConfirm, $senderId) use ($activeToken, $adminChatId, $customerToken, $storeUrl, $correlationId) {
    if (empty($adminChatId) || $senderId !== $adminChatId) {
        sendBaleMessage($activeToken, $senderId, "⛔ دسترسی غیرمجاز: تنها شناسه عددی ادمین مجاز به تایید سفارش‌ها است.");
        return ['ok' => false, 'error' => 'Unauthorized'];
    }

    $txResult = withDatabaseTransaction(function(&$dbRef) use ($codeToConfirm) {
        $order = findOrderByCodePhp($dbRef['orders'] ?? [], $codeToConfirm, true);
        if (!$order) return ['ok' => false, 'error' => 'سفارش یافت نشد'];

        foreach ($dbRef['orders'] as &$ord) {
            if (($ord['trackingCode'] ?? '') === $order['trackingCode']) {
                if (($ord['paymentStatus'] ?? '') === 'Paid') {
                    return ['ok' => true, 'alreadyPaid' => true, 'order' => $ord];
                }
                $invRes = deductOrderInventory($dbRef, $ord);
                if (!$invRes['ok']) {
                    return ['ok' => false, 'error' => $invRes['error']];
                }
                $ord['paymentStatus'] = 'Paid';
                $ord['status'] = 'Processing';
                $ord['approvedAt'] = date('c');
                return ['ok' => true, 'order' => $ord];
            }
        }
        return ['ok' => false, 'error' => 'خطا در ثبت تایید سفارش'];
    });

    if ($txResult['ok']) {
        $ordObj = $txResult['order'];
        $amountToman = getOrderAmountTomanPhp($ordObj);
        sendBaleMessage($activeToken, $senderId, "✅ فیش سفارش {$ordObj['trackingCode']} تایید شد و موجودی انبار کسر گردید.");

        $custChat = $ordObj['baleChatId'] ?? $ordObj['chatId'] ?? null;
        if ($custChat) {
            $custNotify =
                "🎉 خریدار گرامی، پرداخت شما تأیید شد!\n\n" .
                "✅ فیش واریزی سفارش {$ordObj['trackingCode']} توسط مدیریت تایید گردید.\n" .
                "💰 مبلغ: " . number_format($amountToman) . " تومان\n" .
                "📦 وضعیت مرسوله: در حال بسته‌بندی و ارسال پستی 🚚\n\n" .
                "از حسن اعتماد شما به محصولات ارگانیک اونیوال صمیمانه سپاسگزاریم. 🌿🍯\n\n" .
                "🔍 پیگیری لحظه‌ای سفارش:\n{$storeUrl}?track={$ordObj['trackingCode']}";
            sendBaleMessage(!empty($customerToken) ? $customerToken : $activeToken, $custChat, $custNotify);
        }
        onival_log('order', 'receipt_approved', "Order {$ordObj['trackingCode']} confirmed by admin", [], $correlationId);
    } else {
        sendBaleMessage($activeToken, $senderId, "⚠️ خطا در تایید: " . ($txResult['error'] ?? 'خطای ناشناخته'));
    }
    return $txResult;
};

$rejectOrderPayment = function($codeToReject, $senderId) use ($activeToken, $adminChatId, $customerToken, $storeUrl, $correlationId) {
    if (empty($adminChatId) || $senderId !== $adminChatId) {
        sendBaleMessage($activeToken, $senderId, "⛔ دسترسی غیرمجاز: تنها شناسه عددی ادمین مجاز به رد سفارش‌ها است.");
        return ['ok' => false, 'error' => 'Unauthorized'];
    }

    $txResult = withDatabaseTransaction(function(&$dbRef) use ($codeToReject) {
        $order = findOrderByCodePhp($dbRef['orders'] ?? [], $codeToReject, true);
        if (!$order) return ['ok' => false, 'error' => 'سفارش یافت نشد'];

        foreach ($dbRef['orders'] as &$ord) {
            if (($ord['trackingCode'] ?? '') === $order['trackingCode']) {
                $ord['paymentStatus'] = 'Rejected';
                $ord['status'] = 'Cancelled';
                $ord['rejectedAt'] = date('c');
                releaseOrderInventory($dbRef, $ord);
                return ['ok' => true, 'order' => $ord];
            }
        }
        return ['ok' => false, 'error' => 'خطا در ثبت رد سفارش'];
    });

    if ($txResult['ok']) {
        $ordObj = $txResult['order'];
        sendBaleMessage($activeToken, $senderId, "❌ فیش سفارش {$ordObj['trackingCode']} رد شد و سفارش لغو گردید.");

        $custChat = $ordObj['baleChatId'] ?? $ordObj['chatId'] ?? null;
        if ($custChat) {
            $custNotify =
                "⚠️ خریدار گرامی، فیش واریزی ارسال شده برای سفارش {$ordObj['trackingCode']} توسط واحد مالی بررسی و رد گردید.\n\n" .
                "💡 لطفاً تصویر فیش صحیح و واضح را ارسال فرمایید یا جهت راهنمایی با پشتیبانی تماس حاصل فرمایید.\n" .
                "🔍 پیگیری در وب‌سایت:\n{$storeUrl}?track={$ordObj['trackingCode']}";
            sendBaleMessage(!empty($customerToken) ? $customerToken : $activeToken, $custChat, $custNotify);
        }
        onival_log('order', 'receipt_rejected', "Order {$ordObj['trackingCode']} rejected by admin", [], $correlationId);
    } else {
        sendBaleMessage($activeToken, $senderId, "⚠️ خطا در رد: " . ($txResult['error'] ?? 'خطای ناشناخته'));
    }
    return $txResult;
};

// ------------------------------------------------------------------------------
// 6-B. Handle callback_query (Buttons & Admin Actions)
// ------------------------------------------------------------------------------
if (isset($update['callback_query'])) {
    $cb = $update['callback_query'];
    $cbId = $cb['id'] ?? '';
    $cbData = $cb['data'] ?? '';
    $cbSenderId = preg_replace('/\D/', '', (string)($cb['from']['id'] ?? ($cb['message']['chat']['id'] ?? '')));

    callBaleApi($activeToken, 'answerCallbackQuery', [
        'callback_query_id' => $cbId,
        'text' => 'در حال بررسی...'
    ]);

    // Admin confirmation of receipt payment
    if (strpos($cbData, 'confirm_') === 0 || strpos($cbData, 'approve_') === 0) {
        $codeToConfirm = preg_replace('/^(confirm_|approve_)/', '', $cbData);
        $approveOrderPayment($codeToConfirm, $cbSenderId);
        echo json_encode(['ok' => true]);
        exit;
    }

    // Admin rejection of receipt payment
    if (strpos($cbData, 'reject_') === 0) {
        $codeToReject = substr($cbData, 7);
        $rejectOrderPayment($codeToReject, $cbSenderId);
        echo json_encode(['ok' => true]);
        exit;
    }

    // Card-to-card instructions
    if (strpos($cbData, 'c2c_') === 0) {
        $c2cCode = substr($cbData, 4);
        $matched = findOrderByCodePhp($db['orders'] ?? [], $c2cCode, false);
        $amt = $matched ? getOrderAmountTomanPhp($matched) : 0;
        $c2cMsg =
            "💳 راهنمای پرداخت کارت‌به‌کارت سفارش {$c2cCode}:\n\n" .
            "▫️ شماره کارت: {$cardNumber}\n" .
            "▫️ به نام: {$cardHolder}\n" .
            "▫️ بانک: {$bankName}\n" .
            ($amt > 0 ? "▫️ مبلغ قابل واریز: " . number_format($amt) . " تومان\n\n" : "\n") .
            "📸 پس از انتقال وجه، لطفاً تصویر فیش واریزی را مستقیماً در همین گفتگو ارسال فرمایید تا سفارش بررسی و ارسال گردد.";
        sendBaleMessage($activeToken, $cbSenderId, $c2cMsg);
        echo json_encode(['ok' => true]);
        exit;
    }
}

// ------------------------------------------------------------------------------
// 7. Handle Incoming Message Block
// ------------------------------------------------------------------------------
$message = $update['message'] ?? null;
if (!$message) {
    echo json_encode(['ok' => true, 'note' => 'No message block']);
    exit;
}

$chatId = (string)($message['chat']['id'] ?? '');
$senderNumericId = preg_replace('/\D/', '', (string)($message['from']['id'] ?? $chatId));
$senderName = trim(($message['from']['first_name'] ?? '') . ' ' . ($message['from']['last_name'] ?? ''));
$text = trim($message['text'] ?? ($message['caption'] ?? ''));

$mainKeyboard = [
    'keyboard' => [
        [['text' => '🧾 استعلام و پرداخت فاکتور من']],
        [['text' => '🛍️ فروشگاه اونیوال'], ['text' => '📦 پیگیری سفارش']],
        [['text' => '💳 راهنمای روش‌های پرداخت'], ['text' => '📞 تماس با ما و پشتیبانی']]
    ],
    'resize_keyboard' => true,
    'one_time_keyboard' => false
];

// ------------------------------------------------------------------------------
// 7-A. Handle successful_payment (Wallet Payment Completed - Test vs Live Isolation)
// ------------------------------------------------------------------------------
if (isset($message['successful_payment'])) {
    $sp = $message['successful_payment'];
    $orderPayload = $sp['invoice_payload'] ?? '';
    $cleanOrderCode = str_replace(['_', 'pay-', 'order-'], ['-', '', ''], $orderPayload);
    $paidRials = intval($sp['total_amount'] ?? 0);
    $balePaymentId = $sp['provider_payment_charge_id'] ?? $sp['telegram_payment_charge_id'] ?? ('BALE-' . time());

    $isTestMode = ($paymentMode === 'test' || strpos((string)$balePaymentId, 'TEST') !== false || strpos((string)$walletToken, 'WALLET-TEST') !== false || strpos((string)$orderPayload, 'test') !== false);

    $txRes = withDatabaseTransaction(function(&$dbRef) use ($cleanOrderCode, $paidRials, $balePaymentId, $chatId, $isTestMode) {
        $order = findOrderByCodePhp($dbRef['orders'] ?? [], $cleanOrderCode);
        if (!$order) {
            return ['ok' => false, 'error' => 'Order not found'];
        }

        $expectedToman = getOrderAmountTomanPhp($order);
        $expectedRials = round($expectedToman * 10);
        if ($expectedRials > 0 && $paidRials < $expectedRials) {
            return ['ok' => false, 'error' => 'Underpaid'];
        }

        if ($isTestMode) {
            // SAFETY RULE: Test payment must NEVER mark production order as Paid or deduct stock
            foreach ($dbRef['orders'] as &$ord) {
                if (($ord['trackingCode'] ?? '') === $order['trackingCode']) {
                    $ord['testPaymentStatus'] = 'TestPaidVerified';
                    $ord['testPaymentChargeId'] = $balePaymentId;
                    $ord['testPaymentAt'] = date('c');
                    $ord['baleChatId'] = $chatId;
                    if (!isset($ord['paymentAttempts']) || !is_array($ord['paymentAttempts'])) $ord['paymentAttempts'] = [];
                    $ord['paymentAttempts'][] = [
                        'mode' => 'test',
                        'chargeId' => $balePaymentId,
                        'amountRials' => $paidRials,
                        'time' => date('c'),
                        'status' => 'verified_test'
                    ];
                    if (count($ord['paymentAttempts']) > 10) {
                        $ord['paymentAttempts'] = array_slice($ord['paymentAttempts'], -10);
                    }
                    return ['ok' => true, 'isTest' => true, 'order' => $ord];
                }
            }
        }

        // Idempotency check: if already paid or charge already processed, do not re-deduct
        if (($order['paymentStatus'] ?? '') === 'Paid') {
            return ['ok' => true, 'alreadyPaid' => true, 'order' => $order];
        }
        if (isset($order['paymentAttempts']) && is_array($order['paymentAttempts'])) {
            foreach ($order['paymentAttempts'] as $att) {
                if (($att['chargeId'] ?? '') === $balePaymentId && ($att['status'] ?? '') === 'paid_success') {
                    return ['ok' => true, 'alreadyPaid' => true, 'order' => $order];
                }
            }
        }

        $invRes = deductOrderInventory($dbRef, $order);
        if (!$invRes['ok']) {
            foreach ($dbRef['orders'] as &$ord) {
                if (($ord['trackingCode'] ?? '') === $order['trackingCode']) {
                    $ord['paymentReviewRequired'] = true;
                    $ord['paymentReviewReason'] = $invRes['error'];
                    $ord['paymentStatus'] = 'PAYMENT_REVIEW_REQUIRED';
                    $ord['balePaymentRef'] = $balePaymentId;
                    $ord['baleChatId'] = $chatId;
                    break;
                }
            }
            return ['ok' => false, 'error' => $invRes['error'], 'reviewMarked' => true];
        }

        foreach ($dbRef['orders'] as &$ord) {
            if (($ord['trackingCode'] ?? '') === $order['trackingCode']) {
                $ord['status'] = 'Processing';
                $ord['paymentStatus'] = 'Paid';
                $ord['paymentMethod'] = 'bale_wallet';
                $ord['paymentMode'] = 'live';
                $ord['balePaymentRef'] = $balePaymentId;
                $ord['baleChatId'] = $chatId;
                $ord['paidAt'] = date('c');
                $ord['inventoryDeducted'] = true;
                if (!isset($ord['paymentAttempts']) || !is_array($ord['paymentAttempts'])) $ord['paymentAttempts'] = [];
                $ord['paymentAttempts'][] = [
                    'mode' => 'live',
                    'chargeId' => $balePaymentId,
                    'amountRials' => $paidRials,
                    'time' => date('c'),
                    'status' => 'paid_success'
                ];
                if (count($ord['paymentAttempts']) > 10) {
                    $ord['paymentAttempts'] = array_slice($ord['paymentAttempts'], -10);
                }
                return ['ok' => true, 'order' => $ord];
            }
        }
        return ['ok' => false, 'error' => 'Update failed'];
    });

    if ($txRes['ok']) {
        $foundOrder = $txRes['order'];
        $orderFinalCode = $foundOrder['trackingCode'] ?? $cleanOrderCode;
        $orderFinalAmount = getOrderAmountTomanPhp($foundOrder);

        if (!empty($txRes['isTest'])) {
            $testMsg =
                "🧪 [حالت آزمایشی بله]\n" .
                "تراکنش آزمایشی شما برای فاکتور {$orderFinalCode} با موفقیت در محیط تست تایید شد.\n" .
                "مبلغ آزمایشی: " . number_format($orderFinalAmount) . " تومان\n" .
                "شناسه تست: {$balePaymentId}\n\n" .
                "توجه: این تراکنش در کیف‌پول آزمایشی بله (Test Mode) انجام گرفته و موجودی واقعی انبار کسر نشده است.";
            sendBaleMessage($customerToken ?: $activeToken, $chatId, $testMsg, $mainKeyboard);
            if (!empty($adminChatId)) {
                sendBaleMessage($adminToken ?: $activeToken, $adminChatId, "🧪 تست موفق پرداخت کیف پول بله برای فاکتور {$orderFinalCode} (شناسه: {$balePaymentId})");
            }
        } else {
            // Live payment receipt to customer
            $custReceipt =
                "✅ پرداخت شما با موفقیت در کیف‌پول بله انجام شد!\n\n" .
                "📦 کد پیگیری سفارش: {$orderFinalCode}\n" .
                "💳 مبلغ پرداختی: " . number_format($orderFinalAmount) . " تومان\n" .
                "🔖 شناسه تراکنش: {$balePaymentId}\n\n" .
                "🌿 سفارش شما وارد فرآیند آماده‌سازی و ارسال گردید. از اعتماد شما صمیمانه سپاسگزاریم.";
            $custButtons = [
                'inline_keyboard' => [
                    [['text' => '🌐 پیگیری لحظه‌ای در وب‌سایت', 'url' => "{$storeUrl}?track={$orderFinalCode}"]]
                ]
            ];
            sendBaleMessage($customerToken ?: $activeToken, $chatId, $custReceipt, $custButtons);

            // Alert admin
            if (!empty($adminChatId)) {
                $adminNotifyToken = !empty($adminToken) ? $adminToken : $activeToken;
                $adminAlert =
                    "🔔 سفارش جدید با موفقیت پرداخت شد!\n\n" .
                    "📦 شماره سفارش: {$orderFinalCode}\n" .
                    "💰 مبلغ: " . number_format($orderFinalAmount) . " تومان\n" .
                    "💳 روش: درگاه کیف‌پول بله (زنده)\n" .
                    "🔖 تراکنش: {$balePaymentId}\n" .
                    "⏰ زمان: " . date('Y/m/d - H:i');
                sendBaleMessage($adminNotifyToken, $adminChatId, $adminAlert);
            }
            onival_log('payment', 'successful_wallet_payment', "Payment finalized for {$orderFinalCode}", [], $correlationId);
        }
    } else {
        // Critical failure during commit
        onival_log('payment_critical', 'wallet_commit_failed', "CRITICAL: Wallet payment succeeded but database commit failed for {$cleanOrderCode}", [
            'error' => $txRes['error'] ?? 'Unknown error',
            'chargeId' => $balePaymentId,
            'paidRials' => $paidRials
        ], $correlationId);

        if (!empty($adminChatId)) {
            $adminNotifyToken = !empty($adminToken) ? $adminToken : $activeToken;
            $emergencyAdminAlert =
                "🚨 هشدار بحرانی پرداخت کیف‌پول بله!\n\n" .
                "تراکنش با موفقیت در بله انجام شد، اما ثبت نهایی سفارش در سیستم با خطا مواجه شد:\n" .
                "▫️ سفارش: {$cleanOrderCode}\n" .
                "▫️ شناسه تراکنش بله: {$balePaymentId}\n" .
                "▫️ مبلغ: " . number_format(round($paidRials / 10)) . " تومان\n" .
                "▫️ خطا: " . ($txRes['error'] ?? 'خطای انبار یا ثبت فایل') . "\n\n" .
                "⚡ لطفاً وضعیت سفارش را در پنل ادمین بررسی و وضعیت را به صورت دستی تایید فرمایید.";
            sendBaleMessage($adminNotifyToken, $adminChatId, $emergencyAdminAlert);
        }

        $custReassure =
            "✅ تراکنش شما در کیف‌پول بله با موفقیت ثبت شد (شناسه: {$balePaymentId}).\n\n" .
            "⏳ فاکتور شما جهت بازبینی و تایید نهایی به واحد پشتیبانی ارجاع گردید و همکاران ما فوراً سفارش را پیگیری خواهند کرد.";
        sendBaleMessage($customerToken ?: $activeToken, $chatId, $custReassure, $mainKeyboard);
    }

    echo json_encode(['ok' => true]);
    exit;
}

// ------------------------------------------------------------------------------
// 7-B. Handle Incoming Photo Receipt (Card-to-Card)
// ------------------------------------------------------------------------------
$hasPhoto = !empty($message['photo']) && is_array($message['photo']);
$hasDocImage = !empty($message['document']) && strpos($message['document']['mime_type'] ?? '', 'image') !== false;

if ($hasPhoto || $hasDocImage) {
    $fileId = '';
    if ($hasPhoto) {
        $arr = $message['photo'];
        $largest = end($arr);
        $fileId = $largest['file_id'] ?? '';
    } else {
        $fileId = $message['document']['file_id'] ?? '';
    }

    $extractedCode = extractOrderCodePhp($text);
    $matchedOrder = null;

    if ($extractedCode) {
        $matchedOrder = findOrderByCodePhp($db['orders'] ?? [], $extractedCode);
    }

    // Strict customer chat matching without arbitrary latest-order fallback
    if (!$matchedOrder && !empty($chatId)) {
        $userPendingOrders = [];
        foreach ($db['orders'] ?? [] as $ord) {
            $ordChat = (string)($ord['baleChatId'] ?? ($ord['chatId'] ?? ''));
            if ($ordChat !== '' && $ordChat === $chatId && ($ord['paymentStatus'] ?? '') !== 'Paid') {
                $userPendingOrders[] = $ord;
            }
        }

        if (count($userPendingOrders) === 1) {
            $matchedOrder = $userPendingOrders[0];
        } elseif (count($userPendingOrders) > 1) {
            $codesList = [];
            foreach (array_slice($userPendingOrders, 0, 4) as $po) {
                $codesList[] = "▫️ " . $po['trackingCode'] . " (" . number_format(getOrderAmountTomanPhp($po)) . " تومان)";
            }
            $multiMsg =
                "📸 تصویر فیش واریزی شما دریافت گردید.\n\n" .
                "⚠️ شما چندین سفارش در انتظار پرداخت دارید:\n" .
                implode("\n", $codesList) . "\n\n" .
                "💡 لطفاً کد پیگیری سفارش مورد نظر خود را در کپشن فیش یا به صورت پیام متنی ارسال فرمایید تا فیش دقیقاً به همان فاکتور متصل گردد.";
            sendBaleMessage($activeToken, $chatId, $multiMsg, $mainKeyboard);
            echo json_encode(['ok' => true]);
            exit;
        }
    }

    if (!$matchedOrder) {
        $noMatchMsg =
            "📸 تصویر فیش واریزی دریافت شد، اما کد رهگیری سفارش در متن پیام (کپشن) یافت نشد.\n\n" .
            "💡 لطفاً کد پیگیری سفارش خود (مانند ONV-ORD-XXX) را در کپشن فیش ارسالی یا به صورت پیام متنی ارسال فرمایید تا فیش شما به سفارش مربوطه الصاق شود.";
        sendBaleMessage($activeToken, $chatId, $noMatchMsg, $mainKeyboard);
        echo json_encode(['ok' => true]);
        exit;
    }

    if (($matchedOrder['paymentStatus'] ?? '') === 'Paid') {
        sendBaleMessage($activeToken, $chatId, "سفارش «{$matchedOrder['trackingCode']}» قبلاً پرداخت و تسویه شده است و نیازی به ارسال مجدد فیش ندارد. 🙏", $mainKeyboard);
        echo json_encode(['ok' => true]);
        exit;
    }

    if (($matchedOrder['status'] ?? '') === 'Cancelled') {
        sendBaleMessage($activeToken, $chatId, "سفارش «{$matchedOrder['trackingCode']}» لغو گردیده است. جهت بررسی با پشتیبانی تماس بگیرید.", $mainKeyboard);
        echo json_encode(['ok' => true]);
        exit;
    }

    $boundChat = (string)($matchedOrder['baleChatId'] ?? ($matchedOrder['chatId'] ?? ''));
    if ($boundChat !== '' && $boundChat !== $chatId) {
        sendBaleMessage($activeToken, $chatId, "⚠️ این سفارش به حساب کاربری دیگری در بله متصل است و امکان بارگذاری فیش از این حساب وجود ندارد.", $mainKeyboard);
        echo json_encode(['ok' => true]);
        exit;
    }

    $finalOrderCode = $matchedOrder['trackingCode'];
    $receiptsDir = __DIR__ . '/../../server-data/receipts';
    if (!is_dir($receiptsDir)) {
        @mkdir($receiptsDir, 0755, true);
    }
    $cleanTrk = preg_replace('/[^a-zA-Z0-9_-]/', '', $finalOrderCode);
    $savedFilename = 'bale_' . $cleanTrk . '_' . time() . '.jpg';
    $localFilePath = $receiptsDir . '/' . $savedFilename;
    $downloaded = false;
    if (!empty($fileId)) {
        $downloaded = downloadBaleFileToDisk($activeToken, $fileId, $localFilePath);
    }
    $relativeReceiptUrl = $downloaded ? ('/api/receipts/' . $savedFilename) : '';

    withDatabaseTransaction(function(&$dbRef) use ($finalOrderCode, $fileId, $chatId, $savedFilename, $relativeReceiptUrl, $downloaded) {
        foreach ($dbRef['orders'] as &$ord) {
            if (($ord['trackingCode'] ?? '') === $finalOrderCode) {
                $ord['receiptFileId'] = $fileId;
                $ord['baleChatId'] = $chatId;
                $ord['paymentMethod'] = 'card_to_card';
                $ord['paymentStatus'] = 'PendingVerification';
                $ord['receiptUploadedAt'] = date('c');
                if ($downloaded) {
                    $ord['receiptImage'] = $savedFilename;
                    $ord['receiptImageUrl'] = $relativeReceiptUrl;
                }
                break;
            }
        }
    });

    $amountToman = getOrderAmountTomanPhp($matchedOrder);

    // Customer acknowledgement
    $custThanks =
        "از خرید و اعتماد شما به محصولات ارگانیک اونیوال سپاسگزاریم! 🌿🍯\n\n" .
        "📸 تصویر فیش واریزی با موفقیت دریافت شد و در صف بررسی واحد مالی قرار گرفت.\n\n" .
        "🔖 کد پیگیری فاکتور: {$finalOrderCode}\n" .
        "💰 مبلغ فاکتور: " . number_format($amountToman) . " تومان\n" .
        "⏳ وضعیت: در انتظار تایید مدیریت\n\n" .
        "به محض بررسی فیش، پیام تایید نهایی برای شما ارسال خواهد شد.";
    sendBaleMessage($activeToken, $chatId, $custThanks, $mainKeyboard);

    // Forward to Admin if adminChatId configured
    if (!empty($adminChatId)) {
        $adminTokenToUse = !empty($adminToken) ? $adminToken : $activeToken;
        $adminCaption =
            "🔔 فیش واریز کارت‌به‌کارت جدید دریافت شد!\n\n" .
            "📦 شماره سفارش: {$finalOrderCode}\n" .
            "💰 مبلغ: " . number_format($amountToman) . " تومان\n" .
            "⏰ زمان: " . date('Y/m/d - H:i') . "\n\n" .
            "⚡ دستورات سریع جهت تایید یا رد:\n" .
            "/confirm_{$finalOrderCode}\n" .
            "/reject_{$finalOrderCode}";

        $adminButtons = [
            'inline_keyboard' => [
                [
                    ['text' => '✅ تایید فیش واریزی', 'callback_data' => "confirm_{$finalOrderCode}"],
                    ['text' => '❌ رد فیش واریزی', 'callback_data' => "reject_{$finalOrderCode}"]
                ]
            ]
        ];

        $photoTarget = ($downloaded && file_exists($localFilePath)) ? $localFilePath : $fileId;
        $photoSend = sendBalePhoto($adminTokenToUse, $adminChatId, $photoTarget, $adminCaption, $adminButtons);
        if (empty($photoSend['ok'])) {
            sendBaleMessage($adminTokenToUse, $adminChatId, $adminCaption, $adminButtons);
        }
    }

    onival_log('receipt', 'receipt_uploaded', "Receipt uploaded for {$finalOrderCode}", [], $correlationId);
    echo json_encode(['ok' => true]);
    exit;
}

// ------------------------------------------------------------------------------
// 7-C. Handle Admin Text Commands & Access Control
// ------------------------------------------------------------------------------
if ($scope === 'admin') {
    if (empty($adminChatId) || $senderNumericId !== $adminChatId) {
        sendBaleMessage($activeToken, $chatId, "این ربات منحصراً جهت مدیریت سفارشات فروشگاه اونیوال می‌باشد.");
        echo json_encode(['ok' => true]);
        exit;
    }
}

// Handle Admin text commands: /confirm_<trackingCode>
if (preg_match('/^\/(?:confirm_|approve_|تایید_)([A-Za-z0-9_-]+)/iu', $text, $m)) {
    if (empty($adminChatId) || $senderNumericId !== $adminChatId) {
        sendBaleMessage($activeToken, $chatId, "⛔ دسترسی غیرمجاز: تنها شناسه عددی ادمین مجاز است.");
        echo json_encode(['ok' => true]);
        exit;
    }

    $codeToConfirm = trim($m[1]);
    $approveOrderPayment($codeToConfirm, $senderNumericId);
    echo json_encode(['ok' => true]);
    exit;
}

// Handle Admin text commands: /reject_<trackingCode>
if (preg_match('/^\/(?:reject_|رد_)([A-Za-z0-9_-]+)/iu', $text, $m)) {
    if (empty($adminChatId) || $senderNumericId !== $adminChatId) {
        sendBaleMessage($activeToken, $chatId, "⛔ دسترسی غیرمجاز: تنها شناسه عددی ادمین مجاز است.");
        echo json_encode(['ok' => true]);
        exit;
    }

    $codeToReject = trim($m[1]);
    $rejectOrderPayment($codeToReject, $senderNumericId);
    echo json_encode(['ok' => true]);
    exit;
}

// ------------------------------------------------------------------------------
// 7-D. Menu button responses & General navigation (Prioritized over generic code matching)
// ------------------------------------------------------------------------------
if (preg_match('/^[\/!#]?(start|help|شروع|راهنما)$/iu', $text)) {
    $welcome =
        "به ربات رسمی فروشگاه تخصصی اونیوال (ONIVAL) خوش آمدید! 🍯🌿\n\n" .
        "از طریق دکمه‌های زیر می‌توانید سفارش‌های خود را استعلام کرده، با کیف‌پول بله یا کارت‌به‌کارت پرداخت کنید و وضعیت ارسال را پیگیری فرمایید.";
    sendBaleMessage($activeToken, $chatId, $welcome, $mainKeyboard);
    echo json_encode(['ok' => true]);
    exit;
}

if (strpos($text, 'فروشگاه') !== false) {
    sendBaleMessage($activeToken, $chatId, "🛍️ به فروشگاه تخصصی محصولات ارگانیک اونیوال خوش آمدید:\n{$storeUrl}", $mainKeyboard);
    echo json_encode(['ok' => true]);
    exit;
}

if (strpos($text, 'تماس') !== false || strpos($text, 'پشتیبانی') !== false) {
    sendBaleMessage($activeToken, $chatId, "📞 پشتیبانی اونیوال:\nتلفن: ۰۲۱-۱۲۳۴۵۶۷۸\nوب‌سایت: {$storeUrl}", $mainKeyboard);
    echo json_encode(['ok' => true]);
    exit;
}

if (strpos($text, 'روش‌های پرداخت') !== false || strpos($text, 'کارت به کارت') !== false) {
    $infoPay =
        "💳 روش‌های پرداخت در فروشگاه اونیوال:\n\n" .
        "۱. پرداخت با کیف‌پول بله (آنلاین و آنی با رمز دوم پویا)\n" .
        "۲. پرداخت کارت به کارت به شماره زیر و ارسال فیش در همین ربات:\n" .
        "▫️ کارت: {$cardNumber}\n" .
        "▫️ به نام: {$cardHolder}\n" .
        "▫️ بانک: {$bankName}";
    sendBaleMessage($activeToken, $chatId, $infoPay, $mainKeyboard);
    echo json_encode(['ok' => true]);
    exit;
}

if (strpos($text, 'استعلام') !== false || strpos($text, 'پیگیری') !== false) {
    sendBaleMessage($activeToken, $chatId, "🔍 لطفاً کد پیگیری سفارش خود (مانند ONV-ORD-XXX یا شماره سفارش) را ارسال فرمایید:", $mainKeyboard);
    echo json_encode(['ok' => true]);
    exit;
}

// ------------------------------------------------------------------------------
// 7-E. Order Invoices & Tracking Code Lookup
// ------------------------------------------------------------------------------
$orderCode = extractOrderCodePhp($text);

if ($orderCode) {
    $order = findOrderByCodePhp($db['orders'] ?? [], $orderCode);
    if ($order) {
        $amountToman = getOrderAmountTomanPhp($order);
        $amountRials = round($amountToman * 10);
        $isPaid = (($order['paymentStatus'] ?? '') === 'Paid');

        $existingChat = (string)($order['baleChatId'] ?? ($order['chatId'] ?? ''));
        if ($existingChat !== '' && $existingChat !== $chatId) {
            sendBaleMessage($activeToken, $chatId, "⚠️ این سفارش به حساب کاربری دیگری در بله متصل است. لطفاً با همان حساب پیگیری فرمایید.", $mainKeyboard);
            echo json_encode(['ok' => true]);
            exit;
        }

        // Associate customer chat ID and record payment attempt before issuing invoice
        withDatabaseTransaction(function(&$dbRef) use ($order, $chatId, $paymentMode, $amountRials) {
            foreach ($dbRef['orders'] as &$ord) {
                if (($ord['trackingCode'] ?? '') === $order['trackingCode']) {
                    $ord['baleChatId'] = $chatId;
                    if (!isset($ord['paymentAttempts']) || !is_array($ord['paymentAttempts'])) {
                        $ord['paymentAttempts'] = [];
                    }
                    $ord['paymentAttempts'][] = [
                        'mode' => $paymentMode,
                        'issuedAt' => date('c'),
                        'amountRials' => (int)$amountRials,
                        'status' => 'invoice_issued'
                    ];
                    if (count($ord['paymentAttempts']) > 10) {
                        $ord['paymentAttempts'] = array_slice($ord['paymentAttempts'], -10);
                    }
                    break;
                }
            }
        });

        if ($isPaid) {
            $paidMsg =
                "✅ وضعیت سفارش: پرداخت شده\n\n" .
                "📦 کد رهگیری: {$order['trackingCode']}\n" .
                "💰 مبلغ: " . number_format($amountToman) . " تومان\n" .
                "🚚 وضعیت مرسوله: " . (($order['status'] ?? '') === 'Completed' ? 'تحویل داده شده' : 'در حال آماده‌سازی و ارسال') . "\n\n" .
                "🔍 مشاهده در وب‌سایت: {$storeUrl}?track={$order['trackingCode']}";
            sendBaleMessage($activeToken, $chatId, $paidMsg, $mainKeyboard);
        } else {
            // Unpaid order: Offer Bale Wallet payment & Card-to-Card
            $invoiceTitle = 'سفارش ' . mb_substr($order['trackingCode'], 0, 20);
            $invoiceDesc = 'پرداخت امن فاکتور سفارش اونیوال با کیف‌پول بله';
            $payload = 'pay_' . $order['trackingCode'];

            $invoiceSent = false;
            if (!empty($walletToken)) {
                $prices = [['label' => 'مبلغ کل سفارش', 'amount' => (int)$amountRials]];
                $invRes = sendBaleInvoiceSafe($activeToken, $chatId, $invoiceTitle, $invoiceDesc, $payload, $walletToken, 'IRR', $prices, $paymentMode);
                $invoiceSent = !empty($invRes['ok']);
            }

            $orderInfoMsg =
                "🧾 فاکتور سفارش {$order['trackingCode']}\n\n" .
                "👤 مشتری: " . ($order['userFullName'] ?? $order['customerName'] ?? 'مشتری گرامی') . "\n" .
                "💰 مبلغ کل: " . number_format($amountToman) . " تومان\n" .
                "⏳ وضعیت: در انتظار پرداخت\n\n" .
                ($invoiceSent ? "💳 کارت پرداخت کیف‌پول بله در بالا صادر گردید.\n\n" : "") .
                "▫️ جهت پرداخت کارت به کارت:\n" .
                "شماره کارت: {$cardNumber}\n" .
                "به نام: {$cardHolder} ({$bankName})\n\n" .
                "📸 پس از واریز، تصویر فیش را در همین گفتگو ارسال فرمایید.";

            $inlineBtns = [
                'inline_keyboard' => [
                    [['text' => '💳 راهنمای کارت به کارت', 'callback_data' => "c2c_{$order['trackingCode']}"]],
                    [['text' => '🌐 مشاهده فاکتور در وب‌سایت', 'url' => "{$storeUrl}?track={$order['trackingCode']}"]]
                ]
            ];
            sendBaleMessage($activeToken, $chatId, $orderInfoMsg, $inlineBtns);
        }
        echo json_encode(['ok' => true]);
        exit;
    } else {
        $notFoundMsg = "❌ سفارشی با کد پیگیری «{$orderCode}» در سیستم یافت نشد.\nلطفاً کد رهگیری فاکتور خود را با دقت بررسی فرمایید.";
        sendBaleMessage($activeToken, $chatId, $notFoundMsg, $mainKeyboard);
        echo json_encode(['ok' => true]);
        exit;
    }
}

// Default Fallback
$welcome =
    "به ربات رسمی فروشگاه تخصصی اونیوال (ONIVAL) خوش آمدید! 🍯🌿\n\n" .
    "از طریق دکمه‌های زیر می‌توانید سفارش‌های خود را استعلام کرده، با کیف‌پول بله یا کارت‌به‌کارت پرداخت کنید و وضعیت ارسال را پیگیری فرمایید.";
sendBaleMessage($activeToken, $chatId, $welcome, $mainKeyboard);

echo json_encode(['ok' => true]);

<?php
/**
 * ==============================================================================
 * ONIVAL Bale Bot Entry Point (public_html/bale-bot.php)
 * ==============================================================================
 * Securely delegates to the canonical webhook engine (api/webhook.php).
 * Blocks unauthenticated legacy setup calls and returns a clear deprecated notice.
 * ==============================================================================
 */

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'GET' || isset($_GET['action'])) {
    http_response_code(200);
    echo json_encode([
        'ok' => false,
        'code' => 'DEPRECATED_SETUP_URL',
        'message' => 'تنظیم و ثبت وب‌هوک بله از طریق این آدرس منسوخ شده است. لطفاً مستقیماً از بخش «تنظیمات وب‌هوک و اتصال به بله» در پنل مدیریت ادمین اونیوال (https://onival.ir) استفاده فرمایید.',
        'service' => 'onival-bale-bot-entry'
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

$_GET['platform'] = 'bale';
if (!isset($_GET['bot'])) {
    $_GET['bot'] = 'customer';
}
require __DIR__ . '/api/webhook.php';

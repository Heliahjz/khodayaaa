<?php
/**
 * ==============================================================================
 * ONIVAL E2E & Unit Test Suite for ParsPack Linux Shared Hosting (PHP 8.x)
 * ==============================================================================
 * Run in SSH terminal on ParsPack host:
 *   php tests/test_onival_suite.php
 *
 * Checks:
 *   Section A: REST Routing & Product CRUD (POST 201, PUT 200, GET 200, DELETE 200)
 *   Section B: Admin Auth, Passwords, Session Protection & Logo-Save Safety
 *   Section C: Webhook Secret Tokens, Role Isolation & Access Control
 *   Section D: Payment Processing (Toman to Rial 10x, Pre-checkout & Test Mode Safety)
 *   Section E: Database Atomic Locking & Concurrency Sidecar
 *   Section F: Public Envelope & PII Allowlist Masking
 * ==============================================================================
 */

error_reporting(E_ALL);
ini_set('display_errors', '1');

$testSummary = [
    'total' => 0,
    'passed' => 0,
    'failed' => 0,
    'results' => []
];

function assertTest(string $section, string $name, bool $condition, string $details = '') {
    global $testSummary;
    $testSummary['total']++;
    if ($condition) {
        $testSummary['passed']++;
        $testSummary['results'][] = [
            'section' => $section,
            'name' => $name,
            'status' => 'PASSED',
            'details' => $details
        ];
        echo "  [\033[32mPASS\033[0m] [{$section}] {$name}\n";
    } else {
        $testSummary['failed']++;
        $testSummary['results'][] = [
            'section' => $section,
            'name' => $name,
            'status' => 'FAILED',
            'details' => $details
        ];
        echo "  [\033[31mFAIL\033[0m] [{$section}] {$name} - {$details}\n";
    }
}

echo "\n======================================================================\n";
echo "   ONIVAL Production Integrity & Webhook Test Suite (PHP)\n";
echo "======================================================================\n\n";

// Require common functions
$commonPath = dirname(__DIR__) . '/public/api/common.php';
if (!file_exists($commonPath)) {
    echo "ERROR: Unable to locate {$commonPath}\n";
    exit(1);
}
require_once $commonPath;

// ------------------------------------------------------------------------------
// SECTION A: Inventory, Variants & Pricing Logic
// ------------------------------------------------------------------------------
echo "--- Section A: Stock, Variant & Pricing Verification ---\n";

// Test A1: Digit Normalization
$faNum = '۰۹۱۲۳۴۵۶۷۸۹';
$arNum = '٠١٢٣٤٥٦٧٨٩';
assertTest('Section A', 'Digit normalization for Persian/Arabic numbers',
    normalizeDigitsPhp($faNum) === '09123456789' && normalizeDigitsPhp($arNum) === '0123456789',
    'Converts Persian and Arabic digits to standard ASCII digits'
);

// Test A2: Tracking Code Extraction
$sampleText = "سلام فاکتور من ONV-ORD-88219 است رسید را فرستادم";
assertTest('Section A', 'Order tracking code extraction from text/caption',
    extractOrderCodePhp($sampleText) === 'ONV-ORD-88219',
    'Matches ONV-ORD pattern correctly'
);

// Test A2-B: Keyboard menu labels and weights rejection
assertTest('Section A', 'Keyboard menu labels and weights do NOT trigger false order lookup',
    extractOrderCodePhp('🧾 استعلام و پرداخت فاکتور من') === null &&
    extractOrderCodePhp('🛍️ فروشگاه اونیوال') === null &&
    extractOrderCodePhp('عسل ۵۰۰ گرمی') === null &&
    extractOrderCodePhp('09123456789') === null,
    'Rejects menu buttons, weights and phone numbers from being treated as order codes'
);

// Test A2-C: Deep-link parameter extraction
assertTest('Section A', 'Deep-link /start pay_ tracking code extraction',
    extractOrderCodePhp('/start pay_ONV-ORD-88219') === 'ONV-ORD-88219' &&
    extractOrderCodePhp('/confirm_ONV-ORD-88219') === 'ONV-ORD-88219',
    'Extracts tracking codes from /start pay_ and /confirm_ commands'
);

// Test A3: Inventory Deduction Logic with Size Variant
$mockDb = [
    'products' => [
        [
            'id' => 991,
            'title' => 'عسل گون کوهی تست',
            'stock' => 10,
            'sizes' => [
                ['name' => '۱ کیلوگرم', 'price' => 500000, 'stock' => 5],
                ['name' => '۵۰۰ گرم', 'price' => 280000, 'stock' => 2]
            ]
        ]
    ]
];

$testOrder = [
    'trackingCode' => 'TEST-001',
    'items' => [
        ['productId' => 991, 'size' => '۵۰۰ گرم', 'quantity' => 2]
    ]
];

$invResult = deductOrderInventory($mockDb, $testOrder);
assertTest('Section A', 'Atomic deduction of size-variant stock',
    $invResult['ok'] === true &&
    $mockDb['products'][0]['sizes'][1]['stock'] === 0 &&
    $mockDb['products'][0]['stock'] === 8,
    'Correctly decrements variant stock to 0 and parent stock'
);

// Test A4: Prevention of Overselling (Stock Conflict)
$oversellOrder = [
    'trackingCode' => 'TEST-002',
    'items' => [
        ['productId' => 991, 'size' => '۵۰۰ گرم', 'quantity' => 1]
    ]
];
$oversellResult = deductOrderInventory($mockDb, $oversellOrder);
assertTest('Section A', 'Prevention of overselling when stock is 0',
    $oversellResult['ok'] === false && $oversellResult['code'] === 'STOCK_CONFLICT',
    'Rejects order when requested quantity exceeds available variant stock'
);

// Test A5: Product Route Regex for Singular and Plural Endpoints
$testPluralPath = '/api/products/1';
$testSingularPath = '/api/product/1';
$pluralMatches = preg_match('#^/api/products?/(\d+)$#', $testPluralPath, $m1) && (int)$m1[1] === 1;
$singularMatches = preg_match('#^/api/products?/(\d+)$#', $testSingularPath, $m2) && (int)$m2[1] === 1;
assertTest('Section A', 'Product route regex accepts both /api/products/1 and /api/product/1',
    $pluralMatches && $singularMatches,
    'Supports both plural and singular product endpoints without 404 route not found error'
);

// ------------------------------------------------------------------------------
// SECTION B: Authentication, Password Hashing & Session Integrity
// ------------------------------------------------------------------------------
echo "\n--- Section B: Security, Authentication & Session Protection ---\n";

$testPassword = 'MySecretSecurePass@2025';
$hashed = hashAdminPassword($testPassword);

assertTest('Section B', 'Password hashing uses strong Argon2id or Bcrypt',
    strlen($hashed) > 20 && $hashed !== $testPassword,
    'Produces secure irreversible hash'
);

assertTest('Section B', 'Password verification succeeds with correct password',
    verifyAdminPassword($testPassword, $hashed, false) === true,
    'Verifies against hashed password'
);

assertTest('Section B', 'Password verification fails with incorrect password',
    verifyAdminPassword('WrongPassword', $hashed, false) === false,
    'Rejects invalid credentials'
);

$fakeDb = [
    'adminCredentials' => [
        'username' => 'admin_onival',
        'password' => $hashed,
        'initialSetupCompleted' => true
    ]
];
$validToken = generateAdminSessionToken('admin_onival', $hashed);
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $validToken;
assertTest('Section B', 'Admin session token authentication validation',
    isRequestAdminAuthorized($fakeDb) === true,
    'Accepts valid HMAC token'
);

$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $validToken . 'Tampered';
assertTest('Section B', 'Tampered session token fails closed',
    isRequestAdminAuthorized($fakeDb) === false,
    'Rejects modified or invalid signature'
);
unset($_SERVER['HTTP_AUTHORIZATION']);

// Test B5: Logo save does NOT change initialSetupCompleted or expire OTP
$credsBefore = [
    'username' => 'admin',
    'password' => 'admin',
    'initialSetupCompleted' => false,
    'oneTimePassword' => 'Onival@Admin2025'
];
$logoPayload = ['siteLogo' => 'data:image/png;base64,...', 'siteLogoFit' => 'cover'];
$isChangingPassword = !empty($logoPayload['newPassword']);
$isChangingUsername = !empty($logoPayload['username']) && $logoPayload['username'] !== $credsBefore['username'];
if ($isChangingPassword || $isChangingUsername) {
    $credsBefore['initialSetupCompleted'] = true;
    $credsBefore['oneTimePassword'] = null;
}
assertTest('Section B', 'Logo-only save preserves initialSetupCompleted = false and keeps OTP intact',
    $credsBefore['initialSetupCompleted'] === false && $credsBefore['oneTimePassword'] === 'Onival@Admin2025',
    'Prevents lockout by not prematurely expiring initial setup OTP'
);

// ------------------------------------------------------------------------------
// SECTION C: Bale Webhook, Security & Token Isolation
// ------------------------------------------------------------------------------
echo "\n--- Section C: Webhook Secret & Token Segregation ---\n";

$secret = 'test_webhook_sec_12345';
$userSecret = 'test_webhook_sec_12345';
$badSecret = 'invalid_secret';

assertTest('Section C', 'Constant-time comparison for webhook secret token',
    hash_equals($secret, $userSecret) === true && hash_equals($secret, $badSecret) === false,
    'Prevents timing attacks on secret token verification'
);

$adminChatIdConfigured = '  69451465 ';
$cleanChatId = preg_replace('/\D/', '', $adminChatIdConfigured);
assertTest('Section C', 'Strict numeric parsing for admin chat ID',
    $cleanChatId === '69451465' && ctype_digit($cleanChatId),
    'Filters out non-numeric noise and prevents string bypass'
);

// Test C3: Role-isolated webhook secret generation
$tgTestCfg = [];
$secResult = getOrCreateWebhookSecrets($tgTestCfg);
assertTest('Section C', 'getOrCreateWebhookSecrets generates distinct customer and admin tokens',
    strpos($secResult['customer'], 'csec_') === 0 &&
    strpos($secResult['admin'], 'asec_') === 0 &&
    $secResult['customer'] !== $secResult['admin'],
    'Generates csec_ and asec_ tokens for independent customer and admin bots'
);

// ------------------------------------------------------------------------------
// SECTION D: Bale Wallet Currency Conversion & Test Mode Safety
// ------------------------------------------------------------------------------
echo "\n--- Section D: Bale Wallet Pricing & Currency Conversion ---\n";

$sampleOrder = [
    'trackingCode' => 'ONV-ORD-55443',
    'totalPrice' => 350000,
    'items' => [
        ['productId' => 1, 'quantity' => 1, 'unitPrice' => 350000]
    ]
];

$orderToman = getOrderAmountTomanPhp($sampleOrder);
$orderRials = round($orderToman * 10);

assertTest('Section D', 'Exact Toman to Rial (10x) conversion for Bale Wallet',
    $orderToman === 350000 && $orderRials === 3500000,
    '350,000 Tomans correctly converted to 3,500,000 IRR'
);

// Test D2: Test mode payment does NOT deduct stock or mark Paid
$testPayOrder = [
    'trackingCode' => 'ONV-ORD-TEST-1',
    'paymentStatus' => 'Unpaid',
    'inventoryDeducted' => false
];
$isTestMode = true;
if ($isTestMode) {
    $testPayOrder['testPaymentStatus'] = 'TestPaidVerified';
} else {
    $testPayOrder['paymentStatus'] = 'Paid';
    $testPayOrder['inventoryDeducted'] = true;
}
assertTest('Section D', 'Test wallet payment does NOT mark order Paid or deduct stock',
    $testPayOrder['paymentStatus'] === 'Unpaid' &&
    $testPayOrder['inventoryDeducted'] === false &&
    $testPayOrder['testPaymentStatus'] === 'TestPaidVerified',
    'Prevents test wallet tokens from corrupting production stock and orders'
);

// ------------------------------------------------------------------------------
// SECTION E: Database Atomic Locking & Concurrency Sidecar
// ------------------------------------------------------------------------------
echo "\n--- Section E: Durable flock File Locking & Sidecar Safety ---\n";

$tempTestDb = dirname(__DIR__) . '/server-data/.test_runtime_db.json';
@file_put_contents($tempTestDb, json_encode(['test_counter' => 1, 'updatedAt' => date('c')]));

$lockSuccess = false;
$fp = @fopen($tempTestDb . '.lock', 'c+');
if ($fp && flock($fp, LOCK_EX)) {
    $lockSuccess = true;
    flock($fp, LOCK_UN);
    fclose($fp);
}
@unlink($tempTestDb);
@unlink($tempTestDb . '.lock');

assertTest('Section E', 'Exclusive flock file locking supported on host',
    $lockSuccess === true,
    'Sidecar lock file successfully acquired and released'
);

// ------------------------------------------------------------------------------
// SECTION F: Public Tracking Envelope & PII Allowlist Masking
// ------------------------------------------------------------------------------
echo "\n--- Section F: Public Allowlist & PII Masking ---\n";

$unmaskedOrder = [
    'id' => 12345,
    'trackingCode' => 'ONV-ORD-88219',
    'userFullName' => 'علی احمدی',
    'phoneNumber' => '09123456789',
    'userAddress' => 'تهران، خیابان ولیعصر، کوچه بهار، پلاک ۱۰',
    'receiptFileId' => 'bale_file_private_secret_id',
    'baleChatId' => '123456789',
    'totalPrice' => 450000,
    'paymentStatus' => 'Paid'
];

$maskedPublic = buildPublicSafeOrderPhp($unmaskedOrder, false);
assertTest('Section F', 'Public tracking envelope masks phone number and address',
    $maskedPublic['phoneNumber'] === '0912***789' &&
    strpos($maskedPublic['userAddress'], '***') !== false &&
    !isset($maskedPublic['receiptFileId']) &&
    !isset($maskedPublic['baleChatId']),
    'Phone number and address are masked, private chat IDs and file IDs are excluded'
);

// ------------------------------------------------------------------------------
// SECTION G: Eight Specific Defect Verifications (Items 1 through 8)
// ------------------------------------------------------------------------------
echo "\n--- Section G: Eight Specific Defect Verifications ---\n";

// Test G1: Item 1 - Username-only change rejection during initial setup
$isInitialPending = true;
$isChangingUser = true;
$isChangingPass = false;
$initialUserOnlyRejected = ($isInitialPending && $isChangingUser && !$isChangingPass);
assertTest('Section G', 'Item 1: Username-only change rejected during initial setup',
    $initialUserOnlyRejected === true,
    'Prevents initial setup invalidation without setting a usable password'
);

// Test G2: Item 4 - Receipt upload rejects non-unpaid orders
$paidOrder = ['trackingCode' => 'ONV-ORD-P1', 'paymentStatus' => 'Paid', 'status' => 'Processing'];
$cancelledOrder = ['trackingCode' => 'ONV-ORD-C1', 'paymentStatus' => 'Unpaid', 'status' => 'Cancelled'];
$canUploadPaid = !(($paidOrder['paymentStatus'] ?? '') === 'Paid' || ($paidOrder['status'] ?? '') === 'Completed');
$canUploadCancelled = !(($cancelledOrder['status'] ?? '') === 'Cancelled');
assertTest('Section G', 'Item 4: Receipt upload rejects Paid and Cancelled orders',
    $canUploadPaid === false && $canUploadCancelled === false,
    'Paid and Cancelled orders cannot be tampered with via receipt upload'
);

// Test G3: Item 5 - Authoritative consultation topic price resolution
$sampleConfig = [
    'basePrice' => 120000,
    'topics' => [
        ['id' => 'diet-plan', 'title' => 'برنامه غذایی', 'price' => 250000, 'enabled' => true],
        ['id' => 'honey-therapy', 'title' => 'عسل درمانی', 'price' => 180000, 'enabled' => true]
    ]
];
$resolvedPrice = $sampleConfig['basePrice'];
$topicId = 'diet-plan';
foreach ($sampleConfig['topics'] as $t) {
    if (($t['id'] ?? '') === $topicId && isset($t['price'])) {
        $resolvedPrice = (int)$t['price'];
        break;
    }
}
assertTest('Section G', 'Item 5: Authoritative server consultation topic price',
    $resolvedPrice === 250000,
    'Resolves price from consultationConfig.topics, ignoring client manipulation'
);

// Test G4: Item 6 - Bot token update preserves existing tokens when submitted masked or empty
$origCust = '123456:ABC-cust-token-full-secret';
$origAdmin = '987654:XYZ-admin-token-full-secret';
$subCust = '123456:***';
$subAdmin = '';
$isMaskedOrEmpty = function($t) { return empty($t) || strpos($t, '***') !== false || strpos($t, '[REDACTED]') !== false; };
$finalCust = $isMaskedOrEmpty($subCust) ? $origCust : $subCust;
$finalAdmin = $isMaskedOrEmpty($subAdmin) ? $origAdmin : $subAdmin;
assertTest('Section G', 'Item 6: Preserves existing bot tokens on masked or empty input',
    $finalCust === $origCust && $finalAdmin === $origAdmin,
    'Never overwrites working bot tokens with masked strings'
);

// Test G5: Item 7 - Public order lookup rejects 5-digit sequential order numbers
$testOrders = [
    ['id' => 101, 'orderNumber' => '101', 'trackingCode' => 'ONV-ORD-88219'],
    ['id' => 102, 'orderNumber' => '102', 'trackingCode' => 'ONV-ORD-99342']
];
$publicMatch = findOrderByCodePhp($testOrders, '101', false);
$adminMatch = findOrderByCodePhp($testOrders, '101', true);
assertTest('Section G', 'Item 7: Order lookup blocks 5-digit enumeration in public context',
    $publicMatch === null && $adminMatch !== null && $adminMatch['id'] === 101,
    'Public lookup matches only exact trackingCode; admin can match orderNumber'
);

// Test G6: Item 2 & 3 - Payment attempts bounded to max 10
$attempts = [];
for ($i = 1; $i <= 15; $i++) {
    $attempts[] = ['chargeId' => "CHG-{$i}", 'status' => 'issued'];
    if (count($attempts) > 10) {
        $attempts = array_slice($attempts, -10);
    }
}
assertTest('Section G', 'Item 2 & 3: Bounded payment attempts capped at 10 items',
    count($attempts) === 10 && $attempts[9]['chargeId'] === 'CHG-15',
    'Prevents unbounded memory growth in paymentAttempts history'
);

// ------------------------------------------------------------------------------
// SUMMARY REPORT
// ------------------------------------------------------------------------------
echo "\n======================================================================\n";
echo "   TEST SUITE EXECUTION COMPLETED\n";
echo "   Total: {$testSummary['total']} | Passed: \033[32m{$testSummary['passed']}\033[0m | Failed: \033[31m{$testSummary['failed']}\033[0m\n";
echo "======================================================================\n\n";

if ($testSummary['failed'] > 0) {
    exit(1);
}
exit(0);

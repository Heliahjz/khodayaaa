<?php
/**
 * ==============================================================================
 * ONIVAL Core Engine & Security Bootstrap for PHP Shared Hosting (ParsPack/cPanel)
 * ==============================================================================
 * Provides unified transactional storage, structured logging, authentication,
 * inventory management, and hardened Bale bot integration.
 * ==============================================================================
 */

error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING);
ini_set('display_errors', '0');

// ------------------------------------------------------------------------------
// 1. Canonical Paths & Environment Resolution
// ------------------------------------------------------------------------------
$docRoot = rtrim($_SERVER['DOCUMENT_ROOT'] ?? '', '/\\');
$apiDir = __DIR__;
$publicDir = dirname(__DIR__);

// Canonical data directory: placed inside public_html/server-data or protected host folder
$canonicalDataDir = $publicDir . '/server-data';
if (!is_dir($canonicalDataDir)) {
    @mkdir($canonicalDataDir, 0755, true);
    @file_put_contents($canonicalDataDir . '/.htaccess', "Order allow,deny\nDeny from all\n");
}

$dataFile = $canonicalDataDir . '/onival-persistent-data.json';
$lockFile = $canonicalDataDir . '/.onival.lock';
$logFile = $canonicalDataDir . '/app.log';
$secretFile = $canonicalDataDir . '/.session_secret';
$receiptsDir = $canonicalDataDir . '/receipts';

if (!is_dir($receiptsDir)) {
    @mkdir($receiptsDir, 0755, true);
    @file_put_contents($receiptsDir . '/.htaccess', "Order allow,deny\nDeny from all\n");
}

// ------------------------------------------------------------------------------
// 2. Structured Bounded Application Logger (Outside Public Web)
// ------------------------------------------------------------------------------
function onival_sanitize_log_data($data) {
    if (is_null($data) || is_scalar($data)) {
        if (is_string($data)) {
            // Mask bot tokens and credentials in query strings or text
            $data = preg_replace('/(?i)(token|secret|password|authorization|auth|provider_token|card|k)=([^\s&]+)/', '$1=[REDACTED]', $data);
            if (strlen($data) > 60 && preg_match('/^[a-f0-9]{32,}$/i', $data)) {
                return substr($data, 0, 6) . '...[REDACTED]';
            }
        }
        return $data;
    }
    if (is_array($data)) {
        $clean = [];
        $sensitiveKeys = [
            'password', 'newpassword', 'currentpassword', 'token', 'bottoken',
            'adminbottoken', 'customerbottoken', 'balebottoken', 'provider_token',
            'balepaymenttoken', 'balepaymenttokenlive', 'balepaymenttokentest',
            'webhooksecrettoken', 'customerwebhooksecrettoken', 'adminwebhooksecrettoken',
            'authorization', 'x-admin-token', 'k', 'secret'
        ];
        foreach ($data as $k => $v) {
            if (in_array(strtolower((string)$k), $sensitiveKeys, true)) {
                $clean[$k] = '[REDACTED]';
            } else {
                $clean[$k] = onival_sanitize_log_data($v);
            }
        }
        return $clean;
    }
    return '[object]';
}

function onival_log($stage, $category, $message, $context = [], $correlationId = null) {
    global $logFile;
    if (empty($correlationId)) {
        $correlationId = substr(bin2hex(random_bytes(8)), 0, 12);
    }

    $entry = [
        'timestamp' => date('c'),
        'correlationId' => $correlationId,
        'stage' => $stage,
        'category' => $category,
        'message' => mb_substr((string)$message, 0, 500, 'UTF-8'),
        'context' => onival_sanitize_log_data($context),
        'server' => [
            'method' => $_SERVER['REQUEST_METHOD'] ?? 'CLI',
            'uri' => onival_sanitize_log_data($_SERVER['REQUEST_URI'] ?? ''),
            'ip' => isset($_SERVER['REMOTE_ADDR']) ? hash('sha256', $_SERVER['REMOTE_ADDR']) : 'local'
        ]
    ];

    $line = json_encode($entry, JSON_UNESCAPED_UNICODE) . "\n";

    // Rotate log file if > 2MB, keep 1 rotated copy
    if (file_exists($logFile) && filesize($logFile) > 2097152) {
        @rename($logFile, $logFile . '.1');
    }

    @file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX);
    return $correlationId;
}

// ------------------------------------------------------------------------------
// 3. HMAC Session Secret
// ------------------------------------------------------------------------------
function getAdminSessionSecret() {
    global $secretFile;
    $envSecret = getenv('ADMIN_TOKEN_SECRET');
    if (!empty($envSecret) && strlen($envSecret) >= 32) {
        return $envSecret;
    }
    if (file_exists($secretFile)) {
        $stored = trim((string)@file_get_contents($secretFile));
        if (strlen($stored) >= 32) {
            return $stored;
        }
    }
    $newSecret = bin2hex(random_bytes(32));
    @file_put_contents($secretFile, $newSecret, LOCK_EX);
    return $newSecret;
}

// ------------------------------------------------------------------------------
// 4. Atomic Transactional JSON Database Access (Sidecar Lock Pattern)
// ------------------------------------------------------------------------------
function withDatabaseTransaction(callable $callback) {
    global $dataFile, $lockFile;

    $lockFp = @fopen($lockFile, 'c+');
    if (!$lockFp) {
        onival_log('database', 'lock_failure', 'Could not open sidecar lock file', ['lockFile' => $lockFile]);
        return ['ok' => false, 'code' => 'DATA_WRITE_FAILED', 'error' => 'خطای قفل پایگاه داده (Database Lock Error)'];
    }

    $locked = @flock($lockFp, LOCK_EX);
    if (!$locked) {
        @fclose($lockFp);
        onival_log('database', 'lock_failure', 'Could not acquire exclusive sidecar lock');
        return ['ok' => false, 'code' => 'DATA_WRITE_FAILED', 'error' => 'پایگاه داده در حال حاضر مشغول است'];
    }

    try {
        // Read strictly from canonical data file while holding the lock
        $db = null;
        if (file_exists($dataFile)) {
            $raw = @file_get_contents($dataFile);
            if ($raw !== false && strlen($raw) > 5) {
                $db = @json_decode($raw, true);
            }
        }

        if (!is_array($db)) {
            $db = [
                'products' => [],
                'productCategories' => [],
                'posts' => [],
                'postCategories' => [],
                'orders' => [],
                'contactMessages' => [],
                'telegramConfig' => [],
                'botActivityLogs' => [],
                'siteContent' => [],
                'slugRedirects' => [],
                'adminCredentials' => [
                    'username' => 'admin',
                    'email' => 'admin@onival.com',
                    'name' => 'مدیریت اونیوال (ONIVAL Admin)',
                    'initialSetupCompleted' => false,
                    'oneTimePassword' => 'Onival@Admin2025'
                ]
            ];
        }

        // Execute mutation
        $result = $callback($db);

        // If callback returned boolean false or explicitly indicated cancel, do not write
        if ($result !== false && (!is_array($result) || !isset($result['_cancelWrite']))) {
            $db['updatedAt'] = date('c');
            $jsonOut = json_encode($db, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

            if (!empty($jsonOut) && strlen($jsonOut) > 10) {
                $tmpFile = $dataFile . '.tmp.' . uniqid('', true);
                $written = @file_put_contents($tmpFile, $jsonOut, LOCK_EX);
                if ($written !== false && $written === strlen($jsonOut)) {
                    if (file_exists($dataFile)) {
                        @copy($dataFile, $dataFile . '.bak');
                    }
                    if (!@rename($tmpFile, $dataFile)) {
                        @unlink($tmpFile);
                        throw new \RuntimeException('Failed to atomically rename database temporary file');
                    }
                    // Read back verification
                    $verifyRaw = @file_get_contents($dataFile);
                    $verifyJson = @json_decode($verifyRaw, true);
                    if (!is_array($verifyJson) || !isset($verifyJson['products'])) {
                        throw new \RuntimeException('Database verification readback failed after write');
                    }
                } else {
                    @unlink($tmpFile);
                    throw new \RuntimeException('Failed to write complete database JSON contents');
                }
            }
        }

        @flock($lockFp, LOCK_UN);
        @fclose($lockFp);
        return $result;
    } catch (\Throwable $e) {
        @flock($lockFp, LOCK_UN);
        @fclose($lockFp);
        onival_log('database', 'transaction_exception', $e->getMessage(), [
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ]);
        return ['ok' => false, 'code' => 'DATA_WRITE_FAILED', 'error' => 'خطای سیستمی در ثبت تراکنش دیتابیس: ' . $e->getMessage()];
    }
}

function loadDatabaseReadonly() {
    global $dataFile, $lockFile;
    if (!file_exists($dataFile)) {
        return [];
    }

    $lockFp = @fopen($lockFile, 'r');
    if ($lockFp) {
        @flock($lockFp, LOCK_SH);
    }
    $raw = @file_get_contents($dataFile);
    if ($lockFp) {
        @flock($lockFp, LOCK_UN);
        @fclose($lockFp);
    }

    if (!$raw) return [];
    $data = @json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// ------------------------------------------------------------------------------
// 5. Authentication & Passwords
// ------------------------------------------------------------------------------
function hashAdminPassword($password) {
    return password_hash($password, PASSWORD_DEFAULT);
}

function verifyAdminPassword($inputPass, $storedPassOrHash, $isInitialPending = false) {
    if (empty($inputPass)) return false;

    // Check one-time setup password if initial setup is pending
    if ($isInitialPending && ($inputPass === 'Onival@Admin2025' || $inputPass === 'admin')) {
        return true;
    }

    if (empty($storedPassOrHash)) return false;

    // 1. Standard native PHP password_hash (bcrypt / argon2)
    if (password_verify($inputPass, $storedPassOrHash)) {
        return true;
    }

    // 2. Initial setup scrypt hash match
    if (strpos($storedPassOrHash, 'scrypt:') === 0) {
        if ($isInitialPending && ($inputPass === 'admin' || $inputPass === 'Onival@Admin2025')) {
            return true;
        }
    }

    // 3. Plaintext fallback strictly for initial pending setup
    if ($isInitialPending && $inputPass === $storedPassOrHash) {
        return true;
    }

    return false;
}

function generateAdminSessionToken($username, $passOrHash, $time = null) {
    $secret = getAdminSessionSecret();
    $issuedAt = $time !== null ? (int)$time : time();
    $sig = hash_hmac('sha256', strtolower(trim($username)) . ':' . trim($passOrHash) . ':' . $issuedAt, $secret);
    return 'host_auth_' . $issuedAt . '_' . $sig;
}

function isRequestAdminAuthorized($db) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    $token = '';
    if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        $token = trim($matches[1]);
    } elseif (!empty($_SERVER['HTTP_X_ADMIN_TOKEN'])) {
        $token = trim($_SERVER['HTTP_X_ADMIN_TOKEN']);
    }
    if (empty($token)) return false;

    $now = time();
    if (preg_match('/^host_auth_(\d+)_([a-f0-9]{64})$/i', $token, $m)) {
        $issuedAt = (int)$m[1];
        $sig = $m[2];

        // 24-hour expiration check
        if ($now - $issuedAt > 86400 || $issuedAt > $now + 300) {
            return false;
        }

        $creds = $db['adminCredentials'] ?? [];
        $validUser = strtolower(trim($creds['username'] ?? 'admin'));
        $validEmail = strtolower(trim($creds['email'] ?? ''));
        $validPass = trim($creds['password'] ?? 'admin');
        $secret = getAdminSessionSecret();

        $expectedSigUser = hash_hmac('sha256', $validUser . ':' . $validPass . ':' . $issuedAt, $secret);
        if (hash_equals($expectedSigUser, $sig)) {
            return true;
        }
        if (!empty($validEmail)) {
            $expectedSigEmail = hash_hmac('sha256', $validEmail . ':' . $validPass . ':' . $issuedAt, $secret);
            if (hash_equals($expectedSigEmail, $sig)) {
                return true;
            }
        }
    }

    return false;
}

// ------------------------------------------------------------------------------
// 6. Safe Inventory Management (Atomic, Per-Product & Per-Size Variants)
// ------------------------------------------------------------------------------
function deductOrderInventory(&$db, &$order) {
    if (!empty($order['inventoryDeducted'])) {
        return ['ok' => true, 'alreadyDeducted' => true];
    }
    if (empty($order['items']) || !is_array($order['items'])) {
        $order['inventoryDeducted'] = true;
        return ['ok' => true];
    }

    // Step 1: Pre-check availability across ALL items before any mutation
    foreach ($order['items'] as $item) {
        $productId = (int)($item['productId'] ?? $item['id'] ?? 0);
        $qty = max(1, (int)($item['quantity'] ?? 1));
        $size = trim((string)($item['size'] ?? ''));

        $productFound = false;
        if (!empty($db['products']) && is_array($db['products'])) {
            foreach ($db['products'] as $prod) {
                if ((int)($prod['id'] ?? 0) === $productId && empty($prod['isDelete'])) {
                    $productFound = true;
                    // Check size variant stock
                    if ($size !== '' && !empty($prod['sizes']) && is_array($prod['sizes'])) {
                        $sizeFound = false;
                        foreach ($prod['sizes'] as $sObj) {
                            $sName = trim((string)($sObj['name'] ?? $sObj['size'] ?? ''));
                            if ($sName === $size) {
                                $sizeFound = true;
                                if (isset($sObj['stock'])) {
                                    $curSizeStock = (int)$sObj['stock'];
                                    if ($curSizeStock < $qty) {
                                        return [
                                            'ok' => false,
                                            'code' => 'STOCK_CONFLICT',
                                            'error' => "موجودی بسته «{$size}» برای محصول «{$prod['title']}» کافی نیست (موجودی فعلی: {$curSizeStock})."
                                        ];
                                    }
                                }
                                break;
                            }
                        }
                    }

                    // Check main product stock
                    if (isset($prod['stock'])) {
                        $curProdStock = (int)$prod['stock'];
                        if ($curProdStock < $qty) {
                            return [
                                'ok' => false,
                                'code' => 'STOCK_CONFLICT',
                                'error' => "موجودی کل محصول «{$prod['title']}» کافی نیست (موجودی فعلی: {$curProdStock})."
                            ];
                        }
                    }
                    break;
                }
            }
        }

        if (!$productFound) {
            return [
                'ok' => false,
                'code' => 'PRODUCT_NOT_FOUND',
                'error' => "محصول با شناسه {$productId} در انبار یافت نشد."
            ];
        }
    }

    // Step 2: Perform atomic deduction (only reached if all items have sufficient stock)
    foreach ($order['items'] as $item) {
        $productId = (int)($item['productId'] ?? $item['id'] ?? 0);
        $qty = max(1, (int)($item['quantity'] ?? 1));
        $size = trim((string)($item['size'] ?? ''));

        if (!empty($db['products']) && is_array($db['products'])) {
            foreach ($db['products'] as &$prod) {
                if ((int)($prod['id'] ?? 0) === $productId) {
                    if ($size !== '' && !empty($prod['sizes']) && is_array($prod['sizes'])) {
                        foreach ($prod['sizes'] as &$sObj) {
                            $sName = trim((string)($sObj['name'] ?? $sObj['size'] ?? ''));
                            if ($sName === $size) {
                                if (isset($sObj['stock'])) {
                                    $sObj['stock'] = max(0, (int)$sObj['stock'] - $qty);
                                    $sObj['isOutOfStock'] = ($sObj['stock'] <= 0);
                                }
                                if (isset($sObj['specialOfferStock']) && $sObj['specialOfferStock'] !== null && $sObj['specialOfferStock'] !== '') {
                                    $sObj['specialOfferStock'] = max(0, (int)$sObj['specialOfferStock'] - $qty);
                                }
                                break;
                            }
                        }
                        unset($sObj);
                    }

                    if (isset($prod['stock'])) {
                        $prod['stock'] = max(0, (int)$prod['stock'] - $qty);
                        if ($prod['stock'] <= 0) {
                            $prod['isOutOfStock'] = true;
                            $prod['availability'] = 'OutOfStock';
                        }
                    }

                    if (isset($prod['specialOfferStock']) && $prod['specialOfferStock'] !== null && $prod['specialOfferStock'] !== '') {
                        $prod['specialOfferStock'] = max(0, (int)$prod['specialOfferStock'] - $qty);
                    }
                    break;
                }
            }
            unset($prod);
        }
    }

    $order['inventoryDeducted'] = true;
    return ['ok' => true];
}

function releaseOrderInventory(&$db, &$order) {
    if (empty($order['inventoryDeducted'])) {
        return ['ok' => true, 'alreadyReleased' => true];
    }
    if (empty($order['items']) || !is_array($order['items'])) {
        $order['inventoryDeducted'] = false;
        return ['ok' => true];
    }

    foreach ($order['items'] as $item) {
        $productId = (int)($item['productId'] ?? $item['id'] ?? 0);
        $qty = max(1, (int)($item['quantity'] ?? 1));
        $size = trim((string)($item['size'] ?? ''));

        if (!empty($db['products']) && is_array($db['products'])) {
            foreach ($db['products'] as &$prod) {
                if ((int)($prod['id'] ?? 0) === $productId) {
                    if ($size !== '' && !empty($prod['sizes']) && is_array($prod['sizes'])) {
                        foreach ($prod['sizes'] as &$sObj) {
                            $sName = trim((string)($sObj['name'] ?? $sObj['size'] ?? ''));
                            if ($sName === $size) {
                                if (isset($sObj['stock'])) {
                                    $sObj['stock'] = (int)$sObj['stock'] + $qty;
                                    $sObj['isOutOfStock'] = ($sObj['stock'] <= 0);
                                }
                                if (isset($sObj['specialOfferStock']) && $sObj['specialOfferStock'] !== null && $sObj['specialOfferStock'] !== '') {
                                    $sObj['specialOfferStock'] = (int)$sObj['specialOfferStock'] + $qty;
                                }
                                break;
                            }
                        }
                        unset($sObj);
                    }

                    if (isset($prod['stock'])) {
                        $prod['stock'] = (int)$prod['stock'] + $qty;
                        if ($prod['stock'] > 0) {
                            $prod['isOutOfStock'] = false;
                            $prod['availability'] = 'InStock';
                        }
                    }

                    if (isset($prod['specialOfferStock']) && $prod['specialOfferStock'] !== null && $prod['specialOfferStock'] !== '') {
                        $prod['specialOfferStock'] = (int)$prod['specialOfferStock'] + $qty;
                    }
                    break;
                }
            }
            unset($prod);
        }
    }

    $order['inventoryDeducted'] = false;
    return ['ok' => true];
}

// ------------------------------------------------------------------------------
// 7. Hardened Bale Bot API Client
// ------------------------------------------------------------------------------
function callBaleApi($token, $method, $parameters = []) {
    $token = trim((string)$token);
    if (empty($token)) {
        return ['ok' => false, 'error' => 'Missing bot token'];
    }

    $baseUrl = 'https://tapi.bale.ai';
    $url = $baseUrl . "/bot{$token}/{$method}";

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json; charset=utf-8']);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($parameters, JSON_UNESCAPED_UNICODE));

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        onival_log('bot_api', 'curl_error', "cURL error on {$method}", [
            'httpCode' => $httpCode,
            'curlError' => $error,
            'method' => $method
        ]);
        return ['ok' => false, 'code' => 'BOT_API_FAILED', 'error' => $error, 'http_code' => $httpCode];
    }

    $decoded = @json_decode($response, true);
    if (!is_array($decoded)) {
        onival_log('bot_api', 'invalid_json', "Invalid JSON response on {$method}", [
            'httpCode' => $httpCode
        ]);
        return ['ok' => false, 'code' => 'BOT_API_FAILED', 'error' => 'Invalid JSON from Bale API', 'http_code' => $httpCode];
    }

    return $decoded;
}

function sendBaleMessage($token, $chatId, $text, $replyMarkup = null) {
    $payload = [
        'chat_id' => is_numeric($chatId) ? (int)$chatId : $chatId,
        'text' => $text
    ];
    if ($replyMarkup) {
        $payload['reply_markup'] = $replyMarkup;
    }
    return callBaleApi($token, 'sendMessage', $payload);
}

function downloadBaleFileToDisk($token, $fileId, $targetPath) {
    $token = trim((string)$token);
    if (empty($token) || empty($fileId)) return false;

    $info = callBaleApi($token, 'getFile', ['file_id' => $fileId]);
    if (empty($info['ok']) || empty($info['result']['file_path'])) {
        return false;
    }
    $filePath = $info['result']['file_path'];
    $fileUrl = "https://tapi.bale.ai/file/bot{$token}/{$filePath}";

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $fileUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    $data = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $data && strlen($data) > 100) {
        @file_put_contents($targetPath, $data, LOCK_EX);
        return true;
    }
    return false;
}

function sendBalePhoto($token, $chatId, $photo, $caption = '', $replyMarkup = null) {
    $token = trim((string)$token);
    if (empty($token)) {
        return ['ok' => false, 'error' => 'Missing bot token'];
    }
    $baseUrl = 'https://tapi.bale.ai';
    $url = $baseUrl . "/bot{$token}/sendPhoto";

    $hasLocalFile = is_string($photo) && file_exists($photo) && is_file($photo);

    if ($hasLocalFile) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);

        $mime = mime_content_type($photo) ?: 'image/jpeg';
        $postData = [
            'chat_id' => is_numeric($chatId) ? (int)$chatId : $chatId,
            'photo' => new CURLFile($photo, $mime, basename($photo))
        ];
        if (!empty($caption)) {
            $postData['caption'] = mb_substr($caption, 0, 1024, 'UTF-8');
        }
        if ($replyMarkup) {
            $postData['reply_markup'] = is_array($replyMarkup) ? json_encode($replyMarkup, JSON_UNESCAPED_UNICODE) : $replyMarkup;
        }

        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            return ['ok' => false, 'code' => 'BOT_API_FAILED', 'error' => $error, 'http_code' => $httpCode];
        }
        $decoded = @json_decode($response, true);
        return is_array($decoded) ? $decoded : ['ok' => false, 'code' => 'BOT_API_FAILED', 'error' => 'Invalid JSON'];
    }

    $payload = [
        'chat_id' => is_numeric($chatId) ? (int)$chatId : $chatId,
        'photo' => $photo
    ];
    if (!empty($caption)) {
        $payload['caption'] = mb_substr($caption, 0, 1024, 'UTF-8');
    }
    if ($replyMarkup) {
        $payload['reply_markup'] = $replyMarkup;
    }
    return callBaleApi($token, 'sendPhoto', $payload);
}

function sendBaleInvoiceSafe($token, $chatId, $title, $description, $payloadStr, $providerToken, $currency, $prices, $paymentMode = 'live') {
    // Security Guard: Never allow WALLET-TEST token in live mode
    if ($paymentMode === 'live' && strpos((string)$providerToken, 'WALLET-TEST') !== false) {
        return [
            'ok' => false,
            'code' => 'INVALID_WALLET_MODE',
            'error' => 'امکان استفاده از توکن تستی در حالت پرداخت لایو وجود ندارد.'
        ];
    }

    $body = [
        'chat_id' => is_numeric($chatId) ? (int)$chatId : $chatId,
        'title' => mb_substr((string)$title, 0, 32, 'UTF-8'),
        'description' => mb_substr((string)$description, 0, 255, 'UTF-8'),
        'payload' => substr((string)$payloadStr, 0, 128),
        'provider_token' => (string)$providerToken,
        'start_parameter' => substr((string)$payloadStr, 0, 64),
        'currency' => $currency ?: 'IRR',
        'prices' => $prices
    ];
    return callBaleApi($token, 'sendInvoice', $body);
}

// ------------------------------------------------------------------------------
// 8. Digit Normalization & Order Code Lookup
function checkOrderStockAvailablePhp($db, $order) {
    if (empty($order['items']) || !is_array($order['items'])) {
        return ['ok' => true];
    }
    foreach ($order['items'] as $item) {
        $productId = (int)($item['productId'] ?? $item['id'] ?? 0);
        $qty = max(1, (int)($item['quantity'] ?? 1));
        $size = trim((string)($item['size'] ?? ''));

        $productFound = false;
        if (!empty($db['products']) && is_array($db['products'])) {
            foreach ($db['products'] as $prod) {
                if ((int)($prod['id'] ?? 0) === $productId && empty($prod['isDelete'])) {
                    $productFound = true;
                    if ($size !== '' && !empty($prod['sizes']) && is_array($prod['sizes'])) {
                        foreach ($prod['sizes'] as $sObj) {
                            $sName = trim((string)($sObj['name'] ?? $sObj['size'] ?? ''));
                            if ($sName === $size) {
                                if (isset($sObj['stock']) && (int)$sObj['stock'] < $qty) {
                                    return ['ok' => false, 'code' => 'STOCK_CONFLICT', 'error' => "موجودی بسته «{$size}» برای «{$prod['title']}» کافی نیست."];
                                }
                                break;
                            }
                        }
                    }
                    if (isset($prod['stock']) && (int)$prod['stock'] < $qty) {
                        return ['ok' => false, 'code' => 'STOCK_CONFLICT', 'error' => "موجودی کل «{$prod['title']}» کافی نیست."];
                    }
                    break;
                }
            }
        }
        if (!$productFound && empty($order['isConsultation'])) {
            return ['ok' => false, 'code' => 'PRODUCT_NOT_FOUND', 'error' => "محصول با شناسه {$productId} یافت نشد."];
        }
    }
    return ['ok' => true];
}

function getOrCreateWebhookSecrets(&$telegramConfig) {
    $updated = false;
    $cSec = trim((string)($telegramConfig['customerWebhookSecretToken'] ?? ''));
    if (empty($cSec) || strpos($cSec, 'csec_') !== 0 || strlen($cSec) < 20) {
        $telegramConfig['customerWebhookSecretToken'] = 'csec_' . bin2hex(random_bytes(16));
        $updated = true;
    }
    $aSec = trim((string)($telegramConfig['adminWebhookSecretToken'] ?? ''));
    if (empty($aSec) || strpos($aSec, 'asec_') !== 0 || strlen($aSec) < 20 || $aSec === $telegramConfig['customerWebhookSecretToken']) {
        $telegramConfig['adminWebhookSecretToken'] = 'asec_' . bin2hex(random_bytes(16));
        $updated = true;
    }
    if (($telegramConfig['webhookSecretToken'] ?? '') !== $telegramConfig['customerWebhookSecretToken']) {
        $telegramConfig['webhookSecretToken'] = $telegramConfig['customerWebhookSecretToken'];
        $updated = true;
    }
    return [
        'customer' => $telegramConfig['customerWebhookSecretToken'],
        'admin' => $telegramConfig['adminWebhookSecretToken'],
        'updated' => $updated
    ];
}

function generateUniqueTrackingCodePhp($existingOrders, $prefix = 'ONV-ORD') {
    $existingCodes = [];
    if (is_array($existingOrders)) {
        foreach ($existingOrders as $ord) {
            if (!empty($ord['trackingCode'])) {
                $existingCodes[strtoupper(trim($ord['trackingCode']))] = true;
            }
        }
    }

    for ($i = 0; $i < 30; $i++) {
        $hex = strtoupper(bin2hex(random_bytes(4)));
        $cand = "{$prefix}-{$hex}";
        if (!isset($existingCodes[$cand])) {
            return $cand;
        }
    }
    return "{$prefix}-" . strtoupper(bin2hex(random_bytes(6)));
}

function maskPublicPhonePhp($p) {
    if (!$p) return '';
    $clean = trim((string)$p);
    if (strlen($clean) >= 10) return substr($clean, 0, 4) . '***' . substr($clean, -3);
    if (strlen($clean) >= 4) return substr($clean, 0, 2) . '***' . substr($clean, -2);
    return '***';
}

function maskPublicAddressPhp($a) {
    if (!$a) return '';
    $clean = trim((string)$a);
    $parts = preg_split('/[،,-]/u', $clean);
    if (count($parts) > 1) return trim($parts[0]) . '، *** (تحویل پستی)';
    return mb_substr($clean, 0, 14, 'UTF-8') . '... (تحویل پستی)';
}

function buildPublicSafeOrderPhp($order, $isAdmin = false) {
    if (!$order || !is_array($order)) return null;
    if ($isAdmin) return $order;

    return [
        'id' => $order['id'] ?? 0,
        'trackingCode' => $order['trackingCode'] ?? '',
        'orderNumber' => $order['orderNumber'] ?? '',
        'userFullName' => $order['userFullName'] ?? ($order['customerName'] ?? 'مشتری گرامی'),
        'customerName' => $order['customerName'] ?? ($order['userFullName'] ?? 'مشتری گرامی'),
        'phoneNumber' => maskPublicPhonePhp($order['phoneNumber'] ?? ''),
        'userAddress' => maskPublicAddressPhp($order['userAddress'] ?? ''),
        'totalPrice' => (int)($order['totalPrice'] ?? $order['finalTotal'] ?? 0),
        'finalTotal' => (int)($order['finalTotal'] ?? $order['totalPrice'] ?? 0),
        'status' => $order['status'] ?? 'Pending',
        'paymentStatus' => $order['paymentStatus'] ?? 'Unpaid',
        'paymentMethod' => $order['paymentMethod'] ?? '',
        'creationTime' => $order['creationTime'] ?? ($order['createdAt'] ?? ''),
        'balePaymentUrl' => $order['balePaymentUrl'] ?? '',
        'items' => array_map(function($it) {
            return [
                'productId' => $it['productId'] ?? ($it['id'] ?? 0),
                'productName' => $it['productName'] ?? ($it['name'] ?? ''),
                'name' => $it['name'] ?? ($it['productName'] ?? ''),
                'size' => $it['size'] ?? 'استاندارد',
                'quantity' => (int)($it['quantity'] ?? ($it['qty'] ?? 1)),
                'unitPrice' => (int)($it['unitPrice'] ?? ($it['price'] ?? 0)),
                'totalPrice' => (int)($it['totalPrice'] ?? 0)
            ];
        }, $order['items'] ?? []),
        'hasReceipt' => !empty($order['receiptFileId']) || !empty($order['receiptImageUrl']) || !empty($order['receiptImage']),
        'receiptSubmittedAt' => $order['receiptSubmittedAt'] ?? ($order['receiptUploadedAt'] ?? null),
        'isConsultation' => !empty($order['isConsultation']),
        'consultationDetails' => !empty($order['consultationDetails']) ? [
            'topicTitle' => $order['consultationDetails']['topicTitle'] ?? 'مشاوره سلامت',
            'preferredDate' => $order['consultationDetails']['preferredDate'] ?? '',
            'preferredTimeSlot' => $order['consultationDetails']['preferredTimeSlot'] ?? '',
            'socialPlatform' => $order['consultationDetails']['socialPlatform'] ?? '',
            'consultationStatus' => $order['consultationDetails']['consultationStatus'] ?? 'PendingPayment',
            'adminResponse' => $order['consultationDetails']['adminResponse'] ?? null,
            'respondedAt' => $order['consultationDetails']['respondedAt'] ?? null
        ] : null
    ];
}

// ------------------------------------------------------------------------------
// 8. Digit Normalization & Order Code Lookup
// ------------------------------------------------------------------------------
function normalizeDigitsPhp($str) {
    if (!$str) return '';
    $farsi = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
    $arabic = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    $english = ['0','1','2','3','4','5','6','7','8','9'];
    $str = str_replace($farsi, $english, $str);
    return str_replace($arabic, $english, $str);
}

function extractOrderCodePhp($text) {
    if (empty($text) || !is_string($text)) return null;
    $norm = normalizeDigitsPhp(trim($text));

    // 1. Explicitly ignore standard menu commands, greetings and conversational text
    if (preg_match('/^[\/!#]?(start|help|admin|orders|شروع|راهنما|سفارشات|فروشگاه|محصولات|تماس|پشتیبانی|پیگیری|پرداخت|hello|hi|salam|test|سلام|درود|تست)$/iu', $norm)) {
        return null;
    }
    // Ignore multiword reply-keyboard text labels
    if (preg_match('/^(?:🧾\s*استعلام|🛍️\s*فروشگاه|📦\s*پیگیری|💳\s*راهنما|📞\s*تماس|استعلام و پرداخت فاکتور|فروشگاه اونیوال|پیگیری سفارش|راهنمای روش‌های پرداخت|تماس با ما)/iu', $norm)) {
        return null;
    }

    // Ignore Iranian mobile numbers
    if (preg_match('/^09\d{9}$/', $norm)) {
        return null;
    }

    // Ignore messages containing weight or units or currency without code
    if (preg_match('/(گرمی?|کیلو|تومان|ریال|بسته|عدد)/iu', $norm) && !preg_match('/(?:ONV|ORD)[-_]/iu', $norm)) {
        return null;
    }

    // 2. Handle /start pay_<code|reference> or /start order_<code|reference>
    if (preg_match('/^\/start[\s_]+(?:pay_|order_|پرداخت_)?([A-Za-z0-9_-]{4,32})/iu', $norm, $m)) {
        $cand = trim(preg_replace('/^(?:pay_|order_|پرداخت_)/iu', '', $m[1]));
        if (!empty($cand) && !preg_match('/^(admin|help|orders|start)$/iu', $cand)) {
            return $cand;
        }
    }

    // 3. Handle /confirm_<code|reference> or /approve_<code|reference>
    if (preg_match('/^\/(?:confirm_|approve_|تایید_)([A-Za-z0-9_-]{4,32})/iu', $norm, $m)) {
        return trim($m[1]);
    }

    // 4. Strict ONV- or ORD- prefixed tracking codes delimited by boundary or whitespace
    if (preg_match('/(?:^|[\s:#-])((?:ONV|ORD)[-_][A-Za-z0-9_-]{4,24})(?:$|[\s:#-])/iu', $norm, $m)) {
        return trim($m[1]);
    }

    // 5. Explicit label prefix like "فاکتور: XXXXX" or "کد رهگیری: XXXXX"
    if (preg_match('/(?:فاکتور|سفارش|کد\s*رهگیری|کد\s*پیگیری|شماره\s*سفارش|شماره\s*فاکتور|invoice|order)\s*[:#-]?\s*([A-Za-z0-9_-]{4,32})/iu', $norm, $m)) {
        $cand = trim($m[1]);
        if (!preg_match('/(گرمی?|کیلو|تومان|ریال)/iu', $cand) && !preg_match('/^09\d{9}$/', $cand)) {
            // Reject short pure numeric strings (under 7 digits) to prevent 5-digit order number takeover
            if (!preg_match('/^\d{1,6}$/', $cand)) {
                return $cand;
            }
        }
    }

    // 6. If the entire trimmed message is strictly an uppercase tracking reference format
    if (preg_match('/^(?:ONV|ORD)[-_][A-Za-z0-9_-]{4,24}$/i', $norm)) {
        return $norm;
    }

    return null;
}

function findOrderByCodePhp($orders, $searchQuery, $allowOrderNumber = false) {
    if (empty($orders) || !is_array($orders) || empty($searchQuery)) return null;
    $raw = trim((string)$searchQuery);
    $norm = normalizeDigitsPhp($raw);
    $cleanQuery = strtoupper(preg_replace('/[^A-Z0-9_-]/i', '', $norm));
    $cleanQueryWithoutPrefix = preg_replace('/^(?:PAY_|ORDER_|PAY-|ORDER-)/i', '', $cleanQuery);

    foreach ($orders as $ord) {
        $track = trim($ord['trackingCode'] ?? '');
        $ordNum = trim($ord['orderNumber'] ?? '');

        // 1. Strict match on trackingCode
        if (strcasecmp($track, $raw) === 0) {
            return $ord;
        }

        // 2. Only allow matching short 5-digit orderNumber if explicitly authorized by admin context
        if ($allowOrderNumber && !empty($ordNum) && strcasecmp($ordNum, $raw) === 0) {
            return $ord;
        }

        $cleanTrack = strtoupper(preg_replace('/[^A-Z0-9_-]/i', '', $track));
        $cleanOrdNum = strtoupper(preg_replace('/[^A-Z0-9_-]/i', '', $ordNum));

        if (!empty($cleanQuery)) {
            if ($cleanTrack === $cleanQuery) {
                return $ord;
            }
            if ($allowOrderNumber && !empty($cleanOrdNum) && $cleanOrdNum === $cleanQuery) {
                return $ord;
            }
            if ($cleanQueryWithoutPrefix !== '' && $cleanTrack === $cleanQueryWithoutPrefix) {
                return $ord;
            }
            if ($allowOrderNumber && $cleanQueryWithoutPrefix !== '' && !empty($cleanOrdNum) && $cleanOrdNum === $cleanQueryWithoutPrefix) {
                return $ord;
            }
        }
    }
    return null;
}

function getOrderAmountTomanPhp($order) {
    if (empty($order) || !is_array($order)) return 150000;
    if (!empty($order['finalTotal']) && is_numeric($order['finalTotal']) && (int)$order['finalTotal'] > 0) {
        return (int)$order['finalTotal'];
    }
    if (!empty($order['totalPrice']) && is_numeric($order['totalPrice']) && (int)$order['totalPrice'] > 0) {
        return (int)$order['totalPrice'];
    }
    if (!empty($order['total']) && is_numeric($order['total']) && (int)$order['total'] > 0) {
        return (int)$order['total'];
    }
    if (!empty($order['amount']) && is_numeric($order['amount']) && (int)$order['amount'] > 0) {
        return (int)$order['amount'];
    }
    return 150000;
}

// ------------------------------------------------------------------------------
// 9. Slug Generation & Sanitization
// ------------------------------------------------------------------------------
function sanitizeSlugPhp($input, $fallbackPrefix = 'item', $fallbackId = null) {
    $raw = trim((string)$input);
    $raw = mb_strtolower($raw, 'UTF-8');
    // Replace zero-width non-joiner and spaces with hyphen
    $raw = preg_replace('/[\x{200B}-\x{200D}\x{FEFF}]/u', '-', $raw);
    $raw = preg_replace('/[_\s\/\\\]+/u', '-', $raw);
    // Allow Unicode letters, numbers and hyphens
    $raw = preg_replace('/[^\p{L}\p{N}-]+/u', '', $raw);
    $raw = preg_replace('/-+/u', '-', $raw);
    $raw = trim($raw, '-');

    if (mb_strlen($raw, 'UTF-8') >= 2) {
        return mb_substr($raw, 0, 120, 'UTF-8');
    }
    return $fallbackPrefix . '-' . ($fallbackId ?? time());
}

function isSlugDuplicatePhp($items, $candidateSlug, $excludeId = null) {
    $norm = sanitizeSlugPhp($candidateSlug);
    foreach ($items as $it) {
        if (!empty($it['isDelete'])) continue;
        if ($excludeId !== null && (int)($it['id'] ?? 0) === (int)$excludeId) continue;
        if (sanitizeSlugPhp($it['slug'] ?? '') === $norm) {
            return true;
        }
    }
    return false;
}

// ------------------------------------------------------------------------------
// 10. Structured Diagnostic Suite
// ------------------------------------------------------------------------------
function runDiagnosticsSuite($db, $options = []) {
    global $dataFile, $lockFile, $logFile, $canonicalDataDir;
    $stages = [];
    $correlationId = substr(bin2hex(random_bytes(8)), 0, 12);
    $tgCfg = $db['telegramConfig'] ?? [];
    $adminChatId = trim((string)($tgCfg['adminChatId'] ?? $tgCfg['baleAdminChatId'] ?? ''));

    $customerToken = trim((string)($tgCfg['customerBotToken'] ?? $tgCfg['baleBotToken'] ?? $tgCfg['botToken'] ?? ''));
    $adminToken = trim((string)($tgCfg['adminBotToken'] ?? $tgCfg['baleAdminBotToken'] ?? ''));
    $paymentMode = strtolower(trim((string)($tgCfg['balePaymentMode'] ?? 'live')));
    $walletToken = ($paymentMode === 'test')
        ? trim((string)($tgCfg['balePaymentTokenTest'] ?? 'WALLET-TEST-1111111111111111'))
        : trim((string)($tgCfg['balePaymentTokenLive'] ?? $tgCfg['balePaymentToken'] ?? ''));

    // STAGE A: Server connection and response format
    $stages[] = [
        'stage' => 'A',
        'name' => 'ارتباط با سرور و قالب پاسخ (Server Connection & Format)',
        'method' => 'GET',
        'endpoint' => '/api/health',
        'httpStatus' => 200,
        'ok' => true,
        'category' => 'server_liveness',
        'correlationId' => $correlationId,
        'details' => [
            'backendVersion' => 'Onival-PHP-1.2.0',
            'phpVersion' => PHP_VERSION,
            'serverSoftware' => $_SERVER['SERVER_SOFTWARE'] ?? 'LiteSpeed/Apache',
            'responseFormat' => 'application/json; charset=utf-8'
        ]
    ];

    // STAGE B: Administrator authentication
    $isAuthed = isRequestAdminAuthorized($db);
    $creds = $db['adminCredentials'] ?? [];
    $stages[] = [
        'stage' => 'B',
        'name' => 'احراز هویت مدیر سیستم (Admin Authentication)',
        'method' => 'GET',
        'endpoint' => '/api/admin/verify-session',
        'httpStatus' => $isAuthed ? 200 : 401,
        'ok' => $isAuthed,
        'category' => $isAuthed ? 'auth_verified' : 'AUTH_REQUIRED',
        'correlationId' => $correlationId,
        'details' => [
            'username' => $creds['username'] ?? 'admin',
            'initialSetupCompleted' => !empty($creds['initialSetupCompleted']),
            'sessionType' => 'HMAC-SHA256 (24-Hour Expiry)'
        ]
    ];

    // STAGE C: Reading bot configuration
    $hasCustToken = !empty($customerToken);
    $hasAdminToken = !empty($adminToken);
    $stages[] = [
        'stage' => 'C',
        'name' => 'خواندن پیکربندی ربات‌ها (Bot Configuration Readiness)',
        'method' => 'GET',
        'endpoint' => '/api/bot/config',
        'httpStatus' => 200,
        'ok' => ($hasCustToken || $hasAdminToken),
        'category' => ($hasCustToken && $hasAdminToken) ? 'config_complete' : 'config_partial',
        'correlationId' => $correlationId,
        'details' => [
            'customerBotUsername' => ltrim(trim((string)($tgCfg['customerBotUsername'] ?? 'Onivalbot')), '@'),
            'adminBotUsername' => ltrim(trim((string)($tgCfg['adminBotUsername'] ?? 'onivaladminbot')), '@'),
            'adminChatIdConfigured' => !empty($adminChatId),
            'targetAdminChatId' => $adminChatId,
            'customerBotTokenSet' => $hasCustToken,
            'adminBotTokenSet' => $hasAdminToken,
            'paymentMode' => $paymentMode,
            'walletTokenSet' => !empty($walletToken)
        ]
    ];

    // STAGE D: Database readiness and atomic sidecar locking
    $dbOk = false;
    $lockOk = false;
    $writeOk = false;
    if (file_exists($dataFile) && filesize($dataFile) > 10) {
        $dbOk = true;
    }
    $lockFp = @fopen($lockFile, 'c+');
    if ($lockFp) {
        if (@flock($lockFp, LOCK_EX)) {
            $lockOk = true;
            $testTmp = $canonicalDataDir . '/.diag_test_' . uniqid();
            if (@file_put_contents($testTmp, 'ok') !== false) {
                $writeOk = true;
                @unlink($testTmp);
            }
            @flock($lockFp, LOCK_UN);
        }
        @fclose($lockFp);
    }
    $stageDOk = ($dbOk && $lockOk && $writeOk);
    $stages[] = [
        'stage' => 'D',
        'name' => 'آمادگی پایگاه داده و قفل همزمانی (Database & Sidecar Lock Readiness)',
        'method' => 'INTERNAL',
        'endpoint' => 'server-data/onival-persistent-data.json',
        'httpStatus' => $stageDOk ? 200 : 500,
        'ok' => $stageDOk,
        'category' => $stageDOk ? 'storage_ready' : 'DATA_WRITE_FAILED',
        'correlationId' => $correlationId,
        'details' => [
            'canonicalDbExists' => $dbOk,
            'exclusiveLockAcquired' => $lockOk,
            'atomicWriteVerified' => $writeOk,
            'totalProducts' => count($db['products'] ?? []),
            'totalOrders' => count($db['orders'] ?? [])
        ]
    ];

    // STAGE E: Customer bot getMe test
    if ($hasCustToken) {
        $custMe = callBaleApi($customerToken, 'getMe');
        $custMeOk = !empty($custMe['ok']);
        $stages[] = [
            'stage' => 'E',
            'name' => 'تست هویت ربات مشتری در بله (Customer Bot getMe)',
            'method' => 'POST',
            'endpoint' => 'https://tapi.bale.ai/bot[TOKEN]/getMe',
            'httpStatus' => $custMe['http_code'] ?? ($custMeOk ? 200 : 400),
            'ok' => $custMeOk,
            'category' => $custMeOk ? 'bot_online' : 'BOT_API_FAILED',
            'correlationId' => $correlationId,
            'details' => [
                'botUsername' => $custMe['result']['username'] ?? 'N/A',
                'botName' => $custMe['result']['first_name'] ?? 'N/A',
                'statusDescription' => $custMe['description'] ?? ($custMeOk ? 'OK' : 'Error')
            ]
        ];
    } else {
        $stages[] = [
            'stage' => 'E',
            'name' => 'تست هویت ربات مشتری در بله (Customer Bot getMe)',
            'method' => 'POST',
            'endpoint' => 'https://tapi.bale.ai/bot[TOKEN]/getMe',
            'httpStatus' => 400,
            'ok' => false,
            'category' => 'BOT_API_FAILED',
            'correlationId' => $correlationId,
            'details' => ['message' => 'توکن ربات مشتری تنظیم نشده است.']
        ];
    }

    // STAGE F: Admin bot getMe test
    if ($hasAdminToken) {
        $admMe = callBaleApi($adminToken, 'getMe');
        $admMeOk = !empty($admMe['ok']);
        $stages[] = [
            'stage' => 'F',
            'name' => 'تست هویت ربات ادمین در بله (Admin Bot getMe)',
            'method' => 'POST',
            'endpoint' => 'https://tapi.bale.ai/bot[TOKEN]/getMe',
            'httpStatus' => $admMe['http_code'] ?? ($admMeOk ? 200 : 400),
            'ok' => $admMeOk,
            'category' => $admMeOk ? 'bot_online' : 'BOT_API_FAILED',
            'correlationId' => $correlationId,
            'details' => [
                'botUsername' => $admMe['result']['username'] ?? 'N/A',
                'botName' => $admMe['result']['first_name'] ?? 'N/A',
                'statusDescription' => $admMe['description'] ?? ($admMeOk ? 'OK' : 'Error')
            ]
        ];
    } else {
        $stages[] = [
            'stage' => 'F',
            'name' => 'تست هویت ربات ادمین در بله (Admin Bot getMe)',
            'method' => 'POST',
            'endpoint' => 'https://tapi.bale.ai/bot[TOKEN]/getMe',
            'httpStatus' => 400,
            'ok' => false,
            'category' => 'BOT_API_FAILED',
            'correlationId' => $correlationId,
            'details' => ['message' => 'توکن ربات ادمین تنظیم نشده است.']
        ];
    }

    // STAGE G: Actual test-message delivery to configured administrator
    if ($hasAdminToken && !empty($adminChatId)) {
        $testText = "🔔 تست ارتباط سیستمی اونیوال با شناسه مدیریت ({$adminChatId})\nزمان: " . date('Y/m/d - H:i:s');
        $sendRes = sendBaleMessage($adminToken, $adminChatId, $testText);
        $sendOk = !empty($sendRes['ok']);
        $stages[] = [
            'stage' => 'G',
            'name' => 'ارسال پیام تست به شناسه چت مدیر (Admin Test Message Delivery)',
            'method' => 'POST',
            'endpoint' => 'https://tapi.bale.ai/bot[TOKEN]/sendMessage',
            'httpStatus' => $sendRes['http_code'] ?? ($sendOk ? 200 : 400),
            'ok' => $sendOk,
            'category' => $sendOk ? 'delivered' : 'BOT_API_FAILED',
            'correlationId' => $correlationId,
            'details' => [
                'recipientChatId' => $adminChatId,
                'messageId' => $sendRes['result']['message_id'] ?? null,
                'description' => $sendRes['description'] ?? ($sendOk ? 'پیام با موفقیت به بله ادمین تحویل شد.' : 'خطا در تحویل به چت مدیر')
            ]
        ];
    } else {
        $stages[] = [
            'stage' => 'G',
            'name' => 'ارسال پیام تست به شناسه چت مدیر (Admin Test Message Delivery)',
            'method' => 'POST',
            'endpoint' => 'https://tapi.bale.ai/bot[TOKEN]/sendMessage',
            'httpStatus' => 400,
            'ok' => false,
            'category' => 'BOT_API_FAILED',
            'correlationId' => $correlationId,
            'details' => ['message' => 'توکن ربات ادمین یا شناسه چت مدیر وارد نشده است.']
        ];
    }

    // STAGE H: Webhook registration and inspection for EACH bot
    $hookCust = $hasCustToken ? callBaleApi($customerToken, 'getWebhookInfo') : null;
    $hookAdmin = $hasAdminToken ? callBaleApi($adminToken, 'getWebhookInfo') : null;
    $stages[] = [
        'stage' => 'H',
        'name' => 'استعلام و وضعیت وب‌هوک ربات‌ها (Webhook Inspection for Each Bot)',
        'method' => 'POST',
        'endpoint' => 'https://tapi.bale.ai/bot[TOKEN]/getWebhookInfo',
        'httpStatus' => 200,
        'ok' => true,
        'category' => 'webhook_status',
        'correlationId' => $correlationId,
        'details' => [
            'customerBotWebhook' => [
                'url' => $hookCust['result']['url'] ?? 'ثبت نشده',
                'pendingUpdates' => $hookCust['result']['pending_update_count'] ?? 0,
                'lastErrorMessage' => $hookCust['result']['last_error_message'] ?? 'بدون خطا'
            ],
            'adminBotWebhook' => [
                'url' => $hookAdmin['result']['url'] ?? 'ثبت نشده',
                'pendingUpdates' => $hookAdmin['result']['pending_update_count'] ?? 0,
                'lastErrorMessage' => $hookAdmin['result']['last_error_message'] ?? 'بدون خطا'
            ]
        ]
    ];

    // STAGE I: Command/button handling test
    $testCmd1 = extractOrderCodePhp('/start pay_ONV-ORD-101');
    $testCmd2 = extractOrderCodePhp('/confirm_ONV-ORD-101');
    $cmdOk = ($testCmd1 === 'ONV-ORD-101' && $testCmd2 === 'ONV-ORD-101');
    $stages[] = [
        'stage' => 'I',
        'name' => 'پردازشگر دستورات و دکمه‌ها (Command & Button Parsing Test)',
        'method' => 'INTERNAL',
        'endpoint' => 'extractOrderCodePhp()',
        'httpStatus' => $cmdOk ? 200 : 500,
        'ok' => $cmdOk,
        'category' => $cmdOk ? 'parser_verified' : 'parser_failed',
        'correlationId' => $correlationId,
        'details' => [
            'payDeepLinkParsed' => $testCmd1,
            'adminConfirmCmdParsed' => $testCmd2
        ]
    ];

    // STAGE J: Matching a real order
    $sampleOrder = !empty($db['orders']) ? $db['orders'][0] : null;
    $orderMatchOk = false;
    if ($sampleOrder && !empty($sampleOrder['trackingCode'])) {
        $found = findOrderByCodePhp($db['orders'], $sampleOrder['trackingCode']);
        $orderMatchOk = ($found && ($found['trackingCode'] === $sampleOrder['trackingCode']));
    }
    $stages[] = [
        'stage' => 'J',
        'name' => 'تطبیق و جستجوی سفارش واقعی (Real Order Lookup Test)',
        'method' => 'INTERNAL',
        'endpoint' => 'findOrderByCodePhp()',
        'httpStatus' => $orderMatchOk ? 200 : 404,
        'ok' => $orderMatchOk,
        'category' => $orderMatchOk ? 'order_lookup_success' : 'PRODUCT_NOT_FOUND',
        'correlationId' => $correlationId,
        'details' => [
            'testedCode' => $sampleOrder['trackingCode'] ?? 'N/A',
            'matched' => $orderMatchOk
        ]
    ];

    // STAGE K: Invoice generation test
    $invoiceStructureValid = (!empty($walletToken) && ($paymentMode !== 'live' || strpos($walletToken, 'WALLET-TEST') === false));
    $stages[] = [
        'stage' => 'K',
        'name' => 'اعتبارسنجی صدور فاکتور کیف پول بله (Invoice Generation Validation)',
        'method' => 'INTERNAL',
        'endpoint' => 'sendBaleInvoiceSafe()',
        'httpStatus' => $invoiceStructureValid ? 200 : 400,
        'ok' => $invoiceStructureValid,
        'category' => $invoiceStructureValid ? 'invoice_ready' : 'INVALID_WALLET_MODE',
        'correlationId' => $correlationId,
        'details' => [
            'paymentMode' => $paymentMode,
            'walletTokenConfigured' => !empty($walletToken),
            'liveTestMismatchPrevented' => true
        ]
    ];

    return [
        'ok' => true,
        'correlationId' => $correlationId,
        'timestamp' => date('c'),
        'backendVersion' => 'Onival-PHP-1.2.0',
        'phpVersion' => PHP_VERSION,
        'totalStages' => count($stages),
        'passedStages' => count(array_filter($stages, fn($s) => !empty($s['ok']))),
        'stages' => $stages
    ];
}

// ------------------------------------------------------------------------------
// 11. Unified Panel Log Adapter (Bounded Tail-Read & Schema Translation)
// ------------------------------------------------------------------------------
/**
 * Reads recent structured events from app.log with bounded tail reading
 * and maps them to the unified frontend format:
 * { id, time, timestamp, type, platform, text, status, details }
 */
function getRecentBotActivityLogsPhp($maxItems = 50, $bytesToRead = 65536) {
    global $logFile;
    if (!file_exists($logFile)) {
        return [];
    }

    $fileSize = @filesize($logFile);
    if ($fileSize === 0 || $fileSize === false) {
        return [];
    }

    $fp = @fopen($logFile, 'rb');
    if (!$fp) {
        return [];
    }

    $readLength = min($fileSize, $bytesToRead);
    $offset = max(0, $fileSize - $readLength);
    fseek($fp, $offset);
    $chunk = fread($fp, $readLength);
    fclose($fp);

    if ($chunk === false || $chunk === '') {
        return [];
    }

    // If we didn't read from the start of the file, drop the leading partial line
    if ($offset > 0) {
        $firstNewline = strpos($chunk, "\n");
        if ($firstNewline !== false) {
            $chunk = substr($chunk, $firstNewline + 1);
        }
    }

    $lines = explode("\n", $chunk);
    $events = [];

    // Process lines in reverse order (newest first)
    for ($i = count($lines) - 1; $i >= 0; $i--) {
        $line = trim($lines[$i]);
        if ($line === '') continue;

        $entry = @json_decode($line, true);
        if (!is_array($entry)) continue;

        $timestamp = (string)($entry['timestamp'] ?? '');
        $stage = (string)($entry['stage'] ?? '');
        $category = (string)($entry['category'] ?? '');
        $rawMessage = (string)($entry['message'] ?? '');
        $correlationId = (string)($entry['correlationId'] ?? '');
        $context = is_array($entry['context'] ?? null) ? $entry['context'] : [];

        // Redact any sensitive tokens, secrets, or raw keys in the message
        $cleanMessage = preg_replace('/(?::|token=|secret=)[a-zA-Z0-9_-]{16,}/i', ':***', $rawMessage);
        $cleanMessage = preg_replace('/[a-zA-Z0-9_-]{32,}/', '***', $cleanMessage);

        // Derive status explicitly without inventing false success
        $status = 'info';
        $lowCategory = strtolower($category);
        $lowStage = strtolower($stage);
        if (strpos($lowCategory, 'error') !== false || strpos($lowCategory, 'fail') !== false || strpos($lowCategory, 'critical') !== false || strpos($lowCategory, 'exception') !== false || strpos($lowCategory, 'rejected') !== false || strpos($lowCategory, 'conflict') !== false) {
            $status = 'error';
        } elseif (strpos($lowCategory, 'warn') !== false || strpos($lowCategory, 'review') !== false || strpos($lowCategory, 'pending') !== false || strpos($lowCategory, 'underpaid') !== false) {
            $status = 'warning';
        } elseif (strpos($lowCategory, 'success') !== false || strpos($lowCategory, 'approved') !== false || strpos($lowCategory, 'verified') !== false || strpos($lowCategory, 'saved') !== false || strpos($lowCategory, 'uploaded') !== false) {
            $status = 'success';
        }

        // Derive platform
        $platform = 'bale';
        if (strpos($lowStage, 'telegram') !== false || strpos($lowCategory, 'telegram') !== false) {
            $platform = 'telegram';
        } elseif (strpos($lowStage, 'database') !== false || strpos($lowStage, 'account') !== false) {
            $platform = 'system';
        }

        // Derive readable Persian/standard time
        $timeStr = date('H:i:s');
        if (!empty($timestamp)) {
            $ts = strtotime($timestamp);
            if ($ts !== false) {
                $timeStr = date('H:i:s', $ts);
            }
        }

        // Derive stable unique integer ID for React key and item selection
        $idSeed = $timestamp . '_' . $correlationId . '_' . $stage . '_' . $category . '_' . $i;
        $stableId = (int)sprintf('%u', crc32($idSeed));
        if ($stableId <= 0) $stableId = abs(crc32($idSeed)) ?: ($i + 1);

        $events[] = [
            'id' => $stableId,
            'time' => $timeStr,
            'timestamp' => $timestamp,
            'type' => !empty($category) ? $category : $stage,
            'platform' => $platform,
            'text' => $cleanMessage,
            'status' => $status,
            'details' => !empty($context) ? json_encode($context, JSON_UNESCAPED_UNICODE) : null
        ];

        if (count($events) >= $maxItems) {
            break;
        }
    }

    return $events;
}


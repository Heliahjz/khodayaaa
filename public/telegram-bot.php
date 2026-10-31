<?php
/**
 * ==============================================================================
 * ONIVAL Telegram Bot Entry Point (public_html/telegram-bot.php)
 * ==============================================================================
 * Securely delegates to the canonical webhook engine (api/webhook.php)
 * ==============================================================================
 */

$_GET['platform'] = 'telegram';
require __DIR__ . '/api/webhook.php';

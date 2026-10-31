<?php
/**
 * ==============================================================================
 * Dedicated Telegram Bot Webhook Entry Point
 * URL: https://yourdomain.com/api/telegram-webhook.php
 * ==============================================================================
 */

$_GET['platform'] = 'telegram';
require __DIR__ . '/webhook.php';

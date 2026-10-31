import fs from 'fs';
import path from 'path';

const distDir = path.join(process.cwd(), 'dist');
const publicDir = path.join(process.cwd(), 'public');

const htaccessContent = `# ==============================================================================
# ONIVAL Security & Routing Configuration for Apache / LiteSpeed / cPanel
# Generated automatically during build
# ==============================================================================

# 1. Prevent Directory Browsing
Options -Indexes

# 2. Block direct HTTP access to sensitive files, configs, databases, and logs
<FilesMatch "(^#.*#|\\.(bak|conf|dist|fla|in[ci]|log|psd|sh|sql|sw[op]|env.*|json|lock|yml|yaml|ts|tsx|map)|session_secret|\\.session_secret)$">
    Order allow,deny
    Deny from all
</FilesMatch>

<Files ".session_secret">
    Order allow,deny
    Deny from all
</Files>

<Files "onival-persistent-data.json">
    Order allow,deny
    Deny from all
</Files>

<Files ".env">
    Order allow,deny
    Deny from all
</Files>

<Files "server.cjs">
    Order allow,deny
    Deny from all
</Files>

<Files "server.ts">
    Order allow,deny
    Deny from all
</Files>

<Files "package.json">
    Order allow,deny
    Deny from all
</Files>

<Files "bun.lock">
    Order allow,deny
    Deny from all
</Files>

# 3. Security Headers
<IfModule mod_headers.c>
    Header set X-Content-Type-Options "nosniff"
    Header set X-XSS-Protection "1; mode=block"
    Header set Referrer-Policy "strict-origin-when-cross-origin"
    Header set Permissions-Policy "geolocation=(), microphone=(), camera=()"
</IfModule>

# 4. API Backend & SPA URL Rewriting
<IfModule mod_rewrite.c>
    RewriteEngine On

    # Route all /api and /api/* requests to PHP backend
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^api(?:/(.*))?$ api/index.php?path=$1 [QSA,L]

    # SPA Fallback for all other frontend routes
    RewriteRule ^index\\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . index.html [L]
</IfModule>
`;

if (fs.existsSync(distDir)) {
  fs.writeFileSync(path.join(distDir, '.htaccess'), htaccessContent, 'utf-8');
  console.log('✓ Successfully generated secure .htaccess in dist/');

  // Ensure api/ directory and index.php exist in dist/
  const distApiDir = path.join(distDir, 'api');
  if (!fs.existsSync(distApiDir)) {
    fs.mkdirSync(distApiDir, { recursive: true });
  }

  // Ensure all PHP files in public/api exist in dist/api
  const publicApiFiles = ['index.php', 'common.php', 'webhook.php', 'bale-webhook.php', 'telegram-webhook.php'];
  for (const phpFile of publicApiFiles) {
    const src = path.join(publicDir, 'api', phpFile);
    const dest = path.join(distApiDir, phpFile);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`✓ Copied ${phpFile} to dist/api/${phpFile}`);
    }
  }

  // Ensure root PHP bot files for public_html exist in dist/
  const rootPhpFiles = ['bale-bot.php', 'telegram-bot.php', 'bot-config.php'];
  for (const phpFile of rootPhpFiles) {
    const src = path.join(publicDir, phpFile);
    const dest = path.join(distDir, phpFile);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`✓ Copied ${phpFile} to dist/${phpFile}`);
    }
  }

  // Ensure server-data directory and protective .htaccess exist in dist/
  const distDataDir = path.join(distDir, 'server-data');
  if (!fs.existsSync(distDataDir)) {
    fs.mkdirSync(distDataDir, { recursive: true });
  }
  fs.writeFileSync(path.join(distDataDir, '.htaccess'), "Order allow,deny\nDeny from all\n", 'utf-8');
  console.log('✓ Protected server-data directory prepared in dist/');

  // Copy test suite to dist/tests
  const distTestsDir = path.join(distDir, 'tests');
  if (!fs.existsSync(distTestsDir)) {
    fs.mkdirSync(distTestsDir, { recursive: true });
  }
  const testFileSrc = path.join(process.cwd(), 'tests', 'test_onival_suite.php');
  if (fs.existsSync(testFileSrc)) {
    fs.copyFileSync(testFileSrc, path.join(distTestsDir, 'test_onival_suite.php'));
    console.log('✓ Copied test suite to dist/tests/test_onival_suite.php');
  }
}

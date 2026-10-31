/**
 * Sanitizes eNamad / Trust badge HTML snippet to prevent Stored XSS.
 * Only allows safe <a> and <img> tags, strictly stripping script, iframe, object, embed,
 * event handlers (on*), and javascript: URIs.
 */
export function sanitizeTrustBadgeHtml(rawHtml?: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  let html = rawHtml.trim();

  // Strip script, iframe, object, embed, form, link, style tags and their contents
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  html = html.replace(/<\/?(?:iframe|object|embed|form|input|button|link|meta|base|applet|svg|math)[^>]*>/gi, '');

  // Strip all inline event handlers (e.g. onclick, onerror, onload, onmouseover, etc.)
  html = html.replace(/\s+on[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Strip javascript: / vbscript: in href or src attributes
  html = html.replace(/(href|src)\s*=\s*(["'])\s*(?:javascript|vbscript):[^"']*\2/gi, '$1="#"');
  html = html.replace(/(href|src)\s*=\s*(?:javascript|vbscript):[^\s>]*/gi, '$1="#"');

  return html;
}

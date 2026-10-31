import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/dataService';
import { ImageOff, Loader2 } from 'lucide-react';

interface AuthenticatedReceiptImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackText?: string;
}

/**
 * Renders an image from an authenticated endpoint by fetching it with
 * Authorization headers via apiFetch and displaying it as a local Blob Object URL.
 * Automatically revokes the Object URL when unmounted or when src changes.
 * Never leaks the admin token into a query string.
 */
export const AuthenticatedReceiptImage: React.FC<AuthenticatedReceiptImageProps> = ({
  src,
  alt,
  className = '',
  fallbackText = 'تصویر رسید در دسترس نیست'
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src || typeof src !== 'string' || src.trim() === '') {
      setBlobUrl(null);
      setError(false);
      setLoading(false);
      return;
    }

    const trimmed = src.trim();

    // Direct Data URLs or external URLs can be displayed natively
    if (trimmed.startsWith('data:image/') || /^https?:\/\//i.test(trimmed)) {
      setBlobUrl(trimmed);
      setError(false);
      setLoading(false);
      return;
    }

    let active = true;
    let createdUrl: string | null = null;
    setLoading(true);
    setError(false);

    // Canonicalize path: support both /api/receipts/ and /api/admin/receipts/
    const targetUrl = trimmed.startsWith('/api/receipts/')
      ? '/api/admin/receipts/' + trimmed.slice('/api/receipts/'.length)
      : trimmed;

    apiFetch(targetUrl)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [src]);

  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-100 text-slate-400 text-xs gap-1 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
        <span className="text-[10px]">در حال بارگذاری فیش...</span>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-100 text-slate-400 text-xs p-2 text-center gap-1 ${className}`}>
        <ImageOff className="w-5 h-5 text-slate-400" />
        <span className="text-[10px]">{fallbackText}</span>
      </div>
    );
  }

  return <img src={blobUrl} alt={alt} className={className} />;
};

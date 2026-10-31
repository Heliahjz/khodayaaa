import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, Sparkles, ExternalLink, Play, Pause } from 'lucide-react';
import { TopBanner, TopBannerSettings } from '../types';

interface TopBannerCarouselProps {
  settings?: TopBannerSettings;
  banners?: TopBanner[];
  onBannerClick?: (banner: TopBanner) => void;
}

const DEFAULT_BANNER_SLIDES: TopBanner[] = [
  {
    id: 'banner-slide-1',
    imageUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=1600&auto=format&fit=crop&q=80',
    title: 'عسل طبیعی و خام کوهستان با برگه رسمی آزمایشگاهی',
    subtitle: 'برداشت مستقیم از بهترین کندوهای دامنه سبلان بدون فرآوری و حرارت‌دهی صنعتی',
    linkUrl: '/categories/honey',
    enabled: true
  },
  {
    id: 'banner-slide-2',
    imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=1600&auto=format&fit=crop&q=80',
    title: 'ژل رویال شاهانه ۱۰۰٪ خالص در زنجیره سرمایشی',
    subtitle: 'اکسیر جوانی و تقویت قوای جسمی و سیستم ایمنی با بسته‌بندی ایزوله یخچالی',
    linkUrl: '/categories/supplement',
    enabled: true
  },
  {
    id: 'banner-slide-3',
    imageUrl: 'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=1600&auto=format&fit=crop&q=80',
    title: 'دمنوش‌های آرامش‌بخش کوهستان و سکنجبین سنتی',
    subtitle: 'ترکیب دست‌چین گیاهان دارویی خودرو، تصفیه‌کننده کبد و کاملاً ارگانیک',
    linkUrl: '/categories/drink',
    enabled: true
  }
];

export const TopBannerCarousel: React.FC<TopBannerCarouselProps> = ({
  settings,
  banners,
  onBannerClick
}) => {
  const isEnabled = settings?.enabled ?? true;
  const intervalSeconds = 4; // Constant 4-second standard timing as requested
  const autoRotate = settings?.autoRotate ?? true;
  const showDots = settings?.showDots ?? true;
  const showArrows = settings?.showArrows ?? true;

  const rawSlides = banners && banners.length > 0 ? banners : (settings?.banners && settings.banners.length > 0 ? settings.banners : DEFAULT_BANNER_SLIDES);
  const activeSlides = rawSlides.filter(b => b.enabled !== false && b.imageUrl);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<any>(null);

  // Auto-switch based on standard timing
  useEffect(() => {
    if (!isEnabled || !autoRotate || isPaused || activeSlides.length <= 1) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
    }, intervalSeconds * 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isEnabled, autoRotate, isPaused, activeSlides.length, intervalSeconds]);

  if (!isEnabled || activeSlides.length === 0) {
    return null;
  }

  const handlePrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);
  };

  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
  };

  const currentSlide = activeSlides[currentIndex] || activeSlides[0];

  return (
    <section 
      aria-label="بنر متحرک بالای فروشگاه"
      className="relative w-full rounded-[22px] sm:rounded-[28px] overflow-hidden shadow-lg border border-amber-900/10 group select-none transition-all my-3 sm:my-4"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* Banner Slide Frame */}
      <div className="relative w-full h-44 sm:h-64 md:h-80 lg:h-96 overflow-hidden bg-stone-900">
        {activeSlides.map((slide, idx) => {
          const isActive = idx === currentIndex;
          return (
            <div
              key={slide.id || idx}
              aria-hidden={!isActive}
              className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${
                isActive ? 'opacity-100 z-10 scale-100 pointer-events-auto' : 'opacity-0 z-0 scale-105 pointer-events-none'
              }`}
              style={{ transitionProperty: 'opacity, transform' }}
            >
              {/* Background Banner Image */}
              <img
                src={slide.imageUrl}
                alt={slide.title || 'بنر فروشگاه اونیوال'}
                className="w-full h-full object-cover object-center"
                loading={idx === 0 ? 'eager' : 'lazy'}
              />

              {/* Dark Gradient Overlay for readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-stone-950/80 via-transparent to-transparent hidden sm:block" />

              {/* Content Box */}
              <div className="absolute inset-0 flex flex-col justify-end sm:justify-center p-4 sm:p-8 md:p-12 text-white">
                <div className="max-w-xl space-y-2 sm:space-y-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/90 text-stone-950 text-[10px] sm:text-xs font-black shadow-md backdrop-blur-xs">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>پیشنهاد و معرفی برتر اونیوال</span>
                  </div>

                  {slide.title && (
                    <h2 className="text-base sm:text-2xl md:text-3xl font-black leading-snug tracking-tight text-white drop-shadow-md">
                      {slide.title}
                    </h2>
                  )}

                  {slide.subtitle && (
                    <p className="text-xs sm:text-sm text-stone-200 font-medium line-clamp-2 leading-relaxed drop-shadow-sm max-w-lg">
                      {slide.subtitle}
                    </p>
                  )}

                  {slide.linkUrl && (
                    <div className="pt-1">
                      <a
                        href={slide.linkUrl.trim().toLowerCase().startsWith('javascript:') ? '#' : slide.linkUrl}
                        rel={slide.linkUrl.startsWith('http') ? 'noopener noreferrer' : undefined}
                        target={slide.linkUrl.startsWith('http') ? '_blank' : undefined}
                        onClick={(e) => {
                          if (onBannerClick) {
                            e.preventDefault();
                            onBannerClick(slide);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-stone-900 hover:bg-amber-400 hover:text-stone-950 text-xs sm:text-sm font-black transition-all shadow-md group-hover:scale-102 cursor-pointer"
                      >
                        <span>مشاهده و سفارش آنلاین</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Arrows */}
      {showArrows && activeSlides.length > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            aria-label="اسلاید قبلی بنر"
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-stone-950/40 hover:bg-stone-950/80 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all opacity-0 group-hover:opacity-100 hover:scale-110 cursor-pointer shadow-md"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="اسلاید بعدی بنر"
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-stone-950/40 hover:bg-stone-950/80 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all opacity-0 group-hover:opacity-100 hover:scale-110 cursor-pointer shadow-md"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Bottom Bar: Dots & Timing Badge */}
      {activeSlides.length > 1 && (
        <div className="absolute bottom-2.5 sm:bottom-4 left-0 right-0 z-20 flex items-center justify-between px-4 sm:px-8 pointer-events-none">
          {/* Pause / Play Indicator */}
          <div className="pointer-events-auto">
            <button
              type="button"
              onClick={() => setIsPaused(!isPaused)}
              className="px-2 py-1 rounded-lg bg-black/40 hover:bg-black/60 text-[10px] text-white/80 flex items-center gap-1 backdrop-blur-xs transition cursor-pointer"
              title={isPaused ? 'شروع چرخش خودکار' : 'توقف چرخش'}
            >
              {isPaused ? <Play className="w-2.5 h-2.5 text-amber-400" /> : <Pause className="w-2.5 h-2.5 text-amber-400" />}
              <span className="hidden sm:inline">{isPaused ? 'چرخش متوقف شد' : `هر ${intervalSeconds} ثانیه`}</span>
            </button>
          </div>

          {/* Dots Indicator */}
          {showDots && (
            <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-xs border border-white/10">
              {activeSlides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`رفتن به اسلاید ${idx + 1}`}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    idx === currentIndex
                      ? 'w-6 bg-amber-400 shadow-sm shadow-amber-400/50'
                      : 'w-2 bg-white/40 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Slide counter */}
          <div className="text-[10px] font-mono font-bold text-white/70 bg-black/40 px-2 py-1 rounded-lg backdrop-blur-xs">
            {currentIndex + 1} / {activeSlides.length}
          </div>
        </div>
      )}
    </section>
  );
};

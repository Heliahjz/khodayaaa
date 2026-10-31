import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Layers, 
  FileText, 
  Bookmark, 
  MessageSquare, 
  ShoppingCart, 
  Bot, 
  KeyRound, 
  Store,
  Sliders,
  Percent,
  CreditCard,
  Sparkles,
  Globe,
  Search,
  X,
  LogOut
} from 'lucide-react';

export type NavItem = 
  | 'dashboard'
  | 'products'
  | 'discounts'
  | 'product-categories'
  | 'posts'
  | 'post-categories'
  | 'consultations'
  | 'messages'
  | 'orders'
  | 'payment-settings'
  | 'page-editor'
  | 'seo'
  | 'search-engines'
  | 'bot'
  | 'account';

interface SidebarProps {
  activeTab: NavItem;
  onSelectTab: (tab: NavItem) => void;
  unreadMessagesCount: number;
  pendingOrdersCount: number;
  isOpen: boolean;
  onClose: () => void;
  onViewStorefront?: () => void;
  onLogout?: () => void;
  brandName?: string;
  brandEnglishName?: string;
  siteLogo?: string;
  siteLogoFit?: 'cover' | 'contain';
  siteLogoShape?: 'circle' | 'rounded' | 'free';
  siteLogoScale?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  unreadMessagesCount,
  pendingOrdersCount,
  isOpen,
  onClose,
  onViewStorefront,
  onLogout,
  brandName = 'اونیوال',
  brandEnglishName = 'ONIVAL',
  siteLogo,
  siteLogoFit = 'cover',
  siteLogoShape = 'rounded',
  siteLogoScale = 100
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'داشبورد مدیریت', icon: LayoutDashboard, badge: null },
    { id: 'products', label: 'محصولات فروشگاه', icon: Package, badge: null },
    { 
      id: 'discounts', 
      label: 'مدیریت تخفیف‌ها', 
      icon: Percent, 
      badge: 'شگفت‌انگیز', 
      badgeColor: 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
    },
    { id: 'product-categories', label: 'دسته‌بندی محصولات', icon: Layers, badge: null },
    { id: 'posts', label: 'مقالات و اخبار', icon: FileText, badge: null },
    { id: 'post-categories', label: 'دسته‌بندی مقالات', icon: Bookmark, badge: null },
    { 
      id: 'consultations', 
      label: 'مدیریت و تنظیمات مشاوره', 
      icon: Sparkles, 
      badge: 'رزرو و قیمت', 
      badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
    },
    { 
      id: 'messages', 
      label: 'پیام‌ها و پشتیبانی', 
      icon: MessageSquare, 
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : null,
      badgeColor: 'bg-rose-500 text-white'
    },
    { 
      id: 'orders', 
      label: 'سفارشات و فیش‌های واریزی', 
      icon: ShoppingCart, 
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : null,
      badgeColor: 'bg-amber-500 text-white'
    },
    { 
      id: 'payment-settings', 
      label: 'تنظیمات صفحه پرداخت', 
      icon: CreditCard, 
      badge: 'کارت / درگاه', 
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
    },
    { 
      id: 'page-editor', 
      label: 'اصلاح صفحات و چیدمان', 
      icon: Sliders, 
      badge: 'محتوا', 
      badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
    },
    { 
      id: 'seo', 
      label: 'سئو تکنیکال، نقشه سایت و ریدایرکت', 
      icon: Globe, 
      badge: 'SEO', 
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
    },
    { 
      id: 'search-engines', 
      label: 'اتصال به ترب، ایمالز و اینماد', 
      icon: Search, 
      badge: 'ترب / اینماد', 
      badgeColor: 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
    },
    { id: 'bot', label: 'ربات بله/تلگرام و ارتباطات پشتیبانی', icon: Bot, badge: 'تست زنده', badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' },
    { id: 'account', label: 'تنظیمات و امنیت', icon: KeyRound, badge: null },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar Content */}
      <aside
        className={`fixed top-0 bottom-0 right-0 z-50 w-72 bg-slate-900 text-slate-200 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-10 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {siteLogo ? (
              <div
                className={
                  siteLogoShape === 'free'
                    ? 'h-10 max-w-[110px] flex items-center justify-center overflow-hidden shrink-0'
                    : `w-10 h-10 ${
                        siteLogoShape === 'circle' ? 'rounded-full' : 'rounded-xl'
                      } bg-white flex items-center justify-center shadow-lg shadow-amber-500/20 overflow-hidden shrink-0`
                }
              >
                <img
                  src={siteLogo}
                  alt={brandName}
                  style={{
                    transform:
                      siteLogoScale && siteLogoScale !== 100
                        ? `scale(${siteLogoScale / 100})`
                        : undefined,
                    transformOrigin: 'center center'
                  }}
                  className={`w-full h-full ${
                    siteLogoShape === 'free'
                      ? 'object-contain max-h-10 w-auto'
                      : siteLogoFit === 'cover'
                      ? 'object-cover'
                      : 'object-contain'
                  }`}
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 overflow-hidden shrink-0">
                <Store className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="text-base font-black text-white tracking-wide">فروشگاه {brandName}</div>
              <div className="text-xs text-amber-400 font-mono font-medium">{brandEnglishName} Web & Bot Panel</div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {onViewStorefront && (
            <div className="mb-4 px-1">
              <button
                id="btn-sidebar-view-storefront"
                onClick={() => {
                  onViewStorefront();
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20 transition group"
              >
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-blue-200 group-hover:scale-110 transition" />
                  <span>مشاهده فروشگاه (دید مشتری)</span>
                </div>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md">لایو</span>
              </button>
            </div>
          )}

          <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 tracking-wider">
            بخش‌های اصلی پنل مدیریت
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => {
                  onSelectTab(item.id as NavItem);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== null && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${item.badgeColor || 'bg-slate-800 text-slate-200'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Info & Logout */}
        <div className="p-4 border-t border-slate-800 text-xs text-slate-400 space-y-3">
          <div className="flex items-center justify-between">
            <span>سامانه فروشگاه:</span>
            <span className="font-mono text-amber-400 font-bold">{brandEnglishName || 'ONIVAL'} Core</span>
          </div>
          <div className="text-[11px] text-slate-400">
            نسخه ۱.۱.۰ (v1.1.0) • اتصال هاست، ربات بله و تلگرام
          </div>
          {onLogout && (
            <button
              type="button"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-600/30 border border-rose-500/20 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج از پنل مدیریت</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

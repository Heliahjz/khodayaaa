import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Bell,
  Search,
  User,
  ExternalLink,
  Store,
  ShoppingCart,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  CreditCard,
  ChevronLeft,
  Settings,
  X
} from 'lucide-react';
import { Order, ContactMessage } from '../types';
import { NavItem } from './Sidebar';

interface HeaderProps {
  onMenuClick: () => void;
  title: string;
  unreadMessagesCount: number;
  pendingOrdersCount?: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onViewStorefront?: () => void;
  onNavigate?: (item: NavItem) => void;
  orders?: Order[];
  messages?: ContactMessage[];
  onMarkMessageRead?: (id: number) => void;
  siteLogo?: string;
  adminName?: string;
  adminEmail?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onMenuClick,
  title,
  unreadMessagesCount,
  pendingOrdersCount = 0,
  searchQuery,
  setSearchQuery,
  onViewStorefront,
  onNavigate,
  orders = [],
  messages = [],
  onMarkMessageRead,
  siteLogo,
  adminName = 'مدیر ارشد سیستم',
  adminEmail = 'admin@onival.com'
}) => {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const NOTIF_STORAGE_KEY = 'onival_admin_seen_notifications_v1.1';
  const [seenNotificationKeys, setSeenNotificationKeys] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(NOTIF_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Close notification dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    if (isNotifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotifOpen]);

  // Compute actionable notifications from orders & messages
  const pendingReceiptOrders = orders.filter(
    o => o.paymentStatus === 'PendingVerification' || Boolean(o.receiptImage && o.paymentStatus !== 'Paid')
  );
  const activePendingOrders = orders.filter(
    o => (o.status === 'Pending' || o.status === 'Processing') && o.paymentStatus !== 'PendingVerification'
  );
  const unreadConsultations = messages.filter(
    m => (!m.isRead || !m.isResponded) && Boolean(m.consultationDetails)
  );
  const unreadTickets = messages.filter(
    m => (!m.isRead || !m.isResponded) && !m.consultationDetails
  );

  const totalNotifications =
    pendingReceiptOrders.length +
    unreadConsultations.length +
    unreadTickets.length +
    activePendingOrders.length;

  // Unique keys for each current notification item
  const allNotificationKeys = [
    ...pendingReceiptOrders.map(o => `receipt-${o.id}-${o.paymentStatus}`),
    ...unreadConsultations.map(m => `consult-${m.id}-${m.isRead ? 'read' : 'unread'}`),
    ...unreadTickets.map(m => `msg-${m.id}-${m.isRead ? 'read' : 'unread'}`),
    ...activePendingOrders.map(o => `order-${o.id}-${o.status}`)
  ];

  // Unread badge strictly counts items that haven't been seen/reviewed yet
  const unseenCount = allNotificationKeys.filter(k => !seenNotificationKeys.includes(k)).length;

  const handleToggleNotifications = () => {
    setIsNotifOpen(prev => {
      const next = !prev;
      if (next && allNotificationKeys.length > 0) {
        // Mark current items as viewed so the unread badge clears
        const updated = Array.from(new Set([...seenNotificationKeys, ...allNotificationKeys]));
        setSeenNotificationKeys(updated);
        try {
          localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(updated));
        } catch {}
      }
      return next;
    });
  };

  const handleMarkAllRead = () => {
    if (onMarkMessageRead) {
      messages.forEach(m => {
        if (!m.isRead) {
          onMarkMessageRead(m.id);
        }
      });
    }
    const updated = Array.from(new Set([...seenNotificationKeys, ...allNotificationKeys]));
    setSeenNotificationKeys(updated);
    try {
      localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Right Section: Mobile Hamburger + Logo/Title */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden transition shrink-0"
            aria-label="منوی مدیریت"
          >
            <Menu className="w-5 h-5" />
          </button>

          {siteLogo && (
            <div className="w-9 h-9 rounded-xl border border-amber-200 bg-amber-50/60 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
              <img
                src={siteLogo}
                alt="لوگوی سایت"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-lg font-black text-slate-800 truncate leading-tight">
                {title}
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300/80 shadow-2xs shrink-0">
                نسخه ۱.۱.۰
              </span>
            </div>
            <p className="hidden md:block text-[11px] text-slate-400 font-medium truncate mt-0.5">
              پنل یکپارچه مدیریت فروشگاه، سفارشات، مشاوره و ربات‌های پشتیبانی اونیوال (v1.1.0)
            </p>
          </div>
        </div>

        {/* Center Section: Desktop Search Box */}
        <div className="hidden md:flex items-center relative w-60 lg:w-72 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder="جستجو در محصولات، سفارشات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-8 py-2 bg-slate-100/90 border border-slate-200/70 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 rounded-xl text-xs text-slate-700 placeholder-slate-400 transition outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 text-slate-400 hover:text-slate-600"
              title="پاک کردن جستجو"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Left Section: Action Buttons, Notifications Bell & Admin Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Mobile Search Toggle Button */}
          <button
            onClick={() => setIsMobileSearchOpen(prev => !prev)}
            className={`md:hidden p-2 rounded-xl border transition ${
              isMobileSearchOpen || searchQuery
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100'
            }`}
            title="جستجو"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* View Storefront Button (Responsive for Mobile & Desktop) */}
          {onViewStorefront && (
            <button
              id="btn-view-storefront"
              onClick={onViewStorefront}
              className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/90 transition shadow-2xs shrink-0"
              title="مشاهده نمای فروشگاه (دید مشتری)"
            >
              <Store className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="hidden sm:inline">مشاهده فروشگاه</span>
              <span className="sm:hidden text-[11px]">فروشگاه</span>
              <ExternalLink className="w-3 h-3 opacity-70 hidden lg:inline" />
            </button>
          )}

          {/* Interactive Notification Bell Dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              id="btn-admin-notifications"
              onClick={handleToggleNotifications}
              className={`relative p-2 sm:p-2.5 rounded-xl border transition ${
                isNotifOpen
                  ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-xs'
                  : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title="اعلان‌ها و رویدادهای سیستم"
            >
              <Bell className={`w-4 h-4 sm:w-5 sm:h-5 ${unseenCount > 0 ? 'animate-pulse text-amber-600' : ''}`} />
              {unseenCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-white shadow-xs">
                  {unseenCount > 99 ? '99+' : unseenCount}
                </span>
              )}
            </button>

            {/* Notification Popover Menu */}
            {isNotifOpen && (
              <div
                className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2.5 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
                dir="rtl"
              >
                {/* Header */}
                <div className="px-4 py-3 bg-gradient-to-l from-slate-900 to-slate-800 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-400" />
                    <span className="text-xs sm:text-sm font-bold">مرکز اعلان‌ها و رویدادهای فوری</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {unseenCount > 0 ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-500/90 text-white rounded-full">
                        {unseenCount} مورد جدید
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 rounded-full">
                        خوانده شده
                      </span>
                    )}
                    <button
                      onClick={() => setIsNotifOpen(false)}
                      className="text-slate-400 hover:text-white p-0.5 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Quick Summary Counters */}
                <div className="grid grid-cols-3 gap-1.5 p-2.5 bg-slate-50 border-b border-slate-200/80 text-center">
                  <button
                    onClick={() => {
                      onNavigate?.('orders');
                      setIsNotifOpen(false);
                    }}
                    className="p-2 rounded-xl bg-white border border-slate-200/70 hover:border-amber-400 transition group"
                  >
                    <div className="text-xs font-black text-amber-600">
                      {pendingReceiptOrders.length + activePendingOrders.length}
                    </div>
                    <div className="text-[10px] text-slate-500 group-hover:text-slate-800 font-medium truncate">
                      سفارش و فیش
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      onNavigate?.('consultations');
                      setIsNotifOpen(false);
                    }}
                    className="p-2 rounded-xl bg-white border border-slate-200/70 hover:border-purple-400 transition group"
                  >
                    <div className="text-xs font-black text-purple-600">
                      {unreadConsultations.length}
                    </div>
                    <div className="text-[10px] text-slate-500 group-hover:text-slate-800 font-medium truncate">
                      نوبت مشاوره
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      onNavigate?.('messages');
                      setIsNotifOpen(false);
                    }}
                    className="p-2 rounded-xl bg-white border border-slate-200/70 hover:border-rose-400 transition group"
                  >
                    <div className="text-xs font-black text-rose-600">
                      {unreadTickets.length}
                    </div>
                    <div className="text-[10px] text-slate-500 group-hover:text-slate-800 font-medium truncate">
                      پیام پشتیبانی
                    </div>
                  </button>
                </div>

                {/* Notification Items List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {totalNotifications === 0 ? (
                    <div className="py-10 px-4 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2.5">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">تمامی پیام‌ها و سفارشات بررسی شده‌اند!</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        در حال حاضر هیچ سفارش در انتظار یا پیام خوانده‌نشده‌ای وجود ندارد.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* 1. Pending Receipt Verification Orders */}
                      {pendingReceiptOrders.map(order => (
                        <button
                          key={`receipt-${order.id}`}
                          onClick={() => {
                            onNavigate?.('orders');
                            setIsNotifOpen(false);
                          }}
                          className="w-full text-right p-3 hover:bg-amber-50/70 transition flex items-start gap-3 group"
                        >
                          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-extrabold text-slate-800 group-hover:text-amber-800 truncate">
                                فیش واریزی در انتظار تایید ({order.trackingCode})
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold shrink-0">
                                فیش کارت‌به‌کارت
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {order.userFullName} — مبلغ: {order.totalPrice.toLocaleString('fa-IR')} تومان
                            </p>
                          </div>
                          <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-amber-600 self-center shrink-0" />
                        </button>
                      ))}

                      {/* 2. Unread Consultations */}
                      {unreadConsultations.map(consult => (
                        <button
                          key={`consult-${consult.id}`}
                          onClick={() => {
                            onMarkMessageRead?.(consult.id);
                            onNavigate?.('consultations');
                            setIsNotifOpen(false);
                          }}
                          className="w-full text-right p-3 hover:bg-purple-50/60 transition flex items-start gap-3 group"
                        >
                          <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-extrabold text-slate-800 group-hover:text-purple-800 truncate">
                                نوبت مشاوره: {consult.fullName}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold shrink-0">
                                {consult.trackingCode}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {consult.consultationDetails?.topicTitle || consult.message}
                            </p>
                          </div>
                          <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-purple-600 self-center shrink-0" />
                        </button>
                      ))}

                      {/* 3. Unread Support Tickets */}
                      {unreadTickets.map(msg => (
                        <button
                          key={`msg-${msg.id}`}
                          onClick={() => {
                            onMarkMessageRead?.(msg.id);
                            onNavigate?.('messages');
                            setIsNotifOpen(false);
                          }}
                          className="w-full text-right p-3 hover:bg-rose-50/60 transition flex items-start gap-3 group"
                        >
                          <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                            <MessageSquare className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-extrabold text-slate-800 group-hover:text-rose-800 truncate">
                                پیام از {msg.fullName}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                {msg.trackingCode}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {msg.message}
                            </p>
                          </div>
                          <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-rose-600 self-center shrink-0" />
                        </button>
                      ))}

                      {/* 4. Active Pending Orders */}
                      {activePendingOrders.map(order => (
                        <button
                          key={`order-${order.id}`}
                          onClick={() => {
                            onNavigate?.('orders');
                            setIsNotifOpen(false);
                          }}
                          className="w-full text-right p-3 hover:bg-blue-50/60 transition flex items-start gap-3 group"
                        >
                          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                            <ShoppingCart className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-extrabold text-slate-800 group-hover:text-blue-800 truncate">
                                سفارش {order.status === 'Pending' ? 'در انتظار بررسی' : 'در حال آماده‌سازی'} ({order.trackingCode})
                              </span>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                {order.creationTime}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              مشتری: {order.userFullName} — {order.totalPrice.toLocaleString('fa-IR')} تومان
                            </p>
                          </div>
                          <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-blue-600 self-center shrink-0" />
                        </button>
                      ))}
                    </>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="p-2.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-2">
                  {totalNotifications > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 transition"
                    >
                      علامت‌گذاری همه به عنوان خوانده‌شده
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onNavigate?.('messages');
                      setIsNotifOpen(false);
                    }}
                    className="mr-auto text-[11px] font-bold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-200/60 transition flex items-center gap-1"
                  >
                    <span>مشاهده همه پیام‌ها</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Admin Profile Pill (Clicks to Account & Logo Settings) */}
          <button
            onClick={() => onNavigate?.('account')}
            className="flex items-center gap-2.5 pl-1 sm:pl-2 pr-1.5 sm:pr-3 py-1 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition group"
            title="تنظیمات حساب مدیر، رمز عبور و لوگوی سایت"
          >
            <div className="hidden lg:block text-left">
              <div className="text-xs font-bold text-slate-800 group-hover:text-amber-700 transition truncate max-w-[140px]">
                {adminName}
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">
                {adminEmail}
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 flex items-center justify-center font-bold overflow-hidden shrink-0 group-hover:bg-amber-500 group-hover:text-white transition">
              {siteLogo ? (
                <img src={siteLogo} alt="Logo" className="w-full h-full object-contain p-0.5" />
              ) : (
                <User className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Collapsible Mobile Search Bar */}
      {isMobileSearchOpen && (
        <div className="md:hidden px-3 pb-3 pt-1 bg-white border-t border-slate-100 animate-in slide-in-from-top-1 duration-150">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="جستجو در محصولات، سفارشات، کد رهگیری..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full pr-10 pl-9 py-2 bg-slate-100 border border-slate-200 focus:bg-white focus:border-amber-500 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

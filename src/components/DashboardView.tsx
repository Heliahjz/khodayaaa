import React from 'react';
import { 
  Package, 
  FileText, 
  MessageSquare, 
  ShoppingCart, 
  TrendingUp, 
  Bot, 
  Plus, 
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  Store,
  Sliders
} from 'lucide-react';
import { Product, Post, ContactMessage, Order, AdminStats, TelegramConfig } from '../types';
import { NavItem } from './Sidebar';

interface DashboardViewProps {
  stats: AdminStats;
  products: Product[];
  posts: Post[];
  messages: ContactMessage[];
  orders: Order[];
  botConfig: TelegramConfig;
  onNavigate: (tab: NavItem) => void;
  onOpenAddProduct: () => void;
  onOpenAddPost: () => void;
  onTestBot: () => void;
  onViewStorefront?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  products,
  posts,
  messages,
  orders,
  botConfig,
  onNavigate,
  onOpenAddProduct,
  onOpenAddPost,
  onTestBot,
  onViewStorefront,
}) => {
  const formatPrice = (val: number) => {
    return new Intl.NumberFormat('fa-IR').format(val) + ' تومان';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-blue-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-medium text-blue-200 border border-white/10">
              <Bot className="w-3.5 h-3.5" />
              سیستم متصل به بات هوشمند بله و تلگرام
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-xs font-black border border-amber-400/30">
              نسخه ۱.۱.۰ (v1.1.0)
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-2">
            پنل یکپارچه مدیریت فروشگاه و ارتباطات انیوال
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-5">
            کنترل کاتالوگ محصولات با ویژگی‌های قیمت و سایز، انتشار مقالات وبلاگ، رسیدگی به پیام‌های پشتیبانی با کد پیگیری و مدیریت سفارشات مستقیم.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              id="btn-quick-page-editor"
              onClick={() => onNavigate('page-editor')}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-md transition"
            >
              <Sliders className="w-4 h-4" />
              <span>اصلاح صفحات و چیدمان</span>
            </button>
            {onViewStorefront && (
              <button
                id="btn-quick-view-storefront"
                onClick={onViewStorefront}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium flex items-center gap-2 backdrop-blur-xs transition"
              >
                <Store className="w-4 h-4" />
                <span>مشاهده فروشگاه (دید مشتری)</span>
              </button>
            )}
            <button
              id="btn-quick-add-product"
              onClick={onOpenAddProduct}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن محصول جدید</span>
            </button>
            <button
              id="btn-quick-add-post"
              onClick={onOpenAddPost}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium flex items-center gap-2 backdrop-blur-xs transition"
            >
              <FileText className="w-4 h-4" />
              <span>نوشتن مقاله جدید</span>
            </button>
            <button
              id="btn-quick-test-bot"
              onClick={onTestBot}
              className="px-4 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition"
            >
              <Bot className="w-4 h-4" />
              <span>ارسال تست به بات</span>
            </button>
            <button
              id="btn-quick-firebase-seed"
              onClick={() => onNavigate('account')}
              className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 rounded-xl text-sm font-bold flex items-center gap-2 transition cursor-pointer"
            >
              <span>دیتابیس سوپابیس (Supabase) و Seed Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">محصولات فعال</div>
            <div className="text-2xl font-bold text-slate-800">{stats.totalProducts} قلم</div>
            <div className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>دسته‌بندی‌ها فعال</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">سفارشات در انتظار</div>
            <div className="text-2xl font-bold text-slate-800">{stats.pendingOrders} سفارش</div>
            <div className="text-[11px] text-amber-600 mt-1 flex items-center gap-1 font-medium">
              <Clock className="w-3 h-3" />
              <span>نیازمند بررسی و ارسال</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <ShoppingCart className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">پیام‌های بی‌پاسخ</div>
            <div className="text-2xl font-bold text-slate-800">{stats.unreadMessages} پیام</div>
            <div className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3 h-3" />
              <span>دارای کد رهگیری فعال</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <MessageSquare className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">فروش کل ثبت شده</div>
            <div className="text-xl font-bold text-slate-800">{formatPrice(stats.totalRevenue)}</div>
            <div className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3 h-3" />
              <span>تراکنش‌های موفق</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Content Grid: Orders & Messages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              <span>آخرین سفارشات مشتریان</span>
            </div>
            <button
              onClick={() => onNavigate('orders')}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
            >
              <span>مشاهده همه</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {orders.slice(0, 4).map((order) => (
              <div
                key={order.id}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between hover:bg-slate-100/80 transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {order.trackingCode}
                    </span>
                    <span className="text-sm font-bold text-slate-800">{order.userFullName}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {order.items.map(i => `${i.productName} (${i.quantity})`).join(' ، ')}
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-slate-800">{formatPrice(order.totalPrice)}</div>
                  <span
                    className={`inline-block text-[11px] px-2 py-0.5 rounded-md font-semibold mt-1 ${
                      order.status === 'Processing'
                        ? 'bg-blue-100 text-blue-700'
                        : order.status === 'Pending'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {order.status === 'Processing' ? 'در حال آماده‌سازی' : order.status === 'Pending' ? 'در انتظار' : 'تحویل شده'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Contact Messages */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <MessageSquare className="w-5 h-5 text-rose-500" />
              <span>پیام‌های اخیر پشتیبانی و بات</span>
            </div>
            <button
              onClick={() => onNavigate('messages')}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
            >
              <span>مشاهده همه</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {messages.slice(0, 4).map((msg) => (
              <div
                key={msg.id}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100/80 transition"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      {msg.trackingCode}
                    </span>
                    <span className="text-sm font-bold text-slate-800">{msg.fullName}</span>
                  </div>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                      msg.isResponded
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {msg.isResponded ? 'پاسخ داده شده' : 'نیازمند پاسخ'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {msg.message}
                </p>
                <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>{msg.creationTime}</span>
                  {msg.phoneNumber && <span>{msg.phoneNumber}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bot & Integration Status Bar */}
      <div className="bg-slate-900 rounded-2xl p-5 text-white flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-blue-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold flex items-center gap-2">
              <span>وضعیت وب‌هوک و بات انیوال</span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                آنلاین (Online)
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              API Base: {botConfig.baseUrl} | Admin Chat ID: {botConfig.adminChatId}
            </div>
          </div>
        </div>

        <button
          id="btn-go-to-bot-settings"
          onClick={() => onNavigate('bot')}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition w-full md:w-auto justify-center"
        >
          <span>مدیریت تنظیمات و لاگ‌های بات</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { 
  ShoppingCart, 
  Search, 
  CheckCircle2, 
  Clock, 
  Truck, 
  XCircle, 
  MapPin, 
  Phone, 
  Hash,
  CreditCard,
  Image as ImageIcon,
  Eye,
  Check,
  X,
  Send,
  Globe,
  AlertCircle,
  Sliders,
  Download,
  FileSpreadsheet,
  Users,
  TrendingUp,
  Calendar,
  Package,
  BarChart3
} from 'lucide-react';
import { Order } from '../types';
import { apiFetch, getReceiptImageUrlWithAuth } from '../services/dataService';

interface OrdersViewProps {
  orders: Order[];
  onUpdateOrderStatus: (id: number, status: Order['status'], paymentStatus?: Order['paymentStatus']) => Promise<void>;
  onVerifyReceipt?: (id: number, approved: boolean) => Promise<void>;
  onOpenPaymentSettings?: () => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  onUpdateOrderStatus,
  onVerifyReceipt,
  onOpenPaymentSettings
}) => {
  const [activeTab, setActiveTab] = useState<'all_orders' | 'paid_report'>('all_orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);
  const [previewOrderReceipt, setPreviewOrderReceipt] = useState<Order | null>(null);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat('fa-IR').format(val) + ' تومان';
  };

  const normalizeDate = (val: string): string => {
    return String(val || '')
      .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
      .replace(/-/g, '/')
      .trim();
  };

  const paidOrdersList = orders.filter((o) => {
    const isPaid = o.paymentStatus === 'Paid' || o.status === 'Completed';
    if (!isPaid) return false;
    const normOrderDate = normalizeDate(String(o.creationTime || (o as any).date || '').slice(0, 10));
    const normStart = normalizeDate(reportStartDate);
    const normEnd = normalizeDate(reportEndDate);
    if (normStart && normOrderDate < normStart) return false;
    if (normEnd && normOrderDate > normEnd) return false;
    return true;
  });

  const totalPaidRevenue = paidOrdersList.reduce((acc, o) => acc + (Number(o.totalPrice) || 0), 0);
  const totalPaidCount = paidOrdersList.length;
  const totalPaidItemsCount = paidOrdersList.reduce((acc, o) => {
    return acc + (o.items || []).reduce((itemAcc, it) => itemAcc + (Number(it.quantity) || 1), 0);
  }, 0);

  const handleDownloadPaidOrdersCsv = async () => {
    setIsDownloadingCsv(true);
    try {
      let url = '/api/admin/export/paid-orders.csv';
      const params = new URLSearchParams();
      if (reportStartDate) params.set('startDate', reportStartDate);
      if (reportEndDate) params.set('endDate', reportEndDate);
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await apiFetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `paid-orders-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        return;
      }
    } catch (err) {
      console.error('Error downloading paid orders CSV from server:', err);
    } finally {
      setIsDownloadingCsv(false);
    }

    handleExportOrdersExcel(true);
  };

  const pendingReceiptsCount = orders.filter(
    o => o.paymentStatus === 'PendingVerification' || (o.receiptImageUrl && o.paymentStatus !== 'Paid')
  ).length;

  const consultationsCount = orders.filter(
    o => Boolean(o.isConsultation || o.trackingCode.startsWith('ONV-CNS') || o.consultationDetails)
  ).length;

  const filteredOrders = orders.filter((o) => {
    const matchSearch =
      o.userFullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.trackingCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.phoneNumber.includes(searchTerm);

    if (statusFilter === 'all') return matchSearch;
    if (statusFilter === 'PendingReceipt') {
      return matchSearch && (o.paymentStatus === 'PendingVerification' || Boolean(o.receiptImageUrl && o.paymentStatus !== 'Paid'));
    }
    if (statusFilter === 'Consultations') {
      return matchSearch && Boolean(o.isConsultation || o.trackingCode.startsWith('ONV-CNS') || o.consultationDetails);
    }
    return matchSearch && o.status === statusFilter;
  });

  const handleReceiptDecision = async (order: Order, approved: boolean) => {
    setVerifyingId(order.id);
    try {
      if (onVerifyReceipt) {
        await onVerifyReceipt(order.id, approved);
      } else {
        await onUpdateOrderStatus(
          order.id,
          approved ? 'Processing' : order.status,
          approved ? 'Paid' : 'Failed'
        );
      }
      if (previewOrderReceipt?.id === order.id) {
        setPreviewOrderReceipt(null);
      }
    } finally {
      setVerifyingId(null);
    }
  };

  const downloadCsvWithBom = (csvContent: string, filename: string) => {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    let str = String(val).replace(/"/g, '""');
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'` + str;
    }
    return `"${str}"`;
  };

  const handleExportOrdersExcel = (onlyPaid: boolean = false) => {
    const targetOrders = onlyPaid ? orders.filter(o => o.paymentStatus === 'Paid') : orders;
    if (targetOrders.length === 0) {
      return;
    }

    const headers = [
      'شناسه سیستم',
      'شماره فاکتور / کد رهگیری',
      'نام و نام خانوادگی خریدار',
      'شماره تماس / موبایل',
      'مبلغ کل فاکتور (تومان)',
      'وضعیت فاکتور',
      'وضعیت پرداخت',
      'روش پرداخت',
      'اقلام سفارش',
      'تعداد کل کالاها',
      'نشانی تحویل',
      'تاریخ ثبت فاکتور',
      'فیش واریزی دارد؟'
    ];

    const rows = targetOrders.map(o => {
      const itemsDesc = (o.items || [])
        .map(it => `${it.productName} (${it.size || 'استاندارد'}) × ${it.quantity} عدد`)
        .join(' | ');
      const totalQty = (o.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0);
      const statusFa = o.status === 'Completed' ? 'تکمیل شده'
        : o.status === 'Shipped' ? 'ارسال شده'
        : o.status === 'Processing' ? 'در حال آماده‌سازی'
        : o.status === 'Cancelled' ? 'لغو شده' : 'در انتظار بررسی';
      const payStatusFa = o.paymentStatus === 'Paid' ? 'پرداخت شده'
        : o.paymentStatus === 'PendingVerification' ? 'فیش منتظر تایید'
        : o.paymentStatus === 'Failed' ? 'ناموفق / رد شده' : 'در انتظار پرداخت';
      const payMethodFa = o.paymentMethod === 'card_to_card' ? 'کارت به کارت'
        : o.paymentMethod === 'online_gateway' ? 'درگاه بانکی' : 'ربات بله';

      return [
        escapeCsv(o.id),
        escapeCsv(o.trackingCode),
        escapeCsv(o.userFullName),
        escapeCsv(o.phoneNumber),
        escapeCsv(o.totalPrice),
        escapeCsv(statusFa),
        escapeCsv(payStatusFa),
        escapeCsv(payMethodFa),
        escapeCsv(itemsDesc),
        escapeCsv(totalQty),
        escapeCsv(o.userAddress),
        escapeCsv(o.creationTime),
        escapeCsv(o.receiptImageUrl ? 'بله' : 'خیر')
      ].join(',');
    });

    const csvContent = [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
    const filename = `onival_orders_${onlyPaid ? 'paid_' : 'all_'}${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.csv`;
    downloadCsvWithBom(csvContent, filename);
  };

  const handleExportCustomersExcel = () => {
    if (orders.length === 0) {
      return;
    }

    const customersMap = new Map<string, {
      fullName: string;
      phoneNumber: string;
      totalSpent: number;
      ordersCount: number;
      lastOrderDate: string;
      lastTrackingCode: string;
      lastStatus: string;
      address: string;
    }>();

    for (const o of orders) {
      const cleanPhone = (o.phoneNumber || '').trim();
      const existing = customersMap.get(cleanPhone);
      if (existing) {
        existing.totalSpent += (o.totalPrice || 0);
        existing.ordersCount += 1;
        if (!existing.address && o.userAddress) existing.address = o.userAddress;
        if (!existing.fullName && o.userFullName) existing.fullName = o.userFullName;
      } else {
        customersMap.set(cleanPhone, {
          fullName: o.userFullName || 'مشتری گرامی',
          phoneNumber: cleanPhone,
          totalSpent: o.totalPrice || 0,
          ordersCount: 1,
          lastOrderDate: o.creationTime || '',
          lastTrackingCode: o.trackingCode || '',
          lastStatus: o.paymentStatus === 'Paid' ? 'پرداخت شده' : 'در انتظار',
          address: o.userAddress || ''
        });
      }
    }

    const customerList = Array.from(customersMap.values());
    const headers = [
      'شماره همراه خریدار (مخصوص پنل پیامک و تبلیغات)',
      'نام و نام خانوادگی',
      'تعداد کل سفارشات',
      'مجموع خریدهای ثبت شده (تومان)',
      'آخرین کد سفارش',
      'وضعیت آخرین فاکتور',
      'نشانی خریدار',
      'تاریخ آخرین خرید'
    ];

    const rows = customerList.map(c => [
      escapeCsv(c.phoneNumber),
      escapeCsv(c.fullName),
      escapeCsv(c.ordersCount),
      escapeCsv(c.totalSpent),
      escapeCsv(c.lastTrackingCode),
      escapeCsv(c.lastStatus),
      escapeCsv(c.address),
      escapeCsv(c.lastOrderDate)
    ].join(','));

    const csvContent = [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
    const filename = `onival_customers_sms_marketing_${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.csv`;
    downloadCsvWithBom(csvContent, filename);
  };

  const uniqueCustomersCount = new Set(orders.map(o => (o.phoneNumber || '').trim()).filter(Boolean)).size;

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>در انتظار بررسی</span>
          </span>
        );
      case 'Processing':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>در حال آماده‌سازی</span>
          </span>
        );
      case 'Shipped':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 flex items-center gap-1">
            <Truck className="w-3 h-3" />
            <span>ارسال شده</span>
          </span>
        );
      case 'Completed':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>تکمیل شده</span>
          </span>
        );
      case 'Cancelled':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            <span>لغو شده</span>
          </span>
        );
    }
  };

  const getPaymentBadge = (order: Order) => {
    if (order.paymentStatus === 'Paid') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>پرداخت تایید شده</span>
        </span>
      );
    }
    if (order.paymentStatus === 'PendingVerification' || order.receiptImageUrl) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 animate-pulse">
          <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
          <span>فیش واریزی منتظر تایید مدیر</span>
        </span>
      );
    }
    if (order.paymentStatus === 'Failed') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 flex items-center gap-1">
          <XCircle className="w-3.5 h-3.5 text-rose-600" />
          <span>فیش رد شده / ناموفق</span>
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 flex items-center gap-1">
        <Clock className="w-3 h-3 text-slate-400" />
        <span>در انتظار پرداخت</span>
      </span>
    );
  };

  const getMethodLabel = (method?: Order['paymentMethod']) => {
    if (method === 'card_to_card') {
      return (
        <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
          <CreditCard className="w-3 h-3 text-amber-600" />
          <span>کارت به کارت</span>
        </span>
      );
    }
    if (method === 'online_gateway') {
      return (
        <span className="text-[11px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md flex items-center gap-1">
          <Globe className="w-3 h-3 text-blue-600" />
          <span>درگاه بانکی</span>
        </span>
      );
    }
    return (
      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
        <Send className="w-3 h-3 text-emerald-600" />
        <span>ربات بله</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Primary Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('all_orders')}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
            activeTab === 'all_orders'
              ? 'bg-white text-blue-600 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>مدیریت همه سفارش‌ها و فیش‌ها</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
            activeTab === 'all_orders' ? 'bg-blue-50 text-blue-700' : 'bg-slate-200 text-slate-700'
          }`}>
            {orders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('paid_report')}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
            activeTab === 'paid_report'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>گزارش سفارش‌های تایید و پرداخت‌شده</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
            activeTab === 'paid_report' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {orders.filter(o => o.paymentStatus === 'Paid' || o.status === 'Completed').length}
          </span>
        </button>
      </div>

      {activeTab === 'paid_report' ? (
        <div className="space-y-6">
          {/* 3 Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-2xl text-white shadow-md shadow-emerald-500/20 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-100">کل درآمد وصول شده</span>
                <span className="p-2 bg-white/15 rounded-xl">
                  <TrendingUp className="w-5 h-5 text-white" />
                </span>
              </div>
              <div className="mt-3 text-2xl font-black">
                {formatPrice(totalPaidRevenue)}
              </div>
              <div className="mt-1 text-[11px] text-emerald-100 font-medium">
                مجموع مبالغ واریز شده و فیش‌های تاییدشده
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-5 rounded-2xl text-white shadow-md shadow-blue-500/20 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-100">تعداد سفارش‌های پرداخت شده</span>
                <span className="p-2 bg-white/15 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </span>
              </div>
              <div className="mt-3 text-2xl font-black">
                {new Intl.NumberFormat('fa-IR').format(totalPaidCount)} فاکتور
              </div>
              <div className="mt-1 text-[11px] text-blue-100 font-medium">
                تراکنش‌های موفق مالی و فاکتورهای نهایی
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-5 rounded-2xl text-white shadow-md shadow-amber-500/20 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-100">کل اقلام فروخته شده</span>
                <span className="p-2 bg-white/15 rounded-xl">
                  <Package className="w-5 h-5 text-white" />
                </span>
              </div>
              <div className="mt-3 text-2xl font-black">
                {new Intl.NumberFormat('fa-IR').format(totalPaidItemsCount)} عدد کالا
              </div>
              <div className="mt-1 text-[11px] text-amber-100 font-medium">
                مجموع واحدهای کالایی کسر شده از انبار
              </div>
            </div>
          </div>

          {/* Date Filter & Direct CSV Export Toolbar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>فیلتر بازه زمانی فاکتورها:</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="از تاریخ (مثلاً 1403/01/01)"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                />
                <span className="text-slate-400 text-xs">تا</span>
                <input
                  type="text"
                  placeholder="تا تاریخ (مثلاً 1403/12/29)"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                />
                {(reportStartDate || reportEndDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setReportStartDate('');
                      setReportEndDate('');
                    }}
                    className="px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 cursor-pointer font-bold"
                  >
                    حذف فیلتر
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              disabled={isDownloadingCsv || paidOrdersList.length === 0}
              onClick={handleDownloadPaidOrdersCsv}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              <Download className={`w-4 h-4 ${isDownloadingCsv ? 'animate-bounce' : ''}`} />
              <span>
                {isDownloadingCsv
                  ? 'در حال دریافت خروجی CSV...'
                  : `دانلود گزارش مالی فاکتورهای پرداخت‌شده (CSV اکسل - ${paidOrdersList.length} مورد)`}
              </span>
            </button>
          </div>

          {/* Paid Orders Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                لیست تراکنش‌ها و فاکتورهای پرداخت‌شده ({paidOrdersList.length} فاکتور)
              </h3>
            </div>
            {paidOrdersList.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                هیچ سفارش پرداخت‌شده‌ای در این بازه زمانی یافت نشد.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-100 font-bold">
                    <tr>
                      <th className="py-3 px-4">کد رهگیری</th>
                      <th className="py-3 px-4">نام مشتری</th>
                      <th className="py-3 px-4">شماره تماس</th>
                      <th className="py-3 px-4">مبلغ پرداختی</th>
                      <th className="py-3 px-4">روش پرداخت</th>
                      <th className="py-3 px-4">تاریخ ثبت</th>
                      <th className="py-3 px-4">اقلام فاکتور</th>
                      <th className="py-3 px-4">نشانی</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {paidOrdersList.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-bold text-blue-700">
                          {o.trackingCode || `ONV-${o.id}`}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">{o.userFullName}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{o.phoneNumber}</td>
                        <td className="py-3 px-4 font-black text-emerald-700">
                          {formatPrice(o.totalPrice)}
                        </td>
                        <td className="py-3 px-4">{getMethodLabel(o.paymentMethod)}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {o.creationTime || (o as any).date || '-'}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={(o.items || []).map(it => `${it.productName} (${it.size || ''}) × ${it.quantity}`).join(' | ')}>
                          {(o.items || []).map(it => `${it.productName} × ${it.quantity}`).join('، ')}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-500" title={o.userAddress}>
                          {o.userAddress}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                <span>مدیریت سفارشات و تایید فیش‌های واریزی</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                بررسی تصاویر فیش‌های واریزی کارت به کارت به همراه شماره فاکتور، تایید پرداخت و مدیریت ارسال مرسولات
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
          {onOpenPaymentSettings && (
            <button
              type="button"
              onClick={onOpenPaymentSettings}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-600" />
              <span>تنظیمات صفحه پرداخت و شماره کارت</span>
            </button>
          )}

          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            همه ({orders.length})
          </button>

          <button
            onClick={() => setStatusFilter('PendingReceipt')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'PendingReceipt'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>فیش‌های منتظر تایید</span>
            {pendingReceiptsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black">
                {pendingReceiptsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setStatusFilter('Consultations')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'Consultations'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>نوبت‌های مشاوره</span>
            {consultationsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-purple-700 text-white text-[10px] font-black">
                {consultationsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setStatusFilter('Pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              statusFilter === 'Pending'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            در انتظار
          </button>
          <button
            onClick={() => setStatusFilter('Processing')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              statusFilter === 'Processing'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            آماده‌سازی
          </button>
          <button
            onClick={() => setStatusFilter('Completed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              statusFilter === 'Completed'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            تکمیل شده
          </button>
        </div>
      </div>

      {/* Export Toolbar: Excel Orders & Marketing Customer List */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 p-4 sm:p-5 rounded-2xl border border-emerald-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-xs">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-black text-slate-800">
              خروجی جدول اکسل (Excel / CSV) برای فاکتورها و لیست مشتریان
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
              UTF-8 BOM سازگار با اکسل
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            مناسب ارسال تبلیغات پیامکی، عضویت در کانال‌های رسانه‌ای، حسابداری و بایگانی فاکتورهای فروشگاه. ({orders.length} فاکتور، {uniqueCustomersCount} مشتری یکتا)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl shadow-xs border border-emerald-300 overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => handleExportOrdersExcel(false)}
              className="px-3.5 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-50 transition flex items-center gap-1.5 cursor-pointer border-l border-emerald-200"
              title="خروجی تمام سفارشات و فاکتورها در فرمت اکسل"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>اکسل تمام فاکتورها ({orders.length})</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportOrdersExcel(true)}
              className="px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition flex items-center gap-1 cursor-pointer bg-emerald-50/50"
              title="فقط سفارشاتی که وضعیت پرداخت آن‌ها Paid است"
            >
              <span>فقط پرداخت‌شده‌ها ({orders.filter(o => o.paymentStatus === 'Paid').length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportCustomersExcel}
            className="px-4 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition flex items-center gap-2 cursor-pointer"
            title="خروجی شماره تلفن‌ها، نام، جمع مبالغ خرید و آدرس بدون شماره تکراری برای پنل پیامک"
          >
            <Users className="w-3.5 h-3.5" />
            <span>خروجی لیست مشتریان (تبلیغات و پیامک)</span>
            <span className="bg-blue-500/80 px-1.5 py-0.2 rounded-full text-[10px] font-mono">
              {uniqueCustomersCount}
            </span>
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="جستجو با شماره فاکتور / کد رهگیری سفارش (مثلاً ONV-ORD-101)، نام خریدار یا شماره تلفن..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pr-10 pl-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
        />
      </div>

      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
            سفارشی با این مشخصات یافت نشد.
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              className={`bg-white rounded-2xl border p-5 shadow-xs hover:shadow-md transition space-y-4 ${
                order.paymentStatus === 'PendingVerification'
                  ? 'border-amber-300 ring-2 ring-amber-500/10'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className="text-xs font-mono font-black text-blue-800 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200 flex items-center gap-1"
                    title="شماره فاکتور و کد رهگیری سفارش"
                  >
                    <Hash className="w-3.5 h-3.5 text-blue-600" />
                    <span>شماره فاکتور: {order.trackingCode}</span>
                  </span>
                  {getMethodLabel(order.paymentMethod)}
                  {(order.isConsultation || order.trackingCode.startsWith('ONV-CNS') || order.consultationDetails) && (
                    <span className="text-xs font-black text-purple-800 bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-purple-600" />
                      <span>نوبت مشاوره</span>
                    </span>
                  )}
                  <span className="font-bold text-slate-900 text-sm">{order.userFullName}</span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span className="font-mono">{order.phoneNumber}</span>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">{order.creationTime}</span>
                  {getPaymentBadge(order)}
                  {getStatusBadge(order.status)}
                </div>
              </div>

              {/* Receipt Image & Verification Box (If customer uploaded a receipt image) */}
              {order.receiptImageUrl && (
                <div className="rounded-2xl bg-amber-50/70 border border-amber-200 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-4">
                    <div
                      onClick={() => setPreviewOrderReceipt(order)}
                      className="w-20 h-20 rounded-xl overflow-hidden border-2 border-amber-300 bg-white shrink-0 cursor-pointer relative group shadow-xs"
                      title="کلیک برای بزرگنمایی تصویر فیش واریزی"
                    >
                      <img
                        src={getReceiptImageUrlWithAuth(order.receiptImageUrl)}
                        alt={`فیش واریزی فاکتور ${order.trackingCode}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                        <Eye className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="font-black text-slate-900 flex flex-wrap items-center gap-2">
                        <span>فیش واریزی کارت به کارت</span>
                        <span className="font-mono text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                          شماره فاکتور: {order.trackingCode}
                        </span>
                      </div>
                      <div className="text-slate-600">
                        مبلغ فاکتور: <strong className="text-slate-900">{formatPrice(order.totalPrice)}</strong>
                        {order.receiptSubmittedAt && (
                          <span className="text-slate-400 mr-2">• زمان ثبت فیش: {order.receiptSubmittedAt}</span>
                        )}
                      </div>
                      {order.receiptNote && (
                        <div className="text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-amber-200/80 inline-block">
                          توضیحات / کد پیگیری ارسالی مشتری: <strong>{order.receiptNote}</strong>
                        </div>
                      )}
                      <div>
                        <button
                          type="button"
                          onClick={() => setPreviewOrderReceipt(order)}
                          className="text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1 mt-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>مشاهده کامل تصویر فیش واریزی</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Admin Approve / Reject Receipt Buttons */}
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                    {order.paymentStatus !== 'Paid' ? (
                      <>
                        <button
                          type="button"
                          disabled={verifyingId === order.id}
                          onClick={() => handleReceiptDecision(order, true)}
                          className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          <span>تایید فیش واریزی و شروع آماده‌سازی</span>
                        </button>

                        <button
                          type="button"
                          disabled={verifyingId === order.id}
                          onClick={() => handleReceiptDecision(order, false)}
                          className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                          <span>رد فیش</span>
                        </button>
                      </>
                    ) : (
                      <div className="px-3.5 py-2 rounded-xl bg-emerald-100 text-emerald-900 text-xs font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>فیش واریزی توسط مدیر تایید شده است</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Consultation Details Box */}
              {(order.isConsultation || order.consultationDetails) && (
                <div className="rounded-2xl bg-purple-50/80 border border-purple-200 p-4 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-black text-purple-900">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    <span>جزئیات نوبت رزرو مشاوره تخصصی</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-slate-700">
                    <div className="bg-white/80 rounded-lg p-2 border border-purple-100">
                      <span className="text-slate-400 block text-[10px]">تاریخ درخواستی:</span>
                      <span className="font-bold text-purple-950 font-mono">
                        {order.consultationDetails?.preferredDate || 'تعیین در هماهنگی'}
                      </span>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2 border border-purple-100">
                      <span className="text-slate-400 block text-[10px]">بازه ساعتی:</span>
                      <span className="font-bold text-purple-950">
                        {order.consultationDetails?.preferredTimeSlot || 'تعیین در هماهنگی'}
                      </span>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2 border border-purple-100">
                      <span className="text-slate-400 block text-[10px]">بستر ارتباطی:</span>
                      <span className="font-bold text-purple-950">
                        {order.consultationDetails?.socialPlatform || 'تماس تلفنی / پیام‌رسان'}
                      </span>
                    </div>
                  </div>
                  {(order.consultationDetails?.topicTitle || order.consultationDetails?.question) && (
                    <div className="text-slate-600 pt-1 border-t border-purple-100">
                      <span className="font-bold text-slate-700">موضوع / توضیحات: </span>
                      {order.consultationDetails.topicTitle ? `[${order.consultationDetails.topicTitle}] ` : ''}
                      {order.consultationDetails.question}
                    </div>
                  )}
                </div>
              )}

              {/* Items List */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
                <div className="text-xs font-bold text-slate-600 mb-1">اقلام خریداری شده در فاکتور {order.trackingCode}:</div>
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs text-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <span className="font-medium">{item.productName}</span>
                      {item.size && item.size !== 'standard' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-white border border-slate-200 text-slate-600 font-medium">
                          {item.size === 'small' ? 'سایز کوچک' : item.size === 'large' ? 'سایز بزرگ' : item.size}
                        </span>
                      )}
                      <span className="text-slate-400">× {item.quantity} عدد</span>
                    </div>
                    <div className="font-bold text-slate-800">{formatPrice(item.totalPrice)}</div>
                  </div>
                ))}
              </div>

              {/* Address & Total & Status Changer */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
                <div className="flex items-start gap-1.5 text-xs text-slate-600 max-w-lg">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>{order.userAddress}</span>
                </div>

                <div className="flex flex-wrap items-center gap-4 self-end md:self-auto">
                  <div className="text-left">
                    <div className="text-[11px] text-slate-400">مبلغ کل فاکتور:</div>
                    <div className="text-base font-bold text-slate-900">{formatPrice(order.totalPrice)}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={order.paymentStatus}
                      onChange={(e) =>
                        onUpdateOrderStatus(order.id, order.status, e.target.value as Order['paymentStatus'])
                      }
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                      title="وضعیت پرداخت فاکتور"
                    >
                      <option value="Unpaid">پرداخت نشده</option>
                      <option value="PendingVerification">فیش منتظر تایید</option>
                      <option value="Paid">پرداخت تایید شده</option>
                      <option value="Failed">پرداخت ناموفق / رد شده</option>
                    </select>

                    <select
                      value={order.status}
                      onChange={(e) => onUpdateOrderStatus(order.id, e.target.value as Order['status'], order.paymentStatus)}
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                      title="وضعیت پردازش و ارسال سفارش"
                    >
                      <option value="Pending">در انتظار بررسی</option>
                      <option value="Processing">در حال آماده‌سازی</option>
                      <option value="Shipped">ارسال شده</option>
                      <option value="Completed">تکمیل شده</option>
                      <option value="Cancelled">لغو سفارش</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      </>
      )}

      {/* Full-Screen Receipt Inspection Modal for Admin */}
      {previewOrderReceipt && (
        <div
          onClick={() => setPreviewOrderReceipt(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  بررسی تصویر فیش واریزی کارت به کارت
                </h3>
                <div className="text-xs text-blue-700 font-mono font-bold mt-0.5">
                  شماره فاکتور: {previewOrderReceipt.trackingCode}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOrderReceipt(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl text-xs border border-slate-200/70">
              <div>
                <span className="text-slate-400 block">خریدار:</span>
                <span className="font-bold text-slate-800">{previewOrderReceipt.userFullName}</span>
              </div>
              <div>
                <span className="text-slate-400 block">مبلغ فاکتور:</span>
                <span className="font-black text-emerald-700">{formatPrice(previewOrderReceipt.totalPrice)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">شماره تماس:</span>
                <span className="font-mono font-bold text-slate-800">{previewOrderReceipt.phoneNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block">زمان ارسال فیش:</span>
                <span className="font-bold text-slate-700">{previewOrderReceipt.receiptSubmittedAt || previewOrderReceipt.creationTime}</span>
              </div>
              {previewOrderReceipt.receiptNote && (
                <div className="col-span-2 pt-2 border-t border-slate-200/60">
                  <span className="text-slate-400 block">توضیحات / شماره پیگیری ثبت‌شده توسط مشتری:</span>
                  <span className="font-bold text-slate-900">{previewOrderReceipt.receiptNote}</span>
                </div>
              )}
            </div>

            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 max-h-96 flex items-center justify-center">
              <img
                src={getReceiptImageUrlWithAuth(previewOrderReceipt.receiptImageUrl)}
                alt={`فیش فاکتور ${previewOrderReceipt.trackingCode}`}
                className="max-h-96 w-auto object-contain mx-auto"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="button"
                disabled={verifyingId === previewOrderReceipt.id}
                onClick={() => handleReceiptDecision(previewOrderReceipt, true)}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>تایید فیش واریزی و تغییر وضعیت به آماده‌سازی</span>
              </button>

              <button
                type="button"
                disabled={verifyingId === previewOrderReceipt.id}
                onClick={() => handleReceiptDecision(previewOrderReceipt, false)}
                className="px-4 py-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition cursor-pointer"
              >
                رد فیش
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

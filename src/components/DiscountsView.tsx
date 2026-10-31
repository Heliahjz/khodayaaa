import React, { useState } from 'react';
import { 
  Percent, 
  Tag, 
  Flame, 
  Search, 
  Check, 
  Layers, 
  Eye, 
  ArrowRight,
  Sliders,
  Sparkles,
  Zap,
  RotateCcw
} from 'lucide-react';
import { Product, ProductCategory } from '../types';

interface DiscountsViewProps {
  products: Product[];
  categories: ProductCategory[];
  onEditProduct: (id: number, prod: Partial<Product>) => Promise<void>;
  onViewStorefront?: () => void;
}

export const DiscountsView: React.FC<DiscountsViewProps> = ({
  products,
  categories,
  onEditProduct,
  onViewStorefront,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [filterType, setFilterType] = useState<'all' | 'discounted' | 'non-discounted'>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [quickPercentInput, setQuickPercentInput] = useState<{ [productId: number]: number }>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Bulk discount modal state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState<number | 'all'>('all');
  const [bulkDiscountPercent, setBulkDiscountPercent] = useState<number>(15);
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const formatPrice = (num: number) => {
    return new Intl.NumberFormat('fa-IR').format(num);
  };

  const discountedProducts = products.filter(p => (p.discount || 0) > 0);
  const averageDiscount = discountedProducts.length > 0
    ? Math.round(discountedProducts.reduce((acc, p) => acc + (p.discount || 0), 0) / discountedProducts.length)
    : 0;
  const maxDiscount = discountedProducts.length > 0
    ? Math.max(...discountedProducts.map(p => p.discount || 0))
    : 0;

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;

    const hasDiscount = (p.discount || 0) > 0;
    const matchesDiscountFilter = 
      filterType === 'all' ||
      (filterType === 'discounted' && hasDiscount) ||
      (filterType === 'non-discounted' && !hasDiscount);

    return matchesSearch && matchesCategory && matchesDiscountFilter;
  });

  const handleUpdateDiscount = async (product: Product, newDiscount: number) => {
    const clamped = Math.max(0, Math.min(99, Math.round(newDiscount)));
    setUpdatingId(product.id);
    try {
      await onEditProduct(product.id, { discount: clamped });
      showToast(`تخفیف محصول «${product.title}» به ${clamped}٪ تغییر یافت.`);
    } catch (err) {
      console.error(err);
      showToast('خطا در به‌روزرسانی تخفیف محصول');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleApplyBulkDiscount = async () => {
    const targetProducts = products.filter(p => {
      if (bulkCategory === 'all') return true;
      return p.categoryId === bulkCategory;
    });

    if (targetProducts.length === 0) {
      showToast('هیچ محصولی در دسته انتخابی یافت نشد.');
      return;
    }

    setIsApplyingBulk(true);
    try {
      for (const p of targetProducts) {
        await onEditProduct(p.id, { discount: bulkDiscountPercent });
      }
      setIsBulkModalOpen(false);
      showToast(`تخفیف ${bulkDiscountPercent}٪ روی ${targetProducts.length} محصول با موفقیت اعمال شد.`);
    } catch (err) {
      console.error(err);
      showToast('خطا در اعمال تخفیف گروهی');
    } finally {
      setIsApplyingBulk(false);
    }
  };

  const handleClearAllDiscounts = async () => {
    if (discountedProducts.length === 0) {
      showToast('هیچ محصول تخفیف‌داری برای بازنشانی وجود ندارد.');
      return;
    }

    setIsApplyingBulk(true);
    try {
      for (const p of discountedProducts) {
        await onEditProduct(p.id, { discount: 0 });
      }
      showToast(`تخفیف تمام محصولات برداشته شد.`);
    } catch (err) {
      console.error(err);
      showToast('خطا در حذف تخفیف‌ها');
    } finally {
      setIsApplyingBulk(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-bounce">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-amber-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-bold">
              <Flame className="w-3.5 h-3.5 text-amber-300" />
              <span>مدیریت جشنواره فروش و پیشنهاد شگفت‌انگیز</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black">
              تنظیمات درصد تخفیف و پیشنهادهای ویژه (Special Deals)
            </h1>
            <p className="text-xs sm:text-sm text-white/80 max-w-xl leading-relaxed">
              محصولاتی که دارای درصد تخفیف بزرگتر از صفر باشند به طور خودکار در باکس قرمز رنگ «پیشنهاد شگفت‌انگیز» صفحه اصلی و با برچسب تخفیف ویژه به مشتریان نمایش داده می‌شوند.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="px-4 py-2.5 bg-white text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-500" />
              <span>اعمال تخفیف گروهی</span>
            </button>
            <button
              onClick={handleClearAllDiscounts}
              disabled={discountedProducts.length === 0}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span>حذف همه تخفیف‌ها</span>
            </button>
            {onViewStorefront && (
              <button
                onClick={onViewStorefront}
                className="px-4 py-2.5 bg-stone-900/80 hover:bg-stone-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-4 h-4 text-amber-400" />
                <span>مشاهده در ویترین</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block mb-1">محصولات شگفت‌انگیز</span>
            <span className="text-2xl font-black text-rose-600">{discountedProducts.length}</span>
            <span className="text-[11px] text-slate-400 mr-1.5">از {products.length} محصول</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Flame className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block mb-1">میانگین تخفیف فعال</span>
            <span className="text-2xl font-black text-amber-600">{averageDiscount}٪</span>
            <span className="text-[11px] text-slate-400 mr-1.5">در کل فروشگاه</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Percent className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block mb-1">بیشترین درصد تخفیف</span>
            <span className="text-2xl font-black text-emerald-600">{maxDiscount}٪</span>
            <span className="text-[11px] text-slate-400 mr-1.5">حداکثر آفر</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block mb-1">محصولات بدون تخفیف</span>
            <span className="text-2xl font-black text-slate-700">{products.length - discountedProducts.length}</span>
            <span className="text-[11px] text-slate-400 mr-1.5">قیمت عادی</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Tag className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="جستجوی نام محصول یا توضیحات برای تنظیم تخفیف..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-amber-500 transition"
          />
        </div>

        {/* Filter Toggle: All / Discounted / Normal */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start md:self-auto">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterType === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            همه ({products.length})
          </button>
          <button
            onClick={() => setFilterType('discounted')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
              filterType === 'discounted' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-500 hover:text-rose-600'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>تخفیف‌دار ({discountedProducts.length})</span>
          </button>
          <button
            onClick={() => setFilterType('non-discounted')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterType === 'non-discounted' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            عادی ({products.length - discountedProducts.length})
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          همه دسته‌ها
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {cat.title}
          </button>
        ))}
      </div>

      {/* Products Discount List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
            محصولی با این شرایط فیلتر یافت نشد.
          </div>
        ) : (
          filteredProducts.map(product => {
            const currentDiscount = product.discount || 0;
            const isDiscounted = currentDiscount > 0;
            const inputVal = quickPercentInput[product.id] !== undefined
              ? quickPercentInput[product.id]
              : currentDiscount;

            const basePrice = product.sizes?.[0]?.price || product.priceSmall || product.price;
            const finalPrice = isDiscounted ? Math.round(basePrice * (1 - currentDiscount / 100)) : basePrice;

            return (
              <div
                key={product.id}
                className={`bg-white rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between ${
                  isDiscounted
                    ? 'border-rose-300 shadow-sm shadow-rose-100/50 ring-1 ring-rose-200'
                    : 'border-slate-200 shadow-xs hover:border-slate-300'
                }`}
              >
                {/* Product Header */}
                <div>
                  <div className="flex items-start gap-3.5 mb-3">
                    <div className="relative shrink-0">
                      <img
                        src={product.imageName}
                        alt={product.title}
                        className="w-16 h-16 rounded-xl object-cover border border-slate-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1587049359535-b64d3dd0d716?w=800&auto=format&fit=crop&q=80';
                        }}
                      />
                      {isDiscounted && (
                        <span className="absolute -top-2 -right-2 bg-rose-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
                          {currentDiscount}٪
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-0.5">
                        <Tag className="w-3 h-3" />
                        <span>{product.categoryTitle || 'عمومی'}</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {product.title}
                      </h3>
                      <div className="mt-1 flex items-baseline gap-2">
                        {isDiscounted ? (
                          <>
                            <span className="text-xs text-slate-400 line-through">
                              {formatPrice(basePrice)}
                            </span>
                            <span className="text-sm font-black text-rose-600">
                              {formatPrice(finalPrice)} تومان
                            </span>
                          </>
                        ) : (
                          <span className="text-xs font-bold text-slate-800">
                            {formatPrice(basePrice)} تومان
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Size info badge if any */}
                  {product.sizes && product.sizes.length > 0 && (
                    <div className="text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg mb-3 flex items-center gap-1">
                      <Layers className="w-3 h-3 text-slate-400" />
                      <span>دارای {product.sizes.length} اندازه (تخفیف روی تمام سایزها اعمال می‌شود)</span>
                    </div>
                  )}
                </div>

                {/* Discount Control Section */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5 text-rose-500" />
                      <span>درصد تخفیف:</span>
                    </label>

                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={inputVal}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setQuickPercentInput(prev => ({ ...prev, [product.id]: val }));
                        }}
                        className="w-16 px-2 py-1 border border-slate-300 rounded-lg text-xs font-bold text-center font-mono focus:border-rose-500 focus:outline-hidden"
                      />
                      <span className="text-xs font-bold text-slate-500">٪</span>
                      <button
                        type="button"
                        disabled={updatingId === product.id || inputVal === currentDiscount}
                        onClick={() => handleUpdateDiscount(product, inputVal)}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-40"
                      >
                        {updatingId === product.id ? '...' : 'ثبت'}
                      </button>
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleUpdateDiscount(product, 0)}
                      className={`flex-1 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                        currentDiscount === 0
                          ? 'bg-slate-100 text-slate-700 border-slate-300'
                          : 'bg-white text-slate-400 border-slate-200 hover:text-slate-700 hover:border-slate-300'
                      }`}
                      title="بدون تخفیف"
                    >
                      عادی
                    </button>
                    {[10, 15, 20, 30].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleUpdateDiscount(product, pct)}
                        className={`flex-1 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          currentDiscount === pct
                            ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                            : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                        }`}
                      >
                        {pct}٪
                      </button>
                    ))}
                  </div>

                  {/* Status Indicator */}
                  <div className="text-[10px] flex items-center justify-between text-slate-400 pt-1">
                    {isDiscounted ? (
                      <span className="text-rose-600 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                        نمایش در پیشنهاد شگفت‌انگیز
                      </span>
                    ) : (
                      <span>نمایش با قیمت عادی</span>
                    )}
                    <span className="font-mono">کد کالا: #{product.id}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bulk Discount Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scale space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  <Zap className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-slate-800">
                  اعمال تخفیف گروهی و سراسری
                </h3>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              با استفاده از این فرم می‌توانید یک درصد تخفیف مشخص را به صورت همزمان روی تمام محصولات یک دسته یا کل فروشگاه اعمال فرمایید:
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  انتخاب دسته‌بندی هدف:
                </label>
                <select
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 text-slate-800 focus:bg-white focus:outline-amber-500"
                >
                  <option value="all">تمام محصولات فروشگاه ({products.length} محصول)</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({products.filter(p => p.categoryId === c.id).length} محصول)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  درصد تخفیف مورد نظر:
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={bulkDiscountPercent}
                    onChange={(e) => setBulkDiscountPercent(Number(e.target.value))}
                    className="w-24 px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-center font-mono focus:border-rose-500"
                  />
                  <span className="text-xs font-bold text-slate-700">درصد (٪)</span>
                  <div className="flex items-center gap-1 mr-auto">
                    {[10, 15, 20, 25, 30].map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setBulkDiscountPercent(p)}
                        className={`px-2 py-1 rounded-lg text-xs font-bold border ${
                          bulkDiscountPercent === p ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {p}٪
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isApplyingBulk}
                onClick={handleApplyBulkDiscount}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {isApplyingBulk ? 'در حال اعمال تخفیف...' : 'اعمال گروهی تخفیف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

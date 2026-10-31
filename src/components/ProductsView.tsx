import React, { useState } from 'react';
import {
  Product,
  ProductCategory,
  ProductSize,
  PublicationStatus,
  StockAvailability
} from '../types';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Tag,
  Package,
  X,
  Image as ImageIcon,
  Images,
  Video,
  Film,
  ZoomIn,
  Star,
  ListPlus,
  Upload,
  Check,
  Percent,
  Sparkles,
  Globe,
  Eye,
  EyeOff,
  AlertCircle,
  Sliders,
  MoveRight,
  MoveLeft
} from 'lucide-react';
import { sanitizeSlug, isSlugDuplicate } from '../utils/seo';

interface ProductsViewProps {
  products: Product[];
  categories: ProductCategory[];
  onAddProduct: (product: Partial<Product>) => Promise<void>;
  onEditProduct: (id: number, product: Partial<Product>) => Promise<void>;
  onDeleteProduct: (id: number) => Promise<void>;
}

const PRESET_PRODUCT_IMAGES = [
  {
    label: 'عسل طلایی خالص',
    url: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&w=900&q=80',
  },
  {
    label: 'شان عسل و موم طبیعی',
    url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=900&q=80',
  },
  {
    label: 'ژل رویال و اکسیر کندو',
    url: 'https://images.unsplash.com/photo-1471943311424-646960669fbc?auto=format&fit=crop&w=900&q=80',
  },
  {
    label: 'دمنوش و گیاهان دارویی',
    url: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=900&q=80',
  },
  {
    label: 'گرده گل و فرآورده کوهستانی',
    url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80',
  },
];

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  categories,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formError, setFormError] = useState('');
  const [activeModalTab, setActiveModalTab] = useState<'general' | 'media' | 'seo'>('general');

  // Form states
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [price, setPrice] = useState('');
  const [hasSize, setHasSize] = useState(false);
  const [sizes, setSizes] = useState<ProductSize[]>([
    { name: 'نیم کیلوگرم (۵۰۰ گرم)', price: 200000 },
    { name: 'یک کیلوگرم (۱۰۰۰ گرم)', price: 380000 },
  ]);
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [productCategoryId, setProductCategoryId] = useState<number>(categories[0]?.id || 1);
  const [imageName, setImageName] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [newImageInput, setNewImageInput] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoType, setVideoType] = useState<'direct' | 'aparat' | 'youtube'>('direct');
  const [imageAspectRatio, setImageAspectRatio] = useState<'square' | 'portrait' | 'wide' | 'auto'>('square');
  const [imageFitMode, setImageFitMode] = useState<'cover' | 'contain'>('cover');
  const [imageZoomLevel, setImageZoomLevel] = useState<number>(2);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [isAmazingOffer, setIsAmazingOffer] = useState<boolean>(false);
  const [stock, setStock] = useState<number>(20);
  const [specialOfferStock, setSpecialOfferStock] = useState<number>(3);

  // SEO & Publishing states
  const [status, setStatus] = useState<PublicationStatus>('published');
  const [availability, setAvailability] = useState<StockAvailability>('InStock');
  const [sku, setSku] = useState('');
  const [brand, setBrand] = useState('اونیوال | ONIVAL');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [ogTitle, setOgTitle] = useState('');
  const [ogDescription, setOgDescription] = useState('');
  const [ogImage, setOgImage] = useState('');
  const [robotsNoIndex, setRobotsNoIndex] = useState(false);
  const [robotsNoFollow, setRobotsNoFollow] = useState(false);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormError('');
    setActiveModalTab('general');
    setTitle('');
    setSlug('');
    setPrice('');
    setHasSize(false);
    setSizes([
      { name: 'نیم کیلوگرم (۵۰۰ گرم)', price: 200000, stock: 15, specialOfferStock: 2 },
      { name: 'یک کیلوگرم (۱۰۰۰ گرم)', price: 380000, stock: 10, specialOfferStock: 2 },
    ]);
    setShortDescription('');
    setDescription('');
    setProductCategoryId(categories[0]?.id || 1);
    const defaultCover = PRESET_PRODUCT_IMAGES[0].url;
    setImageName(defaultCover);
    setImageAlt('');
    setImages([defaultCover]);
    setNewImageInput('');
    setVideoUrl('');
    setVideoType('direct');
    setImageAspectRatio('square');
    setImageFitMode('cover');
    setImageZoomLevel(2);
    setDiscountPercent(0);
    setIsAmazingOffer(false);
    setStock(20);
    setSpecialOfferStock(3);
    setStatus('published');
    setAvailability('InStock');
    setSku('');
    setBrand('اونیوال | ONIVAL');
    setSeoTitle('');
    setSeoDescription('');
    setCanonicalUrl('');
    setOgTitle('');
    setOgDescription('');
    setOgImage('');
    setRobotsNoIndex(false);
    setRobotsNoFollow(false);
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormError('');
    setActiveModalTab('general');
    setTitle(product.title);
    setSlug(product.slug);
    setPrice(product.price.toString());
    setHasSize(product.hasSize);
    if (product.sizes && product.sizes.length > 0) {
      setSizes(product.sizes.map((s) => ({
        ...s,
        stock: s.stock !== undefined ? s.stock : 10,
        specialOfferStock: s.specialOfferStock !== undefined ? s.specialOfferStock : 0,
        isOutOfStock: Boolean(s.isOutOfStock || (s.stock !== undefined && s.stock <= 0)),
      })));
    } else if (product.hasSize) {
      const halfStock = Math.floor((product.stock || 20) / 2);
      const halfQuota = Math.floor((product.specialOfferStock || 0) / 2);
      setSizes([
        { name: 'سایز کوچک (۵۰۰ گرم)', price: product.priceSmall || product.price, stock: halfStock, specialOfferStock: halfQuota },
        { name: 'سایز بزرگ (۱ کیلوگرم)', price: product.priceLarge || product.price, stock: Math.max(1, (product.stock || 20) - halfStock), specialOfferStock: Math.max(0, (product.specialOfferStock || 0) - halfQuota) },
      ]);
    } else {
      setSizes([
        { name: 'نیم کیلوگرم (۵۰۰ گرم)', price: 200000, stock: 15, specialOfferStock: 2 },
        { name: 'یک کیلوگرم (۱۰۰۰ گرم)', price: 380000, stock: 10, specialOfferStock: 2 },
      ]);
    }
    setShortDescription(product.shortDescription || product.description || '');
    setDescription(product.content || product.description || '');
    setProductCategoryId(product.categoryId ?? product.productCategoryId ?? (categories[0]?.id || 1));
    const cover = product.imageName || PRESET_PRODUCT_IMAGES[0].url;
    setImageName(cover);
    setImageAlt(product.imageAlt || `${product.title} - فروشگاه اونیوال`);

    const currentImages = Array.isArray(product.images) && product.images.length > 0
      ? product.images
      : [cover];
    setImages(currentImages);
    setNewImageInput('');
    setVideoUrl(product.videoUrl || '');
    setVideoType(product.videoType || 'direct');
    setImageAspectRatio(product.imageAspectRatio || 'square');
    setImageFitMode(product.imageFitMode || 'cover');
    setImageZoomLevel(product.imageZoomLevel || 2);

    setDiscountPercent(product.discount ?? product.discountPercent ?? 0);
    setIsAmazingOffer(Boolean(product.isAmazingOffer || product.isSpecialOffer || (product.discount ?? 0) > 0));
    setStock(product.stock !== undefined ? product.stock : 20);
    setSpecialOfferStock(product.specialOfferStock !== undefined ? product.specialOfferStock : (product.discount ? 3 : 0));
    setStatus(product.status || 'published');
    setAvailability(product.availability || ((product.stock !== undefined && product.stock <= 0) ? 'OutOfStock' : 'InStock'));
    setSku(product.sku || `ONV-${product.id}`);
    setBrand(product.brand || 'اونیوال | ONIVAL');
    setSeoTitle(product.seoTitle || '');
    setSeoDescription(product.seoDescription || '');
    setCanonicalUrl(product.canonicalUrl || '');
    setOgTitle(product.ogTitle || '');
    setOgDescription(product.ogDescription || '');
    setOgImage(product.ogImage || '');
    setRobotsNoIndex(Boolean(product.robotsNoIndex));
    setRobotsNoFollow(Boolean(product.robotsNoFollow));
    setIsModalOpen(true);
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const url = reader.result;
        setImageName(url);
        if (!images.includes(url)) {
          setImages([url, ...images]);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleMultipleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const url = reader.result;
          setImages((prev) => {
            if (prev.includes(url)) return prev;
            return [...prev, url];
          });
          setImageName((curr) => curr || url);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleAddImageByUrl = () => {
    const trimmed = newImageInput.trim();
    if (!trimmed) return;
    if (!images.includes(trimmed)) {
      setImages([...images, trimmed]);
      if (!imageName) setImageName(trimmed);
    }
    setNewImageInput('');
  };

  const handleRemoveImage = (indexToRemove: number) => {
    const removedUrl = images[indexToRemove];
    const nextImages = images.filter((_, idx) => idx !== indexToRemove);
    setImages(nextImages);
    if (imageName === removedUrl) {
      setImageName(nextImages[0] || PRESET_PRODUCT_IMAGES[0].url);
    }
  };

  const handleSetAsCover = (url: string) => {
    setImageName(url);
  };

  const handleMoveImage = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    const reordered = [...images];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    setImages(reordered);
  };

  const handleVideoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 80 * 1024 * 1024) {
      setFormError('حجم فایل ویدیو حداکثر می‌تواند ۸۰ مگابایت باشد.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setVideoUrl(reader.result);
        setVideoType('direct');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleVideoUrlChange = (val: string) => {
    const trimmed = val.trim();
    setVideoUrl(trimmed);
    if (trimmed.includes('aparat.com')) {
      setVideoType('aparat');
    } else if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
      setVideoType('youtube');
    } else {
      setVideoType('direct');
    }
  };

  const handleAddSizeRow = () => {
    setSizes([...sizes, { name: '', price: 0, stock: 10, specialOfferStock: 0, isOutOfStock: false }]);
  };

  const handleRemoveSizeRow = (index: number) => {
    if (sizes.length <= 1) return;
    setSizes(sizes.filter((_, idx) => idx !== index));
  };

  const handleSizeChange = (
    index: number,
    field: 'name' | 'price' | 'stock' | 'specialOfferStock',
    val: string
  ) => {
    const updated = [...sizes];
    if (field === 'name') {
      updated[index].name = val;
    } else if (field === 'price') {
      updated[index].price = Math.max(0, Number(val) || 0);
    } else if (field === 'stock') {
      const stockVal = Math.max(0, parseInt(val, 10) || 0);
      updated[index].stock = stockVal;
      updated[index].isOutOfStock = stockVal <= 0;
    } else if (field === 'specialOfferStock') {
      updated[index].specialOfferStock = Math.max(0, parseInt(val, 10) || 0);
    }
    setSizes(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim()) {
      setFormError('عنوان محصول الزامی است.');
      return;
    }

    const candidateSlug = sanitizeSlug(slug || title, 'product', editingProduct?.id);
    if (isSlugDuplicate(products, candidateSlug, editingProduct?.id)) {
      setFormError(`اسلاگ «${candidateSlug}» تکراری است و قبلاً برای محصول دیگری ثبت شده است.`);
      setActiveModalTab('seo');
      return;
    }

    const validSizes = hasSize
      ? sizes
          .filter((s) => s.name.trim() !== '')
          .map((s) => {
            const rowStock = Math.max(0, Number(s.stock !== undefined ? s.stock : 10));
            const rowOffer = Math.max(0, Number(s.specialOfferStock !== undefined ? s.specialOfferStock : 0));
            return {
              name: s.name.trim(),
              price: Math.max(0, Number(s.price) || 0),
              stock: rowStock,
              specialOfferStock: rowOffer,
              isOutOfStock: rowStock <= 0,
              sku: s.sku || undefined,
            };
          })
      : [];

    const basePrice =
      hasSize && validSizes.length > 0 ? validSizes[0].price : Number(price) || 0;

    const resolvedDiscount = Math.min(90, Math.max(0, Number(discountPercent) || 0));
    const resolvedShortDesc = shortDescription.trim() || `${title.trim()} با تضمین اصالت و کیفیت آزمایشگاهی`;
    const resolvedFullContent = description.trim() || resolvedShortDesc || title.trim();

    const resolvedCover = imageName.trim() || images[0] || PRESET_PRODUCT_IMAGES[0].url;
    const resolvedImages = images.length > 0 ? images : [resolvedCover];
    if (!resolvedImages.includes(resolvedCover)) {
      resolvedImages.unshift(resolvedCover);
    }

    const computedTotalStock = hasSize && validSizes.length > 0
      ? validSizes.reduce((sum, s) => sum + (s.stock ?? 0), 0)
      : Math.max(0, Number(stock) || 0);

    const computedTotalOfferStock = hasSize && validSizes.length > 0
      ? validSizes.reduce((sum, s) => sum + (s.specialOfferStock ?? 0), 0)
      : (isAmazingOffer || resolvedDiscount > 0 ? Math.max(0, Number(specialOfferStock) || 0) : 0);

    const payload: Partial<Product> = {
      title: title.trim(),
      slug: candidateSlug,
      price: basePrice,
      hasSize,
      sizes: hasSize ? validSizes : [],
      priceSmall: hasSize && validSizes[0] ? validSizes[0].price : undefined,
      priceLarge: hasSize && validSizes[1] ? validSizes[1].price : undefined,
      shortDescription: resolvedShortDesc,
      description: resolvedShortDesc,
      content: resolvedFullContent,
      categoryId: Number(productCategoryId),
      productCategoryId: Number(productCategoryId),
      imageName: resolvedCover,
      imageAlt: imageAlt.trim() || `${title.trim()} - فروشگاه تخصصی اونیوال`,
      images: resolvedImages,
      videoUrl: videoUrl.trim() || undefined,
      videoType: videoUrl.trim() ? videoType : undefined,
      imageAspectRatio,
      imageFitMode,
      discount: resolvedDiscount,
      discountPercent: resolvedDiscount,
      isAmazingOffer,
      isSpecialOffer: Boolean(isAmazingOffer || (resolvedDiscount > 0 && computedTotalOfferStock > 0)),
      stock: computedTotalStock,
      isOutOfStock: computedTotalStock <= 0,
      specialOfferStock: computedTotalOfferStock,
      specialOfferInitialStock: Math.max(computedTotalOfferStock, editingProduct?.specialOfferInitialStock || computedTotalOfferStock),
      status,
      availability: computedTotalStock <= 0 ? 'OutOfStock' : availability,
      sku: sku.trim() || `ONV-${editingProduct?.id || Date.now()}`,
      brand: brand.trim() || 'اونیوال | ONIVAL',
      seoTitle: seoTitle.trim() || `${title.trim()} | خرید با ضمانت آزمایشگاهی از اونیوال`,
      seoDescription:
        seoDescription.trim() ||
        resolvedShortDesc ||
        resolvedFullContent.slice(0, 155),
      canonicalUrl: canonicalUrl.trim() || undefined,
      ogTitle: ogTitle.trim() || undefined,
      ogDescription: ogDescription.trim() || undefined,
      ogImage: ogImage.trim() || undefined,
      robotsNoIndex,
      robotsNoFollow,
    };

    try {
      if (editingProduct) {
        await onEditProduct(editingProduct.id, payload);
      } else {
        await onAddProduct(payload);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'خطا در ذخیره محصول');
    }
  };

  const filteredProducts = products.filter((p) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      String(p.title || '').toLowerCase().includes(q) ||
      String(p.description || p.shortDescription || '').toLowerCase().includes(q) ||
      String(p.slug || '').toLowerCase().includes(q);
    const catId = p.categoryId ?? p.productCategoryId;
    const matchesCategory =
      selectedCategory === 'all' || catId === Number(selectedCategory);
    const pStatus = p.status || 'published';
    const matchesStatus = statusFilter === 'all' || pStatus === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus && !p.isDelete;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fa-IR').format(amount) + ' تومان';
  };

  const previewSlug = sanitizeSlug(slug || title, 'product', editingProduct?.id);
  const previewTitle =
    seoTitle.trim() || `${title || 'عنوان محصول'} | خرید آنلاین از فروشگاه اونیوال`;
  const previewDesc =
    seoDescription.trim() ||
    shortDescription.trim() ||
    'توضیحات متا محصول در نتایج جستجوی گوگل در این بخش نمایش داده می‌شود...';

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="جستجو در نام، اسلاگ یا توضیحات محصول..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) =>
              setSelectedCategory(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">همه دسته‌بندی‌ها</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">همه وضعیت‌های انتشار</option>
            <option value="published">منتشرشده (عمومی و در Sitemap)</option>
            <option value="draft">پیش‌نویس (مخفی از فروشگاه و گوگل)</option>
          </select>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          افزودن محصول جدید
        </button>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredProducts.map((product) => {
          const isDraft = product.status === 'draft';
          return (
            <div
              key={product.id}
              className={`bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group ${
                isDraft ? 'border-amber-300 bg-amber-50/10' : 'border-slate-200/70'
              }`}
            >
              <div>
                <div className="h-48 bg-slate-100 relative overflow-hidden">
                  <img
                    src={product.imageName || PRESET_PRODUCT_IMAGES[0].url}
                    alt={product.imageAlt || product.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />

                  <div className="absolute top-3 right-3 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/90 text-slate-800 backdrop-blur-sm shadow-sm">
                      <Tag className="w-3 h-3 text-blue-600" />
                      {product.categoryTitle || product.productCategoryTitle || 'عمومی'}
                    </span>

                    {isDraft ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-sm">
                        <EyeOff className="w-3 h-3" />
                        پیش‌نویس
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-sm">
                        <Eye className="w-3 h-3" />
                        منتشرشده
                      </span>
                    )}

                    {(product.stock !== undefined && product.stock <= 0) || product.availability === 'OutOfStock' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-900 text-white shadow-sm">
                        ناموجود
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-700 text-white shadow-sm">
                        موجودی: {product.stock ?? 20} عدد
                      </span>
                    )}

                    {(product.discount ?? product.discountPercent ?? 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-600 text-white shadow-sm">
                        {product.discount ?? product.discountPercent}٪ تخفیف
                        {product.specialOfferStock !== undefined && product.specialOfferStock > 0 ? ` (سهمیه: ${product.specialOfferStock})` : ''}
                      </span>
                    ) : null}
                  </div>

                  <div className="absolute bottom-3 right-3 left-3 flex items-center justify-between text-white">
                    <span className="font-bold text-base truncate">{product.title}</span>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono" dir="ltr">
                    <span className="truncate">/products/{product.slug}</span>
                    <span className={product.robotsNoIndex ? 'text-rose-500 font-bold' : 'text-emerald-600 font-bold'}>
                      {product.robotsNoIndex ? 'noindex' : 'index'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 min-h-[2rem]">
                    {product.description || product.shortDescription}
                  </p>

                  <div className="pt-2 border-t border-slate-100">
                    {product.hasSize && product.sizes && product.sizes.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold text-slate-400">
                          سایزها و قیمت‌ها:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {product.sizes.map((s, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                            >
                              <span className="text-slate-600 font-medium">{s.name}:</span>
                              <span className="font-bold text-blue-600">
                                {formatCurrency(s.price)}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">قیمت محصول:</span>
                        <span className="font-bold text-slate-800">
                          {formatCurrency(product.price)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                <a
                  href={`/products/${encodeURIComponent(product.slug)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
                >
                  <Globe className="w-3.5 h-3.5" />
                  مشاهده صفحه سئو
                </a>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(product)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    ویرایش و سئو
                  </button>
                  <button
                    onClick={() => onDeleteProduct(product.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    حذف
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredProducts.length === 0 && (
          <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-slate-200/60">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700">محصولی یافت نشد</h3>
            <p className="text-xs text-slate-400 mt-1">
              هیچ محصولی با فیلترهای انتخاب شده مطابقت ندارد.
            </p>
          </div>
        )}
      </div>

      {/* Add / Edit Modal with SEO & Structured Data Tab */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editingProduct ? 'ویرایش محصول و تنظیمات سئو' : 'افزودن محصول جدید به فروشگاه'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-1.5 mt-4 bg-slate-100 p-1.5 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveModalTab('general')}
                className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeModalTab === 'general'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                ۱. مشخصات و قیمت
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('media')}
                className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeModalTab === 'media'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Images className="w-3.5 h-3.5" />
                ۲. چند عکس، ویدیو و زوم ({images.length} عکس{videoUrl ? ' + ویدیو' : ''})
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('seo')}
                className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeModalTab === 'seo'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                ۳. تنظیمات سئو و انتشار
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {activeModalTab === 'general' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        عنوان محصول *
                      </label>
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => {
                          setTitle(e.target.value);
                          if (!editingProduct && !slug) {
                            setSlug(sanitizeSlug(e.target.value, 'product'));
                          }
                        }}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="مثلاً: عسل کوهستان اردبیل"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        وضعیت انتشار و نمایش
                      </label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as PublicationStatus)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="published">منتشرشده (نمایش در فروشگاه و نقشه سایت گوگل)</option>
                        <option value="draft">پیش‌نویس (مخفی از مشتریان و موتورهای جستجو)</option>
                      </select>
                    </div>
                  </div>

                  {/* Quick Cover Preview Banner with Media Tab Shortcut */}
                  <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 h-14 rounded-xl bg-slate-200 border border-slate-300 overflow-hidden shrink-0">
                        {imageName ? (
                          <img src={imageName} alt="کاور اصلی" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 text-[10px]">
                            بدون عکس
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                          <Images className="w-4 h-4 text-blue-600" />
                          <span>گالری تصاویر و ویدیو ({images.length} تصویر {videoUrl ? '• ۱ ویدیو' : ''})</span>
                        </div>
                        <p className="text-[11px] text-blue-800/80 mt-0.5">
                          برای آپلود چند عکس همزمان، ویدیو و تنظیم کادر و زوم به تب دوم بروید.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveModalTab('media')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shrink-0 cursor-pointer text-center"
                    >
                      مدیریت گالری، ویدیو و زوم (تب ۲)
                    </button>
                  </div>

                  {/* Category, Inventory Stock & Pricing */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        دسته‌بندی محصول
                      </label>
                      <select
                        value={productCategoryId}
                        onChange={(e) => setProductCategoryId(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        موجودی انبار (تعداد کل) *
                      </label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={stock}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                          setStock(val);
                          if (val === 0) {
                            setAvailability('OutOfStock');
                          } else if (availability === 'OutOfStock') {
                            setAvailability('InStock');
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="مثلاً: 25"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        وضعیت عرضه و فروش
                      </label>
                      <select
                        value={availability}
                        onChange={(e) => {
                          const newAvail = e.target.value as StockAvailability;
                          setAvailability(newAvail);
                          if (newAvail === 'OutOfStock' && stock > 0) {
                            setStock(0);
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="InStock">موجود در انبار (InStock)</option>
                        <option value="OutOfStock">ناموجود (OutOfStock)</option>
                        <option value="PreOrder">پیش‌فروش (PreOrder)</option>
                      </select>
                    </div>

                    {!hasSize && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          قیمت تک‌سایز (تومان) *
                        </label>
                        <input
                          type="number"
                          required={!hasSize}
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          placeholder="مثلاً: 250000"
                        />
                      </div>
                    )}
                  </div>

                  {/* Discount & Amazing Offer with Quota Control */}
                  <div className="p-4 bg-rose-50/60 rounded-2xl border border-rose-200/70 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Percent className="w-4 h-4 text-rose-600" />
                        <span className="text-xs font-bold text-slate-800">
                          تنظیمات تخفیف و سهمیه پیشنهاد شگفت‌انگیز
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {[0, 10, 15, 20, 30, 50].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setDiscountPercent(preset);
                              if (preset > 0 && specialOfferStock === 0) {
                                setSpecialOfferStock(3);
                              }
                            }}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                              discountPercent === preset
                                ? 'bg-rose-600 text-white shadow-sm'
                                : 'bg-white text-slate-600 border border-slate-200 hover:border-rose-300'
                            }`}
                          >
                            {preset === 0 ? 'بدون تخفیف' : `${preset}٪`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          درصد تخفیف (۰ تا ۹۰ درصد)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={90}
                          value={discountPercent}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setDiscountPercent(val);
                            if (val > 0 && specialOfferStock === 0) {
                              setSpecialOfferStock(3);
                            }
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          سهمیه فروش در تخفیف (عدد)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={specialOfferStock}
                          onChange={(e) => setSpecialOfferStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                          placeholder="مثلاً: 3"
                        />
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          پس از فروش این تعداد، تخفیف منقضی و قیمت عادی اعمال می‌شود.
                        </span>
                      </div>

                      <div className="flex items-start pt-5">
                        <label className="flex items-center gap-2.5 w-full px-3 py-2 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-rose-300 transition">
                          <input
                            type="checkbox"
                            checked={isAmazingOffer}
                            onChange={(e) => {
                              setIsAmazingOffer(e.target.checked);
                              if (e.target.checked && specialOfferStock === 0) {
                                setSpecialOfferStock(3);
                              }
                            }}
                            className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500"
                          />
                          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                          <span className="text-xs font-bold text-slate-700">
                            اسلایدر «شگفت‌انگیز»
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Multi-size toggle */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          id="hasSizeToggle"
                          checked={hasSize}
                          onChange={(e) => setHasSize(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <label
                          htmlFor="hasSizeToggle"
                          className="text-xs font-bold text-slate-700 cursor-pointer"
                        >
                          این محصول دارای وزن‌ها / سایزهای متنوع با قیمت‌های متفاوت است
                        </label>
                      </div>

                      {hasSize && (
                        <button
                          type="button"
                          onClick={handleAddSizeRow}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                        >
                          <ListPlus className="w-3.5 h-3.5" />
                          افزودن سایز جدید
                        </button>
                      )}
                    </div>

                    {hasSize && (
                      <div className="space-y-3 pt-3 border-t border-slate-200/80">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] bg-blue-50/70 p-2.5 rounded-xl border border-blue-200/60 text-blue-900">
                          <span className="font-bold">
                            📦 مدیریت موجودی انبار و سهمیه تخفیف هر بسته‌بندی:
                          </span>
                          <span>
                            مجموع موجودی کل: <strong className="text-blue-700 font-black">{sizes.reduce((sum, s) => sum + (Number(s.stock) || 0), 0)} عدد</strong>
                            {' '} | سهمیه تخفیف کل: <strong className="text-amber-700 font-black">{sizes.reduce((sum, s) => sum + (Number(s.specialOfferStock) || 0), 0)} عدد</strong>
                          </span>
                        </div>

                        {/* Column Header Titles */}
                        <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-2 text-[11px] font-bold text-slate-500">
                          <div className="col-span-4">عنوان اندازه / بسته‌بندی</div>
                          <div className="col-span-3">قیمت (تومان)</div>
                          <div className="col-span-2">موجودی انبار</div>
                          <div className="col-span-2">سهمیه تخفیف</div>
                          <div className="col-span-1 text-center">حذف</div>
                        </div>

                        <div className="space-y-2">
                          {sizes.map((s, idx) => (
                            <div
                              key={idx}
                              className="p-3 sm:p-2 bg-white border border-slate-200 rounded-xl flex flex-col sm:grid sm:grid-cols-12 gap-2 sm:items-center shadow-2xs"
                            >
                              <div className="sm:col-span-4">
                                <label className="sm:hidden block text-[10px] font-bold text-slate-600 mb-1">
                                  عنوان بسته / اندازه:
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={s.name}
                                  onChange={(e) => handleSizeChange(idx, 'name', e.target.value)}
                                  placeholder="مثلاً: ۵۰۰ گرم یا قوطی شیشه‌ای"
                                  className="w-full px-3 py-1.5 bg-slate-50 sm:bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                              </div>

                              <div className="sm:col-span-3">
                                <label className="sm:hidden block text-[10px] font-bold text-slate-600 mb-1">
                                  قیمت (تومان):
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  required
                                  value={s.price}
                                  onChange={(e) => handleSizeChange(idx, 'price', e.target.value)}
                                  placeholder="قیمت (تومان)"
                                  className="w-full px-3 py-1.5 bg-slate-50 sm:bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <label className="sm:hidden block text-[10px] font-bold text-slate-600 mb-1">
                                  موجودی انبار (عدد):
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  value={s.stock !== undefined ? s.stock : 10}
                                  onChange={(e) => handleSizeChange(idx, 'stock', e.target.value)}
                                  placeholder="موجودی"
                                  title="تعداد موجودی فیزیکی این بسته‌بندی در انبار"
                                  className={`w-full px-3 py-1.5 border rounded-lg text-xs font-black focus:outline-none focus:ring-2 ${
                                    (s.stock !== undefined && s.stock <= 0)
                                      ? 'bg-rose-50 border-rose-300 text-rose-700 focus:ring-rose-500/20'
                                      : 'bg-emerald-50 sm:bg-white border-slate-200 text-emerald-800 focus:ring-emerald-500/20'
                                  }`}
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <label className="sm:hidden block text-[10px] font-bold text-slate-600 mb-1">
                                  سهمیه تخفیف (عدد):
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  value={s.specialOfferStock !== undefined ? s.specialOfferStock : 0}
                                  onChange={(e) => handleSizeChange(idx, 'specialOfferStock', e.target.value)}
                                  placeholder="سهمیه تخفیف"
                                  title="تعداد مجاز برای فروش با نرخ تخفیفی در شگفت‌انگیز (پس از فروش، با قیمت عادی فروخته می‌شود)"
                                  className="w-full px-3 py-1.5 bg-amber-50 sm:bg-white border border-slate-200 rounded-lg text-xs font-bold text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                />
                              </div>

                              <div className="sm:col-span-1 flex justify-end sm:justify-center pt-1 sm:pt-0">
                                {sizes.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSizeRow(idx)}
                                    title="حذف این بسته‌بندی"
                                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      توضیحات کوتاه (نمایش در کارت محصول و خلاصه بالای صفحه) *
                    </label>
                    <input
                      type="text"
                      required
                      value={shortDescription}
                      onChange={(e) => setShortDescription(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="خلاصه یک خطی از ویژگی‌های محصول..."
                    />
                  </div>
                </>
              ) : activeModalTab === 'media' ? (
                /* ================= TAB 2: MULTI-IMAGE, VIDEO & ZOOM SETTINGS ================= */
                <div className="space-y-6 animate-fadeIn">
                  {/* 1. Multiple Images Gallery Section */}
                  <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                      <div>
                        <div className="text-sm font-black text-slate-900 flex items-center gap-2">
                          <Images className="w-4 h-4 text-blue-600" />
                          <span>گالری عکس‌های محصول (آپلود چند عکس)</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          می‌توانید چندین تصویر باکیفیت از زاویه‌ها، بسته‌بندی و جزئیات محصول قرار دهید. عکسی که دارای ستاره طلایی است، کاور اصلی محصول خواهد بود.
                        </p>
                      </div>

                      <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold self-start sm:self-auto">
                        {images.length} تصویر
                      </span>
                    </div>

                    {/* Image Actions: Multi-File Upload & URL Adder */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs shrink-0">
                        <Upload className="w-4 h-4" />
                        <span>آپلود چند عکس همزمان از کامپیوتر</span>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleMultipleImageUpload}
                          className="hidden"
                        />
                      </label>

                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          value={newImageInput}
                          onChange={(e) => setNewImageInput(e.target.value)}
                          placeholder="افزودن با آدرس اینترنتی عکس (https://...)"
                          dir="ltr"
                          className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20"
                        />
                        <button
                          type="button"
                          onClick={handleAddImageByUrl}
                          disabled={!newImageInput.trim()}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition shrink-0 cursor-pointer"
                        >
                          افزودن
                        </button>
                      </div>
                    </div>

                    {/* Thumbnails Grid with Star / Reorder / Delete */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                      {images.map((imgUrl, idx) => {
                        const isCover = imageName === imgUrl;
                        return (
                          <div
                            key={idx}
                            className={`group relative rounded-2xl overflow-hidden border-2 bg-white transition shadow-xs ${
                              isCover ? 'border-amber-500 ring-2 ring-amber-400/20' : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="aspect-square w-full overflow-hidden bg-slate-100 relative">
                              <img src={imgUrl} alt={`عکس ${idx + 1}`} className="w-full h-full object-cover" />
                              <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                                #{idx + 1}
                              </div>

                              {isCover && (
                                <div className="absolute bottom-2 right-2 left-2 bg-amber-500 text-stone-950 text-[10px] font-black px-2 py-1 rounded-lg text-center flex items-center justify-center gap-1 shadow-md">
                                  <Star className="w-3 h-3 fill-current" />
                                  <span>کاور اصلی</span>
                                </div>
                              )}
                            </div>

                            <div className="p-2 bg-white flex items-center justify-between gap-1 border-t border-slate-100">
                              {!isCover ? (
                                <button
                                  type="button"
                                  onClick={() => handleSetAsCover(imgUrl)}
                                  className="text-[10px] font-bold text-slate-600 hover:text-amber-700 flex items-center gap-1 p-1 rounded-md hover:bg-amber-50 transition cursor-pointer"
                                  title="انتخاب به عنوان کاور اصلی"
                                >
                                  <Star className="w-3.5 h-3.5" />
                                  <span>انتخاب کاور</span>
                                </button>
                              ) : (
                                <span className="text-[10px] font-black text-amber-600">کاور فعال</span>
                              )}

                              <div className="flex items-center gap-1">
                                {idx > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleMoveImage(idx, 'up')}
                                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                                    title="حرکت به راست"
                                  >
                                    <MoveRight className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {idx < images.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleMoveImage(idx, 'down')}
                                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                                    title="حرکت به چپ"
                                  >
                                    <MoveLeft className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveImage(idx)}
                                  className="p-1 rounded text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                                  title="حذف این تصویر"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Presets Quick Picker */}
                    <div className="pt-2 border-t border-slate-200/80">
                      <span className="block text-[11px] text-slate-500 mb-1.5 font-bold">
                        یا افزودن سریع از تصاویر آماده عسل و فرآورده‌های طبیعی:
                      </span>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {PRESET_PRODUCT_IMAGES.map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (!images.includes(preset.url)) {
                                setImages([...images, preset.url]);
                              }
                              if (!imageName) setImageName(preset.url);
                            }}
                            className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-200 hover:border-blue-500 transition shrink-0 cursor-pointer group"
                            title={`افزودن ${preset.label}`}
                          >
                            <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition">
                              + افزودن
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Alt Text for Google Images SEO */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        متن جایگزین عکس اصلی (Image Alt Text برای سئو تصاویر گوگل):
                      </label>
                      <input
                        type="text"
                        value={imageAlt}
                        onChange={(e) => setImageAlt(e.target.value)}
                        placeholder="مثال: شیشه عسل خالص کوهستان سبلان ۱۰۰۰ گرمی اونیوال"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  {/* 2. Product Video Section */}
                  <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                      <div>
                        <div className="text-sm font-black text-slate-900 flex items-center gap-2">
                          <Video className="w-4 h-4 text-emerald-600" />
                          <span>ویدیو محصول (تیزر معرفی، ویدیو تبلیغاتی یا بررسی تصویری)</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          امکان آپلود مستقیم ویدیو یا قراردادن لینک ویدیو از آپارات، یوتیوب یا لینک فایل MP4
                        </p>
                      </div>

                      {videoUrl && (
                        <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1">
                          <Film className="w-3.5 h-3.5" />
                          <span>دارای ویدیو</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 space-y-2">
                        <label className="block text-xs font-bold text-slate-700">
                          لینک ویدیو یا کد Embed آپارات / یوتیوب:
                        </label>
                        <input
                          type="text"
                          value={videoUrl}
                          onChange={(e) => handleVideoUrlChange(e.target.value)}
                          placeholder="مثلاً: https://www.aparat.com/v/... یا لینک مستقیم MP4"
                          dir="ltr"
                          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-2">
                          یا آپلود مستقیم فایل ویدیو:
                        </label>
                        <label className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer transition">
                          <Upload className="w-4 h-4 text-emerald-600" />
                          <span>انتخاب فایل MP4</span>
                          <input
                            type="file"
                            accept="video/mp4,video/webm"
                            onChange={handleVideoFileUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Live Video Player Preview */}
                    {videoUrl && (
                      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>پیش‌نمایش زنده ویدیو در صفحه محصول:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setVideoUrl('');
                              setVideoType('direct');
                            }}
                            className="text-rose-600 hover:text-rose-800 text-xs flex items-center gap-1 font-bold cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            حذف ویدیو
                          </button>
                        </div>

                        <div className="aspect-video w-full max-w-lg mx-auto rounded-xl overflow-hidden bg-black flex items-center justify-center shadow-inner">
                          {videoType === 'aparat' || videoUrl.includes('aparat.com') ? (
                            <iframe
                              src={
                                videoUrl.includes('/v/')
                                  ? videoUrl.replace('/v/', '/video/video/embed/videohash/') + '/vt/frame'
                                  : videoUrl
                              }
                              title="پیش‌نمایش ویدیو آپارات"
                              allowFullScreen
                              className="w-full h-full border-0"
                            />
                          ) : videoType === 'youtube' || videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be') ? (
                            <iframe
                              src={
                                videoUrl.includes('watch?v=')
                                  ? videoUrl.replace('watch?v=', 'embed/')
                                  : videoUrl.includes('youtu.be/')
                                  ? videoUrl.replace('youtu.be/', 'www.youtube.com/embed/')
                                  : videoUrl
                              }
                              title="پیش‌نمایش ویدیو یوتیوب"
                              allowFullScreen
                              className="w-full h-full border-0"
                            />
                          ) : (
                            <video controls className="w-full h-full object-contain" src={videoUrl} />
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Image Frame Ratio & Zoom Settings */}
                  <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                    <div className="pb-3 border-b border-slate-200">
                      <div className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-amber-600" />
                        <span>تنظیمات کادر عکس‌های محصول و میزان زوم (Frame & Zoom Settings)</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        تنظیم نسبت ابعاد کادر تصویر و قدرت بزرگنمایی ذره‌بین و لایت‌باکس در صفحه فروشگاه
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Aspect Ratio */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          نسبت کادر عکس (Aspect Ratio)
                        </label>
                        <select
                          value={imageAspectRatio}
                          onChange={(e) => setImageAspectRatio(e.target.value as any)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500/20"
                        >
                          <option value="square">مربع ۱:۱ (پیش‌نهادی استاندارد فروشگاهی)</option>
                          <option value="portrait">پرتره عمودی ۴:۵ (مناسب بطری و شیشه)</option>
                          <option value="wide">عریض ۱۶:۹ (افقی و سینمایی)</option>
                          <option value="auto">آزاد و طبیعی (بدون محدودیت نسبت)</option>
                        </select>
                      </div>

                      {/* Fit Mode */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          حالت جاگیری عکس در کادر (Fit Mode)
                        </label>
                        <select
                          value={imageFitMode}
                          onChange={(e) => setImageFitMode(e.target.value as any)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500/20"
                        >
                          <option value="cover">Cover (پر کردن تمام کادر بدون حاشیه)</option>
                          <option value="contain">Contain (نمایش کامل کل عکس با حاشیه بدون برش)</option>
                        </select>
                      </div>

                      {/* Zoom Level */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                          <ZoomIn className="w-3.5 h-3.5 text-amber-600" />
                          <span>قدرت زوم بزرگنمایی: {imageZoomLevel}x برابر</span>
                        </label>
                        <div className="grid grid-cols-4 gap-1 bg-white p-1 rounded-xl border border-slate-200">
                          {[1.5, 2, 2.5, 3].map((lvl) => (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => setImageZoomLevel(lvl)}
                              className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                imageZoomLevel === lvl
                                  ? 'bg-amber-500 text-stone-950 font-black shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {lvl}x
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* SEO & Structured Data Tab */
                <div className="space-y-4">
                  {/* Live Google SERP Preview */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-400">
                      پیش‌نمایش زنده نتیجه در جستجوی گوگل (Google SERP Preview):
                    </div>
                    <div className="text-xs text-emerald-700 font-mono truncate" dir="ltr">
                      {typeof window !== 'undefined' ? window.location.origin : 'https://onival.ir'}/products/{previewSlug}
                    </div>
                    <div className="text-base font-bold text-blue-700 hover:underline truncate">
                      {previewTitle}
                    </div>
                    <div className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {previewDesc}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        آدرس یکتای محصول (URL Slug) *
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="sabalan-natural-honey"
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        در صورت تغییر اسلاگ محصول قبلی، ریدایرکت ۳۰۱ خودکار ثبت می‌شود.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        کد شناسه کالا (SKU در اسکیمای Product)
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={sku}
                        onChange={(e) => setSku(e.target.value)}
                        placeholder="ONV-101"
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      عنوان سئو اختصاصی (SEO Meta Title)
                    </label>
                    <input
                      type="text"
                      value={seoTitle}
                      onChange={(e) => setSeoTitle(e.target.value)}
                      placeholder={`${title || 'نام محصول'} | خرید با برگه آزمایشگاهی از اونیوال`}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                      <span>در صورت خالی بودن، از عنوان محصول به صورت هوشمند ساخته می‌شود.</span>
                      <span>{seoTitle.length} / 60</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      توضیحات متا سئو (SEO Meta Description)
                    </label>
                    <textarea
                      rows={3}
                      value={seoDescription}
                      onChange={(e) => setSeoDescription(e.target.value)}
                      placeholder="توضیحات جذاب شامل مزایا، خلوص و ارسال سریع برای جذب کلیک در نتایج گوگل..."
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                      <span>پیشنهاد استاندارد: ۱۲۰ تا ۱۵۵ کاراکتر</span>
                      <span>{seoDescription.length} / 160</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        برند محصول (Brand Schema)
                      </label>
                      <input
                        type="text"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        آدرس Canonical سفارشی (اختیاری)
                      </label>
                      <input
                        type="url"
                        dir="ltr"
                        value={canonicalUrl}
                        onChange={(e) => setCanonicalUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Advanced Indexing Controls */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={robotsNoIndex}
                        onChange={(e) => setRobotsNoIndex(e.target.checked)}
                        className="w-4 h-4 text-rose-600 rounded"
                      />
                      <span className="text-xs font-bold text-slate-700">
                        عدم ایندکس در گوگل (<code dir="ltr">noindex</code>)
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={robotsNoFollow}
                        onChange={(e) => setRobotsNoFollow(e.target.checked)}
                        className="w-4 h-4 text-rose-600 rounded"
                      />
                      <span className="text-xs font-bold text-slate-700">
                        عدم دنبال کردن لینک‌ها (<code dir="ltr">nofollow</code>)
                      </span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
                >
                  {editingProduct ? 'ذخیره تغییرات و بروزرسانی سئو' : 'ثبت و انتشار محصول'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

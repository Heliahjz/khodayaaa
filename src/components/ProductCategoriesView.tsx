import React, { useState } from 'react';
import { ProductCategory, PublicationStatus } from '../types';
import {
  Plus,
  Trash2,
  Edit2,
  Layers,
  CornerDownLeft,
  Globe,
  X,
  AlertCircle
} from 'lucide-react';
import { sanitizeSlug, isSlugDuplicate } from '../utils/seo';

interface ProductCategoriesViewProps {
  categories: ProductCategory[];
  onAddCategory: (category: Partial<ProductCategory>) => Promise<void>;
  onEditCategory?: (id: number, category: Partial<ProductCategory>) => Promise<void>;
  onDeleteCategory: (id: number) => Promise<void>;
}

export const ProductCategoriesView: React.FC<ProductCategoriesViewProps> = ({
  categories,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
}) => {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState<string>('none');
  const [description, setDescription] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [status, setStatus] = useState<PublicationStatus>('published');
  const [editingCat, setEditingCat] = useState<ProductCategory | null>(null);
  const [formError, setFormError] = useState('');

  const resetForm = () => {
    setEditingCat(null);
    setTitle('');
    setSlug('');
    setParentId('none');
    setDescription('');
    setSeoTitle('');
    setSeoDescription('');
    setStatus('published');
    setFormError('');
  };

  const startEdit = (cat: ProductCategory) => {
    setEditingCat(cat);
    setTitle(cat.title);
    setSlug(cat.slug || '');
    setParentId(cat.parentId ? String(cat.parentId) : 'none');
    setDescription(cat.description || '');
    setSeoTitle(cat.seoTitle || '');
    setSeoDescription(cat.seoDescription || '');
    setStatus(cat.status || 'published');
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!title.trim()) return;

    const candidateSlug = sanitizeSlug(slug || title, 'category', editingCat?.id);
    if (isSlugDuplicate(categories, candidateSlug, editingCat?.id)) {
      setFormError(`اسلاگ «${candidateSlug}» تکراری است.`);
      return;
    }

    const payload: Partial<ProductCategory> = {
      title: title.trim(),
      slug: candidateSlug,
      parentId: parentId === 'none' ? null : Number(parentId),
      description: description.trim() || `خرید آنلاین انواع ${title.trim()} اصل از فروشگاه اونیوال`,
      seoTitle: seoTitle.trim() || `خرید ${title.trim()} اصل با ضمانت آزمایشگاهی | اونیوال`,
      seoDescription:
        seoDescription.trim() ||
        description.trim() ||
        `لیست قیمت و خرید آنلاین انواع ${title.trim()} طبیعی و ارگانیک با برگه آزمایشگاهی در فروشگاه اونیوال.`,
      status,
    };

    if (editingCat && onEditCategory) {
      await onEditCategory(editingCat.id, payload);
    } else {
      await onAddCategory(payload);
    }
    resetForm();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Add/Edit Category Form */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm h-fit">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            {editingCat ? `ویرایش دسته‌بندی: ${editingCat.title}` : 'افزودن دسته‌بندی محصول'}
          </h3>
          {editingCat && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              انصراف
            </button>
          )}
        </div>

        {formError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              عنوان دسته‌بندی *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!editingCat && !slug) {
                  setSlug(sanitizeSlug(e.target.value, 'category'));
                }
              }}
              placeholder="مثلاً: عسل‌های دارویی"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              آدرس یکتا (URL Slug) *
            </label>
            <input
              type="text"
              dir="ltr"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="natural-honey"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                دسته‌بندی مادر
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="none">بدون دسته مادر</option>
                {categories
                  .filter((c) => !c.parentId && c.id !== editingCat?.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                وضعیت انتشار
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PublicationStatus)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="published">منتشرشده (عمومی)</option>
                <option value="draft">پیش‌نویس (مخفی)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              عنوان سئو (SEO Title)
            </label>
            <input
              type="text"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder="خرید عسل طبیعی با برگه آزمایشگاهی | اونیوال"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              توضیحات سئو دسته‌بندی (Meta Description & Intro)
            </label>
            <textarea
              rows={3}
              value={seoDescription}
              onChange={(e) => {
                setSeoDescription(e.target.value);
                setDescription(e.target.value);
              }}
              placeholder="توضیحات صفحه دسته‌بندی برای نمایش به کاربران و موتور جستجوی گوگل..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {editingCat ? 'ذخیره تغییرات و بروزرسانی سئو' : 'ثبت دسته‌بندی'}
          </button>
        </form>
      </div>

      {/* Categories List */}
      <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-4">
          ساختار درختی و آدرس‌های سئو دسته‌بندی محصولات
        </h3>

        <div className="divide-y divide-slate-100">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="py-3.5 flex items-center justify-between hover:bg-slate-50/80 px-3 rounded-xl transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  {cat.parentId ? (
                    <CornerDownLeft className="w-4 h-4 text-slate-400 mr-4" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                  )}
                  <span
                    className={`text-sm ${
                      cat.parentId ? 'text-slate-700 font-medium' : 'text-slate-900 font-bold'
                    }`}
                  >
                    {cat.title}
                  </span>
                  {cat.parentTitle && (
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md">
                      زیرمجموعه: {cat.parentTitle}
                    </span>
                  )}
                  {cat.status === 'draft' && (
                    <span className="text-[11px] px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md font-bold">
                      پیش‌نویس
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 mr-5">
                  <a
                    href={`/categories/${encodeURIComponent(cat.slug)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="font-mono text-emerald-700 hover:underline inline-flex items-center gap-1"
                  >
                    <Globe className="w-3 h-3" />
                    /categories/{cat.slug}
                  </a>
                  {cat.seoTitle && <span className="truncate max-w-xs">| {cat.seoTitle}</span>}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => startEdit(cat)}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="ویرایش سئو دسته‌بندی"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDeleteCategory(cat.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="حذف دسته‌بندی"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

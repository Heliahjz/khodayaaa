import React, { useState } from 'react';
import { Bookmark, Plus, Trash2, Tag, AlertTriangle, X } from 'lucide-react';
import { PostCategory } from '../types';

interface PostCategoriesViewProps {
  categories: PostCategory[];
  onAddCategory: (cat: { title: string; parentId?: number | null }) => Promise<void>;
  onDeleteCategory: (id: number) => Promise<void>;
}

export const PostCategoriesView: React.FC<PostCategoriesViewProps> = ({
  categories,
  onAddCategory,
  onDeleteCategory,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PostCategory | null>(null);
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddCategory({ title });
      setTitle('');
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      await onDeleteCategory(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-blue-600" />
            <span>دسته‌بندی مقالات و وبلاگ</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            مدیریت سرفصل‌های مقالات تخصصی، راهنماهای باریستا و اخبار انیوال
          </p>
        </div>

        <button
          id="btn-add-post-category"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>افزودن دسته مقاله</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
              <tr>
                <th className="py-3.5 px-4">شناسه</th>
                <th className="py-3.5 px-4">عنوان دسته‌بندی</th>
                <th className="py-3.5 px-4">نامک (Slug)</th>
                <th className="py-3.5 px-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4 font-mono text-xs text-slate-500">
                    #{cat.id}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-800">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-indigo-500" />
                      <span>{cat.title}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-500">
                    {cat.slug}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => setDeleteTarget(cat)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                      title="حذف دسته‌بندی"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-blue-600" />
                <span>افزودن دسته‌بندی مقاله</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  عنوان دسته‌بندی مقاله را وارد کنید <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: راهنمای دم‌آوری، رویدادها..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  {isSubmitting ? 'در حال ثبت...' : 'افزودن دسته'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">
              حذف دسته‌بندی «{deleteTarget.title}»
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              آیا از حذف این دسته‌بندی مقاله اطمینان دارید؟
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition"
              >
                {isSubmitting ? 'در حال حذف...' : 'تأیید و حذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { 
  MessageSquare, 
  Search, 
  Send, 
  Trash2, 
  CheckCircle, 
  Clock, 
  X, 
  Bot, 
  AlertCircle,
  Phone,
  Hash,
  AlertTriangle
} from 'lucide-react';
import { ContactMessage } from '../types';

interface ContactMessagesViewProps {
  messages: ContactMessage[];
  onRespond: (id: number, response: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export const ContactMessagesView: React.FC<ContactMessagesViewProps> = ({
  messages,
  onRespond,
  onDelete,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'unanswered' | 'answered'>('all');
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [responseText, setResponseText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ContactMessage | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openRespondModal = (msg: ContactMessage) => {
    setSelectedMessage(msg);
    setResponseText(msg.adminResponse || '');
  };

  const handleSendResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMessage || !responseText.trim()) return;

    setIsSubmitting(true);
    try {
      await onRespond(selectedMessage.id, responseText);
      setSelectedMessage(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      await onDelete(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const q = (searchTerm || '').trim().toLowerCase();
  const filteredMessages = messages.filter((m) => {
    const matchSearch = !q || (
      (m.fullName || '').toLowerCase().includes(q) ||
      (m.trackingCode || '').toLowerCase().includes(q) ||
      (m.message || '').toLowerCase().includes(q) ||
      (m.phoneNumber || '').toLowerCase().includes(q)
    );

    if (filter === 'unanswered') return matchSearch && !m.isResponded;
    if (filter === 'answered') return matchSearch && m.isResponded;
    return matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-rose-500" />
            <span>پیام‌های پشتیبانی، تماس و ربات انیوال</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            رسیدگی به پیام‌های دریافتی از سایت و ربات بله، پاسخ‌دهی آنلاین با کد رهگیری
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            همه پیام‌ها ({messages.length})
          </button>
          <button
            onClick={() => setFilter('unanswered')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filter === 'unanswered'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            در انتظار پاسخ ({messages.filter(m => !m.isResponded).length})
          </button>
          <button
            onClick={() => setFilter('answered')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filter === 'answered'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            پاسخ داده شده ({messages.filter(m => m.isResponded).length})
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="جستجو بر اساس کد رهگیری (مثلاً ONV-9421)، نام یا متن پیام..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pr-10 pl-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
        />
      </div>

      {/* Messages List */}
      <div className="space-y-3">
        {filteredMessages.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
            پیامی برای نمایش یافت نشد.
          </div>
        ) : (
          filteredMessages.map((msg) => (
            <div
              key={msg.id}
              className={`bg-white rounded-2xl border p-5 transition shadow-xs ${
                !msg.isResponded ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200 flex items-center gap-1">
                    <Hash className="w-3 h-3 text-indigo-500" />
                    <span>{msg.trackingCode}</span>
                  </span>
                  <span className="font-bold text-slate-900 text-sm">{msg.fullName}</span>
                  {msg.phoneNumber && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span className="font-mono">{msg.phoneNumber}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">{msg.creationTime}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1 ${
                      msg.isResponded
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {msg.isResponded ? (
                      <>
                        <CheckCircle className="w-3 h-3" />
                        <span>پاسخ داده شد</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3" />
                        <span>در انتظار بررسی</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Consultation Structured Info if Consultation */}
              {msg.consultationDetails && (
                <div className="mt-3 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <span className="text-[11px] text-amber-700 block">موضوع مشاوره:</span>
                    <span className="font-bold text-slate-900">{msg.consultationDetails.topicTitle}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-amber-700 block">زمان انتخابی مشتری:</span>
                    <span className="font-bold text-blue-800">
                      {msg.consultationDetails.preferredDate} | {msg.consultationDetails.preferredTimeSlot}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-amber-700 block">شبکه اجتماعی ارتباط:</span>
                    <span className="font-bold text-emerald-800">
                      {msg.consultationDetails.socialPlatform} ({msg.consultationDetails.socialContactId})
                    </span>
                  </div>
                </div>
              )}

              {/* Message Body */}
              <div className="py-3 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {msg.message}
              </div>

              {/* Existing Response */}
              {msg.adminResponse && (
                <div className="mt-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                  <div className="flex items-center gap-1.5 font-bold text-blue-700 mb-1">
                    <Bot className="w-3.5 h-3.5" />
                    <span>پاسخ ارسال شده توسط مدیریت به کاربر (از طریق ربات/سامانه):</span>
                  </div>
                  <p className="leading-relaxed">{msg.adminResponse}</p>
                  {msg.respondedAt && (
                    <div className="text-[10px] text-slate-400 mt-2 text-left font-mono">
                      زمان ثبت: {msg.respondedAt}
                    </div>
                  )}
                </div>
              )}

              {/* Actions Footer */}
              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => openRespondModal(msg)}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{msg.isResponded ? 'ویرایش پاسخ' : 'ارسال پاسخ'}</span>
                </button>
                <button
                  onClick={() => setDeleteTarget(msg)}
                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                  title="حذف پیام"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Respond Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-600" />
                <span>ارسال پاسخ به پیام ({selectedMessage.trackingCode})</span>
              </h3>
              <button 
                onClick={() => setSelectedMessage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 mb-4 border border-slate-100">
              <div className="font-bold text-slate-800 mb-1">{selectedMessage.fullName}:</div>
              <p className="line-clamp-3">{selectedMessage.message}</p>
            </div>

            <form onSubmit={handleSendResponse} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  متن پاسخ مدیریت انیوال <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="لطفاً پاسخ را وارد کنید..."
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  این پاسخ در ربات بله / تلگرام و هنگام استعلام با کد رهگیری برای کاربر ارسال می‌شود.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'در حال ارسال...' : 'ثبت و ارسال پاسخ'}</span>
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
              حذف پیام ({deleteTarget.trackingCode})
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              آیا از حذف این پیام اطمینان دارید؟ پیام با موفقیت حذف خواهد شد.
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

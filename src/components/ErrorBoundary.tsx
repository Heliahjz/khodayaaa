import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, ShoppingBag } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Onival ErrorBoundary] Uncaught render error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-xl border border-stone-200 text-center space-y-5 animate-fadeIn">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-black text-stone-900">
                {this.props.fallbackTitle || 'بروز خطای موقت در نمایش این بخش'}
              </h2>
              <p className="text-xs text-stone-500 leading-relaxed">
                متأسفانه در پردازش این صفحه خطایی رخ داد. اطلاعات خرید و تنظیمات شما در دیتابیس محلی ذخیره شده و آسیبی ندیده است.
              </p>
              {this.state.error?.message && (
                <div className="text-[11px] font-mono text-stone-400 bg-stone-50 p-2.5 rounded-xl border border-stone-100 truncate" dir="ltr">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-white rounded-xl text-xs font-black shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>بازگشت به صفحه اصلی فروشگاه</span>
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="py-3 px-5 border border-stone-200 text-stone-700 hover:bg-stone-50 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>تازه‌سازی</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

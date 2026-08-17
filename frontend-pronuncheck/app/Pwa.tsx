'use client';

import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { Download, Share, PlusSquare, X, Smartphone, Sparkles, CheckCircle2 } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function Pwa() {
  const { t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Đăng ký Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => console.log('Service Worker registered with scope:', registration.scope))
          .catch((error) => console.error('Service Worker registration failed:', error));
      });
    }

    // 2. Kiểm tra xem có đang chạy ở chế độ Standalone (App đã cài đặt) không
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');
      
      setIsStandalone(isStandaloneMode);
      return isStandaloneMode;
    };

    if (checkStandalone()) {
      return; // Đang chạy dưới dạng App đã cài đặt -> không hiển thị banner
    }

    // 3. Nhận diện thiết bị iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice =
      /iphone|ipad|ipod/.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIos(isIosDevice);

    // 4. Bắt sự kiện beforeinstallprompt trên Chromium / Android / Edge
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 5. Kiểm tra thời gian người dùng đóng banner lần trước (nếu đóng thì ẩn trong 3 ngày)
    const dismissedTime = localStorage.getItem('pwa_prompt_dismissed_time');
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const isRecentlyDismissed = dismissedTime && Date.now() - parseInt(dismissedTime, 10) < threeDaysMs;

    if (!isRecentlyDismissed) {
      // Hiện banner sau 1.5 giây để tạo cảm giác thả xuống nhẹ nhàng
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa_prompt_dismissed_time', Date.now().toString());
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Trình duyệt hỗ trợ Web Install API (Android / Chrome / Edge)
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    } else {
      // Trên iOS Safari hoặc trình duyệt không hỗ trợ prompt trực tiếp -> mở Modal hướng dẫn
      setShowIosModal(true);
    }
  };

  if (isStandalone) {
    return null;
  }

  return (
    <>
      {/* Banner thả xuống nhẹ nhàng từ trên đỉnh màn hình */}
      {showBanner && (
        <aside 
          aria-label="Cài đặt ứng dụng PronunCheck"
          className="fixed top-3 left-3 right-3 z-50 max-w-xl mx-auto transition-all duration-500 ease-out animate-in fade-in slide-in-from-top-4"
        >
          <div className="bg-gray-900/95 backdrop-blur-md border border-lime-500/40 rounded-2xl p-3.5 sm:p-4 shadow-2xl shadow-black/80 flex items-center gap-3 text-white">
            {/* App Icon */}
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-xl bg-lime-500/20 border border-lime-500/40 flex items-center justify-center overflow-hidden shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icon-192x192.png"
                  alt="PronunCheck Icon"
                  className="w-10 h-10 object-contain rounded-lg"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <Smartphone className="w-6 h-6 text-lime-400 absolute" style={{ zIndex: -1 }} />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-lime-500 border-2 border-gray-900"></span>
              </span>
            </div>

            {/* Nội dung thông báo */}
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-1.5 font-semibold text-sm text-lime-400">
                <Sparkles className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                <span>{t('pwa.install_title')}</span>
              </div>
              <p className="text-xs text-gray-300 line-clamp-2 mt-0.5 leading-snug">
                {t('pwa.install_desc')}
              </p>
            </div>

            {/* Nút hành động */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleInstallClick}
                className="px-3 py-1.5 bg-gradient-to-r from-lime-500 to-green-600 hover:from-lime-400 hover:to-green-500 text-gray-950 font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
              >
                {deferredPrompt ? (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>{t('pwa.install_btn')}</span>
                  </>
                ) : (
                  <>
                    <Share className="w-3.5 h-3.5" />
                    <span>{isIos ? t('pwa.how_to_install') : t('pwa.install_btn')}</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDismiss}
                aria-label="Đóng thông báo"
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Modal hướng dẫn chi tiết dành cho Safari iOS */}
      {showIosModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-modal-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-sm transition-opacity animate-in fade-in"
        >
          <div className="bg-gray-900 border border-lime-500/30 text-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-lime-500/20 text-lime-400 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 id="ios-modal-title" className="font-bold text-base text-gray-100">
                  {t('pwa.ios_guide_title')}
                </h3>
              </div>
              <button
                onClick={() => setShowIosModal(false)}
                aria-label="Đóng hướng dẫn"
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-300">
              {t('pwa.ios_guide_desc')}
            </p>

            {/* Các bước hướng dẫn */}
            <div className="space-y-3 pt-1">
              {/* Bước 1 */}
              <div className="flex items-start gap-3 bg-gray-800/60 border border-gray-700/50 p-3 rounded-xl">
                <div className="w-7 h-7 rounded-full bg-lime-500/20 text-lime-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  1
                </div>
                <div className="flex-1 text-xs text-gray-200">
                  <span>{t('pwa.ios_step1')}</span>
                  <div className="mt-1.5 flex items-center gap-1.5 text-lime-400 font-medium bg-gray-900/80 px-2 py-1 rounded-lg w-fit">
                    <Share className="w-3.5 h-3.5" />
                    <span>Nút Chia sẻ (Share)</span>
                  </div>
                </div>
              </div>

              {/* Bước 2 */}
              <div className="flex items-start gap-3 bg-gray-800/60 border border-gray-700/50 p-3 rounded-xl">
                <div className="w-7 h-7 rounded-full bg-lime-500/20 text-lime-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  2
                </div>
                <div className="flex-1 text-xs text-gray-200">
                  <span>{t('pwa.ios_step2')}</span>
                  <div className="mt-1.5 flex items-center gap-1.5 text-lime-400 font-medium bg-gray-900/80 px-2 py-1 rounded-lg w-fit">
                    <PlusSquare className="w-3.5 h-3.5" />
                    <span>Thêm vào MH chính (+)</span>
                  </div>
                </div>
              </div>

              {/* Bước 3 */}
              <div className="flex items-start gap-3 bg-gray-800/60 border border-gray-700/50 p-3 rounded-xl">
                <div className="w-7 h-7 rounded-full bg-lime-500/20 text-lime-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  3
                </div>
                <div className="flex-1 text-xs text-gray-200">
                  <span>{t('pwa.ios_step3')}</span>
                  <div className="mt-1.5 flex items-center gap-1.5 text-green-400 font-medium bg-gray-900/80 px-2 py-1 rounded-lg w-fit">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Thêm (Add)</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setShowIosModal(false);
                handleDismiss();
              }}
              className="w-full py-2.5 bg-lime-500 hover:bg-lime-400 text-gray-950 font-bold text-sm rounded-xl transition-all cursor-pointer shadow-lg"
            >
              {t('pwa.close')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

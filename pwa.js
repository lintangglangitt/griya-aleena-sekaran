// pwa.js — registrasi service worker + tombol "Pasang Aplikasi"
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW gagal:', err));
    });
  }

  window.__installPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__installPrompt = e;
    document.dispatchEvent(new CustomEvent('pwa-installable'));
  });
  window.addEventListener('appinstalled', () => {
    window.__installPrompt = null;
    document.dispatchEvent(new CustomEvent('pwa-installed'));
  });

  window.isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  window.triggerInstall = async () => {
    if (!window.__installPrompt) return false;
    window.__installPrompt.prompt();
    await window.__installPrompt.userChoice;
    window.__installPrompt = null;
    return true;
  };
})();

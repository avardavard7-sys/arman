'use client';
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

export default function InstallButton() {
  const [deferred, setDeferred] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    if (standalone) setInstalled(true);

    const onPrompt = (e: any) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  return (
    <button
      onClick={async () => {
        deferred.prompt();
        try { await deferred.userChoice; } catch {}
        setDeferred(null);
      }}
      className="flex items-center gap-2 w-full rounded-xl bg-terra text-white text-sm font-bold px-3 py-2.5 hover:opacity-90 transition"
    >
      <Download size={16} /> Установить приложение
    </button>
  );
}

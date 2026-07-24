'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Dumbbell, Medal, Users, Trophy, BookOpen, Newspaper, Send, LifeBuoy, LogOut, Video, ScrollText, Palette, Menu, X } from 'lucide-react';
import { useAdmin } from '@/lib/useAdmin';
import { sb } from '@/lib/supabase';
import HelpDrawer from '@/components/HelpDrawer';
import InstallButton from '@/components/InstallButton';

const NAV = [
  { href: '/dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { href: '/exercises', label: 'Упражнения', icon: Dumbbell },
  { href: '/sport', label: 'Спорт', icon: Medal },
  { href: '/completions', label: 'Проверка видео', icon: Video },
  { href: '/users', label: 'Пользователи', icon: Users },
  { href: '/rating', label: 'Рейтинг', icon: Trophy },
  { href: '/journal', label: 'Журнал', icon: BookOpen },
  { href: '/news', label: 'Новости', icon: Newspaper },
  { href: '/broadcast', label: 'Рассылка', icon: Send },
  { href: '/audit', label: 'Аудит', icon: ScrollText },
  { href: '/settings', label: 'Настройки', icon: Palette },
  { href: '/help', label: 'Справка', icon: LifeBuoy },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAdmin();
  const path = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) return <div className="min-h-screen bg-paper flex items-center justify-center text-ink/40">Загрузка…</div>;

  return (
    <div className="min-h-screen flex">
      {menuOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMenuOpen(false)} />}
      <aside className={`w-60 shrink-0 bg-navy text-paper flex flex-col fixed inset-y-0 z-40 transform transition-transform duration-200 lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-5 py-6 flex items-start justify-between">
          <div>
          <div className="text-xl font-extrabold tracking-[0.25em]">CSKA KAZ</div>
          <div className="text-paper/40 text-xs mt-1">Панель управления</div>
          </div>
          <button className="lg:hidden text-paper/60 hover:text-paper mt-1" onClick={() => setMenuOpen(false)}><X size={20} /></button>
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV.map((n) => {
            const active = path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? 'bg-white/10 text-paper' : 'text-paper/55 hover:text-paper hover:bg-white/5'}`}>
                <span className={`w-1 h-5 rounded-full ${active ? 'bg-gold' : 'bg-transparent'}`} />
                <n.icon size={17} /> {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10 space-y-3">
          <InstallButton />
          <div>
            <div className="text-xs text-paper/50 mb-2 truncate">{user?.full_name || 'Администратор'}</div>
            <button className="flex items-center gap-2 text-sm font-semibold text-paper/70 hover:text-paper"
              onClick={async () => { await sb.auth.signOut(); router.replace('/login'); }}>
              <LogOut size={15} /> Выйти
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 lg:ml-60 min-w-0">
        <header className="sticky top-0 z-20 bg-paper/85 backdrop-blur border-b border-sand px-4 lg:px-8 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button className="lg:hidden shrink-0 text-ink/70 hover:text-ink" onClick={() => setMenuOpen(true)}>
              <Menu size={22} />
            </button>
            <div className="text-sm text-ink/50 font-semibold truncate hidden sm:block">Администрирование мобильного приложения CSKA KAZ</div>
            <div className="text-sm text-ink font-extrabold tracking-[0.2em] sm:hidden">CSKA KAZ</div>
          </div>
          <HelpDrawer />
        </header>
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

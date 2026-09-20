/** Botaxt Studio — kompakt Elgato / macOS sidebar. */

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Gamepad2,
  LayoutDashboard,
  Link2,
  MessageSquareText,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Star,
  Users,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/cn";

export type StudioNavId =
  | "dashboard"
  | "alerts"
  | "widgets"
  | "chatbot"
  | "loyalty"
  | "shop"
  | "minigames"
  | "integrations"
  | "profile"
  | "subusers"
  | "settings";

export type StudioNavItem = {
  id: StudioNavId;
  label: string;
  hint: string;
  Icon: LucideIcon;
};

// Etiketler Türkçe: uygulamanın geri kalanı Türkçe ve bu menü BotRix'in
// karşılığı — aynı adlandırmayı kullanmak, oradan gelen kullanıcıyı
// şaşırtmıyor. İpuçları artık bölümün ne işe yaradığını anlatıyor.
export const STUDIO_NAV: StudioNavItem[] = [
  { id: "dashboard", label: "Dashboard", hint: "Canlı özet", Icon: LayoutDashboard },
  { id: "alerts", label: "Uyarılar", hint: "Takip · abone · bağış", Icon: ShieldAlert },
  { id: "widgets", label: "Widgets", hint: "OBS widget’ları", Icon: Sparkles },
  { id: "chatbot", label: "Sohbet botu", hint: "Moderasyon · komutlar", Icon: MessageSquareText },
  { id: "loyalty", label: "Sadakat", hint: "Puan · seviye", Icon: Star },
  { id: "shop", label: "Mağaza", hint: "Puanla ödül", Icon: ShoppingBag },
  { id: "minigames", label: "Mini oyunlar", hint: "Rulet · düello", Icon: Gamepad2 },
  { id: "integrations", label: "Entegrasyonlar", hint: "Platform bağlantıları", Icon: Link2 },
  { id: "profile", label: "Profil", hint: "Kimlik · dil", Icon: UserRound },
  { id: "subusers", label: "Alt kullanıcılar", hint: "Yetki devri", Icon: Users },
  { id: "settings", label: "Ayarlar", hint: "Uygulama ayarları", Icon: Settings },
];

type Props = {
  active: StudioNavId;
  onNavigate: (id: StudioNavId) => void;
  children: ReactNode;
  footer?: ReactNode;
};

export default function StudioShell({ active, onNavigate, children, footer }: Props) {
  return (
    <div className="studio-shell mx-3 mb-3 mt-2 flex min-h-0 flex-1 overflow-hidden rounded-lg border border-white/[0.05] bg-[#0c0d10] text-white">
      <aside className="studio-sidebar flex w-[11.5rem] shrink-0 flex-col border-r border-white/[0.05] bg-[#090a0c]">
        <div className="border-b border-white/[0.05] px-3 py-3">
          <p className="text-[12px] font-semibold tracking-tight text-white/90">BotAxT</p>
          <p className="yya-label mt-0.5 normal-case tracking-normal">Studio</p>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-1.5" aria-label="Studio">
          {STUDIO_NAV.map((item) => {
            const isActive = active === item.id;
            const Icon = item.Icon;
            return (
              <button
                key={item.id}
                type="button"
                title={item.hint}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "studio-nav-btn",
                  isActive ? "studio-nav-btn-active" : "studio-nav-btn-idle"
                )}
              >
                <span className="studio-nav-icon">
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                </span>
                <span className="studio-nav-label truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {footer ? (
          <div className="border-t border-white/[0.05] p-2 text-[10px] text-white/50">{footer}</div>
        ) : null}
      </aside>

      <main className="studio-main min-w-0 flex-1 overflow-y-auto p-3 sm:p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

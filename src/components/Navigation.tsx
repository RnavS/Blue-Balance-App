import { motion } from 'framer-motion';
import { LayoutDashboard, History, ScanBarcode, Bot, Settings } from 'lucide-react';

export type TabType = 'coach' | 'scan' | 'dashboard' | 'history' | 'settings';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const tabs = [
  { id: 'coach' as const, label: 'AI Coach', icon: Bot },
  { id: 'scan' as const, label: 'Scan', icon: ScanBarcode },
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'history' as const, label: 'History', icon: History },
  { id: 'settings' as const, label: 'Settings', icon: Settings },
];

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
      <div className="mx-3 mb-3">
        <div className="glass-card p-2 flex justify-around glow-effect-sm">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => onTabChange(tab.id)}
                className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-all duration-300 ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-primary/15 rounded-2xl"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <tab.icon className={`w-5 h-5 relative z-10 transition-all duration-300 ${isActive ? 'drop-shadow-[0_0_8px_hsl(var(--primary))]' : ''}`} />
                <span className="text-[10px] font-medium relative z-10">{tab.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
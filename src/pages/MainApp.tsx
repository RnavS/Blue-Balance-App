import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { Navigation, TabType } from '@/components/Navigation';
import { Dashboard } from '@/pages/Dashboard';
import { History } from '@/pages/History';
import { Settings } from '@/pages/Settings';
import { QuickScan } from '@/pages/QuickScan';
import { AICoach } from '@/pages/AICoach';

export function MainApp() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentProfile, loading: profileLoading } = useProfile();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
    } else if (!profileLoading && user && !currentProfile) {
      navigate('/profiles');
    }
  }, [user, authLoading, currentProfile, profileLoading, navigate]);

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !currentProfile) {
    return null;
  }

  const pageVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <div className="min-h-screen bg-background">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'history' && <History />}
          {activeTab === 'scan' && <QuickScan />}
          {activeTab === 'coach' && <AICoach />}
          {activeTab === 'settings' && <Settings />}
        </motion.div>
      </AnimatePresence>
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
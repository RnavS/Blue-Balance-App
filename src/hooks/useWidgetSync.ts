import { useEffect } from 'react';
import { useProfile } from '@/contexts/ProfileContext';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        blueBalanceWidget?: {
          postMessage: (message: any) => void;
        }
      }
    };
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
    quickAddFromWidget?: (amount: number, drinkType?: string) => Promise<void>;
  }
}

export function useWidgetSync() {
  const { currentProfile, getTodayIntake, waterLogs, addWaterLog } = useProfile();
  const { toast } = useToast();

  useEffect(() => {
    if (!currentProfile) return;

    const todayIntake = getTodayIntake();

    const widgetData = {
      profileId: currentProfile.id,
      dailyGoal: currentProfile.daily_goal,
      unit: currentProfile.unit_preference,
      currentIntake: todayIntake,
      remaining: Math.max(0, currentProfile.daily_goal - todayIntake),
      progressPercent: Math.min(100, Math.round((todayIntake / currentProfile.daily_goal) * 100)),
      lastLogTime: waterLogs.length > 0 ? waterLogs[0].logged_at : null,
      timestamp: new Date().toISOString()
    };

    if (window.webkit?.messageHandlers?.blueBalanceWidget) {
      try {
        window.webkit.messageHandlers.blueBalanceWidget.postMessage(widgetData);
      } catch (e) {
        console.error("iOS Widget sync error:", e);
      }
    }

    if (window.ReactNativeWebView) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'WIDGET_DATA', payload: widgetData }));
      } catch (e) {
        console.error("React Native Widget sync error:", e);
      }
    }

    localStorage.setItem('blueBalance_widgetData', JSON.stringify(widgetData));

  }, [currentProfile, waterLogs, getTodayIntake]);

  useEffect(() => {
    if (!currentProfile) return;

    window.quickAddFromWidget = async (amount: number, drinkType: string = 'Water') => {
      try {
        await addWaterLog(amount, drinkType);
        toast({ title: 'Logged via Widget', description: `Added ${amount} ${currentProfile.unit_preference} of ${drinkType}`});
      } catch (e) {
        console.error("Widget quick add error", e);
      }
    };

    return () => {
      delete window.quickAddFromWidget;
    };
  }, [currentProfile, addWaterLog, toast]);
}

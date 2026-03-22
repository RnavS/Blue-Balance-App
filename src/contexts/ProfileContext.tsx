import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { inferBeverageCategory, normalizeDrinkName } from '@/utils/beverageCategory';

export interface Beverage {
  id: string;
  profile_id: string;
  name: string;
  serving_size: number;
  hydration_factor: number;
  icon: string;
  is_default: boolean;
  created_at: string;
}

export interface ScannedBeverage {
  id: string;
  profile_id: string;
  barcode: string;
  name: string;
  serving_size: number;
  hydration_factor: number;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  age: number | null;
  height: number | null;
  weight: number | null;
  unit_preference: 'oz' | 'ml';
  wake_time: string;
  sleep_time: string;
  activity_level: 'light' | 'moderate' | 'high';
  daily_goal: number;
  interval_length: number;
  theme: string;
  custom_accent_color: string | null;
  gradient_preset: string | null;
  reminders_enabled: boolean;
  reminder_interval: number;
  quiet_hours_start: string;
  quiet_hours_end: string;
  sound_enabled: boolean;
  vibration_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface WaterLog {
  id: string;
  profile_id: string;
  amount: number;
  raw_amount?: number | null;
  hydration_factor?: number | null;
  drink_type: string;
  category?: string | null;
  source?: string | null;
  barcode?: string | null;
  details?: Record<string, unknown> | null;
  logged_at: string;
  created_at: string;
}

export type WaterLogSource = 'manual' | 'quick' | 'scan' | 'coach' | 'other';

export interface AddWaterLogOptions {
  source?: WaterLogSource;
  category?: string;
  barcode?: string | null;
  details?: Record<string, unknown> | null;
  dedupeWindowMs?: number;
}

export interface ChatMessage {
  id: string;
  profile_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export const DEFAULT_BEVERAGES = [
  { name: 'Water', serving_size_oz: 8, serving_size_ml: 240, hydration_factor: 1.0, icon: 'droplet' },
  { name: 'Sparkling Water', serving_size_oz: 12, serving_size_ml: 355, hydration_factor: 1.0, icon: 'sparkles' },
  { name: 'Tea', serving_size_oz: 8, serving_size_ml: 240, hydration_factor: 0.9, icon: 'leaf' },
  { name: 'Coffee', serving_size_oz: 8, serving_size_ml: 240, hydration_factor: 0.8, icon: 'coffee' },
  { name: 'Orange Juice', serving_size_oz: 8, serving_size_ml: 240, hydration_factor: 0.85, icon: 'citrus' },
  { name: 'Sports Drink', serving_size_oz: 12, serving_size_ml: 355, hydration_factor: 0.95, icon: 'zap' },
  { name: 'Soda', serving_size_oz: 12, serving_size_ml: 355, hydration_factor: 0.5, icon: 'cup-soda' },
];

interface ProfileContextType {
  profiles: Profile[];
  currentProfile: Profile | null;
  waterLogs: WaterLog[];
  beverages: Beverage[];
  scannedBeverages: ScannedBeverage[];
  chatMessages: ChatMessage[];
  loading: boolean;
  setCurrentProfile: (profile: Profile | null) => void;
  createProfile: (profile: Partial<Profile>) => Promise<Profile | null>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  fetchProfiles: () => Promise<void>;
  addWaterLog: (amount: number, drinkType?: string, hydrationFactor?: number, options?: AddWaterLogOptions) => Promise<void>;
  deleteWaterLog: (logId: string) => Promise<void>;
  undoLastLog: () => Promise<void>;
  getTodayIntake: () => number;
  getEffectiveIntake: () => number;
  getFilteredLogs: (filter: string, customRange?: { start: Date; end: Date }) => WaterLog[];
  getFluidMix: (filter?: string, customRange?: { start: Date; end: Date }) => Array<{ category: string; amount: number; percentage: number; entries: number }>;
  getExpectedIntake: () => number;
  getExpectedRange: () => { min: number; max: number };
  isOnTrack: () => boolean;
  getStreak: () => number;
  getHydrationScore: (logs?: WaterLog[]) => number;
  getCurrentIntervalProgress: () => { current: number; target: number; timeRemaining: number; intervalIndex: number; totalIntervals: number };
  addBeverage: (beverage: Partial<Beverage>) => Promise<Beverage | null>;
  deleteBeverage: (id: string) => Promise<void>;
  addScannedBeverage: (beverage: Partial<ScannedBeverage>) => Promise<ScannedBeverage | null>;
  deleteScannedBeverage: (id: string) => Promise<void>;
  addChatMessage: (role: 'user' | 'assistant', content: string) => Promise<ChatMessage | null>;
  clearChatHistory: () => Promise<void>;
  convertAmount: (amount: number, fromUnit: 'oz' | 'ml', toUnit: 'oz' | 'ml') => number;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [beverages, setBeverages] = useState<Beverage[]>([]);
  const [scannedBeverages, setScannedBeverages] = useState<ScannedBeverage[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const lastAddRef = useRef<{ key: string; ts: number } | null>(null);
  const inFlightAddKeysRef = useRef<Set<string>>(new Set());

  const convertAmount = useCallback((amount: number, fromUnit: 'oz' | 'ml', toUnit: 'oz' | 'ml'): number => {
    if (fromUnit === toUnit) return amount;
    if (fromUnit === 'oz' && toUnit === 'ml') return amount * 29.5735;
    return amount / 29.5735;
  }, []);

  const fetchProfiles = useCallback(async () => {
    if (!user) {
      setProfiles([]);
      setCurrentProfile(null);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const typedData = (data || []).map(p => ({
        ...p,
        unit_preference: p.unit_preference as 'oz' | 'ml',
        activity_level: p.activity_level as 'light' | 'moderate' | 'high',
      })) as Profile[];

      setProfiles(typedData);

      if (typedData.length > 0 && !currentProfile) {
        const savedProfileId = await AsyncStorage.getItem('blueBalance_currentProfile');
        const savedProfile = typedData.find(p => p.id === savedProfileId);
        setCurrentProfile(savedProfile || typedData[0]);
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
    } finally {
      setLoading(false);
    }
  }, [user, currentProfile]);

  const fetchWaterLogs = useCallback(async () => {
    if (!currentProfile) { setWaterLogs([]); return; }
    try {
      const historyWindowStart = new Date();
      historyWindowStart.setDate(historyWindowStart.getDate() - 400);
      const { data, error } = await supabase
        .from('water_logs')
        .select('*')
        .eq('profile_id', currentProfile.id)
        .gte('logged_at', historyWindowStart.toISOString())
        .order('logged_at', { ascending: false });
      if (error) throw error;
      setWaterLogs((data || []).map(log => ({
        ...log,
        amount: Number(log.amount),
        raw_amount: log.raw_amount !== null && log.raw_amount !== undefined ? Number(log.raw_amount) : Number(log.amount),
        hydration_factor: log.hydration_factor !== null && log.hydration_factor !== undefined ? Number(log.hydration_factor) : 1.0,
        details: typeof log.details === 'object' && log.details !== null ? (log.details as Record<string, unknown>) : null,
      })));
    } catch (error) {
      console.error('Error fetching water logs:', error);
    }
  }, [currentProfile]);

  const fetchBeverages = useCallback(async () => {
    if (!currentProfile) { setBeverages([]); return; }
    try {
      const { data, error } = await supabase
        .from('beverages')
        .select('*')
        .eq('profile_id', currentProfile.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setBeverages((data || []).map(b => ({
        ...b,
        serving_size: Number(b.serving_size),
        hydration_factor: Number(b.hydration_factor),
      })));
    } catch (error) {
      console.error('Error fetching beverages:', error);
    }
  }, [currentProfile]);

  const fetchScannedBeverages = useCallback(async () => {
    if (!currentProfile) { setScannedBeverages([]); return; }
    try {
      const { data, error } = await supabase
        .from('scanned_beverages')
        .select('*')
        .eq('profile_id', currentProfile.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setScannedBeverages((data || []).map(b => ({
        ...b,
        serving_size: Number(b.serving_size),
        hydration_factor: Number(b.hydration_factor),
      })));
    } catch (error) {
      console.error('Error fetching scanned beverages:', error);
    }
  }, [currentProfile]);

  const fetchChatMessages = useCallback(async () => {
    if (!currentProfile) { setChatMessages([]); return; }
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('profile_id', currentProfile.id)
        .order('created_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      setChatMessages((data || []).map(m => ({ ...m, role: m.role as 'user' | 'assistant' })));
    } catch (error) {
      console.error('Error fetching chat messages:', error);
    }
  }, [currentProfile]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  useEffect(() => {
    if (currentProfile) {
      AsyncStorage.setItem('blueBalance_currentProfile', currentProfile.id);
      fetchWaterLogs();
      fetchBeverages();
      fetchScannedBeverages();
      fetchChatMessages();
    }
  }, [currentProfile, fetchWaterLogs, fetchBeverages, fetchScannedBeverages, fetchChatMessages]);

  const createProfile = async (profileData: Partial<Profile>): Promise<Profile | null> => {
    if (!user) return null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Not signed in');

      const insertData = {
        user_id: session.user.id,
        username: ((profileData.first_name ?? '') + ' ' + (profileData.last_name ?? '')).trim() || 'User',
        first_name: profileData.first_name || null,
        last_name: profileData.last_name || null,
        age: profileData.age || null,
        height: profileData.height || null,
        weight: profileData.weight || null,
        unit_preference: profileData.unit_preference || 'oz',
        wake_time: profileData.wake_time || '07:00',
        sleep_time: profileData.sleep_time || '22:00',
        activity_level: profileData.activity_level || 'moderate',
        daily_goal: profileData.daily_goal || 80,
        interval_length: profileData.interval_length || 60,
        theme: profileData.theme || 'midnight',
        reminders_enabled: (profileData as any).reminders_enabled ?? true,
        reminder_interval: (profileData as any).reminder_interval ?? 30,
        quiet_hours_start: (profileData as any).quiet_hours_start || '22:00',
        quiet_hours_end: (profileData as any).quiet_hours_end || '07:00',
        sound_enabled: true,
        vibration_enabled: true,
      };

      const { data, error } = await supabase.from('profiles').insert(insertData).select().single();
      if (error) throw error;

      const typedProfile = {
        ...data,
        unit_preference: data.unit_preference as 'oz' | 'ml',
        activity_level: data.activity_level as 'light' | 'moderate' | 'high',
      } as Profile;

      setProfiles(prev => [...prev, typedProfile]);
      return typedProfile;
    } catch (error) {
      console.error('Error creating profile:', error);
      return null;
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!currentProfile) return;
    try {
      const { error } = await supabase.from('profiles').update(updates).eq('id', currentProfile.id);
      if (error) throw error;
      const updated = { ...currentProfile, ...updates } as Profile;
      setCurrentProfile(updated);
      setProfiles(prev => prev.map(p => p.id === currentProfile.id ? updated : p));
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const deleteProfile = async (profileId: string) => {
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', profileId);
      if (error) throw error;
      setProfiles(prev => prev.filter(p => p.id !== profileId));
      if (currentProfile?.id === profileId) {
        setCurrentProfile(profiles.filter(p => p.id !== profileId)[0] || null);
      }
    } catch (error) {
      console.error('Error deleting profile:', error);
    }
  };

  const addWaterLog = async (
    amount: number,
    drinkType = 'Water',
    hydrationFactor = 1.0,
    options: AddWaterLogOptions = {}
  ) => {
    if (!currentProfile) return;
    let dedupeKey = '';
    try {
      const normalizedDrink = normalizeDrinkName(drinkType) || 'Water';
      const safeRawAmount = Number(amount);
      if (!Number.isFinite(safeRawAmount) || safeRawAmount <= 0) return;

      const safeHydrationFactor = Number.isFinite(hydrationFactor) && hydrationFactor > 0 ? hydrationFactor : 1.0;
      const effectiveAmount = safeRawAmount * safeHydrationFactor;
      const source = options.source || 'manual';
      const category = (options.category || inferBeverageCategory(normalizedDrink)).toLowerCase();
      const barcode = options.barcode || null;
      const details = options.details ?? null;
      const dedupeWindowMs = Number.isFinite(options.dedupeWindowMs) ? Number(options.dedupeWindowMs) : 4500;
      dedupeKey = `${currentProfile.id}|${normalizedDrink.toLowerCase()}|${safeRawAmount.toFixed(3)}|${source}|${barcode ?? ''}`;
      const nowMs = Date.now();

      if (lastAddRef.current && lastAddRef.current.key === dedupeKey && nowMs - lastAddRef.current.ts < dedupeWindowMs) {
        return;
      }
      if (inFlightAddKeysRef.current.has(dedupeKey)) {
        return;
      }

      const duplicateInLocalState = waterLogs.some((log) => {
        const loggedMs = new Date(log.logged_at).getTime();
        const recentEnough = Number.isFinite(loggedMs) && nowMs - loggedMs >= 0 && nowMs - loggedMs < dedupeWindowMs;
        if (!recentEnough) return false;

        const logRawAmount = log.raw_amount !== null && log.raw_amount !== undefined ? Number(log.raw_amount) : Number(log.amount);
        const sameAmount = Math.abs(logRawAmount - safeRawAmount) < 0.001;
        const sameDrink = normalizeDrinkName(log.drink_type).toLowerCase() === normalizedDrink.toLowerCase();
        const sameSource = (log.source || 'manual') === source;
        const sameBarcode = (log.barcode || null) === barcode;
        return sameAmount && sameDrink && sameSource && sameBarcode;
      });

      if (duplicateInLocalState) {
        lastAddRef.current = { key: dedupeKey, ts: nowMs };
        return;
      }

      inFlightAddKeysRef.current.add(dedupeKey);
      const { data, error } = await supabase
        .from('water_logs')
        .insert({
          profile_id: currentProfile.id,
          amount: effectiveAmount,
          raw_amount: safeRawAmount,
          hydration_factor: safeHydrationFactor,
          drink_type: normalizedDrink,
          category,
          source,
          barcode,
          details: details || {},
          logged_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      lastAddRef.current = { key: dedupeKey, ts: nowMs };
      setWaterLogs(prev => [{
        ...data,
        amount: Number(data.amount),
        raw_amount: data.raw_amount !== null && data.raw_amount !== undefined ? Number(data.raw_amount) : Number(data.amount),
        hydration_factor: data.hydration_factor !== null && data.hydration_factor !== undefined ? Number(data.hydration_factor) : 1.0,
        details: typeof data.details === 'object' && data.details !== null ? (data.details as Record<string, unknown>) : null,
      }, ...prev]);
    } catch (error) {
      console.error('Error adding water log:', error);
    } finally {
      inFlightAddKeysRef.current.delete(dedupeKey);
    }
  };

  const deleteWaterLog = async (logId: string) => {
    try {
      const { error } = await supabase.from('water_logs').delete().eq('id', logId);
      if (error) throw error;
      setWaterLogs(prev => prev.filter(l => l.id !== logId));
    } catch (error) {
      console.error('Error deleting water log:', error);
    }
  };

  const undoLastLog = async () => {
    const today = new Date();
    const todayLogs = waterLogs.filter(l => new Date(l.logged_at).toDateString() === today.toDateString());
    if (todayLogs.length > 0) await deleteWaterLog(todayLogs[0].id);
  };

  const getTodayIntake = useCallback(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return waterLogs.filter(l => new Date(l.logged_at) >= today).reduce((s, l) => s + l.amount, 0);
  }, [waterLogs]);

  const getEffectiveIntake = useCallback(() => getTodayIntake(), [getTodayIntake]);

  const getFilteredLogs = useCallback((filter: string, customRange?: { start: Date; end: Date }) => {
    const now = new Date();
    let startDate: Date;
    switch (filter) {
      case 'hour': startDate = new Date(now.getTime() - 60 * 60 * 1000); break;
      case 'day': startDate = new Date(now); startDate.setHours(0, 0, 0, 0); break;
      case 'week': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case 'month': startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      case 'year': startDate = new Date(now.getFullYear(), 0, 1); break;
      case 'custom':
        if (customRange) return waterLogs.filter(l => new Date(l.logged_at) >= customRange.start && new Date(l.logged_at) <= customRange.end);
        return waterLogs;
      default: startDate = new Date(now); startDate.setHours(0, 0, 0, 0);
    }
    return waterLogs.filter(l => new Date(l.logged_at) >= startDate);
  }, [waterLogs]);

  const getFluidMix = useCallback((filter: string = 'day', customRange?: { start: Date; end: Date }) => {
    const logs = getFilteredLogs(filter, customRange);
    const grouped = new Map<string, { category: string; amount: number; entries: number }>();

    let total = 0;
    for (const log of logs) {
      const consumed = log.raw_amount !== null && log.raw_amount !== undefined ? Number(log.raw_amount) : Number(log.amount);
      if (!Number.isFinite(consumed) || consumed <= 0) continue;
      total += consumed;

      const category = (log.category || inferBeverageCategory(log.drink_type)).toLowerCase();
      const existing = grouped.get(category) || { category, amount: 0, entries: 0 };
      existing.amount += consumed;
      existing.entries += 1;
      grouped.set(category, existing);
    }

    if (total <= 0) return [];
    return [...grouped.values()]
      .sort((a, b) => b.amount - a.amount)
      .map((item) => ({
        ...item,
        amount: Number(item.amount.toFixed(2)),
        percentage: Number(((item.amount / total) * 100).toFixed(1)),
      }));
  }, [getFilteredLogs]);

  const getExpectedIntake = useCallback(() => {
    if (!currentProfile) return 0;
    const now = new Date();
    const [wh, wm] = currentProfile.wake_time.split(':').map(Number);
    const [sh, sm] = currentProfile.sleep_time.split(':').map(Number);
    const wake = new Date(now); wake.setHours(wh, wm, 0, 0);
    const sleep = new Date(now); sleep.setHours(sh, sm, 0, 0);
    if (sleep <= wake) sleep.setDate(sleep.getDate() + 1);
    if (now < wake) return 0;
    if (now > sleep) return currentProfile.daily_goal;
    const progress = (now.getTime() - wake.getTime()) / (sleep.getTime() - wake.getTime());
    return currentProfile.daily_goal * Math.max(0, Math.min(progress, 1));
  }, [currentProfile]);

  const getExpectedRange = useCallback(() => {
    const expected = getExpectedIntake();
    const tolerance = currentProfile ? currentProfile.daily_goal * 0.1 : 0;
    return { min: Math.max(0, expected - tolerance), max: expected + tolerance };
  }, [getExpectedIntake, currentProfile]);

  const isOnTrack = useCallback(() => getTodayIntake() >= getExpectedRange().min, [getTodayIntake, getExpectedRange]);

  const getStreak = useCallback(() => {
    if (!currentProfile) return 0;
    let streak = 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 30; i++) {
      const check = new Date(today); check.setDate(check.getDate() - i);
      const next = new Date(check); next.setDate(next.getDate() + 1);
      const day = waterLogs.filter(l => new Date(l.logged_at) >= check && new Date(l.logged_at) < next).reduce((s, l) => s + l.amount, 0);
      if (day >= currentProfile.daily_goal) { streak++; }
      else if (i === 0) { continue; }
      else { break; }
    }
    return streak;
  }, [currentProfile, waterLogs]);

  const getHydrationScore = useCallback((logs?: WaterLog[]) => {
    if (!currentProfile) return 0;
    const use = logs || getFilteredLogs('day');
    const intake = use.reduce((s, l) => s + l.amount, 0);
    const goal = Math.min(intake / currentProfile.daily_goal, 1) * 40;
    const exp = getExpectedIntake();
    const pace = Math.min(exp > 0 ? Math.min(intake / exp, 1.2) : 1, 1) * 30;
    const [wh, wm] = currentProfile.wake_time.split(':').map(Number);
    const [sh, sm] = currentProfile.sleep_time.split(':').map(Number);
    const wakeMin = wh * 60 + wm;
    let sleepMin = sh * 60 + sm; if (sleepMin <= wakeMin) sleepMin += 1440;
    const ivMin = currentProfile.interval_length;
    const ivCount = Math.ceil((sleepMin - wakeMin) / ivMin);
    const now = new Date();
    const curMin = now.getHours() * 60 + now.getMinutes();
    const elapsed = Math.max(0, curMin - wakeMin);
    const curIv = Math.floor(elapsed / ivMin);
    let met = 0;
    for (let i = 0; i <= Math.min(curIv, ivCount - 1); i++) {
      const s = new Date(now); s.setHours(0, 0, 0, 0); s.setMinutes(wakeMin + i * ivMin);
      const e = new Date(s); e.setMinutes(s.getMinutes() + ivMin);
      if (use.some(l => { const lt = new Date(l.logged_at); return lt >= s && lt < e; })) met++;
    }
    const consistency = (met / Math.max(curIv + 1, 1)) * 30;
    return Math.round(goal + pace + consistency);
  }, [currentProfile, getFilteredLogs, getExpectedIntake]);

  const getCurrentIntervalProgress = useCallback(() => {
    if (!currentProfile) return { current: 0, target: 0, timeRemaining: 0, intervalIndex: 0, totalIntervals: 0 };
    const now = new Date();
    const [wh, wm] = currentProfile.wake_time.split(':').map(Number);
    const [sh, sm] = currentProfile.sleep_time.split(':').map(Number);
    const wake = new Date(now); wake.setHours(wh, wm, 0, 0);
    const sleep = new Date(now); sleep.setHours(sh, sm, 0, 0);
    if (sleep <= wake) sleep.setDate(sleep.getDate() + 1);
    const ivMs = currentProfile.interval_length * 60 * 1000;
    const total = Math.ceil((sleep.getTime() - wake.getTime()) / ivMs);
    const elapsed = Math.max(0, now.getTime() - wake.getTime());
    const idx = Math.min(Math.floor(elapsed / ivMs), total - 1);
    const ivStart = new Date(wake.getTime() + idx * ivMs);
    const ivEnd = new Date(Math.min(ivStart.getTime() + ivMs, sleep.getTime()));
    const target = currentProfile.daily_goal / total;
    const logs = waterLogs.filter(l => { const t = new Date(l.logged_at); return t >= ivStart && t < ivEnd; });
    return { current: logs.reduce((s, l) => s + l.amount, 0), target, timeRemaining: Math.max(0, ivEnd.getTime() - now.getTime()), intervalIndex: idx, totalIntervals: total };
  }, [currentProfile, waterLogs]);

  const addBeverage = async (d: Partial<Beverage>): Promise<Beverage | null> => {
    if (!currentProfile) return null;
    try {
      const { data, error } = await supabase.from('beverages').insert({ profile_id: currentProfile.id, name: d.name || 'Custom', serving_size: d.serving_size || 8, hydration_factor: d.hydration_factor || 1.0, icon: d.icon || 'droplet', is_default: false }).select().single();
      if (error) throw error;
      const b = { ...data, serving_size: Number(data.serving_size), hydration_factor: Number(data.hydration_factor) } as Beverage;
      setBeverages(prev => [...prev, b]);
      return b;
    } catch (e) { console.error(e); return null; }
  };

  const deleteBeverage = async (id: string) => {
    try {
      const { error } = await supabase.from('beverages').delete().eq('id', id);
      if (error) throw error;
      setBeverages(prev => prev.filter(b => b.id !== id));
    } catch (e) { console.error(e); }
  };

  const addScannedBeverage = async (d: Partial<ScannedBeverage>): Promise<ScannedBeverage | null> => {
    if (!currentProfile) return null;
    try {
      const { data, error } = await supabase.from('scanned_beverages').insert({ profile_id: currentProfile.id, barcode: d.barcode || '', name: d.name || 'Scanned', serving_size: d.serving_size || 8, hydration_factor: d.hydration_factor || 1.0 }).select().single();
      if (error) throw error;
      const b = { ...data, serving_size: Number(data.serving_size), hydration_factor: Number(data.hydration_factor) } as ScannedBeverage;
      setScannedBeverages(prev => [b, ...prev]);
      return b;
    } catch (e) { console.error(e); return null; }
  };

  const deleteScannedBeverage = async (id: string) => {
    try {
      const { error } = await supabase.from('scanned_beverages').delete().eq('id', id);
      if (error) throw error;
      setScannedBeverages(prev => prev.filter(b => b.id !== id));
    } catch (e) { console.error(e); }
  };

  const addChatMessage = async (role: 'user' | 'assistant', content: string): Promise<ChatMessage | null> => {
    if (!currentProfile) return null;
    try {
      const { data, error } = await supabase.from('chat_messages').insert({ profile_id: currentProfile.id, role, content }).select().single();
      if (error) throw error;
      const m = { ...data, role: data.role as 'user' | 'assistant' } as ChatMessage;
      setChatMessages(prev => [...prev, m]);
      return m;
    } catch (e) { console.error(e); return null; }
  };

  const clearChatHistory = async () => {
    if (!currentProfile) return;
    try {
      const { error } = await supabase.from('chat_messages').delete().eq('profile_id', currentProfile.id);
      if (error) throw error;
      setChatMessages([]);
    } catch (e) { console.error(e); }
  };

  return (
    <ProfileContext.Provider value={{
      profiles, currentProfile, waterLogs, beverages, scannedBeverages, chatMessages, loading,
      setCurrentProfile, createProfile, updateProfile, deleteProfile, fetchProfiles,
      addWaterLog, deleteWaterLog, undoLastLog, getTodayIntake, getEffectiveIntake,
      getFilteredLogs, getFluidMix, getExpectedIntake, getExpectedRange, isOnTrack, getStreak,
      getHydrationScore, getCurrentIntervalProgress, addBeverage, deleteBeverage,
      addScannedBeverage, deleteScannedBeverage, addChatMessage, clearChatHistory, convertAmount,
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used within ProfileProvider');
  return context;
}

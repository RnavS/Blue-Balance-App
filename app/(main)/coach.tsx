import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import ScreenContainer from '@/components/ui/ScreenContainer';
import SurfaceCard from '@/components/ui/SurfaceCard';
import { useProfile } from '@/contexts/ProfileContext';
import { usePremium } from '@/contexts/PremiumContext';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/theme/useAppTheme';

const sanitize = (text: string) =>
  text
    .replace(/\*\*\*/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/___/g, '')
    .replace(/__/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[\s]*[-*+]\s+/gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export default function CoachScreen() {
  const {
    currentProfile,
    chatMessages,
    addChatMessage,
    clearChatHistory,
    getTodayIntake,
    getExpectedIntake,
    getStreak,
    getHydrationScore,
    updateProfile,
    addWaterLog,
    addBeverage,
    undoLastLog,
    waterLogs,
  } = useProfile();
  const { isPremium } = usePremium();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  if (!currentProfile) return null;

  const theme = useAppTheme(currentProfile.theme);
  const styles = createStyles(theme);

  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [chatMessages]);

  const unit = currentProfile.unit_preference;

  const buildContext = () => {
    const intake = getTodayIntake();
    const expected = getExpectedIntake();
    return `User: ${currentProfile.first_name || currentProfile.username}
Daily Goal: ${currentProfile.daily_goal} ${unit}
Intake Today: ${intake.toFixed(1)} ${unit}
Expected: ${expected.toFixed(1)} ${unit}
On Track: ${intake >= expected ? 'Yes' : 'No'}
Score: ${getHydrationScore()}/100
Streak: ${getStreak()} days
Recent: ${waterLogs.slice(0, 3).map((l) => `${l.amount.toFixed(1)}${unit} ${l.drink_type}`).join(', ')}`;
  };

  const handleAIAction = async (action: { type: string; params: any }) => {
    const params = action?.params || {};
    switch (action.type) {
      case 'update_goal':
        if (params.daily_goal) await updateProfile({ daily_goal: params.daily_goal });
        break;
      case 'add_water':
      case 'log_water':
        if (params.amount) await addWaterLog(params.amount, params.drink_type || 'Water', 1.0, { source: 'coach' });
        break;
      case 'update_interval':
        if (params.interval_length) await updateProfile({ interval_length: params.interval_length });
        break;
      case 'update_theme':
      case 'set_theme':
        if (params.theme) await updateProfile({ theme: params.theme });
        break;
      case 'update_schedule':
        await updateProfile({
          ...(params.wake_time ? { wake_time: params.wake_time } : {}),
          ...(params.sleep_time ? { sleep_time: params.sleep_time } : {}),
        });
        break;
      case 'update_reminders':
        await updateProfile({
          ...(typeof params.reminders_enabled === 'boolean' ? { reminders_enabled: params.reminders_enabled } : {}),
          ...(params.reminder_interval ? { reminder_interval: params.reminder_interval } : {}),
        } as any);
        break;
      case 'update_unit':
        if (params.unit_preference === 'oz' || params.unit_preference === 'ml') {
          await updateProfile({ unit_preference: params.unit_preference });
        }
        break;
      case 'create_beverage':
        if (params.name && params.serving_size) {
          await addBeverage({
            name: params.name,
            serving_size: params.serving_size,
            hydration_factor: params.hydration_factor || 1.0,
            icon: params.icon || 'droplet',
          });
        }
        break;
      case 'undo_last_log':
        await undoLastLog();
        break;
      case 'clear_chat':
        await clearChatHistory();
        break;
      case 'update_profile':
        await updateProfile(params);
        break;
    }
  };

  const handleSend = async (prefill?: string) => {
    const userMsg = (prefill ?? message).trim();
    if (!userMsg || loading) return;
    setMessage('');
    setLoading(true);
    await addChatMessage('user', userMsg);

    try {
      const history = chatMessages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke('ai-coach', {
        body: { message: userMsg, context: buildContext(), history },
      });

      if (error) throw error;

      let response = data?.response || "I'm here to help you stay hydrated!";
      response = sanitize(response);

      if (data?.action) await handleAIAction(data.action);
      await addChatMessage('assistant', response);
    } catch (_) {
      await addChatMessage('assistant', "I'm having trouble connecting right now. Please try again.");
    }

    setLoading(false);
  };

  const suggestions = ['How am I doing today?', 'Set my goal to 100 oz', 'Tips for more water', 'When should I drink next?'];

  return (
    <ScreenContainer accentId={currentProfile.theme}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={94}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.botIcon}>
              <Ionicons name="chatbubble-ellipses" size={18} color={theme.colors.primary} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Blue</Text>
              <Text style={styles.headerSub}>Personal hydration assistant</Text>
            </View>
          </View>
          {chatMessages.length > 0 && (
            <Pressable style={styles.clearBtn} onPress={clearChatHistory}>
              <Ionicons name="trash-outline" size={18} color={theme.colors.textMuted} />
            </Pressable>
          )}
        </View>

        {!isPremium && (
          <SurfaceCard style={styles.freeBanner}>
            <Text style={styles.freeBannerText}>Blue is active. Premium in Settings adds deeper automation and priority responses.</Text>
          </SurfaceCard>
        )}

        <FlatList
          ref={listRef}
          data={chatMessages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <SurfaceCard style={styles.emptyChat} accent>
              <View style={styles.botIconLarge}>
                <Ionicons name="chatbubble-ellipses" size={30} color={theme.colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Ask anything about your hydration</Text>
              <Text style={styles.emptySub}>I can suggest goals, pacing, and quick adjustments for your routine.</Text>
              <View style={styles.suggestionsWrap}>
                {suggestions.map((s) => (
                  <Pressable key={s} style={styles.suggestionChip} onPress={() => handleSend(s)}>
                    <Text style={styles.suggestionText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </SurfaceCard>
          }
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              <Text style={[styles.bubbleText, item.role === 'user' ? styles.userText : styles.aiText]}>{item.content}</Text>
              <Text style={[styles.bubbleTime, item.role === 'user' ? styles.userTime : styles.aiTime]}>
                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )}
          ListFooterComponent={
            loading ? (
              <View style={[styles.bubble, styles.aiBubble]}>
                <ActivityIndicator color={theme.colors.primary} size="small" />
              </View>
            ) : null
          }
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Message your coach..."
            placeholderTextColor={theme.colors.textMuted}
            value={message}
            onChangeText={setMessage}
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
            multiline
          />
          <Pressable style={[styles.sendBtn, (!message.trim() || loading) && { opacity: 0.45 }]} onPress={() => handleSend()} disabled={!message.trim() || loading}>
            <Ionicons name="send" size={16} color={theme.colors.onPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: { flex: 1, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    botIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.softHighlight,
      borderWidth: 1,
      borderColor: theme.colors.primarySoft,
    },
    headerTitle: { color: theme.colors.primary, fontSize: theme.fontSize.lg, fontWeight: '800' },
    headerSub: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
    clearBtn: {
      width: 34,
      height: 34,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    freeBanner: {
      marginBottom: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceAlt,
      borderColor: theme.colors.primarySoft,
      paddingVertical: theme.spacing.sm,
    },
    freeBannerText: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, lineHeight: 17 },
    messageList: { paddingBottom: 16, gap: theme.spacing.sm, flexGrow: 1 },
    emptyChat: { alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.lg },
    botIconLarge: {
      width: 64,
      height: 64,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    emptyTitle: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: '800', textAlign: 'center' },
    emptySub: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, textAlign: 'center', lineHeight: 20 },
    suggestionsWrap: { width: '100%', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
    suggestionChip: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    suggestionText: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, fontWeight: '600' },
    bubble: {
      maxWidth: '84%',
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    userBubble: {
      alignSelf: 'flex-end',
      backgroundColor: theme.colors.primary,
      borderTopRightRadius: 8,
    },
    aiBubble: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderTopLeftRadius: 8,
    },
    bubbleText: { fontSize: theme.fontSize.base, lineHeight: 21 },
    userText: { color: theme.colors.onPrimary },
    aiText: { color: theme.colors.text },
    bubbleTime: { marginTop: 5, fontSize: 10 },
    userTime: { color: 'rgba(255,255,255,0.75)', textAlign: 'right' },
    aiTime: { color: theme.colors.textMuted },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: theme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingTop: theme.spacing.sm,
      paddingBottom: 20,
      backgroundColor: theme.colors.background,
    },
    textInput: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.input,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      color: theme.colors.text,
      fontSize: theme.fontSize.base,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      ...theme.shadows.card,
    },
    upgradeWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.lg },
    upgradeCard: { width: '100%', alignItems: 'center', gap: theme.spacing.sm },
    upgradeIconWrap: {
      width: 74,
      height: 74,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    upgradeTitle: { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: '800' },
    upgradeDesc: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, textAlign: 'center', lineHeight: 21 },
    upgradeBtn: {
      marginTop: theme.spacing.sm,
      height: 48,
      minWidth: 180,
      borderRadius: theme.radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      ...theme.shadows.card,
    },
    upgradeBtnText: { color: theme.colors.onPrimary, fontSize: theme.fontSize.base, fontWeight: '700' },
  });

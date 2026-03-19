import { useState, useRef, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useProfile } from '@/contexts/ProfileContext';
import { usePremium } from '@/contexts/PremiumContext';
import { supabase } from '@/lib/supabase';
import { Colors, FontSize, Radius, Spacing } from '@/theme/colors';
import { globalStyles } from '@/theme/styles';

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
    currentProfile, chatMessages, addChatMessage, clearChatHistory,
    getTodayIntake, getExpectedIntake, getStreak, getHydrationScore,
    updateProfile, addWaterLog, waterLogs,
  } = useProfile();
  const { isPremium } = usePremium();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [chatMessages]);

  if (!currentProfile) return null;

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
Recent: ${waterLogs.slice(0, 3).map(l => `${l.amount.toFixed(1)}${unit} ${l.drink_type}`).join(', ')}`;
  };

  const handleAIAction = async (action: { type: string; params: any }) => {
    switch (action.type) {
      case 'update_goal':
        if (action.params.daily_goal) await updateProfile({ daily_goal: action.params.daily_goal });
        break;
      case 'add_water':
        if (action.params.amount) await addWaterLog(action.params.amount, action.params.drink_type || 'Water');
        break;
      case 'update_interval':
        if (action.params.interval_length) await updateProfile({ interval_length: action.params.interval_length });
        break;
      case 'update_theme':
        if (action.params.theme) await updateProfile({ theme: action.params.theme });
        break;
    }
  };

  const handleSend = async () => {
    if (!message.trim() || loading) return;
    const userMsg = message.trim();
    setMessage('');
    setLoading(true);
    await addChatMessage('user', userMsg);

    try {
      const history = chatMessages.slice(-10).map(m => ({ role: m.role, content: m.content }));
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

  if (!isPremium) {
    return (
      <View style={[globalStyles.screen, globalStyles.center]}>
        <View style={styles.upgradeCard}>
          <Ionicons name="chatbubble-ellipses" size={48} color={Colors.primary} />
          <Text style={styles.upgradeTitle}>AI Coach</Text>
          <Text style={styles.upgradeDesc}>Upgrade to Premium to unlock personalized hydration coaching, smart schedule adjustments, and AI-powered insights.</Text>
          <Pressable style={styles.upgradeBtn} onPress={() => Toast.show({ type: 'info', text1: 'Upgrade in Settings tab' })}>
            <Text style={styles.upgradeBtnText}>Learn More</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={globalStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.botIcon}>
            <Ionicons name="chatbubble-ellipses" size={20} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>AI Coach</Text>
            <Text style={styles.headerSub}>Your hydration assistant</Text>
          </View>
        </View>
        {chatMessages.length > 0 && (
          <Pressable onPress={clearChatHistory}>
            <Ionicons name="trash-outline" size={20} color={Colors.muted} />
          </Pressable>
        )}
      </View>

      <FlatList
        ref={listRef}
        data={chatMessages}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <View style={styles.botIconLg}>
              <Ionicons name="chatbubble-ellipses" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.emptyChatTitle}>Hi! I'm your AI Coach</Text>
            <Text style={styles.emptyChatSub}>Ask me anything about your hydration.</Text>
            <View style={styles.suggestionsWrap}>
              {suggestions.map(s => (
                <Pressable key={s} style={styles.suggestionChip} onPress={() => setMessage(s)}>
                  <Text style={styles.suggestionText}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            <Text style={[styles.bubbleText, item.role === 'user' ? styles.userText : styles.aiText]}>
              {item.content}
            </Text>
            <Text style={[styles.bubbleTime, item.role === 'user' ? styles.userTime : styles.aiTime]}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}
        ListFooterComponent={
          loading ? (
            <View style={[styles.bubble, styles.aiBubble]}>
              <ActivityIndicator color={Colors.primary} size="small" />
            </View>
          ) : null
        }
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask your AI coach…"
          placeholderTextColor={Colors.muted}
          value={message}
          onChangeText={setMessage}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          multiline
        />
        <Pressable style={[styles.sendBtn, (!message.trim() || loading) && { opacity: 0.4 }]} onPress={handleSend} disabled={!message.trim() || loading}>
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: 60, paddingBottom: Spacing.md },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  botIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.foreground },
  headerSub: { fontSize: FontSize.xs, color: Colors.muted },
  messageList: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg, flexGrow: 1 },
  emptyChat: { alignItems: 'center', paddingTop: 40, gap: Spacing.md },
  botIconLg: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)' },
  emptyChatTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.foreground },
  emptyChatSub: { fontSize: FontSize.base, color: Colors.muted, textAlign: 'center', maxWidth: 260 },
  suggestionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center', paddingHorizontal: Spacing.md },
  suggestionChip: { backgroundColor: Colors.card, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.cardBorder, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  suggestionText: { fontSize: FontSize.sm, color: Colors.muted },
  bubble: { maxWidth: '80%', padding: Spacing.md, borderRadius: Radius.xl, marginBottom: Spacing.sm },
  userBubble: { alignSelf: 'flex-end', backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: FontSize.base, lineHeight: 22 },
  userText: { color: '#fff' },
  aiText: { color: Colors.foreground },
  bubbleTime: { fontSize: 10, marginTop: 4 },
  userTime: { color: 'rgba(255,255,255,0.6)', textAlign: 'right' },
  aiTime: { color: Colors.muted },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: Spacing.md, paddingBottom: 34, gap: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background },
  textInput: { flex: 1, backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.xl, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: Colors.foreground, fontSize: FontSize.base, maxHeight: 120 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  upgradeCard: { backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.xl, margin: Spacing.lg, alignItems: 'center', gap: Spacing.md },
  upgradeTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.foreground },
  upgradeDesc: { fontSize: FontSize.base, color: Colors.muted, textAlign: 'center', lineHeight: 22 },
  upgradeBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  upgradeBtnText: { color: '#fff', fontWeight: '600', fontSize: FontSize.base },
});

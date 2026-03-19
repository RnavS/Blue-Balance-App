import { useState, useRef, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList,
  ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { CameraView, Camera, BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useProfile } from '@/contexts/ProfileContext';
import { Colors, FontSize, Radius, Spacing } from '@/theme/colors';
import { globalStyles } from '@/theme/styles';
import { supabase } from '@/lib/supabase';

type View_ = 'scan' | 'manual' | 'history';

const BARCODE_CACHE: Record<string, any> = {};

export default function ScanScreen() {
  const { currentProfile, addWaterLog, scannedBeverages, addScannedBeverage } = useProfile();
  const [activeView, setActiveView] = useState<View_>('scan');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{ name: string; amount: number } | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualSize, setManualSize] = useState('');

  useEffect(() => {
    Camera.requestCameraPermissionsAsync().then(({ status }) => {
      setHasPermission(status === 'granted');
    });
  }, []);

  if (!currentProfile) return null;

  const unit = currentProfile.unit_preference;

  const lookupBarcode = async (barcode: string) => {
    if (BARCODE_CACHE[barcode]) return BARCODE_CACHE[barcode];

    const saved = scannedBeverages.find(b => b.barcode === barcode);
    if (saved) return { name: saved.name, serving_size: saved.serving_size, hydration_factor: saved.hydration_factor };

    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
      const data = await res.json();
      if (data?.status === 1 && data?.product) {
        const p = data.product;
        const name = p.product_name || p.generic_name || 'Scanned Beverage';
        const servingG = p.serving_quantity ?? 250;
        const servingMl = servingG;
        const amount = unit === 'oz' ? servingMl / 29.5735 : servingMl;
        const result = { name, serving_size: Math.round(amount), hydration_factor: 0.9 };
        BARCODE_CACHE[barcode] = result;
        return result;
      }
    } catch (_) {}

    return null;
  };

  const handleBarcode = async (e: BarcodeScanningResult) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);

    const result = await lookupBarcode(e.data);

    if (result) {
      setLastResult({ name: result.name, amount: result.serving_size });
      await addWaterLog(result.serving_size, result.name, result.hydration_factor);
      await addScannedBeverage({ barcode: e.data, name: result.name, serving_size: result.serving_size, hydration_factor: result.hydration_factor });
      Toast.show({ type: 'success', text1: result.name, text2: `+${result.serving_size.toFixed(0)} ${unit} logged` });
    } else {
      Toast.show({ type: 'info', text1: 'Product not found', text2: 'Try entering details manually.' });
    }

    setLoading(false);
    setTimeout(() => setScanned(false), 2500);
  };

  const handleManualAdd = async () => {
    if (!manualName.trim()) { Toast.show({ type: 'error', text1: 'Name required' }); return; }
    const amount = parseFloat(manualSize) || (unit === 'oz' ? 8 : 240);
    await addWaterLog(amount, manualName.trim(), 1.0);
    Toast.show({ type: 'success', text1: `${manualName} logged`, text2: `+${amount} ${unit}` });
    setManualName(''); setManualSize('');
  };

  return (
    <View style={globalStyles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Quick Scan</Text>
        <View style={styles.segmented}>
          {(['scan', 'manual', 'history'] as View_[]).map(v => (
            <Pressable
              key={v}
              style={[styles.segBtn, activeView === v && styles.segBtnActive]}
              onPress={() => setActiveView(v)}
            >
              <Text style={[styles.segText, activeView === v && styles.segTextActive]}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {activeView === 'scan' && (
        <View style={styles.cameraContainer}>
          {hasPermission === null && (
            <View style={styles.permCenter}>
              <ActivityIndicator color={Colors.primary} size="large" />
            </View>
          )}
          {hasPermission === false && (
            <View style={styles.permCenter}>
              <Ionicons name="camera-outline" size={48} color={Colors.muted} />
              <Text style={styles.permText}>Camera permission denied.</Text>
              <Pressable style={styles.permBtn} onPress={() => Camera.requestCameraPermissionsAsync().then(({ status }) => setHasPermission(status === 'granted'))}>
                <Text style={styles.permBtnText}>Grant Permission</Text>
              </Pressable>
            </View>
          )}
          {hasPermission === true && (
            <>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }}
                onBarcodeScanned={handleBarcode}
              />
              <View style={styles.scanOverlay}>
                <View style={styles.scanFrame} />
                <Text style={styles.scanHint}>Point camera at barcode</Text>
              </View>
              {loading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator color={Colors.primary} size="large" />
                  <Text style={styles.loadingText}>Looking up product…</Text>
                </View>
              )}
              {lastResult && (
                <View style={styles.resultBanner}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                  <Text style={styles.resultText}>{lastResult.name} — +{lastResult.amount.toFixed(0)} {unit}</Text>
                </View>
              )}
            </>
          )}
        </View>
      )}

      {activeView === 'manual' && (
        <View style={styles.manualContainer}>
          <Text style={styles.sectionTitle}>Log Manually</Text>
          <TextInput style={styles.input} placeholder="Beverage name" placeholderTextColor={Colors.muted} value={manualName} onChangeText={setManualName} />
          <TextInput style={styles.input} placeholder={`Amount in ${unit}`} placeholderTextColor={Colors.muted} value={manualSize} onChangeText={setManualSize} keyboardType="numeric" />
          <Pressable style={styles.addBtn} onPress={handleManualAdd}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addBtnText}>Log Beverage</Text>
          </Pressable>
        </View>
      )}

      {activeView === 'history' && (
        <FlatList
          data={scannedBeverages}
          keyExtractor={b => b.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="scan-outline" size={48} color={Colors.muted} />
              <Text style={styles.emptyText}>No scanned beverages yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.historyItem}
              onPress={() => {
                addWaterLog(item.serving_size, item.name, item.hydration_factor);
                Toast.show({ type: 'success', text1: item.name, text2: `+${item.serving_size} ${unit}` });
              }}
            >
              <View style={styles.histIconBox}>
                <Ionicons name="barcode" size={18} color={Colors.primary} />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.histName}>{item.name}</Text>
                <Text style={styles.histMeta}>{item.serving_size} {unit} · tap to log</Text>
              </View>
              <Ionicons name="add-circle" size={24} color={Colors.primary} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.lg, paddingTop: 60, paddingBottom: Spacing.md, gap: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.foreground },
  segmented: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: Radius.lg, padding: 3, borderWidth: 1, borderColor: Colors.cardBorder },
  segBtn: { flex: 1, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md },
  segBtnActive: { backgroundColor: Colors.primary },
  segText: { fontSize: FontSize.sm, color: Colors.muted, fontWeight: '500' },
  segTextActive: { color: '#fff', fontWeight: '600' },
  cameraContainer: { flex: 1, position: 'relative' },
  permCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  permText: { fontSize: FontSize.base, color: Colors.muted, textAlign: 'center' },
  permBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  permBtnText: { color: '#fff', fontWeight: '600' },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  scanFrame: { width: 240, height: 160, borderWidth: 2, borderColor: Colors.primary, borderRadius: Radius.xl, backgroundColor: 'transparent' },
  scanHint: { color: '#fff', fontSize: FontSize.base, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  loadingText: { color: '#fff', fontSize: FontSize.base },
  resultBanner: { position: 'absolute', bottom: 40, left: Spacing.lg, right: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.cardBorder },
  resultText: { flex: 1, color: Colors.foreground, fontSize: FontSize.sm, fontWeight: '500' },
  manualContainer: { padding: Spacing.lg, gap: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.foreground },
  input: { backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 52, color: Colors.foreground, fontSize: FontSize.base },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.lg, height: 52 },
  addBtnText: { color: '#fff', fontSize: FontSize.base, fontWeight: '600' },
  list: { paddingHorizontal: Spacing.md, paddingBottom: 100 },
  historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.md },
  histIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  flex1: { flex: 1 },
  histName: { fontSize: FontSize.base, fontWeight: '500', color: Colors.foreground },
  histMeta: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyText: { fontSize: FontSize.base, color: Colors.muted },
});

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TextInput,
  Modal,
  Switch,
} from 'react-native';
import { CameraView, Camera, BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import ScreenContainer from '@/components/ui/ScreenContainer';
import SurfaceCard from '@/components/ui/SurfaceCard';
import { useProfile } from '@/contexts/ProfileContext';
import { useAppTheme } from '@/theme/useAppTheme';

type ViewMode = 'scan' | 'manual' | 'history';
type BarcodeLookupResult = {
  name: string;
  serving_size: number;
  hydration_factor: number;
  source: 'saved' | 'lookup';
};

const BARCODE_CACHE: Record<string, any> = {};
const GO_UPC_API_KEY = process.env.EXPO_PUBLIC_GO_UPC_API_KEY ?? '';

export default function ScanScreen() {
  const { currentProfile, addWaterLog, scannedBeverages, addScannedBeverage, deleteScannedBeverage } = useProfile();
  const [activeView, setActiveView] = useState<ViewMode>('scan');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{ name: string; amount: number } | null>(null);
  const [pendingScan, setPendingScan] = useState<(BarcodeLookupResult & { barcode: string }) | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [confirmSize, setConfirmSize] = useState('');
  const [rememberBarcode, setRememberBarcode] = useState(true);
  const [manualName, setManualName] = useState('');
  const [manualSize, setManualSize] = useState('');
  const scanLockRef = useRef(false);
  const lastScanRef = useRef<{ barcode: string; ts: number } | null>(null);

  useEffect(() => {
    Camera.requestCameraPermissionsAsync().then(({ status }) => {
      setHasPermission(status === 'granted');
    });
  }, []);

  if (!currentProfile) return null;

  const theme = useAppTheme(currentProfile.theme);
  const styles = createStyles(theme);
  const unit = currentProfile.unit_preference;

  const parseNumeric = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(',', '.').match(/\d+(\.\d+)?/);
      if (cleaned) {
        const num = parseFloat(cleaned[0]);
        if (Number.isFinite(num) && num > 0) return num;
      }
    }
    return null;
  };

  const toMl = (amount: number, rawUnit: string): number | null => {
    const u = rawUnit.toLowerCase().trim();
    if (!u) return null;
    if (u.includes('ml')) return amount;
    if (u === 'l' || u.includes('liter') || u.includes('litre')) return amount * 1000;
    if (u.includes('cl')) return amount * 10;
    if (u.includes('fl oz') || u.includes('fluid ounce') || u === 'oz' || u.includes('ounce')) {
      return amount * 29.5735;
    }
    return null;
  };

  const parseVolumeFromText = (value: unknown): number | null => {
    if (typeof value !== 'string' || !value.trim()) return null;
    const str = value.replace(',', '.').toLowerCase();
    const regex = /(\d+(?:\.\d+)?)\s*(fl\.?\s*oz|fluid\s*ounces?|oz|ml|millilit(?:er|re)s?|lit(?:er|re)s?|l|cl)\b/g;
    const candidates: number[] = [];
    let match: RegExpExecArray | null = regex.exec(str);
    while (match) {
      const amount = parseFloat(match[1]);
      const converted = toMl(amount, match[2]);
      if (converted && converted > 0) candidates.push(converted);
      match = regex.exec(str);
    }
    if (!candidates.length) return null;
    const realistic = candidates.filter((v) => v >= 100 && v <= 3000);
    return (realistic.length ? Math.max(...realistic) : Math.max(...candidates));
  };

  const extractServingFromOpenFoodFacts = (product: any): number | null => {
    const containerMl: number[] = [];
    const servingMl: number[] = [];

    const productQuantity = parseNumeric(product?.product_quantity);
    if (productQuantity) {
      const unitFromField = String(product?.product_quantity_unit || '').trim();
      const converted = unitFromField ? toMl(productQuantity, unitFromField) : productQuantity;
      if (converted && converted > 0) containerMl.push(converted);
    }

    const quantityText = parseVolumeFromText(product?.quantity);
    if (quantityText) containerMl.push(quantityText);

    const nameText = parseVolumeFromText(product?.product_name);
    if (nameText) containerMl.push(nameText);

    const genericNameText = parseVolumeFromText(product?.generic_name);
    if (genericNameText) containerMl.push(genericNameText);

    const servingText = parseVolumeFromText(product?.serving_size);
    if (servingText) servingMl.push(servingText);

    const nutrServingText = parseVolumeFromText(product?.nutriments?.serving_size);
    if (nutrServingText) servingMl.push(nutrServingText);

    const servingQuantity = parseNumeric(product?.serving_quantity);
    if (servingQuantity) {
      const servingUnit = String(product?.serving_quantity_unit || product?.serving_unit || 'ml');
      const converted = toMl(servingQuantity, servingUnit);
      if (converted && converted > 0) servingMl.push(converted);
    }

    const containerFiltered = containerMl.filter((v) => Number.isFinite(v) && v > 0 && v <= 5000);
    const servingFiltered = servingMl.filter((v) => Number.isFinite(v) && v > 0 && v <= 5000);

    const pool = containerFiltered.length ? containerFiltered : servingFiltered;
    if (!pool.length) return null;

    const realistic = pool.filter((v) => v >= 120 && v <= 3000);
    const ml = realistic.length ? Math.max(...realistic) : Math.max(...pool);
    const converted = unit === 'oz' ? ml / 29.5735 : ml;
    return unit === 'oz' ? Math.round(converted * 10) / 10 : Math.round(converted);
  };

  const normalizeVolumeToCurrentUnit = (ml: number): number => {
    const converted = unit === 'oz' ? ml / 29.5735 : ml;
    return unit === 'oz' ? Math.round(converted * 10) / 10 : Math.round(converted);
  };

  const extractVolumeFromCandidateTexts = (texts: Array<unknown>): number | null => {
    for (const value of texts) {
      const parsedMl = parseVolumeFromText(value);
      if (parsedMl) return normalizeVolumeToCurrentUnit(parsedMl);
    }
    return null;
  };

  const extractVolumeFromUnknownObject = (node: unknown): number | null => {
    const found: number[] = [];
    const seen = new Set<unknown>();

    const visit = (value: unknown, keyPath: string = '') => {
      if (value === null || value === undefined) return;
      if (typeof value === 'object') {
        if (seen.has(value)) return;
        seen.add(value);
      }

      if (typeof value === 'string') {
        const fromText = parseVolumeFromText(value);
        if (fromText) found.push(fromText);
        return;
      }

      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        if (/volume|size|content|quantity|serving|fluid|net/i.test(keyPath)) {
          const fromText = parseVolumeFromText(`${value} ${keyPath}`);
          if (fromText) found.push(fromText);
        }
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((item) => visit(item, keyPath));
        return;
      }

      if (typeof value === 'object') {
        Object.entries(value as Record<string, unknown>).forEach(([k, v]) => visit(v, k));
      }
    };

    visit(node);

    if (!found.length) return null;
    const realistic = found.filter((v) => v >= 120 && v <= 3000);
    const ml = realistic.length ? Math.max(...realistic) : Math.max(...found);
    return normalizeVolumeToCurrentUnit(ml);
  };

  const lookupBarcode = async (barcode: string): Promise<BarcodeLookupResult | null> => {
    if (BARCODE_CACHE[barcode]) return BARCODE_CACHE[barcode];

    const saved = scannedBeverages.find((b) => b.barcode === barcode);
    if (saved) {
      const result = {
        name: saved.name,
        serving_size: saved.serving_size,
        hydration_factor: saved.hydration_factor,
        source: 'saved' as const,
      };
      BARCODE_CACHE[barcode] = result;
      return result;
    }

    const defaultServing = unit === 'oz' ? 16.9 : 500;
    let resolvedName: string | null = null;
    let resolvedServing: number | null = null;

    // 1) Open Food Facts (primary)
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
      const data = await res.json();
      if (data?.status === 1 && data?.product) {
        const p = data.product;
        resolvedName = p.product_name || p.generic_name || resolvedName;
        resolvedServing = extractServingFromOpenFoodFacts(p) ?? resolvedServing;
      }
    } catch (_) {
      // Continue fallbacks.
    }

    // 2) UPCitemdb (fallback)
    if (!resolvedName || !resolvedServing) {
      try {
        const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`);
        if (res.ok) {
          const data = await res.json();
          const item = Array.isArray(data?.items) ? data.items[0] : null;
          if (item) {
            resolvedName = resolvedName || item.title || item.brand || null;
            if (!resolvedServing) {
              resolvedServing = extractVolumeFromCandidateTexts([
                item.size,
                item.dimension,
                item.weight,
                item.description,
                item.title,
              ]);
            }
          }
        }
      } catch (_) {
        // Continue fallbacks.
      }
    }

    // 3) Go-UPC (fallback)
    if ((!resolvedName || !resolvedServing) && GO_UPC_API_KEY) {
      try {
        const res = await fetch(`https://go-upc.com/api/v1/code/${encodeURIComponent(barcode)}?key=${encodeURIComponent(GO_UPC_API_KEY)}`);
        if (res.ok) {
          const data = await res.json();
          const productNode = data?.product ?? data?.item ?? data?.data ?? data;
          resolvedName = resolvedName || productNode?.name || productNode?.title || productNode?.product_name || null;
          if (!resolvedServing) {
            resolvedServing = extractVolumeFromUnknownObject(productNode);
          }
        }
      } catch (_) {
        // Fall through.
      }
    }

    if (resolvedName || resolvedServing) {
      const safeName = resolvedName || 'Scanned Beverage';
      const result: BarcodeLookupResult = {
        name: safeName,
        serving_size: resolvedServing ?? defaultServing,
        hydration_factor: safeName.toLowerCase().includes('water') ? 1.0 : 0.9,
        source: 'lookup',
      };
      BARCODE_CACHE[barcode] = result;
      return result;
    }

    return null;
  };

  const handleBarcode = async (e: BarcodeScanningResult) => {
    if (scanLockRef.current || scanned || loading) return;

    const now = Date.now();
    if (lastScanRef.current && lastScanRef.current.barcode === e.data && now - lastScanRef.current.ts < 8000) {
      return;
    }
    lastScanRef.current = { barcode: e.data, ts: now };
    scanLockRef.current = true;

    setScanned(true);
    setLoading(true);

    const result = await lookupBarcode(e.data);

    if (result) {
      setPendingScan({ ...result, barcode: e.data });
      setConfirmName(result.name);
      setConfirmSize(String(result.serving_size));
      setRememberBarcode(result.source === 'saved');
    } else {
      Toast.show({ type: 'info', text1: 'Product not found', text2: 'Try entering details manually.' });
    }

    setLoading(false);
    if (!result) {
      setTimeout(() => {
        setScanned(false);
        scanLockRef.current = false;
      }, 1200);
    }
  };

  const confirmPendingScan = async () => {
    if (!pendingScan) return;
    const amount = parseFloat(confirmSize);
    if (!Number.isFinite(amount) || amount <= 0) {
      Toast.show({ type: 'error', text1: 'Invalid size', text2: `Enter a valid amount in ${unit}.` });
      return;
    }

    const finalName = confirmName.trim() || pendingScan.name;
    await addWaterLog(amount, finalName, pendingScan.hydration_factor);

    if (rememberBarcode) {
      const existing = scannedBeverages.filter((b) => b.barcode === pendingScan.barcode);
      for (const item of existing) {
        await deleteScannedBeverage(item.id);
      }
      await addScannedBeverage({
        barcode: pendingScan.barcode,
        name: finalName,
        serving_size: amount,
        hydration_factor: pendingScan.hydration_factor,
      });
      BARCODE_CACHE[pendingScan.barcode] = {
        name: finalName,
        serving_size: amount,
        hydration_factor: pendingScan.hydration_factor,
        source: 'saved',
      };
    }

    setLastResult({ name: finalName, amount });
    Toast.show({ type: 'success', text1: finalName, text2: `+${amount.toFixed(1)} ${unit} logged` });
    setPendingScan(null);
    setScanned(false);
    scanLockRef.current = false;
  };

  const cancelPendingScan = () => {
    setPendingScan(null);
    setScanned(false);
    scanLockRef.current = false;
  };

  const handleManualAdd = async () => {
    if (!manualName.trim()) {
      Toast.show({ type: 'error', text1: 'Name required' });
      return;
    }
    const amount = parseFloat(manualSize) || (unit === 'oz' ? 8 : 240);
    await addWaterLog(amount, manualName.trim(), 1.0);
    Toast.show({ type: 'success', text1: `${manualName} logged`, text2: `+${amount} ${unit}` });
    setManualName('');
    setManualSize('');
  };

  return (
    <ScreenContainer accentId={currentProfile.theme}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Scan & Log</Text>
          <Text style={styles.subtitle}>Saved, Open Food Facts, UPCitemdb, then Go-UPC fallback.</Text>
        </View>

        <View style={styles.segmented}>
          {(['scan', 'manual', 'history'] as ViewMode[]).map((v) => (
            <Pressable key={v} style={[styles.segBtn, activeView === v && styles.segBtnActive]} onPress={() => setActiveView(v)}>
              <Text style={[styles.segText, activeView === v && styles.segTextActive]}>{v.charAt(0).toUpperCase() + v.slice(1)}</Text>
            </Pressable>
          ))}
        </View>

        {activeView === 'scan' && (
          <View style={styles.cameraWrap}>
            {hasPermission === null && (
              <View style={styles.centerState}>
                <ActivityIndicator color={theme.colors.primary} size="large" />
                <Text style={styles.stateText}>Checking camera access…</Text>
              </View>
            )}

            {hasPermission === false && (
              <View style={styles.centerState}>
                <Ionicons name="camera-outline" size={42} color={theme.colors.textMuted} />
                <Text style={styles.stateText}>Camera permission denied.</Text>
                <Pressable style={styles.permissionBtn} onPress={() => Camera.requestCameraPermissionsAsync().then(({ status }) => setHasPermission(status === 'granted'))}>
                  <Text style={styles.permissionBtnText}>Grant Permission</Text>
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
                  <View style={styles.scanBox}>
                    <View style={styles.scanCornerTopLeft} />
                    <View style={styles.scanCornerTopRight} />
                    <View style={styles.scanCornerBottomLeft} />
                    <View style={styles.scanCornerBottomRight} />
                  </View>
                  <Text style={styles.scanHint}>Align the barcode inside the frame</Text>
                </View>

                {loading && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator color={theme.colors.onPrimary} size="large" />
                    <Text style={styles.loadingText}>Fetching product…</Text>
                  </View>
                )}

                {lastResult && (
                  <View style={styles.resultBanner}>
                    <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
                    <Text style={styles.resultText}>{lastResult.name} · +{lastResult.amount.toFixed(1)} {unit}</Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {activeView === 'manual' && (
          <SurfaceCard style={styles.manualCard}>
            <Text style={styles.sectionTitle}>Manual log</Text>
            <TextInput style={styles.input} placeholder="Beverage name" placeholderTextColor={theme.colors.textMuted} value={manualName} onChangeText={setManualName} />
            <TextInput style={styles.input} placeholder={`Amount in ${unit}`} placeholderTextColor={theme.colors.textMuted} value={manualSize} onChangeText={setManualSize} keyboardType="numeric" />
            <Pressable style={styles.manualBtn} onPress={handleManualAdd}>
              <Ionicons name="add" size={18} color={theme.colors.onPrimary} />
              <Text style={styles.manualBtnText}>Log Beverage</Text>
            </Pressable>
          </SurfaceCard>
        )}

        {activeView === 'history' && (
          <FlatList
            data={scannedBeverages}
            keyExtractor={(b) => b.id}
            contentContainerStyle={styles.historyList}
            ListEmptyComponent={
              <SurfaceCard style={styles.emptyCard}>
                <Ionicons name="scan-outline" size={42} color={theme.colors.textMuted} />
                <Text style={styles.emptyTitle}>No scanned beverages yet</Text>
                <Text style={styles.emptyText}>Scan a product to store it here for one-tap reuse.</Text>
              </SurfaceCard>
            }
            renderItem={({ item }) => (
              <View style={styles.historyItem}>
                <Pressable
                  style={styles.historyMainTap}
                  onPress={() => {
                    addWaterLog(item.serving_size, item.name, item.hydration_factor);
                    Toast.show({ type: 'success', text1: item.name, text2: `+${item.serving_size} ${unit}` });
                  }}
                >
                  <View style={styles.histIconBox}>
                    <Ionicons name="barcode" size={17} color={theme.colors.primary} />
                  </View>
                  <View style={styles.flex1}>
                    <Text style={styles.histName}>{item.name}</Text>
                    <Text style={styles.histMeta}>{item.serving_size} {unit} · tap to log</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color={theme.colors.primary} />
                </Pressable>
                <Pressable
                  style={styles.removeSavedBtn}
                  onPress={async () => {
                    await deleteScannedBeverage(item.id);
                    delete BARCODE_CACHE[item.barcode];
                    Toast.show({ type: 'success', text1: 'Removed saved barcode', text2: 'Scan again to re-save with a new size.' });
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                  <Text style={styles.removeSavedText}>Remove</Text>
                </Pressable>
              </View>
            )}
          />
        )}
      </View>

      <Modal visible={!!pendingScan} transparent animationType="fade" onRequestClose={cancelPendingScan}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Product found</Text>
            <Text style={styles.confirmSub}>
              {pendingScan?.source === 'saved'
                ? 'Saved product detected. Confirm before logging.'
                : 'Confirm details before logging.'}
            </Text>

            <Text style={styles.confirmLabel}>Product name</Text>
            <TextInput
              style={styles.input}
              value={confirmName}
              onChangeText={setConfirmName}
              placeholder="Product name"
              placeholderTextColor={theme.colors.textMuted}
            />

            <Text style={styles.confirmLabel}>Amount ({unit})</Text>
            <TextInput
              style={styles.input}
              value={confirmSize}
              onChangeText={setConfirmSize}
              keyboardType="decimal-pad"
              placeholder={`Amount in ${unit}`}
              placeholderTextColor={theme.colors.textMuted}
            />

            <View style={styles.rememberRow}>
              <View style={styles.flex1}>
                <Text style={styles.rememberTitle}>Don’t ask again for this barcode</Text>
                <Text style={styles.rememberSub}>Save this size for future scans of the same product.</Text>
              </View>
              <Switch
                value={rememberBarcode}
                onValueChange={setRememberBarcode}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              />
            </View>

            <View style={styles.confirmActions}>
              <Pressable style={styles.cancelBtn} onPress={cancelPendingScan}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmBtn} onPress={confirmPendingScan}>
                <Text style={styles.confirmBtnText}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: { flex: 1, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm },
    header: { marginBottom: theme.spacing.md },
    title: { fontSize: theme.fontSize.xxl + 2, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.4 },
    subtitle: { marginTop: theme.spacing.xs, fontSize: theme.fontSize.sm, color: theme.colors.textMuted },
    segmented: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surface,
      padding: 4,
      gap: 6,
      marginBottom: theme.spacing.md,
    },
    segBtn: { flex: 1, height: 34, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
    segBtnActive: { backgroundColor: theme.colors.softHighlight },
    segText: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, fontWeight: '600' },
    segTextActive: { color: theme.colors.primary, fontWeight: '700' },
    cameraWrap: {
      flex: 1,
      borderRadius: theme.radius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      marginBottom: theme.spacing.md,
    },
    centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, padding: theme.spacing.lg },
    stateText: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, textAlign: 'center' },
    permissionBtn: {
      marginTop: theme.spacing.sm,
      height: 44,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.lg,
    },
    permissionBtnText: { color: theme.colors.onPrimary, fontSize: theme.fontSize.sm, fontWeight: '700' },
    scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md },
    scanBox: { width: 250, height: 156, borderRadius: 20, backgroundColor: 'transparent', position: 'relative' },
    scanCornerTopLeft: { position: 'absolute', top: 0, left: 0, width: 42, height: 42, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#FFFFFF', borderTopLeftRadius: 16 },
    scanCornerTopRight: { position: 'absolute', top: 0, right: 0, width: 42, height: 42, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#FFFFFF', borderTopRightRadius: 16 },
    scanCornerBottomLeft: { position: 'absolute', bottom: 0, left: 0, width: 42, height: 42, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#FFFFFF', borderBottomLeftRadius: 16 },
    scanCornerBottomRight: { position: 'absolute', bottom: 0, right: 0, width: 42, height: 42, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#FFFFFF', borderBottomRightRadius: 16 },
    scanHint: {
      color: '#FFFFFF',
      fontSize: theme.fontSize.sm,
      fontWeight: '600',
      backgroundColor: 'rgba(0,0,0,0.45)',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 5,
      borderRadius: theme.radius.full,
    },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.overlay, gap: theme.spacing.sm },
    loadingText: { color: theme.colors.onPrimary, fontSize: theme.fontSize.sm },
    resultBanner: {
      position: 'absolute',
      left: theme.spacing.md,
      right: theme.spacing.md,
      bottom: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    resultText: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: '600', flex: 1 },
    manualCard: { gap: theme.spacing.md, marginBottom: theme.spacing.md },
    sectionTitle: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: '700' },
    input: {
      height: 50,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
      paddingHorizontal: theme.spacing.md,
      fontSize: theme.fontSize.base,
      color: theme.colors.text,
    },
    manualBtn: {
      height: 52,
      borderRadius: theme.radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.primary,
      ...theme.shadows.card,
    },
    manualBtnText: { color: theme.colors.onPrimary, fontSize: theme.fontSize.base, fontWeight: '700' },
    historyList: { paddingBottom: 130, gap: theme.spacing.sm },
    historyItem: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
      ...theme.shadows.card,
    },
    historyMainTap: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: 6 },
    histIconBox: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.softHighlight,
      borderWidth: 1,
      borderColor: theme.colors.primarySoft,
    },
    flex1: { flex: 1 },
    histName: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: '700' },
    histMeta: { marginTop: 2, color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
    removeSavedBtn: {
      alignSelf: 'flex-end',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.input,
    },
    removeSavedText: { color: theme.colors.danger, fontSize: theme.fontSize.xs, fontWeight: '700' },
    emptyCard: { alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.xl, paddingVertical: theme.spacing.xl },
    emptyTitle: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: '700' },
    emptyText: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, textAlign: 'center', lineHeight: 20 },
    confirmBackdrop: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.lg,
    },
    confirmCard: {
      width: '100%',
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      ...theme.shadows.floating,
    },
    confirmTitle: { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: '800' },
    confirmSub: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, marginBottom: 2 },
    confirmLabel: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, fontWeight: '600' },
    rememberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.xs,
    },
    rememberTitle: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: '700' },
    rememberSub: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, marginTop: 1 },
    confirmActions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs },
    cancelBtn: {
      flex: 1,
      height: 46,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceAlt,
    },
    cancelBtnText: { color: theme.colors.text, fontSize: theme.fontSize.base, fontWeight: '700' },
    confirmBtn: {
      flex: 1,
      height: 46,
      borderRadius: theme.radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      ...theme.shadows.card,
    },
    confirmBtnText: { color: theme.colors.onPrimary, fontSize: theme.fontSize.base, fontWeight: '800' },
  });

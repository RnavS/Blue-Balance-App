import { BrowserMultiFormatReader } from '@zxing/browser';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanBarcode,
  Camera,
  Check,
  Plus,
  Trash2,
  History as HistoryIcon,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProfile } from '@/contexts/ProfileContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface BeverageData {
  name: string;
  serving_size: number;
  hydration_factor: number;
  beverage_type: string;
}

interface BarcodeLookupResponse {
  found: boolean;
  name?: string;
  volume_ml?: number | null;
  volume_oz?: number | null;
}

type VolumeUnit = 'oz' | 'ml';

// Local cache for barcode lookups
const barcodeCache: Record<string, BeverageData> = {};
const PRODUCT_POPUP_PREFS_KEY = 'blueBalance_hideProductPopupByBarcode_v1';
const BARCODE_SIZE_OVERRIDES_KEY = 'blueBalance_barcodeSizeOverrides_v1';
const BARCODE_UNIT_PREFS_KEY = 'blueBalance_barcodeUnits_v1';
const KNOWN_BARCODE_VOLUME_OVERRIDES: Record<string, { oz: number; ml: number }> = {
  // EANData record has no volume fields for this Kirkland water barcode.
  '0096619082797': { oz: 16.9, ml: 500 },
  '096619082797': { oz: 16.9, ml: 500 },
};

const normalizeBarcode = (value: string) =>
  value.replace(/[^0-9A-Za-z]/g, '').trim();

const getBarcodeLookupCandidates = (raw: string): string[] => {
  const code = normalizeBarcode(raw);
  if (!code) return [];

  const variants = new Set<string>([code]);

  // UPC-A (12) <-> EAN-13 (13 with leading 0)
  if (/^\d+$/.test(code)) {
    if (code.length === 12) variants.add(`0${code}`);
    if (code.length === 13 && code.startsWith('0')) variants.add(code.slice(1));
  }

  return Array.from(variants);
};

const isLikelyBarcodeLength = (code: string) => {
  // Common lengths + allow longer Code128-style values
  return [8, 12, 13, 14].includes(code.length) || code.length >= 6;
};

const getHiddenPopupPreferences = (): Record<string, boolean> => {
  try {
    const raw = localStorage.getItem(PRODUCT_POPUP_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
};

const setHiddenPopupPreference = (barcode: string, hide: boolean) => {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) return;
  const current = getHiddenPopupPreferences();
  current[normalized] = hide;
  localStorage.setItem(PRODUCT_POPUP_PREFS_KEY, JSON.stringify(current));
};

const shouldHideProductPopup = (barcode: string) => {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) return false;
  return !!getHiddenPopupPreferences()[normalized];
};

const getBarcodeSizeOverrides = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(BARCODE_SIZE_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    const entries = Object.entries(parsed).filter(
      ([key, value]) => typeof key === 'string' && typeof value === 'number' && Number.isFinite(value) && value > 0,
    );

    return Object.fromEntries(entries);
  } catch {
    return {};
  }
};

const setBarcodeSizeOverride = (barcode: string, servingSize: number) => {
  const normalized = normalizeBarcode(barcode);
  if (!normalized || !Number.isFinite(servingSize) || servingSize <= 0) return;

  const current = getBarcodeSizeOverrides();
  current[normalized] = Math.round(servingSize * 10) / 10;
  localStorage.setItem(BARCODE_SIZE_OVERRIDES_KEY, JSON.stringify(current));
};

const getBarcodeUnitPreferences = (): Record<string, VolumeUnit> => {
  try {
    const raw = localStorage.getItem(BARCODE_UNIT_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    const entries = Object.entries(parsed).filter(
      ([key, value]) => typeof key === 'string' && (value === 'oz' || value === 'ml'),
    ) as Array<[string, VolumeUnit]>;

    return Object.fromEntries(entries);
  } catch {
    return {};
  }
};

const setBarcodeUnitPreference = (barcode: string, unit: VolumeUnit) => {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) return;
  const current = getBarcodeUnitPreferences();
  current[normalized] = unit;
  localStorage.setItem(BARCODE_UNIT_PREFS_KEY, JSON.stringify(current));
};

const getBarcodeUnitPreference = (barcode: string): VolumeUnit | null => {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) return null;
  const current = getBarcodeUnitPreferences();
  return current[normalized] || null;
};

const getBarcodeSizeOverride = (barcode: string) => {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) return null;

  const overrides = getBarcodeSizeOverrides();
  const value = overrides[normalized];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
};

const getKnownVolumeOverride = (barcodes: string[], unit: 'oz' | 'ml') => {
  for (const barcode of barcodes) {
    const normalized = normalizeBarcode(barcode);
    const known = KNOWN_BARCODE_VOLUME_OVERRIDES[normalized];
    if (known) return unit === 'oz' ? known.oz : known.ml;
  }
  return null;
};

const inferLegacySavedUnit = (servingSize: number, currentUnit: VolumeUnit): VolumeUnit => {
  // Legacy records didn't store unit. Use conservative heuristics when unit metadata is missing.
  if (currentUnit === 'ml' && servingSize > 0 && servingSize <= 40) return 'oz';
  if (currentUnit === 'oz' && servingSize >= 100) return 'ml';
  return currentUnit;
};

const getHydrationDefaults = (productName: string) => {
  const lower = productName.toLowerCase();

  if (lower.includes('water')) return { hydrationFactor: 1.0, beverageType: 'Water' };
  if (lower.includes('sparkling')) return { hydrationFactor: 1.0, beverageType: 'Sparkling Water' };
  if (lower.includes('tea')) return { hydrationFactor: 0.9, beverageType: 'Tea' };
  if (lower.includes('coffee')) return { hydrationFactor: 0.8, beverageType: 'Coffee' };
  if (lower.includes('juice')) return { hydrationFactor: 0.85, beverageType: 'Juice' };
  if (lower.includes('sports') || lower.includes('electrolyte')) return { hydrationFactor: 0.9, beverageType: 'Sports Drink' };
  if (lower.includes('soda') || lower.includes('cola') || lower.includes('soft drink')) return { hydrationFactor: 0.5, beverageType: 'Soda' };

  return { hydrationFactor: 0.85, beverageType: 'Other' };
};

const parseVolumeFromText = (input: string): { volumeMl: number; volumeOz: number } | null => {
  if (!input) return null;

  const regex = /(\d+(?:\.\d+)?)\s*(fl\.?\s*oz|oz|ml|l|cl)\b/gi;
  const matches: Array<{ volumeMl: number; volumeOz: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase().replace(/\s+/g, '');
    if (!Number.isFinite(value) || value <= 0) continue;

    if (unit === 'ml') {
      matches.push({ volumeMl: value, volumeOz: value / 29.5735 });
    } else if (unit === 'cl') {
      const ml = value * 10;
      matches.push({ volumeMl: ml, volumeOz: ml / 29.5735 });
    } else if (unit === 'l') {
      const ml = value * 1000;
      matches.push({ volumeMl: ml, volumeOz: ml / 29.5735 });
    } else if (unit === 'oz' || unit === 'fl.oz' || unit === 'floz') {
      matches.push({ volumeMl: value * 29.5735, volumeOz: value });
    }
  }

  if (!matches.length) return null;

  // Prefer larger container amounts over serving-size snippets in label text.
  return matches.reduce((best, curr) => (curr.volumeMl > best.volumeMl ? curr : best));
};

export function QuickScan() {
  const { currentProfile, addWaterLog, scannedBeverages, addScannedBeverage, deleteScannedBeverage, convertAmount } = useProfile();
  const { toast } = useToast();

  const [scanning, setScanning] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [estimatedBeverage, setEstimatedBeverage] = useState<BeverageData | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editServingSize, setEditServingSize] = useState('');
  const [editBeverageType, setEditBeverageType] = useState('');
  const [editHydrationFactor, setEditHydrationFactor] = useState('');
  const [hidePopupForProduct, setHidePopupForProduct] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const barcodeDetectorRef = useRef<any | null>(null);
  const scanBusyRef = useRef(false);
  const lastDetectedRef = useRef<{ value: string; at: number }>({ value: '', at: 0 });

  const unitPreference = currentProfile?.unit_preference || 'oz';

  useEffect(() => {
    // Serving size in cache depends on unit preference; clear cache when user switches units.
    Object.keys(barcodeCache).forEach((key) => {
      delete barcodeCache[key];
    });
  }, [unitPreference]);

  const convertSavedServingToCurrentUnit = (barcode: string, servingSize: number) => {
    const explicitUnit = getBarcodeUnitPreference(barcode);
    const savedUnit = explicitUnit || inferLegacySavedUnit(servingSize, unitPreference);
    if (savedUnit === unitPreference) return servingSize;
    return Math.round(convertAmount(servingSize, savedUnit, unitPreference) * 10) / 10;
  };

  const getResolvedOverrideForCandidates = (barcodes: string[]) => {
    for (const barcode of barcodes) {
      const rawOverride = getBarcodeSizeOverride(barcode);
      if (!rawOverride) continue;
      const explicitUnit = getBarcodeUnitPreference(barcode);
      const overrideUnit = explicitUnit || inferLegacySavedUnit(rawOverride, unitPreference);
      if (overrideUnit === unitPreference) return rawOverride;
      return Math.round(convertAmount(rawOverride, overrideUnit, unitPreference) * 10) / 10;
    }
    return null;
  };

  const setBeverageFromData = (data: BeverageData, barcode: string) => {
    setEstimatedBeverage(data);
    setEditName(data.name);
    setEditServingSize(data.serving_size.toString());
    setEditAmount(data.serving_size.toString());
    setEditBeverageType(data.beverage_type);
    setEditHydrationFactor((data.hydration_factor * 100).toString());
    setScannedBarcode(barcode);
    setHidePopupForProduct(false);
    setShowConfirmModal(true);
  };

  const logResolvedBeverage = async (data: BeverageData, barcode: string) => {
    await addWaterLog(data.serving_size, data.name, data.hydration_factor);

    if (!scannedBeverages.find((b) => normalizeBarcode(b.barcode) === normalizeBarcode(barcode))) {
      await addScannedBeverage({
        barcode,
        name: data.name,
        serving_size: data.serving_size,
        hydration_factor: data.hydration_factor,
      });
      setBarcodeUnitPreference(barcode, unitPreference);
    }

    toast({
      title: 'Beverage logged!',
      description: `+${data.serving_size} ${unitPreference} of ${data.name}`,
    });
  };

  const resolveServingSizeFromLookup = (lookupData: BarcodeLookupResponse) => {
    if (unitPreference === 'ml') {
      if (lookupData.volume_ml && lookupData.volume_ml > 0) return lookupData.volume_ml;
      if (lookupData.volume_oz && lookupData.volume_oz > 0) return lookupData.volume_oz * 29.5735;
      const parsedFromName = lookupData.name ? parseVolumeFromText(lookupData.name) : null;
      if (parsedFromName) return parsedFromName.volumeMl;
      return 355;
    }

    if (lookupData.volume_oz && lookupData.volume_oz > 0) return lookupData.volume_oz;
    if (lookupData.volume_ml && lookupData.volume_ml > 0) return lookupData.volume_ml / 29.5735;
    const parsedFromName = lookupData.name ? parseVolumeFromText(lookupData.name) : null;
    if (parsedFromName) return parsedFromName.volumeOz;
    return 12;
  };

  const lookupViaEanData = async (barcode: string): Promise<BeverageData | null> => {
    const { data, error } = await supabase.functions.invoke<BarcodeLookupResponse>('barcode-lookup', {
      body: { barcode },
    });

    if (error) {
      console.error('EANData lookup function error:', error);
      return null;
    }

    if (!data?.found || !data.name) return null;

    const defaults = getHydrationDefaults(data.name);
    const servingSize = resolveServingSizeFromLookup(data);

    return {
      name: data.name,
      serving_size: Math.round(servingSize * 10) / 10,
      hydration_factor: defaults.hydrationFactor,
      beverage_type: defaults.beverageType,
    };
  };

  const lookupViaOpenFoodFacts = async (lookupCandidates: string[]): Promise<BeverageData | null> => {
    for (const candidate of lookupCandidates) {
      const offResponse = await fetch(`https://world.openfoodfacts.org/api/v2/product/${candidate}.json`);
      const offData = await offResponse.json();

      if (offData.status === 1 && offData.product) {
        const product = offData.product;
        const name = product.product_name || product.product_name_en || 'Unknown Beverage';

        let servingSize = unitPreference === 'oz' ? 12 : 355;
        let parsedVolume: { volumeMl: number; volumeOz: number } | null = null;

        // Prefer package quantity fields (total container amount) over serving_size.
        const quantityCandidates: string[] = [];
        if (typeof product.quantity === 'string') quantityCandidates.push(product.quantity);
        if (typeof product.quantity_en === 'string') quantityCandidates.push(product.quantity_en);
        if (typeof product.product_quantity === 'string') quantityCandidates.push(product.product_quantity);
        if (typeof product.product_quantity === 'number' && typeof product.product_quantity_unit === 'string') {
          quantityCandidates.push(`${product.product_quantity} ${product.product_quantity_unit}`);
        }
        if (typeof product.quantity === 'number' && typeof product.quantity_unit === 'string') {
          quantityCandidates.push(`${product.quantity} ${product.quantity_unit}`);
        }

        for (const candidateText of quantityCandidates) {
          const parsed = parseVolumeFromText(candidateText);
          if (parsed) {
            parsedVolume = parsed;
            break;
          }
        }

        if (!parsedVolume && typeof product.serving_size === 'string') {
          parsedVolume = parseVolumeFromText(product.serving_size);
        }

        if (!parsedVolume) {
          parsedVolume = parseVolumeFromText(name);
        }

        if (parsedVolume) {
          servingSize = unitPreference === 'oz' ? parsedVolume.volumeOz : parsedVolume.volumeMl;
        }

        let hydrationFactor = 0.85;
        const categories = (product.categories_tags || []).join(' ').toLowerCase();

        if (categories.includes('water') || categories.includes('mineral')) {
          hydrationFactor = 1.0;
        } else if (categories.includes('tea')) {
          hydrationFactor = 0.9;
        } else if (categories.includes('coffee')) {
          hydrationFactor = 0.8;
        } else if (categories.includes('soda') || categories.includes('soft-drink')) {
          hydrationFactor = 0.5;
        } else if (categories.includes('juice')) {
          hydrationFactor = 0.85;
        } else if (categories.includes('sports') || categories.includes('energy')) {
          hydrationFactor = 0.9;
        }

        return {
          name,
          serving_size: Math.round(servingSize * 10) / 10,
          hydration_factor: hydrationFactor,
          beverage_type: name,
        };
      }
    }

    return null;
  };

  const lookupBarcode = async (barcodeInput: string) => {
    const normalizedBarcode = normalizeBarcode(barcodeInput);
    if (!normalizedBarcode) return;

    setLoading(true);
    setScannedBarcode(normalizedBarcode);

    const lookupCandidates = getBarcodeLookupCandidates(normalizedBarcode);
    const sizeOverride = getResolvedOverrideForCandidates(lookupCandidates);
    const knownVolumeOverride = getKnownVolumeOverride(lookupCandidates, unitPreference);

    // Check local cache first (all variants)
    for (const candidate of lookupCandidates) {
      if (barcodeCache[candidate]) {
        setBeverageFromData(barcodeCache[candidate], normalizedBarcode);
        setLoading(false);
        return;
      }
    }

    // Saved beverages are now fallback-only so stale historical sizes don't override fresh API data.
    const savedBeverage = scannedBeverages.find((b) =>
      lookupCandidates.includes(normalizeBarcode(b.barcode))
    );
    const savedBeverageData: BeverageData | null = savedBeverage
      ? {
          name: savedBeverage.name,
          serving_size: convertSavedServingToCurrentUnit(savedBeverage.barcode, savedBeverage.serving_size),
          hydration_factor: savedBeverage.hydration_factor,
          beverage_type: savedBeverage.name,
        }
      : null;

    // If user asked to skip popup and has an explicit size override, trust that saved value first.
    if (shouldHideProductPopup(normalizedBarcode) && savedBeverageData && sizeOverride) {
      const savedResolved = { ...savedBeverageData, serving_size: sizeOverride };
      await logResolvedBeverage(savedResolved, normalizedBarcode);
      setLoading(false);
      return;
    }

    let data: BeverageData | null = null;

    try {
      data = await lookupViaEanData(normalizedBarcode);
    } catch (error) {
      console.error('Unexpected EANData lookup error:', error);
    }

    // Preserve old behavior when EANData misses/fails.
    if (!data) {
      try {
        data = await lookupViaOpenFoodFacts(lookupCandidates);
      } catch (error) {
        console.error('Open Food Facts lookup failed:', error);
      }
    }

    if (!data && savedBeverageData) {
      data = savedBeverageData;
    }

    if (data) {
      if (sizeOverride) {
        data = { ...data, serving_size: sizeOverride };
      } else if (knownVolumeOverride) {
        data = { ...data, serving_size: knownVolumeOverride };
      }

      lookupCandidates.forEach((v) => {
        barcodeCache[v] = data;
      });

      if (shouldHideProductPopup(normalizedBarcode)) {
        await logResolvedBeverage(data, normalizedBarcode);
      } else {
        setBeverageFromData(data, normalizedBarcode);
        toast({
          title: 'Product found!',
          description: data.name,
        });
      }

      setLoading(false);
      return;
    }

    // Fallback: Allow manual creation
    const defaultData: BeverageData = {
      name: 'Unknown Beverage',
      serving_size: unitPreference === 'oz' ? 12 : 355,
      hydration_factor: 0.85,
      beverage_type: 'Other',
    };

    setBeverageFromData(defaultData, normalizedBarcode);
    setLoading(false);

    toast({
      title: 'Product not found',
      description: 'Please enter the beverage details manually',
    });
  };

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    try {
      zxingReaderRef.current?.reset?.();
    } catch {
      // ignore
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    scanBusyRef.current = false;

    setScanning(false);
    setCameraReady(false);
    setCameraError(null);
  }, []);

  const startBarcodeScanning = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize native detector once
    if (!barcodeDetectorRef.current && 'BarcodeDetector' in window) {
      try {
        barcodeDetectorRef.current = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        });
      } catch {
        barcodeDetectorRef.current = null;
      }
    }

    // Initialize ZXing fallback once
    if (!zxingReaderRef.current) {
      zxingReaderRef.current = new BrowserMultiFormatReader();
    }

    // Scan every 350ms
    scanIntervalRef.current = window.setInterval(async () => {
      if (scanBusyRef.current) return;
      if (!videoRef.current || !canvasRef.current) return;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

      scanBusyRef.current = true;

      try {
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        let rawValue: string | null = null;

        // 1) Native BarcodeDetector first (fast when supported)
        if (barcodeDetectorRef.current) {
          try {
            const barcodes = await barcodeDetectorRef.current.detect(canvas);
            if (barcodes?.length) {
              rawValue = barcodes[0]?.rawValue ?? null;
            }
          } catch {
            // ignore and fallback to ZXing
          }
        }

        // 2) ZXing fallback for browsers where native API is missing/weaker
        if (!rawValue && zxingReaderRef.current) {
          try {
            const result: any = await (zxingReaderRef.current as any).decodeFromCanvas(canvas);
            rawValue = result?.getText?.() ?? result?.text ?? null;
          } catch {
            // normal if no barcode in frame
          }
        }

        if (rawValue) {
          const normalized = normalizeBarcode(rawValue);
          if (!normalized) return;

          // Debounce same barcode for 2s
          const now = Date.now();
          const duplicateTooSoon =
            lastDetectedRef.current.value === normalized &&
            now - lastDetectedRef.current.at < 2000;

          if (duplicateTooSoon) return;

          lastDetectedRef.current = { value: normalized, at: now };

          stopCamera();
          lookupBarcode(normalized);
        }
      } finally {
        scanBusyRef.current = false;
      }
    }, 350);
  }, [stopCamera]); // lookupBarcode is stable enough for this usage

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setPermissionDenied(false);
    setCameraReady(false);
    setScanning(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('MediaDevices API not supported');
      }

      // Request camera with rear preference
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current
            ?.play()
            .then(() => {
              setCameraReady(true);
              startBarcodeScanning();
            })
            .catch(console.error);
        };
      }

      toast({
        title: 'Scanner active',
        description: 'Point at a barcode to scan',
      });
    } catch (error: any) {
      console.error('Camera error:', error);
      setScanning(false);

      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        setCameraError('Camera access was denied. Please allow camera access in your browser settings.');
      } else if (error?.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else if (error?.name === 'NotReadableError') {
        setCameraError('Camera is in use by another application.');
      } else {
        setCameraError('Failed to start camera. Please try again or enter barcode manually.');
      }
    }
  }, [toast, startBarcodeScanning]);

  useEffect(() => {
    canvasRef.current = document.createElement('canvas');

    if (!zxingReaderRef.current) {
      zxingReaderRef.current = new BrowserMultiFormatReader();
    }

    return () => {
      try {
        zxingReaderRef.current?.reset?.();
      } catch {
        // ignore
      }
      stopCamera();
    };
  }, [stopCamera]);

  const handleManualScan = () => {
    const normalized = normalizeBarcode(manualBarcode);

    if (!normalized) {
      toast({
        title: 'Enter barcode',
        description: 'Please enter a barcode number',
        variant: 'destructive',
      });
      return;
    }

    if (!isLikelyBarcodeLength(normalized)) {
      toast({
        title: 'Barcode looks invalid',
        description: 'Barcodes can be different lengths (8, 12, 13, 14+). Paste the full code exactly.',
        variant: 'destructive',
      });
      return;
    }

    lookupBarcode(normalized);
    setManualBarcode('');
  };

  const handleConfirm = async () => {
    const amount = parseFloat(editAmount);
    const hydrationFactor = parseFloat(editHydrationFactor) / 100;
    const normalizedScannedBarcode = normalizeBarcode(scannedBarcode);
    const updatedServingSize = parseFloat(editServingSize) || amount;

    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid amount',
        variant: 'destructive',
      });
      return;
    }

    // Log the beverage
    await addWaterLog(amount, editName || 'Beverage', hydrationFactor);

    const existingSaved = scannedBeverages.find(
      (b) => normalizeBarcode(b.barcode) === normalizedScannedBarcode,
    );

    // Persist edited values for this barcode. Replace existing record if needed.
    if (existingSaved) {
      const shouldReplace =
        existingSaved.name !== editName ||
        Math.abs(existingSaved.serving_size - updatedServingSize) > 0.01 ||
        Math.abs(existingSaved.hydration_factor - hydrationFactor) > 0.001;

      if (shouldReplace) {
        await deleteScannedBeverage(existingSaved.id);
        await addScannedBeverage({
          barcode: scannedBarcode,
          name: editName,
          serving_size: updatedServingSize,
          hydration_factor: hydrationFactor,
        });
      }
    } else {
      await addScannedBeverage({
        barcode: scannedBarcode,
        name: editName,
        serving_size: updatedServingSize,
        hydration_factor: hydrationFactor,
      });
    }

    if (hidePopupForProduct) {
      setHiddenPopupPreference(scannedBarcode, true);
    }

    setBarcodeSizeOverride(normalizedScannedBarcode, updatedServingSize);
    setBarcodeUnitPreference(normalizedScannedBarcode, unitPreference);

    toast({
      title: 'Beverage logged!',
      description: `+${amount} ${unitPreference} of ${editName}`,
    });

    setShowConfirmModal(false);
    setEstimatedBeverage(null);
    setScannedBarcode('');
  };

  const handleDeleteScanned = async (id: string) => {
    await deleteScannedBeverage(id);
    toast({
      title: 'Removed',
      description: 'Beverage removed from history',
    });
  };

  const handleQuickAddScanned = async (beverage: typeof scannedBeverages[0]) => {
    const convertedServingSize = convertSavedServingToCurrentUnit(beverage.barcode, beverage.serving_size);
    await addWaterLog(convertedServingSize, beverage.name, beverage.hydration_factor);
    toast({
      title: 'Added!',
      description: `+${convertedServingSize} ${unitPreference} of ${beverage.name}`,
    });
  };

  const beverageTypes = ['Water', 'Sparkling Water', 'Tea', 'Coffee', 'Juice', 'Sports Drink', 'Soda', 'Other'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen pb-32 px-4"
    >
      {/* Header */}
      <header className="pt-10 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/20 glow-effect-sm">
              <ScanBarcode className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Quick Scan</h1>
              <p className="text-sm text-muted-foreground">Scan barcode to log</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowHistory(!showHistory)}
            className={showHistory ? 'text-primary' : 'text-muted-foreground'}
          >
            <HistoryIcon className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="space-y-4">
        {/* Camera Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card overflow-hidden"
        >
          <div className="aspect-video relative bg-card/80 flex items-center justify-center overflow-hidden">
            {scanning ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ transform: 'none' }}
                />
                {/* Scan frame overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-56 h-36">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-lg" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full h-0.5 bg-primary/50 animate-pulse" />
                    </div>
                  </div>
                </div>
                {!cameraReady && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                )}
              </>
            ) : cameraError ? (
              <div className="text-center p-6">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-destructive" />
                <p className="text-sm text-destructive mb-2">{cameraError}</p>
                {permissionDenied && (
                  <p className="text-xs text-muted-foreground">
                    Try refreshing the page and allowing camera access
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center p-6">
                <Camera className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Tap to start scanning
                </p>
              </div>
            )}

            {loading && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}
          </div>

          <div className="p-4">
            <Button
              onClick={scanning ? stopCamera : startCamera}
              className="w-full bg-primary hover:bg-primary/90"
              disabled={loading}
            >
              {scanning ? 'Stop Scanning' : 'Start Camera'}
            </Button>
          </div>
        </motion.div>

        {/* Manual Entry */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-4 space-y-3"
        >
          <h3 className="font-semibold text-foreground text-sm">Manual Entry</h3>
          <p className="text-xs text-muted-foreground">
            Enter barcode number (8 / 12 / 13 / 14+ digits) or use camera above
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., 012345678905"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value.replace(/[^\d]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && handleManualScan()}
              className="bg-card/60 border-white/10"
              inputMode="numeric"
            />
            <Button
              onClick={handleManualScan}
              disabled={loading || !manualBarcode.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lookup'}
            </Button>
          </div>
        </motion.div>

        {/* Scanned History */}
        <AnimatePresence>
          {showHistory && scannedBeverages.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-card p-4 space-y-3"
            >
              <h3 className="font-semibold text-foreground text-sm">Saved Beverages</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-hide">
                {scannedBeverages.map((bev) => (
                  <div
                    key={bev.id}
                    className="flex items-center justify-between p-3 bg-card/40 rounded-xl"
                  >
                    <div>
                      <p className="font-medium text-foreground text-sm">{bev.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {convertSavedServingToCurrentUnit(bev.barcode, bev.serving_size)} {unitPreference} · {Math.round(bev.hydration_factor * 100)}%
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleQuickAddScanned(bev)}
                        className="h-8 w-8 text-primary"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteScanned(bev.id)}
                        className="h-8 w-8 text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Confirm Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="glass-card border-white/10 max-w-sm bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">Confirm Beverage</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-card/60 border-white/10"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Beverage Type</label>
              <Select value={editBeverageType} onValueChange={setEditBeverageType}>
                <SelectTrigger className="bg-card/60 border-white/10">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {beverageTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Serving Size ({unitPreference})</label>
                <Input
                  type="number"
                  step="0.1"
                  value={editServingSize}
                  onChange={(e) => setEditServingSize(e.target.value)}
                  className="bg-card/60 border-white/10"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Amount Consumed ({unitPreference})</label>
                <Input
                  type="number"
                  step="0.1"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="bg-card/60 border-white/10"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Hydration Factor (%)</label>
              <Input
                type="number"
                step="1"
                min="0"
                max="100"
                value={editHydrationFactor}
                onChange={(e) => setEditHydrationFactor(e.target.value)}
                className="bg-card/60 border-white/10"
              />
              <p className="text-xs text-muted-foreground mt-1">
                100% = Water, 90% = Tea, 80% = Coffee, etc.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="hide-popup-product"
                checked={hidePopupForProduct}
                onCheckedChange={(checked) => setHidePopupForProduct(checked === true)}
              />
              <Label htmlFor="hide-popup-product" className="text-xs text-muted-foreground">
                Don&apos;t show this product popup again for this barcode
              </Label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                <Check className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

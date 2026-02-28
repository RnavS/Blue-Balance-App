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
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProfile } from '@/contexts/ProfileContext';
import { useToast } from '@/hooks/use-toast';

interface BeverageData {
  name: string;
  serving_size: number;
  hydration_factor: number;
  beverage_type: string;
}

// Local cache for barcode lookups
const barcodeCache: Record<string, BeverageData> = {};

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

export function QuickScan() {
  const { currentProfile, addWaterLog, scannedBeverages, addScannedBeverage, deleteScannedBeverage } = useProfile();
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

  const setBeverageFromData = (data: BeverageData, barcode: string) => {
    setEstimatedBeverage(data);
    setEditName(data.name);
    setEditServingSize(data.serving_size.toString());
    setEditAmount(data.serving_size.toString());
    setEditBeverageType(data.beverage_type);
    setEditHydrationFactor((data.hydration_factor * 100).toString());
    setScannedBarcode(barcode);
    setShowConfirmModal(true);
  };

  const lookupBarcode = async (barcodeInput: string) => {
    const normalizedBarcode = normalizeBarcode(barcodeInput);
    if (!normalizedBarcode) return;

    setLoading(true);
    setScannedBarcode(normalizedBarcode);

    const lookupCandidates = getBarcodeLookupCandidates(normalizedBarcode);

    // Check local cache first (all variants)
    for (const candidate of lookupCandidates) {
      if (barcodeCache[candidate]) {
        setBeverageFromData(barcodeCache[candidate], normalizedBarcode);
        setLoading(false);
        return;
      }
    }

    // Check saved scanned beverages (all variants)
    const savedBeverage = scannedBeverages.find((b) =>
      lookupCandidates.includes(normalizeBarcode(b.barcode))
    );

    if (savedBeverage) {
      const data: BeverageData = {
        name: savedBeverage.name,
        serving_size: savedBeverage.serving_size,
        hydration_factor: savedBeverage.hydration_factor,
        beverage_type: savedBeverage.name,
      };
      setBeverageFromData(data, normalizedBarcode);
      setLoading(false);
      return;
    }

    try {
      // Try Open Food Facts with barcode variants (helps with UPC/EAN leading-zero issues)
      for (const candidate of lookupCandidates) {
        const offResponse = await fetch(`https://world.openfoodfacts.org/api/v2/product/${candidate}.json`);
        const offData = await offResponse.json();

        if (offData.status === 1 && offData.product) {
          const product = offData.product;
          const name = product.product_name || product.product_name_en || 'Unknown Beverage';

          // Try to determine serving size from product data
          let servingSize = unitPreference === 'oz' ? 12 : 355;
          if (product.serving_size) {
            const match = product.serving_size.match(/(\d+\.?\d*)\s*(ml|oz|fl)/i);
            if (match) {
              servingSize = parseFloat(match[1]);
              const unit = match[2].toLowerCase();
              if (unit === 'ml' && unitPreference === 'oz') {
                servingSize = servingSize / 29.5735;
              } else if ((unit === 'oz' || unit === 'fl') && unitPreference === 'ml') {
                servingSize = servingSize * 29.5735;
              }
            }
          }

          // Estimate hydration factor based on category tags
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

          const data: BeverageData = {
            name,
            serving_size: Math.round(servingSize * 10) / 10,
            hydration_factor: hydrationFactor,
            beverage_type: name,
          };

          // Cache all variants so future lookups are fast
          lookupCandidates.forEach((v) => {
            barcodeCache[v] = data;
          });

          setBeverageFromData(data, normalizedBarcode);
          setLoading(false);

          toast({
            title: 'Product found!',
            description: name,
          });
          return;
        }
      }
    } catch (error) {
      console.error('Open Food Facts lookup failed:', error);
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

    // Save to scanned beverages if not already saved
    if (!scannedBeverages.find((b) => normalizeBarcode(b.barcode) === normalizeBarcode(scannedBarcode))) {
      await addScannedBeverage({
        barcode: scannedBarcode,
        name: editName,
        serving_size: parseFloat(editServingSize) || amount,
        hydration_factor: hydrationFactor,
      });
    }

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
    await addWaterLog(beverage.serving_size, beverage.name, beverage.hydration_factor);
    toast({
      title: 'Added!',
      description: `+${beverage.serving_size} ${unitPreference} of ${beverage.name}`,
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
            aria-label={showHistory ? 'Hide history' : 'Show history'}
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
                        {bev.serving_size} {unitPreference} · {Math.round(bev.hydration_factor * 100)}%
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Add ${bev.name}`}
                        onClick={() => handleQuickAddScanned(bev)}
                        className="h-8 w-8 text-primary"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${bev.name}`}
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

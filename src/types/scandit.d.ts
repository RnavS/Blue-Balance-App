declare module 'scandit-react-native-datacapture-core' {
  export type FrameData = any;

  export const DataCaptureContext: {
    forLicenseKey: (licenseKey: string) => any;
  };

  export const FrameSourceState: {
    On: any;
  };
}

declare module 'scandit-react-native-datacapture-barcode' {
  export type BarcodeCapture = any;
  export type BarcodeCaptureSession = any;

  export const BarcodeCaptureView: any;
  export const BarcodeCaptureSettings: any;
  export const Symbology: Record<string, any>;
}

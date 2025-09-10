export interface ChromeExtension {
  id: string;
}

export interface ExtendedWindow extends Window {
  backgroundOpenExtension?: { id: string };
}

export interface BatchOpenState {
  version: "basic" | "advanced";
  mode: "multi" | "single";
  input: string;
  urls: string[];
  progress: number;
  status: string;
  error: string;
  isProcessing: boolean;
  extensionInstalled: boolean;
  extensionId: string;
  showExtensionPrompt: boolean;
  showTerminateConfirm: boolean;
  showAdvancedSettings: boolean;
  delay: number;
  maxTabs: number;
  enableDelay: boolean;
  enableTabLimit: boolean;
  enableAutoClose: boolean;
  autoCloseDelay: number;
  enableBatchMode: boolean;
  batchSize: number;
  enableProgressiveOpen: boolean;
  enableSmartDelay: boolean;
  enableTabGrouping: boolean;
  tabGroupName: string;
  enableWindowMode: boolean;
  windowWidth: number;
  windowHeight: number;
  enableIncognito: boolean;
  enablePinTabs: boolean;
  enableMuteTabs: boolean;
  enableCustomUserAgent: boolean;
  customUserAgent: string;
  enableReferrer: boolean;
  customReferrer: string;
  enableCookieSync: boolean;
  enableJavaScript: boolean;
  enableImages: boolean;
  enablePopups: boolean;
  enableNotifications: boolean;
  enableGeolocation: boolean;
  enableCamera: boolean;
  enableMicrophone: boolean;
  enableFullscreen: boolean;
  enableClipboard: boolean;
  enableDownloads: boolean;
  enablePrint: boolean;
  enableScreenCapture: boolean;
  enableLocalStorage: boolean;
  enableSessionStorage: boolean;
  enableIndexedDB: boolean;
  enableWebSQL: boolean;
  enableFileSystem: boolean;
  enableWebGL: boolean;
  enableWebAssembly: boolean;
  enableServiceWorker: boolean;
  enableSharedWorker: boolean;
  enableWebRTC: boolean;
  enableMIDI: boolean;
  enableSensors: boolean;
  enablePayment: boolean;
  enableCredentials: boolean;
  enableBluetooth: boolean;
  enableUSB: boolean;
  enableSerial: boolean;
  enableHID: boolean;
  enableNFC: boolean;
  enableWebXR: boolean;
  enableWebCodecs: boolean;
  enableWebTransport: boolean;
  enableWebLocks: boolean;
  enableWebStreams: boolean;
  enableWebCrypto: boolean;
  enableWebAuthn: boolean;
  enableWebShare: boolean;
  enableWebOTP: boolean;
  enableWebHID: boolean;
  enableWebSerial: boolean;
  enableWebUSB: boolean;
  enableWebBluetooth: boolean;
  enableWebNFC: boolean;
}

export const MAX_TABS = 10;
export const DEFAULT_DELAY = 1000;
export const DEFAULT_BATCH_SIZE = 5;
export const DEFAULT_WINDOW_WIDTH = 1200;
export const DEFAULT_WINDOW_HEIGHT = 800;
export const DEFAULT_AUTO_CLOSE_DELAY = 30000;
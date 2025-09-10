// Configuration data types for admin config routes

export interface ConfigExportData {
  key: string;
  value: string;
  type: string;
  description?: string;
  isHotReloadable?: boolean;
  updatedBy?: string;
  updatedAt?: Date;
  category?: string;
}

export interface ConfigImportData {
  key: string;
  value: string;
  category?: string;
  description?: string;
  isSecret?: boolean;
  isRequired?: boolean;
  validationRule?: string;
}

export interface ConfigValidationError {
  key: string;
  isValid: boolean;
  errors: string[];
}

export interface ConfigSyncData {
  source: 'database' | 'environment' | 'file';
  target: 'cache' | 'database' | 'environment';
  dryRun?: boolean;
  overwrite?: boolean;
  categories?: string[];
}

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ConfigSyncChange {
  key: string;
  action: 'created' | 'updated' | 'skipped';
  oldValue?: string;
  newValue?: string;
}

export interface ConfigSyncResults {
  synced: number;
  skipped: number;
  errors: string[];
  changes: ConfigSyncChange[];
  [key: string]: any; // Allow additional properties for Prisma metadata
}

export interface ConfigCategoryStats {
  name: string;
  count: number;
}

export interface ConfigExportPreview {
  totalConfigs: number;
  secretConfigs: number;
  categories: ConfigCategoryStats[];
  availableFormats: string[];
  estimatedSize: {
    json: string;
    env: string;
    yaml: string;
  };
}

export interface ConfigImportResults {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  [key: string]: any; // Allow additional properties for Prisma metadata
}

export interface ConfigSyncStatus {
  database: {
    totalConfigs: number;
    lastUpdated: Date | null;
  };
  cache: {
    totalKeys: number;
    expiredKeys: number;
    memoryUsage: string | number;
  };
  environment: {
    totalVars: number;
    configVars: number;
  };
}
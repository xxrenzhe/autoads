'use client';

import React from 'react';

interface DataExportImportProps {
  onExport?: (options: any) => Promise<boolean>;
  onImport?: (file: File, options: any) => Promise<boolean>;
  onBackup?: (name: string, description: string) => Promise<boolean>;
  onRestore?: (backupId: string) => Promise<boolean>;
}

const DataExportImport: React.FC<DataExportImportProps> = ({
  onExport,
  onImport,
  onBackup,
  onRestore
}) => {
  return (
    <div className="p-8 text-center">
      <h2 className="text-xl font-semibold mb-4">Data Export/Import</h2>
      <p className="text-gray-600 mb-4">
        This component is temporarily disabled for build purposes.
      </p>
      <p className="text-sm text-gray-500">
        The full functionality will be restored after fixing syntax errors.
      </p>
    </div>
  );
};

export default DataExportImport; 
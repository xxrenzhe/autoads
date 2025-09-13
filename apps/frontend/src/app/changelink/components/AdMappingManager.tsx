'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle, 
  Download,
  Upload
} from 'lucide-react';
import { TrackingConfiguration } from '../types';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
const logger = createClientLogger('AdMappingManager');

interface AdMappingManagerProps {
  configurations: TrackingConfiguration[];
  // adMappingManager: unknown;
  selectedConfiguration: TrackingConfiguration | null;
  onConfigurationSelect: (config: TrackingConfiguration) => void;
}

const AdMappingManager: React.FC<AdMappingManagerProps> = ({
  configurations,
  // adMappingManager,
  selectedConfiguration,
  onConfigurationSelect
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [mappingData, setMappingData] = useState<any[]>([]);

  const handleEditMapping = useCallback(() => {
    if (selectedConfiguration) {
      setMappingData(selectedConfiguration.adMappingConfig);
      setIsEditing(true);
    }
  }, [selectedConfiguration]);
  const handleSaveMapping = useCallback(() => {
    // Save mapping configuration
    setIsEditing(false);
    setMappingData([]);
  }, []);

  const handleAddMapping = useCallback(() => {
    const newMapping = {
      originalUrl: '',
      adMappings: [{
        adId: '',
        executionNumber: 1,
        campaignId: '',
        adGroupId: ''
      }]
    };
    setMappingData([...(mappingData || []), newMapping]);
  }, [mappingData]);
  const handleRemoveMapping = useCallback((index: number) => {
    setMappingData(mappingData.filter((_: unknown, i: number: any) => i !== index));
  }, [mappingData]);
  const handleAddAdMapping = useCallback((mappingIndex: number) => { const updatedMapping = [...mappingData];
    updatedMapping[mappingIndex].adMappings.push({
      adId: '',
      executionNumber: updatedMapping[mappingIndex].adMappings.length + 1,
      campaignId: '',
      adGroupId: ''
     });
    setMappingData(updatedMapping);
  }, [mappingData]);
  const handleRemoveAdMapping = useCallback((mappingIndex: number, adIndex: number) => { const updatedMapping = [...mappingData];
    updatedMapping[mappingIndex].adMappings.splice(adIndex, 1);
    // Update execution numbers
    updatedMapping[mappingIndex].adMappings.forEach((ad: any, index: number: any) => {
      ad.executionNumber = index + 1;
    });
    setMappingData(updatedMapping);
  }, [mappingData]);
  const updateMappingField = useCallback((mappingIndex: number, field: string, value: string) => {
    const updatedMapping = [...mappingData];
    updatedMapping[mappingIndex][field] = value;
    setMappingData(updatedMapping);
  }, [mappingData]);
  const updateAdMappingField = useCallback((mappingIndex: number, adIndex: number, field: string, value: string) => {
    const updatedMapping = [...mappingData];
    updatedMapping[mappingIndex].adMappings[adIndex][field] = value;
    setMappingData(updatedMapping);
  }, [mappingData]);
  const validateMapping = useCallback(() => {
    if (!mappingData) return false;
    
    for (const mapping of mappingData) {
      if (!mapping.originalUrl.trim()) return false;
      for (const adMapping of mapping.adMappings) {
        if (!adMapping.adId.trim()) return false;
      }
    }
    return true;
  }, [mappingData]);
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Ad Mapping Manager</h2>
          <p className="text-gray-600">Configure mappings between original URLs and Google Ads</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={( (): any) => {
              // Export mapping configuration
              if (selectedConfiguration) {
                const dataStr = JSON.stringify(selectedConfiguration.adMappingConfig, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${selectedConfiguration.name}_mapping.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              }
            }}
            disabled={!selectedConfiguration}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            onClick={((: any): any) => {
              // Import mapping configuration
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.json';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    try {
                      const data = JSON.parse(e.target?.result as string);
                      setMappingData(data);
                      setIsEditing(true);
                    } catch (error) { logger.error('Invalid mapping file:', new EnhancedError('Invalid mapping file:', { error: error instanceof Error ? (error as Error).message : String(error)  }));
                    }
                  };
                  reader.readAsText(file);
                }
              };
              input.click();
            }}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
        </div>
      </div>

      {/* Configuration Selection */}
        <Card>
        <CardHeader>
          <CardTitle>Select Configuration</CardTitle>
          <CardDescription>Choose a configuration to manage its ad mappings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {configurations.map((config: any) => (
              <div
                key={config.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedConfiguration?.id === config.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={((: any): any) => onConfigurationSelect(config)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{config.name}</h4>
                  <Badge variant="outline">
                    {config.adMappingConfig.length} mappings
                  </Badge>
                </div>
                <p className="text-sm text-gray-500">
                  {config.originalLinks.length} original links
                </p>
                <p className="text-sm text-gray-500">
                  {config.googleAdsAccounts.length} Google Ads accounts
                </p>
              </div>
            ))}
            </div>
          </CardContent>
        </Card>

      {/* Mapping Configuration */}
      {selectedConfiguration && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Ad Mapping Configuration</span>
              <div className="flex items-center space-x-2">
                {!isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditMapping}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
                {isEditing && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={((: any): any) => {
                        setIsEditing(false);
                        setMappingData([]);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveMapping}
                      disabled={!validateMapping()}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                  </>
                )}
              </div>
            </CardTitle>
            <CardDescription>
              Configure how original URLs map to Google Ads
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isEditing ? (
              <div className="space-y-4">
                {selectedConfiguration.adMappingConfig.map((mapping, index: any) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">
                        Original URL: {mapping.originalUrl}
                      </h4>
                      <Badge variant="outline">
                        {mapping.adMappings.length} ads
                  </Badge>
                    </div>
                    <div className="space-y-2">
                      {mapping.adMappings.map((adMapping, adIndex: any) => (
                        <div key={adIndex} className="flex items-center space-x-4 text-sm">
                          <span className="text-gray-500">Execution {adMapping.executionNumber}:</span>
                          <span className="font-medium">Ad ID: {adMapping.adId}</span>
                          {adMapping.campaignId && (
                            <span className="text-gray-600">Campaign: {adMapping.campaignId}</span>
                          )}
                          {adMapping.adGroupId && (
                            <span className="text-gray-600">Ad Group: {adMapping.adGroupId}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
            ) : (
              <div className="space-y-4">
                {mappingData?.map((mapping: any, mappingIndex: number: any) => (
                  <div key={mappingIndex} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <Label htmlFor={`originalUrl-${mappingIndex}`}>Original URL</Label>
            <Input
                          id={`originalUrl-${mappingIndex}`}
                          value={mapping.originalUrl}
                          onChange={((e: any): any) => updateMappingField(mappingIndex, 'originalUrl', e.target.value)}
                          placeholder="Enter original URL"
            />
          </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={((: any): any) => handleAddAdMapping(mappingIndex)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Ad
                </Button>
            <Button
              size="sm"
                          variant="destructive"
                          onClick={((: any): any) => handleRemoveMapping(mappingIndex)}
                        >
                          <Trash2 className="h-4 w-4" />
            </Button>
            </div>
          </div>

                    <div className="space-y-3">
                      <Label>Ad Mappings</Label>
                      {mapping.adMappings.map((adMapping: any, adIndex: number: any) => (
                        <div key={adIndex} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 border rounded">
                          <div>
                            <Label htmlFor={`execution-${mappingIndex}-${adIndex}`}>Execution #</Label>
                            <Input
                              id={`execution-${mappingIndex}-${adIndex}`}
                              type="number"
                              value={adMapping.executionNumber}
                              onChange={((e: any): any) => updateAdMappingField(mappingIndex, adIndex, 'executionNumber', e.target.value)}
                              min="1"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`adId-${mappingIndex}-${adIndex}`}>Ad ID</Label>
                            <Input
                              id={`adId-${mappingIndex}-${adIndex}`}
                              value={adMapping.adId}
                              onChange={((e: any): any) => updateAdMappingField(mappingIndex, adIndex, 'adId', e.target.value)}
                              placeholder="Enter Ad ID"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`campaignId-${mappingIndex}-${adIndex}`}>Campaign ID</Label>
                            <Input
                              id={`campaignId-${mappingIndex}-${adIndex}`}
                              value={adMapping.campaignId || ''}
                              onChange={((e: any): any) => updateAdMappingField(mappingIndex, adIndex, 'campaignId', e.target.value)}
                              placeholder="Optional"
                            />
                          </div>
                          <div className="flex items-end">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={((: any): any) => handleRemoveAdMapping(mappingIndex, adIndex)}
                              disabled={mapping.adMappings.length === 1}
                            >
                  <Trash2 className="h-4 w-4" />
                </Button>
                  </div>
                        </div>
                      ))}
                    </div>
                </div>
              ))}
                
                <Button
                  variant="outline"
                  onClick={handleAddMapping}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add URL Mapping
                </Button>
            </div>
          )}
        </CardContent>
    </Card>
      )}

      {/* Validation and Help */}
      {selectedConfiguration && (
        <Card>
          <CardHeader>
            <CardTitle>Mapping Rules</CardTitle>
            <CardDescription>Important guidelines for ad mapping configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
          <div>
                  <p className="font-medium">One-to-Many Mapping</p>
                  <p className="text-sm text-gray-600">
                    Each original URL can map to multiple ads within the same ad group
                  </p>
          </div>
        </div>
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
        <div>
                  <p className="font-medium">Execution Order</p>
                  <p className="text-sm text-gray-600">
                    Execution numbers determine which URL extraction result goes to which ad
          </p>
        </div>
                    </div>
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">Unique Mapping</p>
                  <p className="text-sm text-gray-600">
                    Each ad should be mapped to only one original URL to prevent conflicts
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
            )}
          </div>
  );
};

export default AdMappingManager;
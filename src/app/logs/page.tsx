'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface LogFile {
  name: string;
  size: number;
  sizeFormatted: string;
  modified: string;
  compressed: boolean;
  downloadUrl: string;
}

interface LogStats {
  totalFiles: number;
  totalSize: number;
  totalSizeFormatted: string;
  currentSize: number;
  currentSizeFormatted: string;
  oldestLog?: string;
  newestLog?: string;
  config: {
    maxSize: number;
    maxSizeFormatted: string;
    maxFiles: number;
    compress: boolean;
  };
}

export default function LogsPage() {
  const [logFiles, setLogFiles] = useState<LogFile[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [selectedFile, setSelectedFile] = useState('output.log');
  const [logContent, setLogContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [lines, setLines] = useState(1000);

  useEffect(() => {
    loadLogFiles();
    loadStats();
  }, []);

  useEffect(() => {
    if (selectedFile) {
      loadLogContent();
    }
  }, [selectedFile, filter, lines]);

  const loadLogFiles = async () => {
    try {
      const response = await fetch('/api/logs/manage?action=list');
      const data = await response.json();
      setLogFiles(data.files);
    } catch (error) {
      console.error('Failed to load log files:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/logs/manage?action=stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to load log stats:', error);
    }
  };

  const loadLogContent = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        file: selectedFile,
        lines: lines.toString(),
        format: 'raw'
      });
      
      if (filter) {
        params.set('filter', filter);
      }
      
      const response = await fetch(`/api/o?${params}`);
      const content = await response.text();
      setLogContent(content);
    } catch (error) {
      console.error('Failed to load log content:', error);
      setLogContent('Failed to load log content');
    } finally {
      setLoading(false);
    }
  };

  const forceRotate = async () => {
    try {
      await fetch('/api/logs/manage?action=rotate', { method: 'GET' });
      await loadLogFiles();
      await loadStats();
      alert('Log rotation completed successfully');
    } catch (error) {
      console.error('Failed to rotate logs:', error);
      alert('Failed to rotate logs');
    }
  };

  const deleteLogFile = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) {
      return;
    }
    
    try {
      await fetch(`/api/logs/manage?filename=${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      await loadLogFiles();
      await loadStats();
      if (selectedFile === filename) {
        setSelectedFile('output.log');
      }
    } catch (error) {
      console.error('Failed to delete log file:', error);
      alert('Failed to delete log file');
    }
  };

  const downloadLog = (filename: string) => {
    window.open(`/api/o?download=true&file=${encodeURIComponent(filename)}`, '_blank');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">日志管理</h1>
        <Button onClick={forceRotate} variant="outline">
          强制轮转日志
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">总文件数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalFiles}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">总大小</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSizeFormatted}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">当前文件大小</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.currentSizeFormatted}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">轮转配置</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <div>最大: {stats.config.maxSizeFormatted}</div>
                <div>保留: {stats.config.maxFiles} 个</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="view" className="space-y-4">
        <TabsList>
          <TabsTrigger value="view">查看日志</TabsTrigger>
          <TabsTrigger value="files">文件管理</TabsTrigger>
        </TabsList>

        <TabsContent value="view" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>日志查看器</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium">过滤</label>
                  <Input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="输入过滤条件..."
                  />
                </div>
                <div className="w-32">
                  <label className="text-sm font-medium">行数</label>
                  <Input
                    type="number"
                    value={lines}
                    onChange={(e) => setLines(parseInt(e.target.value) || 1000)}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={loadLogContent} disabled={loading}>
                    刷新
                  </Button>
                </div>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <pre className="bg-gray-900 text-gray-100 p-4 text-sm overflow-auto max-h-96">
                  {loading ? 'Loading...' : logContent}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>日志文件</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {logFiles.map((file) => (
                  <div
                    key={file.name}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-3">
                      <div>
                        <div className="font-medium">{file.name}</div>
                        <div className="text-sm text-gray-500">
                          {file.sizeFormatted} • {new Date(file.modified).toLocaleString()}
                        </div>
                      </div>
                      {file.compressed && (
                        <Badge variant="secondary">压缩</Badge>
                      )}
                      {file.name === 'output.log' && (
                        <Badge variant="default">当前</Badge>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedFile(file.name)}
                      >
                        查看
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadLog(file.name)}
                      >
                        下载
                      </Button>
                      {file.name !== 'output.log' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteLogFile(file.name)}
                        >
                          删除
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";

export default function DebugAccessModePage() {
  const [accessMode, setAccessMode] = useState<"http" | "puppeteer">("http");
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[Debug] ${message}`);
  };

  const handleAccessModeChange = (mode: "http" | "puppeteer") => {
    addLog(`用户选择访问模式: ${mode}`);
    setAccessMode(mode);
  };

  const simulateSendRequest = () => {
    addLog(`准备发送请求 - 当前 accessMode: ${accessMode}`);
    
    // 模拟发送请求的数据
    const requestData = {
      taskId: `debug_${Date.now()}`,
      urls: ["https://example.com"],
      cycleCount: 5,
      accessMode: accessMode
    };
    
    addLog(`发送到后端的数据: ${JSON.stringify(requestData, null, 2)}`);
    
    // 实际发送请求
    fetch('/api/batchopen/silent-start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    })
      .then(response => response.json())
      .then(data => {
        addLog(`后端响应: ${JSON.stringify(data, null, 2)}`);
      })
      .catch(error => {
        addLog(`请求失败: ${error.message}`);
      });
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">AccessMode 调试页面</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">访问模式选择</h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                accessMode === "http"
                  ? "bg-blue-50 border-blue-500 text-blue-700"
                  : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
              onClick={((: any): any) => handleAccessModeChange("http")}
            >
              HTTP 访问
            </button>
            <button
              className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                accessMode === "puppeteer"
                  ? "bg-purple-50 border-purple-500 text-purple-700"
                  : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
              onClick={((: any): any) => handleAccessModeChange("puppeteer")}
            >
              Puppeteer 访问
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            当前选择的访问模式: <span className="font-mono">{accessMode}</span>
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">操作</h2>
          <div className="flex gap-4">
            <button
              onClick={simulateSendRequest}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              模拟发送请求
            </button>
            <button
              onClick={clearLogs}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              清空日志
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">调试日志</h2>
          <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">暂无日志</p>
            ) : (
              logs.map((log, index: any) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">使用说明</h3>
          <ol className="list-decimal list-inside text-sm text-yellow-700 space-y-1">
            <li>选择访问模式（HTTP 或 Puppeteer）</li>
            <li>点击"模拟发送请求"按钮</li>
            <li>查看日志输出，确认 accessMode 是否正确传递</li>
            <li>同时打开浏览器控制台查看更多日志</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
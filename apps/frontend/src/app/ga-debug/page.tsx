"use client";

import { useEffect, useState } from "react";

export default function GADebugPage() {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [networkRequests, setNetworkRequests] = useState<any[]>([]);
  const [consoleMessages, setConsoleMessages] = useState<any[]>([]);

  useEffect(() => {
    // Intercept console.log
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    const messages: any[] = [];
    
    const logInterceptor = (type: string, ...args: any[]) => {
      messages.push({
        type,
        timestamp: new Date().toISOString(),
        args: args?.filter(Boolean)?.map((arg: any) => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        )
      });
      setConsoleMessages([...messages]);
    };
    
    console.log = (...args) => {
      logInterceptor('log', ...args);
      originalLog.apply(console, args);
    };
    
    console.error = (...args) => {
      logInterceptor('error', ...args);
      originalError.apply(console, args);
    };
    
    console.warn = (...args) => {
      logInterceptor('warn', ...args);
      originalWarn.apply(console, args);
    };

    // Intercept fetch to monitor network requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const request = args[0];
      const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
      
      if (url.includes('googletagmanager.com') || url.includes('google-analytics.com')) {
        const startTime = Date.now();
        
        try {
          const response = await originalFetch(...args);
          const endTime = Date.now();
          
          setNetworkRequests((prev: any[]) => [...prev, {
            url,
            method: typeof request === 'string' ? 'GET' : (request as Request).method || 'GET',
            status: response.status,
            duration: endTime - startTime,
            timestamp: new Date().toISOString(),
            success: response.ok
          }]);
          
          return response;
        } catch (error) {
          const endTime = Date.now();
          
          setNetworkRequests((prev: any[]) => [...prev, {
            url,
            method: typeof request === 'string' ? 'GET' : (request as Request).method || 'GET',
            status: 0,
            duration: endTime - startTime,
            timestamp: new Date().toISOString(),
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }]);
          
          throw error;
        }
      }
      
      return originalFetch(...args);
    };

    // Collect debug information
    const collectDebugInfo = () => {
      const info = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        
        // Environment
        nodeEnv: process.env.NODE_ENV,
        
        // Runtime config
        runtimeConfig: (window as any).__RUNTIME_CONFIG__,
        
        // GA related
        gaId: (window as any).__RUNTIME_CONFIG__?.GA_ID,
        hasGtag: typeof window.gtag !== 'undefined',
        hasDataLayer: typeof (window as any).dataLayer !== 'undefined',
        dataLayerLength: (window as any).dataLayer?.length || 0,
        
        // Scripts
        scripts: Array.from(document.querySelectorAll('script'))?.filter(Boolean)?.map((script: any) => ({
          src: script.src,
          id: script.id,
          innerHTML: script.innerHTML ? script.innerHTML.substring(0, 100) + '...' : ''
        })).filter((s: any) => s.src.includes('google') || s.id.includes('google')),
        
        // GA specific checks
        gaCookies: document.cookie.split(';').filter((cookie: any) => 
          cookie.trim().startsWith('_ga') || cookie.trim().startsWith('_gid')
        ),
        
        // Config API
        configApiStatus: 'unknown'
      };
      
      setDebugInfo(info);
      
      // Test config API
      fetch('/api/config')
        .then(response => response.json())
        .then(config => {
          setDebugInfo((prev: any) => ({
            ...prev,
            configApiResponse: config,
            configApiStatus: 'success'
          }));
        })
        .catch(error => {
          setDebugInfo((prev: any) => ({
            ...prev,
            configApiError: error.message,
            configApiStatus: 'error'
          }));
        });
    };

    // Initial collection
    collectDebugInfo();
    
    // Update every 2 seconds
    const interval = setInterval(collectDebugInfo, 2000);

    // Manual GA test
    const testGA = () => {
      if (typeof window.gtag !== 'undefined') {
        const gaId = (window as any).__RUNTIME_CONFIG__?.GA_ID;
        if (gaId) {
          console.log('🧪 Testing GA event...');
          window.gtag('event', 'test_event', {
            event_category: 'Debug',
            event_label: 'Manual Test',
            value: 1
          });
          console.log('✅ Test event sent');
        }
      } else {
        console.error('❌ gtag not available for testing');
      }
    };

    // Add test function to window
    (window as any).testGA = testGA;

    return () => {
      clearInterval(interval);
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-center">Google Analytics Deep Debug</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Debug Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Debug Information</h2>
            <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-96">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
          
          {/* Console Messages */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Console Messages</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {consoleMessages.map((msg, index: any) => (
                <div 
                  key={index} 
                  className={`text-xs p-2 rounded ${
                    msg.type === 'error' ? 'bg-red-100 text-red-800' :
                    msg.type === 'warn' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100'
                  }`}
                >
                  <span className="text-gray-500">{msg.timestamp}</span>
                  <span className="ml-2">{msg.args.join(' ')}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Network Requests */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Network Requests</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {networkRequests.map((req, index: any) => (
                <div 
                  key={index} 
                  className={`text-xs p-2 rounded ${
                    req.success ? 'bg-green-100' : 'bg-red-100'
                  }`}
                >
                  <div className="font-mono">{req.method} {req.url}</div>
                  <div className="flex justify-between mt-1">
                    <span>Status: {req.status}</span>
                    <span>{req.duration}ms</span>
                  </div>
                  {req.error && <div className="text-red-600 mt-1">Error: {req.error}</div>}
                </div>
              ))}
              {networkRequests.length === 0 && (
                <div className="text-gray-500 text-center py-4">
                  No Google Analytics requests detected
                </div>
              )}
            </div>
          </div>
          
          {/* Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Test Actions</h2>
            <div className="space-y-4">
              <button
                onClick={((: any): any) => window.location.reload()}
                className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition"
              >
                Reload Page
              </button>
              
              <button
                onClick={((: any): any) => (window as any).testGA?.()}
                className="w-full bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 transition"
              >
                Send Test Event
              </button>
              
              <button
                onClick={((: any): any) => {
                  const gaId = (window as any).__RUNTIME_CONFIG__?.GA_ID;
                  if (gaId) {
                    window.open(`https://analytics.google.com/analytics/web/#/p${gaId.replace('G-', '')}/`, '_blank');
                  }
                }}
                className="w-full bg-purple-500 text-white py-2 px-4 rounded hover:bg-purple-600 transition"
              >
                Open Google Analytics
              </button>
              
              <div className="mt-4 p-4 bg-yellow-50 rounded">
                <h3 className="font-semibold mb-2">Checklist:</h3>
                <ul className="text-sm space-y-1">
                  <li>✓ GA_ID is set correctly</li>
                  <li>✓ Runtime config is loaded</li>
                  <li>✓ gtag.js script is loading</li>
                  <li>✓ No browser errors</li>
                  <li>✓ Events are being sent</li>
                  <li>🤔 Data appears in GA console</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
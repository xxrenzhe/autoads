"use client";

import { getGA_TRACKING_ID, isGAEnabled } from "@/lib/gtag";
import { useEffect, useState } from "react";

export default function GATestPage() {
  const [gaStatus, setGaStatus] = useState<string>("Checking...");

  useEffect(() => {
    console.log('🔍 GA Debug Info:', {
      GA_TRACKING_ID: getGA_TRACKING_ID(),
      isGAEnabled: isGAEnabled(),
      hasGtag: typeof window.gtag !== 'undefined',
      hasDataLayer: typeof (window as any).dataLayer !== 'undefined',
      env: process.env.NODE_ENV,
      runtimeConfig: (window as any).__RUNTIME_CONFIG__
    });

    // Check if GA is loaded
    const checkInterval = setInterval(() => {
      if (typeof window.gtag !== 'undefined') {
        setGaStatus("✅ gtag is loaded");
        clearInterval(checkInterval);
        
        // Test a pageview
        const gaId = getGA_TRACKING_ID();
        if (gaId) {
          window.gtag('config', gaId, {
            page_path: '/ga-test'
          });
          console.log('✅ Test pageview sent to', gaId);
        }
      } else {
        setGaStatus("❌ gtag is not loaded");
        console.log('❌ gtag still not loaded, checking scripts...');
        
        // Check if GA scripts are in the DOM
        const gaScripts = document.querySelectorAll('script[src*="googletagmanager.com/gtag"]');
        console.log('Found GA scripts:', gaScripts.length);
        
        const inlineScripts = document.querySelectorAll('script[id="google-analytics"]');
        console.log('Found inline GA scripts:', inlineScripts.length);
      }
    }, 1000);

    // Timeout after 5 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      if (gaStatus === "Checking...") {
        setGaStatus("❌ Timeout - gtag not loaded");
      }
    }, 5000);

    return () => clearInterval(checkInterval);
  }, [gaStatus]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-6">Google Analytics Test</h1>
        
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">GA_ID (Runtime):</p>
            <p className="font-mono text-lg">{getGA_TRACKING_ID() || 'NOT_SET'}</p>
          </div>
          
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">GA Enabled:</p>
            <p className="text-lg font-semibold">{isGAEnabled() ? 'Yes' : 'No'}</p>
          </div>
          
          <div className="p-4 bg-yellow-50 rounded-lg">
            <p className="text-sm text-gray-600">Status:</p>
            <p className="text-lg font-semibold">{gaStatus}</p>
          </div>
          
          <div className="mt-6 p-4 bg-gray-100 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">Debug Info:</p>
            <ul className="text-xs space-y-1">
              <li>• Check Network tab for requests to googletagmanager.com</li>
              <li>• GA ID should be: G-F1HVLMDMV0</li>
              <li>• Look for: /gtag/js?id=G-F1HVLMDMV0</li>
              <li>• Also check browser console for messages</li>
            </ul>
          </div>
          
          <button
            onClick={() => window.location.reload()}
            className="w-full mt-4 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';

export default function DashboardPage() {
  const [summary, setSummary] = useState({
    offerCount: 0,
    activeWorkflows: 0,
    tokenBalance: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get('/api/user/summary');
        setSummary(response.data);
      } catch (error) {
        console.error("Failed to fetch summary", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSummary();
  }, []);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      {isLoading ? (
        <p>Loading dashboard...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-2">Offers</h2>
            <p className="text-4xl font-bold">{summary.offerCount}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-2">Active Workflows</h2>
            <p className="text-4xl font-bold">{summary.activeWorkflows}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-2">Token Balance</h2>
            <p className="text-4xl font-bold">{summary.tokenBalance.toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import axios from 'axios';

export default function SiterankPage() {
  const [offers, setOffers] = useState([]);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    fetchOffers();
  }, []);

  useEffect(() => {
    if (selectedOffer) {
      fetchAnalysis(selectedOffer.id);
    }
  }, [selectedOffer]);

  useEffect(() => {
    let interval;
    if (isPolling) {
      interval = setInterval(() => {
        if (selectedOffer) {
          fetchAnalysis(selectedOffer.id);
        }
      }, 5000); // Poll every 5 seconds
    }
    return () => clearInterval(interval);
  }, [isPolling, selectedOffer]);

  const fetchOffers = async () => {
    try {
      const response = await axios.get('/api/offers');
      setOffers(Object.values(response.data));
    } catch (error) {
      console.error("Failed to fetch offers", error);
    }
  };

  const fetchAnalysis = async (offerId) => {
    try {
      const { data } = await axios.get(`/api/siterank/results/${offerId}`);
      if (data.status === 'completed') {
        setIsPolling(false);
      }
      setAnalysis(data);
    } catch (error) {
      // It's normal to get a 404 if analysis hasn't started yet
      if (error.response?.status !== 404) {
        console.error("Failed to fetch analysis", error);
      }
    }
  };

  const handleAnalyze = async () => {
    if (selectedOffer) {
      try {
        setIsLoading(true);
        await axios.post('/api/siterank/analyze', { url: selectedOffer.originalUrl, offerId: selectedOffer.id });
        setIsPolling(true);
      } catch (error) {
        console.error("Failed to start analysis", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Siterank AI Analysis</h1>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select onValueChange={(value) => setSelectedOffer(offers.find(o => o.id === value))}>
            <SelectTrigger>
              <SelectValue placeholder="Select an offer to analyze" />
            </SelectTrigger>
            <SelectContent>
              {offers.map((offer) => (
                <SelectItem key={offer.id} value={offer.id}>{offer.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAnalyze} disabled={!selectedOffer || isLoading || isPolling}>
            {isPolling ? 'Analysis in progress...' : (isLoading ? 'Starting...' : 'Analyze')}
          </Button>
        </div>
      </div>

      {analysis && (
        <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4">Analysis Results for {selectedOffer?.name}</h2>
          <p className="mb-4">Status: <span className="font-semibold">{analysis.status}</span></p>
          {analysis.status === 'completed' && analysis.result && (
            <div>
              <h3 className="text-xl font-semibold">AI Opportunity Score</h3>
              <p className="text-4xl font-bold text-green-600 my-2">{analysis.result.opportunityScore.toFixed(2)} / 100</p>
              <h3 className="text-xl font-semibold mt-4">AI Strategy Suggestion</h3>
              <p className="mt-2 text-gray-700">{analysis.result.strategy}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

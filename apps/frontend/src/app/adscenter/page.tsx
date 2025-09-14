"use client";

import React from 'react';
import AdsCenterClient from '@/app/changelink/AdsCenterClient';
import { UI_CONSTANTS } from '@/components/ui/ui-constants';

export default function AdsCenterPage() {
  return (
    <div className={`min-h-screen ${UI_CONSTANTS.gradients.hero}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <AdsCenterClient />
        </div>
      </div>
    </div>
  );
}


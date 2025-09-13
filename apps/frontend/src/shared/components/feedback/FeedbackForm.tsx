'use client';

import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Modal } from '@/shared/components/ui/Modal';

interface FeedbackFormProps {
  isOpen: boolean;
  onClose: () => void;
  module?: 'siterank' | 'batchopen' | 'adscenter' | 'general';
}

interface FeedbackData {
  type: 'bug' | 'feature' | 'improvement' | 'general';
  module?: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  email?: string;
  screenshot?: string;
}

export const FeedbackForm: React.FC<FeedbackFormProps> = ({
  isOpen,
  onClose,
  module = 'general',
}) => {
  const [formData, setFormData] = useState<FeedbackData>({
    type: 'general',
    module,
    title: '',
    description: '',
    priority: 'medium',
    email: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleInputChange = (
    field: keyof FeedbackData,
    value: string
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSubmitStatus('success');
        // Reset form
        setFormData({
          type: 'general',
          module,
          title: '',
          description: '',
          priority: 'medium',
          email: '',
        });
        // Close modal after 2 seconds
        setTimeout(() => {
          onClose();
          setSubmitStatus('idle');
        }, 2000);
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Feedback submission error:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScreenshot = async () => {
    try {
      // Use html2canvas or similar library to capture screenshot
      // This is a placeholder implementation
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#333';
        ctx.font = '16px Arial';
        ctx.fillText('Screenshot placeholder', 50, 50);
        
        const screenshot = canvas.toDataURL('image/png');
        setFormData(prev => ({ ...prev, screenshot }));
      }
    } catch (error) {
      console.error('Screenshot capture error:', error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Submit Feedback">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Feedback Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Feedback Type *
          </label>
          <select
            value={formData.type}
            onChange={((e: any): any) => handleInputChange('type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="general">General Feedback</option>
            <option value="bug">Bug Report</option>
            <option value="feature">Feature Request</option>
            <option value="improvement">Improvement Suggestion</option>
          </select>
        </div>

        {/* Module */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Related Module
          </label>
          <select
            value={formData.module}
            onChange={((e: any): any) => handleInputChange('module', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="general">General</option>
            <option value="siterank">SiteRank</option>
            <option value="batchopen">BatchOpen</option>
            <option value="adscenter">ChangeLink</option>
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title *
          </label>
          <Input
            type="text"
            value={formData.title}
            onChange={((e: any): any) => handleInputChange('title', e.target.value)}
            placeholder="Brief description of your feedback"
            maxLength={200}
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description *
          </label>
          <textarea
            value={formData.description}
            onChange={((e: any): any) => handleInputChange('description', e.target.value)}
            placeholder="Detailed description of your feedback, including steps to reproduce if reporting a bug"
            rows={4}
            maxLength={2000}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <div className="text-sm text-gray-500 mt-1">
            {formData.description.length}/2000 characters
          </div>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Priority
          </label>
          <select
            value={formData.priority}
            onChange={((e: any): any) => handleInputChange('priority', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email (optional)
          </label>
          <Input
            type="email"
            value={formData.email}
            onChange={((e: any): any) => handleInputChange('email', e.target.value)}
            placeholder="Your email for follow-up"
          />
        </div>

        {/* Screenshot */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Screenshot
          </label>
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleScreenshot}
              disabled={isSubmitting}
            >
              Capture Screenshot
            </Button>
            {formData.screenshot && (
              <span className="text-sm text-green-600">Screenshot captured</span>
            )}
          </div>
        </div>

        {/* Submit Status */}
        {submitStatus === 'success' && (
          <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            Thank you for your feedback! We'll review it and get back to you if needed.
          </div>
        )}

        {submitStatus === 'error' && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            Sorry, there was an error submitting your feedback. Please try again.
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !formData.title || !formData.description}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default FeedbackForm;
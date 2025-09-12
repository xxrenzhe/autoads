/**
 * Input Component Stories
 * Storybook stories demonstrating Input component usage and accessibility
 */

import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A fully accessible input component with error handling, helper text, and multiple size variants.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'error'],
      description: 'Visual variant of the input',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size variant of the input',
    },
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'tel', 'url', 'search'],
      description: 'HTML input type',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the input is disabled',
    },
    required: {
      control: 'boolean',
      description: 'Whether the input is required',
    },
    error: {
      control: 'text',
      description: 'Error message to display',
    },
    helperText: {
      control: 'text',
      description: 'Helper text to provide additional context',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Basic input
export const Default: Story = {
  args: {
    placeholder: 'Enter text here...',
  },
};

// With label (accessibility best practice)
export const WithLabel: Story = {
  render: (args: any) => (
    <div className="w-80">
      <label htmlFor="labeled-input" className="block text-sm font-medium mb-2">
        Email Address
      </label>
      <Input
        {...args}
        id="labeled-input"
        type="email"
        placeholder="Enter your email"
      />
    </div>
  ),
};

// Size variants
export const Sizes: Story = {
  render: () => (
    <div className="space-y-4 w-80">
      <div>
        <label htmlFor="small-input" className="block text-sm font-medium mb-1">
          Small Input
        </label>
        <Input id="small-input" size="sm" placeholder="Small input" />
      </div>
      <div>
        <label htmlFor="medium-input" className="block text-sm font-medium mb-1">
          Medium Input (Default)
        </label>
        <Input id="medium-input" size="md" placeholder="Medium input" />
      </div>
      <div>
        <label htmlFor="large-input" className="block text-sm font-medium mb-1">
          Large Input
        </label>
        <Input id="large-input" size="lg" placeholder="Large input" />
      </div>
    </div>
  ),
};

// Error state
export const WithError: Story = {
  render: () => (
    <div className="w-80">
      <label htmlFor="error-input" className="block text-sm font-medium mb-2">
        Password
      </label>
      <Input
        id="error-input"
        type="password"
        variant="error"
        error="Password must be at least 8 characters long"
        placeholder="Enter password"
      />
    </div>
  ),
};

// With helper text
export const WithHelperText: Story = {
  render: () => (
    <div className="w-80">
      <label htmlFor="helper-input" className="block text-sm font-medium mb-2">
        Username
      </label>
      <Input
        id="helper-input"
        helperText="Username must be 3-20 characters, letters and numbers only"
        placeholder="Enter username"
      />
    </div>
  ),
};

// Required field
export const Required: Story = {
  render: () => (
    <div className="w-80">
      <label htmlFor="required-input" className="block text-sm font-medium mb-2">
        Full Name <span className="text-red-500" aria-label="required">*</span>
      </label>
      <Input
        id="required-input"
        required
        placeholder="Enter your full name"
      />
    </div>
  ),
};

// Disabled state
export const Disabled: Story = {
  render: () => (
    <div className="w-80">
      <label htmlFor="disabled-input" className="block text-sm font-medium mb-2">
        Disabled Input
      </label>
      <Input
        id="disabled-input"
        disabled
        value="This input is disabled"
        placeholder="Cannot edit this"
      />
    </div>
  ),
};

// Different input types
export const InputTypes: Story = {
  render: () => (
    <div className="space-y-4 w-80">
      <div>
        <label htmlFor="email-input" className="block text-sm font-medium mb-1">
          Email
        </label>
        <Input id="email-input" type="email" placeholder="user@example.com" />
      </div>
      <div>
        <label htmlFor="password-input" className="block text-sm font-medium mb-1">
          Password
        </label>
        <Input id="password-input" type="password" placeholder="Enter password" />
      </div>
      <div>
        <label htmlFor="number-input" className="block text-sm font-medium mb-1">
          Number
        </label>
        <Input id="number-input" type="number" placeholder="123" />
      </div>
      <div>
        <label htmlFor="tel-input" className="block text-sm font-medium mb-1">
          Phone
        </label>
        <Input id="tel-input" type="tel" placeholder="(555) 123-4567" />
      </div>
      <div>
        <label htmlFor="url-input" className="block text-sm font-medium mb-1">
          Website
        </label>
        <Input id="url-input" type="url" placeholder="https://example.com" />
      </div>
      <div>
        <label htmlFor="search-input" className="block text-sm font-medium mb-1">
          Search
        </label>
        <Input id="search-input" type="search" placeholder="Search..." />
      </div>
    </div>
  ),
};

// Form validation example
export const FormValidation: Story = {
  render: () => (
    <form className="space-y-4 w-80">
      <div>
        <label htmlFor="form-email" className="block text-sm font-medium mb-2">
          Email Address <span className="text-red-500" aria-label="required">*</span>
        </label>
        <Input
          id="form-email"
          type="email"
          required
          helperText="We'll never share your email with anyone else"
          placeholder="Enter your email"
        />
      </div>
      <div>
        <label htmlFor="form-password" className="block text-sm font-medium mb-2">
          Password <span className="text-red-500" aria-label="required">*</span>
        </label>
        <Input
          id="form-password"
          type="password"
          required
          minLength={8}
          helperText="Must be at least 8 characters long"
          placeholder="Enter password"
        />
      </div>
      <div>
        <label htmlFor="form-confirm" className="block text-sm font-medium mb-2">
          Confirm Password <span className="text-red-500" aria-label="required">*</span>
        </label>
        <Input
          id="form-confirm"
          type="password"
          required
          placeholder="Confirm password"
        />
      </div>
    </form>
  ),
};

// Accessibility showcase
export const AccessibilityShowcase: Story = {
  render: () => (
    <div className="space-y-6 w-80">
      <div>
        <h3 className="text-lg font-semibold mb-4">Accessibility Features</h3>
        
        {/* Proper labeling */}
        <div className="mb-4">
          <label htmlFor="a11y-labeled" className="block text-sm font-medium mb-2">
            Properly Labeled Input
          </label>
          <Input
            id="a11y-labeled"
            placeholder="This input has a proper label"
          />
        </div>

        {/* ARIA label for inputs without visible labels */}
        <div className="mb-4">
          <Input
            aria-label="Search products"
            type="search"
            placeholder="Search..."
          />
          <p className="text-xs text-gray-600 mt-1">
            This search input uses aria-label since it has no visible label
          </p>
        </div>

        {/* Error with ARIA announcements */}
        <div className="mb-4">
          <label htmlFor="a11y-error" className="block text-sm font-medium mb-2">
            Input with Error
          </label>
          <Input
            id="a11y-error"
            variant="error"
            error="This error message will be announced to screen readers"
            placeholder="This input has an error"
          />
        </div>

        {/* Helper text */}
        <div className="mb-4">
          <label htmlFor="a11y-helper" className="block text-sm font-medium mb-2">
            Input with Helper Text
          </label>
          <Input
            id="a11y-helper"
            helperText="This helper text provides additional context"
            placeholder="Input with helper text"
          />
        </div>

        {/* Required field */}
        <div className="mb-4">
          <label htmlFor="a11y-required" className="block text-sm font-medium mb-2">
            Required Field <span className="text-red-500" aria-label="required">*</span>
          </label>
          <Input
            id="a11y-required"
            required
            aria-required="true"
            placeholder="This field is required"
          />
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'This story demonstrates various accessibility features including proper labeling, ARIA attributes, error announcements, and helper text.',
      },
    },
  },
};
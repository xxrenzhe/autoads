import type { Meta, StoryObj } from '@storybook/react';
import { StatusIndicator, BatchStatusIndicator } from './StatusIndicator';

const meta: any = {
  title: 'UI/StatusIndicator',
  component: StatusIndicator,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: { type: 'select' },
      options: ['success', 'error', 'warning', 'info', 'pending', 'running', 'paused', 'idle'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    variant: {
      control: { type: 'select' },
      options: ['dot', 'badge', 'icon'],
    },
    animated: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = any;

export const Default: Story = {
  args: {
    status: 'success',
    variant: 'badge',
    size: 'md',
  },
};

export const WithCustomLabel: Story = {
  args: {
    status: 'running',
    label: 'Processing data...',
    variant: 'badge',
    animated: true,
  },
};

export const AllStatuses: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <StatusIndicator status="success" />
        <StatusIndicator status="error" />
        <StatusIndicator status="warning" />
        <StatusIndicator status="info" />
      </div>
      <div className="flex flex-wrap gap-4">
        <StatusIndicator status="pending" animated />
        <StatusIndicator status="running" animated />
        <StatusIndicator status="paused" />
        <StatusIndicator status="idle" />
      </div>
    </div>
  ),
};

export const Variants: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-3">Badge Variant</h3>
        <div className="flex flex-wrap gap-4">
          <StatusIndicator status="success" variant="badge" />
          <StatusIndicator status="error" variant="badge" />
          <StatusIndicator status="warning" variant="badge" />
          <StatusIndicator status="running" variant="badge" animated />
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-3">Icon Variant</h3>
        <div className="flex flex-wrap gap-4">
          <StatusIndicator status="success" variant="icon" />
          <StatusIndicator status="error" variant="icon" />
          <StatusIndicator status="warning" variant="icon" />
          <StatusIndicator status="running" variant="icon" animated />
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-3">Dot Variant</h3>
        <div className="flex flex-wrap gap-4">
          <StatusIndicator status="success" variant="dot" />
          <StatusIndicator status="error" variant="dot" />
          <StatusIndicator status="warning" variant="dot" />
          <StatusIndicator status="running" variant="dot" animated />
        </div>
      </div>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-3">Small</h3>
        <div className="flex flex-wrap gap-4">
          <StatusIndicator status="success" size="sm" />
          <StatusIndicator status="error" size="sm" variant="icon" />
          <StatusIndicator status="warning" size="sm" variant="dot" />
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-3">Medium</h3>
        <div className="flex flex-wrap gap-4">
          <StatusIndicator status="success" size="md" />
          <StatusIndicator status="error" size="md" variant="icon" />
          <StatusIndicator status="warning" size="md" variant="dot" />
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-3">Large</h3>
        <div className="flex flex-wrap gap-4">
          <StatusIndicator status="success" size="lg" />
          <StatusIndicator status="error" size="lg" variant="icon" />
          <StatusIndicator status="warning" size="lg" variant="dot" />
        </div>
      </div>
    </div>
  ),
};

// Batch Status Indicator Stories
export const BatchDefault: StoryObj<typeof BatchStatusIndicator> = {
  args: {
    statuses: [
      { status: 'success', count: 45, label: 'Completed' },
      { status: 'running', count: 12, label: 'In Progress' },
      { status: 'error', count: 3, label: 'Failed' },
      { status: 'pending', count: 8, label: 'Waiting' },
    ],
  },
};

export const BatchSizes: StoryObj<typeof BatchStatusIndicator> = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-3">Small</h3>
        <BatchStatusIndicator
          size="sm"
          statuses={[
            { status: 'success', count: 25 },
            { status: 'error', count: 5 },
            { status: 'pending', count: 10 },
          ]}
        />
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-3">Medium</h3>
        <BatchStatusIndicator
          size="md"
          statuses={[
            { status: 'success', count: 25 },
            { status: 'error', count: 5 },
            { status: 'pending', count: 10 },
          ]}
        />
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-3">Large</h3>
        <BatchStatusIndicator
          size="lg"
          statuses={[
            { status: 'success', count: 25 },
            { status: 'error', count: 5 },
            { status: 'pending', count: 10 },
          ]}
        />
      </div>
    </div>
  ),
};

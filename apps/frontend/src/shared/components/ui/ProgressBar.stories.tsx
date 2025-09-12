import type { Meta, StoryObj } from '@storybook/react';
import { Progress } from './ProgressBar';

const meta: Meta<typeof Progress> = {
  title: 'UI/ProgressBar',
  component: Progress,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
    },
    max: {
      control: { type: 'number' },
    },
    className: {
      control: { type: 'text' },
    },
    indicatorClassName: {
      control: { type: 'text' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 50,
    max: 100,
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="w-80">
      <div className="flex justify-between mb-2">
        <span className="text-sm font-medium">Processing...</span>
        <span className="text-sm text-gray-600">75%</span>
      </div>
      <Progress value={75} max={100} />
    </div>
  ),
};

export const Success: Story = {
  args: {
    value: 100,
    max: 100,
    indicatorClassName: 'bg-green-600',
  },
};

export const Warning: Story = {
  args: {
    value: 85,
    max: 100,
    className: 'bg-yellow-200',
  },
};

export const Error: Story = {
  args: {
    value: 30,
    max: 100,
    className: 'bg-red-200',
  },
};

export const CustomStyles: Story = {
  args: {
    value: 70,
    max: 100,
    className: 'bg-blue-500',
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="space-y-4 w-80">
      <div>
        <p className="text-sm font-medium mb-2">Small</p>
        <Progress value={40} className="h-1" />
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Medium</p>
        <Progress value={60} className="h-2" />
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Large</p>
        <Progress value={80} className="h-4" />
      </div>
    </div>
  ),
};
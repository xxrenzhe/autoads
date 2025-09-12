import type { Meta, StoryObj } from '@storybook/react';
import { DataTable } from './DataTable';
import { StatusIndicator } from '../ui/StatusIndicator';

// Sample data
const sampleData = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'Admin',
    status: 'active',
    lastLogin: '2024-01-15',
    projects: 5,
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'User',
    status: 'inactive',
    lastLogin: '2024-01-10',
    projects: 3,
  },
  {
    id: '3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    role: 'Manager',
    status: 'active',
    lastLogin: '2024-01-16',
    projects: 8,
  },
  {
    id: '4',
    name: 'Alice Brown',
    email: 'alice@example.com',
    role: 'User',
    status: 'pending',
    lastLogin: '2024-01-12',
    projects: 2,
  },
  {
    id: '5',
    name: 'Charlie Wilson',
    email: 'charlie@example.com',
    role: 'Admin',
    status: 'active',
    lastLogin: '2024-01-14',
    projects: 12,
  },
];

// Generate more data for pagination testing
const generateLargeDataset = (count: number) => {
  const roles = ['Admin', 'User', 'Manager', 'Viewer'];
  const statuses = ['active', 'inactive', 'pending'];
  const names = ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana', 'Eve', 'Frank'];
  const surnames = ['Doe', 'Smith', 'Johnson', 'Brown', 'Wilson', 'Davis', 'Miller', 'Garcia'];

  return Array.from({ length: count }, (_, i) => {
    const name = names[i % names.length];
    const surname = surnames[i % surnames.length];
    return {
      id: String(i + 1),
      name: `${name} ${surname}`,
      email: `${name.toLowerCase()}.${surname.toLowerCase()}${i}@example.com`,
      role: roles[i % roles.length],
      status: statuses[i % statuses.length],
      lastLogin: new Date(2024, 0, Math.floor(Math.random() * 30) + 1).toISOString().split('T')[0],
      projects: Math.floor(Math.random() * 15) + 1,
    };
  });
};

const meta: Meta<typeof DataTable> = {
  title: 'Data Display/DataTable',
  component: DataTable,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
A fully accessible data table component with sorting, filtering, pagination, and keyboard navigation.

## Accessibility Features
- Full keyboard navigation support
- Screen reader compatible with proper ARIA labels
- Sortable columns with ARIA sort attributes
- Proper table structure with roles and scope attributes
- Live regions for status updates
- Focus management for interactive elements

## Keyboard Navigation
- **Tab**: Navigate through interactive elements
- **Enter/Space**: Activate sortable columns and clickable rows
- **Arrow keys**: Navigate within pagination controls

## Screen Reader Support
- Table caption and description
- Column header announcements
- Sort state announcements
- Filter and search result announcements
- Pagination status updates
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    data: {
      description: 'Array of data objects to display in the table',
    },
    columns: {
      description: 'Column configuration with headers, sorting, and filtering options',
    },
    pageSize: {
      description: 'Number of rows per page for pagination',
      control: { type: 'number', min: 1, max: 50 },
    },
    searchable: {
      description: 'Enable global search functionality',
      control: { type: 'boolean' },
    },
    loading: {
      description: 'Show loading state',
      control: { type: 'boolean' },
    },
    onRowClick: {
      description: 'Callback function when a row is clicked',
    },
    caption: {
      description: 'Table caption for accessibility (screen reader only)',
    },
    ariaLabel: {
      description: 'Custom ARIA label for the table',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const basicColumns = [
  {
    key: 'name' as const,
    header: 'Name',
    sortable: true,
    filterable: true,
  },
  {
    key: 'email' as const,
    header: 'Email',
    sortable: true,
    filterable: true,
  },
  {
    key: 'role' as const,
    header: 'Role',
    sortable: true,
    filterable: true,
  },
  {
    key: 'status' as const,
    header: 'Status',
    sortable: true,
    filterable: true,
    render: (value: any) => (
      <StatusIndicator 
        status={value === 'active' ? 'success' : value === 'inactive' ? 'error' : 'warning'} 
        label={String(value)}
        size="sm"
      />
    ),
  },
  {
    key: 'projects' as const,
    header: 'Projects',
    sortable: true,
    width: '100px',
  },
];

export const Default: Story = {
  args: {
    data: sampleData,
    columns: basicColumns,
    searchable: true,
    pageSize: 5,
    caption: 'User management table showing user details and status',
    ariaLabel: 'List of users with their contact information and roles',
  },
};

export const WithCustomRendering: Story = {
  args: {
    data: sampleData,
    columns: [
      {
        key: 'name' as const,
        header: 'User',
        sortable: true,
        render: (value: any, row: any) => (
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
              {String(value).charAt(0)}
            </div>
            <div>
              <div className="font-medium">{String(value)}</div>
              <div className="text-sm text-gray-500">{row.email}</div>
            </div>
          </div>
        ),
      },
      {
        key: 'role' as const,
        header: 'Role',
        sortable: true,
        render: (value: any) => (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
            value === 'Admin' ? 'bg-purple-100 text-purple-800' :
            value === 'Manager' ? 'bg-blue-100 text-blue-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {String(value)}
          </span>
        ),
      },
      {
        key: 'status' as const,
        header: 'Status',
        sortable: true,
        render: (value: any) => (
          <StatusIndicator 
            status={value === 'active' ? 'success' : value === 'inactive' ? 'error' : 'warning'} 
            label={String(value)}
            size="sm"
          />
        ),
      },
      {
        key: 'lastLogin' as const,
        header: 'Last Login',
        sortable: true,
        render: (value: any) => new Date(String(value)).toLocaleDateString(),
      },
      {
        key: 'projects' as const,
        header: 'Projects',
        sortable: true,
        render: (value: any) => (
          <div className="text-center">
            <span className="text-lg font-semibold">{String(value)}</span>
          </div>
        ),
      },
    ],
    searchable: true,
    pageSize: 5,
    onRowClick: (row: any) => console.log('Row clicked:', row),
  },
};

export const WithPagination: Story = {
  args: {
    data: generateLargeDataset(50),
    columns: basicColumns,
    searchable: true,
    pageSize: 10,
  },
};

export const Loading: Story = {
  args: {
    data: [],
    columns: basicColumns,
    loading: true,
  },
};

export const Empty: Story = {
  args: {
    data: [],
    columns: basicColumns,
    emptyMessage: 'No users found. Try adjusting your search criteria.',
  },
};

export const NoSearch: Story = {
  args: {
    data: sampleData,
    columns: basicColumns,
    searchable: false,
    pageSize: 10,
  },
};

export const CompactView: Story = {
  args: {
    data: generateLargeDataset(20),
    columns: [
      {
        key: 'name' as const,
        header: 'Name',
        sortable: true,
        filterable: true,
        width: '200px',
      },
      {
        key: 'email' as const,
        header: 'Email',
        sortable: true,
        filterable: true,
        width: '250px',
      },
      {
        key: 'role' as const,
        header: 'Role',
        sortable: true,
        filterable: true,
        width: '100px',
      },
      {
        key: 'status' as const,
        header: 'Status',
        sortable: true,
        filterable: true,
        width: '120px',
        render: (value: any) => (
          <StatusIndicator 
            status={value === 'active' ? 'success' : value === 'inactive' ? 'error' : 'warning'} 
            variant="dot"
            size="sm"
          />
        ),
      },
    ],
    searchable: true,
    pageSize: 15,
    className: 'text-sm',
  },
};

export const WithActions: Story = {
  args: {
    data: sampleData,
    columns: [
      ...basicColumns,
      {
        key: 'actions' as const,
        header: 'Actions',
        render: (value: any, row: any) => (
          <div className="flex space-x-2">
            <button 
              className="text-blue-600 hover:text-blue-800 text-sm"
              onClick={(e) => {
                e.stopPropagation();
                console.log('Edit:', row);
              }}
            >
              Edit
            </button>
            <button 
              className="text-red-600 hover:text-red-800 text-sm"
              onClick={(e) => {
                e.stopPropagation();
                console.log('Delete:', row);
              }}
            >
              Delete
            </button>
          </div>
        ),
      },
    ],
    searchable: true,
    pageSize: 5,
    onRowClick: (row: any) => console.log('Row clicked:', row),
  },
};

export const AccessibilityDemo: Story = {
  args: {
    data: sampleData.slice(0, 4),
    columns: basicColumns?.filter(Boolean)?.map(col => ({
      ...col,
      ariaLabel: `${col.header} column - ${col.sortable ? 'sortable' : 'not sortable'}${col.filterable ? ', filterable' : ''}`,
    })),
    searchable: true,
    onRowClick: (row) => console.log('Accessibility demo - selected:', row.name),
    caption: 'Accessibility demonstration table with enhanced ARIA labels and descriptions',
    ariaLabel: 'Demonstration of accessible data table features including keyboard navigation and screen reader support',
    pageSize: 4,
  },
  parameters: {
    docs: {
      description: {
        story: `
This story demonstrates the accessibility features of the DataTable:

**Try these interactions:**
1. Use Tab to navigate through interactive elements
2. Use Enter/Space on column headers to sort
3. Use Enter/Space on table rows to select them
4. Use screen reader to hear announcements
5. Check the browser's accessibility tree

**Accessibility Features Demonstrated:**
- Proper table structure with roles and scope
- ARIA sort attributes on sortable columns
- Keyboard navigation for all interactive elements
- Screen reader announcements for state changes
- Focus management and visual focus indicators
- Semantic HTML with proper labeling
        `,
      },
    },
  },
};
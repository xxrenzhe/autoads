import React from 'react';
import {
  DataGridPro,
  GridColDef,
  GridValueGetter,
  GridActionsCellItem,
  GridRenderCellParams,
  GridRowsProp,
} from '@mui/x-data-grid-pro';
import {
  Box,
  Chip,
  Tooltip,
  IconButton,
  Typography,
  useTheme,
  CircularProgress,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  MoreVert as MoreIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface ResponsiveDataGridProps {
  rows: GridRowsProp;
  columns: GridColDef[];
  loading?: boolean;
  pageSize?: number;
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  onView?: (row: any) => void;
  getRowId?: (row: any) => string;
  actions?: Array<{
    icon: React.ReactNode;
    label: string;
    onClick: (row: any) => void;
    show?: (row: any) => boolean;
  }>;
}

/**
 * Enhanced responsive data grid with common functionality
 */
export const ResponsiveDataGrid: React.FC<ResponsiveDataGridProps> = ({
  rows,
  columns,
  loading = false,
  pageSize = 25,
  onEdit,
  onDelete,
  onView,
  getRowId,
  actions = [],
}) => {
  const theme = useTheme();

  // Format date columns
  const enhancedColumns = columns.map((col: any) => {
    if (col.type === 'dateTime') {
      return {
        ...col,
        renderCell: (params: GridRenderCellParams) => {
          if (!params.value) return '-';
          return format(new Date(params.value), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN });
        },
        valueGetter: (value: any, row: any) => {
          if (!value) return null as any;
          return new Date(value);
        },
      };
    }
    if (col.type === 'date') {
      return {
        ...col,
        renderCell: (params: GridRenderCellParams) => {
          if (!params.value) return '-';
          return format(new Date(params.value), 'yyyy-MM-dd', { locale: zhCN });
        },
        valueGetter: (value: any, row: any) => {
          if (!value) return null as any;
          return new Date(value);
        },
      };
    }
    if (col.type === 'boolean') {
      return {
        ...col,
        renderCell: (params: GridRenderCellParams) => {
          const value = params.value as boolean;
          return (
            <Chip
              label={value ? '是' : '否'}
              color={value ? 'success' : 'default'}
              size="small"
            />
          );
        },
      };
    }
    return col;
  });

  // Add actions column if needed
  const hasActions = onEdit || onDelete || onView || actions.length > 0;
  const finalColumns = hasActions
    ? [
        ...enhancedColumns,
        {
          field: 'actions',
          type: 'actions',
          headerName: '操作',
          width: 180,
          getActions: (params: any) => {
            const actionsArray: any[] = [];

            if (onView) {
              actionsArray.push(
                <GridActionsCellItem
                  icon={<ViewIcon />}
                  label="查看"
                  onClick={() => onView?.(params.row)}
                  showInMenu
                />
              );
            }

            if (onEdit) {
              actionsArray.push(
                <GridActionsCellItem
                  icon={<EditIcon />}
                  label="编辑"
                  onClick={() => onEdit?.(params.row)}
                  showInMenu
                />
              );
            }

            actions.forEach((action: any) => {
              if (!action.show || action.show(params.row)) {
                actionsArray.push(
                  <GridActionsCellItem
                    icon={action.icon}
                    label={action.label}
                    onClick={() => action.onClick(params.row)}
                    showInMenu
                  />
                );
              }
            });

            if (onDelete) {
              actionsArray.push(
                <GridActionsCellItem
                  icon={<DeleteIcon />}
                  label="删除"
                  onClick={() => onDelete?.(params.row)}
                  showInMenu
                />
              );
            }

            return actionsArray;
          },
        } as GridColDef,
      ]
    : enhancedColumns;

  return (
    <Box sx={{ width: '100%' }}>
      <DataGridPro
        rows={rows}
        columns={finalColumns}
        loading={loading}
        pageSizeOptions={[10, 25, 50, 100]}
        disableRowSelectionOnClick
        disableColumnMenu={false}
        getRowId={getRowId}
        sx={{
          '& .MuiDataGrid-cell': {
            borderBottom: `1px solid ${theme.palette.divider}`,
          },
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: theme.palette.action.hover,
          },
          '& .MuiDataGrid-columnHeader': {
            fontWeight: 600,
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: theme.palette.action.hover,
          },
          '& .MuiDataGrid-footerContainer': {
            borderTop: `1px solid ${theme.palette.divider}`,
          },
        }}
        slots={{
          noRowsOverlay: () => (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                p: 3,
              }}
            >
              <Typography variant="h6" color="text.secondary">
                暂无数据
              </Typography>
            </Box>
          ),
          loadingOverlay: () => (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <CircularProgress />
              <Typography variant="body2" sx={{ mt: 1 }}>
                加载中...
              </Typography>
            </Box>
          ),
        }}
      />
    </Box>
  );
};

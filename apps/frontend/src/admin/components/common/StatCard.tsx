import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Info,
  Refresh,
} from '@mui/icons-material';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
  tooltip?: string;
  onRefresh?: () => void;
  loading?: boolean;
}

/**
 * Enhanced statistics card component
 */
export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  color = 'primary',
  tooltip,
  onRefresh,
  loading = false,
}) => {
  const getColor = () => {
    switch (color) {
      case 'success':
        return '#4caf50';
      case 'error':
        return '#f44336';
      case 'warning':
        return '#ff9800';
      case 'info':
        return '#2196f3';
      case 'secondary':
        return '#9c27b0';
      default:
        return '#3f51b5';
    }
  };

  const cardContent = (
    <Card
      sx={{
        height: '100%',
        position: 'relative',
        '&:hover': {
          boxShadow: 4,
        },
        transition: 'box-shadow 0.3s ease',
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {title}
          </Typography>
          {onRefresh && (
            <IconButton
              size="small"
              onClick={onRefresh}
              disabled={loading}
              sx={{ p: 0.5 }}
            >
              <Refresh fontSize="small" />
            </IconButton>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 1 }}>
          <Typography
            variant="h4"
            component="div"
            sx={{
              fontWeight: 600,
              color: getColor(),
            }}
          >
            {loading ? '---' : value}
          </Typography>
          {trend && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                ml: 2,
                color: trend.isPositive ? 'success.main' : 'error.main',
              }}
            >
              {trend.isPositive ? (
                <TrendingUp fontSize="small" />
              ) : (
                <TrendingDown fontSize="small" />
              )}
              <Typography variant="body2" sx={{ ml: 0.5 }}>
                {Math.abs(trend.value)}%
              </Typography>
            </Box>
          )}
        </Box>
        
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
        
        {icon && (
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              opacity: 0.3,
            }}
          >
            {icon}
          </Box>
        )}
      </CardContent>
    </Card>
  );

  if (tooltip) {
    return (
      <Tooltip title={tooltip} placement="top">
        <Box>{cardContent}</Box>
      </Tooltip>
    );
  }

  return cardContent;
};

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
  actions?: React.ReactNode;
}

/**
 * Card component for charts
 */
export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  children,
  height = 400,
  actions,
}) => {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 2,
          }}
        >
          <Box>
            <Typography variant="h6" gutterBottom>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          {actions}
        </Box>
        <Box sx={{ height }}>{children}</Box>
      </CardContent>
    </Card>
  );
};
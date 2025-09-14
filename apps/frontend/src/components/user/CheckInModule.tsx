'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Grid,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Badge,
  IconButton,
  Tooltip,
  Stack,
  Divider,
  Snackbar
} from '@mui/material';
import {
  CalendarToday,
  EmojiEvents,
  LocalActivity,
  Refresh,
  CheckCircle,
  Pending,
  Whatshot,
  Star,
  TrendingUp,
  Share
} from '@mui/icons-material';
import { format, isToday, isYesterday, addDays, subDays, startOfDay, endOfDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import CheckInSuccessDialog from './CheckInSuccessDialog';
import { http } from '@/shared/http/client'

interface CheckInRecord {
  id: string;
  date: string;
  tokens: number;
  streak: number;
  rewardLevel: number;
  createdAt: string;
}

interface CheckInStats {
  totalCheckIns: number;
  thisMonthCheckIns: number;
  lastMonthCheckIns: number;
  currentStreak: number;
  longestStreak: number;
  consecutiveDays: number;
}

interface CheckInData {
  hasCheckedInToday: boolean;
  todayCheckIn?: CheckInRecord;
  history: CheckInRecord[];
  stats: CheckInStats;
  nextReward: {
    streak: number;
    tokens: number;
    rewardLevel: number;
  };
}

const CheckInModule: React.FC = () => {
  const [checkInData, setCheckInData] = useState<CheckInData | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successDialog, setSuccessDialog] = useState(false);
  const [checkInResult, setCheckInResult] = useState<any>(null);
  const [hasSharedToday, setHasSharedToday] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });

  useEffect(() => {
    fetchCheckInData();
  }, []);

  const fetchCheckInData = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await http.get<CheckInData>('/user/check-in');
      setCheckInData(data as any);
      
      // Check if user has shared today
      await checkShareStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const checkShareStatus = async () => {
    try {
      const today = new Date();
      const todayStart = startOfDay(today).toISOString();
      const todayEnd = endOfDay(today).toISOString();
      
      const data = await http.get<{ hasSharedToday: boolean }>(
        '/user/check-in/share-rewards',
        { startDate: todayStart, endDate: todayEnd }
      );
      setHasSharedToday((data as any)?.hasSharedToday || false);
    } catch (error) {
      console.error('Failed to check share status:', error);
    }
  };

  const handleCheckIn = async () => {
    setCheckingIn(true);
    setError(null);

    try {
      const data = await http.post<{ success: boolean; checkIn?: any; error?: string }>(
        '/user/check-in',
        undefined
      )
      if ((data as any)?.success === false) {
        throw new Error((data as any)?.error || 'Check-in failed')
      }

      setCheckInResult(data as any);
      setSuccessDialog(true);
      await fetchCheckInData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleShare = async (platform: string) => {
    if (!checkInResult?.checkIn?.id) {
      setSnackbar({
        open: true,
        message: '请先完成签到',
        severity: 'error'
      });
      return;
    }

    try {
      // Generate share content
      const shareText = `我在 ChangeLink 已连续签到 ${checkInResult.checkIn.streak} 天，获得了 ${checkInResult.checkIn.tokens} Token 奖励！一起来签到赢取奖励吧！`;
      const shareUrl = typeof window !== 'undefined' ? window.location.origin : '';

      // Create share rewards record
      const data = await http.post<{ success: boolean; rewardToken: number; error?: string }>(
        '/user/check-in/share-rewards',
        {
          checkInId: checkInResult.checkIn.id,
          platform,
          shareText,
          shareUrl
        }
      );

      if ((data as any)?.success === false) {
        throw new Error((data as any)?.error || 'Share reward failed');
      }

      // Update share status
      setHasSharedToday(true);
      
      // Show success message
      setSnackbar({
        open: true,
        message: `分享成功！获得 ${data.rewardToken} Token 奖励`,
        severity: 'success'
      });

      // Refresh check-in data to update token balance
      await fetchCheckInData();

      // Open share dialog (this would be platform-specific)
      if (platform === 'weixin') {
        // WeChat sharing logic
        console.log('Sharing to WeChat:', shareText, shareUrl);
      } else if (platform === 'weibo') {
        // Weibo sharing logic
        const weiboUrl = `https://service.weibo.com/share/share.php?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}`;
        window.open(weiboUrl, '_blank');
      } else if (platform === 'qq') {
        // QQ sharing logic
        const qqUrl = `https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}`;
        window.open(qqUrl, '_blank');
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : '分享失败',
        severity: 'error'
      });
    }
  };

  const getRewardInfo = (level: number) => {
    const rewards = [
      { level: 1, tokens: 10, label: '第一天', color: 'primary' },
      { level: 2, tokens: 20, label: '第二天', color: 'secondary' },
      { level: 3, tokens: 40, label: '第三天', color: 'warning' },
      { level: 4, tokens: 80, label: '第四天+', color: 'success' }
    ];
    return rewards[level - 1] || rewards[0];
  };

  const renderCalendar = () => {
    if (!checkInData) return null as any;

    const today = new Date();
    const calendarDays: Array<{
      date: Date;
      checkIn: CheckInRecord | undefined;
      isToday: boolean;
      isPast: boolean;
    }> = [];
    
    // Show last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = subDays(today, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const checkIn = checkInData.history.find((h: any) => 
        format(new Date(h.date), 'yyyy-MM-dd') === dateStr
      );
      
      calendarDays.push({
        date,
        checkIn,
        isToday: isToday(date),
        isPast: date < today
      });
    }

    return (
      <Grid container spacing={1} sx={{ mt: 2 }}>
        {calendarDays.map((day, index: any) => {
          const dayName = format(day.date, 'EEE', { locale: zhCN });
          const dayNum = format(day.date, 'd');
          
          return (
            <Grid item xs={4} sm={3} md={2} lg={1} key={index}>
              <Card 
                sx={{ 
                  height: 80,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: day.checkIn ? 'success.light' : 
                           day.isToday ? 'primary.light' : 
                           day.isPast ? 'grey.100' : 'background.paper',
                  border: day.isToday ? 2 : 1,
                  borderColor: day.isToday ? 'primary.main' : 'grey.300'
                }}
              >
                <Typography variant="caption" color="textSecondary">
                  {dayName}
                </Typography>
                <Typography variant="h6" sx={{ my: 0.5 }}>
                  {dayNum}
                </Typography>
                {day.checkIn ? (
                  <CheckCircle color="success" fontSize="small" />
                ) : day.isToday && !checkInData.hasCheckedInToday ? (
                  <Pending color="primary" fontSize="small" />
                ) : null}
                {day.checkIn && (
                  <Typography variant="caption" color="success.dark" fontWeight={600}>
                    +{day.checkIn.tokens}
                  </Typography>
                )}
              </Card>
            </Grid>
          );
        })}
      </Grid>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (!checkInData) {
    return null as any;
  }

  const { hasCheckedInToday, todayCheckIn, stats, nextReward } = checkInData;
  const currentReward = getRewardInfo(Math.min(stats.currentStreak, 4));
  const nextRewardInfo = getRewardInfo(nextReward.rewardLevel);

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CalendarToday sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h5" component="h2">
              每日签到
            </Typography>
          </Box>
          <Tooltip title="刷新">
            <IconButton onClick={fetchCheckInData} size="small">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Current Status */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'primary.light', color: 'white' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <EmojiEvents />
                <Typography variant="h4" sx={{ my: 1 }}>
                  {stats.currentStreak}
                </Typography>
                <Typography variant="body2">
                  当前连续天数
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'warning.light', color: 'white' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Whatshot />
                <Typography variant="h4" sx={{ my: 1 }}>
                  {stats.longestStreak}
                </Typography>
                <Typography variant="body2">
                  最长连续天数
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'info.light', color: 'white' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <TrendingUp />
                <Typography variant="h4" sx={{ my: 1 }}>
                  {stats.thisMonthCheckIns}
                </Typography>
                <Typography variant="body2">
                  本月签到
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'secondary.light', color: 'white' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Star />
                <Typography variant="h4" sx={{ my: 1 }}>
                  {stats.totalCheckIns}
                </Typography>
                <Typography variant="body2">
                  累计签到
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Reward Progress */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            奖励进度
          </Typography>
          <Stack spacing={2}>
            {[1, 2, 3, 4].map((level: any) => {
              const reward = getRewardInfo(level);
              const isCurrentLevel = stats.currentStreak >= level;
              const isNextLevel = nextReward.rewardLevel === level;
              
              return (
                <Box key={level} sx={{ display: 'flex', alignItems: 'center' }}>
                  <Badge
                    color={isCurrentLevel ? 'success' : 'default'}
                    variant={isCurrentLevel ? 'standard' : 'dot'}
                    badgeContent={isCurrentLevel ? <CheckCircle fontSize="small" /> : 0}
                  >
                    <Chip
                      label={`${reward.label}: ${reward.tokens} Token`}
                      color={isCurrentLevel ? 'success' : isNextLevel ? 'primary' : 'default'}
                      variant={isCurrentLevel ? 'filled' : 'outlined'}
                      icon={<LocalActivity />}
                    />
                  </Badge>
                  {isNextLevel && !hasCheckedInToday && (
                    <Typography variant="body2" color="primary" sx={{ ml: 2 }}>
                      下一次签到可获得
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Stack>
        </Box>

        {/* Check-in Button */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Button
            variant="contained"
            size="large"
            onClick={handleCheckIn}
            disabled={hasCheckedInToday || checkingIn}
            startIcon={hasCheckedInToday ? <CheckCircle /> : <LocalActivity />}
            sx={{ minWidth: 200 }}
          >
            {hasCheckedInToday 
              ? `今日已签到 (+${todayCheckIn?.tokens} Token)` 
              : checkingIn 
                ? '签到中...' 
                : `立即签到 (+${nextReward.tokens} Token)`
            }
          </Button>
        </Box>

        {/* Calendar */}
        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" gutterBottom>
          签到日历
        </Typography>
        {renderCalendar()}

        {/* Success Dialog */}
        <CheckInSuccessDialog
          open={successDialog}
          onClose={() => setSuccessDialog(false)}
          checkInResult={checkInResult}
          onShare={handleShare}
          hasSharedToday={hasSharedToday}
        />

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          message={snackbar.message}
        />
      </CardContent>
    </Card>
  );
};

export default CheckInModule;

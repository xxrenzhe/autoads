'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  IconButton,
  Stack,
  Divider
} from '@mui/material';
import {
  EmojiEvents,
  Share,
  Close,
  Star,
  LocalActivity,
  Whatshot,
  Autorenew
} from '@mui/icons-material';

interface CheckInSuccessDialogProps {
  open: boolean;
  onClose: () => void;
  checkInResult: {
    checkIn: {
      id: string;
      tokens: number;
      streak: number;
      rewardLevel: number;
    };
  };
  onShare: (platform: string) => void;
  hasSharedToday?: boolean;
}

const CheckInSuccessDialog: React.FC<CheckInSuccessDialogProps> = ({
  open,
  onClose,
  checkInResult,
  onShare,
  hasSharedToday = false
}) => {
  const { checkIn } = checkInResult;

  const sharePlatforms = [
    { id: 'weixin', name: '微信', icon: '💬' },
    { id: 'weibo', name: '微博', icon: '📱' },
    { id: 'qq', name: 'QQ空间', icon: '🐧' }
  ];

  const getRewardMessage = (streak: number) => {
    if (streak === 1) return '初来乍到，继续加油！';
    if (streak === 2) return '连续两天，保持势头！';
    if (streak === 3) return '三连达成，势不可挡！';
    if (streak >= 4) return '签到达人，太棒了！';
    return '签到成功！';
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle sx={{ textAlign: 'center', pb: 2 }}>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <motion.div
                animate={{
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{
                  duration: 0.5,
                  ease: "easeInOut"
                }}
              >
                <EmojiEvents 
                  color="success" 
                  sx={{ 
                    fontSize: 64, 
                    mb: 2,
                    filter: 'drop-shadow(0 4px 8px rgba(76, 175, 80, 0.3))'
                  }} 
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Typography variant="h4" fontWeight={700}>
            签到成功！
          </Typography>
          <Typography variant="body1" color="text.secondary" mt={1}>
            {getRewardMessage(checkIn.streak)}
          </Typography>
        </motion.div>
      </DialogTitle>

      <DialogContent sx={{ textAlign: 'center' }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Box
            sx={{
              background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
              color: 'white',
              borderRadius: 2,
              p: 3,
              mb: 3,
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -50,
                right: -50,
                width: 100,
                height: 100,
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '50%'
              }}
            />
            <Typography variant="h3" fontWeight={700}>
              +{checkIn.tokens} Token
            </Typography>
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} mt={1}>
              <Whatshot />
              <Typography variant="body1">
                连续 {checkIn.streak} 天
              </Typography>
            </Stack>
          </Box>
        </motion.div>

        {checkIn.rewardLevel > 1 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Chip
              label={`奖励等级 ${checkIn.rewardLevel}`}
              color="success"
              sx={{ 
                mb: 3,
                fontSize: '1rem',
                px: 2,
                py: 1,
                '& .MuiChip-icon': { fontSize: '1.2rem' }
              }}
              icon={<Star />}
            />
          </motion.div>
        )}

        <Divider sx={{ my: 3 }} />

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} mb={2}>
              <Share color="primary" />
              <Typography variant="h6">
                分享签到
              </Typography>
            </Stack>
            
            {!hasSharedToday ? (
              <>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  分享到社交媒体，额外获得 10 Token 奖励！
                </Typography>
                <Stack direction="row" spacing={2} justifyContent="center">
                  {sharePlatforms.map((platform: any) => (
                    <motion.div
                      key={platform.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        variant="outlined"
                        onClick={() => onShare(platform.id)}
                        startIcon={<span style={{ fontSize: '1.2rem' }}>{platform.icon}</span>}
                        sx={{
                          borderRadius: 2,
                          minWidth: 100
                        }}
                      >
                        {platform.name}
                      </Button>
                    </motion.div>
                  ))}
                </Stack>
              </>
            ) : (
              <Box
                sx={{
                  bgcolor: 'success.light',
                  color: 'white',
                  borderRadius: 2,
                  p: 2
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                  <EmojiEvents />
                  <Typography variant="body1" fontWeight={600}>
                    今日分享奖励已领取
                  </Typography>
                </Stack>
              </Box>
            )}
          </Box>
        </motion.div>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <Button
            onClick={onClose}
            variant="contained"
            size="large"
            sx={{
              borderRadius: 2,
              px: 4,
              background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #45a049 0%, #4CAF50 100%)'
              }
            }}
          >
            确定
          </Button>
        </motion.div>
      </DialogActions>
    </Dialog>
  );
};

export default CheckInSuccessDialog;
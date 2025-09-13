'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Chip,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  CircularProgress
} from '@mui/material';
import {
  CreditCard as CreditCardIcon,
  AccountBalance as AccountBalanceIcon,
  QrCode as QrCodeIcon,
  LocalOffer as LocalOfferIcon,
  CheckCircle as CheckCircleIcon,
  Payments as PaymentsIcon
} from '@mui/icons-material';
import { loadStripe } from '@stripe/stripe-js';

interface QuickRechargeProps {
  userId: string;
  currentBalance: number;
  onRechargeSuccess?: (amount: number) => void;
}

interface RechargePackage {
  id: string;
  name: string;
  tokens: number;
  price: number;
  bonus: number;
  popular?: boolean;
  description: string;
}

const QuickRecharge: React.FC<QuickRechargeProps> = ({ userId, currentBalance, onRechargeSuccess }) => {
  const [open, setOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<RechargePackage | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [customTokens, setCustomTokens] = useState('');
  const [error, setError] = useState('');

  const rechargePackages: RechargePackage[] = [
    {
      id: 'starter',
      name: '入门包',
      tokens: 1000,
      price: 9.9,
      bonus: 0,
      description: '适合轻度用户'
    },
    {
      id: 'standard',
      name: '标准包',
      tokens: 5000,
      price: 39.9,
      bonus: 500,
      popular: true,
      description: '最受欢迎'
    },
    {
      id: 'premium',
      name: '高级包',
      tokens: 10000,
      price: 69.9,
      bonus: 1500,
      description: '超值优惠'
    },
    {
      id: 'enterprise',
      name: '企业包',
      tokens: 50000,
      price: 299.9,
      bonus: 10000,
      description: '企业用户首选'
    }
  ];

  const steps = ['选择套餐', '支付方式', '确认支付', '完成'];

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setActiveStep(0);
    setSelectedPackage(null);
    setPaymentMethod('stripe');
    setCustomAmount('');
    setCustomTokens('');
    setError('');
    setPaymentUrl('');
  };

  const handlePackageSelect = (pkg: RechargePackage) => {
    setSelectedPackage(pkg);
    setActiveStep(1);
  };

  const handleCustomRecharge = () => {
    const amount = parseFloat(customAmount);
    const tokens = parseInt(customTokens);
    
    if (!amount || amount < 1) {
      setError('请输入有效的充值金额');
      return;
    }
    
    if (!tokens || tokens < 100) {
      setError('最少充值100个Token');
      return;
    }

    setSelectedPackage({
      id: 'custom',
      name: '自定义',
      tokens,
      price: amount,
      bonus: 0,
      description: '自定义充值'
    });
    setActiveStep(1);
  };

  const handlePayment = async () => {
    if (!selectedPackage) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/payment/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          packageId: selectedPackage.id,
          amount: selectedPackage.price,
          tokens: selectedPackage.tokens,
          bonus: selectedPackage.bonus,
          paymentMethod
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (paymentMethod === 'stripe') {
          const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
          if (stripe) {
            await stripe.redirectToCheckout({ sessionId: data.sessionId });
          }
        } else {
          setPaymentUrl(data.paymentUrl);
          setActiveStep(2);
        }
      } else {
        setError(data.error || '创建支付订单失败');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError('支付系统暂时不可用，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const simulatePaymentSuccess = () => {
    setActiveStep(3);
    if (onRechargeSuccess && selectedPackage) {
      onRechargeSuccess(selectedPackage.tokens + selectedPackage.bonus);
    }
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>选择充值套餐</Typography>
            <Grid container spacing={2}>
              {rechargePackages.map((pkg) => (
                <Grid item xs={12} sm={6} key={pkg.id}>
                  <Card
                    variant={selectedPackage?.id === pkg.id ? "elevation" : "outlined"}
                    sx={{
                      cursor: 'pointer',
                      position: 'relative',
                      border: selectedPackage?.id === pkg.id ? 2 : 1,
                      borderColor: selectedPackage?.id === pkg.id ? 'primary.main' : 'divider',
                      transition: 'all 0.3s',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: 2
                      }
                    }}
                    onClick={() => handlePackageSelect(pkg)}
                  >
                    {pkg.popular && (
                      <Chip
                        label="最受欢迎"
                        color="primary"
                        size="small"
                        sx={{ position: 'absolute', top: 8, right: 8 }}
                      />
                    )}
                    <CardContent>
                      <Typography variant="h6" component="div">
                        {pkg.name}
                      </Typography>
                      <Typography variant="h4" color="primary" sx={{ my: 1 }}>
                        ¥{pkg.price}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {pkg.tokens} Tokens
                      </Typography>
                      {pkg.bonus > 0 && (
                        <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                          +{pkg.bonus} 赠送
                        </Typography>
                      )}
                      <Typography variant="caption" color="textSecondary" sx={{ mt: 1 }}>
                        {pkg.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>自定义充值</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="充值金额 (¥)"
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  inputProps={{ min: 1, step: 0.1 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Token数量"
                  type="number"
                  value={customTokens}
                  onChange={(e) => setCustomTokens(e.target.value)}
                  inputProps={{ min: 100 }}
                />
              </Grid>
            </Grid>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            <Button
              variant="outlined"
              fullWidth
              sx={{ mt: 2 }}
              onClick={handleCustomRecharge}
            >
              自定义充值
            </Button>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>选择支付方式</Typography>
            {selectedPackage && (
              <Card sx={{ mb: 3, bgcolor: 'grey.50' }}>
                <CardContent>
                  <Typography variant="subtitle1">{selectedPackage.name}</Typography>
                  <Typography variant="h4" color="primary">
                    ¥{selectedPackage.price}
                  </Typography>
                  <Typography variant="body2">
                    {selectedPackage.tokens} Tokens
                    {selectedPackage.bonus > 0 && (
                      <span> + {selectedPackage.bonus} 赠送</span>
                    )}
                  </Typography>
                </CardContent>
              </Card>
            )}

            <FormControl component="fieldset" fullWidth>
              <RadioGroup
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <Card variant="outlined" sx={{ mb: 2, cursor: 'pointer' }}>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Radio value="stripe" />
                    <CreditCardIcon color="primary" />
                    <Box>
                      <Typography variant="subtitle1">信用卡/借记卡</Typography>
                      <Typography variant="body2" color="textSecondary">
                        支持Visa、Mastercard等国际信用卡
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ mb: 2, cursor: 'pointer' }}>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Radio value="alipay" />
                    <PaymentsIcon color="primary" />
                    <Box>
                      <Typography variant="subtitle1">支付宝</Typography>
                      <Typography variant="body2" color="textSecondary">
                        扫码支付，即时到账
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ cursor: 'pointer' }}>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Radio value="wechat" />
                    <QrCodeIcon color="primary" />
                    <Box>
                      <Typography variant="subtitle1">微信支付</Typography>
                      <Typography variant="body2" color="textSecondary">
                        扫码支付，安全便捷
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </RadioGroup>
            </FormControl>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>扫码支付</Typography>
            {paymentUrl ? (
              <Box sx={{ textAlign: 'center' }}>
                <Card sx={{ maxWidth: 300, mx: 'auto', p: 2 }}>
                  <CardContent>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      请使用{paymentMethod === 'alipay' ? '支付宝' : '微信'}扫码支付
                    </Typography>
                    <Box
                      sx={{
                        width: 200,
                        height: 200,
                        bgcolor: 'grey.200',
                        mx: 'auto',
                        my: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <QrCodeIcon sx={{ fontSize: 80 }} />
                    </Box>
                    <Typography variant="h6" color="primary">
                      ¥{selectedPackage?.price}
                    </Typography>
                  </CardContent>
                </Card>
                <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                  支付完成后将自动到账，如有问题请联系客服
                </Typography>
                <Button
                  variant="contained"
                  sx={{ mt: 3 }}
                  onClick={simulatePaymentSuccess}
                >
                  模拟支付成功
                </Button>
              </Box>
            ) : (
              <CircularProgress />
            )}
          </Box>
        );

      case 3:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              充值成功！
            </Typography>
            <Typography variant="body1" color="textSecondary">
              您已成功充值 {selectedPackage?.tokens} Tokens
              {selectedPackage?.bonus && (
                <span> + {selectedPackage.bonus} 赠送</span>
              )}
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Token已实时到账，祝您使用愉快！
            </Typography>
          </Box>
        );

      default:
        return null as any;
    }
  };

  return (
    <Box>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">快速充值</Typography>
            <Button
              variant="contained"
              startIcon={<CreditCardIcon />}
              onClick={handleOpen}
            >
              立即充值
            </Button>
          </Box>

          <Grid container spacing={2}>
            {rechargePackages.slice(0, 3).map((pkg) => (
              <Grid item xs={12} sm={4} key={pkg.id}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="subtitle1">{pkg.name}</Typography>
                    <Typography variant="h5" color="primary" sx={{ my: 1 }}>
                      ¥{pkg.price}
                    </Typography>
                    <Typography variant="body2">
                      {pkg.tokens} Tokens
                    </Typography>
                    {pkg.bonus > 0 && (
                      <Chip
                        label={`+${pkg.bonus}赠送`}
                        color="success"
                        size="small"
                        sx={{ mt: 1 }}
                      />
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
            <Typography variant="body2" color="info.dark">
              <LocalOfferIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
              充值说明：购买Token永久有效，支持随时退款未使用部分
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Token充值</DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label, index) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {getStepContent(activeStep)}
        </DialogContent>
        <DialogActions>
          {activeStep > 0 && activeStep < 3 && (
            <Button onClick={() => setActiveStep(activeStep - 1)}>
              上一步
            </Button>
          )}
          {activeStep === 1 && (
            <Button
              variant="contained"
              onClick={handlePayment}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : '确认支付'}
            </Button>
          )}
          {activeStep === 3 && (
            <Button variant="contained" onClick={handleClose}>
              完成
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QuickRecharge;
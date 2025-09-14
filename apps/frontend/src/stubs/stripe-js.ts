// Minimal stub for '@stripe/stripe-js'
export async function loadStripe(_key?: string) {
  return {
    createPaymentMethod: async (_opts: any) => ({ error: null, paymentMethod: { id: 'stub_payment_method' } }),
  } as any
}


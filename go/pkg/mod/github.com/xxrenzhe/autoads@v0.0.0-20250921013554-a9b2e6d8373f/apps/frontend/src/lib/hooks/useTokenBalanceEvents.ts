import { useEffect } from 'react'

export function useTokenBalanceEvents(onUpdate: (payload: { balance: number; consumed?: number }) => void) {
  useEffect(() => {
    let es: EventSource | null = null
    try {
      es = new EventSource('/api/user/tokens/balance/events')
      es.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data)
          if (data?.type === 'balance_updated' && typeof data.balance === 'number') {
            onUpdate({ balance: data.balance, consumed: data.consumed })
          }
        } catch {}
      }
    } catch {}

    return () => {
      try { es?.close() } catch {}
    }
  }, [onUpdate])
}


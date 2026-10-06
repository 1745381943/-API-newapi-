/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Gift, Sparkles, Ticket } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { handleServerError } from '@/lib/handle-server-error'

import {
  drawWheel,
  getUserCoupons,
  getWheelStatus,
  type UserCoupon,
  type WheelStatus,
} from './api'

export function LuckyWheelCard() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<string | null>(null)

  const { data: status, isLoading } = useQuery({
    queryKey: ['lucky-wheel-status'],
    queryFn: async () => {
      const res = await getWheelStatus()
      // 未启用时后端返回 enabled=false 的对象；容错避免 data 为 undefined
      if (res && res.success && res.data) return res.data
      return {
        enabled: false,
        daily_limit: 0,
        draws_today: 0,
        remaining: 0,
        prizes: [],
        coupons: [],
        quota_per_unit: 0,
      } as WheelStatus
    },
    staleTime: 15000,
  })

  const { data: coupons } = useQuery({
    queryKey: ['user-coupons'],
    queryFn: async () => {
      const res = await getUserCoupons()
      return res.data ?? []
    },
    staleTime: 30000,
  })

  const drawMutation = useMutation({
    mutationFn: async () => drawWheel(),
    onSuccess: async (res) => {
      if (!res.success) {
        toast.error(res.message || t('Draw failed'))
        setSpinning(false)
        return
      }
      const data = res.data
      // 旋转动画：额外转 5 圈
      setRotation((r) => r + 1800 + Math.floor(Math.random() * 360))
      setTimeout(() => {
        setSpinning(false)
        if (data) {
          setResult(data.prize_name)
          toast.success(`${t('You got')}: ${data.prize_name}`)
        }
        void qc.invalidateQueries({ queryKey: ['lucky-wheel-status'] })
        void qc.invalidateQueries({ queryKey: ['user-coupons'] })
      }, 1600)
    },
    onError: (e) => {
      setSpinning(false)
      handleServerError(e, t('Draw failed'))
    },
  })

  if (isLoading) {
    return (
      <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
        <div className='p-6'>
          <Skeleton className='h-6 w-40' />
        </div>
      </Card>
    )
  }

  if (!status?.enabled) return null

  const remaining = status.remaining ?? 0
  const canDraw = remaining > 0 || status.daily_limit === 0
  const prizes = status.prizes ?? []

  const handleDraw = () => {
    if (spinning || !canDraw) return
    setSpinning(true)
    setResult(null)
    drawMutation.mutate()
  }

  return (
    <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
      <div className='border-b p-4 sm:p-6'>
        <div className='flex items-start gap-3'>
          <IconBadge tone='neutral' size='lg'>
            <Gift className='h-5 w-5' strokeWidth={2} />
          </IconBadge>
          <div className='min-w-0 flex-1'>
            <h3 className='text-base font-semibold tracking-tight sm:text-lg'>
              {t('Lucky Wheel')}
            </h3>
            <p className='text-muted-foreground mt-1 text-xs sm:text-sm'>
              {t('Daily spins remaining')}:{' '}
              <span className='text-foreground font-medium'>
                {status.daily_limit === 0 ? t('Unlimited') : remaining}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className='flex flex-col items-center gap-4 p-6'>
        {/* 转盘示意 */}
        <div className='relative'>
          <div
            className='grid h-44 w-44 place-items-center rounded-full border-4 border-amber-400/60 bg-gradient-to-br from-amber-100 to-orange-200 shadow-inner transition-transform duration-[1600ms] ease-out dark:from-amber-900/40 dark:to-orange-900/40'
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <div className='grid h-32 w-32 grid-cols-2 gap-1'>
              {prizes.slice(0, 6).map((p, i) => (
                <div
                  key={p.id ?? i}
                  className='flex items-center justify-center rounded-md bg-white/70 px-1 text-center text-[10px] leading-tight font-medium text-amber-900 dark:bg-black/30 dark:text-amber-200'
                >
                  <span className='line-clamp-2'>{p.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className='absolute -top-2 left-1/2 -translate-x-1/2 text-2xl'>
            🔻
          </div>
        </div>

        {result && (
          <div className='text-primary flex items-center gap-1.5 text-sm font-medium'>
            <Sparkles className='h-4 w-4' />
            {t('You got')}: {result}
          </div>
        )}

        <Button onClick={handleDraw} disabled={spinning || !canDraw}>
          {spinning
            ? t('Spinning...')
            : canDraw
              ? t('Spin now')
              : t('No spins left today')}
        </Button>
      </div>

      {coupons && coupons.length > 0 && (
        <div className='border-t p-4 sm:p-6'>
          <div className='mb-2 flex items-center gap-1.5 text-sm font-medium'>
            <Ticket className='h-4 w-4' />
            {t('My Coupons')}
          </div>
          <div className='space-y-2'>
            {coupons.map((c: UserCoupon) => (
              <div
                key={c.id}
                className='flex items-center justify-between rounded-md border px-3 py-2 text-xs'
              >
                <span className='font-medium'>{c.title}</span>
                <span className='text-muted-foreground'>
                  {c.coupon_type === 'discount'
                    ? `${(c.value * 10).toFixed(1)}${t('折')}`
                    : `¥${c.value}`}
                  {c.expire_at > 0
                    ? ` · ${new Date(c.expire_at * 1000).toLocaleDateString()}`
                    : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

export type { WheelStatus }

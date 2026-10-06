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

import { SectionPageLayout } from '@/components/layout'
import { Card } from '@/components/ui/card'
import { handleServerError } from '@/lib/handle-server-error'

import {
  drawWheel,
  getUserCoupons,
  getWheelStatus,
  type UserCoupon,
  type WheelStatus,
} from './api'
import { WheelSvg } from './wheel-svg'

const EMPTY_STATUS: WheelStatus = {
  enabled: false,
  daily_limit: 0,
  draws_today: 0,
  remaining: 0,
  prizes: [],
  coupons: [],
  quota_per_unit: 0,
}

export function LuckyWheelPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<string | null>(null)

  const { data: status, isLoading } = useQuery({
    queryKey: ['lucky-wheel-status'],
    queryFn: async () => {
      const res = await getWheelStatus()
      if (res && res.success && res.data) return res.data
      return EMPTY_STATUS
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
      // 根据中奖奖品的索引计算要转到的角度，让指针停在中奖扇区
      const wonId = res.data?.prize_id
      const idx = prizes.findIndex((p) => p.id === wonId)
      const n = prizes.length || 1
      const anglePer = 360 / n
      // 指针在正上方(0度)；扇区 i 的中心角 = (i+0.5)*anglePer
      // 需要转盘旋转 -中心角 才能让该扇区停在指针下，再加若干整圈
      let target = 0
      if (idx >= 0) {
        const center = (idx + 0.5) * anglePer
        target = 360 - center
      }
      const extra = 1800 + Math.floor(Math.random() * 360) // 5+ 圈
      setRotation((prev) => {
        const base = Math.floor(prev / 360) * 360
        return base + extra + target
      })
      setTimeout(() => {
        setSpinning(false)
        if (res.data) {
          setResult(res.data.prize_name)
          toast.success(`${t('You got')}: ${res.data.prize_name}`)
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

  const current = status ?? EMPTY_STATUS
  const remaining = current.remaining ?? 0
  const canDraw = remaining > 0 || current.daily_limit === 0
  const prizes = current.prizes ?? []
  const myCoupons: UserCoupon[] = coupons ?? []

  const handleDraw = () => {
    if (spinning || !canDraw) return
    setSpinning(true)
    setResult(null)
    drawMutation.mutate()
  }

  if (isLoading) {
    return (
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>{t('Lucky Wheel')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <Card className='p-10 text-center text-sm text-muted-foreground'>
            {t('Loading...')}
          </Card>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  if (!current.enabled) {
    return (
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>{t('Lucky Wheel')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <Card className='flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground'>
            <Gift className='h-8 w-8 opacity-40' />
            {t('Lucky wheel is not enabled')}
          </Card>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>{t('Lucky Wheel')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.6fr)] lg:items-start'>
          <Card className='flex flex-col items-center gap-5 overflow-hidden p-6 sm:p-10'>
            <div className='text-muted-foreground text-sm'>
              {t('Daily spins remaining')}:{' '}
              <span className='text-foreground font-medium'>
                {current.daily_limit === 0 ? t('Unlimited') : remaining}
              </span>
            </div>

            <WheelSvg
              prizes={prizes}
              rotation={rotation}
              spinning={spinning}
              canDraw={canDraw}
              onSpin={handleDraw}
              centerLabel={
                canDraw ? t('Spin now') : t('No spins left today')
              }
            />

            {result && (
              <div className='text-primary flex items-center gap-1.5 text-sm font-medium'>
                <Sparkles className='h-4 w-4' />
                {t('You got')}: {result}
              </div>
            )}
          </Card>

          <Card className='p-4 sm:p-6'>
            <div className='mb-3 flex items-center gap-1.5 text-sm font-medium'>
              <Ticket className='h-4 w-4' />
              {t('My Coupons')}
            </div>
            {myCoupons.length === 0 ? (
              <div className='text-muted-foreground py-6 text-center text-xs'>
                {t('No coupons yet')}
              </div>
            ) : (
              <div className='space-y-2'>
                {myCoupons.map((c) => (
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
            )}
          </Card>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

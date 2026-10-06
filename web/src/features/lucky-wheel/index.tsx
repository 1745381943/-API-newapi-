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
import { Gift, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/dialog'
import { handleServerError } from '@/lib/handle-server-error'

import {
  createPrize,
  deletePrize,
  getPrizes,
  updatePrize,
  type LuckyWheelPrize,
} from './api'
import { PrizeFormBody, type PrizeFormState } from './prize-form'

type FormState = PrizeFormState

const emptyForm: FormState = {
  id: 0,
  name: '',
  prize_type: 'quota',
  quota_amount: 1,
  coupon_type: 'discount',
  coupon_value: 0.9,
  coupon_min_amount: 0,
  coupon_valid_days: 30,
  weight: 100,
  enabled: true,
  sort_order: 0,
}

export function LuckyWheelPrizes() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)

  const { data, isLoading } = useQuery({
    queryKey: ['lucky-wheel-prizes'],
    queryFn: async () => {
      const res = await getPrizes()
      return res.data ?? []
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = { ...f }
      if (f.id > 0) {
        return updatePrize(payload)
      }
      return createPrize(payload)
    },
    onSuccess: async (res) => {
      if (res.success) {
        toast.success(t('Saved successfully'))
        setOpen(false)
        await qc.invalidateQueries({ queryKey: ['lucky-wheel-prizes'] })
      } else {
        toast.error(res.message || t('Save failed'))
      }
    },
    onError: (e) => handleServerError(e, t('Save failed')),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => deletePrize(id),
    onSuccess: async (res) => {
      if (res.success) {
        toast.success(t('Deleted successfully'))
        await qc.invalidateQueries({ queryKey: ['lucky-wheel-prizes'] })
      } else {
        toast.error(res.message || t('Delete failed'))
      }
    },
    onError: (e) => handleServerError(e, t('Delete failed')),
  })

  const prizes: LuckyWheelPrize[] = data ?? []
  const totalWeight = prizes
    .filter((p) => p.enabled && p.weight > 0)
    .reduce((s, p) => s + p.weight, 0)

  const openCreate = () => {
    setForm({ ...emptyForm, sort_order: prizes.length })
    setOpen(true)
  }

  const openEdit = (p: LuckyWheelPrize) => {
    setForm({
      id: p.id,
      name: p.name,
      prize_type: p.prize_type,
      quota_amount: p.quota_amount ?? 0,
      coupon_type: (p.coupon_type || 'discount') as 'discount' | 'threshold',
      coupon_value: p.coupon_value,
      coupon_min_amount: p.coupon_min_amount,
      coupon_valid_days: p.coupon_valid_days,
      weight: p.weight,
      enabled: p.enabled,
      sort_order: p.sort_order,
    })
    setOpen(true)
  }

  const prizeTypeLabel = (p: LuckyWheelPrize) => {
    if (p.prize_type === 'quota') return `${t('Quota')} ¥${p.quota_amount}`
    if (p.prize_type === 'none') return t('Thanks for participating')
    if (p.coupon_type === 'discount') {
      return `${t('Discount')} ${(p.coupon_value * 10).toFixed(1)}${t('折')}`
    }
    return `${t('Threshold')} ¥${p.coupon_value} / ¥${p.coupon_min_amount}`
  }

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>{t('Lucky Wheel')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Dialog
          open={open}
          onOpenChange={setOpen}
          title={form.id > 0 ? t('Edit Prize') : t('Add Prize')}
          contentClassName='sm:max-w-lg'
          bodyClassName='space-y-4'
          trigger={
            <Button size='sm' onClick={openCreate}>
              <Plus className='me-1 h-4 w-4' />
              {t('Add Prize')}
            </Button>
          }
          footer={
            <>
              <Button variant='outline' onClick={() => setOpen(false)}>
                {t('Cancel')}
              </Button>
              <Button
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending}
              >
                {t('Save')}
              </Button>
            </>
          }
        >
          <PrizeFormBody form={form} setForm={setForm} />
        </Dialog>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <Card className='overflow-hidden p-0'>
          <div className='text-muted-foreground flex items-center justify-between border-b px-4 py-3 text-xs'>
            <span>
              {t(
                'Prize probability = weight / total enabled weight. Configure the wheel in System Settings.'
              )}
            </span>
            <span>
              {t('Total weight')}: {totalWeight}
            </span>
          </div>
          {isLoading ? (
            <div className='text-muted-foreground p-8 text-center text-sm'>
              {t('Loading...')}
            </div>
          ) : prizes.length === 0 ? (
            <div className='text-muted-foreground flex flex-col items-center gap-2 p-10 text-center text-sm'>
              <Gift className='h-8 w-8 opacity-40' />
              {t('No prizes yet. Click "Add Prize" to create one.')}
            </div>
          ) : (
            <div className='divide-y'>
              {prizes.map((p) => (
                <div
                  key={p.id}
                  className='flex items-center justify-between gap-3 px-4 py-3'
                >
                  <div className='min-w-0 flex-1'>
                    <div className='flex items-center gap-2'>
                      <span className='truncate font-medium'>{p.name}</span>
                      {!p.enabled && (
                        <Badge variant='secondary'>{t('Disabled')}</Badge>
                      )}
                    </div>
                    <div className='text-muted-foreground mt-0.5 text-xs'>
                      {prizeTypeLabel(p)} · {t('Weight')} {p.weight} ·{' '}
                      {totalWeight > 0
                        ? `${((p.weight / totalWeight) * 100).toFixed(1)}%`
                        : '0%'}
                    </div>
                  </div>
                  <div className='flex shrink-0 items-center gap-1'>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => {
                        if (confirm(t('Delete this prize?'))) {
                          deleteMutation.mutate(p.id)
                        }
                      }}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

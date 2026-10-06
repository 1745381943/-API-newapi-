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
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

export type PrizeFormState = {
  id: number
  name: string
  prize_type: 'quota' | 'coupon' | 'none'
  quota_amount: number
  coupon_type: 'discount' | 'threshold'
  coupon_value: number
  coupon_min_amount: number
  coupon_valid_days: number
  weight: number
  enabled: boolean
  sort_order: number
}

export function PrizeFormBody({
  form,
  setForm,
}: {
  form: PrizeFormState
  setForm: (f: PrizeFormState) => void
}) {
  const { t } = useTranslation()
  const patch = (p: Partial<PrizeFormState>) => setForm({ ...form, ...p })

  return (
    <div className='grid gap-4'>
      <div className='grid gap-1.5'>
        <Label>{t('Prize name')}</Label>
        <Input
          value={form.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder={t('e.g. 1000 quota')}
        />
      </div>

      <div className='grid gap-1.5'>
        <Label>{t('Prize type')}</Label>
        <Select
          value={form.prize_type}
          onValueChange={(v) =>
            patch({ prize_type: v as PrizeFormState['prize_type'] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='quota'>{t('Quota')}</SelectItem>
            <SelectItem value='coupon'>{t('Coupon')}</SelectItem>
            <SelectItem value='none'>
              {t('Thanks for participating')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {form.prize_type === 'quota' && (
        <div className='grid gap-1.5'>
          <Label>{t('Quota amount')} (¥, {t('supports decimals')})</Label>
          <Input
            type='number'
            step='0.01'
            min={0}
            value={form.quota_amount}
            onChange={(e) => patch({ quota_amount: Number(e.target.value) })}
          />
          <p className='text-muted-foreground text-xs'>
            {t('Amount in yuan. Converted to credits automatically.')}
          </p>
        </div>
      )}

      {form.prize_type === 'coupon' && (
        <>
          <div className='grid gap-1.5'>
            <Label>{t('Coupon type')}</Label>
            <Select
              value={form.coupon_type}
              onValueChange={(v) =>
                patch({ coupon_type: v as 'discount' | 'threshold' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='discount'>
                  {t('Discount coupon')}
                </SelectItem>
                <SelectItem value='threshold'>
                  {t('Threshold coupon')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.coupon_type === 'discount' ? (
            <div className='grid gap-1.5'>
              <Label>
                {t('Discount rate')} (0~1, {t('e.g. 0.9 = 10% off')})
              </Label>
              <Input
                type='number'
                step='0.01'
                min={0.01}
                max={0.99}
                value={form.coupon_value}
                onChange={(e) => patch({ coupon_value: Number(e.target.value) })}
              />
            </div>
          ) : (
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='grid gap-1.5'>
                <Label>{t('Reduce amount')} (¥)</Label>
                <Input
                  type='number'
                  step='0.01'
                  value={form.coupon_value}
                  onChange={(e) =>
                    patch({ coupon_value: Number(e.target.value) })
                  }
                />
              </div>
              <div className='grid gap-1.5'>
                <Label>
                  {t('Minimum spend')} (¥, 0 = {t('none')})
                </Label>
                <Input
                  type='number'
                  step='0.01'
                  value={form.coupon_min_amount}
                  onChange={(e) =>
                    patch({ coupon_min_amount: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          )}

          <div className='grid gap-1.5'>
            <Label>
              {t('Valid days')} (0 = {t('never expires')})
            </Label>
            <Input
              type='number'
              value={form.coupon_valid_days}
              onChange={(e) =>
                patch({ coupon_valid_days: Number(e.target.value) })
              }
            />
          </div>
        </>
      )}

      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='grid gap-1.5'>
          <Label>{t('Weight (probability)')}</Label>
          <Input
            type='number'
            min={0}
            value={form.weight}
            onChange={(e) => patch({ weight: Number(e.target.value) })}
          />
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('Sort order')}</Label>
          <Input
            type='number'
            value={form.sort_order}
            onChange={(e) => patch({ sort_order: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className='flex items-center justify-between'>
        <Label>{t('Enabled')}</Label>
        <Switch
          checked={form.enabled}
          onCheckedChange={(v) => patch({ enabled: v })}
        />
      </div>
    </div>
  )
}

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
import { api } from '@/lib/api'

export interface LuckyWheelPrize {
  id: number
  name: string
  prize_type: 'quota' | 'coupon' | 'none'
  quota: number
  quota_amount: number
  coupon_type: 'discount' | 'threshold' | ''
  coupon_value: number
  coupon_min_amount: number
  coupon_valid_days: number
  weight: number
  enabled: boolean
  sort_order: number
  created_at?: number
  updated_at?: number
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data?: T
}

export interface WheelPrizeView {
  id: number
  name: string
  type: string
}

export interface UserCoupon {
  id: number
  coupon_type: 'discount' | 'threshold'
  value: number
  min_amount: number
  title: string
  status: string
  expire_at: number
}

export interface WheelStatus {
  enabled: boolean
  daily_limit: number
  draws_today: number
  remaining: number
  prizes: WheelPrizeView[]
  coupons: UserCoupon[]
  quota_per_unit: number
}

export interface DrawResult {
  prize_id: number
  prize_name: string
  prize_type: string
  quota_awarded: number
  coupon?: UserCoupon
}

// ============================================================================
// User-side wheel APIs
// ============================================================================

export async function getWheelStatus(): Promise<ApiResponse<WheelStatus>> {
  const res = await api.get('/api/user/lucky-wheel')
  return res.data
}

export async function drawWheel(): Promise<ApiResponse<DrawResult>> {
  const res = await api.post('/api/user/lucky-wheel/draw')
  return res.data
}

export async function getUserCoupons(): Promise<ApiResponse<UserCoupon[]>> {
  const res = await api.get('/api/user/coupons')
  return res.data
}

export async function getPrizes(): Promise<ApiResponse<LuckyWheelPrize[]>> {
  const res = await api.get('/api/user/lucky-wheel/prizes')
  return res.data
}

export async function createPrize(
  prize: Partial<LuckyWheelPrize>
): Promise<ApiResponse<LuckyWheelPrize>> {
  const res = await api.post('/api/user/lucky-wheel/prizes', prize)
  return res.data
}

export async function updatePrize(
  prize: Partial<LuckyWheelPrize>
): Promise<ApiResponse<LuckyWheelPrize>> {
  const res = await api.put('/api/user/lucky-wheel/prizes', prize)
  return res.data
}

export async function deletePrize(id: number): Promise<ApiResponse> {
  const res = await api.delete(`/api/user/lucky-wheel/prizes/${id}`)
  return res.data
}

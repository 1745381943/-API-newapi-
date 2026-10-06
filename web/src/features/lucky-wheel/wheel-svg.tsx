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
import { useMemo } from 'react'

import type { WheelPrizeView } from './api'

// 一组明亮、区分度高的扇区颜色
const SECTOR_COLORS = [
  '#3B82F6', // blue
  '#F97316', // orange
  '#10B981', // green
  '#EF4444', // red
  '#8B5CF6', // violet
  '#F59E0B', // amber
  '#06B6D4', // cyan
  '#EC4899', // pink
  '#84CC16', // lime
  '#6366F1', // indigo
  '#14B8A6', // teal
  '#F43F5E', // rose
  '#A855F7', // purple
  '#EAB308', // yellow
]

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function sectorPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
) {
  const start = polar(cx, cy, r, endAngle)
  const end = polar(cx, cy, r, startAngle)
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    'Z',
  ].join(' ')
}

export function WheelSvg({
  prizes,
  rotation,
  spinning,
  canDraw,
  onSpin,
  centerLabel,
}: {
  prizes: WheelPrizeView[]
  rotation: number
  spinning: boolean
  canDraw: boolean
  onSpin: () => void
  centerLabel: string
}) {
  const size = 320
  const cx = size / 2
  const cy = size / 2
  const r = 150

  // 最多展示 12 个扇区
  const items = useMemo(() => prizes.slice(0, 12), [prizes])
  const n = items.length || 1
  const anglePer = 360 / n

  const sectors = items.map((p, i) => {
    const start = i * anglePer
    const end = (i + 1) * anglePer
    const mid = start + anglePer / 2
    const textPos = polar(cx, cy, r * 0.62, mid)
    const color = SECTOR_COLORS[i % SECTOR_COLORS.length]
    return { p, start, end, mid, textPos, color, i }
  })

  return (
    <div className='relative' style={{ width: size, height: size }}>
      {/* 指针 */}
      <div className='pointer-events-none absolute left-1/2 top-[-6px] z-20 -translate-x-1/2'>
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: '14px solid transparent',
            borderRight: '14px solid transparent',
            borderTop: '26px solid #EF4444',
            filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.35))',
          }}
        />
      </div>

      {/* 转盘本体 */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning
            ? 'transform 1.6s cubic-bezier(0.17, 0.67, 0.16, 1)'
            : 'none',
        }}
      >
        <defs>
          <radialGradient id='wheelHub' cx='50%' cy='50%' r='50%'>
            <stop offset='0%' stopColor='#FFF7E6' />
            <stop offset='100%' stopColor='#F5C24B' />
          </radialGradient>
        </defs>

        {/* 外圈金边 */}
        <circle cx={cx} cy={cy} r={r + 8} fill='#F3C24B' />
        <circle cx={cx} cy={cy} r={r + 2} fill='#E0A82E' />

        {/* 扇区 */}
        {sectors.length === 0 ? (
          <circle cx={cx} cy={cy} r={r} fill='#E5E7EB' />
        ) : sectors.length === 1 ? (
          <circle cx={cx} cy={cy} r={r} fill={sectors[0].color} />
        ) : (
          sectors.map((s) => (
            <path
              key={s.p.id ?? s.i}
              d={sectorPath(cx, cy, r, s.start, s.end)}
              fill={s.color}
              stroke='#FFFFFF'
              strokeWidth={1.5}
            />
          ))
        )}

        {/* 扇区文字 */}
        {sectors.map((s) => {
          const chars = (s.p.name || '').slice(0, 6)
          return (
            <text
              key={`t-${s.p.id ?? s.i}`}
              x={s.textPos.x}
              y={s.textPos.y}
              fill='#ffffff'
              fontSize={13}
              fontWeight={600}
              textAnchor='middle'
              dominantBaseline='middle'
              transform={`rotate(${s.mid} ${s.textPos.x} ${s.textPos.y})`}
              style={{ pointerEvents: 'none' }}
            >
              {chars}
            </text>
          )
        })}

        {/* 中心圆盘 */}
        <circle cx={cx} cy={cy} r={52} fill='#FFFFFF' />
        <circle cx={cx} cy={cy} r={48} fill='url(#wheelHub)' />
      </svg>

      {/* 中心按钮（不随转盘旋转） */}
      <button
        type='button'
        onClick={onSpin}
        disabled={spinning || !canDraw}
        className='absolute left-1/2 top-1/2 z-10 grid h-[88px] w-[88px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-center text-sm font-semibold text-amber-900 transition-transform enabled:hover:scale-105 disabled:cursor-not-allowed disabled:opacity-90'
        style={{ background: 'transparent', border: 'none' }}
      >
        <span className='pointer-events-none max-w-[72px] leading-tight'>
          {centerLabel}
        </span>
      </button>
    </div>
  )
}

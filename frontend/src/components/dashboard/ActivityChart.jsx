import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { getMyActivity } from '../../api/progression.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const BRAND = '#243491'
const BRAND_SOFT = 'rgba(36, 52, 145, 0.22)'

const verticalDashedLinePlugin = {
  id: 'verticalDashedLine',
  afterDraw: (chart) => {
    const active = chart.tooltip?.getActiveElements?.() || []
    if (!active.length) return

    const activePoint = active[0]
    const { ctx } = chart
    const x = activePoint.element.x
    const topY = activePoint.element.y
    const bottomY = chart.scales.y.bottom

    ctx.save()
    ctx.beginPath()
    ctx.setLineDash([4, 4])
    ctx.moveTo(x, topY)
    ctx.lineTo(x, bottomY)
    ctx.lineWidth = 1.5
    ctx.strokeStyle = BRAND
    ctx.stroke()
    ctx.restore()
  },
}

function niceYMax(hoursValues) {
  const peak = Math.max(0, ...hoursValues, 0.5)
  if (peak <= 2) return 2
  if (peak <= 4) return 4
  if (peak <= 6) return 6
  if (peak <= 8) return 8
  return Math.ceil(peak / 2) * 2
}

export default function ActivityChart({ className = '' }) {
  const chartRef = useRef(null)
  const [period, setPeriod] = useState('weekly')
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payload, setPayload] = useState(null)
  const [chartData, setChartData] = useState({ labels: [], datasets: [] })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await getMyActivity(period)
        if (!cancelled) setPayload(data)
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.detail || 'Impossible de charger l’activité.')
          setPayload(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [period])

  const days = useMemo(() => payload?.days || [], [payload])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !days.length) {
      setChartData({ labels: [], datasets: [] })
      return
    }

    const ctx = chart.ctx
    const gradient = ctx.createLinearGradient(0, 0, 0, 160)
    gradient.addColorStop(0, BRAND_SOFT)
    gradient.addColorStop(1, 'rgba(36, 52, 145, 0)')

    setChartData({
      labels: days.map((d) => d.label),
      datasets: [
        {
          data: days.map((d) => d.value_heures),
          borderColor: BRAND,
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
          backgroundColor: gradient,
          pointBackgroundColor: BRAND,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBorderWidth: 2,
        },
      ],
    })
  }, [days, loading])

  const yMax = useMemo(
    () => niceYMax(days.map((d) => Number(d.value_heures) || 0)),
    [days]
  )

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 700,
        easing: 'easeOutQuart',
      },
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: BRAND,
          titleFont: { size: 0 },
          bodyFont: { size: 12, weight: '600' },
          bodyColor: '#ffffff',
          padding: { top: 6, bottom: 6, left: 12, right: 12 },
          cornerRadius: 8,
          displayColors: false,
          caretSize: 5,
          caretPadding: 8,
          callbacks: {
            title: () => '',
            label: (context) => days[context.dataIndex]?.display || '0min',
          },
        },
      },
      scales: {
        x: {
          grid: { display: false, drawBorder: false },
          border: { display: false },
          ticks: {
            color: '#94a3b8',
            font: { size: 11, weight: '500' },
            maxRotation: 0,
            autoSkip: period === 'monthly',
            maxTicksLimit: period === 'monthly' ? 10 : 7,
          },
        },
        y: {
          min: 0,
          max: yMax,
          ticks: {
            stepSize: yMax <= 4 ? 1 : 2,
            color: '#94a3b8',
            font: { size: 11, weight: '500' },
            callback: (value) => `${value}h`,
          },
          grid: {
            color: '#f1f5f9',
            borderDash: [4, 4],
          },
          border: { display: false },
        },
      },
    }),
    [days, period, yMax]
  )

  const periodLabel = period === 'weekly' ? 'Cette semaine' : 'Ce mois'

  return (
    <div
      className={`rounded-2xl bg-white p-4 shadow-[0_12px_40px_-16px_rgba(36,52,145,0.18)] sm:p-5 ${className}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Activité</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Temps passé en apprentissage
            {payload?.total_display ? (
              <>
                {' · '}
                <span className="font-semibold text-brand">{payload.total_display}</span>
              </>
            ) : null}
          </p>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-slate-200 hover:text-slate-700"
          >
            <span>{periodLabel}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-10 mt-1.5 w-40 overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-lg">
              {[
                { id: 'weekly', label: 'Cette semaine' },
                { id: 'monthly', label: 'Ce mois' },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setPeriod(option.id)
                    setMenuOpen(false)
                  }}
                  className={`block w-full px-3 py-2 text-left text-xs font-semibold transition ${
                    period === option.id
                      ? 'bg-brand-light text-brand'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="relative h-36 w-full sm:h-40">
        {loading ? (
          <div className="flex h-full items-center justify-center text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-red-500">
            {error}
          </div>
        ) : (
          <Line
            ref={chartRef}
            data={chartData}
            options={options}
            plugins={[verticalDashedLinePlugin]}
          />
        )}
      </div>
    </div>
  )
}

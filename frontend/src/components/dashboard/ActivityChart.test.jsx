import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ActivityChart from './ActivityChart'

vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  Tooltip: {},
  Filler: {},
}))

vi.mock('react-chartjs-2', () => ({
  Line: () => <div role="img" aria-label="Graphique d’activité" />,
}))

vi.mock('../../api/progression.js', () => ({
  getMyActivity: vi.fn(),
}))

import { getMyActivity } from '../../api/progression.js'

describe('ActivityChart', () => {
  beforeEach(() => {
    getMyActivity.mockReset()
  })

  it('affiche un chargement puis le total d’activité', async () => {
    getMyActivity.mockResolvedValue({
      total_display: '2h 15min',
      days: [{ label: 'Lun', value_heures: 1.5, display: '1h 30min' }],
    })

    render(<ActivityChart />)

    expect(screen.getByText('Activité')).toBeInTheDocument()
    expect(screen.getByText('Temps passé en apprentissage')).toBeInTheDocument()

    expect(await screen.findByText('2h 15min')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Graphique d’activité' })).toBeInTheDocument()
    expect(getMyActivity).toHaveBeenCalledWith('weekly')
  })

  it('affiche une erreur si le chargement échoue', async () => {
    getMyActivity.mockRejectedValue({
      response: { data: { detail: 'Service indisponible' } },
    })

    render(<ActivityChart />)

    expect(await screen.findByText('Service indisponible')).toBeInTheDocument()
  })

  it('permet de basculer sur la période mensuelle', async () => {
    getMyActivity.mockImplementation(async (period) => ({
      total_display: period === 'monthly' ? '8h' : '2h',
      days: [],
    }))
    const user = userEvent.setup()

    render(<ActivityChart />)
    expect(await screen.findByText('2h')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Cette semaine/i }))
    await user.click(screen.getByRole('button', { name: 'Ce mois' }))

    await waitFor(() => {
      expect(getMyActivity).toHaveBeenCalledWith('monthly')
    })
    expect(await screen.findByText('8h')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ce mois/i })).toBeInTheDocument()
  })
})

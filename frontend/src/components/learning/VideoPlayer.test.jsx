import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import VideoPlayer from './VideoPlayer'

describe('VideoPlayer', () => {
  it('affiche un message si aucune source n’est fournie', () => {
    render(<VideoPlayer src="" />)
    expect(
      screen.getByText('Aucune vidéo disponible pour cette leçon.'),
    ).toBeInTheDocument()
  })

  it('affiche le lecteur et le temps initial', () => {
    render(<VideoPlayer src="/media/lesson.mp4" autoPlay={false} />)

    expect(document.querySelector('video')).toHaveAttribute('src', '/media/lesson.mp4')
    expect(screen.getByText('0:00 / 0:00')).toBeInTheDocument()
    expect(screen.getByLabelText('Play/Pause')).toBeInTheDocument()
  })

  it('lance la lecture au clic sur play', async () => {
    const user = userEvent.setup()
    render(<VideoPlayer src="/media/lesson.mp4" autoPlay={false} />)

    const video = document.querySelector('video')
    await user.click(screen.getByLabelText('Play/Pause'))
    expect(video.play).toHaveBeenCalled()
  })

  it('cycle la vitesse de lecture', async () => {
    const user = userEvent.setup()
    render(<VideoPlayer src="/media/lesson.mp4" autoPlay={false} />)

    const rateButton = screen.getByRole('button', { name: '1x' })
    await user.click(rateButton)
    expect(screen.getByRole('button', { name: '1.25x' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '1.25x' }))
    expect(screen.getByRole('button', { name: '1.5x' })).toBeInTheDocument()
  })

  it('signale la fin de la vidéo', () => {
    const onEnded = vi.fn()
    render(<VideoPlayer src="/media/lesson.mp4" autoPlay={false} onEnded={onEnded} />)

    const video = document.querySelector('video')
    video.dispatchEvent(new Event('ended'))
    expect(onEnded).toHaveBeenCalledTimes(1)
  })
})

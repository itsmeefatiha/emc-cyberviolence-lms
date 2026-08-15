import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DocumentViewer from './DocumentViewer'

describe('DocumentViewer', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['%PDF'], { type: 'application/pdf' }),
      }),
    )
    URL.createObjectURL = vi.fn(() => 'blob:pdf-preview')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('indique l’absence de fichier', () => {
    render(<DocumentViewer src="" title="Guide" />)
    expect(screen.getByText('Aucun fichier document attaché.')).toBeInTheDocument()
  })

  it('propose un téléchargement pour un format non PDF', () => {
    render(
      <DocumentViewer
        src="/media/notes.docx"
        title="Notes de cours"
        format="DOCX"
      />,
    )

    expect(screen.getByText('Notes de cours')).toBeInTheDocument()
    expect(
      screen.getByText(/Aperçu intégré non disponible pour le format DOCX/),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Télécharger \/ Ouvrir/i })).toHaveAttribute(
      'href',
      '/media/notes.docx',
    )
  })

  it('affiche l’aperçu PDF une fois chargé', async () => {
    render(
      <DocumentViewer src="/media/guide.pdf" title="Guide pédagogique" format="PDF" />,
    )

    expect(screen.getByText(/Chargement du document/)).toBeInTheDocument()
    expect(await screen.findByTitle('Guide pédagogique')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ouvrir dans un nouvel onglet/i })).toHaveAttribute(
      'href',
      '/media/guide.pdf',
    )
  })

  it('affiche une erreur et un lien si le PDF ne peut pas être chargé', async () => {
    fetch.mockRejectedValue(new Error('network'))

    render(<DocumentViewer src="/media/guide.pdf" title="Guide" format="PDF" />)

    expect(
      await screen.findByText('Impossible de charger le document. Utilisez le lien ci-dessous.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ouvrir le PDF/i })).toHaveAttribute(
      'href',
      '/media/guide.pdf',
    )
  })

  it('tente une URL de repli si le premier fetch échoue', async () => {
    fetch
      .mockRejectedValueOnce(new Error('proxy'))
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['%PDF'], { type: 'application/pdf' }),
      })

    render(<DocumentViewer src="/media/guide.pdf" title="Guide" format="PDF" />)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByTitle('Guide')).toBeInTheDocument()
  })
})

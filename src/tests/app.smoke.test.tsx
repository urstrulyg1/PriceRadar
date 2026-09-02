/**
 * Smoke test — the production app shell renders without any preloaded data
 * and shows honest empty states (never fabricated content).
 */

import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import App from '../App'

beforeAll(() => {
  localStorage.clear()
})

afterAll(() => {
  vi.restoreAllMocks()
})

describe('App shell', () => {
  it('renders the workspace with zero preloaded shopping data', async () => {
    const { container } = render(<App />)

    // Honest hero copy
    expect(screen.getByText(/Nothing invented/i)).toBeTruthy()

    // Navigation reflects the real architecture
    expect(screen.getByText('Data sources')).toBeTruthy()
    expect(screen.getByText('Compare prices')).toBeTruthy()

    // No offer cards may exist before any search
    await waitFor(() => {
      expect(container.querySelectorAll('.offer-card').length).toBe(0)
    })

    // No fabricated product names from the old static catalog
    const text = container.textContent ?? ''
    for (const banned of ['iPhone 16', 'AirPods', 'Amul Taaza Toned Fresh Milk', 'Koramangala']) {
      expect(text.includes(banned), `app renders fabricated content: ${banned}`).toBe(false)
    }

    // The honest pre-search state is visible
    expect(screen.getByText(/Start with a real search/i)).toBeTruthy()
  })

  it('shows the source board with pending integrations, never claiming them', async () => {
    render(<App />)
    fireEvent.click(screen.getByText('Data sources'))

    await waitFor(() => {
      // Pending stores are listed transparently as not integrated
      expect(screen.getByText('Blinkit')).toBeTruthy()
      expect(screen.getByText('Zepto')).toBeTruthy()
    })
    // Keyless open sources are listed with honest status
    expect(screen.getByText('Open Prices')).toBeTruthy()
    expect(screen.getByText('UPCitemDB')).toBeTruthy()
    // Policy card states the no-fabrication guarantee
    expect(screen.getByText(/No fabricated data/i)).toBeTruthy()
  })
})

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommuteImpact from '../components/CommuteImpact/CommuteImpact';
import { useCommuteImpact } from '../hooks/useCommuteImpact';

vi.mock('../hooks/useCommuteImpact', () => ({
  useCommuteImpact: vi.fn(),
}));

describe('CommuteImpact', () => {
  it('shows setup prompt when no profile', async () => {
    useCommuteImpact.mockReturnValue({ impact: null, loading: false });
    const onSetupTrip = vi.fn();

    render(<CommuteImpact profile={null} onSetupTrip={onSetupTrip} />);

    expect(screen.getByText(/Add your usual trip/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Set up trip/i }));
    expect(onSetupTrip).toHaveBeenCalledTimes(1);
  });

  it('renders impact headline and metrics', () => {
    useCommuteImpact.mockReturnValue({
      loading: false,
      impact: {
        headline: 'Your Frankston commute is currently risky. Leave 14 minutes earlier.',
        status: 'risky',
        recommendation: { confidence: 0.72, action: 'leave_early' },
        risk: { score: 67 },
        dataHealth: { status: 'live', ageSeconds: 12 },
      },
    });

    render(<CommuteImpact profile={{ lineId: 'frankston' }} onSetupTrip={() => {}} />);

    expect(screen.getByText(/currently risky/i)).toBeInTheDocument();
    expect(screen.getByText(/Risk: 67/)).toBeInTheDocument();
    expect(screen.getByText(/Confidence: 72%/)).toBeInTheDocument();
  });
});

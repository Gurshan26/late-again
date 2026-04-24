import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DayTimeline from '../components/Timeline/DayTimeline';

const mockProfile = Array.from({ length: 24 }, (_, i) => ({ hour: i, risk: i * 3 }));

describe('DayTimeline', () => {
  it('renders 24 cells', () => {
    render(<DayTimeline profile={mockProfile} />);
    const cells = screen.getAllByRole('img');
    expect(cells.length).toBe(24);
  });

  it('renders nothing when profile is null', () => {
    const { container } = render(<DayTimeline profile={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows ! marker for high-risk hours', () => {
    render(<DayTimeline profile={mockProfile} />);
    expect(screen.getAllByText('!').length).toBeGreaterThan(0);
  });
});

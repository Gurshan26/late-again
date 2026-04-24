import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import LineCard from '../components/Dashboard/LineCard';
import { useDelayData } from '../hooks/useDelayData';

vi.mock('../hooks/useDelayData', () => ({
  useDelayData: vi.fn(),
}));

const mockLine = {
  id: 'frankston',
  name: 'Frankston',
  colour: '#009B77',
  group: 'Frankston',
};

describe('LineCard', () => {
  beforeEach(() => {
    useDelayData.mockReturnValue({
      data: { currentRisk: 60, hasAlert: false, activeDelayCount: 0, profile24h: null },
      loading: false,
      error: null,
    });
  });

  it('renders line name', () => {
    render(<LineCard line={mockLine} isSelected={false} onClick={() => {}} />);
    expect(screen.getByText('Frankston')).toBeInTheDocument();
  });

  it('renders group name', () => {
    render(<LineCard line={mockLine} isSelected={false} onClick={() => {}} />);
    expect(screen.getByText('Frankston Group')).toBeInTheDocument();
  });

  it('shows MODERATE label for risk 60', () => {
    render(<LineCard line={mockLine} isSelected={false} onClick={() => {}} />);
    expect(screen.getByText('MODERATE')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const handler = vi.fn();
    render(<LineCard line={mockLine} isSelected={false} onClick={handler} />);
    screen.getByRole('button').click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('shows ALERT badge when hasAlert is true', () => {
    useDelayData.mockReturnValue({
      data: { currentRisk: 70, hasAlert: true, activeDelayCount: 2, profile24h: null },
      loading: false,
      error: null,
    });

    render(<LineCard line={mockLine} isSelected={false} onClick={() => {}} />);
    expect(screen.getByText(/ALERT/)).toBeInTheDocument();
  });
});

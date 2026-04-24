import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RiskBreakdown from '../components/RiskBreakdown/RiskBreakdown';

describe('RiskBreakdown', () => {
  it('renders empty state without explanation', () => {
    render(<RiskBreakdown explanation={null} />);
    expect(screen.getByText(/Select a line to view factor breakdown/)).toBeInTheDocument();
  });

  it('renders factor rows and total', () => {
    const explanation = {
      total: 67,
      label: 'HIGH RISK',
      breakdown: [
        { factor: 'Peak hour baseline', points: 23, explanation: 'Baseline risk higher during peak.' },
        { factor: 'Live delays', points: 12, explanation: 'Active delays detected.' },
      ],
    };

    render(<RiskBreakdown explanation={explanation} />);

    expect(screen.getByText(/67 · HIGH RISK/)).toBeInTheDocument();
    expect(screen.getByText('Peak hour baseline')).toBeInTheDocument();
    expect(screen.getByText('Live delays')).toBeInTheDocument();
  });
});

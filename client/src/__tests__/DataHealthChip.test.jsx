import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DataHealthChip from '../components/DataHealthChip/DataHealthChip';

describe('DataHealthChip', () => {
  it('renders live status and age', () => {
    render(<DataHealthChip health={{ status: 'live', ageSeconds: 18, message: 'ok' }} />);
    expect(screen.getByText(/PTV FEED:/)).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByText(/18s ago/)).toBeInTheDocument();
  });

  it('renders unknown when health is missing', () => {
    render(<DataHealthChip health={null} />);
    expect(screen.getByText('UNKNOWN')).toBeInTheDocument();
  });
});

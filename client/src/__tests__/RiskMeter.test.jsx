import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RiskMeter from '../components/Dashboard/RiskMeter';

describe('RiskMeter', () => {
  it('renders a canvas with aria label', () => {
    render(<RiskMeter score={42} size={80} />);
    expect(screen.getByLabelText('Risk score: 42')).toBeInTheDocument();
  });

  it('renders safely with null score', () => {
    render(<RiskMeter score={null} size={80} />);
    expect(screen.getByLabelText('Risk score: null')).toBeInTheDocument();
  });
});

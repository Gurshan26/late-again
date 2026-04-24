import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NearMissBanner from '../components/NearMissBanner/NearMissBanner';

describe('NearMissBanner', () => {
  it('does not render when near miss is false', () => {
    const { container } = render(<NearMissBanner nearMiss={{ isNearMiss: false, reasons: [] }} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders banner and reasons when near miss is true', () => {
    render(
      <NearMissBanner
        nearMiss={{
          isNearMiss: true,
          message: 'Frankston line risk is rising quickly. Monitor before leaving.',
          reasons: ['Risk increased by 24 points in the last 15 minutes.'],
        }}
      />,
    );

    expect(screen.getByText('EARLY WARNING')).toBeInTheDocument();
    expect(screen.getByText(/risk is rising quickly/)).toBeInTheDocument();
    expect(screen.getByText(/Risk increased by 24 points/)).toBeInTheDocument();
  });
});

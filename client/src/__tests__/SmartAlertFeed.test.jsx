import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SmartAlertFeed from '../components/SmartAlertFeed/SmartAlertFeed';
import { useAlerts } from '../hooks/useAlerts';

vi.mock('../hooks/useAlerts', () => ({
  useAlerts: vi.fn(),
}));

describe('SmartAlertFeed', () => {
  it('hides minor facility alerts by default', () => {
    useAlerts.mockReturnValue({
      loading: false,
      alerts: {
        alerts: [
          {
            id: '1',
            severity: 'minor',
            severityScore: 25,
            category: 'station_facility',
            planned: false,
            facilityOnly: true,
            mode: 'metro',
            header: 'Car park closure',
            description: 'Closure',
            plainEnglish: 'Car park closure',
            routes: ['5'],
            activePeriod: [],
          },
        ],
      },
    });

    render(<SmartAlertFeed profile={null} />);
    expect(screen.getByText(/No relevant alerts/)).toBeInTheDocument();
  });

  it('shows my trip badge for matching route and supports critical filter', async () => {
    useAlerts.mockReturnValue({
      loading: false,
      alerts: {
        alerts: [
          {
            id: 'critical-1',
            severity: 'critical',
            severityScore: 100,
            category: 'delay',
            planned: false,
            facilityOnly: false,
            mode: 'metro',
            header: 'No trains running',
            description: 'Suspended',
            plainEnglish: 'No trains running',
            routes: ['5'],
            activePeriod: [],
          },
          {
            id: 'moderate-1',
            severity: 'moderate',
            severityScore: 55,
            category: 'delay',
            planned: false,
            facilityOnly: false,
            mode: 'metro',
            header: 'Delays',
            description: 'Allow extra time',
            plainEnglish: 'Allow extra time',
            routes: ['2'],
            activePeriod: [],
          },
        ],
      },
    });

    render(<SmartAlertFeed profile={{ lineId: 'frankston' }} />);

    expect(screen.getByText('MY TRIP')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Critical only/i }));
    expect(screen.getAllByText(/No trains running/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Delays$/)).not.toBeInTheDocument();
  });
});

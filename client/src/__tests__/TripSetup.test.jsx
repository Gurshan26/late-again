import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TripSetup from '../components/TripSetup/TripSetup';

function mockFetchImplementation() {
  global.fetch = vi.fn(async (url) => {
    const text = String(url);

    if (text.includes('/api/planner/stations')) {
      const q = new URL(text).searchParams.get('query') || '';
      if (/frank/i.test(q)) {
        return {
          ok: true,
          json: async () => ({
            stations: [
              { id: 'vic:rail:FKN', name: 'Frankston Station', lat: -38.1, lon: 145.1, modes: ['metro'] },
            ],
          }),
        };
      }
      if (/flinders/i.test(q)) {
        return {
          ok: true,
          json: async () => ({
            stations: [
              { id: 'vic:rail:FS', name: 'Flinders Street Station', lat: -37.8, lon: 144.9, modes: ['metro'] },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({ stations: [] }) };
    }

    if (text.includes('/api/planner/options')) {
      return {
        ok: true,
        json: async () => ({
          options: [
            {
              id: 'opt-1',
              departureTime: '2026-04-24T08:12',
              arrivalTime: '2026-04-24T09:00',
              durationMinutes: 48,
              transferCount: 0,
              walkMinutes: 2,
              primaryLineId: 'frankston',
              riskScore: 44,
              riskLabel: 'MINOR RISK',
              score: 53.1,
              legs: [],
              recommendation: {
                title: 'Leave 10 minutes earlier',
                action: 'leave_early',
              },
            },
          ],
          partialSearch: false,
          emptyReason: null,
        }),
      };
    }

    return { ok: false, json: async () => ({}) };
  });
}

describe('TripSetup', () => {
  beforeEach(() => {
    mockFetchImplementation();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders collapsed saved summary with station objects', () => {
    render(
      <TripSetup
        profile={{
          name: 'Morning commute',
          origin: { id: 'vic:rail:FKN', name: 'Frankston Station' },
          destination: { id: 'vic:rail:FS', name: 'Flinders Street Station' },
          selectedOptionSummary: '08:12 → 09:00 (48m, 0 transfers)',
        }}
        saveProfile={() => {}}
        clearProfile={() => {}}
        expanded={false}
        onToggle={() => {}}
      />,
    );

    expect(screen.getByText(/Morning commute:/)).toBeInTheDocument();
    expect(screen.getByText(/Option:/)).toBeInTheDocument();
  });

  it('blocks route search until valid station suggestions are selected', async () => {
    render(
      <TripSetup
        profile={null}
        saveProfile={() => {}}
        clearProfile={() => {}}
        expanded
        onToggle={() => {}}
      />,
    );

    await userEvent.type(screen.getByLabelText(/Origin station/i), 'not real');
    await userEvent.type(screen.getByLabelText(/Destination station/i), 'still fake');

    const findButton = screen.getByRole('button', { name: /Find routes/i });
    expect(findButton).toBeDisabled();
  });

  it('finds routes and saves selected journey option', async () => {
    const saveProfile = vi.fn();
    const onToggle = vi.fn();

    render(
      <TripSetup
        profile={null}
        saveProfile={saveProfile}
        clearProfile={() => {}}
        expanded
        onToggle={onToggle}
      />,
    );

    await userEvent.clear(screen.getByLabelText(/Trip name/i));
    await userEvent.type(screen.getByLabelText(/Trip name/i), 'Office run');

    const originInput = screen.getByLabelText(/Origin station/i);
    await userEvent.type(originInput, 'Frank');
    const originSuggestion = await screen.findByRole('button', { name: /Frankston Station/i });
    await userEvent.click(originSuggestion);

    const destinationInput = screen.getByLabelText(/Destination station/i);
    await userEvent.type(destinationInput, 'Flinders');
    const destinationSuggestion = await screen.findByRole('button', { name: /Flinders Street Station/i });
    await userEvent.click(destinationSuggestion);

    const findButton = screen.getByRole('button', { name: /Find routes/i });
    expect(findButton).not.toBeDisabled();
    await userEvent.click(findButton);

    await screen.findByText(/Route options/i);
    await userEvent.click(screen.getByRole('button', { name: /Use this option/i }));

    await waitFor(() => expect(saveProfile).toHaveBeenCalledTimes(1));
    expect(saveProfile.mock.calls[0][0]).toMatchObject({
      name: 'Office run',
      origin: { id: 'vic:rail:FKN', name: 'Frankston Station' },
      destination: { id: 'vic:rail:FS', name: 'Flinders Street Station' },
      selectedOptionId: 'opt-1',
      primaryLineId: 'frankston',
    });
    expect(onToggle).toHaveBeenCalledWith(false);

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/planner/options'));
  });
});

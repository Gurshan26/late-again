import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TripSetup from '../components/TripSetup/TripSetup';

describe('TripSetup', () => {
  it('renders collapsed summary for saved profile', () => {
    render(
      <TripSetup
        profile={{ name: 'Morning commute', origin: 'Frankston', destination: 'Flinders Street' }}
        saveProfile={() => {}}
        clearProfile={() => {}}
        expanded={false}
        onToggle={() => {}}
      />, 
    );

    expect(screen.getByText(/Morning commute: Frankston/)).toBeInTheDocument();
  });

  it('submits form and saves profile', async () => {
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
    await userEvent.type(screen.getByLabelText(/Origin station/i), 'Frankston');
    await userEvent.type(screen.getByLabelText(/Destination station/i), 'Flinders Street');

    await userEvent.click(screen.getByRole('button', { name: /Save trip/i }));

    expect(saveProfile).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(false);
  });
});

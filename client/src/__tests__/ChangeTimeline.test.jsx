import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChangeTimeline from '../components/ChangeTimeline/ChangeTimeline';

describe('ChangeTimeline', () => {
  it('shows empty message without line', () => {
    render(<ChangeTimeline lineId={null} snapshot={null} />);
    expect(screen.getByText(/Select a line to view change history/)).toBeInTheDocument();
  });

  it('records and displays changes for snapshots', () => {
    const lineId = 'frankston';

    const first = {
      timestamp: '2026-04-24T00:00:00.000Z',
      lineId,
      risk: 40,
      activeDelayCount: 1,
      maxSeverity: 'moderate',
      dataHealthStatus: 'live',
    };

    const second = {
      timestamp: '2026-04-24T00:10:00.000Z',
      lineId,
      risk: 62,
      activeDelayCount: 3,
      maxSeverity: 'major',
      dataHealthStatus: 'live',
    };

    const { rerender } = render(<ChangeTimeline lineId={lineId} snapshot={first} />);
    rerender(<ChangeTimeline lineId={lineId} snapshot={second} />);

    expect(screen.getByText(/Risk rose from 40 to 62/)).toBeInTheDocument();
    expect(screen.getByText(/Major alert detected/)).toBeInTheDocument();
  });
});

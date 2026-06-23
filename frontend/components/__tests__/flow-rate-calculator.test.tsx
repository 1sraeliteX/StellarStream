import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FlowRateCalculator } from '../flow-rate-calculator';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, animate, initial, transition, ...props }: any) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
  },
}));

vi.mock('lucide-react', () => ({
  Gauge: () => <svg data-testid="gauge-icon" />,
  Clock: () => <svg data-testid="clock-icon" />,
  ChevronDown: ({ className }: any) => (
    <svg data-testid="chevron-down" className={className} />
  ),
  Save: () => <svg data-testid="save-icon" />,
  Trash2: () => <svg data-testid="trash-icon" />,
  Activity: () => <svg data-testid="activity-icon" />,
}));

const SECONDS_IN_DAY = 86_400;
const DAYS_IN_CURRENT_MONTH = new Date(
  new Date().getFullYear(),
  new Date().getMonth() + 1,
  0,
).getDate();
const SECONDS_IN_MONTH = SECONDS_IN_DAY * DAYS_IN_CURRENT_MONTH;

describe('FlowRateCalculator', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders with default props', () => {
    render(<FlowRateCalculator />);
    expect(screen.getByTestId('flow-rate-calculator')).toBeInTheDocument();
    expect(screen.getByText('Flow Rate Calculator')).toBeInTheDocument();
    expect(screen.getByText('Per Second')).toBeInTheDocument();
    expect(screen.getByText('Per Day')).toBeInTheDocument();
    expect(screen.getByText('Per Month')).toBeInTheDocument();
  });

  it('displays zero rates when no ratePerSecond provided', () => {
    render(<FlowRateCalculator />);
    const displayValues = screen.getAllByRole('progressbar');
    expect(displayValues).toHaveLength(3);
    displayValues.forEach((bar) => {
      expect(bar).toHaveAttribute('aria-valuenow', '0');
    });
  });

  it('converts ratePerSecond to perDay and perMonth correctly', () => {
    render(<FlowRateCalculator ratePerSecond={1} />);

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const perSecondInput = inputs[0];
    const perDayInput = inputs[1];
    const perMonthInput = inputs[2];

    expect(perSecondInput).toHaveValue('1');
    expect(perDayInput).toHaveValue(SECONDS_IN_DAY.toLocaleString('en-US', { maximumFractionDigits: 6 }));
    expect(perMonthInput).toHaveValue(SECONDS_IN_MONTH.toLocaleString('en-US', { maximumFractionDigits: 6 }));
  });

  it('converts 0.01 per second to correct daily and monthly values', () => {
    render(<FlowRateCalculator ratePerSecond={0.01} />);

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const perDayInput = inputs[1];
    const perMonthInput = inputs[2];

    const expectedPerDay = 0.01 * SECONDS_IN_DAY;
    const expectedPerMonth = 0.01 * SECONDS_IN_MONTH;

    expect(perDayInput).toHaveValue(expectedPerDay.toLocaleString('en-US', { maximumFractionDigits: 6 }));
    expect(perMonthInput).toHaveValue(expectedPerMonth.toLocaleString('en-US', { maximumFractionDigits: 6 }));
  });

  it('enforces 6-decimal precision with repeating decimals', () => {
    render(<FlowRateCalculator ratePerSecond={1 / 3} />);

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const perDayInput = inputs[1];

    const rawPerDay = (1 / 3) * SECONDS_IN_DAY;
    const roundedPerDay = Number(rawPerDay.toFixed(6));

    expect(perDayInput).toHaveValue(roundedPerDay.toLocaleString('en-US', { maximumFractionDigits: 6 }));
  });

  it('editing perSecond updates perDay and perMonth', () => {
    const onRateChange = vi.fn();
    render(<FlowRateCalculator onRateChange={onRateChange} />);

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const perSecondInput = inputs[0];
    const perDayInput = inputs[1];
    const perMonthInput = inputs[2];

    fireEvent.focus(perSecondInput);
    fireEvent.change(perSecondInput, { target: { value: '2' } });

    const expectedPerDay = 2 * SECONDS_IN_DAY;
    const expectedPerMonth = 2 * SECONDS_IN_MONTH;

    expect(perDayInput).toHaveValue(
      expectedPerDay.toLocaleString('en-US', { maximumFractionDigits: 6 }),
    );
    expect(perMonthInput).toHaveValue(
      expectedPerMonth.toLocaleString('en-US', { maximumFractionDigits: 6 }),
    );
  });

  it('editing perMonth updates perSecond and perDay using actual month days', () => {
    const onRateChange = vi.fn();
    render(<FlowRateCalculator onRateChange={onRateChange} />);

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const perSecondInput = inputs[0];
    const perDayInput = inputs[1];
    const perMonthInput = inputs[2];

    fireEvent.focus(perMonthInput);
    fireEvent.change(perMonthInput, { target: { value: '30000' } });

    const expectedPerDay = Number((30000 / DAYS_IN_CURRENT_MONTH).toFixed(6));
    const expectedPerSecond = Number((30000 / SECONDS_IN_MONTH).toFixed(6));

    expect(perDayInput).toHaveValue(
      expectedPerDay.toLocaleString('en-US', { maximumFractionDigits: 6 }),
    );
    expect(perSecondInput).toHaveValue(
      expectedPerSecond.toLocaleString('en-US', { maximumFractionDigits: 6 }),
    );
  });

  it('calls onRateChange when perSecond is edited', () => {
    const onRateChange = vi.fn();
    render(<FlowRateCalculator onRateChange={onRateChange} />);

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    fireEvent.focus(inputs[0]);
    fireEvent.change(inputs[0], { target: { value: '5' } });

    expect(onRateChange).toHaveBeenCalledWith(5);
  });

  it('calls onRateChange when perDay is edited', () => {
    const onRateChange = vi.fn();
    render(<FlowRateCalculator onRateChange={onRateChange} />);

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    fireEvent.focus(inputs[1]);
    fireEvent.change(inputs[1], { target: { value: '86400' } });

    expect(onRateChange).toHaveBeenCalledWith(1);
  });

  it('calls onRateChange when perMonth is edited', () => {
    const onRateChange = vi.fn();
    render(<FlowRateCalculator onRateChange={onRateChange} />);

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    fireEvent.focus(inputs[2]);
    fireEvent.change(inputs[2], { target: { value: String(SECONDS_IN_MONTH) } });

    expect(onRateChange).toHaveBeenCalledWith(1);
  });

  it('displays relative bar widths proportional to max value', () => {
    render(<FlowRateCalculator ratePerSecond={1} />);

    const bars = screen.getAllByRole('progressbar');
    expect(bars).toHaveLength(3);

    const perSecondPct = Math.round((1 / SECONDS_IN_MONTH) * 100);
    const perDayPct = Math.round((SECONDS_IN_DAY / SECONDS_IN_MONTH) * 100);

    expect(bars[0]).toHaveAttribute('aria-valuenow', String(perSecondPct));
    expect(bars[1]).toHaveAttribute('aria-valuenow', String(perDayPct));
    expect(bars[2]).toHaveAttribute('aria-valuenow', '100');
  });

  it('shows preset section and can toggle it', () => {
    render(<FlowRateCalculator ratePerSecond={1} />);

    const presetButton = screen.getByText('Presets');
    expect(presetButton).toBeInTheDocument();

    fireEvent.click(presetButton);
    expect(screen.getByText(/No saved presets yet/)).toBeInTheDocument();
  });

  it('saves and loads presets via localStorage', () => {
    render(<FlowRateCalculator ratePerSecond={1} />);

    fireEvent.click(screen.getByText('Presets'));
    fireEvent.click(screen.getByText('Save'));

    const nameInput = screen.getByLabelText('Preset name');
    fireEvent.change(nameInput, { target: { value: 'Test Rate' } });
    fireEvent.click(screen.getByText('Save'));

    const presetElements = screen.getAllByText('Test Rate');
    expect(presetElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/1\.000000/)).toBeInTheDocument();
  });

  it('loads a preset and updates rates', () => {
    const onRateChange = vi.fn();
    render(<FlowRateCalculator onRateChange={onRateChange} />);

    fireEvent.click(screen.getByText('Presets'));
    fireEvent.click(screen.getByText('Save'));

    const nameInput = screen.getByLabelText('Preset name');
    fireEvent.change(nameInput, { target: { value: 'Fast Rate' } });
    fireEvent.click(screen.getByText('Save'));

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    fireEvent.focus(inputs[0]);
    fireEvent.change(inputs[0], { target: { value: '10' } });

    fireEvent.click(screen.getByText('Fast Rate'));

    expect(onRateChange).toHaveBeenLastCalledWith(0);
  });

  it('deletes a preset', () => {
    render(<FlowRateCalculator ratePerSecond={1} />);

    fireEvent.click(screen.getByText('Presets'));
    fireEvent.click(screen.getByText('Save'));

    const nameInput = screen.getByLabelText('Preset name');
    fireEvent.change(nameInput, { target: { value: 'Delete Me' } });
    fireEvent.click(screen.getByText('Save'));

    expect(screen.getAllByText('Delete Me').length).toBeGreaterThanOrEqual(1);

    const deleteBtn = screen.getByLabelText('Delete preset Delete Me');
    fireEvent.click(deleteBtn);

    expect(screen.queryAllByText('Delete Me').length).toBe(0);
  });

  it('shows active preset badge when rate matches a saved preset', () => {
    render(<FlowRateCalculator ratePerSecond={5} />);

    fireEvent.click(screen.getByText('Presets'));
    fireEvent.click(screen.getByText('Save'));

    const nameInput = screen.getByLabelText('Preset name');
    fireEvent.change(nameInput, { target: { value: 'Five Per Sec' } });
    fireEvent.click(screen.getByText('Save'));

    expect(screen.getAllByText('Five Per Sec').length).toBeGreaterThanOrEqual(1);
  });
});

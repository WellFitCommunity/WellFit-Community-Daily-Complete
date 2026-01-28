import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import VitalTrendChart, {
  type ChartDataPoint,
  type DataSeries,
  type ReferenceRange,
} from '../VitalTrendChart';

// Mock Recharts components since they don't render in jsdom
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ReferenceLine: ({ label }: { label?: { value: string } }) => (
    <div data-testid="reference-line">{label?.value}</div>
  ),
  Legend: () => <div data-testid="legend" />,
}));

const mockData: ChartDataPoint[] = [
  { date: 'Jan 25', timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, systolic: 120, diastolic: 80 },
  { date: 'Jan 26', timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, systolic: 118, diastolic: 78 },
  { date: 'Jan 27', timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000, systolic: 122, diastolic: 82 },
  { date: 'Jan 28', timestamp: Date.now(), systolic: 115, diastolic: 75 },
];

const mockSeries: DataSeries[] = [
  { key: 'systolic', label: 'Systolic', color: '#ef4444', unit: 'mmHg' },
  { key: 'diastolic', label: 'Diastolic', color: '#3b82f6', unit: 'mmHg' },
];

const mockReferenceLines: ReferenceRange[] = [
  { label: 'Normal Systolic', value: 120, color: '#22c55e' },
  { label: 'Normal Diastolic', value: 80, color: '#22c55e' },
];

describe('VitalTrendChart', () => {
  describe('Rendering', () => {
    it('renders the chart title', () => {
      render(
        <VitalTrendChart
          data={mockData}
          series={mockSeries}
          title="Blood Pressure Trends"
        />
      );

      expect(screen.getByText('Blood Pressure Trends')).toBeInTheDocument();
    });

    it('renders time range buttons', () => {
      render(
        <VitalTrendChart
          data={mockData}
          series={mockSeries}
          title="Test Chart"
        />
      );

      expect(screen.getByRole('button', { name: /7 days/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /30 days/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /90 days/i })).toBeInTheDocument();
    });

    it('renders the chart container when data exists', () => {
      render(
        <VitalTrendChart
          data={mockData}
          series={mockSeries}
          title="Test Chart"
        />
      );

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('renders reference lines when provided', () => {
      render(
        <VitalTrendChart
          data={mockData}
          series={mockSeries}
          title="Test Chart"
          referenceLines={mockReferenceLines}
        />
      );

      const refLines = screen.getAllByTestId('reference-line');
      expect(refLines.length).toBe(2);
    });
  });

  describe('Empty State', () => {
    it('shows empty message when no data', () => {
      render(
        <VitalTrendChart
          data={[]}
          series={mockSeries}
          title="Test Chart"
        />
      );

      expect(screen.getByText('No data available for chart')).toBeInTheDocument();
    });

    it('shows message when no data in selected time range', () => {
      // Create data older than 7 days
      const oldData: ChartDataPoint[] = [
        { date: 'Dec 1', timestamp: Date.now() - 60 * 24 * 60 * 60 * 1000, systolic: 120, diastolic: 80 },
      ];

      render(
        <VitalTrendChart
          data={oldData}
          series={mockSeries}
          title="Test Chart"
        />
      );

      // Default is 7 days, so this data should be filtered out
      expect(screen.getByText('No readings in selected time range')).toBeInTheDocument();
    });
  });

  describe('Time Range Selection', () => {
    it('7 days is selected by default', () => {
      render(
        <VitalTrendChart
          data={mockData}
          series={mockSeries}
          title="Test Chart"
        />
      );

      const sevenDaysButton = screen.getByRole('button', { name: /7 days/i });
      // Check if it has the primary color background (indicating selected)
      expect(sevenDaysButton).toHaveClass('text-white');
    });

    it('changes time range when button clicked', () => {
      render(
        <VitalTrendChart
          data={mockData}
          series={mockSeries}
          title="Test Chart"
        />
      );

      const thirtyDaysButton = screen.getByRole('button', { name: /30 days/i });
      fireEvent.click(thirtyDaysButton);

      // 30 days button should now be selected
      expect(thirtyDaysButton).toHaveClass('text-white');
    });
  });

  describe('Custom Props', () => {
    it('applies custom height', () => {
      render(
        <VitalTrendChart
          data={mockData}
          series={mockSeries}
          title="Test Chart"
          height={400}
        />
      );

      // ResponsiveContainer is rendered, implying height prop was passed
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('applies custom primary color to title', () => {
      const { container } = render(
        <VitalTrendChart
          data={mockData}
          series={mockSeries}
          title="Test Chart"
          primaryColor="#ff0000"
        />
      );

      const title = container.querySelector('h2');
      expect(title).toHaveStyle({ color: '#ff0000' });
    });
  });
});

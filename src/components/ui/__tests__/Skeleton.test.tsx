/**
 * Tests for Skeleton Components
 *
 * UI Design System: Loading skeleton placeholders
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  Skeleton,
  MappingTableSkeleton,
  StatsSkeleton,
  CodePreviewSkeleton,
  DashboardSkeleton,
  ApiKeyManagerSkeleton,
  TransferPacketSkeleton,
} from '../skeleton';

describe('Skeleton', () => {
  describe('Rendering', () => {
    it('should render skeleton element', () => {
      const { container } = render(<Skeleton />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('should have animate-pulse class for loading animation', () => {
      const { container } = render(<Skeleton />);
      expect(container.firstChild).toHaveClass('animate-pulse');
    });

    it('should have bg-gray-200 background', () => {
      const { container } = render(<Skeleton />);
      expect(container.firstChild).toHaveClass('bg-gray-200');
    });

    it('should have rounded-sm class', () => {
      const { container } = render(<Skeleton />);
      expect(container.firstChild).toHaveClass('rounded-sm');
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      const { container } = render(<Skeleton className="h-4 w-24" />);
      expect(container.firstChild).toHaveClass('h-4');
      expect(container.firstChild).toHaveClass('w-24');
    });

    it('should merge custom className with default styles', () => {
      const { container } = render(<Skeleton className="custom-class" />);
      expect(container.firstChild).toHaveClass('custom-class');
      expect(container.firstChild).toHaveClass('animate-pulse');
    });
  });

  describe('Children', () => {
    it('should render children content', () => {
      render(<Skeleton><span>Loading...</span></Skeleton>);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });
});

describe('MappingTableSkeleton', () => {
  it('should render table skeleton structure', () => {
    const { container } = render(<MappingTableSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should render multiple skeleton rows', () => {
    const { container } = render(<MappingTableSkeleton />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(5);
  });
});

describe('StatsSkeleton', () => {
  it('should render stats grid', () => {
    const { container } = render(<StatsSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should render 4 stat cards', () => {
    const { container } = render(<StatsSkeleton />);
    const cards = container.querySelectorAll('.bg-gray-50');
    expect(cards.length).toBe(4);
  });
});

describe('CodePreviewSkeleton', () => {
  it('should render code preview skeleton', () => {
    const { container } = render(<CodePreviewSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should render multiple code line skeletons', () => {
    const { container } = render(<CodePreviewSkeleton />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(10);
  });
});

describe('DashboardSkeleton', () => {
  it('should render dashboard skeleton', () => {
    const { container } = render(<DashboardSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should render stats cards section', () => {
    const { container } = render(<DashboardSkeleton />);
    const statsGrid = container.querySelector('.grid.grid-cols-1.md\\:grid-cols-5');
    expect(statsGrid).toBeInTheDocument();
  });

  it('should render table skeleton', () => {
    const { container } = render(<DashboardSkeleton />);
    const table = container.querySelector('table');
    expect(table).toBeInTheDocument();
  });
});

describe('ApiKeyManagerSkeleton', () => {
  it('should render API key manager skeleton', () => {
    const { container } = render(<ApiKeyManagerSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should render table structure', () => {
    const { container } = render(<ApiKeyManagerSkeleton />);
    const table = container.querySelector('table');
    expect(table).toBeInTheDocument();
  });

  it('should render stats cards', () => {
    const { container } = render(<ApiKeyManagerSkeleton />);
    const statsGrid = container.querySelector('.grid.grid-cols-2');
    expect(statsGrid).toBeInTheDocument();
  });
});

describe('TransferPacketSkeleton', () => {
  it('should render transfer packet skeleton', () => {
    const { container } = render(<TransferPacketSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should render 3 packet cards', () => {
    const { container } = render(<TransferPacketSkeleton />);
    const cards = container.querySelectorAll('.border-l-4');
    expect(cards.length).toBe(3);
  });
});

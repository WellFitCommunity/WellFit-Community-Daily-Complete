/**
 * Card.test.tsx - Tests for Card component and sub-components
 *
 * Purpose: Verify card rendering, branding integration, and composition
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../card';

// Mock the branding context
vi.mock('../../../BrandingContext', () => ({
  useBranding: () => ({
    branding: {
      primaryColor: '#4F46E5',
      secondaryColor: '#10B981',
      logoUrl: '/logo.png',
      organizationName: 'Test Org',
    },
  }),
}));

describe('Card', () => {
  describe('Rendering', () => {
    it('should render children', () => {
      render(
        <Card>
          <div data-testid="child">Card content</div>
        </Card>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('should apply base styles', () => {
      render(<Card data-testid="card">Content</Card>);

      const card = screen.getByTestId('card');
      expect(card).toHaveClass('rounded-lg');
      expect(card).toHaveClass('bg-white');
      expect(card).toHaveClass('shadow-lg');
    });

    it('should apply custom className', () => {
      render(<Card data-testid="card" className="custom-card">Content</Card>);

      const card = screen.getByTestId('card');
      expect(card).toHaveClass('custom-card');
    });

    it('should apply branding color to border', () => {
      render(<Card data-testid="card">Content</Card>);

      const card = screen.getByTestId('card');
      expect(card).toHaveStyle({ borderColor: '#4F46E5' });
    });

    it('should forward ref', () => {
      const ref = vi.fn();
      render(<Card ref={ref}>Content</Card>);

      expect(ref).toHaveBeenCalled();
    });

    it('should spread additional props', () => {
      render(<Card data-testid="card" id="my-card" aria-label="Main card">Content</Card>);

      const card = screen.getByTestId('card');
      expect(card).toHaveAttribute('id', 'my-card');
      expect(card).toHaveAttribute('aria-label', 'Main card');
    });
  });
});

describe('CardHeader', () => {
  it('should render children', () => {
    render(
      <CardHeader>
        <span>Header content</span>
      </CardHeader>
    );

    expect(screen.getByText('Header content')).toBeInTheDocument();
  });

  it('should apply padding styles', () => {
    render(<CardHeader data-testid="header">Content</CardHeader>);

    const header = screen.getByTestId('header');
    expect(header).toHaveClass('p-6');
  });

  it('should apply custom className', () => {
    render(<CardHeader data-testid="header" className="custom-header">Content</CardHeader>);

    const header = screen.getByTestId('header');
    expect(header).toHaveClass('custom-header');
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<CardHeader ref={ref}>Content</CardHeader>);

    expect(ref).toHaveBeenCalled();
  });
});

describe('CardTitle', () => {
  it('should render as h3 element', () => {
    render(<CardTitle>My Title</CardTitle>);

    const title = screen.getByRole('heading', { level: 3 });
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent('My Title');
  });

  it('should apply title styles', () => {
    render(<CardTitle data-testid="title">Title</CardTitle>);

    const title = screen.getByTestId('title');
    expect(title).toHaveClass('text-lg');
    expect(title).toHaveClass('font-semibold');
  });

  it('should apply custom className', () => {
    render(<CardTitle data-testid="title" className="custom-title">Title</CardTitle>);

    const title = screen.getByTestId('title');
    expect(title).toHaveClass('custom-title');
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<CardTitle ref={ref}>Title</CardTitle>);

    expect(ref).toHaveBeenCalled();
  });
});

describe('CardDescription', () => {
  it('should render as paragraph', () => {
    render(<CardDescription>This is a description</CardDescription>);

    expect(screen.getByText('This is a description')).toBeInTheDocument();
  });

  it('should apply description styles', () => {
    render(<CardDescription data-testid="desc">Description</CardDescription>);

    const desc = screen.getByTestId('desc');
    expect(desc).toHaveClass('text-sm');
    expect(desc).toHaveClass('text-gray-500');
  });

  it('should apply custom className', () => {
    render(<CardDescription data-testid="desc" className="custom-desc">Description</CardDescription>);

    const desc = screen.getByTestId('desc');
    expect(desc).toHaveClass('custom-desc');
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<CardDescription ref={ref}>Description</CardDescription>);

    expect(ref).toHaveBeenCalled();
  });
});

describe('CardContent', () => {
  it('should render children', () => {
    render(
      <CardContent>
        <p>Main content goes here</p>
      </CardContent>
    );

    expect(screen.getByText('Main content goes here')).toBeInTheDocument();
  });

  it('should apply content styles', () => {
    render(<CardContent data-testid="content">Content</CardContent>);

    const content = screen.getByTestId('content');
    expect(content).toHaveClass('p-6');
    expect(content).toHaveClass('pt-0');
  });

  it('should apply custom className', () => {
    render(<CardContent data-testid="content" className="custom-content">Content</CardContent>);

    const content = screen.getByTestId('content');
    expect(content).toHaveClass('custom-content');
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<CardContent ref={ref}>Content</CardContent>);

    expect(ref).toHaveBeenCalled();
  });
});

describe('CardFooter', () => {
  it('should render children', () => {
    render(
      <CardFooter>
        <button>Action</button>
      </CardFooter>
    );

    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });

  it('should apply footer styles', () => {
    render(<CardFooter data-testid="footer">Footer</CardFooter>);

    const footer = screen.getByTestId('footer');
    expect(footer).toHaveClass('flex');
    expect(footer).toHaveClass('items-center');
    expect(footer).toHaveClass('p-6');
    expect(footer).toHaveClass('pt-0');
  });

  it('should apply custom className', () => {
    render(<CardFooter data-testid="footer" className="custom-footer">Footer</CardFooter>);

    const footer = screen.getByTestId('footer');
    expect(footer).toHaveClass('custom-footer');
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<CardFooter ref={ref}>Footer</CardFooter>);

    expect(ref).toHaveBeenCalled();
  });
});

describe('Card Composition', () => {
  it('should render complete card structure', () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card description text</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Main content</p>
        </CardContent>
        <CardFooter>
          <button>Save</button>
          <button>Cancel</button>
        </CardFooter>
      </Card>
    );

    expect(screen.getByTestId('card')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Card Title' })).toBeInTheDocument();
    expect(screen.getByText('Card description text')).toBeInTheDocument();
    expect(screen.getByText('Main content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should work with minimal content', () => {
    render(
      <Card>
        <CardContent>Simple content</CardContent>
      </Card>
    );

    expect(screen.getByText('Simple content')).toBeInTheDocument();
  });
});

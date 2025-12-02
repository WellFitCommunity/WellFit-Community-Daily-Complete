import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionnaireAnalyticsDashboard } from '../QuestionnaireAnalyticsDashboard';

// Mock the supabase client
const mockFrom = jest.fn();
const mockSupabase = {
  from: mockFrom,
};

// Mock the AuthContext
jest.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    supabase: mockSupabase,
    user: { id: 'test-user-id' },
  }),
}));

describe('QuestionnaireAnalyticsDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setupMockQueries = (options: {
    deployments?: any[];
    responses?: any[];
    templates?: any[];
  } = {}) => {
    const { deployments = [], responses = [], templates = [] } = options;

    mockFrom.mockImplementation((table: string) => {
      let data: any[] = [];
      if (table === 'questionnaire_deployments') data = deployments;
      if (table === 'questionnaire_responses') data = responses;
      if (table === 'question_templates') data = templates;

      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data, error: null }),
      };
    });
  };

  it('should render loading state initially', () => {
    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockImplementation(() => new Promise(() => {})),
    }));

    render(<QuestionnaireAnalyticsDashboard />);

    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should render dashboard with no deployments', async () => {
    setupMockQueries({ deployments: [] });

    render(<QuestionnaireAnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Questionnaire Analytics/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/No deployments yet/i)).toBeInTheDocument();
  });

  it('should render dashboard with deployments', async () => {
    const mockDeployments = [
      {
        id: 'deploy-1',
        questionnaire_id: 'q-1',
        questionnaire_name: 'Depression Screening PHQ-9',
        target_population: 'All seniors',
        deployment_type: 'scheduled',
        status: 'active',
        start_date: '2025-11-01',
        target_count: 100,
        completed_count: 65,
        response_rate: 65,
        created_at: '2025-11-01',
      },
    ];

    setupMockQueries({ deployments: mockDeployments });

    render(<QuestionnaireAnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Questionnaire Analytics/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Depression Screening PHQ-9')).toBeInTheDocument();
    expect(screen.getByText('All seniors')).toBeInTheDocument();
  });

  it('should display metrics correctly', async () => {
    setupMockQueries({ deployments: [], responses: [], templates: [] });

    render(<QuestionnaireAnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Total Deployments/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Active Deployments/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Responses/i)).toBeInTheDocument();
    expect(screen.getByText(/Avg Response Rate/i)).toBeInTheDocument();
  });

  it('should have tab navigation', async () => {
    setupMockQueries();

    render(<QuestionnaireAnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Questionnaire Analytics/i)).toBeInTheDocument();
    });

    // Should have tabs
    expect(screen.getByRole('tab', { name: /Deployments/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Responses/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Templates/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Analytics/i })).toBeInTheDocument();
  });

  it('should switch between tabs', async () => {
    const mockResponses = [
      {
        id: 'resp-1',
        questionnaire_id: 'q-1',
        questionnaire_name: 'PHQ-9',
        respondent_id: 'user-1',
        status: 'completed',
        completion_time_minutes: 5,
        score: 8,
        created_at: '2025-12-01',
        profiles: { first_name: 'John', last_name: 'Doe' },
      },
    ];

    setupMockQueries({ responses: mockResponses });

    render(<QuestionnaireAnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Questionnaire Analytics/i)).toBeInTheDocument();
    });

    // Click on Responses tab
    const responsesTab = screen.getByRole('tab', { name: /Responses/i });
    await userEvent.click(responsesTab);

    await waitFor(() => {
      expect(screen.getByText(/Recent Responses/i)).toBeInTheDocument();
    });
  });

  it('should have New Deployment button', async () => {
    setupMockQueries();

    render(<QuestionnaireAnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Questionnaire Analytics/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /New Deployment/i })).toBeInTheDocument();
  });

  it('should display error state with retry button', async () => {
    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockRejectedValue(new Error('Network error')),
    }));

    render(<QuestionnaireAnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to Load Dashboard/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });
});

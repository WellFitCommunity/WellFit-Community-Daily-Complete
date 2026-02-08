/**
 * Star Ratings Types — CMS Star Ratings (1-5)
 *
 * ONC Criteria: 170.315(c)(1), (c)(2), (c)(3)
 */

export interface StarRatingScore {
  id: string;
  tenantId: string;
  reportingYear: number;
  ratingType: 'part_c' | 'part_d';
  domainScores: Record<string, number>;
  domainWeights: Record<string, number>;
  overallStarRating: number | null;
  measureStarDetails: MeasureStarDetail[];
  previousYearRating: number | null;
  trendDirection: 'up' | 'down' | 'stable' | null;
  totalMeasuresRated: number;
  measuresAt4Plus: number;
  measuresBelow3: number;
  calculatedAt: string;
  notes: string | null;
}

export interface MeasureStarDetail {
  measureId: string;
  cmsId: string;
  title: string;
  domain: string;
  performanceRate: number | null;
  starRating: number;
  cutPoints: StarCutPoints;
  isInverse: boolean;
  weight: number;
}

export interface StarCutPoints {
  '1': number;
  '2': number;
  '3': number;
  '4': number;
  '5': number;
}

export interface StarDomainSummary {
  domain: string;
  score: number;
  weight: number;
  measureCount: number;
  measures: MeasureStarDetail[];
}

export interface StarRatingRow {
  id: string;
  tenant_id: string;
  reporting_year: number;
  rating_type: 'part_c' | 'part_d';
  domain_scores: Record<string, number>;
  domain_weights: Record<string, number>;
  overall_star_rating: number | null;
  measure_star_details: MeasureStarDetail[];
  previous_year_rating: number | null;
  trend_direction: 'up' | 'down' | 'stable' | null;
  total_measures_rated: number;
  measures_at_4_plus: number;
  measures_below_3: number;
  calculated_at: string;
  calculated_by: string | null;
  notes: string | null;
}

export interface CalculateStarOptions {
  tenantId: string;
  reportingYear: number;
  ratingType?: 'part_c' | 'part_d';
}

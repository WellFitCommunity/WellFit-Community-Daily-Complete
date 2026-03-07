export interface SlideProps {
  isActive: boolean;
  direction: 'left' | 'right' | 'none';
}

export interface MetricItem {
  label: string;
  value: string;
  description: string;
}

export interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

export interface TimelineItem {
  quarter: string;
  title: string;
  description: string;
  status: 'completed' | 'current' | 'upcoming';
}

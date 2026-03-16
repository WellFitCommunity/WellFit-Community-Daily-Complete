// Quick Action Card Component for FHIR AI Dashboard

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';

interface QuickActionCardProps {
  title: string;
  description: string;
  action: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  onClick: () => void;
}

const urgencyColors = {
  LOW: 'bg-blue-50 border-blue-200 text-blue-800',
  MEDIUM: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  HIGH: 'bg-orange-50 border-orange-200 text-orange-800',
  CRITICAL: 'bg-red-50 border-red-200 text-red-800'
};

const QuickActionCard: React.FC<QuickActionCardProps> = ({ title, description, action, urgency, onClick }) => {
  return (
    <Card className={`cursor-pointer transition-all hover:shadow-md ${urgencyColors[urgency]}`} onClick={onClick} aria-label={`${title} - ${urgency} urgency`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Badge variant={urgency === 'CRITICAL' ? 'destructive' : 'secondary'}>
            {urgency}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs mb-2">{description}</p>
        <Button size="sm" variant="outline" className="w-full">
          {action}
        </Button>
      </CardContent>
    </Card>
  );
};

export default QuickActionCard;

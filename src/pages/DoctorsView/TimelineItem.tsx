/**
 * TimelineItem — Activity timeline entry
 *
 * Displays a single check-in or health report in a vertical timeline
 * with review status indicator.
 *
 * @module DoctorsView/TimelineItem
 * Copyright 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import Clock from 'lucide-react/dist/esm/icons/clock';

interface TimelineItemProps {
  date: string;
  title: string;
  content: string;
  reviewed: boolean;
  type: 'checkin' | 'health';
}

const typeColors = {
  checkin: 'bg-blue-100 text-blue-800',
  health: 'bg-purple-100 text-purple-800',
};

export const TimelineItem: React.FC<TimelineItemProps> = ({ date, title, content, reviewed, type }) => {
  return (
    <div className="relative pl-8 pb-6 border-l-2 border-gray-200 last:border-l-0 last:pb-0">
      <div className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full border-2 border-white ${reviewed ? 'bg-green-500' : 'bg-gray-300'}`}></div>
      <div className="bg-white rounded-lg p-4 shadow-xs border border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-sm ${typeColors[type]}`}>
                {type === 'checkin' ? 'Check-in' : 'Health Report'}
              </span>
              {reviewed && (
                <span className="text-xs px-2 py-0.5 rounded-sm bg-green-100 text-green-800 flex items-center">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Reviewed
                </span>
              )}
            </div>
            <h4 className="font-medium text-gray-900">{title}</h4>
          </div>
          <span className="text-xs text-gray-500 flex items-center">
            <Clock className="w-3 h-3 mr-1" />
            {new Date(date).toLocaleDateString()}
          </span>
        </div>
        <p className="text-sm text-gray-700">{content}</p>
      </div>
    </div>
  );
};

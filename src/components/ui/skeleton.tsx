import React from 'react';

interface SkeletonProps {
  className?: string;
  children?: React.ReactNode;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', children }) => {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`}>
      {children}
    </div>
  );
};

export const MappingTableSkeleton: React.FC = () => {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-48" />
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2">
          <div className="grid grid-cols-5 gap-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className={`px-4 py-3 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
            <div className="grid grid-cols-5 gap-4">
              <div className="space-y-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2 w-16" />
              </div>
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-6 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const StatsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="bg-gray-50 p-4 rounded-lg">
          <Skeleton className="h-8 w-12 mx-auto mb-2" />
          <Skeleton className="h-4 w-24 mx-auto" />
        </div>
      ))}
    </div>
  );
};

export const CodePreviewSkeleton: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="bg-gray-100 rounded-lg p-4">
        <div className="space-y-2">
          {Array.from({ length: 20 }).map((_, index) => (
            <Skeleton
              key={index}
              className={`h-4 ${
                index % 4 === 0 ? 'w-1/4' :
                index % 3 === 0 ? 'w-3/4' :
                'w-full'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
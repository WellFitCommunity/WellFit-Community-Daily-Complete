// src/components/StepList.tsx
import { FC } from 'react';

interface StepListProps {
  steps: string[];
}

const StepList: FC<StepListProps> = ({ steps }) => {
  return (
    <ol className="list-decimal ml-6 mt-2 space-y-2">
      {steps.map((step, index) => (
        <li key={index} className="text-base text-gray-800">{step}</li>
      ))}
    </ol>
  );
};

export default StepList;

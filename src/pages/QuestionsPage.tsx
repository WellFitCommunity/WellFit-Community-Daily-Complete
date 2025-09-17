// src/pages/QuestionsPage.tsx
import React from 'react';
import UserQuestions from '../components/UserQuestions';

export default function QuestionsPage() {
  return (
    <div className="container mx-auto py-8">
      <UserQuestions isAdmin={false} />
    </div>
  );
}
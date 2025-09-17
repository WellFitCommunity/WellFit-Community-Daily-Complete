// src/pages/AdminQuestionsPage.tsx  
import React from 'react';
import UserQuestions from '../components/UserQuestions';

export default function AdminQuestionsPage() {
  return (
    <div className="container mx-auto py-8">
      <UserQuestions isAdmin={true} />
    </div>
  );
}
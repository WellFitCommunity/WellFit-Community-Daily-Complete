// Dashboard Meal of the Day Widget
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { allRecipes } from '../../data/allRecipes';

const DashMealOfTheDay: React.FC = () => {
  const navigate = useNavigate();
  const [todaysMeal, setTodaysMeal] = useState<any>(null);

  useEffect(() => {
    // Get today's meal based on date
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    const mealIndex = dayOfYear % allRecipes.length;
    setTodaysMeal(allRecipes[mealIndex]);
  }, []);

  if (!todaysMeal) {
    return (
      <div className="text-center">
        <div className="text-2xl sm:text-3xl mb-3">🍽️</div>
        <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-3">
          Today's Meal
        </h3>
        <p className="text-sm sm:text-base text-gray-600">
          Loading today's featured meal...
        </p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="text-2xl sm:text-3xl mb-3">🍽️</div>
      <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-3">
        Today's Featured Meal
      </h3>

      <div className="mb-4">
        {todaysMeal.image_url && (
          <img
            src={todaysMeal.image_url}
            alt={todaysMeal.name}
            className="w-full h-32 sm:h-40 object-cover rounded-lg mb-3"
          />
        )}
        <h4 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">
          {todaysMeal.name}
        </h4>
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {todaysMeal.description || 'A delicious and nutritious meal for today!'}
        </p>

        <div className="flex justify-center gap-4 text-xs sm:text-sm text-gray-500 mb-4">
          {todaysMeal.calories && (
            <span>🔥 {todaysMeal.calories} cal</span>
          )}
          {todaysMeal.cost && (
            <span>💰 ${todaysMeal.cost}</span>
          )}
        </div>
      </div>

      <button
        onClick={() => navigate(`/meals/${todaysMeal.id}`)}
        className="bg-green-600 text-white text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-green-700 transition-colors w-full"
      >
        🍳 View Full Recipe
      </button>
    </div>
  );
};

export default DashMealOfTheDay;
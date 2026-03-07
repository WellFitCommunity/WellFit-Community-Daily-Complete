/**
 * PitchDeck - Interactive slide-based pitch deck for Envision Atlus + WellFit Community Daily
 *
 * Navigation: Arrow keys, click arrows, touch swipe, or dot indicators
 * Slides: Hero, Problem, Solution, AI Platform, Deployment, Metrics, Roadmap, CTA
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import SlideHero from './SlideHero';
import SlideProblem from './SlideProblem';
import SlideSolution from './SlideSolution';
import SlideAIPlatform from './SlideAIPlatform';
import SlideDeployment from './SlideDeployment';
import SlideMetrics from './SlideMetrics';
import SlideRoadmap from './SlideRoadmap';
import SlideCTA from './SlideCTA';

const SLIDE_TITLES = [
  'Welcome',
  'The Problem',
  'Our Solution',
  'AI Platform',
  'Deployment',
  'Metrics',
  'Roadmap',
  'Get Started',
];

const SLIDES = [
  SlideHero,
  SlideProblem,
  SlideSolution,
  SlideAIPlatform,
  SlideDeployment,
  SlideMetrics,
  SlideRoadmap,
  SlideCTA,
];

const PitchDeck: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right' | 'none'>('none');
  const touchStartX = useRef(0);

  const totalSlides = SLIDES.length;

  const goToSlide = useCallback(
    (index: number) => {
      if (index < 0 || index >= totalSlides || index === currentSlide) return;
      setDirection(index > currentSlide ? 'right' : 'left');
      setCurrentSlide(index);
    },
    [currentSlide, totalSlides]
  );

  const nextSlide = useCallback(() => goToSlide(currentSlide + 1), [currentSlide, goToSlide]);
  const prevSlide = useCallback(() => goToSlide(currentSlide - 1), [currentSlide, goToSlide]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToSlide(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goToSlide(totalSlides - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide, goToSlide, totalSlides]);

  // Touch swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) nextSlide();
      else prevSlide();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-[#111827] overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slide Container */}
      <div className="relative w-full h-full">
        {SLIDES.map((SlideComponent, index) => (
          <SlideComponent
            key={SLIDE_TITLES[index]}
            isActive={currentSlide === index}
            direction={currentSlide === index ? direction : 'none'}
          />
        ))}
      </div>

      {/* Navigation Arrows */}
      {currentSlide > 0 && (
        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-all backdrop-blur-sm border border-white/10 z-20"
          aria-label="Previous slide"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {currentSlide < totalSlides - 1 && (
        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-all backdrop-blur-sm border border-white/10 z-20"
          aria-label="Next slide"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M8 4L14 10L8 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* Dot Navigation */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
        {SLIDE_TITLES.map((title, index) => (
          <button
            key={title}
            onClick={() => goToSlide(index)}
            className={`group relative transition-all duration-300 ${
              currentSlide === index
                ? 'w-8 h-3 rounded-full bg-[#C8E63D]'
                : 'w-3 h-3 rounded-full bg-white/30 hover:bg-white/50'
            }`}
            aria-label={`Go to slide: ${title}`}
          >
            {/* Tooltip */}
            <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {title}
            </span>
          </button>
        ))}
      </div>

      {/* Slide Counter */}
      <div className="absolute top-4 right-4 text-white/40 text-sm font-mono z-20">
        {currentSlide + 1} / {totalSlides}
      </div>

      {/* Keyboard hint (top left) */}
      <div className="absolute top-4 left-4 z-20">
        <span className="text-white/30 text-xs hidden md:inline">
          &#8592; &#8594; keys &bull; Space to advance
        </span>
      </div>
    </div>
  );
};

export default PitchDeck;

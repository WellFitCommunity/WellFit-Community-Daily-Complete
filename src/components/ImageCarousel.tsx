// src/components/ImageCarousel.tsx
import React, { useState } from 'react';

interface ImageCarouselProps {
  images: string[];
  altText?: string;
}

const ImageCarousel: React.FC<ImageCarouselProps> = ({ images, altText = "Meal Image" }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="relative w-full max-w-xl mx-auto mt-4">
      <img
        src={images[currentIndex]}
        alt={`${altText} ${currentIndex + 1}`}
        className="rounded-lg w-full h-auto shadow-md object-cover"
      />
      {images.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute top-1/2 left-0 transform -translate-y-1/2 bg-white bg-opacity-70 px-2 py-1 rounded-r text-sm"
          >
            ◀
          </button>
          <button
            onClick={goToNext}
            className="absolute top-1/2 right-0 transform -translate-y-1/2 bg-white bg-opacity-70 px-2 py-1 rounded-l text-sm"
          >
            ▶
          </button>
        </>
      )}
    </div>
  );
};

export default ImageCarousel;

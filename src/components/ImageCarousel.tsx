import { useState } from 'react';

interface ImageCarouselProps {
  images: string[];
  altText?: string;
}

const ImageCarousel: React.FC<ImageCarouselProps> = ({ images, altText = "Meal Image" }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToPrevious = () => setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  const goToNext = () => setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));

  // Keyboard navigation for accessibility
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') goToPrevious();
    if (e.key === 'ArrowRight') goToNext();
  };

  return (
    <div
      className="relative w-full max-w-xl mx-auto mt-4 outline-none"
      tabIndex={0}
      aria-label="Image Carousel"
      onKeyDown={handleKeyDown}
    >
      <img
        src={images[currentIndex]}
        alt={`${altText} ${currentIndex + 1}`}
        className="rounded-lg w-full h-auto shadow-md object-cover max-h-72 md:max-h-96"
        style={{ minHeight: '180px', background: '#f4f4f4' }}
      />
      {images.length > 1 && (
        <>
          <button
            aria-label="Previous image"
            onClick={goToPrevious}
            className="absolute top-1/2 left-2 transform -translate-y-1/2 bg-white bg-opacity-80 px-3 py-2 rounded-full text-xl font-bold shadow focus:outline-none"
          >
            ◀
          </button>
          <button
            aria-label="Next image"
            onClick={goToNext}
            className="absolute top-1/2 right-2 transform -translate-y-1/2 bg-white bg-opacity-80 px-3 py-2 rounded-full text-xl font-bold shadow focus:outline-none"
          >
            ▶
          </button>
          {/* Dots for visual indication */}
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
            {images.map((_, i) => (
              <span
                key={i}
                className={`w-3 h-3 rounded-full ${i === currentIndex ? 'bg-[#8cc63f]' : 'bg-gray-400'} inline-block`}
                aria-label={`Go to image ${i + 1}`}
                role="button"
                tabIndex={0}
                onClick={() => setCurrentIndex(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ImageCarousel;


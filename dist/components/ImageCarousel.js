"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/components/ImageCarousel.tsx
const react_1 = __importStar(require("react"));
const ImageCarousel = ({ images, altText = "Meal Image" }) => {
    const [currentIndex, setCurrentIndex] = (0, react_1.useState)(0);
    const goToPrevious = () => {
        setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    };
    const goToNext = () => {
        setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    };
    return (<div className="relative w-full max-w-xl mx-auto mt-4">
      <img src={images[currentIndex]} alt={`${altText} ${currentIndex + 1}`} className="rounded-lg w-full h-auto shadow-md object-cover"/>
      {images.length > 1 && (<>
          <button onClick={goToPrevious} className="absolute top-1/2 left-0 transform -translate-y-1/2 bg-white bg-opacity-70 px-2 py-1 rounded-r text-sm">
            ◀
          </button>
          <button onClick={goToNext} className="absolute top-1/2 right-0 transform -translate-y-1/2 bg-white bg-opacity-70 px-2 py-1 rounded-l text-sm">
            ▶
          </button>
        </>)}
    </div>);
};
exports.default = ImageCarousel;

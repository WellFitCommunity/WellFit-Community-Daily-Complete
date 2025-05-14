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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/pages/MealDetailPage.tsx
const react_1 = __importStar(require("react"));
const react_router_dom_1 = require("react-router-dom");
const supabaseClient_1 = require("../lib/supabaseClient");
const PhotoUpload_1 = __importDefault(require("../components/PhotoUpload"));
const PhotoGallery_1 = __importDefault(require("../components/PhotoGallery"));
const MealDetailPage = () => {
    const { id } = (0, react_router_dom_1.useParams)();
    const [meal, setMeal] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    (0, react_1.useEffect)(() => {
        if (!id)
            return;
        const fetchMeal = async () => {
            setLoading(true);
            const { data, error } = await supabaseClient_1.supabase
                .from('meals')
                .select('id,name,description,image_url')
                .eq('id', id)
                .single();
            if (error) {
                console.error('Error fetching meal:', error.message);
            }
            else {
                setMeal(data);
            }
            setLoading(false);
        };
        fetchMeal();
    }, [id]);
    if (loading) {
        return <p className="text-center text-gray-600">Loading...</p>;
    }
    if (!meal) {
        return <p className="text-center text-gray-600">No meal found.</p>;
    }
    // Use stored image_url or fallback to Unsplash
    const imgSrc = meal.image_url
        ? meal.image_url
        : `https://source.unsplash.com/600x400/?${encodeURIComponent(meal.name)}`;
    return (<div className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-center text-wellfit-blue">{meal.name}</h1>
      <img src={imgSrc} alt={meal.name} className="w-full h-64 object-cover rounded-lg shadow-md"/>
      <p className="text-gray-700">{meal.description}</p>

      {/* Photo upload and gallery */}
      <div className="space-y-4">
        <PhotoUpload_1.default context="meal" recordId={meal.id}/>
        <PhotoGallery_1.default context="meal" recordId={meal.id}/>
      </div>
    </div>);
};
exports.default = MealDetailPage;

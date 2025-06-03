// src/components/UploadMeal.tsx
import React, { useState } from 'react';
import { useSupabaseClient, SupabaseClient } from '@supabase/auth-helpers-react'; // Import SupabaseClient for typing

interface MealFormData {
  name: string;
  imageFile: File | null;
  ingredients: string;
  steps: string;
  calories: string; // Keep as string for input, convert to number on submit
  cost: string;
  cookTime: string;
  cookTemp: string;
  tags: string;
}

const UploadMeal: React.FC = () => {
  const supabase: SupabaseClient = useSupabaseClient(); // Explicitly type supabase client

  const initialFormData: MealFormData = {
    name: '',
    imageFile: null,
    ingredients: '',
    steps: '',
    calories: '',
    cost: '',
    cookTime: '',
    cookTemp: '',
    tags: ''
  };
  const [formData, setFormData] = useState<MealFormData>(initialFormData);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type?: 'success' | 'error'; text?: string }>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (e.target instanceof HTMLInputElement && e.target.files) {
      setFormData(prev => ({
        ...prev,
        [name]: e.target.files ? e.target.files[0] : null // Handle null case for files
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    // Clear message on new input
    if (message.text) setMessage({});
  };

  const handleUpload = async (): Promise<void> => {
    setIsLoading(true);
    setMessage({});
    try {
      let imageUrl = '';
      if (formData.imageFile) {
        // Validate file type (basic example)
        if (!formData.imageFile.type.startsWith('image/')) {
          throw new Error('Invalid file type. Please upload an image.');
        }

        const { data, error: uploadError } = await supabase.storage
          .from('meal_images')
          .upload(`meal-${Date.now()}`, formData.imageFile);
        if (uploadError) throw uploadError;

        imageUrl = supabase.storage
          .from('meal_images')
          .getPublicUrl(data.path).data.publicUrl;
      }

      const { error: insertError } = await supabase.from('meals').insert({
        name: formData.name,
        image_url: imageUrl,
        ingredients: formData.ingredients.split('\n'),
        steps: formData.steps.split('\n'),
        calories: Number(formData.calories),
        cost: formData.cost,
        cook_time: formData.cookTime,
        cook_temp: formData.cookTemp,
        tags: formData.tags.split(',').map(tag => tag.trim())
      });

      if (insertError) throw insertError;

      setMessage({ type: 'success', text: 'Meal uploaded successfully!' });
      // Optionally reset form fields here
      setFormData(initialFormData);
      // Clear file input if it's a separate ref, or re-render component by key
      // This is tricky with controlled components; resetting formData.imageFile to null is usually enough.
      // If direct DOM manipulation is needed, ensure the element exists.
      const fileInput = document.getElementById('meal-imageFile') as HTMLInputElement | null;
      if (fileInput) {
        fileInput.value = ''; // Clears the displayed file name in the input
      }

    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "An unknown error occurred.";
      setMessage({ type: 'error', text: `Error: ${errMsg}` });
    } finally {
      setIsLoading(false);
    }
  };

  const commonInputClass = "mb-2 w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100";
  const commonTextareaClass = `${commonInputClass} h-24`;


  return (
    <div className="p-4 sm:p-6 bg-white rounded-xl shadow-lg">
      <h2 className="text-xl sm:text-2xl font-bold mb-6 text-gray-800 text-center">Upload a New Meal</h2>
      <form onSubmit={(e) => { e.preventDefault(); handleUpload(); }} className="space-y-4">
        <div>
          <label htmlFor="meal-name" className="block text-sm font-medium text-gray-700 mb-1">Meal Name</label>
          <input id="meal-name" type="text" name="name" value={formData.name} placeholder="e.g., Delicious Pancakes" onChange={handleChange} className={commonInputClass} disabled={isLoading} aria-required="true" />
        </div>
        <div>
          <label htmlFor="meal-imageFile" className="block text-sm font-medium text-gray-700 mb-1">Meal Image (Optional)</label>
          <input id="meal-imageFile" type="file" name="imageFile" accept="image/*" onChange={handleChange} className={`${commonInputClass} file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100`} disabled={isLoading} />
        </div>
        <div>
          <label htmlFor="meal-ingredients" className="block text-sm font-medium text-gray-700 mb-1">Ingredients</label>
          <textarea id="meal-ingredients" name="ingredients" value={formData.ingredients} placeholder="List each ingredient on a new line" onChange={handleChange} className={commonTextareaClass} disabled={isLoading} aria-required="true" />
        </div>
        <div>
          <label htmlFor="meal-steps" className="block text-sm font-medium text-gray-700 mb-1">Steps</label>
          <textarea id="meal-steps" name="steps" value={formData.steps} placeholder="List each step on a new line" onChange={handleChange} className={commonTextareaClass} disabled={isLoading} aria-required="true" />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <label htmlFor="meal-calories" className="block text-sm font-medium text-gray-700 mb-1">Calories (Optional)</label>
            <input id="meal-calories" type="number" name="calories" value={formData.calories} placeholder="e.g., 350" onChange={handleChange} className={commonInputClass} disabled={isLoading} />
          </div>
          <div>
            <label htmlFor="meal-cost" className="block text-sm font-medium text-gray-700 mb-1">Estimated Cost (Optional)</label>
            <input id="meal-cost" type="text" name="cost" value={formData.cost} placeholder="e.g., $5.00" onChange={handleChange} className={commonInputClass} disabled={isLoading} />
          </div>
          <div>
            <label htmlFor="meal-cookTime" className="block text-sm font-medium text-gray-700 mb-1">Cook Time (Optional)</label>
            <input id="meal-cookTime" type="text" name="cookTime" value={formData.cookTime} placeholder="e.g., 30 mins" onChange={handleChange} className={commonInputClass} disabled={isLoading} />
          </div>
          <div>
            <label htmlFor="meal-cookTemp" className="block text-sm font-medium text-gray-700 mb-1">Cook Temperature (Optional)</label>
            <input id="meal-cookTemp" type="text" name="cookTemp" value={formData.cookTemp} placeholder="e.g., 350°F" onChange={handleChange} className={commonInputClass} disabled={isLoading} />
          </div>
        </div>
        <div>
          <label htmlFor="meal-tags" className="block text-sm font-medium text-gray-700 mb-1">Tags (Optional)</label>
          <input id="meal-tags" type="text" name="tags" value={formData.tags} placeholder="Comma-separated, e.g., breakfast, quick" onChange={handleChange} className={`${commonInputClass} mb-1`} disabled={isLoading} />
        </div>

        <button 
          type="submit"
          className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-700 transition duration-150 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          disabled={isLoading || !formData.name} // Basic validation: disable if no name
        >
          {isLoading ? 'Uploading Meal...' : 'Upload Meal'}
        </button>

        {message.text && (
          <p role="status" className={`mt-4 text-sm p-3 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message.text}
          </p>
        )}
      </form>
    </div>
  );
};

export default UploadMeal;


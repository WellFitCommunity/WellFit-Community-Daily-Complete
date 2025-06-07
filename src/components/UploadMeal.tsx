import { useState } from 'react';
import { useSupabaseClient, SupabaseClient } from '@supabase/auth-helpers-react';

interface MealFormData {
  name: string;
  imageFile: File | null;
  ingredients: string;
  steps: string;
  calories: string;
  cost: string;
  cookTime: string;
  cookTemp: string;
  tags: string;
}

const UploadMeal: React.FC = () => {
  const supabase: SupabaseClient = useSupabaseClient();

  const initialFormData: MealFormData = {
    name: '',
    imageFile: null,
    ingredients: '',
    steps: '',
    calories: '',
    cost: '',
    cookTime: '',
    cookTemp: '',
    tags: '',
  };

  const [formData, setFormData] = useState<MealFormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type?: 'success' | 'error'; text?: string }>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name } = e.target;

    if (e.target instanceof HTMLInputElement && e.target.type === 'file') {
      const file = e.target.files?.[0] ?? null;
      setFormData(prev => ({ ...prev, [name]: file }));
    } else {
      setFormData(prev => ({ ...prev, [name]: e.target.value }));
    }

    if (message.text) setMessage({});
  };

  const handleUpload = async (): Promise<void> => {
    setIsLoading(true);
    setMessage({});
    try {
      let imageUrl = '';

      if (formData.imageFile) {
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
        tags: formData.tags.split(',').map(tag => tag.trim()),
      });

      if (insertError) throw insertError;

      setMessage({ type: 'success', text: 'Meal uploaded successfully!' });
      setFormData(initialFormData);

      const fileInput = document.getElementById('meal-imageFile') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';

    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'An unknown error occurred.';
      setMessage({ type: 'error', text: `Error: ${errMsg}` });
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "mb-2 w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100";
  const textareaClass = `${inputClass} h-24`;

  return (
    <div className="p-4 sm:p-6 bg-white rounded-xl shadow-lg">
      <h2 className="text-xl sm:text-2xl font-bold mb-6 text-gray-800 text-center">Upload a New Meal</h2>
      <form onSubmit={(e) => { e.preventDefault(); handleUpload(); }} className="space-y-4">
        <input id="meal-name" type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Meal Name" className={inputClass} disabled={isLoading} required />
        <input id="meal-imageFile" type="file" name="imageFile" accept="image/*" onChange={handleChange} className={`${inputClass} file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100`} disabled={isLoading} />
        <textarea id="meal-ingredients" name="ingredients" value={formData.ingredients} onChange={handleChange} placeholder="Ingredients (one per line)" className={textareaClass} disabled={isLoading} required />
        <textarea id="meal-steps" name="steps" value={formData.steps} onChange={handleChange} placeholder="Steps (one per line)" className={textareaClass} disabled={isLoading} required />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input id="meal-calories" type="number" name="calories" value={formData.calories} onChange={handleChange} placeholder="Calories" className={inputClass} disabled={isLoading} />
          <input id="meal-cost" type="text" name="cost" value={formData.cost} onChange={handleChange} placeholder="Estimated Cost" className={inputClass} disabled={isLoading} />
          <input id="meal-cookTime" type="text" name="cookTime" value={formData.cookTime} onChange={handleChange} placeholder="Cook Time" className={inputClass} disabled={isLoading} />
          <input id="meal-cookTemp" type="text" name="cookTemp" value={formData.cookTemp} onChange={handleChange} placeholder="Cook Temp" className={inputClass} disabled={isLoading} />
        </div>

        <input id="meal-tags" type="text" name="tags" value={formData.tags} onChange={handleChange} placeholder="Tags (comma separated)" className={inputClass} disabled={isLoading} />

        <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400" disabled={isLoading || !formData.name}>
          {isLoading ? 'Uploading...' : 'Upload Meal'}
        </button>

        {message.text && (
          <p className={`mt-4 text-sm p-3 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message.text}
          </p>
        )}
      </form>
    </div>
  );
};

export default UploadMeal;

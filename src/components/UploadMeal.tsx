// src/components/UploadMeal.tsx
import React, { useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

const UploadMeal: React.FC = () => {
  const supabase = useSupabaseClient();

  const [formData, setFormData] = useState({
    name: '',
    imageFile: null as File | null,
    ingredients: '',
    steps: '',
    calories: '',
    cost: '',
    cookTime: '',
    cookTemp: '',
    tags: ''
  });

  const [message, setMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, files } = e.target as any;
    setFormData(prev => ({
      ...prev,
      [name]: files ? files[0] : value
    }));
  };

  const handleUpload = async () => {
    try {
      let imageUrl = '';
      if (formData.imageFile) {
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

      setMessage('Meal uploaded successfully!');
    } catch (err: any) {
      console.error(err);
      setMessage(`Error: ${err.message}`);
    }
  };

  return (
    <div className="p-4 bg-white rounded-xl shadow-md">
      <h2 className="text-xl font-bold mb-3">Upload a New Meal</h2>

      <input type="text" name="name" placeholder="Meal name" onChange={handleChange} className="mb-2 w-full p-2 border" />
      <input type="file" name="imageFile" accept="image/*" onChange={handleChange} className="mb-2 w-full p-2" />
      <textarea name="ingredients" placeholder="Ingredients (one per line)" onChange={handleChange} className="mb-2 w-full p-2 border" rows={5} />
      <textarea name="steps" placeholder="Steps (one per line)" onChange={handleChange} className="mb-2 w-full p-2 border" rows={5} />
      <input type="text" name="calories" placeholder="Calories" onChange={handleChange} className="mb-2 w-full p-2 border" />
      <input type="text" name="cost" placeholder="Estimated Cost" onChange={handleChange} className="mb-2 w-full p-2 border" />
      <input type="text" name="cookTime" placeholder="Cook Time" onChange={handleChange} className="mb-2 w-full p-2 border" />
      <input type="text" name="cookTemp" placeholder="Cook Temperature" onChange={handleChange} className="mb-2 w-full p-2 border" />
      <input type="text" name="tags" placeholder="Tags (comma-separated)" onChange={handleChange} className="mb-4 w-full p-2 border" />

      <button onClick={handleUpload} className="bg-blue-700 text-white px-4 py-2 rounded-xl hover:bg-green-500 transition">
        Upload Meal
      </button>

      {message && <p className="mt-3 text-sm">{message}</p>}
    </div>
  );
};

export default UploadMeal;


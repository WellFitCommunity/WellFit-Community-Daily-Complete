import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

type Form = { email: string; password: string };

export default function LoginPage() {
  const { register, handleSubmit } = useForm<Form>({ defaultValues: { email: '', password: '' } });
  const navigate = useNavigate();

  const onSubmit = async (data: Form) => {
    const { error } = await supabase.auth.signInWithPassword(data);
    if (error) {
      alert(error.message);
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white w-full max-w-sm p-6 rounded-xl shadow space-y-4">
        <h1 className="text-xl font-bold text-center text-[#003865]">Sign In</h1>
        <input {...register('email')} type="email" placeholder="Email" className="w-full border rounded px-3 py-2"/>
        <input {...register('password')} type="password" placeholder="Password" className="w-full border rounded px-3 py-2"/>
        <button className="w-full rounded bg-[#003865] text-white py-2">Sign In</button>
        <p className="text-center text-sm text-gray-600">
          Don’t have an account? <Link className="text-blue-600 underline" to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
}

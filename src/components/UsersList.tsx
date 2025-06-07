// src/components/UsersList.tsx

import { useEffect, useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

type Profile = {
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  dob?: string;
  address?: string;
};

const UsersList: React.FC = () => {
  const supabase = useSupabaseClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      setLoading(true);
      setErrorMessage(null);
      const { data, error } = await supabase
        .from('profiles_with_user_id') // FIXED: Corrected table name
        .select('user_id, first_name, last_name, phone, dob, address'); // FIXED: Now fetches user_id

      if (error) {
        console.error('Error fetching profiles:', error.message);
        setProfiles([]);
        setErrorMessage(`Failed to load users: ${error.message}`);
      } else {
        setProfiles(data || []);
      }
      setLoading(false);
    };

    fetchProfiles();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <svg className="animate-spin h-8 w-8 text-wellfit-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="ml-2 text-gray-500">Loading users...</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl shadow" role="alert">
        <strong className="font-bold">Error:</strong>
        <span className="block sm:inline"> {errorMessage}</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-4 md:p-6 space-y-4">
      <h3 className="text-xl lg:text-2xl font-bold text-wellfit-blue">Registered Users</h3>
      {profiles.length === 0 && !errorMessage ? (
        <div className="flex flex-col items-center justify-center h-40">
          <svg className="h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 016-6h6M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="mt-2 text-gray-400">No users found.</p>
          {/* Optionally, add a button or link to invite users */}
          {/* <button className="mt-4 px-4 py-2 bg-wellfit-orange text-white rounded hover:bg-orange-600">Invite Users</button> */}
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((user) => (
            <li key={user.user_id} className="bg-gray-100 rounded-lg p-4 shadow hover:shadow-lg transition-shadow duration-200">
              <div className="font-semibold text-lg text-wellfit-purple">{user.first_name} {user.last_name}</div>
              <div className="text-sm text-gray-700 mt-1">{user.phone}</div>
              {user.dob && <div className="text-xs text-gray-500 mt-1">DOB: {user.dob}</div>}
              {user.address && <div className="text-xs text-gray-500 mt-1">Address: {user.address}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default UsersList;



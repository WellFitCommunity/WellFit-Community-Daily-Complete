// src/components/UsersList.tsx

import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data, error } = await supabase
        .from('profiles_with_user_id') // FIXED: Corrected table name
        .select('user_id, first_name, last_name, phone, dob, address'); // FIXED: Now fetches user_id

      if (error) {
        console.error('Error fetching profiles:', error.message);
        setProfiles([]);
      } else {
        setProfiles(data || []);
      }
      setLoading(false);
    };

    fetchProfiles();
  }, [supabase]);

  if (loading) return <p className="text-center text-gray-500">Loading users...</p>;

  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-3">
      <h3 className="text-xl font-bold text-wellfit-blue">Registered Users</h3>
      {profiles.length === 0 ? (
        <p className="text-center text-gray-400">No users found.</p>
      ) : (
        <ul className="space-y-2">
          {profiles.map((user) => (
            <li key={user.user_id} className="bg-gray-100 rounded-lg p-3"> {/* FIXED: key now uses user_id */}
              <div className="font-semibold">{user.first_name} {user.last_name}</div>
              <div className="text-sm text-gray-700">{user.phone}</div>
              {user.dob && <div className="text-sm text-gray-500">DOB: {user.dob}</div>}
              {user.address && <div className="text-sm text-gray-500">Address: {user.address}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default UsersList;



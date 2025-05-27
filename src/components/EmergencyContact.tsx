import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient'; // Added
import { useBranding } from '../BrandingContext'; // Added

interface Contact {
  firstName: string;
  lastName: string;
  phone: string;
  relationship: string;
  email: string; // Added email
}

const EmergencyContact: React.FC = () => {
  const branding = useBranding(); // Added
  const [contact, setContact] = useState<Contact>({
    firstName: '',
    lastName: '',
    phone: '',
    relationship: '',
    email: '', // Added email
  });
  const [editing, setEditing] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [userId, setUserId] = useState<string | null>(null); // Added to store user ID

  // Load user and contact data from Supabase
  useEffect(() => {
    const fetchUserAndContact = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('caregiver_first_name, caregiver_last_name, caregiver_phone, caregiver_relationship, caregiver_email')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching contact data:', error);
          setEditing(true); // Allow editing if fetch fails or no data
        } else if (profile) {
          const hasData = profile.caregiver_first_name || profile.caregiver_last_name || profile.caregiver_phone || profile.caregiver_relationship || profile.caregiver_email;
          setContact({
            firstName: profile.caregiver_first_name || '',
            lastName: profile.caregiver_last_name || '',
            phone: profile.caregiver_phone || '',
            relationship: profile.caregiver_relationship || '',
            email: profile.caregiver_email || '',
          });
          setEditing(!hasData); // If any field has data, view mode, else edit mode
        } else {
          setEditing(true); // No profile data found, allow editing
        }
      } else {
        // No user logged in, perhaps redirect or show message
        console.log("No user logged in");
        setEditing(false); // Prevent editing if no user
      }
    };

    fetchUserAndContact();
  }, []);

  const handleSave = async () => {
    if (!userId) {
      console.error("No user ID available to save contact.");
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        caregiver_first_name: contact.firstName,
        caregiver_last_name: contact.lastName,
        caregiver_phone: contact.phone,
        caregiver_relationship: contact.relationship,
        caregiver_email: contact.email,
      })
      .eq('id', userId);

    if (error) {
      console.error('Error saving contact data:', error);
      // Optionally, show an error message to the user
    } else {
      setEditing(false);
    }
  };

  const handle911 = () => {
    if (window.confirm('Are you sure you want to call 911?')) {
      window.location.href = 'tel:911';
    }
  };

  return (
    <section className="bg-white border-2 border-wellfit-green rounded-xl shadow-md max-w-md mx-auto">
      <header className="flex items-center justify-between p-4">
        <h2 className="text-xl font-semibold" style={{ color: branding.primaryColor }}> {/* Use branding color */}
          Next of Kin Contact
        </h2>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-2xl leading-none text-gray-500 hover:text-gray-700"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '…' : '•••'}
        </button>
      </header>

      {expanded && (
        <div className="p-4 space-y-4">
          {editing ? (
            <>
              <div>
                <label className="block text-gray-700">First Name</label>
                <input
                  type="text"
                  value={contact.firstName}
                  onChange={e =>
                    setContact({ ...contact, firstName: e.target.value })
                  }
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-gray-700">Last Name</label>
                <input
                  type="text"
                  value={contact.lastName}
                  onChange={e =>
                    setContact({ ...contact, lastName: e.target.value })
                  }
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-gray-700">Phone Number</label>
                <input
                  type="tel"
                  placeholder="000-000-0000"
                  value={contact.phone}
                  onChange={e =>
                    setContact({ ...contact, phone: e.target.value })
                  }
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-gray-700">Email</label> {/* Added Email Field */}
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={contact.email}
                  onChange={e =>
                    setContact({ ...contact, email: e.target.value })
                  }
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-gray-700">Relationship</label>
                <input
                  type="text"
                  placeholder="son, daughter, spouse, etc."
                  value={contact.relationship}
                  onChange={e =>
                    setContact({ ...contact, relationship: e.target.value })
                  }
                  className="w-full p-2 border rounded"
                />
              </div>
              <button
                onClick={handleSave}
                className="w-full py-2 bg-wellfit-blue text-white font-semibold rounded" // Existing wellfit-blue
                // style={{ backgroundColor: branding.primaryColor }} // Alternative if directly using branding object
              >
                Save Next of Kin
              </button>
            </>
          ) : (
            <>
              <p className="truncate overflow-hidden whitespace-nowrap">
                <strong>Name:</strong> {contact.firstName} {contact.lastName}
              </p>
              <p className="truncate overflow-hidden whitespace-nowrap">
                <strong>Phone:</strong> {contact.phone}
              </p>
              <p className="truncate overflow-hidden whitespace-nowrap"> {/* Added Email display */}
                <strong>Email:</strong> {contact.email}
              </p>
              <p className="truncate overflow-hidden whitespace-nowrap">
                <strong>Relationship:</strong> {contact.relationship}
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={() => setEditing(true)}
                  className="flex-1 py-2 bg-wellfit-green text-white font-semibold rounded" // Existing wellfit-green
                  // style={{ backgroundColor: branding.secondaryColor }} // Alternative if directly using branding object
                >
                  Edit
                </button>
                <button
                  onClick={handle911}
                  className="flex-1 py-2 bg-red-600 text-white font-semibold rounded"
                >
                  Call 911
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default EmergencyContact;

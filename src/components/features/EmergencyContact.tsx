// src/components/features/EmergencyContact.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useBranding } from '../../BrandingContext';

interface Contact {
  firstName: string;
  lastName: string;
  phone: string;
  relationship: string;
  email?: string;
}

interface ProfileCaregiverData {
  caregiver_first_name?: string | null;
  caregiver_last_name?: string | null;
  caregiver_phone?: string | null;
  caregiver_relationship?: string | null;
  caregiver_email?: string | null;
}

const EmergencyContact: React.FC = () => {
  // ✅ Correct: destructure from BrandingContext value
  const { branding } = useBranding();
  const primaryColor = branding?.primaryColor ?? '#0FA958';

  const [contact, setContact] = useState<Contact>({
    firstName: '',
    lastName: '',
    phone: '',
    relationship: '',
    email: '',
  });
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type?: 'success' | 'error' | 'info'; text?: string } | null>(null);

  useEffect(() => {
    const fetchUserAndContact = async (): Promise<void> => {
      setIsLoadingData(true);
      setMessage(null);
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        if (user) {
          setUserId(user.id);
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('caregiver_first_name, caregiver_last_name, caregiver_phone, caregiver_relationship, caregiver_email')
            .eq('id', user.id)
            .single(); // keep runtime typing simple

          if (profileError && (profileError as any).code !== 'PGRST116') {
            throw profileError;
          }

          if (profileData) {
            const d = profileData as ProfileCaregiverData;
            const hasData =
              d.caregiver_first_name || d.caregiver_last_name || d.caregiver_phone || d.caregiver_relationship || d.caregiver_email;

            setContact({
              firstName: d.caregiver_first_name || '',
              lastName: d.caregiver_last_name || '',
              phone: d.caregiver_phone || '',
              relationship: d.caregiver_relationship || '',
              email: d.caregiver_email || '',
            });
            setEditing(!hasData);
          } else {
            setEditing(true);
          }
        } else {
          setMessage({ type: 'info', text: 'Please log in to manage emergency contact.' });
          setEditing(false);
        }
      } catch (error) {

        const text = error instanceof Error ? error.message : 'An unknown error occurred.';
        setMessage({ type: 'error', text: `Error fetching data: ${text}` });
        setEditing(true);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchUserAndContact();
  }, []);

  const handleSave = async (): Promise<void> => {
    if (!userId) {
      setMessage({ type: 'error', text: 'No user ID available. Cannot save.' });
      return;
    }
    if (!contact.firstName || !contact.lastName || !contact.phone || !contact.relationship) {
      setMessage({ type: 'error', text: 'All fields (except email) are required to save.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
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

      if (error) throw error;

      setMessage({ type: 'success', text: 'Contact information saved successfully!' });
      setEditing(false);
    } catch (error) {

      const text = error instanceof Error ? error.message : 'An unknown error occurred.';
      setMessage({ type: 'error', text: `Error saving data: ${text}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handle911 = (): void => {
    if (window.confirm('Are you sure you want to call 911?')) {
      window.location.href = 'tel:911';
    }
  };

  return (
    <section className="bg-white border-2 border-wellfit-green rounded-xl shadow-md max-w-md mx-auto">
      <header className="flex items-center justify-between p-4">
        <h2 className="text-xl font-semibold" style={{ color: primaryColor }}>
          Next of Kin Contact
        </h2>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-2xl leading-none text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 rounded-sm"
          aria-label={expanded ? 'Collapse contact form' : 'Expand contact form'}
          aria-expanded={expanded}
        >
          {expanded ? '−' : '+'}
        </button>
      </header>

      {expanded && (
        <div className="p-4 space-y-4">
          {isLoadingData ? (
            <p className="text-center text-gray-600">Loading contact information...</p>
          ) : editing ? (
            <>
              {message?.text && (
                <div
                  role="status"
                  aria-live={message.type === 'error' ? 'assertive' : 'polite'}
                  className={`p-3 mb-3 rounded-md text-sm text-white ${
                    message.type === 'success' ? 'bg-green-500' :
                    message.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                >
                  {message.text}
                </div>
              )}

              <div>
                <label htmlFor="ec-firstName" className="block text-sm font-medium text-gray-700">First Name</label>
                <input
                  type="text"
                  id="ec-firstName"
                  value={contact.firstName}
                  onChange={(e) => setContact({ ...contact, firstName: e.target.value })}
                  className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                  disabled={isSaving}
                  aria-required="true"
                />
              </div>

              <div>
                <label htmlFor="ec-lastName" className="block text-sm font-medium text-gray-700">Last Name</label>
                <input
                  type="text"
                  id="ec-lastName"
                  value={contact.lastName}
                  onChange={(e) => setContact({ ...contact, lastName: e.target.value })}
                  className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                  disabled={isSaving}
                  aria-required="true"
                />
              </div>

              <div>
                <label htmlFor="ec-phone" className="block text-sm font-medium text-gray-700">Phone Number</label>
                <input
                  type="tel"
                  id="ec-phone"
                  placeholder="000-000-0000"
                  value={contact.phone}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                  className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                  disabled={isSaving}
                  aria-required="true"
                />
              </div>

              <div>
                <label htmlFor="ec-email" className="block text-sm font-medium text-gray-700">Email (Optional)</label>
                <input
                  type="email"
                  id="ec-email"
                  placeholder="name@example.com"
                  value={contact.email || ''}
                  onChange={(e) => setContact({ ...contact, email: e.target.value })}
                  className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                  disabled={isSaving}
                />
              </div>

              <div>
                <label htmlFor="ec-relationship" className="block text-sm font-medium text-gray-700">Relationship</label>
                <input
                  type="text"
                  id="ec-relationship"
                  placeholder="son, daughter, spouse, etc."
                  value={contact.relationship}
                  onChange={(e) => setContact({ ...contact, relationship: e.target.value })}
                  className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                  disabled={isSaving}
                  aria-required="true"
                />
              </div>

              <button
                onClick={handleSave}
                disabled={isSaving || !userId}
                className="w-full py-2 bg-wellfit-blue text-white font-semibold rounded-md shadow-sm hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-wellfit-blue disabled:bg-gray-400"
              >
                {isSaving ? 'Saving...' : 'Save Next of Kin'}
              </button>
            </>
          ) : (
            <>
              {message?.text && (
                <div className={`p-3 mb-3 rounded-md text-sm text-white ${
                  message.type === 'success' ? 'bg-green-500' :
                  message.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                }`}>
                  {message.text}
                </div>
              )}

              {(contact.firstName || contact.lastName) ? (
                <>
                  <p className="truncate"><strong>Name:</strong> {contact.firstName} {contact.lastName}</p>
                  <p className="truncate"><strong>Phone:</strong> {contact.phone}</p>
                  {contact.email && <p className="truncate"><strong>Email:</strong> {contact.email}</p>}
                  <p className="truncate"><strong>Relationship:</strong> {contact.relationship}</p>
                </>
              ) : (
                <p className="text-gray-500">No contact information available. Please add a contact.</p>
              )}

              <div className="flex space-x-4 mt-4">
                <button
                  onClick={() => { setEditing(true); setMessage(null); }}
                  disabled={!userId || isLoadingData}
                  className="flex-1 py-2 bg-wellfit-green text-white font-semibold rounded-md shadow-sm hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-wellfit-green disabled:bg-gray-400"
                >
                  {contact.firstName || contact.lastName ? 'Edit' : 'Add Contact'}
                </button>
                <button
                  onClick={handle911}
                  className="flex-1 py-2 bg-red-600 text-white font-semibold rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600"
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

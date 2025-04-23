import React, { useState, useEffect } from 'react';

interface Contact {
  firstName: string;
  lastName: string;
  phone: string;
  relationship: string;
}

const EmergencyContact: React.FC = () => {
  const [contact, setContact] = useState<Contact>({
    firstName: '',
    lastName: '',
    phone: '',
    relationship: '',
  });
  const [editing, setEditing] = useState(true);
  const [expanded, setExpanded] = useState(true); // new state for collapse/expand

  // Load saved contact
  useEffect(() => {
    const saved = localStorage.getItem('nextOfKin');
    if (saved) {
      setContact(JSON.parse(saved));
      setEditing(false);
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('nextOfKin', JSON.stringify(contact));
    setEditing(false);
  };

  const handle911 = () => {
    if (window.confirm('Are you sure you want to call 911?')) {
      window.location.href = 'tel:911';
    }
  };

  return (
    <section className="bg-white border-2 border-wellfit-green rounded-xl shadow-md max-w-md mx-auto">
      {/* Header with ellipsis toggle */}
      <header className="flex items-center justify-between p-4">
        <h2 className="text-xl font-semibold text-wellfit-blue">
          Next of Kin Contact
        </h2>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-2xl leading-none text-gray-500 hover:text-gray-700"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {/* Show … when expanded, ••• when collapsed */}
          {expanded ? '…' : '•••'}
        </button>
      </header>

      {/* Collapsible content */}
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
                className="w-full py-2 bg-wellfit-blue text-white font-semibold rounded"
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
              <p className="truncate overflow-hidden whitespace-nowrap">
                <strong>Relationship:</strong> {contact.relationship}
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={() => setEditing(true)}
                  className="flex-1 py-2 bg-wellfit-green text-white font-semibold rounded"
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

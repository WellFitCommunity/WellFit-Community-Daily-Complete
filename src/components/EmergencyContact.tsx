import React, { useState } from 'react';

const EmergencyContact = () => {
  const [show, setShow] = useState(false);

  return (
    <section className="bg-white border-2 border-[#8cc63f] p-4 rounded-xl shadow">
      <h2 className="text-xl font-semibold text-[#003865] mb-2">Emergency Contact</h2>
      <button
        onClick={() => setShow(!show)}
        className="text-[#003865] font-medium underline"
      >
        {show ? 'Hide Contacts' : 'Show Contacts...'}
      </button>
      {show && (
        <ul className="mt-2 text-gray-700 text-sm list-disc list-inside">
          <li>Call Nurse Station: (555) 123-4567</li>
          <li>Community Director: (555) 987-6543</li>
          <li>Emergency Services: 911</li>
        </ul>
      )}
    </section>
  );
};

export default EmergencyContact;

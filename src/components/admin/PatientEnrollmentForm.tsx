import React from 'react';
import { Printer } from 'lucide-react';

/**
 * Printable Patient Enrollment Form Component
 *
 * This component renders a standardized paper form that can be:
 * 1. Printed for use during power/internet outages
 * 2. Filled out by hand
 * 3. Photographed/scanned
 * 4. Auto-processed via Claude Vision API
 *
 * Design considerations:
 * - High contrast for better OCR accuracy
 * - Clearly labeled fields
 * - Adequate spacing for handwriting
 * - Checkbox options for common values
 * - Grid lines for alignment
 */

const PatientEnrollmentForm: React.FC = () => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Print Button - Hidden when printing */}
      <div className="print:hidden mb-6 flex justify-end">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Printer className="w-5 h-5" />
          Print Form
        </button>
      </div>

      {/* Printable Form */}
      <div className="bg-white p-8 border-2 border-black print:border-0">
        {/* Header */}
        <div className="text-center border-b-4 border-black pb-4 mb-6">
          <h1 className="text-3xl font-bold">HOSPITAL PATIENT ENROLLMENT FORM</h1>
          <p className="text-lg mt-2">WellFit Community Health System</p>
          <p className="text-sm mt-1">Emergency Backup Form - For use during system outages</p>
        </div>

        {/* Instructions */}
        <div className="bg-gray-100 border-2 border-gray-400 p-4 mb-6 print:bg-white">
          <p className="font-bold">INSTRUCTIONS:</p>
          <ul className="list-disc ml-6 text-sm mt-2">
            <li>Print clearly in BLACK INK or use BLUE INK only</li>
            <li>Mark checkboxes with an X</li>
            <li>Use MM/DD/YYYY format for dates</li>
            <li>Take a clear photo when systems are restored for auto-upload</li>
          </ul>
        </div>

        {/* Form ID */}
        <div className="mb-6 border-2 border-black p-3">
          <label className="font-bold text-lg">FORM ID (Auto-assigned):</label>
          <div className="border-b-2 border-gray-400 mt-2 h-8"></div>
        </div>

        {/* Section 1: Patient Demographics */}
        <div className="mb-6">
          <h2 className="text-xl font-bold bg-gray-800 text-white p-2 mb-4">
            1. PATIENT DEMOGRAPHICS
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="font-bold">Last Name:</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
            <div>
              <label className="font-bold">First Name:</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="font-bold">Middle Initial:</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
            <div>
              <label className="font-bold">Date of Birth (MM/DD/YYYY):</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
            <div>
              <label className="font-bold">Age:</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
          </div>

          <div className="mb-4">
            <label className="font-bold">Gender:</label>
            <div className="flex gap-6 mt-2">
              <label className="flex items-center">
                <div className="w-6 h-6 border-2 border-black mr-2"></div>
                Male
              </label>
              <label className="flex items-center">
                <div className="w-6 h-6 border-2 border-black mr-2"></div>
                Female
              </label>
              <label className="flex items-center">
                <div className="w-6 h-6 border-2 border-black mr-2"></div>
                Other
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="font-bold">Medical Record Number (MRN):</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
            <div>
              <label className="font-bold">Social Security Number:</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
          </div>
        </div>

        {/* Section 2: Contact Information */}
        <div className="mb-6">
          <h2 className="text-xl font-bold bg-gray-800 text-white p-2 mb-4">
            2. CONTACT INFORMATION
          </h2>

          <div className="mb-4">
            <label className="font-bold">Phone Number:</label>
            <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
          </div>

          <div className="mb-4">
            <label className="font-bold">Email Address:</label>
            <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
          </div>

          <div className="mb-4">
            <label className="font-bold">Street Address:</label>
            <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="font-bold">City:</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
            <div>
              <label className="font-bold">State:</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
            <div>
              <label className="font-bold">ZIP Code:</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
          </div>
        </div>

        {/* Section 3: Emergency Contact */}
        <div className="mb-6">
          <h2 className="text-xl font-bold bg-gray-800 text-white p-2 mb-4">
            3. EMERGENCY CONTACT
          </h2>

          <div className="mb-4">
            <label className="font-bold">Emergency Contact Name:</label>
            <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="font-bold">Relationship:</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
            <div>
              <label className="font-bold">Emergency Contact Phone:</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
          </div>
        </div>

        {/* Section 4: Hospital Admission Details */}
        <div className="mb-6">
          <h2 className="text-xl font-bold bg-gray-800 text-white p-2 mb-4">
            4. HOSPITAL ADMISSION DETAILS
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="font-bold">Admission Date (MM/DD/YYYY):</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
            <div>
              <label className="font-bold">Admission Time:</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="font-bold">Hospital Unit:</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
            <div>
              <label className="font-bold">Room Number:</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
            <div>
              <label className="font-bold">Bed Number:</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
          </div>

          <div className="mb-4">
            <label className="font-bold">Admission Source:</label>
            <div className="flex flex-wrap gap-4 mt-2">
              <label className="flex items-center">
                <div className="w-6 h-6 border-2 border-black mr-2"></div>
                Emergency Room
              </label>
              <label className="flex items-center">
                <div className="w-6 h-6 border-2 border-black mr-2"></div>
                Physician Referral
              </label>
              <label className="flex items-center">
                <div className="w-6 h-6 border-2 border-black mr-2"></div>
                Transfer
              </label>
              <label className="flex items-center">
                <div className="w-6 h-6 border-2 border-black mr-2"></div>
                Other
              </label>
            </div>
          </div>

          <div className="mb-4">
            <label className="font-bold">Acuity Level:</label>
            <div className="flex flex-wrap gap-4 mt-2">
              <label className="flex items-center">
                <div className="w-6 h-6 border-2 border-black mr-2"></div>
                1-Critical
              </label>
              <label className="flex items-center">
                <div className="w-6 h-6 border-2 border-black mr-2"></div>
                2-High
              </label>
              <label className="flex items-center">
                <div className="w-6 h-6 border-2 border-black mr-2"></div>
                3-Moderate
              </label>
              <label className="flex items-center">
                <div className="w-6 h-6 border-2 border-black mr-2"></div>
                4-Low
              </label>
              <label className="flex items-center">
                <div className="w-6 h-6 border-2 border-black mr-2"></div>
                5-Stable
              </label>
            </div>
          </div>

          <div className="mb-4">
            <label className="font-bold">Code Status:</label>
            <div className="flex flex-wrap gap-4 mt-2">
              <label className="flex items-center">
                <div className="w-6 h-6 border-2 border-black mr-2"></div>
                Full Code
              </label>
              <label className="flex items-center">
                <div className="w-6 h-6 border-2 border-black mr-2"></div>
                DNR
              </label>
              <label className="flex items-center">
                <div className="w-6 h-6 border-2 border-black mr-2"></div>
                DNR/DNI
              </label>
              <label className="flex items-center">
                <div className="w-6 h-6 border-2 border-black mr-2"></div>
                Comfort Care
              </label>
            </div>
          </div>
        </div>

        {/* Section 5: Insurance Information */}
        <div className="mb-6">
          <h2 className="text-xl font-bold bg-gray-800 text-white p-2 mb-4">
            5. INSURANCE INFORMATION
          </h2>

          <div className="mb-4">
            <label className="font-bold">Primary Insurance:</label>
            <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="font-bold">Insurance ID Number:</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
            <div>
              <label className="font-bold">Group Number:</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="font-bold">Medicare Number (if applicable):</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
            <div>
              <label className="font-bold">Medicaid Number (if applicable):</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
          </div>
        </div>

        {/* Section 6: Clinical Notes */}
        <div className="mb-6">
          <h2 className="text-xl font-bold bg-gray-800 text-white p-2 mb-4">
            6. CLINICAL NOTES / CHIEF COMPLAINT
          </h2>

          <div className="mb-2">
            <label className="font-bold">Reason for Admission / Clinical Notes:</label>
          </div>
          <div className="border-2 border-gray-400 p-2 min-h-[120px]">
            {/* Lined area for writing */}
            {[...Array(5)].map((_, i) => (
              <div key={i} className="border-b border-gray-300 h-6"></div>
            ))}
          </div>
        </div>

        {/* Section 7: Allergies */}
        <div className="mb-6">
          <h2 className="text-xl font-bold bg-gray-800 text-white p-2 mb-4">
            7. ALLERGIES
          </h2>

          <div className="mb-2">
            <label className="flex items-center">
              <div className="w-6 h-6 border-2 border-black mr-2"></div>
              <span className="font-bold">No Known Allergies (NKDA)</span>
            </label>
          </div>

          <div className="mb-2">
            <label className="font-bold">Known Allergies (list all):</label>
          </div>
          <div className="border-2 border-gray-400 p-2 min-h-[80px]">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border-b border-gray-300 h-6"></div>
            ))}
          </div>
        </div>

        {/* Section 8: Staff Information */}
        <div className="mb-6">
          <h2 className="text-xl font-bold bg-gray-800 text-white p-2 mb-4">
            8. STAFF INFORMATION (To be completed by registering staff)
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="font-bold">Staff Name (Print):</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
            <div>
              <label className="font-bold">Staff Signature:</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="font-bold">Date Completed (MM/DD/YYYY):</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
            <div>
              <label className="font-bold">Time Completed:</label>
              <div className="border-b-2 border-gray-400 mt-1 h-8"></div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-4 border-black pt-4 mt-8 text-center text-sm">
          <p className="font-bold">FOR OFFICIAL USE ONLY - CONFIDENTIAL MEDICAL INFORMATION</p>
          <p className="mt-2">
            When systems are restored, photograph this form clearly and upload via Admin Panel → Paper Form Scanner
          </p>
          <p className="mt-2">Form Version 1.0 | WellFit Community Health System</p>
        </div>
      </div>
    </div>
  );
};

export default PatientEnrollmentForm;

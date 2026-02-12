// FHIR Integration Service — Patient Resource Mapper
// Maps WellFit profiles to FHIR R4 Patient resources

import type { FHIRPatient, Profile } from './types';

/**
 * Parse a comma-separated address string into FHIR Address format.
 */
export function parseAddress(address: string): Array<{
  use: string;
  type: string;
  line: string[];
  city: string;
  state: string;
  postalCode: string;
  country: string;
}> {
  // Simple address parsing - you might want to enhance this
  const parts = address.split(',').map(p => p.trim());
  return [
    {
      use: 'home',
      type: 'both',
      line: parts.slice(0, -3),
      city: parts[parts.length - 3] || '',
      state: parts[parts.length - 2] || '',
      postalCode: parts[parts.length - 1] || '',
      country: 'US'
    }
  ];
}

/**
 * Create a FHIR R4 Patient resource from a WellFit profile.
 */
export function createPatientResource(
  profile: Profile,
  organizationSystem: string
): FHIRPatient {
  const patient: FHIRPatient = {
    resourceType: 'Patient',
    id: profile.user_id,
    identifier: [
      {
        use: 'usual',
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'MR',
              display: 'Medical Record Number'
            }
          ]
        },
        system: organizationSystem,
        value: `WF-${profile.user_id.slice(0, 8)}`
      }
    ],
    active: true,
    name: [
      {
        use: 'official',
        family: profile.last_name,
        given: [profile.first_name]
      }
    ],
    telecom: [
      {
        system: 'phone',
        value: profile.phone,
        use: 'home'
      }
    ],
    gender: 'unknown', // You might want to add gender to profiles table
    birthDate: profile.dob || '',
    address: profile.address ? parseAddress(profile.address) : []
  };

  // Add email if present
  if (profile.email) {
    patient.telecom.push({
      system: 'email',
      value: profile.email,
      use: 'home'
    });
  }

  // Add emergency contact if present
  if (profile.emergency_contact_name && profile.caregiver_email) {
    patient.contact = [
      {
        relationship: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
                code: 'C',
                display: 'Emergency Contact'
              }
            ]
          }
        ],
        name: {
          family: profile.emergency_contact_name.split(' ').pop() || '',
          given: profile.emergency_contact_name.split(' ').slice(0, -1)
        },
        telecom: [
          {
            system: 'email',
            value: profile.caregiver_email
          }
        ]
      }
    ];
  }

  return patient;
}

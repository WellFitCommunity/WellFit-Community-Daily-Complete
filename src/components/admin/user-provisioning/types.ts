/**
 * Types for User Provisioning UI components
 */

/** Role options supported by admin_register edge function */
export interface ProvisioningRole {
  code: number;
  slug: string;
  label: string;
  level: 'elevated' | 'public';
}

/** Input for single user invite */
export interface InviteUserInput {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role_code: number;
  delivery: 'email' | 'sms' | 'none';
}

/** Response from admin_register edge function */
export interface InviteUserResult {
  success: boolean;
  user_id: string;
  role_code: number;
  role_slug: string;
  delivery: string;
  temporary_password: string;
  info: string;
}

/** Pending registration row from DB */
export interface PendingRegistration {
  id: string;
  phone: string | null;
  email: string | null;
  first_name: string;
  last_name: string;
  role_code: number | null;
  role_slug: string | null;
  hcaptcha_verified: boolean;
  verification_code_sent: boolean;
  created_at: string;
  expires_at: string | null;
}

export interface InviteUserFormProps {
  roles: ProvisioningRole[];
  saving: boolean;
  onInvite: (input: InviteUserInput) => void;
  lastResult: InviteUserResult | null;
  onClearResult: () => void;
}

export interface PendingInvitationsTableProps {
  invitations: PendingRegistration[];
  loading: boolean;
  onRefresh: () => void;
  onDelete: (id: string) => void;
}

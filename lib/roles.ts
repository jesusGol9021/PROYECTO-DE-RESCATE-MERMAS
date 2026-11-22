export type Role = 'donor' | 'receiver' | 'admin'
export type VerificationStatus = 'pending' | 'approved' | 'rejected'

export const ROLE_LABELS: Record<Role, string> = {
  donor: 'Donante',
  receiver: 'Receptor',
  admin: 'Administrador',
}

export function isRole(value: unknown): value is Role {
  return value === 'donor' || value === 'receiver' || value === 'admin'
}

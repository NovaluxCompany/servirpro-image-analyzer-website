export interface SystemUser {
  id: number;
  email?: string;
  name?: string;
  documentNumber?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  roleName?: string;
  roleId?: number;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  name: string;
  documentNumber?: string;
  isActive?: boolean;
}

export interface UpdateUserPayload {
  email?: string;
  password?: string;
  name?: string;
  documentNumber?: string;
  isActive?: boolean;
}

export const ROLE_OPTIONS: { id: number; label: string }[] = [
  { id: 1, label: 'Administrador' },
  { id: 2, label: 'Asesor' },
  { id: 3, label: 'Pagos' },
  { id: 4, label: 'Cargar Afiliados' },
];

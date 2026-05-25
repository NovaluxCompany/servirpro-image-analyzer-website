import { Menu, MenuPermission } from '../../menu/interfaces/menu.interface';

export interface RoleMenuPermission {
  id?: number;
  roleId: number;
  menuPermissionId: number;
  menuPermission?: MenuPermission;
}

export interface Role {
  id?: number;
  name: string;
  description?: string;
  isActive: boolean;
  roleMenuPermissions?: RoleMenuPermission[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedRoles {
  items: Role[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

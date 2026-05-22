export interface Permission {
  id: number;
  code: string;
  description: string;
}

export interface MenuPermission {
  id: number;
  menuId: number;
  permissionId: number;
  permission: Permission;
  menu?: Menu;
}

export interface Menu {
  id?: number;
  name: string;
  icon: string;
  path: string;
  parentId?: number | null;
  sortOrder?: number;
  isActive: boolean;
  menuPermissions?: MenuPermission[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedMenus {
  items: Menu[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

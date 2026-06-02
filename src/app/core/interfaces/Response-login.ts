export interface UserMenu {
  label: string;
  path: string;
  permissions: string[];
}

export interface UserInfo {
  id: number;
  email: string;
  name: string;
  roles: string[];
  roleIds?: number[];
  menuPaths: string[];
  menus?: UserMenu[];
}

export interface ResponseLogin {
  access_token: string;
  user: UserInfo;
}


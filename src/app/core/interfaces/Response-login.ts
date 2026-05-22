export interface UserInfo {
  id: number;
  email: string;
  name: string;
  roles: string[];
  menuPaths: string[];
}

export interface ResponseLogin {
  access_token: string;
  user: UserInfo;
}


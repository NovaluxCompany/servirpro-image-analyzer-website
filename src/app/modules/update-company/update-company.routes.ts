import { Routes } from "@angular/router";
import { roleGuard } from "../../core/guard/role.guard";
import { LoginGuardian } from "../../core/guard/login-guard";
import { UpdateCompanyList } from "./pages/update-company-list";

export const updateCompanyRoutes: Routes = [
  {
    path: '',
    component: UpdateCompanyList,
    canActivate: [LoginGuardian, roleGuard],
  },
];

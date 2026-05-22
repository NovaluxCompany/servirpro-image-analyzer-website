import { Routes } from "@angular/router";
import { MenuComponent } from "../pages/menu-list";
import { LoginGuardian } from "../../../core/guard/login-guard";
import { roleGuard } from "../../../core/guard/role.guard";

export const menuRoutes: Routes = [
    {
        path: '',
        component: MenuComponent,
        canActivate: [LoginGuardian, roleGuard]
    }
];

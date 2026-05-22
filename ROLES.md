# Matriz de Roles y Accesos — ServiPro

## Roles disponibles

| Rol | Nombre en BD | Descripción |
|-----|-------------|-------------|
| Administrador | `admin` | Acceso total al sistema: afiliados, transacciones, menús y roles |
| Supervisor | `supervisor` | Puede ver y gestionar afiliados y transacciones, sin acceso a configuración del sistema |
| Asesor | `asesor` | Puede ver afiliados, crear y ver transacciones propias |

> **Importante:** estos nombres (`admin`, `supervisor`, `asesor`) deben coincidir **exactamente** con los que el backend guarda en el campo `roles[]` del token JWT. Si el backend usa otro nombre (p. ej. `ADMIN`, `Administrador`), se debe actualizar el campo `data.roles` en los archivos de rutas correspondientes.

> **Superadmin:** si el backend retorna `roles: []` (array vacío), el guard concede acceso total a todas las rutas. Esto permite que el usuario inicial/demo acceda sin restricciones mientras se configuran los roles en el sistema.

---

## Acceso por módulo y ruta

### `/afiliados` — Gestión de afiliados

| Acción | admin | supervisor | asesor |
|--------|:-----:|:----------:|:------:|
| Ver listado de afiliados | ✅ | ✅ | ✅ |
| Crear nuevo afiliado | ✅ | ✅ | ✅ |
| Editar afiliado | ✅ | ✅ | ✅ |
| Activar / desactivar afiliado | ✅ | ✅ | ❌ |
| Enviar correo al afiliado | ✅ | ✅ | ✅ |
| Subir documento de identidad (PDF) | ✅ | ✅ | ✅ |
| Descargar documento de identidad | ✅ | ✅ | ✅ |

> Protegido en ruta: `data: { roles: ['admin', 'supervisor', 'asesor'] }`

---

### `/transacciones` — Gestión de transacciones

| Acción | admin | supervisor | asesor |
|--------|:-----:|:----------:|:------:|
| Ver listado de transacciones | ✅ | ✅ | ✅ |
| Ver detalle de transacción | ✅ | ✅ | ✅ |
| Crear nueva transacción | ✅ | ❌ | ✅ |
| Exportar a Excel | ✅ | ✅ | ✅ |

> - Listado y detalle: `data: { roles: ['admin', 'supervisor', 'asesor'] }`
> - Crear (`/transacciones/crear`): `data: { roles: ['admin', 'asesor'] }`

---

### `/menu` — Configuración de menús

| Acción | admin | supervisor | asesor |
|--------|:-----:|:----------:|:------:|
| Ver menús | ✅ | ❌ | ❌ |
| Crear menú | ✅ | ❌ | ❌ |
| Editar menú | ✅ | ❌ | ❌ |
| Eliminar menú | ✅ | ❌ | ❌ |

> Protegido en ruta: `data: { roles: ['admin'] }`

---

### `/roles` — Configuración de roles

| Acción | admin | supervisor | asesor |
|--------|:-----:|:----------:|:------:|
| Ver roles | ✅ | ❌ | ❌ |
| Crear rol | ✅ | ❌ | ❌ |
| Editar rol | ✅ | ❌ | ❌ |
| Eliminar rol | ✅ | ❌ | ❌ |
| Asignar permisos de menú a rol | ✅ | ❌ | ❌ |

> Protegido en ruta: `data: { roles: ['admin'] }`

---

## Archivos modificados

| Archivo | Guard aplicado |
|---------|---------------|
| `src/app/core/guard/role.guard.ts` | **Nuevo** — guard funcional de roles |
| `src/app/app.routes.ts` | `roleGuard` en todos los módulos hijos |
| `src/app/modules/transactions/transactions.routes.ts` | `roleGuard` por ruta |
| `src/app/modules/affiliates/affiliates.routes.ts` | `roleGuard` |
| `src/app/modules/menu/services/menu.routes.ts` | `roleGuard` solo `admin` |
| `src/app/modules/roles/roles.routes.ts` | `roleGuard` solo `admin` |

---

## Cómo agregar un nuevo rol

1. Crear el rol en el backend con el nombre exacto (ej. `operador`).
2. Agregar el nombre a los `data: { roles: [...] }` de las rutas que le corresponden.
3. Documentar el acceso en esta tabla.

## Cómo agregar protección a un nuevo módulo

```typescript
// En el archivo de rutas del módulo
import { roleGuard } from '../../core/guard/role.guard';

{
  path: 'mi-modulo',
  component: MiComponente,
  canActivate: [LoginGuardian, roleGuard],
  data: { roles: ['admin', 'supervisor'] }  // roles que pueden acceder
}
```

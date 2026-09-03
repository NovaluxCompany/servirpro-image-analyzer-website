# Documentación de módulos y funciones — servirpro-image-analyzer-website

> Generado automáticamente a partir del código fuente en `src/`. Aplicación Angular (standalone components) para gestión de afiliados, transacciones/comprobantes de pago, roles/permisos y administración general de "Ritmo Vivo / Servirpro".

## Índice

1. [App raíz](#app-raíz)
2. [Auth](#auth)
3. [Core](#core)
   - [Guards](#core---guards)
   - [Interceptors](#core---interceptors)
   - [Services](#core---services)
   - [Interfaces](#core---interfaces)
   - [Components](#core---components)
4. [Shared](#shared)
5. [Módulo: Affiliates](#módulo-affiliates)
6. [Módulo: Deactivate Affiliates](#módulo-deactivate-affiliates)
7. [Módulo: Menu](#módulo-menu)
8. [Módulo: Roles](#módulo-roles)
9. [Módulo: Transactions](#módulo-transactions-modulestransactions)
10. [Módulo: Update Company](#módulo-update-company)
11. [⚠️ Carpeta legacy duplicada: `src/app/transactions`](#carpeta-legacy-srcapptransactions-duplicado)
12. [Otros: Prueba Login, Environments, Bootstrap](#otros)
13. [Herramientas: script de CI](#herramientas-de-ci)

---

## ⚠️ Nota importante: código duplicado

Existen **dos copias casi completas** del módulo de transacciones:

- `src/app/modules/transactions/` — versión **activa/actual**, con `PermissionService`, `roleGuard`, función de inhabilitar transacciones (soft delete), columna de asesores, filtro `isActive=true` en todas las consultas.
- `src/app/transactions/` — copia **legacy**, sin control de permisos por rol, sin soft-delete, con un modelo de `Affiliate` más amplio (incluye teléfono/email/dirección) y con una inconsistencia de contrato de API (`search` vs `q` en la búsqueda de afiliados).

Ver detalle completo en la [sección dedicada](#carpeta-legacy-srcapptransactions-duplicado). Se recomienda evaluar eliminar `src/app/transactions/` si ya no está en uso, dado que ninguna ruta de `app.routes.ts` apunta a ella.

También existen dos servicios de catálogo duplicados dentro de `modules/affiliates/services/` (`compensation-box.service.ts`, `pension.service.ts`) que replican funcionalidad ya cubierta por `AffiliateMembersService`.

---

## App raíz

### `src/app/app.ts`
**Clase:** `App` (componente raíz, standalone) — shell de la aplicación, monta el `router-outlet` y el contenedor de toasts.

| Método | Descripción |
|---|---|
| `ngOnInit(): void` | Inicializa Flowbite (`initFlowbite()`) al arrancar el componente raíz. |

**Dependencias/estado:** `title` (signal, `'servirpro'`, protegido). Importa `RouterOutlet` y `ToastContainerComponent`.

### `src/app/app.config.ts`
Configuración de la aplicación (`ApplicationConfig`) usada por `bootstrapApplication`.
- `provideBrowserGlobalErrorListeners()` — listeners globales de error del navegador.
- `provideRouter(routes)` — registra las rutas de `app.routes.ts`.
- `provideHttpClient(withInterceptors([authInterceptor]))` — HttpClient con el interceptor de autenticación.
- `{ provide: DATE_PIPE_DEFAULT_TIMEZONE, useValue: 'America/Bogota' }` — zona horaria por defecto para el `DatePipe`.

### `src/app/app.routes.ts`
Define el árbol de rutas principal (`Routes`).
- `''` y `'login'` → componente `Login` (público).
- Ruta raíz `''` con `component: LayoutComponent`, protegida por `LoginGuardian` (`canActivate`), contiene rutas hijas *lazy* (`loadChildren`):
  - `transacciones` (protegida por `roleGuard`) → `modules/transactions/transactions.routes`
  - `afiliados` (protegida por `roleGuard`) → `modules/affiliates/affiliates.routes`
  - `menu` (protegida por `redirectBackGuard`) → `modules/menu/services/menu.routes`
  - `roles` (protegida por `redirectBackGuard`) → `modules/roles/roles.routes`
  - `desactivar-afiliados` (protegida por `roleGuard`) → `modules/deactivate-affiliates/deactivate-affiliates.routes`
  - `actualizar-compania` (protegida por `roleGuard`) → `modules/update-company/update-company.routes`
- `'**'` (wildcard) → `Login`, protegida por `redirectBackGuard`.

### `src/app/app.spec.ts`
Test unitario básico de Angular (Jasmine/TestBed) para `App`: verifica que el componente se crea correctamente y que renderiza un `<h1>` (nota: el texto esperado `'Hello, ritmovivo-dashboard'` parece un remanente de plantilla/boilerplate, no coincide con el `app.html` actual).

### `src/app/app.html`
Plantilla raíz: `<router-outlet>` + `<app-toast-container>`. Sin lógica.

---

## Auth

### `src/app/auth/login/login.ts`
**Clase:** `Login` (componente standalone) — formulario reactivo de inicio de sesión, valida credenciales y redirige al usuario según sus rutas de menú.

| Método | Descripción |
|---|---|
| `login(): void` | Punto de entrada del submit: resetea estado, valida el formulario y dispara la autenticación. |
| `resetState(): void` (privado) | Limpia token previo y mensajes de error. |
| `isFormValid(): boolean` (privado) | Valida el `FormGroup` y setea el mensaje de error correspondiente (campos requeridos, email inválido, password corta). |
| `executeAuthentication(): void` (privado) | Llama a `AuthService.loginDB`, calcula la ruta de destino a partir de `user.menus`/`user.menuPaths` (normaliza y limpia paths) y navega; maneja el error mostrando mensaje de credenciales incorrectas. |
| `togglePasswordVisibility(): void` | Alterna mostrar/ocultar contraseña. |
| `isFieldInvalid(fieldName: string): boolean` | Indica si un campo del formulario es inválido y ha sido tocado/modificado. |

**Estado:** `showError`, `messageError`, `isLoading`, `showPassword`, `form` (FormGroup con `email`, `password`).

**Dependencias inyectadas:** `TokenService`, `AuthService`, `Router`, `ChangeDetectorRef`, `FormBuilder`.

### `src/app/auth/login/login.html` (resumen)
Layout de dos paneles: branding a la izquierda (marca "ImageAnalyzer", features destacadas) y formulario de login a la derecha con campos de email/contraseña (control de visibilidad de password), alerta de error condicional, botón de submit con estado de carga (spinner) y overlay de "Conectando al servidor...". Usa control flow moderno (`@if`) y clases Tailwind.

---

## Core

### Core - Guards

#### `src/app/core/guard/login-guard.ts`
**Clase:** `LoginGuardian` (`CanActivate`, `providedIn: 'root'`) — protege rutas que requieren sesión activa.

| Método | Descripción |
|---|---|
| `canActivate(): boolean` | Si `LoginService.isAuthenticated()` es `true` permite el acceso; si no, navega a `/` y bloquea. |

**Dependencias:** `LoginService`, `Router`.

#### `src/app/core/guard/redirect-back.guard.ts`
**Función guard:** `redirectBackGuard: CanActivateFn` — maneja la ruta wildcard (`**`), evitando pantallas en blanco.

| Función | Descripción |
|---|---|
| `normalizePath(path): string` | Normaliza un path (agrega `/` inicial, quita `/` finales). |
| `collectConfiguredRoutes(routes, prefix?): string[]` | Recorre recursivamente el árbol de rutas configuradas para obtener todos los paths válidos. |
| `redirectBackGuard: CanActivateFn` | Si hay navegación previa, redirige a ella (`UrlTree`); si no hay usuario, redirige a `/`; si hay usuario pero la URL es inválida, busca la primera ruta accesible según `menus`/`menuPaths` del usuario y `PermissionService.canAccessRoute`, con fallback a `/`. |

**Dependencias:** `Router`, `TokenService`, `PermissionService`.

#### `src/app/core/guard/role.guard.ts`
**Función guard:** `roleGuard: CanActivateFn` — controla acceso a rutas según `menuPaths` del usuario (control desde BD; la seguridad real está en backend).

| Función | Descripción |
|---|---|
| `normalizePath(path): string` | Normaliza el path (quita query/hash, minúsculas, slash inicial/final). |
| `roleGuard(_route, state)` | Si no hay usuario, navega a `/` y bloquea. Si `menuPaths` está vacío, permite todo (modo bootstrap). Si la ruta actual coincide con algún `menuPath` permitido, permite; si no, muestra toast de error (`ToastService.showError`) y redirige a la URL anterior o al primer `menuPath` válido. |

**Dependencias:** `TokenService`, `ToastService`, `Router`.

### Core - Interceptors

#### `src/app/core/interceptors/auth.interceptor.ts`
**Función:** `authInterceptor: HttpInterceptorFn` — interceptor HTTP funcional que gestiona el token JWT en cada request.

| Comportamiento | Descripción |
|---|---|
| Adjunta token | Si existe token y no está expirado, clona el request agregando header `Authorization: Bearer <token>`. |
| Token expirado | Si el token está expirado, llama a `authService.logout()` y lanza error observable ("Sesión expirada..."). |
| Manejo de 401 | En `catchError`, si la respuesta es `401 Unauthorized`, invoca `authService.logout()`; siempre re-lanza el error. |

**Dependencias:** `TokenService`, `AuthService`, `Router`.

### Core - Interfaces

- **`Response-login.ts`**: `UserMenu` (`label`, `path`, `permissions`), `UserInfo` (`id`, `email`, `name`, `roles`, `roleIds?`, `menuPaths`, `menus?`), `ResponseLogin` (`access_token`, `user`).
- **`compensation-box.interface.ts`**: `CompensationBox` (`id`, `nameCompensationBox`).
- **`param-config-general.interface.ts`**: `ParamConfigGeneral` (`id`, `key`, `value`, `description`, `status`, `creation_date`, `update_date`).
- **`pension.interface.ts`**: `Pension` (`id`, `namePensions`).

### Core - Services

#### `src/app/core/service/auth.service.ts`
**Clase:** `AuthService` (`providedIn: 'root'`) — maneja autenticación contra el backend.

| Método | Descripción |
|---|---|
| `loginDB(email, password)` | POST a `{urlBD}/auth/login`; guarda token y usuario vía `TokenService` (`tap`). Retorna `Observable<ResponseLogin>`. |
| `logout(): void` | Elimina token/usuario y navega a `/login`. |
| `isAuthenticated(): boolean` | Retorna `true` si el token no está expirado. |

#### `src/app/core/service/compensation-box.service.ts`
**Clase:** `CompensationBoxService` (`providedIn: 'root'`) — consulta cajas de compensación.

- `findAll()` — GET `{urlBD}/compensation-boxes`.
- `findForDropdown()` — GET `{urlBD}/compensation-boxes/dropdown`.
- `getHeaders()` (privado) — header Authorization.
- `handleError(error)` (privado) — traduce códigos HTTP (401/404/500+) a mensajes legibles.

#### `src/app/core/service/config-general.service.ts`
**Clase:** `ConfigGeneralService` (`providedIn: 'root'`) — accede a parámetros de configuración general.

- `findAll()` — GET `{urlBD}/param-config-general`.
- `findByKey(key)` — GET `{urlBD}/param-config-general/{key}`.
- `getValue(key)` — GET `{urlBD}/param-config-general/{key}/value`.
- `getHeaders()` / `handleError(error)` (privados).

#### `src/app/core/service/login.service.ts`
**Clase:** `LoginService` (`providedIn: 'root'`) — `isAuthenticated(): boolean`, verifica token válido y no expirado.

#### `src/app/core/service/pensions.service.ts`
**Clase:** `PensionsService` (`providedIn: 'root'`) — `findAll()`, `findForDropdown()`, `getHeaders()`/`handleError()` (privados). Consulta fondos de pensiones.

#### `src/app/core/service/permission.service.ts`
**Clase:** `PermissionService` (`providedIn: 'root'`) — evalúa permisos y acceso a rutas del usuario autenticado. Usado ampliamente en toda la app para mostrar/ocultar acciones.

| Método | Descripción |
|---|---|
| `can(permission, path?): boolean` | Evalúa si el usuario tiene el/los permiso(s) sobre un path. |
| `check(permission, path?, message?): boolean` | Igual que `can`, pero muestra toast de error si no tiene acceso. |
| `canAccessRoute(urlSegment): boolean` | Verifica acceso a una ruta (usado en `roleGuard`/`redirectBackGuard`). |
| `normalize`, `normalizePath`, `getUserMenus`, `hasPermissionOnPath`, `getPathFromCurrentRoute`, `hasPathAccess`, `buildDefaultMessage` | Helpers privados de resolución de permisos. |

#### `src/app/core/service/toast.service.ts`
**Clase:** `ToastService` (`providedIn: 'root'`) — notificaciones toast reactivas (signal).

- `showSuccess/showError/showInfo(message)` — agregan un toast del tipo correspondiente.
- `addToast(message, type)` (privado) — crea el toast y programa auto-eliminación a los 5s.
- `removeToast(id)` — elimina un toast por id.

#### `src/app/core/service/token.service.ts`
**Clase:** `TokenService` (`providedIn: 'root'`) — persistencia de token JWT y usuario en `localStorage`, validación de expiración.

| Método | Descripción |
|---|---|
| `saveToken` / `getToken` / `removeToken` | Gestión del JWT en `localStorage`. |
| `saveUser` / `getUser` / `clearUser` | Gestión del usuario actual (signal `_currentUser`). |
| `hasRole(role)` | Verifica rol del usuario actual. |
| `hasMenuAccess(path)` | Verifica acceso por `menuPaths`. |
| `isTokenExpired()` / `getTokenExpirationDate()` | Validación/lectura de expiración del JWT. |
| `_loadUserFromStorage()` / `decodeToken(token)` (privados) | Inicialización y decodificación del JWT. |

### Core - Components

#### `src/app/core/components/layout/layout.ts`
**Clase:** `LayoutComponent` (standalone) — layout principal de la app autenticada (sidebar, header, router-outlet hijo).

- `canSee(path)` — determina si un ítem de menú debe mostrarse según `PermissionService.canAccessRoute`.
- `toggleSidebar()` — alterna visibilidad del sidebar.
- `logout()` — limpia sesión y navega a `/login`.
- `isActiveRoute(route)` — resaltado de nav activo.
- `updateCurrentRoute()` (privado) — suscribe a `router.events` para actualizar el signal `currentRoute`.

**Estado/computed:** `isSidebarOpen`, `currentRoute`, `currentUser`, `userName`/`userRole`.

#### `src/app/core/components/toast-container/toast-container.ts`
**Clase:** `ToastContainerComponent` (standalone, template inline) — renderiza la pila de toasts.

- `getToastClass(type)` / `getIconClass(type)` — clases CSS según tipo de toast.

---

## Shared

### `src/app/shared/components/searchable-select/searchable-select.ts`
**Clase:** `SearchableSelectComponent` (standalone, `ControlValueAccessor`) — combo/select con búsqueda, soporta modo "select" clásico y modo "combobox" (texto libre + sugerencias). Usado en formularios de afiliados, filtros, etc.

| Método | Descripción |
|---|---|
| `writeValue` / `registerOnChange` / `registerOnTouched` / `setDisabledState` | Implementación de `ControlValueAccessor`. |
| `openDropdown()` / `selectOption(option)` / `clearSelection()` | Flujo del modo select clásico. |
| `onComboInput` / `onComboFocus` / `onComboBlur` / `toggleComboDropdown` / `clearComboValue` / `selectComboOption` | Flujo del modo combobox (texto libre + sugerencias). |
| `onDocumentClick(event)` (`@HostListener`) | Cierra el dropdown si el click ocurre fuera del componente. |
| `ngAfterViewInit` / `ngOnDestroy` | Registra/limpia listener de scroll externo. |
| `closeDropdownPanel`, `moveDropdownToBody`, `updateDropdownPosition`, `closeOnScroll` (privados) | Posicionamiento del panel flotante (se mueve a `document.body` para funcionar dentro de modales). |

**Getters/computed:** `filteredOptions`, `comboFilteredOptions`, `selectedLabel`.

---

## Módulo: Affiliates

Gestión de afiliados: listado paginado con filtros, alta/edición vía formulario modal con carga de documento PDF, activación/desactivación, envío de correo, sincronización con Siigo y exportación a Excel.

### Rutas
`src/app/modules/affiliates/affiliates.routes.ts` — `''` → `AffiliatesListComponent` (`LoginGuardian`, `roleGuard`).

### Componentes

#### `affiliate-form-modal.ts`
**Clase:** `AffiliateFormModalComponent` — Modal reactivo (crear/editar) para afiliados, con formulario extenso (datos personales, ubicación, plan/afiliación, seguridad social) y carga/gestión de documento PDF.

- `toggleSection1/2/3()` — abren/cierran secciones colapsables.
- Getters `planOptions/companyOptions/grouperOptions/advisorOptions/epsOptions/referenceOptions/pensionOptions/compensationBoxOptions/departmentOptions/cityOptions` — mapean catálogos a `SelectOption[]`.
- `validateAfp/validateArl/validateCcf/validateProfession/validateEps(control)` — habilitan/validan campos según el plan.
- `validateDocumentFile()` — hace el archivo obligatorio solo si la agrupadora es "GESTIÓN".
- `get isGestionGrouper` — indica si la agrupadora activa es GESTIÓN.
- `ngOnInit()` — suscribe cambios de `planId`, `grouperId`, `departmentCode`, `cityCode`.
- `loadCitiesForDepartment(code)`, `updatePlanLogic(planId)`, `updateCertControls()` (privados) — lógica dependiente de plan/ubicación.
- `todayDate()`, `toLocalDateStr(value)` (privados) — utilidades de fecha (huso Bogotá).
- `loadCatalogs$()` / `loadCatalogs()` (privados) — `forkJoin` de todos los catálogos.
- `loadEditData(affiliate)` / `patchForm(affiliate)` (privados) — carga y rellena datos en modo edición.
- `onFileSelected(event)` / `clearFile()` — validación (PDF, máx. 10MB) y limpieza de archivo.
- `onDocumentNumberBlur()` / `checkDuplicate()` (privado) — valida duplicidad de número de documento.
- `onClose()` / `onSubmit()` — cierre y envío (crea/actualiza afiliado, gestiona documento, notifica sync con Siigo).
- `isFieldInvalid(field)` — helper de validación visual.

#### `affiliate-status-modal.ts`
**Clase:** `AffiliateStatusModalComponent` — Modal de confirmación para activar/desactivar un afiliado.

- `get isActivating` / `actionLabel` / `title` / `confirmMessage` / `successMessage` — textos dinámicos.
- `onConfirm()` — llama `toggleStatus(id)`, muestra toast, emite `confirmed`.
- `onCancel()` — emite `cancelled`.

### Páginas

#### `affiliates-list.ts`
**Clase:** `AffiliatesListComponent` — tabla paginada de afiliados con filtros (nombre, cédula, referencia, asesor, estado, grupo), acciones por fila y exportación a Excel.

- `toggleDropdown/closeDropdown/onDocumentClick` — menú de acciones desplegable por fila.
- `ngOnInit()` — debounce de filtros de texto (400ms) + carga inicial.
- `buildFilters()` (privado) — arma `AffiliateFilters`.
- `loadAffiliates()` / `loadFilterOptions()` (privado) — carga de datos y opciones de filtro.
- `getDepartmentName(code)` — resuelve nombre de departamento.
- `onTextFilterChange()` / `onDropdownFilterChange()` / `clearFilters()` / `get hasActiveFilters` — gestión de filtros.
- `goToPage/nextPage/previousPage/get pageNumbers` — paginación.
- `openCreate()` / `openEdit(affiliate)` / `openStatusToggle(affiliate)` — abren modales (validan permisos).
- `onFormSaved/onFormClosed/onStatusConfirmed/onStatusCancelled` — manejadores de cierre de modales.
- `downloadDocument(affiliate)` — descarga el PDF asociado como blob.
- `downloadExcel()` — exporta el listado filtrado (valida permiso `export`).
- `formatDate(date)` / `isEmptyValue(value)` — helpers de formato.
- `isGestionAffiliate(affiliate)` — afiliado de agrupadora GESTIÓN con documento.
- `sendEmail(affiliate)` — envía correo de afiliación vía backend/n8n.
- `syncToSiigo(affiliate)` — sincroniza con Siigo.

### Servicios

#### `affiliate-members.service.ts`
**Clase:** `AffiliateMembersService` (`providedIn: 'root'`) — cliente HTTP central del módulo (CRUD, documentos, catálogos, exportación, notificaciones). Define `AffiliateFilters`.

- `getAffiliates(filters)`, `getReferences()`, `createAffiliate(dto)`, `updateAffiliate(id, dto)`, `toggleStatus(id)` — CRUD y estado.
- `uploadDocument(affiliateId, file)` / `deleteDocument(affiliateId, documentId)` / `downloadBlob(id, documentId)` — gestión de documentos.
- `syncToSiigo(id)` — sincronización con Siigo.
- `exportToExcel(filters)` — exporta listado filtrado.
- `sendEmail(affiliationId)` — dispara envío de correo (n8n).
- `getPlans/getCompanies/getGroupers/getAdvisors/getEpsList/getPensions/getCompensationBoxes/getDepartments/getCitiesByDepartment` — catálogos dropdown.
- `getHeaders()` / `handleError(error)` (privados).

#### `compensation-box.service.ts` y `pension.service.ts` ⚠️
Servicios independientes/legacy que duplican `getCompensationBoxes()`/`getPensions()` de `AffiliateMembersService`; no se detectaron referencias activas fuera de sí mismos.

### Interfaces
- **`affiliate-member.interface.ts`**: `DocumentType`, `AffiliateDocument`, `AffiliateMember` (entidad principal), `CreateAffiliateMemberDto`, `UpdateAffiliateMemberDto`.
- **`catalog.interface.ts`**: `CatalogItem`, `Plan`, `Company`, `Grouper`, `Advisor`, `EpsItem`, `Pension`, `CompensationBox`, `Department`, `CityOption`, `AffiliateCatalogs`.
- **`compensation-box.interface.ts`**: `CompensationBoxInterface`.
- **`paginated-affiliates.interface.ts`**: `PaginatedAffiliatesResponse`.
- **`pension.interface.ts`**: `PensionInterface`.

---

## Módulo: Deactivate Affiliates

Inhabilitación/desactivación de afiliados por falta de pago o pago incompleto (pestañas "sin pago" / "pagos incompletos"), revisión de transacciones asociadas, aprobación de pagos/transacciones, exportación a Excel.

### Rutas
`deactivate-affiliates.routes.ts` — `''` → `DeactivateAffiliatesList` (`LoginGuardian`, `roleGuard`).

### Componentes
`deactivate-affiliates-status.ts` — **stub vacío** (plantilla placeholder), no referenciado en rutas ni por otros componentes del módulo; parece código generado no utilizado.

### Páginas

#### `deactivate-affiliates-list.ts`
**Clase:** `DeactivateAffiliatesList` (`OnPush`) — dos pestañas, selección múltiple, filtros client-side reactivos, modal de confirmación de desactivación masiva/individual, modal de aprobación de pago, modal de detalle de transacciones, exportación a Excel.

- Computeds clave: `canViewUnderpaid`, `canDeactivateAffiliates`, `allAffiliates`, `filteredAffiliates`, `totalItems/totalPages`, `currentAffiliates`, `isDeactivateButtonDisabled`, `modalMessage`, contadores de selección, opciones únicas de filtro (`referenceOptions`, etc.), `canDeactivateByDate`.
- `ngOnInit()` — obtiene tamaño de página desde `ConfigGeneralService` y carga datos.
- `setFilterName/Document/Reference/Adviser/Company/Grouper(value)` / `clearFilters()` — filtros.
- `loadData()` (protected) — `forkJoin` de contexto + afiliados sin pago + (si hay permiso) pago incompleto.
- `changeTab(tab)` — cambia pestaña verificando permiso `view`.
- `previousPage/nextPage/goToPage` — paginación.
- `toggleRow/toggleVisibleRows/isSelected` — selección de filas.
- `openConfirmationModal/cancelDeactivation/deactivateAll/confirmDeactivation/handleDeactivationResponse/closeResultsModal` — flujo de desactivación (individual, masiva o por filtros).
- `openApprovePaymentModal/cancelApprovePayment/confirmApprovePayment` — aprobación de pago de afiliación.
- `openTransactionsModal/closeTransactionsModal/toggleTransactionApproved` — detalle y aprobación de transacciones de un afiliado.
- `toggleDropdown/closeDropdown/onDocumentClick` — menú de acciones.
- `trackById/trackByTransactionId` — `trackBy` de listas.
- `formatDateColombia/formatDateOnlyColumbia/formatCurrency` — formateo.
- `downloadExcel()` — exporta (solo pestaña "unpaid", valida permiso `export`).

### Servicios

#### `deactivate-affiliates.service.ts`
**Clase:** `DeactivateAffiliatesService` (`providedIn: 'root'`) — reglas de desactivación, listados normalizados, aprobación de pagos/transacciones, exportación, consulta de transacciones por afiliado.

- `getContext()` — reglas de negocio (día mínimo permitido, fecha de servidor).
- `getActiveAffiliates(page)` / `normalizeRow(row)` (privado) — afiliados activos normalizados.
- `deactivateAffiliates(ids)` / `deactivateAllAffiliates(filters)` — desactivación por IDs o por filtros.
- `getUnpaidAffiliates()` / `getUnderpaidAffiliates()` — listados normalizados y filtrados.
- `approvePayment(affiliateId, accepted)` / `approveTransaction(transactionId, approved)` — aprobaciones.
- `exportToExcel(tab, filters)` — exportación según pestaña.
- `getAffiliateTransactions(documentId)` — intenta múltiples claves de query en cadena hasta obtener resultados.
- `normalizeInactivationRow`, `toNumber`, `toBoolean`, `isUnderpaid`, `normalizeTransactionRow`, `extractTransactionRows`, `handleError` (privados) — normalización de datos heterogéneos del backend (snake_case/camelCase).

### Interfaces
- **`deactivate-affiliates.interface.ts`**: `DeactivateAffiliateFilters`, `ActiveAffiliateRow`, `DeactivationContext`, `ActiveDeactivationResponse`, `DeactivateAffiliatesResponse`, `InactivationAffiliateRow`, `AffiliateTransactionRow`.
- **`paginated-deactivate-affiliates.interfaces.ts`**: `PaginatedDeactivationResponse`.
- **`raw-affiliate-row.interface.ts`**: formas crudas del backend (`RawDeactivateAffiliateRow`, `RawActiveDeactivationResponse`, `RawInactivationAffiliateRow`, `RawAffiliateTransactionRow`).

---

## Módulo: Menu

Administración de menús del sistema (ítems de navegación) y sus permisos asociados, usado por el módulo de Roles.

### Rutas
`menu.routes.ts` (ubicado en `services/`, no en la raíz del módulo) — `''` → `MenuComponent` (`LoginGuardian`, `roleGuard`).

### Componentes

#### `menu-for-modal.ts`
**Clase:** `MenuForModal` — modal de creación/edición de un menú, con selección de permisos asociados.

- `ngOnInit()` — inicializa formulario y carga permisos disponibles.
- `ngOnChanges(changes)` — rellena o resetea el formulario según `menuData`.
- `initForm()` — crea el `FormGroup` (`name`, `icon`, `path`, `isActive`, `permissionIds` con mínimo 1).
- `onPermissionChange(id, checked)` / `isPermissionChecked(id)` — gestión de permisos seleccionados.
- `onClose()` / `onSubmit()` — cierre y envío (crea/actualiza).

### Páginas

#### `menu-list.ts`
**Clase:** `MenuComponent` — listado paginado de menús con alta/edición vía modal y eliminación con confirmación.

- `ngOnInit()` / `loadMenus()` — carga.
- `openCreateModal()` / `openEditModal(menu)` — abren modal.
- `onPageChange(page)` — paginación.
- `onSaved()` — cierra modal, toast, recarga.
- `confirmDelete(menu)` / `cancelDelete()` / `deleteMenu()` — flujo de borrado.
- `get totalPages` / `get pages` — cálculo de paginación.

### Servicios

#### `menus.service.ts`
**Clase:** `MenusService` (`providedIn: 'root'`) — CRUD de menús y consulta de permisos.

- `findAll(page, limit)`, `findOne(id)`, `create(menu)`, `update(id, menu)`, `remove(id)`, `getPermissions()`, `getHeaders()` (privado).

### Interfaces
`menu.interface.ts`: `Permission`, `MenuPermission`, `Menu`, `PaginatedMenus`.

---

## Módulo: Roles

Administración de roles, cada uno con un conjunto de permisos (`menuPermission`) sobre los menús del sistema.

### Rutas
`roles.routes.ts` — `''` → `RoleListComponent` (`LoginGuardian`, `roleGuard`).

### Componentes

#### `role-form-modal.component.ts`
**Clase:** `RoleFormModalComponent` — modal de creación/edición de rol, con selección jerárquica (por menú y por permiso individual) de `menuPermission`s.

- `ngOnInit()` / `ngOnChanges(changes)` — inicialización y reseteo/rellenado según `roleData`.
- `initForm()` / `loadMenus()` / `resetForm()` / `patchRoleData()` — preparación del formulario y datos.
- `isMenuSelected(menuId)` / `toggleMenu(menu, checked)` — checkbox padre (todos los permisos de un menú).
- `isMenuPermissionChecked(id)` / `toggleMenuPermission(id, checked)` — checkbox de permiso individual.
- `onClose()` / `onSubmit()` — cierre y envío (valida al menos un permiso seleccionado).

### Páginas

#### `role-list.component.ts`
**Clase:** `RoleListComponent` — listado paginado de roles con alta/edición vía modal, eliminación con confirmación y resumen de menús asociados.

- `ngOnInit()` / `loadRoles()` — carga.
- `openCreateModal()` / `openEditModal(role)` / `onPageChange(page)` / `onSaved()` — gestión de modal y paginación.
- `confirmDelete(role)` / `cancelDelete()` / `deleteRole()` — borrado.
- `get totalPages` / `get pages` — paginación.
- `getMenusList(role)` — nombres únicos de menús asociados a un rol (o `'Ninguno'`).

### Servicios

#### `roles.service.ts`
**Clase:** `RolesService` (`providedIn: 'root'`) — CRUD de roles: `findAll`, `findOne`, `create`, `update`, `remove`, `getHeaders()` (privado).

### Interfaces
`role.interface.ts`: `RoleMenuPermission`, `Role`, `PaginatedRoles`.

---

## Módulo: Transactions (`modules/transactions`)

Módulo **activo** de gestión de comprobantes de pago: creación con selección de afiliados y carga de imágenes, extracción por IA, listado con filtros, detalle con polling, exportación e inhabilitación (soft delete).

### Rutas
`transactions.routes.ts`:

| Path | Componente | Guards |
|---|---|---|
| `''` | `TransactionsListComponent` | `LoginGuardian`, `roleGuard` |
| `'crear'` | `TransactionCreateComponent` | `LoginGuardian`, `roleGuard`, `canCreateTransactionGuard` (guard funcional local: `PermissionService.can('create','/transacciones')`) |
| `':id'` | `TransactionDetailComponent` | `LoginGuardian`, `roleGuard` |

### Componentes

#### `affiliates-form.ts`
**Clase:** `AffiliatesFormComponent` — busca afiliados por referencia/cédula, los selecciona (checkboxes) y los emite al padre.

- `onSearch()` / `onClearSearch()` — búsqueda y limpieza.
- `onTableFilterChange(event)` / `applyTableFilter()` — filtro de texto en cliente.
- `toggleAffiliate(idNumber)` / `isSelected(idNumber)` / `selectAll()` / `deselectAll()` — selección.
- `getSelectedAffiliates()` / `getSelectedCount()` / `getReference()` / `isValid()` — acceso al estado de selección.
- `formatCurrency(amount)` — formateo COP.

#### `image-uploader.ts`
**Clase:** `ImageUploaderComponent` — subida de comprobantes vía drag&drop o input file, preview base64, validación de cantidad/tipo/tamaño.

- `onDragOver/onDragLeave/onDrop(event)` / `onFileSelected(event)` — captura de archivos.
- `handleFiles(files)` (privado) — valida máx. 10 archivos, tipos jpg/jpeg/png, tamaño máx. 5MB, genera previews.
- `removeImage(index)` / `emitFiles()` (privado) / `getFileCount()`.

#### `receipts-table.ts`
**Clase:** `ReceiptsTableComponent` — tabla de solo lectura de recibos extraídos por IA.

- `averageVeracity` (computed) — promedio de `veracityPercentage`.
- `formatCurrency(amount?)`.

#### `transaction-filters.ts`
**Clase:** `TransactionFiltersComponent` — filtros (fecha, referencia, afiliado, cédula, subido por, estado).

- `onSearch()` — construye `TransactionFilters` (fechas a ISO) y emite `filterApplied`.
- `onClear()` — resetea filtros.

#### `transaction-status-badge.ts`
**Clase:** `TransactionStatusBadgeComponent` — badge de estado (`pending` → "Procesando", `processed` → "Completado").

#### `transaction-table.ts`
**Clase:** `TransactionTableComponent` — tabla principal con menú de acciones por fila y flujo de inhabilitación.

- `toggleDropdown/closeDropdown/onDocumentClick` — menú de acciones.
- `onViewDetail(id)` — emite `viewDetail`.
- `requestDisable(id)` / `confirmDisable()` / `cancelDisable()` / `onDisableTransaction(id)` — flujo de inhabilitación (con y sin modal).
- `formatCurrency(amount)` / `formatDate(date)` — formateo.
- `getAffiliatesCount(transaction)` / `getAdvisors(transaction)` / `getAverageVeracity(transaction)` — datos derivados por fila.
- Usa `effect()` para cerrar el modal automáticamente cuando el id inhabilitado coincide con el pendiente.

### Páginas

#### `transaction-create.ts`
**Clase:** `TransactionCreateComponent` — creación de una transacción.

- `ngOnInit()` — verifica permiso `create` (defensa adicional al guard de ruta).
- `onAffiliatesChanged(affiliates)` — recalcula `totalValue`.
- `onImagesChanged(files)` — guarda archivos.
- `onDiscountedValueChanged()` / `updateValuePaid()` (privado) — calcula `amountPaid`.
- `onSubmit()` — valida, arma `FormData` (remapea `charge`/`arl` con fallback `null`), llama `createTransaction`, navega a la lista.
- `onCancel()` — vuelve a la lista.
- `isFieldInvalid` / `getFieldError` — validación visual.

#### `transaction-detail.ts`
**Clase:** `TransactionDetailComponent` — detalle con polling automático mientras `status === 'pending'`.

- `ngOnInit()` / `ngOnDestroy()` — carga inicial y limpieza.
- `loadTransaction(id)` — obtiene la transacción; si `pending`, inicia polling.
- `startPolling(id)` / `stopPolling()` (privados) — polling cada 5s (`takeWhile`).
- `refreshTransaction()` / `goBack()` — acciones manuales.
- `formatCurrency(amount)` / `formatDate(date)` / `getTotalPrice()` — formateo y cálculo.
- `openImageModal(imageBase64)` / `closeImageModal()` — modal de imagen ampliada.

#### `transactions-list.ts`
**Clase:** `TransactionsListComponent` — lista paginada con filtros, exportación e inhabilitación.

- `ngOnInit()` — carga y muestra toast de éxito si viene de creación.
- `loadTransactions(filters?, page?)` / `onFilterApplied(filters)` — carga y filtrado.
- `goToPage/nextPage/previousPage/get pageNumbers` — paginación.
- `onCreateTransaction()` — valida permiso `create` y navega.
- `downloadExcel()` — valida permiso `export`.
- `onViewDetail(id)` — navega al detalle.
- `get canDisableTransactions` / `onDisableTransaction(id)` — inhabilitación (soft delete).

### Servicios

#### `affiliates.service.ts`
**Clase:** `AffiliatesService` — `searchAffiliates(search)` (GET `/affiliates/search?q={search}`), `handleError(error)` (privado).

#### `transactions.service.ts`
**Clase:** `TransactionsService` — CRUD/consultas, todas filtran `isActive=true`.

- `getTransactions(filters?)` / `getPaginatedTransactions(filters?, page, limit)` / `getTransactionById(id)`.
- `createTransaction(formData)` — POST multipart.
- `setTransactionActive(id, isActive)` — soft delete/restauración.
- `exportToExcel(filters?)` — blob de Excel.
- `handleError(error)` (privado).

### Interfaces
- **`affiliate.interface.ts`**: `Affiliate` (`type`, `idNumber`, `fullName`, `plan`, `price`, `eps`, `reference`, `charge?`, `arl?`, etc.).
- **`paginated-response.interface.ts`**: `PaginatedResponse<T>`.
- **`receipt.interface.ts`**: `Receipt` (`amount?`, `veracityPercentage?`, `reliabilityAlert?`, `date`).
- **`transaction-filters.interface.ts`**: `TransactionFilters`.
- **`transaction.interface.ts`**: `Transaction` (`status: 'pending'|'processed'`, `affiliates[]`, `images[]`, `receipts[]`, `isActive?`, `isApproved?`, etc.).

---

## Módulo: Update Company

Carga masiva por Excel para actualizar la empresa de afiliados, con validación previa, ejecución, historial paginado y ventana de fechas habilitada por el backend.

### Rutas
`update-company.routes.ts` — `''` → `UpdateCompanyList` (`LoginGuardian`, `roleGuard`).

### Páginas

#### `update-company-list.ts`
**Clase:** `UpdateCompanyList` (`OnPush`).

- `loadContext()` — obtiene `UpdateCompanyContext` (si el módulo está habilitado según el día del mes).
- `onDragOver/onDragLeave/onDrop(event)` / `onFileChange(event)` — captura de archivo (valida permiso y ventana de fecha).
- `handleFile(file)` (privado) — valida extensión `.xlsx`.
- `triggerFileInput` / `clearFile` — control del input.
- `validateFile()` — pre-validación (POST).
- `openConfirmation()` / `closeConfirmation()` / `executeUpload(inputEl?)` — confirmación y ejecución de la actualización masiva.
- `downloadTemplate()` — plantilla `.xlsx` vacía.
- `downloadSummaryReport()` — Excel resumen de la última ejecución.
- `loadHistory()` / `previousPage()` / `nextPage()` / `goToPage(page)` — historial paginado.
- `openErrorDetail(row)` / `closeErrorDetail()` — detalle de error de una fila del historial.
- `formatDate(dateString)` (protected).
- Computeds: `isDateAllowed`, `canUpload`, `canViewHistory`, `canExportHistory`, estimaciones de tiempo de procesamiento (`estimatedValidationLabel`, `estimatedProcessingLabel`), `totalPages`.

### Servicios

#### `update-company.service.ts`
**Clase:** `UpdateCompanyService` (sin `handleError` centralizado, a diferencia de Transactions).

- `getContext()` — ventana de fechas habilitada.
- `validateFile(file)` — pre-validación (multipart).
- `executeUpload(file)` — ejecución real (multipart).
- `getHistory(page, limit)` — historial paginado.
- `downloadTemplate()` / `downloadSummaryExcel(details)` — descargas.

### Interfaces
`update-company.interface.ts`: `ValidationError`, `PreviewRow`, `ValidationResponse`, `ExecutionRow`, `ExecutionResponse`, `HistoryRow`, `HistoryResponse`, `UpdateCompanyContext`.

---

## Carpeta legacy: `src/app/transactions` (duplicado)

⚠️ Esta carpeta es una **copia legacy/duplicada** de `src/app/modules/transactions`, ubicada fuera de `modules/`, con estructura de archivos idéntica (mismos nombres de componentes/páginas/servicios/interfaces y selectores Angular). No está referenciada en `app.routes.ts` — nada la enruta activamente.

### Diferencias funcionales relevantes respecto a `modules/transactions`

| Aspecto | `modules/transactions` (activo) | `src/app/transactions` (legacy) |
|---|---|---|
| Guards de ruta | `LoginGuardian`, `roleGuard`, `canCreateTransactionGuard` | Solo `LoginGuardian` — sin control de rol/permiso |
| `PermissionService` | Inyectado en `transaction-create`, `transactions-list` | **No inyectado en ningún lado** |
| Inhabilitar transacción (soft delete) | Sí (`TransactionTableComponent`, `setTransactionActive`) | **No existe** |
| Columna/dato de asesor | `getAdvisors(transaction)` en la tabla | No existe |
| Filtro `isActive=true` | Siempre aplicado en `TransactionsService` | **Nunca aplicado** (trae también inhabilitadas) |
| Búsqueda de afiliados | Query param `q` | Query param `search` ⚠️ posible contrato de API desactualizado |
| Remapeo `charge`/`arl` al crear | Sí (`?? null`) | No, se envían tal cual del formulario |
| Modelo `Affiliate` | Más reducido (`reference`/`eps` requeridos) | Más amplio: incluye `affiliationId`, `documentExpDate?`, `phone?`, `email?`, `address?`, `municipality?`, `company?`, `grouper?` |
| `transaction-filters.ts` | Opciones de estado probablemente hardcodeadas en HTML | Agrega `statusOptions` con estados `'failed'`/`'error'` que no existen en el tipo `Transaction.status` (código desactualizado/aspiracional) |

**Recomendación:** dado que no está enrutada y difiere en seguridad (sin `roleGuard`/`PermissionService`) y en reglas de negocio (sin soft-delete, sin filtro `isActive`), conviene confirmar si sigue siendo necesaria o puede eliminarse para evitar confusión y deuda técnica.

---

## Otros

### Prueba Login
`src/app/prueba-login/prueba-login.ts` — componente standalone **vacío**, sin lógica implementada; parece un placeholder de prueba no utilizado.

### Environments
- `environment.ts` / `environment.development.ts`: `urlBD` → `https://servirpro-image-analyzer-api-1.onrender.com/api` (desarrollo).
- `environment.production.ts`: `urlBD` → `https://servirpro-image-analyzer-api-g18u.onrender.com/api` (producción, backend distinto).

### Bootstrap
`src/main.ts` — `bootstrapApplication(App, appConfig)`, loguea errores de arranque en consola.

---

## Herramientas de CI

### `.github/scripts/angular-review.js`
Script Node.js usado por el workflow `angular-pr-review.yml` de GitHub Actions: agente de revisión automática de PRs enfocado en buenas prácticas de Angular, calidad y seguridad, potenciado por la API de Anthropic (modelo `claude-opus-4-8`).

| Función | Descripción |
|---|---|
| `getDiff()` | Lee el diff del PR desde `pr_diff_trimmed.txt`. |
| `scanForConsoleLog(diff)` | Chequeo determinístico (no delegado a la IA): escanea las líneas añadidas de archivos `.ts`/`.html` en busca de `console.log(...)`; si encuentra alguno, marca hallazgos que fuerzan `REQUEST_CHANGES` sin importar el veredicto del modelo. |
| `callClaude(diff)` (async) | Envía el diff a la API de Anthropic para obtener la revisión (veredicto + comentarios). |
| `formatGitHubComment(review)` | Da formato Markdown al comentario que se publicará en el PR. |
| `postGitHubComment(body)` (async) | Publica el comentario formateado en el PR vía API de GitHub. |
| `submitPRReview(verdict, body)` (async) | Envía la revisión formal del PR (aprobar / solicitar cambios) vía API de GitHub. |
| `main()` (async) | Orquesta el flujo completo: lee variables de entorno (`ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `PR_NUMBER`, etc.), obtiene el diff, corre el chequeo determinístico y la revisión de IA, y publica resultado. |

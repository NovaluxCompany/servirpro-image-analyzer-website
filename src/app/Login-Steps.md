# 🧩 **Historia de Usuario (HU) — Frontend Login con Angular + Tailwind + Flowbite**

## **HU-001 — Implementar pantalla de Login y flujo de autenticación**

### 🎯 **Como** desarrollador frontend

### 👤 **Quiero** construir completamente el login en Angular usando **Tailwind + Flowbite**

### ✅ **Para que** el usuario pueda autenticarse, recibir retroalimentación clara de errores y mantener su sesión activa con un token.

---

# ✅ 1. Objetivo de la tarea

Construir **todo el lado frontend del login**, incluyendo:

* UI visual del login con **Tailwind + Flowbite**
* Validaciones básicas en el formulario
* Envío de petición al backend
* Manejo de errores de credenciales
* Almacenamiento seguro del token cuando el login sea exitoso
* Redirección posterior al dashboard (o home)

---

# 📁 2. Estructura de archivos esperada

Dentro del proyecto Angular, crear o usar:

```
src/
 ├── app/
 │   ├── auth/
 │   │   ├── login/
 │   │   │   ├── login.component.ts
 │   │   │   ├── login.component.html
 │   │   │   └── login.component.scss
 │   │   └── auth.service.ts
 │   └── core/
 │       └── services/
 │           └── token.service.ts
```

---

# 🎨 3. Diseño visual (UI) — **Obligatorio usar Flowbite + Tailwind**

### **3.1 Estructura visual esperada (login.component.html)**

Usar el **componente Card de Flowbite** y un formulario centrado en pantalla:

Elementos obligatorios:

* Título: **“Iniciar Sesión”**
* Campo Email
* Campo Contraseña
* Botón **“Ingresar”**
* Texto de error (oculto por defecto)
* Loader/spinner al enviar la petición

Referencia de estilo Flowbite a usar:

* Card
* Input fields con label
* Button primario
* Alert de error

👉 El formulario debe verse así conceptualmente:

```
------------------------------------
|          INICIAR SESIÓN         |
|                                  |
|  📧 Email: [__________]          |
|                                  |
|  🔑 Contraseña: [__________]     |
|                                  |
|  [   INGRESAR   ]  (botón azul)  |
|                                  |
|  ⚠️ Credenciales inválidas       |  (solo aparece si hay error)
------------------------------------
```

---

# 🧠 4. Lógica en Angular (login.component.ts)

### 4.1 Crear formulario reactivo

Usar **Reactive Forms**:

Campos requeridos:

* email → requerido + formato email
* password → requerido + mínimo 6 caracteres

---

### 4.2 Crear método login()

Flujo esperado:

1. Usuario hace clic en **Ingresar**
2. Se muestra loader
3. Se envía petición POST a:

```
POST /api/auth/login
```

Payload esperado:

```json
{
  "email": "usuario@gmail.com",
  "password": "123456"
}
```

---

# 🔁 5. Servicio de autenticación (auth.service.ts)

Crear método:

```ts
login(credentials: { email: string; password: string }) {
  return this.http.post<any>('/api/auth/login', credentials);
}
```

---

# ❌ 6. Manejo de errores

Si el backend responde con:

* 401 → Credenciales inválidas
* 400 → Datos mal enviados

👉 Mostrar en pantalla un **alert rojo de Flowbite** con el mensaje:

> “Correo o contraseña incorrectos. Inténtalo nuevamente.”

Este mensaje debe aparecer **debajo del botón** y desaparecer al intentar de nuevo.

---

# ✅ 7. Manejo de éxito y almacenamiento del token

Si el backend responde algo como:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR..."
}
```

Guardar el token en:

```
localStorage.setItem('auth_token', token);
```

Crear un servicio:

```ts
@Injectable({ providedIn: 'root' })
export class TokenService {
  setToken(token: string) {
    localStorage.setItem('auth_token', token);
  }

  getToken() {
    return localStorage.getItem('auth_token');
  }

  removeToken() {
    localStorage.removeItem('auth_token');
  }
}
```

Usarlo en el login:

```ts
this.tokenService.setToken(response.token);
```

---

# 🚪 8. Redirección tras login exitoso

Una vez guardado el token:

```ts
this.router.navigate(['/dashboard']);
```

---

# 🧪 9. Criterios de aceptación

El trabajo se considera **APROBADO** si:

* ✅ Usa **Tailwind + Flowbite**
* ✅ El formulario es responsive y centrado
* ✅ Valida email y contraseña
* ✅ Muestra loader al enviar
* ✅ Muestra error cuando credenciales son inválidas
* ✅ Guarda el token correctamente
* ✅ Redirige al dashboard si login es exitoso
* ✅ No deja pasar al dashboard sin token

---

# 🧑‍💻 10. Bonus (si quieres más nivel)

Opcional:

* Bloquear botón mientras carga
* Animación suave en error
* Mensaje “Bienvenido” antes de redirigir

---
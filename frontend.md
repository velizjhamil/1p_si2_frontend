# CLAUDE.md — Attention Frontend (Angular + Tailwind)

## Proyecto
**Attention** — Plataforma inteligente de e-commerce para tienda de ropa con vestidor virtual vía Realidad Aumentada.
Universidad Autónoma Gabriel René Moreno (UAGRM) · FICCT · Sistemas de Información II · Gestión 2-2026

---

## Stack técnico
| Capa | Tecnología |
|---|---|
| Framework | Angular 17+ (standalone components) |
| Estilos | Tailwind CSS |
| Estado | Angular Signals + Services |
| HTTP | Angular HttpClient |
| Auth | JWT almacenado en localStorage, interceptor HTTP |
| Routing | Angular Router con guards por rol |

---

## Estructura de carpetas (NO modificar esta convención)
```
src/
├── app/
│   ├── core/
│   │   ├── guards/          # AuthGuard, RoleGuard
│   │   ├── interceptors/    # JWT interceptor, error interceptor
│   │   ├── models/          # Interfaces TypeScript (entidades)
│   │   └── services/        # AuthService, ApiService base
│   ├── features/            # Un módulo por CU o grupo de CUs
│   │   ├── auth/            # login, logout
│   │   ├── usuarios/        # gestión de usuarios
│   │   ├── roles/           # roles y permisos
│   │   ├── empresa/         # datos de empresa
│   │   ├── sucursales/      # sucursales
│   │   ├── proveedores/     # proveedores
│   │   ├── productos/       # , , , 
│   │   ├── inventario/      # 
│   │   ├── reservas/        # 
│   │   ├── carrito/         # 
│   │   ├── ventas/          # , 
│   │   └── reportes/        # 
│   ├── shared/
│   │   ├── components/      # Componentes reutilizables (tabla, modal, botón)
│   │   ├── pipes/           # Pipes custom
│   │   └── directives/      # Directivas custom
│   └── layouts/
│       ├── admin-layout/    # Layout para ASU y GS
│       ├── vendedor-layout/ # Layout para Vendedor
│       └── cliente-layout/  # Layout para Cliente
```

---

## Actores y rutas por rol
| Actor | Ruta base | Guard |
|---|---|---|
| ASU | `/admin/...` | `RoleGuard('ASU')` |
| GS | `/gerente/...` | `RoleGuard('GS')` |
| Vendedor | `/vendedor/...` | `RoleGuard('V')` |
| Cliente | `/tienda/...` | `AuthGuard` o público |

---

## Convenciones de código

### Componentes
- Todos **standalone** (`standalone: true`)
- Nombre: `{feature}-{tipo}.component.ts` → `login-form.component.ts`
- Un componente por archivo, un archivo por responsabilidad

### Servicios
- Un service por feature: `auth.service.ts`, `usuario.service.ts`
- Comunicación con API: solo a través de services, nunca desde componentes
- Base URL de la API: variable de entorno `environment.apiUrl = 'http://localhost:8000/api/v1'`

### Modelos / Interfaces
```typescript
// Siempre definir interfaces para las entidades
export interface Usuario {
  id_usuario: string; // UUID
  nombre: string;
  correo: string;
  estado: string;
  rol: Rol;
}
```

### Tailwind — clases base del proyecto
- **Botón primario**: `bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition`
- **Botón secundario**: `border border-black text-black px-4 py-2 rounded-lg hover:bg-gray-100`
- **Botón peligro**: `bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700`
- **Input**: `w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black`
- **Card**: `bg-white rounded-xl shadow-md p-6`
- **Tabla header**: `bg-gray-50 text-gray-600 text-sm font-semibold uppercase`
- **Badge activo**: `bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs`
- **Badge inactivo**: `bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs`

### Paleta de colores (marca Attention)
- Principal: negro `#000000` / blanco `#FFFFFF`
- Acento: gris oscuro `#1F2937` (gray-800)
- Fondo: `#F9FAFB` (gray-50)
- Éxito: verde `#16A34A` (green-600)
- Error: rojo `#DC2626` (red-600)

---

## Reglas de negocio en UI
1. **Login**: mostrar error inline, bloquear botón tras 5 intentos.
2. **Roles**: el menú lateral se renderiza dinámicamente según el rol del usuario autenticado.
3. **Permisos**: los botones de acción (crear/editar/eliminar) deben ocultarse si el rol no tiene el permiso.
4. **Formularios**: validación reactiva con mensajes de error en español.
5. **Tablas**: paginación del lado del servidor, 10 registros por página por defecto.
6. **Confirmaciones**: modal de confirmación antes de cualquier eliminación o desactivación.

---

## Instrucciones para el agente

### Al generar un componente:
1. Usar **standalone component** siempre.
2. Importar solo lo necesario en el array `imports: []`.
3. Usar **Tailwind** para estilos — nunca CSS inline ni clases custom innecesarias.
4. Manejar estados de carga con `isLoading = false` y mostrar un spinner.
5. Manejar errores del HTTP con mensajes en español al usuario.
6. Los formularios usan `ReactiveFormsModule` con `FormBuilder`.

### Orden de generación por feature:
1. `core/models/{entidad}.model.ts` — interface TypeScript
2. `features/{feature}/{feature}.service.ts` — llamadas HTTP
3. `features/{feature}/{feature}-list.component.ts` — tabla/listado
4. `features/{feature}/{feature}-form.component.ts` — crear/editar
5. Agregar ruta en el router del módulo correspondiente

### Interceptor JWT (ya debe existir):
```typescript
// Agrega automáticamente el token a cada request
headers.set('Authorization', `Bearer ${token}`)
```
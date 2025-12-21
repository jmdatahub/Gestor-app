# Mi Panel Financiero

Aplicación de gestión de finanzas personales.

## Estructura del Proyecto

```
Gestor-app/
├── app-clean/          ← PROYECTO PRINCIPAL (Vite + React)
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── legacy_root_backup/ ← Archivos del proyecto viejo (no usar)
├── package.json        ← Scripts que delegan a app-clean
└── README.md
```

## Desarrollo

### Instalación

```bash
# Instalar dependencias del proyecto
cd app-clean
npm install
```

### Ejecutar en desarrollo

```bash
# Desde la raíz (delega a app-clean)
npm run dev

# O directamente desde app-clean
cd app-clean
npm run dev
```

Abre **http://localhost:5173/** en tu navegador.

### Build para producción

```bash
npm run build
```

### Preview del build

```bash
npm run preview
```

## Tecnologías

- **Frontend**: React 19 + TypeScript
- **Estilos**: CSS puro (sistema de diseño en index.css)
- **Routing**: React Router v7
- **Backend**: Supabase (Auth + Database)
- **Build**: Vite

## Notas

- El proyecto real está en `app-clean/`
- Los archivos en `legacy_root_backup/` son del proyecto viejo y no se usan
- Todas las variables de entorno están en `app-clean/.env`

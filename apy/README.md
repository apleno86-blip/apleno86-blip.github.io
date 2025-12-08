# Apleno API (Comentarios)

API REST en Node.js (Express) con SQLite para gestionar comentarios. Incluye seguridad básica, paginación, sanitización de salida y cierre ordenado.

## Requisitos
- Node.js >= 18

Si no puedes instalar Node a nivel del sistema, puedes usar la versión portable de Node incluida en las instrucciones (ver más abajo).

## Instalación

Usando npm estándar:

```
npm install
```

Si usas Node portable (sin instalación del sistema):

1. Descarga Node portable (Windows x64) desde:
   https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip
2. Descomprime en `./nodejs/`. Debes tener `./nodejs/node-v20.18.0-win-x64/node.exe`.
3. Instala dependencias con el npm incluido:

```
./nodejs/node-v20.18.0-win-x64/npm.cmd install
```

## Ejecución

Con Node instalado en el sistema:

```
node "server (1).js"
```

Con Node portable:

```
./nodejs/node-v20.18.0-win-x64/node.exe "server (1).js"
```

El servidor quedará escuchando en: http://localhost:3000

## Endpoints

- GET `/api/health`
  - Estado del servidor y de la base de datos.
- GET `/api/comments?limit=20&offset=0`
  - Lista de comentarios (sin emails) con paginación. `limit` máximo 100.
- POST `/api/comments`
  - Crea un comentario con body JSON: `{ name?, email?, message }`
  - Validaciones: `message` 5..2000 chars, `email` formato básico.

## Seguridad y buenas prácticas
- `helmet` para cabeceras seguras.
- `express-rate-limit` en POST para evitar abuso.
- `CORS` abierto en desarrollo y restringible en producción.
- Sanitización de `message` al responder para mitigar XSS si el frontend usa `innerHTML`.

## Almacenamiento
- Base de datos en `./data/comments.db` (excluida del repositorio por `.gitignore`).

## Scripts útiles (opcional)
Puedes agregar en `package.json`:

```
{
  "scripts": {
    "start": "node \"server (1).js\""
  }
}
```

## Despliegue
- Este proyecto está pensado como servicio simple. Para producción, configura:
  - `NODE_ENV=production`
  - CORS: limitar orígenes conocidos.
  - Servicio como `pm2`/NSSM o servicio de Windows.

## Licencia
ISC

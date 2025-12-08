// Servidor de comentarios para Apleno Verdulería
// Base de datos: SQLite (persistente en disco)
// Endpoints:
//   GET  /api/health        -> estado del servidor
//   GET  /api/comments      -> lista de comentarios (ordenados por fecha desc.)
//   POST /api/comments      -> crear comentario { name, email, message }

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Asegurar carpeta de datos
const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

// Ruta del archivo de base de datos
const DB_PATH = path.join(DATA_DIR, 'comments.db');

// Inicializar DB
let dbReady = false;
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error abriendo la base de datos:', err);
    return;
  }
  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT,
        message TEXT NOT NULL,
        date TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      [],
      (e) => {
        if (e) {
          console.error('Error creando tabla:', e);
        } else {
          // Índice auxiliar para ordenación por created_at
          db.run(`CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC)`);
          dbReady = true;
        }
      }
    );
  });
});

const app = express();

// Seguridad básica
if (NODE_ENV === 'production') {
  app.use(cors({ origin: [/^https?:\/\/localhost(:\d+)?$/, /.*apleno.*/i] }));
} else {
  app.use(cors());
}
app.use(helmet());

// Límite de peticiones para evitar abuso en POST
const commentsLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });

app.use(express.json({ limit: '64kb' }));

// Util: limpieza básica de strings para evitar inyecciones de HTML al devolver
function sanitize(str = ''){
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: dbReady, message: 'Apleno API funcionando' });
});

// Listar comentarios
app.get('/api/comments', (req, res) => {
  const limit = Math.max(1, Math.min(parseInt(req.query.limit || '20', 10) || 20, 100));
  const offset = Math.max(0, parseInt(req.query.offset || '0', 10) || 0);
  db.all(
    `SELECT id, name, /* email, */ message, date, created_at
     FROM comments
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
    (err, rows) => {
      if (err) {
        console.error('DB get error:', err);
        return res.status(500).json({ ok: false, error: 'DB_ERROR' });
      }
      const safe = rows.map(r => ({
        id: r.id,
        name: r.name || 'Anónimo',
        // email omitido por privacidad
        message: sanitize(r.message),
        date: r.date,
        created_at: r.created_at
      }));
      res.json({ ok: true, items: safe, limit, offset });
    }
  );
});

// Crear comentario
app.post('/api/comments', commentsLimiter, (req, res) => {
  const name = (req.body.name || '').toString().trim().slice(0, 100);
  const email = (req.body.email || '').toString().trim().slice(0, 150);
  const message = (req.body.message || '').toString().trim();

  // Validaciones
  if (!message || message.length < 5) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_MIN_LENGTH', field: 'message' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_MAX_LENGTH', field: 'message' });
  }
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'VALIDATION_EMAIL', field: 'email' });
  }

  const date = new Date().toISOString();

  const sql = `INSERT INTO comments (name, email, message, date) VALUES (?, ?, ?, ?)`;
  db.run(sql, [name, email, message, date], function(err){
    if (err) {
      console.error('DB insert error:', err);
      return res.status(500).json({ ok: false, error: 'DB_ERROR' });
    }
    const id = this.lastID;
    res.status(201).json({ ok: true, item: { id, name: name || 'Anónimo', /* email excluido en respuesta */ message: sanitize(message), date } });
  });
});

// Middleware de errores JSON malformado y genérico
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ ok: false, error: 'JSON_INVALID_BODY' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
});

const server = app.listen(PORT, () => {
  console.log(`Apleno API escuchando en http://localhost:${PORT}`);
});

// Cierre ordenado
function shutdown() {
  console.log('Cerrando servidor...');
  server.close(() => {
    db.close(() => {
      console.log('DB cerrada.');
      process.exit(0);
    });
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const express = require('express');
const basicAuth = require('express-basic-auth');
const Database = require('better-sqlite3');
const { nanoid } = require('nanoid');
const { marked } = require('marked');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// Basic auth credentials from environment
const AUTH_USER = process.env.AUTH_USER || 'admin';
const AUTH_PASS = process.env.AUTH_PASS || 'changeme';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize SQLite database
const dbPath = process.env.DB_PATH || './pastes.db';
const db = new Database(dbPath);

// Create table if not exists
db.exec(`CREATE TABLE IF NOT EXISTS pastes (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  format TEXT DEFAULT 'text',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Prepare statements
const stmts = {
  getAllPastes: db.prepare('SELECT id, format, created_at, updated_at FROM pastes ORDER BY updated_at DESC'),
  getPaste: db.prepare('SELECT * FROM pastes WHERE id = ?'),
  getPublicPaste: db.prepare('SELECT content, format as stored_format FROM pastes WHERE id = ?'),
  insertPaste: db.prepare('INSERT INTO pastes (id, content, format) VALUES (?, ?, ?)'),
  updatePaste: db.prepare('UPDATE pastes SET content = ?, format = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  deletePaste: db.prepare('DELETE FROM pastes WHERE id = ?')
};

// Basic auth middleware for admin routes
const auth = basicAuth({
  users: { [AUTH_USER]: AUTH_PASS },
  challenge: true,
  realm: 'Admin Area'
});

// Serve static files for admin interface
app.use('/admin/static', auth, express.static(path.join(__dirname, 'static')));

// Admin dashboard
app.get('/admin', auth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// API: Get all pastes (admin only)
app.get('/api/pastes', auth, (req, res) => {
  try {
    const rows = stmts.getAllPastes.all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Get single paste (admin only)
app.get('/api/pastes/:id', auth, (req, res) => {
  try {
    const row = stmts.getPaste.get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Paste not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Create new paste (admin only)
app.post('/api/pastes', auth, (req, res) => {
  const id = nanoid(10);
  const { content, format = 'text' } = req.body;
  
  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }
  
  try {
    stmts.insertPaste.run(id, content, format);
    res.json({ id, url: `${req.protocol}://${req.get('host')}/${id}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Update paste (admin only)
app.put('/api/pastes/:id', auth, (req, res) => {
  const { content, format } = req.body;
  
  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }
  
  try {
    const result = stmts.updatePaste.run(content, format, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Paste not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Delete paste (admin only)
app.delete('/api/pastes/:id', auth, (req, res) => {
  try {
    const result = stmts.deletePaste.run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Paste not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public read-only routes
app.get('/:id', (req, res) => {
  const acceptHeader = req.get('Accept') || '';
  const format = req.query.format;
  
  try {
    const row = stmts.getPublicPaste.get(req.params.id);
    if (!row) return res.status(404).send('Not found');
    
    // Determine output format
    const isMarkdown = row.stored_format === 'markdown';
    const wantsHtml = acceptHeader.includes('text/html') && !format;
    
    if (wantsHtml && isMarkdown) {
      // Render markdown as HTML for browser viewing
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paste ${req.params.id}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 40px auto;
      padding: 0 20px;
      color: #333;
    }
    pre {
      background: #f4f4f4;
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
    }
    code {
      background: #f4f4f4;
      padding: 2px 4px;
      border-radius: 2px;
    }
    blockquote {
      border-left: 4px solid #ddd;
      margin-left: 0;
      padding-left: 16px;
      color: #666;
    }
  </style>
</head>
<body>
  ${marked(row.content)}
</body>
</html>`;
      res.type('html').send(html);
    } else {
      // Serve as plain text
      res.type('text/plain; charset=utf-8').send(row.content);
    }
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Raw content endpoint (always plain text)
app.get('/:id/raw', (req, res) => {
  try {
    const row = stmts.getPublicPaste.get(req.params.id);
    if (!row) return res.status(404).send('Not found');
    res.type('text/plain; charset=utf-8').send(row.content);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Root redirect to admin
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`Auth: ${AUTH_USER} / ${AUTH_PASS} (change with AUTH_USER and AUTH_PASS env vars)`);
});
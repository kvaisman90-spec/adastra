const API_KEY = '$2a$10$9.ps8GyXkLA1CtMuEvsxcOCxe9W8SIdgoQQfWhhXFJQznNnn8LkO2';
const BIN_ID = '6a87c78ff5f4af5e292f9a29';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let db = { ads: [], subscribers: [] };

    const binRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { 'X-Master-Key': API_KEY }
    });

    if (binRes.ok) {
      const data = await binRes.json();
      const rec = data.record || {};
      db.ads = Array.isArray(rec.ads) ? rec.ads : [];
      db.subscribers = Array.isArray(rec.subscribers) ? rec.subscribers : [];
    }

    if (req.method === 'GET') {
      return res.status(200).json(db);
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { action, id, ...payload } = body;
      const now = Date.now();

      if (action === 'publish') {
        db.ads.push({
          id: now, type: 'ad', status: 'pending',
          owner: payload.owner, title: payload.title,
          text: payload.text, contact: payload.contact,
          image: payload.image || null,
          created_at: new Date().toISOString()
        });
      }
      else if (action === 'subscribe') {
        if (!db.subscribers.find(s => s.contact === payload.contact)) {
          db.subscribers.push({ id: now, contact: payload.contact, date: new Date().toISOString() });
        }
      }
      else if (action === 'approve') {
        const item = db.ads.find(p => p.id == id);
        if (item) item.status = 'approved';
      }
      else if (action === 'reject') {
        const item = db.ads.find(p => p.id == id);
        if (item) item.status = 'rejected';
      }
      else if (action === 'delete') {
        db.ads = db.ads.filter(p => p.id != id);
      }
      else if (action === 'delete_sub') {
        db.subscribers = db.subscribers.filter(s => s.id != id);
      }

      await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY },
        body: JSON.stringify(db)
      });

      return res.status(200).json({ success: true, ...db });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

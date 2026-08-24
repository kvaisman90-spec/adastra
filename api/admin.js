const API_KEY = '$2a$10$9.ps8GyXkLA1CtMuEvsxcOCxe9W8SIdgoQQfWhhXFJQznNnn8LkO2';
const BIN_ID = '6a87c78ff5f4af5e292f9a29';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let db = { ads: [], subscribers: [], messages: [], stats: { views: 0, clicks: 0 } };
    const binRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, { headers: { 'X-Master-Key': API_KEY } });
    if (binRes.ok) {
      const data = await binRes.json();
      const rec = data.record || {};
      db.ads = Array.isArray(rec.ads) ? rec.ads : [];
      db.subscribers = Array.isArray(rec.subscribers) ? rec.subscribers : [];
      db.messages = Array.isArray(rec.messages) ? rec.messages : [];
      db.stats = rec.stats || { views: 0, clicks: 0 };
    }

    if (req.method === 'GET') return res.status(200).json(db);

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { action, id, ...payload } = body;
      const now = Date.now();

      if (action === 'publish') {
        db.ads.push({
          id: now, type: 'ad', status: 'pending', paid: false,
          owner: payload.owner, title: payload.title, text: payload.text,
          cta: payload.cta || '', contact: payload.contact, image: payload.image || null,
          format: payload.format || 'banner', country: payload.country || '', city: payload.city || '',
          languages: Array.isArray(payload.languages) ? payload.languages : ['ru'],
          views: 0, clicks: 0, created_at: new Date().toISOString()
        });
      }
      else if (action === 'approve_paid') { const i = db.ads.find(p => p.id == id); if(i){i.status='approved_paid'; i.paid=true;} }
      else if (action === 'approve_free') { const i = db.ads.find(p => p.id == id); if(i){i.status='approved_free'; i.paid=false;} }
      else if (action === 'reject' || action === 'delete') { db.ads = db.ads.filter(p => p.id != id); }
      else if (action === 'increment_view') { const i = db.ads.find(p => p.id == id); if(i) i.views=(i.views||0)+1; db.stats.views++; }
      else if (action === 'increment_click') { const i = db.ads.find(p => p.id == id); if(i) i.clicks=(i.clicks||0)+1; db.stats.clicks++; }
      else if (action === 'subscribe') { if(!db.subscribers.find(s=>s.contact===payload.contact)) db.subscribers.push({id:now, contact:payload.contact, lang:payload.lang||'ru', date:new Date().toISOString()}); }
      else if (action === 'delete_sub') { db.subscribers = db.subscribers.filter(s => s.id != id); }
      else if (action === 'support') { db.messages.push({ id: now, from: payload.from, text: payload.text, read: false, created_at: new Date().toISOString() }); }
      else if (action === 'delete_msg') { db.messages = db.messages.filter(m => m.id != id); }

      await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY }, body: JSON.stringify(db)
      });
      return res.status(200).json({ success: true, ...db });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) { return res.status(500).json({ error: e.message }); }
}

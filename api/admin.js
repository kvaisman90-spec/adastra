const API_KEY = '$2a$10$9.ps8GyXkLA1CtMuEvsxcOCxe9W8SIdgoQQfWhhXFJQznNnn8LkO2';
const BIN_ID = '6a87c78ff5f4af5e292f9a29';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    let db = { ads: [], subscribers: [], messages: [], wallets: {} };
    
    const binRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { 'X-Master-Key': API_KEY }
    });
    
    if (binRes.ok) {
      const data = await binRes.json();
      const rec = data.record || {};
      db.ads = Array.isArray(rec.ads) ? rec.ads : [];
      db.subscribers = Array.isArray(rec.subscribers) ? rec.subscribers : [];
      db.messages = Array.isArray(rec.messages) ? rec.messages : [];
      db.wallets = rec.wallets || {};
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
          id: now,
          type: 'ad',
          status: 'pending',
          paid: false,
          owner: payload.owner || 'Гость',
          title: payload.title || '',
          text: payload.text || '',
          cta: payload.cta || '',
          contact: payload.contact || '',
          image: payload.image || null,
          format: payload.format || 'banner',
          languages: payload.languages || ['RU'],
          region: payload.region || 'world',
          country: payload.country || 'world',
          city: payload.city || 'all',
          category: payload.category || 'other',
          created_at: new Date().toISOString()
        });
      }
      else if (action === 'approve_paid') {
        const item = db.ads.find(p => p.id == id);
        if (item) { item.status = 'approved_paid'; item.paid = false; }
      }
      else if (action === 'approve_free') {
        const item = db.ads.find(p => p.id == id);
        if (item) { item.status = 'approved_free'; item.paid = false; }
      }
      else if (action === 'reject') {
        db.ads = db.ads.filter(p => p.id != id);
      }
      else if (action === 'delete') {
        db.ads = db.ads.filter(p => p.id != id);
      }
      else if (action === 'make_paid') {
        const item = db.ads.find(p => p.id == id);
        if (item) { item.paid = true; item.status = 'paid'; }
      }
      else if (action === 'make_free') {
        const item = db.ads.find(p => p.id == id);
        if (item) { item.paid = false; item.status = 'approved_free'; }
      }
      else if (action === 'approve') {
        const item = db.ads.find(p => p.id == id);
        if (item) item.status = 'approved_paid';
      }
      else if (action === 'confirm_payment') {
        const item = db.ads.find(p => p.id == id);
        if (item) { item.status = 'paid'; item.paid = true; }
      }
      else if (action === 'subscribe') {
        if (!db.subscribers.find(s => s.contact === payload.contact)) {
          db.subscribers.push({
            id: now,
            contact: payload.contact,
            date: new Date().toISOString(),
            consent: true
          });
        }
      }
      else if (action === 'delete_sub') {
        db.subscribers = db.subscribers.filter(s => s.id != id);
      }
      else if (action === 'support') {
        db.messages.push({
          id: now,
          from: payload.from || 'Аноним',
          text: payload.text || '',
          read: false,
          created_at: new Date().toISOString()
        });
      }
      else if (action === 'delete_msg') {
        db.messages = db.messages.filter(m => m.id != id);
      }
      else if (action === 'mark_read') {
        const item = db.messages.find(m => m.id == id);
        if (item) item.read = true;
      }
      else if (action === 'save_wallets') {
        db.wallets = payload.wallets || {};
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

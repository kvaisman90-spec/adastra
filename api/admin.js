const API_KEY = '$2a$10$9.ps8GyXkLA1CtMuEvsxcOCxe9W8SIdgoQQfWhhXFJQznNnn8LkO2';
const BIN_ID = '6a87c78ff5f4af5e292f9a29';

const BANNED_WORDS = [
  'наркотик', 'наркотики', 'кокаин', 'героин', 'марихуана', 'трава', 'спайс',
  'оружие', 'пистолет', 'автомат', 'взрывчатка', 'бомба',
  'проститутк', 'шлюх', 'порно', 'секс-услуг', 'эскорт',
  'террор', 'терроризм', 'экстремизм', 'насилие', 'убийств',
  'мошенник', 'скам', 'развод', 'пирамида'
];

function containsBannedContent(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return BANNED_WORDS.some(word => lowerText.includes(word.toLowerCase()));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let db = { 
      ads: [], subscribers: [], messages: [], payments: [], onlineUsers: [] 
    };
    
    const binRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { 'X-Master-Key': API_KEY }
    });
    
    if (binRes.ok) {
      const data = await binRes.json();
      const rec = data.record || {};
      db.ads = Array.isArray(rec.ads) ? rec.ads : [];
      db.subscribers = Array.isArray(rec.subscribers) ? rec.subscribers : [];
      db.messages = Array.isArray(rec.messages) ? rec.messages : [];
      db.payments = Array.isArray(rec.payments) ? rec.payments : [];
      db.onlineUsers = Array.isArray(rec.onlineUsers) ? rec.onlineUsers : [];
    }

    if (req.method === 'GET') {
      const twoMinutesAgo = Date.now() - 120000;
      db.onlineUsers = db.onlineUsers.filter(u => u.lastSeen > twoMinutesAgo);
      
      await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY },
        body: JSON.stringify(db)
      });
      
      return res.status(200).json(db);
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { action, id, ...payload } = body;
      const now = Date.now();

      if (action === 'publish') {
        const titleText = `${payload.title} ${payload.text} ${payload.contact}`;
        if (containsBannedContent(titleText)) {
          return res.status(400).json({ success: false, error: 'Обнаружен запрещённый контент.' });
        }
        
        db.ads.push({
          id: now, type: 'ad', status: 'pending', paid: false,
          owner: payload.owner, title: payload.title,
          text: payload.text, cta: payload.cta || '', contact: payload.contact,
          image: payload.image || null, video: payload.video || null,
          format: payload.format || '', category: payload.category || 'general',
          region: payload.region || 'international', city: payload.city || '',
          langs: payload.langs || 7, created_at: new Date().toISOString()
        });
      }
      else if (action === 'heartbeat') {
        const existingUser = db.onlineUsers.find(u => u.name === payload.name);
        if (existingUser) {
          existingUser.lastSeen = now;
        } else {
          db.onlineUsers.push({ name: payload.name, role: payload.role || 'client', lastSeen: now });
        }
      }
      else if (action === 'block_user') {
        const user = db.subscribers.find(s => s.contact === payload.name);
        if (user) { user.blocked = true; user.blockReason = payload.reason || 'Нарушение правил'; }
        db.onlineUsers = db.onlineUsers.filter(u => u.name !== payload.name);
      }
      else if (action === 'unblock_user') {
        const user = db.subscribers.find(s => s.contact === payload.name);
        if (user) { user.blocked = false; delete user.blockReason; }
      }
      else if (action === 'delete_user') {
        db.subscribers = db.subscribers.filter(s => s.contact !== payload.name);
        db.ads = db.ads.filter(a => a.owner !== payload.name);
        db.messages = db.messages.filter(m => m.from !== payload.name && m.to !== payload.name);
        db.onlineUsers = db.onlineUsers.filter(u => u.name !== payload.name);
      }
      else if (action === 'approve_paid') {
        const item = db.ads.find(p => p.id == id);
        if (item) { 
          item.status = 'approved_paid'; 
          db.messages.push({ id: now + 1, from: 'Администратор AdAstra', to: item.owner, text: `✅ Ваша реклама "${item.title}" одобрена как ПЛАТНАЯ. Перейдите в раздел "Счёт" для оплаты.`, read: false, created_at: new Date().toISOString(), type: 'notification' });
        }
      }
      else if (action === 'approve_free') {
        const item = db.ads.find(p => p.id == id);
        if (item) { 
          item.status = 'approved_free'; 
          db.messages.push({ id: now + 1, from: 'Администратор AdAstra', to: item.owner, text: ` Ваша реклама "${item.title}" одобрена БЕСПЛАТНО. Она уже в ленте!`, read: false, created_at: new Date().toISOString(), type: 'notification' });
        }
      }
      else if (action === 'reject') {
        const item = db.ads.find(p => p.id == id);
        if (item) {
          item.status = 'rejected'; item.rejectionReason = payload.reason || 'Не соответствует правилам';
          db.messages.push({ id: now + 1, from: 'Администратор AdAstra', to: item.owner, text: `❌ Ваша реклама "${item.title}" отклонена.\n\nПричина: ${item.rejectionReason}`, read: false, created_at: new Date().toISOString(), type: 'rejection' });
        }
      }
      else if (action === 'delete') { db.ads = db.ads.filter(p => p.id != id); }
      else if (action === 'confirm_payment') {
        const item = db.ads.find(p => p.id == id);
        if (item) {
          item.status = 'paid'; item.paid = true;
          db.payments.push({ id: now, adId: id, owner: item.owner, title: item.title, amount: payload.amount || 0, method: payload.method || 'unknown', date: new Date().toISOString(), status: 'pending_verification' });
          db.messages.push({ id: now + 2, from: item.owner, to: 'Администратор AdAstra', text: `💰 Клиент сообщил об оплате рекламы "${item.title}" на сумму $${payload.amount || 0} (${payload.method}). Проверьте поступление.`, read: false, created_at: new Date().toISOString(), type: 'payment_notification' });
        }
      }
      else if (action === 'verify_payment') {
        const pay = db.payments.find(p => p.id == id);
        if (pay) { pay.status = 'verified'; const item = db.ads.find(a => a.id == pay.adId); if (item) { item.status = 'paid'; item.paid = true; } }
      }
      else if (action === 'subscribe') {
        const existingUser = db.subscribers.find(s => s.contact === payload.contact);
        if (existingUser && existingUser.blocked) return res.status(403).json({ success: false, error: 'Аккаунт заблокирован.' });
        if (!existingUser) db.subscribers.push({ id: now, contact: payload.contact, date: new Date().toISOString(), blocked: false });
      }
      else if (action === 'support') {
        if (containsBannedContent(payload.text)) return res.status(400).json({ success: false, error: 'Сообщение содержит запрещённый контент.' });
        db.messages.push({ id: now, from: payload.from, text: payload.text, read: false, created_at: new Date().toISOString() });
      }
      else if (action === 'delete_msg') { db.messages = db.messages.filter(m => m.id != id); }
      else if (action === 'mark_read') { 
        const item = db.messages.find(m => m.id == id); 
        if (item) item.read = true; 
      }
      else if (action === 'mark_all_read') {
        const userName = payload.userName;
        db.messages.forEach(m => {
          if ((m.to === userName || m.type === 'notification' || m.type === 'rejection') && !m.read) {
            m.read = true;
          }
        });
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

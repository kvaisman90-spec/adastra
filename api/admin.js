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

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let db = { 
      ads: [], subscribers: [], messages: [], payments: [], onlineUsers: [],
      adminPassword: '584462'
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
      if (rec.adminPassword) db.adminPassword = rec.adminPassword;
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

      // Смена пароля админа
      if (action === 'change_password') {
        if (payload.oldPassword !== db.adminPassword) {
          return res.status(400).json({ success: false, error: 'Неверный старый пароль' });
        }
        if (!payload.newPassword || payload.newPassword.length < 4) {
          return res.status(400).json({ success: false, error: 'Пароль должен быть минимум 4 символа' });
        }
        db.adminPassword = payload.newPassword;
        await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY },
          body: JSON.stringify(db)
        });
        return res.status(200).json({ success: true, message: 'Пароль изменён' });
      }

      // Проверка пароля (для входа)
      if (action === 'check_password') {
        return res.status(200).json({ 
          success: payload.password === db.adminPassword 
        });
      }

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
        const userName = normalizeName(payload.name);
        const user = db.subscribers.find(s => normalizeName(s.contact) === userName);
        
        // Если пользователь удалён или заблокирован — выкидываем
        if (!user) {
          return res.status(200).json({ success: true, kicked: true, reason: 'Пользователь не найден' });
        }
        if (user.blocked) {
          return res.status(200).json({ success: true, kicked: true, reason: user.blockReason || 'Аккаунт заблокирован' });
        }
        
        const existingUser = db.onlineUsers.find(u => normalizeName(u.name) === userName);
        if (existingUser) {
          existingUser.lastSeen = now;
        } else {
          db.onlineUsers.push({ name: payload.name, role: payload.role || 'client', lastSeen: now });
        }
        
        await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY },
          body: JSON.stringify(db)
        });
        
        return res.status(200).json({ success: true, kicked: false });
      }
      else if (action === 'block_user') {
        const userName = normalizeName(payload.name);
        const user = db.subscribers.find(s => normalizeName(s.contact) === userName);
        if (user) { 
          user.blocked = true; 
          user.blockReason = payload.reason || 'Нарушение правил'; 
          user.blockedAt = new Date().toISOString();
        }
        db.onlineUsers = db.onlineUsers.filter(u => normalizeName(u.name) !== userName);
      }
      else if (action === 'unblock_user') {
        const userName = normalizeName(payload.name);
        const user = db.subscribers.find(s => normalizeName(s.contact) === userName);
        if (user) { 
          user.blocked = false; 
          delete user.blockReason; 
          delete user.blockedAt; 
        }
      }
      else if (action === 'delete_user') {
        const userName = normalizeName(payload.name);
        db.subscribers = db.subscribers.filter(s => normalizeName(s.contact) !== userName);
        db.ads = db.ads.filter(a => normalizeName(a.owner) !== userName);
        db.messages = db.messages.filter(m => normalizeName(m.from) !== userName && normalizeName(m.to) !== userName);
        db.onlineUsers = db.onlineUsers.filter(u => normalizeName(u.name) !== userName);
      }
      else if (action === 'approve_paid') {
        const item = db.ads.find(p => p.id == id);
        if (item) { 
          item.status = 'approved_paid'; 
          const ownerNorm = normalizeName(item.owner);
          db.messages.push({ 
            id: now + 1, 
            from: 'Администратор AdAstra', 
            to: item.owner,
            toNorm: ownerNorm,
            text: `✅ Ваша реклама "${item.title}" одобрена как ПЛАТНАЯ. Перейдите в раздел "Счёт" для оплаты.`, 
            read: false, 
            created_at: new Date().toISOString(), 
            type: 'notification' 
          });
        }
      }
      else if (action === 'approve_free') {
        const item = db.ads.find(p => p.id == id);
        if (item) { 
          item.status = 'approved_free'; 
          const ownerNorm = normalizeName(item.owner);
          db.messages.push({ 
            id: now + 1, 
            from: 'Администратор AdAstra', 
            to: item.owner,
            toNorm: ownerNorm,
            text: `🎁 Ваша реклама "${item.title}" одобрена БЕСПЛАТНО. Она уже в ленте!`, 
            read: false, 
            created_at: new Date().toISOString(), 
            type: 'notification' 
          });
        }
      }
      else if (action === 'reject') {
        const item = db.ads.find(p => p.id == id);
        if (item) {
          item.status = 'rejected'; 
          item.rejectionReason = payload.reason || 'Не соответствует правилам';
          item.rejectedAt = new Date().toISOString();
          const ownerNorm = normalizeName(item.owner);
          
          // Создаём уведомление с нормализованным именем
          db.messages.push({ 
            id: now + 1, 
            from: 'Администратор AdAstra', 
            to: item.owner,
            toNorm: ownerNorm,
            text: `❌ Ваша реклама "${item.title}" отклонена.\n\nПричина: ${item.rejectionReason}\n\nПожалуйста, исправьте и отправьте снова.`, 
            read: false, 
            created_at: new Date().toISOString(), 
            type: 'rejection' 
          });
        }
      }
      else if (action === 'delete') { db.ads = db.ads.filter(p => p.id != id); }
      else if (action === 'confirm_payment') {
        const item = db.ads.find(p => p.id == id);
        if (item) {
          item.status = 'paid'; item.paid = true;
          db.payments.push({ 
            id: now, adId: id, owner: item.owner, title: item.title, 
            amount: payload.amount || 0, method: payload.method || 'unknown', 
            date: new Date().toISOString(), status: 'pending_verification' 
          });
          db.messages.push({ 
            id: now + 2, 
            from: item.owner, 
            to: 'Администратор AdAstra',
            toNorm: 'создатель',
            text: `💰 Клиент сообщил об оплате рекламы "${item.title}" на сумму $${payload.amount || 0} (${payload.method}). Проверьте поступление.`, 
            read: false, 
            created_at: new Date().toISOString(), 
            type: 'payment_notification' 
          });
        }
      }
      else if (action === 'verify_payment') {
        const pay = db.payments.find(p => p.id == id);
        if (pay) { 
          pay.status = 'verified'; 
          const item = db.ads.find(a => a.id == pay.adId); 
          if (item) { item.status = 'paid'; item.paid = true; } 
        }
      }
      else if (action === 'subscribe') {
        const contactNorm = normalizeName(payload.contact);
        const existingUser = db.subscribers.find(s => normalizeName(s.contact) === contactNorm);
        if (existingUser && existingUser.blocked) {
          return res.status(403).json({ success: false, error: 'Аккаунт заблокирован. Обратитесь в поддержку.' });
        }
        if (!existingUser) {
          db.subscribers.push({ 
            id: now, 
            contact: payload.contact, 
            contactNorm: contactNorm,
            date: new Date().toISOString(), 
            blocked: false 
          });
        }
      }
      else if (action === 'support') {
        if (containsBannedContent(payload.text)) {
          return res.status(400).json({ success: false, error: 'Сообщение содержит запрещённый контент.' });
        }
        db.messages.push({ 
          id: now, 
          from: payload.from,
          fromNorm: normalizeName(payload.from),
          text: payload.text, 
          read: false, 
          created_at: new Date().toISOString() 
        });
      }
      else if (action === 'delete_msg') { db.messages = db.messages.filter(m => m.id != id); }
      else if (action === 'mark_read') { 
        const item = db.messages.find(m => m.id == id); 
        if (item) item.read = true; 
      }
      else if (action === 'mark_all_read') {
        const userName = normalizeName(payload.userName);
        db.messages.forEach(m => {
          // Помечаем все сообщения клиента: отправленные им И полученные им
          const fromMatch = m.fromNorm === userName || normalizeName(m.from) === userName;
          const toMatch = m.toNorm === userName || normalizeName(m.to) === userName;
          if (fromMatch || toMatch) {
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

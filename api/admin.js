const API_KEY = '$2a$10$9.ps8GyXkLA1CtMuEvsxcOCxe9W8SIdgoQQfWhhXFJQznNnn8LkO2';
const BIN_ID = '6a87c78ff5f4af5e292f9a29';

// Стоп-слова для фильтрации неподобающего контента
const BANNED_WORDS = [
  'наркотик', 'наркотики', 'кокаин', 'героин', 'марихуана', 'трава', 'спайс',
  'оружие', 'пистолет', 'автомат', 'взрывчатка', 'бомба',
  'проститутк', 'шлюх', 'порно', 'секс-услуг', 'эскорт',
  'террор', 'терроризм', 'экстремизм', 'насилие', 'убийств',
  'детская порнография', 'педофил', 'child porn',
  'мошенник', 'скам', 'развод', 'пирамида', 'финансовая пирамида'
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
      ads: [], 
      subscribers: [], 
      messages: [], 
      payments: [],
      onlineUsers: []
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
      // Очистка устаревших онлайн-пользователей (старше 2 минут)
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

      // КЛИЕНТ: Отправка на модерацию (с фото/видео)
      if (action === 'publish') {
        const titleText = `${payload.title} ${payload.text} ${payload.contact}`;
        
        // Проверка на запрещённый контент
        if (containsBannedContent(titleText)) {
          return res.status(400).json({ 
            success: false, 
            error: 'Обнаружен запрещённый контент. Реклама отклонена.' 
          });
        }
        
        db.ads.push({
          id: now, 
          type: 'ad', 
          status: 'pending', 
          paid: false,
          owner: payload.owner, 
          title: payload.title,
          text: payload.text, 
          cta: payload.cta || '', 
          contact: payload.contact,
          image: payload.image || null,
          video: payload.video || null,
          format: payload.format || '',
          category: payload.category || 'general',
          region: payload.region || 'international',
          city: payload.city || '',
          langs: payload.langs || 7,
          userLang: payload.userLang || 'ru',
          created_at: new Date().toISOString()
        });
      }
      
      // КЛИЕНТ: Heartbeat (отслеживание онлайн)
      else if (action === 'heartbeat') {
        const existingUser = db.onlineUsers.find(u => u.name === payload.name);
        if (existingUser) {
          existingUser.lastSeen = now;
        } else {
          db.onlineUsers.push({
            name: payload.name,
            role: payload.role || 'client',
            lastSeen: now,
            firstSeen: now
          });
        }
      }
      
      // АДМИН: Блокировка клиента
      else if (action === 'block_user') {
        const user = db.subscribers.find(s => s.contact === payload.name);
        if (user) {
          user.blocked = true;
          user.blockedAt = new Date().toISOString();
          user.blockReason = payload.reason || 'Нарушение правил';
        }
        // Удаляем из онлайн
        db.onlineUsers = db.onlineUsers.filter(u => u.name !== payload.name);
      }
      
      // АДМИН: Разблокировка клиента
      else if (action === 'unblock_user') {
        const user = db.subscribers.find(s => s.contact === payload.name);
        if (user) {
          user.blocked = false;
          delete user.blockedAt;
          delete user.blockReason;
        }
      }
      
      // АДМИН: Удаление клиента навсегда
      else if (action === 'delete_user') {
        db.subscribers = db.subscribers.filter(s => s.contact !== payload.name);
        db.ads = db.ads.filter(a => a.owner !== payload.name);
        db.messages = db.messages.filter(m => m.from !== payload.name && m.to !== payload.name);
        db.onlineUsers = db.onlineUsers.filter(u => u.name !== payload.name);
      }
      
      // АДМИН: Одобрить платно
      else if (action === 'approve_paid') {
        const item = db.ads.find(p => p.id == id);
        if (item) { 
          item.status = 'approved_paid'; 
          item.paid = false;
          db.messages.push({
            id: now + 1, 
            from: 'Администратор AdAstra', 
            to: item.owner,
            text: `✅ Ваша реклама "${item.title}" одобрена как ПЛАТНАЯ. Пожалуйста, перейдите в раздел "Счёт" для оплаты.`,
            read: false, 
            created_at: new Date().toISOString(), 
            type: 'notification'
          });
        }
      }
      
      // АДМИН: Одобрить бесплатно
      else if (action === 'approve_free') {
        const item = db.ads.find(p => p.id == id);
        if (item) { 
          item.status = 'approved_free'; 
          item.paid = false;
          db.messages.push({
            id: now + 1, 
            from: 'Администратор AdAstra', 
            to: item.owner,
            text: `🎁 Ваша реклама "${item.title}" одобрена БЕСПЛАТНО. Она уже в ленте!`,
            read: false, 
            created_at: new Date().toISOString(), 
            type: 'notification'
          });
        }
      }
      
      // АДМИН: Отклонить (с уведомлением)
      else if (action === 'reject') {
        const item = db.ads.find(p => p.id == id);
        if (item) {
          item.status = 'rejected';
          item.rejectedAt = new Date().toISOString();
          item.rejectionReason = payload.reason || 'Не соответствует правилам платформы';
          db.messages.push({
            id: now + 1, 
            from: 'Администратор AdAstra', 
            to: item.owner,
            text: `❌ Ваша реклама "${item.title}" отклонена модератором.\n\nПричина: ${item.rejectionReason}\n\nПожалуйста, исправьте и отправьте снова.`,
            read: false, 
            created_at: new Date().toISOString(), 
            type: 'rejection', 
            adId: id
          });
        }
      }
      
      // АДМИН: Удалить объявление
      else if (action === 'delete') {
        db.ads = db.ads.filter(p => p.id != id);
      }
      
      // КЛИЕНТ: Подтверждение оплаты
      else if (action === 'confirm_payment') {
        const item = db.ads.find(p => p.id == id);
        if (item) {
          item.status = 'paid';
          item.paid = true;
          db.payments.push({
            id: now,
            adId: id,
            owner: item.owner,
            title: item.title,
            amount: payload.amount || 0,
            method: payload.method || 'unknown',
            date: new Date().toISOString(),
            status: 'pending_verification'
          });
          db.messages.push({
            id: now + 2, 
            from: item.owner, 
            to: 'Администратор AdAstra',
            text: ` Клиент сообщил об оплате рекламы "${item.title}" на сумму $${payload.amount || 0} (${payload.method || 'unknown'}). Проверьте поступление.`,
            read: false, 
            created_at: new Date().toISOString(), 
            type: 'payment_notification'
          });
        }
      }
      
      // АДМИН: Подтвердить получение денег
      else if (action === 'verify_payment') {
        const pay = db.payments.find(p => p.id == id);
        if (pay) {
          pay.status = 'verified';
          const item = db.ads.find(a => a.id == pay.adId);
          if (item) { 
            item.status = 'paid'; 
            item.paid = true; 
          }
        }
      }
      
      // КЛИЕНТ: Подписка
      else if (action === 'subscribe') {
        // Проверка на блокировку
        const existingUser = db.subscribers.find(s => s.contact === payload.contact);
        if (existingUser && existingUser.blocked) {
          return res.status(403).json({ 
            success: false, 
            error: 'Ваш аккаунт заблокирован. Обратитесь в поддержку.' 
          });
        }
        
        if (!existingUser) {
          db.subscribers.push({ 
            id: now, 
            contact: payload.contact, 
            date: new Date().toISOString(),
            blocked: false,
            lastActivity: now,
            totalAds: 0,
            paidAds: 0
          });
        } else {
          existingUser.lastActivity = now;
        }
      }
      
      // Сообщения
      else if (action === 'support') {
        // Проверка на запрещённый контент в сообщениях
        if (containsBannedContent(payload.text)) {
          return res.status(400).json({ 
            success: false, 
            error: 'Сообщение содержит запрещённый контент.' 
          });
        }
        
        db.messages.push({
          id: now, 
          from: payload.from, 
          text: payload.text,
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

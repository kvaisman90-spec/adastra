const ADMIN_PASS = '584462';

// Твои данные JSON Bin
const JSONBIN_BIN_ID = '6a87c78ff5f4af5e292f9a29';
const JSONBIN_MASTER_KEY = '$2a$10$9.ps8GyXkLA1CtMuEvsxcOCxe9W8SIdgoQQfWhhXFJQznNnn8LkO2';
const RESEND_API_KEY = 're_MS8dwiXa_6u4duP62htLXWby5smibfEHf';

const VERIFIED_BOARDS = {
  IL: [{ name: 'КупДам', email: 'admin@kupdam.ru' }, { name: 'DoskaTV', email: 'info@doskatv.co.il' }, { name: 'Orbita.co.il', email: 'info@orbita.co.il' }],
  RU: [{ name: 'КупДам', email: 'admin@kupdam.ru' }, { name: 'SeaJobs', email: 'cv@allcrew.net' }, { name: 'Grainboard', email: 'info@grainboard.ru' }],
  UA: [{ name: 'IZI.ua', email: 'support@izi.ua' }, { name: 'Гард.City', email: 'thegard.city@gmail.com' }, { name: 'FastivNews', email: 'hello.fastiv@gmail.com' }, { name: 'Nikopol.net', email: 'nikopol.net@ukr.net' }],
  BY: [{ name: 'Kupika.by', email: 'support@kupika.by' }, { name: 'Vishka.by', email: 'admin@infostroy.by' }],
  US: [{ name: 'Whidbey Weekly', email: 'editor@whidbeyweekly.com' }, { name: 'Access Press', email: 'ads@accesspress.org' }, { name: 'Charlotte News', email: 'ads@thecharlottenews.org' }, { name: 'Oklahoma Choice', email: 'classifieds@oklahomaschoiceweekly.com' }, { name: 'Addison Independent', email: 'classifieds@addisonindependent.com' }],
  EU: [{ name: 'Advertigo', email: 'info@advertigo.net' }, { name: 'Global Free Classifieds', email: 'support@global-free-classified-ads.com' }],
  international: [{ name: 'Advertigo', email: 'info@advertigo.net' }, { name: 'Global Free Classifieds', email: 'support@global-free-classified-ads.com' }]
};

const SOCIAL_SHARE_URLS = {
  facebook: (t, x, u) => 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(u) + '&quote=' + encodeURIComponent(t + ' ' + x),
  twitter: (t, x, u) => 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(t + ' ' + x) + '&url=' + encodeURIComponent(u),
  telegram: (t, x, u) => 'https://t.me/share/url?url=' + encodeURIComponent(u) + '&text=' + encodeURIComponent(t + ' ' + x),
  whatsapp: (t, x, u) => 'https://wa.me/?text=' + encodeURIComponent(t + ' ' + x + ' ' + u),
  linkedin: (t, x, u) => 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(u),
  reddit: (t, x, u) => 'https://reddit.com/submit?url=' + encodeURIComponent(u) + '&title=' + encodeURIComponent(t),
  pinterest: (t, x, u, i) => 'https://pinterest.com/pin/create/button/?url=' + encodeURIComponent(u) + '&description=' + encodeURIComponent(t + ' ' + x) + '&media=' + encodeURIComponent(i || '')
};

async function getDB() {
  const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
    headers: { 'X-Master-Key': JSONBIN_MASTER_KEY }
  });
  if (!res.ok) throw new Error('JSON Bin read failed: ' + res.status);
  const data = await res.json();
  return data.record;
}

async function saveDB(data) {
  const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': JSONBIN_MASTER_KEY
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('JSON Bin write failed: ' + res.status);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const db = await getDB();
      return res.status(200).json({
        ads: db.ads || [],
        subscribers: db.subscribers || [],
        messages: db.messages || [],
        payments: db.payments || [],
        onlineUsers: db.onlineUsers || []
      });
    }

    if (req.method === 'POST') {
      const body = req.body;
      const action = body.action;
      const db = await getDB();

      if (action === 'publish') {
        const ad = { 
          id: Date.now(), owner: body.owner, title: body.title, text: body.text, 
          cta: body.cta, contact: body.contact, format: body.format, category: body.category, 
          region: body.region, city: body.city, langs: body.langs, image: body.image, 
          video: body.video, status: 'pending', paid: false, created_at: new Date().toISOString() 
        };
        if (!db.ads) db.ads = [];
        db.ads.push(ad);
        await saveDB(db);
        return res.status(200).json({ success: true, id: ad.id });
      }

      if (action === 'approve_paid' || action === 'approve_free') {
        const adIndex = db.ads.findIndex(a => a.id === body.id);
        if (adIndex === -1) return res.status(404).json({ error: 'Ad not found' });
        
        const ad = db.ads[adIndex];
        ad.status = action === 'approve_paid' ? 'approved_paid' : 'approved_free';
        ad.approved_at = new Date().toISOString();
        
        const notif = { 
          id: Date.now(), from: 'Администратор AdAstra', to: ad.owner, 
          text: 'Ваша реклама "' + ad.title + '" одобрена.', type: 'notification', 
          read: false, created_at: new Date().toISOString() 
        };
        if (!db.messages) db.messages = [];
        db.messages.push(notif);
        await saveDB(db);

        const region = ad.region || 'international';
        let boards = [];
        if (region === 'international') {
          for (const key in VERIFIED_BOARDS) boards = boards.concat(VERIFIED_BOARDS[key]);
        } else if (VERIFIED_BOARDS[region]) {
          boards = VERIFIED_BOARDS[region].concat(VERIFIED_BOARDS.international);
        } else {
          boards = VERIFIED_BOARDS.international;
        }

        const emailSubject = 'Новое объявление AdAstra: ' + ad.title;
        const emailBody = '<h2>Детали объявления</h2><p><strong>Заголовок:</strong> ' + ad.title + '</p><p><strong>Описание:</strong> ' + (ad.text || '') + '</p><p><strong>Категория:</strong> ' + (ad.category || '') + '</p><p><strong>Регион:</strong> ' + (ad.region || '') + ' ' + (ad.city || '') + '</p><p><strong>Контакт:</strong> ' + (ad.contact || '') + '</p><p><strong>Источник:</strong> AdAstra - https://adastra-lime.vercel.app</p>';

        for (let i = 0; i < boards.length; i++) {
          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + RESEND_API_KEY },
              body: JSON.stringify({ from: 'AdAstra <onboarding@resend.dev>', to: [boards[i].email], subject: emailSubject, html: emailBody })
            });
          } catch (e) {
            console.error('Email error:', e.message);
          }
        }
        return res.status(200).json({ success: true });
      }

      if (action === 'reject') {
        const adIndex = db.ads.findIndex(a => a.id === body.id);
        if (adIndex === -1) return res.status(404).json({ error: 'Ad not found' });
        
        const ad = db.ads[adIndex];
        ad.status = 'rejected';
        ad.rejectionReason = body.reason || 'Не соответствует правилам';
        ad.rejectedAt = new Date().toISOString();
        
        const notif = { 
          id: Date.now(), from: 'Администратор AdAstra', to: ad.owner, 
          text: 'Ваша реклама отклонена: ' + ad.rejectionReason, type: 'rejection', 
          read: false, created_at: new Date().toISOString() 
        };
        if (!db.messages) db.messages = [];
        db.messages.push(notif);
        await saveDB(db);
        return res.status(200).json({ success: true });
      }

      if (action === 'delete') {
        db.ads = db.ads.filter(a => a.id !== body.id);
        await saveDB(db);
        return res.status(200).json({ success: true });
      }

      if (action === 'confirm_payment') {
        const ad = db.ads.find(a => a.id === body.id);
        if (!ad) return res.status(404).json({ error: 'Ad not found' });
        
        const payment = { 
          id: Date.now(), adId: body.id, owner: ad.owner, title: ad.title, 
          amount: body.amount, method: body.method, status: 'pending_verification', 
          date: new Date().toISOString() 
        };
        if (!db.payments) db.payments = [];
        db.payments.push(payment);
        await saveDB(db);
        return res.status(200).json({ success: true });
      }

      if (action === 'verify_payment') {
        const payIndex = db.payments.findIndex(p => p.id === body.id);
        if (payIndex === -1) return res.status(404).json({ error: 'Payment not found' });
        
        const payment = db.payments[payIndex];
        payment.status = 'verified';
        
        const adIndex = db.ads.findIndex(a => a.id === payment.adId);
        if (adIndex !== -1) {
          db.ads[adIndex].status = 'paid';
          db.ads[adIndex].paid = true;
        }
        await saveDB(db);
        return res.status(200).json({ success: true });
      }

      if (action === 'support') {
        const msg = { 
          id: Date.now(), from: body.from, text: body.text, type: 'support', 
          read: false, created_at: new Date().toISOString() 
        };
        if (!db.messages) db.messages = [];
        db.messages.push(msg);
        await saveDB(db);
        return res.status(200).json({ success: true });
      }

      if (action === 'mark_read') {
        const msg = db.messages.find(m => m.id === body.id);
        if (msg) {
          msg.read = true;
          await saveDB(db);
        }
        return res.status(200).json({ success: true });
      }

      if (action === 'mark_all_read') {
        db.messages.forEach(m => {
          if (m.to === body.userName || m.type === 'notification' || m.type === 'rejection') {
            m.read = true;
          }
        });
        await saveDB(db);
        return res.status(200).json({ success: true });
      }

      if (action === 'delete_msg') {
        db.messages = db.messages.filter(m => m.id !== body.id);
        await saveDB(db);
        return res.status(200).json({ success: true });
      }

      if (action === 'subscribe') {
        if (!db.subscribers) db.subscribers = [];
        let sub = db.subscribers.find(s => s.contact === body.contact);
        if (sub) {
          sub.date = new Date().toISOString();
        } else {
          sub = { contact: body.contact, date: new Date().toISOString(), blocked: false };
          db.subscribers.push(sub);
        }
        await saveDB(db);
        return res.status(200).json({ success: true });
      }

      if (action === 'heartbeat') {
        if (!db.onlineUsers) db.onlineUsers = [];
        let user = db.onlineUsers.find(u => u.name === body.name);
        if (user) {
          user.lastSeen = new Date().toISOString();
        } else {
          user = { name: body.name, role: body.role, lastSeen: new Date().toISOString() };
          db.onlineUsers.push(user);
        }
        
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        db.onlineUsers = db.onlineUsers.filter(u => u.lastSeen > fiveMinAgo);
        
        if (db.subscribers) {
          const sub = db.subscribers.find(s => s.contact === body.name);
          if (sub && sub.blocked) {
            await saveDB(db);
            return res.status(200).json({ kicked: true, reason: sub.blockReason || 'Заблокирован' });
          }
        }
        await saveDB(db);
        return res.status(200).json({ success: true });
      }

      if (action === 'block_user') {
        if (!db.subscribers) return res.status(404).json({ error: 'User not found' });
        const sub = db.subscribers.find(s => s.contact === body.name);
        if (!sub) return res.status(404).json({ error: 'User not found' });
        sub.blocked = true;
        sub.blockReason = body.reason || 'Нарушение правил';
        sub.blockedAt = new Date().toISOString();
        await saveDB(db);
        return res.status(200).json({ success: true });
      }

      if (action === 'unblock_user') {
        if (!db.subscribers) return res.status(404).json({ error: 'User not found' });
        const sub = db.subscribers.find(s => s.contact === body.name);
        if (!sub) return res.status(404).json({ error: 'User not found' });
        sub.blocked = false;
        sub.blockReason = '';
        sub.blockedAt = null;
        await saveDB(db);
        return res.status(200).json({ success: true });
      }

      if (action === 'delete_user') {
        if (db.subscribers) {
          db.subscribers = db.subscribers.filter(s => s.contact !== body.name);
          await saveDB(db);
        }
        return res.status(200).json({ success: true });
      }

      if (action === 'change_password') {
        if (body.oldPassword !== ADMIN_PASS) return res.status(401).json({ error: 'Wrong password' });
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(404).json({ error: 'Not Found' });
  } catch (e) {
    console.error('Vercel API Error:', e.message, e.stack);
    return res.status(500).json({ error: e.message });
  }
}

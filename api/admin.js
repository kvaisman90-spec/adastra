const ADMIN_PASS = '584462';

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

// Вспомогательные функции для JSON Bin
async function getDB(env) {
  const res = await fetch(`https://api.jsonbin.io/v3/b/${env.JSONBIN_BIN_ID}/latest`, {
    headers: { 'X-Master-Key': env.JSONBIN_MASTER_KEY }
  });
  if (!res.ok) throw new Error('JSON Bin read failed');
  const data = await res.json();
  return data.record;
}

async function saveDB(env, data) {
  const res = await fetch(`https://api.jsonbin.io/v3/b/${env.JSONBIN_BIN_ID}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': env.JSONBIN_MASTER_KEY
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('JSON Bin write failed');
}

export default {
  async fetch(request, env, ctx) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Master-Key'
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    try {
      const url = new URL(request.url);

      // 1. RSS Фид
      if (url.pathname === '/feed.xml' && request.method === 'GET') {
        const db = await getDB(env);
        let rssItems = '';
        for (const ad of (db.ads || [])) {
          if (ad.status === 'approved_paid' || ad.status === 'approved_free' || ad.status === 'paid') {
            rssItems += '<item><title><![CDATA[' + ad.title + ']]></title><description><![CDATA[' + (ad.text || '') + '<br>Контакт: ' + (ad.contact || '') + '<br>Регион: ' + (ad.region || '') + ' ' + (ad.city || '') + ']]></description><link>https://adastra-lime.vercel.app</link><pubDate>' + new Date(ad.approved_at || ad.created_at).toUTCString() + '</pubDate></item>';
          }
        }
        const rss = '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>AdAstra Approved Ads Feed</title><link>https://adastra-lime.vercel.app</link><description>AdAstra RSS Feed</description>' + rssItems + '</channel></rss>';
        return new Response(rss, { headers: { 'Content-Type': 'application/xml', ...cors } });
      }

      // 2. API Шеринга
      if (url.pathname === '/api/share' && request.method === 'POST') {
        const body = await request.json();
        const shareLinks = {};
        for (const platform in SOCIAL_SHARE_URLS) {
          shareLinks[platform] = SOCIAL_SHARE_URLS[platform](body.title || '', body.text || '', body.url || '', body.image || '');
        }
        return new Response(JSON.stringify({ success: true, shareLinks }), { headers: { 'Content-Type': 'application/json', ...cors } });
      }

      // 3. GET запрос (загрузка всех данных для фронтенда)
      if (request.method === 'GET') {
        const db = await getDB(env);
        return new Response(JSON.stringify({
          ads: db.ads || [],
          subscribers: db.subscribers || [],
          messages: db.messages || [],
          payments: db.payments || [],
          onlineUsers: db.onlineUsers || []
        }), { headers: { 'Content-Type': 'application/json', ...cors } });
      }

      // 4. POST запросы (действия)
      if (request.method === 'POST') {
        const body = await request.json();
        const action = body.action;
        const db = await getDB(env);

        if (action === 'publish') {
          const ad = { id: Date.now(), owner: body.owner, title: body.title, text: body.text, cta: body.cta, contact: body.contact, format: body.format, category: body.category, region: body.region, city: body.city, langs: body.langs, image: body.image, video: body.video, status: 'pending', paid: false, created_at: new Date().toISOString() };
          db.ads.push(ad);
          await saveDB(env, db);
          return new Response(JSON.stringify({ success: true, id: ad.id }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'approve_paid' || action === 'approve_free') {
          const adIndex = db.ads.findIndex(a => a.id === body.id);
          if (adIndex === -1) return new Response(JSON.stringify({ error: 'Ad not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...cors } });
          
          const ad = db.ads[adIndex];
          ad.status = action === 'approve_paid' ? 'approved_paid' : 'approved_free';
          ad.approved_at = new Date().toISOString();
          
          const notif = { id: Date.now(), from: 'Администратор AdAstra', to: ad.owner, text: 'Ваша реклама "' + ad.title + '" одобрена.', type: 'notification', read: false, created_at: new Date().toISOString() };
          db.messages.push(notif);
          
          await saveDB(env, db);

          // Автопостинг через Resend
          const region = ad.region || 'international';
          let boards = [];
          if (region === 'international') {
            for (const key in VERIFIED_BOARDS) {
              boards = boards.concat(VERIFIED_BOARDS[key]);
            }
          } else if (VERIFIED_BOARDS[region]) {
            boards = VERIFIED_BOARDS[region].concat(VERIFIED_BOARDS.international);
          } else {
            boards = VERIFIED_BOARDS.international;
          }

          const resendKey = env.RESEND_API_KEY || 're_MS8dwiXa_6u4duP62htLXWby5smibfEHf';
          const emailSubject = 'Новое объявление AdAstra: ' + ad.title;
          const emailBody = '<h2>Детали объявления</h2><p><strong>Заголовок:</strong> ' + ad.title + '</p><p><strong>Описание:</strong> ' + (ad.text || '') + '</p><p><strong>Категория:</strong> ' + (ad.category || '') + '</p><p><strong>Регион:</strong> ' + (ad.region || '') + ' ' + (ad.city || '') + '</p><p><strong>Контакт:</strong> ' + (ad.contact || '') + '</p><p><strong>Источник:</strong> AdAstra - https://adastra-lime.vercel.app</p>';

          for (let i = 0; i < boards.length; i++) {
            try {
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + resendKey },
                body: JSON.stringify({ from: 'AdAstra <onboarding@resend.dev>', to: [boards[i].email], subject: emailSubject, html: emailBody })
              });
            } catch (e) {
              console.error('Email error:', e.message);
            }
          }

          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'reject') {
          const adIndex = db.ads.findIndex(a => a.id === body.id);
          if (adIndex === -1) return new Response(JSON.stringify({ error: 'Ad not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...cors } });
          
          const ad = db.ads[adIndex];
          ad.status = 'rejected';
          ad.rejectionReason = body.reason || 'Не соответствует правилам';
          ad.rejectedAt = new Date().toISOString();
          
          const notif = { id: Date.now(), from: 'Администратор AdAstra', to: ad.owner, text: 'Ваша реклама отклонена: ' + ad.rejectionReason, type: 'rejection', read: false, created_at: new Date().toISOString() };
          db.messages.push(notif);
          
          await saveDB(env, db);
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'delete') {
          db.ads = db.ads.filter(a => a.id !== body.id);
          await saveDB(env, db);
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'confirm_payment') {
          const ad = db.ads.find(a => a.id === body.id);
          if (!ad) return new Response(JSON.stringify({ error: 'Ad not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...cors } });
          
          const payment = { id: Date.now(), adId: body.id, owner: ad.owner, title: ad.title, amount: body.amount, method: body.method, status: 'pending_verification', date: new Date().toISOString() };
          db.payments.push(payment);
          await saveDB(env, db);
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'verify_payment') {
          const payIndex = db.payments.findIndex(p => p.id === body.id);
          if (payIndex === -1) return new Response(JSON.stringify({ error: 'Payment not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...cors } });
          
          const payment = db.payments[payIndex];
          payment.status = 'verified';
          
          const adIndex = db.ads.findIndex(a => a.id === payment.adId);
          if (adIndex !== -1) {
            db.ads[adIndex].status = 'paid';
            db.ads[adIndex].paid = true;
          }
          await saveDB(env, db);
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'support') {
          const msg = { id: Date.now(), from: body.from, text: body.text, type: 'support', read: false, created_at: new Date().toISOString() };
          db.messages.push(msg);
          await saveDB(env, db);
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'mark_read') {
          const msg = db.messages.find(m => m.id === body.id);
          if (msg) {
            msg.read = true;
            await saveDB(env, db);
          }
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'mark_all_read') {
          db.messages.forEach(m => {
            if (m.to === body.userName || m.type === 'notification' || m.type === 'rejection') {
              m.read = true;
            }
          });
          await saveDB(env, db);
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'delete_msg') {
          db.messages = db.messages.filter(m => m.id !== body.id);
          await saveDB(env, db);
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'subscribe') {
          let sub = db.subscribers.find(s => s.contact === body.contact);
          if (sub) {
            sub.date = new Date().toISOString();
          } else {
            sub = { contact: body.contact, date: new Date().toISOString(), blocked: false };
            db.subscribers.push(sub);
          }
          await saveDB(env, db);
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'heartbeat') {
          let user = db.onlineUsers.find(u => u.name === body.name);
          if (user) {
            user.lastSeen = new Date().toISOString();
          } else {
            user = { name: body.name, role: body.role, lastSeen: new Date().toISOString() };
            db.onlineUsers.push(user);
          }
          
          // Очистка старых онлайн-пользователей (старше 5 минут)
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          db.onlineUsers = db.onlineUsers.filter(u => u.lastSeen > fiveMinAgo);
          
          const sub = db.subscribers.find(s => s.contact === body.name);
          if (sub && sub.blocked) {
            await saveDB(env, db);
            return new Response(JSON.stringify({ kicked: true, reason: sub.blockReason || 'Заблокирован' }), { headers: { 'Content-Type': 'application/json', ...cors } });
          }
          
          await saveDB(env, db);
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'block_user') {
          const sub = db.subscribers.find(s => s.contact === body.name);
          if (!sub) return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...cors } });
          sub.blocked = true;
          sub.blockReason = body.reason || 'Нарушение правил';
          sub.blockedAt = new Date().toISOString();
          await saveDB(env, db);
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'unblock_user') {
          const sub = db.subscribers.find(s => s.contact === body.name);
          if (!sub) return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...cors } });
          sub.blocked = false;
          sub.blockReason = '';
          sub.blockedAt = null;
          await saveDB(env, db);
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'delete_user') {
          db.subscribers = db.subscribers.filter(s => s.contact !== body.name);
          await saveDB(env, db);
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'change_password') {
          if (body.oldPassword !== ADMIN_PASS) return new Response(JSON.stringify({ error: 'Wrong password' }), { status: 401, headers: { 'Content-Type': 'application/json', ...cors } });
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
      }

      return new Response('Not Found', { status: 404 });
    } catch (e) {
      console.error('Worker error:', e.message, e.stack);
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
    }
  }
};

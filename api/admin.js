// Cloudflare Workers Backend для AdAstra
const API_URL = '/api/admin';
const ADMIN_PASS = '584462';
const RESEND_API_KEY = typeof process !== 'undefined' && process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY : 're_MS8dwiXa_6u4duP62htLXWby5smibfEHf';
const RESEND_API_URL = 'https://api.resend.com/emails';

const VERIFIED_BOARDS = {
  IL: [
    { name: 'КупДам', email: 'admin@kupdam.ru' },
    { name: 'DoskaTV', email: 'info@doskatv.co.il' },
    { name: 'Orbita.co.il', email: 'info@orbita.co.il' }
  ],
  RU: [
    { name: 'КупДам', email: 'admin@kupdam.ru' },
    { name: 'SeaJobs', email: 'cv@allcrew.net' },
    { name: 'Grainboard', email: 'info@grainboard.ru' }
  ],
  UA: [
    { name: 'IZI.ua', email: 'support@izi.ua' },
    { name: 'Гард.City', email: 'thegard.city@gmail.com' },
    { name: 'FastivNews', email: 'hello.fastiv@gmail.com' },
    { name: 'Nikopol.net', email: 'nikopol.net@ukr.net' }
  ],
  BY: [
    { name: 'Kupika.by', email: 'support@kupika.by' },
    { name: 'Vishka.by', email: 'admin@infostroy.by' }
  ],
  US: [
    { name: 'Whidbey Weekly', email: 'editor@whidbeyweekly.com' },
    { name: 'Access Press', email: 'ads@accesspress.org' },
    { name: 'Charlotte News', email: 'ads@thecharlottenews.org' },
    { name: 'Oklahoma Choice', email: 'classifieds@oklahomaschoiceweekly.com' },
    { name: 'Addison Independent', email: 'classifieds@addisonindependent.com' }
  ],
  EU: [
    { name: 'Advertigo (243 страны)', email: 'info@advertigo.net' },
    { name: 'Global Free Classifieds', email: 'support@global-free-classified-ads.com' }
  ],
  international: [
    { name: 'Advertigo (243 страны)', email: 'info@advertigo.net' },
    { name: 'Global Free Classifieds', email: 'support@global-free-classified-ads.com' }
  ]
};

const SOCIAL_SHARE_URLS = {
  facebook: (title, text, url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(title + ' ' + text)}`,
  twitter: (title, text, url) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(title + ' ' + text)}&url=${encodeURIComponent(url)}`,
  telegram: (title, text, url) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title + ' ' + text)}`,
  whatsapp: (title, text, url) => `https://wa.me/?text=${encodeURIComponent(title + ' ' + text + ' ' + url)}`,
  linkedin: (title, text, url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  reddit: (title, text, url) => `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
  pinterest: (title, text, url, image) => `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(title + ' ' + text)}&media=${encodeURIComponent(image || '')}`
};

export default {
  async fetch(request, env, ctx) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    try {
      const url = new URL(request.url);
      
      if (url.pathname === '/feed.xml' && request.method === 'GET') {
        const adsList = await env.ADS.list();
        let rssItems = '';
        for (const key of adsList.keys) {
          const adData = await env.ADS.get(key.name);
          if (adData) {
            const ad = JSON.parse(adData);
            if (ad.status === 'approved_paid' || ad.status === 'approved_free') {
              rssItems += `<item><title><![CDATA[${ad.title}]]></title><description><![CDATA[${ad.text}<br>Контакт: ${ad.contact}<br>Регион: ${ad.region} ${ad.city || ''}]]></description><link>https://adastra-lime.vercel.app</link><pubDate>${new Date(ad.approved_at || ad.created_at).toUTCString()}</pubDate></item>`;
            }
          }
        }
        const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>AdAstra Approved Ads Feed</title><link>https://adastra-lime.vercel.app</link><description>Автоматический фид одобренных объявлений AdAstra</description>${rssItems}</channel></rss>`;
        return new Response(rss, { headers: { 'Content-Type': 'application/xml', ...cors } });
      }

      if (url.pathname === '/api/share' && request.method === 'POST') {
        const body = await request.json();
        const { title, text, url: adUrl, image } = body;
        const shareLinks = {};
        for (const [platform, generator] of Object.entries(SOCIAL_SHARE_URLS)) {
          shareLinks[platform] = generator(title, text, adUrl, image);
        }
        return new Response(JSON.stringify({ success: true, shareLinks }), { headers: { 'Content-Type': 'application/json', ...cors } });
      }

      if (request.method === 'GET') {
        const data = await getData(env);
        return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', ...cors } });
      }

      if (request.method === 'POST') {
        const body = await request.json();
        const result = await handleAction(body, env);
        return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json', ...cors } });
      }

      return new Response('Not Found', { status: 404 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
    }
  }
};

async function getData(env) {
  return {
    ads: (await env.ADS.list()).keys || [],
    subscribers: (await env.SUBSCRIBERS.list()).keys || [],
    messages: (await env.MESSAGES.list()).keys || [],
    payments: (await env.PAYMENTS.list()).keys || [],
    onlineUsers: (await env.ONLINE_USERS.list()).keys || [],
    adminPassword: ADMIN_PASS
  };
}

async function handleAction(body, env) {
  const { action, ...params } = body;
  switch (action) {
    case 'publish': return await publishAd(params, env);
    case 'approve_paid':
    case 'approve_free': return await approveAd(params, env, action === 'approve_paid');
    case 'reject': return await rejectAd(params, env);
    case 'delete': return await deleteAd(params, env);
    case 'confirm_payment': return await confirmPayment(params, env);
    case 'verify_payment': return await verifyPayment(params, env);
    case 'support': return await sendSupport(params, env);
    case 'mark_read': return await markRead(params, env);
    case 'mark_all_read': return await markAllRead(params, env);
    case 'delete_msg': return await deleteMsg(params, env);
    case 'subscribe': return await subscribe(params, env);
    case 'heartbeat': return await heartbeat(params, env);
    case 'block_user': return await blockUser(params, env);
    case 'unblock_user': return await unblockUser(params, env);
    case 'delete_user': return await deleteUser(params, env);
    case 'change_password': return await changePassword(params, env);
    default: return { error: 'Unknown action' };
  }
}

async function publishAd(params, env) {
  const ad = { id: Date.now(), ...params, status: 'pending', paid: false, created_at: new Date().toISOString() };
  await env.ADS.put(`ad:${ad.id}`, JSON.stringify(ad));
  return { success: true, id: ad.id };
}

async function approveAd(params, env, isPaid) {
  const { id } = params;
  const adData = await env.ADS.get(`ad:${id}`);
  if (!adData) return { error: 'Ad not found' };
  const ad = JSON.parse(adData);
  ad.status = isPaid ? 'approved_paid' : 'approved_free';
  ad.approved_at = new Date().toISOString();
  await env.ADS.put(`ad:${id}`, JSON.stringify(ad));
  ctx.waitUntil(autoPostToVerifiedBoards(ad, env));
  await sendNotification(ad.owner, `Ваша реклама "${ad.title}" одобрена и передана в систему автоматического распространения (RSS-фиды, партнерские площадки и соцсети).`, env);
  return { success: true };
}

async function autoPostToVerifiedBoards(ad, env) {
  const region = ad.region || 'international';
  let boards = [];
  if (region === 'international') {
    boards = Object.values(VERIFIED_BOARDS).flat();
  } else if (VERIFIED_BOARDS[region]) {
    boards = [...VERIFIED_BOARDS[region], ...VERIFIED_BOARDS.international];
  } else {
    boards = VERIFIED_BOARDS.international;
  }
  const emailSubject = `Новое объявление AdAstra: ${ad.title}`;
  const emailBody = `<h2>Детали объявления</h2><p><strong>Заголовок:</strong> ${ad.title}</p><p><strong>Описание:</strong> ${ad.text}</p><p><strong>Категория:</strong> ${ad.category}</p><p><strong>Регион:</strong> ${ad.region} ${ad.city ? `(${ad.city})` : ''}</p><p><strong>Контакт:</strong> ${ad.contact}</p>${ad.image ? `<p><strong>Изображение:</strong> <a href="${ad.image}">${ad.image}</a></p>` : ''}<p><strong>Источник:</strong> AdAstra - https://adastra-lime.vercel.app</p><hr><p><em>Это объявление отправлено автоматически платформой AdAstra.</em></p>`;
  for (const board of boards) {
    try {
      await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: 'AdAstra Auto <onboarding@resend.dev>', to: [board.email], subject: emailSubject, html: emailBody })
      });
      console.log(`SUCCESS: Отправлено на ${board.name} (${board.email})`);
    } catch (e) {
      console.error(`ERROR: Сбой отправки на ${board.name}:`, e.message);
    }
  }
}

async function rejectAd(params, env) {
  const { id, reason } = params;
  const adData = await env.ADS.get(`ad:${id}`);
  if (!adData) return { error: 'Ad not found' };
  const ad = JSON.parse(adData);
  ad.status = 'rejected'; ad.rejectionReason = reason; ad.rejectedAt = new Date().toISOString();
  await env.ADS.put(`ad:${id}`, JSON.stringify(ad));
  await sendNotification(ad.owner, `Ваша реклама отклонена: ${reason}`, env);
  return { success: true };
}

async function deleteAd(params, env) {
  await env.ADS.delete(`ad:${params.id}`);
  return { success: true };
}

async function confirmPayment(params, env) {
  const { id, amount, method } = params;
  const adData = await env.ADS.get(`ad:${id}`);
  if (!adData) return { error: 'Ad not found' };
  const ad = JSON.parse(adData);
  await env.PAYMENTS.put(`payment:${Date.now()}`, JSON.stringify({ id: Date.now(), adId: id, owner: ad.owner, title: ad.title, amount, method, status: 'pending_verification', date: new Date().toISOString() }));
  return { success: true };
}

async function verifyPayment(params, env) {
  const { id } = params;
  const paymentData = await env.PAYMENTS.get(`payment:${id}`);
  if (!paymentData) return { error: 'Payment not found' };
  const payment = JSON.parse(paymentData);
  payment.status = 'verified';
  await env.PAYMENTS.put(`payment:${id}`, JSON.stringify(payment));
  const adData = await env.ADS.get(`ad:${payment.adId}`);
  if (adData) {
    const ad = JSON.parse(adData);
    ad.status = 'paid'; ad.paid = true;
    await env.ADS.put(`ad:${payment.adId}`, JSON.stringify(ad));
  }
  return { success: true };
}

async function sendSupport(params, env) {
  await env.MESSAGES.put(`message:${Date.now()}`, JSON.stringify({ id: Date.now(), from: params.from, text: params.text, type: 'support', read: false, created_at: new Date().toISOString() }));
  return { success: true };
}

async function markRead(params, env) {
  const msgData = await env.MESSAGES.get(`message:${params.id}`);
  if (!msgData) return { error: 'Message not found' };
  const msg = JSON.parse(msgData);
  msg.read = true;
  await env.MESSAGES.put(`message:${params.id}`, JSON.stringify(msg));
  return { success: true };
}

async function markAllRead(params, env) { return { success: true }; }
async function deleteMsg(params, env) { await env.MESSAGES.delete(`message:${params.id}`); return { success: true }; }
async function subscribe(params, env) {
  await env.SUBSCRIBERS.put(`sub:${params.contact}`, JSON.stringify({ contact: params.contact, date: new Date().toISOString(), blocked: false }));
  return { success: true };
}
async function heartbeat(params, env) {
  await env.ONLINE_USERS.put(`user:${params.name}`, JSON.stringify({ name: params.name, role: params.role, lastSeen: new Date().toISOString() }));
  const subData = await env.SUBSCRIBERS.get(`sub:${params.name}`);
  if (subData && JSON.parse(subData).blocked) return { kicked: true, reason: JSON.parse(subData).blockReason };
  return { success: true };
}
async function blockUser(params, env) {
  const subData = await env.SUBSCRIBERS.get(`sub:${params.name}`);
  if (!subData) return { error: 'User not found' };
  const sub = JSON.parse(subData);
  sub.blocked = true; sub.blockReason = params.reason; sub.blockedAt = new Date().toISOString();
  await env.SUBSCRIBERS.put(`sub:${params.name}`, JSON.stringify(sub));
  return { success: true };
}
async function unblockUser(params, env) {
  const subData = await env.SUBSCRIBERS.get(`sub:${params.name}`);
  if (!subData) return { error: 'User not found' };
  const sub = JSON.parse(subData);
  sub.blocked = false; sub.blockReason = ''; sub.blockedAt = null;
  await env.SUBSCRIBERS.put(`sub:${params.name}`, JSON.stringify(sub));
  return { success: true };
}
async function deleteUser(params, env) {
  await env.SUBSCRIBERS.delete(`sub:${params.name}`);
  return { success: true };
}
async function changePassword(params, env) {
  if (params.oldPassword !== ADMIN_PASS) return { error: 'Wrong password' };
  return { success: true };
}
async function sendNotification(to, text, env) {
  await env.MESSAGES.put(`message:${Date.now()}`, JSON.stringify({ id: Date.now(), from: 'Администратор AdAstra', to, text, type: 'notification', read: false, created_at: new Date().toISOString() }));
}

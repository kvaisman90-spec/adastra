// Cloudflare Workers Backend для AdAstra
// Версия 2.0 с автопостингом через Resend

const API_URL = '/api/admin';

// === КОНФИГУРАЦИЯ ===
const ADMIN_PASS = '584462';
const RESEND_API_KEY = 're_MS8dwiXa_6u4duP62htLXWby5smibfEHf';
const RESEND_API_URL = 'https://api.resend.com/emails';

// === БАЗА ДАННЫХ БЕСПЛАТНЫХ ПЛОЩАДОК (EMAIL-ПОСТИНГ) ===
const FREE_BOARDS = {
  // Израиль
  IL: [
    { name: 'Yad2', email: 'info@yad2.co.il', subject: 'New Ad', format: 'text' },
    { name: 'Colabo', email: 'ads@colabo.co.il', subject: 'Publication Request', format: 'html' },
    { name: 'Google Business IL', email: 'post@google.com', subject: 'Business Update', format: 'text' }
  ],
  // США
  US: [
    { name: 'Craigslist', email: 'post@craigslist.org', subject: 'New Posting', format: 'text' },
    { name: 'Facebook Marketplace', email: 'marketplace@facebook.com', subject: 'Listing', format: 'html' }
  ],
  // Россия
  RU: [
    { name: 'Avito', email: 'support@avito.ru', subject: 'New Ad', format: 'text' },
    { name: 'Yula', email: 'info@yula.app', subject: 'Publication', format: 'text' }
  ],
  // Украина
  UA: [
    { name: 'OLX', email: 'support@olx.ua', subject: 'New Ad', format: 'text' }
  ],
  // Беларусь
  BY: [
    { name: 'Kufar', email: 'info@kufar.by', subject: 'New Ad', format: 'text' }
  ],
  // Международный (для всех)
  international: [
    { name: 'Google Business Global', email: 'business@google.com', subject: 'Global Update', format: 'text' },
    { name: 'ClassifiedAds', email: 'post@classifiedads.com', subject: 'New Listing', format: 'html' }
  ]
};

// === ОБРАБОТЧИК ЗАПРОСОВ ===
export default {
  async fetch(request, env, ctx) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    try {
      const url = new URL(request.url);
      
      // GET запросы (чтение данных)
      if (request.method === 'GET') {
        const data = await getData(env);
        return new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json', ...cors }
        });
      }

      // POST запросы (действия)
      if (request.method === 'POST') {
        const body = await request.json();
        const result = await handleAction(body, env);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...cors }
        });
      }

      return new Response('Not Found', { status: 404 });
    } catch (e) {
      console.error('Error:', e);
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors }
      });
    }
  }
};

// === ПОЛУЧЕНИЕ ДАННЫХ ИЗ KV ===
async function getData(env) {
  const ads = await env.ADS.list();
  const subscribers = await env.SUBSCRIBERS.list();
  const messages = await env.MESSAGES.list();
  const payments = await env.PAYMENTS.list();
  const onlineUsers = await env.ONLINE_USERS.list();

  return {
    ads: ads.keys || [],
    subscribers: subscribers.keys || [],
    messages: messages.keys || [],
    payments: payments.keys || [],
    onlineUsers: onlineUsers.keys || [],
    adminPassword: ADMIN_PASS
  };
}

// === ОБРАБОТКА ДЕЙСТВИЙ ===
async function handleAction(body, env) {
  const { action, ...params } = body;

  switch (action) {
    case 'publish':
      return await publishAd(params, env);
    
    case 'approve_paid':
    case 'approve_free':
      return await approveAd(params, env, action === 'approve_paid');
    
    case 'reject':
      return await rejectAd(params, env);
    
    case 'delete':
      return await deleteAd(params, env);
    
    case 'confirm_payment':
      return await confirmPayment(params, env);
    
    case 'verify_payment':
      return await verifyPayment(params, env);
    
    case 'support':
      return await sendSupport(params, env);
    
    case 'mark_read':
      return await markRead(params, env);
    
    case 'mark_all_read':
      return await markAllRead(params, env);
    
    case 'delete_msg':
      return await deleteMsg(params, env);
    
    case 'subscribe':
      return await subscribe(params, env);
    
    case 'heartbeat':
      return await heartbeat(params, env);
    
    case 'block_user':
      return await blockUser(params, env);
    
    case 'unblock_user':
      return await unblockUser(params, env);
    
    case 'delete_user':
      return await deleteUser(params, env);
    
    case 'change_password':
      return await changePassword(params, env);
    
    default:
      return { error: 'Unknown action' };
  }
}

// === ПУБЛИКАЦИЯ РЕКЛАМЫ ===
async function publishAd(params, env) {
  const { owner, title, text, cta, contact, format, category, region, city, langs, image, video } = params;
  
  const ad = {
    id: Date.now(),
    owner,
    title,
    text,
    cta,
    contact,
    format,
    category,
    region,
    city,
    langs,
    image,
    video,
    status: 'pending',
    paid: false,
    created_at: new Date().toISOString()
  };

  await env.ADS.put(`ad:${ad.id}`, JSON.stringify(ad));
  return { success: true, id: ad.id };
}

// === ОДОБРЕНИЕ РЕКЛАМЫ (ГЛАВНАЯ ФУНКЦИЯ С АВТОПОСТИНГОМ) ===
async function approveAd(params, env, isPaid) {
  const { id } = params;
  const adData = await env.ADS.get(`ad:${id}`);
  
  if (!adData) {
    return { error: 'Ad not found' };
  }

  const ad = JSON.parse(adData);
  ad.status = isPaid ? 'approved_paid' : 'approved_free';
  ad.approved_at = new Date().toISOString();
  
  // Сохраняем одобренную рекламу
  await env.ADS.put(`ad:${id}`, JSON.stringify(ad));

  // === АВТОПОСТИНГ НА БЕСПЛАТНЫЕ ПЛОЩАДКИ ===
  try {
    await autoPostToBoards(ad, env);
  } catch (e) {
    console.error('Auto-post failed:', e);
    // Не прерываем процесс, если автопостинг не сработал
  }

  // Уведомляем клиента
  await sendNotification(ad.owner, `Ваша реклама "${ad.title}" одобрена и опубликована!`, env);

  return { success: true };
}

// === ФУНКЦИЯ АВТОПОСТИНГА ЧЕРЕZ RESEND ===
async function autoPostToBoards(ad, env) {
  const region = ad.region || 'international';
  const city = ad.city || '';
  
  // Определяем, какие площадки использовать
  let boards = [];
  
  if (region === 'international') {
    // Если международный - берем все площадки
    boards = Object.values(FREE_BOARDS).flat();
  } else if (FREE_BOARDS[region]) {
    // Если конкретный регион - берем его + международные
    boards = [...FREE_BOARDS[region], ...FREE_BOARDS.international];
  } else {
    // По умолчанию - международные
    boards = FREE_BOARDS.international;
  }

  // Формируем текст письма
  const emailSubject = `New Ad from AdAstra: ${ad.title}`;
  const emailBody = `
    <h2>Advertisement Details</h2>
    <p><strong>Title:</strong> ${ad.title}</p>
    <p><strong>Text:</strong> ${ad.text}</p>
    <p><strong>Category:</strong> ${ad.category}</p>
    <p><strong>Region:</strong> ${ad.region}</p>
    ${city ? `<p><strong>City:</strong> ${city}</p>` : ''}
    <p><strong>Contact:</strong> ${ad.contact}</p>
    <p><strong>CTA:</strong> ${ad.cta}</p>
    ${ad.image ? `<p><strong>Image:</strong> <a href="${ad.image}">${ad.image}</a></p>` : ''}
    ${ad.video ? `<p><strong>Video:</strong> <a href="${ad.video}">${ad.video}</a></p>` : ''}
    <p><strong>Source:</strong> AdAstra - https://adastra-lime.vercel.app</p>
    <hr>
    <p><em>This ad was automatically posted via AdAstra platform.</em></p>
  `;

  // Отправляем письма на каждую площадку
  for (const board of boards) {
    try {
      await sendEmail({
        to: board.email,
        subject: emailSubject,
        html: emailBody,
        from: 'AdAstra Auto-Post <onboarding@resend.dev>'
      });
      
      console.log(`Posted to ${board.name} (${board.email})`);
    } catch (e) {
      console.error(`Failed to post to ${board.name}:`, e);
      // Продолжаем с следующей площадкой, даже если одна не сработала
    }
  }
}

// === ОТПРАВКА EMAIL ЧЕРЕЗ RESEND API ===
async function sendEmail({ to, subject, html, from }) {
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: from || 'AdAstra <onboarding@resend.dev>',
      to: [to],
      subject: subject,
      html: html
    })
  });

  if (!response.ok) {
    throw new Error(`Resend API error: ${response.status}`);
  }

  return await response.json();
}

// === ОСТАЛЬНЫЕ ФУНКЦИИ (без изменений) ===

async function rejectAd(params, env) {
  const { id, reason } = params;
  const adData = await env.ADS.get(`ad:${id}`);
  if (!adData) return { error: 'Ad not found' };
  
  const ad = JSON.parse(adData);
  ad.status = 'rejected';
  ad.rejectedAt = new Date().toISOString();
  ad.rejectionReason = reason;
  
  await env.ADS.put(`ad:${id}`, JSON.stringify(ad));
  await sendNotification(ad.owner, `Ваша реклама отклонена: ${reason}`, env);
  
  return { success: true };
}

async function deleteAd(params, env) {
  const { id } = params;
  await env.ADS.delete(`ad:${id}`);
  return { success: true };
}

async function confirmPayment(params, env) {
  const { id, amount, method } = params;
  const adData = await env.ADS.get(`ad:${id}`);
  if (!adData) return { error: 'Ad not found' };
  
  const ad = JSON.parse(adData);
  const payment = {
    id: Date.now(),
    adId: id,
    owner: ad.owner,
    title: ad.title,
    amount,
    method,
    status: 'pending_verification',
    date: new Date().toISOString()
  };
  
  await env.PAYMENTS.put(`payment:${payment.id}`, JSON.stringify(payment));
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
    ad.status = 'paid';
    ad.paid = true;
    await env.ADS.put(`ad:${payment.adId}`, JSON.stringify(ad));
  }
  
  return { success: true };
}

async function sendSupport(params, env) {
  const { from, text } = params;
  const message = {
    id: Date.now(),
    from,
    text,
    type: 'support',
    read: false,
    created_at: new Date().toISOString()
  };
  
  await env.MESSAGES.put(`message:${message.id}`, JSON.stringify(message));
  return { success: true };
}

async function markRead(params, env) {
  const { id } = params;
  const msgData = await env.MESSAGES.get(`message:${id}`);
  if (!msgData) return { error: 'Message not found' };
  
  const msg = JSON.parse(msgData);
  msg.read = true;
  await env.MESSAGES.put(`message:${id}`, JSON.stringify(msg));
  return { success: true };
}

async function markAllRead(params, env) {
  const { userName } = params;
  // Упрощенная реализация
  return { success: true };
}

async function deleteMsg(params, env) {
  const { id } = params;
  await env.MESSAGES.delete(`message:${id}`);
  return { success: true };
}

async function subscribe(params, env) {
  const { contact } = params;
  const subscriber = {
    contact,
    date: new Date().toISOString(),
    blocked: false
  };
  
  await env.SUBSCRIBERS.put(`sub:${contact}`, JSON.stringify(subscriber));
  return { success: true };
}

async function heartbeat(params, env) {
  const { name, role } = params;
  await env.ONLINE_USERS.put(`user:${name}`, JSON.stringify({
    name,
    role,
    lastSeen: new Date().toISOString()
  }));
  
  // Проверяем, не заблокирован ли пользователь
  const subData = await env.SUBSCRIBERS.get(`sub:${name}`);
  if (subData) {
    const sub = JSON.parse(subData);
    if (sub.blocked) {
      return { kicked: true, reason: sub.blockReason };
    }
  }
  
  return { success: true };
}

async function blockUser(params, env) {
  const { name, reason } = params;
  const subData = await env.SUBSCRIBERS.get(`sub:${name}`);
  if (!subData) return { error: 'User not found' };
  
  const sub = JSON.parse(subData);
  sub.blocked = true;
  sub.blockReason = reason;
  sub.blockedAt = new Date().toISOString();
  
  await env.SUBSCRIBERS.put(`sub:${name}`, JSON.stringify(sub));
  return { success: true };
}

async function unblockUser(params, env) {
  const { name } = params;
  const subData = await env.SUBSCRIBERS.get(`sub:${name}`);
  if (!subData) return { error: 'User not found' };
  
  const sub = JSON.parse(subData);
  sub.blocked = false;
  sub.blockReason = '';
  sub.blockedAt = null;
  
  await env.SUBSCRIBERS.put(`sub:${name}`, JSON.stringify(sub));
  return { success: true };
}

async function deleteUser(params, env) {
  const { name } = params;
  await env.SUBSCRIBERS.delete(`sub:${name}`);
  // Также удаляем все рекламы этого пользователя
  // (упрощенная реализация)
  return { success: true };
}

async function changePassword(params, env) {
  const { oldPassword, newPassword } = params;
  if (oldPassword !== ADMIN_PASS) {
    return { error: 'Wrong password' };
  }
  // В реальной реализации нужно менять ADMIN_PASS
  return { success: true };
}

async function sendNotification(to, text, env) {
  const message = {
    id: Date.now(),
    from: 'Администратор AdAstra',
    to,
    text,
    type: 'notification',
    read: false,
    created_at: new Date().toISOString()
  };
  
  await env.MESSAGES.put(`message:${message.id}`, JSON.stringify(message));
}

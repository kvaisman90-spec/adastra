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
            if (ad.status === 'approved_paid' || ad.status === 'approved_free' || ad.status === 'paid') {
              rssItems += '<item><title><![CDATA[' + ad.title + ']]></title><description><![CDATA[' + (ad.text || '') + '<br>Контакт: ' + (ad.contact || '') + '<br>Регион: ' + (ad.region || '') + ' ' + (ad.city || '') + ']]></description><link>https://adastra-lime.vercel.app</link><pubDate>' + new Date(ad.approved_at || ad.created_at).toUTCString() + '</pubDate></item>';
            }
          }
        }
        const rss = '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>AdAstra Approved Ads Feed</title><link>https://adastra-lime.vercel.app</link><description>AdAstra RSS Feed</description>' + rssItems + '</channel></rss>';
        return new Response(rss, { headers: { 'Content-Type': 'application/xml', ...cors } });
      }

      if (url.pathname === '/api/share' && request.method === 'POST') {
        const body = await request.json();
        const title = body.title || '';
        const text = body.text || '';
        const adUrl = body.url || '';
        const image = body.image || '';
        const shareLinks = {};
        for (const platform in SOCIAL_SHARE_URLS) {
          shareLinks[platform] = SOCIAL_SHARE_URLS[platform](title, text, adUrl, image);
        }
        return new Response(JSON.stringify({ success: true, shareLinks: shareLinks }), { headers: { 'Content-Type': 'application/json', ...cors } });
      }

      if (request.method === 'GET') {
        const adsList = await env.ADS.list();
        const subsList = await env.SUBSCRIBERS.list();
        const msgsList = await env.MESSAGES.list();
        const paysList = await env.PAYMENTS.list();
        const onlList = await env.ONLINE_USERS.list();

        return new Response(JSON.stringify({
          ads: adsList.keys || [],
          subscribers: subsList.keys || [],
          messages: msgsList.keys || [],
          payments: paysList.keys || [],
          onlineUsers: onlList.keys || [],
          adminPassword: ADMIN_PASS
        }), { headers: { 'Content-Type': 'application/json', ...cors } });
      }

      if (request.method === 'POST') {
        const body = await request.json();
        const action = body.action;

        if (action === 'publish') {
          const ad = { id: Date.now(), owner: body.owner, title: body.title, text: body.text, cta: body.cta, contact: body.contact, format: body.format, category: body.category, region: body.region, city: body.city, langs: body.langs, image: body.image, video: body.video, status: 'pending', paid: false, created_at: new Date().toISOString() };
          await env.ADS.put('ad:' + ad.id, JSON.stringify(ad));
          return new Response(JSON.stringify({ success: true, id: ad.id }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'approve_paid' || action === 'approve_free') {
          const id = body.id;
          const adData = await env.ADS.get('ad:' + id);
          if (!adData) return new Response(JSON.stringify({ error: 'Ad not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...cors } });
          const ad = JSON.parse(adData);
          ad.status = action === 'approve_paid' ? 'approved_paid' : 'approved_free';
          ad.approved_at = new Date().toISOString();
          await env.ADS.put('ad:' + id, JSON.stringify(ad));

          const notif = { id: Date.now(), from: 'Администратор AdAstra', to: ad.owner, text: 'Ваша реклама "' + ad.title + '" одобрена.', type: 'notification', read: false, created_at: new Date().toISOString() };
          await env.MESSAGES.put('message:' + notif.id, JSON.stringify(notif));

          const region = ad.region || 'international';
          let boards = [];
          if (region === 'international') {
            const allBoards = [];
            for (const key in VERIFIED_BOARDS) {
              for (let i = 0; i < VERIFIED_BOARDS[key].length; i++) {
                allBoards.push(VERIFIED_BOARDS[key][i]);
              }
            }
            boards = allBoards;
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
          const id = body.id;
          const reason = body.reason || 'Не соответствует правилам';
          const adData = await env.ADS.get('ad:' + id);
          if (!adData) return new Response(JSON.stringify({ error: 'Ad not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...cors } });
          const ad = JSON.parse(adData);
          ad.status = 'rejected';
          ad.rejectionReason = reason;
          ad.rejectedAt = new Date().toISOString();
          await env.ADS.put('ad:' + id, JSON.stringify(ad));
          const notif = { id: Date.now(), from: 'Администратор AdAstra', to: ad.owner, text: 'Ваша реклама отклонена: ' + reason, type: 'rejection', read: false, created_at: new Date().toISOString() };
          await env.MESSAGES.put('message:' + notif.id, JSON.stringify(notif));
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'delete') {
          await env.ADS.delete('ad:' + body.id);
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'confirm_payment') {
          const adData = await env.ADS.get('ad:' + body.id);
          if (!adData) return new Response(JSON.stringify({ error: 'Ad not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...cors } });
          const ad = JSON.parse(adData);
          const payment = { id: Date.now(), adId: body.id, owner: ad.owner, title: ad.title, amount: body.amount, method: body.method, status: 'pending_verification', date: new Date().toISOString() };
          await env.PAYMENTS.put('payment:' + payment.id, JSON.stringify(payment));
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'verify_payment') {
          const paymentData = await env.PAYMENTS.get('payment:' + body.id);
          if (!paymentData) return new Response(JSON.stringify({ error: 'Payment not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...cors } });
          const payment = JSON.parse(paymentData);
          payment.status = 'verified';
          await env.PAYMENTS.put('payment:' + body.id, JSON.stringify(payment));
          const adData = await env.ADS.get('ad:' + payment.adId);
          if (adData) {
            const ad = JSON.parse(adData);
            ad.status = 'paid';
            ad.paid = true;
            await env.ADS.put('ad:' + payment.adId, JSON.stringify(ad));
          }
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'support') {
          const msg = { id: Date.now(), from: body.from, text: body.text, type: 'support', read: false, created_at: new Date().toISOString() };
          await env.MESSAGES.put('message:' + msg.id, JSON.stringify(msg));
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'mark_read') {
          const msgData = await env.MESSAGES.get('message:' + body.id);
          if (!msgData) return new Response(JSON.stringify({ error: 'Message not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...cors } });
          const msg = JSON.parse(msgData);
          msg.read = true;
          await env.MESSAGES.put('message:' + body.id, JSON.stringify(msg));
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'mark_all_read') {
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'delete_msg') {
          await env.MESSAGES.delete('message:' + body.id);
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'subscribe') {
          const sub = { contact: body.contact, date: new Date().toISOString(), blocked: false };
          await env.SUBSCRIBERS.put('sub:' + body.contact, JSON.stringify(sub));
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'heartbeat') {
          const user = { name: body.name, role: body.role, lastSeen: new Date().toISOString() };
          await env.ONLINE_USERS.put('user:' + body.name, JSON.stringify(user));
          const subData = await env.SUBSCRIBERS.get('sub:' + body.name);
          if (subData) {
            const sub = JSON.parse(subData);
            if (sub.blocked) return new Response(JSON.stringify({ kicked: true, reason: sub.blockReason || 'Заблокирован' }), { headers: { 'Content-Type': 'application/json', ...cors } });
          }
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'block_user') {
          const subData = await env.SUBSCRIBERS.get('sub:' + body.name);
          if (!subData) return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...cors } });
          const sub = JSON.parse(subData);
          sub.blocked = true;
          sub.blockReason = body.reason || 'Нарушение правил';
          sub.blockedAt = new Date().toISOString();
          await env.SUBSCRIBERS.put('sub:' + body.name, JSON.stringify(sub));
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'unblock_user') {
          const subData = await env.SUBSCRIBERS.get('sub:' + body.name);
          if (!subData) return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...cors } });
          const sub = JSON.parse(subData);
          sub.blocked = false;
          sub.blockReason = '';
          sub.blockedAt = null;
          await env.SUBSCRIBERS.put('sub:' + body.name, JSON.stringify(sub));
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (action === 'delete_user') {
          await env.SUBSCRIBERS.delete('sub:' + body.name);
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

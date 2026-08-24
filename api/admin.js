const BIN_ID = '6a87c78ff5f4af5e292f9a29';
const API_KEY = '$2a$10$9.ps8GyXkLA1CtMuEvsxcOCxe9W8SIdgoQQfWhhXFJQznNnn8LkO2';
const ADMIN_CODE = '584462';
const BIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultSettings() {
  return {
    appName: 'AdAstra',
    price_day: 3,
    month_cap: 49,
    default_price: 20,
    paypal: 'https://www.paypal.me/kvaisman90',
    wallets: {
      usdt_bep20: '',
      btc: '',
      eth: ''
    },
    languages: ['EN', 'HE', 'AR', 'ES', 'FR', 'RU', 'ZH'],
    categories: [
      'Услуги',
      'Товары',
      'Недвижимость',
      'Работа',
      'События',
      'Обучение',
      'Бизнес',
      'Другое'
    ]
  };
}

function defaultDb() {
  return {
    version: 2,
    updated_at: 0,
    users: [],
    ads: [],
    payments: [],
    subscribers: [],
    tickets: [],
    settings: JSON.parse(JSON.stringify(defaultSettings())),
    logs: []
  };
}

function normalizeDb(rec = {}) {
  const db = defaultDb();

  db.version = Number(rec.version) || 2;
  db.updated_at = Number(rec.updated_at) || 0;

  const arrays = ['users', 'ads', 'payments', 'subscribers', 'tickets', 'logs'];
  for (const key of arrays) {
    if (Array.isArray(rec[key])) db[key] = rec[key];
  }

  if (Array.isArray(rec.messages) && db.tickets.length === 0) {
    db.tickets = rec.messages.map((m) => ({
      id: m.id || uid('ticket'),
      user_id: '',
      user_name: m.from || '',
      subject: 'Поддержка',
      status: 'open',
      admin_unread: !m.read,
      client_unread: false,
      created_at: m.created_at || new Date().toISOString(),
      messages: [
        {
          from: 'client',
          text: m.text || '',
          date: m.created_at || new Date().toISOString()
        }
      ]
    }));
  }

  if (rec.settings && typeof rec.settings === 'object') {
    db.settings = {
      ...db.settings,
      ...rec.settings,
      wallets: {
        ...db.settings.wallets,
        ...(rec.settings.wallets || {})
      }
    };
  }

  if (!Array.isArray(db.settings.categories) || db.settings.categories.length === 0) {
    db.settings.categories = defaultSettings().categories;
  }

  if (!Array.isArray(db.settings.languages) || db.settings.languages.length === 0) {
    db.settings.languages = defaultSettings().languages;
  }

  return db;
}

async function loadDb() {
  const binRes = await fetch(`${BIN_URL}/latest`, {
    headers: { 'X-Master-Key': API_KEY }
  });

  if (!binRes.ok) {
    if (binRes.status === 404) return defaultDb();
    throw new Error('Не удалось прочитать JSONBin.');
  }

  const data = await binRes.json();
  return normalizeDb(data.record || {});
}

async function saveDb(db) {
  db.updated_at = Date.now();

  const put = await fetch(BIN_URL, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': API_KEY
    },
    body: JSON.stringify(db)
  });

  if (!put.ok) throw new Error('Не удалось сохранить JSONBin.');
}

function findAd(db, id) {
  return db.ads.find((a) => String(a.id) === String(id));
}

function findUser(db, id) {
  return db.users.find((u) => String(u.id) === String(id));
}

function findPayment(db, id) {
  return db.payments.find((p) => String(p.id) === String(id));
}

function findTicket(db, id) {
  return db.tickets.find((t) => String(t.id) === String(id));
}

function publicAds(db) {
  return db.ads.filter((a) => {
    if (a.archived) return false;
    return ['paid', 'published', 'approved_free'].includes(a.status);
  });
}

function safeSettings(db) {
  const s = JSON.parse(JSON.stringify(db.settings || {}));
  delete s.admin_code;
  return s;
}

function addLog(db, actor, action, details) {
  db.logs.unshift({
    id: uid('log'),
    date: new Date().toISOString(),
    actor: actor || 'system',
    action,
    details: details || ''
  });

  if (db.logs.length > 500) db.logs.length = 500;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let body = {};

    if (req.method === 'POST') {
      body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    }

    const action = body.action || '';
    const isAdmin = body.adminCode && body.adminCode === ADMIN_CODE;
    const clientId = String(body.clientId || '');

    if (req.method === 'GET') {
      const db = await loadDb();
      return res.status(200).json({
        success: true,
        role: 'guest',
        publicAds: publicAds(db),
        settings: safeSettings(db)
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    if (action === 'ping') {
      return res.status(200).json({ success: true });
    }

    if (action === 'login_admin') {
      if (!isAdmin) {
        return res.status(401).json({ success: false, error: 'Неверный админ-код' });
      }
      return res.status(200).json({ success: true, role: 'admin' });
    }

    const adminOnly = [
      'approve_paid',
      'approve_free',
      'reject',
      'archive',
      'restore',
      'delete_forever',
      'make_paid',
      'make_free',
      'confirm_payment',
      'reject_payment',
      'save_settings',
      'delete_sub',
      'admin_reply',
      'delete_ticket',
      'delete_user',
      'toggle_user_block',
      'restore_backup'
    ];

    if (adminOnly.includes(action) && !isAdmin) {
      return res.status(401).json({ success: false, error: 'Требуется админ-доступ' });
    }

    if (
      action === 'publish' &&
      typeof body.image === 'string' &&
      body.image.length > 2500000
    ) {
      return res.status(413).json({ success: false, error: 'Изображение слишком большое.' });
    }

    let db = await loadDb();
    let changed = false;
    let response = { success: true };

    if (action === 'sync') {
      if (isAdmin) {
        response = { success: true, role: 'admin', db };
      } else {
        const user = findUser(db, clientId) || null;

        const myAds = db.ads.filter((a) => {
          if (String(a.owner_id || '') === clientId) return true;
          if (user && a.owner_name && a.owner_name === user.name) return true;
          return false;
        });

        const myPayments = db.payments.filter((p) => String(p.user_id || '') === clientId);
        const myTickets = db.tickets.filter((t) => String(t.user_id || '') === clientId);

        response = {
          success: true,
          role: user ? 'client' : 'guest',
          user,
          myAds,
          myPayments,
          myTickets,
          publicAds: publicAds(db),
          settings: safeSettings(db)
        };
      }
    }

    else if (action === 'login_guest') {
      const userId = clientId || uid('user');
      let user = findUser(db, userId);

      const payloadUser = {
        name: String(body.name || '').trim(),
        contact: String(body.contact || '').trim(),
        language: String(body.language || '').trim(),
        country: String(body.country || '').trim(),
        city: String(body.city || '').trim(),
        updated_at: new Date().toISOString()
      };

      if (!user) {
        user = {
          id: userId,
          role: 'client',
          status: 'active',
          created_at: new Date().toISOString(),
          ...payloadUser
        };
        db.users.unshift(user);
      } else {
        Object.assign(user, payloadUser);
      }

      changed = true;
      addLog(db, user.name || userId, 'login_guest', user.contact || '');
      response = { success: true, user };
    }

    else if (action === 'publish') {
      const ad = {
        id: uid('ad'),
        type: 'ad',
        status: 'pending',
        paid: false,
        archived: false,
        owner_id: clientId || body.owner_id || '',
        owner_name: String(body.owner_name || body.owner || '').trim(),
        contact: String(body.contact || '').trim(),
        title: String(body.title || '').trim(),
        text: String(body.text || '').trim(),
        cta: String(body.cta || '').trim(),
        category: String(body.category || '').trim(),
        format: String(body.format || 'post').trim(),
        image: body.image || null,
        video_url: String(body.video_url || '').trim(),
        country: String(body.country || '').trim(),
        city: String(body.city || '').trim(),
        region: String(body.region || '').trim(),
        worldwide: Boolean(body.worldwide),
        languages: Array.isArray(body.languages) ? body.languages : [],
        translations: body.translations && typeof body.translations === 'object' ? body.translations : {},
        price: Number(body.price) || 0,
        reject_reason: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      db.ads.unshift(ad);
      changed = true;
      addLog(db, ad.owner_name || ad.owner_id, 'publish', ad.title);
      response = { success: true, ad };
    }

    else if (action === 'approve_paid') {
      const ad = findAd(db, body.id);
      if (!ad) {
        return res.status(404).json({ success: false, error: 'Реклама не найдена' });
      }

      ad.status = 'approved_paid';
      ad.paid = false;
      ad.updated_at = new Date().toISOString();

      const hasPayment = db.payments.find(
        (p) => String(p.ad_id || '') === String(ad.id) && ['pending', 'sent'].includes(p.status)
      );

      if (!hasPayment) {
        db.payments.unshift({
          id: uid('pay'),
          ad_id: ad.id,
          user_id: ad.owner_id || '',
          amount: Number(ad.price || db.settings.default_price || 20),
          currency: 'USD',
          method: '',
          status: 'pending',
          note: 'Оплата за рекламу',
          payer_name: '',
          email: '',
          last4: '',
          txid: '',
          created_at: new Date().toISOString()
        });
      }

      changed = true;
      addLog(db, 'admin', 'approve_paid', ad.title);
      response = { success: true, ad };
    }

    else if (action === 'approve_free') {
      const ad = findAd(db, body.id);
      if (!ad) {
        return res.status(404).json({ success: false, error: 'Реклама не найдена' });
      }

      ad.status = 'approved_free';
      ad.paid = false;
      ad.updated_at = new Date().toISOString();

      changed = true;
      addLog(db, 'admin', 'approve_free', ad.title);
      response = { success: true, ad };
    }

    else if (action === 'reject') {
      const ad = findAd(db, body.id);
      if (!ad) {
        return res.status(404).json({ success: false, error: 'Реклама не найдена' });
      }

      ad.status = 'rejected';
      ad.reject_reason = String(body.reason || '').trim();
      ad.updated_at = new Date().toISOString();

      changed = true;
      addLog(db, 'admin', 'reject', ad.title);
      response = { success: true, ad };
    }

    else if (action === 'archive') {
      const ad = findAd(db, body.id);
      if (!ad) {
        return res.status(404).json({ success: false, error: 'Реклама не найдена' });
      }

      ad.archived = true;
      ad.updated_at = new Date().toISOString();

      changed = true;
      addLog(db, 'admin', 'archive', ad.title);
      response = { success: true, ad };
    }

    else if (action === 'restore') {
      const ad = findAd(db, body.id);
      if (!ad) {
        return res.status(404).json({ success: false, error: 'Реклама не найдена' });
      }

      ad.archived = false;
      ad.updated_at = new Date().toISOString();

      changed = true;
      addLog(db, 'admin', 'restore', ad.title);
      response = { success: true, ad };
    }

    else if (action === 'delete_forever') {
      db.ads = db.ads.filter((a) => String(a.id) !== String(body.id));
      changed = true;
      addLog(db, 'admin', 'delete_forever', String(body.id));
      response = { success: true };
    }

    else if (action === 'make_paid') {
      const ad = findAd(db, body.id);
      if (!ad) {
        return res.status(404).json({ success: false, error: 'Реклама не найдена' });
      }

      ad.paid = true;
      ad.status = 'published';
      ad.published_at = new Date().toISOString();
      ad.updated_at = new Date().toISOString();

      changed = true;
      addLog(db, 'admin', 'make_paid', ad.title);
      response = { success: true, ad };
    }

    else if (action === 'make_free') {
      const ad = findAd(db, body.id);
      if (!ad) {
        return res.status(404).json({ success: false, error: 'Реклама не найдена' });
      }

      ad.paid = false;
      ad.status = 'approved_free';
      ad.updated_at = new Date().toISOString();

      changed = true;
      addLog(db, 'admin', 'make_free', ad.title);
      response = { success: true, ad };
    }

    else if (action === 'create_payment') {
      const amount = Number(body.amount) || 0;
      if (amount <= 0) {
        return res.status(400).json({ success: false, error: 'Неверная сумма' });
      }

      const payment = {
        id: uid('pay'),
        ad_id: body.ad_id || '',
        user_id: clientId || '',
        amount,
        currency: 'USD',
        method: '',
        status: 'pending',
        days: Number(body.days) || 0,
        qty: Number(body.qty) || 1,
        note: String(body.note || '').trim(),
        payer_name: '',
        email: '',
        last4: '',
        txid: '',
        created_at: new Date().toISOString()
      };

      db.payments.unshift(payment);
      changed = true;
      addLog(db, clientId, 'create_payment', String(amount));
      response = { success: true, payment };
    }

    else if (action === 'mark_payment_sent') {
      const payment = findPayment(db, body.paymentId || body.id);
      if (!payment) {
        return res.status(404).json({ success: false, error: 'Платёж не найден' });
      }

      payment.status = 'sent';
      payment.method = String(body.method || payment.method || '').trim();
      payment.payer_name = String(body.payer_name || '').trim();
      payment.email = String(body.email || '').trim();
      payment.last4 = String(body.last4 || '').trim();
      payment.txid = String(body.txid || '').trim();
      payment.sent_at = new Date().toISOString();

      changed = true;
      addLog(db, payment.user_id, 'mark_payment_sent', payment.id);
      response = { success: true, payment };
    }

    else if (action === 'confirm_payment') {
      if (body.paymentId || String(body.id || '').startsWith('pay_')) {
        const payment = findPayment(db, body.paymentId || body.id);
        if (!payment) {
          return res.status(404).json({ success: false, error: 'Платёж не найден' });
        }

        payment.status = 'paid';
        payment.confirmed_at = new Date().toISOString();

        if (payment.ad_id) {
          const ad = findAd(db, payment.ad_id);
          if (ad) {
            ad.paid = true;
            ad.status = 'published';
            ad.published_at = new Date().toISOString();
            ad.updated_at = new Date().toISOString();
          }
        }

        changed = true;
        addLog(db, 'admin', 'confirm_payment', payment.id);
        response = { success: true, payment };
      } else {
        const ad = findAd(db, body.id);
        if (!ad) {
          return res.status(404).json({ success: false, error: 'Реклама не найдена' });
        }

        ad.paid = true;
        ad.status = 'published';
        ad.published_at = new Date().toISOString();
        ad.updated_at = new Date().toISOString();

        changed = true;
        addLog(db, 'admin', 'confirm_payment', ad.title);
        response = { success: true, ad };
      }
    }

    else if (action === 'reject_payment') {
      const payment = findPayment(db, body.paymentId || body.id);
      if (!payment) {
        return res.status(404).json({ success: false, error: 'Платёж не найден' });
      }

      payment.status = 'rejected';
      payment.rejected_at = new Date().toISOString();

      changed = true;
      addLog(db, 'admin', 'reject_payment', payment.id);
      response = { success: true, payment };
    }

    else if (action === 'subscribe') {
      const contact = String(body.contact || '').trim();
      if (!contact) {
        return res.status(400).json({ success: false, error: 'Нужен контакт' });
      }

      if (body.consent === false) {
        return res.status(400).json({ success: false, error: 'Нужно согласие' });
      }

      const exists = db.subscribers.find((s) => s.contact === contact);
      if (!exists) {
        db.subscribers.unshift({
          id: uid('sub'),
          contact,
          name: String(body.name || '').trim(),
          language: String(body.language || '').trim(),
          country: String(body.country || '').trim(),
          city: String(body.city || '').trim(),
          source: String(body.source || 'site').trim(),
          consent: true,
          status: 'active',
          created_at: new Date().toISOString()
        });

        changed = true;
        addLog(db, contact, 'subscribe', body.source || 'site');
      }

      response = { success: true };
    }

    else if (action === 'delete_sub') {
      db.subscribers = db.subscribers.filter((s) => String(s.id) !== String(body.id));
      changed = true;
      addLog(db, 'admin', 'delete_sub', String(body.id));
      response = { success: true };
    }

    else if (action === 'support') {
      const text = String(body.text || '').trim();
      if (!text) {
        return res.status(400).json({ success: false, error: 'Пустое сообщение' });
      }

      let ticket = body.ticketId ? findTicket(db, body.ticketId) : null;

      if (!ticket) {
        ticket = {
          id: uid('ticket'),
          user_id: clientId || '',
          user_name: String(body.from_name || body.from || '').trim(),
          subject: String(body.subject || 'Поддержка').trim(),
          status: 'open',
          admin_unread: true,
          client_unread: false,
          created_at: new Date().toISOString(),
          messages: []
        };
        db.tickets.unshift(ticket);
      }

      ticket.messages.push({
        from: 'client',
        text,
        date: new Date().toISOString()
      });

      ticket.admin_unread = true;
      ticket.status = 'open';

      changed = true;
      addLog(db, ticket.user_name || clientId, 'support', ticket.subject);
      response = { success: true, ticket };
    }

    else if (action === 'admin_reply') {
      const ticket = findTicket(db, body.id || body.ticketId);
      if (!ticket) {
        return res.status(404).json({ success: false, error: 'Обращение не найдено' });
      }

      const text = String(body.text || '').trim();
      if (!text) {
        return res.status(400).json({ success: false, error: 'Пустой ответ' });
      }

      ticket.messages.push({
        from: 'admin',
        text,
        date: new Date().toISOString()
      });

      ticket.admin_unread = false;
      ticket.client_unread = true;

      changed = true;
      addLog(db, 'admin', 'admin_reply', ticket.id);
      response = { success: true, ticket };
    }

    else if (action === 'mark_read') {
      const ticket = findTicket(db, body.id || body.ticketId);
      if (!ticket) {
        return res.status(404).json({ success: false, error: 'Обращение не найдено' });
      }

      if (body.viewer === 'admin') {
        ticket.admin_unread = false;
      } else {
        ticket.client_unread = false;
      }

      changed = true;
      response = { success: true, ticket };
    }

    else if (action === 'delete_ticket') {
      db.tickets = db.tickets.filter((t) => String(t.id) !== String(body.id));
      changed = true;
      addLog(db, 'admin', 'delete_ticket', String(body.id));
      response = { success: true };
    }

    else if (action === 'delete_user') {
      db.users = db.users.filter((u) => String(u.id) !== String(body.id));
      changed = true;
      addLog(db, 'admin', 'delete_user', String(body.id));
      response = { success: true };
    }

    else if (action === 'toggle_user_block') {
      const user = findUser(db, body.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'Клиент не найден' });
      }

      user.status = user.status === 'blocked' ? 'active' : 'blocked';
      changed = true;
      addLog(db, 'admin', 'toggle_user_block', user.name || user.id);
      response = { success: true, user };
    }

    else if (action === 'save_settings') {
      const incoming = body.settings || {};

      db.settings = {
        ...db.settings,
        ...incoming,
        wallets: {
          ...db.settings.wallets,
          ...(incoming.wallets || {})
        }
      };

      if (typeof incoming.categories === 'string') {
        db.settings.categories = incoming.categories
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
      }

      if (typeof incoming.languages === 'string') {
        db.settings.languages = incoming.languages
          .split(',')
          .map((x) => x.trim().toUpperCase())
          .filter(Boolean);
      }

      delete db.settings.admin_code;

      changed = true;
      addLog(db, 'admin', 'save_settings', 'settings updated');
      response = { success: true, settings: safeSettings(db) };
    }

    else if (action === 'restore_backup') {
      if (!body.backup || typeof body.backup !== 'object') {
        return res.status(400).json({ success: false, error: 'Неверный бэкап' });
      }

      db = normalizeDb(body.backup);
      changed = true;
      addLog(db, 'admin', 'restore_backup', 'backup restored');
      response = { success: true };
    }

    else {
      return res.status(400).json({ success: false, error: 'Неизвестное действие' });
    }

    if (changed) {
      await saveDb(db);
    }

    return res.status(200).json(response);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: e.message });
  }
}

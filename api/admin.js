// === ТВОИ НАСТРОЙКИ ===
const API_KEY = '$2a$10$9.ps8GyXkLA1CtMuEvsxcOCxe9W8SIdgoQQfWhhXFJQznNnn8LkO2';
const BIN_ID = '6a87c78ff5f4af5e292f9a29';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 1. Пытаемся прочитать данные
    let posts = [];
    const binRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { 
        'X-Master-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (binRes.ok) {
      const binData = await binRes.json();
      // Если в базе уже есть массив, берем его. Если нет - пустой массив.
      posts = Array.isArray(binData.record) ? binData.record : [];
    } else {
      // Если базы нет (404), мы просто начнем с пустого массива
      console.log("База пуста или ошибка чтения, создаем новую структуру");
    }

    // 2. GET запрос (чтение)
    if (req.method === 'GET') {
      return res.status(200).json({ posts });
    }

    // 3. POST запрос (запись/действия)
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { action, id, ...payload } = body;
      const now = Date.now();

      if (action === 'publish') {
        posts.push({ 
          id: now, type: 'ad', status: 'pending',
          owner: payload.owner, title: payload.title, text: payload.text,
          contact: payload.contact, format: payload.format, langs: payload.langs || 7,
          cta: payload.cta || 'Подробнее',
          created_at: new Date().toISOString()
        });
      } else if (action === 'approve') {
        const item = posts.find(p => p.id == id);
        if (item) item.status = 'approved';
      } else if (action === 'reject') {
        const item = posts.find(p => p.id == id);
        if (item) item.status = 'rejected';
      } else if (action === 'make_paid') {
        const item = posts.find(p => p.id == id);
        if (item) { item.status = 'paid'; item.type = 'client_lead'; item.paid = payload.amount || 0; }
      } else if (action === 'make_free') {
        const item = posts.find(p => p.id == id);
        if (item) { item.status = 'free'; item.type = 'client_lead'; }
      } else if (action === 'pay') {
         // Фиксация оплаты клиентом
         posts.push({
             id: now, type: 'payment', status: 'paid',
             owner: payload.user, paid: payload.amount,
             created_at: new Date().toISOString()
         });
      } else if (action === 'delete') {
        posts = posts.filter(p => p.id != id);
      }

      // Сохраняем обратно в JSONBin
      const updateRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Master-Key': API_KEY 
        },
        body: JSON.stringify(posts)
      });

      if (!updateRes.ok) {
        console.error("Ошибка записи в JSONBin:", await updateRes.text());
        return res.status(500).json({ error: "Не удалось сохранить в базу" });
      }

      return res.status(200).json({ success: true, posts });
    }

    return res.status(405).json({ error: "Метод не разрешен" });

  } catch (e) {
    console.error("Критическая ошибка:", e);
    return res.status(500).json({ error: e.message });
  }
}

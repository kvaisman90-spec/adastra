// === ТВОИ НАСТРОЙКИ ===
const API_KEY = '$2a$10$9.ps8GyXkLA1CtMuEvsxcOCxe9W8SIdgoQQfWhhXFJQznNnn8LkO2';
const BIN_ID = 'ВСТАВЬ_СЮДА_BIN_ID_ИЗ_ШАГА_1'; // Например: 66c123abc...

export default async function handler(req, res) {
  // Разрешаем доступ с любых телефонов (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 1. Читаем данные из облака JSONBin
    const binRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { 'X-Master-Key': API_KEY }
    });
    
    let posts = [];
    if (binRes.ok) {
      const binData = await binRes.json();
      posts = binData.record || [];
    }

    if (req.method === 'GET') {
      return res.status(200).json({ posts });
    }

    if (req.method === 'POST') {
      const { action, id, ...payload } = req.body;
      const now = Date.now();

      // --- ЛОГИКА АДМИНКИ ---
      
      // 1. Клиент отправил заявку
      if (action === 'publish') {
        posts.push({ 
          id: now, 
          type: 'ad', 
          status: 'pending', // На модерации
          owner: payload.owner,
          title: payload.title,
          text: payload.text,
          contact: payload.contact,
          format: payload.format,
          created_at: new Date().toISOString()
        });
      } 
      // 2. Админ одобрил
      else if (action === 'approve') {
        const item = posts.find(p => p.id === id);
        if (item) item.status = 'approved';
      } 
      // 3. Админ отклонил
      else if (action === 'reject') {
        const item = posts.find(p => p.id === id);
        if (item) item.status = 'rejected';
      }
      // 4. Админ сделал платным
      else if (action === 'make_paid') {
        const item = posts.find(p => p.id === id);
        if (item) { item.status = 'paid'; item.type = 'client_lead'; }
      }
      // 5. Админ сделал бесплатным
      else if (action === 'make_free') {
        const item = posts.find(p => p.id === id);
        if (item) { item.status = 'free'; item.type = 'client_lead'; }
      }
      // 6. Удаление
      else if (action === 'delete') {
        posts = posts.filter(p => p.id !== id);
      }

      // 2. Сохраняем обратно в облако
      await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Master-Key': API_KEY 
        },
        body: JSON.stringify(posts)
      });

      return res.status(200).json({ success: true, posts });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

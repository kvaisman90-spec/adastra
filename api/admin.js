import fs from 'fs';
import path from 'path';

// Путь к файлу базы данных
const DB_PATH = path.join(process.cwd(), 'posts.json');

// Функция чтения
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) return [];
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error("Read error", e);
    return [];
  }
}

// Функция записи
function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error("Write error", e);
    return false;
  }
}

export default async function handler(req, res) {
  // 1. GET запрос - просто отдаем все данные
  if (req.method === 'GET') {
    const posts = readDB();
    return res.status(200).json({ posts });
  }

  // 2. POST запрос - обработка действий
  if (req.method === 'POST') {
    const { action, id, ...payload } = req.body;
    let posts = readDB();
    let success = false;

    try {
      if (action === 'publish') {
        // Новая реклама от клиента
        const newAd = {
          id: Date.now(),
          type: 'ad',
          status: 'pending', // На модерации
          created_at: new Date().toISOString(),
          ...payload
        };
        posts.push(newAd);
        success = writeDB(posts);
      } 
      else if (action === 'pay') {
        // Клиент оплатил -> создаем запись о клиенте
        const newClient = {
          id: Date.now(),
          type: 'client_lead',
          owner: payload.user,
          status: 'paid',
          paid: payload.amount,
          created_at: new Date().toISOString()
        };
        posts.push(newClient);
        success = writeDB(posts);
      }
      else if (action === 'approve') {
        const item = posts.find(p => p.id === id);
        if (item) { item.status = 'approved'; success = writeDB(posts); }
      }
      else if (action === 'reject') {
        const item = posts.find(p => p.id === id);
        if (item) { item.status = 'rejected'; success = writeDB(posts); }
      }
      else if (action === 'make_paid') {
        const item = posts.find(p => p.id === id);
        if (item) { item.status = 'paid'; success = writeDB(posts); }
      }
      else if (action === 'make_free') {
        const item = posts.find(p => p.id === id);
        if (item) { item.status = 'free'; success = writeDB(posts); }
      }
      else if (action === 'delete') {
        posts = posts.filter(p => p.id !== id);
        success = writeDB(posts);
      }

      if (success) {
        return res.status(200).json({ success: true, posts });
      } else {
        return res.status(500).json({ success: false, error: 'DB Write Failed' });
      }

    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

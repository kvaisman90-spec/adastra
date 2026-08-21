import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Разрешаем запросы только методом POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const body = req.body;
    
    // Формируем новую запись в стиле твоего posts.json
    const newPost = {
      platform: "client_request", // Помечаем, что это заявка с сайта
      content: `Клиент: ${body.name}, Email: ${body.email}, Сообщение: ${body.message}`,
      hashtags: ["new_client"],
      created_at: new Date().toISOString(),
      status: "pending"
    };

    // Путь к файлу posts.json
    const filePath = path.join(process.cwd(), 'posts.json');
    
    // Читаем старые данные
    let posts = [];
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      posts = JSON.parse(fileContent);
    }

    // Добавляем новую заявку
    posts.push(newPost);

    // Сохраняем обратно в файл
    fs.writeFileSync(filePath, JSON.stringify(posts, null, 2));

    return res.status(200).json({ message: 'Заявка успешно отправлена!' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Ошибка сервера' });
  }
}

import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  const apikey = process.env.OPENROUTER_API_KEY;
  if (!apikey) {
    return NextResponse.json({ error: 'Нет API-ключа OpenRouter' }, { status: 500 });
  }
  if (!text) {
    return NextResponse.json({ error: 'Нет текста для перевода' }, { status: 400 });
  }

  const contentPrompt = [
    'Переведи текст на русский язык.',
    'Сохрани структуру, Markdown и форматирование.',
    'Не добавляй никаких пояснений, введения или обрамления.',
    'Верни только готовый перевод.',
    '',
    text,
  ].join('\n');

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apikey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-7b-instruct:free',
        messages: [
          { role: 'system', content: 'Ты — профессиональный переводчик, владеющий современным разговорным русским.' },
          { role: 'user', content: contentPrompt },
        ]
      }),
    })
    if (!response.ok) {
      const responseText = await response.text();
      let errorMsg = responseText;
      try {
        const errorData = JSON.parse(responseText);
        errorMsg = errorData.error?.message || errorData.error?.code || errorData.error || JSON.stringify(errorData);
        if (typeof errorMsg !== 'string') {
          errorMsg = JSON.stringify(errorMsg);
        }
      } catch {
        // Если не удалось распарсить, используем текст как есть
      }
      
      console.error('Ошибка OpenRouter (статус', response.status, '):', errorMsg);
      console.error('Полный ответ:', responseText);
      
      // Улучшаем сообщение об ошибке для пользователя только для региональных ограничений
      let userFriendlyMsg = errorMsg;
      const lowerMsg = errorMsg.toLowerCase();
      if (lowerMsg.includes('not available in your region') || 
          lowerMsg.includes('access denied') ||
          (lowerMsg.includes('region') && lowerMsg.includes('not available'))) {
        userFriendlyMsg = 'Сервис OpenRouter недоступен в вашем регионе. Попробуйте использовать VPN или обратитесь к администратору.';
      }
      
      return NextResponse.json({ error: userFriendlyMsg }, { status: 500 });
    }
    const data = await response.json();
    let translated = data.choices?.[0]?.message?.content || '';
    // Убираем размышления (для совместимости с моделями, которые их добавляют)
    translated = translated.replace(/<think>[^]*?<\/redacted_reasoning>/g, '').trim();
    // нормализуем экранированные переводы строк, которые модель иногда возвращает как \n
    translated = translated.replace(/\\n/g, '\n');
    // срезаем любые вводные, оставляя с первой строки, похожей на контент
    const lines: string[] = translated.split(/\r?\n/);
    const startIdx = lines.findIndex((l: string) => l.trim().match(/^(#|\d+\.)/));
    if (startIdx >= 0) {
      translated = lines.slice(startIdx).join('\n').trim();
    }
    return NextResponse.json({ result: translated, openrouter_raw: data })
  } catch (e) {
    return NextResponse.json({ error: 'Ошибка перевода', detail: e?.toString() }, { status: 500 });
  }
}


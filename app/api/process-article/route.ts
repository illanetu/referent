import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

type ActionType = 'summary' | 'theses' | 'telegram';

function getPromptForActionType(actionType: ActionType, articleText: string): { system: string; user: string } {
  const baseText = articleText;

  switch (actionType) {
    case 'summary': {
      return {
        system: 'Ты — опытный аналитик и реферант. Твоя задача — создавать краткие и информативные резюме статей на русском языке.',
        user: [
          'Прочитай следующую англоязычную статью и создай краткое резюме на русском языке.',
          'Резюме должно включать:',
          '- Основную тему статьи',
          '- Ключевые идеи и аргументы',
          '- Основные выводы',
          '',
          'Формат: связный текст, без списков и маркировки.',
          'Не добавляй вводных фраз, начинай сразу с содержания.',
          '',
          baseText,
        ].join('\n'),
      };
    }

    case 'theses': {
      return {
        system: 'Ты — эксперт по анализу текстов. Твоя задача — выделять основные тезисы и ключевые моменты из статей.',
        user: [
          'Прочитай следующую англоязычную статью и выдели основные тезисы.',
          'Требования:',
          '- Представь тезисы в виде нумерованного списка',
          '- Каждый тезис должен быть кратким и содержательным',
          '- Охвати все ключевые моменты статьи',
          '- На русском языке',
          '',
          'Не добавляй вводных фраз, начинай сразу со списка тезисов.',
          '',
          baseText,
        ].join('\n'),
      };
    }

    case 'telegram': {
      return {
        system: 'Ты — профессиональный копирайтер, специализирующийся на создании постов для социальных сетей, особенно для Telegram.',
        user: [
          'На основе следующей англоязычной статьи создай пост для Telegram.',
          'Требования:',
          '- Привлекательный заголовок (можно использовать эмодзи)',
          '- Краткое и интересное содержание',
          '- Подходящий для Telegram формат (короткие абзацы, можно использовать эмодзи)',
          '- Длина примерно 1500-2000 символов',
          '- Можно добавить релевантные хештеги в конце',
          '- На русском языке',
          '',
          'Не добавляй пояснений перед постом, начинай сразу с заголовка.',
          '',
          baseText,
        ].join('\n'),
      };
    }

    default:
      throw new Error(`Неизвестный тип действия: ${actionType}`);
  }
}

async function parseArticle(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Не удалось загрузить страницу');
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  // Поиск даты
  const date = (
    $('meta[property="article:published_time"]').attr('content') ||
    $('time').attr('datetime') ||
    $('time').text() ||
    ''
  ).trim();

  // Поиск заголовка
  const title = (
    $('meta[property="og:title"]').attr('content') ||
    $('h1').first().text() ||
    $('title').text() ||
    ''
  ).trim();

  // Поиск основного контента
  let content = (
    $('article').text() ||
    $('.post').text() ||
    $('.content').text() ||
    ''
  );
  // Чистим экранированные переводы строк и лишние пробелы
  content = content.replace(/\\n/g, '\n').replace(/\s{2,}/g, ' ').trim();

  return { date, title, content };
}

export async function POST(req: NextRequest) {
  const { url, actionType } = await req.json();

  if (!url) {
    return NextResponse.json({ error: 'Нет URL' }, { status: 400 });
  }

  if (!actionType || !['summary', 'theses', 'telegram'].includes(actionType)) {
    return NextResponse.json(
      { error: 'Некорректный тип действия. Допустимые значения: summary, theses, telegram' },
      { status: 400 }
    );
  }

  const apikey = process.env.OPENROUTER_API_KEY;
  if (!apikey) {
    return NextResponse.json({ error: 'Нет API-ключа OpenRouter' }, { status: 500 });
  }

  try {
    // Шаг 1: Парсинг статьи
    const { title, content, date } = await parseArticle(url);

    if (!content) {
      return NextResponse.json({ error: 'Не удалось извлечь контент из статьи' }, { status: 400 });
    }

    // Формируем полный текст статьи для AI
    const articleText = [
      title ? `Заголовок: ${title}` : '',
      date ? `Дата: ${date}` : '',
      '',
      'Содержание статьи:',
      content,
    ]
      .filter(Boolean)
      .join('\n');

    // Шаг 2: Формируем промпт в зависимости от типа действия
    const { system, user } = getPromptForActionType(actionType as ActionType, articleText);

    // Шаг 3: Вызываем OpenRouter API
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apikey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.2-3b-instruct:free',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
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
      
      return NextResponse.json(
        { error: userFriendlyMsg },
        { status: 500 }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Ошибка парсинга ответа от OpenRouter:', e);
      return NextResponse.json(
        { error: 'Ошибка парсинга ответа от OpenRouter' },
        { status: 500 }
      );
    }
    
    // Проверяем наличие ошибки в ответе от OpenRouter
    if (data.error) {
      console.error('Ошибка OpenRouter в ответе:', data.error);
      return NextResponse.json(
        { error: `Ошибка OpenRouter: ${data.error.message || JSON.stringify(data.error)}` },
        { status: 500 }
      );
    }

    let result = data.choices?.[0]?.message?.content || '';

    if (!result) {
      console.error('Пустой ответ от AI. Данные:', JSON.stringify(data, null, 2));
      return NextResponse.json({ error: 'Пустой ответ от AI' }, { status: 500 });
    }

    // Обработка ответа: убираем размышления (для совместимости с моделями, которые их добавляют)
    result = result.replace(/<think>[^]*?<\/redacted_reasoning>/g, '').trim();
    // Нормализуем экранированные переводы строк, которые модель иногда возвращает как \n
    result = result.replace(/\\n/g, '\n');

    // Убираем вводные фразы, если они есть
    const lines: string[] = result.split(/\r?\n/);
    // Ищем первую строку, которая похожа на начало контента
    const startIdx = lines.findIndex(
      (l: string) =>
        l.trim().length > 0 &&
        (l.trim().match(/^(#|[\d•\-\*]|[\u{1F300}-\u{1F9FF}])/u) || // заголовок, список, эмодзи
          !l.trim().toLowerCase().match(/^(вот|это|ниже|следующ)/))
    );
    if (startIdx >= 0 && startIdx < lines.length) {
      result = lines.slice(startIdx).join('\n').trim();
    }

    return NextResponse.json({ result, actionType, openrouter_raw: data });
  } catch (error) {
    console.error('Ошибка обработки статьи:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Ошибка обработки статьи' }, { status: 500 });
  }
}


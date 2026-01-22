import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Список моделей для генерации изображений (в порядке приоритета)
const IMAGE_MODELS = [
  'stabilityai/stable-diffusion-2-1',
  'runwayml/stable-diffusion-v1-5',
  'prompthero/openjourney-v4',
  'CompVis/stable-diffusion-v1-4',
];

async function parseArticle(url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (!res.ok) {
      throw new Error('Не удалось загрузить страницу');
    }
    const html = await res.text();
    const $ = cheerio.load(html);

  const date = (
    $('meta[property="article:published_time"]').attr('content') ||
    $('time').attr('datetime') ||
    $('time').text() ||
    ''
  ).trim();

  const title = (
    $('meta[property="og:title"]').attr('content') ||
    $('h1').first().text() ||
    $('title').text() ||
    ''
  ).trim();

  let content = (
    $('article').text() ||
    $('.post').text() ||
    $('.content').text() ||
    ''
  );
  content = content.replace(/\\n/g, '\n').replace(/\s{2,}/g, ' ').trim();

  return { date, title, content };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Ошибка парсинга статьи');
  }
}

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url) {
    return NextResponse.json({ error: 'Нет URL' }, { status: 400 });
  }

  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey) {
    return NextResponse.json({ error: 'Нет API-ключа OpenRouter' }, { status: 500 });
  }

  const huggingFaceApiKey = process.env.HUGGINGFACE_API_KEY;
  if (!huggingFaceApiKey) {
    return NextResponse.json({ error: 'Нет API-ключа Hugging Face' }, { status: 500 });
  }

  try {
    // Шаг 1: Парсинг статьи
    let title, content;
    try {
      const parsed = await parseArticle(url);
      title = parsed.title;
      content = parsed.content;
    } catch (parseError) {
      console.error('Ошибка парсинга статьи:', parseError);
      return NextResponse.json(
        { error: 'Не удалось загрузить статью по этой ссылке.' },
        { status: 400 }
      );
    }

    if (!content) {
      return NextResponse.json({ error: 'Не удалось извлечь контент из статьи' }, { status: 400 });
    }

    // Формируем полный текст статьи для AI
    const articleText = [
      title ? `Заголовок: ${title}` : '',
      '',
      'Содержание статьи:',
      content.substring(0, 4000), // Ограничиваем длину для промпта
    ]
      .filter(Boolean)
      .join('\n');

    // Шаг 2: Создаем промпт для изображения через OpenRouter
    const promptResponse = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1-0528:free',
        messages: [
          {
            role: 'system',
            content: 'Ты — эксперт по созданию промптов для генерации изображений. Твоя задача — создавать детальные и точные промпты на английском языке для text-to-image моделей.',
          },
          {
            role: 'user',
            content: [
              'На основе следующей статьи создай детальный промпт на английском языке для генерации иллюстрации.',
              'Требования:',
              '- Промпт должен быть на английском языке',
              '- Описывай визуальные элементы, стиль, композицию',
              '- Укажи художественный стиль (реалистичный, цифровой арт, фотография и т.д.)',
              '- Длина промпта: 50-100 слов',
              '- Не добавляй пояснений, верни ТОЛЬКО промпт',
              '',
              articleText,
            ].join('\n'),
          },
        ],
      }),
    });

    if (!promptResponse.ok) {
      const errorText = await promptResponse.text();
      console.error('Ошибка OpenRouter:', errorText);
      return NextResponse.json(
        { error: 'Ошибка создания промпта для изображения' },
        { status: 500 }
      );
    }

    let promptData;
    try {
      promptData = await promptResponse.json();
    } catch (parseError) {
      console.error('Ошибка парсинга ответа от OpenRouter:', parseError);
      return NextResponse.json(
        { error: 'Ошибка обработки ответа от AI' },
        { status: 500 }
      );
    }

    let imagePrompt = promptData?.choices?.[0]?.message?.content || '';

    if (!imagePrompt) {
      console.error('Пустой промпт от OpenRouter. Ответ:', JSON.stringify(promptData, null, 2));
      return NextResponse.json(
        { error: 'Не удалось создать промпт для изображения. AI не вернул промпт.' },
        { status: 500 }
      );
    }

    console.log('Получен промпт от OpenRouter (первые 200 символов):', imagePrompt.substring(0, 200));

    // Очищаем промпт от лишних символов и вводных фраз
    // Сохраняем оригинальный промпт на случай, если очистка слишком агрессивна
    const originalPrompt = imagePrompt;
    
    imagePrompt = imagePrompt
      .replace(/^(Here is|This is|The prompt is|Prompt:|Image prompt:)\s*/i, '') // Убираем вводные фразы
      .replace(/^[^a-zA-Z]*/i, '') // Убираем не-буквы в начале (только если они есть)
      .trim();

    // Если после очистки промпт стал слишком коротким, используем оригинальный (но ограничиваем длину)
    if (!imagePrompt || imagePrompt.length < 10) {
      console.warn('Промпт стал слишком коротким после очистки, использую оригинальный');
      imagePrompt = originalPrompt.trim();
    }

    // Ограничиваем длину и убираем только действительно проблемные символы
    imagePrompt = imagePrompt
      .replace(/[^\x20-\x7E\n]/g, '') // Убираем только не-ASCII символы (кроме перевода строки)
      .trim()
      .substring(0, 500); // Ограничиваем длину

    // Финальная проверка
    if (!imagePrompt || imagePrompt.length < 10) {
      console.error('Промпт слишком короткий или пустой после всех обработок. Оригинал:', originalPrompt.substring(0, 200));
      return NextResponse.json(
        { error: 'Не удалось создать валидный промпт для изображения' },
        { status: 500 }
      );
    }

    // Шаг 3: Генерируем изображение через Hugging Face Inference API
    console.log('Начинаю генерацию изображения с промптом:', imagePrompt.substring(0, 100));
    
    let lastError: any = null;
    
    // Пробуем каждую модель по очереди
    for (const model of IMAGE_MODELS) {
      try {
        const hfApiUrl = `https://api-inference.huggingface.co/models/${model}`;
        console.log(`Пробую модель: ${model}`);
        
        const hfResponse = await fetch(hfApiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${huggingFaceApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: imagePrompt,
            parameters: {
              guidance_scale: 7.5,
              num_inference_steps: 30,
            },
          }),
        });

        if (!hfResponse.ok) {
          const errorText = await hfResponse.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText };
          }
          
          console.warn(`Модель ${model} недоступна:`, {
            status: hfResponse.status,
            error: errorData,
          });
          
          // Если модель загружается, ждем и пробуем снова
          if (hfResponse.status === 503) {
            console.log(`Модель ${model} загружается, пробую следующую...`);
            lastError = { status: 503, model, message: 'Модель загружается' };
            continue; // Пробуем следующую модель
          }
          
          // Если модель не найдена или удалена, пробуем следующую
          if (hfResponse.status === 404 || hfResponse.status === 410) {
            console.log(`Модель ${model} недоступна (${hfResponse.status}), пробую следующую...`);
            lastError = { status: hfResponse.status, model, message: 'Модель недоступна' };
            continue; // Пробуем следующую модель
          }
          
          // Для других ошибок (401 и т.д.) останавливаемся
          if (hfResponse.status === 401) {
            return NextResponse.json(
              { error: 'Ошибка авторизации Hugging Face. Проверьте API-ключ.' },
              { status: 401 }
            );
          }
          
          lastError = { status: hfResponse.status, model, message: errorData.error || errorText };
          continue; // Пробуем следующую модель
        }

        // Успешно получили изображение
        const imageBlob = await hfResponse.blob();
        console.log(`Изображение успешно сгенерировано моделью ${model}, размер:`, imageBlob.size);
        
        const arrayBuffer = await imageBlob.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = imageBlob.type || 'image/png';

        return NextResponse.json({
          image: `data:${mimeType};base64,${base64}`,
          prompt: imagePrompt,
          model: model, // Возвращаем информацию о модели
        });
      } catch (modelError: any) {
        console.warn(`Ошибка при использовании модели ${model}:`, modelError?.message);
        lastError = { model, message: modelError?.message };
        continue; // Пробуем следующую модель
      }
    }
    
    // Если все модели не сработали
    console.error('Все модели не сработали. Последняя ошибка:', lastError);
    
    if (lastError?.status === 503) {
      return NextResponse.json(
        { error: 'Все модели загружаются, попробуйте через несколько секунд' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Не удалось сгенерировать изображение. Все доступные модели недоступны. Попробуйте позже.' },
      { status: 500 }
    );
  } catch (error) {
    console.error('Общая ошибка генерации иллюстрации:', error);
    console.error('Тип ошибки:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Стек ошибки:', error instanceof Error ? error.stack : 'Нет стека');
    
    if (error instanceof Error) {
      // Возвращаем понятное сообщение об ошибке
      const errorMessage = error.message || 'Неожиданная ошибка генерации иллюстрации';
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: 'Неожиданная ошибка генерации иллюстрации' },
      { status: 500 }
    );
  }
}

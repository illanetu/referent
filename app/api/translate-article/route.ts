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

  const contentPrompt = `Переведи текст на русский язык. Сохрани структуру, Markdown и форматирование:\n${text}`;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apikey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1-0528:free',
        messages: [
          { role: 'system', content: 'Ты — профессиональный переводчик, владеющий современным разговорным русским.' },
          { role: 'user', content: contentPrompt },
        ]
      }),
    })
    if (!response.ok) {
      const msg = await response.text();
      console.error('Ошибка OpenRouter:', msg);
      return NextResponse.json({ error: 'Ошибка OpenRouter', detail: msg }, { status: 500 });
    }
    const data = await response.json();
    const translated = data.choices?.[0]?.message?.content || '';
    return NextResponse.json({ result: translated, openrouter_raw: data })
  } catch (e) {
    return NextResponse.json({ error: 'Ошибка перевода', detail: e?.toString() }, { status: 500 });
  }
}


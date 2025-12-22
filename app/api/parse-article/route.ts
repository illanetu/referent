import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url) {
    return NextResponse.json({ error: 'Нет URL' }, { status: 400 });
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: 'Не удалось загрузить страницу' }, { status: 400 });
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
    const content = (
      $('article').text() ||
      $('.post').text() ||
      $('.content').text() ||
      ''
    ).replace(/\s{2,}/g, ' ').trim();

    return NextResponse.json({ date, title, content });
  } catch (error) {
    return NextResponse.json({ error: 'Ошибка парсинга' }, { status: 500 });
  }
}


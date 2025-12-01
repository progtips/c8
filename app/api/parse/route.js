import * as cheerio from 'cheerio';

export async function POST(request) {
  try {
    
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return Response.json({ error: 'URL не предоставлен' }, { status: 400 });
    }

    console.log('Парсинг URL:', url);

    // Получаем HTML страницы
    let response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        }
      });
    } catch (fetchError) {
      console.error('Ошибка fetch:', fetchError);
      return Response.json({ 
        error: `Ошибка загрузки страницы: ${fetchError.message}` 
      }, { status: 500 });
    }

    if (!response.ok) {
      return Response.json({ 
        error: `Ошибка загрузки страницы: ${response.status} ${response.statusText}` 
      }, { status: response.status });
    }

    const html = await response.text();
    
    if (!html || html.length === 0) {
      return Response.json({ 
        error: 'Получена пустая страница' 
      }, { status: 500 });
    }

    console.log('HTML получен, длина:', html.length);
    const $ = cheerio.load(html);

    // Поиск заголовка статьи
    let title = '';
    const titleSelectors = [
      'h1.entry-title',
      'h1.post-title',
      'h1.article-title',
      'article h1',
      '.post h1',
      '.content h1',
      '.article h1',
      'h1',
      'title'
    ];

    for (const selector of titleSelectors) {
      const found = $(selector).first().text().trim();
      if (found && found.length > 0) {
        title = found;
        break;
      }
    }

    // Поиск даты публикации
    let date = '';
    const dateSelectors = [
      'time[datetime]',
      'time.published',
      '.published',
      '.post-date',
      '.article-date',
      '[itemprop="datePublished"]',
      'meta[property="article:published_time"]',
      '.date',
      '.entry-date'
    ];

    for (const selector of dateSelectors) {
      const found = $(selector).first();
      if (found.length > 0) {
        date = found.attr('datetime') || found.attr('content') || found.text().trim();
        if (date) break;
      }
    }

    // Если дата не найдена через селекторы, ищем в мета-тегах
    if (!date) {
      date = $('meta[property="article:published_time"]').attr('content') || 
             $('meta[name="date"]').attr('content') || 
             $('meta[name="pubdate"]').attr('content') || '';
    }

    // Поиск основного контента статьи
    let content = '';
    const contentSelectors = [
      'article',
      '.post',
      '.content',
      '.article-content',
      '.entry-content',
      '.post-content',
      '[itemprop="articleBody"]',
      'main article',
      '.article-body'
    ];

    for (const selector of contentSelectors) {
      const found = $(selector).first();
      if (found.length > 0) {
        // Удаляем ненужные элементы (скрипты, стили, реклама и т.д.)
        found.find('script, style, nav, header, footer, aside, .advertisement, .ads, .social-share').remove();
        content = found.text().trim();
        if (content && content.length > 100) { // Минимальная длина для валидного контента
          break;
        }
      }
    }

    // Если контент не найден, пытаемся найти через body
    if (!content || content.length < 100) {
      const body = $('body');
      body.find('script, style, nav, header, footer, aside, .advertisement, .ads').remove();
      content = body.text().trim();
    }

    // Очистка контента от лишних пробелов и переносов строк
    content = content.replace(/\s+/g, ' ').trim();

    const result = {
      date: date || 'Дата не найдена',
      title: title || 'Заголовок не найден',
      content: content || 'Контент не найден'
    };

    console.log('Результат парсинга:', {
      titleLength: result.title.length,
      contentLength: result.content.length,
      dateFound: !!date
    });

    return Response.json(result);

  } catch (error) {
    console.error('Ошибка парсинга:', error);
    return Response.json(
      { error: `Ошибка парсинга: ${error.message}\n\nСтек: ${error.stack}` },
      { status: 500 }
    );
  }
}


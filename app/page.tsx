'use client'

import { useState, useRef, useEffect } from 'react'
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert'

type ActionType = 'summary' | 'theses' | 'telegram' | null

type ErrorInfo = {
  message: string
  type: 'article-load' | 'api-error' | 'translation-error' | 'processing-error' | 'unknown'
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [actionType, setActionType] = useState<ActionType>(null)
  const [result, setResult] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [operationName, setOperationName] = useState<string>('')
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [error, setError] = useState<ErrorInfo | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)

  const handleClear = () => {
    setUrl('')
    setActionType(null)
    setResult('')
    setIsLoading(false)
    setOperationName('')
    setStatusMessage('')
    setError(null)
    setCopySuccess(false)
  }

  const handleCopy = async () => {
    if (result) {
      try {
        await navigator.clipboard.writeText(result)
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
      } catch (err) {
        console.error('Ошибка копирования:', err)
      }
    }
  }

  // Автоматическая прокрутка к результатам после успешной генерации
  useEffect(() => {
    if (result && !isLoading && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result, isLoading])

  const getFriendlyErrorMessage = (error: any, response?: Response): ErrorInfo => {
    // Ошибки загрузки статьи (404, 500, таймаут и т.п.)
    if (response && (response.status === 404 || response.status === 500 || response.status >= 500)) {
      return {
        message: 'Не удалось загрузить статью по этой ссылке.',
        type: 'article-load',
      }
    }

    // Ошибки таймаута
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        message: 'Не удалось загрузить статью по этой ссылке.',
        type: 'article-load',
      }
    }

    // Ошибки от API
    if (error?.message) {
      const errorMsg = error.message.toLowerCase()

      // Ошибки парсинга статьи
      if (errorMsg.includes('не удалось загрузить страницу') || errorMsg.includes('парсинг')) {
        return {
          message: 'Не удалось загрузить статью по этой ссылке.',
          type: 'article-load',
        }
      }

      // Ошибки OpenRouter (региональные ограничения)
      if (errorMsg.includes('region') || errorMsg.includes('недоступен в вашем регионе')) {
        return {
          message: 'Сервис AI недоступен в вашем регионе. Попробуйте использовать VPN.',
          type: 'api-error',
        }
      }

      // Ошибки API ключа
      if (errorMsg.includes('api-ключ') || errorMsg.includes('api key')) {
        return {
          message: 'Ошибка конфигурации сервера. Обратитесь к администратору.',
          type: 'api-error',
        }
      }

      // Ошибки модели
      if (errorMsg.includes('endpoint') || errorMsg.includes('model')) {
        return {
          message: 'Ошибка подключения к AI-сервису. Попробуйте позже.',
          type: 'api-error',
        }
      }

      // Ошибки перевода
      if (errorMsg.includes('перевод') || errorMsg.includes('translation')) {
        return {
          message: 'Не удалось перевести статью. Попробуйте позже.',
          type: 'translation-error',
        }
      }

      // Ошибки обработки
      if (errorMsg.includes('обработк') || errorMsg.includes('processing')) {
        return {
          message: 'Ошибка при обработке статьи. Попробуйте позже.',
          type: 'processing-error',
        }
      }
    }

    // Неизвестная ошибка
    return {
      message: 'Произошла ошибка. Попробуйте позже.',
      type: 'unknown',
    }
  }

  const handleSubmit = async (type: ActionType) => {
    if (!url.trim()) {
      alert('Пожалуйста, введите URL статьи')
      return
    }

    if (!type) {
      return
    }

    setActionType(type)
    setOperationName('')
    setIsLoading(true)
    setResult('')
    setError(null)
    setStatusMessage('Загружаю статью...')

    try {
      setStatusMessage('Обрабатываю статью...')
      const response = await fetch('/api/process-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, actionType: type }),
      })

      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch {
          errorData = { error: 'Ошибка обработки статьи' }
        }
        throw { message: errorData.error || 'Ошибка обработки статьи', response }
      }

      const data = await response.json()
      setIsLoading(false)
      setStatusMessage('')

      if (data.error) {
        setError(getFriendlyErrorMessage({ message: data.error }))
        setResult('')
      } else {
        setResult(data.result || 'Результат не получен')
      }
    } catch (error: any) {
      setIsLoading(false)
      setStatusMessage('')
      setError(getFriendlyErrorMessage(error, error?.response))
      setResult('')
    }
  }

  const getActionName = (type: ActionType, opName: string): string => {
    if (opName) {
      return opName
    }
    switch (type) {
      case 'summary':
        return 'О чем статья?'
      case 'theses':
        return 'Тезисы'
      case 'telegram':
        return 'Пост для Telegram'
      default:
        return ''
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Референт
          </h1>
          <p className="text-lg text-gray-600">
            Анализ англоязычных статей с помощью AI
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 mb-6">
          <div className="mb-6">
            <label
              htmlFor="article-url"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              URL англоязычной статьи
            </label>
            <input
              id="article-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Введите URL статьи, например: https://example.com/article"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
            <p className="mt-2 text-xs text-gray-500">
              Укажите ссылку на англоязычную статью
            </p>
          </div>

          <div className="mb-4">
            <button
              onClick={handleClear}
              disabled={isLoading}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Очистить
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <button
              onClick={() => handleSubmit('summary')}
              disabled={isLoading}
              title="Получить краткое резюме статьи на русском языке"
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95"
            >
              О чем статья?
            </button>
            <button
              onClick={() => handleSubmit('theses')}
              disabled={isLoading}
              title="Получить основные тезисы статьи в виде списка"
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95"
            >
              Тезисы
            </button>
            <button
              onClick={() => handleSubmit('telegram')}
              disabled={isLoading}
              title="Создать пост для Telegram на основе статьи"
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95"
            >
              Пост для Telegram
            </button>
            <button
              onClick={async () => {
                if (!url.trim()) {
                  alert('Пожалуйста, введите URL статьи');
                  return;
                }
                setActionType(null);
                setOperationName('Распарсенная статья');
                setIsLoading(true);
                setResult('');
                setError(null);
                setStatusMessage('Загружаю статью...');
                try {
                  const response = await fetch('/api/parse-article', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url }),
                  });
                  
                  if (!response.ok) {
                    let errorData
                    try {
                      errorData = await response.json();
                    } catch {
                      errorData = { error: 'Ошибка парсинга статьи' };
                    }
                    throw { message: errorData.error || 'Ошибка парсинга статьи', response };
                  }

                  const data = await response.json();
                  setIsLoading(false);
                  setStatusMessage('');
                  if (data.error) {
                    setError(getFriendlyErrorMessage({ message: data.error }));
                    setResult('');
                  } else {
                    setResult(
                      typeof data === 'object' && data !== null && 'content' in data
                        ? (data as any).content || ''
                        : JSON.stringify(data, null, 2)
                    );
                  }
                } catch (error: any) {
                  setIsLoading(false);
                  setStatusMessage('');
                  setError(getFriendlyErrorMessage(error, error?.response));
                  setResult('');
                }
              }}
              disabled={isLoading}
              title="Извлечь текст и метаданные из статьи"
              className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95"
            >
              Парсить статью
            </button>
            <button
              onClick={async () => {
                if (!url.trim()) {
                  alert('Пожалуйста, введите URL статьи');
                  return;
                }
                setActionType(null);
                setOperationName('Переведенная статья');
                setIsLoading(true);
                setResult('');
                setError(null);
                setStatusMessage('Загружаю статью...');
                try {
                  // Шаг 1. Получаем распаршенную статью
                  setStatusMessage('Парсю статью...');
                  const resParse = await fetch('/api/parse-article', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url }),
                  });
                  
                  if (!resParse.ok) {
                    let errorData
                    try {
                      errorData = await resParse.json();
                    } catch {
                      errorData = { error: 'Ошибка парсинга статьи' };
                    }
                    throw { message: errorData.error || 'Ошибка парсинга статьи', response: resParse };
                  }

                  const parsed = await resParse.json();
                  const text =
                    (parsed.title ? `# ${parsed.title}\n` : '') +
                    (parsed.date ? `Дата: ${parsed.date}\n\n` : '') +
                    (parsed.content || '');

                  // Шаг 2. Переводим через OpenRouter AI
                  setStatusMessage('Перевожу статью...');
                  const resTrans = await fetch('/api/translate-article', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text }),
                  });
                  
                  if (!resTrans.ok) {
                    let errorData
                    try {
                      errorData = await resTrans.json();
                    } catch {
                      errorData = { error: 'Ошибка перевода' };
                    }
                    throw { message: errorData.error || 'Ошибка перевода', response: resTrans };
                  }

                  const translated = await resTrans.json();
                  setIsLoading(false);
                  setStatusMessage('');
                  
                  if (translated.error) {
                    setError(getFriendlyErrorMessage({ message: translated.error }));
                    setResult('');
                  } else {
                    setResult(
                      typeof translated === 'object' && translated !== null && 'result' in translated
                        ? (translated as any).result || ''
                        : JSON.stringify(translated, null, 2)
                    );
                  }
                } catch (e: any) {
                  setIsLoading(false);
                  setStatusMessage('');
                  setError(getFriendlyErrorMessage(e, e?.response));
                  setResult('');
                }
              }}
              disabled={isLoading}
              title="Перевести статью на русский язык с помощью AI"
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95"
            >
              Перевести статью
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg shadow-md p-4 mb-6">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
              <p className="text-sm text-blue-800">{statusMessage}</p>
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        {(result || isLoading) && (
          <div ref={resultRef} className="bg-white rounded-lg shadow-xl p-6 sm:p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold text-gray-900">
                {isLoading ? 'Генерация...' : getActionName(actionType, operationName)}
              </h2>
              {!isLoading && result && (
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 text-sm text-indigo-600 bg-indigo-50 rounded-lg font-medium hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all"
                >
                  {copySuccess ? 'Скопировано!' : 'Копировать'}
                </button>
              )}
            </div>
            <div className="min-h-[200px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
              ) : (
                <div className="prose max-w-none">
                  <pre className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {result}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

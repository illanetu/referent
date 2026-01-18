'use client'

import { useState } from 'react'

type ActionType = 'summary' | 'theses' | 'telegram' | null

export default function Home() {
  const [url, setUrl] = useState('')
  const [actionType, setActionType] = useState<ActionType>(null)
  const [result, setResult] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [operationName, setOperationName] = useState<string>('')

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

    try {
      const response = await fetch('/api/process-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, actionType: type }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка обработки статьи')
      }

      const data = await response.json()
      setIsLoading(false)

      if (data.error) {
        setResult(`Ошибка: ${data.error}`)
      } else {
        setResult(data.result || 'Результат не получен')
      }
    } catch (error) {
      setIsLoading(false)
      if (error instanceof Error) {
        setResult(`Ошибка: ${error.message}`)
      } else {
        setResult('Ошибка получения данных')
      }
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
            Referent
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
              placeholder="https://example.com/article"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <button
              onClick={() => handleSubmit('summary')}
              disabled={isLoading}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95"
            >
              О чем статья?
            </button>
            <button
              onClick={() => handleSubmit('theses')}
              disabled={isLoading}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95"
            >
              Тезисы
            </button>
            <button
              onClick={() => handleSubmit('telegram')}
              disabled={isLoading}
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
                try {
                  const response = await fetch('/api/parse-article', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url }),
                  });
                  const data = await response.json();
                  setIsLoading(false);
                  setResult(
                    typeof data === 'object' && data !== null && 'content' in data
                      ? (data as any).content || ''
                      : JSON.stringify(data, null, 2)
                  );
                } catch {
                  setIsLoading(false);
                  setResult('Ошибка получения данных');
                }
              }}
              disabled={isLoading}
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
                try {
                  // Шаг 1. Получаем распаршенную статью
                  const resParse = await fetch('/api/parse-article', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url }),
                  });
                  const parsed = await resParse.json();
                  const text =
                    (parsed.title ? `# ${parsed.title}\n` : '') +
                    (parsed.date ? `Дата: ${parsed.date}\n\n` : '') +
                    (parsed.content || '');

                  // Шаг 2. Переводим через OpenRouter AI
                  const resTrans = await fetch('/api/translate-article', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text }),
                  });
                  const translated = await resTrans.json();
                  setIsLoading(false);
                  setResult(
                    typeof translated === 'object' && translated !== null && 'result' in translated
                      ? (translated as any).result || ''
                      : JSON.stringify(translated, null, 2)
                  );
                } catch (e) {
                  setIsLoading(false);
                  setResult('Ошибка при переводе');
                }
              }}
              disabled={isLoading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95"
            >
              Перевести статью
            </button>
          </div>
        </div>

        {(result || isLoading) && (
          <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              {isLoading ? 'Генерация...' : getActionName(actionType, operationName)}
            </h2>
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

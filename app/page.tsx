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
  const [imageResult, setImageResult] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [operationName, setOperationName] = useState<string>('')
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [error, setError] = useState<ErrorInfo | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)
  const shareMenuRef = useRef<HTMLDivElement>(null)

  const handleClear = () => {
    setUrl('')
    setActionType(null)
    setResult('')
    setImageResult(null)
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

  const handleShare = async () => {
    if (!result && !imageResult) return

    // Пробуем использовать Web Share API, если доступен
    if (navigator.share) {
      try {
        const shareData: any = {
          title: getActionName(actionType, operationName),
        }
        
        if (result) {
          shareData.text = result
        }
        
        if (imageResult) {
          // Конвертируем base64 в blob для sharing
          const response = await fetch(imageResult)
          const blob = await response.blob()
          const file = new File([blob], 'illustration.png', { type: blob.type })
          shareData.files = [file]
        }
        
        await navigator.share(shareData)
        setShowShareMenu(false)
        return
      } catch (err) {
        // Пользователь отменил или произошла ошибка
        if ((err as Error).name !== 'AbortError') {
          console.error('Ошибка Web Share API:', err)
        }
      }
    }

    // Если Web Share API недоступен, показываем меню
    setShowShareMenu(!showShareMenu)
  }

  const shareToMessenger = (messenger: 'telegram' | 'whatsapp' | 'vk') => {
    if (!result) return

    const encodedText = encodeURIComponent(result)
    let url = ''

    switch (messenger) {
      case 'telegram':
        url = `https://t.me/share/url?text=${encodedText}`
        break
      case 'whatsapp':
        url = `https://wa.me/?text=${encodedText}`
        break
      case 'vk':
        url = `https://vk.com/share.php?comment=${encodedText}`
        break
    }

    if (url) {
      window.open(url, '_blank', 'width=600,height=400')
      setShowShareMenu(false)
    }
  }

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setShowShareMenu(false)
      }
    }

    if (showShareMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showShareMenu])

  // Автоматическая прокрутка к результатам после успешной генерации
  useEffect(() => {
    if ((result || imageResult) && !isLoading && resultRef.current) {
      // Небольшая задержка для гарантии обновления DOM
      const timer = setTimeout(() => {
        if (resultRef.current) {
          resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [result, imageResult, isLoading])

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
    setImageResult(null)
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
        setImageResult(null)
      } else {
        setResult(data.result || 'Результат не получен')
        setImageResult(null)
      }
    } catch (error: any) {
      setIsLoading(false)
      setStatusMessage('')
      setError(getFriendlyErrorMessage(error, error?.response))
      setResult('')
      setImageResult(null)
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
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Референт-переводчик
          </h1>
          <p className="text-base sm:text-lg text-gray-600 px-2">
            Анализ англоязычных статей с помощью AI
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 lg:p-8 mb-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="article-url"
                className="block text-sm font-medium text-gray-700"
              >
                URL англоязычной статьи
              </label>
              <button
                onClick={handleClear}
                disabled={isLoading}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-600 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Очистить
              </button>
            </div>
            <input
              id="article-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Введите URL статьи, например: https://example.com/article"
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
            <p className="mt-2 text-xs text-gray-500">
              Укажите ссылку на англоязычную статью
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <button
              onClick={() => handleSubmit('summary')}
              disabled={isLoading}
              title="Получить краткое резюме статьи на русском языке"
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-indigo-600 text-white rounded-lg text-sm sm:text-base font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95"
            >
              О чем статья?
            </button>
            <button
              onClick={() => handleSubmit('theses')}
              disabled={isLoading}
              title="Получить основные тезисы статьи в виде списка"
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-indigo-600 text-white rounded-lg text-sm sm:text-base font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95"
            >
              Тезисы
            </button>
            <button
              onClick={() => handleSubmit('telegram')}
              disabled={isLoading}
              title="Создать пост для Telegram на основе статьи"
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-indigo-600 text-white rounded-lg text-sm sm:text-base font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95"
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
                setOperationName('Иллюстрация');
                setIsLoading(true);
                setResult('');
                setImageResult(null);
                setError(null);
                setStatusMessage('Загружаю статью...');
                try {
                  setStatusMessage('Создаю промпт для изображения...');
                  const response = await fetch('/api/generate-illustration', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url }),
                  });
                  
                  if (!response.ok) {
                    let errorData
                    try {
                      errorData = await response.json();
                    } catch {
                      errorData = { error: 'Ошибка генерации иллюстрации' };
                    }
                    throw { message: errorData.error || 'Ошибка генерации иллюстрации', response };
                  }

                  const data = await response.json();
                  setIsLoading(false);
                  setStatusMessage('');
                  
                  if (data.error) {
                    setError(getFriendlyErrorMessage({ message: data.error }));
                    setImageResult(null);
                  } else {
                    setImageResult(data.image || null);
                    setResult(''); // Очищаем текстовый результат, показываем только изображение
                  }
                } catch (error: any) {
                  setIsLoading(false);
                  setStatusMessage('');
                  setError(getFriendlyErrorMessage(error, error?.response));
                  setImageResult(null);
                }
              }}
              disabled={isLoading}
              title="Сгенерировать иллюстрацию на основе статьи"
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-purple-600 text-white rounded-lg text-sm sm:text-base font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95"
            >
              Иллюстрация
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg shadow-md p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
              <p className="text-sm text-blue-800">{statusMessage}</p>
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-4 sm:mb-6">
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        {(result || imageResult || isLoading) && (
          <div ref={resultRef} className="bg-white rounded-lg shadow-xl p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
                {isLoading ? 'Генерация...' : getActionName(actionType, operationName)}
              </h2>
              {!isLoading && (result || imageResult) && (
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <div className="relative" ref={shareMenuRef}>
                    <button
                      onClick={handleShare}
                      className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-green-600 bg-green-50 rounded-lg font-medium hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      <span>Поделиться</span>
                    </button>
                    {showShareMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
                        <button
                          onClick={() => shareToMessenger('telegram')}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.06 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.35-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                          </svg>
                          <span>Telegram</span>
                        </button>
                        <button
                          onClick={() => shareToMessenger('whatsapp')}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                          </svg>
                          <span>WhatsApp</span>
                        </button>
                        <button
                          onClick={() => shareToMessenger('vk')}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12.785 16.241s.224-.027.34-.162c.107-.125.105-.29.105-.29s-.015-2.08.888-2.386c.906-.31 2.07 1.447 3.3 2.09.93.49 1.636.38 1.636.38l3.295-.048s1.724-.11.906-1.473c-.067-.11-.48-1.003-2.47-2.84-2.09-1.94-1.81-.81.707-2.483 1.48-1.25 2.07-2.01 1.884-2.33-.174-.31-1.247-.228-1.247-.228l-3.58.022s-.266-.036-.463.08c-.19.112-.31.37-.31.37s-.558 1.49-1.297 2.76c-1.563 2.65-2.19 2.79-2.445 2.62-.598-.4-.45-1.61-.45-2.47 0-2.69.404-3.81-.79-4.1-.397-.1-.69-.17-1.71-.18-1.31-.01-2.41.01-3.03.31-.41.2-.72.64-.53.66.24.03.78.14 1.07.51.37.46.36 1.5.36 1.5s.21 3.15-.5 3.54c-.49.27-1.17-.28-2.62-2.78-.74-1.24-1.3-2.61-1.3-2.61s-.11-.26-.3-.4c-.23-.15-.55-.2-.55-.2l-3.42.027s-.51.015-.7.23c-.17.2-.01.62-.01.62s2.67 6.28 5.69 9.45c2.77 2.91 5.93 2.72 5.93 2.72h1.42z"/>
                          </svg>
                          <span>ВКонтакте</span>
                        </button>
                      </div>
                    )}
                  </div>
                  {result && (
                    <button
                      onClick={handleCopy}
                      className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-indigo-600 bg-indigo-50 rounded-lg font-medium hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all flex items-center justify-center gap-2"
                    >
                      {copySuccess ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Скопировано!</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>Копировать</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="min-h-[200px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
              ) : imageResult ? (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <img
                      src={imageResult}
                      alt="Сгенерированная иллюстрация"
                      className="max-w-full h-auto rounded-lg shadow-md"
                    />
                  </div>
                  {result && (
                    <div className="prose max-w-none overflow-x-auto">
                      <pre className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm sm:text-base break-words">
                        {result}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="prose max-w-none overflow-x-auto">
                  <pre className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm sm:text-base break-words">
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

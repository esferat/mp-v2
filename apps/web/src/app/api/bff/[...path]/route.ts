import { NextResponse, type NextRequest } from 'next/server';
import { ApiError, createServerClient } from '@/shared/api';
import { revalidateCatalog } from '@/shared/api/catalog-cache';

/**
 * Универсальный BFF-роут (задача 2.6): браузер ходит ТОЛЬКО сюда
 * ('/api/bff/**'), дальше — gateway с токеном сессии (токен не покидает
 * сервер web, в DOM не попадает — AC 2.6).
 *
 * Тонкая обёртка: проброс метода/тела/заголовков, Authorization из сессии,
 * x-request-id от nginx; ошибки gateway → единый формат ApiError.
 * Бизнес-логики и доступа к БД здесь НЕТ (fsd.md §6, №9).
 */
async function proxy(request: NextRequest): Promise<NextResponse> {
  // Путь после /api/bff → путь gateway ('/catalog/doctors?x=1')
  const path = `${request.nextUrl.pathname.replace(/^\/api\/bff/, '')}${request.nextUrl.search}`;

  const isBodyMethod = request.method !== 'GET' && request.method !== 'HEAD';
  const contentType = request.headers.get('content-type');
  const isMultipart = (contentType ?? '').includes('multipart/form-data');
  // multipart: тело уходит стримом (binary нельзя превращать в строку, 3.4/4.4)
  const body = !isBodyMethod ? undefined : isMultipart ? request.body : await request.text();

  try {
    const client = await createServerClient();
    const result = await client.request<unknown>(path, {
      method: request.method,
      ...(body ? { body } : {}),
      // undici требует duplex для потокового тела
      ...(isMultipart ? ({ duplex: 'half' } as RequestInit & { duplex?: 'half' }) : {}),
      headers: {
        ...(contentType ? { 'content-type': contentType } : {}),
        // Прокидываем trace-id от nginx — он же в логах сервисов (S7.2/8.1)
        ...(request.headers.get('x-request-id')
          ? { 'x-request-id': request.headers.get('x-request-id') as string }
          : {}),
      },
      // Прокси — не место для ретраев (повтор бронирования опасен): 2.6
      noRetry: true,
    });

    const response = NextResponse.json(result);
    // Успешная мутация справочника → инвалидация серверного кэша (2.6:
    // revalidateTag; события doctor.*/specialization.* как раз от этих правок)
    if (isBodyMethod) revalidateCatalog(path);
    return response;
  } catch (error) {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError('BFF: неизвестная ошибка', { code: 'BFF_ERROR', status: 500 });

    return NextResponse.json(
      {
        code: apiError.code,
        message: apiError.message,
        ...(apiError.field ? { field: apiError.field } : {}),
        ...(apiError.requestId ? { requestId: apiError.requestId } : {}),
      },
      { status: apiError.status >= 100 && apiError.status < 600 ? apiError.status : 500 },
    );
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };

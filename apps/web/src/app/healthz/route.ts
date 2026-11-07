import { NextResponse } from 'next/server';

/**
 * Liveness витрины (0.7 AC: каждый проект отвечает на /healthz 200).
 * Проверка зависимостей (gateway) добавляется в задачах 1.x.
 */
export function GET(): NextResponse {
  return NextResponse.json({
    status: 'ok',
    service: 'web',
    uptimeSeconds: Math.round(process.uptime()),
  });
}

import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ClientCredentialsTokenCache } from '@mp/service-kit';
import { MAIL_SENDER, PATIENT_EMAIL_SOURCE, SEND_DEPS, parseSkipList } from '../../entities/mail';
import { getNotificationEnv } from '../config';
import { PatientHttpClient } from './patient.http.client';
import { PrismaService } from './prisma.service';
import { SmtpMailSender } from './smtp.client';

/** Service account для вызовов внутренних маршрутов patient-service (6.2). */
const SERVICE_TOKENS = Symbol('NotificationServiceTokenCache');

/**
 * Сборка адаптеров портов entities (fsd.md §4.4): Prisma (inbox), nodemailer
 * (SMTP) и HTTP-клиент patient-service. Составляется в app/app.module.ts.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class SharedApiModule {
  static forRoot(): DynamicModule {
    return {
      module: SharedApiModule,
      providers: [
        {
          provide: SERVICE_TOKENS,
          useFactory: () => {
            const env = getNotificationEnv();
            return new ClientCredentialsTokenCache({
              keycloakInternalUrl: env.KEYCLOAK_INTERNAL_URL,
              realm: env.KEYCLOAK_REALM,
              clientId: env.KEYCLOAK_SVC_BACKEND_CLIENT_ID,
              clientSecret: env.KEYCLOAK_SVC_BACKEND_SECRET,
            });
          },
        },
        { provide: MAIL_SENDER, useFactory: () => new SmtpMailSender(getNotificationEnv()) },
        {
          provide: PATIENT_EMAIL_SOURCE,
          useFactory: (tokens: ClientCredentialsTokenCache) =>
            new PatientHttpClient(getNotificationEnv(), tokens),
          inject: [SERVICE_TOKENS],
        },
        // Готовые зависимости отправки: адаптеры + разобранный skip-whitelist (6.2).
        {
          provide: SEND_DEPS,
          useFactory: (mail: SmtpMailSender, patients: PatientHttpClient) => ({
            mail,
            patients,
            skip: parseSkipList(getNotificationEnv().NOTIFY_SKIP_RECIPIENTS),
          }),
          inject: [MAIL_SENDER, PATIENT_EMAIL_SOURCE],
        },
      ],
      exports: [PrismaService, MAIL_SENDER, PATIENT_EMAIL_SOURCE, SEND_DEPS],
    };
  }
}

export { PrismaService } from './prisma.service';
export { SmtpMailSender } from './smtp.client';
export { PatientHttpClient } from './patient.http.client';

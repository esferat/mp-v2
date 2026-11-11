// Собирает docs/presentation.html из template.html, встраивая скриншоты в base64.
// Запуск: node docs/presentation/build.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const imgDir = join(here, 'img');

/** Плейсхолдер → файл кадра. */
const MAP = {
  __IMG_01_landing__: '01-landing.jpeg',
  __IMG_02_profile__: '02-profile-patient.jpeg',
  __IMG_03_step1__: '03-booking-step1.jpeg',
  __IMG_04_step2__: '04-booking-step2.jpeg',
  __IMG_05_modal__: '05-doctor-info-modal.jpeg',
  __IMG_06_step3__: '06-booking-step3.jpeg',
  __IMG_07_step4__: '07-booking-step4.jpeg',
  __IMG_08_documents__: '08-my-documents.jpeg',
  __IMG_09_history__: '09-patient-history.jpeg',
  __IMG_10_doctor__: '10-doctor-my-appts.jpeg',
  __IMG_11_patients__: '11-doctor-patients.jpeg',
  __IMG_12_card__: '12-doctor-patient-card.jpeg',
  __IMG_13_admin_doctors__: '13-admin-doctors.jpeg',
  __IMG_14_schedule__: '14-admin-schedule.jpeg',
  __IMG_15_reschedule__: '15-reschedule-dialog.jpeg',
  __IMG_16_mailpit__: '16-mailpit.jpeg',
  __IMG_17_prometheus__: '17-prometheus.jpeg',
};

const template = readFileSync(join(here, 'template.html'), 'utf8');
let html = template;
const missing = [];

for (const [placeholder, file] of Object.entries(MAP)) {
  try {
    const bytes = readFileSync(join(imgDir, file));
    html = html.replaceAll(placeholder, `data:image/jpeg;base64,${bytes.toString('base64')}`);
  } catch {
    missing.push(file);
  }
}

if (missing.length) {
  console.error(`Нет кадров: ${missing.join(', ')}`);
  process.exit(1);
}

const leftover = html.match(/__IMG_[A-Z0-9_]+__/g);
if (leftover) {
  console.error(`Не подставлены: ${[...new Set(leftover)].join(', ')}`);
  process.exit(1);
}

const out = join(here, '..', 'presentation.html');
writeFileSync(out, html, 'utf8');
const files = readdirSync(imgDir).length;
console.log(`OK: ${out} (${(html.length / 1024).toFixed(0)} KB, кадров: ${files})`);

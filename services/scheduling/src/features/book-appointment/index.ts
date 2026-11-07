import { Module } from '@nestjs/common';
import { BookAppointmentController } from './api/book-appointment.controller';

/** Публичный API слайса (fsd.md S5): бронирование слота (5.3). */
@Module({
  controllers: [BookAppointmentController],
})
export class BookAppointmentModule {}

export { bookAppointment } from './app/book-appointment';
export type { BookAppointmentDeps, BookAppointmentCommand } from './app/book-appointment';

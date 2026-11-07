import { Module } from '@nestjs/common';
import { GetDoctorPatientsController } from './api/get-doctor-patients.controller';

/** Публичный API слайса (fsd.md S5): пациенты врача (9.3). */
@Module({
  controllers: [GetDoctorPatientsController],
})
export class GetDoctorPatientsModule {}

export { getDoctorPatients } from './app/get-doctor-patients';
export type { GetDoctorPatientsDeps } from './app/get-doctor-patients';

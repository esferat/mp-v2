import { describe, expect, it } from 'vitest';
import { CATALOG_TAGS, catalogTagForPath } from '../src/shared/api/catalog-cache';

/**
 * Серверный кэш справочников (2.6): мутация через BFF должна инвалидировать
 * свой тег, а посторонние пути — не трогать кэш вообще.
 */
describe('catalogTagForPath (2.6: инвалидация кэша по мутации)', () => {
  it('врачи → тег врачей (создание/правка/удаление/фото)', () => {
    expect(catalogTagForPath('/catalog/doctors')).toBe(CATALOG_TAGS.doctors);
    expect(catalogTagForPath('/catalog/doctors/d-1')).toBe(CATALOG_TAGS.doctors);
    expect(catalogTagForPath('/catalog/doctors/d-1/photo')).toBe(CATALOG_TAGS.doctors);
  });

  it('специализации → свой тег (в т.ч. с query)', () => {
    expect(catalogTagForPath('/catalog/specializations')).toBe(CATALOG_TAGS.specializations);
    expect(catalogTagForPath('/catalog/specializations/sp-9?force=1')).toBe(
      CATALOG_TAGS.specializations,
    );
  });

  it('чужие пути и «похожие» префиксы не инвалидируют кэш', () => {
    expect(catalogTagForPath('/scheduling/appointments')).toBeNull();
    expect(catalogTagForPath('/patients/p-1')).toBeNull();
    expect(catalogTagForPath('/catalog/doctorsx')).toBeNull();
    expect(catalogTagForPath('')).toBeNull();
  });
});

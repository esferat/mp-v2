import Menu, { type MenuProps } from '@mui/material/Menu';
import MenuItem, { type MenuItemProps } from '@mui/material/MenuItem';
import { forwardRef } from 'react';

export type MpMenuProps = MenuProps;

/**
 * Выпадающее меню (visual-макеты: «⋯»-меню в строках таблиц, меню записей) —
 * тонкая обёртка над MUI Menu с токенами темы.
 *
 * @example
 * <MpMenu anchorEl={anchorEl} open={open} onClose={handleClose}>
 *   <MpMenuItem onClick={handleEdit}>Перенести</MpMenuItem>
 *   <MpMenuItem onClick={handleCancel}>Отменить</MpMenuItem>
 * </MpMenu>
 */
export const MpMenu = forwardRef<HTMLDivElement, MpMenuProps>(function MpMenu(props, ref) {
  return <Menu ref={ref} {...props} />;
});

export type MpMenuItemProps = MenuItemProps;

/** Пункт выпадающего меню (иконка/подпись, disabled, divider). */
export const MpMenuItem = forwardRef<HTMLLIElement, MpMenuItemProps>(
  function MpMenuItem(props, ref) {
    return <MenuItem ref={ref} {...props} />;
  },
);

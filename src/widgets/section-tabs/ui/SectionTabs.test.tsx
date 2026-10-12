import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SectionTabs } from './SectionTabs';

const can = vi.hoisted(() => vi.fn<(permission: string) => boolean>());

vi.mock('@/entities/session', () => ({
  PERM_QUALITY: 'quality',
  useSession: () => ({ status: 'ready', can }),
}));

describe('SectionTabs', () => {
  it('ведёт во все три раздела и отмечает открытый', () => {
    can.mockImplementation((permission) => permission === 'quality');
    render(<SectionTabs active="quality" />);

    const nav = screen.getByRole('navigation', { name: 'Разделы' });
    expect(nav).toBeInTheDocument();
    // Дашборд — стартовая страница, «Диалоги» переехали на свой адрес.
    expect(screen.getByRole('link', { name: 'Дашборд' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Диалоги' })).toHaveAttribute('href', '/dialogs');
    const quality = screen.getByRole('link', { name: 'Оценка качества' });
    expect(quality).toHaveAttribute('href', '/quality');
    expect(quality).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Диалоги' })).not.toHaveAttribute('aria-current');
  });

  it('без права на оценку её вкладки нет, дашборд и диалоги остаются', () => {
    can.mockReturnValue(false);
    render(<SectionTabs active="dashboard" />);

    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Дашборд',
      'Диалоги',
    ]);
    expect(screen.getByRole('link', { name: 'Дашборд' })).toHaveAttribute('aria-current', 'page');
  });
});

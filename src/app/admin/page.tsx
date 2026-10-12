'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * У раздела нет своей «главной».
 *
 * Сводка поверх семи экранов была бы восьмым представлением тех же чисел,
 * расходящимся с ними по времени обновления. Первым открывается пайплайн:
 * именно за ним приходят, когда что-то идёт не так.
 */
export default function AdminIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/pipeline');
  }, [router]);
  return <p style={{ padding: 24 }}>Открывается пайплайн…</p>;
}

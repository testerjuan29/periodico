import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/currentUser';
import { UsersManager } from './UsersManager';

export const dynamic = 'force-dynamic';

export default async function UsuariosPage() {
  // El middleware ya redirige a los editores; este guard cubre el edge de
  // sesiones que expiran entre el middleware y el render.
  const me = await getSessionUser();
  if (me?.role !== 'admin') redirect('/');

  return <UsersManager currentUid={me.uid} />;
}

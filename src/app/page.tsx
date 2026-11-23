import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/modules/auth/jwt';

export default async function HomePage() {
  const cookieStore = await cookies();
  const hasSession =
    Boolean(cookieStore.get(ACCESS_TOKEN_COOKIE)?.value) ||
    Boolean(cookieStore.get(REFRESH_TOKEN_COOKIE)?.value);

  if (hasSession) {
    redirect('/dashboard');
  }

  redirect('/login');
}

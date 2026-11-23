import type { ReactNode } from 'react';
import { PortalAuthProvider } from '@/components/portal/PortalAuthContext';
import { PortalShell } from '@/layouts/PortalShell';

export default function PortalGroupLayout({ children }: { children: ReactNode }) {
  return (
    <PortalAuthProvider>
      <PortalShell>{children}</PortalShell>
    </PortalAuthProvider>
  );
}

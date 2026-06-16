import AdminPlatformLayout from '../core/layout/AdminPlatformLayout';
import { sigbaLayoutConfig } from '../modules/sigba/layout/sigbaLayoutConfig';

export default function Layout({
  pagina,
  setPagina,
  usuarioInterno,
  children,
  onLogout,
  onOpenPortal,
  onOpenPublico,
}) {
  return (
    <AdminPlatformLayout
      currentPage={pagina}
      onSelectPage={setPagina}
      user={usuarioInterno}
      onLogout={onLogout}
      onOpenPortal={onOpenPortal}
      onOpenPublico={onOpenPublico}
      shellConfig={sigbaLayoutConfig}
    >
      {children}
    </AdminPlatformLayout>
  );
}

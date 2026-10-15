import { adminNavigation } from '@/features/admin/navigation'
import { AppShell } from './app-shell'

export function AdminLayout() {
  return <AppShell groups={adminNavigation} homePath="/admin" modulesBase="/admin/modulos" />
}

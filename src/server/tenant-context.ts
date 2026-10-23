export type TenantContext = { userId: string; userName: string; organizationId: string; role: string };

export function isTenantContext(value: TenantContext | Response): value is TenantContext {
  return !(value instanceof Response);
}

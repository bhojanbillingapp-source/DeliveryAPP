// In-memory cache of the currently selected outlet — mirrors the staff app's
// src/utils/outletStore.ts. api/client.ts's request interceptor reads this
// synchronously on every request to attach X-Selected-Outlet-Id.

let _cache: any = null;

export const setSelectedOutletGlobal = (outlet: any): void => {
  _cache = outlet ?? null;
};

export const getSelectedOutlet = (): any => {
  return _cache;
};

export const getSelectedOutletId = (): string | null => {
  return _cache?.outlet_id ?? null;
};

export const clearSelectedOutlet = (): void => {
  _cache = null;
};

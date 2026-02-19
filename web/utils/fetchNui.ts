/**
 * Detect if the UI is running in a regular browser (dev mode)
 * rather than inside FiveM's NUI (CEF) environment.
 */
export const isEnvBrowser = (): boolean => !(window as any).GetParentResourceName;

/**
 * Mock responses returned when running in dev/browser mode.
 * Extend this map to simulate NUI callbacks during development.
 */
const mockResponses: Record<string, (data: any) => any> = {
  getPlayerCoords: () => ({ coords: { x: 200.0, y: 300.0, z: 30.0, w: 90.0 } }),
  saveProject:     () => ({ status: 'ok' }),
  deleteProject:   () => ({ status: 'ok' }),
  hideFrame:       () => ({ status: 'ok' }),
  selectChoice:    () => ({ status: 'ok' }),
  cancelInteraction: () => ({ status: 'ok' }),
};

export const fetchNui = async (eventName: string, data: any = {}) => {
  // In browser dev mode, return mock data immediately
  if (isEnvBrowser()) {
    const mockFn = mockResponses[eventName];
    const result = mockFn ? mockFn(data) : { status: 'ok' };
    if (import.meta.env.DEV) {
      console.log(`[fetchNui:mock] ${eventName}`, data, '->', result);
    }
    return result;
  }

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(data),
  };

  const resourceName = (window as any).GetParentResourceName();

  try {
    const resp = await fetch(`https://${resourceName}/${eventName}`, options);
    return await resp.json();
  } catch (e) {
    return { status: 'ok' };
  }
};

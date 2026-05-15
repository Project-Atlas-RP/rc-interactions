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
  /**
   * Returns simulated runtime values for all game variables.
   * Used by the RuntimeDialogue / GameSimulator to resolve CONDITION nodes
   * when running in browser dev mode.
   */
  getGameVariables: () => ({
    // Items (count in inventory)
    'item:bread': 3,
    'item:water': 5,
    'item:lockpick': 1,
    'item:phone': 1,
    'item:id_card': 1,
    'item:weapon_pistol': 0,
    // Money
    'money:cash': 4500,
    'money:bank': 52000,
    // Jobs / Groups (boolean-ish: "1" or "0")
    'job:police': '0',
    'job:ambulance': '0',
    'job:mechanic': '1',
    'job:taxi': '0',
    // Player – GTA native values
    'player:health': 175,
    'player:armor': 50,
    'player:stamina': 80,
    'player:is_dead': '0',
    'player:is_wanted': 0,
    'player:in_vehicle': '0',
    'player:speed': 0.0,
    'player:weapon': 'WEAPON_UNARMED',
    'player:is_swimming': '0',
    'player:is_falling': '0',
    'player:is_running': '0',
    // Player – framework data
    'player:name': 'John Doe',
    'player:job_name': 'mechanic',
    'player:job_grade': 2,
    'player:gang_name': 'none',
    'player:citizenid': 'ABC12345',
    'player:gender': 0,
    'player:phone_number': '555-0199',
  }),
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

let cachedVapidPublicKey: string | null = null;

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export async function getVapidPublicKey(): Promise<string> {
  const buildTimeKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (buildTimeKey) {
    return buildTimeKey;
  }

  if (cachedVapidPublicKey) {
    return cachedVapidPublicKey;
  }

  const response = await fetch('/api/push/public-key', {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('VAPID public key is not set');
  }

  const data = (await response.json()) as { publicKey?: string };
  if (!data.publicKey) {
    throw new Error('VAPID public key is not set');
  }

  cachedVapidPublicKey = data.publicKey;
  return data.publicKey;
}

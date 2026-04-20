// Kill-switch: unregister any previously installed service worker and reload clients.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', async () => {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  await self.registration.unregister();
  clients.forEach(client => client.navigate(client.url));
});

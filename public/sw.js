// Service worker do Lembrei!: recebe os avisos push (mesmo com o app
// fechado) e abre o item certo quando a pessoa toca no aviso.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let aviso = {};
  try {
    aviso = event.data ? event.data.json() : {};
  } catch {
    aviso = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(aviso.title || "Lembrei!", {
      body: aviso.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: aviso.tag,
      data: { link: aviso.link || "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.link || "/dashboard", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const abertas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of abertas) {
        if (new URL(c.url).origin === self.location.origin) {
          await c.focus();
          if ("navigate" in c) await c.navigate(destino);
          return;
        }
      }
      await self.clients.openWindow(destino);
    })()
  );
});

self.addEventListener("push", function (event) {
  if (!event.data) return;
  let data = { title: "What's Up", body: "Something just dropped", url: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/icon",
      badge: "/icon",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        client.postMessage({ type: "NAVIGATE", url: target });
        if ("focus" in client) {
          client.navigate?.(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

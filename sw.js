/* Prompt 工坊 Service Worker：PWA 离线缓存（PRM-03: 命名空间化缓存 + 导航回退收紧） */
var CACHE = 'prompt-studio-v2';
/* 本应用命名空间前缀：activate 只清理该前缀下的旧版本缓存，
   不会误删同源部署的其他应用（它们的缓存名不带此前缀）。 */
var NS = 'prompt-studio-';
var ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        /* PRM-03: 只删除本应用命名空间内的旧版本，保留其它应用的缓存 */
        return Promise.all(keys.filter(function (k) {
          return k.indexOf(NS) === 0 && k !== CACHE;
        }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;

  /* PRM-03: 只有页面导航请求才允许离线回退到 index.html——
     脚本/图片等资源离线失败时返回真实失败，不用 HTML 冒充成功资源。 */
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(function (res) {
        /* 网络优先导航：拿到新页面后更新缓存，已安装客户端因此有可验证的更新路径 */
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      })
    );
    return;
  }

  /* 同源静态资源：缓存优先，离线失败如实失败 */
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return res;
      });
    })
  );
});

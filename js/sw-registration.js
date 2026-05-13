/* ===========================================================
 * sw-registration.js
 * ===========================================================
 * Copyright 2016 @cloudingyu
 * Licensed under Apache 2.0
 * Service worker registration has been disabled.
 * This script now helps unregister existing service workers.
 * ========================================================== */

// 检查是否存在已注册的 Service Worker 并卸载它
if (navigator.serviceWorker) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for (let registration of registrations) {
      // 卸载所有已注册的 Service Worker
      registration.unregister();
      console.log('Service Worker 已卸载');
    }
  });
  
  // 如果页面上有刷新提示，显示一条消息
  if (typeof createSnackbar === 'function') {
    createSnackbar({
      message: "缓存功能已禁用，正在使用最新内容。",
      duration: 3000
    });
  }
  
  console.log('Service Worker 功能已禁用');
}

/**
 * code-copy.js - 为博客代码块添加复制按钮
 * 
 * 创建于: 2025-04-10
 * 作者: CloudingYu
 */

document.addEventListener('DOMContentLoaded', function() {
  // 为所有代码块添加复制按钮
  var codeBlocks = document.querySelectorAll('pre');
  
  codeBlocks.forEach(function(codeBlock) {
    // 创建复制按钮
    var copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.textContent = '复制';
    
    // 添加复制功能
    copyButton.addEventListener('click', function() {
      var code = codeBlock.querySelector('code') ? 
        codeBlock.querySelector('code').innerText : codeBlock.innerText;
      
      navigator.clipboard.writeText(code).then(function() {
        // 如果存在snackbar功能，使用它显示提示信息
        if (typeof showSnackbar === 'function') {
          showSnackbar('代码已复制到剪贴板');
        } else {
          // 不存在snackbar时的反馈
          copyButton.textContent = '已复制!';
          setTimeout(function() {
            copyButton.textContent = '复制';
          }, 2000);
        }
      }).catch(function(err) {
        console.error('无法复制文本: ', err);
        copyButton.textContent = '复制失败';
        setTimeout(function() {
          copyButton.textContent = '复制';
        }, 2000);
      });
    });
    
    // 将按钮添加到代码块
    codeBlock.appendChild(copyButton);
  });
});
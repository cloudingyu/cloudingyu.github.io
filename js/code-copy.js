/**
 * code-copy.js - 为博客代码块添加复制按钮
 * 
 * 创建于: 2025-04-10
 * 作者: CloudingYu
 * 修改于: 2025-04-10 - 修复重复按钮和代码复制内容问题
 */

document.addEventListener('DOMContentLoaded', function() {
  // 删除所有可能已存在的复制按钮（修复重复按钮问题）
  var existingButtons = document.querySelectorAll('.copy-button');
  existingButtons.forEach(function(button) {
    button.parentNode.removeChild(button);
  });
  
  // 为所有代码块添加复制按钮
  var codeBlocks = document.querySelectorAll('pre');
  
  codeBlocks.forEach(function(codeBlock) {
    // 确保每个代码块只有一个复制按钮
    if (codeBlock.querySelector('.copy-button')) {
      return;
    }
    
    // 创建复制按钮
    var copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.textContent = '复制';
    
    // 添加复制功能
    copyButton.addEventListener('click', function() {
      // 获取代码内容
      var codeElement = codeBlock.querySelector('code');
      var code = '';
      
      if (codeElement) {
        // 克隆代码元素以便操作
        var clonedCode = codeElement.cloneNode(true);
        
        // 移除可能的行号元素
        var lineNumbers = clonedCode.querySelectorAll('.line-numbers, .gutter, .line-number');
        lineNumbers.forEach(function(el) {
          el.parentNode.removeChild(el);
        });
        
        // 获取纯文本内容
        code = clonedCode.textContent || clonedCode.innerText;
      } else {
        // 没有code元素时直接从pre获取
        code = codeBlock.textContent || codeBlock.innerText;
      }
      
      // 去除可能的前缀空白和行号
      code = code.replace(/^[\s\t]*\d+[\:|\.]\s+/gm, ''); // 移除形如 "1: " 或 "1. " 的行号
      
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
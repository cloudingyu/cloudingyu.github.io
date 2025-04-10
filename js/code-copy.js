/**
 * code-copy.js - 为博客代码块添加复制按钮
 * 
 * 创建于: 2025-04-10
 * 作者: CloudingYu
 * 修改于: 2025-04-10 - 彻底解决重复按钮和行号问题
 */

// 全局变量，确保只在页面加载一次
var hasInitialized = false;

function addCopyButtons() {
  // 如果已经初始化过，则先移除所有已存在的按钮
  if (hasInitialized) {
    var existingButtons = document.querySelectorAll('.copy-button');
    existingButtons.forEach(function(button) {
      button.remove();
    });
  }
  
  // 获取所有代码块
  var codeBlocks = document.querySelectorAll('pre');
  
  codeBlocks.forEach(function(pre) {
    // 创建复制按钮
    var copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.innerHTML = '复制';
    
    // 添加点击事件
    copyButton.addEventListener('click', function() {
      var code = '';
      
      // 判断代码块结构
      var codeElement = pre.querySelector('code');
      
      if (codeElement) {
        // 如果存在code标签，先克隆它以便于处理
        var tempElement = codeElement.cloneNode(true);
        
        // 移除所有可能存在的行号元素
        ['span.line-numbers', '.gutter', '.line-number', '.hljs-ln-numbers'].forEach(function(selector) {
          var elements = tempElement.querySelectorAll(selector);
          elements.forEach(function(el) {
            el.remove();
          });
        });
        
        // 从处理过的元素中获取文本
        code = tempElement.textContent || tempElement.innerText;
      } else {
        // 直接从pre标签获取文本
        code = pre.textContent || pre.innerText;
      }
      
      // 进一步处理代码文本，移除行号
      code = code
        // 移除行首的数字+冒号/点+空格 (如 "1: " 或 "1. ")
        .replace(/^[ \t]*\d+[\:\.][ \t]+/gm, '')
        // 移除可能存在的其他行号格式
        .replace(/^[ \t]*\d+[ \t]*/gm, '');
      
      // 复制到剪贴板
      try {
        // 现代浏览器API
        navigator.clipboard.writeText(code)
          .then(function() {
            showCopySuccess(copyButton);
          })
          .catch(function() {
            // 回退方法
            fallbackCopy(code, copyButton);
          });
      } catch (err) {
        // 老浏览器回退方法
        fallbackCopy(code, copyButton);
      }
    });
    
    // 将按钮添加到代码块
    pre.appendChild(copyButton);
  });
  
  hasInitialized = true;
}

// 回退复制方法
function fallbackCopy(text, button) {
  var textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    var successful = document.execCommand('copy');
    if (successful) {
      showCopySuccess(button);
    } else {
      button.innerHTML = '复制失败';
      setTimeout(function() {
        button.innerHTML = '复制';
      }, 2000);
    }
  } catch (err) {
    button.innerHTML = '复制失败';
    setTimeout(function() {
      button.innerHTML = '复制';
    }, 2000);
  }
  
  document.body.removeChild(textArea);
}

// 显示复制成功
function showCopySuccess(button) {
  // 如果有snackbar功能，使用它
  if (typeof showSnackbar === 'function') {
    showSnackbar('代码已复制到剪贴板');
  } else {
    // 否则修改按钮文字
    button.innerHTML = '已复制!';
    setTimeout(function() {
      button.innerHTML = '复制';
    }, 2000);
  }
}

// 当DOM加载完成时初始化
document.addEventListener('DOMContentLoaded', function() {
  // 延迟执行，确保其他操作完成
  setTimeout(function() {
    addCopyButtons();
  }, 500);
});

// 对于可能的动态加载内容，添加重新初始化按钮的方法
window.reinitCodeCopyButtons = function() {
  addCopyButtons();
};
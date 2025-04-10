/**
 * code-copy.js - 为博客代码块添加复制按钮
 * 
 * 创建于: 2025-04-10
 * 作者: CloudingYu
 * 修改于: 2025-04-10 - 修复代码块类型识别和风格问题
 */

function addCopyButtons() {
  // 删除所有已存在的复制按钮
  document.querySelectorAll('.copy-button').forEach(button => button.remove());
  
  // 获取所有代码块
  document.querySelectorAll('pre').forEach(function(pre) {
    // 跳过已经有复制按钮的代码块
    if (pre.querySelector('.copy-button')) return;
    
    // 检查代码块类型
    const codeElement = pre.querySelector('code');
    const language = codeElement ? codeElement.className.match(/language-(\w+)/) : null;
    const isPlantUML = language && language[1] === 'plantuml';
    
    // 创建复制按钮
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.innerHTML = '复制';
    if (isPlantUML) {
      copyButton.classList.add('copy-button-plantuml');
    }
    
    // 添加点击事件
    copyButton.addEventListener('click', function() {
      let code = '';
      
      if (codeElement) {
        // 克隆元素以避免修改原始内容
        const tempElement = codeElement.cloneNode(true);
        
        // 移除所有可能的行号元素
        const lineNumberSelectors = [
          '.line-numbers',
          '.line-number',
          '.hljs-ln-numbers',
          '.gutter'
        ];
        
        lineNumberSelectors.forEach(selector => {
          tempElement.querySelectorAll(selector).forEach(el => el.remove());
        });
        
        // 获取代码文本
        code = tempElement.textContent || tempElement.innerText;
      } else {
        code = pre.textContent || pre.innerText;
      }
      
      // 处理代码文本
      code = code
        // 移除可能的前缀空格和制表符
        .replace(/^[\r\n]+/, '')
        .replace(/[\r\n]+$/, '')
        // 保持缩进但移除行号
        .split('\n')
        .map(line => line.replace(/^\s*\d+[:|.]\s*/, ''))
        .join('\n');
      
      // 复制到剪贴板
      copyToClipboard(code, copyButton);
    });
    
    // 将按钮添加到代码块
    pre.appendChild(copyButton);
  });
}

// 复制到剪贴板的函数
function copyToClipboard(text, button) {
  // 使用现代API
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      showSuccess(button);
    }).catch(() => {
      // 如果失败，使用回退方法
      fallbackCopyToClipboard(text, button);
    });
  } else {
    // 在不安全上下文中使用回退方法
    fallbackCopyToClipboard(text, button);
  }
}

// 回退的复制方法
function fallbackCopyToClipboard(text, button) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  textArea.style.top = '-9999px';
  document.body.appendChild(textArea);
  
  try {
    textArea.select();
    const successful = document.execCommand('copy');
    if (successful) {
      showSuccess(button);
    } else {
      showError(button);
    }
  } catch (err) {
    console.error('复制失败:', err);
    showError(button);
  } finally {
    document.body.removeChild(textArea);
  }
}

// 显示成功提示
function showSuccess(button) {
  const originalText = button.innerHTML;
  button.innerHTML = '已复制!';
  button.classList.add('copy-success');
  
  setTimeout(() => {
    button.innerHTML = originalText;
    button.classList.remove('copy-success');
  }, 2000);
}

// 显示错误提示
function showError(button) {
  const originalText = button.innerHTML;
  button.innerHTML = '复制失败';
  button.classList.add('copy-error');
  
  setTimeout(() => {
    button.innerHTML = originalText;
    button.classList.remove('copy-error');
  }, 2000);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
  // 延迟执行以确保其他脚本完成
  setTimeout(addCopyButtons, 500);
});
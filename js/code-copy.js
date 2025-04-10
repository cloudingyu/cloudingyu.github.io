/**
 * 代码块复制功能
 * 为代码块添加复制按钮（仅支持被```包裹的代码块）
 */
(function() {
    // 等待DOM完全加载
    document.addEventListener('DOMContentLoaded', function() {
        // 添加复制按钮样式到head
        var style = document.createElement('style');
        style.innerHTML = `
            .code-header {
                display: flex;
                justify-content: flex-end;
                padding: 5px 10px;
                background: rgba(240, 240, 240, 0.7);
                border-top-left-radius: 10px;
                border-top-right-radius: 10px;
                border-bottom: 1px solid rgba(220, 220, 220, 0.7);
            }
            .copy-btn {
                display: inline-block;
                cursor: pointer;
                color: #666;
                font-size: 14px;
                background-color: transparent;
                border: none;
                padding: 2px 8px;
                border-radius: 4px;
                transition: all 0.2s ease;
            }
            .copy-btn:hover {
                color: #0085a1;
                background-color: rgba(0, 133, 161, 0.1);
            }
            .copy-btn:active {
                background-color: rgba(0, 133, 161, 0.2);
            }
            .copy-btn::before {
                content: "📋 复制";
            }
            .copy-btn.copied::before {
                content: "✓ 已复制";
            }
            /* 调整代码块显示 */
            .highlighter-rouge .highlight {
                margin-top: 0;
                border-top-left-radius: 0;
                border-top-right-radius: 0;
            }
        `;
        document.head.appendChild(style);
        
        // 只为特定的代码块添加复制按钮（被```包裹的代码块）
        // 在Jekyll中，被```包裹的代码块会被转换为.highlighter-rouge元素
        // 但并非所有.highlighter-rouge元素都是```包裹的代码块，因此需要额外检查
        
        // 查找所有的highlighter-rouge元素
        var codeBlocks = document.querySelectorAll('.highlighter-rouge');
        
        codeBlocks.forEach(function(block) {
            // 检查是否是真正的代码框（被```包裹）
            // 方法1: 通常这类代码块内会有一个<pre>元素
            var preElement = block.querySelector('pre');
            
            // 方法2: 检查父元素路径是否符合Markdown渲染后的代码块结构
            var isRealCodeBlock = false;
            
            // 检查这个代码块是否在正文内容中，而非行内代码
            if (block.parentNode && 
                (block.parentNode.classList.contains('post-container') || 
                 block.parentNode.tagName === 'P' || 
                 block.parentNode.tagName === 'DIV')) {
                isRealCodeBlock = true;
            }
            
            // 单行的行内代码通常没有pre元素或只包含很短的内容
            if (!preElement || !isRealCodeBlock) {
                return; // 跳过这个元素
            }
            
            // 筛选掉行内代码 `xxx`，它们通常没有换行或内容很短
            var codeText = preElement.textContent;
            if (!codeText.includes('\n') && codeText.length < 30) {
                return; // 可能是行内代码，跳过
            }
            
            // 创建复制按钮容器
            var header = document.createElement('div');
            header.className = 'code-header';
            
            // 创建复制按钮
            var button = document.createElement('button');
            button.className = 'copy-btn';
            button.title = '复制代码';
            
            // 添加复制功能
            button.addEventListener('click', function() {
                // 获取代码内容
                var code = preElement.textContent;
                
                // 使用Clipboard API复制
                navigator.clipboard.writeText(code).then(function() {
                    // 复制成功，显示反馈
                    button.classList.add('copied');
                    
                    // 2秒后恢复按钮状态
                    setTimeout(function() {
                        button.classList.remove('copied');
                    }, 2000);
                }).catch(function(err) {
                    console.error('无法复制文本: ', err);
                    // 回退方法：创建临时textarea
                    fallbackCopy(code, button);
                });
            });
            
            // 将按钮添加到容器中
            header.appendChild(button);
            
            // 将容器插入到代码块之前
            block.parentNode.insertBefore(header, block);
        });
        
        // 回退复制方法（用于不支持Clipboard API的浏览器）
        function fallbackCopy(text, button) {
            var textArea = document.createElement("textarea");
            textArea.value = text;
            
            // 设置textarea样式，使其不可见
            textArea.style.position = "fixed";
            textArea.style.top = 0;
            textArea.style.left = 0;
            textArea.style.width = "2em";
            textArea.style.height = "2em";
            textArea.style.padding = 0;
            textArea.style.border = "none";
            textArea.style.outline = "none";
            textArea.style.boxShadow = "none";
            textArea.style.background = "transparent";
            
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                var successful = document.execCommand('copy');
                if (successful) {
                    button.classList.add('copied');
                    setTimeout(function() {
                        button.classList.remove('copied');
                    }, 2000);
                }
            } catch (err) {
                console.error('回退复制方法失败:', err);
            }
            
            document.body.removeChild(textArea);
        }
    });
})();
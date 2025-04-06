---
layout:     post
title:      "在VSCode中使用Vim"
subtitle:   "你的下一个Vim又何必是Vim"
date:       2025-01-26
author:     "CloudingYu"
header-img: "img/posts/2025-01-26-vim-VScode/bg.png"
mathjax: true
tags:
    - VScode
    - Vim
    - IDE
    - 插件
---
##  $\mathrm{Vim}$ 与 $\mathrm{VSCode}$ 介绍

$\mathrm{Vim}$ 是一个高度可定制的文本编辑器，具有强大的键盘快捷键和插件系统。它的模式化编辑使得用户可以快速地进行文本操作，而不需要依赖鼠标。

$\mathrm{VSCode}$ 是一个现代化的代码编辑器，具有丰富的扩展和调试功能。它支持多种编程语言，并且可以通过插件进行功能扩展。

通过在 $\mathrm{VSCode}$ 中安装 $\mathrm{Vim}$ 插件，用户可以在享受 $\mathrm{VSCode}$ 现代化界面的同时，使用 $\mathrm{Vim}$ 的强大编辑功能。这种组合可以大大提高开发效率和编辑体验。

## 如何在 $\mathrm{VSCode}$ 中使用 $\mathrm{Vim}$

### 插件安装

在 $\mathrm{VSCode}$ 扩展商店 中搜索插件 `Vim`，选择第一项进行安装：

![vim](/img/posts/2025-01-26-vim-VScode/vim.png)

### $\mathrm{config}$ 配置
安装完插件后，打开`setting.json`文件，在`{}`中添加以下内容：
```
{
    "vim.easymotion": true,
    "vim.incsearch": true,
    "vim.useSystemClipboard": true,
    "vim.useCtrlKeys": true,
    "vim.hlsearch": true,
    "vim.insertModeKeyBindings": [
    {
        "before": ["j", "j"],
        "after": ["<Esc>"]
    }
    ],
    "vim.normalModeKeyBindingsNonRecursive": [
    {
        "before": ["<leader>", "d"],
        "after": ["d", "d"]
    },
    {
        "before": ["<C-n>"],
        "commands": [":nohl"]
    },
    {
        "before": ["K"],
        "commands": ["lineBreakInsert"],
        "silent": true
    }
    ],
    "vim.leader": "<space>",
    "vim.handleKeys": {
    "<C-a>": false,
    "<C-f>": false
    },

    "// To improve performance",
    "extensions.experimental.affinity": {
    "vscodevim.vim": 1
    }
}
```
以上为 $\mathrm{Vim}$ 插件的初始设置.

如果你之前已经掌握了 $\mathrm{Vim}$ 的基本操作方法，那么恭喜你，你基本可以流畅的在 $\mathrm{VSCode}$ 中使用 $\mathrm{Vim}$ 了.

以下为关于 $\mathrm{Vim}$ 基础操作的介绍.



## $\mathrm{Vim}$ 的四种模式

### $\mathrm{Normal}$ 模式

用来执行移动、删除、复制等操作，可通过`<Esc>`回到此模式。

### $\mathrm{Insert}$ 模式

按`i`进入编辑状态，像普通文本编辑器一样插入文本。

### $\mathrm{Visual}$ 模式

按`v`进入，可高亮选择文本进行批量操作，如复制剪切。

### $\mathrm{Command}$ 模式

输入`:`后跳转命令行，可执行保存、退出、替换等操作。

## $\mathrm{Vim}$ 基础指令

以下 [***cheatpaper***](/img/posts/2025-01-26-vim-VScode/vim-cheatsheet.pdf) 可供新手使用时参考：

![vim-cheatpaper](/img/posts/2025-01-26-vim-VScode/vim-cheatsheet.png)

1. `h` / `j` / `k` / `l`
   
   基本光标移动，`h`向左，`j`向下，`k`向上，`l`向右，比起方向键更高效
2. `i` / `I`
   
   进入插入模式，`i`在当前位置插入，`I`在行首插入
3. `a` / `A`
   
   进入插入模式，`a`在当前位置后插入，`A`在行尾插入
4. `v` / `V`
   
   进入可视化模式，`v`字符选择，`V`行选择，`Ctrl+v`块选择
5. `:w` / `:q` / `:wq` / `:q!`
   
   保存、退出、保存并退出、强制退出不保存

6.  `u`
   
    撤销上一步操作，可多次使用回退多步
   
7.  `Ctrl+r`
   
    重做被撤销的操作，与`u`命令相反
   
8.  `yy` / `dd`
   
    `yy`复制整行，`dd`删除整行并保存到剪贴板
9.  `p` / `P`
    
    粘贴剪贴板内容，`p`在当前行后粘贴，`P`在当前行前粘贴
10. `gg` / `G`
    
    快速移动到文件首行/尾行，`5G`跳转到第5行
11. `/xxx`
    
    向下搜索"xxx"文本，可使用正则表达式
12. `n` / `N`
    
    `n`查找下一个搜索结果，`N`查找上一个结果
13. `x`
14. 
    删除当前光标下的字符，相当于普通编辑器的Delete键
15. `dw`
    
    删除从光标到单词结尾的内容，`d3w`删除三个单词
16. `y$`
    
    复制从当前位置到行尾的所有内容
17. `y0`
    
    复制从行首到当前位置的所有内容
18. `y}` / `y{`
    
    复制从当前位置到下一段落/上一段落的所有内容
19. `Ctrl+f` / `Ctrl+b`
    
    向前/向后翻页，相当于PageDown/PageUp
20. `:%s/旧/新/g`
    
    全局替换文本，`%s/旧/新/gc`会在每次替换前询问确认
21. `ciw` / `diw`
    
    `ciw`更改整个单词，`diw`删除整个单词，不管光标位置
22. `.`
    
    重复上一次操作，非常实用的提高效率命令
23. `o` / `O`
    
    `o`在当前行下方新建一行，`O`在当前行上方新建一行
24. `:help 命令`
    
    查看任意命令的帮助文档，如`:help dd`

## 相关插件推荐

### $\mathrm{SmearCursor}$

该插件能够让你在光标移动时获得如 $neovide$ 一样的特效.

在 $\mathrm{VSCode}$ 扩展商店 中搜索插件 `SmearCursor`，选择第一项进行安装：

![smearcursor](/img/posts/2025-01-26-vim-VScode/smearcursor.png)

安装完成后，`ctrl + shift + P`或者`command + shift + P`，运行命令`smearcursor.enable`.

### $\mathrm{Relative}$ $\mathrm{line}$ $\mathrm{numbers}$

该插件能够显示每行相对于当前光标所在行的差数，方便`j`、`k`快速跳转.

在 $\mathrm{VSCode}$ 扩展商店 中搜索插件 `Relative Line Numbers`，选择第一项进行安装：

![Rln](/img/posts/2025-01-26-vim-VScode/Relative_line_numbers.png)


安装完成后，`ctrl + shift + P`或者`command + shift + P`，运行命令`extension.relativeLineNumbersEnable`.

修正: 现在可以直接在设置中勾选 `Vim: Smart Relative Line` 选项, 实现相同的目的
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
##  $Vim$ 与 $VSCode$ 介绍

$Vim$ 是一个高度可定制的文本编辑器，具有强大的键盘快捷键和插件系统。它的模式化编辑使得用户可以快速地进行文本操作，而不需要依赖鼠标。

$VSCode$ 是一个现代化的代码编辑器，具有丰富的扩展和调试功能。它支持多种编程语言，并且可以通过插件进行功能扩展。

通过在 $VSCode$ 中安装 $Vim$ 插件，用户可以在享受 $VSCode$ 现代化界面的同时，使用 $Vim$ 的强大编辑功能。这种组合可以大大提高开发效率和编辑体验。

## 如何在 $VSCode$ 中使用 $Vim$

### 插件安装

在 $VSCode$ 扩展商店 中搜索插件 `Vim`，选择第一项进行安装：

![vim](/img/posts/2025-01-26-vim-VScode/vim.png)

### $config$ 配置
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
以上为 $Vim$ 插件的初始设置.

如果你之前已经掌握了 $Vim$ 的基本操作方法，那么恭喜你，你基本可以流畅的在 $VSCode$ 中使用 $Vim$ 了.

以下为关于 $Vim$ 基础操作的介绍.



## $Vim$ 的四种模式

### Normal 模式

用来执行移动、删除、复制等操作，可通过`<Esc>`回到此模式。

### Insert 模式

按i进入编辑状态，像普通文本编辑器一样插入文本。

### Visual 模式

按v进入，可高亮选择文本进行批量操作，如复制剪切。

### Command 模式

输入:后跳转命令行，可执行保存、退出、替换等操作。

## $Vim$ 基础指令

以下 [***cheatpaper***](/img/posts/2025-01-26-vim-VScode/vim-cheatsheet.pdf) 可供新手使用时参考：

![vim-cheatpaper](/img/posts/2025-01-26-vim-VScode/vim-cheatsheet.png)





1. h / j / k / l：移动光标
2. i / I：插入模式
3. v / V：进入可视化模式
4. :w / :q / :wq：保存、退出、保存并退出
5. :noh：清除高亮
6. u：撤销
7. Ctrl+r：重做
8. yy / dd：复制与删除当前行
9. p：粘贴
10. gg / G：移动到文件首行/尾行
11. /xxx：搜索xxx
12. n / N：下一个/上一个搜索结果
13. x：删除当前字符
14. dw：删除当前单词
15. y$：复制至行尾
16. y0：复制至行首
17. y}:{复制至下一段落或大括号
18. Ctrl+f / Ctrl+b：向前/向后翻页
19. :%s/旧/新/g：全局替换
20. :help 命令：查看帮助


## 相关插件推荐

### SmearCursor

该插件能够让你在光标移动时获得如 $neovide$ 一样的特效.

在 $VSCode$ 扩展商店 中搜索插件 `SmearCursor`，选择第一项进行安装：

![smearcursor](/img/posts/2025-01-26-vim-VScode/smearcursor.png)

安装完成后，`ctrl + shift + P`或者`command + shift +P`，运行命令`smearcursor.enable`.

### Relative line numbers

该插件能够显示每行相对于当前光标所在行的差数，方便`j`、`k`快速跳转.

在 $VSCode$ 扩展商店 中搜索插件 `Relative Line Numbers`，选择第一项进行安装：

![Rln](/img/posts/2025-01-26-vim-VScode/Relative_line_numbers.png)


安装完成即可直接使用.
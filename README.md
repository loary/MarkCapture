# MarkCapture

> 一键将网页内容转换为 Markdown 格式，支持预览、下载保存和语音朗读

![MarkCapture](icons/icon128.png)

## ✨ 功能特性

- 🚀 **一键转换** - 快速将当前网页转换为清晰的 Markdown 格式
- 📄 **实时预览** - 在弹窗中即时查看转换结果
- 💾 **下载保存** - 一键下载为 `.md` 文件
- 📋 **复制分享** - 快速复制转换结果到剪贴板
- 🔊 **语音朗读** - 支持文本转语音，解放双眼
- ⚙️ **朗读设置** - 自定义音色、语速、音高
- ⌨️ **快捷键支持** - `Alt+Shift+M` (Windows) / `Cmd+Shift+M` (Mac)

## 🖥️ 支持浏览器

- ✅ Microsoft Edge (Chromium)
- ✅ Google Chrome
- ✅ Brave
- ✅ 其他 Chromium 内核浏览器

## 📦 安装方式

### 开发模式安装

1. 下载或克隆本仓库
2. 打开浏览器扩展管理页面
   - Edge: `edge://extensions/`
   - Chrome: `chrome://extensions/`
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择本项目根目录

## 🚀 使用说明

1. 打开任意网页
2. 点击浏览器工具栏中的 MarkCapture 图标
3. 点击「转换页面」按钮
4. 预览转换结果，可选择保留图片和链接
5. 使用下载、复制或朗读功能

### 快捷键

| 操作 | Windows/Linux | Mac |
|------|--------------|-----|
| 转换页面 | `Alt+Shift+M` | `Cmd+Shift+M` |

## 🔧 项目结构

```
MarkCapture/
├── background/          # 后台脚本
│   └── background.js    # 处理快捷键和消息
├── content/             # 内容脚本
│   └── content.js       # 页面内容提取与转换
├── popup/               # 弹窗界面
│   ├── popup.html       # HTML 结构
│   ├── popup.css        # 样式
│   └── popup.js         # 交互逻辑
├── lib/                 # 第三方库
│   └── html2md.js       # HTML 转 Markdown 核心库
├── icons/               # 图标资源
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── manifest.json        # 扩展配置
```

## 🌟 核心功能实现

### HTML 转 Markdown

插件使用 `html2md.js` 库将网页内容转换为 Markdown 格式，支持：
- 标题（H1-H6）
- 段落
- 列表（有序/无序）
- 链接和图片
- 代码块
- 表格
- 引用块

### 语音朗读

利用浏览器原生 Web Speech API 实现文本朗读功能：
- 支持多语言音色选择
- 可调节语速（0.3x - 3x）
- 可调节音高（0.5x - 2x）

## 📝 更新日志

### v1.0.0
- 初始版本
- 支持网页转 Markdown
- 支持预览、下载、复制功能
- 支持语音朗读功能
- 添加快捷键支持

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 📧 联系方式

如有问题或建议，欢迎在 GitHub Issues 中反馈。

---

**作者**: Loary  
**项目地址**: https://github.com/helloworld-Co/html2md
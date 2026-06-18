// content.js - 内容脚本，负责从页面提取 HTML 并转换为 Markdown

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'ping':
            sendResponse({ pong: true });
            return false;

        case 'convert':
            handleConvert(message.options || {})
                .then(result => sendResponse(result))
                .catch(err => sendResponse({ error: err.message }));
            return true;

        default:
            return false;
    }
});

async function handleConvert(options) {
    console.log('[html2md] 开始转换页面...', options);

    // 等待页面完全加载
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
    }

    try {
        const converter = new Html2Md(options);

        // 获取页面元信息
        const title = document.title || '';
        const url = window.location.href;
        const now = new Date().toISOString().split('T')[0];

        // 执行转换
        const markdown = converter.convertFromDocument(document);

        if (!markdown || !markdown.trim()) {
            return { error: '页面内容为空，无法转换' };
        }

        // 构建带元数据的最终 Markdown
        const header = `# ${title || '无标题页面'}\n\n` +
                       `> 来源: [${url}](${url})  \n` +
                       `> 导出时间: ${now}  \n\n` +
                       `---\n\n`;

        const finalMd = header + markdown;

        console.log('[html2md] 转换完成，长度:', finalMd.length);

        return {
            markdown: finalMd,
            title: title,
            url: url
        };
    } catch (err) {
        console.error('[html2md] 转换错误:', err);
        return { error: `转换失败: ${err.message}` };
    }
}

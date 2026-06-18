// background.js - Service Worker
// 作者：Loary

chrome.runtime.onInstalled.addListener(function() {
    console.log('[MarkCapture] 插件已安装');
});

// 处理下载请求
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === 'downloadMd') {
        var blob = new Blob(['\uFEFF' + message.content], { type: 'text/markdown;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        chrome.downloads.download({ url: url, filename: message.filename || 'export.md', saveAs: true });
        sendResponse({ success: true });
        return true;
    }
});

// 处理快捷键命令
chrome.commands.onCommand.addListener(async function(command) {
    console.log('[MarkCapture] 快捷键触发:', command);
    
    if (command === 'convert-to-markdown') {
        try {
            // 获取当前活动标签页
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];
            
            if (!tab || !tab.url || !tab.url.startsWith('http')) {
                console.log('[MarkCapture] 无效页面，无法转换');
                return;
            }
            
            // 检查 content script 是否已注入
            try {
                await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
            } catch (e) {
                // content script 未注入，先注入
                await chrome.scripting.executeScript({ 
                    target: { tabId: tab.id }, 
                    files: ['lib/html2md.js', 'content/content.js'] 
                });
                await new Promise(r => setTimeout(r, 300));
            }
            
            // 发送转换请求
            const result = await sendMessageWithTimeout(tab.id, { 
                action: 'convert', 
                options: { keepImages: true, keepLinks: true } 
            }, 10000);
            
            if (result && result.markdown) {
                // 将转换结果保存到 storage，供 popup 使用
                await chrome.storage.local.set({
                    lastConversion: {
                        markdown: result.markdown,
                        title: result.title || tab.title,
                        url: result.url || tab.url,
                        timestamp: Date.now()
                    }
                });
                
                console.log('[MarkCapture] 转换完成，结果已保存');
            } else if (result && result.error) {
                console.error('[MarkCapture] 转换失败:', result.error);
            }
            
            // 打开 popup 显示结果
            chrome.action.openPopup();
            
        } catch (err) {
            console.error('[MarkCapture] 快捷键处理失败:', err);
        }
    }
});

/**
 * 带超时的消息发送函数
 * @param {number} tabId - 标签页ID
 * @param {object} message - 消息内容
 * @param {number} timeoutMs - 超时时间（毫秒）
 * @returns {Promise} 消息响应
 */
function sendMessageWithTimeout(tabId, message, timeoutMs) {
    return new Promise(function(resolve, reject) {
        var timer = setTimeout(function() { 
            reject(new Error('timeout')); 
        }, timeoutMs);
        try {
            chrome.tabs.sendMessage(tabId, message, function(response) {
                clearTimeout(timer);
                if (chrome.runtime.lastError) { 
                    reject(new Error(chrome.runtime.lastError.message)); 
                    return; 
                }
                resolve(response);
            });
        } catch (e) { 
            clearTimeout(timer); 
            reject(e); 
        }
    });
}
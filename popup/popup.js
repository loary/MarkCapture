// popup.js
let currentTitle = '';
let currentUrl = '';
let isConverting = false;

// DOM 元素
const convertBtn = document.getElementById('convertBtn');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const clearBtn = document.getElementById('clearBtn');
const editorArea = document.getElementById('editorArea');
const statusEl = document.getElementById('status');
const actions = document.getElementById('actions');
const pageInfo = document.getElementById('pageInfo');
const lengthInfo = document.getElementById('lengthInfo');
const keepImages = document.getElementById('keepImages');
const keepLinks = document.getElementById('keepLinks');

// 语音元素
const speechBtn = document.getElementById('speechBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const speechConfigStatus = document.getElementById('speechConfigStatus');
const voiceSelect = document.getElementById('voiceSelect');
const speedRange = document.getElementById('speedRange');
const pitchRange = document.getElementById('pitchRange');
const speedValue = document.getElementById('speedValue');
const pitchValue = document.getElementById('pitchValue');

// 语音面板折叠
const speechPanelToggle = document.getElementById('speechPanelToggle');
const speechPanelBody = document.getElementById('speechPanelBody');
const speechToggleIcon = document.getElementById('speechToggleIcon');

// 语音引擎状态
let speechSynth = null;
let speechUtterance = null;
let isSpeaking = false;
let isPaused = false;
let speechText = '';

// ================= 语音面板折叠 =================
speechPanelToggle.addEventListener('click', function() {
    var collapsed = speechPanelBody.classList.toggle('collapsed');
    speechToggleIcon.textContent = collapsed ? '▼' : '▲';
});

// ================= 工具函数 =================
async function getCurrentTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
}

function setStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (type ? ' ' + type : '');
}

function getMarkdown() {
    return editorArea.value;
}

function showMarkdown(md, title, url) {
    currentTitle = title || '';
    currentUrl = url || '';
    editorArea.value = md || '';
    actions.style.display = 'flex';
    pageInfo.textContent = '\uD83D\uDCC4 ' + (title || '\u672A\u77E5\u9875\u9762');
    var charCount = md.length;
    var lineCount = md.split('\n').length;
    lengthInfo.textContent = charCount + ' \u5B57\u7B26 \u00B7 ' + lineCount + ' \u884C';
    setStatus('\u5DF2\u8F6C\u6362', 'active');
}

// ================= 转换 =================
async function convertPage() {
    if (isConverting) return;
    isConverting = true;
    try {
        setStatus('⏳ 正在转换...', 'active');
        convertBtn.disabled = true;
        convertBtn.textContent = '⏳ 转换中...';
        editorArea.placeholder = '正在请求页面内容，请稍候...';

        var tab = await getCurrentTab();
        if (!tab) { setStatus('无法获取当前标签页', 'error'); return; }
        if (!tab.url || !tab.url.startsWith('http')) { setStatus('仅支持 http/https 页面', 'error'); return; }

        var options = { keepImages: keepImages.checked, keepLinks: keepLinks.checked };

        try {
            setStatus('⏳ 请求页面内容...', 'active');
            var result = await sendMessageWithTimeout(tab.id, { action: 'convert', options: options }, 4000);
            if (result && result.markdown) { showMarkdown(result.markdown, result.title || tab.title, result.url || tab.url); return; }
            if (result && result.error) { setStatus(result.error, 'error'); return; }
        } catch (e) {}

        try {
            setStatus('⏳ 注入脚本...', 'active');
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['lib/html2md.js', 'content/content.js'] });
            await new Promise(function(r) { setTimeout(r, 300); });
            setStatus('⏳ 转换中...', 'active');
            var result2 = await sendMessageWithTimeout(tab.id, { action: 'convert', options: options }, 8000);
            if (result2 && result2.markdown) { showMarkdown(result2.markdown, result2.title || tab.title, result2.url || tab.url); }
            else if (result2 && result2.error) { setStatus(result2.error, 'error'); }
            else { setStatus('转换失败：页面未返回有效内容', 'error'); }
        } catch (err) {
            if (err.message && err.message.indexOf('timeout') !== -1) {
                setStatus('⏱️ 转换超时：页面内容过多或响应慢，请刷新后重试', 'error');
            } else {
                setStatus('脚本注入失败：' + err.message, 'error');
            }
        }
    } catch (err) { setStatus('转换出错：' + err.message, 'error'); }
    finally {
        isConverting = false;
        convertBtn.disabled = false;
        convertBtn.textContent = '🔄 转换页面';
        if (!editorArea.value) editorArea.placeholder = '点击「转换页面」开始转换';
    }
}

function sendMessageWithTimeout(tabId, message, timeoutMs) {
    return new Promise(function(resolve, reject) {
        var timer = setTimeout(function() { reject(new Error('timeout')); }, timeoutMs);
        try {
            chrome.tabs.sendMessage(tabId, message, function(response) {
                clearTimeout(timer);
                if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
                resolve(response);
            });
        } catch (e) { clearTimeout(timer); reject(e); }
    });
}

// ================= 下载 & 复制 =================
async function downloadMarkdown() {
    var md = getMarkdown();
    if (!md) return;
    try {
        downloadBtn.disabled = true;
        var safeName = (currentTitle || 'untitled').replace(/[<>:"\/\\|?*]/g, '_').substring(0, 100).trim() || 'untitled';
        var blob = new Blob(['\uFEFF' + md], { type: 'text/markdown;charset=utf-8' });
        await chrome.downloads.download({ url: URL.createObjectURL(blob), filename: safeName + '.md', saveAs: true });
        setStatus('已下载', 'active');
    } catch (err) { setStatus('下载失败：' + err.message, 'error'); }
    finally { downloadBtn.disabled = false; }
}

async function copyMarkdown() {
    var md = getMarkdown();
    if (!md) return;
    try {
        copyBtn.disabled = true;
        await navigator.clipboard.writeText(md);
        setStatus('已复制到剪贴板', 'active');
        setTimeout(function() { copyBtn.disabled = false; }, 1500);
    } catch (err) {
        try {
            var ta = document.createElement('textarea');
            ta.value = md; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select(); document.execCommand('copy');
            document.body.removeChild(ta); setStatus('已复制到剪贴板', 'active');
        } catch (e2) { setStatus('复制失败', 'error'); }
    } finally { copyBtn.disabled = false; }
}

function clearContent() {
    stopSpeech();
    currentTitle = ''; currentUrl = '';
    editorArea.value = '';
    actions.style.display = 'none';
    pageInfo.textContent = '';
    lengthInfo.textContent = '';
    setStatus('已清空');
}

// ================= 语音：加载音色列表 =================
function loadVoices() {
    if (!speechSynth) return [];
    var voices = speechSynth.getVoices();
    if (!voices || voices.length === 0) return [];

    var selectedVal = voiceSelect.value;
    var grouped = { zh: [], en: [], other: [] };
    voices.forEach(function(v) {
        var lang = (v.lang || '').toLowerCase();
        if (lang.startsWith('zh')) grouped.zh.push(v);
        else if (lang.startsWith('en')) grouped.en.push(v);
        else grouped.other.push(v);
    });

    voiceSelect.innerHTML = '';
    function addVoicesToGroup(list, groupLabel) {
        if (list.length === 0) return;
        var optgroup = document.createElement('optgroup');
        optgroup.label = groupLabel;
        list.forEach(function(v) {
            var opt = document.createElement('option');
            opt.value = v.voiceURI;
            opt.textContent = v.name + ' (' + (v.lang || '') + ')';
            optgroup.appendChild(opt);
        });
        voiceSelect.appendChild(optgroup);
    }

    if (!selectedVal || selectedVal === '') {
        var defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '-- 选择音色（推荐中文）--';
        voiceSelect.appendChild(defaultOpt);
    }
    addVoicesToGroup(grouped.zh, '中文');
    addVoicesToGroup(grouped.en, 'English');
    addVoicesToGroup(grouped.other, '其他');

    if (selectedVal && [...voiceSelect.options].some(function(o) { return o.value === selectedVal; })) {
        voiceSelect.value = selectedVal;
    } else if (grouped.zh.length > 0) {
        voiceSelect.value = grouped.zh[0].voiceURI;
    }

    speechConfigStatus.textContent = grouped.zh.length === 0
        ? '⚠️ 未检测到中文语音'
        : '已加载 ' + voices.length + ' 个语音引擎';
    return voices;
}

// ================= 语音：提取纯文本 =================
function getSpeechText(md) {
    return md
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1')
        .replace(/\[([^\]]*)\]\([^\)]+\)/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2')
        .replace(/^-{3,}\s*$/gm, '')
        .replace(/^>\s+/gm, '')
        .replace(/^[\-\*]\s+/gm, '')
        .replace(/^\d+\.\s+/gm, '')
        .replace(/^\|[\s\-]+\|$/gm, '')
        .replace(/\|/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// ================= 语音：朗读核心 =================
function doSpeak(text, voices) {
    speechUtterance = new SpeechSynthesisUtterance(text);
    speechUtterance.rate = parseFloat(speedRange.value);
    speechUtterance.pitch = parseFloat(pitchRange.value);
    speechUtterance.volume = 1;

    var selectedURI = voiceSelect.value;
    if (selectedURI) {
        var matched = voices.find(function(v) { return v.voiceURI === selectedURI; });
        if (matched) speechUtterance.voice = matched;
    }
    if (!speechUtterance.voice) {
        var zhVoice = voices.find(function(v) { return v.lang && v.lang.startsWith('zh'); });
        if (zhVoice) speechUtterance.voice = zhVoice;
    }

    speechUtterance.onstart = function() {
        isSpeaking = true; isPaused = false;
        updateSpeechUI(true);
        setStatus('🔊 正在朗读...', 'active');
        speechConfigStatus.textContent = '🔊 正在朗读...';
        speechConfigStatus.className = 'speech-config-status speaking';
    };

    speechUtterance.onpause = function() {
        isPaused = true; updateSpeechUI(true);
        setStatus('⏸️ 已暂停', 'active');
        speechConfigStatus.textContent = '⏸️ 已暂停';
        speechConfigStatus.className = 'speech-config-status';
    };

    speechUtterance.onresume = function() {
        isPaused = false; updateSpeechUI(true);
        setStatus('🔊 继续朗读...', 'active');
        speechConfigStatus.textContent = '🔊 继续朗读...';
        speechConfigStatus.className = 'speech-config-status speaking';
    };

    speechUtterance.onend = function() {
        finishSpeech('朗读完成 ✅', 'active');
    };

    speechUtterance.onerror = function(event) {
        finishSpeech('', '');
        var err = event.error;
        if (err === 'interrupted' || err === 'canceled') {
            setStatus('已停止朗读', '');
            speechConfigStatus.textContent = '已停止朗读';
        } else if (err === 'synthesis-failed') {
            setStatus('朗读失败：所选音色暂不可用，请切换其他音色', 'error');
            speechConfigStatus.textContent = '❌ 朗读失败，请切换其他音色后重试';
            speechConfigStatus.className = 'speech-config-status error';
        } else if (err === 'audio-busy') {
            setStatus('音频设备繁忙，请稍后重试', 'error');
            speechConfigStatus.textContent = '⏳ 音频设备繁忙';
            speechConfigStatus.className = 'speech-config-status error';
        } else {
            setStatus('朗读出错：' + err, 'error');
            speechConfigStatus.textContent = '❌ 朗读失败(' + err + ')';
            speechConfigStatus.className = 'speech-config-status error';
        }
    };
    speechSynth.speak(speechUtterance);
}

function finishSpeech(statusText, statusType) {
    isSpeaking = false; isPaused = false;
    updateSpeechUI(false);
    if (statusText) {
        setStatus(statusText, statusType);
        speechConfigStatus.textContent = statusText;
    }
    speechConfigStatus.className = 'speech-config-status';
}

function startSpeech() {
    var md = getMarkdown();
    if (!md) { setStatus('没有可朗读的内容', 'error'); speechConfigStatus.textContent = '⚠️ 请先转换页面内容'; return; }
    if (!speechSynth) {
        if (!('speechSynthesis' in window)) { setStatus('浏览器不支持语音朗读', 'error'); return; }
        speechSynth = window.speechSynthesis;
    }
    if (isPaused && speechSynth) { speechSynth.resume(); isPaused = false; updateSpeechUI(true); return; }
    resetSpeech();

    speechText = getSpeechText(md);
    if (!speechText) { setStatus('没有可朗读的文本内容', 'error'); speechConfigStatus.textContent = '⚠️ 内容中无可朗读的纯文本'; return; }

    var voices = speechSynth.getVoices();
    if (voices.length === 0) {
        speechConfigStatus.textContent = '⏳ 正在加载语音引擎...';
        speechSynth.onvoiceschanged = function() {
            speechSynth.onvoiceschanged = null;
            loadVoices();
            doSpeak(speechText, speechSynth.getVoices());
        };
        setTimeout(function() {
            if (!speechSynth.speaking) { loadVoices(); doSpeak(speechText, speechSynth.getVoices()); }
        }, 1000);
        return;
    }
    doSpeak(speechText, voices);
}

function pauseSpeech() {
    if (!speechSynth || !isSpeaking) return;
    if (isPaused) speechSynth.resume(); else speechSynth.pause();
}

function stopSpeech() { resetSpeech(); }

function resetSpeech() {
    if (speechSynth && speechSynth.speaking) {
        if (speechUtterance) { speechUtterance.onerror = null; speechUtterance.onend = null; }
        speechSynth.cancel();
    }
    isSpeaking = false; isPaused = false;
    updateSpeechUI(false);
    speechConfigStatus.className = 'speech-config-status';
}

function updateSpeechUI(active) {
    speechBtn.style.display = active ? 'none' : 'inline-flex';
    pauseBtn.style.display = active ? 'inline-flex' : 'none';
    stopBtn.style.display = active ? 'inline-flex' : 'none';
    if (isPaused) { pauseBtn.textContent = '▶️ 继续'; pauseBtn.className = 'btn btn-speech'; }
    else { pauseBtn.textContent = '⏸️ 暂停'; pauseBtn.className = 'btn btn-warning'; }
}

// ================= 语音控制事件 =================
speedRange.addEventListener('input', function() {
    speedValue.textContent = parseFloat(this.value).toFixed(1) + 'x';
});
pitchRange.addEventListener('input', function() {
    pitchValue.textContent = parseFloat(this.value).toFixed(1) + 'x';
});
voiceSelect.addEventListener('change', function() {
    chrome.storage.local.set({ preferredVoice: this.value });
    speechConfigStatus.textContent = '已选择: ' + voiceSelect.options[voiceSelect.selectedIndex].text;
});

// ================= 键盘快捷键 =================
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (getMarkdown()) startSpeech(); else convertPage();
    }
    if (e.key === 'Escape') {
        if (isSpeaking) stopSpeech(); else clearContent();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (getMarkdown()) downloadMarkdown(); }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        if (isSpeaking && !isPaused) pauseSpeech();
        else if (isPaused) pauseSpeech();
        else if (getMarkdown()) startSpeech();
    }
});

// ================= 事件绑定 =================
convertBtn.addEventListener('click', convertPage);
downloadBtn.addEventListener('click', downloadMarkdown);
copyBtn.addEventListener('click', copyMarkdown);
clearBtn.addEventListener('click', clearContent);
speechBtn.addEventListener('click', startSpeech);
pauseBtn.addEventListener('click', pauseSpeech);
stopBtn.addEventListener('click', stopSpeech);

// ================= 初始化 =================
document.addEventListener('DOMContentLoaded', function() {
    if ('speechSynthesis' in window) {
        speechSynth = window.speechSynthesis;
        var initialVoices = speechSynth.getVoices();
        if (initialVoices.length > 0) loadVoices();
        speechSynth.onvoiceschanged = function() { var v = speechSynth.getVoices(); if (v.length > 0) loadVoices(); };
        chrome.storage.local.get('preferredVoice', function(data) {
            if (data.preferredVoice && voiceSelect.options.length > 0) {
                if ([...voiceSelect.options].some(function(o) { return o.value === data.preferredVoice; }))
                    voiceSelect.value = data.preferredVoice;
            }
        });
    } else {
        speechConfigStatus.textContent = '⚠️ 浏览器不支持语音朗读功能';
        speechBtn.title = '浏览器不支持语音 API';
        speechBtn.style.opacity = '0.4';
    }
    checkContentScript();
    
    // 检查是否有快捷键触发的转换结果
    loadShortcutConversion();
});

/**
 * 加载快捷键触发的转换结果
 */
async function loadShortcutConversion() {
    try {
        const data = await chrome.storage.local.get('lastConversion');
        if (data.lastConversion) {
            const { markdown, title, url, timestamp } = data.lastConversion;
            // 只显示最近10秒内的转换结果
            if (timestamp && Date.now() - timestamp < 10000) {
                showMarkdown(markdown, title, url);
            }
            // 清除已显示的转换结果
            await chrome.storage.local.remove('lastConversion');
        }
    } catch (err) {
        console.error('[MarkCapture] 加载快捷键转换结果失败:', err);
    }
}

async function checkContentScript() {
    try {
        var tab = await getCurrentTab();
        if (!tab) { setStatus('', ''); return; }
        if (!tab.url || !tab.url.startsWith('http')) { setStatus('仅支持 http/https', ''); return; }
        var resp = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
        setStatus('就绪', (resp && resp.pong) ? 'active' : '');
    } catch (_) { setStatus('就绪', ''); }
}
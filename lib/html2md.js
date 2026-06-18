/**
 * html2md - HTML 转 Markdown 转换引擎
 * 完整实现，基于 Turndown 核心算法思路优化
 * 支持 GFM（表格、删除线、代码块）
 */

class Html2Md {
    constructor(options = {}) {
        this.options = {
            keepImages: true,
            keepLinks: true,
            headingStyle: 'atx',       // 'atx' | 'setext'
            hr: '---',
            bulletListMarker: '-',
            codeBlockStyle: 'fenced',  // 'fenced' | 'indented'
            fence: '```',
            emDelimiter: '*',          // '*' | '_'
            strongDelimiter: '**',     // '**' | '__'
            linkStyle: 'inlined',      // 'inlined' | 'referenced'
            linkReferenceStyle: 'full', // 'full' | 'collapsed' | 'shortcut'
            preformattedCode: true,
            tableConverter: true,
            maxDepth: 100,
            ...options
        };
        this.depth = 0;
        this.rules = this.initRules();
    }

    initRules() {
        return [
            // 忽略的元素
            { filter: ['script', 'style', 'noscript', 'link', 'meta', 'iframe',
                       'svg', 'canvas', 'video', 'audio', 'br', 'hr', 'input',
                       'textarea', 'select', 'option', 'object', 'embed'],
              replacement: () => '' },

            // 水平线
            { filter: 'hr', replacement: () => `\n${this.options.hr}\n` },

            // 标题
            { filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
              replacement: (content, node) => {
                  if (this.options.headingStyle === 'setext' && /^h[12]$/i.test(node.tagName)) {
                      const underline = node.tagName === 'H1' ? '=' : '-';
                      return `\n${content}\n${underline.repeat(Math.max(content.length, 3))}\n\n`;
                  }
                  const level = parseInt(node.tagName[1]);
                  return `\n${'#'.repeat(level)} ${content}\n\n`;
              }
            },

            // 段落
            { filter: 'p',
              replacement: (content) => `\n\n${content}\n\n` },

            // 引用
            { filter: 'blockquote',
              replacement: (content) => {
                  const lines = content.split('\n').map(l => l.trim()).filter(l => l);
                  if (!lines.length) return '\n\n';
                  return '\n' + lines.map(l => `> ${l}`).join('\n') + '\n\n';
              }
            },

            // 代码块 (pre > code)
            { filter: 'pre',
              replacement: (content, node) => {
                  const codeEl = node.querySelector('code');
                  let lang = '';
                  if (codeEl && this.options.preformattedCode) {
                      const cls = codeEl.className || '';
                      const match = cls.match(/(?:lang|language)[-:]\s*(\S+)/i);
                      if (match) lang = match[1];
                  }
                  // 去掉额外的反引号包裹
                  let code = codeEl ? codeEl.textContent : node.textContent;
                  code = code.replace(/^`+|`+$/g, '').replace(/\s+$/, '');
                  return `\n${this.options.fence}${lang}\n${code}\n${this.options.fence}\n`;
              }
            },

            // 行内代码
            { filter: 'code',
              replacement: (content) => {
                  // 如果 content 本身包含反引号，用双反引号
                  const delim = content.includes('`') ? '``' : '`';
                  return `${delim}${content}${delim}`;
              }
            },

            // 加粗
            { filter: ['strong', 'b'],
              replacement: (content) => {
                  if (!content.trim()) return '';
                  return `${this.options.strongDelimiter}${content}${this.options.strongDelimiter}`;
              }
            },

            // 斜体
            { filter: ['em', 'i'],
              replacement: (content) => {
                  if (!content.trim()) return '';
                  return `${this.options.emDelimiter}${content}${this.options.emDelimiter}`;
              }
            },

            // 删除线 (GFM)
            { filter: ['del', 's', 'strike'],
              replacement: (content) => `~~${content}~~` },

            // 链接
            { filter: 'a',
              replacement: (content, node) => {
                  if (!this.options.keepLinks) return content;
                  const href = node.getAttribute('href') || '';
                  if (!href || href.startsWith('#') || href.startsWith('javascript:')) return content;
                  const title = node.getAttribute('title') || '';
                  const absHref = this.resolveUrl(href);
                  const titlePart = title ? ` "${title}"` : '';
                  return this.options.linkStyle === 'referenced'
                      ? `[${content}][${href}]`
                      : `[${content}](${absHref}${titlePart})`;
              }
            },

            // 图片
            { filter: 'img',
              replacement: (content, node) => {
                  if (!this.options.keepImages) return '';
                  const src = node.getAttribute('src') || '';
                  const alt = node.getAttribute('alt') || '';
                  const title = node.getAttribute('title') || '';
                  const absSrc = this.resolveUrl(src);
                  const titlePart = title ? ` "${title}"` : '';
                  return `![${alt}](${absSrc}${titlePart})`;
              }
            },

            // 列表
            { filter: ['ul', 'ol'],
              replacement: (content, node) => {
                  const isOrdered = node.tagName === 'OL';
                  return '\n' + this.processList(node, isOrdered) + '\n';
              }
            },

            // 表格 (GFM)
            { filter: 'table',
              replacement: (content, node) => {
                  if (!this.options.tableConverter) return `\n${content}\n`;
                  return '\n' + this.processTable(node) + '\n';
              }
            },

            // DIV 和布局元素 — 直接透传
            { filter: ['div', 'section', 'article', 'header', 'footer', 'nav',
                       'aside', 'span', 'label', 'main', 'figure', 'figcaption',
                       'details', 'summary', 'time', 'address', 'form'],
              replacement: (content) => content },

            // HTML 块级元素直接透传内容
            { filter: ['body', 'html'],
              replacement: (content) => content }
        ];
    }

    // 主转换入口
    convert(input) {
        this.depth = 0;
        let node;
        if (typeof input === 'string') {
            const parser = new DOMParser();
            const doc = parser.parseFromString(input, 'text/html');
            node = doc.body;
        } else if (input instanceof Document) {
            node = input.body;
        } else if (input instanceof Element) {
            node = input;
        } else if (input instanceof DocumentFragment) {
            node = input;
        } else {
            throw new Error('输入必须是 HTML 字符串或 DOM 节点');
        }
        return this.processNode(node).trim();
    }

    // 从 document 提取主要内容并转换
    convertFromDocument(doc) {
        this.depth = 0;
        const selectors = [
            'article', 'main', '[role="main"]', '.post-content',
            '.article-content', '.entry-content', '.content',
            '#content', '#article', '.markdown-body',
            '.post', '.blog-post', '.entry', '.article',
            '.page-content', '.post-body'
        ];
        let mainEl = null;
        for (const sel of selectors) {
            const el = doc.querySelector(sel);
            if (el && el.textContent.trim().length > 80) {
                mainEl = el;
                break;
            }
        }
        if (!mainEl) mainEl = doc.body;
        return this.processNode(mainEl).trim();
    }

    processNode(node) {
        if (this.depth > this.options.maxDepth) return '';
        this.depth++;

        let result = '';
        if (node.nodeType === Node.TEXT_NODE) {
            result = this.escapeText(node.textContent || '');
            this.depth--;
            return result;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) {
            this.depth--;
            return '';
        }

        const tag = node.tagName.toLowerCase();
        // 对 pre 和 code 特殊处理 — 直接取 textContent 避免子节点递归转义
        if (tag === 'pre' || tag === 'code') {
            // 先检查是否有匹配的规则
        }

        // 遍历所有规则看是否匹配
        for (const rule of this.rules) {
            if (this.matchesFilter(node, rule.filter)) {
                const childContent = this.getInlineContent(node);
                result = rule.replacement(childContent, node);
                this.depth--;
                return result;
            }
        }

        // 默认：递归处理子节点
        result = this.getInlineContent(node);
        this.depth--;
        return result;
    }

    matchesFilter(node, filter) {
        if (!filter) return false;
        const tag = node.tagName.toLowerCase();
        if (typeof filter === 'string') return filter === tag;
        if (Array.isArray(filter)) return filter.includes(tag);
        if (typeof filter === 'function') return filter(node);
        return false;
    }

    getInlineContent(node) {
        let result = '';
        const inlineTags = ['a', 'span', 'strong', 'b', 'em', 'i', 'code', 'u',
                          'sub', 'sup', 'small', 'abbr', 'cite', 'del', 'ins',
                          'kbd', 'samp', 'var', 'bdi', 'bdo', 'q', 'mark', 'dfn'];

        for (let i = 0; i < node.childNodes.length; i++) {
            const child = node.childNodes[i];
            const text = this.processNode(child);

            if (child.nodeType === Node.TEXT_NODE) {
                // 文本节点前后是否需要加空格
                const prev = this.prevNonEmptySibling(child);
                const next = this.nextNonEmptySibling(child);
                const prevBlock = prev && prev.nodeType === Node.ELEMENT_NODE &&
                    !inlineTags.includes(prev.tagName.toLowerCase());
                const nextBlock = next && next.nodeType === Node.ELEMENT_NODE &&
                    !inlineTags.includes(next.tagName.toLowerCase());
                let t = text;
                if (prevBlock && result && !result.endsWith(' ')) t = ' ' + t;
                if (nextBlock && !t.endsWith(' ')) t = t + ' ';
                result += t;
            } else {
                result += text;
            }
        }
        // 合并过多空行
        result = result.replace(/\n{4,}/g, '\n\n\n');
        return result;
    }

    prevNonEmptySibling(node) {
        let sib = node.previousSibling;
        while (sib && sib.nodeType === Node.TEXT_NODE && !sib.textContent.trim()) {
            sib = sib.previousSibling;
        }
        return sib;
    }

    nextNonEmptySibling(node) {
        let sib = node.nextSibling;
        while (sib && sib.nodeType === Node.TEXT_NODE && !sib.textContent.trim()) {
            sib = sib.nextSibling;
        }
        return sib;
    }

    processList(list, ordered) {
        let result = '';
        let index = 1;
        for (let i = 0; i < list.children.length; i++) {
            const li = list.children[i];
            if (li.tagName !== 'LI') continue;
            const prefix = ordered ? `${index}. ` : `${this.options.bulletListMarker} `;

            // 获取 li 的内容，排除嵌套列表
            let content = '';
            let nestedHtml = '';
            for (let j = 0; j < li.childNodes.length; j++) {
                const child = li.childNodes[j];
                if (child.nodeType === Node.ELEMENT_NODE &&
                    (child.tagName === 'UL' || child.tagName === 'OL')) {
                    nestedHtml = this.processList(child, child.tagName === 'OL');
                } else {
                    content += this.processNode(child);
                }
            }
            content = content.trim();

            // 缩进嵌套列表
            if (nestedHtml) {
                const indented = nestedHtml.split('\n').map(l => l ? `  ${l}` : l).join('\n');
                result += `${prefix}${content}\n${indented}\n`;
            } else {
                result += `${prefix}${content}\n`;
            }
            if (ordered) index++;
        }
        return result;
    }

    processTable(table) {
        const rows = table.querySelectorAll('tr');
        if (!rows.length) return '';

        const headerRow = table.querySelector('thead tr') || rows[0];
        const headers = [];
        headerRow.querySelectorAll('th, td').forEach(cell => {
            headers.push(this.processNode(cell).trim().replace(/\|/g, '\\|'));
        });

        let result = `| ${headers.join(' | ')} |\n`;
        result += `| ${headers.map(() => '---').join(' | ')} |\n`;

        const startIdx = table.querySelector('thead') ? 0 : 1;
        for (let i = startIdx; i < rows.length; i++) {
            const cells = rows[i].querySelectorAll('td, th');
            if (!cells.length) continue;
            const rowData = [];
            cells.forEach(cell => {
                rowData.push(this.processNode(cell).trim().replace(/\|/g, '\\|'));
            });
            // 补齐缺失的列
            while (rowData.length < headers.length) rowData.push('');
            result += `| ${rowData.join(' | ')} |\n`;
        }
        return result;
    }

    resolveUrl(url) {
        if (!url || url.startsWith('data:') || url.startsWith('http://') ||
            url.startsWith('https://') || url.startsWith('//')) return url;
        try {
            return new URL(url, window.location.href).href;
        } catch {
            return url;
        }
    }

    escapeText(text) {
        if (!text) return '';
        // 保留原始格式，仅压缩连续空白
        text = text.replace(/\s+/g, ' ');
        // 转义可能被解释为 Markdown 语法的字符
        // 但不是所有特殊字符都需要转义 — 只在必要时转义
        text = text
            .replace(/^#{1,6}\s/gm, match => '\\' + match)
            .replace(/^\[(.+?)\]:\s*/gm, '\\[$1]: ')
            .replace(/^[-*+]\s/gm, match => '\\' + match)
            .replace(/^(\d+)\.\s/gm, match => match.replace('.', '\\.'));
        return text;
    }
}

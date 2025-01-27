class KimiAPI {
    static async callKimiAPI(prompt, text) {
        const apiKey = await config.getApiKey();
        if (!apiKey) {
            throw new Error('请先配置Kimi API密钥');
        }

        try {
            const response = await fetch(config.KIMI_API_ENDPOINT + '/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    messages: [
                        { role: "system", content: "你是一个翻译助手，请直接输出翻译结果，不要输出原始提示语或其他无关信息。" },
                        { role: "user", content: prompt + text }
                    ],
                    model: "moonshot-v1-8k",
                    temperature: 0.3,
                    max_tokens: 2000
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                if (errorData && errorData.error) {
                    throw new Error(errorData.error.message || 'API调用失败');
                } else if (response.status === 429) {
                    throw new Error('API调用次数超限，请稍后再试');
                } else {
                    throw new Error(`API调用失败 (${response.status})`);
                }
            }

            const data = await response.json();
            if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error('API返回数据格式错误');
            }

            // 提取翻译结果，去除可能的前缀说明
            let translation = data.choices[0].message.content.trim();
            // 如果结果包含原文或说明，尝试提取实际翻译部分
            if (translation.includes('翻译：')) {
                translation = translation.split('翻译：')[1].trim();
            } else if (translation.includes('Translation:')) {
                translation = translation.split('Translation:')[1].trim();
            }
            
            return translation;
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('网络连接失败，请检查网络设置');
            }
            throw error;
        }
    }
}

class UIManager {
    constructor() {
        this.initializeElements();
        this.initializeEventListeners();
        this.loadSettings();
        
        // 添加消息监听器
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'translateText' && request.text) {
                // 确保元素已经初始化
                if (this.originalContent && this.originalContent.value !== request.text) {
                    this.originalContent.value = request.text;
                    // 如果已经设置了API密钥，自动开始翻译
                    chrome.storage.sync.get(['kimiApiKey'], (result) => {
                        if (result.kimiApiKey) {
                            this.handleTranslateButtonClick();
                        }
                    });
                }
            } else if (request.action === 'showRestrictionNotice') {
                if (this.originalContent) {
                    this.originalContent.value = '注意：在 Chrome 设置页面等特殊页面上，出于安全限制，无法自动获取选中的文本。\n\n请手动复制文本并粘贴到此处进行翻译。';
                }
            }
        });
    }

    async getInitialText() {
        // 请求后台脚本中存储的文本
        chrome.runtime.sendMessage({ action: 'getInitialText' }, (response) => {
            if (response && response.text) {
                this.originalContent.value = response.text;
                this.handleTranslateButtonClick(); // 自动开始翻译
            }
        });
    }

    initializeElements() {
        // 模式切换按钮
        this.translateBtn = document.getElementById('translateBtn');
        this.summarizeBtn = document.getElementById('summarizeBtn');
        
        // 面板
        this.translatePanel = document.getElementById('translatePanel');
        this.summarizePanel = document.getElementById('summarizePanel');
        
        // 翻译相关元素
        this.sourceLang = document.getElementById('sourceLang');
        this.targetLang = document.getElementById('targetLang');
        this.originalContent = document.getElementById('originalContent');
        this.translatedContent = document.getElementById('translatedContent');
        this.translateButton = document.getElementById('translateButton');
        this.copyTranslation = document.getElementById('copyTranslation');
        this.clearTranslation = document.getElementById('clearTranslation');
        
        // 总结相关元素
        this.pageContent = document.getElementById('pageContent');
        this.summaryContent = document.getElementById('summaryContent');
        this.summarizeButton = document.getElementById('summarizeButton');
        this.copySummary = document.getElementById('copySummary');
        this.loadingIndicator = document.getElementById('loadingIndicator');

        // 设置相关元素
        this.settingsBtn = document.getElementById('settingsBtn');
        this.settingsDialog = document.getElementById('settingsDialog');
        this.apiKeyInput = document.getElementById('apiKey');
        this.saveSettingsBtn = document.getElementById('saveSettings');
        this.closeSettingsBtn = document.getElementById('closeSettings');
    }

    initializeEventListeners() {
        // 模式切换
        this.translateBtn.addEventListener('click', () => this.switchMode('translate'));
        this.summarizeBtn.addEventListener('click', () => this.switchMode('summarize'));
        
        // 翻译功能
        this.translateButton.addEventListener('click', () => this.handleTranslateButtonClick());
        this.copyTranslation.addEventListener('click', () => this.copyToClipboard(this.translatedContent));
        this.clearTranslation.addEventListener('click', () => this.clearTranslationPanel());
        
        // 总结功能
        this.summarizeButton.addEventListener('click', () => this.handleSummarizeButtonClick());
        this.copySummary.addEventListener('click', () => this.copyToClipboard(this.summaryContent));

        // 监听选中文本
        this.setupTextSelectionListener();

        // 设置相关事件
        this.settingsBtn.addEventListener('click', () => this.showSettings());
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        this.closeSettingsBtn.addEventListener('click', () => this.hideSettings());
        this.settingsDialog.addEventListener('click', (e) => {
            if (e.target === this.settingsDialog) {
                this.hideSettings();
            }
        });
    }

    switchMode(mode) {
        if (mode === 'translate') {
            this.translateBtn.classList.add('active');
            this.summarizeBtn.classList.remove('active');
            this.translatePanel.classList.add('active');
            this.summarizePanel.classList.remove('active');
        } else {
            this.translateBtn.classList.remove('active');
            this.summarizeBtn.classList.add('active');
            this.translatePanel.classList.remove('active');
            this.summarizePanel.classList.add('active');
        }
    }

    async copyToClipboard(element) {
        try {
            await navigator.clipboard.writeText(element.textContent);
            alert('已复制到剪贴板');
        } catch (err) {
            console.error('复制失败:', err);
        }
    }

    clearTranslationPanel() {
        this.originalContent.value = '';
        this.translatedContent.textContent = '';
    }

    showLoading() {
        this.loadingIndicator.classList.remove('hidden');
    }

    hideLoading() {
        this.loadingIndicator.classList.add('hidden');
    }

    setupTextSelectionListener() {
        // 定期检查当前标签页中的选中文本
        setInterval(async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab) {
                    return;
                }

                // 检查是否是受限制的页面
                if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
                    return;
                }

                // 只在翻译面板激活时检查选中文本
                if (!this.translatePanel.classList.contains('active')) {
                    return;
                }

                chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' }, (response) => {
                    if (chrome.runtime.lastError) {
                        // 不显示错误信息，因为在受限页面这是正常的
                        return;
                    }
                    
                    if (response && response.selectedText) {
                        const selectedText = response.selectedText.trim();
                        if (selectedText) {
                            // 只有当内容不同时才更新，避免光标跳动
                            if (this.originalContent.value !== selectedText) {
                                this.originalContent.value = selectedText;
                            }
                        }
                    }
                });
            } catch (error) {
                // 不显示错误信息，静默失败
                console.debug('获取选中文本失败:', error);
            }
        }, 1000); // 每秒检查一次
    }

    async handleTranslateButtonClick() {
        try {
            // 尝试获取最新的选中文本
            const response = await new Promise(resolve => {
                chrome.runtime.sendMessage({ action: 'getCurrentSelectedText' }, resolve);
            });

            // 如果有新的选中文本，使用新的文本；否则使用输入框中的文本
            const text = (response && response.text) ? response.text : this.originalContent.value.trim();
            
            if (!text) {
                alert('请输入要翻译的文本');
                return;
            }

            // 如果有新的选中文本，更新输入框
            if (response && response.text) {
                this.originalContent.value = text;
            }

            const sourceLang = this.sourceLang.value;
            const targetLang = this.targetLang.value;
            
            this.translatedContent.textContent = '翻译中...';
            
            try {
                let prompt;
                if (sourceLang === 'auto') {
                    // 自动检测语言时的提示语
                    prompt = `请将以下文本翻译成${targetLang === 'zh' ? '中文' : '英文'}：\n\n`;
                } else if (sourceLang === 'zh' && targetLang === 'en') {
                    prompt = '请将以下中文文本翻译成英文：\n\n';
                } else if (sourceLang === 'en' && targetLang === 'zh') {
                    prompt = '请将以下英文文本翻译成中文：\n\n';
                } else {
                    // 如果源语言和目标语言相同，直接返回原文
                    if (sourceLang === targetLang) {
                        this.translatedContent.textContent = text;
                        return;
                    }
                    prompt = `请将以下文本翻译成${targetLang === 'zh' ? '中文' : '英文'}：\n\n`;
                }

                const translation = await KimiAPI.callKimiAPI(prompt, text);
                if (!translation) {
                    throw new Error('翻译结果为空');
                }
                // 处理换行并设置为 pre-wrap 格式
                this.translatedContent.style.whiteSpace = 'pre-wrap';
                this.translatedContent.textContent = translation.trim();
            } catch (error) {
                console.error('翻译失败:', error);
                this.translatedContent.style.whiteSpace = 'pre-wrap';
                this.translatedContent.textContent = '翻译失败: ' + (error.message || '未知错误');
                // 如果是 API 配额超限，给出更明确的提示
                if (error.message && error.message.includes('quota')) {
                    this.translatedContent.textContent = '翻译失败: API 调用次数已达到限制，请稍后再试';
                }
            }
        } catch (error) {
            console.error('处理翻译请求失败:', error);
            this.translatedContent.style.whiteSpace = 'pre-wrap';
            this.translatedContent.textContent = '处理翻译请求失败: ' + (error.message || '未知错误');
        }
    }

    async handleSummarizeButtonClick() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                alert('未找到活动标签页');
                return;
            }

            // 检查是否是受限制的页面
            if (!tab.url || tab.url.startsWith('chrome://') || 
                tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
                alert('无法在此类页面获取内容');
                return;
            }

            this.showLoading();
            
            try {
                // 使用 executeScript 直接获取页面内容
                const [result] = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        // 尝试获取主要内容
                        const article = document.querySelector('article');
                        if (article) {
                            return article.innerText;
                        }
                        
                        // 如果没有 article 标签，尝试获取主要内容区域
                        const main = document.querySelector('main');
                        if (main) {
                            return main.innerText;
                        }
                        
                        // 如果都没有，获取 body 的文本内容
                        return document.body.innerText;
                    }
                });

                if (result && result.result) {
                    const pageContent = result.result.trim();
                    // 显示页面内容
                    this.pageContent.textContent = pageContent;
                    // 生成摘要
                    await this.handleSummary(pageContent);
                } else {
                    throw new Error('无法获取页面内容');
                }
            } catch (error) {
                console.error('获取页面内容失败:', error);
                alert('获取页面内容失败: ' + error.message);
            }
        } catch (error) {
            console.error('总结失败:', error);
            alert('总结失败: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async handleSummary(text) {
        try {
            this.summaryContent.textContent = '生成摘要中...';
            // 如果文本太长，截取前10000个字符
            const truncatedText = text.length > 10000 ? text.slice(0, 10000) + '...' : text;
            const summary = await KimiAPI.callKimiAPI(config.SUMMARIZE_PROMPT, truncatedText);
            this.summaryContent.style.whiteSpace = 'pre-wrap';
            this.summaryContent.textContent = summary;
        } catch (error) {
            console.error('生成摘要失败:', error);
            this.summaryContent.style.whiteSpace = 'pre-wrap';
            this.summaryContent.textContent = '生成摘要失败: ' + error.message;
        }
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get(['kimiApiKey']);
            if (result.kimiApiKey) {
                this.apiKeyInput.value = result.kimiApiKey;
            } else {
                // 如果没有设置API密钥，显示设置对话框
                this.showSettings();
            }
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }

    showSettings() {
        this.settingsDialog.classList.remove('hidden');
    }

    hideSettings() {
        this.settingsDialog.classList.add('hidden');
    }

    async saveSettings() {
        const apiKey = this.apiKeyInput.value.trim();
        if (!apiKey) {
            alert('请输入 API 密钥');
            return;
        }

        try {
            await chrome.storage.sync.set({ kimiApiKey: apiKey });
            this.hideSettings();
            alert('设置已保存');
        } catch (error) {
            console.error('保存设置失败:', error);
            alert('保存设置失败: ' + error.message);
        }
    }
}

// 初始化UI
document.addEventListener('DOMContentLoaded', () => {
    new UIManager();
}); 
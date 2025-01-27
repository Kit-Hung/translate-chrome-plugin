const config = {
    KIMI_API_ENDPOINT: 'https://api.moonshot.cn/v1',
    // API密钥应该由用户在插件设置中配置
    getApiKey: () => {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['kimiApiKey'], (result) => {
                resolve(result.kimiApiKey);
            });
        });
    },
    // 翻译提示词
    TRANSLATE_PROMPT: "请将以下文本翻译成中文，保持原文的语气和风格：",
    // 总结提示词
    SUMMARIZE_PROMPT: "请总结以下文本的主要内容，用简洁的中文表达：",
}; 
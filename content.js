// 监听来自扩展的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getSelectedText') {
        const selectedText = window.getSelection().toString();
        sendResponse({ selectedText: selectedText });
    } else if (request.action === 'getPageContent') {
        // 获取主要内容
        const article = document.querySelector('article');
        const content = article ? article.textContent : document.body.textContent;
        sendResponse({ content: content });
    }
    return true;  // 保持消息通道开放
}); 
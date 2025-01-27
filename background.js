// 存储选中的文本，用于侧边栏打开时使用
let selectedTextToTranslate = '';

// 获取当前选中的文本
async function getCurrentSelectedText(tab) {
    if (!tab.url || tab.url.startsWith('chrome://') || 
        tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        return '';
    }

    try {
        const [result] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.getSelection().toString().trim()
        });
        return result.result;
    } catch (error) {
        console.error('获取选中文本失败:', error);
        return '';
    }
}

// 点击插件图标时
chrome.action.onClicked.addListener((tab) => {
    // 直接打开侧边栏（必须在用户点击事件中直接调用）
    chrome.sidePanel.open({ windowId: tab.windowId });

    // 检查是否是受限制的页面
    const isRestrictedPage = !tab.url || tab.url.startsWith('chrome://') || 
                           tab.url.startsWith('edge://') || tab.url.startsWith('about:');

    if (!isRestrictedPage) {
        // 对于普通页面，获取选中的文本
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.getSelection().toString().trim()
        }).then(([result]) => {
            if (result.result) {
                // 存储选中的文本
                selectedTextToTranslate = result.result;
                // 延迟发送消息，确保侧边栏已经打开
                setTimeout(() => {
                    chrome.runtime.sendMessage({ 
                        action: 'translateText', 
                        text: selectedTextToTranslate 
                    });
                }, 1000);
            }
        }).catch(error => {
            console.error('获取选中文本失败:', error);
        });
    } else {
        // 对于受限页面，延迟发送提示消息
        setTimeout(() => {
            chrome.runtime.sendMessage({ 
                action: 'showRestrictionNotice' 
            });
        }, 1000);
    }
});

// 监听来自侧边栏的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getInitialText') {
        // 发送存储的文本给侧边栏
        sendResponse({ text: selectedTextToTranslate });
        // 清空存储的文本
        selectedTextToTranslate = '';
        return true;
    } else if (request.action === 'getCurrentSelectedText') {
        // 获取当前活动标签页
        chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
            if (tab) {
                const text = await getCurrentSelectedText(tab);
                sendResponse({ text });
            } else {
                sendResponse({ text: '' });
            }
        });
        return true; // 保持消息通道开放
    }
}); 
// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'ADD_SUBSCRIPTION') {
        handleAddSubscription(request.username)
            .then(result => {
                console.log('订阅成功:', result);
                sendResponse({ success: true, data: result });
            })
            .catch(error => {
                console.error('订阅失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // 保持消息通道开启
    }
});

// 处理添加订阅的请求
async function handleAddSubscription(username, retryCount = 0) {
    try {
        // 构造 RSSHub URL
        const rsshubUrl = `rsshub://twitter/user/${username}`;
        
        // 检查订阅源是否存在
        const checkResponse = await fetch(`https://api.follow.is/feeds?url=${encodeURIComponent(rsshubUrl)}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!checkResponse.ok) {
            throw new Error('检查订阅源失败');
        }

        const checkData = await checkResponse.json();
        console.log('Feed 检查结果:', checkData);
        
        // 添加订阅
        const subscribeResponse = await fetch('https://api.follow.is/subscriptions', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                url: rsshubUrl,
                title: `Twitter @${username}`,
                category: 'Twitter',
                view: 1
            })
        });

        if (!subscribeResponse.ok) {
            throw new Error('添加订阅失败');
        }

        const result = await subscribeResponse.json();
        console.log('订阅结果:', result);
        return result;
    } catch (error) {
        console.error(`订阅失败 (重试 ${retryCount}/3):`, error);
        
        // 如果是网络错误且重试次数未超过限制，则重试
        if (retryCount < 3 && (error instanceof TypeError || error.message.includes('failed'))) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return handleAddSubscription(username, retryCount + 1);
        }
        
        throw error;
    }
}
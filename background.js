// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'ADD_SUBSCRIPTION') {
        handleAddSubscription(request.username)
            .then(result => sendResponse({ success: true, data: result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // 保持消息通道开启
    }
    
    if (request.type === 'GET_UTILS') {
        // 返回工具函数的实现
        sendResponse({
            utils: {
                parseUsername: (text) => {
                    if (!text) return null;
                    text = text.trim();
                    if (text.startsWith('@')) text = text.substring(1);
                    return text.split('/').pop().split('?')[0];
                },
                addTwitterSubscription: async (username) => {
                    return chrome.runtime.sendMessage({
                        type: 'ADD_SUBSCRIPTION',
                        username
                    });
                },
                getSubscribedUsers: async () => {
                    const result = await chrome.storage.local.get('subscribedUsers');
                    return result.subscribedUsers || [];
                },
                addSubscribedUser: async (username) => {
                    const users = await this.getSubscribedUsers();
                    if (!users.includes(username)) {
                        users.push(username);
                        await chrome.storage.local.set({ subscribedUsers: users });
                    }
                },
                isUserSubscribed: async (username) => {
                    const users = await this.getSubscribedUsers();
                    return users.includes(username);
                }
            }
        });
        return true;
    }
});

// 处理添加订阅的请求
async function handleAddSubscription(username) {
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

        return await subscribeResponse.json();
    } catch (error) {
        console.error('订阅失败:', error);
        throw error;
    }
}
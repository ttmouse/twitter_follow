// 解析用户名
function parseUsername(text) {
    if (!text) return null;

    // 移除空白字符
    text = text.trim();

    // 尝试匹配不同格式
    const patterns = [
        // @username 格式
        /^@?([a-zA-Z0-9_]{1,15})$/,
        // twitter.com/username 格式
        /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]{1,15})(?:$|[/?#])/,
        // 用户名(@username) 格式
        /^[^@]*\(@([a-zA-Z0-9_]{1,15})\)$/,
        // 用户名 @username 格式
        /^[^@]*@([a-zA-Z0-9_]{1,15})(?:\s|$)/
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return match[1];
        }
    }

    return null;
}

// 添加 Twitter 订阅
async function addTwitterSubscription(username) {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'ADD_SUBSCRIPTION',
            username
        });

        if (!response.success) {
            throw new Error(response.error || '订阅失败');
        }

        // 订阅成功后保存到本地存储
        await addSubscribedUser(username);
        return response.data;
    } catch (error) {
        console.error('添加订阅失败:', error);
        throw error;
    }
}

// 获取已订阅用户列表
async function getSubscribedUsers() {
    const subscribedUsers = await chrome.storage.local.get('subscribedUsers');
    return subscribedUsers.subscribedUsers || [];
}

// 添加已订阅用户
async function addSubscribedUser(username) {
    const users = await getSubscribedUsers();
    if (!users.includes(username)) {
        users.push(username);
        await chrome.storage.local.set({ subscribedUsers: users });
    }
}

// 检查用户是否已订阅
async function isUserSubscribed(username) {
    const users = await getSubscribedUsers();
    return users.includes(username);
}

// 导出工具函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseUsername,
        addTwitterSubscription,
        getSubscribedUsers,
        addSubscribedUser,
        isUserSubscribed
    };
} 
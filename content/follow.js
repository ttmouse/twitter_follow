// Follow.is 内容脚本

// 全局变量存储工具函数
let utils = null;

// 动态加载工具函数
async function loadUtils() {
    if (utils) return utils;
    
    const utilsUrl = chrome.runtime.getURL('utils.js');
    const response = await fetch(utilsUrl);
    const code = await response.text();
    const module = { exports: {} };
    const wrapper = Function('module', 'exports', code);
    wrapper(module, module.exports);
    utils = module.exports;
    return utils;
}

// 获取当前 Twitter 页面的用户信息
function getCurrentTwitterUser() {
    // 尝试从 URL 获取用户名
    const path = window.location.pathname;
    if (!path) return null;

    // 移除开头的斜杠
    const username = path.split('/')[1];
    if (!username) return null;

    // 排除特殊页面
    const excludedPaths = ['home', 'explore', 'notifications', 'messages', 'search'];
    if (excludedPaths.includes(username.toLowerCase())) {
        return null;
    }

    // 尝试获取显示名称
    let displayName = null;
    let avatarUrl = null;
    try {
        // 查找用户名和显示名称
        const userNameElement = document.querySelector('div[data-testid="UserName"]');
        if (userNameElement) {
            const nameSpans = userNameElement.querySelectorAll('span');
            for (const span of nameSpans) {
                const text = span.textContent.trim();
                if (text.startsWith('@')) {
                    const foundUsername = text.substring(1);
                    if (foundUsername.toLowerCase() === username.toLowerCase()) {
                        // 获取显示名称
                        displayName = nameSpans[0].textContent.trim();
                        // 获取头像
                        const avatarImg = document.querySelector('img[data-testid="UserAvatar-Container-' + username + '"]');
                        if (avatarImg) {
                            avatarUrl = avatarImg.src;
                        }
                        break;
                    }
                }
            }
        }
    } catch (error) {
        console.error('获取用户信息失败:', error);
    }

    return displayName && avatarUrl ? {
        username,
        displayName,
        avatarUrl
    } : null;
}

// 提取页面上的所有用户信息
function extractUsers() {
    const users = new Map();
    
    // 查找所有用户卡片
    document.querySelectorAll('div[data-testid="cellInnerDiv"]').forEach(cell => {
        try {
            // 获取用户名和显示名称
            const userNameElement = cell.querySelector('div[data-testid="User-Name"]');
            if (!userNameElement) return;

            let username = null;
            let displayName = null;
            
            // 遍历所有文本节点找到用户名和显示名称
            const spans = userNameElement.querySelectorAll('span');
            spans.forEach(span => {
                const text = span.textContent.trim();
                if (text.startsWith('@')) {
                    username = text.substring(1);
                } else if (!displayName) {
                    displayName = text;
                }
            });

            if (!username || !displayName) return;

            // 获取头像
            const avatarImg = cell.querySelector('img[src*="profile_images"]');
            if (!avatarImg) return;

            const avatarUrl = avatarImg.src;

            // 添加到用户列表
            users.set(username, {
                username,
                displayName,
                avatarUrl
            });
        } catch (error) {
            console.error('提取用户信息失败:', error);
        }
    });

    return Array.from(users.values());
}

// 创建订阅按钮
async function createSubscribeButton(defaultUsername = null, displayName = null) {
    // 1. 加载工具函数
    const utils = await loadUtils();
    const { parseUsername, addTwitterSubscription } = utils;

    // 2. 检查是否已存在按钮
    if (document.getElementById('clipboard-subscribe-btn')) {
        return;
    }

    // 3. 创建按钮
    const button = document.createElement('button');
    button.id = 'clipboard-subscribe-btn';
    button.innerHTML = defaultUsername ? 
        `订阅 ${displayName}(@${defaultUsername})` : 
        '从剪贴板添加订阅';
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        padding: 10px 20px;
        background-color: #1da1f2;
        color: white;
        border: none;
        border-radius: 20px;
        cursor: pointer;
        font-size: 14px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
    `;

    // 4. 添加悬停效果
    button.onmouseover = () => {
        button.style.transform = 'scale(1.05)';
        button.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    };
    button.onmouseout = () => {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    };

    // 5. 添加点击事件
    button.onclick = async () => {
        try {
            let username = defaultUsername;
            let userDisplayName = displayName;

            // 如果没有默认用户名，从剪贴板获取
            if (!username) {
                const text = await navigator.clipboard.readText();
                if (!text) {
                    alert('剪贴板为空！');
                    return;
                }
                username = parseUsername(text);
            }

            if (!username) {
                alert('无法识别用户名！');
                return;
            }

            const buttonText = userDisplayName ? 
                `正在处理 ${userDisplayName}(@${username})...` : 
                `正在处理 @${username}...`;
            button.innerHTML = buttonText;
            button.style.backgroundColor = '#FFA500';

            // 添加订阅
            await addTwitterSubscription(username);
            
            const successText = userDisplayName ? 
                `成功订阅 ${userDisplayName}(@${username})！` : 
                `成功订阅 @${username}！`;
            button.innerHTML = successText;
            button.style.backgroundColor = '#4CAF50';
            setTimeout(() => {
                button.innerHTML = defaultUsername ? 
                    `订阅 ${displayName}(@${defaultUsername})` : 
                    '从剪贴板添加订阅';
                button.style.backgroundColor = '#1da1f2';
            }, 2000);

        } catch (error) {
            console.error('订阅失败:', error);
            button.innerHTML = '订阅失败！';
            button.style.backgroundColor = '#f44336';
            setTimeout(() => {
                button.innerHTML = defaultUsername ? 
                    `订阅 ${displayName}(@${defaultUsername})` : 
                    '从剪贴板添加订阅';
                button.style.backgroundColor = '#1da1f2';
            }, 2000);
        }
    };

    // 6. 添加到页面
    document.body.appendChild(button);
}

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_USERS') {
        try {
            const users = extractUsers();
            // 如果在用户页面，添加当前用户
            const currentUser = getCurrentTwitterUser();
            if (currentUser) {
                users.unshift(currentUser);
            }
            sendResponse({ users });
        } catch (error) {
            console.error('获取用户列表失败:', error);
            sendResponse({ error: error.message });
        }
    }
    return true;
});

// 初始化函数
async function init() {
    try {
        // 加载工具函数
        await loadUtils();

        // 检查是否在 Twitter 页面
        const isTwitter = window.location.hostname.includes('twitter.com') || 
                         window.location.hostname.includes('x.com');
        
        if (isTwitter) {
            // 在 Twitter 页面，尝试获取当前用户信息
            const userInfo = getCurrentTwitterUser();
            if (userInfo) {
                await createSubscribeButton(userInfo.username, userInfo.displayName);
            } else {
                await createSubscribeButton();
            }

            // 监听 URL 变化
            let lastUrl = window.location.href;
            new MutationObserver(async () => {
                const currentUrl = window.location.href;
                if (currentUrl !== lastUrl) {
                    lastUrl = currentUrl;
                    const newUserInfo = getCurrentTwitterUser();
                    const button = document.getElementById('clipboard-subscribe-btn');
                    if (button) {
                        if (newUserInfo) {
                            button.innerHTML = `订阅 ${newUserInfo.displayName}(@${newUserInfo.username})`;
                        } else {
                            button.innerHTML = '从剪贴板添加订阅';
                        }
                    } else {
                        if (newUserInfo) {
                            await createSubscribeButton(newUserInfo.username, newUserInfo.displayName);
                        } else {
                            await createSubscribeButton();
                        }
                    }
                }
            }).observe(document, { subtree: true, childList: true });
        }

        console.log('Twitter Follow 内容脚本初始化完成');
    } catch (error) {
        console.error('Twitter Follow 内容脚本初始化失败:', error);
    }
}

// 确保在页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
} 
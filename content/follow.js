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

    // 移除开头的斜杠并分割路径
    const pathParts = path.split('/').filter(part => part);
    if (!pathParts.length) return null;

    // 获取用户名（路径的第一部分）
    const username = pathParts[0];

    // 排除特殊页面
    const excludedPaths = ['home', 'explore', 'notifications', 'messages', 'search'];
    if (excludedPaths.includes(username.toLowerCase())) {
        return null;
    }

    // 检查是否是followers页面，如果是，仍然返回主用户信息
    const isFollowersPage = pathParts.length > 1 && pathParts[1].toLowerCase() === 'followers';

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
async function extractUsers() {
    // 等待页面加载完成
    await waitForUsers();
    
    const users = new Map();
    
    // 查找所有用户卡片
    document.querySelectorAll('button[data-testid="UserCell"]').forEach(cell => {
        try {
            let username = null;
            let displayName = null;
            let avatarUrl = null;

            // 1. 从UserAvatar-Container获取用户名
            const avatarContainer = cell.querySelector('div[data-testid^="UserAvatar-Container-"]');
            if (avatarContainer) {
                const containerId = avatarContainer.getAttribute('data-testid');
                if (containerId) {
                    username = containerId.replace('UserAvatar-Container-', '');
                }
            }

            // 2. 获取头像URL
            const avatarImg = cell.querySelector('img.css-9pa8cd[draggable="true"]');
            if (avatarImg && avatarImg.src) {
                avatarUrl = avatarImg.src;
            }

            // 3. 获取显示名称
            // 首先尝试获取主显示名称
            const mainNameSpan = cell.querySelector('div[dir="ltr"] span.css-1jxf684 span.css-1jxf684');
            if (mainNameSpan) {
                displayName = mainNameSpan.textContent.trim();
            }

            // 如果没有找到显示名称，尝试其他方法
            if (!displayName) {
                const allSpans = cell.querySelectorAll('span.css-1jxf684');
                for (const span of allSpans) {
                    const text = span.textContent.trim();
                    if (text && !text.startsWith('@') && !text.includes('@')) {
                        displayName = text;
                        break;
                    }
                }
            }

            // 如果还没有用户名，从链接获取
            if (!username) {
                const userLink = cell.querySelector('a[href^="/"][role="link"]');
                if (userLink) {
                    const href = userLink.getAttribute('href');
                    if (href && href.startsWith('/')) {
                        username = href.substring(1).split('/')[0];
                    }
                }
            }

            // 确保所有必要信息都已获取
            if (username && displayName && avatarUrl) {
                // 清理数据
                username = username.trim();
                displayName = displayName.trim();
                // 移除可能的换行符和多余空格
                displayName = displayName.replace(/\s+/g, ' ');
                
                users.set(username, {
                    username,
                    displayName,
                    avatarUrl
                });
            }
        } catch (error) {
            console.error('提取用户信息失败:', error);
        }
    });

    return Array.from(users.values());
}

// 等待用户列表加载
function waitForUsers() {
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 10;
        const checkInterval = 500; // 500ms

        const check = () => {
            const users = document.querySelectorAll('button[data-testid="UserCell"]');
            if (users.length > 0) {
                resolve();
            } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(check, checkInterval);
            } else {
                resolve(); // 超时后也resolve，避免卡住
            }
        };

        check();
    });
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
        extractUsers()
            .then(users => {
                // 如果在用户页面，添加当前用户
                const currentUser = getCurrentTwitterUser();
                if (currentUser) {
                    users.unshift(currentUser);
                }
                sendResponse({ users });
            })
            .catch(error => {
                console.error('获取用户列表失败:', error);
                sendResponse({ error: error.message });
            });
        return true; // 保持消息通道开启
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
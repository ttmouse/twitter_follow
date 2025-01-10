import { addTwitterSubscription, isUserSubscribed } from '../utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const userList = document.getElementById('userList');
    const status = document.getElementById('status');
    const refreshBtn = document.getElementById('refreshBtn');

    function updateStatus(message, type) {
        status.textContent = message;
        status.className = `status ${type}`;
    }

    // 获取批量订阅按钮
    const batchSubscribeBtn = document.getElementById('batchSubscribeBtn');
    let usersList = [];

    // 更新统计信息的函数
    function updateStats(subscribedCount, totalCount) {
        const stats = document.querySelector('.header .stats');
        if (stats) {
            stats.textContent = `已订阅 ${subscribedCount} / 总计 ${totalCount}`;
        }
    }

    // 更新用户列表
    async function updateUserList() {
        const userList = document.getElementById('userList');
        userList.innerHTML = '<div class="no-users">加载中...</div>';

        try {
            // 获取当前标签页
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                throw new Error('无法获取当前标签页');
            }

            // 检查是否在Twitter页面
            if (!tab.url || !tab.url.match(/https:\/\/(.*\.)?(twitter\.com|x\.com)/)) {
                throw new Error('请在Twitter页面使用此扩展');
            }

            // 等待一下确保脚本加载完成
            await new Promise(resolve => setTimeout(resolve, 500));

            // 从页面获取用户列表
            try {
                const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_USERS' });
                if (!response) {
                    throw new Error('无法获取用户列表，请刷新页面后重试');
                }
                if (response.error) {
                    throw new Error(response.error);
                }
                if (!response.users) {
                    throw new Error('无法获取用户列表，请刷新页面后重试');
                }

                usersList = response.users; // 保存用户列表供批量订阅使用
                
                if (usersList.length === 0) {
                    userList.innerHTML = '<div class="no-users">没有找到可订阅的用户</div>';
                    batchSubscribeBtn.disabled = true;
                    return;
                }

                // 检查已订阅状态
                let subscribedCount = 0;
                for (const user of usersList) {
                    user.isSubscribed = await isUserSubscribed(user.username);
                    if (user.isSubscribed) {
                        subscribedCount++;
                    }
                }

                // 更新统计信息
                updateStats(subscribedCount, usersList.length);

                batchSubscribeBtn.disabled = false;
                userList.innerHTML = '';
                
                // 异步创建所有用户列表项
                const userItems = await Promise.all(usersList.map(user => createUserItem(user)));
                userItems.forEach(item => userList.appendChild(item));
            } catch (error) {
                console.error('获取用户列表失败:', error);
                userList.innerHTML = `<div class="no-users">${error.message}</div>`;
                batchSubscribeBtn.disabled = true;
            }
        } catch (error) {
            console.error('获取用户列表失败:', error);
            userList.innerHTML = `<div class="no-users">${error.message}</div>`;
            batchSubscribeBtn.disabled = true;
        }
    }

    // 批量订阅功能
    batchSubscribeBtn.onclick = async () => {
        if (!usersList.length) {
            updateStatus('没有找到可订阅的用户！', 'error');
            return;
        }

        try {
            batchSubscribeBtn.disabled = true;
            batchSubscribeBtn.textContent = '订阅中...';
            let successCount = 0;
            let skipCount = 0;
            let failCount = 0;

            // 遍历所有用户进行订阅
            for (const user of usersList) {
                try {
                    // 跳过已订阅的用户
                    if (user.isSubscribed) {
                        skipCount++;
                        continue;
                    }

                    await addTwitterSubscription(user.username);
                    successCount++;
                    user.isSubscribed = true;

                    // 更新对应用户的订阅按钮状态
                    const subscribeBtn = document.querySelector(`[data-username="${user.username}"]`);
                    if (subscribeBtn) {
                        subscribeBtn.textContent = '已订阅';
                        subscribeBtn.classList.add('subscribed');
                        subscribeBtn.disabled = true;
                    }
                } catch (error) {
                    console.error(`订阅 ${user.username} 失败:`, error);
                    failCount++;
                }
            }

            // 更新统计信息
            const totalSubscribed = successCount + skipCount;
            updateStats(totalSubscribed, usersList.length);

            // 更新状态信息
            if (successCount > 0 || skipCount > 0) {
                let message = '';
                if (successCount > 0) {
                    message += `成功订阅 ${successCount} 个用户`;
                }
                if (skipCount > 0) {
                    message += (message ? '，' : '') + `跳过 ${skipCount} 个已订阅用户`;
                }
                if (failCount > 0) {
                    message += `，${failCount} 个失败`;
                }
                updateStatus(message, failCount > 0 ? 'warning' : 'success');
            } else {
                updateStatus('订阅失败！', 'error');
            }
        } catch (error) {
            console.error('批量订阅失败:', error);
            updateStatus('批量订阅失败！', 'error');
        } finally {
            batchSubscribeBtn.disabled = false;
            batchSubscribeBtn.textContent = '批量订阅';
        }
    };

    // 创建用户列表项
    async function createUserItem(user) {
        const item = document.createElement('div');
        item.className = 'user-item';
        
        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';

        if (user.avatarUrl) {
            const avatar = document.createElement('img');
            avatar.className = 'user-avatar';
            avatar.src = user.avatarUrl;
            avatar.alt = user.username;
            userInfo.appendChild(avatar);
        }

        const nameDiv = document.createElement('div');
        nameDiv.className = 'user-name';
        
        const displayNameDiv = document.createElement('div');
        displayNameDiv.className = 'display-name';
        displayNameDiv.textContent = user.displayName || user.username;
        nameDiv.appendChild(displayNameDiv);

        const usernameDiv = document.createElement('div');
        usernameDiv.className = 'username';
        usernameDiv.textContent = `@${user.username}`;
        nameDiv.appendChild(usernameDiv);

        userInfo.appendChild(nameDiv);
        item.appendChild(userInfo);

        const subscribeBtn = document.createElement('button');
        subscribeBtn.className = 'subscribe-btn';
        subscribeBtn.dataset.username = user.username;
        
        // 使用用户的已订阅状态
        if (user.isSubscribed) {
            subscribeBtn.textContent = '已订阅';
            subscribeBtn.classList.add('subscribed');
            subscribeBtn.disabled = true;
        } else {
            subscribeBtn.textContent = '订阅';
            
            subscribeBtn.onclick = async () => {
                try {
                    subscribeBtn.disabled = true;
                    subscribeBtn.textContent = '处理中...';
                    
                    await addTwitterSubscription(user.username);
                    user.isSubscribed = true;
                    
                    subscribeBtn.textContent = '已订阅';
                    subscribeBtn.classList.add('subscribed');
                    subscribeBtn.disabled = true;
                    
                    // 更新统计信息
                    const subscribedCount = usersList.filter(u => u.isSubscribed).length;
                    updateStats(subscribedCount, usersList.length);
                    
                    updateStatus(`成功订阅 @${user.username}`, 'success');
                } catch (error) {
                    console.error(`订阅 ${user.username} 失败:`, error);
                    subscribeBtn.disabled = false;
                    subscribeBtn.textContent = '订阅';
                    updateStatus(`订阅 @${user.username} 失败: ${error.message}`, 'error');
                }
            };
        }

        item.appendChild(subscribeBtn);
        return item;
    }

    // 初始化
    updateUserList();

    // 添加刷新按钮点击事件
    refreshBtn.addEventListener('click', () => {
        if (!refreshBtn.classList.contains('loading')) {
            updateUserList();
        }
    });
});
document.addEventListener('DOMContentLoaded', () => {
    const userList = document.getElementById('userList');
    const status = document.getElementById('status');
    const refreshBtn = document.getElementById('refreshBtn');
    const subscribedCount = document.getElementById('subscribedCount');
    const totalCount = document.getElementById('totalCount');

    function updateStatus(message, type) {
        status.textContent = message;
        status.className = `status ${type}`;
    }

    // 更新统计数据
    function updateStats() {
        const subscribedButtons = document.querySelectorAll('.subscribe-btn.subscribed');
        const totalButtons = document.querySelectorAll('.subscribe-btn');
        subscribedCount.textContent = subscribedButtons.length;
        totalCount.textContent = totalButtons.length;
    }

    // 获取批量订阅按钮
    const batchSubscribeBtn = document.getElementById('batchSubscribeBtn');
    let usersList = [];

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
            let failCount = 0;
            let skipCount = 0;

            // 遍历所有用户进行订阅
            for (const user of usersList) {
                const subscribeBtn = document.querySelector(`[data-username="${user.username}"]`);
                // 如果按钮已经是订阅状态，跳过
                if (subscribeBtn && subscribeBtn.classList.contains('subscribed')) {
                    skipCount++;
                    continue;
                }

                try {
                    await addTwitterSubscription(user.username);
                    successCount++;
                    // 更新对应用户的订阅按钮状态
                    if (subscribeBtn) {
                        subscribeBtn.textContent = '已订阅';
                        subscribeBtn.classList.add('subscribed');
                        subscribeBtn.disabled = true;
                    }
                    updateStats(); // 更新每个成功订阅后的统计
                } catch (error) {
                    console.error(`订阅 ${user.username} 失败:`, error);
                    failCount++;
                }
            }

            // 更新状态信息
            let message = [];
            if (successCount > 0) message.push(`成功订阅 ${successCount} 个用户`);
            if (skipCount > 0) message.push(`跳过 ${skipCount} 个已订阅用户`);
            if (failCount > 0) message.push(`${failCount} 个失败`);

            updateStatus(message.join('，'), failCount > 0 ? 'warning' : 'success');
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
        
        // 检查是否已订阅
        const isSubscribed = await isUserSubscribed(user.username);
        if (isSubscribed) {
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
                    
                    subscribeBtn.textContent = '已订阅';
                    subscribeBtn.classList.add('subscribed');
                    subscribeBtn.disabled = true;
                    
                    updateStatus(`成功订阅 @${user.username}`, 'success');
                    updateStats(); // 更新统计数据
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

            // 注入内容脚本
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['utils.js', 'content/follow.js']
                });
            } catch (error) {
                console.error('注入脚本失败:', error);
                // 如果是因为脚本已经存在而失败，我们可以继续
                if (!error.message.includes('already exists')) {
                    throw new Error('无法访问页面，请刷新后重试');
                }
            }

            // 等待一下确保脚本加载完成
            await new Promise(resolve => setTimeout(resolve, 500));

            // 从页面获取用户列表
            const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_USERS' });
            if (response.error) {
                throw new Error(response.error);
            }
            if (!response || !response.users) {
                throw new Error('无法获取用户列表，请刷新页面后重试');
            }

            usersList = response.users; // 保存用户列表供批量订阅使用
            
            if (usersList.length === 0) {
                userList.innerHTML = '<div class="no-users">没有找到可订阅的用户</div>';
                batchSubscribeBtn.disabled = true;
                return;
            }

            batchSubscribeBtn.disabled = false;
            userList.innerHTML = '';
            
            // 异步创建所有用户列表项
            const userItems = await Promise.all(usersList.map(user => createUserItem(user)));
            userItems.forEach(item => userList.appendChild(item));
            updateStats(); // 更新列表加载完成后的统计
        } catch (error) {
            console.error('获取用户列表失败:', error);
            userList.innerHTML = `<div class="no-users">${error.message}</div>`;
            batchSubscribeBtn.disabled = true;
        }
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
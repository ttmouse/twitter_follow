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

            // 遍历所有用户进行订阅
            for (const user of usersList) {
                try {
                    await addTwitterSubscription(user.username);
                    successCount++;
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

            // 更新状态信息
            if (successCount > 0) {
                updateStatus(`成功订阅 ${successCount} 个用户${failCount > 0 ? `，${failCount} 个失败` : ''}`, 
                    failCount > 0 ? 'warning' : 'success');
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
    function createUserItem(user) {
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
        subscribeBtn.textContent = '订阅';
        subscribeBtn.dataset.username = user.username;
        
        subscribeBtn.onclick = async () => {
            try {
                subscribeBtn.disabled = true;
                subscribeBtn.textContent = '处理中...';
                
                await addTwitterSubscription(user.username);
                
                subscribeBtn.textContent = '已订阅';
                subscribeBtn.classList.add('subscribed');
                updateStatus(`成功订阅 ${user.displayName || user.username}！`, 'success');
                setTimeout(() => {
                    status.className = 'status';
                }, 2000);
            } catch (error) {
                console.error('订阅失败:', error);
                subscribeBtn.textContent = '订阅';
                subscribeBtn.disabled = false;
                updateStatus(error.message || '订阅失败！', 'error');
            }
        };

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

            // 从页面获取用户列表
            const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_USERS' });
            if (!response || !response.users) {
                throw new Error('无法获取用户列表');
            }

            usersList = response.users; // 保存用户列表供批量订阅使用
            
            if (usersList.length === 0) {
                userList.innerHTML = '<div class="no-users">没有找到可订阅的用户</div>';
                batchSubscribeBtn.disabled = true;
                return;
            }

            batchSubscribeBtn.disabled = false;
            userList.innerHTML = '';
            usersList.forEach(user => {
                userList.appendChild(createUserItem(user));
            });
        } catch (error) {
            console.error('获取用户列表失败:', error);
            userList.innerHTML = '<div class="no-users">获取用户列表失败</div>';
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
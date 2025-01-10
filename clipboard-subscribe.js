// Follow.is 剪贴板订阅脚本
// 在 Follow.is 网站控制台运行

function createSubscribeButton() {
    // 1. 检查是否已存在按钮
    if (document.getElementById('clipboard-subscribe-btn')) {
        return;
    }

    // 2. 创建按钮
    const button = document.createElement('button');
    button.id = 'clipboard-subscribe-btn';
    button.innerHTML = '从剪贴板添加订阅';
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

    // 3. 添加悬停效果
    button.onmouseover = () => {
        button.style.transform = 'scale(1.05)';
        button.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    };
    button.onmouseout = () => {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    };

    // 4. 添加点击事件
    button.onclick = async () => {
        try {
            // 获取剪贴板内容
            const text = await navigator.clipboard.readText();
            if (!text) {
                alert('剪贴板为空！');
                return;
            }

            // 解析用户名或路径
            let username = text;
            
            // 处理完整 URL
            if (text.includes('twitter.com/')) {
                const match = text.match(/twitter\.com\/([^\/\?]+)/);
                if (match) {
                    username = match[1];
                }
            }
            
            // 处理 @ 开头的用户名
            if (username.startsWith('@')) {
                username = username.substring(1);
            }

            // 移除可能的空格和特殊字符
            username = username.trim();

            if (!username) {
                alert('无法识别用户名！');
                return;
            }

            button.innerHTML = '正在处理...';
            button.style.backgroundColor = '#FFA500';

            // 构造请求
            const rsshubUrl = `rsshub://twitter/user/${username}`;
            
            // 检查 feed
            console.log('正在检查 feed...');
            const checkResponse = await fetch(
                `https://api.follow.is/feeds?url=${encodeURIComponent(rsshubUrl)}`,
                {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                }
            );

            const checkResult = await checkResponse.json();
            console.log('Feed 检查结果:', checkResult);

            if (checkResult.code !== 0) {
                throw new Error('Feed 检查失败');
            }

            // 添加订阅
            console.log('正在添加订阅...');
            const addResponse = await fetch('https://api.follow.is/subscriptions', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    url: rsshubUrl,
                    title: `Twitter @${username}`,
                    category: 'Twitter',
                    view: 1
                })
            });

            const addResult = await addResponse.json();
            
            if (addResult.code === 0) {
                button.innerHTML = '订阅成功！';
                button.style.backgroundColor = '#4CAF50';
                setTimeout(() => {
                    button.innerHTML = '从剪贴板添加订阅';
                    button.style.backgroundColor = '#1da1f2';
                }, 2000);
            } else {
                throw new Error(addResult.message || '添加订阅失败');
            }

        } catch (error) {
            console.error('订阅失败:', error);
            button.innerHTML = '订阅失败！';
            button.style.backgroundColor = '#f44336';
            setTimeout(() => {
                button.innerHTML = '从剪贴板添加订阅';
                button.style.backgroundColor = '#1da1f2';
            }, 2000);
        }
    };

    // 5. 添加到页面
    document.body.appendChild(button);
    console.log('订阅按钮已添加到页面右下角');
}

// 执行创建按钮
createSubscribeButton();

// 使用说明
console.log(`
使用方法：
1. 复制 Twitter 用户名（可以是 @用户名 或完整的个人主页链接）
2. 点击页面右下角的蓝色按钮
3. 等待订阅结果

注意：
- 请确保已登录 Follow.is
- 支持以下格式：
  - @username
  - username
  - https://twitter.com/username
  - twitter.com/username
`); 
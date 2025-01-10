// Follow.is Twitter 订阅添加脚本
// 在 Twitter 页面控制台运行

async function addSubscription(username) {
    // 1. 检查认证信息
    const authInfo = JSON.parse(localStorage.getItem('follow_is_auth'));
    if (!authInfo || !authInfo.headers) {
        console.error('未找到认证信息，请先在 Follow.is 页面执行获取认证信息脚本');
        return;
    }

    // 2. 构造请求 URL 和参数
    const rsshubUrl = `rsshub://twitter/user/${username}`;
    const apiUrl = 'https://api.follow.is';

    try {
        // 3. 检查 feed 是否存在
        console.log('正在检查 feed...');
        const checkResponse = await fetch(
            `${apiUrl}/feeds?url=${encodeURIComponent(rsshubUrl)}`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': authInfo.headers.authorization,
                    'X-CSRF-Token': authInfo.headers['x-csrf-token'],
                    'Cookie': authInfo.headers.cookie
                }
            }
        );

        const checkResult = await checkResponse.json();
        console.log('Feed 检查结果:', checkResult);

        // 4. 添加订阅
        console.log('正在添加订阅...');
        const addResponse = await fetch(`${apiUrl}/feeds`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': authInfo.headers.authorization,
                'X-CSRF-Token': authInfo.headers['x-csrf-token'],
                'Cookie': authInfo.headers.cookie
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
            console.log('订阅成功！');
            return true;
        } else {
            throw new Error(addResult.message || '添加订阅失败');
        }

    } catch (error) {
        console.error('订阅失败:', error);
        return false;
    }
}

// 使用说明
console.log(`
使用方法：
1. 确保已在 Follow.is 页面执行过认证信息获取脚本
2. 在 Twitter 用户页面执行：
   addSubscription("用户名")  // 替换为实际的 Twitter 用户名

注意：
- 如果提示认证失败，请重新在 Follow.is 获取认证信息
- 订阅成功后可以在 Follow.is 查看订阅列表
`); 
// Follow.is 认证信息获取脚本
// 在 Follow.is 网站控制台运行

async function getAuthInfo(retryCount = 3) {
    // 1. 检查是否在正确的域名
    if (!window.location.hostname.includes('follow.is')) {
        console.error('请在 Follow.is 网站上执行此脚本');
        return null;
    }

    // 2. 等待页面加载完成
    if (document.readyState !== 'complete') {
        console.log('等待页面加载完成...');
        await new Promise(resolve => window.addEventListener('load', resolve));
    }

    // 3. 获取所有 cookies
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
    }, {});

    // 4. 获取网络请求中的认证信息
    const originalFetch = window.fetch;
    let authHeaders = null;
    let retryAttempt = 0;

    while (retryAttempt < retryCount && (!authHeaders || !authHeaders.authorization)) {
        retryAttempt++;
        console.log(`尝试获取认证信息 (${retryAttempt}/${retryCount})...`);

        try {
            window.fetch = async (...args) => {
                const response = await originalFetch(...args);
                if (args[0].includes('api.follow.is')) {
                    const auth = response.headers.get('authorization');
                    const csrf = response.headers.get('x-csrf-token');
                    if (auth || csrf) {
                        authHeaders = {
                            cookie: document.cookie,
                            authorization: auth || '',
                            'x-csrf-token': csrf || ''
                        };
                        console.log('成功捕获认证头:', authHeaders);
                    }
                }
                return response;
            };

            // 触发一个请求来获取认证信息
            const response = await fetch('https://api.follow.is/subscriptions?view=1', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) {
                throw new Error(`API 请求失败: ${response.status}`);
            }

            const data = await response.json();

            // 如果获取到了认证信息，保存并返回
            if (authHeaders) {
                const authInfo = {
                    cookies,
                    headers: authHeaders,
                    userData: data,
                    timestamp: new Date().getTime()
                };

                localStorage.setItem('follow_is_auth', JSON.stringify(authInfo));
                console.log('认证信息已保存到 localStorage');
                return authInfo;
            }

            // 如果没有获取到认证信息，尝试其他 API 端点
            const otherEndpoints = [
                'https://api.follow.is/feeds',
                'https://api.follow.is/reads?view=1'
            ];

            for (const endpoint of otherEndpoints) {
                console.log(`尝试从 ${endpoint} 获取认证信息...`);
                const altResponse = await fetch(endpoint, {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                if (authHeaders) break;
            }

            if (authHeaders) {
                const authInfo = {
                    cookies,
                    headers: authHeaders,
                    timestamp: new Date().getTime()
                };

                localStorage.setItem('follow_is_auth', JSON.stringify(authInfo));
                console.log('认证信息已保存到 localStorage');
                return authInfo;
            }

            // 如果还是没有获取到认证信息，等待一秒后重试
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            console.error(`尝试 ${retryAttempt} 失败:`, error);
            if (retryAttempt === retryCount) {
                throw error;
            }
            // 等待一秒后重试
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    throw new Error('无法获取完整的认证信息');
}

// 执行获取认证信息
console.log('开始获取认证信息...');
console.log('请确保：');
console.log('1. 你已经登录了 Follow.is');
console.log('2. 当前页面是 Follow.is 的网站');
console.log('3. 页面已完全加载');

getAuthInfo().then(info => {
    if (info) {
        console.log('认证信息获取成功！现在你可以：');
        console.log('1. 打开 Twitter 用户页面');
        console.log('2. 在控制台中执行添加订阅脚本');
    } else {
        console.error('获取认证信息失败，请检查：');
        console.error('1. 是否已登录 Follow.is');
        console.error('2. 是否在 Follow.is 网站上执行此脚本');
        console.error('3. 如果问题持续，请刷新页面后重试');
    }
}).catch(error => {
    console.error('发生错误:', error);
    console.error('请刷新页面后重试');
});
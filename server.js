const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 存储在线用户
const users = new Set();

// 提供静态文件
app.use(express.static('./'));

// WebSocket连接处理
wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(message) {
        try {
            const data = JSON.parse(message);
            
            // 处理用户加入
            if (data.type === 'join') {
                ws.username = data.username;
                users.add(data.username);
                
                // 广播用户列表更新
                broadcastUserList();
                
                // 广播系统消息
                broadcast(JSON.stringify({
                    type: 'system',
                    content: `${data.username} 进入了聊天室`
                }));
            }
            // 处理聊天消息
            else if (data.type === 'chat') {
                broadcast(JSON.stringify({
                    type: 'chat',
                    username: data.username,
                    content: data.content
                }));

                // 如果不是AI的消息，让AI回复
                if (data.username !== 'AI助手') {
                    setTimeout(() => {
                        const aiResponse = getAIResponse(data.content);
                        broadcast(JSON.stringify({
                            type: 'chat',
                            username: 'AI助手',
                            content: aiResponse
                        }));
                    }, 1000);
                }
            }
        } catch (e) {
            console.error('Error processing message:', e);
        }
    });

    // 处理断开连接
    ws.on('close', function() {
        if (ws.username) {
            users.delete(ws.username);
            broadcastUserList();
            broadcast(JSON.stringify({
                type: 'system',
                content: `${ws.username} 离开了聊天室`
            }));
        }
    });
});

// 广播消息给所有客户端
function broadcast(message) {
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// 广播用户列表
function broadcastUserList() {
    const userList = Array.from(users);
    broadcast(JSON.stringify({
        type: 'userList',
        users: userList
    }));
}

// AI回复逻辑
function getAIResponse(message) {
    const responses = {
        '你好': ['你好啊！', '很高兴见到你！', '哈喽~'],
        '再见': ['再见啦！', '下次再聊！', '88~'],
        '天气': ['今天天气确实不错呢！', '是个出去玩的好日子~', '适合躺平刷剧呢！'],
        '名字': ['我是AI助手，很高兴认识你！'],
        '无聊': ['要不我们来玩个游戏？', '我可以给你讲个笑话！', '我们来聊聊天吧！'],
        '笑话': [
            '为什么程序员总是分不清万圣节和圣诞节？因为 Oct 31 = Dec 25！',
            '一个程序员去买面包，老板问："要几个？" 程序员说："要 8 个。" 老板给了他 8 个面包。程序员说："不对，我要的是 1000 个！"',
            '为什么程序员不喜欢户外运动？因为有太多 bug！'
        ]
    };

    // 检查关键词
    for (let keyword in responses) {
        if (message.toLowerCase().includes(keyword)) {
            const possibleResponses = responses[keyword];
            return possibleResponses[Math.floor(Math.random() * possibleResponses.length)];
        }
    }

    // 默认回复
    const defaultResponses = [
        '嗯嗯，继续说~',
        '真的吗？好有趣！',
        '我明白你的意思~',
        '要不换个话题？',
        '你说得对！',
        '这个问题很有意思呢'
    ];
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

const PORT = process.env.PORT || 8000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});

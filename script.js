let ws = null;
let username = '';

// DOM元素
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const usernameInput = document.getElementById('username');
const joinBtn = document.getElementById('join-btn');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesDiv = document.getElementById('messages');
const userList = document.getElementById('user-list');

// 建立WebSocket连接
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = window.location.port;
    const wsUrl = port ? `${protocol}//${host}:${port}` : `${protocol}//${host}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('WebSocket连接已建立');
        joinChat();
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleMessage(data);
    };
    
    ws.onclose = () => {
        console.log('WebSocket连接已关闭');
        setTimeout(connectWebSocket, 3000);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
    };
}

// 处理收到的消息
function handleMessage(data) {
    switch (data.type) {
        case 'chat':
            appendMessage(data.username, data.content);
            break;
        case 'system':
            appendSystemMessage(data.content);
            break;
        case 'userList':
            updateUserList(data.users);
            break;
    }
}

// 添加消息到聊天区域
function appendMessage(username, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.innerHTML = `<span class="username">${username}:</span> ${content}`;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// 添加系统消息
function appendSystemMessage(content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    messageDiv.textContent = content;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// 更新用户列表
function updateUserList(users) {
    userList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user;
        userList.appendChild(li);
    });
}

// 发送消息
function sendMessage() {
    const content = messageInput.value.trim();
    if (content && ws && ws.readyState === WebSocket.OPEN) {
        const message = {
            type: 'chat',
            username: username,
            content: content
        };
        ws.send(JSON.stringify(message));
        messageInput.value = '';
    }
}

// 加入聊天
function joinChat() {
    username = usernameInput.value.trim();
    if (username && ws && ws.readyState === WebSocket.OPEN) {
        const message = {
            type: 'join',
            username: username
        };
        ws.send(JSON.stringify(message));
        
        loginScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        messageInput.focus();
    }
}

// 事件监听
joinBtn.addEventListener('click', () => {
    if (usernameInput.value.trim()) {
        connectWebSocket();
    }
});

usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && usernameInput.value.trim()) {
        connectWebSocket();
    }
});

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// 页面加载完成后聚焦用户名输入框
window.addEventListener('load', () => {
    usernameInput.focus();
});

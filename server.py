import os
import asyncio
import websockets
import json
import logging
from aiohttp import web
import socket
import requests
from urllib.parse import urlparse
import sys
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 配置详细的日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 存储连接的客户端
connected = set()

def get_local_ip():
    """获取本地IP地址"""
    try:
        # 在云环境中，我们不需要真实的本地IP
        return "127.0.0.1"
    except Exception as e:
        logger.error(f"获取本地IP失败: {str(e)}")
        return "127.0.0.1"

def get_public_ip():
    """获取公网IP地址"""
    try:
        response = requests.get('https://api.ipify.org', timeout=5)
        if response.status_code == 200:
            return response.text.strip()
    except Exception as e:
        logger.error(f"获取公网IP失败: {str(e)}")
    return None

# WebSocket消息处理
async def websocket_handler(websocket, path):
    """处理WebSocket连接和消息"""
    try:
        # 添加新的连接到集合
        connected.add(websocket)
        logger.info(f"新的WebSocket连接: {websocket.remote_address}")
        
        # 广播新用户加入的消息
        join_message = json.dumps({
            "type": "system",
            "content": "新用户加入聊天室",
            "users_count": len(connected)
        })
        await broadcast(join_message)
        
        # 等待并处理消息
        async for message in websocket:
            try:
                # 解析收到的JSON消息
                data = json.loads(message)
                # 添加发送时间
                data['timestamp'] = asyncio.get_event_loop().time()
                # 广播消息给所有连接的客户端
                await broadcast(json.dumps(data))
                logger.info(f"广播消息: {message}")
            except json.JSONDecodeError:
                logger.error(f"无效的JSON消息: {message}")
                continue
            
    except websockets.exceptions.ConnectionClosed:
        logger.info("WebSocket连接关闭")
    except Exception as e:
        logger.error(f"WebSocket处理错误: {str(e)}")
    finally:
        # 连接关闭时，从集合中移除
        connected.remove(websocket)
        # 广播用户离开的消息
        leave_message = json.dumps({
            "type": "system",
            "content": "有用户离开聊天室",
            "users_count": len(connected)
        })
        await broadcast(leave_message)

async def broadcast(message):
    """广播消息给所有连接的客户端"""
    if connected:
        await asyncio.gather(
            *[client.send(message) for client in connected],
            return_exceptions=True
        )

# 处理静态文件
async def handle_static(request):
    """处理静态文件请求"""
    path = request.match_info.get('tail', 'index.html')
    if not path:
        path = 'index.html'
    
    try:
        with open(path, 'rb') as f:
            content = f.read()
        
        content_type = 'text/html' if path.endswith('.html') else \
                      'text/css' if path.endswith('.css') else \
                      'application/javascript' if path.endswith('.js') else \
                      'application/octet-stream'
        
        return web.Response(body=content, content_type=content_type)
    except FileNotFoundError:
        return web.Response(text='404: Not Found', status=404)
    except Exception as e:
        logger.error(f"处理静态文件错误: {str(e)}")
        return web.Response(text='500: Internal Server Error', status=500)

async def main():
    try:
        # 获取端口
        port = int(os.getenv('PORT', 3000))
        
        # 获取IP地址
        local_ip = get_local_ip()
        public_ip = get_public_ip()
        
        logger.info("服务器信息:")
        logger.info(f"本地IP地址: http://{local_ip}:{port}")
        if public_ip:
            logger.info(f"公网IP地址: http://{public_ip}:{port}")
        
        # 创建aiohttp应用
        app = web.Application()
        app.router.add_get('/{tail:.*}', handle_static)
        runner = web.AppRunner(app)
        await runner.setup()
        
        # 启动HTTP服务器
        site = web.TCPSite(runner, '0.0.0.0', port)
        await site.start()
        logger.info(f"HTTP服务器启动成功 在端口 {port}")
        
        # 启动WebSocket服务器（使用相同端口）
        async with websockets.serve(websocket_handler, "0.0.0.0", port):
            logger.info(f"WebSocket服务器启动成功 在端口 {port}")
            await asyncio.Future()  # 运行forever
    
    except Exception as e:
        logger.error(f"服务器启动失败: {str(e)}")
        raise

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("服务器正常关闭")
    except Exception as e:
        logger.error(f"服务器运行错误: {str(e)}")
        sys.exit(1)

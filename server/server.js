const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const fs = require('fs');

// 创建 Express 应用
const app = express();
const server = http.createServer(app);

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ server });

// 存储所有连接的客户端
const clients = new Map();

// 存储计时器数据
let timersData = {
    timer1: { name: '科研', totalSeconds: 10800, remainingSeconds: 10800, running: false },
    timer2: { name: '考研', totalSeconds: 10800, remainingSeconds: 10800, running: false },
    timer3: { name: '其他', totalSeconds: 10800, remainingSeconds: 10800, running: false }
};

// 学习时间统计数据
let studyStatsData = {
    date: getCurrentDateString(),
    timers: {
        '科研': { totalSeconds: 10800, studiedSeconds: 0 },
        '考研': { totalSeconds: 10800, studiedSeconds: 0 },
        '其他': { totalSeconds: 10800, studiedSeconds: 0 }
    }
};

// 每天重置计时器的日期标记
let currentDayKey = getCurrentDayKey();

// 确保数据目录存在
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// 提供静态文件
app.use(express.static(path.join(__dirname, '..')));
app.use(express.json());

// API 端点：获取所有计时器状态
app.get('/api/timers', (req, res) => {
    res.json(timersData);
});

// API 端点：获取学习统计数据
app.get('/api/stats', (req, res) => {
    updateStudyStats(); // 更新统计数据
    res.json(studyStatsData);
});

// API 端点：更新计时器状态
app.post('/api/timers/:id', (req, res) => {
    const { id } = req.params;
    const timerData = req.body;
    
    if (timersData[id]) {
        // 更新计时器数据之前记录旧的剩余时间
        const oldRemainingSeconds = timersData[id].remainingSeconds;
        
        // 更新计时器数据
        timersData[id] = { ...timersData[id], ...timerData };
        
        // 更新学习统计数据
        updateTimerStats(timersData[id].name, oldRemainingSeconds, timersData[id].remainingSeconds);
        
        // 向所有客户端广播更新
        broadcastTimerUpdate(id, timersData[id]);
        
        res.json({ success: true, data: timersData[id] });
    } else {
        res.status(404).json({ success: false, message: '计时器不存在' });
    }
});

// WebSocket 连接处理
wss.on('connection', (ws, req) => {
    const clientId = generateClientId();
    
    // 存储新客户端连接
    clients.set(clientId, {
        ws,
        lastActive: Date.now()
    });
    
    console.log(`客户端 ${clientId} 已连接`);
    
    // 发送当前所有计时器数据
    ws.send(JSON.stringify({
        type: 'init',
        data: timersData
    }));
    
    // 监听客户端消息
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // 更新客户端最后活动时间
            clients.get(clientId).lastActive = Date.now();
            
            // 处理消息
            handleClientMessage(clientId, data);
        } catch (error) {
            console.error('无效消息：', error);
        }
    });
    
    // 监听连接关闭
    ws.on('close', () => {
        console.log(`客户端 ${clientId} 已断开连接`);
        clients.delete(clientId);
    });
});

// 处理客户端消息
function handleClientMessage(clientId, message) {
    switch (message.type) {
        case 'update_timer':
            // 更新计时器状态
            const { timerId, data } = message;
            if (timersData[timerId]) {
                // 更新计时器数据之前记录旧的剩余时间
                const oldRemainingSeconds = timersData[timerId].remainingSeconds;
                
                // 更新计时器数据
                timersData[timerId] = { ...timersData[timerId], ...data };
                
                // 更新学习统计数据
                updateTimerStats(timersData[timerId].name, oldRemainingSeconds, timersData[timerId].remainingSeconds);
                
                // 向其他客户端广播更新
                broadcastTimerUpdate(timerId, timersData[timerId], clientId);
            }
            break;
            
        case 'ping':
            // 心跳检测响应
            const client = clients.get(clientId);
            if (client && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify({ type: 'pong' }));
            }
            break;
    }
}

// 向所有客户端广播计时器更新
function broadcastTimerUpdate(timerId, timerData, excludeClientId = null) {
    const message = JSON.stringify({
        type: 'timer_update',
        timerId,
        data: timerData
    });
    
    clients.forEach((client, clientId) => {
        if (client.ws.readyState === WebSocket.OPEN && clientId !== excludeClientId) {
            client.ws.send(message);
        }
    });
}

// 生成客户端 ID
function generateClientId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// 获取当前日期的唯一标识符
function getCurrentDayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

// 获取格式化的当前日期字符串 (YYYY-MM-DD)
function getCurrentDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// 更新单个计时器的学习统计数据
function updateTimerStats(timerName, oldRemainingSeconds, newRemainingSeconds) {
    // 只计算时间减少的部分（即学习时间增加的部分）
    if (newRemainingSeconds < oldRemainingSeconds) {
        const studiedTime = oldRemainingSeconds - newRemainingSeconds;
        
        // 如果计时器名称在统计数据中存在
        if (studyStatsData.timers[timerName]) {
            studyStatsData.timers[timerName].studiedSeconds += studiedTime;
        } else {
            // 如果计时器名称已更改，使用新名称创建统计数据
            studyStatsData.timers[timerName] = {
                totalSeconds: 10800, // 默认3小时
                studiedSeconds: studiedTime
            };
        }
    }
}

// 更新所有计时器的学习统计数据
function updateStudyStats() {
    Object.values(timersData).forEach(timer => {
        if (timer.running) {
            // 计算从上次更新到现在学习了多长时间
            const elapsedSeconds = Math.max(0, timer.totalSeconds - timer.remainingSeconds);
            if (studyStatsData.timers[timer.name]) {
                studyStatsData.timers[timer.name].totalSeconds = timer.totalSeconds;
                studyStatsData.timers[timer.name].studiedSeconds = elapsedSeconds;
            } else {
                studyStatsData.timers[timer.name] = {
                    totalSeconds: timer.totalSeconds,
                    studiedSeconds: elapsedSeconds
                };
            }
        }
    });
}

// 保存学习统计数据到JSON文件
function saveStudyStatsToFile() {
    updateStudyStats(); // 更新最新的学习统计数据
    
    const dateStr = studyStatsData.date;
    const filePath = path.join(dataDir, `stats_${dateStr}.json`);
    
    // 为每个计时器计算学习时间百分比和剩余时间
    const dataToSave = {
        date: dateStr,
        timers: {}
    };
    
    Object.entries(studyStatsData.timers).forEach(([name, data]) => {
        dataToSave.timers[name] = {
            totalHours: parseFloat((data.totalSeconds / 3600).toFixed(2)),
            studiedHours: parseFloat((data.studiedSeconds / 3600).toFixed(2)),
            studiedMinutes: Math.floor(data.studiedSeconds / 60),
            completionPercentage: parseFloat(((data.studiedSeconds / data.totalSeconds) * 100).toFixed(1)),
            remainingHours: parseFloat(((data.totalSeconds - data.studiedSeconds) / 3600).toFixed(2))
        };
    });
    
    // 添加总计信息
    let totalStudied = 0;
    let totalTime = 0;
    
    Object.values(studyStatsData.timers).forEach(data => {
        totalStudied += data.studiedSeconds;
        totalTime += data.totalSeconds;
    });
    
    dataToSave.summary = {
        totalPossibleHours: parseFloat((totalTime / 3600).toFixed(2)),
        totalStudiedHours: parseFloat((totalStudied / 3600).toFixed(2)),
        totalStudiedMinutes: Math.floor(totalStudied / 60),
        overallCompletion: parseFloat(((totalStudied / totalTime) * 100).toFixed(1))
    };
    
    try {
        fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
        console.log(`已保存学习统计数据到: ${filePath}`);
    } catch (error) {
        console.error('保存学习统计数据失败:', error);
    }
}

// 检查并执行每日重置
function checkAndResetTimers() {
    const newDayKey = getCurrentDayKey();
    
    if (newDayKey !== currentDayKey) {
        console.log('执行每日重置');
        
        // 保存前一天的学习统计数据
        saveStudyStatsToFile();
        
        // 重置所有计时器，但保留名称
        Object.keys(timersData).forEach(timerId => {
            const name = timersData[timerId].name;
            timersData[timerId] = {
                name,
                totalSeconds: 10800, // 3小时
                remainingSeconds: 10800,
                running: false
            };
        });
        
        // 重置学习统计数据
        studyStatsData = {
            date: getCurrentDateString(),
            timers: {
                '科研': { totalSeconds: 10800, studiedSeconds: 0 },
                '考研': { totalSeconds: 10800, studiedSeconds: 0 },
                '其他': { totalSeconds: 10800, studiedSeconds: 0 }
            }
        };
        
        // 更新当前日期标记
        currentDayKey = newDayKey;
        
        // 广播更新
        clients.forEach((client, clientId) => {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify({
                    type: 'reset_all',
                    data: timersData
                }));
            }
        });
    }
}

// 清理不活跃的连接
function cleanupInactiveConnections() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5分钟超时
    
    clients.forEach((client, clientId) => {
        if (now - client.lastActive > timeout) {
            console.log(`客户端 ${clientId} 不活跃，关闭连接`);
            client.ws.terminate();
            clients.delete(clientId);
        }
    });
}

// 每小时检查一次是否需要重置
setInterval(checkAndResetTimers, 3600000); // 每小时检查一次

// 每10分钟保存一次学习统计数据（即使没有重置）
setInterval(saveStudyStatsToFile, 600000); // 每10分钟

// 每分钟清理一次不活跃的连接
setInterval(cleanupInactiveConnections, 60000);

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`请确保在同一网络下使用IP地址访问，例如 http://[您的IP地址]:${PORT}`);
});
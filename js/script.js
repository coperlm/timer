document.addEventListener('DOMContentLoaded', () => {
    // WebSocket 连接
    let socket;
    let reconnectAttempts = 0;
    let reconnectInterval;
    let isConnected = false;
    
    // 学习统计数据
    let studyStats = {
        timers: {
            '科研': { totalSeconds: 10800, studiedSeconds: 0 },
            '考研': { totalSeconds: 10800, studiedSeconds: 0 },
            '其他': { totalSeconds: 10800, studiedSeconds: 0 }
        }
    };
    
    // 初始化统计数据显示切换按钮
    const toggleStatsBtn = document.getElementById('toggle-stats-btn');
    const statsContainer = document.getElementById('stats-container');
    
    toggleStatsBtn.addEventListener('click', () => {
        const isHidden = statsContainer.classList.toggle('hidden');
        toggleStatsBtn.textContent = isHidden ? '显示学习统计' : '隐藏学习统计';
        
        // 如果显示了统计数据，则立即更新
        if (!isHidden) {
            fetchStudyStats();
        }
    });
    
    // 初始化生成报告按钮
    const generateReportBtn = document.getElementById('generate-report-btn');
    
    generateReportBtn.addEventListener('click', () => {
        if (generateReportBtn.classList.contains('loading')) {
            return;  // 防止重复点击
        }
        
        // 设置按钮为加载状态
        generateReportBtn.classList.add('loading');
        generateReportBtn.textContent = '正在生成报告...';
        
        // 调用API生成报告
        fetch('/api/generate-report', { method: 'POST' })
            .then(response => {
                if (!response.ok) {
                    throw new Error('生成报告失败');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // 打开生成的HTML报告
                    window.open(data.reportUrl, '_blank');
                    generateReportBtn.textContent = '生成学习统计报告';
                } else {
                    alert('生成报告失败: ' + data.message);
                    generateReportBtn.textContent = '重试生成报告';
                }
            })
            .catch(error => {
                console.error('生成报告错误:', error);
                alert('生成报告出错，请稍后再试');
                generateReportBtn.textContent = '重试生成报告';
            })
            .finally(() => {
                generateReportBtn.classList.remove('loading');
            });
    });
    
    // 连接到服务器
    function connectWebSocket() {
        // 获取当前主机地址（用于确保在服务器上运行时使用正确的URL）
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        const port = window.location.port || (protocol === 'wss:' ? '443' : '80');
        const wsUrl = `${protocol}//${host}:${port}`;
        
        socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
            console.log('WebSocket 已连接');
            isConnected = true;
            reconnectAttempts = 0;
            clearInterval(reconnectInterval);
            
            // 显示连接状态
            updateConnectionStatus(true);
            
            // 获取最新的学习统计数据
            fetchStudyStats();
            
            // 开始发送心跳，保持连接
            startHeartbeat();
        };
        
        socket.onclose = () => {
            console.log('WebSocket 已断开');
            isConnected = false;
            
            // 显示断开状态
            updateConnectionStatus(false);
            
            // 尝试重新连接
            if (reconnectAttempts < 10) {
                reconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 30000);
                console.log(`${delay / 1000} 秒后尝试重新连接...`);
                
                setTimeout(connectWebSocket, delay);
            } else if (!reconnectInterval) {
                // 设置长时间的重连间隔
                reconnectInterval = setInterval(connectWebSocket, 60000);
            }
        };
        
        socket.onerror = (error) => {
            console.error('WebSocket 错误:', error);
        };
        
        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleServerMessage(data);
            } catch (error) {
                console.error('无法解析服务器消息:', error);
            }
        };
    }
    
    // 处理来自服务器的消息
    function handleServerMessage(message) {
        switch (message.type) {
            case 'init':
                // 初始化所有计时器状态
                Object.entries(message.data).forEach(([timerId, timerData]) => {
                    const timer = getTimerById(timerId);
                    if (timer) {
                        // 更新计时器数据（来自服务器）
                        timer.updateFromServer(timerData);
                    }
                });
                
                // 获取最新的学习统计数据
                fetchStudyStats();
                break;
                
            case 'timer_update':
                // 更新单个计时器状态
                const timer = getTimerById(message.timerId);
                if (timer) {
                    timer.updateFromServer(message.data);
                    
                    // 更新统计数据（仅当统计面板可见时）
                    if (!statsContainer.classList.contains('hidden')) {
                        fetchStudyStats();
                    }
                }
                break;
                
            case 'reset_all':
                // 重置所有计时器
                Object.entries(message.data).forEach(([timerId, timerData]) => {
                    const timer = getTimerById(timerId);
                    if (timer) {
                        timer.updateFromServer(timerData);
                    }
                });
                
                // 重置统计数据
                fetchStudyStats();
                break;
                
            case 'pong':
                // 心跳响应，不需要处理
                break;
        }
    }
    
    // 发送消息到服务器
    function sendToServer(data) {
        if (isConnected && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(data));
        } else {
            console.warn('WebSocket 未连接，无法发送消息');
            
            // 尝试重新连接
            if (!isConnected) {
                connectWebSocket();
            }
        }
    }
    
    // 更新连接状态显示
    function updateConnectionStatus(connected) {
        // 在页面上显示连接状态（可选）
        const statusElement = document.createElement('div');
        statusElement.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
        statusElement.textContent = connected ? '已连接' : '未连接';
        
        // 删除旧的状态指示
        const oldStatus = document.querySelector('.connection-status');
        if (oldStatus) {
            oldStatus.remove();
        }
        
        // 添加到页面
        document.querySelector('.container').prepend(statusElement);
        
        // 5秒后隐藏
        setTimeout(() => {
            statusElement.style.opacity = '0';
            setTimeout(() => statusElement.remove(), 1000);
        }, 5000);
    }
    
    // 心跳机制，保持连接
    function startHeartbeat() {
        setInterval(() => {
            if (isConnected && socket.readyState === WebSocket.OPEN) {
                sendToServer({ type: 'ping' });
            }
        }, 30000); // 每30秒发送一次心跳
    }
    
    // 从服务器获取学习统计数据
    function fetchStudyStats() {
        fetch('/api/stats')
            .then(response => {
                if (!response.ok) {
                    throw new Error('无法获取学习统计数据');
                }
                return response.json();
            })
            .then(data => {
                studyStats = data;
                updateStatisticsDisplay();
            })
            .catch(error => {
                console.error('获取统计数据失败:', error);
            });
    }
    
    // 更新统计数据显示
    function updateStatisticsDisplay() {
        // 为各个学习类型更新数据
        Object.entries(studyStats.timers).forEach(([name, data]) => {
            const statsCard = document.getElementById(`stats-${name}`);
            if (statsCard) {
                // 已学习时长
                const hours = Math.floor(data.studiedSeconds / 3600);
                const minutes = Math.floor((data.studiedSeconds % 3600) / 60);
                const studiedTimeElement = statsCard.querySelector('.studied-time');
                studiedTimeElement.textContent = `${hours}小时${minutes}分钟`;
                
                // 完成率
                const completionRate = ((data.studiedSeconds / data.totalSeconds) * 100).toFixed(1);
                const completionRateElement = statsCard.querySelector('.completion-rate');
                completionRateElement.textContent = `${completionRate}%`;
                
                // 进度条
                const progressBar = statsCard.querySelector('.progress-bar');
                progressBar.style.width = `${completionRate}%`;
                
                // 根据完成率调整进度条颜色类别
                updateProgressBarClass(progressBar, parseFloat(completionRate));
            }
        });
        
        // 计算并更新总计数据
        let totalStudied = 0;
        let totalTime = 0;
        
        Object.values(studyStats.timers).forEach(data => {
            totalStudied += data.studiedSeconds;
            totalTime += data.totalSeconds;
        });
        
        const totalHours = Math.floor(totalStudied / 3600);
        const totalMinutes = Math.floor((totalStudied % 3600) / 60);
        const totalCompletionRate = ((totalStudied / totalTime) * 100).toFixed(1);
        
        const totalTimeElement = document.querySelector('.total-studied-time');
        const totalCompletionElement = document.querySelector('.total-completion-rate');
        const totalProgressBar = document.querySelector('.total-stats .progress-bar');
        
        totalTimeElement.textContent = `${totalHours}小时${totalMinutes}分钟`;
        totalCompletionElement.textContent = `${totalCompletionRate}%`;
        totalProgressBar.style.width = `${totalCompletionRate}%`;
        
        // 根据总体完成率调整总进度条颜色
        updateProgressBarClass(totalProgressBar, parseFloat(totalCompletionRate));
    }
    
    // 根据进度值动态更新进度条样式
    function updateProgressBarClass(progressBar, percentage) {
        // 移除所有可能的类
        progressBar.classList.remove('progress-low', 'progress-medium', 'progress-high');
        
        // 基于百分比添加对应的类
        if (percentage < 30) {
            progressBar.classList.add('progress-low');
        } else if (percentage < 70) {
            progressBar.classList.add('progress-medium');
        } else {
            progressBar.classList.add('progress-high');
        }
    }
    
    // 定义倒计时器类
    class CountdownTimer {
        constructor(id) {
            this.id = id;
            this.element = document.getElementById(id);
            
            // 获取固定名称
            const timerTitles = {
                'timer1': '科研',
                'timer2': '考研',
                'timer3': '其他'
            };
            this.name = timerTitles[id];
            
            this.displayElement = this.element.querySelector('.timer-display');
            this.toggleBtn = this.element.querySelector('.toggle-btn');
            
            this.interval = null;
            this.running = false;
            this.totalSeconds = 3 * 3600; // 默认3小时
            this.remainingSeconds = this.totalSeconds;
            this.lastSyncTime = Date.now();
            
            this.setupEventListeners();
            this.loadFromLocalStorage();
            this.updateDisplay();
            this.updateButtonState();
        }
        
        setupEventListeners() {
            this.toggleBtn.addEventListener('click', () => this.toggle());
        }
        
        toggle() {
            if (this.running) {
                this.pause();
            } else {
                this.start();
            }
        }
        
        start() {
            if (this.running) return;
            
            // 特判：确保剩余时间不为负数
            if (this.remainingSeconds <= 0) {
                this.remainingSeconds = 0;
                this.updateDisplay();
                this.finish();
                return;
            }
            
            this.running = true;
            this.updateButtonState();
            this.lastSyncTime = Date.now();
            this.interval = setInterval(() => {
                this.remainingSeconds--;
                
                // 特判：确保剩余时间不为负数
                if (this.remainingSeconds <= 0) {
                    this.remainingSeconds = 0;
                    this.finish();
                }
                
                this.updateDisplay();
                
                // 定期同步到服务器（每10秒）
                const now = Date.now();
                if (now - this.lastSyncTime >= 10000) {
                    this.syncToServer();
                    this.lastSyncTime = now;
                    
                    // 更新统计数据（如果统计面板可见）
                    if (!statsContainer.classList.contains('hidden')) {
                        fetchStudyStats();
                    }
                }
                
                this.saveToLocalStorage();
            }, 1000);
            
            this.saveToLocalStorage();
            this.syncToServer();
        }
        
        pause() {
            if (!this.running) return;
            
            this.running = false;
            this.updateButtonState();
            clearInterval(this.interval);
            this.saveToLocalStorage();
            this.syncToServer();
            
            // 更新统计数据（如果统计面板可见）
            if (!statsContainer.classList.contains('hidden')) {
                fetchStudyStats();
            }
        }
        
        updateButtonState() {
            if (this.running) {
                this.toggleBtn.textContent = '暂停';
                this.toggleBtn.classList.add('running');
            } else {
                this.toggleBtn.textContent = '开始';
                this.toggleBtn.classList.remove('running');
            }
        }
        
        finish() {
            this.pause();
            this.element.classList.add('finished');
            
            // 闪烁效果
            let flashCount = 0;
            const flashInterval = setInterval(() => {
                this.element.style.backgroundColor = flashCount % 2 === 0 ? '#ffebee' : 'white';
                flashCount++;
                if (flashCount > 5) {
                    clearInterval(flashInterval);
                    this.element.style.backgroundColor = 'white';
                }
            }, 500);
            
            // 同步到服务器
            this.syncToServer();
            
            // 更新统计数据
            fetchStudyStats();
        }
        
        updateDisplay() {
            const hours = Math.floor(this.remainingSeconds / 3600);
            const minutes = Math.floor((this.remainingSeconds % 3600) / 60);
            const seconds = this.remainingSeconds % 60;
            
            this.displayElement.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        
        saveToLocalStorage() {
            const timerData = {
                name: this.name,
                totalSeconds: this.totalSeconds,
                remainingSeconds: this.remainingSeconds,
                running: this.running,
                lastUpdated: new Date().toISOString(),
                dayKey: getCurrentDayKey()
            };
            
            localStorage.setItem(`timer_${this.id}`, JSON.stringify(timerData));
        }
        
        loadFromLocalStorage() {
            const savedData = localStorage.getItem(`timer_${this.id}`);
            if (savedData) {
                const data = JSON.parse(savedData);
                
                // 检查是否是当天的数据，如果不是则重置
                if (data.dayKey !== getCurrentDayKey()) {
                    // 重置为默认值
                    this.totalSeconds = 3 * 3600; // 默认3小时
                    this.remainingSeconds = this.totalSeconds;
                } else {
                    // 加载保存的数据
                    this.totalSeconds = data.totalSeconds;
                    this.remainingSeconds = data.remainingSeconds;
                    
                    // 如果之前是运行状态，继续运行
                    if (data.running) {
                        // 计算暂停期间经过的时间
                        const lastUpdated = new Date(data.lastUpdated).getTime();
                        const currentTime = new Date().getTime();
                        const elapsedSeconds = Math.floor((currentTime - lastUpdated) / 1000);
                        
                        // 更新剩余时间
                        this.remainingSeconds = Math.max(0, data.remainingSeconds - elapsedSeconds);
                        
                        // 如果计时器已经结束
                        if (this.remainingSeconds <= 0) {
                            this.remainingSeconds = 0;
                            this.updateDisplay();
                            this.finish();
                        } else {
                            this.start();
                        }
                    }
                }
            }
        }
        
        // 同步数据到服务器
        syncToServer() {
            const timerData = {
                name: this.name,
                totalSeconds: this.totalSeconds,
                remainingSeconds: this.remainingSeconds,
                running: this.running,
                lastUpdated: new Date().toISOString()
            };
            
            sendToServer({
                type: 'update_timer',
                timerId: this.id,
                data: timerData
            });
        }
        
        // 从服务器更新数据
        updateFromServer(data) {
            // 更新计时器状态
            this.totalSeconds = data.totalSeconds;
            
            // 处理运行状态
            if (this.running !== data.running) {
                if (data.running) {
                    // 计算从上次更新到现在经过的时间
                    const lastUpdated = new Date(data.lastUpdated).getTime();
                    const currentTime = new Date().getTime();
                    const elapsedSeconds = Math.floor((currentTime - lastUpdated) / 1000);
                    
                    // 更新剩余时间，并确保不为负数
                    this.remainingSeconds = Math.max(0, data.remainingSeconds - elapsedSeconds);
                    
                    if (this.remainingSeconds <= 0) {
                        this.remainingSeconds = 0;
                        this.running = false;
                        this.element.classList.add('finished');
                        
                        // 如果当前正在运行，停止计时
                        if (this.interval) {
                            clearInterval(this.interval);
                            this.interval = null;
                        }
                    } else {
                        // 如果当前不在运行，则开始运行
                        if (!this.running) {
                            this.start();
                        } else {
                            this.remainingSeconds = Math.max(0, data.remainingSeconds);
                        }
                    }
                } else {
                    // 暂停计时器
                    if (this.running) {
                        this.pause();
                    }
                    this.remainingSeconds = Math.max(0, data.remainingSeconds);
                }
            } else {
                // 同步剩余时间（考虑运行状态）
                if (data.running) {
                    const lastUpdated = new Date(data.lastUpdated).getTime();
                    const currentTime = new Date().getTime();
                    const elapsedSeconds = Math.floor((currentTime - lastUpdated) / 1000);
                    this.remainingSeconds = Math.max(0, data.remainingSeconds - elapsedSeconds);
                    
                    // 如果已经归零，停止计时
                    if (this.remainingSeconds <= 0 && this.running) {
                        this.remainingSeconds = 0;
                        this.finish();
                    }
                } else {
                    this.remainingSeconds = Math.max(0, data.remainingSeconds);
                }
            }
            
            this.updateDisplay();
            this.saveToLocalStorage();
        }
    }
    
    // 获取当前日期的唯一标识符（用于每日重置）
    function getCurrentDayKey() {
        const now = new Date();
        return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    }
    
    // 根据ID获取计时器实例
    function getTimerById(id) {
        switch (id) {
            case 'timer1': return timer1;
            case 'timer2': return timer2;
            case 'timer3': return timer3;
            default: return null;
        }
    }
    
    // 初始化所有计时器
    const timer1 = new CountdownTimer('timer1');
    const timer2 = new CountdownTimer('timer2');
    const timer3 = new CountdownTimer('timer3');
    
    // 每分钟同步一次本地存储，以防刷新或关闭页面
    setInterval(() => {
        if (timer1.running) timer1.saveToLocalStorage();
        if (timer2.running) timer2.saveToLocalStorage();
        if (timer3.running) timer3.saveToLocalStorage();
    }, 60000);
    
    // 连接到 WebSocket 服务器
    connectWebSocket();
    
    // 当网页即将关闭时，保存状态
    window.addEventListener('beforeunload', () => {
        timer1.saveToLocalStorage();
        timer2.saveToLocalStorage();
        timer3.saveToLocalStorage();
    });
    
    // 添加计时器卡片动画效果
    document.querySelectorAll('.timer-card').forEach(card => {
        card.addEventListener('mouseover', () => {
            card.style.transform = 'translateY(-5px)';
            card.style.boxShadow = '0 15px 30px rgba(0,0,0,0.12)';
        });
        
        card.addEventListener('mouseout', () => {
            card.style.transform = '';
            card.style.boxShadow = '';
        });
    });
    
    // 添加暗黑模式切换按钮
    function setupDarkModeToggle() {
        // 创建切换按钮
        const darkModeBtn = document.createElement('button');
        darkModeBtn.id = 'dark-mode-toggle';
        darkModeBtn.innerHTML = '🌙';
        darkModeBtn.title = '切换暗黑模式';
        darkModeBtn.className = 'theme-toggle-btn';
        
        // 添加到页面
        document.body.appendChild(darkModeBtn);
        
        // 从本地存储加载暗黑模式设置
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
            darkModeBtn.innerHTML = '☀️';
        }
        
        // 添加点击事件处理
        darkModeBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDark);
            darkModeBtn.innerHTML = isDark ? '☀️' : '🌙';
        });
    }
    
    // 运行暗黑模式设置
    setupDarkModeToggle();
    
    // 检测网络连接状态
    window.addEventListener('online', () => {
        console.log('网络已连接');
        
        // 重新连接 WebSocket
        if (!isConnected) {
            connectWebSocket();
        }
    });
    
    window.addEventListener('offline', () => {
        console.log('网络已断开');
        updateConnectionStatus(false);
    });
});
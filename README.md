# 学习时间管理系统

一个简单高效的学习时间管理应用，帮助您跟踪和优化日常学习时间。系统提供三个独立的倒计时器（科研、考研和其他），每天自动统计学习时间并保存为JSON文件。

![](pic\image-20250428142139984.png)

## 项目特点

- **三个独立倒计时**：科研、考研和其他类别的学习时间独立跟踪
- **学习时间统计**：自动计算每个类别的学习时间及完成率
- **数据可视化**：直观的进度条显示学习进度
- **自动重置**：每天凌晨自动重置倒计时
- **历史记录**：每天的学习数据保存为独立JSON文件，方便回顾
- **响应式设计**：完美支持手机和电脑访问
- **WebSocket同步**：多设备实时同步，随时随地记录学习进度

## 线上使用

1. 在服务器上安装并启动应用
2. 通过浏览器访问 `http://[服务器IP]:3000`
3. 点击对应学习类型的"开始"按钮开始计时
4. 点击"暂停"按钮暂停计时
5. 点击"显示学习统计"查看当天累计学习情况

## 服务器端部署

### 环境要求

- Node.js 14.0.0 或更高版本
- npm 或 yarn 包管理器

### 安装步骤

1. 克隆仓库
   ```bash
   git clone https://github.com/coperlm/timer.git
   cd timer
   ```

2. 安装依赖
   ```bash
   npm install
   ```

3. 启动应用
   ```bash
   npm start
   ```

4. 访问应用
   - 本地访问: http://localhost:3000
   - 远程访问: http://[服务器IP]:3000

### 服务器端配置

配置文件在 `server/server.js` 中，可以修改以下参数：

- 端口号（默认3000）
- 倒计时默认时间（默认3小时）
- 数据保存频率（默认10分钟）

## 数据存储

所有学习数据将存储在 `data` 目录下，以日期命名：

```
data/
  stats_2025-04-28.json
  stats_2025-04-29.json
  ...
```

每个JSON文件包含当天的学习统计数据，格式如下：

```json
{
  "date": "2025-04-28",
  "timers": {
    "科研": {
      "totalHours": 3,
      "studiedHours": 1.5,
      "studiedMinutes": 90,
      "completionPercentage": 50.0,
      "remainingHours": 1.5
    },
    "考研": {
      "totalHours": 3,
      "studiedHours": 2.2,
      "studiedMinutes": 132,
      "completionPercentage": 73.3,
      "remainingHours": 0.8
    },
    "其他": {
      "totalHours": 3,
      "studiedHours": 0.5,
      "studiedMinutes": 30,
      "completionPercentage": 16.7,
      "remainingHours": 2.5
    }
  },
  "summary": {
    "totalPossibleHours": 9,
    "totalStudiedHours": 4.2,
    "totalStudiedMinutes": 252,
    "overallCompletion": 46.7
  }
}
```

## 技术栈

- 前端：HTML5 + CSS3 + JavaScript
- 后端：Node.js + Express
- 实时通信：WebSocket
- 数据存储：JSON文件

## 自定义设置说明

本应用默认设置为每个计时器3小时，名称分别为"科研"、"考研"和"其他"。如需修改这些设置，您需要在服务器端进行修改：

1. 修改计时器名称和时间：编辑 `server/server.js` 文件中的 `timersData` 对象
2. 修改自动重置时间：调整 `checkAndResetTimers` 函数中的逻辑

## 贡献指南

欢迎提交Pull Request或Issue来改进这个项目！

## 开源协议

MIT License
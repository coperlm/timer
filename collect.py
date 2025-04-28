import os
import json
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from matplotlib.font_manager import FontProperties
import datetime

def load_stats_data(data_folder='data'):
    """加载data文件夹中的所有JSON统计文件"""
    stats_data = []
    
    # 遍历data文件夹中的所有文件
    for filename in os.listdir(data_folder):
        if filename.endswith('.json') and filename.startswith('stats_'):
            file_path = os.path.join(data_folder, filename)
            
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                stats_data.append(data)
    
    # 按日期排序
    stats_data.sort(key=lambda x: datetime.datetime.strptime(x['date'], '%Y-%m-%d'))
    return stats_data

def create_daily_summary_table(stats_data):
    """创建每日总结表格"""
    daily_summary = []
    
    for day_data in stats_data:
        date = day_data['date']
        summary = day_data['summary']
        
        daily_summary.append({
            '日期': date,
            '总计划小时数': summary['totalPossibleHours'],
            '总学习小时数': summary['totalStudiedHours'],
            '完成率 (%)': summary['overallCompletion']
        })
    
    return pd.DataFrame(daily_summary)

def create_category_trend_data(stats_data):
    """创建各类别趋势数据"""
    category_data = {}
    dates = []
    
    for day_data in stats_data:
        date = day_data['date']
        dates.append(date)
        
        for category, stats in day_data['timers'].items():
            if category not in category_data:
                category_data[category] = {
                    '日期': [],
                    '已学习小时数': [],
                    '完成率 (%)': []
                }
            
            category_data[category]['日期'].append(date)
            category_data[category]['已学习小时数'].append(stats['studiedHours'])
            category_data[category]['完成率 (%)'].append(stats['completionPercentage'])
    
    return category_data, dates

def visualize_stats(stats_data):
    """可视化统计数据"""
    if not stats_data:
        print("没有找到统计数据文件！")
        return
    
    # 设置中文字体
    try:
        # 尝试使用系统中文字体
        font = FontProperties(fname=r'C:\Windows\Fonts\simsun.ttc')
    except:
        # 如果找不到特定字体，使用默认字体
        font = FontProperties()
    
    plt.rcParams['font.sans-serif'] = ['SimHei']  # 用来正常显示中文标签
    plt.rcParams['axes.unicode_minus'] = False  # 用来正常显示负号
    
    # 创建一个图形对象
    fig = plt.figure(figsize=(15, 12))
    
    # 1. 每日总结表格
    daily_df = create_daily_summary_table(stats_data)
    
    # 2. 总体学习时间趋势
    ax1 = plt.subplot2grid((3, 2), (0, 0), colspan=2)
    ax1.set_title('每日总学习时间趋势', fontproperties=font, fontsize=14)
    ax1.plot(daily_df['日期'], daily_df['总学习小时数'], 'o-', linewidth=2)
    ax1.set_ylabel('总学习小时数', fontproperties=font)
    ax1.grid(True, linestyle='--', alpha=0.7)
    plt.xticks(rotation=45)
    
    # 3. 完成率趋势
    ax2 = plt.subplot2grid((3, 2), (1, 0), colspan=2)
    ax2.set_title('每日完成率趋势', fontproperties=font, fontsize=14)
    ax2.plot(daily_df['日期'], daily_df['完成率 (%)'], 'o-', color='green', linewidth=2)
    ax2.set_ylabel('完成率 (%)', fontproperties=font)
    ax2.grid(True, linestyle='--', alpha=0.7)
    plt.xticks(rotation=45)
    
    # 4. 类别时间对比
    category_data, dates = create_category_trend_data(stats_data)
    
    # 创建堆叠条形图数据
    category_hours = {}
    for category, data in category_data.items():
        category_hours[category] = data['已学习小时数']
    
    category_df = pd.DataFrame(category_hours, index=dates)
    
    # 堆叠条形图
    ax3 = plt.subplot2grid((3, 2), (2, 0))
    ax3.set_title('各类别学习时间对比', fontproperties=font, fontsize=14)
    category_df.plot(kind='bar', stacked=True, ax=ax3)
    ax3.set_ylabel('学习小时数', fontproperties=font)
    ax3.legend(prop=font)
    plt.xticks(rotation=45)
    
    # 5. 类别完成率对比 - 最后一天的数据
    last_day = stats_data[-1]
    categories = list(last_day['timers'].keys())
    completion_rates = [last_day['timers'][cat]['completionPercentage'] for cat in categories]
    
    ax4 = plt.subplot2grid((3, 2), (2, 1))
    ax4.set_title(f"{last_day['date']} 各类别完成率", fontproperties=font, fontsize=14)
    bars = ax4.bar(categories, completion_rates, color=sns.color_palette("husl", len(categories)))
    ax4.set_ylabel('完成率 (%)', fontproperties=font)
    ax4.set_ylim(0, 100)
    
    # 在条形上方显示完成率数值
    for bar in bars:
        height = bar.get_height()
        ax4.annotate(f'{height:.1f}%',
                    xy=(bar.get_x() + bar.get_width() / 2, height),
                    xytext=(0, 3),  # 3点的垂直偏移
                    textcoords="offset points",
                    ha='center', va='bottom')
    
    plt.tight_layout()
    
    # 保存图像
    plt.savefig('学习统计可视化.png', dpi=300, bbox_inches='tight')
    
    # 同时创建一个HTML表格报告
    html_report = """
    <html>
    <head>
        <title>学习时间统计报告</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 20px; }}
            table {{ border-collapse: collapse; width: 100%; margin-top: 20px; }}
            th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
            th {{ background-color: #f2f2f2; }}
            tr:nth-child(even) {{ background-color: #f9f9f9; }}
            h1, h2 {{ color: #333; }}
            .summary {{ margin-top: 30px; }}
        </style>
    </head>
    <body>
        <h1>学习时间统计报告</h1>
        
        <h2>每日总结</h2>
        {daily_table}
        
        <div class="summary">
            <h2>数据可视化</h2>
            <img src="学习统计可视化.png" alt="学习统计可视化" style="max-width: 100%;">
        </div>
    </body>
    </html>
    """
    
    # 将DataFrame转换为HTML表格
    daily_table_html = daily_df.to_html(index=False)
    html_report = html_report.format(daily_table=daily_table_html)
    
    # 保存HTML报告
    with open('学习时间统计报告.html', 'w', encoding='utf-8') as f:
        f.write(html_report)
    
    print("可视化完成！生成了以下文件：")
    print("1. 学习统计可视化.png - 包含多个图表的可视化")
    print("2. 学习时间统计报告.html - HTML格式的详细报告")

if __name__ == "__main__":
    stats_data = load_stats_data()
    visualize_stats(stats_data)
[English](./README.md)
# Terminal Life

一款运行在终端里的文字人生模拟器，基于 Ink 和 React 构建。

**当前状态：** 早期开发中，游戏内容尚不完整，但核心系统已可用。

## 项目初衷

这个项目的出发点并不是做一款给别人玩的游戏。它更多是一个个人兴趣项目，源于对终端界面、事件驱动架构和依赖注入等技术的尝试。我想看看在命令行里能把一个文字互动程序做到什么程度，同时也把它当作一个长期维护的代码实验场。

## 特性

- **人生模拟** — 随着年龄增长，经历随机事件并受其影响。
- **状态效果** — 主情绪会周期性产生正面或负面效果，影响健康等属性。
- **事件引擎** — 加权随机事件，支持年龄区间过滤、前置条件、互斥、一次性触发、后置事件链。
- **模组支持** — 将模组放入 `~/.mod_live/`，可添加事件、翻译及通过插件 API 注入自定义逻辑。
- **成就系统** — 基于事件触发、数值阈值或自定义条件解锁。
- **纯键盘操作** — 所有按键均可通过游戏内编辑器自定义。
- **多语言** — 内置英文、简体中文、日文、俄文，模组可提供额外语言。
- **终端界面** — 使用 [Ink](https://github.com/vadimdemedes/ink) 渲染，支持 256 色和窗口大小调整。

## 环境要求

- **Node.js** >= 18
- 支持 Unicode 和 256 色的终端

## 安装

```bash
npm install -g @baigao_h/terminal-live
```

使用方法

运行游戏：

```bash
terminal-live
```

默认按键

按键 功能
S 开始游戏
C 打开设置
L 语言选择
A 查看成就
E 退出
Enter 下一回合（游戏中）
R 查看属性
T 查看状态
P 切换控制台通知
Q 返回主菜单

进入 设置 > 按键录制 可以修改所有绑定。

配置

持久化数据保存在安装目录下的 resource/ 文件夹中：

· config.json — 语言、初始玩家属性、启用的模组。
· keys.json — 按键映射。
· achievement/unlocked.json — 成就进度。

玩家属性（姓名、年龄、健康、情绪、财富）可在 玩家属性配置 界面中调整。

模组

模组存放在 ~/.mod_live/<模组名>/，每个模组可包含：

· 一个 index.js 入口，实现 ModPlugin 接口（提供钩子、自定义事件类型）。
· events/ 目录下的 JSON 事件定义文件。
· language/ 目录下的语言文件。
· mod.json 清单（名称、版本、描述、作者）。

在设置 > 模组管理中启用或关闭模组，修改后需重启游戏生效。

面向开发者的模组 API 提供：

· 生命周期钩子（onInit、onPlayerUpdate、onIncidentTrigger 等）
· 自定义事件的事件总线 EventBus
· 持久化存储 ConfigStore
· 动态创建事件类的 createEventClass 辅助方法

开发

```bash
git clone https://github.com/BAIGAOa/TerminalLive
cd terminal-live
npm install
npm run dev      # 构建并运行
npm run watch    # 监视模式
```

游戏使用的是来自 di-wise 这个第三方依赖注入容器库。新服务需要用 @Scoped(Scope.Container) 装饰器标记，并且会自动注册。

许可证

AGPL-3.0


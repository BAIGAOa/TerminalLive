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

## 默认按键

| 按键    | 动作                         |
|--------|------------------------------|
| S      | 开始游戏                     |
| C      | 打开设置                     |
| L      | 语言选择                     |
| A      | 成就                         |
| E      | 退出                         |
| Enter  | 下一回合（游戏中）           |
| R      | 查看属性                     |
| T      | 查看状态                     |
| P      | 切换通知控制台               |
| Q      | 返回主菜单                   |

进入 设置 > 按键录制 可以修改所有绑定。

## 配置

持久化数据保存在安装目录下的 resource/ 文件夹中：

· config.json — 语言、初始玩家属性、启用的模组。
· keys.json — 按键映射。
· achievement/unlocked.json — 成就进度。

玩家属性（姓名、年龄、健康、情绪、财富）可在 玩家属性配置 界面中调整。

## 模组

模组存放在 `~/.mod_live/<模组名>/` 下。每个模组可以添加事件、翻译、插件自定义逻辑，甚至自定义 UI 界面。

### 目录结构

```
~/.mod_live/
  my-mod/
    mod.json          # 模组清单（必需）
    index.js          # 插件入口（可选）
    events/           # JSON 事件定义（可选）
      custom.json
    language/         # 翻译文件（可选）
      zh_CN.json
      en_US.json
```

### 清单文件（`mod.json`）

```json
{
  "name": "my-mod",
  "version": "1.0.0",
  "description": "示例模组",
  "main": "index.js",
  "author": "your-name"
}
```

### JSON 事件定义

在 `events/` 目录下放置 `.json` 文件，每个文件定义一个事件实例：

```json
{
  "type": "BirthEvent",
  "id": "my-custom-event",
  "nameKey": "events.myEvent",
  "rangeKey": ["10-50"],
  "weight": 0.3,
  "once": false,
  "predecessorEvent": null,
  "excludedIds": [],
  "postEvent": null
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | string | 事件类名（需通过 `registerEventTypes` 注册或使用内置类型） |
| `id` | string | 唯一事件标识 |
| `nameKey` | string | 游戏日志中显示的翻译键 |
| `rangeKey` | string[] | 事件可触发的年龄段（如 `["5-12", "18-25"]`） |
| `weight` | number | 随机权重（越大越可能被选中） |
| `once` | boolean \| string[] | `true` = 全局只触发一次。数组 = 每个段只触发一次 |
| `predecessorEvent` | string \| null | 前置事件 ID，只有该事件触发后本事件才可触发 |
| `excludedIds` | string[] | 本事件触发后，被排除的事件 ID 列表 |
| `postEvent` | string \| object[] \| null | 本事件触发后，后续调度的事件 |

### 插件入口（`index.js`）

入口文件导出 `ModPlugin` 对象，游戏在特定生命周期节点调用其方法。

```javascript
module.exports = {
  id: "my-mod",

  // 注册自定义事件类型（可选）
  registerEventTypes(registry, ctx) {
    const MyEvent = ctx.createEventClass({
      apply(player, self) {
        player.fortune += 100;
        ctx.logger.info("自定义事件触发！");
      },
      getWeight(player) {
        return player.angerValue > 50 ? 0.6 : 0.1;
      },
    });
    registry.register("MyEvent", MyEvent);
  },

  // 生命周期钩子（可选）
  hooks: {
    onInit(ctx) {
      ctx.logger.info("模组已加载！");
      // 注册自定义 UI 界面
      ctx.registerScreen({
        scene: "myModSettings",
        component: MySettingsComponent,
        nameKey: "myMod.settingsTitle",
        highlightId: "mySettings",
      });
    },

    onPlayerUpdate(player, ctx) {
      if (player.health < 30) {
        ctx.logger.warn("血量危险！");
      }
    },

    onIncidentTrigger(incident, player, ctx) {
      // 返回 false 可阻止事件触发
      if (incident.id === "academic-stress" && player.angerValue > 80) {
        return false;
      }
    },

    onIncidentExecuted(incident, player, ctx) {
      ctx.logger.info(`事件完成: ${incident.id}`);
    },
  },
};
```

### ModContext API

所有钩子和回调中传入的 `ctx` 对象提供以下能力：

| 属性/方法 | 说明 |
|-----------|------|
| `ctx.eventBus` | 全局事件总线。使用 `on(event, callback)` 订阅，`emit(event, data)` 发送。内置事件：`player:updated`、`incident:executed`、`achievement:unlocked`。 |
| `ctx.configStore` | 持久化配置存储。使用 `getSnapshot()` 读取，`update(partial)` 写入。 |
| `ctx.logger` | 日志输出：`info(msg)`、`warn(msg)`、`error(msg)`。输出到终端 stdout。 |
| `ctx.getPlayer()` | 返回当前 `Player` 实例。 |
| `ctx.createEventClass(def)` | 根据 `{ apply, getWeight? }` 动态创建 `Incident` 子类，返回构造函数供 `registry.register()` 使用。 |
| `ctx.registerScreen(entry)` | 注册自定义 UI 界面：`{ scene, component, nameKey, highlightId? }`，scene 为任意字符串。 |
| `ctx.navigateTo(scene)` | 导航到已注册的场景（内置：`"game"`、`"config"`、`"language"`、`"achievement"`、`"menu"`）。 |

### 生命周期钩子

| 钩子 | 调用时机 | 典型用途 |
|------|----------|----------|
| `onInit(ctx)` | 模组加载后、游戏开始前 | 初始化、订阅事件、注册 UI |
| `onPlayerCreated(player, ctx)` | 玩家对象创建后 | 修改初始玩家状态 |
| `onPlayerUpdate(player, ctx)` | 每回合，player.update() 后 | 回合副作用、属性监控 |
| `onIncidentTrigger(incident, player, ctx)` | 事件执行前 | 阻止事件（返回 `false`）、条件判断 |
| `onIncidentExecuted(incident, player, ctx)` | 事件执行完成后 | 日志记录、后续操作 |

### TypeScript 开发模组

```bash
cd ~/.mod_live/my-mod
npm init -y
npm install --save-dev typescript @baigao_h/terminal-live
npx tsc --module commonjs --target es2022 --outDir . index.ts
```

安装 `@baigao_h/terminal-live` 作为开发依赖，即可获得 `ModPlugin`、`ModContext`、`Player`、`Incident` 等完整类型定义。

### 启用模组

1. 将模组目录放入 `~/.mod_live/`
2. 启动游戏，进入 **设置 → 模组管理**
3. 按 Enter 切换启用/关闭
4. 重启游戏

已启用的模组列表持久化在 `resource/config.json` 的 `enabledMods` 字段中。

## 存档系统

存档以带时间戳的 JSON 文件形式保存在 `~/.archive_live/` 目录下（如 `2026-05-01-12-00.json`）。

### 存档内容

每个存档包含游戏状态的完整快照：

- **玩家属性** — 姓名、年龄、生命、身高、体重、情绪值、财富
- **事件历史** — 已触发和已被屏蔽的事件记录
- **成就进度** — 已解锁的成就列表
- **游戏配置** — 语言及已启用的模组

### 保存

从主菜单进入 **存档管理**，按 `S` 保存当前游戏。文件名自动以当前时间戳生成。

### 加载

1. 从主菜单进入 **存档管理**
2. 使用 `↑` / `↓` 选择存档
3. 按 `Enter` 加载

加载会将存档数据写回游戏配置文件并退出。**重新启动游戏**即可从加载的状态继续。

### 删除

选中存档后按 `D`，再按 `Enter` 确认删除，`Esc` 取消。

### 存档管理界面按键

| 按键 | 动作 |
|------|------|
| `S` | 保存当前游戏 |
| `Enter` | 加载选中的存档 |
| `D` | 删除选中的存档 |
| `↑` / `↓` | 浏览存档 |
| `Esc` | 返回主菜单 |

## 开发

```bash
git clone https://github.com/BAIGAOa/TerminalLive
cd terminal-live
npm install
npm run dev      # 构建并运行
npm run watch    # 监视模式
```

游戏使用的是来自 di-wise 这个第三方依赖注入容器库。新服务需要用 @Scoped(Scope.Container) 装饰器标记，并且会自动注册。

## 许可证

AGPL-3.0


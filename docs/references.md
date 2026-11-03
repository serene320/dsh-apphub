# 参考项目与复用边界

本文是来源和历史研究记录，不是运行授权或待办；当前决定仅以 architecture.md、roadmap.md 和 AGENTS.md 为准。

核查日期：2026-11-03。以下是本次取得的上游提交快照和此前文档/局部源码阅读依据。固定提交便于后续复核，不代表已安装、已兼容或已完成安全审计。

## 核心参考

| 项目 | 固定提交 | 参考价值 | 当前限制与使用决定 |
|---|---|---|---|
| DeepSeek Harness | ce7073d51254c26cd63b22a60835b8f948deb447 | 官方插件、工具、会话、UI、数据扩展 | P01 静态接入基线；实际发布产物与运行兼容性待 P03 |
| open-mcp-apps | 880c3d6e8d80ec52ad483689cfcb66c7f57f15bd | 应用清单、运行时契约、独立数据、变更通知 | P02 已决定首版不引入；需要 HTML/MCP 应用时再评估 |
| dsh-plugin-open-app | 01706d45221a1c98ac33be9c900a9dc3eec4f9af | 应用入口、独立会话、UI 与 AI 桥接 | 文档列出六处非公开宿主依赖；不能直接当作当前兼容实现 |
| DSH-better-sidebar | 2d736f5496fe97f4bba6af37d99861649b9ef3c0 | 注册接口、生命周期、隐藏宿主变化 | 界面底座参考，不能等同完整应用运行时 |
| dsh-powerdesk | d109642ef84ed0e9801ec8a2b74041350fcc75aa | 扩展 manifest、打包和按需 UI 加载 | 扩展共享宿主页面权限；不作为第三方代码隔离方案 |

## 固定来源入口

- [DSH 架构](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/architecture.md)
- [DSH 工具契约](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/subsystems/tools.md)
- [DSH Web Client](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/subsystems/web-client.md)
- [open-mcp-apps 运行时契约](https://github.com/2nd1st/open-mcp-apps/blob/880c3d6e8d80ec52ad483689cfcb66c7f57f15bd/RUNTIME.md)
- [DSH open-app 接入与限制](https://github.com/2nd1st/dsh-plugin-open-app/blob/01706d45221a1c98ac33be9c900a9dc3eec4f9af/README.md)
- [Better Sidebar 外部插件契约](https://github.com/omdsh-dev/DSH-better-sidebar/blob/2d736f5496fe97f4bba6af37d99861649b9ef3c0/docs/external-plugin-guide.md)
- [Powerdesk 扩展模板](https://github.com/FleetingEcho/dsh-powerdesk/blob/d109642ef84ed0e9801ec8a2b74041350fcc75aa/templates/extension/README.md)

## 后续场景参考

- [WorkDSH](https://github.com/techflag/workdsh)：产品工作台与旅行场景参考，不作为当前宿主分叉来源。
- [STARDUSTLC666/dsh-suite](https://github.com/STARDUSTLC666/dsh-suite)：多插件组合与统一工作台；与 whyihaveyou 的同名插件目录区分。
- [dsh-map-tools](https://github.com/HorusJiang/dsh-map-tools)：地图工具与结果卡片，首版通过后按真实旅行需求评估。
- [deepseek-bot](https://github.com/rlaope/deepseek-bot)：消息入口与长期运行案例，不替代官方扩展契约。

## 本轮直接核查来源

以下 DSH 链接固定在同一研究提交：

- [Slot 注册与生命周期](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/subsystems/slots.md)
- [主面板与 selectPanel](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/client/ui-layout/README.md)
- [Remote 生成、挂载与访问控制](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/api-gateway.md)
- [Client 包入口](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/subsystems/client-modules.md)
- [工具注册与审批管线](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/core/tools/README.md)
- [会话与提交语义](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/api/session-controller/README.md)
- [仓库版本与 Node 要求](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/package.json)

- [Client bundle 格式、共享模块与加载生命周期](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/client/modules/README.md)

## P02 复用结论

open-mcp-apps 的 [公开类型接口](https://github.com/2nd1st/open-mcp-apps/blob/880c3d6e8d80ec52ad483689cfcb66c7f57f15bd/index.d.ts) 提供 openStore、createEngine 和 wrapApp，支持嵌入，不能说它必须独立部署。其 [package.json](https://github.com/2nd1st/open-mcp-apps/blob/880c3d6e8d80ec52ad483689cfcb66c7f57f15bd/package.json) 标注 0.10.1，依赖 MCP、SQLite、Schema 与应用商店包。

| 对比项 | 该引擎契约 | 本项目首版决定 |
|---|---|---|
| 应用形态 | HTML、manifest、可选 skill 与资源包 | 只有自带 React 清单组件，不需要源码安装与加载 |
| 数据与写入 | collection、写入回执、expected_version 等 | 借鉴同一数据源、冲突和幂等；只实现三个业务操作 |
| 工具接入 | MCP 引擎，包含应用及数据工具 | 使用三个明确 DSH 工具，避免再接一层通用工具集 |
| 通信与显示 | window.oma、widget、viewer、嵌入包装 | 电脑与手机连接同一 Host，复用 Remote；原生适配仍待探针 |
| 跨应用与身份 | 存在调用者、共享与挂载扩展接口 | 首版为本人可信手机，不引入跨账户共享体系 |
| 事件恢复 | 提供通知与运行时更新机制 | Host 通过 Remote stream 推送小清单快照，无需引入其事件链 |

结论是**当前范围不值得引入整个引擎**，不是判断它能力不足。没有拆取其内部模块或复制代码；未来需要 HTML 应用/MCP Apps 时，优先重新评估公开嵌入接口，不维护私有分叉。

[上游 LICENSE](https://github.com/2nd1st/open-mcp-apps/blob/880c3d6e8d80ec52ad483689cfcb66c7f57f15bd/LICENSE) 为 MIT，复制实质代码需保留声明；未据此推断依赖、商店内容或商标的授权。本仓库自身许可证尚未选择，不阻塞本地实现。

引用不保存原文副本。社区的测试、演示和兼容声明不作为 AppHub 功能验收；本轮是文档/接口核查，不是全量源码审计。

## 远程手机接入依据

以下均固定在同一 DSH 研究提交：

- [Connection 认证与传输](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/client/connection/README.md)：浏览器与 API 连接流程、Cookie/Peer 生命周期、Host/Origin 校验。浏览器 owner 登录不是 AppHub-only 权限；代理 TLS 与 Cookie 行为需实测。
- [Remote Access](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/api/remote-access/README.md)：非 owner 的动作/资源策略。可定义角色不代表已经具备第三方受限登录与凭据签发。
- [Gateway](https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/docs/api-gateway.md)：单次方法和 Remote stream，以及生成/挂载要求。

以上支持设计方向，不证明原生客户端或外网部署已通过。先前单独 SSE 服务方案已撤回，现复用宿主通信；浏览器验证与原生交付分别验收。


## P03a 实际运行基线

官方 DSH 提交 [b830ec950faba0a46dda564be3e2d854afed94f1](https://github.com/deepseek-ai/deepseek-harness/commit/b830ec950faba0a46dda564be3e2d854afed94f1)，已核对本机 HEAD 与 0.2.1-rc.5 包版本并完成入口、页面、Remote 验证。早期研究提交仍仅作历史静态证据。

首页信息层级参考 [Apple App Store 使用说明](https://support.apple.com/en-gb/guide/iphone/iphc90580097/26/ios/26)。仅借鉴应用区域与卡片呈现，不复制素材或实现推荐、排行榜、下载市场。

## 2026-11-03 叠笺与当前 DSH 适配核对

本机用户提供的 StackedNotes 源码：`Sources/StackedNotes/NoteStore.swift`、`Views.swift`、`AppController.swift`、`PaperStyle.swift`。仅核对源代码与原应用 UI，没有导入或修改原笔记数据。

- 原应用为 SwiftUI/AppKit executable；NoteStore 自动保存防抖 350ms，稳定顺序不因输入更新时间重排；颜色枚举 cream/sage/rose/lavender/sky。
- 原应用外观位于菜单/应用控制器，单张纸色位于编辑器；没有自行增加“自动保存开关”或“默认纸色”设置的依据。
- 全部备忘录为左侧搜索/卡片栈与归档列表、右侧编辑、底部纸色和保存状态。原生卡片栈/悬停/拖出涉及 AppKit 窗口，不能直接复制进 React。
- AppHub 采用语义适配，当前不声称完整移植固定草稿、撕纸、文本导出、手动排序或原生快捷键。

官方 rc.5 `ui-sidebar-right/src/client/service.ts` 提供 openTab、toggleExpanded、float/dock 等公开接口；tab body 在官方布局区域内渲染。未发现允许插件自定义宿主收起窄轨内容/任意设置整列宽度的公开接口。当前仅用 tab 注册，不修改宿主。


## 2026-11-03 进程机制核查

来源：官方 harness 本地提交 b830ec950faba0a46dda564be3e2d854afed94f1。
- packages/subprocess/subprocess/src/index.ts、types.ts：ctx.subprocess 生命周期和管道契约；协议、就绪、超时由消费者实现。
- packages/subprocess/subprocess-local/src/index.ts：本地 provider、释放时清理进程；不是应用加载/服务通信框架。
- apps/desktop/src/host-process.ts：桌面专用 DesktopHostProcess 引导、ready 与故障回调；依赖桌面 runtime/profile 与私有 IPC。
- node_modules/@deepseek-ai/dsh-tools/lib/types/index.d.ts（锁定 0.2.1-rc.5）：ToolExecutionInput 的 agent/callId 为工具执行来源。

判断：现阶段保留服务边界，不复制宿主私有管理器，不手写新进程框架。将来拆进程时复用 subprocess 生命周期，另行补齐必要通信验收。


## UI 复用核查

同一官方源码基线：packages/client/ui-primitives/src/index.ts（公开无 Cordis 组件库）；client/web/src/platform.ts（预加载共享模块）；ui-plugin-manager/src/client/PluginManagerPage.tsx 与 .module.css（控件使用和页宽/标题/详情页布局）；ui-theme/src/styles/base.css、design-platform.css 和 theme-settings.ts（主题别名、字体、内容字号）。未直接导入其他功能插件的内部页面组件。

## 第二应用地图能力核查（2026-11-03）

本节为本轮直接阅读的公开来源；尚未安装插件、调用地图 API 或验证当前桌面兼容性。链接 master 会变化，实际复用前须固定提交。

| 候选 | 已核查 | 对本项目的判断 |
|---|---|---|
| [dsh-map-tools README](https://github.com/HorusJiang/dsh-map-tools/blob/master/README.md) | 原生地图工具及聊天路线卡片；包含 Host 静态地图方式 | 可优先复用地图能力；聊天卡片不能直接等同旅行应用页面 |
| [package.json](https://raw.githubusercontent.com/HorusJiang/dsh-map-tools/master/package.json) | 本次响应版本 0.7.3；兼容声明未列出 0.2.1-rc.5；导出包根与 client 等 | 不能仅凭旧版本兼容声明认定当前兼容；尚未确认应用可依赖的公开服务接口 |
| [LICENSE](https://raw.githubusercontent.com/HorusJiang/dsh-map-tools/master/LICENSE) | MIT | 若复用代码，保留版权及许可文件；未复制实现 |
| [高德 MCP 接入](https://lbs.amap.com/api/mcp-server/gettingstarted) | 官方提供 Streamable HTTP 与 Node I/O 两种方式，并推荐前者 | 是工具接入备选；需要独立验证 DSH 接入及结果归属，不额外建立 MCP 客户端框架 |
| [高德 JS API 准备](https://lbs.amap.com/api/javascript-api-v2/prerequisites)、[安全密钥](https://lbs.amap.com/api/javascript-api-v2/guide/abc/jscode) | Web JS key 与安全密钥配套，官方推荐服务端代理保护安全密钥 | 交互地图不能只“塞一个 key”；首版优先静态预览，避免提前引入 JS SDK/proxy 配套 |
| [高德基础服务计费](https://lbs.amap.com/pages/base_service_price) | 基础 LBS 首档、基础搜索公开单价均为 30 元/万次；账号身份、配额影响实际费用 | 仅用于规划估算；未查询用户账号额度，不承诺零成本，不自动充值 |
| [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) | 数据开放不等于公共瓦片无限可用；有署名、缓存、请求标识要求，不提供可用性保证 | 不作为国内首版的“永久免费兜底”；未验证公共路线服务的能力，不照抄插件宣传 |

选择结论是工程判断：高德国内数据路径作为优先候选，地图插件复用优先核查，官方 MCP 为备选；M0 验证后再锁定实现。外部地图数据的保存/展示边界仍须随具体选定接口核对，公开价格不是授权结论。

## 收藏夹能力核查（2026-11-03）

DSH 源码基线 0.2.1-rc.5，commit b830ec950faba0a46dda564be3e2d854afed94f1。以下路径均相对官方 harness 仓库；本轮为静态核查，未测试当前桌面服务加载、图片传输或账号登录。

| 能力 | 公开接口/证据路径 | 结论 |
|---|---|---|
| 图片查看 | packages/client/ui-primitives/src/index.ts、ImageLightbox.tsx | 公开导出 ImageLightbox；卡片布局与封面获取不由它提供 |
| 受控资源传输 | packages/client/connection/README.zh.md；packages/api/session-controller/src/media-references.ts | connection.fetch 注册带 Peer 校验的资源路由，桌面有 IPC 载体；/api/file 属于绝对路径读取，不能宣称应用沙箱 |
| 本地图片实例 | packages/client/ui-sidebar-documentpreview/src/client/image/ImageBody.tsx | 已有读取 bytes → Blob URL 展示与释放的实现参考，不能 deep-import 私有组件 |
| 文件选择 | packages/client/ui-conversation/src/client/skeleton/InputBar.tsx:456；input/editor/view-binding.ts | 宿主使用隐藏 input type=file；pickFiles 依赖已挂载聊天 composer。未发现通用书签导入 API，不挪用会话附件协议 |
| 元信息网页获取 | packages/web/web-fetch-http/README.zh.md；src/index.ts | ctx.web.fetch 提供公共匿名、有限大小的 HTML/text，处理公开 IP 与连接固定；拒绝二进制，不能直接下载封面 |
| 密钥输入与存储 | packages/client/ui-primitives/src/index.ts；packages/credentials/credentials/README.zh.md；packages/api/settings-controller/src/credentials.ts | SettingsSecretField、ctx.credentials、remote.credentials 可复用；实际权限与注入在实现时核实 |
| 授权流程 | packages/credentials/authorization/README.zh.md | registerFlow/begin/cancel 是通用机制，提供方协议需集成方实现。本次未发现面向 Stars 的 GitHub flow |
| Copilot | packages/llm/llm-pi-ai/src/provider-data.generated.ts、tests/auth.spec.ts | 存在 github-copilot 模型凭据；不是收藏应用可借用的 GitHub 授权 |

官方外部依据：
- [Open Graph](https://ogp.me/)：页面标题、描述与封面元信息。
- [GitHub Starring API](https://docs.github.com/en/rest/activity/starring)：用户 Stars、分页、Star 时间、认证访问范围；fine-grained token 使用 Starring read 权限。
- [GitHub OAuth App 注册](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)：自己的应用与 device flow 配置，不能把宿主通用授权框架当作现成 GitHub 登录。
- [Karakeep 导入](https://docs.karakeep.com/using-karakeep/import/)：Netscape HTML 路径；仅参考格式与交互，不复制其 AGPL 实现。

## 代理与批量打开复用核查（2026-11-03）

- `packages/util/http-proxy/src/index.ts`：公开 proxyRouteFor，策略由宿主启动安装，AppHub 只消费。rc.5 不自动读取 macOS 系统代理。
- `packages/web/web-fetch-http/src/provider.ts`：官方 HTML 抓取按代理路由与直连分别处理 DNS；直连保留公网校验和连接固定。
- `apps/desktop/src/main.ts`：setWindowOpenHandler 对 HTTP/HTTPS 调用 shell.openExternal；客户端复用 window.open，无自建 IPC。
- browserUse 是 provider 注册和 agent 资源能力；未发现适合后台批量封面的公开截图服务。不能用侧栏浏览器绕过后台安全校验。

开发接入注意：dsh-http-proxy 为 peer dependency，必须与实际 Host 解析到同一个模块实例，rc.5 的路由策略是模块内状态。本机插件的该 peer 已链接到当前 Host 的公开包；npm ci 后须重新确认 peer 解析，不能自行再初始化一套代理。源码和锁文件不包含本机绝对路径。

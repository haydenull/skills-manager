# 文件树说明

本文档用于帮助贡献者快速理解 skills-manager 的仓库结构。文件树只展示源码、配置、资源和文档相关内容，不展开 `node_modules/`、`out/`、`.git/` 等依赖、构建产物或版本控制目录。

## 精简文件树

```text
.
├── AGENTS.md                    # 面向 AI agent 的仓库规则、命令和文档索引
├── README.md                    # 项目简介、安装、使用和开发说明入口
├── README.zh-CN.md              # 中文项目简介、安装、使用和开发说明入口
├── package.json                 # 项目元信息、脚本、依赖版本和 Electron 入口
├── pnpm-lock.yaml               # pnpm 依赖锁文件，修改依赖后应同步提交
├── electron.vite.config.ts      # Electron Vite 配置，包含 renderer 的 @renderer 别名
├── electron-builder.yml         # Electron Builder 打包配置
├── eslint.config.mjs            # ESLint、TypeScript、React、Hooks、Prettier 兼容配置
├── tsconfig.json                # TypeScript project references 总入口
├── tsconfig.node.json           # main、preload、shared 和构建配置的 TS 配置
├── tsconfig.web.json            # renderer、preload 声明和 shared 类型的 TS 配置
├── .github/                     # GitHub Actions 工作流配置
│   └── workflows/
│       └── release.yml          # 手动发布、构建 macOS/Windows 安装包和创建 Release
├── build/                       # Electron Builder 使用的打包资源和平台配置
│   ├── entitlements.mac.plist   # macOS 权限继承配置
│   ├── icon.icns                # macOS 应用图标
│   ├── icon.ico                 # Windows 应用图标
│   └── icon.png                 # 通用应用图标
├── docs/                        # 项目说明文档目录
│   ├── assets/                   # README 使用的应用截图
│   │   ├── install.png           # 安装新 Skill 页面截图
│   │   ├── settings.png          # 设置页面截图
│   │   └── skill-library.png     # Skill Library 页面截图
│   ├── development.md           # 开发环境准备、常用命令和本地开发隔离说明
│   ├── development.zh-CN.md     # 中文开发说明
│   ├── file-tree.md             # 当前文件树说明
│   ├── installation.md          # Windows/macOS 安装包下载、安装和 macOS 解除隔离标记说明
│   └── installation.zh-CN.md    # 中文安装说明
├── resources/                   # 应用运行或打包时引用的资源
│   └── icon.png                 # 应用资源图标
├── ui/                          # UI 参考图和设计说明
│   ├── README.md                # 首页交互和字段说明
│   ├── home-dark.png            # 首页深色模式参考图
│   ├── home-light.png           # 首页浅色模式参考图
│   ├── install-description-list-dark-v1.png # 安装页深色参考图
│   ├── install-description-list-light-v1.png # 安装页浅色参考图
│   ├── settings-redesign-dark-v2.png # 设置页深色参考图
│   └── settings-redesign-light-v2.png # 设置页浅色参考图
└── src/                         # 源码目录
    ├── main/                    # Electron 主进程代码
    │   ├── index.ts             # 应用启动、窗口创建和主进程入口
    │   └── skills-service.ts    # skills 相关主进程服务逻辑
    ├── preload/                 # preload 桥接层
    │   ├── index.d.ts           # preload API TypeScript 声明
    │   └── index.ts             # 向 renderer 暴露受控 API
    ├── shared/                  # main、preload、renderer 共用类型
    │   └── skills-types.ts      # skills 相关共享类型定义
    └── renderer/                # React 渲染进程代码和 HTML 入口
        ├── index.html           # renderer HTML 入口
        └── src/                 # renderer React 源码
            ├── env.d.ts         # renderer 环境类型声明
            ├── main.tsx         # React 挂载入口
            ├── routeTree.gen.ts # TanStack Router 生成的路由树
            ├── skills-queries.ts # skills 相关 React Query 配置
            ├── assets/          # 渲染层样式和静态图片资源
            │   ├── app-logo.svg # 应用 Logo
            │   ├── app-logo-light-blue.svg # 浅蓝 Logo 变体
            │   ├── app-logo-mint.svg # 薄荷绿 Logo 变体
            │   ├── app-logo-soft-violet.svg # 淡紫 Logo 变体
            │   ├── base.css     # 基础样式
            │   ├── electron.svg # Electron 图标资源
            │   ├── main.css     # 主样式入口
            │   └── wavy-lines.svg # 波纹背景资源
            ├── components/      # renderer 使用的 React 组件
            │   └── Versions.tsx # 版本信息组件
            ├── lib/             # renderer 工具函数
            │   └── cn.ts        # className 合并工具
            └── routes/          # TanStack Router 页面路由
                ├── __root.tsx   # 根布局和侧边栏导航
                ├── index.tsx    # 已安装 Skill 管理页
                ├── install.tsx  # 安装新 Skill 页面
                └── settings.tsx # 设置页面
```

## 配置文件说明

- `package.json` - 项目元信息、脚本、依赖版本和 Electron 入口。
- `pnpm-lock.yaml` - pnpm 依赖锁文件，修改依赖后应同步提交。
- `electron.vite.config.ts` - Electron Vite 构建配置，包含 renderer 的 `@renderer` 路径别名。
- `electron-builder.yml` - Electron Builder 打包配置，包含应用 ID、产品名、平台包和资源规则。
- `.github/workflows/release.yml` - GitHub Actions 手动发布流程，构建 macOS/Windows 安装包并创建 GitHub Release。
- `eslint.config.mjs` - ESLint 配置，接入 TypeScript、React、Hooks、Refresh 和 Prettier 兼容规则。
- `tsconfig.json` - TypeScript project references 总入口。
- `tsconfig.node.json` - main、preload、shared 和构建配置文件的 TypeScript 配置。
- `tsconfig.web.json` - renderer、preload 声明和 shared 类型的 TypeScript 配置。
- `AGENTS.md` - 面向 AI agent 的仓库规则、常用命令和文档索引。
- `README.md` - 项目简介、安装、使用和开发说明入口。
- `README.zh-CN.md` - 中文项目简介、安装、使用和开发说明入口。
- `ui/README.md` - UI 参考图说明和首页交互说明。

## 生成目录

- `out/` - Electron Vite 构建产物，不直接编辑。
- `dist/` - 可能由打包流程生成的发行产物，不直接编辑。
- `.debug/` - `pnpm dev` 使用的本地开发隔离环境，不直接编辑或提交。
- `node_modules/` - 依赖安装目录，不纳入代码审查范围。

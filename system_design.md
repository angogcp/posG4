# Android POS系统架构设计与开发环境构建

## 一、系统架构设计

### 1.1 整体架构

```
                    ┌─────────────────┐
                    │   热敏打印机     │
                    │                 │
                    └─────────────────┘
                           ▲     ▲
                      WiFi │     │ USB/Serial/WiFi
                           │     │
┌─────────────────┐    WiFi/LAN  │     ┌─────────────────┐
│  Android Client │ ◄──────────────────┤ Windows Server  │
│   (Flutter)     │                     │   (.NET Core)   │
└─────────────────┘                     └─────────────────┘
         │                                       │
         ▼                                       ▼
┌─────────────────┐                     ┌─────────────────┐
│   本地SQLite    │                     │   主数据库       │
│   (离线缓存)     │                     │  (SQLite/MySQL) │
└─────────────────┘                     └─────────────────┘

打印方式说明：
方式1: Android Client → WiFi → 热敏打印机 (直连模式)
方式2: Android Client → Windows Server → USB/Serial/WiFi → 热敏打印机 (代理模式)
```

### 1.2 技术栈选择

#### Android Client
- **开发框架**: Flutter 3.x
- **状态管理**: Riverpod
- **本地数据库**: SQLite (sqflite)
- **网络通信**: Dio + WebSocket
- **扫码功能**: mobile_scanner
- **权限管理**: permission_handler
- **UI组件**: Material Design 3

#### Windows Server
- **后端框架**: .NET 8 (ASP.NET Core)
- **数据库**: SQLite (开发) / MySQL (生产)
- **ORM**: Entity Framework Core
- **API**: RESTful API + SignalR (WebSocket)
- **打印驱动**: 厂商SDK集成
- **日志**: Serilog

### 1.3 数据库设计

#### 核心表结构

```sql
-- 商品表
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    category_id INTEGER,
    price DECIMAL(10,2) NOT NULL,
    member_price DECIMAL(10,2),
    stock_quantity INTEGER DEFAULT 0,
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 分类表
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    parent_id INTEGER,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1
);

-- 订单表
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no VARCHAR(50) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    paid_amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    status VARCHAR(20) DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 订单详情表
CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_code VARCHAR(50) NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- 用户表
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'cashier',
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 系统配置表
CREATE TABLE settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    description VARCHAR(500),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 1.4 API接口设计

#### RESTful API 端点

```
# 认证相关
POST   /api/auth/login          # 用户登录
POST   /api/auth/logout         # 用户登出
GET    /api/auth/profile        # 获取用户信息

# 商品管理
GET    /api/products            # 获取商品列表
GET    /api/products/{id}       # 获取商品详情
GET    /api/products/search     # 搜索商品
POST   /api/products            # 创建商品
PUT    /api/products/{id}       # 更新商品
DELETE /api/products/{id}       # 删除商品

# 分类管理
GET    /api/categories          # 获取分类列表
POST   /api/categories          # 创建分类

# 订单管理
POST   /api/orders              # 创建订单
GET    /api/orders              # 获取订单列表
GET    /api/orders/{id}         # 获取订单详情
POST   /api/orders/{id}/refund  # 订单退款

# 打印相关
POST   /api/print/receipt       # 打印小票
GET    /api/print/status        # 打印机状态

# 系统相关
GET    /api/system/status       # 系统状态
GET    /api/system/settings     # 系统设置
```

#### WebSocket 消息协议

```json
{
  "type": "message_type",
  "id": "request_id",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    // 具体数据
  }
}
```

消息类型:
- `heartbeat`: 心跳检测
- `product_update`: 商品信息更新
- `order_created`: 订单创建通知
- `print_request`: 打印请求
- `system_notification`: 系统通知

## 二、开发环境构建

### 2.1 Android Client 开发环境

#### 环境要求
- Flutter SDK 3.16+
- Dart SDK 3.2+
- Android Studio / VS Code
- Android SDK (API 23+)

#### 项目初始化

```bash
# 创建Flutter项目
flutter create pos_client
cd pos_client

# 添加依赖包
flutter pub add riverpod
flutter pub add flutter_riverpod
flutter pub add sqflite
flutter pub add dio
flutter pub add web_socket_channel
flutter pub add mobile_scanner
flutter pub add permission_handler
flutter pub add shared_preferences
flutter pub add connectivity_plus
flutter pub add flutter_secure_storage
```

#### 项目结构

```
pos_client/
├── lib/
│   ├── main.dart
│   ├── app.dart
│   ├── core/
│   │   ├── constants/
│   │   ├── database/
│   │   ├── network/
│   │   └── utils/
│   ├── features/
│   │   ├── auth/
│   │   ├── products/
│   │   ├── orders/
│   │   ├── scanner/
│   │   └── settings/
│   ├── shared/
│   │   ├── models/
│   │   ├── providers/
│   │   ├── services/
│   │   └── widgets/
│   └── presentation/
│       ├── pages/
│       ├── widgets/
│       └── themes/
├── android/
├── assets/
└── test/
```

### 2.2 Windows Server 开发环境

#### 环境要求
- .NET 8 SDK
- Visual Studio 2022 / VS Code
- SQL Server Express / MySQL (可选)

#### 项目初始化

```bash
# 创建解决方案
dotnet new sln -n POSSystem

# 创建Web API项目
dotnet new webapi -n POS.Server
dotnet sln add POS.Server

# 创建类库项目
dotnet new classlib -n POS.Core
dotnet new classlib -n POS.Infrastructure
dotnet sln add POS.Core POS.Infrastructure

# 添加项目引用
cd POS.Server
dotnet add reference ../POS.Core
dotnet add reference ../POS.Infrastructure

cd ../POS.Infrastructure
dotnet add reference ../POS.Core

# 添加NuGet包
cd ../POS.Server
dotnet add package Microsoft.EntityFrameworkCore.Sqlite
dotnet add package Microsoft.EntityFrameworkCore.Design
dotnet add package Microsoft.AspNetCore.SignalR
dotnet add package Serilog.AspNetCore
dotnet add package AutoMapper.Extensions.Microsoft.DependencyInjection
dotnet add package FluentValidation.AspNetCore
```

#### 项目结构

```
POSSystem/
├── POS.Core/
│   ├── Entities/
│   ├── Interfaces/
│   ├── DTOs/
│   └── Enums/
├── POS.Infrastructure/
│   ├── Data/
│   ├── Repositories/
│   ├── Services/
│   └── Configurations/
├── POS.Server/
│   ├── Controllers/
│   ├── Hubs/
│   ├── Middleware/
│   ├── Extensions/
│   └── Program.cs
└── POS.Tests/
```

### 2.3 开发工具配置

#### VS Code 扩展推荐

**Flutter开发:**
- Flutter
- Dart
- Flutter Widget Snippets
- Awesome Flutter Snippets

**.NET开发:**
- C# Dev Kit
- .NET Extension Pack
- REST Client
- SQLite Viewer

#### Git配置

```bash
# 初始化Git仓库
git init

# 创建.gitignore
echo "# Flutter
/build/
/android/app/debug
/android/app/profile
/android/app/release

# .NET
bin/
obj/
*.user
*.suo
.vs/

# Database
*.db
*.sqlite

# Logs
logs/
*.log" > .gitignore

# 首次提交
git add .
git commit -m "Initial project setup"
```

## 三、开发规范

### 3.1 代码规范

#### Flutter代码规范
- 遵循Dart官方代码风格
- 使用`flutter analyze`检查代码质量
- 文件命名使用snake_case
- 类名使用PascalCase
- 变量和方法名使用camelCase

#### .NET代码规范
- 遵循Microsoft C#编码约定
- 使用async/await处理异步操作
- 实现依赖注入模式
- 使用Repository和Service模式

### 3.2 版本控制

#### 分支策略
- `main`: 主分支，用于生产环境
- `develop`: 开发分支
- `feature/*`: 功能分支
- `hotfix/*`: 热修复分支

#### 提交规范
```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建过程或辅助工具的变动
```

### 3.3 测试策略

#### Flutter测试
```bash
# 单元测试
flutter test

# 集成测试
flutter test integration_test/

# 代码覆盖率
flutter test --coverage
```

#### .NET测试
```bash
# 单元测试
dotnet test

# 代码覆盖率
dotnet test --collect:"XPlat Code Coverage"
```

## 四、部署配置

### 4.1 Android应用打包

```bash
# Debug版本
flutter build apk --debug

# Release版本
flutter build apk --release

# 生成App Bundle
flutter build appbundle --release
```

### 4.2 Windows服务部署

```bash
# 发布应用
dotnet publish -c Release -o ./publish

# 创建Windows服务
sc create "POSService" binPath="C:\path\to\POS.Server.exe"
```

### 4.3 数据库迁移

```bash
# 创建迁移
dotnet ef migrations add InitialCreate

# 更新数据库
dotnet ef database update
```

## 五、监控和日志

### 5.1 日志配置

#### Flutter日志
```dart
import 'package:logger/logger.dart';

final logger = Logger(
  printer: PrettyPrinter(),
  level: Level.debug,
);
```

#### .NET日志
```csharp
// Program.cs
builder.Host.UseSerilog((context, configuration) =>
    configuration.ReadFrom.Configuration(context.Configuration));
```

### 5.2 性能监控

- 应用启动时间监控
- API响应时间监控
- 数据库查询性能监控
- 内存使用情况监控

### 5.3 错误追踪

- 崩溃日志收集
- 异常堆栈跟踪
- 用户操作路径记录
- 网络请求失败记录

## 六、安全考虑

### 6.1 数据安全
- 敏感数据加密存储
- HTTPS通信加密
- JWT Token认证
- SQL注入防护

### 6.2 权限控制
- 基于角色的访问控制(RBAC)
- API接口权限验证
- 操作日志审计
- 会话超时管理

---

**下一步行动计划:**
1. 搭建开发环境
2. 创建项目基础架构
3. 实现核心数据模型
4. 开发基础API接口
5. 实现Android客户端基础框架
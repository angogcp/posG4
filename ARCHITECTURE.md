# POS系统架构文档

## 目录

1. [系统概述](#系统概述)
2. [架构设计](#架构设计)
3. [技术栈](#技术栈)
4. [模块设计](#模块设计)
5. [数据库设计](#数据库设计)
6. [API设计](#api设计)
7. [安全架构](#安全架构)
8. [部署架构](#部署架构)
9. [性能优化](#性能优化)
10. [扩展性设计](#扩展性设计)

## 系统概述

### 业务背景

POS（Point of Sale）系统是一个现代化的销售点管理解决方案，专为餐饮行业设计。系统支持多平台操作，包括Web端和Android移动端，提供完整的销售流程管理功能。

### 核心目标

- **多平台支持**: 统一的业务逻辑，多端一致的用户体验
- **实时性**: 订单和数据的实时同步
- **可靠性**: 高可用性和数据一致性保障
- **可扩展性**: 支持业务增长和功能扩展
- **易用性**: 直观的用户界面和流畅的操作体验

### 系统特性

- **混合架构**: 结合Web和原生移动应用的优势
- **离线支持**: Android端支持离线操作和数据同步
- **RESTful API**: 标准化的API接口设计
- **实时通信**: WebSocket支持实时数据推送
- **模块化设计**: 松耦合的模块化架构

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        客户端层                              │
├─────────────────────────┬───────────────────────────────────┤
│      Web客户端          │        Android客户端              │
│   (React + Vite)        │    (React Native)                │
│                         │                                   │
│  ┌─────────────────┐   │   ┌─────────────────────────────┐ │
│  │   用户界面      │   │   │      移动界面               │ │
│  │   状态管理      │   │   │      离线存储               │ │
│  │   路由管理      │   │   │      数据同步               │ │
│  └─────────────────┘   │   └─────────────────────────────┘ │
└─────────────────────────┴───────────────────────────────────┘
                          │
                    ┌─────┴─────┐
                    │   网络层   │
                    │ HTTP/HTTPS │
                    │ WebSocket  │
                    └─────┬─────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                      服务端层                                │
├─────────────────────────────────────────────────────────────┤
│                 API网关/负载均衡                             │
├─────────────────────────────────────────────────────────────┤
│                   应用服务层                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │  认证服务   │ │  业务逻辑   │ │      数据访问层         │ │
│  │             │ │             │ │                         │ │
│  │ JWT Token   │ │ 产品管理    │ │    ORM/查询构建器       │ │
│  │ 权限控制    │ │ 订单处理    │ │    数据验证             │ │
│  │ 会话管理    │ │ 用户管理    │ │    缓存管理             │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                      数据层                                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │   SQLite    │ │   文件存储  │ │       日志系统          │ │
│  │   数据库    │ │             │ │                         │ │
│  │             │ │   图片文件  │ │    应用日志             │ │
│  │   事务管理  │ │   配置文件  │ │    错误日志             │ │
│  │   数据迁移  │ │   备份文件  │ │    访问日志             │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 架构原则

#### 1. 分层架构
- **表现层**: 用户界面和交互逻辑
- **业务层**: 核心业务逻辑和规则
- **数据层**: 数据存储和访问
- **基础设施层**: 通用服务和工具

#### 2. 模块化设计
- **高内聚**: 模块内部功能紧密相关
- **低耦合**: 模块间依赖最小化
- **单一职责**: 每个模块专注特定功能
- **开放封闭**: 对扩展开放，对修改封闭

#### 3. 数据驱动
- **统一数据模型**: 跨平台一致的数据结构
- **实时同步**: 数据变更的实时传播
- **离线优先**: 支持离线操作和延迟同步
- **数据一致性**: 保证数据的完整性和一致性

## 技术栈

### 后端技术栈

#### 核心框架
- **Node.js**: JavaScript运行时环境
- **Express.js**: Web应用框架
- **TypeScript**: 类型安全的JavaScript超集

#### 数据库
- **SQLite**: 轻量级关系数据库
- **better-sqlite3**: 高性能SQLite驱动

#### 认证和安全
- **jsonwebtoken**: JWT令牌生成和验证
- **bcryptjs**: 密码哈希和验证
- **helmet**: HTTP安全头设置
- **cors**: 跨域资源共享配置

#### 工具库
- **express-rate-limit**: API速率限制
- **express-validator**: 请求参数验证
- **multer**: 文件上传处理
- **winston**: 日志管理

### 前端技术栈

#### Web客户端
- **React 18**: 用户界面库
- **TypeScript**: 类型安全开发
- **Vite**: 构建工具和开发服务器
- **React Router**: 客户端路由
- **Zustand**: 状态管理
- **Axios**: HTTP客户端
- **Tailwind CSS**: 实用优先的CSS框架
- **Lucide React**: 图标库

#### Android客户端
- **React Native**: 跨平台移动应用框架
- **TypeScript**: 类型安全开发
- **React Navigation**: 导航管理
- **AsyncStorage**: 本地数据存储
- **NetInfo**: 网络状态检测
- **React Native Vector Icons**: 图标库

### 开发工具

#### 构建和打包
- **Vite**: Web端构建工具
- **Metro**: React Native打包工具
- **ESBuild**: 快速JavaScript打包器

#### 代码质量
- **ESLint**: JavaScript代码检查
- **Prettier**: 代码格式化
- **TypeScript**: 静态类型检查

#### 测试工具
- **Jest**: JavaScript测试框架
- **React Testing Library**: React组件测试
- **Supertest**: HTTP接口测试

## 模块设计

### 后端模块架构

```
server/
├── src/
│   ├── controllers/          # 控制器层
│   │   ├── authController.ts
│   │   ├── productController.ts
│   │   ├── categoryController.ts
│   │   └── orderController.ts
│   ├── middleware/           # 中间件
│   │   ├── auth.ts
│   │   ├── validation.ts
│   │   ├── errorHandler.ts
│   │   └── rateLimit.ts
│   ├── models/              # 数据模型
│   │   ├── User.ts
│   │   ├── Product.ts
│   │   ├── Category.ts
│   │   └── Order.ts
│   ├── routes/              # 路由定义
│   │   ├── auth.ts
│   │   ├── products.ts
│   │   ├── categories.ts
│   │   └── orders.ts
│   ├── services/            # 业务逻辑层
│   │   ├── authService.ts
│   │   ├── productService.ts
│   │   └── orderService.ts
│   ├── utils/               # 工具函数
│   │   ├── database.ts
│   │   ├── logger.ts
│   │   └── helpers.ts
│   └── app.ts               # 应用入口
├── migrations/              # 数据库迁移
├── seeds/                   # 初始数据
└── tests/                   # 测试文件
```

#### 控制器层 (Controllers)

控制器负责处理HTTP请求和响应，协调业务逻辑的执行。

```typescript
// authController.ts
export class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.authenticate(email, password);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(401).json({ success: false, error: error.message });
    }
  }

  async logout(req: Request, res: Response) {
    // 登出逻辑
  }

  async profile(req: Request, res: Response) {
    // 获取用户信息
  }
}
```

#### 服务层 (Services)

服务层包含核心业务逻辑，独立于HTTP层，便于测试和复用。

```typescript
// authService.ts
export class AuthService {
  static async authenticate(email: string, password: string) {
    const user = await User.findByEmail(email);
    if (!user || !await bcrypt.compare(password, user.password)) {
      throw new Error('Invalid credentials');
    }
    
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    return { user, token };
  }
}
```

#### 中间件 (Middleware)

中间件处理横切关注点，如认证、验证、错误处理等。

```typescript
// auth.ts
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};
```

### 前端模块架构

#### Web客户端结构

```
web-client/
├── src/
│   ├── components/          # 可复用组件
│   │   ├── common/          # 通用组件
│   │   ├── forms/           # 表单组件
│   │   └── layout/          # 布局组件
│   ├── pages/               # 页面组件
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── POS.tsx
│   │   ├── Products.tsx
│   │   └── Orders.tsx
│   ├── hooks/               # 自定义Hook
│   │   ├── useAuth.ts
│   │   ├── useApi.ts
│   │   └── useLocalStorage.ts
│   ├── services/            # API服务
│   │   ├── api.ts
│   │   ├── authService.ts
│   │   └── productService.ts
│   ├── store/               # 状态管理
│   │   ├── authStore.ts
│   │   ├── cartStore.ts
│   │   └── productStore.ts
│   ├── types/               # TypeScript类型
│   │   └── index.ts
│   ├── utils/               # 工具函数
│   │   └── helpers.ts
│   └── App.tsx              # 应用根组件
```

#### 状态管理设计

使用Zustand进行状态管理，提供简洁的API和良好的TypeScript支持。

```typescript
// authStore.ts
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,
  
  login: async (email, password) => {
    try {
      const response = await authService.login(email, password);
      const { user, token } = response.data;
      
      localStorage.setItem('token', token);
      set({ user, token, isAuthenticated: true });
    } catch (error) {
      throw error;
    }
  },
  
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false });
  }
}));
```

#### Android客户端结构

```
android-client/
├── src/
│   ├── components/          # 可复用组件
│   ├── screens/             # 屏幕组件
│   │   ├── LoginScreen.tsx
│   │   ├── POSScreen.tsx
│   │   ├── ProductsScreen.tsx
│   │   └── OrdersScreen.tsx
│   ├── navigation/          # 导航配置
│   │   └── AppNavigator.tsx
│   ├── services/            # API和本地服务
│   │   ├── apiService.ts
│   │   ├── storageService.ts
│   │   └── syncService.ts
│   ├── store/               # 状态管理
│   ├── types/               # TypeScript类型
│   └── utils/               # 工具函数
```

#### 离线数据同步

Android客户端实现了完整的离线支持机制：

```typescript
// syncService.ts
export class SyncService {
  private static instance: SyncService;
  private syncQueue: SyncItem[] = [];
  
  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }
  
  async addToSyncQueue(item: SyncItem) {
    this.syncQueue.push(item);
    await this.saveQueueToStorage();
    
    if (await this.isOnline()) {
      this.processSyncQueue();
    }
  }
  
  async processSyncQueue() {
    while (this.syncQueue.length > 0) {
      const item = this.syncQueue.shift();
      try {
        await this.syncItem(item);
      } catch (error) {
        // 同步失败，重新加入队列
        this.syncQueue.unshift(item);
        break;
      }
    }
  }
}
```

## 数据库设计

### 数据模型

#### 用户表 (users)

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'staff',
  is_active BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 产品分类表 (categories)

```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 产品表 (products)

```sql
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category_id INTEGER,
  image_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);
```

#### 订单表 (orders)

```sql
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  table_id INTEGER,
  status VARCHAR(20) DEFAULT 'pending',
  total_amount DECIMAL(10,2) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### 订单项表 (order_items)

```sql
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  modifiers TEXT, -- JSON格式存储修饰符
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

### 数据关系图

```
┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│    users    │       │  categories  │       │  products   │
├─────────────┤       ├──────────────┤       ├─────────────┤
│ id (PK)     │       │ id (PK)      │       │ id (PK)     │
│ username    │       │ name         │       │ name        │
│ email       │       │ description  │       │ description │
│ password    │       │ is_active    │       │ price       │
│ role        │       │ created_at   │       │ category_id │
│ is_active   │       │ updated_at   │       │ image_url   │
│ created_at  │       └──────────────┘       │ is_active   │
│ updated_at  │              │               │ created_at  │
└─────────────┘              │               │ updated_at  │
       │                     │               └─────────────┘
       │                     └─────────────────────┘
       │
       │
┌─────────────┐                           ┌─────────────┐
│   orders    │                           │ order_items │
├─────────────┤                           ├─────────────┤
│ id (PK)     │──────────────────────────▶│ id (PK)     │
│ user_id (FK)│                           │ order_id(FK)│
│ table_id    │                           │ product_id  │
│ status      │                           │ quantity    │
│ total_amount│                           │ unit_price  │
│ created_at  │                           │ total_price │
│ updated_at  │                           │ modifiers   │
└─────────────┘                           └─────────────┘
```

### 索引设计

```sql
-- 用户表索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_active ON users(is_active);

-- 产品表索引
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_name ON products(name);

-- 订单表索引
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_orders_table ON orders(table_id);

-- 订单项表索引
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
```

## API设计

### RESTful API规范

#### 基础规则

1. **URL设计**
   - 使用名词而非动词
   - 使用复数形式
   - 层级关系清晰

2. **HTTP方法**
   - GET: 获取资源
   - POST: 创建资源
   - PUT: 更新资源
   - DELETE: 删除资源

3. **状态码**
   - 2xx: 成功
   - 4xx: 客户端错误
   - 5xx: 服务器错误

#### API端点设计

```
# 认证相关
POST   /api/auth/login          # 用户登录
POST   /api/auth/logout         # 用户登出
GET    /api/auth/profile        # 获取用户信息
POST   /api/auth/refresh        # 刷新令牌

# 产品管理
GET    /api/products            # 获取产品列表
GET    /api/products/:id        # 获取单个产品
POST   /api/products            # 创建产品
PUT    /api/products/:id        # 更新产品
DELETE /api/products/:id        # 删除产品

# 分类管理
GET    /api/categories          # 获取分类列表
GET    /api/categories/:id      # 获取单个分类
POST   /api/categories          # 创建分类
PUT    /api/categories/:id      # 更新分类
DELETE /api/categories/:id      # 删除分类

# 订单管理
GET    /api/orders              # 获取订单列表
GET    /api/orders/:id          # 获取单个订单
POST   /api/orders              # 创建订单
PUT    /api/orders/:id          # 更新订单
DELETE /api/orders/:id          # 删除订单

# 系统接口
GET    /health                  # 健康检查
GET    /info                    # 系统信息
```

### 请求/响应格式

#### 统一响应格式

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  timestamp?: string;
}
```

#### 分页响应格式

```typescript
interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
```

### API版本控制

采用URL路径版本控制：

```
/api/v1/products    # 版本1
/api/v2/products    # 版本2
```

### 错误处理

```typescript
// 错误响应示例
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "email",
    "message": "Invalid email format"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 安全架构

### 认证机制

#### JWT令牌认证

```typescript
// JWT载荷结构
interface JWTPayload {
  userId: number;
  username: string;
  role: string;
  iat: number;  // 签发时间
  exp: number;  // 过期时间
}

// 令牌生成
const generateToken = (user: User): string => {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};
```

#### 刷新令牌机制

```typescript
// 双令牌策略
interface TokenPair {
  accessToken: string;   // 短期访问令牌 (15分钟)
  refreshToken: string;  // 长期刷新令牌 (7天)
}

// 令牌刷新逻辑
const refreshTokens = async (refreshToken: string): Promise<TokenPair> => {
  const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
  const user = await User.findById(decoded.userId);
  
  if (!user || !user.isActive) {
    throw new Error('Invalid refresh token');
  }
  
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user)
  };
};
```

### 权限控制

#### 基于角色的访问控制 (RBAC)

```typescript
// 角色定义
enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  STAFF = 'staff'
}

// 权限检查中间件
const requireRole = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }
    
    next();
  };
};

// 使用示例
router.delete('/products/:id', 
  authenticateToken,
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  productController.deleteProduct
);
```

### 数据安全

#### 密码安全

```typescript
// 密码哈希
const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// 密码验证
const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

// 密码强度验证
const validatePasswordStrength = (password: string): boolean => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  return password.length >= minLength && 
         hasUpperCase && 
         hasLowerCase && 
         hasNumbers && 
         hasSpecialChar;
};
```

#### 输入验证和清理

```typescript
// 使用express-validator进行输入验证
const productValidationRules = () => {
  return [
    body('name')
      .isLength({ min: 1, max: 200 })
      .withMessage('Product name must be 1-200 characters')
      .trim()
      .escape(),
    body('price')
      .isFloat({ min: 0 })
      .withMessage('Price must be a positive number'),
    body('categoryId')
      .isInt({ min: 1 })
      .withMessage('Category ID must be a positive integer')
  ];
};

// SQL注入防护
const safeQuery = (query: string, params: any[]) => {
  // 使用参数化查询
  return db.prepare(query).all(...params);
};
```

### 网络安全

#### HTTPS配置

```typescript
// 生产环境HTTPS配置
if (process.env.NODE_ENV === 'production') {
  const https = require('https');
  const fs = require('fs');
  
  const options = {
    key: fs.readFileSync('path/to/private-key.pem'),
    cert: fs.readFileSync('path/to/certificate.pem')
  };
  
  https.createServer(options, app).listen(443, () => {
    console.log('HTTPS Server running on port 443');
  });
}
```

#### 安全头设置

```typescript
// 使用helmet设置安全头
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

#### CORS配置

```typescript
// CORS配置
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:5173', 'http://localhost:8081'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

### 速率限制

```typescript
// API速率限制
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 最多100次请求
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  }
});

// 认证接口特殊限制
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 最多5次登录尝试
  skipSuccessfulRequests: true
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
```

## 部署架构

### 开发环境

```
┌─────────────────────────────────────────────────────────────┐
│                    开发环境架构                              │
├─────────────────────────────────────────────────────────────┤
│  开发者机器                                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │   后端服务  │ │  Web客户端  │ │    Android客户端        │ │
│  │             │ │             │ │                         │ │
│  │ Node.js     │ │ React+Vite  │ │   React Native          │ │
│  │ :3000       │ │ :5173       │ │   Metro :8081           │ │
│  │             │ │             │ │                         │ │
│  │ SQLite DB   │ │ 热重载      │ │   热重载                │ │
│  │ 文件存储    │ │ 开发工具    │ │   调试工具              │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 生产环境

```
┌─────────────────────────────────────────────────────────────┐
│                    生产环境架构                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐                                            │
│  │ 负载均衡器  │ (Nginx/Apache)                             │
│  │ SSL终止     │                                            │
│  └─────┬───────┘                                            │
│        │                                                    │
│  ┌─────┴───────────────────────────────────────────────┐   │
│  │                应用服务器                            │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐ │   │
│  │  │   API服务   │ │  Web静态文件│ │   文件存储      │ │   │
│  │  │             │ │             │ │                 │ │   │
│  │  │ Node.js     │ │ Nginx       │ │   上传文件      │ │   │
│  │  │ PM2管理     │ │ 静态资源    │ │   图片资源      │ │   │
│  │  │ 集群模式    │ │ Gzip压缩    │ │   备份文件      │ │   │
│  │  └─────────────┘ └─────────────┘ └─────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                        │                                    │
│  ┌─────────────────────┴───────────────────────────────┐   │
│  │                  数据层                              │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐ │   │
│  │  │   数据库    │ │   日志系统  │ │    监控系统     │ │   │
│  │  │             │ │             │ │                 │ │   │
│  │  │ SQLite      │ │ 应用日志    │ │   性能监控      │ │   │
│  │  │ 定期备份    │ │ 错误日志    │ │   错误追踪      │ │   │
│  │  │ 数据迁移    │ │ 访问日志    │ │   资源监控      │ │   │
│  │  └─────────────┘ └─────────────┘ └─────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Docker部署

#### Dockerfile配置

```dockerfile
# 后端服务Dockerfile
FROM node:18-alpine

WORKDIR /app

# 复制package文件
COPY package*.json ./
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# 设置权限
RUN chown -R nodejs:nodejs /app
USER nodejs

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]
```

#### Docker Compose配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  # 后端API服务
  api:
    build: ./server
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - DATABASE_URL=./database.sqlite
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Web客户端
  web:
    build: ./web-client
    ports:
      - "80:80"
    depends_on:
      - api
    restart: unless-stopped

  # Nginx反向代理
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - api
      - web
    restart: unless-stopped
```

### PM2部署配置

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'pos-api',
    script: './dist/app.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

## 性能优化

### 后端性能优化

#### 数据库优化

```typescript
// 连接池配置
const dbConfig = {
  filename: './database.sqlite',
  options: {
    verbose: process.env.NODE_ENV === 'development' ? console.log : null,
    fileMustExist: true
  }
};

// 预编译语句缓存
class QueryCache {
  private static cache = new Map<string, any>();
  
  static getStatement(sql: string) {
    if (!this.cache.has(sql)) {
      this.cache.set(sql, db.prepare(sql));
    }
    return this.cache.get(sql);
  }
}

// 批量操作优化
const batchInsertProducts = (products: Product[]) => {
  const stmt = QueryCache.getStatement(
    'INSERT INTO products (name, price, category_id) VALUES (?, ?, ?)'
  );
  
  const transaction = db.transaction((products) => {
    for (const product of products) {
      stmt.run(product.name, product.price, product.categoryId);
    }
  });
  
  return transaction(products);
};
```

#### 缓存策略

```typescript
// 内存缓存
class MemoryCache {
  private cache = new Map<string, { data: any; expires: number }>();
  
  set(key: string, data: any, ttl: number = 300000) { // 5分钟默认TTL
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl
    });
  }
  
  get(key: string) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
}

// 产品缓存示例
const productCache = new MemoryCache();

const getProducts = async () => {
  const cacheKey = 'products:all';
  let products = productCache.get(cacheKey);
  
  if (!products) {
    products = await Product.findAll();
    productCache.set(cacheKey, products, 600000); // 10分钟缓存
  }
  
  return products;
};
```

#### 响应压缩

```typescript
// Gzip压缩
const compression = require('compression');

app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024
}));
```

### 前端性能优化

#### 代码分割和懒加载

```typescript
// React路由懒加载
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Products = lazy(() => import('./pages/Products'));
const Orders = lazy(() => import('./pages/Orders'));

function App() {
  return (
    <Router>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/orders" element={<Orders />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
```

#### 虚拟滚动

```typescript
// 大列表虚拟滚动
import { FixedSizeList as List } from 'react-window';

const ProductList = ({ products }: { products: Product[] }) => {
  const Row = ({ index, style }: { index: number; style: any }) => (
    <div style={style}>
      <ProductCard product={products[index]} />
    </div>
  );

  return (
    <List
      height={600}
      itemCount={products.length}
      itemSize={120}
      width="100%"
    >
      {Row}
    </List>
  );
};
```

#### 图片优化

```typescript
// 图片懒加载组件
const LazyImage = ({ src, alt, ...props }: ImageProps) => {
  const [imageSrc, setImageSrc] = useState<string | undefined>();
  const [imageRef, isIntersecting] = useIntersectionObserver();

  useEffect(() => {
    if (isIntersecting && src) {
      setImageSrc(src);
    }
  }, [isIntersecting, src]);

  return (
    <div ref={imageRef}>
      {imageSrc ? (
        <img src={imageSrc} alt={alt} {...props} />
      ) : (
        <div className="placeholder">Loading...</div>
      )}
    </div>
  );
};
```

### 移动端性能优化

#### React Native优化

```typescript
// FlatList优化
const OptimizedProductList = ({ products }: { products: Product[] }) => {
  const renderProduct = useCallback(({ item }: { item: Product }) => (
    <ProductCard product={item} />
  ), []);

  const keyExtractor = useCallback((item: Product) => item.id.toString(), []);

  return (
    <FlatList
      data={products}
      renderItem={renderProduct}
      keyExtractor={keyExtractor}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      initialNumToRender={10}
      windowSize={10}
      getItemLayout={(data, index) => ({
        length: 120,
        offset: 120 * index,
        index,
      })}
    />
  );
};
```

#### 图片缓存

```typescript
// React Native图片缓存
import FastImage from 'react-native-fast-image';

const CachedImage = ({ uri, ...props }: ImageProps) => (
  <FastImage
    source={{
      uri,
      priority: FastImage.priority.normal,
      cache: FastImage.cacheControl.immutable
    }}
    {...props}
  />
);
```

## 扩展性设计

### 微服务架构准备

#### 服务拆分策略

```
当前单体架构 → 微服务架构迁移路径

┌─────────────────┐    ┌─────────────────┐
│   单体应用      │    │   API网关       │
│                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ 用户管理    │ │ →  │ │ 路由转发    │ │
│ │ 产品管理    │ │    │ │ 负载均衡    │ │
│ │ 订单管理    │ │    │ │ 认证授权    │ │
│ │ 支付处理    │ │    │ └─────────────┘ │
│ └─────────────┘ │    └─────────────────┘
└─────────────────┘              │
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
┌───────▼──────┐        ┌────────▼────────┐      ┌────────▼────────┐
│  用户服务    │        │   产品服务      │      │   订单服务      │
│              │        │                 │      │                 │
│ 用户认证     │        │ 产品管理        │      │ 订单处理        │
│ 权限管理     │        │ 分类管理        │      │ 状态跟踪        │
│ 用户资料     │        │ 库存管理        │      │ 支付集成        │
└──────────────┘        └─────────────────┘      └─────────────────┘
```

#### 服务接口定义

```typescript
// 用户服务接口
interface UserService {
  authenticate(email: string, password: string): Promise<AuthResult>;
  getUserProfile(userId: number): Promise<User>;
  updateUserProfile(userId: number, data: Partial<User>): Promise<User>;
  validateToken(token: string): Promise<TokenValidation>;
}

// 产品服务接口
interface ProductService {
  getProducts(filters: ProductFilters): Promise<Product[]>;
  getProduct(id: number): Promise<Product>;
  createProduct(data: CreateProductData): Promise<Product>;
  updateProduct(id: number, data: UpdateProductData): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
}

// 订单服务接口
interface OrderService {
  createOrder(data: CreateOrderData): Promise<Order>;
  getOrder(id: number): Promise<Order>;
  updateOrderStatus(id: number, status: OrderStatus): Promise<Order>;
  getOrdersByUser(userId: number): Promise<Order[]>;
}
```

### 数据库扩展

#### 分库分表策略

```sql
-- 按时间分表（订单表）
CREATE TABLE orders_2024_01 (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  -- 其他字段
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders_2024_02 (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  -- 其他字段
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 按用户ID分表（用户数据表）
CREATE TABLE user_data_0 (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  -- 其他字段
);

CREATE TABLE user_data_1 (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  -- 其他字段
);
```

#### 读写分离

```typescript
// 数据库连接管理
class DatabaseManager {
  private writeDB: Database;
  private readDBs: Database[];
  private currentReadIndex = 0;

  constructor() {
    this.writeDB = new Database('./master.sqlite');
    this.readDBs = [
      new Database('./slave1.sqlite'),
      new Database('./slave2.sqlite')
    ];
  }

  getWriteConnection(): Database {
    return this.writeDB;
  }

  getReadConnection(): Database {
    // 轮询选择读库
    const db = this.readDBs[this.currentReadIndex];
    this.currentReadIndex = (this.currentReadIndex + 1) % this.readDBs.length;
    return db;
  }
}
```

### 缓存扩展

#### Redis集成准备

```typescript
// 缓存抽象层
interface CacheProvider {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

// 内存缓存实现
class MemoryCacheProvider implements CacheProvider {
  private cache = new Map<string, { value: string; expires: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key);
    if (!item || Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ttl = 300000): Promise<void> {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl
    });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.cache.has(key) && Date.now() <= this.cache.get(key)!.expires;
  }
}

// Redis缓存实现（未来扩展）
class RedisCacheProvider implements CacheProvider {
  // Redis实现
}

// 缓存工厂
class CacheFactory {
  static create(): CacheProvider {
    if (process.env.REDIS_URL) {
      return new RedisCacheProvider();
    }
    return new MemoryCacheProvider();
  }
}
```

### 消息队列准备

```typescript
// 事件系统
interface EventBus {
  publish(event: string, data: any): Promise<void>;
  subscribe(event: string, handler: EventHandler): void;
  unsubscribe(event: string, handler: EventHandler): void;
}

// 内存事件总线
class MemoryEventBus implements EventBus {
  private handlers = new Map<string, EventHandler[]>();

  async publish(event: string, data: any): Promise<void> {
    const eventHandlers = this.handlers.get(event) || [];
    await Promise.all(eventHandlers.map(handler => handler(data)));
  }

  subscribe(event: string, handler: EventHandler): void {
    const handlers = this.handlers.get(event) || [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
  }

  unsubscribe(event: string, handler: EventHandler): void {
    const handlers = this.handlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }
}

// 事件定义
interface OrderCreatedEvent {
  orderId: number;
  userId: number;
  totalAmount: number;
  items: OrderItem[];
}

// 事件处理器
const handleOrderCreated = async (event: OrderCreatedEvent) => {
  // 发送通知
  await NotificationService.sendOrderConfirmation(event.userId, event.orderId);
  
  // 更新库存
  await InventoryService.updateStock(event.items);
  
  // 记录分析数据
  await AnalyticsService.recordSale(event);
};

// 注册事件处理器
eventBus.subscribe('order.created', handleOrderCreated);
```

### 监控和日志扩展

```typescript
// 监控指标收集
class MetricsCollector {
  private metrics = new Map<string, number>();

  increment(metric: string, value = 1): void {
    const current = this.metrics.get(metric) || 0;
    this.metrics.set(metric, current + value);
  }

  gauge(metric: string, value: number): void {
    this.metrics.set(metric, value);
  }

  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  reset(): void {
    this.metrics.clear();
  }
}

// 性能监控中间件
const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const route = req.route?.path || req.path;
    const method = req.method;
    const status = res.statusCode;
    
    // 记录响应时间
    metricsCollector.gauge(`http.request.duration.${method}.${route}`, duration);
    
    // 记录请求计数
    metricsCollector.increment(`http.request.count.${method}.${status}`);
    
    // 记录错误率
    if (status >= 400) {
      metricsCollector.increment('http.request.errors');
    }
  });
  
  next();
};

// 健康检查端点
app.get('/metrics', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    metrics: metricsCollector.getMetrics()
  });
});
```

### API网关准备

```typescript
// API网关配置
interface GatewayConfig {
  routes: RouteConfig[];
  rateLimit: RateLimitConfig;
  auth: AuthConfig;
  cors: CorsConfig;
}

interface RouteConfig {
  path: string;
  method: string;
  target: string;
  auth?: boolean;
  rateLimit?: RateLimitConfig;
}

// 简单网关实现
class ApiGateway {
  private config: GatewayConfig;
  
  constructor(config: GatewayConfig) {
    this.config = config;
  }
  
  async handleRequest(req: Request, res: Response): Promise<void> {
    const route = this.findRoute(req.path, req.method);
    
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }
    
    // 认证检查
    if (route.auth && !await this.authenticate(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // 速率限制
    if (!await this.checkRateLimit(req, route)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    
    // 转发请求
    await this.forwardRequest(req, res, route.target);
  }
  
  private findRoute(path: string, method: string): RouteConfig | null {
    return this.config.routes.find(route => 
      route.path === path && route.method === method
    ) || null;
  }
}
```

## 总结

### 架构优势

1. **模块化设计**: 清晰的模块边界，便于维护和扩展
2. **技术栈统一**: 全栈TypeScript，降低学习成本
3. **多端支持**: Web和移动端统一的数据模型和API
4. **离线能力**: Android端完整的离线支持
5. **安全可靠**: 完善的认证授权和数据保护机制
6. **性能优化**: 多层次的缓存和优化策略
7. **扩展性强**: 为微服务架构做好准备

### 技术债务管理

1. **代码质量**: 持续的代码审查和重构
2. **测试覆盖**: 完善的单元测试和集成测试
3. **文档维护**: 及时更新技术文档和API文档
4. **依赖管理**: 定期更新依赖包，修复安全漏洞
5. **性能监控**: 持续的性能监控和优化

### 未来发展方向

1. **微服务化**: 逐步拆分为独立的微服务
2. **云原生**: 容器化部署和云平台集成
3. **大数据**: 数据分析和商业智能功能
4. **AI集成**: 智能推荐和预测分析
5. **IoT支持**: 物联网设备集成
6. **区块链**: 供应链追溯和支付创新

---

**文档版本**: 1.0.0  
**最后更新**: 2024年1月  
**维护团队**: POS架构团队

本文档将随着系统的发展持续更新，确保架构设计与实际实现保持一致。
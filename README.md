# 调度中心数据中台：Vercel + Supabase

这个项目用于把网页发布到公网，并接收其他系统提交的数据。

## 已实现

- Vercel 静态网页：别人打开链接即可查看页面
- Vercel API：`/api/records` 接收外部系统数据
- Supabase 数据库：保存数据台账
- 网页表单提交
- CSV 批量导入
- 数据搜索、筛选、导出 CSV
- 本地演示模式：没有配置 Supabase 时，页面自动使用浏览器 localStorage

## 目录

```text
vercel-supabase-data-center/
  index.html
  assets/
    app.js
    styles.css
  api/
    records.js
    health.js
  supabase/
    schema.sql
  sample-data.csv
  vercel.json
```

## 第一步：创建 Supabase 数据表

1. 打开 Supabase，新建一个 Project。
2. 进入 SQL Editor。
3. 复制 `supabase/schema.sql` 的全部内容并运行。
4. 进入 Project Settings -> API，复制：
   - Project URL
   - anon public key

当前 SQL 使用公开 `select` 和 `insert` 策略，适合演示和公开数据收集。正式业务如果涉及隐私，应改成登录后访问或服务端鉴权。

## 第二步：部署到 Vercel

1. 把 `vercel-supabase-data-center` 上传到 GitHub 仓库。
2. 在 Vercel 中选择 Import Project。
3. Framework Preset 选择 Other。
4. 设置环境变量：

```text
SUPABASE_URL=你的 Supabase Project URL
SUPABASE_ANON_KEY=你的 Supabase anon public key
SUPABASE_TABLE=dispatch_records
ALLOWED_ORIGIN=*
INGEST_API_KEY=可选，给外部系统 POST 数据用的密钥
```

5. 点击 Deploy。

部署完成后，Vercel 会给你一个公网链接，例如：

```text
https://你的项目名.vercel.app
```

## 第三步：外部系统如何接入

其他系统用 HTTP POST 把 JSON 提交到：

```http
POST https://你的项目名.vercel.app/api/records
Content-Type: application/json
X-API-Key: 如果设置了 INGEST_API_KEY，就填写这个密钥
```

示例：

```json
{
  "source_system": "高空视频系统",
  "event_type": "视频AI告警",
  "title": "疑似烟雾异常告警",
  "description": "高空视频识别到疑似烟雾",
  "location": "高空视频点位 A-013",
  "region": "锦江区",
  "severity": "较重",
  "status": "待处理"
}
```

也可以一次提交多条：

```json
[
  {
    "source_system": "高空视频系统",
    "event_type": "视频AI告警",
    "title": "疑似烟雾异常告警"
  },
  {
    "source_system": "排口监控系统",
    "event_type": "排口浓度异常",
    "title": "总磷指标短时波动"
  }
]
```

## 查询接口

```http
GET https://你的项目名.vercel.app/api/records?limit=200
GET https://你的项目名.vercel.app/api/records?q=烟雾
GET https://你的项目名.vercel.app/api/records?source_system=高空视频系统
```

## 本地预览

静态页面可以直接打开：

```text
index.html
```

也可以启动本地静态服务：

```powershell
py -3.12 -m http.server 8790
```

然后访问：

```text
http://127.0.0.1:8790/
```

本地没有 Vercel API 和 Supabase 环境变量时，页面会自动使用本地演示数据。

## 证据中台升级

当前页面已经升级为“问题线索 + 图片/视频证据中台”：

- 页面入口脚本：`assets/evidence_app.js`
- 外部系统仍然提交到：`/api/records`
- 支持字段：`image_urls`、`video_urls`、`review_status`、`dispatch_status`
- 图片和视频证据会先存入 `dispatch_records.payload`
- 可选独立证据表：`supabase/evidence_schema.sql`
- 详细对接说明：`docs/evidence_integration.md`

这个设计不会破坏你已经创建好的 `dispatch_records` 表；先可以用于演示和初步对接。正式运行时，建议再增加文件存储、登录权限和人工审核后推送统一调度平台的接口。

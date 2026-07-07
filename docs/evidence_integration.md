# 调度中心证据中台接入说明

这个版本把原来的“数据中台”升级为“问题线索 + 图片/视频证据中台”。适合你现在收集到的情况：很多系统不是只给结构化字段，而是通过视频巡屏、截图、照片作为证据，再推给统一调度平台。

## 当前已经支持

- 10 个来源系统下拉选择
- 单条线索手工录入
- CSV 批量导入
- 外部系统通过 HTTP API 推送
- 图片/截图 URL 展示为证据缩略图
- 视频 URL 展示为证据链接
- 人工审核状态：待人工审核、审核通过、退回线索、无需派发
- 线索导出 CSV

## 外部系统提交地址

```http
POST https://diaodu-project.vercel.app/api/records
Content-Type: application/json
```

如果你在 Vercel 环境变量里设置了 `INGEST_API_KEY`，需要额外加：

```http
X-API-Key: 你的接入密钥
```

## 推荐 JSON 字段

```json
{
  "source_system": "四川省高空视频智能监控监管系统",
  "event_type": "视频识别线索",
  "title": "疑似烟雾异常线索",
  "description": "高空视频识别到疑似烟雾异常，请调度中心人工审核。",
  "location": "高空视频点位 A-013",
  "region": "锦江区",
  "severity": "较重",
  "review_status": "待人工审核",
  "image_urls": [
    "https://example.com/evidence/snapshot-1.jpg"
  ],
  "video_urls": [
    "https://example.com/evidence/clip-1.mp4"
  ]
}
```

## CSV 字段

最少可以只给这些列：

```csv
source_system,event_type,title,description,location,region,severity,review_status,image_urls,video_urls
```

多张图片或多个视频用英文竖线分隔：

```csv
视频融合赋能平台,视频巡屏线索,疑似露天焚烧,发现疑似烟雾,天网点位01,武侯区,较重,待人工审核,https://.../a.jpg|https://.../b.jpg,https://.../clip.mp4
```

## 数据中台后续建议

现在先把截图和视频链接存进 `dispatch_records.payload`，不需要改你已经建好的 Supabase 主表。

如果后面要正式长期运行，建议再做三项升级：

1. 运行 `supabase/evidence_schema.sql`，把每张图片、每段视频单独成表管理。
2. 给图片和视频加 Supabase Storage、阿里云 OSS 或腾讯云 COS 存储，不要只依赖第三方临时链接。
3. 增加“人工审核后推送统一调度平台”的接口，避免未经确认的 AI 视频识别结果直接派发。

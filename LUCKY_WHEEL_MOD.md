# 幸运大转盘 + 优惠券（Lucky Wheel & Coupons）

本项目基于 [QuantumNous/new-api](https://github.com/QuantumNous/new-api) 修改，
新增「幸运大转盘」抽奖与「充值优惠券」功能。

## 许可证

本项目遵循 **GNU Affero General Public License v3.0 (AGPL-3.0)**，
与上游 New API 一致。完整许可证见 [LICENSE](./LICENSE)。

由于本项目作为网络服务对外提供，依据 AGPL-3.0 第 13 条，
我方提供修改后的完整源代码，使用者可自由获取、修改、再分发。

## 新增功能

1. **幸运大转盘**：用户每日签到式抽奖，按权重随机中奖
   - 奖品类型：额度 / 优惠券 / 谢谢参与
   - 每日次数、奖品、概率均由管理员在后台配置
2. **优惠券系统**：折扣券（如 9 折）/ 满减券（如满 100 减 10），支持有效期
3. **充值用券**：用户充值时可选一张优惠券抵扣实付金额（到账额度不变）
   - 每笔订单限用一张，禁止叠加
   - 下单预锁定，支付成功核销；超时 30 分钟未支付自动退回

## 新增/修改文件

### 后端（Go）
- 新增 `model/lucky_wheel.go`、`model/lucky_wheel_draw.go`
- 新增 `controller/lucky_wheel.go`、`controller/lucky_wheel_coupon.go`
- 新增 `setting/operation_setting/lucky_wheel_setting.go`
- 修改 `model/main.go`（注册数据表迁移）
- 修改 `model/topup.go`（充值用券核销）
- 修改 `controller/topup.go`（充值算价支持券）
- 修改 `router/api-router.go`（新增路由）
- 修改 `main.go`（超时券释放后台任务）

### 前端（React/TypeScript）
- 新增 `web/src/features/lucky-wheel/`（转盘页面、管理页、SVG 转盘组件等）
- 新增 `web/src/features/system-settings/general/lucky-wheel-settings-section.tsx`
- 新增 `web/src/routes/_authenticated/lucky-wheel/`（路由）
- 修改钱包充值弹窗、系统设置、侧边栏、i18n 等

## 数据库

新增三张表：`lucky_wheel_prizes`、`lucky_wheel_draws`、`user_coupons`
（由 GORM AutoMigrate 自动创建）。

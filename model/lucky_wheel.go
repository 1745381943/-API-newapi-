package model

import (
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ============================================================================
// 大转盘 Lucky Wheel
// ============================================================================

// LuckyWheelPrize 转盘奖品配置
type LuckyWheelPrize struct {
	Id              int     `json:"id" gorm:"primaryKey;autoIncrement"`
	Name            string  `json:"name" gorm:"type:varchar(191);not null"`         // 奖品名称（显示用）
	PrizeType       string  `json:"prize_type" gorm:"type:varchar(20);not null"`    // quota | coupon | none
	Quota           int     `json:"quota" gorm:"default:0"`                         // 实际发放的内部额度（由 quota_amount 换算）
	QuotaAmount     float64 `json:"quota_amount" gorm:"default:0"`                  // 管理员配置的额度金额（元），冗余保存便于回显
	CouponType      string  `json:"coupon_type" gorm:"type:varchar(20);default:''"` // discount | threshold
	CouponValue     float64 `json:"coupon_value" gorm:"default:0"`                  // 折扣率(0.9) 或 满减额(元)
	CouponMinAmount float64 `json:"coupon_min_amount" gorm:"default:0"`             // 满减门槛(元)，0=不限
	CouponValidDays int     `json:"coupon_valid_days" gorm:"default:0"`             // 券有效期天数，0=永久
	Weight          int     `json:"weight" gorm:"default:0"`                        // 权重（概率权重，0=不参与）
	Enabled         bool    `json:"enabled" gorm:"default:true"`                    // 是否启用
	SortOrder       int     `json:"sort_order" gorm:"default:0"`                    // 展示顺序
	CreatedAt       int64   `json:"created_at" gorm:"bigint"`
	UpdatedAt       int64   `json:"updated_at" gorm:"bigint"`
}

func (LuckyWheelPrize) TableName() string {
	return "lucky_wheel_prizes"
}

// LuckyWheelDraw 抽奖记录
type LuckyWheelDraw struct {
	Id           int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId       int    `json:"user_id" gorm:"not null;index"`
	PrizeId      int    `json:"prize_id" gorm:"not null;index"`
	PrizeName    string `json:"prize_name" gorm:"type:varchar(191)"`
	PrizeType    string `json:"prize_type" gorm:"type:varchar(20)"`
	QuotaAwarded int    `json:"quota_awarded" gorm:"default:0"`
	CouponId     int    `json:"coupon_id" gorm:"default:0"`              // 若发券，关联的 user_coupons.id
	DrawDate     string `json:"draw_date" gorm:"type:varchar(10);index"` // YYYY-MM-DD
	CreatedAt    int64  `json:"created_at" gorm:"bigint"`
}

func (LuckyWheelDraw) TableName() string {
	return "lucky_wheel_draws"
}

// CountUserDrawsOnDate 统计用户某日抽奖次数
func CountUserDrawsOnDate(userId int, date string) (int64, error) {
	var count int64
	err := DB.Model(&LuckyWheelDraw{}).
		Where("user_id = ? AND draw_date = ?", userId, date).
		Count(&count).Error
	return count, err
}

// GetEnabledPrizes 获取所有启用的奖品（按权重抽奖用）
func GetEnabledPrizes() ([]LuckyWheelPrize, error) {
	var prizes []LuckyWheelPrize
	err := DB.Where("enabled = ? AND weight > 0", true).
		Order("sort_order ASC, id ASC").Find(&prizes).Error
	return prizes, err
}

// GetAllPrizes 获取所有奖品（管理端）
func GetAllPrizes() ([]LuckyWheelPrize, error) {
	var prizes []LuckyWheelPrize
	err := DB.Order("sort_order ASC, id ASC").Find(&prizes).Error
	return prizes, err
}

// CreatePrize 创建奖品
func CreatePrize(prize *LuckyWheelPrize) error {
	now := time.Now().Unix()
	prize.CreatedAt = now
	prize.UpdatedAt = now
	return DB.Create(prize).Error
}

// UpdatePrize 更新奖品
func UpdatePrize(prize *LuckyWheelPrize) error {
	prize.UpdatedAt = time.Now().Unix()
	return DB.Model(&LuckyWheelPrize{}).Where("id = ?", prize.Id).Updates(map[string]any{
		"name":              prize.Name,
		"prize_type":        prize.PrizeType,
		"quota":             prize.Quota,
		"quota_amount":      prize.QuotaAmount,
		"coupon_type":       prize.CouponType,
		"coupon_value":      prize.CouponValue,
		"coupon_min_amount": prize.CouponMinAmount,
		"coupon_valid_days": prize.CouponValidDays,
		"weight":            prize.Weight,
		"enabled":           prize.Enabled,
		"sort_order":        prize.SortOrder,
		"updated_at":        prize.UpdatedAt,
	}).Error
}

// DeletePrize 删除奖品
func DeletePrize(id int) error {
	return DB.Delete(&LuckyWheelPrize{}, id).Error
}

// ============================================================================
// 优惠券 User Coupon
// ============================================================================

const (
	CouponTypeDiscount  = "discount"  // 折扣券：实付 = 原价 * value
	CouponTypeThreshold = "threshold" // 满减券：满 min_amount 减 value
)

const (
	CouponStatusUnused  = "unused"
	CouponStatusPending = "pending" // 已下单锁定，未完成支付
	CouponStatusUsed    = "used"
	CouponStatusExpired = "expired"
)

// UserCoupon 用户持有的优惠券
type UserCoupon struct {
	Id          int     `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId      int     `json:"user_id" gorm:"not null;index"`
	CouponType  string  `json:"coupon_type" gorm:"type:varchar(20);not null"` // discount | threshold
	Value       float64 `json:"value" gorm:"not null"`                        // 折扣率(0.9) 或 满减额(元)
	MinAmount   float64 `json:"min_amount" gorm:"default:0"`                  // 满减门槛(元)，0=不限
	Title       string  `json:"title" gorm:"type:varchar(191)"`               // 展示名，如"9折券""满100减10"
	Source      string  `json:"source" gorm:"type:varchar(50);default:''"`    // 来源：lucky_wheel 等
	Status      string  `json:"status" gorm:"type:varchar(20);default:'unused';index"`
	ExpireAt    int64   `json:"expire_at" gorm:"bigint;default:0"` // 过期时间戳，0=永久
	UsedAt      int64   `json:"used_at" gorm:"bigint;default:0"`
	UsedTradeNo string  `json:"used_trade_no" gorm:"type:varchar(255);default:''"` // 核销时的充值单号
	CreatedAt   int64   `json:"created_at" gorm:"bigint"`
}

func (UserCoupon) TableName() string {
	return "user_coupons"
}

// CreateCoupon 创建优惠券
func CreateCoupon(coupon *UserCoupon) error {
	coupon.CreatedAt = time.Now().Unix()
	if coupon.Status == "" {
		coupon.Status = CouponStatusUnused
	}
	return DB.Create(coupon).Error
}

// GetUserCoupons 获取用户的有效优惠券（未使用且未过期）
func GetUserCoupons(userId int) ([]UserCoupon, error) {
	var coupons []UserCoupon
	now := time.Now().Unix()
	err := DB.Where("user_id = ? AND status = ? AND (expire_at = 0 OR expire_at > ?)",
		userId, CouponStatusUnused, now).
		Order("expire_at ASC, id ASC").Find(&coupons).Error
	return coupons, err
}

// GetUserCouponById 获取用户指定优惠券
func GetUserCouponById(userId, couponId int) (*UserCoupon, error) {
	coupon := &UserCoupon{}
	err := DB.Where("id = ? AND user_id = ?", couponId, userId).First(coupon).Error
	if err != nil {
		return nil, err
	}
	return coupon, nil
}

// ExpireOldCoupons 将已过期但仍标记未使用的券置为过期（可定时调用，也可读取时惰性判断）
func ExpireOldCoupons() error {
	now := time.Now().Unix()
	return DB.Model(&UserCoupon{}).
		Where("status = ? AND expire_at > 0 AND expire_at <= ?", CouponStatusUnused, now).
		Update("status", CouponStatusExpired).Error
}

// ErrCouponNotFound 券不存在
var ErrCouponNotFound = errors.New("优惠券不存在")

// ErrCouponUsed 券已使用
var ErrCouponUsed = errors.New("优惠券已使用")

// ErrCouponExpired 券已过期
var ErrCouponExpired = errors.New("优惠券已过期")

// MarkCouponPending 下单时将券预锁定（置为 pending），防止并发重复下单使用同一张券。
// 若券已被锁定/使用/过期则报错。
func MarkCouponPending(userId, couponId int) error {
	if couponId <= 0 {
		return nil
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		coupon := &UserCoupon{}
		if err := lockForUpdate(tx).Where("id = ? AND user_id = ?", couponId, userId).First(coupon).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrCouponNotFound
			}
			return err
		}
		if coupon.Status == CouponStatusUsed {
			return ErrCouponUsed
		}
		if coupon.Status == CouponStatusExpired {
			return ErrCouponExpired
		}
		if coupon.Status == CouponStatusPending {
			return ErrCouponNotFound
		}
		if coupon.ExpireAt > 0 && coupon.ExpireAt <= time.Now().Unix() {
			return ErrCouponExpired
		}
		coupon.Status = CouponStatusPending
		// used_at 兼作预锁定时间，便于超时释放
		coupon.UsedAt = time.Now().Unix()
		return tx.Save(coupon).Error
	})
}

// ErrCouponMinAmount 未满足满减门槛
var ErrCouponMinAmount = errors.New("未达到优惠券使用门槛")

// ReleaseCoupon 释放预锁定的券（订单未支付/失效时退还给用户）
func ReleaseCoupon(userId, couponId int, tradeNo string) error {
	if couponId <= 0 {
		return nil
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		coupon := &UserCoupon{}
		if err := lockForUpdate(tx).Where("id = ? AND user_id = ?", couponId, userId).First(coupon).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil // 券不存在，视为已处理
			}
			return err
		}
		// 仅释放仍处于 pending 且属于该订单的券
		if coupon.Status != CouponStatusPending {
			return nil
		}
		if tradeNo != "" && coupon.UsedTradeNo != "" && coupon.UsedTradeNo != tradeNo {
			return nil
		}
		coupon.Status = CouponStatusUnused
		coupon.UsedTradeNo = ""
		return tx.Save(coupon).Error
	})
}

// ReleaseExpiredPendingCoupons 释放超时未支付的预锁定券（后台任务调用）
// pendingGraceSeconds: 预锁定后经过该秒数仍未支付则释放
func ReleaseExpiredPendingCoupons(pendingGraceSeconds int64) (int64, error) {
	if pendingGraceSeconds <= 0 {
		pendingGraceSeconds = 1800 // 默认 30 分钟
	}
	cutoff := time.Now().Unix() - pendingGraceSeconds
	res := DB.Model(&UserCoupon{}).
		Where("status = ? AND used_at > 0 AND used_at <= ?", CouponStatusPending, cutoff).
		Updates(map[string]any{"status": CouponStatusUnused, "used_trade_no": ""})
	return res.RowsAffected, res.Error
}

// ConsumeCouponTx 在事务内核销优惠券（行锁 + 状态校验），并返回券信息
func consumeCouponTx(tx *gorm.DB, userId, couponId int, tradeNo string) (*UserCoupon, error) {
	coupon := &UserCoupon{}
	err := lockForUpdate(tx).Where("id = ? AND user_id = ?", couponId, userId).First(coupon).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCouponNotFound
		}
		return nil, err
	}
	if coupon.Status == CouponStatusUsed {
		return nil, ErrCouponUsed
	}
	if coupon.Status == CouponStatusExpired {
		return nil, ErrCouponExpired
	}
	if coupon.ExpireAt > 0 && coupon.ExpireAt <= time.Now().Unix() {
		return nil, ErrCouponExpired
	}
	coupon.Status = CouponStatusUsed
	coupon.UsedAt = time.Now().Unix()
	coupon.UsedTradeNo = tradeNo
	if err := tx.Save(coupon).Error; err != nil {
		return nil, err
	}
	return coupon, nil
}

// lockForUpdate 已在 topup.go 中定义，这里复用（同 package）

// CalculateCouponDiscount 计算优惠后的实付金额（元）
// originalMoney: 原实付金额（元）
// 返回：折后金额、是否可用、错误
func CalculateCouponDiscount(coupon *UserCoupon, originalMoney float64) (float64, error) {
	if coupon == nil {
		return originalMoney, nil
	}
	switch coupon.CouponType {
	case CouponTypeDiscount:
		// 折扣券：value 为折扣率，如 0.9 表示 9 折
		if coupon.Value <= 0 || coupon.Value >= 1 {
			return originalMoney, errors.New("折扣券配置无效")
		}
		return roundMoney(originalMoney * coupon.Value), nil
	case CouponTypeThreshold:
		// 满减券：需满足门槛，减固定额
		if coupon.MinAmount > 0 && originalMoney < coupon.MinAmount {
			return originalMoney, ErrCouponMinAmount
		}
		result := originalMoney - coupon.Value
		if result < 0.01 {
			result = 0.01
		}
		return roundMoney(result), nil
	default:
		return originalMoney, errors.New("未知优惠券类型")
	}
}

func roundMoney(v float64) float64 {
	return float64(int64(v*100+0.5)) / 100
}

// 保证 clause 包被引用（lockForUpdate 可能在其他文件用 clause）
var _ = clause.Locking{}

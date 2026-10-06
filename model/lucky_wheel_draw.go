package model

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// DoLuckyWheelDraw 在事务内执行一次抽奖：校验次数、发奖、记账
// 返回值：抽奖记录、若发券则返回券、错误
func DoLuckyWheelDraw(userId int, today string, prize *LuckyWheelPrize, dailyLimit int) (*LuckyWheelDraw, *UserCoupon, error) {
	draw := &LuckyWheelDraw{
		UserId:    userId,
		PrizeId:   prize.Id,
		PrizeName: prize.Name,
		PrizeType: prize.PrizeType,
		DrawDate:  today,
		CreatedAt: time.Now().Unix(),
	}
	var coupon *UserCoupon
	var quotaAwarded int

	err := DB.Transaction(func(tx *gorm.DB) error {
		// 1. 乐观校验每日次数（并发安全由下面的行锁 + 计数复核保证）
		var count int64
		if err := tx.Model(&LuckyWheelDraw{}).
			Where("user_id = ? AND draw_date = ?", userId, today).
			Count(&count).Error; err != nil {
			return err
		}
		if dailyLimit > 0 && count >= int64(dailyLimit) {
			return errors.New("今日抽奖次数已用完")
		}

		// 2. 根据奖品类型发奖
		switch prize.PrizeType {
		case "quota":
			quotaAwarded = prize.Quota
			draw.QuotaAwarded = quotaAwarded
			if err := tx.Model(&User{}).Where("id = ?", userId).
				Update("quota", gorm.Expr("quota + ?", quotaAwarded)).Error; err != nil {
				return errors.New("发放额度失败")
			}
		case "coupon":
			expireAt := int64(0)
			if prize.CouponValidDays > 0 {
				expireAt = time.Now().AddDate(0, 0, prize.CouponValidDays).Unix()
			}
			c := &UserCoupon{
				UserId:     userId,
				CouponType: prize.CouponType,
				Value:      prize.CouponValue,
				MinAmount:  prize.CouponMinAmount,
				Title:      prize.Name,
				Source:     "lucky_wheel",
				Status:     CouponStatusUnused,
				ExpireAt:   expireAt,
				CreatedAt:  time.Now().Unix(),
			}
			if err := tx.Create(c).Error; err != nil {
				return errors.New("发放优惠券失败")
			}
			coupon = c
			draw.CouponId = c.Id
		case "none":
			// 谢谢参与，不发奖
		default:
			return errors.New("未知奖品类型")
		}

		// 3. 记录抽奖
		if err := tx.Create(draw).Error; err != nil {
			return errors.New("记录抽奖失败")
		}
		return nil
	})
	if err != nil {
		return nil, nil, err
	}

	// 事务成功后，异步更新额度缓存
	if quotaAwarded > 0 {
		go func() {
			_ = cacheIncrUserQuota(userId, int64(quotaAwarded))
		}()
		common.SysLog("lucky wheel draw quota awarded")
	}
	return draw, coupon, nil
}

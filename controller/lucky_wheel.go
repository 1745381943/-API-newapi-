package controller

import (
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// 用户侧：大转盘
// ============================================================================

// GetLuckyWheelStatus 获取转盘状态（奖品列表 + 剩余次数 + 我的券）
func GetLuckyWheelStatus(c *gin.Context) {
	setting := operation_setting.GetLuckyWheelSetting()
	userId := c.GetInt("id")

	// 未启用时也返回一个合法对象（enabled=false），避免前端卡片报错
	if !setting.Enabled {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"enabled":     false,
				"daily_limit": setting.DailyLimit,
				"draws_today": 0,
				"remaining":   0,
				"prizes":      []any{},
				"coupons":     []any{},
			},
		})
		return
	}

	today := time.Now().Format("2006-01-02")

	drawsToday, err := model.CountUserDrawsOnDate(userId, today)
	if err != nil {
		common.ApiErrorMsg(c, "获取抽奖次数失败")
		return
	}
	remaining := setting.DailyLimit - int(drawsToday)
	if remaining < 0 {
		remaining = 0
	}

	prizes, err := model.GetEnabledPrizes()
	if err != nil {
		common.ApiErrorMsg(c, "获取奖品失败")
		return
	}
	// 展示用：不暴露权重
	type prizeView struct {
		Id   int    `json:"id"`
		Name string `json:"name"`
		Type string `json:"type"`
	}
	views := make([]prizeView, 0, len(prizes)+1)
	for _, p := range prizes {
		views = append(views, prizeView{Id: p.Id, Name: p.Name, Type: p.PrizeType})
	}

	coupons, _ := model.GetUserCoupons(userId)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"enabled":        setting.Enabled,
			"daily_limit":    setting.DailyLimit,
			"draws_today":    drawsToday,
			"remaining":      remaining,
			"prizes":         views,
			"coupons":        coupons,
			"quota_per_unit": common.QuotaPerUnit,
		},
	})
}

// DoLuckyWheelDraw 执行抽奖
func DoLuckyWheelDraw(c *gin.Context) {
	setting := operation_setting.GetLuckyWheelSetting()
	if !setting.Enabled {
		common.ApiErrorMsg(c, "大转盘功能未启用")
		return
	}
	userId := c.GetInt("id")
	today := time.Now().Format("2006-01-02")

	prizes, err := model.GetEnabledPrizes()
	if err != nil || len(prizes) == 0 {
		common.ApiErrorMsg(c, "奖品未配置")
		return
	}

	// 按权重抽奖
	prize := pickPrizeByWeight(prizes)
	if prize == nil {
		common.ApiErrorMsg(c, "抽奖失败")
		return
	}

	draw, coupon, err := model.DoLuckyWheelDraw(userId, today, prize, setting.DailyLimit)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	msg := fmt.Sprintf("大转盘抽奖，获得 %s", prize.Name)
	if prize.PrizeType == model.CouponTypeDiscount || prize.PrizeType == "coupon" {
		msg = fmt.Sprintf("大转盘抽奖，获得优惠券 %s", prize.Name)
	} else if prize.PrizeType == "quota" {
		msg = fmt.Sprintf("大转盘抽奖，获得额度 %s", logger.LogQuota(prize.Quota))
	}
	model.RecordLog(userId, model.LogTypeSystem, msg)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "抽奖成功",
		"data": gin.H{
			"prize_id":      prize.Id,
			"prize_name":    prize.Name,
			"prize_type":    prize.PrizeType,
			"quota_awarded": draw.QuotaAwarded,
			"coupon":        coupon,
		},
	})
}

// pickPrizeByWeight 按权重随机抽取奖品
func pickPrizeByWeight(prizes []model.LuckyWheelPrize) *model.LuckyWheelPrize {
	total := 0
	for i := range prizes {
		if prizes[i].Weight > 0 {
			total += prizes[i].Weight
		}
	}
	if total <= 0 {
		return nil
	}
	r := rand.Intn(total)
	acc := 0
	for i := range prizes {
		if prizes[i].Weight <= 0 {
			continue
		}
		acc += prizes[i].Weight
		if r < acc {
			return &prizes[i]
		}
	}
	return nil
}

// ============================================================================
// 用户侧：优惠券
// ============================================================================

// GetUserCoupons 获取我的优惠券列表
func GetUserCoupons(c *gin.Context) {
	userId := c.GetInt("id")
	coupons, err := model.GetUserCoupons(userId)
	if err != nil {
		common.ApiErrorMsg(c, "获取优惠券失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": coupons})
}

// ============================================================================
// 管理端：奖品配置
// ============================================================================

// GetLuckyWheelPrizes 管理端获取全部奖品
func GetLuckyWheelPrizes(c *gin.Context) {
	prizes, err := model.GetAllPrizes()
	if err != nil {
		common.ApiErrorMsg(c, "获取奖品失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": prizes})
}

// CreateLuckyWheelPrize 管理端创建奖品
func CreateLuckyWheelPrize(c *gin.Context) {
	var prize model.LuckyWheelPrize
	if err := c.ShouldBindJSON(&prize); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if err := validatePrize(&prize); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	prize.Id = 0
	if err := model.CreatePrize(&prize); err != nil {
		common.ApiErrorMsg(c, "创建失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": prize})
}

// UpdateLuckyWheelPrize 管理端更新奖品
func UpdateLuckyWheelPrize(c *gin.Context) {
	var prize model.LuckyWheelPrize
	if err := c.ShouldBindJSON(&prize); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if prize.Id <= 0 {
		common.ApiErrorMsg(c, "缺少奖品 ID")
		return
	}
	if err := validatePrize(&prize); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	if err := model.UpdatePrize(&prize); err != nil {
		common.ApiErrorMsg(c, "更新失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": prize})
}

// DeleteLuckyWheelPrize 管理端删除奖品
func DeleteLuckyWheelPrize(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if err := model.DeletePrize(id); err != nil {
		common.ApiErrorMsg(c, "删除失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// amountToQuota 将展示货币金额（元）换算为内部额度
// quota = (金额 / 汇率) * QuotaPerUnit
func amountToQuota(amount float64) (int, error) {
	if amount <= 0 {
		return 0, errors.New("金额必须大于 0")
	}
	rate := operation_setting.GetUsdToCurrencyRate(operation_setting.USDExchangeRate)
	if rate <= 0 {
		rate = 1
	}
	usd := amount / rate
	quota := usd * common.QuotaPerUnit
	if quota <= 0 {
		return 0, errors.New("额度换算结果无效")
	}
	return int(quota + 0.5), nil
}

func validatePrize(p *model.LuckyWheelPrize) error {
	if p.Name == "" {
		return errors.New("奖品名称不能为空")
	}
	switch p.PrizeType {
	case "quota":
		// 管理员按金额（元）配置，这里换算为内部额度；允许小数金额
		if p.QuotaAmount <= 0 {
			return errors.New("额度金额必须大于 0")
		}
		quota, err := amountToQuota(p.QuotaAmount)
		if err != nil || quota <= 0 {
			return errors.New("额度金额无效")
		}
		p.Quota = quota
	case "coupon":
		if p.CouponType != model.CouponTypeDiscount && p.CouponType != model.CouponTypeThreshold {
			return errors.New("优惠券类型必须是 discount 或 threshold")
		}
		if p.CouponType == model.CouponTypeDiscount {
			if p.CouponValue <= 0 || p.CouponValue >= 1 {
				return errors.New("折扣券的折扣率必须在 0~1 之间（如 0.9 表示 9 折）")
			}
		} else {
			if p.CouponValue <= 0 {
				return errors.New("满减券的减免额必须大于 0")
			}
		}
	case "none":
		// 谢谢参与
	default:
		return errors.New("奖品类型必须是 quota / coupon / none")
	}
	if p.Weight < 0 {
		return errors.New("权重不能为负")
	}
	return nil
}

package controller

// 本文件包含大转盘优惠券在充值流程中的集成逻辑。
// EpayRequest / AmountRequest 增加 CouponId 字段（见 topup.go 的结构体定义）。
// 规则：
//   - 到账额度不变（Amount 决定），仅降低实付金额（Money）
//   - 每笔充值最多用一张券，禁止叠加
//   - 券在支付成功回调核销（事务内行锁）

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// mapCouponErr 将券错误转成中文提示
func mapCouponErr(err error) string {
	switch {
	case errors.Is(err, model.ErrCouponNotFound):
		return "优惠券不存在"
	case errors.Is(err, model.ErrCouponUsed):
		return "优惠券已使用"
	case errors.Is(err, model.ErrCouponExpired):
		return "优惠券已过期"
	case errors.Is(err, model.ErrCouponMinAmount):
		return "未达到优惠券使用门槛"
	default:
		return "优惠券不可用"
	}
}

// GetCouponDiscountedAmount 前端在充值页选择券后调用，返回折后实付金额
func GetCouponDiscountedAmount(c *gin.Context) {
	var req AmountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.Amount < getMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值数量无效"})
		return
	}
	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	original := getPayMoney(req.Amount, group)

	payMoney := original
	if req.CouponId > 0 {
		coupon, err := model.GetUserCouponById(id, req.CouponId)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": mapCouponErr(model.ErrCouponNotFound)})
			return
		}
		if coupon.Status != model.CouponStatusUnused || (coupon.ExpireAt > 0 && coupon.ExpireAt <= time.Now().Unix()) {
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": "优惠券不可用"})
			return
		}
		payMoney, err = model.CalculateCouponDiscount(coupon, original)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": mapCouponErr(err)})
			return
		}
	}
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "优惠后金额过低"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"original":  strconv.FormatFloat(original, 'f', 2, 64),
			"pay_money": strconv.FormatFloat(payMoney, 'f', 2, 64),
		},
	})
}

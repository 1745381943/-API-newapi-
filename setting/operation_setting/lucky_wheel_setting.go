package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// LuckyWheelSetting 大转盘功能配置
type LuckyWheelSetting struct {
	Enabled    bool `json:"enabled"`     // 是否启用大转盘
	DailyLimit int  `json:"daily_limit"` // 每日免费抽奖次数
}

// 默认配置
var luckyWheelSetting = LuckyWheelSetting{
	Enabled:    false, // 默认关闭
	DailyLimit: 1,     // 每日 1 次
}

func init() {
	config.GlobalConfig.Register("lucky_wheel_setting", &luckyWheelSetting)
}

// GetLuckyWheelSetting 获取大转盘配置
func GetLuckyWheelSetting() *LuckyWheelSetting {
	return &luckyWheelSetting
}

// IsLuckyWheelEnabled 是否启用大转盘
func IsLuckyWheelEnabled() bool {
	return luckyWheelSetting.Enabled
}

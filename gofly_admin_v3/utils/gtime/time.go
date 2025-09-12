package gtime

import (
	"time"
)

// Now 获取当前时间
func Now() time.Time {
	return time.Now()
}

// Format 格式化时间
func Format(t time.Time, format string) string {
	return t.Format(format)
}

// Parse 解析时间字符串
func Parse(layout, value string) (time.Time, error) {
	return time.Parse(layout, value)
}

// Timestamp 获取时间戳
func Timestamp(t time.Time) int64 {
	return t.Unix()
}

// Date 获取日期部分
func Date(t time.Time) string {
	return t.Format("2006-01-02")
}

// DateTime 获取日期时间
func DateTime(t time.Time) string {
	return t.Format("2006-01-02 15:04:05")
}

// AddDuration 添加时间间隔
func AddDuration(t time.Time, d time.Duration) time.Time {
	return t.Add(d)
}

// AddDays 添加天数
func AddDays(t time.Time, days int) time.Time {
	return t.AddDate(0, 0, days)
}

// AddHours 添加小时数
func AddHours(t time.Time, hours int) time.Time {
	return t.Add(time.Duration(hours) * time.Hour)
}

// Between 计算两个时间之间的差值
func Between(t1, t2 time.Time) time.Duration {
	return t2.Sub(t1)
}

// IsZero 检查时间是否为零值
func IsZero(t time.Time) bool {
	return t.IsZero()
}

// StartOfDay 获取一天的开始时间
func StartOfDay(t time.Time) time.Time {
	year, month, day := t.Date()
	return time.Date(year, month, day, 0, 0, 0, 0, t.Location())
}

// EndOfDay 获取一天的结束时间
func EndOfDay(t time.Time) time.Time {
	year, month, day := t.Date()
	return time.Date(year, month, day, 23, 59, 59, 999999999, t.Location())
}

// StartOfWeek 获取一周的开始时间（周一）
func StartOfWeek(t time.Time) time.Time {
	weekday := t.Weekday()
	if weekday == time.Sunday {
		weekday = 7
	}
	return t.AddDate(0, 0, -int(weekday)+1)
}

// StartOfMonth 获取月的开始时间
func StartOfMonth(t time.Time) time.Time {
	year, month, _ := t.Date()
	return time.Date(year, month, 1, 0, 0, 0, 0, t.Location())
}

// StartOfYear 获取年的开始时间
func StartOfYear(t time.Time) time.Time {
	year, _, _ := t.Date()
	return time.Date(year, 1, 1, 0, 0, 0, 0, t.Location())
}

// SetTimeZone 设置时区
func SetTimeZone(t time.Time, tz string) (time.Time, error) {
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return t, err
	}
	return t.In(loc), nil
}

// ConvertToUTC 转换为UTC时间
func ConvertToUTC(t time.Time) time.Time {
	return t.UTC()
}

// ConvertToLocal 转换为本地时间
func ConvertToLocal(t time.Time) time.Time {
	return t.Local()
}
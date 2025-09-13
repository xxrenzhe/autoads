package gf

import (
	"crypto/md5"
	"encoding/hex"
)

// MD5 计算MD5哈希
func MD5(data string) string {
	hash := md5.Sum([]byte(data))
	return hex.EncodeToString(hash[:])
}

// Raw 创建Raw查询
func Raw(sql string, args ...interface{}) interface{} {
	return map[string]interface{}{
		"type": "raw",
		"sql":  sql,
		"args": args,
	}
}

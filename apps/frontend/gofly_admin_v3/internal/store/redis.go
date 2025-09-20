package store

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
	"gofly-admin-v3/internal/config"
)

// Redis Redis客户端封装
type Redis struct {
	client *redis.Client
	config *config.RedisConfig
}

// NewRedis 创建Redis客户端
func NewRedis(cfg *config.RedisConfig) (*Redis, error) {
	if cfg == nil || !cfg.Enable {
		return nil, nil
	}

	rdb := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		Password: cfg.Password,
		DB:       cfg.DB,
		PoolSize: cfg.PoolSize,
	})

	// 测试连接
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis连接失败: %w", err)
	}

	return &Redis{
		client: rdb,
		config: cfg,
	}, nil
}

// Get 获取缓存值
func (r *Redis) Get(ctx context.Context, key string) (string, error) {
	return r.client.Get(ctx, key).Result()
}

// Set 设置缓存值
func (r *Redis) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return r.client.Set(ctx, key, value, expiration).Err()
}

// Delete 删除缓存
func (r *Redis) Delete(ctx context.Context, keys ...string) error {
    if len(keys) == 0 {
        return nil
    }
    return r.client.Del(ctx, keys...).Err()
}

// Del 兼容别名（与部分调用方保持一致）
func (r *Redis) Del(ctx context.Context, keys ...string) error {
    if len(keys) == 0 {
        return nil
    }
    return r.client.Del(ctx, keys...).Err()
}

// Exists 检查key是否存在
func (r *Redis) Exists(ctx context.Context, key string) (bool, error) {
	count, err := r.client.Exists(ctx, key).Result()
	return count > 0, err
}

// Expire 设置过期时间
func (r *Redis) Expire(ctx context.Context, key string, expiration time.Duration) error {
	return r.client.Expire(ctx, key, expiration).Err()
}

// HGet Hash获取
func (r *Redis) HGet(ctx context.Context, key, field string) (string, error) {
	return r.client.HGet(ctx, key, field).Result()
}

// HSet Hash设置
func (r *Redis) HSet(ctx context.Context, key string, values ...interface{}) error {
	return r.client.HSet(ctx, key, values...).Err()
}

// HGetAll Hash获取所有
func (r *Redis) HGetAll(ctx context.Context, key string) (map[string]string, error) {
	return r.client.HGetAll(ctx, key).Result()
}

// HDel Hash删除
func (r *Redis) HDel(ctx context.Context, key string, fields ...string) error {
	return r.client.HDel(ctx, key, fields...).Err()
}

// Incr 自增
func (r *Redis) Incr(ctx context.Context, key string) (int64, error) {
    return r.client.Incr(ctx, key).Result()
}

// IncrBy 按步长自增
func (r *Redis) IncrBy(ctx context.Context, key string, value int64) (int64, error) {
    return r.client.IncrBy(ctx, key, value).Result()
}

// Decr 自减
func (r *Redis) Decr(ctx context.Context, key string) (int64, error) {
	return r.client.Decr(ctx, key).Result()
}

// ZAdd 有序集合添加
func (r *Redis) ZAdd(ctx context.Context, key string, members ...*redis.Z) error {
	return r.client.ZAdd(ctx, key, members...).Err()
}

// ZRange 有序集合范围查询
func (r *Redis) ZRange(ctx context.Context, key string, start, stop int64) ([]string, error) {
	return r.client.ZRange(ctx, key, start, stop).Result()
}

// ZRangeWithScores 有序集合范围查询（带分数）
func (r *Redis) ZRangeWithScores(ctx context.Context, key string, start, stop int64) ([]redis.Z, error) {
	return r.client.ZRangeWithScores(ctx, key, start, stop).Result()
}

// ZRem 有序集合删除
func (r *Redis) ZRem(ctx context.Context, key string, members ...interface{}) error {
	return r.client.ZRem(ctx, key, members...).Err()
}

// ZScore 有序集合获取分数
func (r *Redis) ZScore(ctx context.Context, key, member string) (float64, error) {
	return r.client.ZScore(ctx, key, member).Result()
}

// LPush 列表左推
func (r *Redis) LPush(ctx context.Context, key string, values ...interface{}) error {
	return r.client.LPush(ctx, key, values...).Err()
}

// RPush 列表右推
func (r *Redis) RPush(ctx context.Context, key string, values ...interface{}) error {
	return r.client.RPush(ctx, key, values...).Err()
}

// LPop 列表左弹
func (r *Redis) LPop(ctx context.Context, key string) (string, error) {
	return r.client.LPop(ctx, key).Result()
}

// RPop 列表右弹
func (r *Redis) RPop(ctx context.Context, key string) (string, error) {
	return r.client.RPop(ctx, key).Result()
}

// LRange 列表范围查询
func (r *Redis) LRange(ctx context.Context, key string, start, stop int64) ([]string, error) {
	return r.client.LRange(ctx, key, start, stop).Result()
}

// LLen 列表长度
func (r *Redis) LLen(ctx context.Context, key string) (int64, error) {
	return r.client.LLen(ctx, key).Result()
}

// Publish 发布消息
func (r *Redis) Publish(ctx context.Context, channel string, message interface{}) error {
	return r.client.Publish(ctx, channel, message).Err()
}

// Subscribe 订阅消息
func (r *Redis) Subscribe(ctx context.Context, channels ...string) *redis.PubSub {
	return r.client.Subscribe(ctx, channels...)
}

// Pipeline 管道操作
func (r *Redis) Pipeline() redis.Pipeliner {
	return r.client.Pipeline()
}

// TxPipeline 事务管道
func (r *Redis) TxPipeline() redis.Pipeliner {
	return r.client.TxPipeline()
}

// Close 关闭连接
func (r *Redis) Close() error {
	return r.client.Close()
}

// GetClient 获取原始客户端
func (r *Redis) GetClient() *redis.Client {
	return r.client
}

// 缓存key生成器
type CacheKey struct {
	prefix string
}

// NewCacheKey 创建缓存key生成器
func NewCacheKey(prefix string) *CacheKey {
	return &CacheKey{prefix: prefix}
}

// UserRateLimit 用户速率限制key
func (ck *CacheKey) UserRateLimit(userID string) string {
	return fmt.Sprintf("%s:rate_limit:%s", ck.prefix, userID)
}

// UserRateLimitToken 用户速率限制令牌key
func (ck *CacheKey) UserRateLimitToken(userID string) string {
	return fmt.Sprintf("%s:rate_limit_token:%s", ck.prefix, userID)
}

// PlanConfig 套餐配置key
func (ck *CacheKey) PlanConfig(plan string) string {
	return fmt.Sprintf("%s:plan_config:%s", ck.prefix, plan)
}

// UserStats 用户统计key
func (ck *CacheKey) UserStats(userID string) string {
	return fmt.Sprintf("%s:user_stats:%s", ck.prefix, userID)
}

// SystemStats 系统统计key
func (ck *CacheKey) SystemStats() string {
	return fmt.Sprintf("%s:system_stats", ck.prefix)
}

// UserSession 用户会话key
func (ck *CacheKey) UserSession(sessionID string) string {
	return fmt.Sprintf("%s:session:%s", ck.prefix, sessionID)
}

// UserToken 用户令牌key
func (ck *CacheKey) UserToken(token string) string {
	return fmt.Sprintf("%s:token:%s", ck.prefix, token)
}

// RateLimitStats 速率限制统计key
func (ck *CacheKey) RateLimitStats(date string) string {
	return fmt.Sprintf("%s:rate_limit_stats:%s", ck.prefix, date)
}

// JSONHelper JSON序列化辅助工具
type JSONHelper struct{}

// Serialize 序列化对象为JSON
func (j *JSONHelper) Serialize(value interface{}) (string, error) {
	data, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// Deserialize 反序列化JSON为对象
func (j *JSONHelper) Deserialize(data string, out interface{}) error {
	return json.Unmarshal([]byte(data), out)
}

// 全局JSON助手
var JSON = &JSONHelper{}

// InitRedis 初始化Redis客户端
func InitRedis(cfg *config.RedisConfig) (*Redis, error) {
	return NewRedis(cfg)
}

package gredis

import (
    "context"
    "crypto/tls"
    "errors"
    "strings"
    "time"

    redis "github.com/redis/go-redis/v9"

    "gofly-admin-v3/utils/tools/gvar"
)

// go-redis v9 adapter implementing gredis.Adapter and related Conn/Group interfaces.

type goRedisAdapter struct {
    client redis.UniversalClient
}

// Register adapter on package init.
func init() {
    RegisterAdapterFunc(func(cfg *Config) Adapter {
        if cfg == nil {
            return nil
        }
        opts := &redis.UniversalOptions{}
        if cfg.Address != "" {
            // comma separated addresses
            parts := strings.Split(cfg.Address, ",")
            for i := range parts {
                parts[i] = strings.TrimSpace(parts[i])
            }
            opts.Addrs = parts
        }
        opts.DB = cfg.Db
        opts.Username = cfg.User
        opts.Password = cfg.Pass
        if cfg.TLS || cfg.TLSConfig != nil {
            if cfg.TLSConfig != nil {
                opts.TLSConfig = cfg.TLSConfig
            } else {
                opts.TLSConfig = &tls.Config{InsecureSkipVerify: cfg.TLSSkipVerify}
            }
        }
        if cfg.MasterName != "" {
            opts.MasterName = cfg.MasterName
        }
        if cfg.MaxActive > 0 {
            opts.PoolSize = cfg.MaxActive
        }
        if cfg.MinIdle > 0 {
            opts.MinIdleConns = cfg.MinIdle
        }
        if cfg.IdleTimeout > 0 {
            opts.IdleTimeout = cfg.IdleTimeout
        }
        if cfg.MaxConnLifetime > 0 {
            opts.MaxConnAge = cfg.MaxConnLifetime
        }
        if cfg.DialTimeout > 0 {
            opts.DialTimeout = cfg.DialTimeout
        }
        if cfg.ReadTimeout > 0 {
            opts.ReadTimeout = cfg.ReadTimeout
        }
        if cfg.WriteTimeout > 0 {
            opts.WriteTimeout = cfg.WriteTimeout
        }

        client := redis.NewUniversalClient(opts)
        return &goRedisAdapter{client: client}
    })
}

// AdapterOperation
func (a *goRedisAdapter) Do(ctx context.Context, command string, args ...interface{}) (*gvar.Var, error) {
    // go-redis v9 accepts []any
    cmd := a.client.Do(ctx, append([]any{command}, args...)...)
    res, err := cmd.Result()
    if err != nil {
        return nil, err
    }
    return gvar.New(res), nil
}

func (a *goRedisAdapter) Conn(ctx context.Context) (Conn, error) {
    return &goRedisConn{client: a.client}, nil
}

func (a *goRedisAdapter) Close(ctx context.Context) error {
    return a.client.Close()
}

// AdapterGroup getters
func (a *goRedisAdapter) GroupGeneric() IGroupGeneric     { return &grpGeneric{client: a.client} }
func (a *goRedisAdapter) GroupHash() IGroupHash           { return &grpHash{client: a.client} }
func (a *goRedisAdapter) GroupList() IGroupList           { return &grpList{client: a.client} }
func (a *goRedisAdapter) GroupPubSub() IGroupPubSub       { return &grpPubSub{client: a.client} }
func (a *goRedisAdapter) GroupScript() IGroupScript       { return &grpScript{client: a.client} }
func (a *goRedisAdapter) GroupSet() IGroupSet             { return &grpSet{client: a.client} }
func (a *goRedisAdapter) GroupSortedSet() IGroupSortedSet { return &grpZSet{client: a.client} }
func (a *goRedisAdapter) GroupString() IGroupString       { return &grpString{client: a.client} }

// Conn implementation used for Pub/Sub and Do via connection.
type goRedisConn struct {
    client redis.UniversalClient
    pubsub *redis.PubSub
}

func (c *goRedisConn) Subscribe(ctx context.Context, channel string, channels ...string) ([]*Subscription, error) {
    ps := c.client.Subscribe(ctx, append([]string{channel}, channels...)...)
    c.pubsub = ps
    // Return basic subscription info (optional usage in codebase)
    subs := make([]*Subscription, 0, 1+len(channels))
    subs = append(subs, &Subscription{Kind: "subscribe", Channel: channel, Count: 1})
    for _, ch := range channels {
        subs = append(subs, &Subscription{Kind: "subscribe", Channel: ch, Count: len(subs)+1})
    }
    return subs, nil
}

func (c *goRedisConn) PSubscribe(ctx context.Context, pattern string, patterns ...string) ([]*Subscription, error) {
    ps := c.client.PSubscribe(ctx, append([]string{pattern}, patterns...)...)
    c.pubsub = ps
    subs := make([]*Subscription, 0, 1+len(patterns))
    subs = append(subs, &Subscription{Kind: "psubscribe", Channel: pattern, Count: 1})
    for _, p := range patterns {
        subs = append(subs, &Subscription{Kind: "psubscribe", Channel: p, Count: len(subs)+1})
    }
    return subs, nil
}

func (c *goRedisConn) ReceiveMessage(ctx context.Context) (*Message, error) {
    if c.pubsub == nil {
        return nil, errors.New("pubsub not initialized")
    }
    m, err := c.pubsub.ReceiveMessage(ctx)
    if err != nil {
        return nil, err
    }
    return &Message{Channel: m.Channel, Pattern: m.Pattern, Payload: m.Payload}, nil
}

func (c *goRedisConn) Receive(ctx context.Context) (*gvar.Var, error) {
    if c.pubsub == nil {
        return nil, errors.New("pubsub not initialized")
    }
    v, err := c.pubsub.Receive(ctx)
    if err != nil {
        return nil, err
    }
    return gvar.New(v), nil
}

func (c *goRedisConn) Do(ctx context.Context, command string, args ...interface{}) (*gvar.Var, error) {
    cmd := c.client.Do(ctx, append([]any{command}, args...)...)
    res, err := cmd.Result()
    if err != nil {
        return nil, err
    }
    return gvar.New(res), nil
}

func (c *goRedisConn) Close(ctx context.Context) error {
    if c.pubsub != nil {
        return c.pubsub.Close()
    }
    return nil
}

// --- Pub/Sub group ---
type grpPubSub struct{ client redis.UniversalClient }

func (g *grpPubSub) Publish(ctx context.Context, channel string, message interface{}) (int64, error) {
    return g.client.Publish(ctx, channel, message).Result()
}
func (g *grpPubSub) Subscribe(ctx context.Context, channel string, channels ...string) (Conn, []*Subscription, error) {
    conn := &goRedisConn{client: g.client}
    subs, err := conn.Subscribe(ctx, channel, channels...)
    return conn, subs, err
}
func (g *grpPubSub) PSubscribe(ctx context.Context, pattern string, patterns ...string) (Conn, []*Subscription, error) {
    conn := &goRedisConn{client: g.client}
    subs, err := conn.PSubscribe(ctx, pattern, patterns...)
    return conn, subs, err
}

// --- Minimal stubs for other groups (not used by current code paths) ---
type grpGeneric struct{ client redis.UniversalClient }
func (g *grpGeneric) Copy(ctx context.Context, source, destination string, option ...CopyOption) (int64, error) { return 0, nil }
func (g *grpGeneric) Exists(ctx context.Context, keys ...string) (int64, error) { return g.client.Exists(ctx, keys...).Result() }
func (g *grpGeneric) Type(ctx context.Context, key string) (string, error) { return g.client.Type(ctx, key).Result() }
func (g *grpGeneric) Unlink(ctx context.Context, keys ...string) (int64, error) { return g.client.Unlink(ctx, keys...).Result() }
func (g *grpGeneric) Rename(ctx context.Context, key, newKey string) error { return g.client.Rename(ctx, key, newKey).Err() }
func (g *grpGeneric) RenameNX(ctx context.Context, key, newKey string) (int64, error) { b, err := g.client.RenameNX(ctx, key, newKey).Result(); if err!=nil {return 0, err}; if b {return 1, nil}; return 0, nil }
func (g *grpGeneric) Move(ctx context.Context, key string, db int) (int64, error) { b, err := g.client.Move(ctx, key, db).Result(); if err!=nil {return 0, err}; if b {return 1, nil}; return 0, nil }
func (g *grpGeneric) Del(ctx context.Context, keys ...string) (int64, error) { return g.client.Del(ctx, keys...).Result() }
func (g *grpGeneric) RandomKey(ctx context.Context) (string, error) { return g.client.RandomKey(ctx).Result() }
func (g *grpGeneric) DBSize(ctx context.Context) (int64, error) { return g.client.DBSize(ctx).Result() }
func (g *grpGeneric) Keys(ctx context.Context, pattern string) ([]string, error) { return g.client.Keys(ctx, pattern).Result() }
func (g *grpGeneric) Scan(ctx context.Context, cursor uint64, option ...ScanOption) (uint64, []string, error) { keys, cur, err := g.client.Scan(ctx, cursor, "*", 10).Result(); return cur, keys, err }
func (g *grpGeneric) FlushDB(ctx context.Context, option ...FlushOp) error { return g.client.FlushDB(ctx).Err() }
func (g *grpGeneric) FlushAll(ctx context.Context, option ...FlushOp) error { return g.client.FlushAll(ctx).Err() }
func (g *grpGeneric) Expire(ctx context.Context, key string, seconds int64, option ...ExpireOption) (int64, error) { b, err := g.client.Expire(ctx, key, seconds*1_000_000_000).Result(); if err!=nil {return 0, err}; if b {return 1, nil}; return 0, nil }
func (g *grpGeneric) ExpireAt(ctx context.Context, key string, t time.Time, option ...ExpireOption) (int64, error) { b, err := g.client.ExpireAt(ctx, key, t).Result(); if err!=nil {return 0, err}; if b {return 1, nil}; return 0, nil }
func (g *grpGeneric) ExpireTime(ctx context.Context, key string) (*gvar.Var, error) { v, err := g.client.Do(ctx, "EXPIRETIME", key).Result(); if err!=nil {return nil, err}; return gvar.New(v), nil }
func (g *grpGeneric) TTL(ctx context.Context, key string) (int64, error) { d, err := g.client.TTL(ctx, key).Result(); if err!=nil {return 0, err}; return int64(d.Seconds()), nil }
func (g *grpGeneric) Persist(ctx context.Context, key string) (int64, error) { b, err := g.client.Persist(ctx, key).Result(); if err!=nil {return 0, err}; if b {return 1, nil}; return 0, nil }
func (g *grpGeneric) PExpire(ctx context.Context, key string, ms int64, option ...ExpireOption) (int64, error) { b, err := g.client.PExpire(ctx, key, ms*1_000_000).Result(); if err!=nil {return 0, err}; if b {return 1, nil}; return 0, nil }
func (g *grpGeneric) PExpireAt(ctx context.Context, key string, t time.Time, option ...ExpireOption) (int64, error) { b, err := g.client.PExpireAt(ctx, key, t).Result(); if err!=nil {return 0, err}; if b {return 1, nil}; return 0, nil }
func (g *grpGeneric) PExpireTime(ctx context.Context, key string) (*gvar.Var, error) { v, err := g.client.Do(ctx, "PEXPIRETIME", key).Result(); if err!=nil {return nil, err}; return gvar.New(v), nil }
func (g *grpGeneric) PTTL(ctx context.Context, key string) (int64, error) { d, err := g.client.PTTL(ctx, key).Result(); if err!=nil {return 0, err}; return int64(d.Milliseconds()), nil }

// String group (minimal semantics)
type grpString struct{ client redis.UniversalClient }
func (g *grpString) Set(ctx context.Context, key string, value interface{}, option ...SetOption) (*gvar.Var, error) { err := g.client.Set(ctx, key, value, 0).Err(); if err!=nil {return nil, err}; return gvar.New("OK"), nil }
func (g *grpString) SetNX(ctx context.Context, key string, value interface{}) (bool, error) { return g.client.SetNX(ctx, key, value, 0).Result() }
func (g *grpString) SetEX(ctx context.Context, key string, value interface{}, ttlInSeconds int64) error { return g.client.Set(ctx, key, value, time.Duration(ttlInSeconds)*time.Second).Err() }
func (g *grpString) Get(ctx context.Context, key string) (*gvar.Var, error) { s, err := g.client.Get(ctx, key).Result(); if err!=nil {return nil, err}; return gvar.New(s), nil }
func (g *grpString) GetDel(ctx context.Context, key string) (*gvar.Var, error) { s, err := g.client.GetDel(ctx, key).Result(); if err!=nil {return nil, err}; return gvar.New(s), nil }
func (g *grpString) GetEX(ctx context.Context, key string, option ...GetEXOption) (*gvar.Var, error) { s, err := g.client.Do(ctx, "GETEX", key).Result(); if err!=nil {return nil, err}; return gvar.New(s), nil }
func (g *grpString) GetSet(ctx context.Context, key string, value interface{}) (*gvar.Var, error) { s, err := g.client.GetSet(ctx, key, value).Result(); if err!=nil {return nil, err}; return gvar.New(s), nil }
func (g *grpString) StrLen(ctx context.Context, key string) (int64, error) { return g.client.StrLen(ctx, key).Result() }
func (g *grpString) Append(ctx context.Context, key string, value string) (int64, error) { return g.client.Append(ctx, key, value).Result() }
func (g *grpString) SetRange(ctx context.Context, key string, offset int64, value string) (int64, error) { return g.client.SetRange(ctx, key, offset, value).Result() }
func (g *grpString) GetRange(ctx context.Context, key string, start, end int64) (string, error) { return g.client.GetRange(ctx, key, start, end).Result() }
func (g *grpString) Incr(ctx context.Context, key string) (int64, error) { return g.client.Incr(ctx, key).Result() }
func (g *grpString) IncrBy(ctx context.Context, key string, increment int64) (int64, error) { return g.client.IncrBy(ctx, key, increment).Result() }
func (g *grpString) IncrByFloat(ctx context.Context, key string, increment float64) (float64, error) { return g.client.IncrByFloat(ctx, key, increment).Result() }
func (g *grpString) Decr(ctx context.Context, key string) (int64, error) { return g.client.Decr(ctx, key).Result() }
func (g *grpString) DecrBy(ctx context.Context, key string, decrement int64) (int64, error) { return g.client.DecrBy(ctx, key, decrement).Result() }
func (g *grpString) MSet(ctx context.Context, keyValueMap map[string]interface{}) error { return g.client.MSet(ctx, keyValueMap).Err() }
func (g *grpString) MSetNX(ctx context.Context, keyValueMap map[string]interface{}) (bool, error) { return g.client.MSetNX(ctx, keyValueMap).Result() }
func (g *grpString) MGet(ctx context.Context, keys ...string) (gvar.Vars, error) { vals, err := g.client.MGet(ctx, keys...).Result(); if err!=nil {return nil, err}; out := make(gvar.Vars, 0, len(vals)); for _, v := range vals { out = append(out, gvar.New(v)) }; return out, nil }

// Hash group (stubs via direct redis mappings)
type grpHash struct{ client redis.UniversalClient }
func (g *grpHash) HSet(ctx context.Context, key string, fields map[string]interface{}) (int64, error) { return g.client.HSet(ctx, key, fields).Result() }
func (g *grpHash) HSetNX(ctx context.Context, key, field string, value interface{}) (int64, error) { b, err := g.client.HSetNX(ctx, key, field, value).Result(); if err!=nil {return 0, err}; if b {return 1, nil}; return 0, nil }
func (g *grpHash) HGet(ctx context.Context, key, field string) (*gvar.Var, error) { s, err := g.client.HGet(ctx, key, field).Result(); if err!=nil {return nil, err}; return gvar.New(s), nil }
func (g *grpHash) HStrLen(ctx context.Context, key, field string) (int64, error) { return g.client.HStrLen(ctx, key, field).Result() }
func (g *grpHash) HExists(ctx context.Context, key, field string) (int64, error) { b, err := g.client.HExists(ctx, key, field).Result(); if err!=nil {return 0, err}; if b {return 1, nil}; return 0, nil }
func (g *grpHash) HDel(ctx context.Context, key string, fields ...string) (int64, error) { return g.client.HDel(ctx, key, fields...).Result() }
func (g *grpHash) HLen(ctx context.Context, key string) (int64, error) { return g.client.HLen(ctx, key).Result() }
func (g *grpHash) HIncrBy(ctx context.Context, key, field string, increment int64) (int64, error) { return g.client.HIncrBy(ctx, key, field, increment).Result() }
func (g *grpHash) HIncrByFloat(ctx context.Context, key, field string, increment float64) (float64, error) { return g.client.HIncrByFloat(ctx, key, field, increment).Result() }
func (g *grpHash) HMSet(ctx context.Context, key string, fields map[string]interface{}) error { return g.client.HMSet(ctx, key, fields).Err() }
func (g *grpHash) HMGet(ctx context.Context, key string, fields ...string) (gvar.Vars, error) { vals, err := g.client.HMGet(ctx, key, fields...).Result(); if err!=nil {return nil, err}; out := make(gvar.Vars, 0, len(vals)); for _, v := range vals { out = append(out, gvar.New(v)) }; return out, nil }
func (g *grpHash) HKeys(ctx context.Context, key string) ([]string, error) { return g.client.HKeys(ctx, key).Result() }
func (g *grpHash) HVals(ctx context.Context, key string) (gvar.Vars, error) { vals, err := g.client.HVals(ctx, key).Result(); if err!=nil {return nil, err}; out := make(gvar.Vars, 0, len(vals)); for _, v := range vals { out = append(out, gvar.New(v)) }; return out, nil }
func (g *grpHash) HGetAll(ctx context.Context, key string) (*gvar.Var, error) { m, err := g.client.HGetAll(ctx, key).Result(); if err!=nil {return nil, err}; return gvar.New(m), nil }

// List group
type grpList struct{ client redis.UniversalClient }
func (g *grpList) LPush(ctx context.Context, key string, values ...interface{}) (int64, error) { return g.client.LPush(ctx, key, values...).Result() }
func (g *grpList) LPushX(ctx context.Context, key string, element interface{}, elements ...interface{}) (int64, error) { return g.client.LPushX(ctx, key, append([]interface{}{element}, elements...)...).Result() }
func (g *grpList) RPush(ctx context.Context, key string, values ...interface{}) (int64, error) { return g.client.RPush(ctx, key, values...).Result() }
func (g *grpList) RPushX(ctx context.Context, key string, value interface{}) (int64, error) { return g.client.RPushX(ctx, key, value).Result() }
func (g *grpList) LPop(ctx context.Context, key string, count ...int) (*gvar.Var, error) { v, err := g.client.LPop(ctx, key).Result(); if err!=nil {return nil, err}; return gvar.New(v), nil }
func (g *grpList) RPop(ctx context.Context, key string, count ...int) (*gvar.Var, error) { v, err := g.client.RPop(ctx, key).Result(); if err!=nil {return nil, err}; return gvar.New(v), nil }
func (g *grpList) LRem(ctx context.Context, key string, count int64, value interface{}) (int64, error) { return g.client.LRem(ctx, key, count, value).Result() }
func (g *grpList) LLen(ctx context.Context, key string) (int64, error) { return g.client.LLen(ctx, key).Result() }
func (g *grpList) LIndex(ctx context.Context, key string, index int64) (*gvar.Var, error) { v, err := g.client.LIndex(ctx, key, index).Result(); if err!=nil {return nil, err}; return gvar.New(v), nil }
func (g *grpList) LInsert(ctx context.Context, key string, op LInsertOp, pivot, value interface{}) (int64, error) { return g.client.LInsert(ctx, key, strings.ToLower(string(op)), pivot, value).Result() }
func (g *grpList) LSet(ctx context.Context, key string, index int64, value interface{}) (*gvar.Var, error) { err := g.client.LSet(ctx, key, index, value).Err(); if err!=nil {return nil, err}; return gvar.New("OK"), nil }
func (g *grpList) LRange(ctx context.Context, key string, start, stop int64) (gvar.Vars, error) { vals, err := g.client.LRange(ctx, key, start, stop).Result(); if err!=nil {return nil, err}; out := make(gvar.Vars, 0, len(vals)); for _, v := range vals { out = append(out, gvar.New(v)) }; return out, nil }
func (g *grpList) LTrim(ctx context.Context, key string, start, stop int64) error { return g.client.LTrim(ctx, key, start, stop).Err() }
func (g *grpList) BLPop(ctx context.Context, timeout int64, keys ...string) (gvar.Vars, error) { vals, err := g.client.BLPop(ctx, time.Duration(timeout)*time.Second, keys...).Result(); if err!=nil {return nil, err}; out := make(gvar.Vars, 0, len(vals)); for _, v := range vals { out = append(out, gvar.New(v)) }; return out, nil }
func (g *grpList) BRPop(ctx context.Context, timeout int64, keys ...string) (gvar.Vars, error) { vals, err := g.client.BRPop(ctx, time.Duration(timeout)*time.Second, keys...).Result(); if err!=nil {return nil, err}; out := make(gvar.Vars, 0, len(vals)); for _, v := range vals { out = append(out, gvar.New(v)) }; return out, nil }
func (g *grpList) RPopLPush(ctx context.Context, source, destination string) (*gvar.Var, error) { v, err := g.client.RPopLPush(ctx, source, destination).Result(); if err!=nil {return nil, err}; return gvar.New(v), nil }
func (g *grpList) BRPopLPush(ctx context.Context, source, destination string, timeout int64) (*gvar.Var, error) { v, err := g.client.BRPopLPush(ctx, source, destination, time.Duration(timeout)*time.Second).Result(); if err!=nil {return nil, err}; return gvar.New(v), nil }

// Set group
type grpSet struct{ client redis.UniversalClient }
func (g *grpSet) SAdd(ctx context.Context, key string, member interface{}, members ...interface{}) (int64, error) { return g.client.SAdd(ctx, key, append([]interface{}{member}, members...)...).Result() }
func (g *grpSet) SIsMember(ctx context.Context, key string, member interface{}) (int64, error) { b, err := g.client.SIsMember(ctx, key, member).Result(); if err!=nil {return 0, err}; if b {return 1, nil}; return 0, nil }
func (g *grpSet) SPop(ctx context.Context, key string, count ...int) (*gvar.Var, error) { v, err := g.client.SPop(ctx, key).Result(); if err!=nil {return nil, err}; return gvar.New(v), nil }
func (g *grpSet) SRandMember(ctx context.Context, key string, count ...int) (*gvar.Var, error) { v, err := g.client.SRandMember(ctx, key).Result(); if err!=nil {return nil, err}; return gvar.New(v), nil }
func (g *grpSet) SRem(ctx context.Context, key string, member interface{}, members ...interface{}) (int64, error) { return g.client.SRem(ctx, key, append([]interface{}{member}, members...)...).Result() }
func (g *grpSet) SMove(ctx context.Context, source, destination string, member interface{}) (int64, error) { b, err := g.client.SMove(ctx, source, destination, member).Result(); if err!=nil {return 0, err}; if b {return 1, nil}; return 0, nil }
func (g *grpSet) SCard(ctx context.Context, key string) (int64, error) { return g.client.SCard(ctx, key).Result() }
func (g *grpSet) SMembers(ctx context.Context, key string) (gvar.Vars, error) { vals, err := g.client.SMembers(ctx, key).Result(); if err!=nil {return nil, err}; out := make(gvar.Vars, 0, len(vals)); for _, v := range vals { out = append(out, gvar.New(v)) }; return out, nil }
func (g *grpSet) SMIsMember(ctx context.Context, key, member interface{}, members ...interface{}) ([]int, error) { b, err := g.client.SMIsMember(ctx, key.(string), append([]interface{}{member}, members...)...).Result(); if err!=nil {return nil, err}; out := make([]int, len(b)); for i, x := range b { if x { out[i] = 1 } }; return out, nil }
func (g *grpSet) SInter(ctx context.Context, key string, keys ...string) (gvar.Vars, error) { vals, err := g.client.SInter(ctx, append([]string{key}, keys...)...).Result(); if err!=nil {return nil, err}; out := make(gvar.Vars, 0, len(vals)); for _, v := range vals { out = append(out, gvar.New(v)) }; return out, nil }
func (g *grpSet) SInterStore(ctx context.Context, destination string, key string, keys ...string) (int64, error) { return g.client.SInterStore(ctx, destination, append([]string{key}, keys...)...).Result() }
func (g *grpSet) SUnion(ctx context.Context, key string, keys ...string) (gvar.Vars, error) { vals, err := g.client.SUnion(ctx, append([]string{key}, keys...)...).Result(); if err!=nil {return nil, err}; out := make(gvar.Vars, 0, len(vals)); for _, v := range vals { out = append(out, gvar.New(v)) }; return out, nil }
func (g *grpSet) SUnionStore(ctx context.Context, destination, key string, keys ...string) (int64, error) { return g.client.SUnionStore(ctx, destination, append([]string{key}, keys...)...).Result() }
func (g *grpSet) SDiff(ctx context.Context, key string, keys ...string) (gvar.Vars, error) { vals, err := g.client.SDiff(ctx, append([]string{key}, keys...)...).Result(); if err!=nil {return nil, err}; out := make(gvar.Vars, 0, len(vals)); for _, v := range vals { out = append(out, gvar.New(v)) }; return out, nil }
func (g *grpSet) SDiffStore(ctx context.Context, destination string, key string, keys ...string) (int64, error) { return g.client.SDiffStore(ctx, destination, append([]string{key}, keys...)...).Result() }

// Sorted set group (minimal)
type grpZSet struct{ client redis.UniversalClient }
func (g *grpZSet) ZAdd(ctx context.Context, key string, option *ZAddOption, member ZAddMember, members ...ZAddMember) (*gvar.Var, error) { zm := make([]redis.Z, 0, 1+len(members)); zm = append(zm, redis.Z{Score: member.Score, Member: member.Member}); for _, m := range members { zm = append(zm, redis.Z{Score: m.Score, Member: m.Member}) }; n, err := g.client.ZAdd(ctx, key, zm...).Result(); if err!=nil {return nil, err}; return gvar.New(n), nil }
func (g *grpZSet) ZScore(ctx context.Context, key string, member interface{}) (float64, error) { return g.client.ZScore(ctx, key, member).Result() }
func (g *grpZSet) ZIncrBy(ctx context.Context, key string, increment float64, member interface{}) (float64, error) { return g.client.ZIncrBy(ctx, key, increment, member).Result() }
func (g *grpZSet) ZCard(ctx context.Context, key string) (int64, error) { return g.client.ZCard(ctx, key).Result() }
func (g *grpZSet) ZCount(ctx context.Context, key string, min, max string) (int64, error) { return g.client.ZCount(ctx, key, min, max).Result() }
func (g *grpZSet) ZRange(ctx context.Context, key string, start, stop int64, option ...ZRangeOption) (gvar.Vars, error) { vals, err := g.client.ZRange(ctx, key, start, stop).Result(); if err!=nil {return nil, err}; out := make(gvar.Vars, 0, len(vals)); for _, v := range vals { out = append(out, gvar.New(v)) }; return out, nil }
func (g *grpZSet) ZRevRange(ctx context.Context, key string, start, stop int64, option ...ZRevRangeOption) (*gvar.Var, error) { vals, err := g.client.ZRevRange(ctx, key, start, stop).Result(); if err!=nil {return nil, err}; return gvar.New(vals), nil }
func (g *grpZSet) ZRank(ctx context.Context, key string, member interface{}) (int64, error) { return g.client.ZRank(ctx, key, member).Result() }
func (g *grpZSet) ZRevRank(ctx context.Context, key string, member interface{}) (int64, error) { return g.client.ZRevRank(ctx, key, member).Result() }
func (g *grpZSet) ZRem(ctx context.Context, key string, member interface{}, members ...interface{}) (int64, error) { return g.client.ZRem(ctx, key, append([]interface{}{member}, members...)...).Result() }
func (g *grpZSet) ZRemRangeByRank(ctx context.Context, key string, start, stop int64) (int64, error) { return g.client.ZRemRangeByRank(ctx, key, start, stop).Result() }
func (g *grpZSet) ZRemRangeByScore(ctx context.Context, key string, min, max string) (int64, error) { return g.client.ZRemRangeByScore(ctx, key, min, max).Result() }
func (g *grpZSet) ZRemRangeByLex(ctx context.Context, key string, min, max string) (int64, error) { return g.client.Do(ctx, "ZREMRANGEBYLEX", key, min, max).Int64() }
func (g *grpZSet) ZLexCount(ctx context.Context, key, min, max string) (int64, error) { return g.client.Do(ctx, "ZLEXCOUNT", key, min, max).Int64() }

// Script group (minimal)
type grpScript struct{ client redis.UniversalClient }
func (g *grpScript) Eval(ctx context.Context, script string, numKeys int64, keys []string, args []interface{}) (*gvar.Var, error) { v, err := g.client.Eval(ctx, script, keys, args...).Result(); if err!=nil {return nil, err}; return gvar.New(v), nil }
func (g *grpScript) EvalSha(ctx context.Context, sha1 string, numKeys int64, keys []string, args []interface{}) (*gvar.Var, error) { v, err := g.client.EvalSha(ctx, sha1, keys, args...).Result(); if err!=nil {return nil, err}; return gvar.New(v), nil }
func (g *grpScript) ScriptLoad(ctx context.Context, script string) (string, error) { return g.client.ScriptLoad(ctx, script).Result() }
func (g *grpScript) ScriptExists(ctx context.Context, sha1 string, sha1s ...string) (map[string]bool, error) {
    arr := append([]string{sha1}, sha1s...)
    res, err := g.client.ScriptExists(ctx, arr...).Result()
    if err != nil { return nil, err }
    out := map[string]bool{}
    for i, k := range arr { if i < len(res) { out[k] = res[i] } }
    return out, nil
}
func (g *grpScript) ScriptFlush(ctx context.Context, option ...ScriptFlushOption) error { return g.client.ScriptFlush(ctx).Err() }
func (g *grpScript) ScriptKill(ctx context.Context) error { return g.client.ScriptKill(ctx).Err() }

package config

import "testing"

func TestValidateAndFillDefaults(t *testing.T) {
    c := &Config{}
    if err := validateAndFillDefaults(c); err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if c.App.Port == 0 || c.DB.Charset == "" || c.Redis.Prefix == "" || c.Cache.RedisPrefix == "" {
        t.Fatalf("defaults not filled properly: %+v", c)
    }
}


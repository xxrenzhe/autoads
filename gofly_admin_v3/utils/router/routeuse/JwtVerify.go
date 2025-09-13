package routeuse

import (
    "errors"
    "fmt"
    "strings"
    "time"

    "gofly-admin-v3/utils/tools/gcache"
    "gofly-admin-v3/utils/tools/gcfg"
    "gofly-admin-v3/utils/tools/gconv"
    "gofly-admin-v3/utils/tools/gctx"
    "gofly-admin-v3/utils/tools/gvar"

    "github.com/gin-gonic/gin"
    jwt "github.com/golang-jwt/jwt/v5"
)

// 用户信息类，作为生成token的参数
type UserClaims struct {
    ID         int64 `json:"id"`          //用户数据id
    AccountID  int64 `json:"account_id"`  //A、B端用户账号id
    BusinessID int64 `json:"business_id"` //B端主账号id
    Plan       string `json:"plan"`
    Tenant     string `json:"tenant"`
    jwt.RegisteredClaims
}

var (
	ctx         = gctx.New()
	appConf, _  = gcfg.Instance().Get(ctx, "app")
	appConf_arr = gconv.Map(appConf)
	//自定义的token秘钥 tokensecret
	secret     = []byte(gconv.String(appConf_arr["tokensecret"]))
	effectTime = time.Duration(gconv.Int64(appConf_arr["tokenouttime"])) * time.Minute //单位分钟
	cache      = gcache.New()
)

// 生成token
func GenerateToken(claims *UserClaims) (sign string, err error) {
	//设置token有效期，也可不设置有效期，采用redis的方式
	//   1)将token存储在redis中，设置过期时间，token如没过期，则自动刷新redis过期时间，
	//   2)通过这种方式，可以很方便的为token续期，而且也可以实现长时间不登录的话，强制登录
	//本例只是简单采用 设置token有效期的方式，只是提供了刷新token的方法，并没有做续期处理的逻辑
    claims.RegisteredClaims = jwt.RegisteredClaims{
        ExpiresAt: jwt.NewNumericDate(time.Now().Add(effectTime)),
    }
    //生成token
    sign, err = jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
    if err == nil && gconv.Bool(appConf_arr["tokencache"]) { //内存缓存token
        cache.Set(ctx, sign, true, effectTime)
    }
    return
}

// 设置token失效
func RemoveToken(token string) (removedValue *gvar.Var, err error) {
	if gconv.Bool(appConf_arr["tokencache"]) { //当开启内存是才清除缓存
		removedValue, err = cache.Remove(ctx, token)
	}
	return
}

// 关闭缓存对象，让GC回收资源
func CloseCache() {
	cache.Close(ctx)
}

// 验证token
func JwtVerify(c *gin.Context) {
    //获取token字符串
    token := c.GetHeader("Authorization")
    if token == "" {
        token = c.GetHeader("authorization")
    }
    // 兼容 Bearer 前缀
    if strings.HasPrefix(strings.ToLower(token), "bearer ") {
        token = strings.TrimSpace(token[7:])
    }
    if token != "" {
        //1.验证token是否失效（通过缓存判断）
        if value, err := cache.Contains(ctx, token); (!value || err != nil) && gconv.Bool(appConf_arr["tokencache"]) { //缓存token
            c.Set("jwtempty", true)
            c.Set("jwtmsg", "The token is invalid")
        } else {
            //2.验证token，并存储在请求中
            tokeninfo, err := ParseToken(token)
            if err != nil {
                c.Set("jwtempty", true)
                c.Set("jwtmsg", err.Error())
            } else {
                c.Set("jwtempty", false)
                c.Set("user", tokeninfo)
                c.Set("userID", tokeninfo.ID)
                // 优先使用 Subject 作为字符串用户ID（兼容字符串ID场景）
                if tokeninfo.Subject != "" {
                    c.Set("user_id", tokeninfo.Subject)
                } else {
                    c.Set("user_id", fmt.Sprintf("%d", tokeninfo.ID))
                }
                c.Set("accountID", tokeninfo.AccountID)
                c.Set("businessID", tokeninfo.BusinessID)
            }
        }
    } else {
        c.Set("jwtempty", true)
        c.Set("jwtmsg", "The token does not exist")
    }
}

// 解析Token-验证过去
func ParseToken(tokenString string) (*UserClaims, error) {
    token, err := jwt.ParseWithClaims(tokenString, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
        return secret, nil
    })
    if err != nil {
        return nil, err
    }
    claims, ok := token.Claims.(*UserClaims)
    if !ok || !token.Valid {
        return nil, errors.New("The token is invalid")
    }
    return claims, nil
}

// 仅仅解析数据-不验证
func ParseJwt(tokenString string) (*UserClaims, error) {
    // 仅解析不校验到期
    parser := jwt.NewParser(jwt.WithoutClaimsValidation())
    token, err := parser.ParseWithClaims(tokenString, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
        return secret, nil
    })
    if token == nil {
        return nil, err
    }
    claims, ok := token.Claims.(*UserClaims)
    if !ok {
        return nil, errors.New("The token is invalid")
    }
    return claims, nil
}

// 更新token
func Refresh(tokenString string) (string, error) {
    // 允许解析过期token，仅用于刷新
    parser := jwt.NewParser(jwt.WithoutClaimsValidation())
    token, err := parser.ParseWithClaims(tokenString, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
        return secret, nil
    })
    if err != nil {
        return "", err
    }
    claims, ok := token.Claims.(*UserClaims)
    if !ok {
        return "", errors.New("The token is invalid")
    }
    // 重新设置过期时间
    claims.RegisteredClaims.ExpiresAt = jwt.NewNumericDate(time.Now().Add(effectTime))
    sign, serr := GenerateToken(claims) //生成token
    return sign, serr
}

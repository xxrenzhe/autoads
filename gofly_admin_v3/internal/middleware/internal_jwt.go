package middleware

import (
    "crypto"
    "crypto/rsa"
    "crypto/sha256"
    "crypto/x509"
    "encoding/base64"
    "encoding/json"
    "encoding/pem"
    "net/http"
    "os"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
)

type internalClaims struct {
    Iss string   `json:"iss"`
    Aud string   `json:"aud"`
    Sub string   `json:"sub"`
    Exp int64    `json:"exp"`
    Jti string   `json:"jti"`
    Role string  `json:"role"`
    Scope []string `json:"scope"`
}

func parseRSAPublicKeyFromPEM(pemBytes []byte) (*rsa.PublicKey, error) {
    block, _ := pem.Decode(pemBytes)
    if block == nil {
        return nil, ErrInvalidPEM
    }
    pub, err := x509.ParsePKIXPublicKey(block.Bytes)
    if err != nil {
        // try PKCS1
        if pkcs1, err2 := x509.ParsePKCS1PublicKey(block.Bytes); err2 == nil {
            return pkcs1, nil
        }
        return nil, err
    }
    switch k := pub.(type) {
    case *rsa.PublicKey:
        return k, nil
    default:
        return nil, ErrInvalidKey
    }
}

var (
    ErrInvalidPEM = &jwtError{msg:"invalid PEM"}
    ErrInvalidKey = &jwtError{msg:"invalid public key"}
)

type jwtError struct{ msg string }
func (e *jwtError) Error() string { return e.msg }

// InternalJWTAuth returns a middleware that verifies internal RSA JWT if present.
// If INTERNAL_JWT_ENFORCE=true, requests missing or failing verification will be rejected (401),
// except for health/static routes.
func InternalJWTAuth(enforce bool) gin.HandlerFunc {
    pubKeyPEM := os.Getenv("INTERNAL_JWT_PUBLIC_KEY")
    var pub *rsa.PublicKey
    if pubKeyPEM != "" {
        if k, err := parseRSAPublicKeyFromPEM([]byte(pubKeyPEM)); err == nil {
            pub = k
        }
    }

    return func(c *gin.Context) {
        path := c.Request.URL.Path
        // Allowlist public paths
        if strings.HasPrefix(path, "/health") || strings.HasPrefix(path, "/ready") || strings.HasPrefix(path, "/live") || strings.HasPrefix(path, "/api/health") || strings.HasPrefix(path, "/admin/gofly-panel/") {
            c.Next()
            return
        }

        authz := c.GetHeader("Authorization")
        if authz == "" || !strings.HasPrefix(strings.ToLower(authz), "bearer ") {
            if enforce {
                c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "missing internal token"})
                return
            }
            c.Next()
            return
        }

        token := strings.TrimSpace(authz[len("Bearer "):])
        parts := strings.Split(token, ".")
        if len(parts) != 3 {
            if enforce { c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "malformed token"}); return }
            c.Next(); return
        }
        headerPayload := parts[0] + "." + parts[1]
        sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
        if err != nil {
            if enforce { c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "bad signature"}); return }
            c.Next(); return
        }

        if pub != nil {
            h := sha256.Sum256([]byte(headerPayload))
            if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, h[:], sigBytes); err != nil {
                if enforce { c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "signature verify failed"}); return }
                // continue without identity
            } else {
                // parse claims
                payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
                if err == nil {
                    var claims internalClaims
                    if json.Unmarshal(payloadBytes, &claims) == nil {
                        // exp check (soft unless enforce)
                        if claims.Exp > 0 && time.Now().Unix() > claims.Exp {
                            if enforce { c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "token expired"}); return }
                        }
                        if claims.Sub != "" {
                            c.Set("user_id", claims.Sub)
                        }
                        if claims.Role != "" { c.Set("user_role", claims.Role) }
                    }
                }
            }
        }

        c.Next()
    }
}


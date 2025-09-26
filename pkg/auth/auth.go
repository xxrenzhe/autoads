package auth

import (
    "crypto"
    "crypto/rsa"
    "crypto/sha256"
    "crypto/x509"
    "encoding/base64"
    "encoding/json"
    "encoding/pem"
    "errors"
    "net/http"
    "os"
    "strings"
)

var ErrUnauthenticated = errors.New("unauthenticated")

// ExtractUserID tries to infer the authenticated user id from standard headers in this order:
// 1) X-User-Id (explicit forward from trusted layer)
// 2) X-Endpoint-API-UserInfo (GCP API Gateway with Firebase) – base64 JSON, use `sub` or `id` or `email`
// 3) Authorization: Bearer <jwt> – verify RS256 with INTERNAL_JWT_PUBLIC_KEY; if not provided and
//    ALLOW_INSECURE_INTERNAL_JWT=true, parse without verification (dev-only)
func ExtractUserID(r *http.Request) (string, error) {
    // 1) Explicit header
    if uid := r.Header.Get("X-User-Id"); uid != "" {
        return uid, nil
    }

    // 2) GCP API Gateway user info header
    if ui := r.Header.Get("X-Endpoint-API-UserInfo"); ui != "" {
        if uid := parseUserInfo(ui); uid != "" {
            return uid, nil
        }
    }

    // 3) JWT from Authorization
    if authz := r.Header.Get("Authorization"); authz != "" {
        parts := strings.SplitN(authz, " ", 2)
        if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
            token := parts[1]
            if uid := extractUserFromJWT(token); uid != "" {
                return uid, nil
            }
        }
    }

    return "", ErrUnauthenticated
}

func parseUserInfo(b64 string) string {
    // X-Endpoint-API-UserInfo is base64-encoded JSON
    data, err := base64.StdEncoding.DecodeString(b64)
    if err != nil {
        // also try URL encoding variant (no padding)
        data, err = base64.RawURLEncoding.DecodeString(b64)
        if err != nil {
            return ""
        }
    }
    var m map[string]any
    if json.Unmarshal(data, &m) != nil {
        return ""
    }
    // prefer `sub`, fallback `id` or `email`
    if v, ok := m["sub"].(string); ok && v != "" {
        return v
    }
    if v, ok := m["id"].(string); ok && v != "" {
        return v
    }
    if v, ok := m["email"].(string); ok && v != "" {
        return v
    }
    return ""
}

// Info carries basic identity attributes extracted from headers/JWT.
type Info struct {
    UserID string
    Email  string
}

// ExtractInfo returns best-effort user id and email from standard headers.
// Order:
// 1) X-Endpoint-API-UserInfo (preferred: sub + email)
// 2) Authorization: Bearer <jwt> (RS256 verify when key provided; supports email claim)
// 3) X-User-Id (only user id; email may be empty)
func ExtractInfo(r *http.Request) (Info, error) {
    var out Info
    // 1) GCP API Gateway user info header (contains both sub/email)
    if ui := r.Header.Get("X-Endpoint-API-UserInfo"); ui != "" {
        if id, email := parseUserInfoFull(ui); id != "" {
            out.UserID, out.Email = id, email
            return out, nil
        }
    }
    // 2) Authorization: Bearer
    if authz := r.Header.Get("Authorization"); authz != "" {
        parts := strings.SplitN(authz, " ", 2)
        if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
            sub, email := extractFromJWT(parts[1])
            if sub != "" {
                out.UserID, out.Email = sub, email
                return out, nil
            }
        }
    }
    // 3) Fallback explicit header
    if uid := r.Header.Get("X-User-Id"); uid != "" {
        out.UserID = uid
        return out, nil
    }
    return out, ErrUnauthenticated
}

func parseUserInfoFull(b64 string) (sub, email string) {
    data, err := base64.StdEncoding.DecodeString(b64)
    if err != nil {
        data, err = base64.RawURLEncoding.DecodeString(b64)
        if err != nil { return "", "" }
    }
    var m map[string]any
    if json.Unmarshal(data, &m) != nil { return "", "" }
    if v, ok := m["sub"].(string); ok && v != "" { sub = v }
    if v, ok := m["email"].(string); ok && v != "" { email = v }
    if sub == "" {
        if v, ok := m["id"].(string); ok && v != "" { sub = v }
    }
    return
}

func extractFromJWT(token string) (sub, email string) {
    parts := strings.Split(token, ".")
    if len(parts) != 3 { return "", "" }
    _, err1 := base64.RawURLEncoding.DecodeString(parts[0])
    payloadB, err2 := base64.RawURLEncoding.DecodeString(parts[1])
    sigB, err3 := base64.RawURLEncoding.DecodeString(parts[2])
    if err1 != nil || err2 != nil || err3 != nil { return "", "" }
    // verify if public key provided
    if pub := os.Getenv("INTERNAL_JWT_PUBLIC_KEY"); pub != "" {
        if !verifyRS256([]byte(parts[0]+"."+parts[1]), sigB, pub) { return "", "" }
    } else if strings.ToLower(os.Getenv("ALLOW_INSECURE_INTERNAL_JWT")) != "true" {
        return "", ""
    }
    var claims map[string]any
    if json.Unmarshal(payloadB, &claims) != nil { return "", "" }
    if v, ok := claims["sub"].(string); ok && v != "" { sub = v }
    if v, ok := claims["email"].(string); ok && v != "" { email = v }
    return
}

func extractUserFromJWT(token string) string {
    // Expect JWT: header.payload.signature (base64url)
    parts := strings.Split(token, ".")
    if len(parts) != 3 {
        return ""
    }
    _, err1 := base64.RawURLEncoding.DecodeString(parts[0])
    payloadB, err2 := base64.RawURLEncoding.DecodeString(parts[1])
    sigB, err3 := base64.RawURLEncoding.DecodeString(parts[2])
    if err1 != nil || err2 != nil || err3 != nil {
        return ""
    }
    // Verify if public key is provided
    if pub := os.Getenv("INTERNAL_JWT_PUBLIC_KEY"); pub != "" {
        if !verifyRS256([]byte(parts[0]+"."+parts[1]), sigB, pub) {
            return ""
        }
    } else if strings.ToLower(os.Getenv("ALLOW_INSECURE_INTERNAL_JWT")) != "true" {
        // Disallow unverified parsing by default
        return ""
    }
    var claims map[string]any
    if json.Unmarshal(payloadB, &claims) != nil {
        return ""
    }
    if sub, ok := claims["sub"].(string); ok && sub != "" {
        return sub
    }
    return ""
}

func verifyRS256(signingInput, signature []byte, pubPEM string) bool {
    block, _ := pem.Decode([]byte(pubPEM))
    if block == nil {
        return false
    }
    pubIfc, err := x509.ParsePKIXPublicKey(block.Bytes)
    if err != nil {
        return false
    }
    pub, ok := pubIfc.(*rsa.PublicKey)
    if !ok {
        return false
    }
    h := sha256.Sum256(signingInput)
    return rsa.VerifyPKCS1v15(pub, crypto.SHA256, h[:], signature) == nil
}

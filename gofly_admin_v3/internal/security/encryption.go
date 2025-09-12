package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"

	"golang.org/x/crypto/bcrypt"
)

// EncryptionService 加密服务
type EncryptionService struct {
	key []byte
}

// NewEncryptionService 创建加密服务
func NewEncryptionService(secretKey string) *EncryptionService {
	// 使用SHA256生成32字节的密钥
	hash := sha256.Sum256([]byte(secretKey))
	return &EncryptionService{
		key: hash[:],
	}
}

// Encrypt 加密数据
func (e *EncryptionService) Encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}

	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	// 创建GCM模式
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	// 生成随机nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	// 加密数据
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)

	// 返回base64编码的结果
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt 解密数据
func (e *EncryptionService) Decrypt(ciphertext string) (string, error) {
	if ciphertext == "" {
		return "", nil
	}

	// 解码base64
	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}

	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, ciphertext_bytes := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext_bytes, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %w", err)
	}

	return string(plaintext), nil
}

// HashPassword 哈希密码
func (e *EncryptionService) HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPassword 验证密码
func (e *EncryptionService) CheckPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// GenerateSecureToken 生成安全令牌
func (e *EncryptionService) GenerateSecureToken(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(bytes), nil
}

// EncryptSensitiveData 加密敏感数据（如API密钥）
func (e *EncryptionService) EncryptSensitiveData(data map[string]string) (map[string]string, error) {
	encrypted := make(map[string]string)

	for key, value := range data {
		if value == "" {
			encrypted[key] = ""
			continue
		}

		encryptedValue, err := e.Encrypt(value)
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt %s: %w", key, err)
		}
		encrypted[key] = encryptedValue
	}

	return encrypted, nil
}

// DecryptSensitiveData 解密敏感数据
func (e *EncryptionService) DecryptSensitiveData(data map[string]string) (map[string]string, error) {
	decrypted := make(map[string]string)

	for key, value := range data {
		if value == "" {
			decrypted[key] = ""
			continue
		}

		decryptedValue, err := e.Decrypt(value)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt %s: %w", key, err)
		}
		decrypted[key] = decryptedValue
	}

	return decrypted, nil
}

// MaskSensitiveData 掩码敏感数据用于日志
func (e *EncryptionService) MaskSensitiveData(data string) string {
	if len(data) <= 8 {
		return "****"
	}

	return data[:4] + "****" + data[len(data)-4:]
}

// ValidateDataIntegrity 验证数据完整性
func (e *EncryptionService) ValidateDataIntegrity(data, signature string) bool {
	hash := sha256.Sum256([]byte(data + string(e.key)))
	expectedSignature := base64.StdEncoding.EncodeToString(hash[:])
	return expectedSignature == signature
}

// GenerateDataSignature 生成数据签名
func (e *EncryptionService) GenerateDataSignature(data string) string {
	hash := sha256.Sum256([]byte(data + string(e.key)))
	return base64.StdEncoding.EncodeToString(hash[:])
}

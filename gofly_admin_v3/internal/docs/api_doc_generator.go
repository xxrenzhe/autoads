package docs

import (
	"log"
)

// APIDocGenerator API文档生成器
type APIDocGenerator struct {
	initialized bool
}

// DefaultAPIDocGenerator 默认API文档生成器
var DefaultAPIDocGenerator = &APIDocGenerator{}

// GenerateDocumentation 生成API文档
func (g *APIDocGenerator) GenerateDocumentation() error {
	log.Println("API文档生成功能暂时禁用")
	return nil
}

// GenerateAPIDocs 生成API文档
func GenerateAPIDocs() error {
	return DefaultAPIDocGenerator.GenerateDocumentation()
}

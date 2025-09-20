package docs

import (
	"encoding/json"
)

// SwaggerSpec represents the OpenAPI/Swagger specification
type SwaggerSpec struct {
	OpenAPI    string                 `json:"openapi"`
	Info       Info                   `json:"info"`
	Paths      map[string]interface{} `json:"paths"`
	Components map[string]interface{} `json:"components"`
}

// Info contains metadata about the API
type Info struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Version     string `json:"version"`
}

// GetDefaultSwaggerSpec returns a default Swagger specification
func GetDefaultSwaggerSpec(host string) SwaggerSpec {
	return SwaggerSpec{
		OpenAPI: "3.0.0",
		Info: Info{
			Title:       "AutoAds SaaS API",
			Description: "AutoAds SaaS Platform API Documentation",
			Version:     "1.0.0",
		},
		Paths: make(map[string]interface{}),
		Components: map[string]interface{}{
			"schemas": make(map[string]interface{}),
		},
	}
}

// ToJSON converts the SwaggerSpec to JSON bytes
func (s *SwaggerSpec) ToJSON() ([]byte, error) {
	return json.Marshal(s)
}

// PostmanCollection represents a Postman collection
type PostmanCollection struct {
	Info struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Version     string `json:"version"`
	} `json:"info"`
	Item []interface{} `json:"item"`
}

// GetDefaultPostmanCollection returns a default Postman collection
func GetDefaultPostmanCollection(baseURL string) PostmanCollection {
	return PostmanCollection{
		Info: struct {
			Name        string `json:"name"`
			Description string `json:"description"`
			Version     string `json:"version"`
		}{
			Name:        "AutoAds SaaS API",
			Description: "AutoAds SaaS Platform API Collection",
			Version:     "1.0.0",
		},
		Item: make([]interface{}, 0),
	}
}

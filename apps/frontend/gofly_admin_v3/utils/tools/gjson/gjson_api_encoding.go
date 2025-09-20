package gjson

import (
	"gofly-admin-v3/utils/tools/json"

	"gofly-admin-v3/utils/tools/gini"
	"gofly-admin-v3/utils/tools/gproperties"
	"gofly-admin-v3/utils/tools/gtoml"
	"gofly-admin-v3/utils/tools/gxml"
	"gofly-admin-v3/utils/tools/gyaml"
)

// ========================================================================
// JSON
// ========================================================================

func (j *Json) ToJson() ([]byte, error) {
	j.mu.RLock()
	defer j.mu.RUnlock()
	return Encode(*(j.p))
}

func (j *Json) ToJsonString() (string, error) {
	b, e := j.ToJson()
	return string(b), e
}

func (j *Json) ToJsonIndent() ([]byte, error) {
	j.mu.RLock()
	defer j.mu.RUnlock()
	return json.MarshalIndent(*(j.p), "", "\t")
}

func (j *Json) ToJsonIndentString() (string, error) {
	b, e := j.ToJsonIndent()
	return string(b), e
}

func (j *Json) MustToJson() []byte {
	result, err := j.ToJson()
	if err != nil {
		panic(err)
	}
	return result
}

func (j *Json) MustToJsonString() string {
	return string(j.MustToJson())
}

func (j *Json) MustToJsonIndent() []byte {
	result, err := j.ToJsonIndent()
	if err != nil {
		panic(err)
	}
	return result
}

func (j *Json) MustToJsonIndentString() string {
	return string(j.MustToJsonIndent())
}

// ========================================================================
// XML
// ========================================================================

func (j *Json) ToXml(rootTag ...string) ([]byte, error) {
	return gxml.Encode(j.Var().Map(), rootTag...)
}

func (j *Json) ToXmlString(rootTag ...string) (string, error) {
	b, e := j.ToXml(rootTag...)
	return string(b), e
}

func (j *Json) ToXmlIndent(rootTag ...string) ([]byte, error) {
	return gxml.EncodeWithIndent(j.Var().Map(), rootTag...)
}

func (j *Json) ToXmlIndentString(rootTag ...string) (string, error) {
	b, e := j.ToXmlIndent(rootTag...)
	return string(b), e
}

func (j *Json) MustToXml(rootTag ...string) []byte {
	result, err := j.ToXml(rootTag...)
	if err != nil {
		panic(err)
	}
	return result
}

func (j *Json) MustToXmlString(rootTag ...string) string {
	return string(j.MustToXml(rootTag...))
}

func (j *Json) MustToXmlIndent(rootTag ...string) []byte {
	result, err := j.ToXmlIndent(rootTag...)
	if err != nil {
		panic(err)
	}
	return result
}

func (j *Json) MustToXmlIndentString(rootTag ...string) string {
	return string(j.MustToXmlIndent(rootTag...))
}

// ========================================================================
// YAML
// ========================================================================

func (j *Json) ToYaml() ([]byte, error) {
	j.mu.RLock()
	defer j.mu.RUnlock()
	return gyaml.Encode(*(j.p))
}

func (j *Json) ToYamlIndent(indent string) ([]byte, error) {
	j.mu.RLock()
	defer j.mu.RUnlock()
	return gyaml.EncodeIndent(*(j.p), indent)
}

func (j *Json) ToYamlString() (string, error) {
	b, e := j.ToYaml()
	return string(b), e
}

func (j *Json) MustToYaml() []byte {
	result, err := j.ToYaml()
	if err != nil {
		panic(err)
	}
	return result
}

func (j *Json) MustToYamlString() string {
	return string(j.MustToYaml())
}

// ========================================================================
// TOML
// ========================================================================

func (j *Json) ToToml() ([]byte, error) {
	j.mu.RLock()
	defer j.mu.RUnlock()
	return gtoml.Encode(*(j.p))
}

func (j *Json) ToTomlString() (string, error) {
	b, e := j.ToToml()
	return string(b), e
}

func (j *Json) MustToToml() []byte {
	result, err := j.ToToml()
	if err != nil {
		panic(err)
	}
	return result
}

func (j *Json) MustToTomlString() string {
	return string(j.MustToToml())
}

// ========================================================================
// INI
// ========================================================================

// ToIni json to ini
func (j *Json) ToIni() ([]byte, error) {
	return gini.Encode(j.Map())
}

// ToIniString ini to string
func (j *Json) ToIniString() (string, error) {
	b, e := j.ToIni()
	return string(b), e
}

func (j *Json) MustToIni() []byte {
	result, err := j.ToIni()
	if err != nil {
		panic(err)
	}
	return result
}

// MustToIniString .
func (j *Json) MustToIniString() string {
	return string(j.MustToIni())
}

// ========================================================================
// properties
// ========================================================================
// Toproperties json to properties
func (j *Json) ToProperties() ([]byte, error) {
	return gproperties.Encode(j.Map())
}

// ToPropertiesString properties to string
func (j *Json) ToPropertiesString() (string, error) {
	b, e := j.ToProperties()
	return string(b), e
}

func (j *Json) MustToProperties() []byte {
	result, err := j.ToProperties()
	if err != nil {
		panic(err)
	}
	return result
}

// MustToPropertiesString
func (j *Json) MustToPropertiesString() string {
	return string(j.MustToProperties())
}
